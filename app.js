/**
 * ==========================================================================
 *  ASISTENCIA SUMANPEK, C.A. · Frontend  (v3.2.0 — Fase 3)
 *  © 2026 Anabel Martínez RRHH — Todos los derechos de creación reservados.
 *  Solución personalizada para Sumanpek, C.A.
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

const VERSION = '3.2.0';
const APP_NOMBRE = 'Asistencia Sumanpek, C.A.';
const APP_AUTOR = 'Anabel Martínez RRHH';
const APP_URL = 'https://sumanpek.github.io/';

/* ============================== 2. ESTADO ============================== */
const S = {
  solicitudes: [],
  accesos: [],
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

// Interfaz: principal #C10866 · secundario #031263 · apoyo #EECF15 (botones, menús y textos; no se toca).
// Gráficos: paleta "Tintas de sublimación" — colores saturados inspirados en las tintas CMYK
// con que se sublima, más los tres colores de la marca. Mismo carácter fuerte que el logo.
const PALETA = {
  magenta: '#C10866', cian: '#00A0E3', amarillo: '#EECF15', azul: '#031263', naranja: '#F26B1D',
  turquesa: '#00A68C', purpura: '#6A1B9A', rey: '#2F6FDE', lima: '#7CB518', vino: '#8E1A5A',
  ambar: '#F5A800', rosa: '#FF4F9A', rojo: '#E4002B', grafito: '#3A3F58', cobre: '#A0522D', acero: '#7A8CA5'
};
const COLORES = {
  marca: '#C10866', navy: '#031263', oro: '#EECF15',
  aTiempo: PALETA.turquesa, tarde: PALETA.amarillo, ausente: PALETA.magenta, justificado: PALETA.acero,
  extra: PALETA.cian, retraso: PALETA.magenta,
  serie: [PALETA.magenta, PALETA.cian, PALETA.amarillo, PALETA.azul, PALETA.naranja, PALETA.turquesa, PALETA.purpura, PALETA.rey,
    PALETA.lima, PALETA.vino, PALETA.ambar, PALETA.rosa, PALETA.rojo, PALETA.grafito, PALETA.cobre, PALETA.acero]
};
const colorSerie = i => COLORES.serie[i % COLORES.serie.length];
const conAlfa = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

const SECCIONES = [
  { id: 'dashboard', titulo: 'Dashboard', icono: 'layout-dashboard' },
  { id: 'empleados', titulo: 'Empleados', icono: 'users' },
  { id: 'asistencia', titulo: 'Asistencia', icono: 'clock' },
  { id: 'permisos', titulo: 'Permisos y vacaciones', icono: 'calendar-days' },
  { id: 'evaluaciones', titulo: 'Desempeño', icono: 'award' },
  { id: 'tareas', titulo: 'Tareas', icono: 'square-kanban' },
  { id: 'agenda', titulo: 'Agenda', icono: 'calendar-range' },
  { id: 'curriculums', titulo: 'Currículums', icono: 'file-user' },
  { id: 'registro', titulo: 'Registro de actividad', icono: 'scroll-text' },
  { id: 'ajustes', titulo: 'Ajustes', icono: 'settings' },
  { id: 'ayuda', titulo: 'Ayuda', icono: 'life-buoy' },
  { id: 'mi-marcaje', titulo: 'Mi marcaje', icono: 'fingerprint' }
];

const TIPOS_DOCUMENTO = ['Currículum', 'Cédula de identidad', 'RIF', 'Test psicotécnico', 'Contrato de trabajo',
  'Amonestación', 'Constancia de trabajo', 'Certificado médico / Reposo', 'Título o certificación',
  'Referencias', 'Evaluación firmada', 'Carta de renuncia / despido', 'Soporte de marcaje', 'Otro'];

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS_SEMANA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const TIPO_OTRO = 'Otro (justifique)';
const OPC_SEXO = [{ v: 'F', t: 'Femenino' }, { v: 'M', t: 'Masculino' }];

/** Campo de cédula con selector V / E. Devuelve HTML; los valores llegan como TipoDocumento + Cedula (solo números). */
function campoCedulaHTML(valor = '', { requerido = true } = {}) {
  const txt = String(valor || '').toUpperCase();
  const tipo = /^\s*E/.test(txt) ? 'E' : 'V';
  const numero = txt.replace(/\D/g, '');
  return `<div><label class="etiqueta">Cédula ${requerido ? '*' : ''}</label>
    <div class="flex gap-2">
      <select name="TipoDocumento" class="campo !w-20 shrink-0" title="V = venezolano · E = extranjero">
        <option value="V" ${tipo === 'V' ? 'selected' : ''}>V-</option><option value="E" ${tipo === 'E' ? 'selected' : ''}>E-</option>
      </select>
      <input name="Cedula" class="campo min-w-0" inputmode="numeric" pattern="\\d{6,8}" minlength="6" maxlength="8" ${requerido ? 'required' : ''}
        value="${esc(numero)}" placeholder="12345678" title="Solo números, sin puntos (6 a 8 dígitos)" oninput="this.value=this.value.replace(/\\D/g,'')">
    </div></div>`;
}
const vacioOpc = t => ({ v: '', t });
const OPC = {
  sangre: [vacioOpc('—'), 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'No sabe'],
  civil: [vacioOpc('—'), 'Soltero(a)', 'Casado(a)', 'Unión estable de hecho', 'Divorciado(a)', 'Viudo(a)'],
  instruccion: [vacioOpc('—'), 'Primaria', 'Bachiller', 'Técnico medio', 'TSU', 'Universitario', 'Postgrado'],
  camisa: [vacioOpc('—'), 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
};

/** Criterios de desempeño (el servidor envía la lista oficial en la sesión; esta es la copia de respaldo). */
let CRITERIOS = [
  { k: 'Metas', t: 'Cumplimiento de metas', g: 'Resultados' },
  { k: 'Productividad', t: 'Productividad', g: 'Resultados' },
  { k: 'Calidad', t: 'Calidad del trabajo', g: 'Resultados' },
  { k: 'Puntualidad', t: 'Puntualidad y asistencia', g: 'Disciplina' },
  { k: 'Responsabilidad', t: 'Responsabilidad y compromiso', g: 'Disciplina' },
  { k: 'Normas', t: 'Normas y seguridad laboral', g: 'Disciplina' },
  { k: 'TrabajoEquipo', t: 'Trabajo en equipo', g: 'Relaciones' },
  { k: 'Comunicacion', t: 'Comunicación', g: 'Relaciones' },
  { k: 'AtencionCliente', t: 'Atención al cliente', g: 'Relaciones' },
  { k: 'Iniciativa', t: 'Iniciativa y proactividad', g: 'Actitud' },
  { k: 'Adaptabilidad', t: 'Aprendizaje y adaptación', g: 'Actitud' },
  { k: 'Orden', t: 'Orden y limpieza del área', g: 'Cuidado' },
  { k: 'CuidadoEquipos', t: 'Cuidado de equipos y materiales', g: 'Cuidado' }
];
const GRUPOS_EVAL = () => [...new Set(CRITERIOS.map(c => c.g))];
/** Promedio de un grupo de criterios en una evaluación (ignora los "No aplica"). */
const promGrupo = (v, g) => { const xs = CRITERIOS.filter(c => c.g === g && String(v[c.k] ?? '') !== '').map(c => num(v[c.k])); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
/** Elige la palabra según el sexo: gen('F', 'empleada', 'empleado'). */
const gen = (sexo, fem, masc) => sexo === 'F' ? fem : masc;

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
const edad = (nac, ref = hoyStr()) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(nac || ''))) return null;
  let a = Number(ref.slice(0, 4)) - Number(nac.slice(0, 4));
  if (ref.slice(5, 10) < nac.slice(5, 10)) a--;
  return a;
};
/** Teléfono → "0412-1234567" ('' si vacío, null si inválido). Igual que en el servidor. */
function formatearTelefono(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 12 && d.startsWith('58')) d = '0' + d.slice(2);
  else if (d.length === 13 && d.startsWith('580')) d = d.slice(2);
  else if (d.length === 10 && d[0] !== '0') d = '0' + d;
  return /^0\d{10}$/.test(d) ? d.slice(0, 4) + '-' + d.slice(4) : null;
}
const ATRIB_NOMBRE = `pattern="[\\p{L}][\\p{L}' \\-]*" title="Solo letras (sin números ni símbolos)"`;
const fotoValida = f => /^[A-Za-z0-9+/=]{100,}$/.test(String(f || ''));
/** Foto de perfil o, si no hay, las iniciales. */
function avatarHTML(foto, nombre, clases = 'h-9 w-9 text-xs') {
  return fotoValida(foto)
    ? `<img src="data:image/jpeg;base64,${foto}" alt="" class="${clases} rounded-full object-cover shrink-0">`
    : `<div class="${clases} rounded-full bg-marca-100 text-marca-800 flex items-center justify-center font-bold shrink-0">${esc(iniciales(nombre))}</div>`;
}
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

