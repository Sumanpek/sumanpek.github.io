/**
 * ==========================================================================
 *  APPS ANABEL · Frontend · Sumanpek, C.A.  (v2.0.1 — Fase 2)
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

const VERSION = '2.0.1';

/* ============================== 2. ESTADO ============================== */
const S = {
  solicitudes: [],
  audio: null,
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

// Interfaz: principal #C10866 · secundario #031263 · apoyo #EECF15 (solo botones, menús y textos).
// Gráficos: paleta "Taller de sublimación", 16 tonos pastel y vivos, independiente de la interfaz.
const PALETA = {
  lavanda: '#9883E5', aguamarina: '#50C9CE', chicle: '#F2A0B6', cielo: '#72A1E5', mostaza: '#F2C46D',
  salvia: '#8CC7A1', terracota: '#B26E63', malva: '#7B6B90', durazno: '#F4A97F', cobalto: '#385AB6',
  olivo: '#CEC075', coral: '#E57A8C', liquen: '#9DA9A0', berenjena: '#533961', algodon: '#FCD3DE', tinta: '#2E382E',
  niebla: '#B4C2D0'
};
const COLORES = {
  marca: '#C10866', navy: '#031263', oro: '#EECF15',                  // solo para el confeti (identidad)
  aTiempo: PALETA.aguamarina, tarde: PALETA.mostaza, ausente: PALETA.coral, justificado: PALETA.niebla,
  extra: PALETA.cielo, retraso: PALETA.terracota,
  bueno: PALETA.aguamarina, medio: PALETA.mostaza, bajo: PALETA.coral,
  serie: [PALETA.lavanda, PALETA.aguamarina, PALETA.chicle, PALETA.cielo, PALETA.mostaza, PALETA.salvia, PALETA.terracota,
    PALETA.malva, PALETA.durazno, PALETA.cobalto, PALETA.olivo, PALETA.coral, PALETA.liquen, PALETA.berenjena, PALETA.algodon, PALETA.tinta]
};
const colorSerie = i => COLORES.serie[i % COLORES.serie.length];
const conAlfa = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

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
  'Referencias', 'Evaluación firmada', 'Carta de renuncia / despido', 'Soporte de marcaje', 'Otro'];

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS_SEMANA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const TIPO_OTRO = 'Otro (justifique)';
const vacioOpc = t => ({ v: '', t });
const OPC = {
  sangre: [vacioOpc('—'), 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'No sabe'],
  civil: [vacioOpc('—'), 'Soltero(a)', 'Casado(a)', 'Unión estable de hecho', 'Divorciado(a)', 'Viudo(a)'],
  instruccion: [vacioOpc('—'), 'Primaria', 'Bachiller', 'Técnico medio', 'TSU', 'Universitario', 'Postgrado'],
  camisa: [vacioOpc('—'), 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
};

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
const esMovil = () => window.matchMedia('(max-width: 1023px)').matches;
/** Cuántas veces cae un día de la semana (1=lun … 7=dom) en el mes de una fecha. */
const diasEnMes = (fecha, dia) => { const d = aFecha(fecha); const ult = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); let n = 0; for (let i = 1; i <= ult; i++) { const x = new Date(d.getFullYear(), d.getMonth(), i).getDay(); if ((x === 0 ? 7 : x) === dia) n++; } return n; };
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

