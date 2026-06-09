// ============================================================
//  🌴 Riviera Maya — Cálculo de temporada y ajuste de precio
//  Reglas del complejo (ver ficha de habitaciones):
//   · Temporada BAJA    → precio normal            (x1.00)
//   · Temporada MEDIA   → +15%  (x1.15)  · una semana antes y una
//     semana después de vacaciones · sábados y domingos
//   · Temporada ALTA    → +35%  (x1.35)  · vacaciones y Semana Santa
//   · FECHAS OFICIALES  → +50%  (x1.50)  · Año Nuevo, Navidad,
//     Día del Trabajo (y demás marcadas por el calendario)
// ============================================================

const MULT = { baja: 1.0, media: 1.15, alta: 1.35, oficial: 1.5 }

const ETIQUETA = {
  baja:    'Temporada baja · precio normal',
  media:   'Temporada media · +15%',
  alta:    'Temporada alta · +35%',
  oficial: 'Fecha oficial · +50%',
}

// Domingo de Pascua (algoritmo de Computus de Gauss) para ubicar Semana Santa
function domingoPascua(anio) {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31) // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(anio, mes - 1, dia)
}

// Número comparable AAAAMMDD (ignora hora/zona horaria)
const ymd = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

// Convierte una fecha 'YYYY-MM-DD' (o Date) en Date local al mediodía,
// para que no se corra de día por la zona horaria.
function aFecha(input) {
  if (input instanceof Date) return input
  const s = String(input || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00')
  const d = new Date(s)
  return isNaN(d.getTime()) ? new Date() : d
}

function temporadaDeFecha(input) {
  const f = aFecha(input)
  const Y = f.getFullYear()
  const key = ymd(f)
  const md = (f.getMonth() + 1) * 100 + f.getDate()

  // 1) Fechas oficiales (+50%)
  const OFICIALES = [101, 501, 1224, 1225, 1231] // 1-ene, 1-may, 24/25/31-dic
  if (OFICIALES.includes(md)) return 'oficial'

  const enRango = (a, b) => key >= ymd(a) && key <= ymd(b)

  // Ventanas de vacaciones
  const pascua = domingoPascua(Y)
  const ssIni = sumarDias(pascua, -7) // Domingo de Ramos
  const ssFin = pascua                // Domingo de Pascua
  const verIni = new Date(Y, 6, 15),  verFin = new Date(Y, 7, 15)   // verano 15-jul a 15-ago
  const invIniA = new Date(Y, 11, 20), invFinA = new Date(Y, 11, 31) // invierno 20-31 dic
  const invIniB = new Date(Y, 0, 1),   invFinB = new Date(Y, 0, 6)   // invierno 1-6 ene

  const ventanas = [[ssIni, ssFin], [verIni, verFin], [invIniA, invFinA], [invIniB, invFinB]]

  // 2) Temporada alta (+35%): dentro de una ventana de vacaciones / Semana Santa
  for (const [a, b] of ventanas) if (enRango(a, b)) return 'alta'

  // 3) Temporada media (+15%): una semana antes / después de vacaciones, o fin de semana
  for (const [a, b] of ventanas) {
    if (enRango(sumarDias(a, -7), sumarDias(a, -1))) return 'media'
    if (enRango(sumarDias(b, 1), sumarDias(b, 7))) return 'media'
  }
  const dow = f.getDay() // 0 = domingo, 6 = sábado
  if (dow === 0 || dow === 6) return 'media'

  // 4) Resto del año: temporada baja
  return 'baja'
}

const multiplicador = t => MULT[t] ?? 1
const precioAjustado = (precioBase, t) => Math.round(Number(precioBase) * multiplicador(t))

module.exports = { temporadaDeFecha, multiplicador, precioAjustado, MULT, ETIQUETA }
