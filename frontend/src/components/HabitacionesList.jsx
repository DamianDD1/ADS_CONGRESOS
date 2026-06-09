import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import { temporadaDeFecha, precioAjustado, ETIQUETA } from '../utils/temporada'
import Icon from './Icon'

const mxn = n => '$' + Number(n || 0).toLocaleString('es-MX')
const hoy = () => new Date().toISOString().slice(0, 10)

export default function HabitacionesList() {
  const { token, user } = useAuth()
  const esCoord = user?.rol === 'coordinador'

  const [catalogo, setCatalogo] = useState([])
  const [mias, setMias] = useState({ tipo_cuenta: 'cliente', reservas: [] })
  const [reservasAll, setReservasAll] = useState([])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  // Formularios
  const [compra, setCompra] = useState({ tipo_habitacion_id: '', fecha_inicio: hoy(), noches: 1, huespedes: 1 })
  const [mejora, setMejora] = useState({ reserva_id: '', nuevo_tipo_id: '' })
  const [extender, setExtender] = useState({ reserva_id: '', noches_extra: 1 })
  const [busy, setBusy] = useState(false)

  const cargar = async () => {
    try {
      const cat = await apiFetch('/habitaciones/catalogo')
      setCatalogo(Array.isArray(cat) ? cat : [])
      if (esCoord) setReservasAll(await apiFetch('/habitaciones/reservas', {}, token))
      else setMias(await apiFetch('/habitaciones/mias', {}, token))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { cargar() }, [])

  const flash = (msg) => { setOk(msg); setError(''); setTimeout(() => setOk(''), 5000) }

  // ───────── Acciones ─────────
  const comprar = async e => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const d = await apiFetch('/habitaciones/comprar', { method: 'POST', body: JSON.stringify(compra) }, token)
      flash(`Reserva ${d.folio} confirmada · ${d.habitacion} · ${d.noches} noche(s) · Total ${mxn(d.total)}${d.deposito ? ` · Depósito ${mxn(d.deposito)}` : ''}`)
      setCompra({ tipo_habitacion_id: '', fecha_inicio: hoy(), noches: 1, huespedes: 1 })
      await cargar()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const mejorar = async (reserva_id, nuevo_tipo_id) => {
    setBusy(true); setError('')
    try {
      const d = await apiFetch('/habitaciones/mejorar', { method: 'POST', body: JSON.stringify({ reserva_id, nuevo_tipo_id }) }, token)
      flash(`Habitación mejorada a ${d.habitacion} · Diferencia a pagar ${mxn(d.diferencia)} · Nuevo total ${mxn(d.total)}`)
      setMejora({ reserva_id: '', nuevo_tipo_id: '' })
      await cargar()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const ampliar = async (reserva_id, noches_extra) => {
    setBusy(true); setError('')
    try {
      const d = await apiFetch('/habitaciones/extender', { method: 'POST', body: JSON.stringify({ reserva_id, noches_extra }) }, token)
      flash(`Estancia extendida a ${d.noches} noches · Diferencia a pagar ${mxn(d.diferencia)} · Nuevo total ${mxn(d.total)}`)
      setExtender({ reserva_id: '', noches_extra: 1 })
      await cargar()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  // ───────── Estimación de la compra en vivo ─────────
  const tipoSel = catalogo.find(t => String(t.id) === String(compra.tipo_habitacion_id))
  const tempCompra = temporadaDeFecha(compra.fecha_inicio)
  const precioCompra = tipoSel ? precioAjustado(tipoSel.precio_noche, tempCompra) : 0
  const totalCompra = precioCompra * (parseInt(compra.noches) || 0)
  const depCompra = tipoSel ? Math.round(totalCompra * (tipoSel.deposito_pct || 0) / 100) : 0

  return (
    <div>
      {error && <div className="alert alert-error"><Icon name="alert" size={17} /> {error}</div>}
      {ok && <div className="alert alert-success"><Icon name="check" size={17} /> {ok}</div>}

      <div className="content-hdr">
        <div>
          <div className="content-hdr-title">Habitaciones</div>
          <div className="content-hdr-sub">
            {esCoord ? `${reservasAll.length} reserva(s) en el complejo`
              : mias.tipo_cuenta === 'turista' ? 'Compra tu habitación · sin habitación predeterminada'
              : 'Tu habitación incluida y tus reservas'}
          </div>
        </div>
      </div>

      {/* ───────── CLIENTE / TURISTA: mis reservas ───────── */}
      {!esCoord && (
        <>
          {mias.tipo_cuenta === 'turista' && mias.reservas.filter(r => r.estado === 'activa').length === 0 && (
            <div className="info-note">
              <Icon name="info" size={18} />
              <div>Como <b>turista</b> no tienes una habitación predeterminada, pero puedes <b>comprar</b> la que prefieras desde el catálogo de abajo.</div>
            </div>
          )}

          {mias.reservas.filter(r => r.estado === 'activa').map(r => {
            const mejoras = catalogo.filter(t => t.nivel > r.nivel && t.capacidad >= r.huespedes && t.disponibles > 0)
            return (
              <div key={r.id} className="form-card">
                <div className="bz-band bzb-morado" style={{ marginTop: 0 }}>
                  <span className="bz-ico"><Icon name="building" size={26} /></span>
                  <div>
                    <b>{r.habitacion} {r.origen === 'default' && <span className="badge badge-aprobada" style={{ marginLeft: 6 }}>incluida</span>}</b>
                    <div><small>Folio {r.folio} · {r.noches} noche(s) · {r.huespedes} huésped(es) · {ETIQUETA[r.temporada]}</small></div>
                  </div>
                </div>

                <div className="summary" style={{ marginTop: '1rem' }}>
                  <div className="sum-row"><span>Precio por noche</span><b>{mxn(r.precio_noche_snap)}</b></div>
                  <div className="sum-row"><span>Noches</span><b>{r.noches}</b></div>
                  {r.deposito > 0 && <div className="sum-row"><span>Depósito ({r.deposito_pct}%)</span><b>{mxn(r.deposito)}</b></div>}
                  <div className="sum-total"><span>Total</span><b>{mxn(r.total)}</b></div>
                </div>

                <div className="field-row" style={{ marginTop: '1.2rem' }}>
                  {/* Mejorar de nivel */}
                  <div className="field">
                    <label>Mejorar de nivel (pagas la diferencia)</label>
                    {mejoras.length ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={mejora.reserva_id === r.id ? mejora.nuevo_tipo_id : ''}
                          onChange={e => setMejora({ reserva_id: r.id, nuevo_tipo_id: e.target.value })}
                        >
                          <option value="">— Elige un nivel superior —</option>
                          {mejoras.map(t => {
                            const np = precioAjustado(t.precio_noche, r.temporada) * r.noches
                            return <option key={t.id} value={t.id}>{t.nombre} · +{mxn(np - Number(r.total))}</option>
                          })}
                        </select>
                        <button className="btn btn-gold" disabled={busy || mejora.reserva_id !== r.id || !mejora.nuevo_tipo_id}
                          onClick={() => mejorar(r.id, mejora.nuevo_tipo_id)}>Mejorar</button>
                      </div>
                    ) : <p className="field-warn"><Icon name="info" size={13} /> Ya estás en el nivel más alto disponible</p>}
                  </div>

                  {/* Extender estancia */}
                  <div className="field">
                    <label>Extender estancia (noches adicionales)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" min="1" style={{ maxWidth: 110 }}
                        value={extender.reserva_id === r.id ? extender.noches_extra : 1}
                        onChange={e => setExtender({ reserva_id: r.id, noches_extra: Math.max(1, parseInt(e.target.value) || 1) })} />
                      <button className="btn btn-gold" disabled={busy}
                        onClick={() => ampliar(r.id, extender.reserva_id === r.id ? extender.noches_extra : 1)}>
                        + {mxn(Number(r.precio_noche_snap) * (extender.reserva_id === r.id ? extender.noches_extra : 1))}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Comprar una habitación (turista y cliente) */}
          <div className="form-card">
            <div className="form-card-title">{mias.tipo_cuenta === 'turista' ? 'Comprar habitación' : 'Reservar otra habitación'}</div>
            <div className="form-card-sub">El precio se ajusta según la temporada de la fecha de llegada · Check-in 3:00 PM · Check-out 12:00 PM</div>
            <form onSubmit={comprar}>
              <div className="field">
                <label>Tipo de habitación *</label>
                <select value={compra.tipo_habitacion_id} onChange={e => setCompra({ ...compra, tipo_habitacion_id: e.target.value })} required>
                  <option value="">— Selecciona —</option>
                  {catalogo.map(t => (
                    <option key={t.id} value={t.id} disabled={t.disponibles <= 0}>
                      {t.nombre} · {mxn(t.precio_noche)}/noche · {t.disponibles > 0 ? `${t.disponibles} disp.` : 'agotado'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <div className="field"><label>Fecha de llegada</label><input type="date" value={compra.fecha_inicio} onChange={e => setCompra({ ...compra, fecha_inicio: e.target.value })} /></div>
                <div className="field"><label>Noches</label><input type="number" min="1" value={compra.noches} onChange={e => setCompra({ ...compra, noches: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
                <div className="field"><label>Huéspedes</label><input type="number" min="1" max={tipoSel?.capacidad || 8} value={compra.huespedes} onChange={e => setCompra({ ...compra, huespedes: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
              </div>

              {tipoSel && (
                <div className="summary" style={{ marginTop: '.5rem' }}>
                  <div className="sum-row"><span>{ETIQUETA[tempCompra]}</span><b>{mxn(precioCompra)}/noche</b></div>
                  <div className="sum-row"><span>Capacidad</span><b>hasta {tipoSel.capacidad} huésped(es)</b></div>
                  <div className="sum-row">
                    <span>Disponibles ahora</span>
                    <b className={tipoSel.disponibles > 0 ? '' : 'field-warn'}>
                      {tipoSel.disponibles > 0 ? `${tipoSel.disponibles} de ${tipoSel.stock}` : 'Agotado'}
                    </b>
                  </div>
                  {depCompra > 0 && <div className="sum-row"><span>Depósito ({tipoSel.deposito_pct}%)</span><b>{mxn(depCompra)}</b></div>}
                  <div className="sum-total"><span>Total {compra.noches} noche(s)</span><b>{mxn(totalCompra)}</b></div>
                </div>
              )}

              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={busy || !compra.tipo_habitacion_id}>
                  {busy ? 'Procesando…' : 'Confirmar reserva'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ───────── COORDINADOR: todas las reservas ───────── */}
      {esCoord && (
        <div className="table-wrap" style={{ marginBottom: '1.75rem' }}>
          <div className="table-head"><span className="table-head-title">Reservas del complejo</span></div>
          <table>
            <thead>
              <tr><th>Folio</th><th>Huésped</th><th>Cuenta</th><th>Habitación</th><th>Noches</th><th>Temporada</th><th>Total</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {reservasAll.map(r => (
                <tr key={r.id}>
                  <td><code>{r.folio}</code></td>
                  <td><strong>{r.huesped}</strong><div style={{ fontSize: '.76rem', color: 'var(--text-light)' }}>{r.email}{r.empresa ? ` · ${r.empresa}` : ''}</div></td>
                  <td><span className={`brazalete bz-${r.tipo_cuenta === 'turista' ? 'coral' : 'morado'}`}>{r.tipo_cuenta}</span></td>
                  <td>{r.habitacion}{r.origen === 'default' && <span className="badge badge-aprobada" style={{ marginLeft: 6 }}>incluida</span>}</td>
                  <td>{r.noches}</td>
                  <td style={{ fontSize: '.8rem' }}>{r.temporada}</td>
                  <td>{mxn(r.total)}</td>
                  <td><span className={`badge badge-${r.estado === 'activa' ? 'confirmada' : 'cancelada'}`}>{r.estado}</span></td>
                </tr>
              ))}
              {reservasAll.length === 0 && (
                <tr><td colSpan={8}><div className="empty"><span><Icon name="building" size={28} /></span><p>Sin reservas registradas</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ───────── CATÁLOGO DE HABITACIONES (todos) ───────── */}
      <div className="content-hdr"><div><div className="content-hdr-title" style={{ fontSize: '1.1rem' }}>Catálogo de habitaciones</div><div className="content-hdr-sub">180 habitaciones · capacidad máxima 516 huéspedes</div></div></div>
      <div className="hab-grid">
        {catalogo.map(t => (
          <article className="hab-card" key={t.id}>
            <div className="hab-card-top">
              <span className="hab-ic"><Icon name="building" size={20} /></span>
              <span className={`badge ${t.disponibles > 0 ? 'badge-aprobada' : 'badge-rechazada'}`}>{t.disponibles > 0 ? `${t.disponibles} disp.` : 'agotado'}</span>
            </div>
            <h4>{t.nombre}</h4>
            <p className="hab-desc">{t.descripcion}</p>
            <ul className="hab-meta">
              <li><Icon name="users" size={14} /> Hasta {t.capacidad} huésped(es)</li>
              <li><Icon name="layers" size={14} /> {t.stock} habitaciones</li>
              {t.deposito_pct > 0 && <li><Icon name="card" size={14} /> Depósito {t.deposito_pct}% al reservar</li>}
            </ul>
            <div className="hab-price"><b>{mxn(t.precio_noche)}</b><span>/noche · temp. baja</span></div>
          </article>
        ))}
      </div>
    </div>
  )
}
