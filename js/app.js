// app.js — lógica del perfil alumno

let claseSeleccionada = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const idCancelar = params.get('cancelar');

  if (idCancelar) {
    abrirModalCancelacion(idCancelar);
  }

  await cargarClases();
});

async function cargarClases() {
  const contenido = document.getElementById('contenido');
  try {
    const hoy = new Date();
    const enDosSemanas = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const clases = await apiCall('getClasesDisponibles', {
      desde: isoDate(hoy),
      hasta: isoDate(enDosSemanas)
    });

    renderClases(clases);
  } catch (err) {
    contenido.innerHTML = `<div class="msg error">No se pudieron cargar las clases: ${escapeHtml(err.message)}</div>`;
  }
}

function renderClases(clases) {
  const contenido = document.getElementById('contenido');

  if (!clases.length) {
    contenido.innerHTML = `<div class="empty-state">No hay clases programadas por ahora. Vuelve a revisar más tarde.</div>`;
    return;
  }

  const porFecha = {};
  clases.forEach(c => {
    if (!porFecha[c.fecha]) porFecha[c.fecha] = [];
    porFecha[c.fecha].push(c);
  });

  const fechas = Object.keys(porFecha).sort();

  contenido.innerHTML = fechas.map(fecha => {
    const tarjetas = porFecha[fecha].map(c => {
      const lleno = c.cupo_disponible <= 0;
      const pocos = !lleno && c.cupo_disponible <= 3;
      const claseCupo = lleno ? 'lleno' : (pocos ? 'pocos' : '');
      const textoCupo = lleno ? 'Sin cupos' : `${c.cupo_disponible} de ${c.cupo_maximo} cupos`;

      return `
        <div class="class-card">
          <div class="tipo">${escapeHtml(c.nombre_tipo)}</div>
          <div class="hora">${c.hora_inicio}</div>
          <div class="cupos ${claseCupo}">${textoCupo}</div>
          <button ${lleno ? 'disabled' : ''} onclick='abrirModalReserva(${JSON.stringify(c)})'>
            ${lleno ? 'Sin cupos' : 'Reservar'}
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="day-group">
        <div class="day-title">${formatearFechaLarga(fecha)}</div>
        <div class="classes-grid">${tarjetas}</div>
      </div>
    `;
  }).join('');
}

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
    const resultado = await apiCall('crearReserva', {
      id_clase: claseSeleccionada.id_clase,
      nombre: document.getElementById('f-nombre').value,
      apellido: document.getElementById('f-apellido').value,
      correo: document.getElementById('f-correo').value,
      telefono: document.getElementById('f-telefono').value
    });

    document.getElementById('form-msg').innerHTML =
      `<div class="msg ok">¡Reserva confirmada! Te enviamos un correo con los detalles.</div>`;

    setTimeout(() => {
      cerrarModal();
      cargarClases();
    }, 1500);
  } catch (err) {
    document.getElementById('form-msg').innerHTML =
      `<div class="msg error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar reserva';
  }
});

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

function isoDate(date) {
  return date.toISOString().slice(0, 10);
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
