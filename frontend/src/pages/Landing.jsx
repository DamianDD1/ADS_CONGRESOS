import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import Icon, { BrandMark } from '../components/Icon'
import RivieraScene, { HeroOrb } from '../components/RivieraScene'
import { soloDigitos, emailTieneArroba } from '../utils/validacion'

/* Las vías de registro que pidió el negocio.
   rol_id mapea con el backend: 4=Cliente/Turista · 3=Proveedor · 2=Ponente.
   El asistente se divide en Cliente (viene de una empresa) y Turista (por su cuenta). */
const REGISTROS = [
  {
    rol: 4, tipo: 'cliente',
    cls: 'is-cliente',
    icon: 'briefcase',
    titulo: 'Cliente',
    tagline: 'Vienes de una empresa',
    desc: 'Acredítate con el convenio de tu empresa. Validamos tu código y estrenas una habitación estándar incluida que puedes mejorar o extender cuando quieras.',
    perks: ['Validación por convenio de empresa', 'Habitación estándar incluida por defecto', 'Mejora de nivel o más noches pagando la diferencia'],
    cta: 'Registrarme como cliente',
  },
  {
    rol: 4, tipo: 'turista',
    cls: 'is-turista',
    icon: 'ticket',
    titulo: 'Turista',
    tagline: 'Vienes por tu cuenta',
    desc: 'Sin necesidad de empresa. Recorre el complejo, asiste al evento pagando la cuota turista y compra la habitación que prefieras del catálogo.',
    perks: ['Registro libre, sin empresa', 'Compra la habitación que elijas', 'Acceso a albercas, actividades y experiencias'],
    cta: 'Registrarme como turista',
  },
  {
    rol: 3, tipo: null,
    cls: 'is-proveedor',
    icon: 'store',
    titulo: 'Proveedores',
    tagline: 'Exhibe tus servicios',
    desc: 'Postula tu empresa por categoría —hospedaje, gastronomía, audiovisual, traslados— y consigue un stand para mostrar tu oferta.',
    perks: ['Stand en el directorio de expositores', 'Postulación por categoría de servicio', 'Contacto directo con compradores'],
    cta: 'Registra mi empresa',
  },
  {
    rol: 2, tipo: null,
    cls: 'is-ponente',
    icon: 'mic',
    titulo: 'Ponentes',
    tagline: 'Comparte tu conocimiento',
    desc: 'Envía tu propuesta de ponencia, asigna a tus autores y forma parte del programa académico y de conferencias del evento.',
    perks: ['Envío y seguimiento de ponencias', 'Asignación de coautores', 'Espacio en el programa de conferencias'],
    cta: 'Postular una ponencia',
  },
]

/* Datos del complejo turístico (ficha del hotel) */
const HABITACIONES_FALLBACK = [
  { id: 'estandar', nombre: 'Estándar', precio_noche: 1800, capacidad: 2, stock: 70, deposito_pct: 0, descripcion: '2 personas · una cama matrimonial y una individual.' },
  { id: 'doble', nombre: 'Doble', precio_noche: 2500, capacidad: 4, stock: 40, deposito_pct: 0, descripcion: '4 personas · dos camas matrimoniales.' },
  { id: 'vista_mar', nombre: 'Vista al Mar (Premium)', precio_noche: 3200, capacidad: 2, stock: 30, deposito_pct: 0, descripcion: 'Premium · mitad matrimonial, mitad individual, con vista al mar.' },
  { id: 'suite_junior', nombre: 'Suite Junior', precio_noche: 4200, capacidad: 3, stock: 20, deposito_pct: 0, descripcion: '3 personas · una cama matrimonial y una individual.' },
  { id: 'suite_ejecutiva', nombre: 'Suite Ejecutiva', precio_noche: 5500, capacidad: 2, stock: 12, deposito_pct: 0, descripcion: '2 camas matrimoniales, sala, mini bar, balcón y cocineta.' },
  { id: 'suite_presidencial', nombre: 'Suite Presidencial', precio_noche: 9000, capacidad: 8, stock: 8, deposito_pct: 30, descripcion: 'Sala-comedor, jacuzzi, terraza privada, 2 camas King Size y sofá-cama.' },
]

