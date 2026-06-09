const express = require('express')
const db = require('../config/db')
const { verifyToken, requireRole } = require('../middlewares/auth')
const router = express.Router()

const fmtFecha = (f) => new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
const HORA_PRESENTACION = '09:00' // hora de presentación por defecto (los congresos no manejan hora exacta)

// Congresos abiertos a postulación (para que el proveedor los vea)
router.get('/abiertos', verifyToken, requireRole('proveedor'), async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nombre, tematica, tipo_congreso, sede, fecha_inicio, fecha_fin
       FROM congresos WHERE permite_postulacion=1 AND estado IN ('planeacion','activo')
       ORDER BY fecha_inicio ASC`
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Postulaciones del propio proveedor (para mostrar su estado en cada congreso)
router.get('/mias', verifyToken, requireRole('proveedor'), async (req, res) => {
  try {
    const [[prov]] = await db.query('SELECT id FROM proveedores_detalle WHERE usuario_id=?', [req.user.id])
    if (!prov) return res.json([])
    const [rows] = await db.query(
      `SELECT cp.id, cp.congreso_id, cp.origen, cp.estado, cp.created_at
       FROM congreso_proveedores cp
       WHERE cp.proveedor_id = ?`, [prov.id]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Postulaciones PENDIENTES de los congresos del coordinador (para aprobar/rechazar)
router.get('/pendientes', verifyToken, requireRole('coordinador'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT cp.id, cp.congreso_id, cp.origen, cp.estado, cp.mensaje, cp.created_at,
              c.nombre AS congreso, c.sede, c.fecha_inicio, c.fecha_fin,
              pd.empresa, cs.nombre AS categoria,
              CONCAT(u.nombre,' ',u.apellidos) AS contacto, u.email
       FROM congreso_proveedores cp
       JOIN congresos c ON c.id = cp.congreso_id
       JOIN proveedores_detalle pd ON pd.id = cp.proveedor_id
       JOIN categorias_servicio cs ON cs.id = pd.categoria_id
       JOIN usuarios u ON u.id = pd.usuario_id
       WHERE cp.origen='postulado' AND cp.estado='pendiente'
         AND c.coordinador_id = ?
       ORDER BY cp.created_at ASC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// El proveedor se postula a un congreso
router.post('/', verifyToken, requireRole('proveedor'), async (req, res) => {
  const { congreso_id, mensaje } = req.body
  if (!congreso_id) return res.status(400).json({ error: 'congreso_id requerido' })
  try {
    const [[prov]] = await db.query('SELECT id FROM proveedores_detalle WHERE usuario_id=?', [req.user.id])
    if (!prov) return res.status(400).json({ error: 'Primero registra tu empresa proveedora' })

    const [[c]] = await db.query(
      "SELECT permite_postulacion, estado, fecha_fin FROM congresos WHERE id=?", [congreso_id]
    )
    if (!c) return res.status(404).json({ error: 'Congreso no encontrado' })
    if (!c.permite_postulacion) return res.status(403).json({ error: 'Este congreso no acepta postulaciones' })
    if (['cancelado', 'reembolsado', 'cerrado'].includes(c.estado) || new Date(c.fecha_fin) < new Date(new Date().toDateString()))
      return res.status(403).json({ error: 'Este congreso ya no admite postulaciones' })

    await db.query(
      `INSERT INTO congreso_proveedores (congreso_id,proveedor_id,origen,estado,mensaje)
       VALUES (?,?, 'postulado','pendiente',?)
       ON DUPLICATE KEY UPDATE mensaje=VALUES(mensaje), estado='pendiente', origen='postulado'`,
      [congreso_id, prov.id, mensaje || null]
    )
    res.status(201).json({ message: 'Postulación enviada' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// El coordinador aprueba o rechaza una postulación (y notifica al proveedor)
router.put('/:id/estado', verifyToken, requireRole('coordinador'), async (req, res) => {
  const { estado } = req.body
  if (!['aprobado', 'rechazado'].includes(estado))
    return res.status(400).json({ error: 'Estado inválido' })
  try {
    // Datos del congreso + proveedor para componer la notificación
    const [[row]] = await db.query(
      `SELECT cp.id, cp.congreso_id, c.nombre AS congreso, c.sede, c.fecha_inicio, c.fecha_fin,
              pd.empresa, u.id AS usuario_id
       FROM congreso_proveedores cp
       JOIN congresos c ON c.id = cp.congreso_id
       JOIN proveedores_detalle pd ON pd.id = cp.proveedor_id
       JOIN usuarios u ON u.id = pd.usuario_id
       WHERE cp.id = ?`,
      [req.params.id]
    )
    if (!row) return res.status(404).json({ error: 'Postulación no encontrada' })

    await db.query('UPDATE congreso_proveedores SET estado=? WHERE id=?', [estado, req.params.id])

    const lugar = row.sede || 'sede por confirmar'
    if (estado === 'aprobado') {
      const mensaje = `¡Tu postulación fue aceptada! Tu empresa "${row.empresa}" participará como proveedor en el congreso "${row.congreso}".`
        + ` Nombre del congreso: ${row.congreso}. Lugar: ${lugar}.`
        + ` Fecha: ${fmtFecha(row.fecha_inicio)} a las ${HORA_PRESENTACION} hrs (el evento concluye el ${fmtFecha(row.fecha_fin)}).`
      await db.query(
        `INSERT INTO notificaciones_proveedor (usuario_id, congreso_id, tipo, mensaje)
         VALUES (?, ?, 'aprobacion', ?)`,
        [row.usuario_id, row.congreso_id, mensaje]
      )
    } else {
      const mensaje = `Tu postulación al congreso "${row.congreso}" (${fmtFecha(row.fecha_inicio)} en ${lugar}) no fue aceptada en esta ocasión. Gracias por tu interés.`
      await db.query(
        `INSERT INTO notificaciones_proveedor (usuario_id, congreso_id, tipo, mensaje)
         VALUES (?, ?, 'rechazo', ?)`,
        [row.usuario_id, row.congreso_id, mensaje]
      )
    }

    res.json({ message: 'Actualizado' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
