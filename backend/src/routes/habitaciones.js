const express = require('express')
const db = require('../config/db')
const { verifyToken, requireRole } = require('../middlewares/auth')
const { temporadaDeFecha, precioAjustado, ETIQUETA } = require('../lib/temporada')
const { v4: uuidv4 } = require('uuid')
const router = express.Router()

const folio = () => 'HAB-' + uuidv4().substring(0, 8).toUpperCase()

// Calcula los importes de una reserva a partir del tipo, noches y temporada.
function calcular(tipo, noches, fechaInicio) {
  const temporada = fechaInicio ? temporadaDeFecha(fechaInicio) : 'baja'
  const precioNoche = precioAjustado(tipo.precio_noche, temporada)
  const total = precioNoche * noches
  const deposito = Math.round((total * (tipo.deposito_pct || 0)) / 100)
  return { temporada, precioNoche, total, deposito }
}

// Habitaciones disponibles de un tipo (stock - reservas activas), dentro de tx.
async function disponibles(conn, tipoId) {
  const [[t]] = await conn.query('SELECT stock FROM tipos_habitacion WHERE id=?', [tipoId])
  const [[{ usadas }]] = await conn.query(
    "SELECT COUNT(*) AS usadas FROM reservas_habitacion WHERE tipo_habitacion_id=? AND estado='activa'",
    [tipoId]
  )
  return (t?.stock || 0) - usadas
}

