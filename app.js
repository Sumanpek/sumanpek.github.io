/**
 * ==========================================================================
 *  APPS ANABEL · Frontend · Sumanpek, C.A.  (v1.0.1 — Fase 1 — 6 de noviembre 11:02 pm)
 * ==========================================================================
 */
'use strict';

/* ======================= 1. CONFIGURACIÓN (EDITAR) ======================= */
const CONFIG = {
  // URL de la Aplicación web de Apps Script (termina en /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycbwFH9lbNFbZ1c1sh5ZKhybVct3upDndjOZJLuIQmaMDSAk0MZuy1z58VVJJlTMnt7hD6A/exec',
  // ID de cliente OAuth de Google Cloud (termina en .apps.googleusercontent.com)
  GOOGLE_CLIENT_ID: '110601279842-om0i0kqev5ut2q8quu71v8j82cf1b3hs.apps.googleusercontent.com'
};

/* ============================== 2. ESTADO ============================== */
const S = {
  token: null,
  sesion: null,
  empleados: [],
  permisos: [],
  evaluaciones: [],
  periodos: {},       // caché de datos por filtro (dash, asis)
  charts: {},
  tablas: {},
  orden: {},
  seccion: 'dashboard',
  exp: null,          // expediente abierto
  expTab: 'datos',
  modalVolver: null,
  reloj: null,
  cargas: 0
};

const COLORES = {
  aTiempo: '#0d9488', tarde: '#f59e0b', ausente: '#e11d48', justificado: '#94a3b8',
  serie: ['#0f766e', '#2563eb', '#f59e0b', '#e11d48', '#7c3aed', '#0891b2', '#65a30d', '#db2777', '#475569', '#ea580c']
};

const SECCIONES = [
  { id: 'dashboard', titulo: 'Dashboard', icono: 'layout-dashboard' },
  { id: 'empleados', titulo: 'Empleados', icono: 'users' },
  { id: 'asistencia', titulo: 'Asistencia', icono: 'clock' },
  { id: 'permisos', titulo: 'Permisos y vacaciones', icono: 'calendar-days' },
  { id: 'evaluaciones', titulo: 'Desempeño', icono: 'award' },
  { id: 'mi-marcaje', titulo: 'Mi marcaje', icono: 'fingerprint' }
];

const TIPOS_DOCUMENTO = ['Currículum', 'Cédula de identidad', 'RIF', 'Test psicotécnico', 'Contrato de trabajo',
  'Amonestación', 'Constancia de trabajo', 'Certificado médico / Reposo', 'Título o certificación',
  'Referencias', 'Evaluación firmada', 'Carta de renuncia / despido', 'Otro'];

const CRITERIOS = [
  { k: 'Metas', t: 'Cumplimiento de metas' },
  { k: 'Productividad', t: 'Productividad' },
  { k: 'Calidad', t: 'Calidad del trabajo' },
  { k: 'TrabajoEquipo', t: 'Trabajo en equipo' },
  { k: 'Puntualidad', t: 'Puntualidad' }
];

/* ============================ 3. UTILIDADES ============================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = Number(String(v ?? '').replace(',', '.').trim()); return isFinite(n) ? n : 0; };
const pad = n => String(n).padStart(2, '0');
const fechaStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoyStr = () => fechaStr(new Date());
const aFecha = s => new Date(String(s).slice(0, 10) + 'T12:00:00');
const sumarDias = (s, n) => { const d = aFecha(s); d.setDate(d.getDate() + n); return fechaStr(d); };
const diaSemana = s => { const d = aFecha(s).getDay(); return d === 0 ? 7 : d; };
const rangoFechas = (a, b) => { const out = []; let d = a, g = 0; while (d <= b && g++ < 800) { out.push(d); d = sumarDias(d, 1); } return out; };
const fmtFecha = s => s ? aFecha(s).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtFechaCorta = s => s ? aFecha(s).toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short' }) : '—';
const fmtHora = s => s ? String(s).slice(0, 5) : '—';
const fmtMin = m => { m = Math.round(num(m)); if (!m) return '0 min'; const h = Math.floor(m / 60), r = m % 60; return h ? `${h} h ${pad(r)} min` : `${r} min`; };
const fmtHoras = m => (num(m) / 60).toLocaleString('es-VE', { maximumFractionDigits: 1 }) + ' h';
const fmtPct = v => (v === null || v === undefined || !isFinite(v)) ? '—' : Math.round(v) + '%';
const fmtNum = v => num(v).toLocaleString('es-VE', { maximumFractionDigits: 1 });
const fmtDinero = v => num(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + (S.sesion?.moneda || '');
const fmtTamano = b => { b = num(b); return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; };
const minutos = h => { if (!h) return 0; const [a, b, c] = String(h).split(':').map(Number); return (a || 0) * 60 + (b || 0) + (c || 0) / 60; };
const nombreCompleto = e => e ? `${e.Nombres || ''} ${e.Apellidos || ''}`.trim() : '—';
const iniciales = t => String(t || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || '?';
const normalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const coincide = (e, q) => !q || normalizar([nombreCompleto(e), e.Cedula, e.Cargo, e.Email, e.ID, e.Departamento].join(' ')).includes(normalizar(q));
const empPorId = id => S.empleados.find(e => e.ID === id);
const esRRHH = () => S.sesion?.rol === 'RRHH';
const esGestion = () => ['RRHH', 'DIRECCION'].includes(S.sesion?.rol);
const ordenarNombre = (a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es');
const iconos = () => { if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 2 } }); };

function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function decodificarJWT(t) {
  try {
    const b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b + '='.repeat((4 - b.length % 4) % 4)), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) { return null; }
}
const tokenVigente = t => { const p = decodificarJWT(t); return !!(p && p.exp * 1000 - Date.now() > 120000); };

/* ========================= 4. INTERFAZ BÁSICA ========================= */
function toast(msg, tipo = 'info', ms = 4500) {
  const estilos = {
    ok: ['bg-emerald-600', 'circle-check'], error: ['bg-rose-600', 'circle-x'],
    aviso: ['bg-amber-500', 'triangle-alert'], info: ['bg-slate-800', 'info']
  }[tipo] || ['bg-slate-800', 'info'];
  const el = document.createElement('div');
  el.className = `pointer-events-auto ${estilos[0]} text-white rounded-xl shadow-lg px-4 py-3 text-sm flex items-start gap-3 transition-all duration-300`;
  el.innerHTML = `<i data-lucide="${estilos[1]}" class="w-5 h-5 shrink-0 mt-0.5"></i><span class="flex-1">${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  iconos();
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-6px)'; setTimeout(() => el.remove(), 300); }, ms);
}

function cargando(activo, texto = 'Cargando…') {
  S.cargas = Math.max(0, S.cargas + (activo ? 1 : -1));
  $('#cargando-texto').textContent = texto;
  $('#cargando').classList.toggle('hidden', S.cargas === 0);
}

function mostrarVista(id) {
  $$('.vista').forEach(v => v.classList.toggle('hidden', v.id !== id));
  window.scrollTo(0, 0);
}

function abrirModal({ titulo, cuerpo, pie = '', ancho = 'sm:max-w-2xl', volver = null }) {
  const caja = $('#modal-caja');
  caja.className = `bg-white w-full sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[94vh] ${ancho}`;
  $('#modal-titulo').textContent = titulo;
  $('#modal-cuerpo').innerHTML = cuerpo;
  $('#modal-pie').innerHTML = pie;
  $('#modal-pie').classList.toggle('hidden', !pie);
  $('#modal-cuerpo').scrollTop = 0;
  S.modalVolver = volver;
  $('#modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  iconos();
}

function cerrarModal() {
  $('#modal').classList.add('hidden');
  document.body.style.overflow = '';
  S.modalVolver = null;
  S.exp = null;
}

function cancelarModal() {
  const volver = S.modalVolver;
  if (volver) { S.modalVolver = null; volver(); } else cerrarModal();
}

function confirmar(mensaje, { titulo = 'Confirmar', boton = 'Eliminar', peligro = true } = {}) {
  return new Promise(resolve => {
    const capa = document.createElement('div');
    capa.className = 'confirmacion fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/50';
    capa.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h4 class="font-bold text-lg mb-2">${esc(titulo)}</h4>
        <p class="text-sm text-slate-600 mb-6">${esc(mensaje)}</p>
        <div class="flex justify-end gap-2">
          <button class="btn-sec" data-r="0">Cancelar</button>
          <button class="${peligro ? 'btn-peligro' : 'btn-primario'}" data-r="1">${esc(boton)}</button>
        </div></div>`;
    capa.addEventListener('click', ev => {
      const b = ev.target.closest('[data-r]');
      if (!b) return;
      ev.stopPropagation();
      capa.remove();
      resolve(b.dataset.r === '1');
    });
    document.body.appendChild(capa);
  });
}

function opciones(lista, seleccionado = '', vacio = null) {
  return (vacio !== null ? `<option value="">${esc(vacio)}</option>` : '') +
    lista.map(o => {
      const v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o;
      return `<option value="${esc(v)}" ${String(v) === String(seleccionado) ? 'selected' : ''}>${esc(t)}</option>`;
    }).join('');
}

function insigniaEstado(estado) {
  const c = {
    Activo: 'bg-emerald-100 text-emerald-700', Inactivo: 'bg-slate-200 text-slate-600', Reposo: 'bg-rose-100 text-rose-700',
    Permiso: 'bg-amber-100 text-amber-700', Vacaciones: 'bg-sky-100 text-sky-700',
    Aprobado: 'bg-emerald-100 text-emerald-700', Pendiente: 'bg-amber-100 text-amber-700', Rechazado: 'bg-rose-100 text-rose-700'
  }[estado] || 'bg-slate-100 text-slate-600';
  return `<span class="insignia ${c}">${esc(estado || '—')}</span>`;
}

function colorPuntaje(v) {
  if (v === null || v === undefined || !isFinite(v)) return 'text-slate-400';
  return v >= 85 ? 'text-emerald-600' : v >= 70 ? 'text-marca-700' : v >= 55 ? 'text-amber-600' : 'text-rose-600';
}

function datosFormulario(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
  return o;
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* ========================= 5. COMUNICACIÓN API ========================= */
async function api(action, payload = {}, { silencioso = false, texto = 'Cargando…' } = {}) {
  if (!silencioso) cargando(true, texto);
  try {
    let r;
    try {
      r = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token: S.token, payload }),
        redirect: 'follow'
      });
    } catch (e) {
      throw new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
    }
    if (!r.ok) throw new Error(`Error del servidor (${r.status}). Inténtalo de nuevo.`);
    let j;
    try { j = await r.json(); } catch (e) {
      throw new Error('Respuesta inválida del servidor. Verifica la URL de la API y que la implementación tenga acceso "Cualquier persona".');
    }
    if (!j.ok) {
      if (j.error === 'SESION_EXPIRADA') { cerrarSesion('Tu sesión expiró. Vuelve a iniciar sesión.'); throw new Error('Sesión expirada.'); }
      if (j.error === 'NO_REGISTRADO') {
        const correo = decodificarJWT(S.token || '')?.email || 'tu correo';
        cerrarSesion(`El correo ${correo} no está registrado o está inactivo. Contacta a Recursos Humanos.`);
        throw new Error('Correo no registrado.');
      }
      throw new Error(j.error || 'Error desconocido.');
    }
    return j.data;
  } finally {
    if (!silencioso) cargando(false);
  }
}

/* ======================= 6. INICIO DE SESIÓN GOOGLE ======================= */
function configValida() {
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(CONFIG.API_URL) &&
    /\.apps\.googleusercontent\.com$/.test(CONFIG.GOOGLE_CLIENT_ID) && !CONFIG.GOOGLE_CLIENT_ID.startsWith('PEGA_AQUI');
}

let googleListo = false;
function iniciarGoogle(intentos = 0) {
  if (!window.google?.accounts?.id) {
    if (intentos > 100) { mensajeLogin('No se pudo cargar el inicio de sesión de Google. Revisa tu conexión y recarga la página.'); return; }
    return setTimeout(() => iniciarGoogle(intentos + 1), 150);
  }
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: r => alRecibirCredencial(r.credential),
    auto_select: true,
    cancel_on_tap_outside: false,
    itp_support: true,
    use_fedcm_for_prompt: true
  });
  google.accounts.id.renderButton($('#btn-google'), {
    theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'es', width: 280
  });
  googleListo = true;
  if (!$('#v-login').classList.contains('hidden')) google.accounts.id.prompt();
}

