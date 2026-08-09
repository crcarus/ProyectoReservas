// app.js — flujo del alumno: tipo de clase → calendario mensual → horas → reserva

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

let tipos = [];
let tipoActual = null;
let mesActual = primerDiaDelMes(new Date());
let clasesDelMes = [];      // clases del tipoActual dentro del mes visible
let diaSeleccionado = null; // 'yyyy-MM-dd'
let claseSeleccionada = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const idCancelar = params.get('cancelar');
  if (idCancelar) {
    abrirModalCancelacion(idCancelar);
  }

  await cargarTipos();
});

// ---------- Pantalla 1: elegir tipo de clase ----------

async function cargarTipos() {
  const contenido = document.getElementById('contenido');
  try {
    tipos = await apiCall('getTiposDeClase');
    renderTipos();
  } catch (err) {
    contenido.innerHTML = `<div class="msg error">No se pudieron cargar los tipos de clase: ${escapeHtml(err.message)}</div>`;
  }
}

function renderTipos() {
  const contenido = document.getElementById('contenido');

  if (!tipos.length) {
    contenido.innerHTML = `<div class="empty-state">Todavía no hay clases configuradas. Vuelve a revisar más tarde.</div>`;
    return;
  }

  contenido.innerHTML = `
    <div class="screen-header">
      <div class="nombre-tipo">¿Qué clase quieres reservar?</div>
    </div>
    <div class="tipos-grid">
      ${tipos.map(t => `
        <div class="tipo-card" onclick='seleccionarTipo(${JSON.stringify(t)})'>
          <div class="nombre">${escapeHtml(t.nombre)}</div>
          <div class="detalle">${t.duracion_minutos} min · hasta ${t.cupo_maximo} cupos</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ---------- Pantalla 2: calendario mensual ----------

function seleccionarTipo(tipo) {
  tipoActual = tipo;
  mesActual = primerDiaDelMes(new Date());
  cargarMesYRenderizar();
}

async function cargarMesYRenderizar() {
  const contenido = document.getElementById('contenido');
  contenido.innerHTML = '<p>Cargando calendario...</p>';

  try {
    const desde = mesActual;
    const hasta = ultimoDiaDelMes(mesActual);

    const clases = await apiCall('getClasesDisponibles', {
      desde: isoDate(desde),
      hasta: isoDate(hasta)
    });

    clasesDelMes = clases.filter(c => c.id_tipo === tipoActual.id_tipo);
    renderCalendario();
  } catch (err) {
    contenido.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

function cambiarMes(delta) {
  mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + delta, 1);
  cargarMesYRenderizar();
}

function renderCalendario() {
  const contenido = document.getElementById('contenido');

  const diasConClases = new Set(clasesDelMes.map(c => c.fecha));
  const primerDia = mesActual.getDay(); // 0=domingo
  const totalDias = ultimoDiaDelMes(mesActual).getDate();
  const hoyISO = isoDate(new Date());

  let celdas = '';
  for (let i = 0; i < primerDia; i++) {
    celdas += `<div class="calendar-day vacio"></div>`;
  }
  for (let dia = 1; dia <= totalDias; dia++) {
    const fecha = new Date(mesActual.getFullYear(), mesActual.getMonth(), dia);
    const fechaISO = isoDate(fecha);
    const disponible = diasConClases.has(fechaISO) && fechaISO >= hoyISO;
    celdas += `
      <div class="calendar-day ${disponible ? 'disponible' : ''}"
           ${disponible ? `onclick="seleccionarDia('${fechaISO}')"` : ''}>
        ${dia}
      </div>
    `;
  }

  contenido.innerHTML = `
    <button class="back-link" onclick="renderTipos()">&larr; Elegir otra clase</button>
    <div class="screen-header">
      <div class="nombre-tipo">${escapeHtml(tipoActual.nombre)}</div>
      <div class="meta">Duración: ${tipoActual.duracion_minutos} min · Selecciona un día</div>
    </div>
    <div class="calendar-header">
      <button onclick="cambiarMes(-1)">&larr;</button>
      <div class="calendar-month-label">${formatearMesLargo(mesActual)}</div>
      <button onclick="cambiarMes(1)">&rarr;</button>
    </div>
    <div class="calendar-dow-row">
      ${DOW.map(d => `<div class="calendar-dow">${d}</div>`).join('')}
    </div>
    <div class="calendar-grid">${celdas}</div>
  `;
}

// ---------- Pantalla 3: horarios de un día ----------

function seleccionarDia(fechaISO) {
  diaSeleccionado = fechaISO;
  renderHoras();
}

function renderHoras() {
  const contenido = document.getElementById('contenido');

  const clasesDelDia = clasesDelMes
    .filter(c => c.fecha === diaSeleccionado)
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  contenido.innerHTML = `
    <button class="back-link" onclick="renderCalendario()">&larr; Volver al calendario</button>
    <div class="screen-header">
      <div class="nombre-tipo">${formatearFechaLarga(diaSeleccionado)}</div>
      <div class="meta">${escapeHtml(tipoActual.nombre)} · Selecciona una hora</div>
    </div>
    <div class="horas-list">
      ${clasesDelDia.map(c => {
        const lleno = c.cupo_disponible <= 0;
        const pocos = !lleno && c.cupo_disponible <= 3;
        const claseCupo = lleno ? 'lleno' : (pocos ? 'pocos' : '');
        const textoCupo = lleno ? 'Sin cupos' : `${c.cupo_disponible} de ${c.cupo_maximo} cupos`;
        return `
          <button class="hora-btn" ${lleno ? 'disabled' : ''} onclick='abrirModalReserva(${JSON.stringify(c)})'>
            <span class="hora">${c.hora_inicio}</span>
            <span class="cupos-txt ${claseCupo}">${textoCupo}</span>
          </button>
        `;
      }).join('') || '<p>No hay horarios para este día.</p>'}
    </div>
  `;
}

// ---------- Modal de reserva (flujo de varios pasos) ----------
// pasoModal: 'datos' -> 'resultado' (con cupo) -> 'planes' (sin cupo) -> 'pago' -> 'ok'

let planSeleccionado = null;
let estadoAlumnoActual = null;

function abrirModalReserva(clase) {
  claseSeleccionada = clase;
  planSeleccionado = null;
  estadoAlumnoActual = null;
  renderPasoDatos();
  document.getElementById('modal-reserva').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modal-reserva').style.display = 'none';
  claseSeleccionada = null;
  planSeleccionado = null;
  estadoAlumnoActual = null;
}

function modalInner(html) {
  document.getElementById('modal-reserva-inner').innerHTML = html;
}

// Paso 1: datos del alumno

function renderPasoDatos() {
  modalInner(`
    <h3>${escapeHtml(claseSeleccionada.nombre_tipo)}</h3>
    <p style="margin-bottom:18px;">${formatearFechaLarga(claseSeleccionada.fecha)} — ${claseSeleccionada.hora_inicio} hrs</p>
    <form id="form-datos">
      <div class="field"><label>Nombre</label><input type="text" id="f-nombre" required></div>
      <div class="field"><label>Apellido</label><input type="text" id="f-apellido" required></div>
      <div class="field"><label>Correo</label><input type="email" id="f-correo" required></div>
      <div class="field"><label>Teléfono</label><input type="tel" id="f-telefono" required></div>
      <div id="paso-datos-msg"></div>
      <div style="display:flex; gap:10px;">
        <button type="button" class="secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit">Continuar</button>
      </div>
    </form>
  `);
}

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'form-datos') return;
  e.preventDefault();

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Verificando...';

  const nombre = document.getElementById('f-nombre').value.trim();
  const apellido = document.getElementById('f-apellido').value.trim();
  const correo = document.getElementById('f-correo').value.trim();
  const telefono = document.getElementById('f-telefono').value.trim();

  try {
    const estado = await apiCall('getEstadoAlumno', { nombre, apellido, correo });
    estadoAlumnoActual = Object.assign({}, estado, { nombre, apellido, correo, telefono });

    if (estado.tiene_cupo) {
      renderPasoConCupo();
    } else {
      renderPasoElegirPlan();
    }
  } catch (err) {
    document.getElementById('paso-datos-msg').innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Continuar';
  }
});

