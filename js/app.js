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

// ---------- Modal de reserva ----------

function abrirModalReserva(clase) {
  claseSeleccionada = clase;
  document.getElementById('modal-titulo').textContent = clase.nombre_tipo;
  document.getElementById('modal-detalle').textContent =
    `${formatearFechaLarga(clase.fecha)} — ${clase.hora_inicio} hrs`;
  document.getElementById('form-msg').innerHTML = '';
  document.getElementById('form-reserva').reset();
  document.getElementById('modal-reserva').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modal-reserva').style.display = 'none';
  claseSeleccionada = null;
}

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'form-reserva') return;
  e.preventDefault();

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Reservando...';

  try {
    await apiCall('crearReserva', {
      id_clase: claseSeleccionada.id_clase,
      nombre: document.getElementById('f-nombre').value,
      apellido: document.getElementById('f-apellido').value,
      correo: document.getElementById('f-correo').value,
      telefono: document.getElementById('f-telefono').value
    });

    document.getElementById('form-msg').innerHTML =
      `<div class="msg ok">¡Reserva confirmada! Te enviamos un correo con los detalles.</div>`;

    setTimeout(async () => {
      cerrarModal();
      await cargarMesYRenderizar();
      renderHoras();
    }, 1500);
  } catch (err) {
    document.getElementById('form-msg').innerHTML =
      `<div class="msg error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar reserva';
  }
});

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
