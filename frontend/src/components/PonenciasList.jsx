import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import Icon from './Icon'

export default function PonenciasList() {
  const { token, user } = useAuth()
  const [ponencias, setPonencias] = useState([])
  const [congresos, setCongresos] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ congreso_id:'', titulo:'', resumen:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fetch_ = async () => {
    try {
      const [p, c] = await Promise.all([apiFetch('/ponencias',{},token), apiFetch('/congresos',{},token)])
      setPonencias(p); setCongresos(c)
    } catch(e) { setError(e.message) }
  }
  useEffect(() => { fetch_() }, [])

  const submit = async e => {
    e.preventDefault(); setLoading(true)
    try { await apiFetch('/ponencias',{method:'POST',body:JSON.stringify(form)},token); setShowForm(false); setForm({congreso_id:'',titulo:'',resumen:''}); fetch_() }
    catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  const revisar = async (id, estado) => {
    try { await apiFetch(`/ponencias/${id}/revisar`,{method:'PUT',body:JSON.stringify({estado})},token); fetch_() }
    catch(e) { setError(e.message) }
  }

  return (
    <div>
      {error && <div className="alert alert-error"><Icon name="alert" size={17} /> {error}</div>}

      <div className="content-hdr">
        <div>
          <div className="content-hdr-title">Propuestas de ponencias</div>
          <div className="content-hdr-sub">{ponencias.length} ponencia{ponencias.length!==1?'s':''} registrada{ponencias.length!==1?'s':''}</div>
        </div>
        {user?.rol === 'autor' && (
          <button className={`btn ${showForm?'btn-ghost':'btn-gold'}`} onClick={()=>setShowForm(!showForm)}>
            {showForm ? <><Icon name="x" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Enviar ponencia</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="form-card">
          <div className="form-card-title">Nueva propuesta de ponencia</div>
          <div className="form-card-sub">Envía tu propuesta al coordinador del congreso</div>
          <form onSubmit={submit}>
            <div className="field">
              <label>Congreso *</label>
              <select value={form.congreso_id} onChange={e=>setForm({...form,congreso_id:e.target.value})} required>
                <option value="">— Selecciona un congreso —</option>
                {congresos.filter(c=>c.estado!=='cerrado').map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="field"><label>Título de la ponencia *</label><input type="text" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} required /></div>
            <div className="field"><label>Resumen</label><textarea value={form.resumen} onChange={e=>setForm({...form,resumen:e.target.value})} rows={4} placeholder="Describe brevemente el contenido de tu ponencia…" /></div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Enviando…':'Enviar propuesta'}</button>
              <button type="button" className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap">
        <div className="table-head"><span className="table-head-title">Listado de ponencias</span></div>
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Autor</th>
              <th>Congreso</th>
              <th>Estado</th>
              {user?.rol==='coordinador' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {ponencias.map(p => (
              <tr key={p.id}>
                <td>
                  <strong>{p.titulo}</strong>
                  {p.resumen && <div style={{fontSize:'.76rem',color:'var(--text-light)',marginTop:'2px'}}>{p.resumen.substring(0,60)}…</div>}
                </td>
                <td>{p.autor_nombre}</td>
                <td style={{fontSize:'.82rem'}}>{congresos.find(c=>c.id===p.congreso_id)?.nombre||'—'}</td>
                <td><span className={`badge badge-${p.estado}`}>{p.estado}</span></td>
                {user?.rol==='coordinador' && (
                  <td>
                    {p.estado==='pendiente' && (
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-sm btn-success" onClick={()=>revisar(p.id,'aprobada')}>Aprobar</button>
                        <button className="btn btn-sm btn-danger"  onClick={()=>revisar(p.id,'rechazada')}>Rechazar</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {ponencias.length===0 && (
              <tr><td colSpan={5}><div className="empty"><span><Icon name="mic" size={28} /></span><p>Sin ponencias registradas</p></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
