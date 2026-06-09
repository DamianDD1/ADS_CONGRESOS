// Misma lógica de temporada que el backend (para estimar el precio en vivo).
// baja x1 · media +15% · alta +35% · fecha oficial +50%
export const MULT = { baja: 1.0, media: 1.15, alta: 1.35, oficial: 1.5 }
export const ETIQUETA = {
  baja: 'Temporada baja · precio normal',
  media: 'Temporada media · +15%',
  alta: 'Temporada alta · +35%',
  oficial: 'Fecha oficial · +50%',
}

function domingoPascua(anio) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(anio, mes - 1, dia)
}
const ymd = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
const sumar = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

export function temporadaDeFecha(input) {
  if (!input) return 'baja'
  const f = /^\d{4}-\d{2}-\d{2}$/.test(String(input)) ? new Date(input + 'T12:00:00') : new Date(input)
  if (isNaN(f.getTime())) return 'baja'
  const Y = f.getFullYear(), key = ymd(f), md = (f.getMonth() + 1) * 100 + f.getDate()

  if ([101, 501, 1224, 1225, 1231].includes(md)) return 'oficial'

  const enRango = (a, b) => key >= ymd(a) && key <= ymd(b)
  const p = domingoPascua(Y)
  const ventanas = [
    [sumar(p, -7), p],
    [new Date(Y, 6, 15), new Date(Y, 7, 15)],
    [new Date(Y, 11, 20), new Date(Y, 11, 31)],
    [new Date(Y, 0, 1), new Date(Y, 0, 6)],
  ]
  for (const [a, b] of ventanas) if (enRango(a, b)) return 'alta'
  for (const [a, b] of ventanas) {
    if (enRango(sumar(a, -7), sumar(a, -1))) return 'media'
    if (enRango(sumar(b, 1), sumar(b, 7))) return 'media'
  }
  const dow = f.getDay()
  if (dow === 0 || dow === 6) return 'media'
  return 'baja'
}

export const precioAjustado = (base, t) => Math.round(Number(base || 0) * (MULT[t] ?? 1))
