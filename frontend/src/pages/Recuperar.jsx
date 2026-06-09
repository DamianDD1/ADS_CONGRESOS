import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../hooks/useApi'
import RivieraScene from '../components/RivieraScene'
import Icon, { BrandMark } from '../components/Icon'
import { emailTieneArroba, reglasPassword, passwordValida } from '../utils/validacion'

export default function Recuperar() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState(1)           // 1 = pedir código · 2 = nueva contraseña
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [codigoDemo, setCodigoDemo] = useState('')   // código devuelto (no hay envío de correo)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  const reglas = reglasPassword(password)
  const passOk = passwordValida(password)

  const pedirCodigo = async e => {
    e.preventDefault(); setError(''); setOk('')
    if (!emailTieneArroba(email)) { setError('El correo debe contener al menos una «@»'); return }
    setLoading(true)
    try {
      const d = await apiFetch('/auth/recuperar', { method: 'POST', body: JSON.stringify({ email }) })
      // El backend devuelve el código aquí porque el proyecto no envía correos.
      if (d.token) {
        setCodigoDemo(d.token)
        setToken(d.token)
        setPaso(2)
        setOk('Generamos un código de recuperación. Cópialo y crea tu nueva contraseña.')
      } else {
        setOk(d.message || 'Si el correo está registrado, se generó un código de recuperación.')
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const restablecer = async e => {
    e.preventDefault(); setError(''); setOk('')
    if (!passOk) { setError('La contraseña no cumple los requisitos de seguridad'); return }
    setLoading(true)
    try {
      await apiFetch('/auth/restablecer', { method: 'POST', body: JSON.stringify({ token, password }) })
      setOk('Contraseña actualizada. Redirigiendo al inicio de sesión…')
      setTimeout(() => navigate('/login'), 1800)
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
          <h1 className="auth-brand-title">Recupera<br /><span>tu acceso</span></h1>
          <p className="auth-brand-desc">Genera un código temporal y crea una nueva contraseña para volver a entrar a tu cuenta.</p>
        </div>
      </div>

      <div className="auth-panel-right">
        <div className="auth-form-wrap">
          <Link to="/login" className="auth-back"><Icon name="arrowLeft" size={16} /> Volver a iniciar sesión</Link>
          <h2 className="auth-form-title">Recuperar contraseña</h2>
          <p className="auth-form-sub">
            {paso === 1 ? 'Escribe tu correo para generar un código de recuperación' : 'Captura el código y tu nueva contraseña'}
          </p>

          {error && <div className="alert alert-error">{error}</div>}
          {ok && <div className="alert alert-success"><Icon name="check" size={18} /> {ok}</div>}

          {paso === 1 && (
            <form onSubmit={pedirCodigo}>
              <div className="field">
                <label>Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@riviera.mx" required />
              </div>
              <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '.5rem' }} disabled={loading}>
                {loading ? 'Generando…' : 'Generar código'}
              </button>
            </form>
          )}

          {paso === 2 && (
            <form onSubmit={restablecer}>
              {codigoDemo && (
                <div className="info-note">
                  <Icon name="info" size={18} />
                  <div>Tu código de recuperación es <b style={{ letterSpacing: '.06em' }}>{codigoDemo}</b>. Es válido por 30 minutos.</div>
                </div>
              )}
              <div className="field">
                <label>Código de recuperación</label>
                <input type="text" value={token} onChange={e => setToken(e.target.value)} placeholder="Ej. A1B2C3D4" required />
              </div>
              <div className="field">
                <label>Nueva contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={password && !passOk ? 'input-warn' : ''}
                  required
                />
                <ul className="pass-rules">
                  <li className={reglas.longitud ? 'ok' : ''}><Icon name={reglas.longitud ? 'check' : 'x'} size={13} /> Mínimo 8 caracteres</li>
                  <li className={reglas.mayuscula ? 'ok' : ''}><Icon name={reglas.mayuscula ? 'check' : 'x'} size={13} /> Una mayúscula (A-Z)</li>
                  <li className={reglas.numero ? 'ok' : ''}><Icon name={reglas.numero ? 'check' : 'x'} size={13} /> Un número (0-9)</li>
                  <li className={reglas.simbolo ? 'ok' : ''}><Icon name={reglas.simbolo ? 'check' : 'x'} size={13} /> Un símbolo (!@#$…)</li>
                </ul>
              </div>
              <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '.5rem' }} disabled={loading}>
                {loading ? 'Actualizando…' : 'Cambiar contraseña'}
              </button>
              <p className="auth-link" style={{ marginTop: '1rem' }}>
                <a href="#" onClick={e => { e.preventDefault(); setPaso(1); setError(''); setOk('') }}>Generar un código nuevo</a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
