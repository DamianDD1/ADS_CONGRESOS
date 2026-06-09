const express = require('express')
const PDFDocument = require('pdfkit')
const db = require('../config/db')
const { verifyToken, requireRole } = require('../middlewares/auth')
const router = express.Router()

const mxn = n => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })
// Nunca pasar null/undefined a PDFKit: provoca un error que rompe la generación.
const txt = (v, fallback = '') => {
  if (v === null || v === undefined) return fallback
  const s = String(v).trim()
  return s === '' ? fallback : s
}
const fechaMX = d => {
  const f = new Date(d)
  return isNaN(f) ? '—' : f.toLocaleDateString('es-MX')
}

// Factura fiscal (CFDI) del congreso en PDF — la descarga el coordinador
router.get('/congreso/:id', verifyToken, requireRole('coordinador'), async (req, res) => {
  try {
    const [[c]] = await db.query(
      `SELECT c.*, CONCAT(u.nombre,' ',COALESCE(u.apellidos,'')) AS coordinador_nombre, u.email
       FROM congresos c JOIN usuarios u ON u.id=c.coordinador_id
       WHERE c.id=? AND c.coordinador_id=?`, [req.params.id, req.user.id]
    )
    if (!c) return res.status(404).json({ error: 'Congreso no encontrado' })

    const [salones] = await db.query(
      `SELECT cs.cantidad, cs.costo_dia_snap, s.nombre
       FROM congreso_salones cs JOIN salones s ON s.id=cs.salon_id WHERE cs.congreso_id=?`,
      [req.params.id]
    )
    const [pagoRows] = await db.query(
      "SELECT rfc, razon_social, uso_cfdi, metodo FROM pagos WHERE congreso_id=? ORDER BY id DESC LIMIT 1",
      [req.params.id]
    )
    const pago = pagoRows[0] || null

    // ── Cálculos (con coerción segura) ──
    let dias = Math.floor((new Date(c.fecha_fin) - new Date(c.fecha_inicio)) / 86400000) + 1
    if (!Number.isFinite(dias) || dias < 1) dias = 1
    const subtotal = Number(c.costo_total_salones) || 0
    const multa = Number(c.multa_aplicada) || 0
    const baseConMulta = subtotal + multa
    const iva = baseConMulta * 0.16
    const total = baseConMulta + iva
    const msi = Number(c.msi) || 0

    // ── Documento: se arma en memoria y se envía completo ──
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks = []
    doc.on('data', d => chunks.push(d))
    doc.on('error', err => {
      console.error('[factura] error de PDFKit:', err)
      if (!res.headersSent) res.status(500).json({ error: 'No se pudo generar el PDF' })
    })
    doc.on('end', () => {
      const pdf = Buffer.concat(chunks)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="factura-congreso-${c.id}.pdf"`)
      res.setHeader('Content-Length', pdf.length)
      res.send(pdf)
    })

    const NAVY = '#0a1628', GOLD = '#c9a227', GRAY = '#6b7280'

    // Encabezado
    doc.fillColor(NAVY).fontSize(22).font('Helvetica-Bold').text('Riviera Maya Congresos', 50, 50)
    doc.fillColor(GOLD).fontSize(10).font('Helvetica').text('Congresos Empresariales · Caribe Mexicano', 50, 76)
    doc.fillColor(NAVY).fontSize(16).font('Helvetica-Bold').text('FACTURA', 400, 50, { align: 'right' })
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
      .text(`Folio: RMC-F-${String(c.id).padStart(5, '0')}`, 400, 74, { align: 'right' })
      .text(`Fecha de emisión: ${fechaMX(new Date())}`, 400, 86, { align: 'right' })
      .text('Moneda: MXN (Pesos mexicanos)', 400, 98, { align: 'right' })

    doc.moveTo(50, 120).lineTo(545, 120).strokeColor(GOLD).lineWidth(1.5).stroke()

    // Emisor / Receptor
    doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold').text('EMISOR', 50, 135)
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
      .text('Riviera Maya Congresos S.A. de C.V.', 50, 150)
      .text('RFC: RMC180101AB1', 50, 162)
      .text('Régimen: 601 - General de Ley P.M.', 50, 174)

    doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold').text('RECEPTOR', 320, 135)
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
      .text(txt(pago?.razon_social || c.organizador || c.coordinador_nombre, 'Público en general'), 320, 150)
      .text(`RFC: ${txt(pago?.rfc, 'XAXX010101000')}`, 320, 162)
      .text(`Uso CFDI: ${txt(pago?.uso_cfdi, 'G03 - Gastos en general')}`, 320, 174)

    // Datos del congreso
    doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold').text('CONCEPTO DEL EVENTO', 50, 205)
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
      .text(`${txt(c.nombre, 'Congreso')}  ·  ${dias} día(s)  ·  ${fechaMX(c.fecha_inicio)} a ${fechaMX(c.fecha_fin)}`, 50, 220)

    // Tabla de conceptos
    let y = 250
    doc.rect(50, y, 495, 22).fill(NAVY)
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold')
      .text('Concepto', 60, y + 7).text('Cant.', 330, y + 7).text('P. Unit./día', 380, y + 7).text('Importe', 470, y + 7)
    y += 22
    doc.font('Helvetica').fillColor('#1a1a2e')
    if (salones.length === 0) {
      doc.rect(50, y, 495, 20).fillAndStroke('#faf8f2', '#eee')
      doc.fillColor('#1a1a2e').fontSize(8.5).text('Sin salones reservados', 60, y + 6)
      y += 20
    }
    for (const s of salones) {
      const importe = (Number(s.costo_dia_snap) || 0) * (Number(s.cantidad) || 0) * dias
      doc.rect(50, y, 495, 20).fillAndStroke('#faf8f2', '#eee')
      doc.fillColor('#1a1a2e').fontSize(8.5)
        .text(`${txt(s.nombre, 'Salón')} (${dias} día(s))`, 60, y + 6)
        .text(String(s.cantidad ?? 0), 330, y + 6)
        .text(mxn(s.costo_dia_snap), 380, y + 6)
        .text(mxn(importe), 470, y + 6)
      y += 20
    }

    // Totales
    y += 12
    const totRow = (label, val, bold) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9)
        .fillColor(bold ? NAVY : GRAY)
        .text(label, 360, y, { width: 100, align: 'right' })
        .text(val, 460, y, { width: 85, align: 'right' })
      y += bold ? 20 : 15
    }
    totRow('Subtotal:', mxn(subtotal))
    if (multa > 0) totRow('Multa (15%):', mxn(multa))
    totRow('IVA (16%):', mxn(iva))
    doc.moveTo(360, y).lineTo(545, y).strokeColor(GOLD).lineWidth(1).stroke(); y += 6
    totRow('TOTAL:', mxn(total), true)

    // Meses sin intereses
    if (msi > 0) {
      y += 10
      doc.rect(50, y, 495, 40).fillAndStroke('#f0fdf4', '#bbf7d0')
      doc.fillColor('#166534').fontSize(10).font('Helvetica-Bold')
        .text(`Pago a ${msi} meses sin intereses`, 60, y + 8)
      doc.fillColor('#166534').fontSize(9).font('Helvetica')
        .text(`${msi} pagos mensuales de ${mxn(total / msi)}`, 60, y + 22)
      y += 50
    }

    // Pie
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
      .text(`Método de pago: ${txt(pago?.metodo, 'tarjeta')}  ·  Este documento es una representación impresa de un CFDI.`, 50, 760, { align: 'center', width: 495 })

    doc.end()
  } catch (e) {
    console.error('[factura] error al generar:', e)
    if (!res.headersSent) res.status(500).json({ error: e.message })
  }
})

module.exports = router
