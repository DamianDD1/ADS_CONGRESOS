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
    connectionLimit: 10,
  })

  try {
    const conn = await pool.getConnection()
    
    // Carga schema
    const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf-8')
    const schemaParts = schema.split(';').filter(s => s.trim())
    
    for (const query of schemaParts) {
      if (query.trim()) {
        try {
          await conn.query(query)
        } catch (err) {
          // Ignora errores de "tabla ya existe"
          if (!err.message.includes('already exists')) {
            console.error('Error en query:', err.message)
          }
        }
      }
    }
    
    console.log('✅ Schema DB cargado')
    conn.release()
  } catch (err) {
    console.error('❌ Error inicializando BD:', err.message)
  }

  await pool.end()
}

if (require.main === module) {
  initDB()
}

module.exports = initDB