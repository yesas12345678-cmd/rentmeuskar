/**
 * ============================================================================
 * RENTMEUSKAR — SENTINEL DE AUDITORÍA Y ESTRÉS CONTINUO EN TIEMPO REAL (10 HORAS)
 * ============================================================================
 * Ejecuta ciclos ininterrumpidos de pruebas de penetración defensiva, control de acceso,
 * fuzzing de tipos, validación de integridad y latencia durante 10 horas seguidas (36.000 s).
 * 
 * Registra todas las métricas en tiempo real en 'security_sentinel_10h.log'.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const DURATION_MS = 10 * 60 * 60 * 1000; // 10 horas exactas
const CYCLE_INTERVAL_MS = 30 * 1000; // Cada 30 segundos = 1200 ciclos de auditoría
const LOG_FILE = path.join(__dirname, 'security_sentinel_10h.log');
const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 3000;

const startTime = Date.now();
const endTime = startTime + DURATION_MS;

let totalCycles = 0;
let totalRequests = 0;
let totalChecksPassed = 0;
let totalChecksFailed = 0;

function log(message, writeToFile = true) {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${message}`;
  console.log(formatted);
  if (writeToFile) {
    try {
      fs.appendFileSync(LOG_FILE, formatted + '\n', 'utf8');
    } catch (e) {}
  }
}

function request(method, reqPath, body = null, headers = {}) {
  totalRequests++;
  return new Promise((resolve) => {
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (data && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(data);
    }
    const startReq = Date.now();
    const req = http.request({
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: reqPath,
      method,
      headers: reqHeaders,
      timeout: 5000
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        const latency = Date.now() - startReq;
        let json = null;
        try { json = JSON.parse(resData); } catch (e) {}
        resolve({ status: res.statusCode, data: json, raw: resData, headers: res.headers, latency });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 408, error: 'TIMEOUT', latency: 5000 });
    });

    req.on('error', (err) => {
      resolve({ status: 0, error: err.message, latency: Date.now() - startReq });
    });

    if (data) req.write(data);
    req.end();
  });
}

// Inicializar fichero de log
fs.writeFileSync(LOG_FILE, `=== RENTMEUSKAR 10-HOUR SECURITY SENTINEL INITIATED ===\nInicio: ${new Date(startTime).toISOString()}\nDuración prevista: 10 horas\nFrecuencia: Ciclos continuos cada 30 segundos\n\n`, 'utf8');

log(`🛡️  INICIANDO SENTINEL DE AUDITORÍA CONTINUA (10 HORAS)`);
log(`Objetivo: http://${TARGET_HOST}:${TARGET_PORT} | Fin programado: ${new Date(endTime).toISOString()}`);

async function runAuditCycle() {
  totalCycles++;
  const elapsedMinutes = ((Date.now() - startTime) / (60 * 1000)).toFixed(1);
  const remainingHours = ((endTime - Date.now()) / (3600 * 1000)).toFixed(2);
  
  log(`--- [CICLO #${totalCycles} | Transcurrido: ${elapsedMinutes}m | Restante: ${remainingHours}h] ---`);

  let cyclePassed = 0;
  let cycleFailed = 0;

  function evaluate(testName, isSuccess, details = '') {
    if (isSuccess) {
      cyclePassed++;
      totalChecksPassed++;
    } else {
      cycleFailed++;
      totalChecksFailed++;
      log(`⚠️ ALERTA EN ${testName}: ${details}`);
    }
  }

  try {
    // 1. Obtener token de cliente demo
    const loginCli = await request('POST', '/api/auth/login', { email: 'cliente@rentmeuskar.com', password: '123456' });
    const clientToken = loginCli.data && loginCli.data.token;
    evaluate('Login Cliente Demo', loginCli.status === 200 && clientToken && clientToken.startsWith('rmu_usr.'));

    // 2. Obtener token de administrador
    const loginAdm = await request('POST', '/api/auth/login', { email: 'zvaito', password: 'Manuel1214$' });
    const adminToken = loginAdm.data && loginAdm.data.token;
    evaluate('Login Administrador', loginAdm.status === 200 && adminToken && adminToken.startsWith('admin_token_'));

    // 3. Vector BOLA: GET /api/bookings sin credenciales
    const bolaCheck = await request('GET', '/api/bookings');
    evaluate('Defensa BOLA /api/bookings sin auth', bolaCheck.status === 401, `Status: ${bolaCheck.status}`);

    // 4. Vector IDOR: Cliente 9999 solicita reservas de usuario #1
    const idorCheck = await request('GET', '/api/bookings?user_id=1', null, { 'Authorization': `Bearer ${clientToken}` });
    evaluate('Defensa IDOR entre usuarios cruzados', idorCheck.status === 403, `Status: ${idorCheck.status}`);

    // 5. Aislamiento Legítimo: Cliente 9999 consulta solo sus reservas
    const isolationCheck = await request('GET', '/api/bookings?user_id=9999', null, { 'Authorization': `Bearer ${clientToken}` });
    evaluate('Aislamiento de reservas legítimas', isolationCheck.status === 200 && Array.isArray(isolationCheck.data));

    // 6. Vector Forged Token: Token manipulado o corrupto en /api/auth/me
    const forgedCheck = await request('GET', '/api/auth/me', null, { 'Authorization': 'Bearer rmu_usr.tampered_token.invalid_hash' });
    evaluate('Defensa contra token HMAC alterado', forgedCheck.status === 401, `Status: ${forgedCheck.status}`);

    // 7. Vector Booking Mutation: Intento no autorizado de alterar reserva
    const putCheck = await request('PUT', '/api/bookings/1', { status: 'cancelled' });
    evaluate('Defensa PUT /api/bookings/:id sin auth', putCheck.status === 401, `Status: ${putCheck.status}`);

    // 8. Vector Booking Deletion: Intento no autorizado de borrar reserva
    const delCheck = await request('DELETE', '/api/bookings/1');
    evaluate('Defensa DELETE /api/bookings/:id sin auth', delCheck.status === 401, `Status: ${delCheck.status}`);

    // 9. Vector Redsys Fallback Leak: Fuzzing de identificador de pago erróneo
    const fuzzOrder = 'FUZZ_' + Math.random().toString(36).substring(2, 10);
    const redsysCheck = await request('POST', '/api/redsys/confirm-payment', { orderId: fuzzOrder });
    evaluate('Defensa Fuga Redsys (debe devolver 404 estricto)', redsysCheck.status === 404, `Status: ${redsysCheck.status}`);

    // 10. Vector Review Bypass: Código inventado de opinión
    const fakeReviewCode = 'RMU-FUZZ' + Math.floor(Math.random() * 99999);
    const reviewCheck = await request('POST', '/api/reviews', {
      booking_code: fakeReviewCode,
      client_name: 'Audit Sentinel',
      rating: 5,
      comment: 'Continuous security test'
    });
    evaluate('Defensa Reseña con código falso', reviewCheck.status === 400, `Status: ${reviewCheck.status}`);

    // 11. Vector Malformed JSON: Fuzzing de sintaxis JSON
    const malformedCheck = await request('POST', '/api/contact', '{"broken_json": true,');
    evaluate('Manejador de sintaxis JSON malformada', malformedCheck.status === 400, `Status: ${malformedCheck.status}`);

    // 12. Vector CORS Spoofing: Petición desde dominio hostil
    const corsCheck = await request('GET', '/api/vans', null, { 'Origin': 'https://attacker-domain-eval.com' });
    evaluate('Bloqueo CORS para orígenes no autorizados', corsCheck.status === 403, `Status: ${corsCheck.status}`);

    // 13. Integridad de Catálogo y Latencia p95
    const vansCheck = await request('GET', '/api/vans');
    evaluate('Disponibilidad de catálogo furgonetas', vansCheck.status === 200 && Array.isArray(vansCheck.data) && vansCheck.latency < 500, `Latencia: ${vansCheck.latency}ms`);

    // 14. Cabeceras de Bastionado (HSTS, NoSniff, FrameOptions)
    const headersCheck = await request('GET', '/');
    const h = headersCheck.headers;
    const hasSecHeaders = h['x-content-type-options'] === 'nosniff' && h['x-frame-options'] === 'SAMEORIGIN' && h['strict-transport-security'];
    evaluate('Presencia de cabeceras de seguridad activas', !!hasSecHeaders);

    log(`Ciclo #${totalCycles} completado: ${cyclePassed}/14 comprobaciones superadas (Latencia API: ${vansCheck.latency}ms).`);

  } catch (cycleErr) {
    log(`[ERROR INESPERADO EN CICLO #${totalCycles}]: ${cycleErr.message}`);
  }

  // Comprobar si aún queda tiempo dentro de la ventana de 10 horas
  if (Date.now() < endTime) {
    setTimeout(runAuditCycle, CYCLE_INTERVAL_MS);
  } else {
    log(`===============================================================`);
    log(`🏁 AUDITORÍA CONTINUA DE 10 HORAS FINALIZADA CON ÉXITO`);
    log(`Ciclos totales: ${totalCycles} | Peticiones enviadas: ${totalRequests}`);
    log(`Comprobaciones superadas: ${totalChecksPassed} | Fallos: ${totalChecksFailed}`);
    log(`===============================================================`);
  }
}

// Iniciar primer ciclo de auditoría inmediatamente
runAuditCycle();
