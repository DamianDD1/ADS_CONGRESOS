import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../hooks/useApi'
import Icon from './Icon'

const TIPOS = [
  { v: 'academico',   l: 'Académico' },
  { v: 'empresarial', l: 'Empresarial' },
  { v: 'feria',       l: 'Feria Comercial' },
  { v: 'seminario',   l: 'Seminario' },
  { v: 'productos',   l: 'Presentación de Productos' },
]
const PASOS = ['General', 'Espacios', 'Proveedores', 'Pago']
const EMPTY = {
  organizador: '', nombre: '', tipo_congreso: '', tematica: '', descripcion: '',
  fecha_inicio: '', fecha_fin: '', cuota_recuperacion: 0, cuota_turista: 0, imagen_url: '',
  modulos_stands: '', incluye_talleres: false, incluye_conferencias: false,
  permite_subapartados: false, permite_postulacion: true,
  pago_metodo: 'tarjeta', msi: 0, requiere_factura: true, rfc: '', razon_social: '',
}

export default function CongresosList() {
  const { token, user } = useAuth()
  const [congresos, setCongresos] = useState([])
  const [salonesCat, setSalonesCat] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY)
  const [salSel, setSalSel] = useState({})       // { codigo: cantidad }
  const [provSel, setProvSel] = useState([])      // [proveedor_id]
  const [imgName, setImgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)

  // ── Inscripción del asistente (cliente / turista) a los congresos ──
  const esAsistente = user?.rol === 'cliente'
  const esTurista = user?.tipo_cuenta === 'turista'
  const [misInscripciones, setMisInscripciones] = useState([])
  const [ticket, setTicket] = useState(null)   // último comprobante de inscripción
  const [inscBusy, setInscBusy] = useState(0)   // id del congreso en proceso

  // ── Proveedores: postulación a congresos ──
  const esProveedor = user?.rol === 'proveedor'
  const esCoordinador = user?.rol === 'coordinador'
  const [misPostulaciones, setMisPostulaciones] = useState([]) // postulaciones del proveedor
  const [pendientes, setPendientes] = useState([])             // postulaciones por revisar (coordinador)
  const [postBusy, setPostBusy] = useState(0)                  // id en proceso

  const loadCongresos = async () => {
    try { setCongresos(await apiFetch('/congresos', {}, token)) } catch (e) { setError(e.message) }
  }
  const loadMisInscripciones = async () => {
    if (!esAsistente) return
    try { setMisInscripciones(await apiFetch('/inscripciones/mias', {}, token)) } catch { /* sin inscripciones */ }
  }
  const loadMisPostulaciones = async () => {
    if (!esProveedor) return
    try { setMisPostulaciones(await apiFetch('/postulaciones/mias', {}, token)) } catch { /* sin postulaciones */ }
  }
  const loadPendientes = async () => {
    if (!esCoordinador) return
    try { setPendientes(await apiFetch('/postulaciones/pendientes', {}, token)) } catch { /* sin pendientes */ }
  }
  // Catálogo de salones; si se pasan fechas, la disponibilidad se calcula para
  // esa ventana (un salón ocupado por un congreso que ya terminó queda libre).
  const loadSalones = (ini = '', fin = '') => {
    const qs = ini && fin ? `?fecha_inicio=${ini}&fecha_fin=${fin}` : ''
    apiFetch(`/salones${qs}`, {}, token).then(setSalonesCat).catch(() => {})
  }
  useEffect(() => {
    loadCongresos()
    loadSalones()
    loadMisInscripciones()
    loadMisPostulaciones()
    loadPendientes()
    apiFetch('/proveedores', {}, token).then(setProveedores).catch(() => {})
  }, [])

  // Cuando cambian las fechas del formulario, recalculamos la disponibilidad de
  // salones para ese rango (así un salón que se desocupa aparece libre).
  useEffect(() => {
    if (form.fecha_inicio && form.fecha_fin) loadSalones(form.fecha_inicio, form.fecha_fin)
  }, [form.fecha_inicio, form.fecha_fin])

  const inscribirme = async (c) => {
    setInscBusy(c.id); setError(''); setTicket(null)
    try {
      const d = await apiFetch('/inscripciones', { method: 'POST', body: JSON.stringify({ congreso_id: c.id }) }, token)
      setTicket({ ...d, congreso: c.nombre })
      await Promise.all([loadCongresos(), loadMisInscripciones()])
    } catch (e) { setError(e.message) } finally { setInscBusy(0) }
  }

  // Política de reembolso al cancelar una inscripción (asistente), según las
  // horas de anticipación: ≥72 h → 100% · 48–72 h → 70% · 24–48 h → 50% ·
  // menos de 24 h → sin reembolso.
  const politicaCancelacion = (fechaInicio) => {
    const horas = (new Date(fechaInicio).getTime() - Date.now()) / 3_600_000
    if (horas >= 72) return { pct: 100, txt: '72 h o más antes' }
    if (horas >= 48) return { pct: 70,  txt: 'entre 48 y 72 h antes' }
    if (horas >= 24) return { pct: 50,  txt: 'entre 24 y 48 h antes' }
    return { pct: 0, txt: 'menos de 24 h antes' }
  }

  const cancelarInscripcion = async (inscrito, c) => {
    const pol = politicaCancelacion(inscrito.fecha_inicio)
    const pagado = Number(inscrito.monto_pagado) || 0
    const reembolsoEstim = Math.round(pagado * pol.pct) / 100
    const detalle = pagado > 0
      ? `\n\nCancelas ${pol.txt}: te corresponde un reembolso del ${pol.pct}% (${mxn(reembolsoEstim)} MXN).`
      : `\n\nCancelas ${pol.txt}. No realizaste ningún pago, por lo que no aplica reembolso.`
    if (!confirm(`¿Cancelar tu inscripción a "${c.nombre}"?${detalle}`)) return
    setInscBusy(c.id); setError(''); setTicket(null)
    try {
      const r = await apiFetch(`/inscripciones/${inscrito.id}/cancelar`, { method: 'PUT' }, token)
      if (r?.politica) alert(r.politica)
      await Promise.all([loadCongresos(), loadMisInscripciones()])
    } catch (e) { setError(e.message) } finally { setInscBusy(0) }
  }

  // El proveedor se postula a un congreso abierto
  const postularme = async (c) => {
    setPostBusy(c.id); setError('')
    try {
      await apiFetch('/postulaciones', { method: 'POST', body: JSON.stringify({ congreso_id: c.id }) }, token)
      await loadMisPostulaciones()
    } catch (e) { setError(e.message) } finally { setPostBusy(0) }
  }

  // El coordinador acepta o rechaza una postulación (dispara la notificación al proveedor)
  const resolverPostulacion = async (id, estado) => {
    setPostBusy(id); setError('')
    try {
      await apiFetch(`/postulaciones/${id}/estado`, { method: 'PUT', body: JSON.stringify({ estado }) }, token)
      await loadPendientes()
    } catch (e) { setError(e.message) } finally { setPostBusy(0) }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const f = field => ({ value: form[field], onChange: e => set(field, e.target.value) })

  // ── Cálculos en vivo ──
  const dias = (() => {
    if (!form.fecha_inicio || !form.fecha_fin) return 0
    const d = Math.floor((new Date(form.fecha_fin) - new Date(form.fecha_inicio)) / 864e5) + 1
    return d > 0 ? d : 0
  })()
  const costoSalones = salonesCat.reduce((t, s) => t + (salSel[s.codigo] ? s.costo_dia * salSel[s.codigo] : 0), 0) * dias
  const aforoTotal = salonesCat.reduce((t, s) => t + (salSel[s.codigo] ? s.capacidad * salSel[s.codigo] : 0), 0)
  const mxn = n => '$' + Number(n || 0).toLocaleString('es-MX')

  const toggleSalon = s => {
    setSalSel(prev => {
      const n = { ...prev }
      if (n[s.codigo]) delete n[s.codigo]; else n[s.codigo] = 1
      return n
    })
  }
  const qtySalon = (s, d, e) => {
    e.stopPropagation()
    const maxSel = Number.isFinite(s.disponibles) ? s.disponibles : s.stock
    setSalSel(prev => {
      let q = (prev[s.codigo] || 0) + d
      if (q < 0) q = 0; if (q > maxSel) q = maxSel
      const n = { ...prev }
      if (q === 0) delete n[s.codigo]; else n[s.codigo] = q
      return n
    })
  }
  const toggleProv = id => setProvSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const onFile = file => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('El archivo debe ser una imagen.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no debe exceder 5 MB.'); return }
    setError('')
    setImgName(file.name)
    const r = new FileReader()
    r.onload = () => set('imagen_url', r.result) // data URL base64
    r.readAsDataURL(file)
  }

  // ── Validación por paso ──
  const validate = s => {
    if (s === 0) {
      if (!form.organizador || !form.nombre || !form.tipo_congreso || !form.fecha_inicio || !form.fecha_fin)
        return 'Completa los campos obligatorios (*).'
      if (dias <= 0) return 'La fecha fin debe ser igual o posterior a la de inicio.'
    }
    if (s === 1) {
      if (!Object.keys(salSel).length) return 'Selecciona al menos un salón.'
      if (form.tipo_congreso !== 'academico' && (form.modulos_stands === '' || +form.modulos_stands < 0))
        return 'Indica el número de módulos/stands.'
    }
    return ''
  }
  const next = () => {
    const err = validate(step)
    if (err) { setError(err); return }
    setError('')
    step < 3 ? setStep(step + 1) : submit()
  }
  const back = () => { setError(''); setStep(Math.max(0, step - 1)) }

  const submit = async () => {
    setLoading(true); setError('')
    const payload = {
      organizador: form.organizador, nombre: form.nombre, tipo_congreso: form.tipo_congreso,
      tematica: form.tematica, descripcion: form.descripcion,
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
      cuota_recuperacion: +form.cuota_recuperacion || 0, cuota_turista: +form.cuota_turista || 0,
      msi: +form.msi || 0, imagen_url: form.imagen_url || null,
      salones: Object.entries(salSel).map(([salon_id, cantidad]) => ({ salon_id, cantidad })),
      modulos_stands: form.tipo_congreso === 'academico' ? null : (+form.modulos_stands || 0),
      incluye_talleres: form.incluye_talleres, incluye_conferencias: form.incluye_conferencias,
      permite_subapartados: form.permite_subapartados, permite_postulacion: form.permite_postulacion,
      proveedores_asociados: provSel,
      pago: { metodo: form.pago_metodo, requiere_factura: form.requiere_factura, rfc: form.rfc, razon_social: form.razon_social },
    }
    try {
      await apiFetch('/congresos', { method: 'POST', body: JSON.stringify(payload) }, token)
      resetForm(); loadCongresos()
      // Recargamos el catálogo de salones para reflejar las unidades recién
      // ocupadas (descontadas) por este congreso.
      loadSalones()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  const resetForm = () => {
    setShowForm(false); setStep(0); setForm(EMPTY); setSalSel({}); setProvSel([]); setImgName('')
  }

  const del = async id => {
    if (!confirm('¿Eliminar este congreso?')) return
    try { await apiFetch(`/congresos/${id}`, { method: 'DELETE' }, token); loadCongresos() } catch (e) { setError(e.message) }
  }

  // ¿Listo para iniciar? (mismo criterio que valida el backend)
  // Comparamos por DÍA (ignorando la hora) en zona horaria local para evitar
  // corrimientos. Antes se exigía que faltaran días (diasFalt > 0), por lo que
  // el mismo día de inicio el congreso ya no se podía iniciar. Ahora basta con
  // que el evento no haya terminado: el coordinador puede iniciarlo en cuanto
  // llega la fecha (e incluso antes), pero no después de que finalizó.
  const readiness = c => {
    const soloDia = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const fin = soloDia(c.fecha_fin)
    return [
      { ok: c.costo_total_salones > 0, label: 'Salón asignado' },
      { ok: c.estado_pago === 'liquidado', label: 'Congreso liquidado' },
      { ok: c.estado !== 'cancelado', label: 'No cancelado' },
      { ok: fin >= hoy, label: 'Dentro de las fechas del evento' },
    ]
  }
  const iniciar = async id => {
    try { await apiFetch(`/congresos/${id}/iniciar`, { method: 'PUT' }, token); loadCongresos() }
    catch (e) { setError(e.message) }
  }
  const liquidar = async c => {
    const dias = Math.floor((new Date(c.fecha_inicio) - new Date()) / 864e5)
    const aviso = dias < 15
      ? '\n\nNota: faltan menos de 15 días, se aplicará una multa del 15% sobre el costo de salones.'
      : ''
    if (!confirm(`¿Marcar como LIQUIDADO el congreso "${c.nombre}"?${aviso}`)) return
    try { await apiFetch(`/congresos/${c.id}/liquidar`, { method: 'PUT' }, token); loadCongresos() }
    catch (e) { setError(e.message) }
  }
  const reembolsar = async c => {
    if (!confirm(`¿Aplicar REEMBOLSO total del congreso "${c.nombre}"?\n\nSe devolverá el 100% de su cuota a los asistentes que ya pagaron y el congreso quedará marcado como reembolsado.`)) return
    try { await apiFetch(`/congresos/${c.id}/reembolsar`, { method: 'PUT' }, token); loadCongresos() }
    catch (e) { setError(e.message) }
  }
  const cancelar = async c => {
    if (!confirm(`¿CANCELAR el congreso "${c.nombre}"?\n\nSi cancelas con 15 días o más de anticipación se reembolsa el 50% de salones; los asistentes reciben el 100% de su cuota.`)) return
    try {
      const r = await apiFetch(`/congresos/${c.id}/cancelar`, { method: 'PUT' }, token)
      if (r?.politica) alert(r.politica)
      loadCongresos()
    } catch (e) { setError(e.message) }
  }
  const descargarFactura = async c => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/facturas/congreso/${c.id}`,
        { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('No se pudo generar la factura')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `factura-congreso-${c.id}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(e.message) }
  }

  const statusClass = { planeacion: 's-planeacion', activo: 's-activo', cerrado: 's-cerrado', cancelado: 's-cancelado', reembolsado: 's-reembolsado', borrador: 's-planeacion' }
  const tipoLabel = v => (TIPOS.find(t => t.v === v) || {}).l || v

  return (
    <div>
      {error && <div className="alert alert-error"><Icon name="alert" size={17} /> {error}</div>}

      {/* Comprobante de la última inscripción del asistente */}
      {ticket && (
        <div className={`bz-band bzb-${ticket.brazalete || 'morado'}`}>
          <span className="bz-ico"><Icon name="ticket" size={26} /></span>
          <div>
            <b>Inscrito a {ticket.congreso}</b>
            <div><small>
              Folio {ticket.folio} · Brazalete {ticket.tipo_asistente}
              {ticket.tipo_asistente === 'turista'
                ? ` · Cuota ${mxn(ticket.monto)} MXN`
                : ' · Entrada incluida (sin costo)'}
              {ticket.empresa ? ` · Empresa: ${ticket.empresa}` : ''}
            </small></div>
          </div>
        </div>
      )}

      <div className="content-hdr">
        <div>
          <div className="content-hdr-title">Eventos registrados</div>
          <div className="content-hdr-sub">{congresos.length} congreso{congresos.length !== 1 ? 's' : ''} en el sistema</div>
        </div>
        {user?.rol === 'coordinador' && (
          <button className={`btn ${showForm ? 'btn-ghost' : 'btn-gold'}`} onClick={() => showForm ? resetForm() : setShowForm(true)}>
            {showForm ? <><Icon name="x" size={16} /> Cancelar</> : <><Icon name="plus" size={16} /> Nuevo congreso</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="form-card cong-wizard">
          {/* STEPPER */}
          <div className="stepper">
            {PASOS.map((p, i) => (
              <div key={i} className={`wstep ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                <span className="wstep-dot">{i < step ? <Icon name="check" size={16} /> : i + 1}</span>
                <span className="wstep-txt"><small>Paso {i + 1}</small><b>{p}</b></span>
              </div>
            ))}
          </div>

          {/* ───── PASO 1 ───── */}
          {step === 0 && (
            <div className="wpage">
              <div className="form-card-title">Información general</div>
              <div className="form-card-sub">Datos base del evento y material promocional</div>
              <div className="field-row">
                <div className="field"><label>Nombre del organizador *</label><input {...f('organizador')} placeholder="Ej. Grupo Caribe Eventos" /></div>
                <div className="field"><label>Nombre del congreso *</label><input {...f('nombre')} placeholder="Ej. Cumbre de Innovación 2026" /></div>
              </div>
              <div className="field-row">
                <div className="field"><label>Tipo de congreso *</label>
                  <select {...f('tipo_congreso')}>
                    <option value="">Selecciona…</option>
                    {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
                <div className="field"><label>Temática</label><input {...f('tematica')} placeholder="Ej. Transformación Digital" /></div>
              </div>
              <div className="field"><label>Descripción</label><textarea {...f('descripcion')} rows={3} /></div>
              <div className="field-row-3">
                <div className="field"><label>Fecha inicio *</label><input type="date" {...f('fecha_inicio')} /></div>
                <div className="field"><label>Fecha fin *</label><input type="date" {...f('fecha_fin')} /></div>
                <div className="field"><label>Cuota cliente (MXN)</label>
                  <div className="input-prefix"><span>$</span><input type="number" min={0} {...f('cuota_recuperacion')} /></div>
                </div>
              </div>
              <div className="field-row">
                <div className="field"><label>Cuota turista (MXN)</label>
                  <div className="input-prefix"><span>$</span><input type="number" min={0} {...f('cuota_turista')} /></div>
                  <div className="hint">Monto que paga un turista para ingresar al congreso</div>
                </div>
                <div className="field"></div>
              </div>
              <div className="field">
                <label>Imagen / logo promocional</label>
                <div className={`dropzone ${drag ? 'drag' : ''}`}
                  onClick={() => document.getElementById('cong-img').click()}
                  onDragOver={e => { e.preventDefault(); setDrag(true) }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]) }}>
                  <span className="dz-icon"><Icon name="image" size={30} /></span>
                  <b>Arrastra una imagen aquí</b>
                  <small>o haz clic para explorar · PNG, JPG hasta 5 MB</small>
                </div>
                <input type="file" id="cong-img" accept="image/*" hidden onChange={e => onFile(e.target.files[0])} />
                {imgName && <div className="dz-preview"><Icon name="paperclip" size={16} /> {imgName}<span className="x" onClick={() => { setImgName(''); set('imagen_url', '') }}><Icon name="x" size={15} /></span></div>}
              </div>
            </div>
          )}

          {/* ───── PASO 2 ───── */}
          {step === 1 && (
            <div className="wpage">
              <div className="form-card-title">Espacios y logística</div>
              <div className="form-card-sub">Selecciona los salones; se valida stock y capacidad en tiempo real</div>
              <div className="salon-grid">
                {salonesCat.map(s => {
                  const sel = !!salSel[s.codigo]
                  const disp = Number.isFinite(s.disponibles) ? s.disponibles : s.stock
                  const ocupadas = Number(s.ocupadas) || 0
                  const agotado = disp <= 0 && !sel   // sin unidades libres y no seleccionado
                  const toggleAny = () => {
                    if (agotado) return               // bloqueado hasta que se desocupe
                    s.unico ? toggleSalon(s) : (sel ? setSalSel(p => { const n = { ...p }; delete n[s.codigo]; return n }) : setSalSel(p => ({ ...p, [s.codigo]: 1 })))
                  }
                  return (
                    <div key={s.codigo} className={`salon ${sel ? 'sel' : ''} ${agotado ? 'full' : ''}`} onClick={toggleAny}
                      title={agotado ? 'Salón ocupado — no disponible hasta que se desocupe' : ''}>
                      <input type="checkbox" className="salon-check" checked={sel} disabled={agotado} readOnly onClick={e => e.stopPropagation()} onChange={toggleAny} />
                      {agotado
                        ? <span className="salon-stock so-full">Ocupado</span>
                        : <span className="salon-stock">{disp} de {s.stock} disp.</span>}
                      <div className="salon-name">{s.nombre}</div>
                      <div className="salon-meta">
                        <span><Icon name="users" size={14} /> {s.capacidad} pers.</span>
                        <span className="salon-cost">{mxn(s.costo_dia)}/día MXN</span>
                      </div>
                      {ocupadas > 0 && (
                        <div className="salon-occ"><Icon name="alert" size={12} /> {ocupadas} {ocupadas !== 1 ? 'unidades ocupadas' : 'unidad ocupada'} en otros congresos</div>
                      )}
                      {!s.unico && sel && (
                        <div className="qty">
                          <button type="button" onClick={e => qtySalon(s, -1, e)}>−</button>
                          <span>{salSel[s.codigo] || 0}</span>
                          <button type="button" onClick={e => qtySalon(s, 1, e)}>+</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {form.tipo_congreso === 'academico' && (
                <div className="cond">
                  <div className="cond-title"><Icon name="box" size={15} /> Insumos incluidos (Académico)</div>
                  <div className="chips">
                    <span className="chip">Sillas</span><span className="chip">Mesas</span>
                    <span className="chip">Pizarrones</span><span className="chip">Proyectores</span>
                  </div>
                </div>
              )}
              {form.tipo_congreso && form.tipo_congreso !== 'academico' && (
                <div className="cond">
                  <div className="cond-title"><Icon name="store" size={15} /> Módulos / Stands</div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Número de módulos/stands *</label>
                    <input type="number" min={0} {...f('modulos_stands')} placeholder="Ej. 24" />
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1.25rem' }}>
                <div className="cond-title" style={{ marginBottom: '.6rem' }}><Icon name="gear" size={15} /> Servicios internos del evento</div>
                {[
                  ['incluye_talleres', 'Incluye Talleres', 'Sesiones prácticas paralelas'],
                  ['incluye_conferencias', 'Incluye Conferencias', 'Ponencias magistrales en agenda'],
                  ['permite_subapartados', 'Permite sub-apartados dentro del salón', 'Divide un salón en secciones independientes'],
                ].map(([k, t, d]) => (
                  <label key={k} className={`check ${form[k] ? 'on' : ''}`}>
                    <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} />
                    <div className="check-txt"><b>{t}</b><small>{d}</small></div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ───── PASO 3 ───── */}
          {step === 2 && (
            <div className="wpage">
              <div className="form-card-title">Proveedores y servicios</div>
              <div className="form-card-sub">Asocia proveedores homologados o abre el evento a postulaciones</div>
              {proveedores.length === 0
                ? <div className="empty" style={{ padding: '2rem' }}><span><Icon name="store" size={28} /></span><p>No hay proveedores homologados aún</p></div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '1rem', marginTop: '.5rem' }}>
                    {proveedores.map(p => {
                      const isSel = provSel.includes(p.id)
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleProv(p.id)}
                          style={{
                            border: isSel ? '2px solid var(--accent)' : '2px solid var(--border)',
                            borderRadius: '12px', padding: '1rem', cursor: 'pointer',
                            background: isSel ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))' : 'var(--surface)',
                            transition: 'all .2s', display: 'flex', flexDirection: 'column', gap: '.5rem',
                            position: 'relative'
                          }}
                        >
                          {isSel && (
                            <span style={{ position: 'absolute', top: 8, right: 8, background: 'var(--accent)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="check" size={12} />
                            </span>
                          )}
                          {p.imagen_url
                            ? <img src={p.imagen_url} alt={p.empresa} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, background: 'var(--bg)' }} />
                            : <div style={{ width: '100%', height: 80, borderRadius: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="store" size={28} /></div>
                          }
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--text)' }}>{p.empresa}</div>
                            <div style={{ fontSize: '.75rem', color: 'var(--accent)', fontWeight: 600 }}>{p.categoria}</div>
                            {p.descripcion && <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.25rem', lineHeight: 1.4 }}>{p.descripcion.slice(0,80)}{p.descripcion.length > 80 ? '…' : ''}</div>}
                            {p.rfc && <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>RFC: {p.rfc}</div>}
                            {p.sitio_web && <a href={p.sitio_web} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '.7rem', color: 'var(--accent)', display: 'block', marginTop: '.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.sitio_web.replace(/^https?:\/\//, '')}</a>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
              <label className={`check ${form.permite_postulacion ? 'on' : ''}`} style={{ marginTop: '1rem' }}>
                <input type="checkbox" checked={form.permite_postulacion} onChange={e => set('permite_postulacion', e.target.checked)} />
                <div className="check-txt"><b>Permitir que proveedores se postulen a este congreso</b>
                  <small>Verán el evento activo y podrán ofrecer sus servicios; tú apruebas cada postulación.</small></div>
              </label>
            </div>
          )}

          {/* ───── PASO 4 ───── */}
          {step === 3 && (
            <div className="wpage">
              <div className="form-card-title">Pago y facturación</div>
              <div className="form-card-sub">Método de pago, datos fiscales y confirmación final</div>
              <label className="field-lbl">Método de pago</label>
              <div className="pay-grid">
                {[['tarjeta', 'card', 'Tarjeta'], ['digital', 'card', 'Plataforma digital'], ['pasarela', 'link', 'Pasarela en línea']].map(([v, ic, l]) => (
                  <div key={v} className={`pay ${form.pago_metodo === v ? 'on' : ''}`} onClick={() => set('pago_metodo', v)}>
                    <i><Icon name={ic} size={22} /></i><b>{l}</b>
                  </div>
                ))}
              </div>

              {form.pago_metodo === 'tarjeta' && (
                <div className="msi-box">
                  <label className="field-lbl">Meses sin intereses</label>
                  <div className="msi-opts">
                    {[0, 3, 6, 9, 12].map(m => (
                      <div key={m} className={`msi-opt ${+form.msi === m ? 'on' : ''}`} onClick={() => set('msi', m)}>
                        {m === 0 ? 'Contado' : `${m} MSI`}
                        {m > 0 && costoSalones > 0 && <small>{mxn(costoSalones * 1.16 / m)}/mes</small>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <label className={`check ${form.requiere_factura ? 'on' : ''}`}>
                <input type="checkbox" checked={form.requiere_factura} onChange={e => set('requiere_factura', e.target.checked)} />
                <div className="check-txt"><b>Requiere factura electrónica (CFDI)</b><small>Obligatorio · se emite comprobante fiscal</small></div>
              </label>
              <div className="field-row">
                <div className="field"><label>RFC</label><input {...f('rfc')} placeholder="XAXX010101000" /></div>
                <div className="field"><label>Razón social</label><input {...f('razon_social')} placeholder="Nombre o empresa" /></div>
              </div>

              <div className="summary">
                <h4>Resumen del congreso</h4>
                <div className="sum-row"><span>Salones</span><b>{Object.keys(salSel).length ? Object.entries(salSel).map(([c, q]) => { const s = salonesCat.find(x => x.codigo === c); return s?.unico ? s.nombre : `${s?.nombre} ×${q}` }).join(', ') : '—'}</b></div>
                <div className="sum-row"><span>Días del evento</span><b>{dias}</b></div>
                <div className="sum-row"><span>Aforo total</span><b>{aforoTotal.toLocaleString('es-MX')} personas</b></div>
                <div className="sum-row"><span>Cuota cliente</span><b>{mxn(form.cuota_recuperacion)} MXN</b></div>
                <div className="sum-row"><span>Cuota turista</span><b>{mxn(form.cuota_turista)} MXN</b></div>
                <div className="sum-total"><span>Costo de salones</span><b>{mxn(costoSalones)} MXN</b></div>
                {+form.msi > 0 && <div className="sum-row" style={{ marginTop: '.5rem' }}><span>{form.msi} meses sin intereses</span><b>{mxn(costoSalones * 1.16 / form.msi)}/mes</b></div>}
              </div>

              <div className="policy">
                <Icon name="alert" size={18} />
                <div>Debe liquidarse <b>15 días antes</b> del evento o se aplica una <b>multa del 15%</b>. Con <b>3 días o menos</b> sin liquidar, se cancela automáticamente sin devolución. Si el organizador cancela con ≥15 días, se reembolsa el <b>50%</b> de salones; los asistentes inscritos reciben el <b>100%</b> de su cuota.</div>
              </div>
            </div>
          )}

          {/* NAV */}
          <div className="form-actions" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-ghost" onClick={back} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}><Icon name="arrowLeft" size={16} /> Anterior</button>
            <button type="button" className={step === 3 ? 'btn btn-gold' : 'btn btn-primary'} onClick={next} disabled={loading}>
              {step === 3 ? (loading ? 'Publicando…' : <>Publicar congreso <Icon name="check" size={16} /></>) : <>Siguiente <Icon name="arrowRight" size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Solicitudes de proveedores por revisar (coordinador) ── */}
      {esCoordinador && pendientes.length > 0 && (
        <div className="form-card" style={{ marginBottom: '1.4rem' }}>
          <div className="form-card-title"><Icon name="store" size={18} /> Solicitudes de proveedores</div>
          <div className="form-card-sub">
            {pendientes.length} proveedor{pendientes.length !== 1 ? 'es' : ''} se postul{pendientes.length !== 1 ? 'aron' : 'ó'} a tus congresos.
            Al aceptar, se le enviará una notificación con el nombre del congreso, lugar, fecha y hora.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
            {pendientes.map(p => (
              <div key={p.id} style={{
                border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)',
                padding: '1rem 1.1rem', display: 'flex', flexWrap: 'wrap', gap: '.9rem', alignItems: 'center',
              }}>
                <div style={{ flex: '1 1 260px' }}>
                  <div style={{ fontWeight: 700 }}>
                    {p.empresa}
                    <span style={{ fontWeight: 400, color: 'var(--text-light)', fontSize: '.85rem', textTransform: 'capitalize' }}> · {p.categoria}</span>
                  </div>
                  <div style={{ fontSize: '.84rem', color: 'var(--text-mid)', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '.7rem' }}>
                    <span><Icon name="briefcase" size={13} /> {p.congreso}</span>
                    <span><Icon name="pin" size={13} /> {p.sede || 'Sede por confirmar'}</span>
                    <span><Icon name="calendar" size={13} /> {new Date(p.fecha_inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginTop: 2 }}>
                    <Icon name="user" size={13} /> {p.contacto} · <Icon name="mail" size={13} /> {p.email}
                  </div>
                  {p.mensaje && <div style={{ fontSize: '.85rem', marginTop: 5, fontStyle: 'italic', color: 'var(--text-mid)' }}>“{p.mensaje}”</div>}
                </div>
                <div style={{ display: 'flex', gap: '.5rem', flexShrink: 0 }}>
                  <button className="btn btn-success btn-sm" disabled={postBusy === p.id} onClick={() => resolverPostulacion(p.id, 'aprobado')}>
                    <Icon name="check" size={15} /> Aceptar
                  </button>
                  <button className="btn btn-danger btn-sm" disabled={postBusy === p.id} onClick={() => resolverPostulacion(p.id, 'rechazado')}>
                    <Icon name="x" size={15} /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {congresos.length === 0
        ? <div className="empty"><span><Icon name="briefcase" size={28} /></span><p>No hay congresos registrados aún</p></div>
        : (
          <div className="cards-grid">
            {congresos.map(c => {
              const checks = readiness(c)
              const listo = checks.every(x => x.ok)
              const esCoord = user?.rol === 'coordinador'
              const insc = Number(c.inscritos) || 0
              const aforo = Number(c.aforo_max) || 0
              const dispCupo = aforo > 0 ? Math.max(0, aforo - insc) : null
              const lleno = aforo > 0 && insc >= aforo
              return (
              <div key={c.id} className="card has-img">
                {c.imagen_url
                  ? <img className="card-img" src={c.imagen_url} alt={c.nombre} />
                  : <div className="card-img-ph"><Icon name="building" size={40} /></div>}
                <div className="card-header">
                  <span className={`card-status ${statusClass[c.estado] || 's-planeacion'}`}>{c.estado}</span>
                  {esCoord && <button className="btn-icon" onClick={() => del(c.id)}><Icon name="x" size={16} /></button>}
                </div>
                <div className="card-body">
                  <div className="card-title">{c.nombre}</div>
                  {c.tipo_congreso && <div className="card-topic"><Icon name="tag" size={14} /> {tipoLabel(c.tipo_congreso)}</div>}
                  {c.tematica && <div className="card-detail"><Icon name="layers" size={15} /> {c.tematica}</div>}
                  {c.sede && <div className="card-detail"><Icon name="pin" size={15} /> {c.sede}</div>}
                  <div className="card-detail">
                    <Icon name="calendar" size={15} />
                    {new Date(c.fecha_inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' — '}
                    {new Date(c.fecha_fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  {aforo > 0 && esCoord && (
                    <div className={`cong-cap ${lleno ? 'is-full' : ''}`}>
                      <div className="cong-cap-head">
                        <span><Icon name="users" size={15} /> Inscritos</span>
                        <b>{insc.toLocaleString('es-MX')} / {aforo.toLocaleString('es-MX')}</b>
                        {lleno
                          ? <span className="cap-tag tag-full">LLENO</span>
                          : <span className="cap-tag tag-ok">{dispCupo.toLocaleString('es-MX')} libre{dispCupo !== 1 ? 's' : ''}</span>}
                      </div>
                      <div className="cap-bar"><div className="cap-fill" style={{ width: `${Math.min(100, (insc / aforo) * 100)}%` }} /></div>
                    </div>
                  )}
                  {esCoord && c.cuota_recuperacion > 0 && <div className="card-detail"><Icon name="ticket" size={15} /> Cuota cliente: {mxn(c.cuota_recuperacion)} MXN</div>}
                  {esCoord && c.cuota_turista > 0 && <div className="card-detail"><Icon name="ticket" size={15} /> Cuota turista: {mxn(c.cuota_turista)} MXN</div>}
                  {esCoord && c.costo_total_salones > 0 && <div className="card-detail"><Icon name="building" size={15} /> Salones: {mxn(c.costo_total_salones)} MXN</div>}
                  {esCoord && c.msi > 0 && <div className="card-detail"><Icon name="card" size={15} /> {c.msi} meses sin intereses</div>}
                  {c.descripcion && <div className="card-desc">{c.descripcion.substring(0, 100)}{c.descripcion.length > 100 ? '…' : ''}</div>}
                </div>

                {/* ── Inscripción del asistente (cliente / turista) ── */}
                {esAsistente && (() => {
                  const inscrito = misInscripciones.find(i => i.congreso_id === c.id && i.estado !== 'cancelada')
                  const bloqueado = ['cancelado', 'reembolsado'].includes(c.estado)
                  return (
                    <div className="cong-inscribir">
                      {esTurista
                        ? <div className="ci-note"><Icon name="ticket" size={14} /> Asistes como <b>turista</b>{c.cuota_turista > 0 ? ` · cuota ${mxn(c.cuota_turista)} MXN` : ''}</div>
                        : <div className="ci-note"><Icon name="briefcase" size={14} /> Vienes de <b>{user?.empresa || 'tu empresa'}</b> · entrada sin costo</div>}
                      {inscrito
                        ? (() => {
                            const pol = politicaCancelacion(inscrito.fecha_inicio)
                            const finalizado = ['cancelado', 'reembolsado', 'cerrado'].includes(c.estado)
                            return (
                              <>
                                <div className="ci-ok"><Icon name="check" size={15} /> Inscrito · Folio {inscrito.folio}</div>
                                {!finalizado && (
                                  <>
                                    <div className="ci-policy">
                                      <Icon name="info" size={13} />
                                      <span>
                                        Política de cancelación: <b>72 h o más</b> 100% · <b>48–72 h</b> 70% · <b>24–48 h</b> 50% · <b>menos de 24 h</b> sin reembolso.
                                        {' '}Si cancelas ahora te corresponde el <b>{pol.pct}%</b>.
                                      </span>
                                    </div>
                                    <button className="btn btn-ghost btn-full btn-sm" disabled={inscBusy === c.id}
                                      onClick={() => cancelarInscripcion(inscrito, c)}>
                                      {inscBusy === c.id ? 'Cancelando…' : <><Icon name="x" size={14} /> Cancelar inscripción</>}
                                    </button>
                                  </>
                                )}
                              </>
                            )
                          })()
                        : bloqueado
                          ? <button className="btn btn-ghost btn-full btn-sm" disabled>Congreso {c.estado}</button>
                          : lleno
                            ? <button className="btn btn-ghost btn-full btn-sm" disabled>Cupo lleno</button>
                            : <button className="btn btn-gold btn-full btn-sm" disabled={inscBusy === c.id}
                                onClick={() => inscribirme(c)}>
                                {inscBusy === c.id ? 'Inscribiendo…' : <><Icon name="ticket" size={15} /> Inscribirme</>}
                              </button>}
                    </div>
                  )
                })()}

                {/* ── Postulación del proveedor ── */}
                {esProveedor && (() => {
                  const post = misPostulaciones.find(p => p.congreso_id === c.id)
                  const finalizado = ['cancelado', 'reembolsado', 'cerrado'].includes(c.estado)
                  return (
                    <div className="cong-inscribir">
                      <div className="ci-note"><Icon name="store" size={14} /> Participa como <b>proveedor</b></div>
                      {post
                        ? post.estado === 'aprobado'
                          ? <div className="ci-ok"><Icon name="check" size={15} /> Postulación aceptada</div>
                          : post.estado === 'rechazado'
                            ? <button className="btn btn-ghost btn-full btn-sm" disabled><Icon name="x" size={14} /> Postulación no aceptada</button>
                            : <button className="btn btn-ghost btn-full btn-sm" disabled><Icon name="clock" size={14} /> Postulación en revisión</button>
                        : finalizado
                          ? <button className="btn btn-ghost btn-full btn-sm" disabled>Congreso {c.estado}</button>
                          : !c.permite_postulacion
                            ? <button className="btn btn-ghost btn-full btn-sm" disabled>No acepta postulaciones</button>
                            : <button className="btn btn-gold btn-full btn-sm" disabled={postBusy === c.id}
                                onClick={() => postularme(c)}>
                                {postBusy === c.id ? 'Enviando…' : <><Icon name="store" size={15} /> Postularme</>}
                              </button>}
                    </div>
                  )
                })()}

                {esCoord && ['planeacion', 'borrador'].includes(c.estado) && (
                  <div className="ready">
                    <div className="ready-head">
                      <span className="ready-title">¿Listo para iniciar?</span>
                      <span className={`ready-badge ${listo ? 'rb-ok' : 'rb-no'}`}>{listo ? <><Icon name="check" size={13} /> Listo</> : 'Faltan requisitos'}</span>
                    </div>
                    <ul className="ready-checks">
                      {checks.map((ck, i) => <li key={i} className={ck.ok ? 'ok' : ''}><span className="ck"><Icon name={ck.ok ? 'check' : 'x'} size={12} /></span>{ck.label}</li>)}
                    </ul>
                    <button className="btn btn-gold btn-full" style={{ marginTop: '.6rem' }} disabled={!listo} onClick={() => iniciar(c.id)}><Icon name="rocket" size={16} /> Iniciar congreso</button>
                  </div>
                )}

                <div className="card-footer">
                  <span className="card-coord">Coord: <strong>{c.coordinador_nombre}</strong></span>
                  {esCoord && <span className={`pay-badge pb-${c.estado_pago}`}>{c.estado_pago}</span>}
                </div>

                {esCoord && (
                  <div className="cong-gestion">
                    <span className="cong-gestion-title">Gestión del coordinador</span>
                    {(c.estado === 'cancelado' || c.estado === 'reembolsado') ? (
                      <div className={`cong-final ${c.estado === 'reembolsado' ? 'cf-reemb' : 'cf-canc'}`}>
                        <Icon name={c.estado === 'reembolsado' ? 'card' : 'x'} size={16} />
                        {c.estado === 'reembolsado' ? 'Reembolso aplicado · 100% a asistentes' : 'Congreso cancelado'}
                      </div>
                    ) : (
                      <div className="cong-gestion-btns">
                        {c.estado_pago === 'liquidado'
                          ? <span className="cong-liq-ok"><Icon name="check" size={15} /> Liquidado</span>
                          : <button className="btn btn-success btn-sm" onClick={() => liquidar(c)}><Icon name="check" size={15} /> Liquidar</button>}
                        <button className="btn btn-ghost btn-sm" onClick={() => reembolsar(c)}><Icon name="card" size={15} /> Reembolso</button>
                        <button className="btn btn-danger btn-sm" onClick={() => cancelar(c)}><Icon name="x" size={15} /> Cancelar</button>
                      </div>
                    )}
                  </div>
                )}

                {esCoord && c.costo_total_salones > 0 && (
                  <button className="btn btn-pdf btn-full btn-sm" style={{ margin: '0 1.1rem 1.1rem' }} onClick={() => descargarFactura(c)}><Icon name="file" size={15} /> Descargar factura (PDF)</button>
                )}
              </div>
            )})}
          </div>
        )
      }
    </div>
  )
}