// admin.js — lógica del perfil admin
// El PIN se guarda solo en una variable de JS (memoria de la pestaña), nunca en localStorage.

let ADMIN_PIN = null;
let tabActual = 'tipos';
let cacheTipos = [];

async function hacerLogin(btn) {
  const pin = document.getElementById('pin-input').value;
  const msg = document.getElementById('login-msg');
  msg.innerHTML = '';
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Ingresando...';

  try {
    await apiCall('adminLogin', { pin });
    ADMIN_PIN = pin;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-screen').style.display = 'block';
    cambiarTab('tipos');
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

function cerrarSesion() {
  ADMIN_PIN = null;
  document.getElementById('pin-input').value = '';
  document.getElementById('admin-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
}

async function adminCall(action, payload = {}) {
  return apiCall(action, Object.assign({}, payload, { pin: ADMIN_PIN }));
}

function cambiarTab(tab) {
  tabActual = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  if (tab === 'tipos') renderTabTipos();
  if (tab === 'horarios') renderTabHorarios();
  if (tab === 'generar') renderTabGenerar();
  if (tab === 'reservas') renderTabReservas();
  if (tab === 'planes') renderTabPlanes();
  if (tab === 'alumnos') renderTabAlumnos();
  if (tab === 'config') renderTabConfig();
}

// ---------- Tab: Tipos de clase ----------

async function renderTabTipos() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div> Cargando...</div>';

  try {
    cacheTipos = await adminCall('adminGetTiposDeClase');

    el.innerHTML = `
      <div class="inline-form">
        <div class="field">
          <label>Nombre</label>
          <input type="text" id="t-nombre" placeholder="Ej: Funcional">
        </div>
        <div class="field">
          <label>Duración (min)</label>
          <input type="number" id="t-duracion" placeholder="60">
        </div>
        <div class="field">
          <label>Cupo máximo</label>
          <input type="number" id="t-cupo" placeholder="12">
        </div>
        <button onclick="crearTipo(this)">Agregar tipo de clase</button>
      </div>
      <div id="tipos-msg"></div>
      <div class="planes-grid">
        ${cacheTipos.map(t => `
          <div class="plan-card">
            <div class="nombre">${escapeHtml(t.nombre)}</div>
            <div class="detalle">${t.duracion_minutos} min · hasta ${t.cupo_maximo} cupos</div>
            <span class="pill ${t.activo ? 'activo' : 'inactivo'}">${t.activo ? 'Activo' : 'Inactivo'}</span>
            <div class="acciones">
              <button class="secondary" onclick="toggleTipo(this, '${t.id_tipo}', ${!t.activo})">${t.activo ? 'Desactivar' : 'Activar'}</button>
            </div>
          </div>
        `).join('') || '<p style="color:var(--text-dim);">Todavía no hay tipos de clase configurados.</p>'}
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

async function crearTipo(btn) {
  btn.disabled = true;
  btn.textContent = 'Agregando...';
  const nombre = document.getElementById('t-nombre').value;
  const duracion_minutos = Number(document.getElementById('t-duracion').value);
  const cupo_maximo = Number(document.getElementById('t-cupo').value);
  const msg = document.getElementById('tipos-msg');

  try {
    await adminCall('adminCrearTipoDeClase', { nombre, duracion_minutos, cupo_maximo });
    msg.innerHTML = `<div class="msg ok">Tipo de clase creado.</div>`;
    renderTabTipos();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Agregar tipo de clase';
  }
}

async function toggleTipo(btn, id_tipo, nuevoActivo) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    await adminCall('adminEditarTipoDeClase', { id_tipo, activo: nuevoActivo });
    renderTabTipos();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = nuevoActivo ? 'Activar' : 'Desactivar';
  }
}

// ---------- Tab: Horarios ----------

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // Lunes primero, Domingo al final

let cacheHorarios = [];
let horarioSeleccionado = null; // id_horario abierto en el panel de edición
let horasSeleccionadas = []; // horas agregadas como chips en el formulario de creación masiva
let diaEnEdicion = null; // `${id_tipo}|${dia}` del día abierto en el panel de gestión, o null

async function renderTabHorarios() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div> Cargando...</div>';
  horasSeleccionadas = [];
  horarioSeleccionado = null;
  diaEnEdicion = null;

  try {
    if (!cacheTipos.length) cacheTipos = await adminCall('adminGetTiposDeClase');
    cacheHorarios = await adminCall('adminGetHorarios');

    el.innerHTML = `
      <div class="inline-form" style="flex-direction:column; align-items:stretch;">
        <div class="field" style="max-width:280px;">
          <label>Tipo de clase</label>
          <select id="h-tipo">
            ${cacheTipos.map(t => `<option value="${t.id_tipo}">${escapeHtml(t.nombre)}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label>Días</label>
          <div class="dias-checkboxes">
            ${DIAS_CORTO.map((d, i) => `
              <label class="dia-check">
                <input type="checkbox" class="dia-checkbox" value="${i}"> ${d}
              </label>
            `).join('')}
          </div>
        </div>

        <div class="field">
          <label>Horas</label>
          <div style="display:flex; gap:10px; align-items:center;">
            <input type="time" id="h-hora-nueva" style="max-width:160px;">
            <button type="button" style="width:auto;" onclick="agregarHoraChip()">+ Agregar hora</button>
          </div>
          <div id="horas-chips" class="chips-container"></div>
        </div>

        <button onclick="crearHorariosMasivo(this)">Agregar horarios</button>
      </div>
      <div id="horarios-msg"></div>
      <div id="horarios-lista"></div>
      <div id="horario-editor"></div>
    `;

    renderChipsHoras();
    renderListaHorarios();
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

function renderListaHorarios() {
  const cont = document.getElementById('horarios-lista');
  if (!cont) return;

  if (!cacheHorarios.length) {
    cont.innerHTML = `<p style="color:var(--text-dim);">Todavía no hay horarios configurados.</p>`;
    return;
  }

  cont.innerHTML = cacheTipos.map(tipo => {
    const horariosDelTipo = cacheHorarios.filter(h => h.id_tipo === tipo.id_tipo);
    if (!horariosDelTipo.length) return '';

    const filasPorDia = ORDEN_DIAS.map(dia => {
      const horariosDelDia = horariosDelTipo
        .filter(h => Number(h.dia_semana) === dia)
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
      if (!horariosDelDia.length) return '';

      const clave = tipo.id_tipo + '|' + dia;
      const editando = diaEnEdicion === clave;

      return `
        <div class="horario-dia-row">
          <div class="horario-dia-label">${DIAS_CORTO[dia]}</div>
          <div class="horas-chips-row">
            ${horariosDelDia.map(h => `
              <button type="button" class="hora-chip-btn ${h.activo ? '' : 'inactivo'}" onclick="seleccionarHorarioParaEditar('${h.id_horario}')">
                ${h.hora_inicio}
              </button>
            `).join('')}
          </div>
          <button type="button" class="secondary" style="width:auto;" onclick="toggleEditarDia('${clave}')">${editando ? 'Cerrar' : 'Editar día'}</button>
        </div>
        ${editando ? renderPanelEdicionDia(tipo.id_tipo, dia, horariosDelDia) : ''}
      `;
    }).join('');

    return `
      <div class="horario-group">
        <div class="horario-group-title">${escapeHtml(tipo.nombre)}</div>
        ${filasPorDia}
      </div>
    `;
  }).join('');
}

function toggleEditarDia(clave) {
  diaEnEdicion = diaEnEdicion === clave ? null : clave;
  renderListaHorarios();
}

function renderPanelEdicionDia(id_tipo, dia, horariosDelDia) {
  return `
    <div class="dia-editor-panel">
      <div class="dia-editor-title">Gestionar ${DIAS[dia]}</div>
      <div class="dia-editor-checks">
        ${horariosDelDia.map(h => `
          <label class="dia-check">
            <input type="checkbox" class="dia-editor-check" value="${h.id_horario}"> ${h.hora_inicio}${h.activo ? '' : ' (inactivo)'}
          </label>
        `).join('')}
      </div>
      <button type="button" class="secondary" style="width:auto; margin-top:10px;" onclick="desactivarSeleccionadasDia(this)">Desactivar seleccionadas</button>
      <div style="display:flex; gap:10px; align-items:center; margin-top:14px;">
        <input type="time" id="dia-editor-hora">
        <button type="button" style="width:auto;" onclick="agregarHoraADia(this, '${id_tipo}', ${dia})">+ Agregar hora a este día</button>
      </div>
      <div id="dia-editor-msg"></div>
    </div>
  `;
}

async function desactivarSeleccionadasDia(btn) {
  const ids = Array.from(document.querySelectorAll('.dia-editor-check:checked')).map(cb => cb.value);
  if (!ids.length) return;

  btn.disabled = true;
  btn.textContent = 'Desactivando...';

  for (const id_horario of ids) {
    await adminCall('adminEliminarHorario', { id_horario });
  }
  diaEnEdicion = null;
  renderTabHorarios();
}

async function agregarHoraADia(btn, id_tipo, dia) {
  const input = document.getElementById('dia-editor-hora');
  const msg = document.getElementById('dia-editor-msg');
  const hora = input.value;
  if (!hora) return;

  btn.disabled = true;
  btn.textContent = 'Agregando...';

  try {
    await adminCall('adminCrearHorariosMasivo', { id_tipo, dias: [dia], horas: [hora] });
    diaEnEdicion = id_tipo + '|' + dia;
    renderTabHorarios();
  } catch (err) {
    if (msg) msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = '+ Agregar hora a este día';
  }
}

function seleccionarHorarioParaEditar(id_horario) {
  horarioSeleccionado = id_horario;
  renderEditorHorario();
}

function renderEditorHorario() {
  const cont = document.getElementById('horario-editor');
  if (!cont) return;

  if (!horarioSeleccionado) {
    cont.innerHTML = '';
    return;
  }

  const h = cacheHorarios.find(x => x.id_horario === horarioSeleccionado);
  if (!h) { cont.innerHTML = ''; return; }

  cont.innerHTML = `
    <div class="horario-editor-card">
      <h3 style="margin-bottom:16px;">Editar horario</h3>
      <div class="inline-form" style="margin-bottom:0;">
        <div class="field">
          <label>Tipo de clase</label>
          <select id="edit-tipo">
            ${cacheTipos.map(t => `<option value="${t.id_tipo}" ${t.id_tipo === h.id_tipo ? 'selected' : ''}>${escapeHtml(t.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Día</label>
          <select id="edit-dia">
            ${DIAS.map((d, i) => `<option value="${i}" ${i === Number(h.dia_semana) ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Hora</label>
          <input type="time" id="edit-hora" value="${h.hora_inicio}">
        </div>
      </div>
      <div id="editor-msg"></div>
      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button style="width:auto;" onclick="guardarEdicionHorario(this)">Guardar</button>
        <button class="secondary" style="width:auto;" onclick="toggleActivoHorario(this)">${h.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="secondary" style="width:auto;" onclick="cerrarEditorHorario()">Cerrar</button>
      </div>
    </div>
  `;
}

function cerrarEditorHorario() {
  horarioSeleccionado = null;
  renderEditorHorario();
}

async function guardarEdicionHorario(btn) {
  const id_tipo = document.getElementById('edit-tipo').value;
  const dia_semana = Number(document.getElementById('edit-dia').value);
  const hora_inicio = document.getElementById('edit-hora').value;
  const msg = document.getElementById('editor-msg');

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    await adminCall('adminEditarHorario', { id_horario: horarioSeleccionado, id_tipo, dia_semana, hora_inicio });
    horarioSeleccionado = null;
    renderTabHorarios();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function toggleActivoHorario(btn) {
  const h = cacheHorarios.find(x => x.id_horario === horarioSeleccionado);
  if (!h) return;
  btn.disabled = true;
  btn.textContent = '...';
  await adminCall('adminEditarHorario', { id_horario: horarioSeleccionado, activo: !h.activo });
  horarioSeleccionado = null;
  renderTabHorarios();
}

function agregarHoraChip() {
  const input = document.getElementById('h-hora-nueva');
  const val = input.value;
  if (!val) return;
  if (!horasSeleccionadas.includes(val)) {
    horasSeleccionadas.push(val);
    horasSeleccionadas.sort();
  }
  input.value = '';
  renderChipsHoras();
}

function quitarHoraChip(hora) {
  horasSeleccionadas = horasSeleccionadas.filter(h => h !== hora);
  renderChipsHoras();
}

function renderChipsHoras() {
  const cont = document.getElementById('horas-chips');
  if (!cont) return;
  cont.innerHTML = horasSeleccionadas.length
    ? horasSeleccionadas.map(h => `
        <span class="chip">${h} <button type="button" onclick="quitarHoraChip('${h}')">&times;</button></span>
      `).join('')
    : '<span style="color:var(--text-dim); font-size:13px;">Ninguna hora agregada aún.</span>';
}

async function crearHorariosMasivo(btn) {
  const id_tipo = document.getElementById('h-tipo').value;
  const dias = Array.from(document.querySelectorAll('.dia-checkbox:checked')).map(cb => Number(cb.value));
  const msg = document.getElementById('horarios-msg');

  if (!dias.length) {
    msg.innerHTML = `<div class="msg error">Selecciona al menos un día.</div>`;
    return;
  }
  if (!horasSeleccionadas.length) {
    msg.innerHTML = `<div class="msg error">Agrega al menos una hora.</div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Agregando...';

  try {
    const resultado = await adminCall('adminCrearHorariosMasivo', { id_tipo, dias, horas: horasSeleccionadas });
    const detalle = resultado.omitidos
      ? ` (se omitieron ${resultado.omitidos} que ya existían)`
      : '';
    msg.innerHTML = `<div class="msg ok">Se crearon ${resultado.creados} horarios${detalle}.</div>`;
    renderTabHorarios();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Agregar horarios';
  }
}

async function eliminarHorario(id_horario) {
  await adminCall('adminEliminarHorario', { id_horario });
  renderTabHorarios();
}

// ---------- Tab: Generar clases ----------

function renderTabGenerar() {
  const el = document.getElementById('tab-content');
  const hoy = new Date().toISOString().slice(0, 10);
  const enUnMes = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);

  el.innerHTML = `
    <p>Genera las clases programadas para un rango de fechas, a partir de los horarios recurrentes activos. Es seguro ejecutarlo varias veces: no duplica clases ya creadas.</p>
    <div class="inline-form">
      <div class="field">
        <label>Desde</label>
        <input type="date" id="g-desde" value="${hoy}">
      </div>
      <div class="field">
        <label>Hasta</label>
        <input type="date" id="g-hasta" value="${enUnMes}">
      </div>
      <button onclick="generarClases()">Generar clases</button>
    </div>
    <div id="generar-msg"></div>
  `;
}

async function generarClases() {
  const desde = document.getElementById('g-desde').value;
  const hasta = document.getElementById('g-hasta').value;
  const msg = document.getElementById('generar-msg');
  msg.innerHTML = '<p>Generando...</p>';

  try {
    const resultado = await adminCall('adminGenerarClasesProgramadas', { desde, hasta });
    msg.innerHTML = `<div class="msg ok">Se crearon ${resultado.clases_creadas} clases nuevas.</div>`;
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

// ---------- Tab: Reservas ----------

let reservasMesActual = null;
let reservasClasesDelMes = [];
let reservasDiaSeleccionado = null;

async function renderTabReservas() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div> Cargando...</div>';
  reservasMesActual = primerDiaDelMesR(new Date());
  reservasDiaSeleccionado = null;
  await cargarMesReservasYRenderizar();
}

async function cargarMesReservasYRenderizar() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div> Cargando...</div>';

  try {
    const desde = isoDateR(reservasMesActual);
    const hasta = isoDateR(ultimoDiaDelMesR(reservasMesActual));
    reservasClasesDelMes = await adminCall('adminGetResumenClases', { desde, hasta });
    renderCalendarioReservas();
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

function cambiarMesReservas(delta) {
  reservasMesActual = new Date(reservasMesActual.getFullYear(), reservasMesActual.getMonth() + delta, 1);
  reservasDiaSeleccionado = null;
  cargarMesReservasYRenderizar();
}

function renderCalendarioReservas() {
  const el = document.getElementById('tab-content');
  const diasConClases = new Set(reservasClasesDelMes.map(c => c.fecha));
  const primerDia = reservasMesActual.getDay();
  const totalDias = ultimoDiaDelMesR(reservasMesActual).getDate();

  let celdas = '';
  for (let i = 0; i < primerDia; i++) {
    celdas += `<div class="calendar-day vacio"></div>`;
  }
  for (let dia = 1; dia <= totalDias; dia++) {
    const fecha = new Date(reservasMesActual.getFullYear(), reservasMesActual.getMonth(), dia);
    const fechaISO = isoDateR(fecha);
    const disponible = diasConClases.has(fechaISO);
    const esHoy = fechaISO === isoDateR(new Date());
    celdas += `
      <div class="calendar-day ${disponible ? 'disponible' : ''} ${esHoy ? 'hoy' : ''}"
           ${disponible ? `onclick="seleccionarDiaReservas('${fechaISO}')"` : ''}>
        ${dia}
      </div>
    `;
  }

  el.innerHTML = `
    <div class="calendar-header">
      <button onclick="cambiarMesReservas(-1)">&larr;</button>
      <div class="calendar-month-label">${formatearMesLargoR(reservasMesActual)}</div>
      <button onclick="cambiarMesReservas(1)">&rarr;</button>
    </div>
    <div class="calendar-dow-row">
      ${DIAS_CORTO.map(d => `<div class="calendar-dow">${d}</div>`).join('')}
    </div>
    <div class="calendar-grid">${celdas}</div>
    <div id="reservas-horas" style="margin-top:20px;"></div>
    <div id="detalle-reservas"></div>
  `;

  if (reservasDiaSeleccionado) renderHorasReservas();
}

function seleccionarDiaReservas(fechaISO) {
  reservasDiaSeleccionado = fechaISO;
  renderHorasReservas();
  document.getElementById('detalle-reservas').innerHTML = '';
}

function renderHorasReservas() {
  const cont = document.getElementById('reservas-horas');
  if (!cont) return;

  const clasesDelDia = reservasClasesDelMes
    .filter(c => c.fecha === reservasDiaSeleccionado)
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  cont.innerHTML = `
    <div class="screen-header" style="margin-bottom:14px;">
      <div class="nombre-tipo">${formatearFechaLargaR(reservasDiaSeleccionado)}</div>
      <div class="meta">Selecciona un horario para ver los alumnos</div>
    </div>
    <div class="horas-list">
      ${clasesDelDia.map(c => `
        <button type="button" class="hora-btn" onclick="verReservas('${c.id_clase}', '${escapeHtml(c.nombre_tipo)} — ${c.fecha} ${c.hora_inicio}')">
          <span class="hora">${c.hora_inicio}</span>
          <span class="cupos-txt">${escapeHtml(c.nombre_tipo)} · ${c.ocupados}/${c.cupo_maximo}</span>
        </button>
      `).join('') || '<p style="color:var(--text-dim);">No hay clases este día.</p>'}
    </div>
  `;
}

async function verReservas(id_clase, etiqueta) {
  const detalle = document.getElementById('detalle-reservas');
  detalle.innerHTML = '<div class="loading-state"><div class="spinner"></div> Cargando...</div>';

  try {
    const reservas = await adminCall('adminGetReservasPorClase', { id_clase });
    detalle.innerHTML = `
      <h3 style="margin-top:20px;">${etiqueta}</h3>
      ${reservas.map(r => `
        <div class="alumno-card" style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
            <div>
              <div class="nombre">${escapeHtml(r.nombre)} ${escapeHtml(r.apellido)}${badgeAlertaPlan(r.alerta_plan)}</div>
              <div class="detalle">${escapeHtml(r.correo)} · ${escapeHtml(r.telefono)}</div>
            </div>
            <span class="pill ${r.estado === 'confirmada' ? 'activo' : 'inactivo'}">${r.estado}</span>
          </div>
          ${r.saldo_plan ? `
            <div class="uso ${r.saldo_plan.clases_usadas > r.saldo_plan.clases_incluidas ? 'excede' : ''}" style="margin-top:8px;">
              ${escapeHtml(r.saldo_plan.nombre_plan)} — <span class="num">${r.saldo_plan.clases_incluidas - r.saldo_plan.clases_usadas} de ${r.saldo_plan.clases_incluidas}</span> clases disponibles
              ${!r.saldo_plan.vigente ? '<span class="pill inactivo">Plan vencido</span>' : ''}
            </div>
          ` : '<div class="detalle" style="margin-top:8px; color:var(--danger);">Sin plan registrado</div>'}
        </div>
      `).join('') || '<p style="color:var(--text-dim);">Sin reservas aún.</p>'}
    `;
  } catch (err) {
    detalle.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

function badgeAlertaPlan(alerta) {
  if (alerta === 'sin_plan') return '<span class="badge-alerta">Sin plan</span>';
  if (alerta === 'excede_plan') return '<span class="badge-alerta">Excede plan</span>';
  return '';
}

// Helpers de fecha propios de esta pestaña (evitan chocar con nombres de otras pestañas)
function primerDiaDelMesR(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function ultimoDiaDelMesR(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
function isoDateR(date) {
  const d = new Date(date);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}
function formatearMesLargoR(date) { return date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }); }
function formatearFechaLargaR(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Tab: Planes ----------

let cachePlanes = [];

async function renderTabPlanes() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div> Cargando...</div>';

  try {
    cachePlanes = await adminCall('adminGetPlanes');

    el.innerHTML = `
      <div class="inline-form" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <div class="field" style="flex:1; min-width:140px;">
            <label>Nombre</label>
            <input type="text" id="p-nombre" placeholder="Ej: 8 clases">
          </div>
          <div class="field" style="flex:1; min-width:120px;">
            <label>Clases incluidas</label>
            <input type="number" id="p-clases" placeholder="8">
          </div>
          <div class="field" style="flex:1; min-width:120px;">
            <label>Precio (CLP)</label>
            <input type="number" id="p-precio" placeholder="60000">
          </div>
          <div class="field" style="flex:1; min-width:120px;">
            <label>Duración (días)</label>
            <input type="number" id="p-duracion" placeholder="30" value="30">
          </div>
        </div>
        <label class="dia-check" style="width:fit-content;">
          <input type="checkbox" id="p-gratis"> Es plan gratis (1 uso por alumno, ideal para clase de prueba)
        </label>
        <button onclick="crearPlan(this)">Agregar plan</button>
      </div>
      <div id="planes-msg"></div>
      <div class="planes-grid">
        ${cachePlanes.map(p => `
          <div class="plan-card">
            <div class="nombre">${escapeHtml(p.nombre)} ${p.es_gratis ? '<span class="pill activo">Gratis</span>' : ''}</div>
            <div class="detalle">${p.clases_incluidas} clases · $${formatearPrecio(p.precio)} · ${p.duracion_dias} días</div>
            <span class="pill ${p.activo ? 'activo' : 'inactivo'}">${p.activo ? 'Activo' : 'Inactivo'}</span>
            <div class="acciones">
              <button class="secondary" onclick="togglePlan(this, '${p.id_plan}', ${!p.activo})">${p.activo ? 'Desactivar' : 'Activar'}</button>
            </div>
          </div>
        `).join('') || '<p style="color:var(--text-dim);">Todavía no hay planes configurados.</p>'}
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

async function crearPlan(btn) {
  btn.disabled = true;
  btn.textContent = 'Agregando...';
  const nombre = document.getElementById('p-nombre').value;
  const clases_incluidas = Number(document.getElementById('p-clases').value);
  const precio = Number(document.getElementById('p-precio').value);
  const duracion_dias = Number(document.getElementById('p-duracion').value) || 30;
  const es_gratis = document.getElementById('p-gratis').checked;
  const msg = document.getElementById('planes-msg');

  try {
    await adminCall('adminCrearPlan', { nombre, clases_incluidas, precio, duracion_dias, es_gratis });
    msg.innerHTML = `<div class="msg ok">Plan creado.</div>`;
    renderTabPlanes();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Agregar plan';
  }
}

async function togglePlan(btn, id_plan, nuevoActivo) {
  btn.disabled = true;
  btn.textContent = '...';
  await adminCall('adminEditarPlan', { id_plan, activo: nuevoActivo });
  renderTabPlanes();
}

function formatearPrecio(precio) {
  return Number(precio).toLocaleString('es-CL');
}

// ---------- Tab: Alumnos ----------

let cacheAlumnos = [];
let filtroEstadoPago = 'todos';
let alumnoEnEdicion = null;
let suscripcionEnEdicion = null;

async function renderTabAlumnos() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div> Cargando...</div>';
  filtroEstadoPago = 'todos';
  alumnoEnEdicion = null;
  suscripcionEnEdicion = null;

  try {
    if (!cachePlanes.length) cachePlanes = await adminCall('adminGetPlanes');
    const planesActivos = cachePlanes.filter(p => p.activo);
    cacheAlumnos = await adminCall('adminGetAlumnos');

    el.innerHTML = `
      <h3 style="margin-bottom:10px;">Asignar plan manualmente</h3>
      <div class="inline-form" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <div class="field" style="flex:1; min-width:160px;">
            <label>Correo</label>
            <input type="email" id="al-correo" placeholder="alumno@correo.com">
          </div>
          <div class="field" style="flex:1; min-width:140px;">
            <label>Nombre</label>
            <input type="text" id="al-nombre">
          </div>
          <div class="field" style="flex:1; min-width:140px;">
            <label>Apellido</label>
            <input type="text" id="al-apellido">
          </div>
          <div class="field" style="flex:1; min-width:140px;">
            <label>Teléfono</label>
            <input type="tel" id="al-telefono">
          </div>
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <div class="field" style="flex:1; min-width:200px;">
            <label>Plan</label>
            <select id="al-plan">
              ${planesActivos.map(p => `<option value="${p.id_plan}">${escapeHtml(p.nombre)} — $${formatearPrecio(p.precio)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="flex:1; min-width:160px;">
            <label>Estado de pago</label>
            <select id="al-estado-pago">
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>
        <button onclick="asignarPlan(this)">Asignar plan</button>
      </div>
      <div id="alumnos-msg"></div>

      <h3 style="margin:28px 0 10px;">Alumnos</h3>
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px;">
        <div class="field" style="flex:1; min-width:220px; margin-bottom:0;">
          <input type="text" id="al-buscador" placeholder="Buscar por nombre o correo..." oninput="filtrarAlumnos()">
        </div>
        <div class="field" style="min-width:160px; margin-bottom:0;">
          <select id="al-filtro-pago" onchange="filtrarAlumnos()">
            <option value="todos">Todos los pagos</option>
            <option value="pendiente">Solo pendientes</option>
            <option value="pagado">Solo pagados</option>
          </select>
        </div>
      </div>
      <div id="alumnos-lista"></div>
    `;

    renderListaAlumnos();
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

function filtrarAlumnos() {
  const q = document.getElementById('al-buscador').value.trim().toLowerCase();
  filtroEstadoPago = document.getElementById('al-filtro-pago').value;
  renderListaAlumnos(q);
}

function renderListaAlumnos(q) {
  q = q || '';
  const cont = document.getElementById('alumnos-lista');
  if (!cont) return;

  let lista = cacheAlumnos.filter(a =>
    (a.nombre + ' ' + a.apellido).toLowerCase().includes(q) || a.correo.toLowerCase().includes(q)
  );

  if (filtroEstadoPago !== 'todos') {
    lista = lista
      .map(a => Object.assign({}, a, {
        suscripciones: a.suscripciones.filter(s => s.estado_pago === filtroEstadoPago)
      }))
      .filter(a => a.suscripciones.length > 0);
  }

  cont.innerHTML = lista.map(a => renderAlumnoCard(a)).join('') || '<p style="color:var(--text-dim);">No se encontraron alumnos.</p>';
}

function renderAlumnoCard(a) {
  if (alumnoEnEdicion === a.id_alumno) {
    return `
      <div class="alumno-card" style="margin-bottom:14px; border-color:var(--accent-dim);">
        <div class="inline-form" style="margin-bottom:0;">
          <div class="field"><label>Nombre</label><input type="text" id="edit-al-nombre" value="${escapeHtml(a.nombre)}"></div>
          <div class="field"><label>Apellido</label><input type="text" id="edit-al-apellido" value="${escapeHtml(a.apellido)}"></div>
          <div class="field"><label>Correo</label><input type="email" id="edit-al-correo" value="${escapeHtml(a.correo)}"></div>
          <div class="field"><label>Teléfono</label><input type="tel" id="edit-al-telefono" value="${escapeHtml(a.telefono)}"></div>
        </div>
        <div id="edit-alumno-msg"></div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button style="width:auto;" onclick="guardarEdicionAlumno(this, '${a.id_alumno}')">Guardar</button>
          <button class="secondary" style="width:auto;" onclick="alumnoEnEdicion=null; renderListaAlumnos(document.getElementById('al-buscador').value.trim().toLowerCase());">Cancelar</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="alumno-card" style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
        <div>
          <div class="nombre">${escapeHtml(a.nombre)} ${escapeHtml(a.apellido)}</div>
          <div class="detalle">${escapeHtml(a.correo)} · ${escapeHtml(a.telefono || '—')}</div>
        </div>
        <button class="secondary" style="width:auto;" onclick="alumnoEnEdicion='${a.id_alumno}'; renderListaAlumnos(document.getElementById('al-buscador').value.trim().toLowerCase());">Editar alumno</button>
      </div>
      ${a.suscripciones.map(s => renderSuscripcionItem(s)).join('') || '<p style="color:var(--text-dim); font-size:13px; margin-top:8px;">Sin suscripciones registradas.</p>'}
    </div>
  `;
}

function renderSuscripcionItem(s) {
  if (suscripcionEnEdicion === s.id_suscripcion) {
    return `
      <div class="susc-item" style="flex-direction:column; align-items:stretch; border-color:var(--accent-dim);">
        <div class="inline-form" style="margin-bottom:0;">
          <div class="field">
            <label>Plan</label>
            <select id="edit-susc-plan">
              ${cachePlanes.map(p => `<option value="${p.id_plan}" ${p.id_plan === s.id_plan ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Desde</label><input type="date" id="edit-susc-inicio" value="${s.fecha_inicio}"></div>
          <div class="field"><label>Hasta</label><input type="date" id="edit-susc-fin" value="${s.fecha_fin}"></div>
          <div class="field">
            <label>Pago</label>
            <select id="edit-susc-pago">
              <option value="pagado" ${s.estado_pago === 'pagado' ? 'selected' : ''}>Pagado</option>
              <option value="pendiente" ${s.estado_pago === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            </select>
          </div>
          <div class="field">
            <label>Clases incluidas</label>
            <input type="number" id="edit-susc-clases" value="${s.clases_incluidas}">
          </div>
        </div>
        <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">
          El plan "${escapeHtml(s.nombre_plan)}" da ${s.clases_incluidas_plan} clases por defecto.
          Cambia este número solo para esta suscripción puntual (ej. clase de cortesía por enfermedad).
        </p>
        <div id="edit-susc-msg"></div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button style="width:auto;" onclick="guardarEdicionSuscripcion(this, '${s.id_suscripcion}')">Guardar</button>
          <button class="secondary" style="width:auto;" onclick="suscripcionEnEdicion=null; renderListaAlumnos(document.getElementById('al-buscador').value.trim().toLowerCase());">Cancelar</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="susc-item">
      <div class="info">
        <strong>${escapeHtml(s.nombre_plan)}</strong> — ${s.clases_usadas}/${s.clases_incluidas} clases ·
        ${s.fecha_inicio} al ${s.fecha_fin}
        <span class="pill ${s.vigente ? 'activo' : 'inactivo'}">${s.vigente ? 'Vigente' : 'Vencido'}</span>
        <span class="pill ${s.estado_pago === 'pagado' ? 'activo' : 'inactivo'}">${s.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="secondary" style="width:auto;" onclick="marcarPago(this, '${s.id_suscripcion}', '${s.estado_pago === 'pagado' ? 'pendiente' : 'pagado'}')">
          Marcar ${s.estado_pago === 'pagado' ? 'pendiente' : 'pagado'}
        </button>
        <button class="secondary" style="width:auto;" onclick="suscripcionEnEdicion='${s.id_suscripcion}'; renderListaAlumnos(document.getElementById('al-buscador').value.trim().toLowerCase());">Editar</button>
      </div>
    </div>
  `;
}

async function guardarEdicionAlumno(btn, id_alumno) {
  const msg = document.getElementById('edit-alumno-msg');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    await adminCall('adminEditarAlumno', {
      id_alumno,
      nombre: document.getElementById('edit-al-nombre').value,
      apellido: document.getElementById('edit-al-apellido').value,
      correo: document.getElementById('edit-al-correo').value,
      telefono: document.getElementById('edit-al-telefono').value
    });
    alumnoEnEdicion = null;
    renderTabAlumnos();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function guardarEdicionSuscripcion(btn, id_suscripcion) {
  const msg = document.getElementById('edit-susc-msg');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    await adminCall('adminEditarSuscripcion', {
      id_suscripcion,
      id_plan: document.getElementById('edit-susc-plan').value,
      fecha_inicio: document.getElementById('edit-susc-inicio').value,
      fecha_fin: document.getElementById('edit-susc-fin').value,
      estado_pago: document.getElementById('edit-susc-pago').value,
      clases_incluidas_override: document.getElementById('edit-susc-clases').value
    });
    suscripcionEnEdicion = null;
    renderTabAlumnos();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function marcarPago(btn, id_suscripcion, estado_pago) {
  btn.disabled = true;
  btn.textContent = '...';
  await adminCall('adminMarcarPago', { id_suscripcion, estado_pago });
  renderTabAlumnos();
}

async function asignarPlan(btn) {
  const correo = document.getElementById('al-correo').value;
  const nombre = document.getElementById('al-nombre').value;
  const apellido = document.getElementById('al-apellido').value;
  const telefono = document.getElementById('al-telefono').value;
  const id_plan = document.getElementById('al-plan').value;
  const estado_pago = document.getElementById('al-estado-pago').value;
  const msg = document.getElementById('alumnos-msg');

  btn.disabled = true;
  btn.textContent = 'Asignando...';

  try {
    await adminCall('adminAsignarPlan', { correo, nombre, apellido, telefono, id_plan, estado_pago });
    msg.innerHTML = `<div class="msg ok">Plan asignado.</div>`;
    renderTabAlumnos();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Asignar plan';
  }
}

// ---------- Tab: Configuración ----------

async function renderTabConfig() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div> Cargando...</div>';

  try {
    const datosBancarios = await adminCall('adminGetDatosBancarios');

    el.innerHTML = `
      <h3 style="margin-bottom:10px;">Datos de transferencia</h3>
      <p style="color:var(--text-dim); font-size:13px; margin-bottom:14px;">
        Se muestran al alumno cuando contrata un plan pago, y el correo de confirmación
        también recibe el aviso de cada nueva suscripción pendiente de pago.
      </p>
      <div class="inline-form" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <div class="field" style="flex:1; min-width:140px;"><label>Banco</label><input type="text" id="b-banco" value="${escapeHtml(datosBancarios.banco)}"></div>
          <div class="field" style="flex:1; min-width:120px;"><label>Tipo de cuenta</label><input type="text" id="b-tipo" value="${escapeHtml(datosBancarios.tipo_cuenta)}"></div>
          <div class="field" style="flex:1; min-width:140px;"><label>N° de cuenta</label><input type="text" id="b-numero" value="${escapeHtml(datosBancarios.numero_cuenta)}"></div>
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <div class="field" style="flex:1; min-width:140px;"><label>RUT</label><input type="text" id="b-rut" value="${escapeHtml(datosBancarios.rut)}"></div>
          <div class="field" style="flex:1; min-width:140px;"><label>Nombre titular</label><input type="text" id="b-titular" value="${escapeHtml(datosBancarios.nombre_titular)}"></div>
          <div class="field" style="flex:1; min-width:180px;"><label>Correo confirmación</label><input type="email" id="b-correo" value="${escapeHtml(datosBancarios.correo_confirmacion)}"></div>
        </div>
        <button onclick="guardarDatosBancarios(this)">Guardar datos bancarios</button>
      </div>
      <div id="bancarios-msg"></div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

async function guardarDatosBancarios(btn) {
  const msg = document.getElementById('bancarios-msg');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    await adminCall('adminGuardarDatosBancarios', {
      banco: document.getElementById('b-banco').value,
      tipo_cuenta: document.getElementById('b-tipo').value,
      numero_cuenta: document.getElementById('b-numero').value,
      rut: document.getElementById('b-rut').value,
      nombre_titular: document.getElementById('b-titular').value,
      correo_confirmacion: document.getElementById('b-correo').value
    });
    msg.innerHTML = `<div class="msg ok">Datos bancarios guardados.</div>`;
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar datos bancarios';
  }
}