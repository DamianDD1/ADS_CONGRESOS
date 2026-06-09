require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { iniciarJobs } = require('./jobs/reglas')

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '8mb' })) // permite imágenes en base64 desde el formulario

app.use('/api/auth', require('./routes/auth'))
app.use('/api/congresos', require('./routes/congresos'))
app.use('/api/salones', require('./routes/salones'))
app.use('/api/ponencias', require('./routes/ponencias'))
app.use('/api/proveedores', require('./routes/proveedores'))
app.use('/api/postulaciones', require('./routes/postulaciones'))
app.use('/api/inscripciones', require('./routes/inscripciones'))
app.use('/api/facturas', require('./routes/facturas'))
app.use('/api/mensajes', require('./routes/mensajes'))
app.use('/api/notificaciones', require('./routes/notificaciones'))
app.use('/api/habitaciones', require('./routes/habitaciones'))
app.use('/api/empresas', require('./routes/empresas'))

app.get('/api/health', (_, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🌴 Servidor en http://localhost:${PORT}`)
  iniciarJobs()
})