function dialogo({ titulo = 'Confirmar', mensaje = '', boton = 'Aceptar', peligro = false, conTexto = false, placeholder = '', valor = '', linea = false } = {}) {
  return new Promise(resolve => {
    const capa = document.createElement('div');
    capa.className = 'confirmacion fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/50';
    capa.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h4 class="font-bold text-lg mb-2">${esc(titulo)}</h4>
        <p class="text-sm text-slate-600 ${conTexto ? 'mb-3' : 'mb-6'}">${esc(mensaje)}</p>
        ${conTexto ? (linea ? `<input class="campo mb-5" maxlength="60" placeholder="${esc(placeholder)}" value="${esc(valor)}">` : `<textarea rows="3" class="campo mb-5" placeholder="${esc(placeholder)}">${esc(valor)}</textarea>`) : ''}
        <div class="flex justify-end gap-2">
          <button class="btn-sec" data-r="0">Cancelar</button>
          <button class="${peligro ? 'btn-peligro' : 'btn-primario'}" data-r="1">${esc(boton)}</button>
        </div></div>`;
    capa.addEventListener('click', ev => {
      const b = ev.target.closest('[data-r]');
      if (!b) return;
      ev.stopPropagation();
      const campo = capa.querySelector('textarea, input');
      const texto = conTexto ? campo.value.trim() : '';
      if (b.dataset.r === '1' && conTexto && !texto) { campo.focus(); return; }
      capa.remove();
      resolve(b.dataset.r === '1' ? (conTexto ? texto : true) : (conTexto ? null : false));
    });
    document.body.appendChild(capa);
    if (conTexto) setTimeout(() => { const c = capa.querySelector('textarea, input'); c.focus(); if (linea) c.select(); }, 50);
    if (conTexto && linea) capa.querySelector('input').addEventListener('keydown', ev => { if (ev.key === 'Enter') capa.querySelector('[data-r="1"]').click(); });
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
function barra(delta) {
  S.barra = Math.max(0, (S.barra || 0) + delta);
  $('#barra').classList.toggle('hidden', !S.barra);
}

/** Acciones de solo lectura: se permiten aunque las versiones no coincidan. */
const LECTURAS = new Set(['sesion', 'miHistorial', 'misSolicitudes', 'listarEmpleados', 'expediente', 'datosPeriodo',
  'descargarDocumento', 'descargarSoporte', 'estadoAcceso', 'misPermisos', 'ajustes',
  'planificacion', 'miAgenda', 'curriculums', 'descargarCurriculum', 'ayuda', 'descargarManual', 'auditoria']);

async function api(action, payload = {}, { silencioso = false, texto = 'Cargando…' } = {}) {
  if (S.versionDesigual && !LECTURAS.has(action)) {
    throw new Error('Cambios en pausa: la página y el servidor tienen versiones distintas. Recarga la página en unos minutos.');
  }
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
        if (S.sesion) {
          cerrarSesion('Tu acceso fue desactivado. Contacta a Recursos Humanos.');
          throw new Error('Correo no registrado.');
        }
        const err = new Error('NO_REGISTRADO'); err.codigo = 'NO_REGISTRADO'; throw err;
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
  $('#login-google').classList.remove('hidden');
  $('#login-acceso').classList.add('hidden');
  $('#login-caja').classList.replace('max-w-md', 'max-w-sm');
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
    S.sesionT = Date.now();
    if (verificarVersion()) return;
    entrarSegunRuta();
    if (esGestion() && !S.store) asegurarStore().catch(() => {});   // precarga del panel en segundo plano
  } catch (e) {
    if (e.codigo === 'NO_REGISTRADO') return mostrarAcceso();
    if (!S.token) return; // ya se mostró el mensaje en cerrarSesion
    S.token = null;
    try { sessionStorage.removeItem('aa_token'); } catch (x) { /* nada */ }
    mostrarLogin(e.message);
  }
}

/* ---------- Versión: franja permanente + bloqueo de cambios ---------- */
const cmpVersion = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};
function verificarVersion() {
  const sv = String(S.sesion?.version || '1.0.0');
  const mm = v => String(v).split('.').slice(0, 2).join('.');
  const franja = $('#franja-version');
  if (mm(sv) === mm(VERSION)) {
    S.versionDesigual = null;
    franja.classList.add('hidden');
    document.body.style.paddingTop = '';
    document.documentElement.style.setProperty('--franja', '0px');
    return false;
  }
  S.versionDesigual = { servidor: sv, pagina: VERSION };
  const paginaVieja = cmpVersion(VERSION, sv) < 0;
  // Si el servidor ya es más nuevo, la app se actualiza sola UNA vez (sin que nadie tenga que hacer nada).
  if (paginaVieja) {
    let intentado = true;
    try { intentado = sessionStorage.getItem('aa_auto_' + sv) === '1'; sessionStorage.setItem('aa_auto_' + sv, '1'); } catch (e) { /* nada */ }
    if (!intentado) { actualizarApp(`Actualizando la app a la versión ${sv}…`); return true; }
  }
  const detalle = esRRHH()
    ? (paginaVieja
      ? `La página está en la v${VERSION} y el servidor en la v${sv}. Sube los archivos nuevos de la página a GitHub y pulsa <b>Recargar</b> en un par de minutos.`
      : `El servidor está en la v${sv} y la página en la v${VERSION}. En Apps Script: <b>Implementar → Gestionar implementaciones → ✏️ → Nueva versión</b>, y luego pulsa <b>Recargar</b>.`)
    : 'El sistema se está actualizando. Intenta de nuevo en unos minutos.';
  franja.innerHTML = `<div class="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
    <i data-lucide="triangle-alert" class="w-5 h-5 shrink-0"></i>
    <p class="flex-1 min-w-[200px]"><b>Versiones distintas · cambios en pausa.</b> ${detalle}
      <span class="block text-xs opacity-80">Puedes consultar la información, pero marcar, guardar o aprobar está bloqueado hasta que ambas versiones coincidan.</span></p>
    <button data-acc="recargar" class="btn btn-sm bg-navy-900 text-white hover:bg-navy-950"><i data-lucide="refresh-cw" class="w-4 h-4"></i>Recargar</button></div>`;
  franja.classList.remove('hidden');
  iconos();
  requestAnimationFrame(() => {
    document.body.style.paddingTop = franja.offsetHeight + 'px';
    document.documentElement.style.setProperty('--franja', franja.offsetHeight + 'px');
  });
  return false;
}

/** Borra la copia guardada de la app, busca la versión nueva y recarga. */
async function actualizarApp(mensaje = 'Actualizando…') {
  cargando(true, mensaje);
  try { const regs = await navigator.serviceWorker?.getRegistrations?.(); await Promise.all((regs || []).map(r => r.update().catch(() => {}))); } catch (e) { /* nada */ }
  try { const ks = await caches.keys(); await Promise.all(ks.filter(k => k.startsWith('asistencia-sumanpek')).map(k => caches.delete(k))); } catch (e) { /* nada */ }
  location.reload();
}

/** Al volver a abrir la app (por ejemplo, desde la pantalla de inicio), refresca la sesión y la versión. */
async function alVolverALaApp() {
  if (document.visibilityState !== 'visible' || !S.sesion || !S.token) return;
  try { (await navigator.serviceWorker?.getRegistration?.())?.update(); } catch (e) { /* nada */ }
  if (Date.now() - (S.sesionT || 0) < 5 * 60000) return;
  if (!tokenVigente(S.token)) return reautenticar();
  try {
    const s = await api('sesion', {}, { silencioso: true });
    S.sesion = s; S.sesionT = Date.now();
    if (verificarVersion()) return;
    if (!$('#v-marcaje').classList.contains('hidden')) mostrarMarcaje();
    else if (!$('#v-admin').classList.contains('hidden')) { invalidarCache(); refrescarFondo(); }
  } catch (e) { /* se reintenta la próxima vez */ }
}

/** El token de Google dura 1 hora: al volver después de eso, se renueva con el inicio automático. */
function reautenticar() {
  S.token = null; S.sesion = null; S.store = null;
  try { sessionStorage.removeItem('aa_token'); } catch (e) { /* nada */ }
  cerrarModal();
  mostrarLogin();
}

function cerrarSesion(msg = '') {
  S.token = null; S.sesion = null; S.store = null; S.versionDesigual = null;
  $('#franja-version').classList.add('hidden'); document.body.style.paddingTop = '';
  document.documentElement.style.setProperty('--franja', '0px'); S.catalogoListo = false; S.empleados = []; S.permisos = []; S.evaluaciones = [];
  try { sessionStorage.removeItem('aa_token'); } catch (e) { /* nada */ }
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
  Object.values(S.charts).forEach(c => c.destroy()); S.charts = {};
  cerrarModal();
  document.body.classList.remove('rol-direccion', 'rol-rrhh');
  mostrarLogin(msg);
}

/* ---------- Solicitud de acceso (personas aún no registradas) ---------- */
async function mostrarAcceso() {
  let d;
  try { d = await api('estadoAcceso', {}, { texto: 'Verificando tu correo…' }); }
  catch (e) { return mostrarLogin(e.message); }
  if (d.registrado) return cargarSesion();
  mostrarVista('v-login');
  $('#login-google').classList.add('hidden');
  $('#login-caja').classList.replace('max-w-sm', 'max-w-md');
  const cont = $('#login-acceso');
  cont.classList.remove('hidden');
  const sol = d.solicitud;
  const otraCuenta = '<button data-acc="salir" class="btn-fantasma btn-sm w-full mt-2"><i data-lucide="log-out" class="w-4 h-4"></i>Usar otra cuenta de Google</button>';

  if (sol && sol.Estado === 'Pendiente') {
    cont.innerHTML = `<div class="text-center">
      <div class="mx-auto mb-3 h-14 w-14 rounded-full bg-oro-100 text-oro-700 flex items-center justify-center"><i data-lucide="hourglass" class="w-7 h-7"></i></div>
      <p class="font-bold text-navy-900 text-lg">Solicitud en revisión</p>
      <p class="text-sm text-slate-600 mt-1">Hola ${esc(sol.Nombres)}, Recursos Humanos está verificando tus datos. Cuando te aprueben podrás entrar con <b>${esc(d.email)}</b>.</p>
      <p class="text-xs text-slate-400 mt-2">Enviada el ${esc(String(sol.Creado).slice(0, 16))} · ${esc(sol.Departamento)}</p>
      <button data-acc="revisar-acceso" class="btn-primario w-full mt-5"><i data-lucide="refresh-cw" class="w-4 h-4"></i>Verificar de nuevo</button>${otraCuenta}</div>`;
    return iconos();
  }
  const deptos = opciones(d.departamentos, '', 'Selecciona tu departamento…');
  cont.innerHTML = `
    <p class="font-bold text-navy-900 text-lg text-center">Solicita tu acceso</p>
    <p class="text-sm text-slate-500 text-center mt-1 mb-4">Tu correo aún no está registrado. Completa tus datos y Recursos Humanos los verificará.</p>
    ${sol && sol.Estado === 'Rechazada' ? `<div class="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-700"><b>Tu solicitud anterior fue rechazada.</b>${sol.ComentarioRevision ? '<br>Motivo: ' + esc(sol.ComentarioRevision) : ''}</div>` : ''}
    <form id="f-acceso" class="space-y-3">
      <div><label class="etiqueta">Correo (verificado por Google)</label><input class="campo bg-slate-50 text-slate-500" value="${esc(d.email)}" disabled></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="etiqueta">Nombres *</label><input name="Nombres" class="campo" required maxlength="60" autocomplete="given-name" ${ATRIB_NOMBRE}></div>
        <div><label class="etiqueta">Apellidos *</label><input name="Apellidos" class="campo" required maxlength="60" autocomplete="family-name" ${ATRIB_NOMBRE}></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${campoCedulaHTML('')}
        <div><label class="etiqueta">Fecha de nacimiento *</label><input name="FechaNacimiento" type="date" class="campo" required max="${hoyStr()}"></div>
      </div>
      <div><label class="etiqueta">Sexo *</label><select name="Sexo" class="campo" required>${opciones(OPC_SEXO, '', 'Selecciona…')}</select></div>
      <div><label class="etiqueta">Departamento *</label><select name="Departamento" class="campo" required>${deptos}</select></div>
      <div><label class="etiqueta">Teléfono (opcional)</label><input name="Telefono" type="tel" inputmode="tel" data-tel class="campo" maxlength="20" placeholder="0412-1234567" autocomplete="tel"></div>
      <button type="button" data-acc="enviar-acceso" class="btn-primario w-full !mt-5"><i data-lucide="send" class="w-4 h-4"></i>Enviar solicitud</button>
    </form>${otraCuenta}`;
  iconos();
}

async function enviarAcceso() {
  const form = $('#f-acceso');
  if (!form.reportValidity()) return;
  try {
    await api('solicitarAcceso', datosFormulario(form), { texto: 'Enviando solicitud…' });
    toast('¡Solicitud enviada! Recursos Humanos la revisará.', 'ok', 6000);
    mostrarAcceso();
  } catch (e) {
    if (e.codigo !== 'NO_REGISTRADO') toast(e.message, 'error', 7000);
  }
}

/* ======================= 7. MARCAJE DE ASISTENCIA ======================= */
function mostrarMarcaje() {
  const s = S.sesion;
  mostrarVista('v-marcaje');
  fijarHash('#/asistencia');
  $('#mc-nombre').textContent = s.nombre;
  $('#mc-cargo').textContent = [s.cargo, s.departamento].filter(Boolean).join(' · ') || s.email;
  pintarAvatarPropio();
  $('#mc-volver').classList.toggle('hidden', !esGestion());
  $('#mc-horario').textContent = `${s.horario.entrada} – ${s.horario.salida} · sáb. hasta ${s.horario.salidaSabado}`;
  $('#mc-dias-max').textContent = s.diasMaxManual;
  $('#mc-solicitar').classList.toggle('hidden', !s.empleadoId);
  pintarEstadoMarcaje();
  pintarCumple();
  pintarEmpleadoMes();
  pintarDeptoMes();
  iniciarReloj();
  cargarHistorial();
  cargarMisSolicitudes();
  cargarMisPermisos();
  cargarMiAgenda();
  if (s.empleadoId) verificarUbicacion(true);
  iconos();
}

/* ---------- Cumpleaños: confeti + fanfarria ---------- */
function pintarAvatarPropio() {
  const s = S.sesion;
  if (!s) return;
  const html = fotoValida(s.fotoMini) ? `<img src="data:image/jpeg;base64,${s.fotoMini}" alt="" class="h-full w-full object-cover">` : esc(iniciales(s.nombre));
  ['#mc-avatar', '#ad-avatar'].forEach(id => { $(id).innerHTML = html; });
}

const cuando = d => d === 0 ? '¡Hoy!' : d === 1 ? 'Mañana' : `En ${d} días`;
/** "Ana", "Ana y Luis", "Ana, Luis y Rosa". */
const listaNombres = xs => xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
/** ¡Felicítala! / ¡Felicítalo! / ¡Felicítalas! / ¡Felicítalos! (si hay al menos un hombre en el grupo, va en masculino). */
function felicitalos(personas) {
  const todasMujeres = personas.length && personas.every(p => p.sexo === 'F');
  return '¡Felicítal' + (todasMujeres ? 'a' : 'o') + (personas.length > 1 ? 's' : '') + '!';
}

function pintarProximos() {
  const s = S.sesion;
  const lista = (s.proximosCumpleanos || []).filter(c => !(c.id === s.empleadoId && c.dias === 0));
  $('#mc-proximos').classList.toggle('hidden', !lista.length);
  $('#mc-proximos-lista').innerHTML = lista.map(c => `
    <div class="px-5 py-3 flex items-center gap-3">
      ${avatarHTML(c.foto, c.nombre, 'h-10 w-10 text-xs')}
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-slate-800 truncate">${esc(c.nombre)}${c.id === s.empleadoId ? ' <span class="text-xs text-slate-400">(tú)</span>' : ''}</p>
        <p class="text-xs text-slate-500 truncate">${esc(c.departamento || '')} · cumple <b class="text-marca-700">${c.edad} años</b></p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-xs font-bold ${c.dias === 0 ? 'text-marca-700' : 'text-navy-900'}">${cuando(c.dias)}</p>
        <p class="text-[11px] text-slate-400">${esc(aFecha(c.fecha).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }))}</p>
      </div>
    </div>`).join('');
}

function pintarCumple() {
  const s = S.sesion, el = $('#mc-cumple');
  const otros = (s.cumpleanerosHoy || []).filter(c => c.id !== s.empleadoId);
  pintarProximos();
  let html = '';
  if (s.cumpleanos) {
    html += `<div class="tarjeta p-5 text-center shadow-lg border-oro-300 bg-gradient-to-br from-oro-50 via-white to-marca-50">
      <p class="text-4xl mb-1">🎂</p>
      <p class="text-xl font-extrabold text-marca-700">¡Feliz cumpleaños, ${esc(String(s.nombre).split(' ')[0])}!</p>
      ${s.edadCumple ? `<p class="text-sm font-semibold text-navy-900 mt-1">Hoy cumples ${s.edadCumple} años 🎉</p>` : ''}
      <p class="text-sm text-slate-600 mt-1">Todo el equipo de Sumanpek te desea un día extraordinario.</p>
      <button id="btn-celebrar" data-acc="celebrar" class="btn btn-sm mt-3 bg-navy-900 text-white hover:bg-navy-950">🎉 ¡Celebrar!</button></div>`;
  }
  if (otros.length) {
    html += `<div class="tarjeta px-4 py-3 flex items-center gap-3 bg-oro-50 border-oro-200">
      <span class="text-2xl">🎈</span><p class="text-sm text-slate-700">Hoy ${otros.length === 1 ? 'cumple' : 'cumplen'} años: <b>${listaNombres(otros.map(o => `${esc(o.nombre)} (${o.edad})`))}</b>. ${felicitalos(otros)}</p></div>`;
  }
  el.innerHTML = html;
  el.className = html ? 'space-y-3' : 'hidden';
  let celebrado = false;
  try { celebrado = sessionStorage.getItem('aa_cumple') === s.hoy; sessionStorage.setItem('aa_cumple', s.hoy); } catch (e) { /* nada */ }
  if (s.cumpleanos && !celebrado) setTimeout(() => celebrar(), 700);
}

/** Confeti + "Happy Birthday" (MP3). Si el navegador bloquea el sonido automático, se pide un toque. */
function celebrar() {
  lanzarConfeti();
  try {
    if (S.musica) { S.musica.pause(); S.musica.currentTime = 0; }
    S.musica = S.musica || new Audio('cumpleanos.mp3');
    S.musica.volume = 0.9;
    S.musica.play().then(() => $('#btn-celebrar')?.classList.remove('animate-bounce')).catch(err => {
      if (err && err.name === 'NotAllowedError') {
        const b = $('#btn-celebrar');
        if (b) { b.textContent = '🔊 Toca para escuchar tu canción'; b.classList.add('animate-bounce'); }
      } else fanfarria();   // si el archivo no carga, suena la fanfarria sintetizada
    });
  } catch (e) { fanfarria(); }
}

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
  document.body.classList.toggle('dir-aprueba', s.rol === 'DIRECCION' && !!s.direccionPuedeAprobar);
  if (Array.isArray(s.criteriosEvaluacion) && s.criteriosEvaluacion.length) CRITERIOS = s.criteriosEvaluacion;
  const rolTxt = s.rol === 'RRHH' ? 'Recursos Humanos' : 'Dirección';
  $('#ad-nombre').textContent = s.nombre;
  $('#ad-rol').textContent = rolTxt;
  $('#ad-rol-movil').textContent = rolTxt;
  pintarAvatarPropio();

  pintarSelectoresDepto();
  $('#emp-estado').innerHTML = opciones(s.catalogos.estados, '', 'Todos los estados');
  $('#per-tipo').innerHTML = opciones(s.catalogos.tiposPermiso, '', 'Todos los tipos');
  $('#per-estado').innerHTML = opciones(s.catalogos.estadosPermiso, '', 'Todos los estados');
  actualizarInsignia(s.solicitudesPendientes || 0);
  actualizarInsignia(s.accesosPendientes || 0, 'empleados');
  actualizarInsignia(s.permisosPendientes || 0, 'permisos');
  navegar(S.seccion === 'mi-marcaje' ? 'dashboard' : S.seccion);
}

function pintarSelectoresDepto() {
  const deptos = opciones(S.sesion.departamentos || [], '', 'Todos los departamentos');
  ['#emp-depto', '#per-depto', '#ev-depto', '#dash-depto', '#asis-depto', '#cv-depto'].forEach(id => {
    const el = $(id); if (!el) return;
    const v = el.value; el.innerHTML = deptos;
    if (v && (S.sesion.departamentos || []).includes(v)) el.value = v;
  });
}

function construirNavegacion() {
  $('#nav-lateral').innerHTML = SECCIONES.map(s =>
    `<button data-acc="nav" data-sec="${s.id}" class="nav-item"><i data-lucide="${s.icono}" class="w-5 h-5"></i>${s.titulo}${['asistencia', 'empleados', 'permisos'].includes(s.id) ? `<span data-insignia="${s.id}" class="hidden ml-auto insignia bg-oro-400 text-navy-950">0</span>` : ''}</button>`).join('');
  $('#nav-movil-items').innerHTML = SECCIONES.map(s =>
    `<button data-acc="nav" data-sec="${s.id}" class="nav-movil"><i data-lucide="${s.icono}" class="w-4 h-4"></i>${s.titulo}${['asistencia', 'empleados', 'permisos'].includes(s.id) ? `<span data-insignia="${s.id}" class="hidden insignia bg-oro-400 text-navy-950">0</span>` : ''}</button>`).join('');
}

function actualizarInsignia(n, sec = 'asistencia') {
  $$(`[data-insignia="${sec}"]`).forEach(b => { b.textContent = n; b.classList.toggle('hidden', !n); });
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
     permisos: cargarPermisos, evaluaciones: cargarEvaluaciones, ajustes: cargarAjustes, tareas: cargarTareas,
     agenda: cargarAgenda, curriculums: cargarCurriculums, registro: cargarRegistro, ayuda: cargarAyuda })[sec]();
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

/* ---------- Almacén local: los datos se muestran al instante y se actualizan en segundo plano ---------- */
const VIDA_DATOS_MS = 60000;
function ventanaInicial() {
  const d = aFecha(hoyStr());
  return [fechaStr(new Date(d.getFullYear(), d.getMonth() - 1, 1)), fechaStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
}

function aplicarDatos(d) {
  S.empleados = d.empleados; S.permisos = d.permisos; S.evaluaciones = d.evaluaciones;
  S.solicitudes = d.solicitudes || []; S.accesos = d.accesos || [];
  S.reconocimientos = d.reconocimientos || [];
  S.catalogoListo = true;
  actualizarInsignia(S.permisos.filter(x => x.Estado === 'Pendiente').length, 'permisos');
  actualizarInsignia(S.solicitudes.filter(x => x.Estado === 'Pendiente').length);
  actualizarInsignia(S.accesos.filter(x => x.Estado === 'Pendiente').length, 'empleados');
}

async function cargarStore(desde, hasta) {
  const primera = !S.store;
  if (primera) cargando(true, 'Cargando datos…'); else barra(1);
  try {
    const d = await api('datosPeriodo', { desde, hasta }, { silencioso: true });
    aplicarDatos(d);
    S.store = { desde, hasta, asistencia: d.asistencia, t: Date.now() };
  } finally {
    if (primera) cargando(false); else barra(-1);
  }
}

/** Garantiza que el almacén cubra [desde, hasta]. Si está viejo, lo devuelve igual y lo refresca por detrás. */
async function asegurarStore(desde = null, hasta = null, { forzar = false } = {}) {
  if (!desde) [desde, hasta] = ventanaInicial();
  const st = S.store;
  if (st && !forzar && st.desde <= desde && st.hasta >= hasta) {
    if (Date.now() - st.t > VIDA_DATOS_MS) refrescarFondo();
    return;
  }
  if (S.cargandoStore) await S.cargandoStore;
  const d0 = st ? (desde < st.desde ? desde : st.desde) : desde;
  const h0 = st ? (hasta > st.hasta ? hasta : st.hasta) : hasta;
  const largo = (aFecha(h0) - aFecha(d0)) / 864e5 > 390;
  S.cargandoStore = cargarStore(largo ? desde : d0, largo ? hasta : h0);
  try { await S.cargandoStore; } finally { S.cargandoStore = null; }
}

function refrescarFondo() {
  if (S.refrescando || !S.store) return;
  S.refrescando = true;
  cargarStore(S.store.desde, S.store.hasta)
    .then(() => redibujar())
    .catch(() => { /* se reintenta en la próxima navegación */ })
    .finally(() => { S.refrescando = false; });
}

function redibujar() {
  if (!S.sesion || $('#v-admin').classList.contains('hidden')) return;
  const fn = { dashboard: cargarDashboard, empleados: cargarEmpleados, asistencia: cargarAsistencia,
    permisos: cargarPermisos, evaluaciones: cargarEvaluaciones, ajustes: () => {}, tareas: pintarTareas, agenda: pintarAgenda,
    curriculums: pintarCurriculums, registro: () => {}, ayuda: () => {} }[S.seccion];
  if (fn) fn();
}

async function datosPeriodo(p, forzar) {
  const f = leerFiltro(p);
  await asegurarStore(f.desde, f.hasta, { forzar });
  return { f, asistencia: S.store.asistencia.filter(a => a.Fecha >= f.desde && a.Fecha <= f.hasta) };
}

async function asegurarCatalogo(forzar = false) {
  if (forzar) { refrescarFondo(); if (S.store) return; }
  await asegurarStore();
}

/** Marca los datos como viejos: se muestran igual y se actualizan por detrás. */
function invalidarCache() { if (S.store) S.store.t = 0; }

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
    tarjetaKPI('user-x', 'Ausencias injustificadas', t.ausencias, `${t.justificados} justificadas · del ${esc(fmtFechaCorta(f.desde))} al ${esc(fmtFechaCorta(f.hasta > hoyStr() ? hoyStr() : f.hasta))}${t.pendientes ? ` · ${t.pendientes} sin marcar aún hoy` : ''} (domingos no cuentan)`, 'rosa'),
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
    data: { labels: dl, datasets: [{ data: dl.map(d => dist[d]), backgroundColor: dl.map((_, i) => colorSerie(i)), borderWidth: 3, borderColor: temaOscuro() ? '#131c31' : '#fff', hoverOffset: 10, borderRadius: 6 }] },
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
  pintarEmpleadoMesDash();
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
  const j = a.Justificativo || 'Sin justificativo (registro antiguo)';
  const clip = a.SoporteFileID ? `<button data-acc="ver-soporte" data-id="${esc(a.ID)}" class="ml-1 text-navy-700 hover:text-marca-700" title="Ver soporte"><i data-lucide="paperclip" class="w-4 h-4 inline"></i></button>` : '';
  return `<span class="insignia bg-oro-100 text-oro-700" title="${esc(a.Observacion || '')}">${esc(j)}</span>${clip}`;
}

function pintarManualesDashboard(asistencia, ids) {
  const lista = asistencia.filter(a => esManual(a) && ids.has(a.EmpleadoID))
    .map(a => Object.assign({ _e: empPorId(a.EmpleadoID) || { Nombres: a.Email, Apellidos: '' } }, a))
    .sort((a, b) => a.Fecha < b.Fecha ? 1 : -1);
  const conteo = {};
  lista.forEach(a => { const j = a.Justificativo || 'Sin justificativo (registro antiguo)'; conteo[j] = (conteo[j] || 0) + 1; });
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

/** Próximo cumpleaños de un empleado: { fecha, dias, edad }. */
function proximoCumple(e, hoy = hoyStr()) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(e.FechaNacimiento || ''))) return null;
  const md = e.FechaNacimiento.slice(5, 10) === '02-29' ? '02-28' : e.FechaNacimiento.slice(5, 10);
  let fecha = hoy.slice(0, 4) + '-' + md;
  if (fecha < hoy) fecha = (Number(hoy.slice(0, 4)) + 1) + '-' + md;
  return { fecha, dias: Math.round((aFecha(fecha) - aFecha(hoy)) / 864e5), edad: Number(fecha.slice(0, 4)) - Number(e.FechaNacimiento.slice(0, 4)) };
}

function pintarAlertas(depto, q) {
  const hoy = hoyStr(), en30 = sumarDias(hoy, 30), en7 = sumarDias(hoy, 7);
  const emps = S.empleados.filter(e => e.Estado !== 'Inactivo' && (!depto || e.Departamento === depto) && coincide(e, q));
  const ids = new Set(emps.map(e => e.ID));
  const a = [];
  const item = (icono, color, titulo, detalle, id, acc = `data-acc="ver-expediente" data-id="${esc(id)}"`) => a.push({ icono, color, titulo, detalle, id, acc });
  (S.accesos || []).filter(x => x.Estado === 'Pendiente' && (!depto || x.Departamento === depto)).forEach(x =>
    item('user-plus', 'ambar', `Solicitud de acceso: ${x.Nombres} ${x.Apellidos}`, `${x.Departamento} · ${x.Email}`, '', 'data-acc="nav" data-sec="empleados"'));
  S.solicitudes.filter(x => x.Estado === 'Pendiente' && ids.has(x.EmpleadoID)).forEach(x =>
    item('clipboard-pen', 'ambar', `Marcaje por aprobar: ${nombreCompleto(empPorId(x.EmpleadoID))}`, `${fmtFecha(x.Fecha)} · ${x.Justificativo}`, x.EmpleadoID, 'data-acc="nav" data-sec="asistencia"'));

  emps.forEach(e => {
    if (e.FinContrato && e.FinContrato < hoy) item('file-x', 'rosa', `Contrato vencido: ${nombreCompleto(e)}`, `Venció el ${fmtFecha(e.FinContrato)}`, e.ID);
    else if (e.FinContrato && e.FinContrato <= en30) item('file-clock', 'ambar', `Contrato por vencer: ${nombreCompleto(e)}`, `Vence el ${fmtFecha(e.FinContrato)}`, e.ID);
    const v = saldoVacaciones(e);
    if (v && v.pendientes >= 30) item('sun', 'azul', `Vacaciones acumuladas: ${nombreCompleto(e)}`, `${v.pendientes} días pendientes por disfrutar`, e.ID);
    if (!e.Email) item('mail-x', 'gris', `Sin correo registrado: ${nombreCompleto(e)}`, 'No podrá marcar asistencia', e.ID);
    const pc = proximoCumple(e, hoy);
    if (pc && pc.dias <= 15) item('cake', 'violeta', `Cumpleaños: ${nombreCompleto(e)} cumple ${pc.edad} años`, pc.dias === 0 ? '¡Hoy!' : `${fmtFecha(pc.fecha)} · ${cuando(pc.dias).toLowerCase()}`, e.ID);
  });
  S.permisos.filter(p => ids.has(p.EmpleadoID)).forEach(p => {
    const e = empPorId(p.EmpleadoID);
    if (p.Estado === 'Pendiente') item('hourglass', 'ambar', `Permiso por aprobar: ${nombreCompleto(e)}`, `${p.Tipo} · ${fmtFecha(p.FechaInicio)} al ${fmtFecha(p.FechaFin)}${p.Origen === 'EMPLEADO' ? ' · desde el celular' : ''}`, e.ID, 'data-acc="nav" data-sec="permisos"');
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
  try { await asegurarStore(null, null, { forzar }); } catch (e) { return toast(e.message, 'error'); }
  pintarEmpleados();
  pintarAccesos();
}

function pintarAccesos() {
  const pend = (S.accesos || []).filter(x => x.Estado === 'Pendiente')
    .sort((a, b) => a.Creado < b.Creado ? -1 : 1);
  actualizarInsignia(pend.length, 'empleados');
  $('#acc-panel').classList.toggle('hidden', !pend.length);
  $('#acc-total').textContent = `${pend.length} pendiente${pend.length === 1 ? '' : 's'}`;
  renderTabla('acc-tabla', 't-accesos', [
    { t: 'Persona', v: x => `<b>${esc(x.Nombres)} ${esc(x.Apellidos)}</b><div class="text-xs text-slate-400">${esc(x.Email)}</div>`, s: x => x.Nombres },
    { t: 'Cédula', v: x => esc(x.Cedula) },
    { t: 'Nacimiento', v: x => fmtFecha(x.FechaNacimiento) },
    { t: 'Departamento', v: x => esc(x.Departamento), s: x => x.Departamento },
    { t: 'Teléfono', v: x => esc(x.Telefono || '—') },
    { t: 'Enviada', v: x => `<span class="text-xs text-slate-500">${esc(String(x.Creado).slice(0, 16))}</span>`, s: x => x.Creado },
    { t: 'Observación', v: x => (x.Nota || x.NotaTelefono) ? [x.Nota, x.NotaTelefono].filter(Boolean).map(n => `<p class="text-xs font-semibold text-amber-700">${esc(n)}</p>`).join('') : '<span class="text-xs text-emerald-600">Sin coincidencias</span>', cls: 'envolver' },
    { t: '', v: x => `<div class="flex justify-end gap-1 solo-rrhh whitespace-nowrap">
        <button data-acc="revisar-solicitud-acceso" data-id="${esc(x.ID)}" class="btn btn-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><i data-lucide="user-check" class="w-4 h-4"></i>Revisar y aprobar</button>
        <button data-acc="rechazar-acceso" data-id="${esc(x.ID)}" class="btn btn-sm bg-rose-50 text-rose-700 hover:bg-rose-100"><i data-lucide="x" class="w-4 h-4"></i>Rechazar</button></div>`, cls: 'text-right' }
  ], pend, { pie: false });
}

function revisarAcceso(id) {
  const x = (S.accesos || []).find(a => a.ID === id);
  if (!x) return toast('Solicitud no encontrada.', 'error');
  formEmpleado(null, {
    acceso: x,
    base: { Nombres: x.Nombres, Apellidos: x.Apellidos, Cedula: x.Cedula, FechaNacimiento: x.FechaNacimiento,
      Departamento: x.Departamento, Telefono: x.Telefono, Email: x.Email, Sexo: x.Sexo }
  });
}

async function rechazarAcceso(id) {
  const x = (S.accesos || []).find(a => a.ID === id);
  const motivo = await dialogo({ titulo: 'Rechazar solicitud de acceso', mensaje: `${x ? x.Nombres + ' ' + x.Apellidos : 'La persona'} verá este motivo al iniciar sesión y podrá enviar una nueva solicitud.`,
    boton: 'Rechazar', peligro: true, conTexto: true, placeholder: 'Ej.: No trabajas en Sumanpek / La cédula no coincide.' });
  if (!motivo) return;
  try {
    await api('resolverAcceso', { id, decision: 'Rechazada', comentario: motivo }, { texto: 'Rechazando…' });
    toast('Solicitud rechazada.', 'ok');
    cargarEmpleados(true);
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function vincularAcceso(id, empId) {
  const emp = empPorId(empId);
  if (!await dialogo({ titulo: 'Vincular correo', mensaje: `El correo se agregará al expediente existente ${empId}${emp ? ' (' + nombreCompleto(emp) + ')' : ''}, sin crear uno nuevo.`, boton: 'Vincular' })) return;
  try {
    await api('resolverAcceso', { id, decision: 'Aprobada', vincularA: empId }, { texto: 'Vinculando…' });
    toast('Correo vinculado. La persona ya puede entrar.', 'ok', 6000);
    cerrarModal(); invalidarCache(); cargarEmpleados(true);
  } catch (e) { toast(e.message, 'error', 6000); }
}

function pintarEmpleados() {
  const q = $('#emp-buscar').value.trim(), dep = $('#emp-depto').value, est = $('#emp-estado').value;
  const lista = S.empleados.filter(e => coincide(e, q) && (!dep || e.Departamento === dep) && (!est || e.Estado === est)).sort(ordenarNombre);
  const activos = S.empleados.filter(e => e.Estado !== 'Inactivo').length;
  $('#emp-subtitulo').textContent = `${activos} activos · ${S.empleados.length} expedientes en total`;
  $('#print-detalle').textContent = `Listado de empleados · ${lista.length} registros · Impreso: ${new Date().toLocaleString('es-VE')}`;
  renderTabla('emp-tabla', 't-empleados', [
    { t: 'Empleado', v: e => `<div class="flex items-center gap-3">${avatarHTML(e.FotoMini, nombreCompleto(e))}<div><button data-acc="ver-expediente" data-id="${esc(e.ID)}" class="font-semibold text-slate-800 hover:text-marca-700 text-left">${esc(nombreCompleto(e))}</button><div class="text-xs text-slate-400">${esc(e.Email || 'sin correo')}</div></div></div>`, s: e => nombreCompleto(e), c: e => nombreCompleto(e) },
    { t: 'ID', v: e => `<span class="text-xs font-mono text-slate-500">${esc(e.ID)}</span>`, s: e => e.ID, c: e => e.ID },
    { t: 'Cédula', v: e => esc(e.Cedula), s: e => e.Cedula, c: e => e.Cedula },
    { t: 'Departamento', v: e => esc(e.Departamento), s: e => e.Departamento, c: e => e.Departamento },
    { t: 'Cargo', v: e => esc(e.Cargo || '—'), s: e => e.Cargo, c: e => e.Cargo },
    { t: 'Edad', v: e => edad(e.FechaNacimiento) ?? '—', s: e => edad(e.FechaNacimiento), c: e => edad(e.FechaNacimiento) ?? '', cls: 'text-right' },
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

function formEmpleado(id = null, { acceso = null, base = {}, cv = null } = {}) {
  const e = id ? empPorId(id) : Object.assign({ Estado: 'Activo', Rol: 'EMPLEADO', TipoContrato: 'Tiempo indeterminado', FechaIngreso: hoyStr() }, base);
  if (!e) return toast('Empleado no encontrado.', 'error');
  const c = (name, label, type = 'text', extra = '') =>
    `<div><label class="etiqueta">${label}</label><input name="${name}" type="${type}" class="campo" value="${esc(e[name] || '')}" ${extra}></div>`;
  const s = (name, label, lista, extra = '') =>
    `<div><label class="etiqueta">${label}</label><select name="${name}" class="campo" ${extra}>${opciones(lista, e[name] || '')}</select></div>`;
  const cat = S.sesion.catalogos;
  const volver = S.exp && S.exp.empleado.ID === id ? (() => verExpediente(id, S.expTab)) : null;
  abrirModal({
    titulo: acceso ? `Aprobar acceso: ${nombreCompleto(e)}` : id ? `Editar: ${nombreCompleto(e)}` : 'Nuevo empleado',
    ancho: 'sm:max-w-3xl',
    volver,
    cuerpo: `${acceso ? `<div class="mb-5 rounded-xl bg-navy-50 border border-navy-100 px-4 py-3 text-sm text-navy-900">
        <b>Verifica los datos que envió la persona</b> (nombre, cédula, fecha de nacimiento y departamento) y completa el resto del expediente.
        Al guardar se crea el expediente y podrá entrar con <b>${esc(acceso.Email)}</b>.
        ${acceso.Nota ? `<p class="mt-2 font-semibold text-amber-700">${esc(acceso.Nota)}</p>
          ${/(E\d+)/.test(acceso.Nota) && /sin correo\)$/.test(acceso.Nota) ? `<button type="button" data-acc="vincular-acceso" data-id="${esc(acceso.ID)}" data-emp="${esc(acceso.Nota.match(/(E\d+)/)[1])}" class="btn btn-sm mt-2 bg-white border border-navy-200 text-navy-900 hover:bg-navy-50"><i data-lucide="link" class="w-4 h-4"></i>Es la misma persona: vincular el correo a ${esc(acceso.Nota.match(/(E\d+)/)[1])}</button>`
            : '<p class="mt-1 text-xs text-amber-700">Ese expediente ya tiene su propio correo. Si es la misma persona, lo correcto es <b>rechazar</b> esta solicitud indicándole qué correo usar.</p>'}` : ''}
      </div>` : ''}
      ${cv ? `<div class="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">Datos tomados del currículum de <b>${esc(cv.Nombres + ' ' + (cv.Apellidos || ''))}</b>. Completa el resto: al guardar, el currículum queda como <b>Contratado</b> y su archivo se copia al expediente.</div>` : ''}
      <form id="f-empleado" class="space-y-6" autocomplete="off" ${acceso ? `data-acceso="${esc(acceso.ID)}"` : ''} ${cv ? `data-cv="${esc(cv.ID)}"` : ''}>
      <input type="hidden" name="ID" value="${esc(e.ID || '')}">
      <fieldset><legend class="text-sm font-bold text-marca-700 mb-3">Datos personales</legend>
        <div class="grid sm:grid-cols-2 gap-4">
          ${c('Nombres', 'Nombres *', 'text', 'required ' + ATRIB_NOMBRE)}${c('Apellidos', 'Apellidos *', 'text', 'required ' + ATRIB_NOMBRE)}
          ${campoCedulaHTML(e.Cedula)}
          <div class="grid grid-cols-2 gap-3">${c('FechaNacimiento', 'Fecha de nacimiento', 'date')}${s('Sexo', 'Sexo', [{ v: '', t: 'Sin indicar' }].concat(OPC_SEXO))}</div>
          ${c('Telefono', 'Teléfono', 'tel', 'data-tel inputmode="tel" placeholder="0412-1234567"')}
          ${c('Email', 'Correo de Google (Gmail) para iniciar sesión', 'email', acceso ? 'readonly style="background:#f8fafc;color:#64748b"' : 'placeholder="nombre@gmail.com"')}
          <div class="sm:col-span-2">${c('Direccion', 'Dirección de habitación')}</div>
        </div></fieldset>
      <fieldset><legend class="text-sm font-bold text-marca-700 mb-3">Datos laborales</legend>
        <div class="grid sm:grid-cols-3 gap-4">
          ${s('Departamento', 'Departamento *', e.Departamento && !S.sesion.departamentos.includes(e.Departamento) ? S.sesion.departamentos.concat([e.Departamento]) : S.sesion.departamentos, 'required')}${c('Cargo', 'Cargo')}${c('FechaIngreso', 'Fecha de ingreso *', 'date', 'required')}
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
          ${c('EmergenciaNombre', 'Nombre')}${c('EmergenciaTelefono', 'Teléfono', 'tel', 'data-tel inputmode="tel" placeholder="0412-1234567"')}${c('EmergenciaParentesco', 'Parentesco')}
        </div></fieldset>
      <div><label class="etiqueta">Notas internas</label><textarea name="Notas" rows="2" class="campo">${esc(e.Notas || '')}</textarea></div>
    </form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-empleado" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>${acceso ? 'Aprobar y crear expediente' : 'Guardar'}</button>`
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
    let r;
    if (form.dataset.acceso) {
      const res = await api('resolverAcceso', { id: form.dataset.acceso, decision: 'Aprobada', empleado: datos }, { texto: 'Aprobando acceso…' });
      r = res.empleado;
      S.accesos = (S.accesos || []).filter(a => a.ID !== form.dataset.acceso);
      pintarAccesos();
      toast(`Acceso aprobado. ${nombreCompleto(r)} ya puede iniciar sesión.`, 'ok', 6000);
    } else {
      r = await api('guardarEmpleado', { empleado: datos }, { texto: 'Guardando expediente…' });
    }
    const i = S.empleados.findIndex(e => e.ID === r.ID);
    if (i >= 0) S.empleados[i] = r; else S.empleados.push(r);
    invalidarCache();
    toast(datos.ID ? 'Expediente actualizado.' : `Empleado creado con ID ${r.ID}.`, 'ok');
    if (form.dataset.cv && S.cv) {
      const c = S.cv.curriculums.find(x => x.ID === form.dataset.cv);
      try {
        const rc = await api('guardarCurriculum', { curriculum: Object.assign({}, c, { Estado: 'Contratado', EmpleadoID: r.ID }) }, { texto: 'Actualizando currículum…' });
        Object.assign(c, rc);
        if (S.seccion === 'curriculums') pintarCurriculums();
      } catch (e2) { toast('El expediente se creó, pero no se pudo marcar el currículum: ' + e2.message, 'aviso', 8000); }
    }
    (r._avisos || []).forEach(a => toast(a, 'aviso', 9000));
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
          <div class="relative shrink-0">
            ${fotoValida(e.FotoMini) ? `<img src="data:image/jpeg;base64,${e.FotoMini}" alt="" class="h-16 w-16 rounded-2xl object-cover">`
              : `<div class="h-16 w-16 rounded-2xl bg-marca-700 text-white flex items-center justify-center text-xl font-extrabold">${esc(iniciales(nombreCompleto(e)))}</div>`}
            <button data-acc="cambiar-foto" data-id="${esc(e.ID)}" class="solo-rrhh no-print absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-oro-400 text-navy-950 flex items-center justify-center ring-2 ring-white" title="Cambiar foto"><i data-lucide="camera" class="w-3.5 h-3.5"></i></button>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2"><h4 class="text-xl font-extrabold text-slate-900">${esc(nombreCompleto(e))}</h4>${insigniaEstado(e.Estado)}</div>
            <p class="text-sm text-slate-500">${esc([e.Cargo, e.Departamento].filter(Boolean).join(' · '))} · <span class="font-mono text-xs">${esc(e.ID)}</span> · C.I. ${esc(e.Cedula)}</p>
            ${e.Alergias || e.CondicionesEspeciales ? `<p class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"><i data-lucide="heart-pulse" class="w-3.5 h-3.5"></i>${esc([e.Alergias ? 'Alergias: ' + e.Alergias : '', e.CondicionesEspeciales ? 'Condición especial registrada' : ''].filter(Boolean).join(' · '))}</p>` : ''}
          </div>
          <div class="flex gap-2 no-print">
            <button data-acc="reporte" data-id="${esc(e.ID)}" class="btn-sec btn-sm"><i data-lucide="file-text" class="w-4 h-4"></i>Reporte del mes</button>
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
    ${bloque('Datos personales', [campoLectura('Cédula', esc(e.Cedula)), campoLectura('Fecha de nacimiento', e.FechaNacimiento ? `${fmtFecha(e.FechaNacimiento)} <span class="text-slate-500">(${edad(e.FechaNacimiento)} años)</span>` : ''),
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
        { label: 'Hora de entrada', data: regs.map(a => +minutos(a.Entrada).toFixed(1)), borderColor: PALETA.azul, backgroundColor: conAlfa(PALETA.cian, 0.12), fill: true, pointBackgroundColor: regs.map(a => num(a.MinRetraso) > 0 ? COLORES.ausente : COLORES.aTiempo), pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 6, tension: 0.35 },
        { label: 'Límite (con tolerancia)', data: regs.map(() => lim), borderColor: PALETA.magenta, borderDash: [6, 4], pointRadius: 0 }
      ]
    },
    options: baseOpciones({ scales: { y: { ticks: { callback: aHora } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${aHora(c.parsed.y)}` } } } })
  });
}

function expEvaluaciones({ empleado: e, evaluaciones }) {
  const filas = evaluaciones.length ? `<div class="tarjeta overflow-x-auto"><table class="tabla"><thead><tr><th>Período</th>${GRUPOS_EVAL().map(g => `<th class="text-right">${g}</th>`).join('')}<th class="text-right">Promedio</th><th>Comentarios</th><th class="no-print"></th></tr></thead><tbody>
    ${evaluaciones.map(v => `<tr><td class="font-medium"><button data-acc="ver-eval" data-id="${esc(v.ID)}" class="hover:text-marca-700 text-left cap1">${esc(fmtPeriodo(v.Periodo))}</button></td>${GRUPOS_EVAL().map(g => { const x = promGrupo(v, g); return `<td class="text-right ${colorPuntaje(x)}">${x === null ? '—' : fmtNum(x)}</td>`; }).join('')}
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
    { t: '', v: x => x.Estado === 'Pendiente' ? `<div class="flex justify-end gap-1 aprobador whitespace-nowrap">
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
    const todos = S.store ? S.store.asistencia : [];
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
    { t: 'Tipo', v: p => `${esc(p.Tipo)}${p.Origen === 'EMPLEADO' ? '<div class="text-[11px] text-navy-700 font-semibold">📱 Solicitado por el empleado</div>' : ''}${p.SoporteFileID ? `<button data-acc="ver-soporte" data-id="${esc(p.ID)}" class="text-xs text-navy-700 hover:text-marca-700"><i data-lucide="paperclip" class="w-3.5 h-3.5 inline"></i> soporte</button>` : ''}`, s: p => p.Tipo, c: p => p.Tipo },
    { t: 'Desde', v: p => fmtFecha(p.FechaInicio), s: p => p.FechaInicio, c: p => p.FechaInicio },
    { t: 'Hasta', v: p => fmtFecha(p.FechaFin), s: p => p.FechaFin, c: p => p.FechaFin },
    { t: 'Días', v: p => esc(p.Dias), s: p => num(p.Dias), c: p => p.Dias, cls: 'text-right' },
    { t: 'Estado', v: p => insigniaEstado(p.Estado) + (p.ComentarioRevision ? `<p class="text-xs text-slate-500 mt-1">${esc(p.ComentarioRevision)}</p>` : ''), s: p => p.Estado, c: p => p.Estado },
    { t: 'Observación', v: p => `<span class="text-xs text-slate-500">${esc(p.Observacion)}</span>`, c: p => p.Observacion, cls: 'envolver' },
    { t: '', v: p => `<div class="flex justify-end gap-1 no-print whitespace-nowrap">
        ${p.Estado === 'Pendiente' ? `<button data-acc="estado-permiso" data-id="${esc(p.ID)}" data-estado="Aprobado" class="aprobador btn-sm btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100" title="Aprobar"><i data-lucide="check" class="w-4 h-4"></i>Aprobar</button>
        <button data-acc="estado-permiso" data-id="${esc(p.ID)}" data-estado="Rechazado" class="aprobador btn-sm btn bg-rose-50 text-rose-700 hover:bg-rose-100" title="Rechazar"><i data-lucide="x" class="w-4 h-4"></i></button>` : ''}
        <button data-acc="editar-permiso" data-id="${esc(p.ID)}" class="solo-rrhh btn-fantasma btn-sm" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button>
        <button data-acc="borrar-permiso" data-id="${esc(p.ID)}" class="solo-rrhh btn-fantasma btn-sm text-rose-600" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`, cls: 'text-right' }
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
  const quien = nombreCompleto(empPorId(p.EmpleadoID));
  let comentario = '';
  if (estado === 'Aprobado') {
    if (!await dialogo({ titulo: `¿Aprobar ${p.Tipo.toLowerCase()}?`, mensaje: `${quien} · del ${fmtFecha(p.FechaInicio)} al ${fmtFecha(p.FechaFin)} (${p.Dias} día(s)). Se le avisará por correo.`, boton: 'Aprobar' })) return;
  } else {
    comentario = await dialogo({ titulo: 'Rechazar solicitud', mensaje: `${quien} verá este motivo en su celular y en su correo.`, boton: 'Rechazar', peligro: true, conTexto: true, placeholder: 'Ej.: Esa semana hay entrega importante; propón otra fecha.' });
    if (!comentario) return;
  }
  try {
    await api('resolverPermiso', { id, decision: estado, comentario }, { texto: estado === 'Aprobado' ? 'Aprobando…' : 'Rechazando…' });
    toast(`Permiso ${estado.toLowerCase()}.`, 'ok');
    await asegurarStore(null, null, { forzar: true }); pintarPermisos();
  } catch (e) { toast(e.message, 'error', 6000); }
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
    data: { labels: CRITERIOS.map(c => c.t), datasets: [{ label: 'Promedio', data: CRITERIOS.map(c => { const xs = lista.filter(v => String(v[c.k] ?? '') !== '').map(v => num(v[c.k])); return xs.length ? +prom(xs).toFixed(1) : null; }), borderColor: PALETA.magenta, backgroundColor: conAlfa(PALETA.magenta, 0.16), borderWidth: 2, pointBackgroundColor: CRITERIOS.map((_, i) => colorSerie(i + 1)), pointBorderColor: '#fff', pointRadius: 6 }] },
    options: baseOpciones({ plugins: { legend: { display: false } }, scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, display: false }, pointLabels: { font: { size: 10 } } } } })
  });

  renderTabla('ev-tabla', 't-evaluaciones', [
    { t: 'Empleado', v: v => `<button data-acc="ver-eval" data-id="${esc(v.ID)}" class="font-semibold text-slate-800 hover:text-marca-700 text-left">${esc(nombreCompleto(v._e))}</button><div class="text-xs text-slate-400">${esc(v._e.Departamento || '')}</div>`, s: v => nombreCompleto(v._e), c: v => nombreCompleto(v._e) },
    { t: 'Departamento', v: v => esc(v._e.Departamento), c: v => v._e.Departamento, cls: 'hidden' },
    { t: 'Período', v: v => `<span class="cap1">${esc(fmtPeriodo(v.Periodo))}</span>`, s: v => v.Periodo, c: v => v.Periodo },
    ...GRUPOS_EVAL().map(g => ({ t: g, v: v => { const x = promGrupo(v, g); return `<span class="${colorPuntaje(x)}">${x === null ? '—' : fmtNum(x)}</span>`; }, s: v => promGrupo(v, g) ?? -1, cls: 'text-right' })),
    ...CRITERIOS.map(c => ({ t: c.t, v: v => esc(v[c.k]), c: v => v[c.k] ?? '', cls: 'hidden' })),
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
      <p class="text-xs text-slate-500">Califica cada criterio de 0 a 100. Si alguno no corresponde a su cargo (por ejemplo, atención al cliente), marca <b>No aplica</b> y no contará en el promedio.</p>
      ${GRUPOS_EVAL().map(g => `<div class="tarjeta p-4 space-y-4"><p class="text-xs font-bold uppercase tracking-wide text-marca-700">${g}</p>
        ${CRITERIOS.filter(c => c.g === g).map(c => `<div data-fila="${c.k}">
          <div class="flex justify-between items-center gap-2 mb-1"><label class="etiqueta mb-0">${c.t}</label>
            <div class="flex items-center gap-2">${c.k === 'Puntualidad' ? '<button type="button" data-acc="calc-puntualidad" class="text-xs font-semibold text-marca-700 hover:underline">Calcular desde asistencia</button>' : ''}
            <label class="flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap"><input type="checkbox" data-na="${c.k}" class="h-3.5 w-3.5"> No aplica</label>
            <input name="${c.k}" type="number" min="0" max="100" required class="campo w-20 py-1.5 text-right font-bold" value="80" data-criterio></div></div>
          <input type="range" min="0" max="100" value="80" class="w-full accent-[#C10866]" data-rango="${c.k}"></div>`).join('')}</div>`).join('')}
      <div class="tarjeta p-4 flex justify-between items-center"><span class="text-sm font-semibold">Promedio <span id="ev-n" class="text-xs text-slate-400"></span></span><span id="ev-prom" class="text-2xl font-extrabold text-marca-700">80</span></div>
      <div><label class="etiqueta">Comentarios y plan de mejora</label><textarea name="Comentarios" rows="3" class="campo" placeholder="Fortalezas, oportunidades de mejora, compromisos…"></textarea></div>
    </form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-eval" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Guardar evaluación</button>`
  });
  const form = $('#f-eval');
  const promedio = () => {
    const vals = CRITERIOS.filter(c => !form[c.k].disabled).map(c => num(form[c.k].value));
    const p = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
    $('#ev-prom').textContent = fmtNum(p);
    $('#ev-prom').className = `text-2xl font-extrabold ${colorPuntaje(p)}`;
    $('#ev-n').textContent = `(${vals.length} de ${CRITERIOS.length} criterios)`;
  };
  $$('[data-na]', form).forEach(ch => ch.addEventListener('change', () => {
    const k = ch.dataset.na, inp = form[k], rg = $(`[data-rango="${k}"]`, form);
    inp.disabled = rg.disabled = ch.checked; inp.required = !ch.checked;
    $(`[data-fila="${k}"]`, form).classList.toggle('opacity-40', ch.checked);
    promedio();
  }));
  promedio();
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
  CRITERIOS.forEach(c => { if (form[c.k].disabled) datos[c.k] = ''; });
  if (CRITERIOS.filter(c => datos[c.k] !== '').length < 3) return toast('Califica al menos 3 criterios.', 'aviso');
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

/* ======================= 17b. FOTO DE PERFIL (con recorte) ======================= */
function cambiarFoto(empleadoId = null) {
  if (!empleadoId && !S.sesion?.empleadoId) return toast('Tu correo no tiene expediente de empleado, así que no puedes tener foto de perfil.', 'aviso');
  S.fotoDestino = empleadoId;
  const inp = $('#foto-input');
  inp.value = '';
  inp.click();
}

/** Abre la foto elegida para que la persona la encuadre a su gusto (mover, acercar y girar). */
async function abrirRecorte(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) return toast('Elige una imagen (JPG o PNG).', 'aviso');
  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('No se pudo leer la imagen. Prueba con una foto JPG o PNG.'));
      i.src = url;
    });
  } catch (e) { URL.revokeObjectURL(url); return toast(e.message, 'error'); }
  // Las fotos de cámara (12 MP o más) se reducen para que mover y acercar sea fluido.
  const k0 = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const base = document.createElement('canvas');
  base.width = Math.max(1, Math.round(img.naturalWidth * k0));
  base.height = Math.max(1, Math.round(img.naturalHeight * k0));
  base.getContext('2d').drawImage(img, 0, 0, base.width, base.height);
  URL.revokeObjectURL(url);
  const destino = S.fotoDestino || null;
  const empExp = S.exp?.empleado.ID, tabExp = S.expTab;
  abrirModal({
    titulo: destino && destino !== S.sesion.empleadoId ? `Foto de ${nombreCompleto(empPorId(destino))}` : 'Ajusta tu foto',
    ancho: 'sm:max-w-md',
    volver: empExp ? (() => verExpediente(empExp, tabExp)) : null,
    cuerpo: `<div class="space-y-4">
      <div id="rec-marco" class="relative mx-auto w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden bg-navy-950 cursor-grab">
        <canvas id="rec-canvas" width="640" height="640" class="absolute inset-0 h-full w-full"></canvas>
        <div id="rec-mascara" class="pointer-events-none absolute inset-0"></div>
        <div class="pointer-events-none absolute inset-[1px] rounded-full ring-2 ring-white/80"></div>
      </div>
      <div class="flex items-center gap-3 px-2">
        <button type="button" data-acc="rec-zoom" data-paso="-0.25" class="btn-fantasma btn-sm" title="Alejar"><i data-lucide="zoom-out" class="w-4 h-4"></i></button>
        <input id="rec-zoom" type="range" min="1" max="4" step="0.01" value="1" class="flex-1" aria-label="Acercar o alejar">
        <button type="button" data-acc="rec-zoom" data-paso="0.25" class="btn-fantasma btn-sm" title="Acercar"><i data-lucide="zoom-in" class="w-4 h-4"></i></button>
      </div>
      <div class="flex justify-center gap-2">
        <button type="button" data-acc="rec-girar" class="btn-sec btn-sm"><i data-lucide="rotate-cw" class="w-4 h-4"></i>Girar</button>
        <button type="button" data-acc="rec-centrar" class="btn-sec btn-sm"><i data-lucide="scan" class="w-4 h-4"></i>Centrar</button>
      </div>
      <p class="text-xs text-slate-500 text-center">Arrastra la foto para moverla y usa la barra (o pellizca con dos dedos) para acercarla.<br>Lo que queda dentro del círculo será la foto de perfil.</p>
    </div>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="rec-guardar" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Usar esta foto</button>`
  });
  iniciarRecorte(base, destino);
}