function mensajeLogin(msg) {
  const el = $('#login-msg');
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

function mostrarLogin(msg = '') {
  detenerReloj();
  mostrarVista('v-login');
  mensajeLogin(msg);
  if (googleListo && !msg) google.accounts.id.prompt();
}

async function alRecibirCredencial(token) {
  S.token = token;
  try { sessionStorage.setItem('aa_token', token); } catch (e) { /* modo privado */ }
  await cargarSesion();
}

async function cargarSesion() {
  try {
    S.sesion = await api('sesion', {}, { texto: 'Iniciando sesión…' });
    if (esGestion()) mostrarAdmin(); else mostrarMarcaje();
  } catch (e) {
    if (!S.token) return; // ya se mostró el mensaje en cerrarSesion
    S.token = null;
    try { sessionStorage.removeItem('aa_token'); } catch (x) { /* nada */ }
    mostrarLogin(e.message);
  }
}

function cerrarSesion(msg = '') {
  S.token = null; S.sesion = null; S.periodos = {}; S.catalogoListo = false; S.empleados = []; S.permisos = []; S.evaluaciones = [];
  try { sessionStorage.removeItem('aa_token'); } catch (e) { /* nada */ }
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
  Object.values(S.charts).forEach(c => c.destroy()); S.charts = {};
  cerrarModal();
  document.body.classList.remove('rol-direccion', 'rol-rrhh');
  mostrarLogin(msg);
}

/* ======================= 7. MARCAJE DE ASISTENCIA ======================= */
function mostrarMarcaje() {
  const s = S.sesion;
  mostrarVista('v-marcaje');
  $('#mc-nombre').textContent = s.nombre;
  $('#mc-cargo').textContent = [s.cargo, s.departamento].filter(Boolean).join(' · ') || s.email;
  $('#mc-avatar').textContent = iniciales(s.nombre);
  $('#mc-volver').classList.toggle('hidden', !esGestion());
  $('#mc-horario').textContent = `${s.horario.entrada} – ${s.horario.salida} · sáb. hasta ${s.horario.salidaSabado}`;
  pintarEstadoMarcaje();
  iniciarReloj();
  cargarHistorial();
  if (s.empleadoId) verificarUbicacion(true);
  iconos();
}

function iniciarReloj() {
  detenerReloj();
  const pinta = () => {
    const d = new Date();
    $('#mc-reloj').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    $('#mc-fecha').textContent = d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  pinta();
  S.reloj = setInterval(pinta, 1000);
}
function detenerReloj() { if (S.reloj) clearInterval(S.reloj); S.reloj = null; }

function pintarEstadoMarcaje(bloqueado = false) {
  const s = S.sesion, r = s.marcajeHoy, el = $('#mc-estado');
  const bE = $('#btn-entrada'), bS = $('#btn-salida');
  let html, clase, puedeE = false, puedeS = false;
  if (!s.empleadoId) {
    clase = 'bg-amber-50 text-amber-800 border border-amber-200';
    html = 'Tu correo no tiene expediente de empleado. Regístrate en "Empleados" con este mismo correo para poder marcar.';
  } else if (!r || !r.Entrada) {
    clase = 'bg-slate-50 text-slate-600 border border-slate-200';
    html = 'Aún no has registrado tu entrada de hoy.';
    puedeE = true;
  } else if (!r.Salida) {
    const tarde = num(r.MinRetraso) > 0;
    clase = tarde ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    html = `Entrada registrada a las <b>${fmtHora(r.Entrada)}</b>${tarde ? ` · ${fmtMin(r.MinRetraso)} de retraso` : ' · a tiempo'}`;
    puedeS = true;
  } else {
    clase = 'bg-marca-50 text-marca-800 border border-marca-200';
    html = `Jornada completa: <b>${fmtHora(r.Entrada)}</b> → <b>${fmtHora(r.Salida)}</b> · ${fmtMin(r.MinTrabajados)}` +
      (num(r.MinExtra) > 0 ? ` · ${fmtMin(r.MinExtra)} extra` : '');
  }
  el.className = 'mt-5 rounded-xl px-4 py-3 text-sm font-medium ' + clase;
  el.innerHTML = html;
  bE.disabled = bloqueado || !puedeE;
  bS.disabled = bloqueado || !puedeS;
}

function obtenerPosicion(precisionObjetivo, maxMs = 15000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Este navegador no permite obtener la ubicación.'));
    let mejor = null, fin = false, id = null, t = null;
    const terminar = err => {
      if (fin) return;
      fin = true;
      if (id !== null) navigator.geolocation.clearWatch(id);
      clearTimeout(t);
      if (mejor) resolve(mejor);
      else reject(err || new Error('No se pudo obtener tu ubicación. Activa el GPS e inténtalo de nuevo.'));
    };
    t = setTimeout(() => terminar(), maxMs);
    const mensajes = {
      1: 'Debes permitir el acceso a tu ubicación. Revisa los permisos del navegador para este sitio.',
      2: 'Ubicación no disponible. Activa el GPS (ubicación precisa) de tu teléfono.',
      3: 'Se agotó el tiempo buscando tu ubicación. Inténtalo de nuevo.'
    };
    id = navigator.geolocation.watchPosition(
      p => { if (!mejor || p.coords.accuracy < mejor.coords.accuracy) mejor = p; if (p.coords.accuracy <= precisionObjetivo) terminar(); },
      e => { if (e.code === 1 || !mejor) terminar(new Error(mensajes[e.code] || e.message)); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxMs }
    );
  });
}

function pintarGeo(texto, tipo = 'info') {
  const c = { ok: 'text-emerald-700', error: 'text-rose-600', aviso: 'text-amber-600', info: 'text-slate-500' }[tipo];
  $('#mc-geo').className = `mt-5 flex items-center justify-center gap-2 text-xs font-medium ${c}`;
  $('#mc-geo-texto').textContent = texto;
}

async function verificarUbicacion(silencioso = false) {
  const g = S.sesion.geocerca;
  pintarGeo('Buscando señal GPS…');
  try {
    const p = await obtenerPosicion(g.precisionMax, 10000);
    const d = Math.round(distanciaMetros(p.coords.latitude, p.coords.longitude, g.lat, g.lng));
    const prec = Math.round(p.coords.accuracy);
    if (d <= g.radio) pintarGeo(`Estás dentro del área permitida · ${d} m (±${prec} m)`, prec > g.precisionMax ? 'aviso' : 'ok');
    else pintarGeo(`Fuera del área: estás a ${d} m (máx. ${g.radio} m)`, 'error');
    return p;
  } catch (e) {
    pintarGeo(e.message, 'error');
    if (!silencioso) toast(e.message, 'error', 6000);
    return null;
  }
}

async function marcar(tipo) {
  const g = S.sesion.geocerca;
  pintarEstadoMarcaje(true);
  pintarGeo('Obteniendo tu ubicación GPS…');
  try {
    const p = await obtenerPosicion(g.precisionMax, 15000);
    const { latitude: lat, longitude: lng, accuracy } = p.coords;
    const d = Math.round(distanciaMetros(lat, lng, g.lat, g.lng));
    if (accuracy > g.precisionMax) throw new Error(`Señal GPS imprecisa (±${Math.round(accuracy)} m). Activa la ubicación precisa y vuelve a intentar.`);
    if (d > g.radio) throw new Error(`Estás a ${d} m de la empresa. Debes estar a menos de ${g.radio} m para marcar.`);
    pintarGeo(`Ubicación verificada · ${d} m`, 'ok');
    const r = await api('marcar', { tipo, lat, lng, precision: accuracy }, { texto: tipo === 'ENTRADA' ? 'Registrando entrada…' : 'Registrando salida…' });
    S.sesion.marcajeHoy = r.registro;
    const extra = tipo === 'ENTRADA'
      ? (num(r.minRetraso) > 0 ? ` (${fmtMin(r.minRetraso)} de retraso)` : ' ¡A tiempo!')
      : (num(r.minExtra) > 0 ? ` (${fmtMin(r.minExtra)} extra)` : '');
    toast(`${tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada a las ${fmtHora(r.hora)}${extra}`, 'ok', 6000);
    if (navigator.vibrate) navigator.vibrate(150);
    cargarHistorial();
  } catch (e) {
    pintarGeo(e.message, 'error');
    toast(e.message, 'error', 7000);
  } finally {
    if (S.sesion) pintarEstadoMarcaje(false);
  }
}

async function cargarHistorial() {
  const cont = $('#mc-historial');
  if (!S.sesion.empleadoId) { cont.innerHTML = '<p class="px-5 py-6 text-sm text-slate-400 text-center">Sin registros.</p>'; return; }
  cont.innerHTML = '<p class="px-5 py-6 text-sm text-slate-400 text-center pulso">Cargando…</p>';
  try {
    const lista = await api('miHistorial', {}, { silencioso: true });
    if (!lista.length) { cont.innerHTML = '<p class="px-5 py-6 text-sm text-slate-400 text-center">Aún no tienes marcajes.</p>'; return; }
    cont.innerHTML = lista.map(a => `
      <div class="px-5 py-3 flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold cap1">${esc(fmtFechaCorta(a.Fecha))}</p>
          <p class="text-xs text-slate-500">${fmtHora(a.Entrada)} → ${fmtHora(a.Salida)}${a.MinTrabajados ? ' · ' + fmtMin(a.MinTrabajados) : ''}${a.Origen === 'MANUAL' ? ' · manual' : ''}</p>
        </div>
        ${num(a.MinRetraso) > 0 ? `<span class="insignia bg-amber-100 text-amber-700">+${Math.round(num(a.MinRetraso))} min</span>` : '<span class="insignia bg-emerald-100 text-emerald-700">A tiempo</span>'}
      </div>`).join('');
  } catch (e) {
    cont.innerHTML = `<p class="px-5 py-6 text-sm text-rose-600 text-center">${esc(e.message)}</p>`;
  }
}

/* ======================= 8. PANEL DE GESTIÓN ======================= */
function mostrarAdmin() {
  const s = S.sesion;
  detenerReloj();
  mostrarVista('v-admin');
  document.body.classList.toggle('rol-direccion', s.rol === 'DIRECCION');
  document.body.classList.toggle('rol-rrhh', s.rol === 'RRHH');
  const rolTxt = s.rol === 'RRHH' ? 'Recursos Humanos' : 'Dirección';
  $('#ad-nombre').textContent = s.nombre;
  $('#ad-rol').textContent = rolTxt;
  $('#ad-rol-movil').textContent = rolTxt;
  $('#ad-avatar').textContent = iniciales(s.nombre);

  const deptos = opciones(s.departamentos || [], '', 'Todos los departamentos');
  ['#emp-depto', '#per-depto', '#ev-depto', '#dash-depto', '#asis-depto'].forEach(id => { const el = $(id); if (el) el.innerHTML = deptos; });
  $('#emp-estado').innerHTML = opciones(s.catalogos.estados, '', 'Todos los estados');
  $('#per-tipo').innerHTML = opciones(s.catalogos.tiposPermiso, '', 'Todos los tipos');
  $('#per-estado').innerHTML = opciones(s.catalogos.estadosPermiso, '', 'Todos los estados');
  navegar(S.seccion === 'mi-marcaje' ? 'dashboard' : S.seccion);
}

function construirNavegacion() {
  $('#nav-lateral').innerHTML = SECCIONES.map(s =>
    `<button data-acc="nav" data-sec="${s.id}" class="nav-item"><i data-lucide="${s.icono}" class="w-5 h-5"></i>${s.titulo}</button>`).join('');
  $('#nav-movil-items').innerHTML = SECCIONES.map(s =>
    `<button data-acc="nav" data-sec="${s.id}" class="nav-movil"><i data-lucide="${s.icono}" class="w-4 h-4"></i>${s.titulo}</button>`).join('');
}

function navegar(sec) {
  if (sec === 'mi-marcaje') { S.seccion = 'mi-marcaje'; mostrarMarcaje(); return; }
  if (!$('#s-' + sec)) sec = 'dashboard';
  S.seccion = sec;
  if ($('#v-admin').classList.contains('hidden')) { mostrarVista('v-admin'); detenerReloj(); }
  $$('.seccion').forEach(x => x.classList.toggle('hidden', x.id !== 's-' + sec));
  $$('[data-acc="nav"]').forEach(b => b.classList.toggle('activo', b.dataset.sec === sec));
  ({ dashboard: cargarDashboard, empleados: cargarEmpleados, asistencia: cargarAsistencia,
     permisos: cargarPermisos, evaluaciones: cargarEvaluaciones })[sec]();
  iconos();
}

/* ---------- Filtros de fecha reutilizables ---------- */
function filtroHTML(p) {
  return `<div class="tarjeta p-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
    <div><label class="etiqueta">Período</label>
      <select id="${p}-preset" class="campo">
        <option value="hoy">Hoy</option><option value="ayer">Ayer</option>
        <option value="semana">Esta semana (lun–sáb)</option><option value="semana_ant">Semana anterior</option>
        <option value="mes">Este mes</option><option value="mes_ant">Mes anterior</option>
        <option value="anio">Este año</option><option value="custom">Personalizado</option>
      </select></div>
    <div><label class="etiqueta">Desde</label><input id="${p}-desde" type="date" class="campo"></div>
    <div><label class="etiqueta">Hasta</label><input id="${p}-hasta" type="date" class="campo"></div>
    <div><label class="etiqueta">Departamento</label><select id="${p}-depto" class="campo"></select></div>
    <div><label class="etiqueta">Empleado</label>
      <div class="relative"><i data-lucide="search" class="w-4 h-4 absolute left-3 top-3 text-slate-400"></i>
      <input id="${p}-buscar" class="campo pl-9" placeholder="Nombre o cédula…"></div></div>
    <div><button id="${p}-aplicar" class="btn-primario w-full"><i data-lucide="refresh-cw" class="w-4 h-4"></i>Actualizar</button></div>
  </div>`;
}

function rangoPreset(p) {
  const h = hoyStr(), lunes = sumarDias(h, -(diaSemana(h) - 1)), d = aFecha(h);
  switch (p) {
    case 'hoy': return [h, h];
    case 'ayer': { const a = sumarDias(h, -1); return [a, a]; }
    case 'semana': return [lunes, sumarDias(lunes, 5)];
    case 'semana_ant': { const l = sumarDias(lunes, -7); return [l, sumarDias(l, 5)]; }
    case 'mes': return [fechaStr(new Date(d.getFullYear(), d.getMonth(), 1)), fechaStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
    case 'mes_ant': return [fechaStr(new Date(d.getFullYear(), d.getMonth() - 1, 1)), fechaStr(new Date(d.getFullYear(), d.getMonth(), 0))];
    case 'anio': return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
    default: return null;
  }
}

function prepararFiltro(p, presetInicial, alCambiar) {
  $(`#${p}-filtros`).innerHTML = filtroHTML(p);
  const pre = $(`#${p}-preset`), de = $(`#${p}-desde`), ha = $(`#${p}-hasta`);
  const aplicar = () => { const r = rangoPreset(pre.value); if (r) { de.value = r[0]; ha.value = r[1]; } };
  pre.value = presetInicial; aplicar();
  pre.addEventListener('change', () => { aplicar(); if (pre.value !== 'custom') alCambiar(true); });
  [de, ha].forEach(i => i.addEventListener('change', () => { pre.value = 'custom'; }));
  $(`#${p}-aplicar`).addEventListener('click', () => alCambiar(true));
  $(`#${p}-depto`).addEventListener('change', () => alCambiar(false));
  let t; $(`#${p}-buscar`).addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => alCambiar(false), 250); });
}

function leerFiltro(p) {
  let desde = $(`#${p}-desde`).value, hasta = $(`#${p}-hasta`).value;
  if (!desde || !hasta) { [desde, hasta] = rangoPreset('hoy'); }
  if (hasta < desde) [desde, hasta] = [hasta, desde];
  return { desde, hasta, depto: $(`#${p}-depto`).value, q: $(`#${p}-buscar`).value.trim(), preset: $(`#${p}-preset`).value };
}

function textoPeriodo(f) {
  return f.desde === f.hasta ? fmtFecha(f.desde) : `${fmtFecha(f.desde)} — ${fmtFecha(f.hasta)}`;
}

async function datosPeriodo(p, forzar) {
  const f = leerFiltro(p);
  const c = S.periodos[p];
  if (forzar || !c || c.desde !== f.desde || c.hasta !== f.hasta) {
    const d = await api('datosPeriodo', { desde: f.desde, hasta: f.hasta }, { texto: 'Consultando datos…' });
    S.empleados = d.empleados; S.permisos = d.permisos; S.evaluaciones = d.evaluaciones;
    S.catalogoListo = true;
    S.periodos[p] = { desde: f.desde, hasta: f.hasta, asistencia: d.asistencia };
  }
  return { f, asistencia: S.periodos[p].asistencia };
}

async function asegurarCatalogo(forzar = false) {
  if (!forzar && S.catalogoListo) return;
  const h = hoyStr();
  const d = await api('datosPeriodo', { desde: h, hasta: h }, { texto: 'Cargando…' });
  S.empleados = d.empleados; S.permisos = d.permisos; S.evaluaciones = d.evaluaciones;
  S.catalogoListo = true;
}

