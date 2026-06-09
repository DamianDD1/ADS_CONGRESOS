import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import Icon from './Icon'

const TIPO_ICON  = { asignacion: 'check', aprobacion: 'check', cancelacion: 'alert', rechazo: 'alert' }
const TIPO_COLOR = { asignacion: 'var(--teal)', aprobacion: 'var(--teal)', cancelacion: 'var(--coral)', rechazo: 'var(--coral)' }
const TIPO_BG    = { asignacion: 'var(--teal-light)', aprobacion: 'var(--teal-light)', cancelacion: '#fff0ee', rechazo: '#fff0ee' }
const TIPO_LABEL = {
  asignacion:  '✓ Asignado al congreso',
  aprobacion:  '✓ Postulación aceptada',
  cancelacion: '✕ Congreso cancelado',
  rechazo:     '✕ Postulación no aceptada',
}

function fmtFecha(ts) {
  return new Date(ts).toLocaleString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function NotificacionesList() {
  const { token } = useAuth()
  const [notifs, setNotifs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setNotifs(await apiFetch('/notificaciones', {}, token))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const marcarLeida = async (id) => {
    try {
      await apiFetch(`/notificaciones/${id}/leida`, { method: 'PUT' }, token)
      setNotifs(n => n.map(x => x.id === id ? { ...x, leido: 1 } : x))
    } catch {}
  }

  const marcarTodas = async () => {
    try {
      await apiFetch('/notificaciones/leer-todas', { method: 'PUT' }, token)
      setNotifs(n => n.map(x => ({ ...x, leido: 1 })))
    } catch {}
  }

  const sinLeer = notifs.filter(n => !n.leido).length

  if (loading) return <div className="empty"><span className="spinner" /></div>

  return (
    <div>
      {error && <div className="alert alert-error"><Icon name="alert" size={17} /> {error}</div>}

      <div className="content-hdr">
        <div>
          <div className="content-hdr-title">Mis notificaciones</div>
          <div className="content-hdr-sub">
            {sinLeer > 0 ? `${sinLeer} sin leer` : 'Todo al día'}
          </div>
        </div>
        {sinLeer > 0 && (
          <button className="btn btn-ghost" onClick={marcarTodas}>
            <Icon name="check" size={16} /> Marcar todas como leídas
          </button>
        )}
      </div>

      {notifs.length === 0 ? (
        <div className="empty">
          <span><Icon name="bell" size={28} /></span>
          <p>No tienes notificaciones aún</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {notifs.map(n => (
            <div
              key={n.id}
              style={{
                background: n.leido ? 'var(--card-bg)' : TIPO_BG[n.tipo],
                border: `1.5px solid ${n.leido ? 'var(--border)' : TIPO_COLOR[n.tipo]}`,
                borderRadius: 'var(--radius)',
                padding: '1.1rem 1.3rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                opacity: n.leido ? 0.8 : 1,
                transition: 'opacity .2s',
              }}
            >
              {/* Icono tipo */}
              <span style={{ color: TIPO_COLOR[n.tipo], flexShrink: 0, marginTop: 2 }}>
                <Icon name={TIPO_ICON[n.tipo]} size={22} />
              </span>

              <div style={{ flex: 1 }}>
                {/* Badge tipo */}
                <span style={{
                  display: 'inline-block',
                  background: TIPO_COLOR[n.tipo],
                  color: '#fff',
                  borderRadius: 99,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 10px',
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                  marginBottom: '0.45rem',
                }}>
                  {TIPO_LABEL[n.tipo] || 'Notificación'}
                </span>

                {/* Mensaje principal */}
                <p style={{ margin: '0 0 .5rem', lineHeight: 1.55, fontSize: '0.95rem' }}>
                  {n.mensaje}
                </p>

                {/* Detalles del congreso */}
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                  <span><Icon name="briefcase" size={13} /> {n.congreso_nombre}</span>
                  <span><Icon name="pin" size={13} /> {n.sede || 'Sede por confirmar'}</span>
                  <span><Icon name="calendar" size={13} />
                    {new Date(n.fecha_inicio).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' → '}
                    {new Date(n.fecha_fin).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{fmtFecha(n.created_at)}</span>
                </div>
              </div>

              {/* Botón marcar leída */}
              {!n.leido && (
                <button
                  className="btn btn-ghost"
                  style={{ flexShrink: 0, padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => marcarLeida(n.id)}
                  title="Marcar como leída"
                >
                  <Icon name="check" size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