function iniciarRecorte(original, destino) {
  const cv = $('#rec-canvas'), ctx = cv.getContext('2d'), L = cv.width, marco = $('#rec-marco');
  const R = S.recorte = { src: original, zoom: 1, x: 0, y: 0, destino };
  const medidas = () => { const k = Math.max(L / R.src.width, L / R.src.height) * R.zoom; return { w: R.src.width * k, h: R.src.height * k }; };
  const dibujar = () => {
    const m = medidas();
    R.x = Math.min(0, Math.max(L - m.w, R.x));
    R.y = Math.min(0, Math.max(L - m.h, R.y));
    ctx.fillStyle = '#020b3f'; ctx.fillRect(0, 0, L, L);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(R.src, R.x, R.y, m.w, m.h);
  };
  R.zoomA = (z, ax = L / 2, ay = L / 2) => {
    z = Math.min(4, Math.max(1, z));
    const f = z / R.zoom;
    R.x = ax - (ax - R.x) * f; R.y = ay - (ay - R.y) * f; R.zoom = z;
    $('#rec-zoom').value = z;
    dibujar();
  };
  R.centrar = () => { R.zoom = 1; $('#rec-zoom').value = 1; const m = medidas(); R.x = (L - m.w) / 2; R.y = (L - m.h) / 2; dibujar(); };
  R.girar = () => {
    const c = document.createElement('canvas');
    c.width = R.src.height; c.height = R.src.width;
    const x = c.getContext('2d');
    x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(R.src, 0, 0);
    R.src = c; R.centrar();
  };
  R.exportar = (px, calidad) => {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const x = c.getContext('2d'), f = px / L, m = medidas();
    x.imageSmoothingQuality = 'high';
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, px, px);
    x.drawImage(R.src, R.x * f, R.y * f, m.w * f, m.h * f);
    return c.toDataURL('image/jpeg', calidad).split(',')[1];
  };
  // Arrastrar con el dedo o el ratón, y pellizcar con dos dedos
  const punteros = new Map();
  let ultimo = null, dist0 = 0, zoom0 = 1;
  const pos = ev => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) * L / r.width, y: (ev.clientY - r.top) * L / r.height }; };
  marco.addEventListener('pointerdown', ev => {
    try { marco.setPointerCapture(ev.pointerId); } catch (e) { /* nada */ }
    punteros.set(ev.pointerId, pos(ev)); ultimo = pos(ev);
    if (punteros.size === 2) { const [a, b] = [...punteros.values()]; dist0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = R.zoom; }
    marco.classList.replace('cursor-grab', 'cursor-grabbing');
  });
  marco.addEventListener('pointermove', ev => {
    if (!punteros.has(ev.pointerId)) return;
    const p = pos(ev);
    punteros.set(ev.pointerId, p);
    if (punteros.size >= 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist0) R.zoomA(zoom0 * d / dist0, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    R.x += p.x - ultimo.x; R.y += p.y - ultimo.y; ultimo = p;
    dibujar();
  });
  const soltar = ev => {
    punteros.delete(ev.pointerId);
    if (punteros.size === 1) ultimo = [...punteros.values()][0];
    if (!punteros.size) marco.classList.replace('cursor-grabbing', 'cursor-grab');
  };
  marco.addEventListener('pointerup', soltar);
  marco.addEventListener('pointercancel', soltar);
  marco.addEventListener('wheel', ev => { ev.preventDefault(); const p = pos(ev); R.zoomA(R.zoom * Math.exp(-ev.deltaY * 0.0015), p.x, p.y); }, { passive: false });
  $('#rec-zoom').addEventListener('input', ev => R.zoomA(Number(ev.target.value)));
  R.centrar();
}

async function guardarRecorte() {
  const R = S.recorte;
  if (!R) return;
  const mini = R.exportar(128, 0.82), grande = R.exportar(512, 0.86);
  try {
    const r = await api('subirFoto', { empleadoId: R.destino || undefined, mini, grande }, { texto: 'Subiendo foto…' });
    S.recorte = null;
    const emp = empPorId(r.empleadoId);
    if (emp) emp.FotoMini = r.FotoMini;
    if (r.empleadoId === S.sesion.empleadoId) { S.sesion.fotoMini = r.FotoMini; pintarAvatarPropio(); }
    toast('¡Foto actualizada!', 'ok');
    if (S.exp && S.exp.empleado.ID === r.empleadoId) verExpediente(r.empleadoId, S.expTab);
    else cerrarModal();
    if (S.seccion === 'empleados' && !$('#v-admin').classList.contains('hidden')) pintarEmpleados();
  } catch (e) { toast(e.message, 'error', 6000); }
}

/* ======================= 17d. MODO OSCURO ======================= */
const temaOscuro = () => document.documentElement.classList.contains('dark');
function aplicarTema(oscuro) {
  document.documentElement.classList.toggle('dark', oscuro);
  try { localStorage.setItem('aa_tema', oscuro ? 'oscuro' : 'claro'); } catch (e) { /* nada */ }
  $('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0b1120' : '#031263');
  $$('.icono-tema').forEach(el => {
    const i = document.createElement('i');
    i.setAttribute('data-lucide', oscuro ? 'sun' : 'moon');
    i.className = (el.getAttribute('class') || '').split(/\s+/).filter(c => /^(w|h)-/.test(c)).join(' ') + ' icono-tema';
    el.replaceWith(i);
  });
  if (window.Chart) { Chart.defaults.color = oscuro ? '#9aa8bd' : '#64748b'; Chart.defaults.borderColor = oscuro ? '#26324f' : '#e2e8f0'; }
  iconos();
}
function alternarTema(oscuro = !temaOscuro()) {
  aplicarTema(oscuro);
  if (S.sesion && !$('#v-admin').classList.contains('hidden')) {
    if (S.seccion === 'ajustes' && S.ajustes) pintarAjustes(); else redibujar();
  }
}

/* ======================= 17e. EMPLEADO: PERMISOS Y EMPLEADO DEL MES ======================= */
function pintarEmpleadoMes() {
  const m = S.sesion?.empleadoDelMes, el = $('#mc-mes');
  if (!m) { el.className = 'hidden'; el.innerHTML = ''; return; }
  const yo = m.id === S.sesion.empleadoId;
  el.className = 'tarjeta p-4 flex items-center gap-4 border-oro-300 bg-gradient-to-br from-oro-50 via-white to-marca-50';
  el.innerHTML = `<div class="relative shrink-0">${avatarHTML(m.foto, m.nombre, 'h-16 w-16 text-lg ring-4 ring-oro-400')}<span class="absolute -bottom-1 -right-2 text-2xl">🏆</span></div>
    <div class="min-w-0">
      <p class="text-[11px] font-bold uppercase tracking-wide text-oro-700">${gen(m.sexo, 'Empleada', 'Empleado')} del mes · ${esc(fmtPeriodo(m.periodo))}</p>
      <p class="font-extrabold text-navy-900 truncate">${yo ? `¡Eres tú, ${esc(m.nombre.split(' ')[0])}! 🎉` : esc(m.nombre)}</p>
      <p class="text-xs text-slate-500 truncate">${esc([m.cargo, m.departamento].filter(Boolean).join(' · '))}</p>
      ${m.motivo ? `<p class="text-xs text-slate-600 mt-1 italic">“${esc(m.motivo)}”</p>` : ''}
    </div>`;
}

async function cargarMisPermisos() {
  const card = $('#mc-permisos');
  if (!S.sesion?.empleadoId) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  try {
    const d = await api('misPermisos', {}, { silencioso: true });
    S.misPermisos = d;
    const v = d.saldo;
    $('#mc-saldo').innerHTML = v ? `Vacaciones disponibles: <b class="text-marca-700">${v.pendientes} día${v.pendientes === 1 ? '' : 's'}</b>${v.enSolicitud ? ` · ${v.enSolicitud} en solicitud` : ''}` : 'Vacaciones, reposos y permisos';
    const lista = d.permisos.slice(0, 6);
    $('#mc-permisos-lista').innerHTML = lista.length ? lista.map(x => `
      <div class="px-5 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-800">${esc(x.Tipo)}</p>
            <p class="text-xs text-slate-500">${esc(fmtFecha(x.FechaInicio))}${x.FechaFin !== x.FechaInicio ? ' → ' + esc(fmtFecha(x.FechaFin)) : ''} · ${esc(x.Dias)} día(s)${x.TieneSoporte ? ' · 📎' : ''}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">${insigniaEstado(x.Estado)}${x.Estado === 'Pendiente' ? `<button data-acc="anular-permiso" data-id="${esc(x.ID)}" class="btn-fantasma btn-sm text-rose-600" title="Anular solicitud"><i data-lucide="x" class="w-4 h-4"></i></button>` : ''}</div>
        </div>
        ${x.ComentarioRevision ? `<p class="text-xs mt-1.5 rounded-lg px-2.5 py-1.5 ${x.Estado === 'Rechazado' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}">RRHH: ${esc(x.ComentarioRevision)}</p>` : ''}
      </div>`).join('') : '<p class="px-5 py-4 text-xs text-slate-400 text-center">Aún no tienes solicitudes. Toca <b>Solicitar</b> para pedir vacaciones o un permiso.</p>';
    iconos();
  } catch (e) { $('#mc-saldo').textContent = 'No se pudo cargar. Desliza para actualizar.'; }
}

function formSolicitarPermiso() {
  const s = S.sesion, hoy = hoyStr(), v = S.misPermisos?.saldo;
  const min = sumarDias(hoy, -30), max = sumarDias(hoy, 366), ini = sumarDias(hoy, 7);
  abrirModal({
    titulo: 'Solicitar vacaciones o permiso',
    ancho: 'sm:max-w-lg',
    cuerpo: `<form id="f-mi-permiso" class="space-y-4">
      <div><label class="etiqueta">Tipo *</label><select name="tipo" class="campo" required>${opciones(s.tiposPermiso || [], 'Vacaciones')}</select></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="etiqueta">Desde *</label><input name="desde" type="date" class="campo" required min="${min}" max="${max}" value="${ini}"></div>
        <div><label class="etiqueta">Hasta *</label><input name="hasta" type="date" class="campo" required min="${min}" max="${max}" value="${ini}"></div>
      </div>
      <div id="mp-resumen" class="rounded-xl bg-navy-50 text-navy-900 px-4 py-3 text-sm"></div>
      <div><label id="mp-obs-etq" class="etiqueta">Observación</label><textarea name="observacion" rows="2" maxlength="500" class="campo" placeholder="Ej.: Viaje familiar / Cita médica en el ambulatorio…"></textarea></div>
      <div><label class="etiqueta">Soporte (opcional): foto o PDF</label>
        <input name="archivo" type="file" accept="image/*,application/pdf" class="campo file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:px-3 file:py-1 file:text-marca-700 file:font-semibold">
        <p class="text-xs text-slate-400 mt-1">Para un reposo, toma una foto del certificado médico.</p></div>
      <p class="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">Tu solicitud quedará <b>pendiente</b> hasta que Recursos Humanos la apruebe. Verás la respuesta aquí y también te llegará por correo.</p>
    </form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="enviar-permiso" class="btn-primario"><i data-lucide="send" class="w-4 h-4"></i>Enviar solicitud</button>`
  });
  const f = $('#f-mi-permiso');
  const resumen = () => {
    if (f.hasta.value && f.desde.value && f.hasta.value < f.desde.value) f.hasta.value = f.desde.value;
    const dias = f.desde.value && f.hasta.value ? rangoFechas(f.desde.value, f.hasta.value).filter(x => s.diasLaborables.includes(diaSemana(x))).length : 0;
    let txt = `<b>${dias}</b> día${dias === 1 ? '' : 's'} hábil${dias === 1 ? '' : 'es'}`;
    if (f.tipo.value === 'Vacaciones' && v) {
      const quedan = v.pendientes - v.enSolicitud - dias;
      txt += ` · Te quedarían <b class="${quedan < 0 ? 'text-rose-600' : ''}">${quedan}</b> de ${v.pendientes} días de vacaciones${quedan < 0 ? ' (RRHH decidirá si puede adelantarlas)' : ''}.`;
    }
    $('#mp-resumen').innerHTML = txt;
    const otro = f.tipo.value === TIPO_OTRO;
    f.observacion.required = otro;
    $('#mp-obs-etq').textContent = otro ? 'Motivo *' : 'Observación';
  };
  ['tipo', 'desde', 'hasta'].forEach(n => f[n].addEventListener('change', resumen));
  resumen();
}

