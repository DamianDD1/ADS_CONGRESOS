const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../config/db')
const { v4: uuidv4 } = require('uuid')
const router = express.Router()

router.post('/register', async (req, res) => {
  const { nombre, apellidos, email, password, telefono, rol_id } = req.body
  let { tipo_cuenta, empresa, codigo_empresa } = req.body
  // Campos extra para proveedor
  const { empresa_nombre, categoria_id, rfc, sitio_web, imagen_url, concepto } = req.body
  if (!nombre || !email || !password || !rol_id) return res.status(400).json({ error: 'Campos requeridos' })

  // Tipo de cuenta solo aplica al asistente (rol_id 4). Un CLIENTE viene de una
  // empresa con convenio; un TURISTA no pertenece a ninguna empresa.
  const esAsistente = Number(rol_id) === 4
  tipo_cuenta = esAsistente && tipo_cuenta === 'turista' ? 'turista' : 'cliente'
  let empresaFinal = null
  let empresaValidada = 0

  // Correo: como mínimo debe contener una arroba "@"
  if (!String(email).includes('@'))
    return res.status(400).json({ error: 'El correo debe contener al menos una "@"' })

  // Contraseña: mínimo 8 caracteres, con mayúscula, número y símbolo
  if (
    String(password).length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return res.status(400).json({
      error: 'La contraseña debe tener mínimo 8 caracteres e incluir mayúscula, número y símbolo',
    })
  }

  // Teléfono (opcional): si viene, solo dígitos
  if (telefono != null && telefono !== '' && !/^\d+$/.test(String(telefono)))
    return res.status(400).json({ error: 'El teléfono solo puede contener números' })

  // Corroboración de empresa: un cliente debe venir de una empresa con convenio
  // y capturar el código que su empresa le entregó.
  if (esAsistente && tipo_cuenta === 'cliente') {
    if (!empresa || !codigo_empresa)
      return res.status(400).json({ error: 'Para registrarte como cliente indica tu empresa y el código de validación' })
    try {
      const [[conv]] = await db.query(
        'SELECT id, nombre FROM empresas_convenio WHERE codigo=? AND activo=1',
        [String(codigo_empresa).trim()]
      )
      if (!conv)
        return res.status(400).json({ error: 'Código de empresa inválido. Verifícalo con tu empresa o regístrate como turista.' })
      empresaFinal = conv.nombre          // se guarda el nombre oficial del convenio
      empresaValidada = 1
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  try {
    const [existe] = await db.query('SELECT id FROM usuarios WHERE email=?', [email])
    if (existe.length) return res.status(409).json({ error: 'Email ya registrado' })
    const hash = await bcrypt.hash(password, 12)
    const [r] = await db.query(
      'INSERT INTO usuarios (rol_id,nombre,apellidos,email,password_hash,telefono,tipo_cuenta,empresa,empresa_validada) VALUES(?,?,?,?,?,?,?,?,?)',
      [rol_id, nombre, apellidos, email, hash, telefono || null, tipo_cuenta, empresaFinal, empresaValidada]
    )

    // Si es proveedor, crear su perfil en proveedores_detalle automáticamente.
    const esProveedor = Number(rol_id) === 3
    if (esProveedor && empresa_nombre && categoria_id) {
      try {
        await db.query(
          'INSERT INTO proveedores_detalle (usuario_id,empresa,categoria_id,descripcion,sitio_web,rfc,imagen_url) VALUES(?,?,?,?,?,?,?)',
          [r.insertId, empresa_nombre, categoria_id, concepto || null, sitio_web || null, rfc || null, imagen_url || null]
        )
      } catch { /* si falla el perfil, el usuario quedó creado; puede completar perfil después */ }
    }

    // El cliente de empresa estrena una habitación ESTÁNDAR por defecto.
    if (esAsistente && tipo_cuenta === 'cliente') {
      try {
        const [[estandar]] = await db.query("SELECT * FROM tipos_habitacion WHERE codigo='estandar'")
        if (estandar) {
          const total = Number(estandar.precio_noche)
          const fol = 'HAB-' + uuidv4().substring(0, 8).toUpperCase()
          await db.query(
            `INSERT INTO reservas_habitacion
               (usuario_id,tipo_habitacion_id,folio,noches,huespedes,fecha_inicio,temporada,precio_noche_snap,total,deposito,origen)
             VALUES (?,?,?,?,?,?,?,?,?,?, 'default')`,
            [r.insertId, estandar.id, fol, 1, 1, null, 'baja', total, total, 0]
          )
        }
      } catch { /* si aún no existe el catálogo de habitaciones, se asigna al entrar al panel */ }
    }

    res.status(201).json({ message: 'Usuario creado', id: r.insertId, tipo_cuenta, empresa: empresaFinal })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Credenciales requeridas' })
  try {
    const [rows] = await db.query(
      `SELECT u.*, r.nombre as rol FROM usuarios u JOIN roles r ON r.id=u.rol_id
       WHERE u.email=? AND u.activo=1`, [email]
    )
    if (!rows.length) return res.status(401).json({ error: 'Credenciales inválidas' })
    const user = rows[0]
    if (user.bloqueado_hasta && new Date() < new Date(user.bloqueado_hasta))
      return res.status(403).json({ error: 'Cuenta bloqueada temporalmente' })
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      const intentos = user.intentos_fallidos + 1
      const bloqueo = intentos >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
      await db.query('UPDATE usuarios SET intentos_fallidos=?,bloqueado_hasta=? WHERE id=?', [intentos, bloqueo, user.id])
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }
    await db.query('UPDATE usuarios SET intentos_fallidos=0,bloqueado_hasta=NULL WHERE id=?', [user.id])
    const token = jwt.sign({ id: user.id, rol: user.rol, nombre: user.nombre, tipo_cuenta: user.tipo_cuenta }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN })
    res.json({ token, user: { id: user.id, nombre: user.nombre, apellidos: user.apellidos, email: user.email, rol: user.rol, tipo_cuenta: user.tipo_cuenta, empresa: user.empresa } })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────── RECUPERACIÓN DE CONTRASEÑA ───────────────
// Paso 1: el usuario pide recuperar su contraseña con su correo. Si existe una
// cuenta activa, se genera un código temporal (vigente 30 min). Como este
// proyecto no tiene servicio de correo configurado, el código se devuelve en la
// respuesta para poder continuar el flujo (en producción se enviaría por email).
router.post('/recuperar', async (req, res) => {
  const { email } = req.body
  if (!email || !String(email).includes('@'))
    return res.status(400).json({ error: 'Indica un correo válido' })
  try {
    const [[user]] = await db.query('SELECT id FROM usuarios WHERE email=? AND activo=1', [email])
    if (!user) {
      // No revelamos si el correo existe o no.
      return res.json({ message: 'Si el correo está registrado, se generó un código de recuperación.' })
    }
    const token = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase()
    const expira = new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
    await db.query('UPDATE usuarios SET reset_token=?, reset_expira=? WHERE id=?', [token, expira, user.id])
    res.json({
      message: 'Código de recuperación generado. Cópialo y úsalo para crear una nueva contraseña.',
      token,                       // se entrega aquí porque no hay envío de correo
      expira_en_min: 30,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Paso 2: el usuario captura el código y su nueva contraseña.
router.post('/restablecer', async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Código y nueva contraseña requeridos' })

  // Misma política de contraseña que en el registro.
  if (
    String(password).length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return res.status(400).json({
      error: 'La contraseña debe tener mínimo 8 caracteres e incluir mayúscula, número y símbolo',
    })
  }

  try {
    const [[user]] = await db.query(
      'SELECT id, reset_expira FROM usuarios WHERE reset_token=?',
      [String(token).trim().toUpperCase()]
    )
    if (!user) return res.status(400).json({ error: 'Código inválido' })
    if (!user.reset_expira || new Date() > new Date(user.reset_expira))
      return res.status(400).json({ error: 'El código expiró. Solicita uno nuevo.' })

    const hash = await bcrypt.hash(password, 12)
    // Al restablecer, también se limpia cualquier bloqueo por intentos fallidos.
    await db.query(
      'UPDATE usuarios SET password_hash=?, reset_token=NULL, reset_expira=NULL, intentos_fallidos=0, bloqueado_hasta=NULL WHERE id=?',
      [hash, user.id]
    )
    res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