// Paso 2a: tiene cupo con su plan actual → reserva directa

function renderPasoConCupo() {
  const e = estadoAlumnoActual;
  const restantes = e.clases_incluidas - e.clases_usadas;

  modalInner(`
    <h3>${escapeHtml(claseSeleccionada.nombre_tipo)}</h3>
    <p style="margin-bottom:18px;">${formatearFechaLarga(claseSeleccionada.fecha)} — ${claseSeleccionada.hora_inicio} hrs</p>
    <div class="summary-card">
      <div class="cls">${escapeHtml(e.nombre_plan)}</div>
      <div class="meta">Te quedan ${restantes} de ${e.clases_incluidas} clases · vence el ${e.fecha_fin}</div>
    </div>
    <div id="paso-cupo-msg"></div>
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button type="button" class="secondary" onclick="renderPasoDatos()">Volver</button>
      <button type="button" onclick="confirmarReservaConCupo()">Confirmar reserva</button>
    </div>
  `);
}

async function confirmarReservaConCupo() {
  const msg = document.getElementById('paso-cupo-msg');
  const e = estadoAlumnoActual;

  try {
    await apiCall('crearReserva', {
      id_clase: claseSeleccionada.id_clase,
      nombre: e.nombre, apellido: e.apellido, correo: e.correo, telefono: e.telefono
    });
    renderPasoOk();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

// Paso 2b: sin cupo (nuevo / vencido / agotó su plan) → elegir plan

function renderPasoElegirPlan() {
  const e = estadoAlumnoActual;
  let aviso;
  if (!e.encontrado) {
    aviso = 'Para reservar necesitas un plan activo. Elige una opción:';
  } else if (e.vencido) {
    aviso = `Tu plan (${escapeHtml(e.nombre_plan)}) venció el ${e.fecha_fin}. Elige un nuevo plan para continuar:`;
  } else {
    aviso = `Ya usaste tus ${e.clases_incluidas} clases de este período (vence el ${e.fecha_fin}). Elige un plan para seguir reservando:`;
  }

  modalInner(`
    <h3>${escapeHtml(claseSeleccionada.nombre_tipo)}</h3>
    <p style="margin-bottom:14px;">${formatearFechaLarga(claseSeleccionada.fecha)} — ${claseSeleccionada.hora_inicio} hrs</p>
    <div class="msg error" style="background:rgba(200,240,0,0.08); color:var(--text); border-color:var(--border);">${aviso}</div>
    <div class="planes-select-grid">
      ${e.planes.map(p => {
        const hoy = new Date();
        const vence = new Date(hoy.getTime() + p.duracion_dias * 86400000);
        const precioTxt = p.es_gratis ? 'Gratis' : `$${Number(p.precio).toLocaleString('es-CL')}`;
        return `
          <button type="button" class="plan-select-card ${p.es_gratis ? 'gratis' : ''}" onclick='elegirPlan(${JSON.stringify(p)})'>
            <div class="nombre">${escapeHtml(p.nombre)}</div>
            <div class="detalle">${p.clases_incluidas} clases · ${precioTxt}</div>
            <div class="detalle">Vigencia: ${isoDate(hoy)} al ${isoDate(vence)}</div>
          </button>
        `;
      }).join('')}
    </div>
    <button type="button" class="secondary" style="margin-top:14px;" onclick="renderPasoDatos()">Volver</button>
  `);
}

function elegirPlan(plan) {
  planSeleccionado = plan;
  if (plan.es_gratis) {
    confirmarReservaConPlan();
  } else {
    renderPasoPago();
  }
}

// Paso 3: datos de transferencia (solo planes pagos)

function renderPasoPago() {
  const b = estadoAlumnoActual.datos_bancarios;
  const p = planSeleccionado;

  modalInner(`
    <h3>Datos para transferir</h3>
    <p style="margin-bottom:14px;">Plan <strong>${escapeHtml(p.nombre)}</strong> — $${Number(p.precio).toLocaleString('es-CL')}</p>
    <div class="bank-info-box" id="bank-info-box">
      <div class="bank-row"><span>Banco</span><strong>${escapeHtml(b.banco || '—')}</strong></div>
      <div class="bank-row"><span>Tipo de cuenta</span><strong>${escapeHtml(b.tipo_cuenta || '—')}</strong></div>
      <div class="bank-row"><span>N° de cuenta</span><strong>${escapeHtml(b.numero_cuenta || '—')}</strong></div>
      <div class="bank-row"><span>RUT</span><strong>${escapeHtml(b.rut || '—')}</strong></div>
      <div class="bank-row"><span>Titular</span><strong>${escapeHtml(b.nombre_titular || '—')}</strong></div>
      <div class="bank-row"><span>Enviar comprobante a</span><strong>${escapeHtml(b.correo_confirmacion || '—')}</strong></div>
    </div>
    <button type="button" class="secondary" onclick="copiarDatosBancarios()">Copiar datos</button>
    <div id="paso-pago-msg"></div>
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button type="button" class="secondary" onclick="renderPasoElegirPlan()">Volver</button>
      <button type="button" onclick="confirmarReservaConPlan()">Ya transferí, reservar clase</button>
    </div>
  `);
}

function copiarDatosBancarios() {
  const b = estadoAlumnoActual.datos_bancarios;
  const texto = `Banco: ${b.banco}\nTipo de cuenta: ${b.tipo_cuenta}\nN° de cuenta: ${b.numero_cuenta}\nRUT: ${b.rut}\nTitular: ${b.nombre_titular}\nEnviar comprobante a: ${b.correo_confirmacion}`;
  navigator.clipboard.writeText(texto).then(() => {
    const box = document.getElementById('bank-info-box');
    box.style.borderColor = 'var(--accent)';
    setTimeout(() => { box.style.borderColor = ''; }, 800);
  });
}

async function confirmarReservaConPlan() {
  const msg = document.getElementById('paso-pago-msg');
  const e = estadoAlumnoActual;

  try {
    await apiCall('crearReservaConPlan', {
      id_clase: claseSeleccionada.id_clase,
      nombre: e.nombre, apellido: e.apellido, correo: e.correo, telefono: e.telefono,
      id_plan: planSeleccionado.id_plan
    });
    renderPasoOk();
  } catch (err) {
    if (msg) msg.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
    else modalInner(`<div class="msg error">${escapeHtml(err.message)}</div><button type="button" onclick="cerrarModal()">Cerrar</button>`);
  }
}

// Paso final: confirmación

function renderPasoOk() {
  modalInner(`
    <h3>¡Clase reservada!</h3>
    <p style="margin-bottom:18px;">Te enviamos un correo con los detalles y el link para cancelar si lo necesitas.</p>
    <button type="button" onclick="cerrarModalYRefrescar()">Listo</button>
  `);
}

async function cerrarModalYRefrescar() {
  cerrarModal();
  await cargarMesYRenderizar();
  renderHoras();
}

// ---------- Cancelación vía link del email ----------

let idReservaACancelar = null;

function abrirModalCancelacion(idReserva) {
  idReservaACancelar = idReserva;
  document.getElementById('modal-cancelacion').style.display = 'flex';
}

async function confirmarCancelacion() {
  const msgBox = document.getElementById('cancel-msg');
  try {
    await apiCall('cancelarReserva', { id_reserva: idReservaACancelar });
    msgBox.innerHTML = `<div class="msg ok">Tu reserva fue cancelada. Te enviamos un correo de confirmación.</div>`;
  } catch (err) {
    msgBox.innerHTML = `<div class="msg error">${escapeHtml(err.message)}</div>`;
  }
}

// ---------- helpers ----------

function primerDiaDelMes(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function ultimoDiaDelMes(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isoDate(date) {
  const d = new Date(date);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

function formatearMesLargo(date) {
  return date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
}

function formatearFechaLarga(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}