function dialogo({ titulo = 'Confirmar', mensaje = '', boton = 'Aceptar', peligro = false, conTexto = false, placeholder = '' } = {}) {
  return new Promise(resolve => {
    const capa = document.createElement('div');
    capa.className = 'confirmacion fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/50';
    capa.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h4 class="font-bold text-lg mb-2">${esc(titulo)}</h4>
        <p class="text-sm text-slate-600 ${conTexto ? 'mb-3' : 'mb-6'}">${esc(mensaje)}</p>
        ${conTexto ? `<textarea rows="3" class="campo mb-5" placeholder="${esc(placeholder)}"></textarea>` : ''}
        <div class="flex justify-end gap-2">
          <button class="btn-sec" data-r="0">Cancelar</button>
          <button class="${peligro ? 'btn-peligro' : 'btn-primario'}" data-r="1">${esc(boton)}</button>
        </div></div>`;
    capa.addEventListener('click', ev => {
      const b = ev.target.closest('[data-r]');
      if (!b) return;
      ev.stopPropagation();
      const texto = conTexto ? capa.querySelector('textarea').value.trim() : '';
      if (b.dataset.r === '1' && conTexto && !texto) { capa.querySelector('textarea').focus(); return; }
      capa.remove();
      resolve(b.dataset.r === '1' ? (conTexto ? texto : true) : (conTexto ? null : false));
    });
    document.body.appendChild(capa);
    if (conTexto) setTimeout(() => capa.querySelector('textarea').focus(), 50);
  });
}
const confirmar = (mensaje, { titulo = 'Confirmar', boton = 'Eliminar', peligro = true } = {}) => dialogo({ titulo, mensaje, boton, peligro });

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
    Aprobado: 'bg-emerald-100 text-emerald-700', Pendiente: 'bg-amber-100 text-amber-700', Rechazado: 'bg-rose-100 text-rose-700',
    Aprobada: 'bg-emerald-100 text-emerald-700', Rechazada: 'bg-rose-100 text-rose-700'
  }[estado] || 'bg-slate-100 text-slate-600';
  return `<span class="insignia ${c}">${esc(estado || '—')}</span>`;
}

function colorPuntaje(v) {
  if (v === null || v === undefined || !isFinite(v)) return 'text-slate-400';
  return v >= 85 ? 'text-emerald-600' : v >= 70 ? 'text-navy-600' : v >= 55 ? 'text-amber-600' : 'text-rose-600';
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

/* ---------- Rutas: #/asistencia (marcaje) y #/gestion/<sección> ---------- */
function rutaHash() {
  const [a = '', b = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { a, b };
}
function fijarHash(h) { if (location.hash !== h) history.replaceState(null, '', h); }
function entrarSegunRuta() {
  const r = rutaHash();
  if (!esGestion() || r.a === 'asistencia') return mostrarMarcaje();
  if (r.a === 'gestion') { if (r.b) S.seccion = r.b; return mostrarAdmin(); }
  return esMovil() ? mostrarMarcaje() : mostrarAdmin();   // en el celular, directivos entran al marcaje
}

async function cargarSesion() {
  try {
    S.sesion = await api('sesion', {}, { texto: 'Iniciando sesión…' });
    entrarSegunRuta();
    if (esRRHH() && String(S.sesion.version || '1').split('.').slice(0, 2).join('.') !== VERSION.split('.').slice(0, 2).join('.')) {
      toast(`El servidor está en la versión ${S.sesion.version || '1.x'} y la página en la ${VERSION}. En Apps Script: Implementar → Gestionar implementaciones → ✏️ → Nueva versión.`, 'aviso', 15000);
    }
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
  fijarHash('#/asistencia');
  $('#mc-nombre').textContent = s.nombre;
  $('#mc-cargo').textContent = [s.cargo, s.departamento].filter(Boolean).join(' · ') || s.email;
  $('#mc-avatar').textContent = iniciales(s.nombre);
  $('#mc-volver').classList.toggle('hidden', !esGestion());
  $('#mc-horario').textContent = `${s.horario.entrada} – ${s.horario.salida} · sáb. hasta ${s.horario.salidaSabado}`;
  $('#mc-dias-max').textContent = s.diasMaxManual;
  $('#mc-solicitar').classList.toggle('hidden', !s.empleadoId);
  pintarEstadoMarcaje();
  pintarCumple();
  iniciarReloj();
  cargarHistorial();
  cargarMisSolicitudes();
  if (s.empleadoId) verificarUbicacion(true);
  iconos();
}

/* ---------- Cumpleaños: confeti + fanfarria ---------- */
function pintarCumple() {
  const s = S.sesion, el = $('#mc-cumple');
  const otros = (s.cumpleanerosHoy || []).filter(c => c.id !== s.empleadoId);
  let html = '';
  if (s.cumpleanos) {
    html += `<div class="tarjeta p-5 text-center shadow-lg border-oro-300 bg-gradient-to-br from-oro-50 via-white to-marca-50">
      <p class="text-4xl mb-1">🎂</p>
      <p class="text-xl font-extrabold text-marca-700">¡Feliz cumpleaños, ${esc(String(s.nombre).split(' ')[0])}!</p>
      <p class="text-sm text-slate-600 mt-1">Todo el equipo de Sumanpek te desea un día extraordinario.</p>
      <button data-acc="celebrar" class="btn btn-sm mt-3 bg-navy-900 text-white hover:bg-navy-950">🎉 ¡Celebrar!</button></div>`;
  }
  if (otros.length) {
    html += `<div class="tarjeta px-4 py-3 flex items-center gap-3 bg-oro-50 border-oro-200">
      <span class="text-2xl">🎈</span><p class="text-sm text-slate-700">Hoy ${otros.length === 1 ? 'cumple' : 'cumplen'} años: <b>${otros.map(o => esc(o.nombre)).join(', ')}</b>. ¡Felicítalos!</p></div>`;
  }
  el.innerHTML = html;
  el.className = html ? 'space-y-3' : 'hidden';
  let celebrado = false;
  try { celebrado = sessionStorage.getItem('aa_cumple') === s.hoy; sessionStorage.setItem('aa_cumple', s.hoy); } catch (e) { /* nada */ }
  if (s.cumpleanos && !celebrado) setTimeout(() => celebrar(), 700);
}

function celebrar() { lanzarConfeti(); fanfarria(); }

function lanzarConfeti(ms = 4500) {
  const cv = $('#confeti'), ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
  const colores = [COLORES.marca, COLORES.navy, COLORES.oro, '#e66aa3', '#5468c4'];
  const ps = Array.from({ length: 170 }, (_, i) => ({
    x: Math.random() * W, y: -Math.random() * H * 0.6, w: (6 + Math.random() * 7) * dpr, h: (9 + Math.random() * 9) * dpr,
    vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 3) * dpr, r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.3, c: colores[i % colores.length]
  }));
  const t0 = performance.now();
  (function paso(t) {
    ctx.clearRect(0, 0, W, H);
    ps.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.04 * dpr; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r))); ctx.restore();
    });
    if (t - t0 < ms) requestAnimationFrame(paso); else ctx.clearRect(0, 0, W, H);
  })(t0);
}

/** Fanfarria corta sintetizada con Web Audio (sin archivos de sonido). */
function fanfarria() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = S.audio || (S.audio = new AC());
    if (ac.state === 'suspended') ac.resume();
    const t0 = ac.currentTime + 0.05;
    const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, D5 = 587.33;
    const notas = [[C5, 0, 0.13], [C5, 0.15, 0.13], [C5, 0.3, 0.13], [E5, 0.45, 0.35], [D5, 0.85, 0.13], [E5, 1.0, 0.13],
      [C5, 1.2, 1.1], [E5, 1.2, 1.1], [G5, 1.2, 1.1], [C6, 1.2, 1.1]];
    notas.forEach(([f, ini, dur]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + ini);
      g.gain.linearRampToValueAtTime(0.16, t0 + ini + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ini + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0 + ini); o.stop(t0 + ini + dur + 0.05);
    });
  } catch (e) { /* sin audio */ }
}

/* ---------- Solicitudes de marcaje manual (empleado) ---------- */
async function comprimirImagen(file, max = 1600, calidad = 0.82) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    if (k === 1 && file.size < 1.5e6) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', calidad));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) { return file; } finally { URL.revokeObjectURL(url); }
}

async function archivoParaEnviar(file) {
  if (!file) return null;
  const f = await comprimirImagen(file);
  const maxMB = num(S.sesion.tamanoMaxMB) || 10;
  if (f.size > maxMB * 1024 * 1024) throw new Error(`El archivo pesa ${fmtTamano(f.size)}. El máximo es ${maxMB} MB.`);
  return { nombre: f.name, mimeType: f.type || 'application/octet-stream', base64: await leerBase64(f) };
}

function camposMarcajeHTML({ conModo = true, min = '', fecha = '', entrada = '', salida = '', justificativo = '', detalle = '', etiquetaDetalle = 'Detalle' } = {}) {
  const radio = (v, t, chk) => `<label class="cursor-pointer"><input type="radio" name="modo" value="${v}" class="peer sr-only" ${chk ? 'checked' : ''}>
    <span class="block text-center rounded-xl border border-slate-300 px-2 py-2.5 text-xs font-semibold text-slate-600 peer-checked:bg-navy-900 peer-checked:text-white peer-checked:border-navy-900">${t}</span></label>`;
  return `
    <div><label class="etiqueta">Fecha *</label><input name="fecha" type="date" class="campo" required ${min ? `min="${min}"` : ''} max="${hoyStr()}" value="${esc(fecha)}">
      ${min ? `<p class="text-xs text-slate-400 mt-1">Puedes elegir desde el ${fmtFecha(min)} hasta hoy.</p>` : ''}</div>
    ${conModo ? `<div><label class="etiqueta">¿Qué necesitas registrar? *</label><div class="grid grid-cols-3 gap-2">
      ${radio('ambos', 'Entrada y salida', true)}${radio('entrada', 'Solo entrada', false)}${radio('salida', 'Solo salida', false)}</div></div>` : ''}
    <div class="grid grid-cols-2 gap-3">
      <div data-campo="entrada"><label class="etiqueta">Hora de entrada *</label><input name="entrada" type="time" class="campo" value="${esc(entrada)}"></div>
      <div data-campo="salida"><label class="etiqueta">Hora de salida${conModo ? ' *' : ''}</label><input name="salida" type="time" class="campo" value="${esc(salida)}"></div>
    </div>
    <div><label class="etiqueta">Justificativo *</label><select name="justificativo" class="campo" required>${opciones(S.sesion.justificativos, justificativo, 'Selecciona…')}</select></div>
    <div><label class="etiqueta">${esc(etiquetaDetalle)}</label><textarea name="detalle" rows="2" maxlength="500" class="campo" placeholder="Ej.: Estuve haciendo una instalación en el cliente desde las 8:00.">${esc(detalle)}</textarea></div>
    <div><label class="etiqueta">Soporte (opcional): foto o PDF</label>
      <input name="archivo" type="file" accept="image/*,application/pdf" class="campo file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:px-3 file:py-1 file:text-marca-700 file:font-semibold">
      <p class="text-xs text-slate-400 mt-1">Puedes tomar una foto con la cámara. Las fotos se reducen automáticamente.</p></div>`;
}

function formSolicitud() {
  const s = S.sesion, hoy = hoyStr(), min = sumarDias(hoy, -s.diasMaxManual);
  abrirModal({
    titulo: 'Solicitar marcaje manual',
    cuerpo: `<form id="f-solicitud" class="space-y-4">${camposMarcajeHTML({ min, fecha: sumarDias(hoy, -1) })}
      <p class="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">Tu solicitud quedará <b>pendiente</b> hasta que Recursos Humanos la apruebe. Solo se aceptan fechas y horas pasadas.</p></form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="enviar-solicitud" class="btn-primario"><i data-lucide="send" class="w-4 h-4"></i>Enviar solicitud</button>`
  });
  const form = $('#f-solicitud');
  const modo = () => {
    const m = form.querySelector('[name=modo]:checked').value;
    $('[data-campo=entrada]', form).classList.toggle('hidden', m === 'salida');
    $('[data-campo=salida]', form).classList.toggle('hidden', m === 'entrada');
    form.entrada.required = m !== 'salida';
    form.salida.required = m !== 'entrada';
  };
  $$('[name=modo]', form).forEach(r => r.addEventListener('change', modo));
  modo();
}

async function enviarSolicitud() {
  const form = $('#f-solicitud');
  if (!form.reportValidity()) return;
  const m = form.querySelector('[name=modo]:checked').value;
  const d = { fecha: form.fecha.value, justificativo: form.justificativo.value, detalle: form.detalle.value.trim(),
    entrada: m !== 'salida' ? form.entrada.value : '', salida: m !== 'entrada' ? form.salida.value : '' };
  const ahora = new Date(), minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  if (d.fecha === hoyStr() && [d.entrada, d.salida].some(h => h && minutos(h) > minAhora)) return toast('Solo puedes registrar horas que ya pasaron.', 'aviso');
  if (d.entrada && d.salida && minutos(d.salida) <= minutos(d.entrada)) return toast('La salida debe ser posterior a la entrada.', 'aviso');
  try {
    cargando(true, 'Preparando soporte…');
    try { d.archivo = await archivoParaEnviar(form.archivo.files[0]); } finally { cargando(false); }
    await api('solicitarMarcaje', d, { texto: 'Enviando solicitud…' });
    toast('Solicitud enviada. RRHH la revisará pronto.', 'ok', 6000);
    cerrarModal();
    invalidarCache();
    if (esGestion()) S.sesion.solicitudesPendientes = (S.sesion.solicitudesPendientes || 0) + 1;
    cargarMisSolicitudes();
  } catch (e) { toast(e.message, 'error', 7000); }
}

async function cargarMisSolicitudes() {
  if (!S.sesion?.empleadoId) { $('#mc-solicitudes-tarjeta').classList.add('hidden'); return; }
  try {
    const l = await api('misSolicitudes', {}, { silencioso: true });
    $('#mc-solicitudes-tarjeta').classList.toggle('hidden', !l.length);
    $('#mc-solicitudes').innerHTML = l.map(x => `
      <div class="px-5 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold cap1">${esc(fmtFechaCorta(x.Fecha))}</p>
            <p class="text-xs text-slate-500">${x.Entrada ? fmtHora(x.Entrada) : '—'} → ${x.Salida ? fmtHora(x.Salida) : '—'} · ${esc(x.Justificativo)}${x.TieneSoporte ? ' · 📎' : ''}</p>
          </div>
          ${insigniaEstado(x.Estado)}
        </div>
        ${x.ComentarioRevision ? `<p class="text-xs mt-1.5 rounded-lg px-2.5 py-1.5 ${x.Estado === 'Rechazada' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}">RRHH: ${esc(x.ComentarioRevision)}</p>` : ''}
      </div>`).join('');
  } catch (e) { /* silencioso */ }
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
          <p class="text-xs text-slate-500">${fmtHora(a.Entrada)} → ${fmtHora(a.Salida)}${a.MinTrabajados ? ' · ' + fmtMin(a.MinTrabajados) : ''}${a.Origen && a.Origen !== 'GPS' ? ' · ' + esc(a.Justificativo || 'manual') : ''}</p>
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
  invalidarCache();
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
  actualizarInsignia(s.solicitudesPendientes || 0);
  navegar(S.seccion === 'mi-marcaje' ? 'dashboard' : S.seccion);
}

function construirNavegacion() {
  $('#nav-lateral').innerHTML = SECCIONES.map(s =>
    `<button data-acc="nav" data-sec="${s.id}" class="nav-item"><i data-lucide="${s.icono}" class="w-5 h-5"></i>${s.titulo}${s.id === 'asistencia' ? '<span data-insignia class="hidden ml-auto insignia bg-oro-400 text-navy-950">0</span>' : ''}</button>`).join('');
  $('#nav-movil-items').innerHTML = SECCIONES.map(s =>
    `<button data-acc="nav" data-sec="${s.id}" class="nav-movil"><i data-lucide="${s.icono}" class="w-4 h-4"></i>${s.titulo}${s.id === 'asistencia' ? '<span data-insignia class="hidden insignia bg-oro-400 text-navy-950">0</span>' : ''}</button>`).join('');
}

function actualizarInsignia(n) {
  $$('[data-insignia]').forEach(b => { b.textContent = n; b.classList.toggle('hidden', !n); });
}

function navegar(sec) {
  if (sec === 'mi-marcaje') { S.seccion = 'mi-marcaje'; mostrarMarcaje(); return; }
  if (!$('#s-' + sec)) sec = 'dashboard';
  S.seccion = sec;
  fijarHash('#/gestion/' + sec);
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
  const vencido = !c || Date.now() - c.t > 60000;   // los datos se renuevan solos después de 1 minuto
  if (forzar || vencido || c.desde !== f.desde || c.hasta !== f.hasta) {
    const d = await api('datosPeriodo', { desde: f.desde, hasta: f.hasta }, { texto: 'Consultando datos…' });
    S.empleados = d.empleados; S.permisos = d.permisos; S.evaluaciones = d.evaluaciones;
    S.solicitudes = d.solicitudes || [];
    actualizarInsignia(S.solicitudes.filter(x => x.Estado === 'Pendiente').length);
    S.catalogoListo = true;
    S.periodos[p] = { desde: f.desde, hasta: f.hasta, asistencia: d.asistencia, t: Date.now() };
  }
  return { f, asistencia: S.periodos[p].asistencia };
}

async function asegurarCatalogo(forzar = false) {
  if (!forzar && S.catalogoListo) return;
  const h = hoyStr();
  const d = await api('datosPeriodo', { desde: h, hasta: h }, { texto: 'Cargando…' });
  S.empleados = d.empleados; S.permisos = d.permisos; S.evaluaciones = d.evaluaciones;
  S.solicitudes = d.solicitudes || [];
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
  const semanal = activos.reduce((s, e) => s + num(e.SalarioSemanal), 0);
  const diaPago = S.sesion.diaPago || 6;
  const semanasMes = diasEnMes(f.hasta, diaPago);
  const nomina = semanal * semanasMes;
  const nombreMes = aFecha(f.hasta).toLocaleDateString('es-VE', { month: 'long' });
  const empsRot = S.empleados.filter(e => (!f.depto || e.Departamento === f.depto) && coincide(e, f.q));
  const rot = rotacion(empsRot, f.desde, f.hasta);

  $('#dash-subtitulo').textContent = `${textoPeriodo(f)}${f.depto ? ' · ' + f.depto : ''}${f.q ? ' · “' + f.q + '”' : ''}`;
  $('#print-detalle').textContent = 'Dashboard gerencial · ' + $('#dash-subtitulo').textContent + ' · Impreso: ' + new Date().toLocaleString('es-VE');

  $('#dash-kpis').innerHTML = [
    tarjetaKPI('users', 'Personal activo', activos.length, `${ausentesHoy} de vacaciones/permiso hoy`, 'marca'),
    tarjetaKPI('user-check', 'Asistencia', fmtPct(t.pctAsistencia), `${t.asistidosLab} de ${Math.max(0, t.esperados - t.justificados)} jornadas esperadas`, 'verde'),
    tarjetaKPI('timer', 'Puntualidad', fmtPct(t.pctPuntualidad), `${t.tardes} llegada${t.tardes === 1 ? '' : 's'} tarde · ${fmtMin(t.minRetraso)}`, 'ambar'),
    tarjetaKPI('user-x', 'Ausencias injustificadas', t.ausencias, `${t.justificados} justificadas${t.pendientes ? ` · ${t.pendientes} sin marcar aún hoy` : ''}`, 'rosa'),
    tarjetaKPI('hourglass', 'Horas extra (netas)', fmtHoras(t.minExtra), `${t.conExtra} empleado${t.conExtra === 1 ? '' : 's'} · ${fmtHoras(t.minRetraso)} de retraso acumulado`, 'violeta'),
    tarjetaKPI('clock', 'Horas trabajadas', fmtHoras(t.minTrabajados), `${t.asistidos ? fmtHoras(t.minTrabajados / t.asistidos) : '0 h'} promedio por jornada${t.sinSalida ? ` · ${t.sinSalida} sin salida` : ''}`, 'azul'),
    tarjetaKPI('wallet', `Nómina estimada · ${nombreMes}`, fmtDinero(nomina), `${semanasMes} ${DIAS_SEMANA[diaPago]} × ${fmtDinero(semanal)} semanales`, 'gris'),
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
        { label: 'A tiempo', data: ser.series.map(s => s.aTiempo), backgroundColor: COLORES.aTiempo, borderRadius: 6, borderSkipped: false, stack: 'a' },
        { label: 'Tarde', data: ser.series.map(s => s.tarde), backgroundColor: COLORES.tarde, borderRadius: 6, borderSkipped: false, stack: 'a' },
        { label: 'Justificado', data: ser.series.map(s => s.justificado), backgroundColor: COLORES.justificado, borderRadius: 6, borderSkipped: false, stack: 'a' },
        { label: 'Ausente', data: ser.series.map(s => s.ausente), backgroundColor: COLORES.ausente, borderRadius: 6, borderSkipped: false, stack: 'a' }
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
    data: { labels: dl, datasets: [{ data: dl.map(d => dist[d]), backgroundColor: dl.map((_, i) => colorSerie(i)), borderWidth: 3, borderColor: '#fff', hoverOffset: 10, borderRadius: 6 }] },
    options: baseOpciones({ cutout: '62%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } } } })
  });

  const pd = k.porDepto.filter(d => d.n > 0);
  grafico('ch-puntualidad', {
    type: 'bar',
    data: { labels: pd.map(d => d.depto), datasets: [{ label: 'Puntualidad %', data: pd.map(d => d.pctPuntualidad === null ? 0 : Math.round(d.pctPuntualidad)), backgroundColor: pd.map((d, i) => colorSerie(i)), borderRadius: 8, borderSkipped: false }] },
    options: baseOpciones({ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } }, y: { grid: { display: false } } } })
  });
  grafico('ch-extras', {
    type: 'bar',
    data: { labels: pd.map(d => d.depto), datasets: [
      { label: 'Horas extra (netas)', data: pd.map(d => +(d.minExtra / 60).toFixed(1)), backgroundColor: COLORES.extra, borderRadius: 8, borderSkipped: false },
      { label: 'Horas de retraso', data: pd.map(d => +(d.minRetraso / 60).toFixed(1)), backgroundColor: COLORES.retraso, borderRadius: 8, borderSkipped: false }
    ] },
    options: baseOpciones({ scales: { x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0, font: { size: 10 } } }, y: { beginAtZero: true, ticks: { callback: v => v + ' h' } } } })
  });

  pintarAlertas(f.depto, f.q);
  pintarManualesDashboard(asistencia, new Set(emps.map(e => e.ID)));

  renderTabla('dash-tabla-deptos', 't-dash-deptos', [
    { t: 'Departamento', v: d => `<b>${esc(d.depto)}</b>`, s: d => d.depto, c: d => d.depto },
    { t: 'Empleados', v: d => d.n, s: d => d.n, c: d => d.n, cls: 'text-right' },
    { t: 'Asistencia', v: d => `<span class="${colorPuntaje(d.pctAsistencia)} font-semibold">${fmtPct(d.pctAsistencia)}</span>`, s: d => d.pctAsistencia, c: d => pctCSV(d.pctAsistencia), cls: 'text-right' },
    { t: 'Puntualidad', v: d => `<span class="${colorPuntaje(d.pctPuntualidad)} font-semibold">${fmtPct(d.pctPuntualidad)}</span>`, s: d => d.pctPuntualidad, c: d => pctCSV(d.pctPuntualidad), cls: 'text-right' },
    { t: 'Retrasos', v: d => d.tardes, s: d => d.tardes, c: d => d.tardes, cls: 'text-right' },
    { t: 'Horas retraso', v: d => d.minRetraso ? `<span class="text-marca-700 font-semibold">${fmtHoras(d.minRetraso)}</span>` : '—', s: d => d.minRetraso, c: d => hCSV(d.minRetraso), cls: 'text-right' },
    { t: 'Ausencias', v: d => d.ausencias, s: d => d.ausencias, c: d => d.ausencias, cls: 'text-right' },
    { t: 'Justificadas', v: d => d.justificados, s: d => d.justificados, c: d => d.justificados, cls: 'text-right' },
    { t: 'Horas trabajadas', v: d => fmtHoras(d.minTrabajados), s: d => d.minTrabajados, c: d => hCSV(d.minTrabajados), cls: 'text-right' },
    { t: 'Horas extra', v: d => d.minExtra ? `<span class="text-navy-700 font-semibold">${fmtHoras(d.minExtra)}</span>` : '—', s: d => d.minExtra, c: d => hCSV(d.minExtra), cls: 'text-right' },
    { t: 'Desempeño', v: d => `<span class="${colorPuntaje(d.evalProm)} font-semibold">${d.evalProm === null ? '—' : fmtNum(d.evalProm)}</span>`, s: d => d.evalProm, c: d => d.evalProm === null ? '' : d.evalProm.toFixed(1).replace('.', ','), cls: 'text-right' }
  ], k.porDepto, { vacio: 'No hay empleados para estos filtros.' });

  renderTabla('dash-tabla-emp', 't-dash-emp', [
    { t: 'Empleado', v: r => `<button data-acc="ver-expediente" data-id="${esc(r.e.ID)}" class="font-semibold text-navy-900 hover:text-marca-700 text-left">${esc(nombreCompleto(r.e))}</button><div class="text-xs text-slate-400">${esc(r.e.Cargo || '')}</div>`, s: r => nombreCompleto(r.e), c: r => nombreCompleto(r.e) },
    { t: 'Cédula', v: r => esc(r.e.Cedula), c: r => r.e.Cedula },
    { t: 'Departamento', v: r => esc(r.e.Departamento), s: r => r.e.Departamento, c: r => r.e.Departamento },
    { t: 'Jornadas', v: r => r.esperados, s: r => r.esperados, c: r => r.esperados, cls: 'text-right' },
    { t: 'Asistidas', v: r => r.asistidos, s: r => r.asistidos, c: r => r.asistidos, cls: 'text-right' },
    { t: 'Ausencias', v: r => r.ausencias ? `<span class="text-rose-600 font-semibold" title="${esc(r.fechasAusente.map(fmtFecha).join(', '))}">${r.ausencias}</span>` : '0', s: r => r.ausencias, c: r => r.ausencias, cls: 'text-right' },
    { t: 'Justif.', v: r => r.justificados, s: r => r.justificados, c: r => r.justificados, cls: 'text-right' },
    { t: 'Retrasos', v: r => r.tardes ? `<span class="text-amber-600 font-semibold">${r.tardes}</span> <span class="text-xs text-slate-400">(${fmtMin(r.minRetraso)})</span>` : '0', s: r => r.minRetraso, c: r => r.tardes, cls: 'text-right whitespace-nowrap' },
    { t: 'Horas retraso', v: r => r.minRetraso ? `<span class="text-marca-700 font-semibold">${fmtHoras(r.minRetraso)}</span>` : '—', s: r => r.minRetraso, c: r => hCSV(r.minRetraso), cls: 'text-right whitespace-nowrap' },
    { t: 'Horas trab.', v: r => fmtHoras(r.minTrabajados), s: r => r.minTrabajados, c: r => hCSV(r.minTrabajados), cls: 'text-right whitespace-nowrap' },
    { t: 'Horas extra', v: r => r.minExtra ? `<b class="text-navy-700">${fmtHoras(r.minExtra)}</b>` : '—', s: r => r.minExtra, c: r => hCSV(r.minExtra), cls: 'text-right whitespace-nowrap' },
    { t: 'Asistencia', v: r => `<span class="${colorPuntaje(r.pctAsistencia)} font-semibold">${fmtPct(r.pctAsistencia)}</span>`, s: r => r.pctAsistencia, c: r => pctCSV(r.pctAsistencia), cls: 'text-right' },
    { t: 'Puntualidad', v: r => `<span class="${colorPuntaje(r.pctPuntualidad)} font-semibold">${fmtPct(r.pctPuntualidad)}</span>`, s: r => r.pctPuntualidad, c: r => pctCSV(r.pctPuntualidad), cls: 'text-right' },
    { t: 'Desempeño', v: r => `<span class="${colorPuntaje(r.evalProm)} font-semibold">${r.evalProm === null ? '—' : fmtNum(r.evalProm)}</span>`, s: r => r.evalProm, c: r => r.evalProm === null ? '' : r.evalProm.toFixed(1).replace('.', ','), cls: 'text-right' }
  ], k.filas, { vacio: 'No hay empleados para estos filtros.' });
  iconos();
}

/* ---------- Marcajes manuales y justificativos en el dashboard ---------- */
const esManual = a => a.Origen && a.Origen !== 'GPS';
function insigniaJustificativo(a) {
  if (!esManual(a)) return '<span class="text-slate-300">—</span>';
  const j = a.Justificativo || 'Sin justificativo';
  const clip = a.SoporteFileID ? `<button data-acc="ver-soporte" data-id="${esc(a.ID)}" class="ml-1 text-navy-700 hover:text-marca-700" title="Ver soporte"><i data-lucide="paperclip" class="w-4 h-4 inline"></i></button>` : '';
  return `<span class="insignia bg-oro-100 text-oro-700" title="${esc(a.Observacion || '')}">${esc(j)}</span>${clip}`;
}

function pintarManualesDashboard(asistencia, ids) {
  const lista = asistencia.filter(a => esManual(a) && ids.has(a.EmpleadoID))
    .map(a => Object.assign({ _e: empPorId(a.EmpleadoID) || { Nombres: a.Email, Apellidos: '' } }, a))
    .sort((a, b) => a.Fecha < b.Fecha ? 1 : -1);
  const conteo = {};
  lista.forEach(a => { const j = a.Justificativo || 'Sin justificativo'; conteo[j] = (conteo[j] || 0) + 1; });
  const etq = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a]);
  grafico('ch-justif', {
    type: 'bar',
    data: { labels: etq, datasets: [{ label: 'Marcajes', data: etq.map(j => conteo[j]), backgroundColor: etq.map((_, i) => colorSerie(i + 3)), borderRadius: 8, borderSkipped: false }] },
    options: baseOpciones({ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } } })
  });
  renderTabla('dash-manuales', 't-dash-manuales', [
    { t: 'Fecha', v: a => `<span class="cap1">${esc(fmtFechaCorta(a.Fecha))}</span>`, s: a => a.Fecha, c: a => a.Fecha },
    { t: 'Empleado', v: a => `<button data-acc="ver-expediente" data-id="${esc(a.EmpleadoID)}" class="font-semibold text-slate-800 hover:text-marca-700 text-left">${esc(nombreCompleto(a._e))}</button><div class="text-xs text-slate-400">${esc(a._e.Departamento || '')}</div>`, s: a => nombreCompleto(a._e), c: a => nombreCompleto(a._e) },
    { t: 'Departamento', v: a => esc(a._e.Departamento), c: a => a._e.Departamento, cls: 'hidden' },
    { t: 'Horario', v: a => `${fmtHora(a.Entrada)} → ${fmtHora(a.Salida)}`, c: a => `${fmtHora(a.Entrada)} - ${fmtHora(a.Salida)}` },
    { t: 'Justificativo', v: a => insigniaJustificativo(a), s: a => a.Justificativo || '', c: a => a.Justificativo || 'Sin justificativo' },
    { t: 'Detalle', v: a => `<span class="text-xs text-slate-500">${esc(a.Observacion)}</span>`, c: a => a.Observacion, cls: 'envolver' },
    { t: 'Vía', v: a => a.SolicitudID ? '<span class="insignia bg-navy-50 text-navy-700">Solicitud</span>' : '<span class="insignia bg-slate-100 text-slate-600">RRHH</span>', c: a => a.SolicitudID ? 'Solicitud del empleado' : 'Registro de RRHH' },
    { t: 'Soporte', v: a => a.SoporteFileID ? 'Sí' : 'No', c: a => a.SoporteFileID ? 'Sí' : 'No', cls: 'hidden' }
  ], lista, { vacio: 'No hubo marcajes manuales en este período.' });
}

function pintarAlertas(depto, q) {
  const hoy = hoyStr(), en30 = sumarDias(hoy, 30), en7 = sumarDias(hoy, 7);
  const emps = S.empleados.filter(e => e.Estado !== 'Inactivo' && (!depto || e.Departamento === depto) && coincide(e, q));
  const ids = new Set(emps.map(e => e.ID));
  const a = [];
  const item = (icono, color, titulo, detalle, id, acc = `data-acc="ver-expediente" data-id="${esc(id)}"`) => a.push({ icono, color, titulo, detalle, id, acc });
  S.solicitudes.filter(x => x.Estado === 'Pendiente' && ids.has(x.EmpleadoID)).forEach(x =>
    item('clipboard-pen', 'ambar', `Marcaje por aprobar: ${nombreCompleto(empPorId(x.EmpleadoID))}`, `${fmtFecha(x.Fecha)} · ${x.Justificativo}`, x.EmpleadoID, 'data-acc="nav" data-sec="asistencia"'));

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

  const colores = { rosa: 'bg-rose-50 text-rose-600', ambar: 'bg-oro-100 text-oro-700', azul: 'bg-navy-50 text-navy-700',
    gris: 'bg-slate-100 text-slate-500', violeta: 'bg-violet-50 text-violet-600', marca: 'bg-marca-50 text-marca-700' };
  const orden = { rosa: 0, ambar: 1, azul: 2, marca: 3, violeta: 4, gris: 5 };
  a.sort((x, y) => orden[x.color] - orden[y.color]);
  $('#dash-alertas-total').textContent = a.length;
  $('#dash-alertas').innerHTML = a.length ? a.map(x => `
    <button ${x.acc} class="w-full text-left flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50">
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
    { t: 'Salario semanal', v: e => esc(e.SalarioSemanal), c: e => String(e.SalarioSemanal || '').replace('.', ','), cls: 'hidden' },
    { t: 'Tipo de sangre', v: e => esc(e.TipoSangre), c: e => e.TipoSangre, cls: 'hidden' },
    { t: 'Alergias', v: e => esc(e.Alergias), c: e => e.Alergias, cls: 'hidden' },
    { t: 'Condiciones especiales', v: e => esc(e.CondicionesEspeciales), c: e => e.CondicionesEspeciales, cls: 'hidden' },
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
          ${c('SalarioSemanal', `Salario semanal (${esc(S.sesion.moneda)})`, 'number', 'min="0" step="0.01"')}
          ${s('TipoContrato', 'Tipo de contrato', ['Tiempo indeterminado', 'Tiempo determinado', 'Por obra determinada', 'Pasantía', 'Honorarios profesionales'])}
          <div data-si="contrato">${c('FinContrato', 'Fin de contrato', 'date')}</div>
          ${s('Estado', 'Estado *', cat.estados, 'required')}
          <div data-si="egreso">${c('FechaEgreso', 'Fecha de egreso', 'date')}</div>
          ${s('Rol', 'Rol en el sistema', [{ v: 'EMPLEADO', t: 'Empleado (solo marcaje)' }, { v: 'DIRECCION', t: 'Dirección (ver todo)' }, { v: 'RRHH', t: 'RRHH (gestionar todo)' }])}
        </div></fieldset>
      <fieldset><legend class="text-sm font-bold text-marca-700 mb-3">Salud y datos complementarios</legend>
        <div class="grid sm:grid-cols-3 gap-4">
          ${s('TipoSangre', 'Tipo de sangre', OPC.sangre)}${s('EstadoCivil', 'Estado civil', OPC.civil)}${c('NumeroHijos', 'Número de hijos', 'number', 'min="0" step="1"')}
          <div class="sm:col-span-3">${c('Alergias', 'Alergias', 'text', 'placeholder="Ej.: Penicilina, mariscos… (vacío si no tiene)"')}</div>
          <div class="sm:col-span-3"><label class="etiqueta">Condiciones especiales</label><textarea name="CondicionesEspeciales" rows="2" class="campo" placeholder="Condiciones médicas, discapacidad, tratamientos, embarazo, restricciones laborales…">${esc(e.CondicionesEspeciales || '')}</textarea></div>
          ${s('NivelInstruccion', 'Nivel de instrucción', OPC.instruccion)}${s('TallaCamisa', 'Talla de camisa', OPC.camisa)}
          <div class="grid grid-cols-2 gap-3">${c('TallaPantalon', 'Talla pantalón')}${c('TallaCalzado', 'Talla calzado')}</div>
        </div></fieldset>
      <fieldset><legend class="text-sm font-bold text-marca-700 mb-3">Contacto de emergencia</legend>
        <div class="grid sm:grid-cols-3 gap-4">
          ${c('EmergenciaNombre', 'Nombre')}${c('EmergenciaTelefono', 'Teléfono', 'tel')}${c('EmergenciaParentesco', 'Parentesco')}
        </div></fieldset>
      <div><label class="etiqueta">Notas internas</label><textarea name="Notas" rows="2" class="campo">${esc(e.Notas || '')}</textarea></div>
    </form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-empleado" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Guardar</button>`
  });
  const form = $('#f-empleado');
  const condicionales = () => {
    $('[data-si="egreso"]', form).classList.toggle('hidden', form.Estado.value !== 'Inactivo');
    $('[data-si="contrato"]', form).classList.toggle('hidden', form.TipoContrato.value === 'Tiempo indeterminado');
  };
  form.Estado.addEventListener('change', condicionales);
  form.TipoContrato.addEventListener('change', condicionales);
  condicionales();
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
            ${e.Alergias || e.CondicionesEspeciales ? `<p class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"><i data-lucide="heart-pulse" class="w-3.5 h-3.5"></i>${esc([e.Alergias ? 'Alergias: ' + e.Alergias : '', e.CondicionesEspeciales ? 'Condición especial registrada' : ''].filter(Boolean).join(' · '))}</p>` : ''}
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
      campoLectura('Tipo de contrato', esc(e.TipoContrato)),
      ...(e.TipoContrato && e.TipoContrato !== 'Tiempo indeterminado' ? [campoLectura('Fin de contrato', e.FinContrato ? fmtFecha(e.FinContrato) : '')] : []),
      campoLectura('Salario semanal', e.SalarioSemanal ? fmtDinero(e.SalarioSemanal) : ''),
      ...(e.Estado === 'Inactivo' ? [campoLectura('Fecha de egreso', e.FechaEgreso ? fmtFecha(e.FechaEgreso) : '')] : []),
      campoLectura('Rol en el sistema', esc(e.Rol))])}
    ${bloque('Salud y datos complementarios', [campoLectura('Tipo de sangre', esc(e.TipoSangre)),
      campoLectura('Alergias', e.Alergias ? `<span class="font-semibold text-rose-700">${esc(e.Alergias)}</span>` : ''),
      campoLectura('Condiciones especiales', e.CondicionesEspeciales ? `<span class="whitespace-pre-line">${esc(e.CondicionesEspeciales)}</span>` : ''),
      campoLectura('Estado civil', esc(e.EstadoCivil)), campoLectura('Número de hijos', esc(e.NumeroHijos)),
      campoLectura('Nivel de instrucción', esc(e.NivelInstruccion)),
      campoLectura('Tallas (camisa · pantalón · calzado)', [e.TallaCamisa, e.TallaPantalon, e.TallaCalzado].some(Boolean) ? esc([e.TallaCamisa || '—', e.TallaPantalon || '—', e.TallaCalzado || '—'].join(' · ')) : '')])}
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
    <td>${num(a.MinExtra) > 0 ? fmtMin(a.MinExtra) : '—'}</td><td class="text-xs">${esManual(a) ? insigniaJustificativo(a) : `GPS · ${esc(a.DistEntrada)} m`}</td></tr>`).join('')
    : '<tr><td colspan="7" class="text-center text-slate-400 py-8">Sin marcajes en los últimos 90 días.</td></tr>';
  return `<div class="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">${tarjetas}</div>
    <div class="tarjeta p-5 mb-5"><h5 class="font-bold text-sm text-marca-700 mb-3">Hora de entrada · últimos 30 días</h5><div class="h-56"><canvas id="ch-exp-asis"></canvas></div></div>
    <div class="tarjeta overflow-x-auto"><table class="tabla"><thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Retraso</th><th>Trabajado</th><th>Extra</th><th>Origen / justificativo</th></tr></thead><tbody>${filas}</tbody></table></div>`;
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
        { label: 'Hora de entrada', data: regs.map(a => +minutos(a.Entrada).toFixed(1)), borderColor: PALETA.lavanda, backgroundColor: conAlfa(PALETA.lavanda, 0.12), fill: true, pointBackgroundColor: regs.map(a => num(a.MinRetraso) > 0 ? COLORES.ausente : COLORES.aTiempo), pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 6, tension: 0.35 },
        { label: 'Límite (con tolerancia)', data: regs.map(() => lim), borderColor: PALETA.coral, borderDash: [6, 4], pointRadius: 0 }
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

/* ---------- Selector de mes por botones (funciona en todos los navegadores) ---------- */
function selectorMesHTML(id, valor = '', { vacio = '', name = '' } = {}) {
  const etq = valor ? fmtPeriodo(valor) : (vacio || 'Selecciona un mes…');
  return `<div class="relative selector-mes" data-id="${id}" data-vacio="${esc(vacio)}">
    <input type="hidden" id="${id}" ${name ? `name="${name}"` : ''} value="${esc(valor)}">
    <button type="button" data-acc="mes-abrir" data-id="${id}" class="campo text-left flex items-center justify-between gap-2">
      <span data-etq class="cap1">${esc(etq)}</span><i data-lucide="calendar" class="w-4 h-4 text-slate-400"></i></button>
    <div data-pop class="hidden absolute left-0 z-50 mt-1 w-72 bg-white rounded-2xl border border-slate-200 p-3 shadow-xl"></div>
  </div>`;
}

function pintarPopMes(id, anio) {
  const cont = document.querySelector(`.selector-mes[data-id="${id}"]`);
  const val = $('#' + id).value, vacio = cont.dataset.vacio;
  cont.querySelector('[data-pop]').innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <button type="button" data-acc="mes-anio" data-id="${id}" data-anio="${anio - 1}" class="btn-fantasma btn-sm"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
      <b class="text-navy-900">${anio}</b>
      <button type="button" data-acc="mes-anio" data-id="${id}" data-anio="${anio + 1}" class="btn-fantasma btn-sm"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
    </div>
    <div class="grid grid-cols-4 gap-1.5">${MESES.map((m, i) => {
      const v = `${anio}-${pad(i + 1)}`;
      return `<button type="button" data-acc="mes-elegir" data-id="${id}" data-valor="${v}" class="rounded-lg py-2 text-sm font-semibold ${v === val ? 'bg-marca-700 text-white' : v === hoyStr().slice(0, 7) ? 'bg-oro-100 text-navy-900 hover:bg-oro-200' : 'text-slate-700 hover:bg-slate-100'}">${m}</button>`;
    }).join('')}</div>
    ${vacio ? `<button type="button" data-acc="mes-elegir" data-id="${id}" data-valor="" class="w-full mt-2 btn-fantasma btn-sm">${esc(vacio)}</button>` : ''}`;
  iconos();
}

