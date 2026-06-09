import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import Icon from '../components/Icon'
import Sidebar from '../components/Sidebar'
import CongresosList from '../components/CongresosList'
import PonenciasList from '../components/PonenciasList'
import MensajesList from '../components/MensajesList'
import HabitacionesList from '../components/HabitacionesList'
import ProveedoresDisponibles from '../components/ProveedoresDisponibles'
import NotificacionesList from '../components/NotificacionesList'

const TITLES = {
  congresos:               'Congresos',
  ponencias:               'Ponencias',
  habitaciones:            'Habitaciones',
  mensajes:                'Mensajes',
  'proveedores-disponibles': 'Proveedores disponibles',
  notificaciones:          'Notificaciones',
}

export default function Dashboard() {
  const { user, token } = useAuth()
  const [section, setSection] = useState('congresos')
  const [stats, setStats] = useState({ congresos: 0, inscritos: 0 })

  // El asistente puede ser cliente (de empresa) o turista (por su cuenta).
  const etiquetaRol = user?.tipo_cuenta === 'turista' ? 'turista' : user?.rol
  const pillClass = user?.tipo_cuenta === 'turista' ? 'role-turista' : `role-${user?.rol}`

  useEffect(() => {
    const load = async () => {
      try {
        const c = await apiFetch('/congresos', {}, token)
        const totalInscritos = c.reduce((t, x) => t + (Number(x.inscritos) || 0), 0)
        setStats({ congresos: c.length, inscritos: totalInscritos })
      } catch {}
    }
    load()
  }, [token])

  const renderSection = () => {
    switch (section) {
      case 'congresos':               return <CongresosList />
      case 'ponencias':               return <PonenciasList />
      case 'habitaciones':            return <HabitacionesList />
      case 'mensajes':                return <MensajesList />
      case 'proveedores-disponibles': return <ProveedoresDisponibles />
      case 'notificaciones':          return <NotificacionesList />
      default:                        return <CongresosList />
    }
  }

  return (
    <div className="dashboard">
      <Sidebar active={section} onSelect={setSection} />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">{TITLES[section]}</div>
            <div className="topbar-sub">Sistema de Gestión · Riviera Maya</div>
          </div>
          <div className="topbar-right">
            <span className={`role-pill ${pillClass}`}>{etiquetaRol}</span>
          </div>
        </div>

        <div className="content">
          {section === 'congresos' && (
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-icon si-gold"><Icon name="briefcase" size={22} /></div>
                <div><div className="stat-num">{stats.congresos}</div><div className="stat-lbl">Congresos</div></div>
              </div>
              {user?.rol === 'coordinador' && (
                <div className="stat-card">
                  <div className="stat-icon si-blue"><Icon name="users" size={22} /></div>
                  <div><div className="stat-num">{stats.inscritos}</div><div className="stat-lbl">Asistentes</div></div>
                </div>
              )}
            </div>
          )}
          {renderSection()}
        </div>
      </div>
    </div>
  )
}