const ALBERCAS = [
  { nombre: 'Principal', cap: 200, nota: 'Nado libre y eventos' },
  { nombre: 'Familiar', cap: 150, nota: 'Para toda la familia' },
  { nombre: 'Infantil', cap: 80, nota: 'Clases de natación para niños' },
  { nombre: 'Vista al Mar', cap: 90, nota: 'Frente al mar' },
  { nombre: 'Deportiva', cap: 100, nota: 'Solo eventos de natación' },
]

const EXPERIENCIAS = [
  { icon: 'compass', titulo: 'Recreativas', desc: 'Nado libre, juegos acuáticos, aqua zumba y acuaeróbics, sin costo.' },
  { icon: 'users', titulo: 'Niños', desc: 'Clases de natación sin costo para los más pequeños.' },
  { icon: 'rocket', titulo: 'Relax', desc: 'Sesiones de hidroterapia y yoga acuático · $200 c/u.' },
  { icon: 'compass', titulo: 'Actividades guiadas', desc: 'Kayak, paseo ecológico, tour de snorkel y actividades deportivas.' },
  { icon: 'rocket', titulo: 'Premium', desc: 'Pesca deportiva y buceo para los más aventureros.' },
  { icon: 'clock', titulo: 'Horarios', desc: 'Albercas de 7:00 a 21:00 h · Check-in 3:00 PM · Check-out 12:00 PM.' },
]

const OFERTA = [
  { icon:'briefcase', titulo:'Gestión de congresos', promesa:'Planeación de punta a punta', desc:'Crea y configura congresos, ferias y seminarios con control total de aforo, sede y fechas.' },
  { icon:'mic',       titulo:'Ponencias y autores', promesa:'Contenido curado', desc:'Recibe propuestas, asigna autores y aprueba o devuelve ponencias con retroalimentación clara.' },
  { icon:'store',     titulo:'Proveedores y stands', promesa:'Ecosistema de aliados', desc:'Invita o recibe postulaciones por categoría: hospedaje, gastronomía, audiovisual y traslados.' },
  { icon:'ticket',    titulo:'Inscripciones', promesa:'Acreditación sin fricción', desc:'Administra asistentes, folios, brazaletes y estados de pago en un solo lugar.' },
  { icon:'building',  titulo:'Salones y aforo', promesa:'Espacios bajo control', desc:'Reserva salones del catálogo con precios congelados y valida la capacidad real del recinto.' },
  { icon:'file',      titulo:'Facturación CFDI', promesa:'Cumplimiento fiscal', desc:'Genera comprobantes en PDF con subtotal, IVA, multas y meses sin intereses listos para descargar.' },
]

const TIPO_LABEL = {
  academico: 'Académico', empresarial: 'Empresarial', feria: 'Feria Comercial',
  seminario: 'Seminario', productos: 'Presentación de Productos',
}