async function enviarSolicitudPermiso() {
  const f = $('#f-mi-permiso');
  if (!f.reportValidity()) return;
  const d = { tipo: f.tipo.value, desde: f.desde.value, hasta: f.hasta.value, observacion: f.observacion.value.trim() };
  try {
    cargando(true, 'Preparando soporte…');
    try { d.archivo = await archivoParaEnviar(f.archivo.files[0]); } finally { cargando(false); }
    await api('solicitarPermiso', d, { texto: 'Enviando solicitud…' });
    toast('Solicitud enviada. RRHH te responderá pronto.', 'ok', 6000);
    cerrarModal(); invalidarCache();
    cargarMisPermisos();
  } catch (e) { toast(e.message, 'error', 7000); }
}

async function anularMiPermiso(id) {
  if (!await confirmar('Tu solicitud pendiente se anulará y RRHH ya no la verá.', { titulo: '¿Anular solicitud?', boton: 'Anular' })) return;
  try {
    await api('cancelarMiPermiso', { id }, { texto: 'Anulando…' });
    toast('Solicitud anulada.', 'ok'); invalidarCache();
    cargarMisPermisos();
  } catch (e) { toast(e.message, 'error'); }
}

/* ======================= 17f. EMPLEADO DEL MES (DASHBOARD) ======================= */
async function pintarEmpleadoMesDash() {
  const cont = $('#dash-mes-cuerpo'), per = $('#dash-mes-periodo')?.value;
  if (!cont || !per) return;
  const [y, m] = per.split('-').map(Number);
  const hoy = hoyStr(), desde = `${per}-01`, fin = fechaStr(new Date(y, m, 0)), hasta = fin > hoy ? hoy : fin;
  if (desde > hoy) { cont.innerHTML = '<p class="lg:col-span-5 text-sm text-slate-400 text-center py-6">Elige un mes que ya haya comenzado.</p>'; return; }
  try { await asegurarStore(desde, hasta); } catch (e) { cont.innerHTML = `<p class="lg:col-span-5 text-sm text-rose-600">${esc(e.message)}</p>`; return; }
  const asis = S.store.asistencia.filter(a => a.Fecha >= desde && a.Fecha <= hasta);
  const emps = empleadosDelPeriodo(desde, hasta, '', '').filter(e => e.Estado !== 'Inactivo');
  const k = calcularKPIs(emps, asis, S.permisos, S.evaluaciones, desde, hasta);
  const rank = k.filas.filter(r => r.asistidos > 0 && r.esperados > 0).map(r => {
    const p = r.pctPuntualidad ?? 0, a = r.pctAsistencia ?? 100;
    return Object.assign({ puntaje: r.evalProm !== null ? p * 0.4 + a * 0.3 + r.evalProm * 0.3 : p * 0.55 + a * 0.45 }, r);
  }).sort((a, b) => b.puntaje - a.puntaje || a.minRetraso - b.minRetraso || b.minTrabajados - a.minTrabajados).slice(0, 5);
  const rec = (S.reconocimientos || []).find(x => x.Periodo === per && x.Tipo !== 'DEPARTAMENTO');
  const g = rec ? empPorId(rec.EmpleadoID) : null;
  const izq = g ? `<div class="h-full rounded-2xl p-5 text-center bg-gradient-to-br from-oro-50 via-white to-marca-50 border border-oro-300">
      <div class="relative inline-block">${avatarHTML(g.FotoMini, nombreCompleto(g), 'h-24 w-24 text-2xl ring-4 ring-oro-400 mx-auto')}<span class="absolute -bottom-1 -right-2 text-3xl">🏆</span></div>
      <p class="mt-3 text-lg font-extrabold text-navy-900">${esc(nombreCompleto(g))}</p>
      <p class="text-xs text-slate-500">${esc([g.Cargo, g.Departamento].filter(Boolean).join(' · '))}</p>
      <p class="mt-1 text-xs font-bold uppercase tracking-wide text-oro-700">${gen(sexoDe(g), 'Empleada', 'Empleado')} del mes · ${esc(fmtPeriodo(per))}</p>
      ${rec.Motivo ? `<p class="mt-2 text-sm italic text-slate-600">“${esc(rec.Motivo)}”</p>` : ''}
      ${rec.Puntaje ? `<p class="mt-1 text-xs text-slate-400">Puntaje: ${esc(rec.Puntaje)}</p>` : ''}
      <button data-acc="quitar-reconocimiento" data-id="${esc(rec.ID)}" class="btn-fantasma btn-sm mt-3 solo-rrhh no-print"><i data-lucide="x" class="w-4 h-4"></i>Quitar</button>
    </div>`
    : `<div class="h-full rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center text-center">
      <span class="text-4xl">🏆</span>
      <p class="mt-2 font-semibold text-slate-700">Sin empleado del mes para ${esc(fmtPeriodo(per))}</p>
      <p class="text-xs text-slate-500 mt-1">${esRRHH() ? 'Elige del ranking y pulsa <b>Reconocer</b>. Aparecerá en la app de todo el personal y le llegará un correo de felicitación.' : 'Recursos Humanos aún no lo ha elegido.'}</p></div>`;
  const der = rank.length ? `<div class="space-y-2">${rank.map((r, i) => `
      <div class="flex items-center gap-3 rounded-xl p-2.5 ${rec && rec.EmpleadoID === r.e.ID ? 'bg-oro-50' : 'hover:bg-slate-50'}">
        <span class="w-6 text-center font-extrabold ${i === 0 ? 'text-oro-600' : 'text-slate-400'}">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
        ${avatarHTML(r.e.FotoMini, nombreCompleto(r.e))}
        <div class="flex-1 min-w-0">
          <button data-acc="ver-expediente" data-id="${esc(r.e.ID)}" class="block font-semibold text-slate-800 hover:text-marca-700 truncate text-left">${esc(nombreCompleto(r.e))}</button>
          <p class="text-xs text-slate-500 truncate">${esc(r.e.Departamento)} · puntualidad ${fmtPct(r.pctPuntualidad)} · asistencia ${fmtPct(r.pctAsistencia)}${r.evalProm !== null ? ` · desempeño ${fmtNum(r.evalProm)}` : ''}</p>
        </div>
        <span class="text-lg font-extrabold tabular-nums ${colorPuntaje(r.puntaje)}">${fmtNum(r.puntaje)}</span>
        <button data-acc="reconocer" data-id="${esc(r.e.ID)}" data-puntaje="${r.puntaje.toFixed(1)}" class="btn btn-sm bg-oro-400 text-navy-950 hover:bg-oro-300 solo-rrhh no-print">Reconocer</button>
      </div>`).join('')}</div>`
    : '<p class="text-sm text-slate-400 text-center py-8">No hay marcajes en ese mes para calcular el ranking.</p>';
  cont.innerHTML = `<div class="lg:col-span-2">${izq}</div><div class="lg:col-span-3">${der}</div>`;
  pintarDeptoMesDash(per, k.filas);
  iconos();
}

async function reconocerEmpleado(id, puntaje) {
  const per = $('#dash-mes-periodo').value, e = empPorId(id);
  const motivo = await dialogo({ titulo: `Empleado del mes · ${fmtPeriodo(per)}`,
    mensaje: `${nombreCompleto(e)} aparecerá en la app de todo el personal y recibirá un correo de felicitación. Escribe el motivo (lo verán todos):`,
    boton: 'Reconocer 🏆', conTexto: true, valor: 'Por su puntualidad, su compromiso y su excelente desempeño.' });
  if (!motivo) return;
  try {
    const r = await api('reconocer', { periodo: per, empleadoId: id, motivo, puntaje }, { texto: 'Guardando…' });
    S.reconocimientos = (S.reconocimientos || []).filter(x => !(x.Periodo === per && x.Tipo !== 'DEPARTAMENTO')).concat([r]);
    toast(`¡${nombreCompleto(e)} es ${gen(sexoDe(e), 'la empleada', 'el empleado')} del mes!`, 'ok', 6000);
    lanzarConfeti(2500);
    pintarEmpleadoMesDash();
  } catch (err) { toast(err.message, 'error'); }
}

async function quitarReconocimiento(id) {
  if (!await confirmar('Se quitará el reconocimiento de ese mes.', { titulo: '¿Quitar empleado del mes?', boton: 'Quitar' })) return;
  try {
    await api('quitarReconocimiento', { id }, { texto: 'Quitando…' });
    S.reconocimientos = (S.reconocimientos || []).filter(x => x.ID !== id);
    pintarEmpleadoMesDash();
  } catch (e) { toast(e.message, 'error'); }
}

/* ======================= 17g. REPORTE MENSUAL (IMPRIMIR / PDF) ======================= */
async function formReporte(empId = null) {
  try { await asegurarCatalogo(); } catch (e) { return toast(e.message, 'error'); }
  const empExp = S.exp?.empleado.ID, tabExp = S.expTab;
  const lista = S.empleados.slice().sort(ordenarNombre);
  abrirModal({
    titulo: 'Reporte mensual de asistencia',
    ancho: 'sm:max-w-5xl',
    volver: empExp ? (() => verExpediente(empExp, tabExp)) : null,
    cuerpo: `<div class="no-print grid sm:grid-cols-3 gap-3 mb-5">
        <div><label class="etiqueta">Mes</label>${selectorMesHTML('rep-mes', hoyStr().slice(0, 7))}</div>
        <div><label class="etiqueta">Departamento</label><select id="rep-depto" class="campo">${opciones(S.sesion.departamentos || [], '', 'Todos los departamentos')}</select></div>
        <div><label class="etiqueta">Empleado</label><select id="rep-emp" class="campo">${opciones(lista.map(e => ({ v: e.ID, t: nombreCompleto(e) })), empId || '', 'Reporte general (todos)')}</select></div>
      </div>
      <p class="no-print text-xs text-slate-500 mb-3">Para guardarlo como PDF: pulsa <b>Imprimir / Guardar PDF</b> y en "Destino" elige <b>Guardar como PDF</b>.</p>
      <div id="rep-hoja" class="rounded-xl border border-slate-200 p-5 sm:p-7"></div>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cerrar</button><button data-acc="imprimir-modal" class="btn-primario"><i data-lucide="printer" class="w-4 h-4"></i>Imprimir / Guardar PDF</button>`
  });
  ['#rep-mes', '#rep-depto', '#rep-emp'].forEach(id => $(id).addEventListener('change', generarReporte));
  generarReporte();
}

async function generarReporte() {
  const per = $('#rep-mes')?.value, depto = $('#rep-depto').value, empId = $('#rep-emp').value, cont = $('#rep-hoja');
  if (!per || !cont) return;
  const hoy = hoyStr(), [y, m] = per.split('-').map(Number);
  const desde = `${per}-01`, fin = fechaStr(new Date(y, m, 0)), hasta = fin > hoy ? hoy : fin;
  if (desde > hoy) { cont.innerHTML = '<p class="text-center text-sm text-slate-400 py-10">Ese mes todavía no comienza.</p>'; return; }
  cont.innerHTML = '<p class="text-center text-sm text-slate-400 py-10 pulso">Preparando el reporte…</p>';
  try { await asegurarStore(desde, hasta); } catch (e) { cont.innerHTML = `<p class="text-center text-sm text-rose-600 py-10">${esc(e.message)}</p>`; return; }
  const asis = S.store.asistencia.filter(a => a.Fecha >= desde && a.Fecha <= hasta);
  const mesTxt = fmtPeriodo(per);
  $('#print-detalle').textContent = '';
  const encabezado = (titulo, sub) => `<div class="flex flex-wrap items-start justify-between gap-4 pb-4 mb-5 border-b-2 border-navy-900">
      <div class="flex items-center gap-3"><img src="logo.png" alt="" class="h-14 w-14 object-contain">
        <div><p class="text-lg font-extrabold text-navy-900 leading-tight">Sumanpek, C.A.</p><p class="text-xs text-slate-500">Recursos Humanos · Control de asistencia</p></div></div>
      <div class="text-right"><p class="font-extrabold text-slate-900">${esc(titulo)}</p><p class="text-sm text-slate-600 cap1">${esc(sub)}</p>
        <p class="text-[11px] text-slate-400">Generado el ${esc(new Date().toLocaleString('es-VE'))}</p></div></div>`;
  const chip = (t, v, c = 'text-slate-900') => `<div class="rounded-xl border border-slate-200 px-3 py-2"><p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">${t}</p><p class="text-lg font-extrabold ${c} tabular-nums">${v}</p></div>`;
  const pie = firmas => `<div class="rep-firma grid gap-10 mt-14" style="grid-template-columns:repeat(${firmas.length},minmax(0,1fr))">${firmas.map(f => `<div class="text-center"><div class="border-t border-slate-400 pt-1 text-xs text-slate-600">${esc(f)}</div></div>`).join('')}</div>
      <p class="text-[10px] text-slate-400 mt-6 text-center">Asistencia Sumanpek, C.A. · © Anabel Martínez RRHH · ${hasta < fin ? `Datos hasta el ${esc(fmtFecha(hasta))} (mes en curso).` : 'Mes completo.'}</p>`;

  if (empId) {
    const e = empPorId(empId);
    const r = calcularKPIs([e], asis, S.permisos, S.evaluaciones, desde, hasta).filas[0];
    const idx = new Map(asis.filter(a => a.EmpleadoID === e.ID).map(a => [a.Fecha, a]));
    const lab = S.sesion.diasLaborables;
    const perms = S.permisos.filter(p => p.EmpleadoID === e.ID && p.Estado === 'Aprobado');
    const filas = rangoFechas(desde, hasta).map(f => {
      const a = idx.get(f), laborable = lab.includes(diaSemana(f));
      const pe = perms.find(p => p.FechaInicio <= f && p.FechaFin >= f);
      let obs = '', cls = '';
      if (a) obs = esManual(a) ? 'Manual · ' + (a.Justificativo || 'registro de RRHH') : (!a.Salida && f < hoy ? 'Sin salida' : '');
      else if (pe) obs = pe.Tipo;
      else if (!laborable) { obs = 'No laborable'; cls = 'text-slate-400'; }
      else if ((e.FechaIngreso && f < e.FechaIngreso) || (e.FechaEgreso && f > e.FechaEgreso)) { obs = 'Fuera de contrato'; cls = 'text-slate-400'; }
      else if (r.fechasAusente.includes(f)) obs = 'AUSENTE';
      else if (f === hoy) obs = 'Jornada en curso';
      return `<tr class="${cls}"><td class="cap1">${esc(fmtFechaCorta(f))}</td><td>${a ? fmtHora(a.Entrada) : '—'}</td><td>${a ? fmtHora(a.Salida) : '—'}</td>
        <td class="text-right">${a && a.MinTrabajados ? fmtMin(a.MinTrabajados) : '—'}</td><td class="text-right">${a && num(a.MinRetraso) > 0 ? fmtMin(a.MinRetraso) : '—'}</td>
        <td class="text-right">${a && num(a.MinExtra) > 0 ? fmtMin(a.MinExtra) : '—'}</td><td class="${obs === 'AUSENTE' ? 'text-rose-600 font-bold' : ''}">${esc(obs)}</td></tr>`;
    }).join('');
    cont.innerHTML = `${encabezado('Reporte individual de asistencia', mesTxt)}
      <div class="grid sm:grid-cols-4 gap-x-6 gap-y-1 text-sm mb-5">
        <p><span class="text-slate-500">Empleado:</span> <b>${esc(nombreCompleto(e))}</b></p><p><span class="text-slate-500">Cédula:</span> ${esc(e.Cedula)}</p>
        <p><span class="text-slate-500">Departamento:</span> ${esc(e.Departamento)}</p><p><span class="text-slate-500">Cargo:</span> ${esc(e.Cargo || '—')}</p></div>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        ${chip('Asistidas', `${r.asistidos}<span class="text-xs text-slate-400"> / ${Math.max(0, r.esperados - r.justificados)}</span>`)}${chip('Ausencias', r.ausencias, r.ausencias ? 'text-rose-600' : 'text-slate-900')}
        ${chip('Justificadas', r.justificados)}${chip('Retrasos', `${r.tardes} <span class="text-xs text-slate-400">(${fmtMin(r.minRetraso)})</span>`)}
        ${chip('Horas trabajadas', fmtHoras(r.minTrabajados))}${chip('Horas extra', fmtHoras(r.minExtra))}</div>
      <table class="rep-tabla"><thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th class="text-right">Trabajado</th><th class="text-right">Retraso</th><th class="text-right">Extra</th><th>Observación</th></tr></thead><tbody>${filas}</tbody>
        <tfoot><tr><td colspan="3">Totales del mes · Puntualidad ${fmtPct(r.pctPuntualidad)} · Asistencia ${fmtPct(r.pctAsistencia)}</td><td class="text-right">${fmtMin(r.minTrabajados)}</td><td class="text-right">${fmtMin(r.minRetraso)}</td><td class="text-right">${fmtMin(r.minExtra)}</td><td></td></tr></tfoot></table>
      ${pie(['Firma del trabajador', 'Recursos Humanos'])}`;
  } else {
    const emps = empleadosDelPeriodo(desde, hasta, depto, '').sort((a, b) => (a.Departamento || '').localeCompare(b.Departamento || '', 'es') || ordenarNombre(a, b));
    const k = calcularKPIs(emps, asis, S.permisos, S.evaluaciones, desde, hasta), t = k.tot;
    const filas = k.filas.map(r => `<tr><td><b>${esc(nombreCompleto(r.e))}</b><span class="block text-[10px] text-slate-400">C.I. ${esc(r.e.Cedula)}</span></td><td>${esc(r.e.Departamento)}</td>
      <td class="text-right">${r.asistidos}/${Math.max(0, r.esperados - r.justificados)}</td><td class="text-right ${r.ausencias ? 'text-rose-600 font-bold' : ''}">${r.ausencias}</td><td class="text-right">${r.justificados}</td>
      <td class="text-right">${r.tardes}</td><td class="text-right">${fmtHoras(r.minRetraso)}</td><td class="text-right">${fmtHoras(r.minTrabajados)}</td><td class="text-right">${fmtHoras(r.minExtra)}</td>
      <td class="text-right">${fmtPct(r.pctPuntualidad)}</td><td class="text-right">${fmtPct(r.pctAsistencia)}</td></tr>`).join('');
    cont.innerHTML = `${encabezado('Reporte general de asistencia', mesTxt + (depto ? ' · ' + depto : ''))}
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        ${chip('Empleados', emps.length)}${chip('Asistencia', fmtPct(t.pctAsistencia))}${chip('Puntualidad', fmtPct(t.pctPuntualidad))}
        ${chip('Ausencias', t.ausencias, t.ausencias ? 'text-rose-600' : 'text-slate-900')}${chip('Horas trabajadas', fmtHoras(t.minTrabajados))}${chip('Horas extra', fmtHoras(t.minExtra))}</div>
      <table class="rep-tabla"><thead><tr><th>Empleado</th><th>Departamento</th><th class="text-right">Asistidas</th><th class="text-right">Ausencias</th><th class="text-right">Justif.</th>
        <th class="text-right">Retrasos</th><th class="text-right">H. retraso</th><th class="text-right">H. trabajadas</th><th class="text-right">H. extra</th><th class="text-right">Puntualidad</th><th class="text-right">Asistencia</th></tr></thead>
        <tbody>${filas || '<tr><td colspan="11" class="text-center text-slate-400">Sin empleados.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="2">Totales</td><td class="text-right">${t.asistidosLab}/${Math.max(0, t.esperados - t.justificados)}</td><td class="text-right">${t.ausencias}</td><td class="text-right">${t.justificados}</td><td class="text-right">${t.tardes}</td>
          <td class="text-right">${fmtHoras(t.minRetraso)}</td><td class="text-right">${fmtHoras(t.minTrabajados)}</td><td class="text-right">${fmtHoras(t.minExtra)}</td><td class="text-right">${fmtPct(t.pctPuntualidad)}</td><td class="text-right">${fmtPct(t.pctAsistencia)}</td></tr></tfoot></table>
      ${pie(['Recursos Humanos', 'Dirección'])}`;
  }
}

/* ======================= 17h. IMPORTAR EMPLEADOS DESDE EXCEL ======================= */
const COLS_IMPORT = [['Nombres', 'Nombres *'], ['Apellidos', 'Apellidos *'], ['Cedula', 'Cédula *'], ['Email', 'Correo (Gmail)'], ['Telefono', 'Teléfono'],
  ['FechaNacimiento', 'Fecha de nacimiento'], ['FechaIngreso', 'Fecha de ingreso *'], ['Departamento', 'Departamento *'], ['Cargo', 'Cargo'],
  ['SalarioSemanal', 'Salario semanal'], ['TipoContrato', 'Tipo de contrato'], ['FinContrato', 'Fin de contrato'], ['Estado', 'Estado'], ['Direccion', 'Dirección'],
  ['TipoSangre', 'Tipo de sangre'], ['Alergias', 'Alergias'], ['EstadoCivil', 'Estado civil'], ['NumeroHijos', 'Número de hijos'],
  ['NivelInstruccion', 'Nivel de instrucción'], ['EmergenciaNombre', 'Contacto de emergencia'], ['EmergenciaTelefono', 'Teléfono de emergencia'],
  ['EmergenciaParentesco', 'Parentesco de emergencia'], ['Notas', 'Notas']];
const claveCol = s => normalizar(s).replace(/[^a-z0-9]/g, '');
const MAPA_IMPORT = (() => {
  const m = {};
  COLS_IMPORT.forEach(([k, t]) => { m[claveCol(t)] = k; m[claveCol(k)] = k; });
  Object.assign(m, { nombre: 'Nombres', apellido: 'Apellidos', ci: 'Cedula', cedulade: 'Cedula', cedulaidentidad: 'Cedula', ceduladeidentidad: 'Cedula',
    correo: 'Email', gmail: 'Email', correoelectronico: 'Email', celular: 'Telefono', telefonocelular: 'Telefono', nacimiento: 'FechaNacimiento',
    fechanacimiento: 'FechaNacimiento', ingreso: 'FechaIngreso', fechaingreso: 'FechaIngreso', salario: 'SalarioSemanal', contrato: 'TipoContrato',
    sangre: 'TipoSangre', hijos: 'NumeroHijos', instruccion: 'NivelInstruccion', emergencia: 'EmergenciaNombre', parentesco: 'EmergenciaParentesco' });
  return m;
})();

function formImportar() {
  S.import = null;
  abrirModal({
    titulo: 'Importar empleados desde Excel',
    ancho: 'sm:max-w-4xl',
    cuerpo: `<div class="space-y-5">
      <div class="tarjeta p-5">
        <p class="font-bold text-navy-900 mb-1">1. Descarga la plantilla y llénala</p>
        <p class="text-sm text-slate-600">Una fila por empleado. Obligatorios: <b>Nombres, Apellidos, Cédula, Fecha de ingreso y Departamento</b>. Las fechas pueden ir como <b>31/12/1990</b>.
          Si ya tienes tu propio Excel, sirve igual: solo revisa que los títulos de las columnas se parezcan a los de la plantilla.</p>
        <p class="text-xs text-slate-500 mt-2">Departamentos válidos: ${(S.sesion.departamentos || []).map(esc).join(' · ')}</p>
        <button data-acc="imp-plantilla" class="btn-sec btn-sm mt-3"><i data-lucide="download" class="w-4 h-4"></i>Descargar plantilla</button>
      </div>
      <div class="tarjeta p-5">
        <p class="font-bold text-navy-900 mb-3">2. Sube el archivo (Excel .xlsx o .csv) y revísalo</p>
        <div class="grid sm:grid-cols-3 gap-3 items-end">
          <div class="sm:col-span-2"><input id="imp-archivo" type="file" accept=".xlsx,.xls,.csv,.txt" class="campo file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:px-3 file:py-1 file:text-marca-700 file:font-semibold"></div>
          <button data-acc="imp-revisar" class="btn-primario"><i data-lucide="scan-search" class="w-4 h-4"></i>Revisar archivo</button>
        </div>
        <label class="mt-3 flex items-center gap-2 text-sm text-slate-600"><input id="imp-crear" type="checkbox" class="h-4 w-4 accent-[#C10866]"> Crear automáticamente los departamentos que no existan</label>
        <p class="text-xs text-slate-400 mt-2">Primero se revisa todo sin guardar nada. Todos entran con rol <b>Empleado</b>; los roles se cambian después en cada expediente.</p>
      </div>
      <div id="imp-resultado"></div>
    </div>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button id="imp-btn" data-acc="imp-confirmar" class="btn-primario" disabled><i data-lucide="upload" class="w-4 h-4"></i>Importar</button>`
  });
}

function descargarPlantilla() {
  const celda = v => /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const d0 = (S.sesion.departamentos || ['Ventas'])[0];
  const ejemplo = { Nombres: 'María José', Apellidos: 'Pérez Gómez', Cedula: '12345678', Email: 'mariajose@gmail.com', Telefono: '0412-1234567',
    FechaNacimiento: '31/12/1990', FechaIngreso: '15/01/2024', Departamento: d0, Cargo: 'Vendedora', SalarioSemanal: '120', TipoContrato: 'Tiempo indeterminado',
    Estado: 'Activo', TipoSangre: 'O+', EstadoCivil: 'Soltero(a)', NumeroHijos: '0', NivelInstruccion: 'Universitario', EmergenciaNombre: 'José Pérez',
    EmergenciaTelefono: '0414-7654321', EmergenciaParentesco: 'Padre' };
  const lineas = [COLS_IMPORT.map(([, t]) => celda(t.replace(' *', ''))).join(';'), COLS_IMPORT.map(([k]) => celda(ejemplo[k] || '')).join(';')];
  descargarBlob(new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'plantilla_empleados_sumanpek.csv');
  toast('Plantilla descargada. Ábrela con Excel, borra la fila de ejemplo y escribe tus empleados.', 'ok', 7000);
}

function parsearCSV(t) {
  const prim = t.split(/\r?\n/)[0] || '';
  const sep = [';', '\t', ','].map(c => [c, prim.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const out = [];
  let fila = [], campo = '', comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += c;
      continue;
    }
    if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; fila.push(campo); out.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); out.push(fila); }
  return out;
}

function cargarLectorExcel() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => res();
    s.onerror = () => rej(new Error('No se pudo cargar el lector de Excel. Revisa tu conexión, o guarda el archivo como CSV y súbelo de nuevo.'));
    document.head.appendChild(s);
  });
}

async function leerTablaArchivo(file) {
  if (/\.(csv|txt)$/i.test(file.name)) return parsearCSV((await file.text()).replace(/^﻿/, ''));
  await cargarLectorExcel();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
}

