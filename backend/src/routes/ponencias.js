const express = require('express')
const db = require('../config/db')
const { verifyToken, requireRole } = require('../middlewares/auth')
const router = express.Router()

router.get('/', verifyToken, async (req, res) => {
  const { congreso_id } = req.query
  try {
    // El AUTOR (ponente) solo ve SUS propias propuestas y el estado de cada una;
    // el COORDINADOR ve todas las ponencias para poder aprobarlas o rechazarlas.
    const soloMias = req.user.rol === 'autor' ? req.user.id : null
    const [rows] = await db.query(
      `SELECT p.*, CONCAT(u.nombre,' ',u.apellidos) as autor_nombre
       FROM ponencias p JOIN usuarios u ON u.id=p.autor_id
       WHERE (?  IS NULL OR p.congreso_id=?)
         AND (?  IS NULL OR p.autor_id=?)
       ORDER BY p.created_at DESC`,
      [congreso_id || null, congreso_id || null, soloMias, soloMias]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', verifyToken, requireRole('autor'), async (req, res) => {
  const { congreso_id, titulo, resumen } = req.body
  if (!congreso_id || !titulo) return res.status(400).json({ error: 'Campos requeridos' })
  const [r] = await db.query(
    'INSERT INTO ponencias (congreso_id,autor_id,titulo,resumen) VALUES(?,?,?,?)',
    [congreso_id, req.user.id, titulo, resumen]
  )
  res.status(201).json({ message: 'Propuesta enviada', id: r.insertId })
})

router.put('/:id/revisar', verifyToken, requireRole('coordinador'), async (req, res) => {
  const { estado, feedback } = req.body
  await db.query('UPDATE ponencias SET estado=?,feedback=? WHERE id=?', [estado, feedback, req.params.id])
  res.json({ message: 'Actualizado' })
})

module.exports = router
