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

async function renderTabHorarios() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<p>Cargando...</p>';

  try {
    if (!cacheTipos.length) cacheTipos = await adminCall('adminGetTiposDeClase');
    const horarios = await adminCall('adminGetHorarios');

    el.innerHTML = `
      <div class="inline-form">
        <div class="field">
          <label>Tipo de clase</label>
          <select id="h-tipo">
            ${cacheTipos.map(t => `<option value="${t.id_tipo}">${escapeHtml(t.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Día</label>
          <select id="h-dia">
            ${DIAS.map((d, i) => `<option value="${i}">${d}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Hora inicio</label>
          <input type="time" id="h-hora">
        </div>
        <button onclick="crearHorario()">Agregar horario</button>
      </div>
      <div id="horarios-msg"></div>
      <table>
        <thead><tr><th>Tipo</th><th>Día</th><th>Hora</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${horarios.map(h => {
            const tipo = cacheTipos.find(t => t.id_tipo === h.id_tipo);
            return `
              <tr>
                <td>${tipo ? escapeHtml(tipo.nombre) : h.id_tipo}</td>
                <td>${DIAS[h.dia_semana]}</td>
                <td>${h.hora_inicio}</td>
                <td><span class="pill ${h.activo ? 'activo' : 'inactivo'}">${h.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td><button class="secondary" style="width:auto;" onclick="eliminarHorario('${h.id_horario}')">Desactivar</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

async function crearHorario() {
  const id_tipo = document.getElementById('h-tipo').value;
  const dia_semana = Number(document.getElementById('h-dia').value);
  const hora_inicio = document.getElementById('h-hora').value;
  const msg = document.getElementById('horarios-msg');

  try {
    await adminCall('adminCrearHorario', { id_tipo, dia_semana, hora_inicio });
    msg.innerHTML = `<div class="msg ok">Horario agregado.</div>`;
    renderTabHorarios();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
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
