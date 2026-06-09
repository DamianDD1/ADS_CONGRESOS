const express = require('express')
const db = require('../config/db')
const { verifyToken, requireRole } = require('../middlewares/auth')
const router = express.Router()
 
const TIPOS = ['academico', 'empresarial', 'feria', 'seminario', 'productos']
const METODOS = ['tarjeta', 'digital', 'pasarela']
 
// Días inclusivos entre dos fechas (10→12 = 3 días)
const diasEvento = (ini, fin) => {
  const d = Math.floor((new Date(fin) - new Date(ini)) / 86400000) + 1
  return d > 0 ? d : 0
}
 
// ───────────── LISTAR ─────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, CONCAT(u.nombre,' ',u.apellidos) AS coordinador_nombre,
              (SELECT COUNT(*) FROM inscripciones i
                WHERE i.congreso_id = c.id AND i.estado <> 'cancelada') AS inscritos
       FROM congresos c JOIN usuarios u ON u.id = c.coordinador_id
       ORDER BY c.fecha_inicio DESC`
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})
 
// ───────────── PÚBLICOS (para la página de inicio, sin login) ─────────────
router.get('/publicos', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nombre, organizador, tematica, tipo_congreso, sede, imagen_url,
              aforo_max, cuota_recuperacion, cuota_turista, descripcion,
              fecha_inicio, fecha_fin, estado,
              (SELECT COUNT(*) FROM inscripciones i
                WHERE i.congreso_id = congresos.id AND i.estado <> 'cancelada') AS inscritos
       FROM congresos
       WHERE estado IN ('planeacion','activo','cerrado')
         AND (fecha_fin >= CURDATE() OR fecha_fin >= DATE_SUB(CURDATE(), INTERVAL 60 DAY))
       ORDER BY
         (fecha_fin < CURDATE()) ASC,                                  -- en curso/próximos primero, terminados al final
         FIELD(estado,'activo','planeacion','cerrado'),
         CASE WHEN fecha_fin < CURDATE() THEN fecha_fin END DESC,      -- entre terminados, el más reciente arriba
         fecha_inicio ASC
       LIMIT 24`
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})
 
// ───────────── DETALLE (incluye salones + proveedores) ─────────────
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [[congreso]] = await db.query(
      `SELECT c.*, CONCAT(u.nombre,' ',u.apellidos) AS coordinador_nombre,
              (SELECT COUNT(*) FROM inscripciones i
                WHERE i.congreso_id = c.id AND i.estado <> 'cancelada') AS inscritos
       FROM congresos c JOIN usuarios u ON u.id = c.coordinador_id WHERE c.id=?`,
      [req.params.id]
    )
    if (!congreso) return res.status(404).json({ error: 'Congreso no encontrado' })
    const [salones] = await db.query(
      `SELECT cs.cantidad, cs.costo_dia_snap, cs.capacidad_snap, s.codigo, s.nombre
       FROM congreso_salones cs JOIN salones s ON s.id = cs.salon_id WHERE cs.congreso_id=?`,
      [req.params.id]
    )
    const [proveedores] = await db.query(
      `SELECT cp.id, cp.origen, cp.estado, pd.empresa, cs.nombre AS categoria
       FROM congreso_proveedores cp
       JOIN proveedores_detalle pd ON pd.id = cp.proveedor_id
       JOIN categorias_servicio cs ON cs.id = pd.categoria_id
       WHERE cp.congreso_id=?`,
      [req.params.id]
    )
    res.json({ ...congreso, salones, proveedores })
  } catch (e) { res.status(500).json({ error: e.message }) }
})
 