function invalidarCache() { S.periodos = {}; }

/* ======================= 9. MOTOR DE KPIs ======================= */
function empleadosDelPeriodo(desde, hasta, depto, q) {
  return S.empleados
    .filter(e => (!e.FechaIngreso || e.FechaIngreso <= hasta) && (e.Estado !== 'Inactivo' || (e.FechaEgreso && e.FechaEgreso >= desde)))
    .filter(e => !depto || e.Departamento === depto)
    .filter(e => coincide(e, q))
    .sort(ordenarNombre);
}

function resumir(filas) {
  const t = { n: filas.length, esperados: 0, asistidos: 0, asistidosLab: 0, aTiempo: 0, tardes: 0, justificados: 0, ausencias: 0,
    pendientes: 0, sinSalida: 0, minRetraso: 0, minTrabajados: 0, minExtra: 0, conExtra: 0, evalSuma: 0, evalN: 0 };
  filas.forEach(r => {
    ['esperados', 'asistidos', 'asistidosLab', 'aTiempo', 'tardes', 'justificados', 'ausencias', 'pendientes', 'sinSalida', 'minRetraso', 'minTrabajados', 'minExtra']
      .forEach(k => { t[k] += r[k]; });
    if (r.minExtra > 0) t.conExtra++;
    if (r.evalProm !== null) { t.evalSuma += r.evalProm; t.evalN++; }
  });
  const base = t.esperados - t.justificados;
  t.pctAsistencia = base > 0 ? t.asistidosLab / base * 100 : null;
  t.pctPuntualidad = t.asistidos > 0 ? t.aTiempo / t.asistidos * 100 : null;
  t.evalProm = t.evalN ? t.evalSuma / t.evalN : null;
  return t;
}

function calcularKPIs(empleados, asistencia, permisos, evaluaciones, desde, hasta) {
  const lab = S.sesion.diasLaborables || [1, 2, 3, 4, 5, 6];
  const hoy = hoyStr();
  const ahora = new Date();
  const finHoy = minutos(diaSemana(hoy) === 6 ? S.sesion.horario.salidaSabado : S.sesion.horario.salida);
  const hoyCerrado = ahora.getHours() * 60 + ahora.getMinutes() >= finHoy;
  const fechas = rangoFechas(desde, hasta);
  const idx = new Map();
  asistencia.forEach(a => idx.set(a.EmpleadoID + '|' + a.Fecha, a));
  const aprobados = permisos.filter(p => p.Estado === 'Aprobado');
  const diario = {};
  fechas.forEach(f => { diario[f] = { aTiempo: 0, tarde: 0, ausente: 0, justificado: 0 }; });

  const filas = empleados.map(e => {
    const r = { e, esperados: 0, asistidos: 0, asistidosLab: 0, aTiempo: 0, tardes: 0, justificados: 0, ausencias: 0,
      pendientes: 0, sinSalida: 0, minRetraso: 0, minTrabajados: 0, minExtra: 0, fechasAusente: [] };
    const permE = aprobados.filter(p => p.EmpleadoID === e.ID);
    fechas.forEach(f => {
      if (f > hoy) return;
      const enContrato = (!e.FechaIngreso || f >= e.FechaIngreso) && (!e.FechaEgreso || f <= e.FechaEgreso);
      const laborable = lab.includes(diaSemana(f));
      const reg = idx.get(e.ID + '|' + f);
      if (reg && reg.Entrada) {
        r.asistidos++;
        if (laborable && enContrato) { r.esperados++; r.asistidosLab++; }
        const ret = num(reg.MinRetraso);
        if (ret > 0) { r.tardes++; r.minRetraso += ret; diario[f].tarde++; } else { r.aTiempo++; diario[f].aTiempo++; }
        r.minTrabajados += num(reg.MinTrabajados);
        r.minExtra += num(reg.MinExtra);
        if (!reg.Salida && f < hoy) r.sinSalida++;
        return;
      }
      if (!laborable || !enContrato) return;
      const justificado = permE.some(p => p.FechaInicio <= f && p.FechaFin >= f) ||
        (f === hoy && ['Vacaciones', 'Reposo', 'Permiso'].includes(e.Estado));
      if (justificado) { r.esperados++; r.justificados++; diario[f].justificado++; return; }
      if (f === hoy && !hoyCerrado) { r.pendientes++; return; }
      r.esperados++; r.ausencias++; r.fechasAusente.push(f); diario[f].ausente++;
    });
    const base = r.esperados - r.justificados;
    r.pctAsistencia = base > 0 ? r.asistidosLab / base * 100 : null;
    r.pctPuntualidad = r.asistidos > 0 ? r.aTiempo / r.asistidos * 100 : null;
    const evs = evaluaciones.filter(v => v.EmpleadoID === e.ID && v.Periodo >= desde.slice(0, 7) && v.Periodo <= hasta.slice(0, 7));
    r.evalProm = evs.length ? evs.reduce((s, v) => s + num(v.Promedio), 0) / evs.length : null;
    return r;
  });

  const grupos = {};
  filas.forEach(r => { const d = r.e.Departamento || 'Sin departamento'; (grupos[d] = grupos[d] || []).push(r); });
  const porDepto = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es'))
    .map(d => Object.assign({ depto: d }, resumir(grupos[d])));
  return { filas, tot: resumir(filas), porDepto, diario, fechas };
}

function saldoVacaciones(e, permisos = S.permisos, hoy = hoyStr()) {
  if (!e.FechaIngreso) return null;
  const ing = aFecha(e.FechaIngreso), h = aFecha(hoy);
  let anios = h.getFullYear() - ing.getFullYear();
  if (h.getMonth() < ing.getMonth() || (h.getMonth() === ing.getMonth() && h.getDate() < ing.getDate())) anios--;
  anios = Math.max(0, anios);
  let generados = 0;
  for (let k = 1; k <= anios; k++) generados += Math.min(15 + (k - 1), 30);
  const disfrutados = permisos.filter(p => p.EmpleadoID === e.ID && p.Tipo === 'Vacaciones' && p.Estado === 'Aprobado')
    .reduce((s, p) => s + num(p.Dias), 0);
  const prox = new Date(ing); prox.setFullYear(ing.getFullYear() + anios + 1);
  return { anios, generados, disfrutados, pendientes: generados - disfrutados, proximo: fechaStr(prox), diasProximo: Math.min(15 + anios, 30) };
}

function rotacion(empleados, desde, hasta) {
  const activosEn = f => empleados.filter(e => e.FechaIngreso && e.FechaIngreso <= f && (!e.FechaEgreso || e.FechaEgreso > f)).length;
  const egresos = empleados.filter(e => e.FechaEgreso && e.FechaEgreso >= desde && e.FechaEgreso <= hasta).length;
  const ingresos = empleados.filter(e => e.FechaIngreso && e.FechaIngreso >= desde && e.FechaIngreso <= hasta).length;
  const promedio = (activosEn(desde) + activosEn(hasta)) / 2;
  return { egresos, ingresos, pct: promedio > 0 ? egresos / promedio * 100 : 0 };
}

/* ======================= 10. TABLAS GENÉRICAS ======================= */
/** columnas: [{ t: título, v: fila => html, s: fila => valor para ordenar, c: fila => valor CSV, cls }] */
function renderTabla(contId, id, columnas, filas, opts = {}) {
  S.tablas[id] = { contId, columnas, filas, opts };
  pintarTabla(id);
}

function pintarTabla(id) {
  const { contId, columnas, filas, opts } = S.tablas[id];
  const o = S.orden[id];
  let lista = filas.slice();
  if (o && columnas[o.col] && columnas[o.col].s) {
    const fn = columnas[o.col].s;
    lista.sort((a, b) => {
      const x = fn(a), y = fn(b);
      if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y), 'es') * o.dir;
      return ((x ?? -1e15) - (y ?? -1e15)) * o.dir;
    });
  }
  const cont = $('#' + contId);
  if (!lista.length) {
    cont.innerHTML = `<div class="px-6 py-12 text-center text-sm text-slate-400"><i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2"></i>${esc(opts.vacio || 'No hay registros para mostrar.')}</div>`;
    iconos();
    return;
  }
  const th = columnas.map((c, i) => {
    const flecha = o && o.col === i ? (o.dir > 0 ? ' ▲' : ' ▼') : '';
    return `<th ${c.s ? `data-acc="ordenar" data-tabla="${id}" data-col="${i}"` : ''} class="${c.cls || ''}">${esc(c.t)}${flecha}</th>`;
  }).join('');
  const tr = lista.map(f => `<tr ${opts.fila ? opts.fila(f) : ''}>${columnas.map(c => `<td class="${c.cls || ''}">${c.v(f)}</td>`).join('')}</tr>`).join('');
  const pie = opts.pie !== false ? `<div class="px-4 py-3 text-xs text-slate-400">${lista.length} registro${lista.length === 1 ? '' : 's'}</div>` : '';
  cont.innerHTML = `<table class="tabla"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>${pie}`;
  iconos();
}

function ordenarTabla(id, col) {
  col = Number(col);
  const o = S.orden[id];
  S.orden[id] = o && o.col === col ? { col, dir: -o.dir } : { col, dir: 1 };
  pintarTabla(id);
}

