const express = require('express')
const db = require('../config/db')
const { verifyToken, requireRole } = require('../middlewares/auth')
const router = express.Router()

// ───────────── ENVIAR MENSAJE (público, sin login) ─────────────
// Lo usa el formulario de "Contacto" de la landing.
// Validaciones: email debe contener '@', teléfono solo dígitos.
router.post('/', async (req, res) => {
  let { nombre, apellido, email, telefono, mensaje } = req.body

  nombre  = (nombre  || '').trim()
  email   = (email   || '').trim()
  mensaje = (mensaje || '').trim()

  if (!nombre || !email || !mensaje)
    return res.status(400).json({ error: 'Nombre, correo y mensaje son obligatorios' })

  // Correo: como mínimo debe contener una arroba "@"
  if (!email.includes('@'))
    return res.status(400).json({ error: 'El correo debe contener al menos una "@"' })

  // Teléfono (opcional): si viene, solo se aceptan dígitos
  if (telefono != null && telefono !== '') {
    telefono = String(telefono).trim()
    if (!/^\d+$/.test(telefono))
      return res.status(400).json({ error: 'El teléfono solo puede contener números' })
  } else {
    telefono = null
  }

  try {
    const [r] = await db.query(
      'INSERT INTO mensajes_contacto (nombre,apellido,email,telefono,mensaje) VALUES (?,?,?,?,?)',
      [nombre, apellido || null, email, telefono, mensaje]
    )
    res.status(201).json({ message: 'Mensaje enviado', id: r.insertId })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ───────────── BANDEJA (solo COORDINADOR) ─────────────
// Los mensajes solo le llegan / los puede ver el coordinador.
router.get('/', verifyToken, requireRole('coordinador'), async (_req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM mensajes_contacto ORDER BY leido ASC, created_at DESC'
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ───────────── MARCAR COMO LEÍDO (solo COORDINADOR) ─────────────
router.put('/:id/leido', verifyToken, requireRole('coordinador'), async (req, res) => {
  try {
    await db.query('UPDATE mensajes_contacto SET leido=1 WHERE id=?', [req.params.id])
    res.json({ message: 'Marcado como leído' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
