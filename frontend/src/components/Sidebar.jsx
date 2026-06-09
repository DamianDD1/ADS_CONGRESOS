import { useAuth } from '../context/AuthContext'
import Icon, { BrandMark } from './Icon'

const NAV = [
  { key:'congresos',              icon:'briefcase',    label:'Congresos',              roles:['coordinador','autor','proveedor','cliente'] },
  { key:'ponencias',              icon:'mic',          label:'Ponencias',              roles:['coordinador','autor'] },
  { key:'habitaciones',           icon:'building',     label:'Habitaciones',           roles:['coordinador','cliente'] },
  { key:'proveedores-disponibles',icon:'store',        label:'Proveedores disponibles',roles:['coordinador'] },
  { key:'mensajes',               icon:'mail',         label:'Mensajes',               roles:['coordinador'] },
  { key:'notificaciones',         icon:'bell',         label:'Notificaciones',         roles:['proveedor'] },
]

// Color de acreditación por rol
const ROLE_BZ = { coordinador:'dorado', autor:'azul', proveedor:'verde', cliente:'morado' }

export default function Sidebar({ active, onSelect }) {
  const { user, logout } = useAuth()
  const items = NAV.filter(n => n.roles.includes(user?.rol))
  const initials = user ? (user.nombre[0] + (user.apellidos?.[0] || '')).toUpperCase() : '?'

  // Un asistente puede ser CLIENTE (viene de una empresa) o TURISTA (por su
  // cuenta). En ese caso mostramos "turista" y no el rol genérico "cliente".
  const esTurista = user?.tipo_cuenta === 'turista'
  const etiqueta = esTurista ? 'turista' : user?.rol
  const bzColor = esTurista ? 'coral' : (ROLE_BZ[user?.rol] || 'morado')

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <span className="sidebar-palm"><BrandMark size={30} /></span>
          <div>
            <span className="sidebar-name">Riviera Maya</span>
            <span className="sidebar-sub">Congresos</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-section">Menú principal</span>
        {items.map(item => (
          <button key={item.key} className={`sidebar-item ${active === item.key ? 'active' : ''}`} onClick={() => onSelect(item.key)}>
            <span className="sidebar-item-icon"><Icon name={item.icon} size={19} /></span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div>
            <span className="sidebar-uname">{user?.nombre} {user?.apellidos}</span>
            <span className={`brazalete bz-${bzColor}`} style={{ marginTop: '4px' }}>{etiqueta}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={logout}><Icon name="logout" size={17} /> Cerrar sesión</button>
      </div>
    </aside>
  )
}
