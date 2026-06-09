const express = require('express')
const db = require('../config/db')
const { verifyToken, requireRole } = require('../middlewares/auth')
const router = express.Router()

// Catálogo de categorías (público, sin auth — lo necesita el registro)
router.get('/categorias', async (req, res) => {
  const [rows] = await db.query('SELECT id, nombre FROM categorias_servicio ORDER BY nombre')
  res.json(rows)
})

// ───────── Proveedores disponibles (para coordinador — muestra todos con info de contacto) ─────────
router.get('/disponibles', verifyToken, requireRole('coordinador'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT pd.*, CONCAT(u.nombre,' ',u.apellidos) AS contacto, u.email, u.id AS usuario_id,
              cs.nombre AS categoria
       FROM proveedores_detalle pd
       JOIN usuarios u ON u.id = pd.usuario_id
       JOIN categorias_servicio cs ON cs.id = pd.categoria_id
       ORDER BY cs.nombre, pd.empresa`
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/', verifyToken, async (req, res) => {
  const [rows] = await db.query(
    `SELECT pd.*, CONCAT(u.nombre,' ',u.apellidos) as contacto, u.email, cs.nombre as categoria
     FROM proveedores_detalle pd JOIN usuarios u ON u.id=pd.usuario_id JOIN categorias_servicio cs ON cs.id=pd.categoria_id`
  )
  res.json(rows)
})

router.post('/', verifyToken, requireRole('proveedor'), async (req, res) => {
  const { empresa, categoria_id, descripcion, sitio_web, rfc, imagen_url } = req.body
  if (!empresa || !categoria_id) return res.status(400).json({ error: 'Campos requeridos' })
  const [r] = await db.query(
    'INSERT INTO proveedores_detalle (usuario_id,empresa,categoria_id,descripcion,sitio_web,rfc,imagen_url) VALUES(?,?,?,?,?,?,?)',
    [req.user.id, empresa, categoria_id, descripcion, sitio_web, rfc, imagen_url || null]
  )
  res.status(201).json({ message: 'Proveedor registrado', id: r.insertId })
})

module.exports = router
