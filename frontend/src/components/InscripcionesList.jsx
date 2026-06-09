import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import Icon from './Icon'

const mxn = n => '$' + Number(n || 0).toLocaleString('es-MX')
const BZ = { cliente: 'morado', turista: 'coral' }

export default function InscripcionesList() {
  const { token, user } = useAuth()
  const [inscripciones, setInscripciones] = useState([])
  const [congresos, setCongresos] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ congreso_id: '', tipo_asistente: user?.tipo_cuenta === 'turista' ? 'turista' : 'cliente', empresa_representada: '' })
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState(null)   // resultado de la inscripción (folio + brazalete)
  const [loading, setLoading] = useState(false)

  const fetch_ = async () => {
    try {
      const c = await apiFetch('/congresos', {}, token)
      setCongresos(c)
      if (user?.rol === 'coordinador') setInscripciones(await apiFetch('/inscripciones', {}, token))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { fetch_() }, [])

  const congresoSel = congresos.find(c => String(c.id) === String(form.congreso_id))
  const montoEstimado = congresoSel
    ? (form.tipo_asistente === 'turista' ? congresoSel.cuota_turista : congresoSel.cuota_recuperacion)
    : 0

  // Cupo de cada congreso: aforo máximo, inscritos vigentes y lugares restantes.
  const cupo = c => {
    const max = Number(c.aforo_max) || 0
    const ins = Number(c.inscritos) || 0
    return { max, ins, disp: max > 0 ? Math.max(0, max - ins) : null, lleno: max > 0 && ins >= max }
  }
  const cupoSel = congresoSel ? cupo(congresoSel) : null

  const submit = async e => {
    e.preventDefault(); setLoading(true); setError(''); setTicket(null)
    try {
      const d = await apiFetch('/inscripciones', { method: 'POST', body: JSON.stringify(form) }, token)
      setTicket(d)
      setShowForm(false)
      setForm({ congreso_id: '', tipo_asistente: 'cliente', empresa_representada: '' })
      await fetch_()   // refresca el contador de cupo de los congresos
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const cambiarEstado = async (id, estado) => {
    try { await apiFetch(`/inscripciones/${id}/estado`, { method: 'PUT', body: JSON.stringify({ estado }) }, token); fetch_() }
    catch (e) { setError(e.message) }
  }

  return (
    <div>
      {error && <div className="alert alert-error"><Icon name="alert" size={17} /> {error}</div>}

      <div className="content-hdr">
        <div>
          <div className="content-hdr-title">Inscripciones</div>
          <div className="content-hdr-sub">
            {user?.rol === 'coordinador' ? `${inscripciones.length} registro${inscripciones.length !== 1 ? 's' : ''}` : 'Inscríbete a un congreso activo'}
          </div>
        </div>
        {user?.rol === 'cliente' && (
          <button className={`btn ${showForm ? 'btn-ghost' : 'btn-gold'}`} onClick={() => { setShowForm(!showForm); setTicket(null) }}>
            {showForm ? <><Icon name="x" size={16} /> Cancelar</> : <><Icon name="ticket" size={16} /> Inscribirme</>}
          </button>
        )}
      </div>

      {/* Brazalete entregado tras inscribirse */}
      {ticket && (
        <div className={`bz-band bzb-${ticket.brazalete}`}>
          <span className="bz-ico"><Icon name="ticket" size={26} /></span>
          <div>
            <b>Brazalete {ticket.brazalete} · {ticket.tipo_asistente}</b>
            <div><small>Folio {ticket.folio} · Cuota {mxn(ticket.monto)} MXN</small></div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="form-card">
          <div className="form-card-title">Inscripción a congreso</div>
          <div className="form-card-sub">Solo se muestran congresos con estado activo</div>

          <div className="info-note">
            <Icon name="info" size={18} />
            <div>Un <b>cliente</b> asiste al congreso pero no a las zonas arqueológicas. Un <b>turista común</b> no entra al congreso salvo que pague la <b>cuota turista</b> que fija el coordinador.</div>
          </div>

          <form onSubmit={submit}>
            <div className="field">
              <label>Tipo de asistente *</label>
              <div className="seg">
                {[['cliente', 'Cliente', 'Asiste al congreso'], ['turista', 'Turista', 'Paga cuota para entrar']].map(([v, t, d]) => (
                  <div key={v} className={`seg-opt ${form.tipo_asistente === v ? 'on' : ''}`} onClick={() => setForm({ ...form, tipo_asistente: v, empresa_representada: v === 'turista' ? '' : form.empresa_representada })}>
                    <span className={`brazalete bz-${BZ[v]}`} style={{ marginBottom: '.35rem' }}>{t}</span>
                    <small>{d}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Congreso *</label>
              <select value={form.congreso_id} onChange={e => setForm({ ...form, congreso_id: e.target.value })} required>
                <option value="">— Selecciona un congreso —</option>
                {congresos.filter(c => c.estado === 'activo').map(c => {
                  const k = cupo(c)
                  const sufijo = k.max > 0 ? (k.lleno ? ' · LLENO' : ` · ${k.disp} de ${k.max} lugares`) : ''
                  return (
                    <option key={c.id} value={c.id} disabled={k.lleno}>
                      {c.nombre} · {new Date(c.fecha_inicio).toLocaleDateString('es-MX')}{sufijo}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Contador de cupo en vivo del congreso seleccionado */}
            {cupoSel && cupoSel.max > 0 && (
              <div className={`cap-box ${cupoSel.lleno ? 'cap-full' : ''}`}>
                <div className="cap-head">
                  <span><Icon name="users" size={15} /> Cupo del congreso</span>
                  <b>{cupoSel.ins} / {cupoSel.max}</b>
                </div>
                <div className="cap-bar"><div className="cap-fill" style={{ width: `${Math.min(100, (cupoSel.ins / cupoSel.max) * 100)}%` }} /></div>
                <small>{cupoSel.lleno ? 'Sin lugares disponibles — el cupo está lleno' : `Quedan ${cupoSel.disp} lugar${cupoSel.disp !== 1 ? 'es' : ''} disponible${cupoSel.disp !== 1 ? 's' : ''}`}</small>
              </div>
            )}

            {/* La empresa solo aplica al cliente. El turista no viene de una empresa. */}
            {form.tipo_asistente === 'cliente' && (
              <div className="field">
                <label>Empresa que representas (opcional)</label>
                <input type="text" value={form.empresa_representada} onChange={e => setForm({ ...form, empresa_representada: e.target.value })} placeholder="Si vienes por parte de una empresa" />
              </div>
            )}

            {congresoSel && (
              <div className="summary" style={{ marginTop: '.5rem' }}>
                <div className="sum-total"><span>A pagar ({form.tipo_asistente})</span><b>{mxn(montoEstimado)} MXN</b></div>
              </div>
            )}

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading || (cupoSel && cupoSel.lleno)}>
                {loading ? 'Procesando…' : (cupoSel && cupoSel.lleno) ? 'Cupo lleno' : 'Confirmar inscripción'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {user?.rol === 'cliente' && !showForm && !ticket && (
        <div className="empty"><span><Icon name="ticket" size={28} /></span><p>Usa el botón de arriba para inscribirte a un congreso activo</p></div>
      )}

      {user?.rol === 'coordinador' && (
        <div className="table-wrap">
          <div className="table-head"><span className="table-head-title">Registro de asistentes</span></div>
          <table>
            <thead>
              <tr><th>Folio</th><th>Asistente</th><th>Tipo</th><th>Empresa</th><th>Congreso</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {inscripciones.map(i => (
                <tr key={i.id}>
                  <td><code>{i.folio}</code></td>
                  <td>
                    <strong>{i.cliente_nombre}</strong>
                    <div style={{ fontSize: '.76rem', color: 'var(--text-light)' }}>{i.email}</div>
                  </td>
                  <td><span className={`brazalete bz-${BZ[i.tipo_asistente] || 'morado'}`}>{i.tipo_asistente}</span></td>
                  <td style={{ fontSize: '.8rem' }}>{i.empresa_representada || '—'}</td>
                  <td style={{ fontSize: '.82rem' }}>{congresos.find(c => c.id === i.congreso_id)?.nombre || '—'}</td>
                  <td><span className={`badge badge-${i.estado}`}>{i.estado}</span></td>
                  <td>
                    {i.estado === 'pendiente' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-success" onClick={() => cambiarEstado(i.id, 'confirmada')}>Confirmar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => cambiarEstado(i.id, 'cancelada')}>Cancelar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {inscripciones.length === 0 && (
                <tr><td colSpan={7}><div className="empty"><span><Icon name="ticket" size={28} /></span><p>Sin inscripciones registradas</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
