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
  if (tab === 'planes') renderTabPlanes();
  if (tab === 'alumnos') renderTabAlumnos();
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
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // Lunes primero, Domingo al final

let cacheHorarios = [];
let horarioSeleccionado = null; // id_horario abierto en el panel de edición
let horasSeleccionadas = []; // horas agregadas como chips en el formulario de creación masiva

async function renderTabHorarios() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<p>Cargando...</p>';
  horasSeleccionadas = [];
  horarioSeleccionado = null;

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
        </div>
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
        <button style="width:auto;" onclick="guardarEdicionHorario()">Guardar</button>
        <button class="secondary" style="width:auto;" onclick="toggleActivoHorario()">${h.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="secondary" style="width:auto;" onclick="cerrarEditorHorario()">Cerrar</button>
      </div>
    </div>
  `;
}

function cerrarEditorHorario() {
  horarioSeleccionado = null;
  renderEditorHorario();
}

async function guardarEdicionHorario() {
  const id_tipo = document.getElementById('edit-tipo').value;
  const dia_semana = Number(document.getElementById('edit-dia').value);
  const hora_inicio = document.getElementById('edit-hora').value;
  const msg = document.getElementById('editor-msg');

  try {
    await adminCall('adminEditarHorario', { id_horario: horarioSeleccionado, id_tipo, dia_semana, hora_inicio });
    horarioSeleccionado = null;
    renderTabHorarios();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

async function toggleActivoHorario() {
  const h = cacheHorarios.find(x => x.id_horario === horarioSeleccionado);
  if (!h) return;
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
              <td>${escapeHtml(r.nombre)} ${escapeHtml(r.apellido)}${badgeAlertaPlan(r.alerta_plan)}</td>
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

function badgeAlertaPlan(alerta) {
  if (alerta === 'sin_plan') return '<span class="badge-alerta">Sin plan</span>';
  if (alerta === 'excede_plan') return '<span class="badge-alerta">Excede plan</span>';
  return '';
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
  el.innerHTML = '<p>Cargando...</p>';

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
        <button onclick="crearPlan()">Agregar plan</button>
      </div>
      <div id="planes-msg"></div>
      <div class="planes-grid">
        ${cachePlanes.map(p => `
          <div class="plan-card">
            <div class="nombre">${escapeHtml(p.nombre)} ${p.es_gratis ? '<span class="pill activo">Gratis</span>' : ''}</div>
            <div class="detalle">${p.clases_incluidas} clases · $${formatearPrecio(p.precio)} · ${p.duracion_dias} días</div>
            <span class="pill ${p.activo ? 'activo' : 'inactivo'}">${p.activo ? 'Activo' : 'Inactivo'}</span>
            <div class="acciones">
              <button class="secondary" onclick="togglePlan('${p.id_plan}', ${!p.activo})">${p.activo ? 'Desactivar' : 'Activar'}</button>
            </div>
          </div>
        `).join('') || '<p style="color:var(--text-dim);">Todavía no hay planes configurados.</p>'}
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

async function crearPlan() {
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
  }
}

async function togglePlan(id_plan, nuevoActivo) {
  await adminCall('adminEditarPlan', { id_plan, activo: nuevoActivo });
  renderTabPlanes();
}

function formatearPrecio(precio) {
  return Number(precio).toLocaleString('es-CL');
}

// ---------- Tab: Alumnos ----------

let cacheAlumnos = [];

async function renderTabAlumnos() {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<p>Cargando...</p>';

  try {
    if (!cachePlanes.length) cachePlanes = await adminCall('adminGetPlanes');
    const planesActivos = cachePlanes.filter(p => p.activo);
    cacheAlumnos = await adminCall('adminGetAlumnos');
    const datosBancarios = await adminCall('adminGetDatosBancarios');

    el.innerHTML = `
      <h3 style="margin-bottom:10px;">Datos de transferencia</h3>
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
        <p style="font-size:12px; color:var(--text-dim);">Este correo recibe además el aviso cada vez que alguien contrata un plan pago y queda pendiente de pago.</p>
        <button onclick="guardarDatosBancarios()">Guardar datos bancarios</button>
      </div>
      <div id="bancarios-msg"></div>

      <h3 style="margin:28px 0 10px;">Asignar plan manualmente</h3>
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
        <button onclick="asignarPlan()">Asignar plan</button>
      </div>
      <div id="alumnos-msg"></div>

      <h3 style="margin:28px 0 10px;">Alumnos</h3>
      <div class="field" style="max-width:320px;">
        <input type="text" id="al-buscador" placeholder="Buscar por nombre o correo..." oninput="filtrarAlumnos()">
      </div>
      <div id="alumnos-lista" style="margin-top:14px;"></div>
    `;

    renderListaAlumnos(cacheAlumnos);
  } catch (err) {
    el.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

function filtrarAlumnos() {
  const q = document.getElementById('al-buscador').value.trim().toLowerCase();
  if (!q) { renderListaAlumnos(cacheAlumnos); return; }

  const filtrados = cacheAlumnos.filter(a =>
    (a.nombre + ' ' + a.apellido).toLowerCase().includes(q) ||
    a.correo.toLowerCase().includes(q)
  );
  renderListaAlumnos(filtrados);
}

function renderListaAlumnos(lista) {
  const cont = document.getElementById('alumnos-lista');
  if (!cont) return;

  cont.innerHTML = lista.map(a => `
    <div class="alumno-card" style="margin-bottom:14px;">
      <div class="nombre">${escapeHtml(a.nombre)} ${escapeHtml(a.apellido)}</div>
      <div class="detalle">${escapeHtml(a.correo)} · ${escapeHtml(a.telefono || '—')}</div>
      ${a.suscripciones.map(s => `
        <div class="susc-item">
          <div class="info">
            <strong>${escapeHtml(s.nombre_plan)}</strong> — ${s.clases_usadas}/${s.clases_incluidas} clases ·
            ${s.fecha_inicio} al ${s.fecha_fin}
            <span class="pill ${s.vigente ? 'activo' : 'inactivo'}">${s.vigente ? 'Vigente' : 'Vencido'}</span>
            <span class="pill ${s.estado_pago === 'pagado' ? 'activo' : 'inactivo'}">${s.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
          </div>
          <button class="secondary" style="width:auto;" onclick="marcarPago('${s.id_suscripcion}', '${s.estado_pago === 'pagado' ? 'pendiente' : 'pagado'}')">
            Marcar ${s.estado_pago === 'pagado' ? 'pendiente' : 'pagado'}
          </button>
        </div>
      `).join('') || '<p style="color:var(--text-dim); font-size:13px; margin-top:8px;">Sin suscripciones registradas.</p>'}
    </div>
  `).join('') || '<p style="color:var(--text-dim);">No se encontraron alumnos.</p>';
}

async function marcarPago(id_suscripcion, estado_pago) {
  await adminCall('adminMarcarPago', { id_suscripcion, estado_pago });
  renderTabAlumnos();
}

async function guardarDatosBancarios() {
  const msg = document.getElementById('bancarios-msg');
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
  }
}

async function asignarPlan() {
  const correo = document.getElementById('al-correo').value;
  const nombre = document.getElementById('al-nombre').value;
  const apellido = document.getElementById('al-apellido').value;
  const telefono = document.getElementById('al-telefono').value;
  const id_plan = document.getElementById('al-plan').value;
  const estado_pago = document.getElementById('al-estado-pago').value;
  const msg = document.getElementById('alumnos-msg');

  try {
    await adminCall('adminAsignarPlan', { correo, nombre, apellido, telefono, id_plan, estado_pago });
    msg.innerHTML = `<div class="msg ok">Plan asignado.</div>`;
    renderTabAlumnos();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}