function exportarTabla(id, nombre) {
  const t = S.tablas[id];
  if (!t || !t.filas.length) return toast('No hay datos para exportar.', 'aviso');
  const cols = t.columnas.filter(c => c.c);
  const celda = v => {
    let s = String(v ?? '');
    if (/^[=+@]/.test(s)) s = "'" + s;
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lineas = [cols.map(c => celda(c.t)).join(';')].concat(t.filas.map(f => cols.map(c => celda(c.c(f))).join(';')));
  descargarBlob(new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${nombre}_${hoyStr()}.csv`);
  toast('Archivo descargado. Ábrelo con Excel o Google Sheets.', 'ok');
}

const pctCSV = v => v === null || !isFinite(v) ? '' : Math.round(v);
const hCSV = m => (num(m) / 60).toFixed(2).replace('.', ',');

/* ======================= 11. GRÁFICOS ======================= */
function grafico(id, config) {
  if (!window.Chart) return;
  if (S.charts[id]) S.charts[id].destroy();
  const el = document.getElementById(id);
  if (!el) return;
  S.charts[id] = new Chart(el, config);
}

function baseOpciones(extra = {}) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } }, tooltip: { padding: 10, cornerRadius: 8 } }
  }, extra);
}

function agruparSerie(diario, fechas) {
  const lab = S.sesion.diasLaborables || [1, 2, 3, 4, 5, 6];
  let clave, etiqueta, modo;
  if (fechas.length <= 31) {
    modo = 'por día';
    fechas = fechas.filter(f => lab.includes(diaSemana(f)) || Object.values(diario[f]).some(v => v > 0));
    clave = f => f;
    etiqueta = f => aFecha(f).toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit' });
  } else if (fechas.length <= 120) {
    modo = 'por semana';
    clave = f => sumarDias(f, -(diaSemana(f) - 1));
    etiqueta = k => 'Sem ' + k.slice(8, 10) + '/' + k.slice(5, 7);
  } else {
    modo = 'por mes';
    clave = f => f.slice(0, 7);
    etiqueta = k => aFecha(k + '-01').toLocaleDateString('es-VE', { month: 'short', year: '2-digit' });
  }
  const g = new Map();
  fechas.forEach(f => {
    const k = clave(f);
    if (!g.has(k)) g.set(k, { aTiempo: 0, tarde: 0, ausente: 0, justificado: 0 });
    const a = g.get(k), d = diario[f];
    Object.keys(a).forEach(x => { a[x] += d[x]; });
  });
  return { modo, labels: Array.from(g.keys()).map(etiqueta), series: Array.from(g.values()) };
}

/* ======================= 12. DASHBOARD ======================= */
function tarjetaKPI(icono, titulo, valor, sub, color = 'marca') {
  const c = {
    marca: 'bg-marca-50 text-marca-700', azul: 'bg-sky-50 text-sky-700', ambar: 'bg-amber-50 text-amber-700',
    rosa: 'bg-rose-50 text-rose-700', violeta: 'bg-violet-50 text-violet-700', gris: 'bg-slate-100 text-slate-700', verde: 'bg-emerald-50 text-emerald-700'
  }[color];
  return `<div class="tarjeta p-5">
    <div class="flex items-start justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${esc(titulo)}</p>
      <span class="h-9 w-9 rounded-xl ${c} flex items-center justify-center shrink-0"><i data-lucide="${icono}" class="w-5 h-5"></i></span>
    </div>
    <p class="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums">${valor}</p>
    <p class="text-xs text-slate-500 mt-1">${sub}</p>
  </div>`;
}

async function cargarDashboard(forzar = false) {
  let datos;
  try { datos = await datosPeriodo('dash', forzar); } catch (e) { return toast(e.message, 'error', 6000); }
  const { f, asistencia } = datos;
  const emps = empleadosDelPeriodo(f.desde, f.hasta, f.depto, f.q);
  const k = calcularKPIs(emps, asistencia, S.permisos, S.evaluaciones, f.desde, f.hasta);
  const t = k.tot;
  const hoy = hoyStr();
  const activos = emps.filter(e => e.Estado !== 'Inactivo');
  const ausentesHoy = activos.filter(e => ['Vacaciones', 'Reposo', 'Permiso'].includes(e.Estado) ||
    S.permisos.some(p => p.EmpleadoID === e.ID && p.Estado === 'Aprobado' && p.FechaInicio <= hoy && p.FechaFin >= hoy)).length;
  const nomina = activos.reduce((s, e) => s + num(e.Salario), 0);
  const empsRot = S.empleados.filter(e => (!f.depto || e.Departamento === f.depto) && coincide(e, f.q));
  const rot = rotacion(empsRot, f.desde, f.hasta);

  $('#dash-subtitulo').textContent = `${textoPeriodo(f)}${f.depto ? ' · ' + f.depto : ''}${f.q ? ' · “' + f.q + '”' : ''}`;
  $('#print-detalle').textContent = 'Dashboard gerencial · ' + $('#dash-subtitulo').textContent + ' · Impreso: ' + new Date().toLocaleString('es-VE');

  $('#dash-kpis').innerHTML = [
    tarjetaKPI('users', 'Personal activo', activos.length, `${ausentesHoy} de vacaciones/permiso hoy`, 'marca'),
    tarjetaKPI('user-check', 'Asistencia', fmtPct(t.pctAsistencia), `${t.asistidosLab} de ${Math.max(0, t.esperados - t.justificados)} jornadas esperadas`, 'verde'),
    tarjetaKPI('timer', 'Puntualidad', fmtPct(t.pctPuntualidad), `${t.tardes} llegada${t.tardes === 1 ? '' : 's'} tarde · ${fmtMin(t.minRetraso)}`, 'ambar'),
    tarjetaKPI('user-x', 'Ausencias injustificadas', t.ausencias, `${t.justificados} justificadas${t.pendientes ? ` · ${t.pendientes} sin marcar aún hoy` : ''}`, 'rosa'),
    tarjetaKPI('hourglass', 'Horas extra', fmtHoras(t.minExtra), `${t.conExtra} empleado${t.conExtra === 1 ? '' : 's'} con horas extra`, 'violeta'),
    tarjetaKPI('clock', 'Horas trabajadas', fmtHoras(t.minTrabajados), `${t.asistidos ? fmtHoras(t.minTrabajados / t.asistidos) : '0 h'} promedio por jornada${t.sinSalida ? ` · ${t.sinSalida} sin salida` : ''}`, 'azul'),
    tarjetaKPI('wallet', 'Nómina mensual estimada', fmtDinero(nomina), `Suma de salarios de ${activos.length} activos`, 'gris'),
    tarjetaKPI('trending-up', 'Rotación', fmtPct(rot.pct), `${rot.ingresos} ingreso${rot.ingresos === 1 ? '' : 's'} · ${rot.egresos} egreso${rot.egresos === 1 ? '' : 's'}`, 'gris')
  ].join('');

  // Gráfico de asistencia
  const ser = agruparSerie(k.diario, k.fechas);
  $('#dash-agrupado').textContent = ser.modo;
  grafico('ch-diario', {
    type: 'bar',
    data: {
      labels: ser.labels,
      datasets: [
        { label: 'A tiempo', data: ser.series.map(s => s.aTiempo), backgroundColor: COLORES.aTiempo, borderRadius: 4, stack: 'a' },
        { label: 'Tarde', data: ser.series.map(s => s.tarde), backgroundColor: COLORES.tarde, borderRadius: 4, stack: 'a' },
        { label: 'Justificado', data: ser.series.map(s => s.justificado), backgroundColor: COLORES.justificado, borderRadius: 4, stack: 'a' },
        { label: 'Ausente', data: ser.series.map(s => s.ausente), backgroundColor: COLORES.ausente, borderRadius: 4, stack: 'a' }
      ]
    },
    options: baseOpciones({ scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } })
  });

  // Distribución por departamento
  const dist = {};
  activos.forEach(e => { const d = e.Departamento || 'Sin departamento'; dist[d] = (dist[d] || 0) + 1; });
  const dl = Object.keys(dist).sort((a, b) => dist[b] - dist[a]);
  grafico('ch-deptos', {
    type: 'doughnut',
    data: { labels: dl, datasets: [{ data: dl.map(d => dist[d]), backgroundColor: dl.map((_, i) => COLORES.serie[i % COLORES.serie.length]), borderWidth: 2, borderColor: '#fff' }] },
    options: baseOpciones({ cutout: '62%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } } } })
  });

  const pd = k.porDepto.filter(d => d.n > 0);
  grafico('ch-puntualidad', {
    type: 'bar',
    data: { labels: pd.map(d => d.depto), datasets: [{ label: 'Puntualidad %', data: pd.map(d => d.pctPuntualidad === null ? 0 : Math.round(d.pctPuntualidad)), backgroundColor: pd.map(d => (d.pctPuntualidad ?? 0) >= 90 ? COLORES.aTiempo : (d.pctPuntualidad ?? 0) >= 75 ? COLORES.tarde : COLORES.ausente), borderRadius: 6 }] },
    options: baseOpciones({ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } }, y: { grid: { display: false } } } })
  });
  grafico('ch-extras', {
    type: 'bar',
    data: { labels: pd.map(d => d.depto), datasets: [{ label: 'Horas extra', data: pd.map(d => +(d.minExtra / 60).toFixed(1)), backgroundColor: '#7c3aed', borderRadius: 6 }] },
    options: baseOpciones({ plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0, font: { size: 10 } } }, y: { beginAtZero: true, ticks: { callback: v => v + ' h' } } } })
  });

  pintarAlertas(f.depto, f.q);

  renderTabla('dash-tabla-deptos', 't-dash-deptos', [
    { t: 'Departamento', v: d => `<b>${esc(d.depto)}</b>`, s: d => d.depto, c: d => d.depto },
    { t: 'Empleados', v: d => d.n, s: d => d.n, c: d => d.n, cls: 'text-right' },
    { t: 'Asistencia', v: d => `<span class="${colorPuntaje(d.pctAsistencia)} font-semibold">${fmtPct(d.pctAsistencia)}</span>`, s: d => d.pctAsistencia, c: d => pctCSV(d.pctAsistencia), cls: 'text-right' },
    { t: 'Puntualidad', v: d => `<span class="${colorPuntaje(d.pctPuntualidad)} font-semibold">${fmtPct(d.pctPuntualidad)}</span>`, s: d => d.pctPuntualidad, c: d => pctCSV(d.pctPuntualidad), cls: 'text-right' },
    { t: 'Retrasos', v: d => d.tardes, s: d => d.tardes, c: d => d.tardes, cls: 'text-right' },
    { t: 'Ausencias', v: d => d.ausencias, s: d => d.ausencias, c: d => d.ausencias, cls: 'text-right' },
    { t: 'Justificadas', v: d => d.justificados, s: d => d.justificados, c: d => d.justificados, cls: 'text-right' },
    { t: 'Horas trabajadas', v: d => fmtHoras(d.minTrabajados), s: d => d.minTrabajados, c: d => hCSV(d.minTrabajados), cls: 'text-right' },
    { t: 'Horas extra', v: d => fmtHoras(d.minExtra), s: d => d.minExtra, c: d => hCSV(d.minExtra), cls: 'text-right' },
    { t: 'Desempeño', v: d => `<span class="${colorPuntaje(d.evalProm)} font-semibold">${d.evalProm === null ? '—' : fmtNum(d.evalProm)}</span>`, s: d => d.evalProm, c: d => d.evalProm === null ? '' : d.evalProm.toFixed(1).replace('.', ','), cls: 'text-right' }
  ], k.porDepto, { vacio: 'No hay empleados para estos filtros.' });

  renderTabla('dash-tabla-emp', 't-dash-emp', [
    { t: 'Empleado', v: r => `<button data-acc="ver-expediente" data-id="${esc(r.e.ID)}" class="font-semibold text-marca-700 hover:underline text-left">${esc(nombreCompleto(r.e))}</button><div class="text-xs text-slate-400">${esc(r.e.Cargo || '')}</div>`, s: r => nombreCompleto(r.e), c: r => nombreCompleto(r.e) },
    { t: 'Cédula', v: r => esc(r.e.Cedula), c: r => r.e.Cedula },
    { t: 'Departamento', v: r => esc(r.e.Departamento), s: r => r.e.Departamento, c: r => r.e.Departamento },
    { t: 'Jornadas', v: r => r.esperados, s: r => r.esperados, c: r => r.esperados, cls: 'text-right' },
    { t: 'Asistidas', v: r => r.asistidos, s: r => r.asistidos, c: r => r.asistidos, cls: 'text-right' },
    { t: 'Ausencias', v: r => r.ausencias ? `<span class="text-rose-600 font-semibold" title="${esc(r.fechasAusente.map(fmtFecha).join(', '))}">${r.ausencias}</span>` : '0', s: r => r.ausencias, c: r => r.ausencias, cls: 'text-right' },
    { t: 'Justif.', v: r => r.justificados, s: r => r.justificados, c: r => r.justificados, cls: 'text-right' },
    { t: 'Retrasos', v: r => r.tardes ? `<span class="text-amber-600 font-semibold">${r.tardes}</span> <span class="text-xs text-slate-400">(${fmtMin(r.minRetraso)})</span>` : '0', s: r => r.minRetraso, c: r => r.tardes, cls: 'text-right whitespace-nowrap' },
    { t: 'Min. retraso', v: r => Math.round(r.minRetraso), s: r => r.minRetraso, c: r => Math.round(r.minRetraso), cls: 'text-right hidden' },
    { t: 'Horas trab.', v: r => fmtHoras(r.minTrabajados), s: r => r.minTrabajados, c: r => hCSV(r.minTrabajados), cls: 'text-right whitespace-nowrap' },
    { t: 'Horas extra', v: r => r.minExtra ? `<b class="text-violet-700">${fmtHoras(r.minExtra)}</b>` : '—', s: r => r.minExtra, c: r => hCSV(r.minExtra), cls: 'text-right whitespace-nowrap' },
    { t: 'Asistencia', v: r => `<span class="${colorPuntaje(r.pctAsistencia)} font-semibold">${fmtPct(r.pctAsistencia)}</span>`, s: r => r.pctAsistencia, c: r => pctCSV(r.pctAsistencia), cls: 'text-right' },
    { t: 'Puntualidad', v: r => `<span class="${colorPuntaje(r.pctPuntualidad)} font-semibold">${fmtPct(r.pctPuntualidad)}</span>`, s: r => r.pctPuntualidad, c: r => pctCSV(r.pctPuntualidad), cls: 'text-right' },
    { t: 'Desempeño', v: r => `<span class="${colorPuntaje(r.evalProm)} font-semibold">${r.evalProm === null ? '—' : fmtNum(r.evalProm)}</span>`, s: r => r.evalProm, c: r => r.evalProm === null ? '' : r.evalProm.toFixed(1).replace('.', ','), cls: 'text-right' }
  ], k.filas, { vacio: 'No hay empleados para estos filtros.' });
  iconos();
}

function pintarAlertas(depto, q) {
  const hoy = hoyStr(), en30 = sumarDias(hoy, 30), en7 = sumarDias(hoy, 7);
  const emps = S.empleados.filter(e => e.Estado !== 'Inactivo' && (!depto || e.Departamento === depto) && coincide(e, q));
  const ids = new Set(emps.map(e => e.ID));
  const a = [];
  const item = (icono, color, titulo, detalle, id) => a.push({ icono, color, titulo, detalle, id });

  emps.forEach(e => {
    if (e.FinContrato && e.FinContrato < hoy) item('file-x', 'rosa', `Contrato vencido: ${nombreCompleto(e)}`, `Venció el ${fmtFecha(e.FinContrato)}`, e.ID);
    else if (e.FinContrato && e.FinContrato <= en30) item('file-clock', 'ambar', `Contrato por vencer: ${nombreCompleto(e)}`, `Vence el ${fmtFecha(e.FinContrato)}`, e.ID);
    const v = saldoVacaciones(e);
    if (v && v.pendientes >= 30) item('sun', 'azul', `Vacaciones acumuladas: ${nombreCompleto(e)}`, `${v.pendientes} días pendientes por disfrutar`, e.ID);
    if (!e.Email) item('mail-x', 'gris', `Sin correo registrado: ${nombreCompleto(e)}`, 'No podrá marcar asistencia', e.ID);
    if (e.FechaNacimiento && e.FechaNacimiento.slice(5, 7) === hoy.slice(5, 7)) item('cake', 'violeta', `Cumpleaños este mes: ${nombreCompleto(e)}`, fmtFecha(hoy.slice(0, 4) + e.FechaNacimiento.slice(4)), e.ID);
  });
  S.permisos.filter(p => ids.has(p.EmpleadoID)).forEach(p => {
    const e = empPorId(p.EmpleadoID);
    if (p.Estado === 'Pendiente') item('hourglass', 'ambar', `Permiso por aprobar: ${nombreCompleto(e)}`, `${p.Tipo} · ${fmtFecha(p.FechaInicio)} al ${fmtFecha(p.FechaFin)}`, e.ID);
    else if (p.Estado === 'Aprobado' && p.FechaInicio <= hoy && p.FechaFin >= hoy) item('calendar-check', 'azul', `Hoy de ${p.Tipo.toLowerCase()}: ${nombreCompleto(e)}`, `Hasta el ${fmtFecha(p.FechaFin)}`, e.ID);
    else if (p.Estado === 'Aprobado' && p.Tipo === 'Vacaciones' && p.FechaInicio > hoy && p.FechaInicio <= en7) item('plane', 'marca', `Vacaciones próximas: ${nombreCompleto(e)}`, `Desde el ${fmtFecha(p.FechaInicio)}`, e.ID);
  });

  const colores = { rosa: 'bg-rose-50 text-rose-600', ambar: 'bg-amber-50 text-amber-600', azul: 'bg-sky-50 text-sky-600',
    gris: 'bg-slate-100 text-slate-500', violeta: 'bg-violet-50 text-violet-600', marca: 'bg-marca-50 text-marca-700' };
  const orden = { rosa: 0, ambar: 1, azul: 2, marca: 3, violeta: 4, gris: 5 };
  a.sort((x, y) => orden[x.color] - orden[y.color]);
  $('#dash-alertas-total').textContent = a.length;
  $('#dash-alertas').innerHTML = a.length ? a.map(x => `
    <button data-acc="ver-expediente" data-id="${esc(x.id)}" class="w-full text-left flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50">
      <span class="h-8 w-8 rounded-lg ${colores[x.color]} flex items-center justify-center shrink-0"><i data-lucide="${x.icono}" class="w-4 h-4"></i></span>
      <span class="min-w-0"><span class="block text-sm font-medium text-slate-800">${esc(x.titulo)}</span><span class="block text-xs text-slate-500">${esc(x.detalle)}</span></span>
    </button>`).join('') : '<p class="text-sm text-slate-400 text-center py-8">Sin alertas. ¡Todo en orden!</p>';
}

/* ======================= 13. EMPLEADOS ======================= */
async function cargarEmpleados(forzar = false) {
  try {
    if (forzar || !S.empleados.length) {
      const d = await api('listarEmpleados', {}, { texto: 'Cargando empleados…' });
      S.empleados = d.empleados;
    }
  } catch (e) { return toast(e.message, 'error'); }
  pintarEmpleados();
}

function pintarEmpleados() {
  const q = $('#emp-buscar').value.trim(), dep = $('#emp-depto').value, est = $('#emp-estado').value;
  const lista = S.empleados.filter(e => coincide(e, q) && (!dep || e.Departamento === dep) && (!est || e.Estado === est)).sort(ordenarNombre);
  const activos = S.empleados.filter(e => e.Estado !== 'Inactivo').length;
  $('#emp-subtitulo').textContent = `${activos} activos · ${S.empleados.length} expedientes en total`;
  $('#print-detalle').textContent = `Listado de empleados · ${lista.length} registros · Impreso: ${new Date().toLocaleString('es-VE')}`;
  renderTabla('emp-tabla', 't-empleados', [
    { t: 'Empleado', v: e => `<div class="flex items-center gap-3"><div class="h-9 w-9 rounded-full bg-marca-100 text-marca-800 flex items-center justify-center text-xs font-bold shrink-0">${esc(iniciales(nombreCompleto(e)))}</div><div><button data-acc="ver-expediente" data-id="${esc(e.ID)}" class="font-semibold text-slate-800 hover:text-marca-700 text-left">${esc(nombreCompleto(e))}</button><div class="text-xs text-slate-400">${esc(e.Email || 'sin correo')}</div></div></div>`, s: e => nombreCompleto(e), c: e => nombreCompleto(e) },
    { t: 'ID', v: e => `<span class="text-xs font-mono text-slate-500">${esc(e.ID)}</span>`, s: e => e.ID, c: e => e.ID },
    { t: 'Cédula', v: e => esc(e.Cedula), s: e => e.Cedula, c: e => e.Cedula },
    { t: 'Departamento', v: e => esc(e.Departamento), s: e => e.Departamento, c: e => e.Departamento },
    { t: 'Cargo', v: e => esc(e.Cargo || '—'), s: e => e.Cargo, c: e => e.Cargo },
    { t: 'Ingreso', v: e => fmtFecha(e.FechaIngreso), s: e => e.FechaIngreso, c: e => e.FechaIngreso },
    { t: 'Estado', v: e => insigniaEstado(e.Estado), s: e => e.Estado, c: e => e.Estado },
    { t: 'Teléfono', v: e => esc(e.Telefono || '—'), c: e => e.Telefono, cls: 'hidden xl:table-cell' },
    { t: 'Correo', v: e => esc(e.Email), c: e => e.Email, cls: 'hidden' },
    { t: 'Salario', v: e => esc(e.Salario), c: e => String(e.Salario || '').replace('.', ','), cls: 'hidden' },
    { t: 'Tipo contrato', v: e => esc(e.TipoContrato), c: e => e.TipoContrato, cls: 'hidden' },
    { t: 'Fin contrato', v: e => esc(e.FinContrato), c: e => e.FinContrato, cls: 'hidden' },
    { t: 'Rol', v: e => esc(e.Rol), c: e => e.Rol, cls: 'hidden' },
    { t: '', v: e => `<div class="flex justify-end gap-1 no-print">
        <button data-acc="ver-expediente" data-id="${esc(e.ID)}" class="btn-fantasma btn-sm" title="Ver expediente"><i data-lucide="folder-open" class="w-4 h-4"></i></button>
        <button data-acc="editar-empleado" data-id="${esc(e.ID)}" class="btn-fantasma btn-sm solo-rrhh" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button></div>`, cls: 'text-right' }
  ], lista, { vacio: S.empleados.length ? 'Ningún empleado coincide con la búsqueda.' : 'Aún no hay empleados. Pulsa "Nuevo empleado" para comenzar.' });
}

function formEmpleado(id = null) {
  const e = id ? empPorId(id) : { Estado: 'Activo', Rol: 'EMPLEADO', TipoContrato: 'Tiempo indeterminado', FechaIngreso: hoyStr() };
  if (!e) return toast('Empleado no encontrado.', 'error');
  const c = (name, label, type = 'text', extra = '') =>
    `<div><label class="etiqueta">${label}</label><input name="${name}" type="${type}" class="campo" value="${esc(e[name] || '')}" ${extra}></div>`;
  const s = (name, label, lista, extra = '') =>
    `<div><label class="etiqueta">${label}</label><select name="${name}" class="campo" ${extra}>${opciones(lista, e[name] || '')}</select></div>`;
  const cat = S.sesion.catalogos;
  const volver = S.exp && S.exp.empleado.ID === id ? (() => verExpediente(id, S.expTab)) : null;
  abrirModal({
    titulo: id ? `Editar: ${nombreCompleto(e)}` : 'Nuevo empleado',
    ancho: 'sm:max-w-3xl',
    volver,
    cuerpo: `<form id="f-empleado" class="space-y-6" autocomplete="off">
      <input type="hidden" name="ID" value="${esc(e.ID || '')}">
      <fieldset><legend class="text-sm font-bold text-marca-700 mb-3">Datos personales</legend>
        <div class="grid sm:grid-cols-2 gap-4">
          ${c('Nombres', 'Nombres *', 'text', 'required')}${c('Apellidos', 'Apellidos *', 'text', 'required')}
          ${c('Cedula', 'Cédula *', 'text', 'required placeholder="V-12345678"')}${c('FechaNacimiento', 'Fecha de nacimiento', 'date')}
          ${c('Telefono', 'Teléfono', 'tel', 'placeholder="0414-0000000"')}
          ${c('Email', 'Correo de Google (Gmail) para iniciar sesión', 'email', 'placeholder="nombre@gmail.com"')}
          <div class="sm:col-span-2">${c('Direccion', 'Dirección de habitación')}</div>
        </div></fieldset>
      <fieldset><legend class="text-sm font-bold text-marca-700 mb-3">Datos laborales</legend>
        <div class="grid sm:grid-cols-3 gap-4">
          ${s('Departamento', 'Departamento *', S.sesion.departamentos, 'required')}${c('Cargo', 'Cargo')}${c('FechaIngreso', 'Fecha de ingreso *', 'date', 'required')}
          ${s('TipoContrato', 'Tipo de contrato', ['Tiempo indeterminado', 'Tiempo determinado', 'Por obra determinada', 'Pasantía', 'Honorarios profesionales'])}
          ${c('FinContrato', 'Fin de contrato (si aplica)', 'date')}${c('Salario', `Salario mensual (${esc(S.sesion.moneda)})`, 'number', 'min="0" step="0.01"')}
          ${s('Estado', 'Estado *', cat.estados, 'required')}${c('FechaEgreso', 'Fecha de egreso', 'date')}
          ${s('Rol', 'Rol en el sistema', [{ v: 'EMPLEADO', t: 'Empleado (solo marcaje)' }, { v: 'DIRECCION', t: 'Dirección (ver todo)' }, { v: 'RRHH', t: 'RRHH (gestionar todo)' }])}
        </div></fieldset>
      <fieldset><legend class="text-sm font-bold text-marca-700 mb-3">Contacto de emergencia</legend>
        <div class="grid sm:grid-cols-3 gap-4">
          ${c('EmergenciaNombre', 'Nombre')}${c('EmergenciaTelefono', 'Teléfono', 'tel')}${c('EmergenciaParentesco', 'Parentesco')}
        </div></fieldset>
      <div><label class="etiqueta">Notas internas</label><textarea name="Notas" rows="2" class="campo">${esc(e.Notas || '')}</textarea></div>
    </form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-empleado" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Guardar</button>`
  });
}

