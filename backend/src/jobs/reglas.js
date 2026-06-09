const cron = require('node-cron')
const db = require('../config/db')

// Reglas de liquidación, multas y cancelación automática.
// Se evalúan contra fecha_inicio. Idempotentes: la multa solo se aplica una vez.
async function evaluarReglas() {
  try {
    // 1) Multa del 15% — faltan ≤15 días, no liquidado y sin multa previa
    const [multar] = await db.query(
      `SELECT id, costo_total_salones FROM congresos
       WHERE estado IN ('planeacion','activo')
         AND estado_pago <> 'liquidado'
         AND multa_aplicada = 0
         AND DATEDIFF(fecha_inicio, CURDATE()) <= 15
         AND DATEDIFF(fecha_inicio, CURDATE()) > 3`
    )
    for (const c of multar) {
      const multa = Number(c.costo_total_salones) * 0.15
      await db.query('UPDATE congresos SET multa_aplicada=? WHERE id=?', [multa, c.id])
      console.log(`⚠️  Multa 15% ($${multa}) aplicada al congreso ${c.id}`)
    }

    // 2) Cancelación automática — faltan ≤3 días y no liquidado (sin devolución)
    const [cancelar] = await db.query(
      `SELECT id FROM congresos
       WHERE estado IN ('planeacion','activo')
         AND estado_pago <> 'liquidado'
         AND DATEDIFF(fecha_inicio, CURDATE()) <= 3`
    )
    for (const c of cancelar) {
      // Asistentes que ya pagaron sí recuperan el 100% (la falla es del organizador)
      await db.query(
        `UPDATE inscripciones SET estado='cancelada', estado_pago='reembolsado'
         WHERE congreso_id=? AND estado_pago='pagado'`, [c.id]
      )
      await db.query('UPDATE congresos SET estado=? WHERE id=?', ['cancelado', c.id])
      console.log(`🚫 Congreso ${c.id} cancelado automáticamente (impago a ≤3 días)`)
    }

    await cerrarFinalizados()
  } catch (e) {
    console.error('Error evaluando reglas de congresos:', e.message)
  }
}

// Marca como TERMINADO (estado='cerrado') todo congreso cuya fecha de fin ya pasó
// y que seguía en planeación/activo. Así la cartelera y todas las vistas reflejan
// "Evento terminado" en lugar de dejarlo eternamente "en curso".
async function cerrarFinalizados() {
  try {
    const [cerrar] = await db.query(
      `SELECT id FROM congresos
        WHERE estado IN ('planeacion','activo')
          AND fecha_fin < CURDATE()`
    )
    for (const c of cerrar) {
      await db.query("UPDATE congresos SET estado='cerrado' WHERE id=?", [c.id])
      console.log(`✅ Congreso ${c.id} marcado como terminado (cerrado)`)
    }
  } catch (e) {
    console.error('Error cerrando congresos finalizados:', e.message)
  }
}

function iniciarJobs() {
  // Al arrancar, cerramos de inmediato los congresos que ya terminaron para que
  // la cartelera no espere hasta las 03:00 para mostrar "Evento terminado".
  cerrarFinalizados()
  // Todos los días a las 03:00
  cron.schedule('0 3 * * *', evaluarReglas)
  console.log('⏰ Job de reglas de congresos programado (diario 03:00)')
}

module.exports = { iniciarJobs, evaluarReglas, cerrarFinalizados }
