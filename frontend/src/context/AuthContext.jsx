import { createContext, useContext, useState, useEffect } from 'react'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = localStorage.getItem('rm_token')
    const u = localStorage.getItem('rm_user')
    if (t && u) { setToken(t); setUser(JSON.parse(u)) }
    setLoading(false)
  }, [])
  const login = (t, u) => { localStorage.setItem('rm_token', t); localStorage.setItem('rm_user', JSON.stringify(u)); setToken(t); setUser(u) }
  const logout = () => { localStorage.removeItem('rm_token'); localStorage.removeItem('rm_user'); setToken(null); setUser(null) }
  return <AuthContext.Provider value={{ user, token, login, logout, loading }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