function filasAObjetos(tabla) {
  const h = tabla.findIndex(f => (f || []).filter(c => MAPA_IMPORT[claveCol(c)]).length >= 3);
  if (h === -1) throw new Error('No encontré los títulos de las columnas (Nombres, Apellidos, Cédula…). Usa la plantilla como guía.');
  const cab = tabla[h].map(c => MAPA_IMPORT[claveCol(c)] || null);
  const ignoradas = tabla[h].filter((c, i) => String(c).trim() && !cab[i]).map(String);
  const objs = [];
  for (let i = h + 1; i < tabla.length; i++) {
    const f = tabla[i] || [];
    if (f.every(c => String(c ?? '').trim() === '')) continue;
    const o = { _fila: i + 1 };
    cab.forEach((k, j) => { if (k && o[k] === undefined) o[k] = String(f[j] ?? '').trim(); });
    objs.push(o);
  }
  if (!objs.length) throw new Error('El archivo no tiene filas con empleados debajo de los títulos.');
  return { objs, ignoradas };
}

async function revisarImport() {
  const file = $('#imp-archivo').files[0];
  if (!file) return toast('Elige el archivo primero.', 'aviso');
  const crear = $('#imp-crear').checked;
  $('#imp-btn').disabled = true;
  try {
    cargando(true, 'Leyendo el archivo…');
    let datos;
    try { datos = filasAObjetos(await leerTablaArchivo(file)); } finally { cargando(false); }
    const r = await api('importarEmpleados', { filas: datos.objs, simular: true, crearDeptos: crear }, { texto: `Revisando ${datos.objs.length} fila(s)…` });
    S.import = { objs: datos.objs, crear };
    pintarResultadoImport(r, datos.ignoradas);
  } catch (e) { $('#imp-resultado').innerHTML = `<div class="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">${esc(e.message)}</div>`; }
}

function pintarResultadoImport(r, ignoradas = []) {
  const btn = $('#imp-btn');
  btn.disabled = r.simular ? !r.validos : true;
  btn.innerHTML = `<i data-lucide="upload" class="w-4 h-4"></i>Importar ${r.validos} empleado${r.validos === 1 ? '' : 's'}`;
  $('#imp-resultado').innerHTML = `
    <div class="flex flex-wrap gap-2 mb-3">
      <span class="insignia bg-emerald-100 text-emerald-700">${r.validos} ${r.simular ? 'listos para importar' : 'importados'}</span>
      ${r.errores ? `<span class="insignia bg-rose-100 text-rose-700">${r.errores} con errores (no se importan)</span>` : ''}
      ${r.departamentosNuevos.length ? `<span class="insignia bg-oro-100 text-oro-700">Departamentos nuevos: ${esc(r.departamentosNuevos.join(', '))}</span>` : ''}
      ${ignoradas.length ? `<span class="insignia bg-slate-100 text-slate-600" title="${esc(ignoradas.join(', '))}">${ignoradas.length} columna(s) no reconocidas</span>` : ''}
    </div>
    <div class="tarjeta overflow-x-auto max-h-80 overflow-y-auto scroll-fino"><table class="tabla"><thead><tr><th>Fila</th><th>Empleado</th><th>Resultado</th></tr></thead><tbody>
      ${r.resultados.map(x => `<tr><td class="text-xs text-slate-500">${x.fila}</td><td class="font-medium">${esc(x.nombre)}${x.ok ? `<span class="block text-xs text-slate-400">${esc(x.departamento)}${x.nuevoDepto ? ' (nuevo)' : ''}</span>` : ''}</td>
        <td class="envolver">${x.ok ? `<span class="insignia bg-emerald-100 text-emerald-700">✓ ${r.simular ? 'Correcto' : 'Creado ' + esc(x.id)}</span>` : `<span class="text-sm text-rose-600">${esc(x.error)}</span>`}</td></tr>`).join('')}
    </tbody></table></div>
    ${r.simular && r.errores ? '<p class="text-xs text-slate-500 mt-2">Puedes corregir el Excel y volver a revisarlo, o importar ahora solo las filas correctas.</p>' : ''}`;
  iconos();
}

async function confirmarImport() {
  if (!S.import) return;
  try {
    const r = await api('importarEmpleados', { filas: S.import.objs, simular: false, crearDeptos: S.import.crear }, { texto: 'Importando empleados…' });
    pintarResultadoImport(r);
    toast(`${r.validos} empleado(s) importados.`, 'ok', 6000);
    S.import = null;
    if (r.departamentosNuevos.length) { S.sesion = await api('sesion', {}, { silencioso: true }); S.sesionT = Date.now(); pintarSelectoresDepto(); }
    await asegurarStore(null, null, { forzar: true });
    if (S.seccion === 'empleados') pintarEmpleados();
  } catch (e) { toast(e.message, 'error', 7000); }
}

/* ======================= 17i. AJUSTES Y DEPARTAMENTOS ======================= */
async function cargarAjustes() {
  if (!S.ajustes) $('#aj-contenido').innerHTML = '<p class="text-center text-sm text-slate-400 py-16 pulso">Cargando ajustes…</p>';
  else pintarAjustes();
  try {
    S.ajustes = await api('ajustes', {}, { silencioso: true });
    if (S.seccion === 'ajustes') pintarAjustes();
  } catch (e) { toast(e.message, 'error'); }
}

function pintarAjustes() {
  const { departamentos, config: c, info } = S.ajustes;
  const rr = esRRHH(), dis = rr ? '' : 'disabled';
  const campo = (k, etq, tipo = 'number', extra = '', ayuda = '') => `<div><label class="etiqueta">${etq}</label>
    <input name="${k}" type="${tipo}" class="campo" value="${esc(c[k])}" ${extra} ${dis}>${ayuda ? `<p class="text-[11px] text-slate-400 mt-1">${ayuda}</p>` : ''}</div>`;
  const interruptor = (k, etq, ayuda) => `<label class="flex items-start gap-3 rounded-xl border border-slate-200 p-3 ${rr ? 'cursor-pointer' : ''}">
    <input type="checkbox" name="${k}" class="mt-0.5 h-5 w-5 shrink-0 accent-[#C10866]" ${String(c[k]).toUpperCase() !== 'NO' ? 'checked' : ''} ${dis}>
    <span><span class="block text-sm font-semibold text-slate-800">${etq}</span><span class="block text-xs text-slate-500">${ayuda}</span></span></label>`;
  const dias = String(c.DIAS_LABORABLES).split(',').map(Number);
  const chips = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => `<label class="cursor-pointer"><input type="checkbox" name="dia" value="${i + 1}" class="peer sr-only" ${dias.includes(i + 1) ? 'checked' : ''} ${dis}>
    <span class="block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 peer-checked:bg-navy-900 peer-checked:text-white peer-checked:border-navy-900">${d}</span></label>`).join('');
  const deptos = departamentos.slice().sort((a, b) => (b.Activo - a.Activo) || a.Nombre.localeCompare(b.Nombre, 'es'));
  const filaDepto = d => `<div class="flex items-center gap-2 px-5 py-3">
      <div class="flex-1 min-w-0"><p class="font-semibold truncate ${d.Activo ? 'text-slate-800' : 'text-slate-400 line-through'}">${esc(d.Nombre)}</p>
        <p class="text-xs text-slate-500">${d.activos} activo${d.activos === 1 ? '' : 's'}${d.total > d.activos ? ` · ${d.total} expedientes` : ''}${d.Activo ? '' : ' · <b>oculto</b>'}</p></div>
      <div class="flex gap-0.5 solo-rrhh">
        <button data-acc="depto-renombrar" data-nombre="${esc(d.Nombre)}" class="btn-fantasma btn-sm" title="Cambiar nombre"><i data-lucide="pencil" class="w-4 h-4"></i></button>
        <button data-acc="depto-activo" data-nombre="${esc(d.Nombre)}" data-activo="${d.Activo ? '0' : '1'}" class="btn-fantasma btn-sm" title="${d.Activo ? 'Ocultar de las listas' : 'Volver a mostrar'}"><i data-lucide="${d.Activo ? 'eye-off' : 'eye'}" class="w-4 h-4"></i></button>
        ${d.total ? '' : `<button data-acc="depto-eliminar" data-nombre="${esc(d.Nombre)}" class="btn-fantasma btn-sm text-rose-600" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`}
      </div></div>`;
  const lc = info.ultimoCierre;
  const auto = ['cierreDiario', 'respaldoSemanal'].every(n => (info.disparadores || []).includes(n));
  const nombreDia = n => { const t = DIAS_SEMANA[n].replace(/s$/, ''); return t.charAt(0).toUpperCase() + t.slice(1); };
  $('#aj-contenido').innerHTML = `
  <div class="grid xl:grid-cols-3 gap-5 items-start">
    <div class="tarjeta">
      <div class="px-5 py-4 border-b border-slate-100"><h3 class="titulo-tarjeta">Departamentos</h3>
        <p class="text-xs text-slate-400">${deptos.filter(d => d.Activo).length} activos. Ocultar uno lo quita de las listas sin tocar los expedientes; cambiar el nombre actualiza a todos sus empleados.</p></div>
      <form id="f-depto" class="solo-rrhh px-5 py-4 border-b border-slate-100 flex gap-2" onsubmit="event.preventDefault(); deptoAgregar();">
        <input name="nombre" class="campo" maxlength="60" placeholder="Nuevo departamento…" required>
        <button data-acc="depto-agregar" class="btn-primario shrink-0"><i data-lucide="plus" class="w-4 h-4"></i>Agregar</button></form>
      <div class="divide-y divide-slate-100">${deptos.map(filaDepto).join('')}</div>
    </div>
    <form id="f-ajustes" class="xl:col-span-2 space-y-5" onsubmit="return false">
      ${rr ? '' : '<div class="rounded-xl bg-navy-50 text-navy-900 px-4 py-3 text-sm">Vista de solo lectura: solo Recursos Humanos puede cambiar los ajustes.</div>'}
      <div class="tarjeta p-5">
        <h3 class="titulo-tarjeta">Horario y reglas de asistencia</h3>
        <p class="text-xs text-slate-400 mb-4">Se aplican a los marcajes nuevos. Para aplicarlas a los anteriores usa "Recalcular asistencia" (abajo).</p>
        <div class="grid sm:grid-cols-3 gap-4">
          ${campo('HORA_ENTRADA', 'Hora de entrada', 'time', 'required')}${campo('HORA_SALIDA', 'Salida (lunes a viernes)', 'time', 'required')}${campo('HORA_SALIDA_SABADO', 'Salida (sábado)', 'time', 'required')}
          ${campo('TOLERANCIA_MIN', 'Tolerancia (minutos)', 'number', 'min="0" max="120" required', 'Minutos de gracia antes de contar retraso.')}
          ${campo('UMBRAL_EXTRA_MIN', 'Mínimo para horas extra (min)', 'number', 'min="0" max="240" required', 'Minutos después de la salida a partir de los cuales cuentan.')}
          ${campo('DIAS_MAX_MARCAJE_MANUAL', 'Días para pedir marcaje manual', 'number', 'min="1" max="60" required', 'Hacia atrás, desde el celular del empleado.')}
          <div class="sm:col-span-3"><label class="etiqueta">Días laborables</label><div class="flex flex-wrap items-center gap-2">${chips}<span class="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-400" title="El domingo nunca cuenta como día de asistencia">Dom · no laborable</span></div></div>
          <div class="sm:col-span-3">${interruptor('COMPENSAR_RETRASO', 'Descontar el retraso de las horas extra del mismo día', 'Ejemplo: llegó 20 min tarde y se quedó 60 min más → cuenta 40 min de extra.')}</div>
          ${campo('MONEDA', 'Moneda', 'text', 'maxlength="10" required')}
          <div><label class="etiqueta">Día de pago semanal</label><select name="DIA_PAGO" class="campo" ${dis}>${opciones([1, 2, 3, 4, 5, 6, 7].map(n => ({ v: n, t: nombreDia(n) })), c.DIA_PAGO)}</select></div>
          ${campo('TAMANO_MAX_MB', 'Máximo por archivo (MB)', 'number', 'min="1" max="25" required')}
        </div>
      </div>
      <div class="tarjeta p-5">
        <h3 class="titulo-tarjeta">Ubicación de la empresa</h3>
        <p class="text-xs text-slate-400 mb-4">Solo se puede marcar dentro de este círculo.</p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          ${campo('OFICINA_LAT', 'Latitud', 'number', 'step="any" required')}${campo('OFICINA_LNG', 'Longitud', 'number', 'step="any" required')}
          ${campo('RADIO_METROS', 'Radio permitido (m)', 'number', 'min="20" max="5000" required')}${campo('PRECISION_MAX_METROS', 'Precisión GPS mínima (m)', 'number', 'min="10" max="500" required')}
        </div>
        <div class="flex flex-wrap gap-2 mt-4">
          <button type="button" data-acc="aj-mi-ubicacion" class="btn-sec btn-sm solo-rrhh"><i data-lucide="locate-fixed" class="w-4 h-4"></i>Usar mi ubicación actual</button>
          <a href="https://www.google.com/maps?q=${encodeURIComponent(c.OFICINA_LAT + ',' + c.OFICINA_LNG)}" target="_blank" rel="noopener" class="btn-sec btn-sm"><i data-lucide="map" class="w-4 h-4"></i>Ver en Google Maps</a>
        </div>
      </div>
      <div class="tarjeta p-5">
        <h3 class="titulo-tarjeta">Correos y tareas automáticas</h3>
        <p class="text-xs text-slate-400 mb-4">Los correos salen desde la cuenta de Google de RRHH (máximo 100 al día).${info.cuotaCorreos !== null && info.cuotaCorreos !== undefined ? ` Disponibles hoy: <b>${info.cuotaCorreos}</b>.` : ''}</p>
        <div class="grid sm:grid-cols-2 gap-3">
          ${interruptor('CORREOS_ACTIVOS', 'Enviar correos automáticos', 'Avisa a RRHH de cada solicitud nueva y a cada empleado de la respuesta.')}
          ${interruptor('CIERRE_AVISAR_EMPLEADOS', 'Recordar a quien no marcó salida', 'En el cierre diario, cada uno recibe un correo para pedir su marcaje.')}
          ${interruptor('DIRECCION_PUEDE_APROBAR', 'Dirección también puede aprobar', 'Podrá aprobar o rechazar marcajes manuales y permisos (además de RRHH).')}
          <div class="grid grid-cols-2 gap-3">${campo('HORA_CIERRE', 'Hora del cierre diario', 'number', 'min="0" max="23" required', '0 a 23 (20 = 8 p. m.)')}${campo('RESPALDOS_A_CONSERVAR', 'Respaldos a guardar', 'number', 'min="1" max="52" required', 'Se hace uno cada domingo.')}</div>
          <div class="sm:col-span-2">${campo('DIRECCION_EMAILS', 'Correos de Dirección (separados por coma)', 'text', 'placeholder="ejemplo@sumanpek.com"', 'Ven todo sin editar y reciben el resumen del cierre diario.')}</div>
        </div>
        <div class="mt-4 rounded-xl ${auto ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'} px-4 py-3 text-sm">
          ${auto ? `✅ Tareas automáticas activas: cierre diario a las <b>${esc(c.HORA_CIERRE)}:00</b> y respaldo cada domingo a las 3:00 a. m.`
            : '⚠️ Las tareas automáticas no están activas. En la hoja de cálculo usa <b>Asistencia Sumanpek → Instalar / reparar estructura</b>.'}
          <span class="block text-xs mt-1 opacity-80">Último cierre: ${lc ? `${esc(fmtFecha(lc.Fecha))} · ${esc(lc.Presentes)} presentes, ${esc(lc.Ausentes)} ausentes, ${esc(lc.SinSalida)} sin salida` : 'todavía ninguno'}
            · Último respaldo: ${info.ultimoRespaldo ? esc(String(info.ultimoRespaldo).slice(0, 16)) : 'todavía ninguno'}</span>
        </div>
        <div class="flex flex-wrap gap-2 mt-4 solo-rrhh">
          <button type="button" data-acc="aj-cierre" class="btn-sec btn-sm"><i data-lucide="clipboard-check" class="w-4 h-4"></i>Ver el cierre de hoy</button>
          <button type="button" data-acc="aj-respaldo" class="btn-sec btn-sm"><i data-lucide="hard-drive-download" class="w-4 h-4"></i>Hacer un respaldo ahora</button>
          <button type="button" data-acc="aj-recalcular" class="btn-sec btn-sm"><i data-lucide="calculator" class="w-4 h-4"></i>Recalcular asistencia</button>
        </div>
      </div>
      <div class="tarjeta p-5">
        <h3 class="titulo-tarjeta mb-3">Apariencia de este dispositivo</h3>
        <div class="flex gap-2">
          <button type="button" data-acc="tema-fijo" data-tema="claro" class="${temaOscuro() ? 'btn-sec' : 'btn-primario'}"><i data-lucide="sun" class="w-4 h-4"></i>Claro</button>
          <button type="button" data-acc="tema-fijo" data-tema="oscuro" class="${temaOscuro() ? 'btn-primario' : 'btn-sec'}"><i data-lucide="moon" class="w-4 h-4"></i>Oscuro</button>
        </div>
        <p class="text-xs text-slate-400 mt-2">Cada persona elige el suyo desde el botón 🌙 de la barra superior. El modo claro es el predeterminado.</p>
      </div>
      <div class="solo-rrhh sticky bottom-4 z-10 flex justify-end"><button type="button" data-acc="aj-guardar" class="btn-primario shadow-lg"><i data-lucide="save" class="w-4 h-4"></i>Guardar ajustes</button></div>
    </form>
  </div>`;
  iconos();
}

async function guardarAjustesForm() {
  const f = $('#f-ajustes');
  if (!f.reportValidity()) return;
  const cfg = {};
  Object.keys(S.ajustes.config).forEach(k => {
    const el = f.elements[k];
    if (el) cfg[k] = el.type === 'checkbox' ? (el.checked ? 'SI' : 'NO') : String(el.value).trim();
  });
  cfg.DIAS_LABORABLES = $$('[name=dia]:checked', f).map(i => i.value).join(',');
  if (!cfg.DIAS_LABORABLES) return toast('Elige al menos un día laborable.', 'aviso');
  try {
    const r = await api('guardarAjustes', { config: cfg }, { texto: 'Guardando ajustes…' });
    S.ajustes = r;
    pintarAjustes();
    if (!r.cambios.length) return toast('No había cambios por guardar.', 'info');
    toast(`Ajustes guardados (${r.cambios.length} cambio${r.cambios.length === 1 ? '' : 's'}).`, 'ok');
    S.sesion = await api('sesion', {}, { silencioso: true }); S.sesionT = Date.now();
    if (r.cambios.some(k => /^(HORA_ENTRADA|HORA_SALIDA|HORA_SALIDA_SABADO|TOLERANCIA_MIN|UMBRAL_EXTRA_MIN|DIAS_LABORABLES|COMPENSAR_RETRASO)$/.test(k))) {
      toast('Los marcajes nuevos ya usan estas reglas. Para aplicarlas también a los anteriores, pulsa "Recalcular asistencia".', 'info', 9000);
    }
  } catch (e) { toast(e.message, 'error', 7000); }
}

async function refrescarDeptos() {
  const [aj, ses] = await Promise.all([api('ajustes', {}, { silencioso: true }), api('sesion', {}, { silencioso: true })]);
  S.ajustes = aj; S.sesion = ses; S.sesionT = Date.now();
  pintarSelectoresDepto();
  invalidarCache();
  if (S.seccion === 'ajustes') pintarAjustes();
}

