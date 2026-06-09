import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import Icon from './Icon'

const CATS = ['hospedaje','gastronomia','audiovisual','traslados','actividades','otro']
const CAT_ICON = { hospedaje:'building', gastronomia:'utensils', audiovisual:'video', traslados:'truck', actividades:'compass', otro:'box' }

export default function ProveedoresList() {
  const { token, user } = useAuth()
  const [proveedores, setProveedores] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ empresa:'', categoria_id:1, descripcion:'', sitio_web:'', rfc:'', imagen_url:'' })
  const [imgName, setImgName] = useState('')
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fetch_ = async () => { try { setProveedores(await apiFetch('/proveedores',{},token)) } catch(e) { setError(e.message) } }
  useEffect(() => { fetch_() }, [])

  const onFile = file => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('El archivo debe ser una imagen.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no debe exceder 5 MB.'); return }
    setError('')
    setImgName(file.name)
    const r = new FileReader()
    r.onload = () => setForm(f => ({ ...f, imagen_url: r.result })) // data URL base64
    r.readAsDataURL(file)
  }
  const resetForm = () => {
    setShowForm(false)
    setForm({ empresa:'', categoria_id:1, descripcion:'', sitio_web:'', rfc:'', imagen_url:'' })
    setImgName('')
  }

  const submit = async e => {
    e.preventDefault(); setLoading(true)
    try { await apiFetch('/proveedores',{method:'POST',body:JSON.stringify(form)},token); resetForm(); fetch_() }
    catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div>
      {error && <div className="alert alert-error"><Icon name="alert" size={17} /> {error}</div>}

      <div className="content-hdr">
        <div>
          <div className="content-hdr-title">Directorio de proveedores</div>
          <div className="content-hdr-sub">{proveedores.length} empresa{proveedores.length!==1?'s':''} registrada{proveedores.length!==1?'s':''}</div>
        </div>
        {user?.rol==='proveedor' && (
          <button className={`btn ${showForm?'btn-ghost':'btn-gold'}`} onClick={()=> showForm ? resetForm() : setShowForm(true)}>
            {showForm ? <><Icon name="x" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Registrar empresa</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="form-card">
          <div className="form-card-title">Registro de empresa proveedora</div>
          <div className="form-card-sub">Tu información será visible para los coordinadores</div>
          <form onSubmit={submit}>
            <div className="field-row">
              <div className="field"><label>Nombre de empresa *</label><input type="text" value={form.empresa} onChange={e=>setForm({...form,empresa:e.target.value})} required /></div>
              <div className="field"><label>Categoría *</label>
                <select value={form.categoria_id} onChange={e=>setForm({...form,categoria_id:parseInt(e.target.value)})}>
                  {CATS.map((c,i)=><option key={i} value={i+1}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Descripción de servicios</label><textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} rows={3} /></div>
            <div className="field-row">
              <div className="field"><label>Sitio web</label><input type="url" value={form.sitio_web} onChange={e=>setForm({...form,sitio_web:e.target.value})} placeholder="https://…" /></div>
              <div className="field"><label>RFC</label><input type="text" value={form.rfc} onChange={e=>setForm({...form,rfc:e.target.value})} /></div>
            </div>
            <div className="field">
              <label>Imagen de referencia</label>
              <div className={`dropzone ${drag ? 'drag' : ''}`}
                onClick={() => document.getElementById('prov-img').click()}
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]) }}>
                <span className="dz-icon"><Icon name="image" size={30} /></span>
                <b>Arrastra una imagen aquí</b>
                <small>o haz clic para explorar · PNG, JPG hasta 5 MB</small>
              </div>
              <input type="file" id="prov-img" accept="image/*" hidden onChange={e => onFile(e.target.files[0])} />
              {imgName && <div className="dz-preview"><Icon name="paperclip" size={16} /> {imgName}<span className="x" onClick={() => { setImgName(''); setForm(f => ({ ...f, imagen_url: '' })) }}><Icon name="x" size={15} /></span></div>}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Guardando…':'Registrar empresa'}</button>
              <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {proveedores.length === 0
        ? <div className="empty"><span><Icon name="store" size={28} /></span><p>Sin proveedores registrados aún</p></div>
        : (
          <div className="cards-grid">
            {proveedores.map(p => (
              <div key={p.id} className={`card ${p.imagen_url ? 'has-img' : ''}`}>
                {p.imagen_url && <img className="card-img" src={p.imagen_url} alt={p.empresa} />}
                <div className="card-header">
                  <span className="card-status" style={{background:'var(--teal-light)',color:'var(--teal-dark)',display:'inline-flex',alignItems:'center',gap:6}}><Icon name={CAT_ICON[p.categoria]||'box'} size={14} /> {p.categoria}</span>
                </div>
                <div className="card-body">
                  <div className="card-title">{p.empresa}</div>
                  {p.descripcion && <div className="card-desc">{p.descripcion}</div>}
                  <div className="card-detail" style={{marginTop:'.75rem'}}><Icon name="user" size={15} /> {p.contacto}</div>
                  <div className="card-detail"><Icon name="mail" size={15} /> {p.email}</div>
                  {p.sitio_web && <div className="card-detail"><Icon name="link" size={15} /> <a href={p.sitio_web} target="_blank" rel="noreferrer">{p.sitio_web}</a></div>}
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
