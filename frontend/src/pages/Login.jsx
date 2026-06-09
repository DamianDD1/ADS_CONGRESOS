import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import RivieraScene from '../components/RivieraScene'
import Icon, { BrandMark } from '../components/Icon'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(form) })
      login(data.token, data.user)
      navigate('/dashboard')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-layout">
      <div className="auth-panel-left">
        <RivieraScene />
        <div className="auth-left-content">
          <span className="auth-brand-icon"><BrandMark size={44} /></span>
          <span className="auth-brand-eyebrow">Riviera Maya · Congresos 2026</span>
          <h1 className="auth-brand-title">Gestión de<br /><span>Congresos</span></h1>
          <p className="auth-brand-desc">Plataforma integral para planear, acreditar y administrar congresos empresariales en el Caribe mexicano.</p>
        </div>
      </div>
      <div className="auth-panel-right">
        <div className="auth-form-wrap">
          <Link to="/" className="auth-back"><Icon name="arrowLeft" size={16} /> Volver al inicio</Link>
          <h2 className="auth-form-title">Bienvenido</h2>
          <p className="auth-form-sub">Ingresa a tu cuenta para continuar</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>Correo electrónico</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="usuario@riviera.mx" required />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary btn-full" style={{marginTop:'.5rem'}} disabled={loading}>
              {loading ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>
          <p className="auth-link" style={{ marginTop: '1rem' }}><a href="/recuperar">¿Olvidaste tu contraseña?</a></p>
          <p className="auth-link">¿No tienes cuenta? <a href="/register">Regístrate</a></p>
        </div>
      </div>
    </div>
  )
}