function cerrarSelectoresMes(excepto = null) {
  $$('.selector-mes').forEach(c => { if (c !== excepto) c.querySelector('[data-pop]').classList.add('hidden'); });
}

function abrirSelectorMes(id) {
  const cont = document.querySelector(`.selector-mes[data-id="${id}"]`), pop = cont.querySelector('[data-pop]');
  cerrarSelectoresMes(cont);
  if (!pop.classList.contains('hidden')) return pop.classList.add('hidden');
  const val = $('#' + id).value;
  pintarPopMes(id, val ? Number(val.slice(0, 4)) : new Date().getFullYear());
  pop.classList.remove('hidden');
}

function elegirMes(id, valor) {
  const cont = document.querySelector(`.selector-mes[data-id="${id}"]`), inp = $('#' + id);
  inp.value = valor;
  cont.querySelector('[data-etq]').textContent = valor ? fmtPeriodo(valor) : (cont.dataset.vacio || 'Selecciona un mes…');
  cont.querySelector('[data-pop]').classList.add('hidden');
  inp.dispatchEvent(new Event('change'));
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

const verDocumento = id => abrirArchivo('descargarDocumento', id);
const verSoporte = id => abrirArchivo('descargarSoporte', id);

async function abrirArchivo(accion, id) {
  const ventana = window.open('', '_blank');
  if (ventana) ventana.document.write('<p style="font-family:sans-serif;padding:24px;color:#475569">Cargando documento…</p>');
  try {
    const d = await api(accion, { id }, { texto: 'Descargando documento…' });
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
  pintarSolicitudes();
  $('#asis-resumen').innerHTML = [
    tarjetaKPI('fingerprint', 'Marcajes', lista.length, `${lista.filter(esManual).length} manuales con justificativo`, 'marca'),
    tarjetaKPI('timer', 'Llegadas tarde', tarde, lista.length ? `${Math.round(tarde / lista.length * 100)}% de los marcajes` : '—', 'ambar'),
    tarjetaKPI('log-out', 'Sin salida', sinSalida, 'Jornadas pasadas sin marcar salida', 'rosa'),
    tarjetaKPI('hourglass', 'Horas extra (netas)', fmtHoras(extra), `Retraso acumulado: ${fmtHoras(lista.reduce((s, a) => s + num(a.MinRetraso), 0))}`, 'violeta')
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
    { t: 'Extra', v: a => num(a.MinExtra) > 0 || num(a.MinExtraBruto) > 0 ? `<b class="text-navy-700" title="${num(a.MinExtraBruto) !== num(a.MinExtra) ? esc(`Brutas: ${fmtMin(a.MinExtraBruto)} − retraso ${fmtMin(a.MinRetraso)}`) : ''}">${fmtMin(a.MinExtra)}</b>${num(a.MinExtraBruto) > num(a.MinExtra) ? '<span class="block text-[10px] text-slate-400">compensado</span>' : ''}` : '—', s: a => num(a.MinExtra), c: a => hCSV(a.MinExtra) },
    { t: 'Extra bruta', v: a => esc(a.MinExtraBruto), c: a => hCSV(a.MinExtraBruto), cls: 'hidden' },
    { t: 'Ubicación', v: a => a.Origen === 'MANUAL' ? '<span class="text-xs text-slate-400">Manual</span>' : `<span class="text-xs text-slate-500 whitespace-nowrap">${a.DistEntrada ? esc(a.DistEntrada) + ' m' : '—'}${a.DistSalida ? ' / ' + esc(a.DistSalida) + ' m' : (a.Origen === 'GPS+MANUAL' ? ' / manual' : '')}</span>`, c: a => a.Origen === 'GPS' ? `${a.DistEntrada} m` : a.Origen },
    { t: 'Justificativo', v: a => insigniaJustificativo(a), s: a => a.Justificativo || '', c: a => a.Justificativo },
    { t: 'Observación', v: a => esc(a.Observacion), c: a => a.Observacion, cls: 'hidden' },
    { t: '', v: a => `<div class="flex justify-end gap-1 no-print solo-rrhh"><button data-acc="marcaje-manual" data-id="${esc(a.ID)}" class="btn-fantasma btn-sm" title="Corregir"><i data-lucide="pencil" class="w-4 h-4"></i></button><button data-acc="borrar-asis" data-id="${esc(a.ID)}" class="btn-fantasma btn-sm text-rose-600" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`, cls: 'text-right' }
  ], lista, { vacio: 'No hay marcajes en este período.' });
}

/* ---------- Bandeja de solicitudes de marcaje (RRHH aprueba) ---------- */
function pintarSolicitudes() {
  const todas = $('#sol-todas').checked;
  const pend = S.solicitudes.filter(x => x.Estado === 'Pendiente').length;
  $('#sol-total').textContent = `${pend} pendiente${pend === 1 ? '' : 's'}`;
  $('#sol-total').className = `insignia ${pend ? 'bg-oro-400 text-navy-950' : 'bg-slate-100 text-slate-500'}`;
  actualizarInsignia(pend);
  const lista = S.solicitudes.filter(x => todas || x.Estado === 'Pendiente')
    .map(x => Object.assign({ _e: empPorId(x.EmpleadoID) || { Nombres: x.Email, Apellidos: '' } }, x))
    .sort((a, b) => (a.Estado === 'Pendiente') !== (b.Estado === 'Pendiente') ? (a.Estado === 'Pendiente' ? -1 : 1) : (a.Creado < b.Creado ? 1 : -1));
  renderTabla('sol-tabla', 't-solicitudes', [
    { t: 'Fecha', v: x => `<span class="cap1 whitespace-nowrap">${esc(fmtFechaCorta(x.Fecha))}</span>`, s: x => x.Fecha },
    { t: 'Empleado', v: x => `<b>${esc(nombreCompleto(x._e))}</b><div class="text-xs text-slate-400">${esc(x._e.Departamento || '')}</div>`, s: x => nombreCompleto(x._e) },
    { t: 'Solicita', v: x => `${x.Entrada ? 'Entrada <b>' + fmtHora(x.Entrada) + '</b>' : ''}${x.Entrada && x.Salida ? '<br>' : ''}${x.Salida ? 'Salida <b>' + fmtHora(x.Salida) + '</b>' : ''}` },
    { t: 'Justificativo', v: x => `<span class="insignia bg-oro-100 text-oro-700">${esc(x.Justificativo)}</span>${x.Detalle ? `<p class="text-xs text-slate-500 mt-1">${esc(x.Detalle)}</p>` : ''}`, cls: 'envolver' },
    { t: 'Soporte', v: x => x.SoporteFileID ? `<button data-acc="ver-soporte" data-id="${esc(x.ID)}" class="btn-fantasma btn-sm"><i data-lucide="paperclip" class="w-4 h-4"></i>Ver</button>` : '<span class="text-xs text-slate-300">—</span>' },
    { t: 'Enviada', v: x => `<span class="text-xs text-slate-500">${esc(String(x.Creado).slice(0, 16))}</span>`, s: x => x.Creado },
    { t: 'Estado', v: x => insigniaEstado(x.Estado) + (x.ComentarioRevision ? `<p class="text-xs text-slate-500 mt-1">${esc(x.ComentarioRevision)}</p>` : ''), s: x => x.Estado },
    { t: '', v: x => x.Estado === 'Pendiente' ? `<div class="flex justify-end gap-1 solo-rrhh whitespace-nowrap">
        <button data-acc="aprobar-solicitud" data-id="${esc(x.ID)}" class="btn btn-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><i data-lucide="check" class="w-4 h-4"></i>Aprobar</button>
        <button data-acc="rechazar-solicitud" data-id="${esc(x.ID)}" class="btn btn-sm bg-rose-50 text-rose-700 hover:bg-rose-100"><i data-lucide="x" class="w-4 h-4"></i>Rechazar</button></div>` : '', cls: 'text-right' }
  ], lista, { vacio: todas ? 'No hay solicitudes en este período.' : 'No hay solicitudes pendientes. ¡Todo al día!', pie: false });
}

async function resolverSolicitud(id, decision) {
  const x = S.solicitudes.find(y => y.ID === id);
  const quien = x ? nombreCompleto(empPorId(x.EmpleadoID)) : 'el empleado';
  let comentario = '';
  if (decision === 'Aprobada') {
    if (!await dialogo({ titulo: '¿Aprobar solicitud?', mensaje: `Se registrará el marcaje de ${quien} del ${x ? fmtFecha(x.Fecha) : ''} y se recalcularán sus horas.`, boton: 'Aprobar' })) return;
  } else {
    comentario = await dialogo({ titulo: 'Rechazar solicitud', mensaje: `${quien} verá este motivo en su celular.`, boton: 'Rechazar', peligro: true, conTexto: true, placeholder: 'Ej.: No hay soporte de la salida a campo.' });
    if (!comentario) return;
  }
  try {
    await api('resolverSolicitud', { id, decision, comentario }, { texto: decision === 'Aprobada' ? 'Aprobando…' : 'Rechazando…' });
    toast(`Solicitud ${decision.toLowerCase()}.`, 'ok');
    invalidarCache();
    cargarAsistencia(true);
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function formMarcajeManual(id = null) {
  try { await asegurarCatalogo(); } catch (e) { return toast(e.message, 'error'); }
  let a = { Fecha: hoyStr(), Entrada: '', Salida: '', Observacion: '' };
  if (id) {
    const todos = Object.values(S.periodos).flatMap(p => p.asistencia);
    a = todos.find(x => x.ID === id) || a;
  }
  const activos = S.empleados.filter(e => e.Estado !== 'Inactivo').sort(ordenarNombre);
  const hora = h => (fmtHora(h) === '—' ? '' : fmtHora(h));
  abrirModal({
    titulo: id ? 'Corregir marcaje' : 'Registro manual de asistencia',
    cuerpo: `<form id="f-manual" class="space-y-4">
      <div><label class="etiqueta">Empleado *</label><select name="empleadoId" class="campo" required ${id ? 'disabled' : ''}>${opciones(activos.map(e => ({ v: e.ID, t: `${nombreCompleto(e)} · ${e.Departamento}` })), a.EmpleadoID || '', 'Selecciona…')}</select>
        ${id ? `<input type="hidden" name="empleadoId" value="${esc(a.EmpleadoID)}">` : ''}</div>
      ${camposMarcajeHTML({ conModo: false, fecha: a.Fecha, entrada: hora(a.Entrada), salida: hora(a.Salida), justificativo: a.Justificativo || '',
        detalle: String(a.Observacion || '').replace(/\s*\((registrado|solicitado|por) .+\)$/, ''), etiquetaDetalle: 'Observación' })}
      <p class="text-xs text-slate-500">Como RRHH puedes registrar cualquier fecha pasada. Si ya existe un marcaje ese día, se corregirá. Queda en la auditoría.</p>
    </form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-manual" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Guardar</button>`
  });
  const form = $('#f-manual');
  form.entrada.required = true;
  if (id) form.fecha.readOnly = true;
}

async function guardarManual() {
  const form = $('#f-manual');
  if (!form.reportValidity()) return;
  const d = { empleadoId: form.querySelector('[name=empleadoId]:not([disabled])')?.value || form.empleadoId.value, fecha: form.fecha.value,
    entrada: form.entrada.value, salida: form.salida.value, justificativo: form.justificativo.value, observacion: form.detalle.value.trim() };
  try {
    cargando(true, 'Preparando soporte…');
    try { d.archivo = await archivoParaEnviar(form.archivo.files[0]); } finally { cargando(false); }
    await api('marcajeManual', d, { texto: 'Guardando…' });
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
  const otro = () => { form.Observacion.required = form.Tipo.value === TIPO_OTRO; form.Observacion.placeholder = form.Tipo.value === TIPO_OTRO ? 'Obligatorio: explica el motivo del permiso.' : 'Ej.: Reposo según certificado médico N.º…'; };
  form.Tipo.addEventListener('change', () => { recalcular(false); otro(); });
  recalcular(!id); otro();
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
    data: { labels: dl, datasets: [{ label: 'Promedio', data: dl.map(d => +prom(grupos[d]).toFixed(1)), backgroundColor: dl.map((_, i) => colorSerie(i)), borderRadius: 8, borderSkipped: false }] },
    options: baseOpciones({ plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } } })
  });
  grafico('ch-eval-criterios', {
    type: 'radar',
    data: { labels: CRITERIOS.map(c => c.t), datasets: [{ label: 'Promedio', data: CRITERIOS.map(c => +prom(lista.map(v => num(v[c.k]))).toFixed(1)), borderColor: PALETA.lavanda, backgroundColor: conAlfa(PALETA.lavanda, 0.22), borderWidth: 2, pointBackgroundColor: CRITERIOS.map((_, i) => colorSerie(i + 1)), pointBorderColor: '#fff', pointRadius: 6 }] },
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
        <div><label class="etiqueta">Período evaluado *</label>${selectorMesHTML('ev-form-periodo', mesAnt, { name: 'Periodo' })}</div>
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
  if (!datos.Periodo) return toast('Selecciona el período evaluado.', 'aviso');
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
  'borrar-asis': d => borrarAsistencia(d.id),
  'solicitar-marcaje': () => formSolicitud(),
  'enviar-solicitud': () => enviarSolicitud(),
  'aprobar-solicitud': d => resolverSolicitud(d.id, 'Aprobada'),
  'rechazar-solicitud': d => resolverSolicitud(d.id, 'Rechazada'),
  'ver-soporte': d => verSoporte(d.id),
  'celebrar': () => celebrar(),
  'mes-abrir': d => abrirSelectorMes(d.id),
  'mes-anio': d => pintarPopMes(d.id, Number(d.anio)),
  'mes-elegir': d => elegirMes(d.id, d.valor)
};

function prepararUI() {
  $('#anio').textContent = new Date().getFullYear();
  $('#version').textContent = VERSION;
  $('#ev-periodo-cont').innerHTML = selectorMesHTML('ev-periodo', '', { vacio: 'Todos los períodos' });
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
  $('#sol-todas').addEventListener('change', pintarSolicitudes);
  window.addEventListener('hashchange', () => { if (S.sesion) entrarSegunRuta(); });

  document.addEventListener('click', ev => {
    if (!ev.target.closest('.selector-mes')) cerrarSelectoresMes();
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