async function guardarEmpleado() {
  const form = $('#f-empleado');
  if (!form.reportValidity()) return;
  const datos = datosFormulario(form);
  try {
    const r = await api('guardarEmpleado', { empleado: datos }, { texto: 'Guardando expediente…' });
    const i = S.empleados.findIndex(e => e.ID === r.ID);
    if (i >= 0) S.empleados[i] = r; else S.empleados.push(r);
    invalidarCache();
    toast(datos.ID ? 'Expediente actualizado.' : `Empleado creado con ID ${r.ID}.`, 'ok');
    if (datos.ID && S.modalVolver) verExpediente(r.ID, S.expTab);
    else if (!datos.ID) verExpediente(r.ID, 'documentos');
    else cerrarModal();
    if (S.seccion === 'empleados') pintarEmpleados();
  } catch (e) { toast(e.message, 'error', 6000); }
}

/* ======================= 14. EXPEDIENTE DIGITAL ======================= */
async function verExpediente(id, tab = 'datos') {
  try {
    const d = await api('expediente', { id }, { texto: 'Abriendo expediente…' });
    const i = S.empleados.findIndex(e => e.ID === d.empleado.ID);
    if (i >= 0) S.empleados[i] = d.empleado; else S.empleados.push(d.empleado);
    const e = d.empleado;
    abrirModal({
      titulo: 'Expediente digital',
      ancho: 'sm:max-w-5xl',
      cuerpo: `
        <div class="flex flex-wrap items-center gap-4 mb-5">
          <div class="h-16 w-16 rounded-2xl bg-marca-700 text-white flex items-center justify-center text-xl font-extrabold">${esc(iniciales(nombreCompleto(e)))}</div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2"><h4 class="text-xl font-extrabold text-slate-900">${esc(nombreCompleto(e))}</h4>${insigniaEstado(e.Estado)}</div>
            <p class="text-sm text-slate-500">${esc([e.Cargo, e.Departamento].filter(Boolean).join(' · '))} · <span class="font-mono text-xs">${esc(e.ID)}</span> · C.I. ${esc(e.Cedula)}</p>
          </div>
          <div class="flex gap-2 no-print">
            <button data-acc="imprimir-modal" class="btn-sec btn-sm"><i data-lucide="printer" class="w-4 h-4"></i>Imprimir</button>
            <button data-acc="editar-empleado" data-id="${esc(e.ID)}" class="btn-primario btn-sm solo-rrhh"><i data-lucide="pencil" class="w-4 h-4"></i>Editar</button>
          </div>
        </div>
        <div class="border-b border-slate-200 flex gap-1 overflow-x-auto scroll-fino mb-5 no-print">
          ${[['datos', 'Datos'], ['documentos', `Documentos (${d.documentos.length})`], ['permisos', 'Vacaciones y permisos'], ['asistencia', 'Asistencia'], ['evaluaciones', `Desempeño (${d.evaluaciones.length})`]]
            .map(([k, t]) => `<button data-acc="exp-tab" data-tab="${k}" class="pestana">${t}</button>`).join('')}
        </div>
        <div id="exp-contenido"></div>`
    });
    S.exp = d;
    pintarExpTab(tab);
  } catch (err) { toast(err.message, 'error'); }
}

function pintarExpTab(tab) {
  if (!S.exp) return;
  S.expTab = tab;
  $$('[data-acc="exp-tab"]').forEach(b => b.classList.toggle('activo', b.dataset.tab === tab));
  const fn = { datos: expDatos, documentos: expDocumentos, permisos: expPermisos, asistencia: expAsistencia, evaluaciones: expEvaluaciones }[tab];
  $('#exp-contenido').innerHTML = fn(S.exp);
  if (tab === 'asistencia') expAsistenciaGrafico(S.exp);
  iconos();
}

function campoLectura(t, v) {
  return `<div><p class="text-xs font-semibold text-slate-400 uppercase tracking-wide">${esc(t)}</p><p class="text-sm text-slate-800 mt-0.5 break-words">${v || '<span class="text-slate-300">—</span>'}</p></div>`;
}

function expDatos({ empleado: e }) {
  const antig = e.FechaIngreso ? (() => {
    const m = Math.max(0, Math.floor((aFecha(e.FechaEgreso || hoyStr()) - aFecha(e.FechaIngreso)) / (1000 * 60 * 60 * 24 * 30.4375)));
    return `${Math.floor(m / 12)} año(s) y ${m % 12} mes(es)`;
  })() : '';
  const bloque = (t, campos) => `<div class="tarjeta p-5"><h5 class="font-bold text-sm text-marca-700 mb-4">${t}</h5><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${campos.join('')}</div></div>`;
  return `<div class="space-y-4">
    ${bloque('Datos personales', [campoLectura('Cédula', esc(e.Cedula)), campoLectura('Fecha de nacimiento', e.FechaNacimiento ? fmtFecha(e.FechaNacimiento) : ''),
      campoLectura('Teléfono', esc(e.Telefono)), campoLectura('Correo (inicio de sesión)', esc(e.Email)), campoLectura('Dirección', esc(e.Direccion))])}
    ${bloque('Datos laborales', [campoLectura('Departamento', esc(e.Departamento)), campoLectura('Cargo', esc(e.Cargo)),
      campoLectura('Fecha de ingreso', e.FechaIngreso ? fmtFecha(e.FechaIngreso) : ''), campoLectura('Antigüedad', antig),
      campoLectura('Tipo de contrato', esc(e.TipoContrato)), campoLectura('Fin de contrato', e.FinContrato ? fmtFecha(e.FinContrato) : ''),
      campoLectura('Salario mensual', e.Salario ? fmtDinero(e.Salario) : ''), campoLectura('Fecha de egreso', e.FechaEgreso ? fmtFecha(e.FechaEgreso) : ''),
      campoLectura('Rol en el sistema', esc(e.Rol))])}
    ${bloque('Contacto de emergencia', [campoLectura('Nombre', esc(e.EmergenciaNombre)), campoLectura('Teléfono', esc(e.EmergenciaTelefono)), campoLectura('Parentesco', esc(e.EmergenciaParentesco))])}
    ${e.Notas ? `<div class="tarjeta p-5"><h5 class="font-bold text-sm text-marca-700 mb-2">Notas internas</h5><p class="text-sm whitespace-pre-line">${esc(e.Notas)}</p></div>` : ''}
    <p class="text-xs text-slate-400">Creado: ${esc(e.Creado || '—')} · Última actualización: ${esc(e.Actualizado || '—')}</p>
  </div>`;
}

function iconoArchivo(mime) {
  if (/pdf/.test(mime)) return ['file-text', 'bg-rose-50 text-rose-600'];
  if (/image/.test(mime)) return ['image', 'bg-sky-50 text-sky-600'];
  if (/sheet|excel|csv/.test(mime)) return ['file-spreadsheet', 'bg-emerald-50 text-emerald-600'];
  if (/word|document/.test(mime)) return ['file-type', 'bg-blue-50 text-blue-600'];
  return ['file', 'bg-slate-100 text-slate-600'];
}

function expDocumentos({ empleado: e, documentos }) {
  const subir = `<div class="tarjeta p-5 mb-5 solo-rrhh no-print">
    <h5 class="font-bold text-sm text-marca-700 mb-4">Subir documento al expediente</h5>
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
      <div><label class="etiqueta">Tipo de documento</label><select id="doc-tipo" class="campo">${opciones(TIPOS_DOCUMENTO)}</select></div>
      <div class="lg:col-span-2"><label class="etiqueta">Archivo (PDF, imagen, Word, Excel · máx. ${esc(S.sesion.tamanoMaxMB)} MB)</label>
        <input id="doc-archivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt" class="campo file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:px-3 file:py-1 file:text-marca-700 file:font-semibold"></div>
      <div><button data-acc="subir-doc" data-id="${esc(e.ID)}" class="btn-primario w-full"><i data-lucide="upload" class="w-4 h-4"></i>Subir</button></div>
      <div class="sm:col-span-2 lg:col-span-4"><input id="doc-notas" class="campo" placeholder="Notas (opcional): ej. Amonestación por retrasos reiterados, firmada el 05/11"></div>
    </div>
    <p class="text-xs text-slate-400 mt-3">Los archivos se guardan en Google Drive de RRHH, en la carpeta del empleado.</p>
  </div>`;
  const lista = documentos.length ? `<div class="grid sm:grid-cols-2 gap-3">${documentos.map(d => {
    const [ic, col] = iconoArchivo(d.MimeType);
    return `<div class="tarjeta p-4 flex items-start gap-3">
      <span class="h-10 w-10 rounded-xl ${col} flex items-center justify-center shrink-0"><i data-lucide="${ic}" class="w-5 h-5"></i></span>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-marca-700">${esc(d.Tipo)}</p>
        <p class="text-sm font-medium text-slate-800 truncate" title="${esc(d.Nombre)}">${esc(d.Nombre)}</p>
        <p class="text-xs text-slate-400">${esc(String(d.Creado).slice(0, 10))} · ${fmtTamano(d.Tamano)}</p>
        ${d.Notas ? `<p class="text-xs text-slate-500 mt-1">${esc(d.Notas)}</p>` : ''}
      </div>
      <div class="flex flex-col gap-1 no-print">
        <button data-acc="ver-doc" data-id="${esc(d.ID)}" class="btn-fantasma btn-sm" title="Ver / descargar"><i data-lucide="eye" class="w-4 h-4"></i></button>
        <button data-acc="borrar-doc" data-id="${esc(d.ID)}" class="btn-fantasma btn-sm text-rose-600 solo-rrhh" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div></div>`;
  }).join('')}</div>` : '<div class="text-center text-sm text-slate-400 py-10"><i data-lucide="folder-open" class="w-8 h-8 mx-auto mb-2"></i>Este expediente aún no tiene documentos.</div>';
  return subir + lista;
}

