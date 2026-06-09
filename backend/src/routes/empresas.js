const express = require('express')
const db = require('../config/db')
const router = express.Router()

// Lista pública de empresas con convenio (solo nombre).
// El cliente la usa como referencia al registrarse; el CÓDIGO de validación
// se lo entrega su empresa y se verifica en /api/auth/register.
router.get('/convenio', async (_req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nombre FROM empresas_convenio WHERE activo=1 ORDER BY nombre'
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
