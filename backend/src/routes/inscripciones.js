const express = require('express')
const db = require('../config/db')
const { verifyToken, requireRole } = require('../middlewares/auth')
const { temporadaDeFecha, precioAjustado } = require('../lib/temporada')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')

// Color de brazalete por tipo de asistente
const BRAZALETE = { cliente: 'morado', turista: 'coral' }

// Política de reembolso cuando el ASISTENTE (cliente/turista) cancela su
// inscripción, según las horas de anticipación con que cancela:
//   ≥ 72 h            → 100% de devolución
//   ≥ 48 h y < 72 h   →  70%
//   ≥ 24 h y < 48 h   →  50%
//   < 24 h            →   0% (no aplica reembolso)
const politicaReembolso = (horas) => {
  if (horas >= 72) return { pct: 100, regla: '72 horas o más antes del evento' }
  if (horas >= 48) return { pct: 70,  regla: 'entre 48 y 72 horas antes del evento' }
  if (horas >= 24) return { pct: 50,  regla: 'entre 24 y 48 horas antes del evento' }
  return { pct: 0, regla: 'menos de 24 horas antes del evento' }
}

// Noches (inclusivas) que dura un congreso: del 10 al 12 = 3 noches.
const nochesCongreso = (ini, fin) => {
  const d = Math.floor((new Date(fin) - new Date(ini)) / 86400000) + 1
  return d > 0 ? d : 1
}

// Coordinador: ve todas las inscripciones
router.get('/', verifyToken, requireRole('coordinador'), async (req, res) => {
  const { congreso_id } = req.query
  const [rows] = await db.query(
    `SELECT i.*, CONCAT(u.nombre,' ',u.apellidos) as cliente_nombre, u.email
     FROM inscripciones i JOIN usuarios u ON u.id=i.cliente_id
     WHERE (? IS NULL OR i.congreso_id=?) ORDER BY i.created_at DESC`,
    [congreso_id || null, congreso_id || null]
  )
  res.json(rows)
})

// Asistente: ve sus propias inscripciones (folio + brazalete)
router.get('/mias', verifyToken, requireRole('cliente'), async (req, res) => {
  const [rows] = await db.query(
    `SELECT i.*, c.nombre AS congreso_nombre, c.fecha_inicio
     FROM inscripciones i JOIN congresos c ON c.id=i.congreso_id
     WHERE i.cliente_id=? ORDER BY i.created_at DESC`, [req.user.id]
  )
  res.json(rows)
})

// Inscribirse a un congreso
router.post('/', verifyToken, requireRole('cliente'), async (req, res) => {
  const { congreso_id } = req.body
  if (!congreso_id) return res.status(400).json({ error: 'congreso_id requerido' })

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    // El tipo de asistente y la empresa NO los elige el usuario: se toman de su
    // cuenta (la empresa se capturó al registrarse). Un cliente viene de una
    // empresa; un turista viene por su cuenta.
    const [[u]] = await conn.query(
      'SELECT tipo_cuenta, empresa FROM usuarios WHERE id=?', [req.user.id]
    )
    const tipo_asistente = u?.tipo_cuenta === 'turista' ? 'turista' : 'cliente'
    const empresa_representada = tipo_asistente === 'cliente' ? (u?.empresa || null) : null

    const [[congreso]] = await conn.query(
      'SELECT estado, cuota_recuperacion, cuota_turista, aforo_max, fecha_inicio, fecha_fin FROM congresos WHERE id=? FOR UPDATE',
      [congreso_id]
    )
    if (!congreso) { await conn.rollback(); return res.status(404).json({ error: 'Congreso no encontrado' }) }
    // El cliente puede inscribirse a CUALQUIER congreso; solo se bloquean los
    // congresos cancelados o reembolsados (ya no tiene sentido inscribirse).
    if (['cancelado', 'reembolsado'].includes(congreso.estado)) {
      await conn.rollback()
      return res.status(400).json({ error: 'Este congreso fue cancelado o reembolsado' })
    }

    const [ya] = await conn.query(
      "SELECT id FROM inscripciones WHERE congreso_id=? AND cliente_id=? AND estado!='cancelada'",
      [congreso_id, req.user.id]
    )
    if (ya.length) { await conn.rollback(); return res.status(409).json({ error: 'Ya estás inscrito en este congreso' }) }

    // Contador de inscritos vigentes (las canceladas liberan su lugar) y
    // validación del aforo: si ya se llenó, no se permite una más.
    const [[{ inscritos }]] = await conn.query(
      "SELECT COUNT(*) AS inscritos FROM inscripciones WHERE congreso_id=? AND estado!='cancelada'",
      [congreso_id]
    )
    if (congreso.aforo_max > 0 && inscritos >= congreso.aforo_max) {
      await conn.rollback()
      return res.status(409).json({ error: 'Cupo lleno: este congreso ya alcanzó su aforo máximo' })
    }

    // Al CLIENTE no se le cobra la entrada (cuota 0). El TURISTA paga la cuota
    // turista que fijó el coordinador para poder ingresar.
    const monto = tipo_asistente === 'turista' ? Number(congreso.cuota_turista) : 0
    const brazalete = BRAZALETE[tipo_asistente]
    const folio = 'RMC-' + uuidv4().substring(0, 8).toUpperCase()

    const [r] = await conn.query(
      `INSERT INTO inscripciones
         (congreso_id,cliente_id,folio,tipo_asistente,empresa_representada,monto_pagado,brazalete)
       VALUES (?,?,?,?,?,?,?)`,
      [congreso_id, req.user.id, folio, tipo_asistente, empresa_representada, monto, brazalete]
    )

    // ── La habitación del CLIENTE abarca las NOCHES que dura el congreso ──
    // Se ajusta su habitación incluida (origen 'default') para que cubra todas
    // las noches del evento, con la fecha de inicio y la temporada del congreso.
    if (tipo_asistente === 'cliente') {
      const noches = nochesCongreso(congreso.fecha_inicio, congreso.fecha_fin)
      
      // SOLUCIÓN: Extraemos las partes de la fecha de forma segura para MySQL
      const dIni = new Date(congreso.fecha_inicio)
      const yyyy = dIni.getFullYear()
      const mm = String(dIni.getMonth() + 1).padStart(2, '0')
      const dd = String(dIni.getDate()).padStart(2, '0')
      const fechaIni = `${yyyy}-${mm}-${dd}`

      const temporada = temporadaDeFecha(fechaIni)

      const [[reservaDef]] = await conn.query(
        `SELECT r.id, t.precio_noche, t.deposito_pct
           FROM reservas_habitacion r JOIN tipos_habitacion t ON t.id=r.tipo_habitacion_id
          WHERE r.usuario_id=? AND r.origen='default' AND r.estado='activa'
          ORDER BY r.created_at DESC LIMIT 1`,
        [req.user.id]
      )

      if (reservaDef) {
        const precio = precioAjustado(reservaDef.precio_noche, temporada)
        const total = precio * noches
        const deposito = Math.round((total * (reservaDef.deposito_pct || 0)) / 100)
        await conn.query(
          'UPDATE reservas_habitacion SET noches=?, fecha_inicio=?, temporada=?, precio_noche_snap=?, total=?, deposito=? WHERE id=?',
          [noches, fechaIni, temporada, precio, total, deposito, reservaDef.id]
        )
      } else {
        // Si aún no tenía habitación incluida, se le crea una estándar que ya
        // cubre las noches del congreso.
        const [[estandar]] = await conn.query("SELECT * FROM tipos_habitacion WHERE codigo='estandar'")
        if (estandar) {
          const precio = precioAjustado(estandar.precio_noche, temporada)
          const total = precio * noches
          const deposito = Math.round((total * (estandar.deposito_pct || 0)) / 100)
          const folHab = 'HAB-' + uuidv4().substring(0, 8).toUpperCase()
          await conn.query(
            `INSERT INTO reservas_habitacion
               (usuario_id,tipo_habitacion_id,folio,noches,huespedes,fecha_inicio,temporada,precio_noche_snap,total,deposito,origen)
             VALUES (?,?,?,?,?,?,?,?,?,?, 'default')`,
            [req.user.id, estandar.id, folHab, noches, 1, fechaIni, temporada, precio, total, deposito]
          )
        }
      }
    }

    await conn.commit()

    // Devolvemos el cupo actualizado para que el frontend refresque el contador.
    const ocupados = inscritos + 1
    const disponibles = congreso.aforo_max > 0 ? Math.max(0, congreso.aforo_max - ocupados) : null
    res.status(201).json({
      message: 'Inscripción exitosa', folio, id: r.insertId, monto, brazalete, tipo_asistente,
      empresa: empresa_representada,
      aforo_max: congreso.aforo_max, inscritos: ocupados, disponibles,
      lleno: congreso.aforo_max > 0 && ocupados >= congreso.aforo_max,
    })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ error: e.message })
  } finally { conn.release() }
})

