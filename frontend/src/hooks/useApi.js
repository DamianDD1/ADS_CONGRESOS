const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
export const apiFetch = async (path, options = {}, token = null) => {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error')
  return data
}