// ─────────────── CATÁLOGO PÚBLICO ───────────────
// Tipos de habitación con disponibilidad. Sirve a la landing y al panel.
router.get('/catalogo', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*,
              (t.stock - COALESCE((
                 SELECT COUNT(*) FROM reservas_habitacion r
                 WHERE r.tipo_habitacion_id=t.id AND r.estado='activa'), 0)) AS disponibles
       FROM tipos_habitacion t
       WHERE t.activo=1 ORDER BY t.nivel`
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────── MIS RESERVAS (cliente / turista) ───────────────
// Al cliente de empresa se le asegura su habitación ESTÁNDAR por defecto.
router.get('/mias', verifyToken, requireRole('cliente'), async (req, res) => {
  try {
    const [[u]] = await db.query('SELECT tipo_cuenta FROM usuarios WHERE id=?', [req.user.id])
    const tipoCuenta = u?.tipo_cuenta || 'cliente'

    if (tipoCuenta === 'cliente') {
      const [yaDefault] = await db.query(
        "SELECT id FROM reservas_habitacion WHERE usuario_id=? AND origen='default' AND estado='activa'",
        [req.user.id]
      )
      if (!yaDefault.length) {
        const [[estandar]] = await db.query("SELECT * FROM tipos_habitacion WHERE codigo='estandar'")
        if (estandar) {
          const { temporada, precioNoche, total, deposito } = calcular(estandar, 1, null)
          await db.query(
            `INSERT INTO reservas_habitacion
               (usuario_id,tipo_habitacion_id,folio,noches,huespedes,fecha_inicio,temporada,precio_noche_snap,total,deposito,origen)
             VALUES (?,?,?,?,?,?,?,?,?,?, 'default')`,
            [req.user.id, estandar.id, folio(), 1, 1, null, temporada, precioNoche, total, deposito]
          )
        }
      }
    }

    const [rows] = await db.query(
      `SELECT r.*, t.nombre AS habitacion, t.codigo, t.capacidad, t.nivel, t.deposito_pct, t.precio_noche AS precio_base
       FROM reservas_habitacion r JOIN tipos_habitacion t ON t.id=r.tipo_habitacion_id
       WHERE r.usuario_id=? ORDER BY (r.estado='activa') DESC, r.created_at DESC`,
      [req.user.id]
    )
    res.json({ tipo_cuenta: tipoCuenta, reservas: rows })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────── COMPRAR / RESERVAR UNA HABITACIÓN ───────────────
// El turista no tiene habitación por defecto, pero puede comprar una.
// El cliente también puede comprar habitaciones adicionales.
router.post('/comprar', verifyToken, requireRole('cliente'), async (req, res) => {
  const { tipo_habitacion_id, noches = 1, huespedes = 1, fecha_inicio = null } = req.body
  if (!tipo_habitacion_id) return res.status(400).json({ error: 'Selecciona un tipo de habitación' })
  const n = parseInt(noches), h = parseInt(huespedes)
  if (!(n >= 1)) return res.status(400).json({ error: 'Las noches deben ser al menos 1' })

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[tipo]] = await conn.query(
      'SELECT * FROM tipos_habitacion WHERE id=? AND activo=1 FOR UPDATE', [tipo_habitacion_id]
    )
    if (!tipo) { await conn.rollback(); return res.status(404).json({ error: 'Tipo de habitación no encontrado' }) }
    if (h < 1 || h > tipo.capacidad) {
      await conn.rollback()
      return res.status(400).json({ error: `Esta habitación admite máximo ${tipo.capacidad} huésped(es)` })
    }
    if ((await disponibles(conn, tipo.id)) <= 0) {
      await conn.rollback()
      return res.status(409).json({ error: 'No hay habitaciones disponibles de este tipo' })
    }

    const { temporada, precioNoche, total, deposito } = calcular(tipo, n, fecha_inicio)
    const f = folio()
    const [r] = await conn.query(
      `INSERT INTO reservas_habitacion
         (usuario_id,tipo_habitacion_id,folio,noches,huespedes,fecha_inicio,temporada,precio_noche_snap,total,deposito,origen)
       VALUES (?,?,?,?,?,?,?,?,?,?, 'comprada')`,
      [req.user.id, tipo.id, f, n, h, fecha_inicio || null, temporada, precioNoche, total, deposito]
    )
    await conn.commit()
    res.status(201).json({
      message: 'Reserva confirmada', id: r.insertId, folio: f, habitacion: tipo.nombre,
      noches: n, huespedes: h, temporada, etiqueta: ETIQUETA[temporada],
      precio_noche: precioNoche, total, deposito,
    })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ error: e.message })
  } finally { conn.release() }
})

// ─────────────── MEJORAR DE NIVEL (pagar la diferencia) ───────────────
router.post('/mejorar', verifyToken, requireRole('cliente'), async (req, res) => {
  const { reserva_id, nuevo_tipo_id } = req.body
  if (!reserva_id || !nuevo_tipo_id) return res.status(400).json({ error: 'Datos incompletos' })

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[reserva]] = await conn.query(
      "SELECT * FROM reservas_habitacion WHERE id=? AND usuario_id=? AND estado='activa' FOR UPDATE",
      [reserva_id, req.user.id]
    )
    if (!reserva) { await conn.rollback(); return res.status(404).json({ error: 'Reserva no encontrada' }) }

    const [[actual]] = await conn.query('SELECT * FROM tipos_habitacion WHERE id=?', [reserva.tipo_habitacion_id])
    const [[nuevo]]  = await conn.query('SELECT * FROM tipos_habitacion WHERE id=? AND activo=1 FOR UPDATE', [nuevo_tipo_id])
    if (!nuevo) { await conn.rollback(); return res.status(404).json({ error: 'Tipo de habitación no encontrado' }) }
    if (nuevo.nivel <= actual.nivel) {
      await conn.rollback()
      return res.status(400).json({ error: 'Solo puedes mejorar a un nivel superior' })
    }
    if (reserva.huespedes > nuevo.capacidad) {
      await conn.rollback()
      return res.status(400).json({ error: `La nueva habitación admite máximo ${nuevo.capacidad} huésped(es)` })
    }
    if ((await disponibles(conn, nuevo.id)) <= 0) {
      await conn.rollback()
      return res.status(409).json({ error: 'No hay habitaciones disponibles de ese nivel' })
    }

    // Se conserva la temporada y noches; solo cambia el tipo y se cobra la diferencia.
    const precioNoche = precioAjustado(nuevo.precio_noche, reserva.temporada)
    const total = precioNoche * reserva.noches
    const deposito = Math.round((total * (nuevo.deposito_pct || 0)) / 100)
    const diferencia = total - Number(reserva.total)

    await conn.query(
      'UPDATE reservas_habitacion SET tipo_habitacion_id=?, precio_noche_snap=?, total=?, deposito=? WHERE id=?',
      [nuevo.id, precioNoche, total, deposito, reserva.id]
    )
    await conn.commit()
    res.json({
      message: 'Habitación mejorada', habitacion: nuevo.nombre, total,
      diferencia, deposito, precio_noche: precioNoche,
    })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ error: e.message })
  } finally { conn.release() }
})

// ─────────────── EXTENDER NOCHES (pagar la diferencia) ───────────────
router.post('/extender', verifyToken, requireRole('cliente'), async (req, res) => {
  const { reserva_id, noches_extra } = req.body
  const extra = parseInt(noches_extra)
  if (!reserva_id || !(extra >= 1)) return res.status(400).json({ error: 'Indica cuántas noches adicionales' })

  try {
    const [[reserva]] = await db.query(
      "SELECT r.*, t.deposito_pct FROM reservas_habitacion r JOIN tipos_habitacion t ON t.id=r.tipo_habitacion_id WHERE r.id=? AND r.usuario_id=? AND r.estado='activa'",
      [reserva_id, req.user.id]
    )
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' })

    const nuevasNoches = reserva.noches + extra
    const total = Number(reserva.precio_noche_snap) * nuevasNoches
    const deposito = Math.round((total * (reserva.deposito_pct || 0)) / 100)
    const diferencia = Number(reserva.precio_noche_snap) * extra

    await db.query(
      'UPDATE reservas_habitacion SET noches=?, total=?, deposito=? WHERE id=?',
      [nuevasNoches, total, deposito, reserva.id]
    )
    res.json({ message: 'Estancia extendida', noches: nuevasNoches, total, diferencia, deposito })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────── COORDINADOR: TODAS LAS RESERVAS ───────────────
router.get('/reservas', verifyToken, requireRole('coordinador'), async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, t.nombre AS habitacion, t.codigo,
              CONCAT(u.nombre,' ',COALESCE(u.apellidos,'')) AS huesped,
              u.email, u.tipo_cuenta, u.empresa
       FROM reservas_habitacion r
       JOIN tipos_habitacion t ON t.id=r.tipo_habitacion_id
       JOIN usuarios u ON u.id=r.usuario_id
       ORDER BY (r.estado='activa') DESC, r.created_at DESC`
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