/* Formulario público de contacto. Los mensajes solo le llegan al coordinador. */
function ContactoForm() {
  const [form, setForm] = useState({ nombre:'', apellido:'', email:'', telefono:'', mensaje:'' })
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)

  const emailOk = form.email === '' || emailTieneArroba(form.email)

  const submit = async e => {
    e.preventDefault(); setError('')

    if (!emailTieneArroba(form.email)) { setError('El correo debe contener al menos una «@»'); return }

    setLoading(true)
    try {
      await apiFetch('/mensajes', { method:'POST', body:JSON.stringify(form) })
      setEnviado(true)
      setForm({ nombre:'', apellido:'', email:'', telefono:'', mensaje:'' })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <form className="ct-form" onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}
      {enviado && <div className="alert alert-success"><Icon name="check" size={18} /> ¡Gracias! Tu mensaje fue enviado al coordinador.</div>}

      <div className="ct-row">
        <div className="field">
          <label>Nombre <span className="req">*</span></label>
          <input type="text" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} required />
        </div>
        <div className="field">
          <label>Apellido</label>
          <input type="text" value={form.apellido} onChange={e=>setForm({...form,apellido:e.target.value})} />
        </div>
      </div>

      <div className="field">
        <label>Correo <span className="req">*</span></label>
        <input
          type="email"
          value={form.email}
          onChange={e=>setForm({...form,email:e.target.value})}
          className={!emailOk ? 'input-warn' : ''}
          required
        />
        {!emailOk && <p className="field-warn"><Icon name="alert" size={13} /> El correo debe contener al menos una «@»</p>}
      </div>

      <div className="field">
        <label>Número de teléfono</label>
        <input
          type="tel"
          inputMode="numeric"
          value={form.telefono}
          onChange={e=>setForm({...form,telefono:soloDigitos(e.target.value)})}
          placeholder="Solo números"
        />
      </div>

      <div className="field">
        <label>Cuéntanos un poco de tu evento <span className="req">*</span></label>
        <textarea rows="4" value={form.mensaje} onChange={e=>setForm({...form,mensaje:e.target.value})} required />
      </div>

      <button type="submit" className="ev-btn ev-btn-crimson ct-send" disabled={loading}>
        {loading ? 'Enviando…' : 'Enviar'} <Icon name="arrowRight" size={15} />
      </button>
    </form>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [congresos, setCongresos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [habitaciones, setHabitaciones] = useState(HABITACIONES_FALLBACK)

  useEffect(() => {
    apiFetch('/congresos/publicos')
      .then(data => setCongresos(Array.isArray(data) ? data : []))
      .catch(() => setCongresos([]))
      .finally(() => setCargando(false))

    apiFetch('/habitaciones/catalogo')
      .then(data => {
        const tipos = Array.isArray(data?.tipos) ? data.tipos : (Array.isArray(data) ? data : [])
        if (tipos.length) setHabitaciones(tipos)
      })
      .catch(() => { /* se conserva el fallback con los datos del complejo */ })
  }, [])

  const mxn = n => '$' + Number(n || 0).toLocaleString('es-MX')

  // Calcula el estado visible de cada congreso (terminado / en curso / por iniciar)
  const estadoCongreso = c => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const ini = new Date(c.fecha_inicio); ini.setHours(0, 0, 0, 0)
    const fin = new Date(c.fecha_fin);    fin.setHours(0, 0, 0, 0)
    const dias = Math.round((ini - hoy) / 864e5)
    // Ya terminó: la fecha de fin quedó en el pasado o el coordinador lo cerró
    if (c.estado === 'cerrado' || fin < hoy) return { k: 'terminado', label: 'Evento terminado' }
    // En curso: hoy cae dentro del rango de fechas o el coordinador ya lo activó
    if (c.estado === 'activo' || (ini <= hoy && hoy <= fin)) return { k: 'curso', label: 'En curso' }
    if (dias <= 0) return { k: 'curso', label: 'En curso' }
    if (dias <= 30) return { k: 'pronto', label: `Empieza en ${dias} día${dias !== 1 ? 's' : ''}` }
    return { k: 'proximo', label: 'Próximamente' }
  }
  const fecha = d => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="lp">
      {/* ───────── BARRA SUPERIOR (evento) ───────── */}
      <header className="ev-topbar">
        <Link to="/" className="ev-brand">
          <span className="ev-brand-mark"><BrandMark size={32} /></span>
          <span className="ev-brand-text">
            <b>Riviera Maya</b>
            <small>Congresos</small>
          </span>
        </Link>
        <div className="ev-meta">
          <span className="ev-meta-item"><Icon name="calendar" size={16} /> Proximamente 2026</span>
          <span className="ev-meta-item"><Icon name="pin" size={16} /> Centro de Convenciones · Riviera Maya</span>
        </div>
        <div className="ev-top-actions">
          {user ? (
            <button className="ev-top-cta solid" onClick={() => navigate('/dashboard')}>Mi panel</button>
          ) : (
            <>
              <Link to="/register?rol=4" className="ev-top-cta solid">Registro</Link>
              <Link to="/login" className="ev-top-cta ghost">Iniciar sesión</Link>
            </>
          )}
        </div>
      </header>

      {/* ───────── NAV DE SECCIONES ───────── */}
      <nav className="ev-nav">
        <a href="#congresos">Congresos</a>
        <a href="#registro">Registro</a>
        <a href="#complejo">El complejo</a>
        <a href="#oferta">Exhibe</a>
        <a href="#oferta">Visita</a>
        <a href="#registro">Directorio</a>
        <a href="#lograr">Conferencias</a>
        <a href="#contacto">Contacto</a>
      </nav>

      {/* ───────── HERO ───────── */}
      <section className="ev-hero">
        <div className="ev-hero-scene"><RivieraScene /></div>
        <div className="ev-hero-veil" />
        <div className="ev-hero-inner">
          <div className="fade-up">
            <span className="ev-hero-eyebrow">¡Abrimos registro!</span>
            <h1 className="ev-hero-title">Donde las culturas<br /><em>hacen negocios</em></h1>
            <p className="ev-hero-sub">
              Descubre tendencias, genera networking y conecta con event planners, compradores,
              destinos y proveedores de todo Mexico.
              <span className="ev-hero-claim">Tres formas de ser parte: asiste, exhibe o sé ponente.</span>
            </p>
            <div className="ev-hero-meta">
              <span><Icon name="calendar" size={15} /> Congresos 2026</span>
              <span><Icon name="pin" size={15} /> Congresos Empresariales, Riviera Maya</span>
            </div>
            <div className="ev-hero-actions">
              <a href="#registro" className="ev-btn ev-btn-dark">Ver opciones de registro <Icon name="arrowRight" size={16} /></a>
              {!user && <Link to="/login" className="ev-btn ev-btn-crimson">Ya tengo cuenta</Link>}
            </div>
          </div>
          <div className="ev-hero-orb fade-up" style={{ animationDelay:'.15s' }}>
            <HeroOrb size={380} />
          </div>
        </div>
      </section>

      {/* ───────── CONGRESOS EN CARTELERA ───────── */}
      <section className="lpc" id="congresos">
        <div className="lpc-head">
          <span className="eyebrow">Cartelera</span>
          <h2>Congresos en curso, próximos y recientes</h2>
          <p>Aquí verás los eventos en marcha, los que están por comenzar y los que ya finalizaron. Regístrate y asegura tu lugar.</p>
        </div>

        {cargando ? (
          <div className="lpc-empty"><span><Icon name="clock" size={26} /></span><p>Cargando congresos…</p></div>
        ) : congresos.length === 0 ? (
          <div className="lpc-empty">
            <span><Icon name="calendar" size={26} /></span>
            <p>Aún no hay congresos publicados. ¡Vuelve pronto!</p>
          </div>
        ) : (
          <div className="lpc-grid">
            {congresos.map((c, i) => {
              const st = estadoCongreso(c)
              return (
                <article className="lpc-card fade-up" key={c.id} style={{ animationDelay: `${i * 0.07}s` }}>
                  <div className="lpc-media">
                    {c.imagen_url
                      ? <img src={c.imagen_url} alt={c.nombre} />
                      : <div className="lpc-media-ph"><Icon name="building" size={38} /></div>}
                    <span className={`lpc-chip lpc-${st.k}`}>{st.label}</span>
                  </div>
                  <div className="lpc-body">
                    {c.tipo_congreso && <span className="lpc-tipo"><Icon name="tag" size={13} /> {TIPO_LABEL[c.tipo_congreso] || c.tipo_congreso}</span>}
                    <h3>{c.nombre}</h3>
                    {c.tematica && <p className="lpc-tema">{c.tematica}</p>}
                    <ul className="lpc-meta">
                      <li><Icon name="calendar" size={15} /> {fecha(c.fecha_inicio)} — {fecha(c.fecha_fin)}</li>
                      {c.sede && <li><Icon name="pin" size={15} /> {c.sede}</li>}
                      {c.aforo_max > 0 && <li><Icon name="users" size={15} /> Aforo {c.aforo_max.toLocaleString('es-MX')}</li>}
                      {c.cuota_turista > 0 && <li><Icon name="ticket" size={15} /> Entrada turista {mxn(c.cuota_turista)}</li>}
                    </ul>
                    {c.descripcion && <p className="lpc-desc">{c.descripcion.substring(0, 110)}{c.descripcion.length > 110 ? '…' : ''}</p>}
                    {st.k === 'terminado'
                      ? <span className="ev-btn lpc-cta lpc-cta-done"><Icon name="check" size={15} /> Evento finalizado</span>
                      : user
                        ? <button className="ev-btn ev-btn-crimson lpc-cta" onClick={() => navigate('/dashboard')}>Ir a mi panel <Icon name="arrowRight" size={15} /></button>
                        : <Link to="/register?rol=4" className="ev-btn ev-btn-crimson lpc-cta">Registrarme <Icon name="arrowRight" size={15} /></Link>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* ───────── 3 OPCIONES DE REGISTRO ───────── */}
      <section className="reg" id="registro">
        <div className="reg-head">
          <span className="eyebrow">Forma parte</span>
          <h2 className="reg-title">Elige cómo quieres participar</h2>
          <p className="reg-sub">
            Cuatro vías de acceso al evento donde las culturas se reúnen para hacer negocios.
            Selecciona tu perfil y completa tu registro en minutos.
          </p>
        </div>
        <div className="reg-grid">
          {REGISTROS.map((r, i) => (
            <article className={`reg-card ${r.cls} fade-up`} key={`${r.rol}-${r.tipo || 'x'}`} style={{ animationDelay:`${i * 0.1}s` }}>
              <span className="reg-card-ic"><Icon name={r.icon} size={28} /></span>
              <h3>{r.titulo}</h3>
              <p className="reg-tagline">{r.tagline}</p>
              <p className="reg-desc">{r.desc}</p>
              <ul className="reg-perks">
                {r.perks.map(p => (
                  <li key={p}><Icon name="check" size={16} /> {p}</li>
                ))}
              </ul>
              <Link to={`/register?rol=${r.rol}${r.tipo ? `&tipo=${r.tipo}` : ''}`} className="ev-btn ev-btn-crimson">
                {r.cta} <Icon name="arrowRight" size={15} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* ───────── EL COMPLEJO TURÍSTICO ───────── */}
      <section className="complejo" id="complejo">
        <div className="reg-head">
          <span className="eyebrow">Riviera Maya</span>
          <h2 className="reg-title">Lo que contiene el complejo turístico</h2>
          <p className="reg-sub">
            180 habitaciones para una capacidad máxima de 516 huéspedes, distribuidas en tres
            edificios frente al mar, con albercas, actividades y experiencias incluidas en tu estancia.
          </p>
        </div>

        {/* Datos rápidos del complejo */}
        <div className="cx-facts">
          <div className="cx-fact"><span className="cx-num">180</span><span className="cx-lbl">Habitaciones</span></div>
          <div className="cx-fact"><span className="cx-num">516</span><span className="cx-lbl">Huéspedes máx.</span></div>
          <div className="cx-fact"><span className="cx-num">3</span><span className="cx-lbl">Edificios · A·B·C</span></div>
          <div className="cx-fact"><span className="cx-num">5</span><span className="cx-lbl">Albercas</span></div>
        </div>

        {/* Catálogo de habitaciones */}
        <h3 className="cx-subtitle"><Icon name="building" size={20} /> Habitaciones</h3>
        <div className="hab-grid">
          {habitaciones.map(h => (
            <article className="hab-card" key={h.id || h.codigo || h.nombre}>
              <span className="hab-ic"><Icon name="building" size={22} /></span>
              <h4>{h.nombre}</h4>
              <p className="hab-desc">{h.descripcion}</p>
              <div className="hab-meta">
                <span className="badge"><Icon name="users" size={14} /> {h.capacidad} pers.</span>
                <span className="badge"><Icon name="layers" size={14} /> {h.stock} disp.</span>
                {Number(h.deposito_pct) > 0 && (
                  <span className="badge badge-aprobada"><Icon name="info" size={14} /> Depósito {h.deposito_pct}%</span>
                )}
              </div>
              <div className="hab-price">
                <strong>{mxn(h.precio_noche)}</strong> <span>/ noche</span>
              </div>
            </article>
          ))}
        </div>
        <p className="info-note">
          <Icon name="info" size={16} /> El precio varía por temporada: media +15% (semana antes/después de
          vacaciones, sábados y domingos), alta +35% (vacaciones y Semana Santa) y fechas oficiales +50%
          (Año Nuevo, Navidad y Día del Trabajo). Check-in 3:00 PM · Check-out 12:00 PM.
        </p>

        {/* Albercas */}
        <h3 className="cx-subtitle"><Icon name="compass" size={20} /> Albercas</h3>
        <div className="cx-pool-grid">
          {ALBERCAS.map(a => (
            <article className="cx-pool" key={a.nombre}>
              <h4>{a.nombre}</h4>
              <span className="cx-pool-cap">{a.cap} personas</span>
              <p>{a.nota}</p>
            </article>
          ))}
        </div>

        {/* Experiencias y actividades */}
        <h3 className="cx-subtitle"><Icon name="rocket" size={20} /> Actividades y experiencias</h3>
        <div className="cx-exp-grid">
          {EXPERIENCIAS.map(e => (
            <article className="cx-exp" key={e.titulo}>
              <span className="cx-exp-ic"><Icon name={e.icon} size={20} /></span>
              <div>
                <h4>{e.titulo}</h4>
                <p>{e.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ───────── OFERTA / FEATURES ───────── */}
      <section className="offer" id="oferta">
        <div className="offer-head">
          <span className="eyebrow">La plataforma</span>
          <h2>Descubre una oferta internacional</h2>
          <p>Seis módulos centrales que dan forma a la operación completa del evento, del primer registro al comprobante fiscal.</p>
        </div>
        <div className="offer-grid">
          {OFERTA.map(o => (
            <article className="offer-card" key={o.titulo}>
              <span className="offer-ic"><Icon name={o.icon} size={22} /></span>
              <h4>{o.titulo}</h4>
              <p className="offer-promise">{o.promesa}</p>
              <p>{o.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ───────── LO QUE PUEDES LOGRAR ───────── */}
      <section className="achieve" id="lograr">
        <div className="achieve-inner">
          <div className="achieve-head">
            <span className="eyebrow">Lo que puedes lograr</span>
            <h2>Conecta, exhibe y cierra negocios en un solo lugar</h2>
          </div>
          <div className="achieve-grid">
            <div className="achieve-item">
              <h4>Descubre nuevas ideas</h4>
              <p>Participa en sesiones educativas, paneles y conversaciones que marcan el rumbo de la industria de reuniones, incentivos y exposiciones.</p>
            </div>
            <div className="achieve-item">
              <h4>Encuentra nuevos socios</h4>
              <p>Reúnete con compradores y proveedores internacionales y descubre soluciones que pueden llevar tus eventos al siguiente nivel.</p>
            </div>
            <div className="achieve-item">
              <h4>Conecta con la industria</h4>
              <p>El evento está diseñado para facilitar el networking profesional: cada conversación es una nueva oportunidad de negocio.</p>
            </div>
            <div className="achieve-item">
              <h4>Inspírate con experiencias</h4>
              <p>Descubre cómo la innovación y el diseño están transformando la forma de generar experiencias memorables.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── BANDA CTA ───────── */}
      <section className="cta-band">
        <div className="cta-band-inner">
          <h2>Mientras el mundo mira a México, haz que tu negocio también se note.</h2>
          <p>Participa en el evento donde las culturas se encuentran para cerrar negocios.</p>
          <div className="cta-band-actions">
            <a href="#registro" className="ev-btn ev-btn-light">Registrarme ahora</a>
            <Link to="/login" className="ev-btn ev-btn-outline">Acceder a mi cuenta</Link>
          </div>
        </div>
      </section>

      {/* ───────── PATROCINADORES ───────── */}
      <section className="sponsors">
        <h3>Aliados y patrocinadores</h3>
        <div className="sponsors-row">
          <span className="sponsor-chip"><Icon name="compass" size={20} /> Instituto Politecnico NAcional</span>
          <span className="sponsor-chip"><Icon name="users" size={20} /> ESCOM</span>

        </div>
      </section>

      {/* ───────── CONTACTO ───────── */}
      <section className="contacto" id="contacto">
        <div className="ct-head">
          <h2>¿Quieres que nos pongamos <span>en contacto contigo</span>?</h2>
          <p>Déjanos tus datos y cuéntanos de tu evento. El coordinador te responderá lo antes posible.</p>
        </div>
        <div className="ct-grid">
          {/* Columna de información */}
          <aside className="ct-info">
            <div className="ct-info-item">
              <span className="ct-info-ic"><Icon name="mail" size={22} /></span>
              <div><b>Teléfono</b><p>55 4332 0288</p></div>
            </div>
            <div className="ct-info-item">
              <span className="ct-info-ic"><Icon name="mail" size={22} /></span>
              <div><b>Correo</b><p>contacto@rivieracongresos.mx</p></div>
            </div>
            <div className="ct-info-item">
              <span className="ct-info-ic"><Icon name="pin" size={22} /></span>
              <div><b>Dirección</b><p>Centro de Convenciones,<br />Riviera Maya, México</p></div>
            </div>
          </aside>

          {/* Columna del formulario */}
          <div className="ct-card">
            <ContactoForm />
          </div>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="ev-footer" id="info">
        <div className="ev-footer-inner">
          <div className="ev-footer-brand">
            <Link to="/" className="ev-brand">
              <span className="ev-brand-mark"><BrandMark size={28} /></span>
              <span className="ev-brand-text"><b>Riviera Maya</b><small>Congresos</small></span>
            </Link>
            <p>El punto de encuentro para los protagonistas de la industria de reuniones, incentivos, conferencias y exposiciones del Caribe mexicano.</p>
          </div>
          <div className="ev-footer-col">
            <h5>Información de contacto</h5>
            <span><Icon name="pin" size={14} /> Centro de Convenciones, Riviera Maya</span>
            <a href="mailto:contacto@rivieracongresos.mx"><Icon name="mail" size={14} /> contacto@rivieracongresos.mx</a>
          </div>
          <div className="ev-footer-col">
            <h5>Participa</h5>
            <Link to="/register?rol=4">Registro de asistentes</Link>
            <Link to="/register?rol=3">Registro de proveedores</Link>
            <Link to="/register?rol=2">Registro de ponentes</Link>
            <Link to="/login">Iniciar sesión</Link>
          </div>
        </div>
        <div className="ev-footer-bottom">
          <div className="ev-footer-bottom-inner">
            <small>© {new Date().getFullYear()} Riviera Maya Congresos · Caribe Mexicano</small>
            <div className="links">
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
