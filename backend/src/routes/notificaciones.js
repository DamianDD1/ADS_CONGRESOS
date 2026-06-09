const express = require('express')
const db = require('../config/db')
const { verifyToken, requireRole } = require('../middlewares/auth')
const router = express.Router()

// ───────── GET mis notificaciones (proveedor) ─────────
router.get('/', verifyToken, requireRole('proveedor'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT n.*, c.nombre AS congreso_nombre, c.fecha_inicio, c.fecha_fin, c.sede
       FROM notificaciones_proveedor n
       JOIN congresos c ON c.id = n.congreso_id
       WHERE n.usuario_id = ?
       ORDER BY n.leido ASC, n.created_at DESC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ───────── Marcar como leída ─────────
router.put('/:id/leida', verifyToken, requireRole('proveedor'), async (req, res) => {
  try {
    await db.query(
      'UPDATE notificaciones_proveedor SET leido=1 WHERE id=? AND usuario_id=?',
      [req.params.id, req.user.id]
    )
    res.json({ message: 'Marcada como leída' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ───────── Marcar todas como leídas ─────────
router.put('/leer-todas', verifyToken, requireRole('proveedor'), async (req, res) => {
  try {
    await db.query(
      'UPDATE notificaciones_proveedor SET leido=1 WHERE usuario_id=?',
      [req.user.id]
    )
    res.json({ message: 'Todas marcadas como leídas' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