function expPermisos({ empleado: e, permisos }) {
  const v = saldoVacaciones(e, permisos);
  const tarjetas = v ? `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
    ${[['Años de servicio', v.anios], ['Días generados', v.generados], ['Disfrutados / programados', v.disfrutados], ['Pendientes', `<span class="${v.pendientes > 0 ? 'text-marca-700' : 'text-slate-800'}">${v.pendientes}</span>`]]
      .map(([t, x]) => `<div class="tarjeta p-4"><p class="text-xs font-semibold text-slate-500">${t}</p><p class="text-2xl font-extrabold mt-1">${x}</p></div>`).join('')}
    </div><p class="text-xs text-slate-500 mb-5">Próximo aniversario: <b>${fmtFecha(v.proximo)}</b> · le corresponderán <b>${v.diasProximo}</b> días hábiles. Para cargar vacaciones disfrutadas antes del sistema, registra un permiso de tipo "Vacaciones" aprobado con los días correspondientes.</p>` : '';
  const filas = permisos.length ? `<div class="tarjeta overflow-x-auto"><table class="tabla"><thead><tr><th>Tipo</th><th>Desde</th><th>Hasta</th><th class="text-right">Días</th><th>Estado</th><th>Observación</th><th class="no-print"></th></tr></thead><tbody>
    ${permisos.map(p => `<tr><td class="font-medium">${esc(p.Tipo)}</td><td>${fmtFecha(p.FechaInicio)}</td><td>${fmtFecha(p.FechaFin)}</td><td class="text-right">${esc(p.Dias)}</td><td>${insigniaEstado(p.Estado)}</td><td class="envolver text-xs text-slate-500">${esc(p.Observacion)}</td>
      <td class="text-right no-print whitespace-nowrap solo-rrhh"><button data-acc="editar-permiso" data-id="${esc(p.ID)}" class="btn-fantasma btn-sm"><i data-lucide="pencil" class="w-4 h-4"></i></button><button data-acc="borrar-permiso" data-id="${esc(p.ID)}" class="btn-fantasma btn-sm text-rose-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="text-center text-sm text-slate-400 py-8">Sin permisos registrados.</p>';
  return `${tarjetas}<div class="flex justify-between items-center mb-3"><h5 class="font-bold text-sm text-marca-700">Historial</h5>
    <button data-acc="nuevo-permiso" data-emp="${esc(e.ID)}" class="btn-primario btn-sm solo-rrhh no-print"><i data-lucide="plus" class="w-4 h-4"></i>Registrar permiso</button></div>${filas}`;
}

function expAsistencia({ empleado: e, asistencia, permisos, evaluaciones }) {
  const hasta = hoyStr(), desde = sumarDias(hasta, -29);
  const k = calcularKPIs([e], asistencia.filter(a => a.Fecha >= desde), permisos, evaluaciones, desde, hasta).filas[0];
  const tarjetas = [['Asistencia (30 días)', fmtPct(k.pctAsistencia)], ['Puntualidad', fmtPct(k.pctPuntualidad)], ['Retrasos', `${k.tardes} · ${fmtMin(k.minRetraso)}`],
    ['Ausencias', k.ausencias], ['Horas trabajadas', fmtHoras(k.minTrabajados)], ['Horas extra', fmtHoras(k.minExtra)]]
    .map(([t, x]) => `<div class="tarjeta p-4"><p class="text-xs font-semibold text-slate-500">${t}</p><p class="text-xl font-extrabold mt-1">${x}</p></div>`).join('');
  const filas = asistencia.length ? asistencia.map(a => `<tr><td class="cap1">${esc(fmtFechaCorta(a.Fecha))}</td><td>${fmtHora(a.Entrada)}</td><td>${fmtHora(a.Salida)}</td>
    <td>${num(a.MinRetraso) > 0 ? `<span class="text-amber-600 font-semibold">${fmtMin(a.MinRetraso)}</span>` : '—'}</td><td>${a.MinTrabajados ? fmtMin(a.MinTrabajados) : '—'}</td>
    <td>${num(a.MinExtra) > 0 ? fmtMin(a.MinExtra) : '—'}</td><td class="text-xs">${a.Origen === 'MANUAL' ? `<span class="insignia bg-slate-100 text-slate-600" title="${esc(a.Observacion)}">Manual</span>` : `GPS · ${esc(a.DistEntrada)} m`}</td></tr>`).join('')
    : '<tr><td colspan="7" class="text-center text-slate-400 py-8">Sin marcajes en los últimos 90 días.</td></tr>';
  return `<div class="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">${tarjetas}</div>
    <div class="tarjeta p-5 mb-5"><h5 class="font-bold text-sm text-marca-700 mb-3">Hora de entrada · últimos 30 días</h5><div class="h-56"><canvas id="ch-exp-asis"></canvas></div></div>
    <div class="tarjeta overflow-x-auto"><table class="tabla"><thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Retraso</th><th>Trabajado</th><th>Extra</th><th>Origen</th></tr></thead><tbody>${filas}</tbody></table></div>`;
}

