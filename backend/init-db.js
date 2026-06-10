const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

async function initDB() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'riviera_congresos',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: 5,
  })

  try {
    const conn = await pool.getConnection()
    console.log('✅ Conectado a BD')
    conn.release()
  } catch (err) {
    console.warn('⚠️  No se pudo conectar a BD (aún no está lista):', err.message)
  }

  await pool.end()
}

// Ejecuta en background, no bloquea
initDB().catch(err => console.warn('Init DB warning:', err.message))