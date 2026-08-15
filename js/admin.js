/**
 * Email.gs
 */

const FRONTEND_URL = 'https://crcarus.github.io/ProyectoReservas/index.html';

function sendConfirmacionReserva_(data) {
  const linkCancelacion = FRONTEND_URL + '?cancelar=' + encodeURIComponent(data.id_reserva);
  const fechaLegible = formatDateISO_(data.fecha);

  const asunto = 'Reserva confirmada: ' + data.nombre_tipo + ' – ' + fechaLegible;
  const cuerpo =
    'Hola ' + data.nombre + ',\n\n' +
    'Tu reserva quedó confirmada:\n\n' +
    'Clase: ' + data.nombre_tipo + '\n' +
    'Fecha: ' + fechaLegible + '\n' +
    'Hora: ' + data.hora_inicio + '\n\n' +
    'Si necesitas cancelar, puedes hacerlo hasta 6 horas antes desde este link:\n' +
    linkCancelacion + '\n\n' +
    '¡Te esperamos!';

  MailApp.sendEmail(data.correo, asunto, cuerpo);
}

function sendConfirmacionCancelacion_(data) {
  const fechaLegible = formatDateISO_(data.fecha);
  const asunto = 'Reserva cancelada: ' + data.nombre_tipo + ' – ' + fechaLegible;
  const cuerpo =
    'Hola ' + data.nombre + ',\n\n' +
    'Confirmamos que tu reserva fue cancelada:\n\n' +
    'Clase: ' + data.nombre_tipo + '\n' +
    'Fecha: ' + fechaLegible + '\n' +
    'Hora: ' + data.hora_inicio + '\n\n' +
    'Si fue un error, puedes volver a reservar desde la página principal.';

  MailApp.sendEmail(data.correo, asunto, cuerpo);
}

/**
 * Avisa al gimnasio (correo_confirmacion configurado en Datos bancarios)
 * que hay una suscripción nueva esperando que se verifique la transferencia.
 */
function sendAvisoAdminNuevaSuscripcion_(data) {
  const correoAdmin = getDatosBancarios_().correo_confirmacion;
  if (!correoAdmin) return; // sin correo configurado, no hay a quién avisar

  const asunto = 'Nueva suscripción pendiente de pago: ' + data.nombre + ' ' + data.apellido;
  const cuerpo =
    'Se registró una nueva suscripción pendiente de pago.\n\n' +
    'Alumno: ' + data.nombre + ' ' + data.apellido + '\n' +
    'Correo: ' + data.correo + '\n' +
    'Teléfono: ' + data.telefono + '\n' +
    'Plan: ' + data.nombre_plan + ' — $' + data.precio + '\n\n' +
    'Verifica la transferencia y márcala como pagada desde el panel admin, pestaña Alumnos.';

  MailApp.sendEmail(correoAdmin, asunto, cuerpo);
}