// ───────────── CREAR ─────────────
router.post('/', verifyToken, requireRole('coordinador'), async (req, res) => {
  const {
    nombre, organizador, descripcion, tematica, tipo_congreso, sede, imagen_url,
    cuota_recuperacion = 0, cuota_turista = 0, msi = 0, fecha_inicio, fecha_fin,
    salones = [], modulos_stands = null,
    incluye_talleres = false, incluye_conferencias = false, permite_subapartados = false,
    permite_postulacion = true, proveedores_asociados = [], pago = {},
  } = req.body
 
  if (!nombre || !fecha_inicio || !fecha_fin)
    return res.status(400).json({ error: 'Nombre y fechas son obligatorios' })
  if (tipo_congreso && !TIPOS.includes(tipo_congreso))
    return res.status(400).json({ error: 'Tipo de congreso inválido' })
  const dias = diasEvento(fecha_inicio, fecha_fin)
  if (dias <= 0) return res.status(400).json({ error: 'La fecha fin debe ser igual o posterior a la de inicio' })
  if (!Array.isArray(salones) || salones.length === 0)
    return res.status(400).json({ error: 'Debes seleccionar al menos un salón' })
  if (tipo_congreso && tipo_congreso !== 'academico' && (modulos_stands == null || modulos_stands < 0))
    return res.status(400).json({ error: 'Indica el número de módulos/stands' })
 
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
 
    let costoTotal = 0, aforoTotal = 0
    const reservas = []
    for (const sel of salones) {
      // Bloqueamos la fila del salón (FOR UPDATE) para que dos congresos no
      // puedan reservar la misma unidad al mismo tiempo.
      const [[cat]] = await conn.query(
        'SELECT * FROM salones WHERE codigo=? AND activo=1 FOR UPDATE', [sel.salon_id]
      )
      if (!cat) throw new Error(`Salón desconocido: ${sel.salon_id}`)
      const cant = parseInt(sel.cantidad) || 1

      // Unidades ya ocupadas por otros congresos vivos (planeación/activo/borrador)
      // CUYO RANGO DE FECHAS SE TRASLAPA con el del congreso que se está creando.
      // De este modo un salón usado por un congreso que termina antes (p. ej. el
      // día 9) queda libre para otro que empiece después (p. ej. el día 10).
      const [[{ ocupadas }]] = await conn.query(
        `SELECT COALESCE(SUM(cs.cantidad),0) AS ocupadas
           FROM congreso_salones cs JOIN congresos c ON c.id = cs.congreso_id
          WHERE cs.salon_id = ? AND c.estado IN ('borrador','planeacion','activo')
            AND c.fecha_inicio <= ? AND c.fecha_fin >= ?`,
        [cat.id, fecha_fin, fecha_inicio]
      )
      const disponibles = cat.stock - Number(ocupadas)
      if (disponibles <= 0)
        throw new Error(`"${cat.nombre}" no está disponible: todas sus unidades están ocupadas hasta que se desocupe`)
      if (cant < 1 || cant > disponibles)
        throw new Error(`"${cat.nombre}" solo tiene ${disponibles} unidad(es) disponible(s)`)

      costoTotal += Number(cat.costo_dia) * cant * dias
      aforoTotal += cat.capacidad * cant
      reservas.push({ id: cat.id, cant, costo: cat.costo_dia, cap: cat.capacidad })
    }
 
    // Insertar congreso (Restaurado a su estado original correcto)
    const [r] = await conn.query(
      `INSERT INTO congresos
        (nombre,organizador,descripcion,tematica,tipo_congreso,sede,imagen_url,aforo_max,
         cuota_recuperacion,cuota_turista,msi,modulos_stands,incluye_talleres,incluye_conferencias,permite_subapartados,
         permite_postulacion,costo_total_salones,coordinador_id,fecha_inicio,fecha_fin,estado)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'planeacion')`,
      [nombre, organizador, descripcion, tematica, tipo_congreso || 'empresarial', sede, imagen_url,
       aforoTotal, cuota_recuperacion, cuota_turista, msi, tipo_congreso === 'academico' ? null : modulos_stands,
       !!incluye_talleres, !!incluye_conferencias, !!permite_subapartados,
       !!permite_postulacion, costoTotal, req.user.id, fecha_inicio, fecha_fin]
    )
    const congresoId = r.insertId
 
    for (const rv of reservas) {
      await conn.query(
        `INSERT INTO congreso_salones (congreso_id,salon_id,cantidad,costo_dia_snap,capacidad_snap)
         VALUES (?,?,?,?,?)`,
        [congresoId, rv.id, rv.cant, rv.costo, rv.cap]
      )
    }
 
    for (const provId of proveedores_asociados) {
      await conn.query(
        `INSERT IGNORE INTO congreso_proveedores (congreso_id,proveedor_id,origen,estado)
         VALUES (?,?, 'invitado','aprobado')`,
        [congresoId, provId]
      )
      // Notificar al proveedor que fue seleccionado para este congreso
      const [[pd]] = await conn.query(
        `SELECT pd.id, pd.empresa, u.id AS usuario_id
         FROM proveedores_detalle pd JOIN usuarios u ON u.id = pd.usuario_id
         WHERE pd.id = ?`, [provId]
      )
      if (pd) {
        const fmtFecha = (f) => new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
        const horaInicio = '09:00'
        const mensajeProv = `¡Felicidades! Tu empresa "${pd.empresa}" ha sido seleccionada para ofrecer sus servicios en el congreso "${nombre}". Preséntate en ${sede} el día ${fmtFecha(fecha_inicio)} a las ${horaInicio} hrs. El evento concluye el ${fmtFecha(fecha_fin)}.`
        await conn.query(
          `INSERT INTO notificaciones_proveedor (usuario_id, congreso_id, tipo, mensaje)
           VALUES (?, ?, 'asignacion', ?)`,
          [pd.usuario_id, congresoId, mensajeProv]
        )
      }
    }
 
    // Registrar el pago de salones (AQUÍ ESTABA EL ERROR: Agregado monto_total)
    const metodosValidos = ['tarjeta', 'digital', 'pasarela']
    await conn.query(
      `INSERT INTO pagos (congreso_id,pagador_id,concepto,metodo,monto,monto_total,estado,requiere_factura,rfc,razon_social,uso_cfdi)
       VALUES (?,?, 'salones', ?, ?, ?, 'pendiente', ?, ?, ?, ?)`,
      [congresoId, req.user.id,
       metodosValidos.includes(pago.metodo) ? pago.metodo : 'tarjeta',
       costoTotal, costoTotal, pago.requiere_factura ? 1 : 0,
       pago.rfc || null, pago.razon_social || null, pago.uso_cfdi || 'G03']
    )
 
    await conn.commit()
    res.status(201).json({ message: 'Congreso creado', id: congresoId, costo_total_salones: costoTotal, aforo_total: aforoTotal })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})
 
