const express = require('express')
const db = require('../config/db')
const { verifyToken } = require('../middlewares/auth')
const router = express.Router()

// Catálogo para alimentar el selector dinámico del formulario.
// Cada salón devuelve cuántas unidades están OCUPADAS y cuántas DISPONIBLES.
//
// La ocupación ahora depende de las FECHAS:
//  · Si se reciben ?fecha_inicio=&fecha_fin=, un salón solo se considera ocupado
//    por los congresos vivos (borrador/planeación/activo) cuyo rango de fechas
//    SE TRASLAPA con esas fechas. Así, si un congreso termina el día 9 y quieres
//    rentar el salón a partir del día 10, aparecerá LIBRE.
//  · Si no se reciben fechas, solo cuentan los congresos vivos que AÚN NO han
//    terminado (fecha_fin >= hoy); los congresos ya finalizados liberan su salón.
router.get('/', verifyToken, async (req, res) => {
  try {
    const ini = req.query.fecha_inicio || null
    const fin = req.query.fecha_fin || null

    // Condición de "ocupado" según haya o no ventana de fechas solicitada.
    let condFechas, params
    if (ini && fin) {
      // Traslape de rangos: ocupado si el congreso empieza antes (o el mismo día)
      // de que termina la ventana, y termina después (o el mismo día) de que empieza.
      condFechas = `AND c.fecha_inicio <= ? AND c.fecha_fin >= ?`
      params = [fin, ini]
    } else {
      // Sin ventana: los congresos ya finalizados liberan el salón.
      condFechas = `AND c.fecha_fin >= CURDATE()`
      params = []
    }

    const [rows] = await db.query(
      `SELECT s.codigo, s.nombre, s.stock, s.capacidad, s.costo_dia, s.unico,
              COALESCE(SUM(
                CASE WHEN c.estado IN ('borrador','planeacion','activo')
                          ${condFechas}
                     THEN cs.cantidad ELSE 0 END
              ), 0) AS ocupadas
         FROM salones s
         LEFT JOIN congreso_salones cs ON cs.salon_id = s.id
         LEFT JOIN congresos c        ON c.id        = cs.congreso_id
        WHERE s.activo = 1
        GROUP BY s.id, s.codigo, s.nombre, s.stock, s.capacidad, s.costo_dia, s.unico
        ORDER BY s.costo_dia DESC`,
      params
    )
    // Añadimos el campo derivado "disponibles" para el frontend.
    const data = rows.map(s => {
      const ocupadas = Number(s.ocupadas) || 0
      return { ...s, ocupadas, disponibles: Math.max(0, s.stock - ocupadas) }
    })
    res.json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
