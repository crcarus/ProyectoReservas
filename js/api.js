// api.js
// Reemplaza esta URL por la de tu Web App de Apps Script una vez desplegado
// (Extensiones > Apps Script > Implementar > Nueva implementación > Aplicación web).
const API_URL = 'PASTE_TU_URL_DE_WEB_APP_AQUI';

/**
 * Llama a una acción de la API. Usa text/plain para evitar el preflight CORS
 * que Apps Script no maneja bien con application/json.
 */
async function apiCall(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload })
  });

  if (!res.ok) {
    throw new Error('Error de red al contactar el servidor (' + res.status + ').');
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || 'Ocurrió un error inesperado.');
  }
  return data.data;
}