// ───────────── ACTUALIZAR (datos generales) ─────────────
router.put('/:id', verifyToken, requireRole('coordinador'), async (req, res) => {
  const { nombre, descripcion, tematica, sede, estado, fecha_inicio, fecha_fin, permite_postulacion } = req.body
  try {
    await db.query(
      `UPDATE congresos SET nombre=?,descripcion=?,tematica=?,sede=?,estado=?,
        fecha_inicio=?,fecha_fin=?,permite_postulacion=?
       WHERE id=? AND coordinador_id=?`,
      [nombre, descripcion, tematica, sede, estado, fecha_inicio, fecha_fin,
       permite_postulacion ? 1 : 0, req.params.id, req.user.id]
    )
    res.json({ message: 'Actualizado' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})
 
// ───────────── ¿LISTO PARA INICIAR? (checklist) ─────────────
router.get('/:id/listo', verifyToken, requireRole('coordinador'), async (req, res) => {
  try {
    const [[c]] = await db.query('SELECT * FROM congresos WHERE id=? AND coordinador_id=?', [req.params.id, req.user.id])
    if (!c) return res.status(404).json({ error: 'Congreso no encontrado' })
    const [[{ n: nSalones }]] = await db.query('SELECT COUNT(*) n FROM congreso_salones WHERE congreso_id=?', [req.params.id])
    // Válido mientras el evento no haya terminado (permite iniciarlo el mismo día de inicio)
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const fin = new Date(c.fecha_fin); fin.setHours(0, 0, 0, 0)
 
    const checks = [
      { ok: nSalones > 0,                  label: 'Tiene al menos un salón asignado' },
      { ok: c.estado_pago === 'liquidado', label: 'El congreso está liquidado' },
      { ok: c.estado !== 'cancelado',      label: 'No está cancelado' },
      { ok: fin >= hoy,                    label: 'El evento no ha finalizado' },
    ]
    res.json({ puede_iniciar: checks.every(x => x.ok), estado: c.estado, checks })
  } catch (e) { res.status(500).json({ error: e.message }) }
})
 
// ───────────── INICIAR (activar) CONGRESO ─────────────
router.put('/:id/iniciar', verifyToken, requireRole('coordinador'), async (req, res) => {
  try {
    const [[c]] = await db.query('SELECT * FROM congresos WHERE id=? AND coordinador_id=?', [req.params.id, req.user.id])
    if (!c) return res.status(404).json({ error: 'Congreso no encontrado' })
    const [[{ n: nSalones }]] = await db.query('SELECT COUNT(*) n FROM congreso_salones WHERE congreso_id=?', [req.params.id])
    if (nSalones === 0) return res.status(400).json({ error: 'Asigna al menos un salón antes de iniciar' })
    if (c.estado_pago !== 'liquidado') return res.status(400).json({ error: 'El congreso debe estar liquidado para iniciarse' })
    if (c.estado === 'cancelado') return res.status(400).json({ error: 'El congreso está cancelado' })
    // El evento solo se puede iniciar mientras no haya finalizado (se permite el mismo día de inicio)
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const fin = new Date(c.fecha_fin); fin.setHours(0, 0, 0, 0)
    if (fin < hoy) return res.status(400).json({ error: 'El congreso ya finalizó y no puede iniciarse' })
 
    await db.query("UPDATE congresos SET estado='activo' WHERE id=?", [req.params.id])
    res.json({ message: 'Congreso iniciado', estado: 'activo' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})
 
// ───────────── LIQUIDAR CONGRESO ─────────────
router.put('/:id/liquidar', verifyToken, requireRole('coordinador'), async (req, res) => {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[c]] = await conn.query(
      'SELECT * FROM congresos WHERE id=? AND coordinador_id=?', [req.params.id, req.user.id]
    )
    if (!c) throw new Error('Congreso no encontrado')
    if (c.estado === 'cancelado')   throw new Error('El congreso está cancelado')
    if (c.estado === 'reembolsado') throw new Error('El congreso fue reembolsado')
    if (c.estado_pago === 'liquidado') throw new Error('El congreso ya está liquidado')
 
    const dias = Math.floor((new Date(c.fecha_inicio) - new Date()) / 86400000)
    let multa = 0
    if (dias < 15) multa = Number(c.costo_total_salones) * 0.15   
    const total = Number(c.costo_total_salones) + multa
 
    await conn.query(
      "UPDATE congresos SET estado_pago='liquidado', monto_pagado=?, multa_aplicada=? WHERE id=?",
      [total, multa, req.params.id]
    )
    await conn.query(
      "UPDATE pagos SET estado='pagado' WHERE congreso_id=? AND concepto='salones'",
      [req.params.id]
    )
    // Agregado monto_total aquí también por si acaso
    if (multa > 0) {
      await conn.query(
        `INSERT INTO pagos (congreso_id,pagador_id,concepto,metodo,monto,monto_total,estado,requiere_factura)
         VALUES (?,?, 'multa','tarjeta', ?, ?, 'pagado', 0)`,
        [req.params.id, req.user.id, multa, multa]
      )
    }
 
    await conn.commit()
    res.json({
      message: 'Congreso liquidado',
      estado_pago: 'liquidado',
      multa_aplicada: multa,
      monto_pagado: total,
      nota: multa > 0 ? 'Se aplicó una multa del 15% por liquidar con menos de 15 días' : null,
    })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally { conn.release() }
})
 
// ───────────── REEMBOLSO TOTAL ─────────────
router.put('/:id/reembolsar', verifyToken, requireRole('coordinador'), async (req, res) => {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[c]] = await conn.query(
      'SELECT * FROM congresos WHERE id=? AND coordinador_id=?', [req.params.id, req.user.id]
    )
    if (!c) throw new Error('Congreso no encontrado')
    if (c.estado === 'reembolsado') throw new Error('El congreso ya fue reembolsado')
 
    await conn.query(
      `UPDATE inscripciones SET estado='cancelada', estado_pago='reembolsado'
       WHERE congreso_id=? AND estado_pago='pagado'`, [req.params.id]
    )
    await conn.query(
      "UPDATE pagos SET estado='reembolsado' WHERE congreso_id=? AND estado='pagado'", [req.params.id]
    )
 
    await conn.query(
      "UPDATE congresos SET estado='reembolsado', estado_pago='pendiente', monto_pagado=0 WHERE id=?",
      [req.params.id]
    )
    await conn.commit()
    res.json({ message: 'Reembolso aplicado', estado: 'reembolsado', asistentes_reembolsados: '100% de su cuota' })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally { conn.release() }
})
 
// ───────────── CANCELACIÓN POR EL ORGANIZADOR ─────────────
router.put('/:id/cancelar', verifyToken, requireRole('coordinador'), async (req, res) => {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[c]] = await conn.query(
      'SELECT * FROM congresos WHERE id=? AND coordinador_id=?', [req.params.id, req.user.id]
    )
    if (!c) throw new Error('Congreso no encontrado')
    if (c.estado === 'cancelado') throw new Error('El congreso ya está cancelado')
 
    const dias = Math.floor((new Date(c.fecha_inicio) - new Date()) / 86400000)
    let reembolsoOrganizador = 0
    if (dias >= 15) reembolsoOrganizador = Number(c.monto_pagado) * 0.5  
 
    await conn.query(
      `UPDATE inscripciones SET estado='cancelada', estado_pago='reembolsado'
       WHERE congreso_id=? AND estado_pago='pagado'`, [req.params.id]
    )
    await conn.query(
      `UPDATE pagos SET estado='reembolsado'
       WHERE congreso_id=? AND concepto='cuota_asistente' AND estado='pagado'`, [req.params.id]
    )
 
    await conn.query('UPDATE congresos SET estado=? WHERE id=?', ['cancelado', req.params.id])

    // Notificar a los proveedores asociados que el congreso fue cancelado
    // Los salones quedan automáticamente libres porque la query de disponibilidad
    // excluye congresos con estado='cancelado'
    const [provsCancelados] = await conn.query(
      `SELECT u.id AS usuario_id, pd.empresa
       FROM congreso_proveedores cp
       JOIN proveedores_detalle pd ON pd.id = cp.proveedor_id
       JOIN usuarios u ON u.id = pd.usuario_id
       WHERE cp.congreso_id = ?`, [req.params.id]
    )
    const fmtFechaCnc = (f) => new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    for (const pv of provsCancelados) {
      const msgCnc = `Lamentamos informarte que el congreso "${c.nombre}" (programado del ${fmtFechaCnc(c.fecha_inicio)} al ${fmtFechaCnc(c.fecha_fin)} en ${c.sede}) ha sido cancelado. Tu participación como proveedor queda sin efecto.`
      await conn.query(
        `INSERT INTO notificaciones_proveedor (usuario_id, congreso_id, tipo, mensaje) VALUES (?, ?, 'cancelacion', ?)`,
        [pv.usuario_id, req.params.id, msgCnc]
      )
    }

    await conn.commit()
    res.json({
      message: 'Congreso cancelado',
      reembolso_organizador: reembolsoOrganizador,
      politica: dias >= 15 ? 'Reembolso del 50% de salones (canceló con ≥15 días)'
                           : 'Sin reembolso de salones (canceló con menos de 15 días)',
      asistentes_reembolsados: '100% de su cuota',
    })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally { conn.release() }
})
 
// ───────────── ELIMINAR ─────────────
router.delete('/:id', verifyToken, requireRole('coordinador'), async (req, res) => {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[c]] = await conn.query(
      'SELECT id, nombre, fecha_inicio, fecha_fin, sede FROM congresos WHERE id=? AND coordinador_id=?',
      [req.params.id, req.user.id]
    )
    if (!c) { await conn.rollback(); return res.status(404).json({ error: 'Congreso no encontrado' }) }

    // Notificar proveedores antes de eliminar (ON DELETE CASCADE borrará registros)
    const [provsElim] = await conn.query(
      `SELECT u.id AS usuario_id, pd.empresa
       FROM congreso_proveedores cp
       JOIN proveedores_detalle pd ON pd.id = cp.proveedor_id
       JOIN usuarios u ON u.id = pd.usuario_id
       WHERE cp.congreso_id = ?`, [req.params.id]
    )
    const fmtFechaElim = (f) => new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    for (const pv of provsElim) {
      const msgElim = `El congreso "${c.nombre}" (${fmtFechaElim(c.fecha_inicio)} – ${fmtFechaElim(c.fecha_fin)}, ${c.sede}) ha sido eliminado del sistema. Tu participación como proveedor queda sin efecto y los salones han sido liberados.`
      await conn.query(
        `INSERT INTO notificaciones_proveedor (usuario_id, congreso_id, tipo, mensaje) VALUES (?, ?, 'cancelacion', ?)`,
        [pv.usuario_id, req.params.id, msgElim]
      )
    }

    await conn.query('DELETE FROM congresos WHERE id=? AND coordinador_id=?', [req.params.id, req.user.id])
    await conn.commit()
    res.json({ message: 'Eliminado' })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ error: e.message })
  } finally { conn.release() }
})
 
module.exports = router