router.put('/:id/estado', verifyToken, requireRole('coordinador'), async (req, res) => {
  await db.query('UPDATE inscripciones SET estado=? WHERE id=?', [req.body.estado, req.params.id])
  res.json({ message: 'Actualizado' })
})

// ── El ASISTENTE (cliente / turista) cancela su PROPIA inscripción ──
// Se aplica la política de reembolso según la anticipación con que cancela.
router.put('/:id/cancelar', verifyToken, requireRole('cliente'), async (req, res) => {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [[insc]] = await conn.query(
      `SELECT i.*, c.fecha_inicio, c.nombre AS congreso_nombre
         FROM inscripciones i JOIN congresos c ON c.id = i.congreso_id
        WHERE i.id = ? FOR UPDATE`,
      [req.params.id]
    )
    if (!insc) { await conn.rollback(); return res.status(404).json({ error: 'Inscripción no encontrada' }) }
    if (insc.cliente_id !== req.user.id) {
      await conn.rollback()
      return res.status(403).json({ error: 'No puedes cancelar una inscripción que no es tuya' })
    }
    if (insc.estado === 'cancelada') {
      await conn.rollback()
      return res.status(400).json({ error: 'Esta inscripción ya está cancelada' })
    }

    // Horas que faltan para el inicio del congreso (fecha_inicio a las 00:00).
    const inicio = new Date(insc.fecha_inicio)
    const horas = (inicio.getTime() - Date.now()) / 3_600_000
    const { pct, regla } = politicaReembolso(horas)

    const pagado = Number(insc.monto_pagado) || 0
    const reembolso = Math.round(pagado * pct) / 100   // 2 decimales
    const huboReembolso = pct > 0 && pagado > 0

    await conn.query(
      "UPDATE inscripciones SET estado='cancelada', estado_pago=? WHERE id=?",
      [huboReembolso ? 'reembolsado' : insc.estado_pago, req.params.id]
    )

    await conn.commit()

    const detalle = pagado > 0
      ? ` Te corresponde un reembolso del ${pct}% ($${reembolso.toLocaleString('es-MX')} MXN).`
      : ' No habías realizado ningún pago, por lo que no aplica reembolso.'

    res.json({
      message: 'Inscripción cancelada',
      porcentaje: pct,
      reembolso,
      monto_pagado: pagado,
      politica: `Cancelaste con ${regla}: reembolso del ${pct}%.${detalle}`,
    })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ error: e.message })
  } finally { conn.release() }
})

module.exports = router
