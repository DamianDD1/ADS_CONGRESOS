import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import Icon from './Icon'

export default function MensajesList() {
  const { token, user } = useAuth()
  const [mensajes, setMensajes] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const cargar = async () => {
    try {
      setMensajes(await apiFetch('/mensajes', {}, token))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [])

  const marcarLeido = async id => {
    try {
      await apiFetch(`/mensajes/${id}/leido`, { method: 'PUT' }, token)
      cargar()
    } catch (e) { setError(e.message) }
  }

  const fecha = d => new Date(d).toLocaleString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  // Solo el coordinador tiene acceso a esta bandeja.
  if (user?.rol !== 'coordinador') {
    return <div className="empty"><span><Icon name="mail" size={28} /></span><p>Solo el coordinador puede ver los mensajes de contacto</p></div>
  }

  const noLeidos = mensajes.filter(m => !m.leido).length

  return (
    <div>
      {error && <div className="alert alert-error"><Icon name="alert" size={17} /> {error}</div>}

      <div className="content-hdr">
        <div>
          <div className="content-hdr-title">Mensajes de contacto</div>
          <div className="content-hdr-sub">
            {mensajes.length} mensaje{mensajes.length !== 1 ? 's' : ''}
            {noLeidos > 0 && ` · ${noLeidos} sin leer`}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty"><span><Icon name="clock" size={28} /></span><p>Cargando mensajes…</p></div>
      ) : mensajes.length === 0 ? (
        <div className="empty"><span><Icon name="mail" size={28} /></span><p>Aún no hay mensajes desde el formulario de contacto</p></div>
      ) : (
        <div className="table-wrap">
          <div className="table-head"><span className="table-head-title">Bandeja del coordinador</span></div>
          <table>
            <thead>
              <tr><th>Estado</th><th>De</th><th>Contacto</th><th>Mensaje</th><th>Recibido</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {mensajes.map(m => (
                <tr key={m.id} style={m.leido ? {} : { background: 'var(--surface-2)' }}>
                  <td>
                    <span className={`badge badge-${m.leido ? 'confirmada' : 'pendiente'}`}>
                      {m.leido ? 'Leído' : 'Nuevo'}
                    </span>
                  </td>
                  <td><strong>{m.nombre} {m.apellido || ''}</strong></td>
                  <td style={{ fontSize: '.8rem' }}>
                    <div><a href={`mailto:${m.email}`}>{m.email}</a></div>
                    {m.telefono && <div style={{ color: 'var(--text-light)' }}>{m.telefono}</div>}
                  </td>
                  <td style={{ fontSize: '.84rem', maxWidth: 360, whiteSpace: 'pre-wrap' }}>{m.mensaje}</td>
                  <td style={{ fontSize: '.78rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{fecha(m.created_at)}</td>
                  <td>
                    {!m.leido && (
                      <button className="btn btn-sm btn-success" onClick={() => marcarLeido(m.id)}>
                        <Icon name="check" size={14} /> Marcar leído
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