async function deptoAgregar() {
  const f = $('#f-depto');
  if (!f.reportValidity()) return;
  try {
    await api('guardarDepartamento', { nombre: f.nombre.value.trim() }, { texto: 'Creando departamento…' });
    toast('Departamento creado.', 'ok');
    await refrescarDeptos();
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function deptoRenombrar(nombre) {
  const nuevo = await dialogo({ titulo: 'Cambiar nombre del departamento', mensaje: `Todos los expedientes de "${nombre}" se actualizarán automáticamente.`,
    boton: 'Guardar', conTexto: true, linea: true, valor: nombre });
  if (!nuevo || nuevo === nombre) return;
  try {
    const r = await api('guardarDepartamento', { original: nombre, nombre: nuevo }, { texto: 'Cambiando nombre…' });
    toast(`Nombre cambiado${r.renombrados ? ` · ${r.renombrados} expediente(s) actualizados` : ''}.`, 'ok');
    await refrescarDeptos();
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function deptoActivo(nombre, activo) {
  if (!activo && !await dialogo({ titulo: '¿Ocultar departamento?', mensaje: `"${nombre}" dejará de aparecer en las listas (nuevo empleado, autoregistro y filtros). Los expedientes que ya lo tienen no cambian. Puedes volver a mostrarlo cuando quieras.`, boton: 'Ocultar' })) return;
  try {
    await api('guardarDepartamento', { original: nombre, nombre, activo }, { texto: activo ? 'Activando…' : 'Ocultando…' });
    toast(activo ? 'Departamento visible de nuevo.' : 'Departamento oculto.', 'ok');
    await refrescarDeptos();
  } catch (e) { toast(e.message, 'error'); }
}

async function deptoEliminar(nombre) {
  if (!await confirmar(`Se eliminará "${nombre}". Solo es posible porque no tiene expedientes.`, { titulo: '¿Eliminar departamento?' })) return;
  try {
    await api('eliminarDepartamento', { nombre }, { texto: 'Eliminando…' });
    toast('Departamento eliminado.', 'ok');
    await refrescarDeptos();
  } catch (e) { toast(e.message, 'error', 7000); }
}

async function ajMiUbicacion() {
  try {
    cargando(true, 'Buscando tu ubicación GPS…');
    let p;
    try { p = await obtenerPosicion(25, 15000); } finally { cargando(false); }
    const f = $('#f-ajustes');
    f.elements.OFICINA_LAT.value = p.coords.latitude.toFixed(7);
    f.elements.OFICINA_LNG.value = p.coords.longitude.toFixed(7);
    toast(`Ubicación tomada (precisión ±${Math.round(p.coords.accuracy)} m). Pulsa "Guardar ajustes" para aplicarla.`, 'info', 8000);
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function ajCierre() {
  try {
    const r = await api('ejecutarCierre', { correos: false }, { texto: 'Calculando el cierre de hoy…' });
    const lista = (arr, fn) => arr.length ? `<ul class="mt-1 space-y-1">${arr.map(x => `<li class="text-sm">• ${fn(x)}</li>`).join('')}</ul>` : '<p class="text-sm text-slate-400 mt-1">Ninguno.</p>';
    const bloque = (t, arr, fn, color) => `<div class="tarjeta p-4"><p class="text-xs font-bold uppercase tracking-wide ${color}">${t} (${arr.length})</p>${lista(arr, fn)}</div>`;
    abrirModal({
      titulo: `Cierre del ${fmtFecha(r.fecha)}`,
      ancho: 'sm:max-w-2xl',
      cuerpo: `<p class="text-sm text-slate-600 mb-4">${r.laborable ? `<b>${r.presentes}</b> de ${r.esperados} presentes.` : 'Día no laborable.'} Este es el mismo resumen que se envía por correo a RRHH y a Dirección a las ${esc(S.ajustes.config.HORA_CIERRE)}:00 (aquí no se envió ningún correo).</p>
        <div class="grid sm:grid-cols-2 gap-3">
          ${bloque('Ausentes sin justificar', r.ausentes, x => `${esc(x.nombre)} <span class="text-xs text-slate-400">${esc(x.departamento)}${x.sinCorreo ? ' · sin correo' : ''}</span>`, 'text-rose-600')}
          ${bloque('Sin marcar salida', r.sinSalida, x => `${esc(x.nombre)} <span class="text-xs text-slate-400">entró ${esc(x.entrada)}</span>`, 'text-amber-600')}
          ${bloque('Llegadas tarde', r.tarde, x => `${esc(x.nombre)} <span class="text-xs text-slate-400">${x.minutos} min</span>`, 'text-oro-700')}
          ${bloque('Con permiso o reposo', r.justificados, x => `${esc(x.nombre)} <span class="text-xs text-slate-400">${esc(x.motivo)}</span>`, 'text-navy-700')}
        </div>`,
      pie: `<button data-acc="cerrar-modal" class="btn-primario">Entendido</button>`
    });
    cargarAjustes();
  } catch (e) { toast(e.message, 'error'); }
}

async function ajRespaldo() {
  try {
    const r = await api('respaldoAhora', {}, { texto: 'Copiando la hoja de cálculo…' });
    abrirModal({
      titulo: 'Respaldo creado ✅',
      ancho: 'sm:max-w-md',
      cuerpo: `<p class="text-sm text-slate-700">Se guardó una copia completa de la hoja: <b>${esc(r.nombre)}</b>.</p>
        <p class="text-sm text-slate-500 mt-2">Está en Google Drive, en la carpeta <b>Asistencia Sumanpek - Respaldos</b>. Se conservan los ${esc(S.ajustes.config.RESPALDOS_A_CONSERVAR)} más recientes.</p>`,
      pie: `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="btn-sec"><i data-lucide="external-link" class="w-4 h-4"></i>Abrir la copia</a><button data-acc="cerrar-modal" class="btn-primario">Listo</button>`
    });
    cargarAjustes();
  } catch (e) { toast(e.message, 'error', 7000); }
}

async function ajRecalcular() {
  if (!await dialogo({ titulo: '¿Recalcular toda la asistencia?', mensaje: 'Se recalcularán retrasos, horas trabajadas y horas extra de TODOS los marcajes con el horario y las reglas actuales. Úsalo después de cambiar el horario o la tolerancia.', boton: 'Recalcular' })) return;
  try {
    const r = await api('recalcular', {}, { texto: 'Recalculando…' });
    toast(`Listo: ${r.cambios} valor(es) actualizados.`, 'ok', 6000);
    invalidarCache();
  } catch (e) { toast(e.message, 'error'); }
}

/* ======================= 17j. v3.2 · SEXO, DEPARTAMENTO DEL MES, DETALLE DE EVALUACIÓN ======================= */
/** 'F' o 'M'. Si el expediente no lo indica, se deduce del primer nombre (igual que en el servidor). */
function sexoDe(e) {
  const s = String(e?.Sexo || '').toUpperCase();
  if (s === 'F' || s === 'M') return s;
  const n = normalizar(String(e?.Nombres || '').split(' ')[0]);
  if (!n) return '';
  const fem = ['isabel', 'raquel', 'carmen', 'mercedes', 'beatriz', 'luz', 'ines', 'pilar', 'rosario', 'consuelo', 'dolores', 'maribel', 'marisol',
    'yamilet', 'lisbeth', 'lizbeth', 'nathaly', 'nataly', 'mary', 'ruth', 'esther', 'abigail', 'yanet', 'janet', 'jenny', 'yenny', 'karen', 'evelyn',
    'ingrid', 'liz', 'nancy', 'gladys', 'doris', 'belkis', 'yuli', 'leidy', 'sol', 'noemi', 'milagros', 'dulce', 'flor', 'miriam', 'elizabeth',
    'lourdes', 'socorro', 'nieves', 'jazmin', 'rubi', 'yasmin', 'marian', 'carol', 'yusmary', 'yuleisy', 'deisy', 'daisy', 'nelly', 'ely', 'arelis',
    'maryuri', 'yorgelis', 'mileidy', 'yeliz', 'nairobi', 'ivonne', 'yvonne', 'lilibeth', 'maribeth', 'astrid', 'judith', 'edith', 'raiza', 'isis',
    'sarai', 'jasmin', 'alison', 'allison', 'genesis', 'nicole', 'michelle', 'katherine', 'kathy'];
  const masc = ['joshua', 'luca', 'nikita', 'borja', 'elias', 'jesus', 'matias', 'tobias', 'josue', 'garcia'];
  if (fem.includes(n)) return 'F';
  if (masc.includes(n)) return 'M';
  return /a$/.test(n) ? 'F' : 'M';
}

function pintarDeptoMes() {
  const d = S.sesion?.departamentoDelMes, el = $('#mc-dmes');
  if (!d) { el.className = 'hidden'; el.innerHTML = ''; return; }
  const mio = d.departamento === S.sesion.departamento;
  el.className = 'tarjeta p-4 flex items-center gap-4 border-navy-200 bg-gradient-to-br from-navy-50 via-white to-oro-50';
  el.innerHTML = `<span class="h-14 w-14 shrink-0 rounded-2xl bg-navy-900 text-3xl flex items-center justify-center">🏅</span>
    <div class="min-w-0">
      <p class="text-[11px] font-bold uppercase tracking-wide text-navy-700">Departamento del mes · ${esc(fmtPeriodo(d.periodo))}</p>
      <p class="font-extrabold text-navy-900 truncate">${mio ? `¡Tu equipo: ${esc(d.departamento)}! 🎉` : esc(d.departamento)}</p>
      ${d.motivo ? `<p class="text-xs text-slate-600 mt-1 italic">“${esc(d.motivo)}”</p>` : ''}
    </div>`;
}

function pintarDeptoMesDash(per, filas) {
  const cont = $('#dash-dmes-cuerpo');
  if (!cont) return;
  const g = {};
  const prom = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
  filas.filter(r => r.asistidos > 0 && r.esperados > 0).forEach(r => {
    const p = r.pctPuntualidad ?? 0, a = r.pctAsistencia ?? 100;
    const d = r.e.Departamento || 'Sin departamento';
    (g[d] = g[d] || { d, pts: [], punt: [], asis: [], ev: [] });
    g[d].pts.push(r.evalProm !== null ? p * 0.4 + a * 0.3 + r.evalProm * 0.3 : p * 0.55 + a * 0.45);
    g[d].punt.push(p); g[d].asis.push(a);
    if (r.evalProm !== null) g[d].ev.push(r.evalProm);
  });
  const rank = Object.values(g).map(x => ({ d: x.d, n: x.pts.length, puntaje: prom(x.pts), punt: prom(x.punt), asis: prom(x.asis), ev: x.ev.length ? prom(x.ev) : null }))
    .sort((a, b) => b.puntaje - a.puntaje || b.n - a.n);
  const rec = (S.reconocimientos || []).find(x => x.Periodo === per && x.Tipo === 'DEPARTAMENTO');
  const izq = rec ? `<div class="h-full rounded-2xl p-5 text-center bg-gradient-to-br from-navy-50 via-white to-oro-50 border border-navy-200">
      <span class="mx-auto h-20 w-20 rounded-3xl bg-navy-900 text-5xl flex items-center justify-center">🏅</span>
      <p class="mt-3 text-lg font-extrabold text-navy-900">${esc(rec.Departamento)}</p>
      <p class="mt-1 text-xs font-bold uppercase tracking-wide text-navy-700">Departamento del mes · ${esc(fmtPeriodo(per))}</p>
      ${rec.Motivo ? `<p class="mt-2 text-sm italic text-slate-600">“${esc(rec.Motivo)}”</p>` : ''}
      ${rec.Puntaje ? `<p class="mt-1 text-xs text-slate-400">Puntaje: ${esc(rec.Puntaje)}</p>` : ''}
      <button data-acc="quitar-reconocimiento" data-id="${esc(rec.ID)}" class="btn-fantasma btn-sm mt-3 solo-rrhh no-print"><i data-lucide="x" class="w-4 h-4"></i>Quitar</button></div>`
    : `<div class="h-full rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center text-center">
      <span class="text-4xl">🏅</span><p class="mt-2 font-semibold text-slate-700">Sin departamento del mes para ${esc(fmtPeriodo(per))}</p>
      <p class="text-xs text-slate-500 mt-1">${esRRHH() ? 'Elige del ranking y pulsa <b>Reconocer</b>. Todo su equipo recibirá un correo de felicitación.' : 'Recursos Humanos aún no lo ha elegido.'}</p></div>`;
  const der = rank.length ? `<div class="space-y-2">${rank.slice(0, 6).map((r, i) => `
      <div class="flex items-center gap-3 rounded-xl p-2.5 ${rec && rec.Departamento === r.d ? 'bg-navy-50' : 'hover:bg-slate-50'}">
        <span class="w-6 text-center font-extrabold ${i === 0 ? 'text-oro-600' : 'text-slate-400'}">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
        <div class="flex-1 min-w-0"><p class="font-semibold text-slate-800 truncate">${esc(r.d)}</p>
          <p class="text-xs text-slate-500 truncate">${r.n} persona${r.n === 1 ? '' : 's'} · puntualidad ${fmtPct(r.punt)} · asistencia ${fmtPct(r.asis)}${r.ev !== null ? ` · desempeño ${fmtNum(r.ev)}` : ''}</p></div>
        <span class="text-lg font-extrabold tabular-nums ${colorPuntaje(r.puntaje)}">${fmtNum(r.puntaje)}</span>
        <button data-acc="reconocer-depto" data-depto="${esc(r.d)}" data-puntaje="${r.puntaje.toFixed(1)}" class="btn btn-sm bg-navy-900 text-white hover:bg-navy-950 solo-rrhh no-print">Reconocer</button>
      </div>`).join('')}</div>` : '<p class="text-sm text-slate-400 text-center py-8">No hay marcajes en ese mes para calcular el ranking.</p>';
  cont.innerHTML = `<div class="lg:col-span-2">${izq}</div><div class="lg:col-span-3">${der}</div>`;
}

async function reconocerDepto(depto, puntaje) {
  const per = $('#dash-mes-periodo').value;
  const motivo = await dialogo({ titulo: `Departamento del mes · ${fmtPeriodo(per)}`,
    mensaje: `${depto} aparecerá en la app de todo el personal y cada miembro del equipo recibirá un correo de felicitación. Escribe el motivo:`,
    boton: 'Reconocer 🏅', conTexto: true, valor: 'Por su trabajo en equipo, su puntualidad y su excelente desempeño.' });
  if (!motivo) return;
  try {
    const r = await api('reconocer', { tipo: 'DEPARTAMENTO', periodo: per, departamento: depto, motivo, puntaje }, { texto: 'Guardando…' });
    S.reconocimientos = (S.reconocimientos || []).filter(x => !(x.Periodo === per && x.Tipo === 'DEPARTAMENTO')).concat([r]);
    toast(`¡${depto} es el departamento del mes!`, 'ok', 6000);
    lanzarConfeti(2500);
    pintarEmpleadoMesDash();
  } catch (e) { toast(e.message, 'error'); }
}

function verEvaluacion(id) {
  const v = (S.evaluaciones || []).find(x => x.ID === id) || (S.exp?.evaluaciones || []).find(x => x.ID === id);
  if (!v) return toast('Evaluación no encontrada.', 'error');
  const e = empPorId(v.EmpleadoID) || S.exp?.empleado || {};
  const empExp = S.exp?.empleado.ID;
  const barra = (t, x) => `<div class="flex items-center gap-3 py-1.5"><span class="w-52 shrink-0 text-sm text-slate-600">${esc(t)}</span>
    ${x === null ? '<span class="text-xs text-slate-400">No aplica</span>' : `<div class="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full" style="width:${x}%;background:${x >= 85 ? '#10b981' : x >= 70 ? '#031263' : x >= 55 ? '#f59e0b' : '#e11d48'}"></div></div>
    <span class="w-10 text-right font-bold tabular-nums ${colorPuntaje(x)}">${fmtNum(x)}</span>`}</div>`;
  abrirModal({
    titulo: `Evaluación · ${nombreCompleto(e)}`,
    ancho: 'sm:max-w-2xl',
    volver: empExp ? (() => verExpediente(empExp, 'evaluaciones')) : null,
    cuerpo: `<div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div><p class="text-sm text-slate-500 cap1">${esc(fmtPeriodo(v.Periodo))} · ${esc(e.Departamento || '')}</p><p class="text-xs text-slate-400">Evaluó: ${esc(v.Evaluador || '—')}</p></div>
        <div class="text-right"><p class="text-xs text-slate-500">Promedio</p><p class="text-3xl font-extrabold ${colorPuntaje(num(v.Promedio))}">${esc(v.Promedio)}</p></div></div>
      ${GRUPOS_EVAL().map(g => `<div class="mb-4"><p class="text-xs font-bold uppercase tracking-wide text-marca-700 mb-1">${g}</p>
        ${CRITERIOS.filter(c => c.g === g).map(c => barra(c.t, String(v[c.k] ?? '') === '' ? null : num(v[c.k]))).join('')}</div>`).join('')}
      ${v.Comentarios ? `<div class="rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><p class="text-xs font-bold text-slate-500 mb-1">Comentarios y plan de mejora</p>${esc(v.Comentarios)}</div>` : ''}`,
    pie: `<button data-acc="imprimir-modal" class="btn-sec"><i data-lucide="printer" class="w-4 h-4"></i>Imprimir</button><button data-acc="cancelar-modal" class="btn-primario">Cerrar</button>`
  });
}

/* ======================= 17k. TAREAS (KANBAN) ======================= */
const COLS_TAREA = [
  { e: 'Pendiente', c: '#94a3b8', i: 'circle-dashed' }, { e: 'En progreso', c: '#0ea5e9', i: 'loader' },
  { e: 'En revisión', c: '#f59e0b', i: 'eye' }, { e: 'Hecho', c: '#10b981', i: 'circle-check' }
];
const ESTILO_PRIO = { Urgente: 'bg-rose-100 text-rose-700', Alta: 'bg-amber-100 text-amber-700', Media: 'bg-sky-100 text-sky-700', Baja: 'bg-slate-100 text-slate-600' };

async function cargarPlan(forzar = false) {
  if (S.plan && !forzar && Date.now() - S.plan.t < 60000) return S.plan;
  const d = await api('planificacion', {}, { silencioso: !!S.plan, texto: 'Cargando tablero…' });
  S.plan = Object.assign(d, { t: Date.now() });
  return S.plan;
}

async function cargarTareas() {
  try { await asegurarCatalogo(); await cargarPlan(); } catch (e) { return toast(e.message, 'error'); }
  const sel = $('#ta-resp'), v = sel.value;
  sel.innerHTML = `<option value="">Todos los responsables</option><option value="__sin">Sin asignar</option>` +
    opciones(S.empleados.filter(e => e.Estado !== 'Inactivo').sort(ordenarNombre).map(e => ({ v: e.ID, t: nombreCompleto(e) })));
  sel.value = v;
  pintarTareas();
}

function estadoVencimiento(t) {
  if (!t.FechaLimite || t.Estado === 'Hecho') return '';
  const hoy = hoyStr();
  if (t.FechaLimite < hoy) return 'vencida';
  if (t.FechaLimite <= sumarDias(hoy, 2)) return 'pronto';
  return '';
}

function chipFecha(t) {
  if (!t.FechaLimite) return '';
  const v = estadoVencimiento(t);
  const cls = v === 'vencida' ? 'bg-rose-100 text-rose-700' : v === 'pronto' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  return `<span class="insignia ${cls}" title="Fecha límite"><i data-lucide="calendar" class="w-3 h-3"></i>${esc(aFecha(t.FechaLimite).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }))}${v === 'vencida' ? ' · vencida' : ''}</span>`;
}

function filtrarTareas() {
  const q = normalizar($('#ta-buscar').value.trim()), resp = $('#ta-resp').value, prio = $('#ta-prio').value, venc = $('#ta-vencidas').checked;
  const finSemana = sumarDias(hoyStr(), 7 - diaSemana(hoyStr()));
  return (S.plan?.tareas || []).filter(t => {
    if (resp === '__sin' ? t.ResponsableID : resp && t.ResponsableID !== resp) return false;
    if (prio && t.Prioridad !== prio) return false;
    if (venc && !(t.FechaLimite && t.FechaLimite <= finSemana && t.Estado !== 'Hecho')) return false;
    if (q && !normalizar([t.Titulo, t.Descripcion, t.Etiquetas, nombreCompleto(empPorId(t.ResponsableID)), t.Departamento].join(' ')).includes(q)) return false;
    return true;
  });
}

function tarjetaTarea(t) {
  const e = empPorId(t.ResponsableID), rr = esRRHH();
  const i = COLS_TAREA.findIndex(c => c.e === t.Estado);
  return `<div class="kb-tarjeta tarjeta p-3 ${t.Estado === 'Hecho' ? 'opacity-75' : ''}" draggable="${rr}" data-id="${esc(t.ID)}" data-acc="ver-tarea">
    <div class="flex items-start justify-between gap-2">
      <p class="font-semibold text-sm text-slate-800 leading-snug ${t.Estado === 'Hecho' ? 'line-through' : ''}">${esc(t.Titulo)}</p>
      <span class="insignia shrink-0 ${ESTILO_PRIO[t.Prioridad] || ''}">${esc(t.Prioridad)}</span>
    </div>
    ${t.Descripcion ? `<p class="text-xs text-slate-500 mt-1 line-clamp-2">${esc(t.Descripcion)}</p>` : ''}
    ${t.Etiquetas ? `<div class="flex flex-wrap gap-1 mt-2">${t.Etiquetas.split(',').map(x => `<span class="rounded-md bg-navy-50 text-navy-700 px-1.5 py-0.5 text-[10px] font-semibold">#${esc(x.trim())}</span>`).join('')}</div>` : ''}
    <div class="flex items-center justify-between gap-2 mt-3">
      <div class="flex items-center gap-1.5 min-w-0">${e ? `${avatarHTML(e.FotoMini, nombreCompleto(e), 'h-6 w-6 text-[9px]')}<span class="text-xs text-slate-600 truncate">${esc(String(e.Nombres).split(' ')[0])}</span>` : '<span class="text-xs text-slate-400">Sin asignar</span>'}</div>
      <div class="flex items-center gap-1">${chipFecha(t)}</div>
    </div>
    ${rr ? `<div class="flex justify-between mt-2 md:hidden">
      <button data-acc="tarea-mover" data-id="${esc(t.ID)}" data-dir="-1" class="btn-fantasma btn-sm ${i === 0 ? 'invisible' : ''}"><i data-lucide="arrow-left" class="w-4 h-4"></i>${i > 0 ? esc(COLS_TAREA[i - 1].e) : ''}</button>
      <button data-acc="tarea-mover" data-id="${esc(t.ID)}" data-dir="1" class="btn-fantasma btn-sm ${i === COLS_TAREA.length - 1 ? 'invisible' : ''}">${i < COLS_TAREA.length - 1 ? esc(COLS_TAREA[i + 1].e) : ''}<i data-lucide="arrow-right" class="w-4 h-4"></i></button></div>` : ''}
  </div>`;
}

function pintarTareas() {
  if (!S.plan) return;
  const lista = filtrarTareas();
  $('#ta-tablero').innerHTML = COLS_TAREA.map(c => {
    const ts = lista.filter(t => t.Estado === c.e).sort((a, b) => num(a.Orden) - num(b.Orden));
    return `<div class="rounded-2xl bg-slate-100 p-3">
      <div class="flex items-center justify-between px-1 mb-3">
        <p class="flex items-center gap-2 font-bold text-sm text-slate-700"><span class="h-2.5 w-2.5 rounded-full" style="background:${c.c}"></span>${c.e}</p>
        <span class="insignia bg-white text-slate-600">${ts.length}</span>
      </div>
      <div class="kb-col space-y-2.5 rounded-xl" data-estado="${c.e}">${ts.map(tarjetaTarea).join('') || '<p class="py-6 text-center text-xs text-slate-400">Sin tareas</p>'}</div>
      ${c.e === 'Pendiente' ? '<button data-acc="nueva-tarea" class="solo-rrhh btn-fantasma btn-sm w-full mt-2"><i data-lucide="plus" class="w-4 h-4"></i>Agregar tarea</button>' : ''}
    </div>`;
  }).join('');
  renderTabla('ta-tabla', 't-tareas', [
    { t: 'Tarea', v: t => esc(t.Titulo), c: t => t.Titulo }, { t: 'Descripción', v: t => esc(t.Descripcion), c: t => t.Descripcion },
    { t: 'Estado', v: t => esc(t.Estado), c: t => t.Estado }, { t: 'Prioridad', v: t => esc(t.Prioridad), c: t => t.Prioridad },
    { t: 'Responsable', v: t => esc(nombreCompleto(empPorId(t.ResponsableID))), c: t => t.ResponsableID ? nombreCompleto(empPorId(t.ResponsableID)) : '' },
    { t: 'Departamento', v: t => esc(t.Departamento), c: t => t.Departamento }, { t: 'Fecha límite', v: t => esc(t.FechaLimite), c: t => t.FechaLimite },
    { t: 'Etiquetas', v: t => esc(t.Etiquetas), c: t => t.Etiquetas }, { t: 'Creada', v: t => esc(t.Creado), c: t => t.Creado }, { t: 'Completada', v: t => esc(t.Completado), c: t => t.Completado }
  ], lista);
  iconos();
}

/** Arrastrar y soltar (computadora). En el celular se usan las flechas de cada tarjeta. */
function prepararTablero() {
  const tab = $('#ta-tablero');
  let arrastrada = null;
  tab.addEventListener('dragstart', ev => {
    const c = ev.target.closest('.kb-tarjeta');
    if (!c || !esRRHH()) return ev.preventDefault();
    arrastrada = c.dataset.id;
    c.classList.add('arrastrando');
    ev.dataTransfer.effectAllowed = 'move';
    try { ev.dataTransfer.setData('text/plain', arrastrada); } catch (e) { /* nada */ }
  });
  tab.addEventListener('dragend', ev => { ev.target.closest?.('.kb-tarjeta')?.classList.remove('arrastrando'); $$('.kb-col.sobre').forEach(x => x.classList.remove('sobre')); arrastrada = null; });
  tab.addEventListener('dragover', ev => {
    const col = ev.target.closest('.kb-col');
    if (!col || !arrastrada) return;
    ev.preventDefault();
    $$('.kb-col.sobre').forEach(x => x !== col && x.classList.remove('sobre'));
    col.classList.add('sobre');
  });
  tab.addEventListener('drop', ev => {
    const col = ev.target.closest('.kb-col');
    if (!col || !arrastrada) return;
    ev.preventDefault();
    col.classList.remove('sobre');
    const estado = col.dataset.estado;
    const otras = $$('.kb-tarjeta', col).filter(c => c.dataset.id !== arrastrada);
    const desp = otras.findIndex(c => { const r = c.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
    const ord = id => num((S.plan.tareas.find(t => t.ID === id) || {}).Orden);
    let orden;
    if (!otras.length) orden = 1;
    else if (desp === -1) orden = ord(otras[otras.length - 1].dataset.id) + 1;
    else if (desp === 0) orden = ord(otras[0].dataset.id) - 1;
    else orden = (ord(otras[desp - 1].dataset.id) + ord(otras[desp].dataset.id)) / 2;
    moverTareaA(arrastrada, estado, orden);
  });
}

async function moverTareaA(id, estado, orden) {
  const t = S.plan.tareas.find(x => x.ID === id);
  if (!t) return;
  const antes = { Estado: t.Estado, Orden: t.Orden };
  if (orden === undefined) orden = S.plan.tareas.filter(x => x.Estado === estado && x.ID !== id).reduce((m, x) => Math.max(m, num(x.Orden)), 0) + 1;
  Object.assign(t, { Estado: estado, Orden: String(orden) });
  pintarTareas();
  try {
    const r = await api('moverTarea', { id, estado, orden }, { silencioso: true });
    Object.assign(t, r);
    if (estado === 'Hecho' && antes.Estado !== 'Hecho') toast('¡Tarea completada! ✅', 'ok');
    pintarTareas();
  } catch (e) { Object.assign(t, antes); pintarTareas(); toast(e.message, 'error'); }
}

function moverTareaPaso(id, dir) {
  const t = S.plan.tareas.find(x => x.ID === id);
  const i = COLS_TAREA.findIndex(c => c.e === t.Estado) + Number(dir);
  if (i >= 0 && i < COLS_TAREA.length) moverTareaA(id, COLS_TAREA[i].e);
}

function formTarea(id = null, { estado = 'Pendiente', fecha = '' } = {}) {
  const t = id ? S.plan.tareas.find(x => x.ID === id) : { Estado: estado, Prioridad: 'Media', FechaLimite: fecha };
  if (!t) return toast('Tarea no encontrada.', 'error');
  const rr = esRRHH(), dis = rr ? '' : 'disabled';
  const activos = S.empleados.filter(e => e.Estado !== 'Inactivo' || e.ID === t.ResponsableID).sort(ordenarNombre);
  abrirModal({
    titulo: id ? (rr ? 'Editar tarea' : 'Tarea') : 'Nueva tarea',
    ancho: 'sm:max-w-xl',
    cuerpo: `<form id="f-tarea" class="space-y-4" onsubmit="return false">
      <input type="hidden" name="ID" value="${esc(t.ID || '')}">
      <div><label class="etiqueta">Título *</label><input name="Titulo" class="campo" required maxlength="120" value="${esc(t.Titulo || '')}" placeholder="Ej.: Inventario de tintas del mes" ${dis}></div>
      <div><label class="etiqueta">Descripción</label><textarea name="Descripcion" rows="3" class="campo" maxlength="2000" placeholder="Detalles, pasos, materiales…" ${dis}>${esc(t.Descripcion || '')}</textarea></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="etiqueta">Estado</label><select name="Estado" class="campo" ${dis}>${opciones(COLS_TAREA.map(c => c.e), t.Estado)}</select></div>
        <div><label class="etiqueta">Prioridad</label><select name="Prioridad" class="campo" ${dis}>${opciones(['Baja', 'Media', 'Alta', 'Urgente'], t.Prioridad)}</select></div>
        <div><label class="etiqueta">Responsable</label><select name="ResponsableID" class="campo" ${dis}>${opciones(activos.map(e => ({ v: e.ID, t: nombreCompleto(e) })), t.ResponsableID || '', 'Sin asignar')}</select></div>
        <div><label class="etiqueta">Fecha límite</label><input name="FechaLimite" type="date" class="campo" value="${esc(t.FechaLimite || '')}" ${dis}></div>
        <div><label class="etiqueta">Departamento</label><select name="Departamento" class="campo" ${dis}>${opciones(S.sesion.departamentos || [], t.Departamento || '', 'Ninguno en particular')}</select></div>
        <div><label class="etiqueta">Etiquetas</label><input name="Etiquetas" class="campo" maxlength="120" value="${esc(t.Etiquetas || '')}" placeholder="almacén, cliente X" ${dis}></div>
      </div>
      ${rr ? '<p class="text-xs text-slate-500">Si asignas un responsable con correo, le llegará un aviso y verá la tarea en su celular, donde podrá marcarla como hecha.</p>' : ''}
      ${t.ID ? `<p class="text-xs text-slate-400">Creada por ${esc(t.CreadoPor || '—')} el ${esc(String(t.Creado || '').slice(0, 16))}${t.Completado ? ` · completada el ${esc(String(t.Completado).slice(0, 16))}` : ''}</p>` : ''}
    </form>`,
    pie: rr ? `${t.ID ? `<button data-acc="borrar-tarea" data-id="${esc(t.ID)}" class="btn-fantasma text-rose-600 mr-auto"><i data-lucide="trash-2" class="w-4 h-4"></i>Eliminar</button>` : ''}
      <button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-tarea" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Guardar</button>`
      : `<button data-acc="cancelar-modal" class="btn-primario">Cerrar</button>`
  });
}

async function guardarTareaForm() {
  const f = $('#f-tarea');
  if (!f.reportValidity()) return;
  const datos = datosFormulario(f);
  try {
    const r = await api('guardarTarea', { tarea: datos }, { texto: 'Guardando tarea…' });
    const i = S.plan.tareas.findIndex(t => t.ID === r.ID);
    if (i >= 0) S.plan.tareas[i] = r; else S.plan.tareas.push(r);
    toast(datos.ID ? 'Tarea actualizada.' : 'Tarea creada.', 'ok');
    cerrarModal();
    if (S.seccion === 'tareas') pintarTareas();
    if (S.seccion === 'agenda') pintarAgenda();
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function borrarTarea(id) {
  if (!await confirmar('La tarea se eliminará de forma permanente.', { titulo: '¿Eliminar tarea?' })) return;
  try {
    await api('eliminarTarea', { id }, { texto: 'Eliminando…' });
    S.plan.tareas = S.plan.tareas.filter(t => t.ID !== id);
    toast('Tarea eliminada.', 'ok'); cerrarModal();
    if (S.seccion === 'tareas') pintarTareas();
    if (S.seccion === 'agenda') pintarAgenda();
  } catch (e) { toast(e.message, 'error'); }
}

/* ======================= 17l. AGENDA ======================= */
const COLOR_EVENTO = { 'Reunión': '#2747c9', 'Actividad': '#C10866', 'Capacitación': '#7c3aed', 'Entrevista': '#0284c7', 'Entrega': '#d97706',
  'Celebración': '#ca8a04', 'Recordatorio': '#64748b', 'Otro': '#64748b' };
const FILTROS_AGENDA = [{ k: 'eventos', t: 'Actividades', c: '#C10866' }, { k: 'tareas', t: 'Tareas', c: '#0ea5e9' },
  { k: 'permisos', t: 'Vacaciones y permisos', c: '#10b981' }, { k: 'cumple', t: 'Cumpleaños', c: '#EECF15' }];

async function cargarAgenda() {
  S.agMes = S.agMes || hoyStr().slice(0, 7);
  S.agDia = S.agDia || hoyStr();
  S.agFiltros = S.agFiltros || new Set(FILTROS_AGENDA.map(f => f.k));
  try { await asegurarCatalogo(); await cargarPlan(); } catch (e) { return toast(e.message, 'error'); }
  pintarAgenda();
}

/** Todo lo que pasa en una fecha: actividades, tareas que vencen, vacaciones/permisos y cumpleaños. */
function itemsDelDia(f) {
  const out = [], fl = S.agFiltros || new Set(FILTROS_AGENDA.map(x => x.k));
  if (fl.has('eventos')) (S.plan?.eventos || []).filter(e => e.Fecha === f).sort((a, b) => (a.HoraInicio || '99') < (b.HoraInicio || '99') ? -1 : 1)
    .forEach(e => out.push({ tipo: 'evento', id: e.ID, color: COLOR_EVENTO[e.Tipo] || '#64748b', hora: e.HoraInicio, titulo: e.Titulo, sub: [e.Tipo, e.HoraInicio ? e.HoraInicio + (e.HoraFin ? '–' + e.HoraFin : '') : 'Todo el día', e.Lugar].filter(Boolean).join(' · '), obj: e }));
  if (fl.has('tareas')) (S.plan?.tareas || []).filter(t => t.FechaLimite === f)
    .forEach(t => out.push({ tipo: 'tarea', id: t.ID, color: t.Estado === 'Hecho' ? '#10b981' : t.Prioridad === 'Urgente' ? '#e11d48' : '#0ea5e9', titulo: (t.Estado === 'Hecho' ? '✓ ' : '☐ ') + t.Titulo, sub: `Tarea · ${t.Estado} · ${t.ResponsableID ? nombreCompleto(empPorId(t.ResponsableID)) : 'sin asignar'}`, hecha: t.Estado === 'Hecho', obj: t }));
  if (fl.has('permisos') && diaSemana(f) !== 7) (S.permisos || []).filter(p => (p.Estado === 'Aprobado' || p.Estado === 'Pendiente') && p.FechaInicio <= f && p.FechaFin >= f)
    .forEach(p => { const e = empPorId(p.EmpleadoID); out.push({ tipo: 'permiso', id: p.ID, color: p.Estado === 'Pendiente' ? '#94a3b8' : '#10b981', titulo: `${p.Tipo === 'Vacaciones' ? '🌴' : '📄'} ${e ? String(e.Nombres).split(' ')[0] + ' ' + String(e.Apellidos).split(' ')[0] : p.EmpleadoID}`, sub: `${p.Tipo}${p.Estado === 'Pendiente' ? ' (por aprobar)' : ''}`, obj: p }); });
  if (fl.has('cumple')) S.empleados.filter(e => e.Estado !== 'Inactivo' && /^\d{4}-\d{2}-\d{2}/.test(e.FechaNacimiento || '') && e.FechaNacimiento.slice(5, 10) === f.slice(5, 10))
    .forEach(e => out.push({ tipo: 'cumple', id: e.ID, color: '#ca8a04', titulo: `🎂 ${String(e.Nombres).split(' ')[0]} ${String(e.Apellidos).split(' ')[0]}`, sub: `Cumple ${Number(f.slice(0, 4)) - Number(e.FechaNacimiento.slice(0, 4))} años · ${e.Departamento}`, obj: e }));
  return out;
}

function pintarAgenda() {
  if (!S.plan || !S.agMes) return;
  const [y, m] = S.agMes.split('-').map(Number);
  const primero = `${S.agMes}-01`, hoy = hoyStr();
  $('#ag-titulo').textContent = fmtPeriodo(S.agMes);
  $('#ag-filtros').innerHTML = FILTROS_AGENDA.map(f => `<button data-acc="ag-filtro" data-k="${f.k}" class="insignia border ${S.agFiltros.has(f.k) ? 'bg-white text-slate-700 border-slate-300' : 'bg-transparent text-slate-400 border-dashed border-slate-300 line-through'}">
    <span class="h-2 w-2 rounded-full" style="background:${f.c}"></span>${f.t}</button>`).join('');
  const inicio = sumarDias(primero, -(diaSemana(primero) - 1));
  const ultimo = fechaStr(new Date(y, m, 0));
  const fin = sumarDias(ultimo, 7 - diaSemana(ultimo));
  $('#ag-calendario').innerHTML = rangoFechas(inicio, fin).map(f => {
    const items = itemsDelDia(f), fuera = f.slice(0, 7) !== S.agMes, dom = diaSemana(f) === 7;
    return `<div data-acc="ag-dia" data-f="${f}" class="cal-dia border-b border-r border-slate-100 p-1.5 cursor-pointer hover:bg-slate-50 ${fuera ? 'bg-slate-50/70' : ''} ${f === S.agDia ? 'ring-2 ring-inset ring-marca-600' : ''}">
      <div class="flex justify-between items-center mb-1"><span class="text-xs font-bold h-6 min-w-6 px-1.5 rounded-full flex items-center justify-center ${f === hoy ? 'bg-marca-700 text-white' : fuera || dom ? 'text-slate-400' : 'text-slate-700'}">${Number(f.slice(8))}</span>
        ${items.length ? `<span class="sm:hidden h-1.5 w-1.5 rounded-full bg-marca-600"></span>` : ''}</div>
      <div class="space-y-0.5 hidden sm:block">${items.slice(0, 3).map(x => `<div class="cal-chip ${x.hecha ? 'line-through opacity-60' : ''}" style="background:${x.color}1f;color:${x.color}" title="${esc(x.titulo + ' · ' + x.sub)}"><span class="h-1.5 w-1.5 rounded-full shrink-0" style="background:${x.color}"></span><span class="cal-chip-txt truncate">${x.hora ? esc(x.hora) + ' ' : ''}${esc(x.titulo)}</span></div>`).join('')}
        ${items.length > 3 ? `<p class="text-[10px] font-semibold text-slate-500 pl-1">+${items.length - 3} más</p>` : ''}</div>
    </div>`;
  }).join('');
  pintarDiaAgenda();
  iconos();
}

function pintarDiaAgenda() {
  const f = S.agDia, items = itemsDelDia(f);
  $('#ag-dia-titulo').textContent = aFecha(f).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });
  const acc = { evento: 'ver-evento', tarea: 'ver-tarea', permiso: 'nav', cumple: 'ver-expediente' };
  $('#ag-dia').innerHTML = (items.length ? items.map(x => `
    <button data-acc="${acc[x.tipo]}" data-id="${esc(x.id)}" ${x.tipo === 'permiso' ? 'data-sec="permisos"' : ''} class="w-full text-left px-5 py-3 flex gap-3 hover:bg-slate-50">
      <span class="mt-1 h-3 w-3 rounded-full shrink-0" style="background:${x.color}"></span>
      <span class="min-w-0"><span class="block text-sm font-semibold text-slate-800 ${x.hecha ? 'line-through' : ''}">${esc(x.titulo)}</span>
        <span class="block text-xs text-slate-500">${esc(x.sub)}</span>
        ${x.tipo === 'evento' && x.obj.Descripcion ? `<span class="block text-xs text-slate-400 mt-0.5 line-clamp-2">${esc(x.obj.Descripcion)}</span>` : ''}</span>
    </button>`).join('') : '<p class="px-5 py-8 text-center text-sm text-slate-400">Nada programado este día.</p>') +
    `<div class="px-5 py-3 solo-rrhh flex flex-wrap gap-2"><button data-acc="nuevo-evento" data-f="${f}" class="btn-sec btn-sm"><i data-lucide="calendar-plus" class="w-4 h-4"></i>Actividad este día</button>
      <button data-acc="nueva-tarea" data-f="${f}" class="btn-sec btn-sm"><i data-lucide="plus" class="w-4 h-4"></i>Tarea que vence este día</button></div>`;
  iconos();
}

function formEvento(id = null, { fecha = '' } = {}) {
  const ev = id ? S.plan.eventos.find(x => x.ID === id) : { Fecha: fecha || S.agDia || hoyStr(), Tipo: 'Reunión', Visibilidad: 'TODOS' };
  if (!ev) return toast('Actividad no encontrada.', 'error');
  const rr = esRRHH(), dis = rr ? '' : 'disabled';
  abrirModal({
    titulo: id ? (rr ? 'Editar actividad' : ev.Titulo) : 'Nueva actividad',
    ancho: 'sm:max-w-xl',
    cuerpo: `<form id="f-evento" class="space-y-4" onsubmit="return false">
      <input type="hidden" name="ID" value="${esc(ev.ID || '')}">
      <div><label class="etiqueta">Título *</label><input name="Titulo" class="campo" required maxlength="120" value="${esc(ev.Titulo || '')}" placeholder="Ej.: Reunión de planificación" ${dis}></div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="col-span-2"><label class="etiqueta">Tipo</label><select name="Tipo" class="campo" ${dis}>${opciones(S.plan.tiposEvento || Object.keys(COLOR_EVENTO), ev.Tipo)}</select></div>
        <div class="col-span-2"><label class="etiqueta">Fecha *</label><input name="Fecha" type="date" class="campo" required value="${esc(ev.Fecha)}" ${dis}></div>
        <div class="col-span-1"><label class="etiqueta">Desde</label><input name="HoraInicio" type="time" class="campo" value="${esc(ev.HoraInicio || '')}" ${dis}></div>
        <div class="col-span-1"><label class="etiqueta">Hasta</label><input name="HoraFin" type="time" class="campo" value="${esc(ev.HoraFin || '')}" ${dis}></div>
        <div class="col-span-2"><label class="etiqueta">Lugar</label><input name="Lugar" class="campo" maxlength="120" value="${esc(ev.Lugar || '')}" placeholder="Sala de reuniones, taller…" ${dis}></div>
      </div>
      <p class="text-xs text-slate-400 -mt-2">Sin horas = todo el día.</p>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="etiqueta">¿Quién la ve?</label><select name="Visibilidad" class="campo" ${dis}>${opciones([{ v: 'TODOS', t: 'Todo el personal' }, { v: 'DEPARTAMENTO', t: 'Un departamento' }, { v: 'GESTION', t: 'Solo RRHH y Dirección' }], ev.Visibilidad)}</select></div>
        <div data-si="depto"><label class="etiqueta">Departamento</label><select name="Departamento" class="campo" ${dis}>${opciones(S.sesion.departamentos || [], ev.Departamento || '', 'Selecciona…')}</select></div>
      </div>
      <div><label class="etiqueta">Descripción</label><textarea name="Descripcion" rows="3" class="campo" maxlength="2000" ${dis}>${esc(ev.Descripcion || '')}</textarea></div>
      ${rr ? '<p class="text-xs text-slate-500">Las actividades para "todo el personal" o un departamento aparecen en el celular de cada empleado, en "Mis tareas y actividades".</p>' : ''}
    </form>`,
    pie: rr ? `${ev.ID ? `<button data-acc="borrar-evento" data-id="${esc(ev.ID)}" class="btn-fantasma text-rose-600 mr-auto"><i data-lucide="trash-2" class="w-4 h-4"></i>Eliminar</button>` : ''}
      <button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-evento" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Guardar</button>`
      : `<button data-acc="cancelar-modal" class="btn-primario">Cerrar</button>`
  });
  const f = $('#f-evento');
  const cond = () => { $('[data-si="depto"]', f).classList.toggle('invisible', f.Visibilidad.value !== 'DEPARTAMENTO'); f.Departamento.required = f.Visibilidad.value === 'DEPARTAMENTO'; };
  f.Visibilidad.addEventListener('change', cond); cond();
}

async function guardarEventoForm() {
  const f = $('#f-evento');
  if (!f.reportValidity()) return;
  const datos = datosFormulario(f);
  try {
    const r = await api('guardarEvento', { evento: datos }, { texto: 'Guardando actividad…' });
    const i = S.plan.eventos.findIndex(e => e.ID === r.ID);
    if (i >= 0) S.plan.eventos[i] = r; else S.plan.eventos.push(r);
    toast(datos.ID ? 'Actividad actualizada.' : 'Actividad creada.', 'ok');
    cerrarModal();
    S.agDia = r.Fecha; S.agMes = r.Fecha.slice(0, 7);
    if (S.seccion === 'agenda') pintarAgenda();
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function borrarEvento(id) {
  if (!await confirmar('La actividad se eliminará de la agenda.', { titulo: '¿Eliminar actividad?' })) return;
  try {
    await api('eliminarEvento', { id }, { texto: 'Eliminando…' });
    S.plan.eventos = S.plan.eventos.filter(e => e.ID !== id);
    toast('Actividad eliminada.', 'ok'); cerrarModal();
    if (S.seccion === 'agenda') pintarAgenda();
  } catch (e) { toast(e.message, 'error'); }
}

/* ---------- En el celular del empleado: sus tareas y actividades ---------- */
async function cargarMiAgenda() {
  const card = $('#mc-agenda');
  try {
    const d = await api('miAgenda', {}, { silencioso: true });
    S.miAgenda = d;
    if (!d.tareas.length && !d.eventos.length) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const sig = { 'Pendiente': ['En progreso', 'Empezar', 'play'], 'En progreso': ['Hecho', 'Listo', 'check'], 'En revisión': ['Hecho', 'Listo', 'check'] };
    const tareas = d.tareas.sort((a, b) => (a.Estado === 'Hecho') - (b.Estado === 'Hecho') || String(a.FechaLimite || '9').localeCompare(String(b.FechaLimite || '9'))).map(t => {
      const v = estadoVencimiento(t), s = sig[t.Estado];
      return `<div class="px-5 py-3 flex items-center gap-3">
        <span class="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${t.Estado === 'Hecho' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-700'}"><i data-lucide="${t.Estado === 'Hecho' ? 'circle-check' : 'square-kanban'}" class="w-5 h-5"></i></span>
        <div class="flex-1 min-w-0"><p class="text-sm font-semibold text-slate-800 ${t.Estado === 'Hecho' ? 'line-through text-slate-400' : ''}">${esc(t.Titulo)}</p>
          <p class="text-xs ${v === 'vencida' ? 'text-rose-600 font-semibold' : v === 'pronto' ? 'text-amber-600' : 'text-slate-500'}">${esc(t.Estado)} · ${esc(t.Prioridad)}${t.FechaLimite ? ' · vence ' + esc(fmtFechaCorta(t.FechaLimite)) + (v === 'vencida' ? ' (vencida)' : '') : ''}</p></div>
        ${s ? `<button data-acc="mi-tarea" data-id="${esc(t.ID)}" data-estado="${s[0]}" class="btn btn-sm ${s[0] === 'Hecho' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-navy-900 text-white hover:bg-navy-950'} shrink-0"><i data-lucide="${s[2]}" class="w-4 h-4"></i>${s[1]}</button>` : ''}
      </div>`;
    }).join('');
    const eventos = d.eventos.map(e => `<div class="px-5 py-3 flex items-center gap-3">
        <span class="h-9 w-9 shrink-0 rounded-xl flex flex-col items-center justify-center text-white leading-none" style="background:${COLOR_EVENTO[e.Tipo] || '#64748b'}"><span class="text-sm font-extrabold">${Number(e.Fecha.slice(8))}</span><span class="text-[9px] uppercase">${esc(MESES[Number(e.Fecha.slice(5, 7)) - 1])}</span></span>
        <div class="min-w-0"><p class="text-sm font-semibold text-slate-800">${esc(e.Titulo)}</p>
          <p class="text-xs text-slate-500">${esc([fmtFechaCorta(e.Fecha), e.HoraInicio ? e.HoraInicio + (e.HoraFin ? '–' + e.HoraFin : '') : 'Todo el día', e.Lugar].filter(Boolean).join(' · '))}</p></div>
      </div>`).join('');
    $('#mc-agenda-lista').innerHTML = tareas + eventos;
    iconos();
  } catch (e) { card.classList.add('hidden'); }
}

async function cambiarMiTarea(id, estado) {
  try {
    await api('moverTarea', { id, estado }, { texto: 'Actualizando…' });
    toast(estado === 'Hecho' ? '¡Tarea completada! ✅ RRHH ya fue avisado.' : 'Tarea en progreso.', 'ok', 5000);
    if (estado === 'Hecho') lanzarConfeti(1500);
    cargarMiAgenda();
  } catch (e) { toast(e.message, 'error'); }
}

/* ======================= 17m. CURRÍCULUMS ======================= */
const ESTILO_CV = { 'Nuevo': 'bg-sky-100 text-sky-700', 'En revisión': 'bg-amber-100 text-amber-700', 'Preseleccionado': 'bg-violet-100 text-violet-700',
  'Entrevistado': 'bg-navy-100 text-navy-700', 'Contratado': 'bg-emerald-100 text-emerald-700', 'Descartado': 'bg-slate-200 text-slate-600' };

function estrellasHTML(id, n, editable) {
  n = Number(n) || 0;
  return `<span class="estrellas inline-flex whitespace-nowrap" title="${n ? n + ' de 5 estrellas' : 'Sin calificar'}">${[1, 2, 3, 4, 5].map(i => editable
    ? `<button type="button" data-acc="cv-estrella" data-id="${esc(id)}" data-n="${i}" class="${i <= n ? 'on' : ''}" aria-label="${i} estrellas">★</button>`
    : `<button type="button" tabindex="-1" class="${i <= n ? 'on' : ''} cursor-default">★</button>`).join('')}</span>`;
}

async function cargarCurriculums() {
  if (!S.cv) $('#cv-tabla').innerHTML = '<p class="text-center text-sm text-slate-400 py-16 pulso">Cargando currículums…</p>';
  try {
    await asegurarCatalogo();
    const d = await api('curriculums', {}, { silencioso: !!S.cv });
    S.cv = d;
  } catch (e) { return toast(e.message, 'error'); }
  const est = $('#cv-estado'), dep = $('#cv-depto'), ve = est.value, vd = dep.value;
  est.innerHTML = opciones(S.cv.estados, '', 'Todos los estados');
  dep.innerHTML = opciones(S.sesion.departamentos || [], '', 'Todos los departamentos');
  est.value = ve; dep.value = vd;
  pintarCurriculums();
}

function pintarCurriculums() {
  if (!S.cv) return;
  const q = normalizar($('#cv-buscar').value.trim()), est = $('#cv-estado').value, dep = $('#cv-depto').value, es = $('#cv-estrellas').value;
  const todos = S.cv.curriculums;
  const lista = todos.filter(c => {
    if (est && c.Estado !== est) return false;
    if (dep && c.Departamento !== dep) return false;
    const n = num(c.Estrellas);
    if (es === '0' ? n > 0 : es === '5' ? n !== 5 : es ? n < Number(es) : false) return false;
    return !q || normalizar([c.Nombres, c.Apellidos, c.Cargo, c.Email, c.Telefono, c.Notas, c.Cedula, c.Fuente].join(' ')).includes(q);
  }).sort((a, b) => num(b.Estrellas) - num(a.Estrellas) || (a.Recibido < b.Recibido ? 1 : -1));
  const activos = todos.filter(c => !['Contratado', 'Descartado'].includes(c.Estado));
  $('#cv-resumen').innerHTML = [
    tarjetaKPI('inbox', 'Currículums', todos.length, `${activos.length} en proceso`, 'marca'),
    tarjetaKPI('sparkles', 'Nuevos sin revisar', todos.filter(c => c.Estado === 'Nuevo').length, 'Estado "Nuevo"', 'azul'),
    tarjetaKPI('star', '4 o 5 estrellas', todos.filter(c => num(c.Estrellas) >= 4).length, 'Candidatos destacados', 'ambar'),
    tarjetaKPI('user-check', 'Contratados', todos.filter(c => c.Estado === 'Contratado').length, 'Desde el banco de currículums', 'verde')
  ].join('');
  const rr = esRRHH();
  renderTabla('cv-tabla', 't-cv', [
    { t: 'Candidato', v: c => `<button data-acc="editar-cv" data-id="${esc(c.ID)}" class="font-semibold text-slate-800 hover:text-marca-700 text-left">${esc(c.Nombres + ' ' + (c.Apellidos || ''))}</button>
        <div class="text-xs text-slate-500">${esc(c.Cargo || 'Cargo no indicado')}</div>
        <div class="text-xs text-slate-400">${esc([c.Telefono, c.Email].filter(Boolean).join(' · '))}</div>`, s: c => c.Nombres + ' ' + c.Apellidos, c: c => (c.Nombres + ' ' + (c.Apellidos || '')).trim() },
    { t: 'Cargo', v: c => esc(c.Cargo), c: c => c.Cargo, cls: 'hidden' },
    { t: 'Correo', v: c => esc(c.Email), c: c => c.Email, cls: 'hidden' },
    { t: 'Teléfono', v: c => esc(c.Telefono), c: c => c.Telefono, cls: 'hidden' },
    { t: 'Cédula', v: c => esc(c.Cedula), c: c => c.Cedula, cls: 'hidden' },
    { t: 'Recibido', v: c => esc(fmtFecha(c.Recibido)), s: c => c.Recibido, c: c => c.Recibido },
    { t: 'Departamento', v: c => esc(c.Departamento || '—'), s: c => c.Departamento, c: c => c.Departamento },
    { t: 'Fuente', v: c => `<span class="text-xs text-slate-500">${esc(c.Fuente || '—')}</span>`, c: c => c.Fuente },
    { t: 'Experiencia', v: c => c.Experiencia !== '' ? `${esc(c.Experiencia)} año${c.Experiencia === '1' ? '' : 's'}` : '—', s: c => num(c.Experiencia), c: c => c.Experiencia, cls: 'text-right' },
    { t: 'Pre-evaluación', v: c => estrellasHTML(c.ID, c.Estrellas, rr), s: c => num(c.Estrellas), c: c => c.Estrellas },
    { t: 'Estado', v: c => `<span class="insignia ${ESTILO_CV[c.Estado] || ''}">${esc(c.Estado)}</span>${c.EmpleadoID ? `<button data-acc="ver-expediente" data-id="${esc(c.EmpleadoID)}" class="block text-xs text-navy-700 hover:text-marca-700 mt-1">Expediente ${esc(c.EmpleadoID)}</button>` : ''}`, s: c => c.Estado, c: c => c.Estado },
    { t: 'Notas', v: c => esc(c.Notas), c: c => c.Notas, cls: 'hidden' },
    { t: '', v: c => `<div class="flex justify-end gap-1 no-print whitespace-nowrap">
        ${c.FileID ? `<button data-acc="ver-cv" data-id="${esc(c.ID)}" class="btn-fantasma btn-sm" title="Ver archivo"><i data-lucide="paperclip" class="w-4 h-4"></i></button>` : ''}
        ${c.Estado !== 'Contratado' ? `<button data-acc="contratar-cv" data-id="${esc(c.ID)}" class="solo-rrhh btn-fantasma btn-sm text-emerald-700" title="Contratar: crear expediente"><i data-lucide="user-plus" class="w-4 h-4"></i></button>` : ''}
        <button data-acc="editar-cv" data-id="${esc(c.ID)}" class="btn-fantasma btn-sm" title="${rr ? 'Editar' : 'Ver'}"><i data-lucide="${rr ? 'pencil' : 'eye'}" class="w-4 h-4"></i></button>
        <button data-acc="borrar-cv" data-id="${esc(c.ID)}" class="solo-rrhh btn-fantasma btn-sm text-rose-600" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`, cls: 'text-right' }
  ], lista, { vacio: todos.length ? 'Ningún currículum coincide con los filtros.' : 'Todavía no hay currículums. Pulsa "Registrar currículum" para agregar el primero.' });
}

async function calificarCV(id, n) {
  const c = S.cv.curriculums.find(x => x.ID === id);
  if (!c) return;
  const nuevo = num(c.Estrellas) === Number(n) ? 0 : Number(n);
  const antes = c.Estrellas;
  c.Estrellas = nuevo ? String(nuevo) : '';
  pintarCurriculums();
  try { await api('calificarCurriculum', { id, estrellas: nuevo }, { silencioso: true }); }
  catch (e) { c.Estrellas = antes; pintarCurriculums(); toast(e.message, 'error'); }
}

function formCurriculum(id = null) {
  const c = id ? S.cv.curriculums.find(x => x.ID === id) : { Recibido: hoyStr(), Estado: 'Nuevo', Fuente: 'Anuncio en redes' };
  if (!c) return toast('Currículum no encontrado.', 'error');
  const rr = esRRHH(), dis = rr ? '' : 'disabled';
  const inp = (n, t, tipo = 'text', extra = '') => `<div><label class="etiqueta">${t}</label><input name="${n}" type="${tipo}" class="campo" value="${esc(c[n] || '')}" ${extra} ${dis}></div>`;
  abrirModal({
    titulo: id ? `${rr ? 'Editar' : ''} ${c.Nombres} ${c.Apellidos || ''}`.trim() : 'Registrar currículum',
    ancho: 'sm:max-w-2xl',
    cuerpo: `<form id="f-cv" class="space-y-4" onsubmit="return false">
      <input type="hidden" name="ID" value="${esc(c.ID || '')}">
      <div class="grid sm:grid-cols-2 gap-4">
        ${inp('Nombres', 'Nombres *', 'text', 'required maxlength="60" ' + ATRIB_NOMBRE)}${inp('Apellidos', 'Apellidos', 'text', 'maxlength="60" ' + ATRIB_NOMBRE)}
        ${inp('Telefono', 'Teléfono', 'tel', 'data-tel inputmode="tel" placeholder="0412-1234567"')}${inp('Email', 'Correo', 'email', 'placeholder="nombre@gmail.com"')}
        ${inp('Cedula', 'Cédula (solo números)', 'text', 'inputmode="numeric" pattern="[VEve]?-?\\d{6,8}" maxlength="10"')}${inp('Recibido', 'Fecha de recepción', 'date', `max="${hoyStr()}"`)}
        ${inp('Cargo', 'Cargo al que aspira', 'text', 'maxlength="80" placeholder="Diseñador gráfico, operador de plotter…"')}
        <div><label class="etiqueta">Departamento</label><select name="Departamento" class="campo" ${dis}>${opciones(S.sesion.departamentos || [], c.Departamento || '', 'Sin definir')}</select></div>
        <div><label class="etiqueta">¿Cómo llegó?</label><select name="Fuente" class="campo" ${dis}>${opciones(S.cv.fuentes, c.Fuente || '', 'Sin indicar')}</select></div>
        <div class="grid grid-cols-2 gap-3">${inp('Experiencia', 'Experiencia (años)', 'number', 'min="0" max="60"')}
          <div><label class="etiqueta">Instrucción</label><select name="NivelInstruccion" class="campo" ${dis}>${opciones(OPC.instruccion, c.NivelInstruccion || '')}</select></div></div>
      </div>
      <div class="grid sm:grid-cols-2 gap-4 items-end">
        <div><label class="etiqueta">Pre-evaluación</label><input type="hidden" name="Estrellas" value="${esc(c.Estrellas || '')}">
          <div id="cv-form-estrellas" class="text-2xl">${estrellasHTML('form', c.Estrellas, rr)}</div></div>
        <div><label class="etiqueta">Estado</label><select name="Estado" class="campo" ${dis}>${opciones(S.cv.estados, c.Estado)}</select></div>
      </div>
      <div><label class="etiqueta">Notas (impresión, entrevista, referencias…)</label><textarea name="Notas" rows="3" maxlength="2000" class="campo" ${dis}>${esc(c.Notas || '')}</textarea></div>
      ${rr ? `<div><label class="etiqueta">Archivo del currículum (PDF, Word o foto)${c.FileNombre ? ` · actual: <b>${esc(c.FileNombre)}</b>` : ''}</label>
        <input name="archivo" type="file" accept=".pdf,.doc,.docx,image/*" class="campo file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:px-3 file:py-1 file:text-marca-700 file:font-semibold">
        ${c.FileNombre ? '<p class="text-xs text-slate-400 mt-1">Si subes otro, reemplaza al actual.</p>' : ''}</div>` : ''}
    </form>`,
    pie: rr ? `${c.FileID ? `<button data-acc="ver-cv" data-id="${esc(c.ID)}" class="btn-sec mr-auto"><i data-lucide="paperclip" class="w-4 h-4"></i>Ver archivo</button>` : ''}
      <button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-cv" class="btn-primario"><i data-lucide="check" class="w-4 h-4"></i>Guardar</button>`
      : `${c.FileID ? `<button data-acc="ver-cv" data-id="${esc(c.ID)}" class="btn-sec mr-auto"><i data-lucide="paperclip" class="w-4 h-4"></i>Ver archivo</button>` : ''}<button data-acc="cancelar-modal" class="btn-primario">Cerrar</button>`
  });
}

function estrellaFormulario(n) {
  const f = $('#f-cv');
  const nuevo = num(f.Estrellas.value) === Number(n) ? 0 : Number(n);
  f.Estrellas.value = nuevo || '';
  $('#cv-form-estrellas').innerHTML = estrellasHTML('form', nuevo, true);
}

async function guardarCurriculumForm() {
  const f = $('#f-cv');
  if (!f.reportValidity()) return;
  const datos = datosFormulario(f);
  delete datos.archivo;
  try {
    cargando(true, 'Preparando archivo…');
    let archivo = null;
    try { archivo = await archivoParaEnviar(f.archivo?.files[0]); } finally { cargando(false); }
    const r = await api('guardarCurriculum', { curriculum: datos, archivo }, { texto: 'Guardando currículum…' });
    const i = S.cv.curriculums.findIndex(c => c.ID === r.ID);
    if (i >= 0) S.cv.curriculums[i] = r; else S.cv.curriculums.push(r);
    toast(datos.ID ? 'Currículum actualizado.' : 'Currículum registrado.', 'ok');
    if (r._aviso) toast(r._aviso, 'aviso', 9000);
    cerrarModal(); pintarCurriculums();
  } catch (e) { toast(e.message, 'error', 7000); }
}

async function borrarCurriculum(id) {
  if (!await confirmar('Se eliminará el registro y su archivo irá a la papelera de Google Drive.', { titulo: '¿Eliminar currículum?' })) return;
  try {
    await api('eliminarCurriculum', { id }, { texto: 'Eliminando…' });
    S.cv.curriculums = S.cv.curriculums.filter(c => c.ID !== id);
    toast('Currículum eliminado.', 'ok'); pintarCurriculums();
  } catch (e) { toast(e.message, 'error'); }
}

/** Contratar: abre el formulario de nuevo empleado con los datos del currículum. */
function contratarCV(id) {
  const c = S.cv.curriculums.find(x => x.ID === id);
  if (!c) return;
  formEmpleado(null, { cv: c, base: { Nombres: c.Nombres, Apellidos: c.Apellidos, Cedula: c.Cedula, Email: c.Email, Telefono: c.Telefono,
    Departamento: (S.sesion.departamentos || []).includes(c.Departamento) ? c.Departamento : '', Cargo: c.Cargo, NivelInstruccion: c.NivelInstruccion } });
}

/* ======================= 17n. REGISTRO DE ACTIVIDAD (solo lectura) ======================= */
const CAT_REGISTRO = {
  'Marcajes': ['ENTRADA', 'SALIDA', 'SOLICITUD_MARCAJE', 'SOLICITUD_APROBADA', 'SOLICITUD_RECHAZADA', 'MARCAJE_RECHAZADO', 'ASISTENCIA_MANUAL', 'ASISTENCIA_CORREGIDA', 'ASISTENCIA_ELIMINADA'],
  'Empleados y accesos': ['EMPLEADO_CREADO', 'EMPLEADO_EDITADO', 'EMPLEADOS_IMPORTADOS', 'FOTO_ACTUALIZADA', 'SOLICITUD_ACCESO', 'ACCESO_APROBADO', 'ACCESO_RECHAZADO', 'ACCESO_VINCULADO'],
  'Permisos y vacaciones': ['PERMISO_CREADO', 'PERMISO_EDITADO', 'PERMISO_ELIMINADO', 'PERMISO_SOLICITADO', 'PERMISO_ANULADO', 'PERMISO_APROBADO', 'PERMISO_RECHAZADO'],
  'Documentos y manuales': ['DOCUMENTO_SUBIDO', 'DOCUMENTO_ELIMINADO', 'MANUAL_SUBIDO', 'MANUAL_ELIMINADO'],
  'Desempeño y reconocimientos': ['EVALUACION_CREADA', 'EVALUACION_EDITADA', 'EVALUACION_ELIMINADA', 'EMPLEADO_DEL_MES', 'EMPLEADO_DEL_MES_QUITADO', 'DEPARTAMENTO_DEL_MES'],
  'Tareas y agenda': ['TAREA_CREADA', 'TAREA_EDITADA', 'TAREA_MOVIDA', 'TAREA_ELIMINADA', 'EVENTO_CREADO', 'EVENTO_EDITADO', 'EVENTO_ELIMINADO'],
  'Currículums': ['CURRICULUM_REGISTRADO', 'CURRICULUM_EDITADO', 'CURRICULUM_CALIFICADO', 'CURRICULUM_ELIMINADO'],
  'Ajustes y sistema': ['AJUSTES', 'DEPARTAMENTO_CREADO', 'DEPARTAMENTO_RENOMBRADO', 'DEPARTAMENTO_ACTIVADO', 'DEPARTAMENTO_DESACTIVADO', 'DEPARTAMENTO_ELIMINADO', 'RESPALDO']
};
const COLOR_CAT = ['bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-marca-100 text-marca-700', 'bg-navy-100 text-navy-700', 'bg-oro-100 text-oro-700', 'bg-slate-200 text-slate-700'];
const ETIQUETA_ACCION = { ENTRADA: 'Marcó entrada', SALIDA: 'Marcó salida', AJUSTES: 'Cambió ajustes', RESPALDO: 'Respaldo creado', EMPLEADO_DEL_MES: 'Empleado del mes',
  DEPARTAMENTO_DEL_MES: 'Departamento del mes', SOLICITUD_ACCESO: 'Pidió acceso', SOLICITUD_MARCAJE: 'Pidió marcaje manual', PERMISO_SOLICITADO: 'Pidió permiso' };
const etiquetaAccion = a => ETIQUETA_ACCION[a] || (a.charAt(0) + a.slice(1).toLowerCase().replace(/_/g, ' '))
  .replace(/^Curriculum/, 'Currículum').replace(/^Evaluacion/, 'Evaluación').replace(/ dia/, ' día');
const catDeAccion = a => Object.keys(CAT_REGISTRO).find(k => CAT_REGISTRO[k].includes(a)) || 'Otros';

function prepararFiltrosRegistro() {
  if ($('#rg-desde').value) return;
  $('#rg-desde').value = sumarDias(hoyStr(), -30);
  $('#rg-hasta').value = hoyStr();
  $('#rg-categoria').innerHTML = opciones(Object.keys(CAT_REGISTRO), '', 'Todos los tipos');
}

async function cargarRegistro(mas = false) {
  try { await asegurarCatalogo(); } catch (e) { return toast(e.message, 'error'); }
  prepararFiltrosRegistro();
  const sel = $('#rg-usuario'), v = sel.value;
  const correos = [...new Set(S.empleados.filter(e => e.Email).map(e => e.Email).concat([S.sesion.email]))].sort();
  sel.innerHTML = opciones(correos.map(c => { const e = S.empleados.find(x => x.Email === c); return { v: c, t: e ? nombreCompleto(e) : c }; }), v, 'Todos los usuarios');
  sel.value = v;
  const cat = $('#rg-categoria').value;
  const p = { desde: $('#rg-desde').value, hasta: $('#rg-hasta').value, email: sel.value, q: $('#rg-buscar').value.trim(),
    acciones: cat ? CAT_REGISTRO[cat] : [], limite: 200, antes: mas ? S.reg?.siguiente : null };
  if (!mas) $('#rg-tabla').innerHTML = '<p class="text-center text-sm text-slate-400 py-16 pulso">Cargando registro…</p>';
  try {
    const d = await api('auditoria', p, { silencioso: true });
    S.reg = { lista: (mas && S.reg ? S.reg.lista : []).concat(d.registros), siguiente: d.siguiente, total: d.total };
  } catch (e) { return toast(e.message, 'error'); }
  const porCorreo = {};
  S.empleados.forEach(e => { if (e.Email) porCorreo[e.Email.toLowerCase()] = e; });
  const cats = Object.keys(CAT_REGISTRO);
  renderTabla('rg-tabla', 't-registro', [
    { t: 'Fecha y hora', v: r => `<span class="whitespace-nowrap tabular-nums">${esc(r.Fecha.slice(0, 16))}</span>`, c: r => r.Fecha },
    { t: 'Usuario', v: r => { const e = porCorreo[String(r.Email).toLowerCase()]; return e ? `<span class="font-semibold text-slate-800">${esc(nombreCompleto(e))}</span><div class="text-xs text-slate-400">${esc(r.Email)}</div>` : `<span class="text-slate-600">${esc(r.Email || '—')}</span>`; }, c: r => r.Email },
    { t: 'Acción', v: r => { const c = catDeAccion(r.Accion); return `<span class="insignia ${COLOR_CAT[cats.indexOf(c)] || 'bg-slate-100 text-slate-600'}">${esc(etiquetaAccion(r.Accion))}</span><div class="text-[11px] text-slate-400 mt-0.5">${esc(c)}</div>`; }, c: r => r.Accion },
    { t: 'Detalle', v: r => `<span class="text-xs text-slate-600">${esc(r.Detalle)}</span>`, c: r => r.Detalle, cls: 'envolver' }
  ], S.reg.lista, { vacio: 'No hay movimientos con estos filtros.' });
  $('#rg-mas').classList.toggle('hidden', !S.reg.siguiente);
  $('#rg-mas').textContent = `Cargar más (${S.reg.lista.length} mostrados)`;
}

/* ======================= 17o. CENTRO DE AYUDA ======================= */
const GUIAS_INCLUIDAS = [
  { ID: 'guia-rapida', Titulo: 'Guía rápida de uso', Categoria: 'Guías de usuario', Audiencia: 'TODOS', url: 'ayuda/guia-rapida.pdf',
    Descripcion: 'Una sola hoja con lo esencial: instalar la app, marcar entrada y salida, pedir marcajes y permisos, tus tareas y más.', incluida: true }
];

function iconoArchivo(m) {
  const t = String(m.FileMime || (m.url ? 'application/pdf' : ''));
  return /pdf/.test(t) ? ['file-text', 'bg-rose-50 text-rose-600'] : /image/.test(t) ? ['image', 'bg-sky-50 text-sky-600']
    : /word|document/.test(t) ? ['file-type', 'bg-blue-50 text-blue-600'] : /sheet|excel/.test(t) ? ['file-spreadsheet', 'bg-emerald-50 text-emerald-600'] : ['file', 'bg-slate-100 text-slate-600'];
}

function ayudaHTML(manuales, categorias) {
  const todos = GUIAS_INCLUIDAS.concat(manuales);
  const cats = (categorias || ['Guías de usuario', 'Procedimientos', 'Normas y políticas', 'Formatos', 'Otros']).filter(c => todos.some(m => m.Categoria === c));
  const tarjeta = m => { const [ic, col] = iconoArchivo(m); return `<div class="tarjeta p-4 flex items-start gap-3">
      <span class="h-11 w-11 rounded-xl ${col} flex items-center justify-center shrink-0"><i data-lucide="${ic}" class="w-5 h-5"></i></span>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-slate-800">${esc(m.Titulo)}</p>
        ${m.Descripcion ? `<p class="text-xs text-slate-500 mt-0.5">${esc(m.Descripcion)}</p>` : ''}
        <div class="flex flex-wrap items-center gap-1.5 mt-2">
          ${m.incluida ? '<span class="insignia bg-marca-50 text-marca-700">Incluida en la app</span>' : ''}
          ${m.Audiencia === 'GESTION' ? '<span class="insignia bg-navy-50 text-navy-700">Solo RRHH y Dirección</span>' : ''}
          ${m.Tamano ? `<span class="text-[11px] text-slate-400">${esc(fmtTamano(m.Tamano))}</span>` : ''}
        </div>
      </div>
      <div class="flex flex-col gap-1 shrink-0">
        <button data-acc="ver-manual" data-id="${esc(m.ID)}" ${m.url ? `data-url="${esc(m.url)}"` : ''} class="btn-primario btn-sm"><i data-lucide="book-open" class="w-4 h-4"></i>Ver</button>
        ${!m.incluida ? `<button data-acc="borrar-manual" data-id="${esc(m.ID)}" class="solo-rrhh btn-fantasma btn-sm text-rose-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
      </div></div>`; };
  return cats.map(c => `<div class="mb-6"><h3 class="text-xs font-bold uppercase tracking-wide text-marca-700 mb-3">${esc(c)}</h3>
    <div class="grid md:grid-cols-2 gap-3">${todos.filter(m => m.Categoria === c).map(tarjeta).join('')}</div></div>`).join('') +
    `<p class="text-xs text-slate-400 text-center">¿Tienes una duda que no está aquí? Escríbele a Recursos Humanos.</p>`;
}


async function cargarAyuda() {
  try { S.ayuda = await api('ayuda', {}, { silencioso: !!S.ayuda }); } catch (e) { S.ayuda = S.ayuda || { manuales: [], categorias: null }; }
  $('#ay-contenido').innerHTML = ayudaHTML(S.ayuda.manuales, S.ayuda.categorias);
  iconos();
}

/** Para el empleado (y desde la pantalla de marcaje): el centro de ayuda en una ventana. */
async function abrirAyudaModal() {
  abrirModal({ titulo: 'Ayuda y manuales', ancho: 'sm:max-w-3xl', cuerpo: '<div id="ay-modal"><p class="text-center text-sm text-slate-400 py-10 pulso">Cargando…</p></div>',
    pie: '<button data-acc="cancelar-modal" class="btn-primario">Cerrar</button>' });
  try { S.ayuda = await api('ayuda', {}, { silencioso: true }); } catch (e) { S.ayuda = S.ayuda || { manuales: [], categorias: null }; }
  if ($('#ay-modal')) { $('#ay-modal').innerHTML = ayudaHTML(S.ayuda.manuales, S.ayuda.categorias); iconos(); }
}

function verManual(d) {
  if (d.url) { window.open(d.url, '_blank', 'noopener'); return; }
  abrirArchivo('descargarManual', d.id);
}

function formManual() {
  abrirModal({
    titulo: 'Subir documento de ayuda',
    ancho: 'sm:max-w-lg',
    cuerpo: `<form id="f-manual" class="space-y-4" onsubmit="return false">
      <div><label class="etiqueta">Título *</label><input name="titulo" class="campo" required maxlength="120" placeholder="Ej.: Manual de normas internas"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="etiqueta">Categoría</label><select name="categoria" class="campo">${opciones(S.ayuda?.categorias || ['Guías de usuario', 'Procedimientos', 'Normas y políticas', 'Formatos', 'Otros'], 'Procedimientos')}</select></div>
        <div><label class="etiqueta">¿Quién lo ve?</label><select name="audiencia" class="campo">${opciones([{ v: 'TODOS', t: 'Todo el personal' }, { v: 'GESTION', t: 'Solo RRHH y Dirección' }], 'TODOS')}</select></div>
      </div>
      <div><label class="etiqueta">Descripción corta</label><input name="descripcion" class="campo" maxlength="300" placeholder="¿De qué trata? ¿Cuándo usarlo?"></div>
      <div><label class="etiqueta">Archivo * (PDF recomendado)</label><input name="archivo" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" class="campo file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:px-3 file:py-1 file:text-marca-700 file:font-semibold"></div>
    </form>`,
    pie: `<button data-acc="cancelar-modal" class="btn-sec">Cancelar</button><button data-acc="guardar-manual" class="btn-primario"><i data-lucide="upload" class="w-4 h-4"></i>Subir</button>`
  });
}

async function guardarManual() {
  const f = $('#f-manual');
  if (!f.reportValidity()) return;
  try {
    cargando(true, 'Preparando archivo…');
    let archivo;
    try { archivo = await archivoParaEnviar(f.archivo.files[0]); } finally { cargando(false); }
    await api('subirManual', { titulo: f.titulo.value.trim(), categoria: f.categoria.value, audiencia: f.audiencia.value, descripcion: f.descripcion.value.trim(), archivo }, { texto: 'Subiendo documento…' });
    toast('Documento publicado en Ayuda.', 'ok');
    cerrarModal(); cargarAyuda();
  } catch (e) { toast(e.message, 'error', 7000); }
}

async function borrarManual(id) {
  if (!await confirmar('El documento se quitará de Ayuda y el archivo irá a la papelera de Drive.', { titulo: '¿Eliminar documento?' })) return;
  try { await api('eliminarManual', { id }, { texto: 'Eliminando…' }); toast('Documento eliminado.', 'ok'); cargarAyuda(); }
  catch (e) { toast(e.message, 'error'); }
}

/* ======================= 17c. APP INSTALABLE Y COMPARTIR ======================= */
let eventoInstalar = null;
const esStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
function mostrarBotonesInstalar() {
  const ver = !esStandalone() && (!!eventoInstalar || esIOS());
  $$('.instalar-app').forEach(b => b.classList.toggle('hidden', !ver));
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); eventoInstalar = e; mostrarBotonesInstalar(); });
window.addEventListener('appinstalled', () => { eventoInstalar = null; mostrarBotonesInstalar(); toast('¡App instalada! Búscala en tu pantalla de inicio.', 'ok', 6000); });

async function instalarApp() {
  if (eventoInstalar) {
    eventoInstalar.prompt();
    try { await eventoInstalar.userChoice; } catch (e) { /* nada */ }
    eventoInstalar = null;
    return mostrarBotonesInstalar();
  }
  abrirModal({
    titulo: 'Instalar la app',
    ancho: 'sm:max-w-md',
    cuerpo: `<div class="space-y-3 text-sm text-slate-700">
      <p><b>iPhone (Safari):</b> toca el botón <b>Compartir</b> <i data-lucide="share" class="w-4 h-4 inline"></i> y luego <b>"Agregar a inicio"</b>.</p>
      <p><b>Android (Chrome):</b> menú <b>⋮</b> → <b>"Instalar aplicación"</b> o <b>"Agregar a pantalla principal"</b>.</p>
      <p class="text-xs text-slate-500">La app queda con el logo de Sumanpek y abre a pantalla completa.</p></div>`,
    pie: `<button data-acc="cerrar-modal" class="btn-primario">Entendido</button>`
  });
}

function compartirApp() {
  abrirModal({
    titulo: 'Compartir la app con el personal',
    ancho: 'sm:max-w-md',
    cuerpo: `<div class="text-center">
      <img src="qr-app.png" alt="Código QR de ${esc(APP_URL)}" class="mx-auto h-56 w-56 rounded-xl border border-slate-200 p-2 bg-white">
      <p class="mt-3 font-mono text-sm text-navy-900 break-all">${esc(APP_URL)}</p>
      <p class="mt-2 text-xs text-slate-500">Escanéalo con la cámara del teléfono, inicia sesión con tu Gmail y toca <b>Instalar</b>.</p>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <button data-acc="copiar-enlace" class="btn-sec btn-sm"><i data-lucide="copy" class="w-4 h-4"></i>Copiar enlace</button>
        <a href="cartel-qr.pdf" target="_blank" class="btn-primario btn-sm"><i data-lucide="printer" class="w-4 h-4"></i>Cartel para imprimir</a>
      </div></div>`
  });
}

async function copiarEnlace() {
  try { await navigator.clipboard.writeText(APP_URL); toast('Enlace copiado.', 'ok'); }
  catch (e) { toast(APP_URL, 'info', 8000); }
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
  'mes-elegir': d => elegirMes(d.id, d.valor),
  'enviar-acceso': () => enviarAcceso(),
  'revisar-acceso': () => mostrarAcceso(),
  'revisar-solicitud-acceso': d => revisarAcceso(d.id),
  'rechazar-acceso': d => rechazarAcceso(d.id),
  'vincular-acceso': d => vincularAcceso(d.id, d.emp),
  'cambiar-foto': d => cambiarFoto(d.id || null),
  'instalar-app': () => instalarApp(),
  'compartir-app': () => compartirApp(),
  'copiar-enlace': () => copiarEnlace(),
  'recargar': () => actualizarApp('Recargando…'),
  // v3.1
  'tema': () => alternarTema(),
  'tema-fijo': d => alternarTema(d.tema === 'oscuro'),
  'rec-girar': () => S.recorte?.girar(),
  'rec-centrar': () => S.recorte?.centrar(),
  'rec-zoom': d => S.recorte?.zoomA(S.recorte.zoom + Number(d.paso)),
  'rec-guardar': () => guardarRecorte(),
  'solicitar-permiso': () => formSolicitarPermiso(),
  'enviar-permiso': () => enviarSolicitudPermiso(),
  'anular-permiso': d => anularMiPermiso(d.id),
  'reconocer': d => reconocerEmpleado(d.id, d.puntaje),
  'quitar-reconocimiento': d => quitarReconocimiento(d.id),
  'reporte': d => formReporte(d.id || null),
  'importar': () => formImportar(),
  'imp-plantilla': () => descargarPlantilla(),
  'imp-revisar': () => revisarImport(),
  'imp-confirmar': () => confirmarImport(),
  'depto-agregar': () => deptoAgregar(),
  'depto-renombrar': d => deptoRenombrar(d.nombre),
  'depto-activo': d => deptoActivo(d.nombre, d.activo === '1'),
  'depto-eliminar': d => deptoEliminar(d.nombre),
  'aj-guardar': () => guardarAjustesForm(),
  'aj-mi-ubicacion': () => ajMiUbicacion(),
  'aj-cierre': () => ajCierre(),
  'aj-respaldo': () => ajRespaldo(),
  'aj-recalcular': () => ajRecalcular(),
  // v3.2
  'reconocer-depto': d => reconocerDepto(d.depto, d.puntaje),
  'ver-eval': d => verEvaluacion(d.id),
  'nueva-tarea': d => formTarea(null, { fecha: d.f || '' }),
  'ver-tarea': d => { if (S.plan) formTarea(d.id); },
  'guardar-tarea': () => guardarTareaForm(),
  'borrar-tarea': d => borrarTarea(d.id),
  'tarea-mover': d => moverTareaPaso(d.id, d.dir),
  'mi-tarea': d => cambiarMiTarea(d.id, d.estado),
  'nuevo-evento': d => formEvento(null, { fecha: d.f || '' }),
  'ver-evento': d => formEvento(d.id),
  'guardar-evento': () => guardarEventoForm(),
  'borrar-evento': d => borrarEvento(d.id),
  'ag-mes': d => { const [y, m] = S.agMes.split('-').map(Number); const n = new Date(y, m - 1 + Number(d.paso), 1); S.agMes = fechaStr(n).slice(0, 7); pintarAgenda(); },
  'ag-hoy': () => { S.agMes = hoyStr().slice(0, 7); S.agDia = hoyStr(); pintarAgenda(); },
  'ag-dia': d => { S.agDia = d.f; pintarAgenda(); },
  'ag-filtro': d => { S.agFiltros.has(d.k) ? S.agFiltros.delete(d.k) : S.agFiltros.add(d.k); pintarAgenda(); },
  'nuevo-cv': () => formCurriculum(),
  'editar-cv': d => formCurriculum(d.id),
  'guardar-cv': () => guardarCurriculumForm(),
  'borrar-cv': d => borrarCurriculum(d.id),
  'ver-cv': d => abrirArchivo('descargarCurriculum', d.id),
  'contratar-cv': d => contratarCV(d.id),
  'cv-estrella': d => d.id === 'form' ? estrellaFormulario(d.n) : calificarCV(d.id, d.n),
  'rg-aplicar': () => cargarRegistro(),
  'rg-mas': () => cargarRegistro(true),
  'ayuda-modal': () => abrirAyudaModal(),
  'ver-manual': d => verManual(d),
  'subir-manual': () => formManual(),
  'guardar-manual': () => guardarManual(),
  'borrar-manual': d => borrarManual(d.id)
};

function prepararUI() {
  $('#anio').textContent = new Date().getFullYear();
  $('#version').textContent = VERSION;
  $$('.ver-app').forEach(e => { e.textContent = VERSION; });
  $('#foto-input').addEventListener('change', ev => abrirRecorte(ev.target.files[0]));
  // Teléfonos: se ordenan al salir del campo (0412-1234567) y se marcan si son inválidos
  document.addEventListener('focusout', ev => {
    const i = ev.target;
    if (!i.matches || !i.matches('[data-tel]')) return;
    const v = formatearTelefono(i.value);
    if (v === null) { i.setCustomValidity('Número inválido: debe tener 11 dígitos, por ejemplo 0412-1234567.'); i.reportValidity(); return; }
    i.value = v; i.setCustomValidity('');
    const form = i.closest('#f-empleado');
    if (v && form && i.name === 'Telefono') {
      const otro = S.empleados.find(e => e.ID !== form.ID.value && formatearTelefono(e.Telefono) === v);
      if (otro) toast(`Este teléfono ya está registrado en ${otro.ID} (${nombreCompleto(otro)}).`, 'aviso', 7000);
    }
  });
  document.addEventListener('input', ev => { if (ev.target.matches && ev.target.matches('[data-tel]')) ev.target.setCustomValidity(''); });
  mostrarBotonesInstalar();
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
  let t4, t5;
  $('#ta-buscar').addEventListener('input', () => { clearTimeout(t4); t4 = setTimeout(pintarTareas, 200); });
  ['#ta-resp', '#ta-prio', '#ta-vencidas'].forEach(x => $(x).addEventListener('change', pintarTareas));
  $('#cv-buscar').addEventListener('input', () => { clearTimeout(t5); t5 = setTimeout(pintarCurriculums, 200); });
  ['#cv-estado', '#cv-estrellas', '#cv-depto'].forEach(x => $(x).addEventListener('change', pintarCurriculums));
  $('#rg-buscar').addEventListener('keydown', ev => { if (ev.key === 'Enter') cargarRegistro(); });
  ['#rg-usuario', '#rg-categoria', '#rg-desde', '#rg-hasta'].forEach(x => $(x).addEventListener('change', () => cargarRegistro()));
  prepararTablero();
  window.addEventListener('hashchange', () => { if (S.sesion) entrarSegunRuta(); });
  document.addEventListener('visibilitychange', alVolverALaApp);
  $('#dash-mes-sel').innerHTML = selectorMesHTML('dash-mes-periodo', rangoPreset('mes_ant')[0].slice(0, 7));
  $('#dash-mes-periodo').addEventListener('change', () => pintarEmpleadoMesDash());
  aplicarTema(temaOscuro());

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
  if (window.Chart) Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  iconos();
}

/* ======================= 20. ARRANQUE ======================= */
document.addEventListener('DOMContentLoaded', () => {
  prepararUI();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js?v=' + VERSION).catch(() => { /* sin service worker */ });
  }
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
