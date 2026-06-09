// Validaciones reutilizables (mismas reglas que el backend)

// Deja solo dígitos (para campos de teléfono: "solo números")
export const soloDigitos = (valor = '') => valor.replace(/\D/g, '')

// Correo: como mínimo debe contener una "@"
export const emailTieneArroba = (valor = '') => valor.includes('@')

// Reglas de contraseña: mayúscula, número, símbolo y largo mínimo
export const reglasPassword = (password = '') => ({
  longitud: password.length >= 8,
  mayuscula: /[A-Z]/.test(password),
  numero: /[0-9]/.test(password),
  simbolo: /[^A-Za-z0-9]/.test(password),
})

// ¿La contraseña cumple TODAS las reglas?
export const passwordValida = (password = '') =>
  Object.values(reglasPassword(password)).every(Boolean)
