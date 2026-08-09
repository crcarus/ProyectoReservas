// admin.js — lógica del perfil admin
// El PIN se guarda solo en una variable de JS (memoria de la pestaña), nunca en localStorage.

let ADMIN_PIN = null;
let tabActual = 'tipos';
let cacheTipos = [];

async function hacerLogin() {
  const pin = document.getElementById('pin-input').value;
  const msg = document.getElementById('login-msg');
  msg.innerHTML = '';

  try {
    await apiCall('adminLogin', { pin });
    ADMIN_PIN = pin;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-screen').style.display = 'block';
    cambiarTab('tipos');
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
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
}

// ---------- Tab: Tipos de clase ----------

async function renderTabTipos() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<p>Cargando...</p>';

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
        <button onclick="crearTipo()">Agregar tipo de clase</button>
      </div>
      <div id="tipos-msg"></div>
      <table>
        <thead><tr><th>Nombre</th><th>Duración</th><th>Cupo</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${cacheTipos.map(t => `
            <tr>
              <td>${escapeHtml(t.nombre)}</td>
              <td>${t.duracion_minutos} min</td>
              <td>${t.cupo_maximo}</td>
              <td><span class="pill ${t.activo ? 'activo' : 'inactivo'}">${t.activo ? 'Activo' : 'Inactivo'}</span></td>
              <td><button class="secondary" style="width:auto;" onclick="toggleTipo('${t.id_tipo}', ${!t.activo})">${t.activo ? 'Desactivar' : 'Activar'}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

async function crearTipo() {
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
  }
}

async function toggleTipo(id_tipo, nuevoActivo) {
  await adminCall('adminEditarTipoDeClase', { id_tipo, activo: nuevoActivo });
  renderTabTipos();
}

// ---------- Tab: Horarios ----------

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

let cacheHorarios = [];
let horarioEnEdicion = null; // id_horario de la fila en modo edición, o null
let horasSeleccionadas = []; // horas agregadas como chips en el formulario de creación masiva

async function renderTabHorarios() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<p>Cargando...</p>';
  horasSeleccionadas = [];

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

        <button onclick="crearHorariosMasivo()">Agregar horarios</button>
      </div>
      <div id="horarios-msg"></div>
      <table>
        <thead><tr><th>Tipo</th><th>Día</th><th>Hora</th><th>Estado</th><th colspan="2"></th></tr></thead>
        <tbody id="horarios-tbody">
          ${cacheHorarios.map(h => filaHorario(h)).join('')}
        </tbody>
      </table>
    `;

    renderChipsHoras();
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
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

async function crearHorariosMasivo() {
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

  try {
    const resultado = await adminCall('adminCrearHorariosMasivo', { id_tipo, dias, horas: horasSeleccionadas });
    const detalle = resultado.omitidos
      ? ` (se omitieron ${resultado.omitidos} que ya existían)`
      : '';
    msg.innerHTML = `<div class="msg ok">Se crearon ${resultado.creados} horarios${detalle}.</div>`;
    renderTabHorarios();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

function filaHorario(h) {
  const tipo = cacheTipos.find(t => t.id_tipo === h.id_tipo);

  if (horarioEnEdicion === h.id_horario) {
    return `
      <tr>
        <td>
          <select id="edit-tipo-${h.id_horario}">
            ${cacheTipos.map(t => `<option value="${t.id_tipo}" ${t.id_tipo === h.id_tipo ? 'selected' : ''}>${escapeHtml(t.nombre)}</option>`).join('')}
          </select>
        </td>
        <td>
          <select id="edit-dia-${h.id_horario}">
            ${DIAS.map((d, i) => `<option value="${i}" ${i === Number(h.dia_semana) ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </td>
        <td><input type="time" id="edit-hora-${h.id_horario}" value="${h.hora_inicio}"></td>
        <td><span class="pill ${h.activo ? 'activo' : 'inactivo'}">${h.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td colspan="2" style="display:flex; gap:8px;">
          <button style="width:auto;" onclick="guardarEdicionHorario('${h.id_horario}')">Guardar</button>
          <button class="secondary" style="width:auto;" onclick="cancelarEdicionHorario()">Cancelar</button>
        </td>
      </tr>
    `;
  }

  return `
    <tr>
      <td>${tipo ? escapeHtml(tipo.nombre) : h.id_tipo}</td>
      <td>${DIAS[h.dia_semana]}</td>
      <td>${h.hora_inicio}</td>
      <td><span class="pill ${h.activo ? 'activo' : 'inactivo'}">${h.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td><button class="secondary" style="width:auto;" onclick="editarHorario('${h.id_horario}')">Editar</button></td>
      <td><button class="secondary" style="width:auto;" onclick="eliminarHorario('${h.id_horario}')">Desactivar</button></td>
    </tr>
  `;
}

function refrescarTablaHorarios() {
  document.getElementById('horarios-tbody').innerHTML =
    cacheHorarios.map(h => filaHorario(h)).join('');
}

function editarHorario(id_horario) {
  horarioEnEdicion = id_horario;
  refrescarTablaHorarios();
}

function cancelarEdicionHorario() {
  horarioEnEdicion = null;
  refrescarTablaHorarios();
}

async function guardarEdicionHorario(id_horario) {
  const id_tipo = document.getElementById(`edit-tipo-${id_horario}`).value;
  const dia_semana = Number(document.getElementById(`edit-dia-${id_horario}`).value);
  const hora_inicio = document.getElementById(`edit-hora-${id_horario}`).value;

  try {
    await adminCall('adminEditarHorario', { id_horario, id_tipo, dia_semana, hora_inicio });
    horarioEnEdicion = null;
    renderTabHorarios();
  } catch (err) {
    alert(err.message);
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

async function renderTabReservas() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<p>Cargando...</p>';

  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const enDosSemanas = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const resumen = await adminCall('adminGetResumenClases', { desde: hoy, hasta: enDosSemanas });

    el.innerHTML = `
      <table>
        <thead><tr><th>Clase</th><th>Fecha</th><th>Hora</th><th>Ocupación</th><th></th></tr></thead>
        <tbody>
          ${resumen.map(c => `
            <tr>
              <td>${escapeHtml(c.nombre_tipo)}</td>
              <td>${c.fecha}</td>
              <td>${c.hora_inicio}</td>
              <td>${c.ocupados} / ${c.cupo_maximo}</td>
              <td><button class="secondary" style="width:auto;" onclick="verReservas('${c.id_clase}', '${escapeHtml(c.nombre_tipo)} — ${c.fecha} ${c.hora_inicio}')">Ver alumnos</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div id="detalle-reservas"></div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

async function verReservas(id_clase, etiqueta) {
  const detalle = document.getElementById('detalle-reservas');
  detalle.innerHTML = '<p>Cargando...</p>';

  try {
    const reservas = await adminCall('adminGetReservasPorClase', { id_clase });
    detalle.innerHTML = `
      <h3>${etiqueta}</h3>
      <table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Estado</th></tr></thead>
        <tbody>
          ${reservas.map(r => `
            <tr>
              <td>${escapeHtml(r.nombre)} ${escapeHtml(r.apellido)}</td>
              <td>${escapeHtml(r.correo)}</td>
              <td>${escapeHtml(r.telefono)}</td>
              <td><span class="pill ${r.estado === 'confirmada' ? 'activo' : 'inactivo'}">${r.estado}</span></td>
            </tr>
          `).join('') || '<tr><td colspan="4">Sin reservas aún.</td></tr>'}
        </tbody>
      </table>
    `;
  } catch (err) {
    detalle.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}