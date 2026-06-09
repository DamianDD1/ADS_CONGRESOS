import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import Icon from './Icon'

const CAT_ICON = {
  hospedaje:    'building',
  gastronomia:  'utensils',
  audiovisual:  'video',
  traslados:    'truck',
  actividades:  'compass',
  otro:         'box',
}

// Colores por categoría (índice circular)
const CAT_COLORS = [
  { bg: 'var(--teal-light)',   fg: 'var(--teal-dark)' },
  { bg: '#e8f0ff',             fg: '#2c5cc5' },
  { bg: '#fff4e0',             fg: '#a0660a' },
  { bg: '#f0fff4',             fg: '#1a7340' },
  { bg: '#fef0ff',             fg: '#8b35b5' },
  { bg: '#fff0ee',             fg: '#c0392b' },
]

export default function ProveedoresDisponibles() {
  const { token } = useAuth()
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [busqueda, setBusqueda]       = useState('')
  const [catFiltro, setCatFiltro]     = useState('todas')

  const load = async () => {
    try {
      setLoading(true)
      setProveedores(await apiFetch('/proveedores/disponibles', {}, token))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Categorías únicas presentes
  const categorias = ['todas', ...new Set(proveedores.map(p => p.categoria))]

  const filtrados = proveedores.filter(p => {
    const matchCat = catFiltro === 'todas' || p.categoria === catFiltro
    const q = busqueda.toLowerCase()
    const matchQ = !q || p.empresa.toLowerCase().includes(q) ||
      p.contacto?.toLowerCase().includes(q) ||
      p.descripcion?.toLowerCase().includes(q)
    return matchCat && matchQ
  })

  // Mapa categoría → color index
  const catIdx = {}
  categorias.filter(c => c !== 'todas').forEach((c, i) => { catIdx[c] = i })

  if (loading) return <div className="empty"><span className="spinner" /></div>

  return (
    <div>
      {error && <div className="alert alert-error"><Icon name="alert" size={17} /> {error}</div>}

      <div className="content-hdr">
        <div>
          <div className="content-hdr-title">Proveedores disponibles</div>
          <div className="content-hdr-sub">
            {proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''} registrado{proveedores.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={load}>
          <Icon name="refresh-cw" size={15} /> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.2rem', alignItems: 'center' }}>
        {/* Búsqueda */}
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <Icon name="search" size={15} />
          </span>
          <input
            style={{ paddingLeft: 32, width: '100%' }}
            placeholder="Buscar por empresa, contacto…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        {/* Filtro categoría */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {categorias.map(cat => {
            const col = cat === 'todas' ? null : CAT_COLORS[catIdx[cat] % CAT_COLORS.length]
            const activo = catFiltro === cat
            return (
              <button
                key={cat}
                onClick={() => setCatFiltro(cat)}
                style={{
                  padding: '4px 14px',
                  borderRadius: 99,
                  border: activo ? '2px solid transparent' : '1.5px solid var(--border)',
                  background: activo ? (col ? col.bg : 'var(--gold)') : 'transparent',
                  color: activo ? (col ? col.fg : '#fff') : 'var(--text-muted)',
                  fontWeight: activo ? 700 : 400,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all .15s',
                  textTransform: 'capitalize',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                {cat !== 'todas' && <Icon name={CAT_ICON[cat] || 'box'} size={12} />}
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="empty">
          <span><Icon name="store" size={28} /></span>
          <p>{busqueda || catFiltro !== 'todas' ? 'Sin resultados para este filtro' : 'Aún no hay proveedores registrados'}</p>
        </div>
      ) : (
        <div className="cards-grid">
          {filtrados.map(p => {
            const col = CAT_COLORS[catIdx[p.categoria] % CAT_COLORS.length]
            return (
              <div key={p.id} className={`card ${p.imagen_url ? 'has-img' : ''}`}>
                {p.imagen_url && <img className="card-img" src={p.imagen_url} alt={p.empresa} />}

                <div className="card-header">
                  <span
                    className="card-status"
                    style={{ background: col.bg, color: col.fg, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <Icon name={CAT_ICON[p.categoria] || 'box'} size={13} />
                    {p.categoria}
                  </span>
                </div>

                <div className="card-body">
                  <div className="card-title">{p.empresa}</div>
                  {p.descripcion && <div className="card-desc">{p.descripcion}</div>}

                  <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                    <div className="card-detail"><Icon name="user" size={14} /> {p.contacto}</div>
                    <div className="card-detail"><Icon name="mail" size={14} />
                      <a href={`mailto:${p.email}`} style={{ color: 'inherit' }}>{p.email}</a>
                    </div>
                    {p.sitio_web && (
                      <div className="card-detail"><Icon name="link" size={14} />
                        <a href={p.sitio_web} target="_blank" rel="noreferrer" style={{ color: 'var(--teal)' }}>
                          Visitar sitio web
                        </a>
                      </div>
                    )}
                    {p.rfc && <div className="card-detail"><Icon name="file-text" size={14} /> RFC: {p.rfc}</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