function expAsistenciaGrafico({ asistencia }) {
  const hasta = hoyStr(), desde = sumarDias(hasta, -29);
  const regs = asistencia.filter(a => a.Fecha >= desde && a.Entrada).sort((a, b) => a.Fecha < b.Fecha ? -1 : 1);
  const lim = minutos(S.sesion.horario.entrada) + num(S.sesion.horario.tolerancia);
  const aHora = v => `${pad(Math.floor(v / 60))}:${pad(Math.round(v % 60))}`;
  grafico('ch-exp-asis', {
    type: 'line',
    data: {
      labels: regs.map(a => fmtFechaCorta(a.Fecha)),
      datasets: [
        { label: 'Hora de entrada', data: regs.map(a => +minutos(a.Entrada).toFixed(1)), borderColor: COLORES.aTiempo, backgroundColor: regs.map(a => num(a.MinRetraso) > 0 ? COLORES.tarde : COLORES.aTiempo), pointRadius: 5, tension: 0.25 },
        { label: 'Límite (con tolerancia)', data: regs.map(() => lim), borderColor: COLORES.ausente, borderDash: [6, 4], pointRadius: 0 }
      ]
    },
    options: baseOpciones({ scales: { y: { ticks: { callback: aHora } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${aHora(c.parsed.y)}` } } } })
  });
}

function expEvaluaciones({ empleado: e, evaluaciones }) {
  const filas = evaluaciones.length ? `<div class="tarjeta overflow-x-auto"><table class="tabla"><thead><tr><th>Período</th>${CRITERIOS.map(c => `<th class="text-right">${c.t}</th>`).join('')}<th class="text-right">Promedio</th><th>Comentarios</th><th class="no-print"></th></tr></thead><tbody>
    ${evaluaciones.map(v => `<tr><td class="font-medium">${esc(fmtPeriodo(v.Periodo))}</td>${CRITERIOS.map(c => `<td class="text-right">${esc(v[c.k])}</td>`).join('')}
      <td class="text-right font-extrabold ${colorPuntaje(num(v.Promedio))}">${esc(v.Promedio)}</td><td class="envolver text-xs text-slate-500">${esc(v.Comentarios)}</td>
      <td class="no-print solo-rrhh"><button data-acc="borrar-eval" data-id="${esc(v.ID)}" class="btn-fantasma btn-sm text-rose-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="text-center text-sm text-slate-400 py-8">Sin evaluaciones registradas.</p>';
  return `<div class="flex justify-end mb-3"><button data-acc="nueva-eval" data-emp="${esc(e.ID)}" class="btn-primario btn-sm solo-rrhh no-print"><i data-lucide="plus" class="w-4 h-4"></i>Nueva evaluación</button></div>${filas}`;
}

const fmtPeriodo = p => p ? aFecha(p + '-01').toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }) : '—';

function leerBase64(archivo) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    r.readAsDataURL(archivo);
  });
}

async function subirDocumento(empId) {
  const f = $('#doc-archivo').files[0];
  if (!f) return toast('Selecciona un archivo primero.', 'aviso');
  const maxMB = num(S.sesion.tamanoMaxMB) || 10;
  if (f.size > maxMB * 1024 * 1024) return toast(`El archivo pesa ${fmtTamano(f.size)}. El máximo es ${maxMB} MB.`, 'error');
  try {
    cargando(true, 'Preparando archivo…');
    let base64;
    try { base64 = await leerBase64(f); } finally { cargando(false); }
    await api('subirDocumento', { empleadoId: empId, tipo: $('#doc-tipo').value, nombre: f.name, mimeType: f.type || 'application/octet-stream', base64, notas: $('#doc-notas').value.trim() }, { texto: 'Subiendo documento a Drive…' });
    toast('Documento guardado en el expediente.', 'ok');
    verExpediente(empId, 'documentos');
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function verDocumento(id) {
  const ventana = window.open('', '_blank');
  if (ventana) ventana.document.write('<p style="font-family:sans-serif;padding:24px;color:#475569">Cargando documento…</p>');
  try {
    const d = await api('descargarDocumento', { id }, { texto: 'Descargando documento…' });
    const bytes = Uint8Array.from(atob(d.base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: d.mimeType });
    if (ventana && /^(application\/pdf|image\/|text\/plain)/.test(d.mimeType)) {
      const url = URL.createObjectURL(blob);
      ventana.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } else {
      if (ventana) ventana.close();
      descargarBlob(blob, d.nombre);
    }
  } catch (e) {
    if (ventana) ventana.close();
    toast(e.message, 'error');
  }
}

async function borrarDocumento(id) {
  const empId = S.exp?.empleado.ID;
  if (!await confirmar('El documento se moverá a la papelera de Google Drive y se quitará del expediente.', { titulo: '¿Eliminar documento?' })) return;
  try {
    await api('eliminarDocumento', { id }, { texto: 'Eliminando…' });
    toast('Documento eliminado.', 'ok');
    if (empId) verExpediente(empId, 'documentos');
  } catch (e) { toast(e.message, 'error'); }
}

/* ======================= 15. ASISTENCIA ======================= */
async function cargarAsistencia(forzar = false) {
  let datos;
  try { datos = await datosPeriodo('asis', forzar); } catch (e) { return toast(e.message, 'error', 6000); }
  const { f, asistencia } = datos;
  const ids = new Set(empleadosDelPeriodo(f.desde, f.hasta, f.depto, f.q).map(e => e.ID));
  if (!f.depto && !f.q) asistencia.forEach(a => ids.add(a.EmpleadoID));
  const lista = asistencia.filter(a => ids.has(a.EmpleadoID)).map(a => Object.assign({ _e: empPorId(a.EmpleadoID) || { Nombres: a.Email, Apellidos: '' } }, a));
  lista.sort((a, b) => a.Fecha === b.Fecha ? String(a.Entrada).localeCompare(String(b.Entrada)) : (a.Fecha < b.Fecha ? 1 : -1));

  $('#asis-subtitulo').textContent = `${textoPeriodo(f)}${f.depto ? ' · ' + f.depto : ''}`;
  $('#print-detalle').textContent = `Control de asistencia · ${$('#asis-subtitulo').textContent} · Impreso: ${new Date().toLocaleString('es-VE')}`;
  const tarde = lista.filter(a => num(a.MinRetraso) > 0).length;
  const sinSalida = lista.filter(a => !a.Salida && a.Fecha < hoyStr()).length;
  const extra = lista.reduce((s, a) => s + num(a.MinExtra), 0);
  $('#asis-resumen').innerHTML = [
    tarjetaKPI('fingerprint', 'Marcajes', lista.length, `${lista.filter(a => a.Origen === 'MANUAL').length} registrados manualmente`, 'marca'),
    tarjetaKPI('timer', 'Llegadas tarde', tarde, lista.length ? `${Math.round(tarde / lista.length * 100)}% de los marcajes` : '—', 'ambar'),
    tarjetaKPI('log-out', 'Sin salida', sinSalida, 'Jornadas pasadas sin marcar salida', 'rosa'),
    tarjetaKPI('hourglass', 'Horas extra', fmtHoras(extra), 'Total del período', 'violeta')
  ].join('');

  renderTabla('asis-tabla', 't-asistencia', [
    { t: 'Fecha', v: a => `<span class="cap1 whitespace-nowrap">${esc(fmtFechaCorta(a.Fecha))}</span>`, s: a => a.Fecha, c: a => a.Fecha },
    { t: 'Empleado', v: a => `<button data-acc="ver-expediente" data-id="${esc(a.EmpleadoID)}" class="font-semibold text-slate-800 hover:text-marca-700 text-left">${esc(nombreCompleto(a._e))}</button>`, s: a => nombreCompleto(a._e), c: a => nombreCompleto(a._e) },
    { t: 'Cédula', v: a => esc(a._e.Cedula || ''), c: a => a._e.Cedula || '', cls: 'hidden' },
    { t: 'Departamento', v: a => esc(a._e.Departamento || '—'), s: a => a._e.Departamento || '', c: a => a._e.Departamento || '' },
    { t: 'Entrada', v: a => `<b>${fmtHora(a.Entrada)}</b>`, s: a => a.Entrada, c: a => a.Entrada },
    { t: 'Salida', v: a => a.Salida ? `<b>${fmtHora(a.Salida)}</b>` : (a.Fecha < hoyStr() ? '<span class="insignia bg-rose-100 text-rose-700">Sin salida</span>' : '<span class="text-slate-400">—</span>'), s: a => a.Salida, c: a => a.Salida },
    { t: 'Retraso', v: a => num(a.MinRetraso) > 0 ? `<span class="text-amber-600 font-semibold">${fmtMin(a.MinRetraso)}</span>` : '<span class="text-emerald-600">A tiempo</span>', s: a => num(a.MinRetraso), c: a => Math.round(num(a.MinRetraso)) },
    { t: 'Trabajado', v: a => a.MinTrabajados ? fmtMin(a.MinTrabajados) : '—', s: a => num(a.MinTrabajados), c: a => hCSV(a.MinTrabajados) },
    { t: 'Extra', v: a => num(a.MinExtra) > 0 ? `<b class="text-violet-700">${fmtMin(a.MinExtra)}</b>` : '—', s: a => num(a.MinExtra), c: a => hCSV(a.MinExtra) },
    { t: 'Ubicación', v: a => a.Origen === 'MANUAL' ? `<span class="insignia bg-slate-100 text-slate-600" title="${esc(a.Observacion)}">Manual</span>` : `<span class="text-xs text-slate-500 whitespace-nowrap">${esc(a.DistEntrada)} m${a.DistSalida ? ' / ' + esc(a.DistSalida) + ' m' : ''}</span>`, c: a => a.Origen === 'MANUAL' ? 'Manual' : `${a.DistEntrada} m` },
    { t: 'Observación', v: a => esc(a.Observacion), c: a => a.Observacion, cls: 'hidden' },
    { t: '', v: a => `<div class="flex justify-end gap-1 no-print solo-rrhh"><button data-acc="marcaje-manual" data-id="${esc(a.ID)}" class="btn-fantasma btn-sm" title="Corregir"><i data-lucide="pencil" class="w-4 h-4"></i></button><button data-acc="borrar-asis" data-id="${esc(a.ID)}" class="btn-fantasma btn-sm text-rose-600" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`, cls: 'text-right' }
  ], lista, { vacio: 'No hay marcajes en este período.' });
}

async function formMarcajeManual(id = null) {
  try { await asegurarCatalogo(); } catch (e) { return toast(e.message, 'error'); }
  let a = { Fecha: hoyStr(), Entrada: '', Salida: '', Observacion: '' };
  if (id) {
    const todos = Object.values(S.periodos).flatMap(p => p.asistencia);
    a = todos.find(x => x.ID === id) || a;
  }
  const activos = S.empleados.filter(e => e.Estado !== 'Inactivo').sort(ordenarNombre);
  abrirModal({
    titulo: id ? 'Corregir marcaje' : 'Registro manual de asistencia',
    cuerpo: `<form id="f-manual" class="grid sm:grid-cols-2 gap-4">
      <div class="sm:col-span-2"><label class="etiqueta">Empleado *</label><select name="empleadoId" class="campo" required ${id ? 'disabled' : ''}>${opciones(activos.map(e => ({ v: e.ID, t: `${nombreCompleto(e)} · ${e.Departamento}` })), a.EmpleadoID || '', 'Selecciona…')}</select>
        ${id ? `<input type="hidden" name="empleadoId" value="${esc(a.EmpleadoID)}">` : ''}</div>
      <div><label class="etiqueta">Fecha *</label><input name="fecha" type="date" class="campo" required max="${hoyStr()}" value="${esc(a.Fecha)}" ${id ? 'readonly' : ''}></div>
      <div></div>
      <div><label class="etiqueta">Hora de entrada *</label><input name="entrada" type="time" class="campo" required value="${esc(fmtHora(a.Entrada) === '—' ? '' : fmtHora(a.Entrada))}"></div>
      <div><label class="etiqueta">Hora de salida</label><input name="salida" type="time" class="campo" value="${esc(fmtHora(a.Salida) === '—' ? '' : fmtHora(a.Salida))}"></div>
      <div class="sm:col-span-2"><label class="etiqueta">Motivo *</label><textarea name="observacion" rows="2" class="campo" required placeholder="Ej.: Olvidó marcar la salida; teléfono sin batería; corrección autorizada por gerencia.">${esc(String(a.Observacion || '').replace(/ \(por .+\)$/, ''))}</textarea></div>
      <p class="sm:col-span-2 text-xs text-slate-500">Si ya existe un marcaje para ese empleado y fecha, se corregirá. Queda registrado en la auditoría.</p>
    </form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-manual" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Guardar</button>`
  });
}

async function guardarManual() {
  const form = $('#f-manual');
  if (!form.reportValidity()) return;
  try {
    await api('marcajeManual', datosFormulario(form), { texto: 'Guardando…' });
    toast('Marcaje guardado.', 'ok');
    cerrarModal(); invalidarCache();
    if (S.seccion === 'asistencia') cargarAsistencia(true);
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function borrarAsistencia(id) {
  if (!await confirmar('Se eliminará este marcaje de forma permanente.', { titulo: '¿Eliminar marcaje?' })) return;
  try {
    await api('eliminarAsistencia', { id }, { texto: 'Eliminando…' });
    toast('Marcaje eliminado.', 'ok'); invalidarCache(); cargarAsistencia(true);
  } catch (e) { toast(e.message, 'error'); }
}

/* ======================= 16. PERMISOS Y VACACIONES ======================= */
async function cargarPermisos(forzar = false) {
  try { await asegurarCatalogo(forzar); } catch (e) { return toast(e.message, 'error'); }
  pintarPermisos();
}

function pintarPermisos() {
  const q = $('#per-buscar').value.trim(), dep = $('#per-depto').value, tipo = $('#per-tipo').value, est = $('#per-estado').value;
  const lista = S.permisos.map(p => Object.assign({ _e: empPorId(p.EmpleadoID) || {} }, p))
    .filter(p => coincide(p._e, q) && (!dep || p._e.Departamento === dep) && (!tipo || p.Tipo === tipo) && (!est || p.Estado === est))
    .sort((a, b) => (a.Estado === 'Pendiente') !== (b.Estado === 'Pendiente') ? (a.Estado === 'Pendiente' ? -1 : 1) : (a.FechaInicio < b.FechaInicio ? 1 : -1));
  $('#print-detalle').textContent = `Permisos y vacaciones · Impreso: ${new Date().toLocaleString('es-VE')}`;
  renderTabla('per-tabla', 't-permisos', [
    { t: 'Empleado', v: p => `<button data-acc="ver-expediente" data-id="${esc(p.EmpleadoID)}" class="font-semibold text-slate-800 hover:text-marca-700 text-left">${esc(nombreCompleto(p._e))}</button><div class="text-xs text-slate-400">${esc(p._e.Departamento || '')}</div>`, s: p => nombreCompleto(p._e), c: p => nombreCompleto(p._e) },
    { t: 'Departamento', v: p => esc(p._e.Departamento), c: p => p._e.Departamento, cls: 'hidden' },
    { t: 'Tipo', v: p => esc(p.Tipo), s: p => p.Tipo, c: p => p.Tipo },
    { t: 'Desde', v: p => fmtFecha(p.FechaInicio), s: p => p.FechaInicio, c: p => p.FechaInicio },
    { t: 'Hasta', v: p => fmtFecha(p.FechaFin), s: p => p.FechaFin, c: p => p.FechaFin },
    { t: 'Días', v: p => esc(p.Dias), s: p => num(p.Dias), c: p => p.Dias, cls: 'text-right' },
    { t: 'Estado', v: p => insigniaEstado(p.Estado), s: p => p.Estado, c: p => p.Estado },
    { t: 'Observación', v: p => `<span class="text-xs text-slate-500">${esc(p.Observacion)}</span>`, c: p => p.Observacion, cls: 'envolver' },
    { t: '', v: p => `<div class="flex justify-end gap-1 no-print solo-rrhh whitespace-nowrap">
        ${p.Estado === 'Pendiente' ? `<button data-acc="estado-permiso" data-id="${esc(p.ID)}" data-estado="Aprobado" class="btn-sm btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100" title="Aprobar"><i data-lucide="check" class="w-4 h-4"></i></button>
        <button data-acc="estado-permiso" data-id="${esc(p.ID)}" data-estado="Rechazado" class="btn-sm btn bg-rose-50 text-rose-700 hover:bg-rose-100" title="Rechazar"><i data-lucide="x" class="w-4 h-4"></i></button>` : ''}
        <button data-acc="editar-permiso" data-id="${esc(p.ID)}" class="btn-fantasma btn-sm" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button>
        <button data-acc="borrar-permiso" data-id="${esc(p.ID)}" class="btn-fantasma btn-sm text-rose-600" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`, cls: 'text-right' }
  ], lista, { vacio: 'No hay permisos registrados con estos filtros.' });

  const vac = S.empleados.filter(e => e.Estado !== 'Inactivo' && coincide(e, q) && (!dep || e.Departamento === dep)).sort(ordenarNombre)
    .map(e => Object.assign({ e }, saldoVacaciones(e) || { anios: 0, generados: 0, disfrutados: 0, pendientes: 0, proximo: '', diasProximo: 15 }));
  renderTabla('vac-tabla', 't-vacaciones', [
    { t: 'Empleado', v: r => `<button data-acc="ver-expediente" data-id="${esc(r.e.ID)}" data-tab="permisos" class="font-semibold text-slate-800 hover:text-marca-700 text-left">${esc(nombreCompleto(r.e))}</button>`, s: r => nombreCompleto(r.e), c: r => nombreCompleto(r.e) },
    { t: 'Departamento', v: r => esc(r.e.Departamento), s: r => r.e.Departamento, c: r => r.e.Departamento },
    { t: 'Ingreso', v: r => fmtFecha(r.e.FechaIngreso), s: r => r.e.FechaIngreso, c: r => r.e.FechaIngreso },
    { t: 'Años', v: r => r.anios, s: r => r.anios, c: r => r.anios, cls: 'text-right' },
    { t: 'Generados', v: r => r.generados, s: r => r.generados, c: r => r.generados, cls: 'text-right' },
    { t: 'Disfrutados', v: r => r.disfrutados, s: r => r.disfrutados, c: r => r.disfrutados, cls: 'text-right' },
    { t: 'Pendientes', v: r => `<b class="${r.pendientes >= 30 ? 'text-rose-600' : r.pendientes > 0 ? 'text-marca-700' : 'text-slate-500'}">${r.pendientes}</b>`, s: r => r.pendientes, c: r => r.pendientes, cls: 'text-right' },
    { t: 'Próximo aniversario', v: r => r.proximo ? `${fmtFecha(r.proximo)} <span class="text-xs text-slate-400">(+${r.diasProximo} días)</span>` : '—', s: r => r.proximo, c: r => r.proximo }
  ], vac, { vacio: 'Sin empleados activos.' });
}

async function formPermiso({ id = null, emp = null } = {}) {
  try { await asegurarCatalogo(); } catch (e) { return toast(e.message, 'error'); }
  const fuente = S.exp ? S.exp.permisos.concat(S.permisos) : S.permisos;
  const p = id ? (fuente.find(x => x.ID === id) || {}) : { EmpleadoID: emp || '', Tipo: 'Vacaciones', Estado: 'Aprobado', FechaInicio: hoyStr(), FechaFin: hoyStr() };
  const activos = S.empleados.filter(e => e.Estado !== 'Inactivo' || e.ID === p.EmpleadoID).sort(ordenarNombre);
  const empExp = S.exp?.empleado.ID;
  const volver = empExp ? (() => verExpediente(empExp, 'permisos')) : null;
  abrirModal({
    titulo: id ? 'Editar permiso' : 'Registrar permiso o vacaciones',
    volver,
    cuerpo: `<form id="f-permiso" class="grid sm:grid-cols-2 gap-4">
      <input type="hidden" name="ID" value="${esc(p.ID || '')}">
      <div class="sm:col-span-2"><label class="etiqueta">Empleado *</label><select name="EmpleadoID" class="campo" required>${opciones(activos.map(e => ({ v: e.ID, t: `${nombreCompleto(e)} · ${e.Departamento}` })), p.EmpleadoID, 'Selecciona…')}</select></div>
      <div><label class="etiqueta">Tipo *</label><select name="Tipo" class="campo" required>${opciones(S.sesion.catalogos.tiposPermiso, p.Tipo)}</select></div>
      <div><label class="etiqueta">Estado *</label><select name="Estado" class="campo" required>${opciones(S.sesion.catalogos.estadosPermiso, p.Estado)}</select></div>
      <div><label class="etiqueta">Desde *</label><input name="FechaInicio" type="date" class="campo" required value="${esc(p.FechaInicio)}"></div>
      <div><label class="etiqueta">Hasta *</label><input name="FechaFin" type="date" class="campo" required value="${esc(p.FechaFin)}"></div>
      <div><label class="etiqueta">Días (hábiles)</label><input name="Dias" type="number" min="0" step="0.5" class="campo" value="${esc(p.Dias || '')}"><p class="text-xs text-slate-400 mt-1">Se calcula solo; puedes ajustarlo.</p></div>
      <div id="per-saldo" class="text-xs text-slate-500 self-center"></div>
      <div class="sm:col-span-2"><label class="etiqueta">Observación</label><textarea name="Observacion" rows="2" class="campo" placeholder="Ej.: Reposo según certificado médico N.º…">${esc(p.Observacion || '')}</textarea></div>
    </form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-permiso" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Guardar</button>`
  });
  const form = $('#f-permiso');
  const recalcular = (cambioFechas) => {
    const ini = form.FechaInicio.value, fin = form.FechaFin.value;
    if (cambioFechas && ini && fin && fin >= ini) {
      const lab = S.sesion.diasLaborables;
      form.Dias.value = rangoFechas(ini, fin).filter(f => lab.includes(diaSemana(f))).length;
    }
    const e = empPorId(form.EmpleadoID.value);
    const v = e ? saldoVacaciones(e) : null;
    $('#per-saldo').innerHTML = v && form.Tipo.value === 'Vacaciones' ? `Saldo actual de vacaciones: <b>${v.pendientes}</b> días pendientes.` : '';
  };
  form.FechaInicio.addEventListener('change', () => { if (form.FechaFin.value < form.FechaInicio.value) form.FechaFin.value = form.FechaInicio.value; recalcular(true); });
  form.FechaFin.addEventListener('change', () => recalcular(true));
  form.EmpleadoID.addEventListener('change', () => recalcular(false));
  form.Tipo.addEventListener('change', () => recalcular(false));
  recalcular(!id);
}

async function guardarPermiso() {
  const form = $('#f-permiso');
  if (!form.reportValidity()) return;
  const datos = datosFormulario(form);
  try {
    await api('guardarPermiso', { permiso: datos }, { texto: 'Guardando permiso…' });
    toast('Permiso guardado.', 'ok');
    await asegurarCatalogo(true); invalidarCache();
    if (S.modalVolver) verExpediente(S.exp ? S.exp.empleado.ID : datos.EmpleadoID, 'permisos');
    else cerrarModal();
    if (S.seccion === 'permisos') pintarPermisos();
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function cambiarEstadoPermiso(id, estado) {
  const p = S.permisos.find(x => x.ID === id);
  if (!p) return;
  try {
    await api('guardarPermiso', { permiso: Object.assign({}, p, { Estado: estado }) }, { texto: estado === 'Aprobado' ? 'Aprobando…' : 'Rechazando…' });
    toast(`Permiso ${estado.toLowerCase()}.`, 'ok');
    await asegurarCatalogo(true); invalidarCache(); pintarPermisos();
  } catch (e) { toast(e.message, 'error'); }
}

async function borrarPermiso(id) {
  const empExp = S.exp?.empleado.ID;
  if (!await confirmar('Se eliminará este registro de permiso. Si eran vacaciones, el saldo se recalculará.', { titulo: '¿Eliminar permiso?' })) return;
  try {
    await api('eliminarPermiso', { id }, { texto: 'Eliminando…' });
    toast('Permiso eliminado.', 'ok');
    await asegurarCatalogo(true); invalidarCache();
    if (empExp) verExpediente(empExp, 'permisos');
    if (S.seccion === 'permisos') pintarPermisos();
  } catch (e) { toast(e.message, 'error'); }
}

/* ======================= 17. EVALUACIONES ======================= */
async function cargarEvaluaciones(forzar = false) {
  try { await asegurarCatalogo(forzar); } catch (e) { return toast(e.message, 'error'); }
  pintarEvaluaciones();
}

function pintarEvaluaciones() {
  const q = $('#ev-buscar').value.trim(), dep = $('#ev-depto').value, per = $('#ev-periodo').value;
  const lista = S.evaluaciones.map(v => Object.assign({ _e: empPorId(v.EmpleadoID) || {} }, v))
    .filter(v => coincide(v._e, q) && (!dep || v._e.Departamento === dep) && (!per || v.Periodo === per))
    .sort((a, b) => a.Periodo === b.Periodo ? num(b.Promedio) - num(a.Promedio) : (a.Periodo < b.Periodo ? 1 : -1));
  $('#print-detalle').textContent = `Evaluación de desempeño${per ? ' · ' + fmtPeriodo(per) : ''} · Impreso: ${new Date().toLocaleString('es-VE')}`;

  const grupos = {};
  lista.forEach(v => { const d = v._e.Departamento || 'Sin departamento'; (grupos[d] = grupos[d] || []).push(num(v.Promedio)); });
  const dl = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es'));
  const prom = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
  grafico('ch-eval-deptos', {
    type: 'bar',
    data: { labels: dl, datasets: [{ label: 'Promedio', data: dl.map(d => +prom(grupos[d]).toFixed(1)), backgroundColor: dl.map(d => prom(grupos[d]) >= 85 ? COLORES.aTiempo : prom(grupos[d]) >= 70 ? '#2563eb' : prom(grupos[d]) >= 55 ? COLORES.tarde : COLORES.ausente), borderRadius: 6 }] },
    options: baseOpciones({ plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } } })
  });
  grafico('ch-eval-criterios', {
    type: 'radar',
    data: { labels: CRITERIOS.map(c => c.t), datasets: [{ label: 'Promedio', data: CRITERIOS.map(c => +prom(lista.map(v => num(v[c.k]))).toFixed(1)), borderColor: COLORES.aTiempo, backgroundColor: 'rgba(13,148,136,.18)', pointBackgroundColor: COLORES.aTiempo }] },
    options: baseOpciones({ plugins: { legend: { display: false } }, scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, display: false }, pointLabels: { font: { size: 10 } } } } })
  });

  renderTabla('ev-tabla', 't-evaluaciones', [
    { t: 'Empleado', v: v => `<button data-acc="ver-expediente" data-id="${esc(v.EmpleadoID)}" data-tab="evaluaciones" class="font-semibold text-slate-800 hover:text-marca-700 text-left">${esc(nombreCompleto(v._e))}</button><div class="text-xs text-slate-400">${esc(v._e.Departamento || '')}</div>`, s: v => nombreCompleto(v._e), c: v => nombreCompleto(v._e) },
    { t: 'Departamento', v: v => esc(v._e.Departamento), c: v => v._e.Departamento, cls: 'hidden' },
    { t: 'Período', v: v => `<span class="cap1">${esc(fmtPeriodo(v.Periodo))}</span>`, s: v => v.Periodo, c: v => v.Periodo },
    ...CRITERIOS.map(c => ({ t: c.t, v: v => esc(v[c.k]), s: v => num(v[c.k]), c: v => v[c.k], cls: 'text-right' })),
    { t: 'Promedio', v: v => `<b class="text-base ${colorPuntaje(num(v.Promedio))}">${esc(v.Promedio)}</b>`, s: v => num(v.Promedio), c: v => String(v.Promedio).replace('.', ','), cls: 'text-right' },
    { t: 'Comentarios', v: v => `<span class="text-xs text-slate-500">${esc(v.Comentarios)}</span>`, c: v => v.Comentarios, cls: 'envolver' },
    { t: 'Evaluador', v: v => `<span class="text-xs text-slate-400">${esc(v.Evaluador)}</span>`, c: v => v.Evaluador, cls: 'hidden' },
    { t: '', v: v => `<button data-acc="borrar-eval" data-id="${esc(v.ID)}" class="btn-fantasma btn-sm text-rose-600 no-print solo-rrhh" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`, cls: 'text-right' }
  ], lista, { vacio: 'No hay evaluaciones con estos filtros.' });
}

async function formEvaluacion(emp = null) {
  try { await asegurarCatalogo(); } catch (e) { return toast(e.message, 'error'); }
  const activos = S.empleados.filter(e => e.Estado !== 'Inactivo').sort(ordenarNombre);
  const empExp = S.exp?.empleado.ID;
  const mesAnt = rangoPreset('mes_ant')[0].slice(0, 7);
  abrirModal({
    titulo: 'Nueva evaluación de desempeño',
    volver: empExp ? (() => verExpediente(empExp, 'evaluaciones')) : null,
    cuerpo: `<form id="f-eval" class="space-y-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="etiqueta">Empleado *</label><select name="EmpleadoID" class="campo" required>${opciones(activos.map(e => ({ v: e.ID, t: `${nombreCompleto(e)} · ${e.Departamento}` })), emp || '', 'Selecciona…')}</select></div>
        <div><label class="etiqueta">Período evaluado *</label><input name="Periodo" type="month" class="campo" required value="${mesAnt}"></div>
      </div>
      <div class="tarjeta p-4 space-y-4">
        ${CRITERIOS.map(c => `<div>
          <div class="flex justify-between items-center mb-1"><label class="etiqueta mb-0">${c.t}</label>
            <div class="flex items-center gap-2">${c.k === 'Puntualidad' ? '<button type="button" data-acc="calc-puntualidad" class="text-xs font-semibold text-marca-700 hover:underline">Calcular desde asistencia</button>' : ''}
            <input name="${c.k}" type="number" min="0" max="100" required class="campo w-20 py-1.5 text-right font-bold" value="80" data-criterio></div></div>
          <input type="range" min="0" max="100" value="80" class="w-full accent-teal-700" data-rango="${c.k}"></div>`).join('')}
        <div class="flex justify-between items-center pt-3 border-t border-slate-100"><span class="text-sm font-semibold">Promedio</span><span id="ev-prom" class="text-2xl font-extrabold text-marca-700">80</span></div>
      </div>
      <div><label class="etiqueta">Comentarios y plan de mejora</label><textarea name="Comentarios" rows="3" class="campo" placeholder="Fortalezas, oportunidades de mejora, compromisos…"></textarea></div>
    </form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-eval" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Guardar evaluación</button>`
  });
  const form = $('#f-eval');
  const promedio = () => {
    const vals = CRITERIOS.map(c => num(form[c.k].value));
    const p = vals.reduce((s, x) => s + x, 0) / vals.length;
    $('#ev-prom').textContent = fmtNum(p);
    $('#ev-prom').className = `text-2xl font-extrabold ${colorPuntaje(p)}`;
  };
  $$('[data-rango]', form).forEach(r => r.addEventListener('input', () => { form[r.dataset.rango].value = r.value; promedio(); }));
  $$('[data-criterio]', form).forEach(i => i.addEventListener('input', () => { const r = $(`[data-rango="${i.name}"]`, form); r.value = i.value; promedio(); }));
}

async function calcularPuntualidad() {
  const form = $('#f-eval');
  const id = form.EmpleadoID.value, per = form.Periodo.value;
  if (!id || !per) return toast('Selecciona el empleado y el período primero.', 'aviso');
  const [y, m] = per.split('-').map(Number);
  const desde = `${per}-01`, hasta = fechaStr(new Date(y, m, 0));
  try {
    const d = await api('datosPeriodo', { desde, hasta }, { texto: 'Calculando puntualidad…' });
    const e = d.empleados.find(x => x.ID === id);
    const r = calcularKPIs([e], d.asistencia, d.permisos, [], desde, hasta).filas[0];
    if (!r.asistidos) return toast('No hay marcajes de este empleado en ese período.', 'aviso');
    const valor = Math.round(r.pctPuntualidad * 0.7 + (r.pctAsistencia ?? 100) * 0.3);
    form.Puntualidad.value = valor;
    $('[data-rango="Puntualidad"]', form).value = valor;
    form.Puntualidad.dispatchEvent(new Event('input'));
    toast(`Puntualidad ${fmtPct(r.pctPuntualidad)} · Asistencia ${fmtPct(r.pctAsistencia)} → puntaje ${valor} (70% puntualidad + 30% asistencia).`, 'info', 7000);
  } catch (e) { toast(e.message, 'error'); }
}

async function guardarEvaluacion() {
  const form = $('#f-eval');
  if (!form.reportValidity()) return;
  const datos = datosFormulario(form);
  try {
    await api('guardarEvaluacion', { evaluacion: datos }, { texto: 'Guardando evaluación…' });
    toast('Evaluación guardada.', 'ok');
    await asegurarCatalogo(true); invalidarCache();
    if (S.modalVolver) verExpediente(S.exp ? S.exp.empleado.ID : datos.EmpleadoID, 'evaluaciones');
    else cerrarModal();
    if (S.seccion === 'evaluaciones') pintarEvaluaciones();
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function borrarEvaluacion(id) {
  const empExp = S.exp?.empleado.ID;
  if (!await confirmar('Se eliminará esta evaluación de forma permanente.', { titulo: '¿Eliminar evaluación?' })) return;
  try {
    await api('eliminarEvaluacion', { id }, { texto: 'Eliminando…' });
    toast('Evaluación eliminada.', 'ok');
    await asegurarCatalogo(true); invalidarCache();
    if (empExp) verExpediente(empExp, 'evaluaciones');
    if (S.seccion === 'evaluaciones') pintarEvaluaciones();
  } catch (e) { toast(e.message, 'error'); }
}

/* ======================= 18. IMPRESIÓN ======================= */
function imprimir() { setTimeout(() => window.print(), 50); }
function imprimirModal() {
  document.body.classList.add('print-modal');
  const quitar = () => { document.body.classList.remove('print-modal'); window.removeEventListener('afterprint', quitar); };
  window.addEventListener('afterprint', quitar);
  setTimeout(() => { window.print(); setTimeout(quitar, 1500); }, 50);
}

/* ======================= 19. EVENTOS ======================= */
const ACC = {
  'nav': d => navegar(d.sec),
  'salir': () => cerrarSesion(),
  'ir-panel': () => mostrarAdmin(),
  'marcar': d => marcar(d.tipo),
  'verificar-ubicacion': () => verificarUbicacion(false),
  'cerrar-modal': () => cerrarModal(),
  'cancelar-modal': () => cancelarModal(),
  'ordenar': d => ordenarTabla(d.tabla, d.col),
  'exportar': d => exportarTabla(d.tabla, d.nombre),
  'imprimir': () => imprimir(),
  'imprimir-modal': () => imprimirModal(),
  'nuevo-empleado': () => formEmpleado(),
  'editar-empleado': d => formEmpleado(d.id),
  'guardar-empleado': () => guardarEmpleado(),
  'ver-expediente': d => verExpediente(d.id, d.tab || 'datos'),
  'exp-tab': d => pintarExpTab(d.tab),
  'subir-doc': d => subirDocumento(d.id),
  'ver-doc': d => verDocumento(d.id),
  'borrar-doc': d => borrarDocumento(d.id),
  'nuevo-permiso': d => formPermiso({ emp: d.emp || null }),
  'editar-permiso': d => formPermiso({ id: d.id }),
  'guardar-permiso': () => guardarPermiso(),
  'estado-permiso': d => cambiarEstadoPermiso(d.id, d.estado),
  'borrar-permiso': d => borrarPermiso(d.id),
  'nueva-eval': d => formEvaluacion(d.emp || null),
  'calc-puntualidad': () => calcularPuntualidad(),
  'guardar-eval': () => guardarEvaluacion(),
  'borrar-eval': d => borrarEvaluacion(d.id),
  'marcaje-manual': d => formMarcajeManual(d.id || null),
  'guardar-manual': () => guardarManual(),
  'borrar-asis': d => borrarAsistencia(d.id)
};

function prepararUI() {
  $('#anio').textContent = new Date().getFullYear();
  construirNavegacion();
  prepararFiltro('dash', 'semana', forzar => cargarDashboard(forzar));
  prepararFiltro('asis', 'hoy', forzar => cargarAsistencia(forzar));
  let t1, t2, t3;
  $('#emp-buscar').addEventListener('input', () => { clearTimeout(t1); t1 = setTimeout(pintarEmpleados, 200); });
  ['#emp-depto', '#emp-estado'].forEach(s => $(s).addEventListener('change', pintarEmpleados));
  $('#per-buscar').addEventListener('input', () => { clearTimeout(t2); t2 = setTimeout(pintarPermisos, 200); });
  ['#per-depto', '#per-tipo', '#per-estado'].forEach(s => $(s).addEventListener('change', pintarPermisos));
  $('#ev-buscar').addEventListener('input', () => { clearTimeout(t3); t3 = setTimeout(pintarEvaluaciones, 200); });
  ['#ev-depto', '#ev-periodo'].forEach(s => $(s).addEventListener('change', pintarEvaluaciones));

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-acc]');
    if (!b || b.disabled) return;
    const fn = ACC[b.dataset.acc];
    if (!fn) return;
    ev.preventDefault();
    fn(b.dataset, b);
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !$('#modal').classList.contains('hidden') && !document.querySelector('.confirmacion')) cancelarModal();
  });
  if (window.Chart) {
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.color = '#64748b';
    Chart.defaults.borderColor = '#e2e8f0';
  }
  iconos();
}

/* ======================= 20. ARRANQUE ======================= */
document.addEventListener('DOMContentLoaded', () => {
  prepararUI();
  if (!configValida()) {
    mostrarLogin('⚙️ Configuración pendiente: escribe API_URL y GOOGLE_CLIENT_ID al inicio del archivo app.js.');
    return;
  }
  iniciarGoogle();
  let guardado = null;
  try { guardado = sessionStorage.getItem('aa_token'); } catch (e) { /* nada */ }
  if (guardado && tokenVigente(guardado)) { S.token = guardado; cargarSesion(); }
  else mostrarLogin();
});
