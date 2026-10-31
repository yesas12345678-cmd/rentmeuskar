// Pruebas de la API con el servidor real en una carpeta temporal (sin base de datos ni correo).
// Ejecutar: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Puerto libre elegido al arrancar (con uno fijo o aleatorio, un servidor de otra ejecución que
// siguiera vivo en ese puerto respondía en lugar del de la prueba)
let PORT;
let BASE;
const net = require('node:net');
const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});
const ADMIN_PASSWORD = 'ClaveDePruebaAdmin1';
const SESSION_SECRET = 'secreto-de-pruebas';
const REDSYS_TEST_KEY = 'sq7HjrUOBfKmC576ILgskD5srU870gJ7'; // clave pública del entorno de pruebas de Redsys
const REDSYS_MERCHANT = '999008881';
const CLIENT = { email: 'cliente@example.com', password: 'ClaveCliente!2030' };
let serverProcess;
let tmpDir;

function scryptHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

async function call(method, url, body, token) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* respuesta sin JSON */ }
  return { status: res.status, data };
}

// Un inicio de sesión por cuenta: el servidor limita los logins por IP y las pruebas comparten IP
const tokens = {};
async function login(email, password) {
  if (!tokens[email]) tokens[email] = (await call('POST', '/api/auth/login', { email, password })).data.token;
  return tokens[email];
}

const booking = (from, to, extra = {}) => ({
  name: 'Cliente Test', van_type: 'medium', van_name: 'x', pickup_date: from, pickup_time: '09:00',
  return_date: to, return_time: '09:00', days: 1, total_price: 1, rental_mode: 'sin', ...extra
});

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rentmeuskar-test-'));
  const store = {
    fallbackUsers: [
      { id: 1, name: 'Cliente Test', email: CLIENT.email, password: scryptHash(CLIENT.password), phone: '600000001', dni: '00000000T' },
      { id: 2, name: 'Otro Cliente', email: 'otro@example.com', password: scryptHash('OtraClave!2030'), phone: '600000002', dni: '00000001R' },
      { id: 3, name: 'Cliente Sesiones', email: 'sesion@example.com', password: scryptHash('ClaveSesion!2030'), phone: '600000003', dni: '00000002W' }
    ],
    fallbackBookings: [
      { id: 50, name: 'Pago Tardío', van_type: 'medium', van_name: 'Furgoneta Test', pickup_date: futureDate(120), pickup_time: '09:00', return_date: futureDate(121), return_time: '09:00', days: 1, extras: [], total_price: 100, user_id: 1, status: 'cancelled', payment_status: 'failed', payment_id: '261099999999', rental_mode: 'sin', created_at: '2020-01-01T00:00:00Z' },
      { id: 52, name: 'Cancelada', van_type: 'medium', van_name: 'Furgoneta Test', pickup_date: futureDate(160), pickup_time: '09:00', return_date: futureDate(161), return_time: '09:00', days: 1, extras: [], total_price: 100, user_id: 1, status: 'cancelled', payment_status: 'failed', payment_id: '261077777777', rental_mode: 'sin', created_at: '2020-01-01T00:00:00Z' },
      { id: 51, name: 'Otro', van_type: 'medium', van_name: 'Furgoneta Test', pickup_date: futureDate(120), pickup_time: '09:00', return_date: futureDate(121), return_time: '09:00', days: 1, extras: [], total_price: 100, user_id: 2, status: 'confirmed', payment_status: 'paid', payment_id: '261088888888', rental_mode: 'sin', created_at: '2020-01-01T00:00:00Z' }
    ], fallbackBlockages: [], fallbackSettings: {}, fallbackReviews: [], manualReviewCodes: [], fallbackFaqs: [],
    fallbackVans: [{ id: 1, van_type: 'medium', name: 'Furgoneta Test', plate: '0000 TST', m3: '8m³', price_sin: 100, min_price_con: 50, km_price_con: 1, status: 'active', images: [], custom_extras: [{ name: 'GPS Navegador', price: 5, type: 'daily' }] },
      { id: 2, van_type: 'borrador', name: 'Furgoneta Borrador', plate: '0001 TST', m3: '8m³', price_sin: 50, min_price_con: 40, km_price_con: 1, status: 'draft', images: [], custom_extras: [] }]
  };
  fs.writeFileSync(path.join(tmpDir, 'admin_store.json'), JSON.stringify(store));

  PORT = await freePort();
  BASE = `http://127.0.0.1:${PORT}`;
  serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env, PORT: String(PORT), DATABASE_URL: '', DATA_DIR: tmpDir, UPLOADS_DIR: path.join(tmpDir, 'uploads'),
      SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_PASS: '', ADMIN_PASSWORD, SESSION_SECRET,
      ENABLE_TEST_PAYMENTS: 'true', REDSYS_MERCHANT_CODE: REDSYS_MERCHANT, REDSYS_SECRET_KEY: REDSYS_TEST_KEY, ALLOWED_ORIGINS: '', BASE_URL: ''
    },
    stdio: 'ignore'
  });
  // Si la ejecución se corta, el servidor de pruebas no se queda vivo ocupando el puerto
  process.once('exit', () => { if (serverProcess) serverProcess.kill(); });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/vans'); return; } catch (e) { await new Promise(r => setTimeout(r, 200)); }
  }
  throw new Error('El servidor de pruebas no arrancó');
});

after(() => {
  if (serverProcess) serverProcess.kill();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('no se sirve el código ni los datos del servidor', async () => {
  for (const file of ['/server.js', '/data/admin_store.json', '/package.json', '/.env']) {
    assert.equal((await fetch(BASE + file)).status, 404, file);
  }
  assert.equal((await fetch(BASE + '/')).status, 200);
});

test('los ajustes públicos no exponen credenciales de admin', async () => {
  const { data } = await call('GET', '/api/settings');
  assert.equal(Object.keys(data).filter(k => k.startsWith('admin')).length, 0);
});

test('login de admin: solo con la contraseña correcta y token firmado', async () => {
  assert.equal((await call('POST', '/api/auth/login', { email: 'zvaito', password: 'mala' })).status, 401);
  const ok = await call('POST', '/api/auth/login', { email: 'zvaito', password: ADMIN_PASSWORD });
  assert.equal(ok.status, 200);
  assert.equal((await call('GET', '/api/admin/vans', null, ok.data.token)).status, 200);
  assert.equal((await call('GET', '/api/admin/vans', null, 'admin_token_aaaaaaaaaaaaaaaaaaaa')).status, 401);
});

test('el hash de la contraseña no sirve como contraseña', async () => {
  const store = JSON.parse(fs.readFileSync(path.join(tmpDir, 'admin_store.json'), 'utf8'));
  const res = await call('POST', '/api/auth/login', { email: CLIENT.email, password: store.fallbackUsers[0].password });
  assert.equal(res.status, 401);
});

test('reservas: precio del servidor, sin sesión no se reserva y nadie ve las de otro', async () => {
  const login = await call('POST', '/api/auth/login', CLIENT);
  const token = login.data.token;

  assert.equal((await call('POST', '/api/bookings', booking(futureDate(40), futureDate(41)))).status, 401);

  const paid = await call('POST', '/api/redsys/process-test-payment', {
    payMethod: 'card', cardDetails: { cardNumber: '4548810000000003' },
    bookingData: booking(futureDate(30), futureDate(32), { extras: ['GPS Navegador (+5.00€/día)'] })
  }, token);
  assert.equal(paid.status, 201);
  // 2 días x 100 € + GPS 2 x 5 € = 210 € + 21 % IVA; el total enviado (1 €) se ignora
  assert.equal(paid.data.booking.total_price, 254.1);
  assert.equal(paid.data.booking.van_plate, '0000 TST', 'matrícula del catálogo, no una fija');

  const id = paid.data.booking.id;
  assert.equal((await call('GET', `/api/bookings/${id}`)).status, 404, 'sin sesión ni código');
  assert.equal((await call('GET', `/api/bookings/${id}?auth=${paid.data.booking.review_code}`)).status, 200);
  assert.equal((await call('GET', `/api/bookings?user_id=999`, null, token)).status, 403);
});

test('no se reserva en fechas ocupadas ni en bloqueos del admin', async () => {
  const token = await login(CLIENT.email, CLIENT.password);
  const admin = await login('zvaito', ADMIN_PASSWORD);
  await call('POST', '/api/blockages', { van_type: 'medium', start_date: futureDate(60), end_date: futureDate(65), reason: 'Mantenimiento' }, admin);
  const blocked = await call('POST', '/api/redsys/process-test-payment', {
    payMethod: 'card', cardDetails: { cardNumber: '4548810000000003' }, bookingData: booking(futureDate(61), futureDate(62))
  }, token);
  assert.equal(blocked.status, 400);
});

test('cinco pagos simultáneos para las mismas fechas: solo se acepta uno', async () => {
  const token = await login(CLIENT.email, CLIENT.password);
  const attempt = () => call('POST', '/api/redsys/process-test-payment', {
    payMethod: 'card', cardDetails: { cardNumber: '4548810000000003' }, bookingData: booking(futureDate(90), futureDate(92))
  }, token);
  const results = await Promise.all([attempt(), attempt(), attempt(), attempt(), attempt()]);
  assert.equal(results.filter(r => r.status === 201).length, 1);
});

test('no se reserva una furgoneta en borrador', async () => {
  const token = await login(CLIENT.email, CLIENT.password);
  const res = await call('POST', '/api/bookings', booking(futureDate(100), futureDate(101), { van_type: 'borrador' }), token);
  assert.equal(res.status, 400);
});

test('el perfil no puede quedarse con el DNI o teléfono de otra cuenta', async () => {
  const token = await login('otro@example.com', 'OtraClave!2030');
  assert.equal((await call('PUT', '/api/auth/me', { dni: '00000000T' }, token)).status, 400);
  assert.equal((await call('PUT', '/api/auth/me', { phone: '600000001' }, token)).status, 400);
  assert.equal((await call('PUT', '/api/auth/me', { name: 'Nombre Nuevo' }, token)).status, 200);
  assert.equal((await call('PUT', '/api/auth/me', { name: 123 }, token)).status, 400);
});

test('no se aceptan fechas pasadas ni horas manipuladas', async () => {
  const token = await login(CLIENT.email, CLIENT.password);
  assert.equal((await call('POST', '/api/bookings', booking('2020-01-01', '2020-01-02'), token)).status, 400);
  assert.equal((await call('POST', '/api/bookings', booking(futureDate(80), futureDate(81), { pickup_time: '<img src=x>' }), token)).status, 400);
  // Mismo día con la devolución antes de la recogida
  assert.equal((await call('POST', '/api/bookings', booking(futureDate(82), futureDate(82), { pickup_time: '19:00', return_time: '09:00' }), token)).status, 400);
});

test('confirm-payment es solo de lectura y no expone pagos inexistentes', async () => {
  assert.equal((await call('POST', '/api/redsys/confirm-payment', { orderId: '000000000000' })).status, 404);
});

test('las opiniones públicas no muestran el código de reserva y no se aceptan códigos inventados', async () => {
  const { data } = await call('GET', '/api/reviews');
  assert.ok(data.every(r => !('booking_code' in r)));
  assert.equal((await call('POST', '/api/reviews', { booking_code: 'RMU-INVENTADO', client_name: 'x', rating: 5, comment: 'x' })).status, 400);
});

test('no se puede registrar un cliente con el correo del administrador', async () => {
  const res = await call('POST', '/api/auth/register', { name: 'X', email: 'info@rentmeuskar.com', phone: '611222333', dni: '00000002W', password: 'ClaveLarga!2030' });
  assert.equal(res.status, 400);
});

test('datos con tipos incorrectos devuelven 400, no 500', async () => {
  for (const url of ['/api/auth/register', '/api/contact', '/api/reviews/verify-code', '/api/auth/verify-registration']) {
    const res = await call('POST', url, { email: ['x'], name: 1, code: 2, contact: 3, message: 4, password: 5 });
    assert.ok(res.status < 500, `${url} devolvió ${res.status}`);
  }
});

test('un POST sin cuerpo devuelve 400, no 500', async () => {
  for (const url of ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/contact']) {
    const res = await call('POST', url);
    assert.ok(res.status >= 400 && res.status < 500, `${url} devolvió ${res.status}`);
  }
});

// Petición de login desde una IP concreta (el servidor confía en X-Forwarded-For del proxy)
async function loginFrom(ip, email, password) {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ email, password })
  });
  return res.status;
}

test('login: los intentos fallidos de otra IP no dejan fuera al administrador', async () => {
  for (let i = 0; i < 10; i++) {
    assert.equal(await loginFrom('203.0.113.10', 'zvaito', 'incorrecta'), 401);
  }
  assert.equal(await loginFrom('203.0.113.99', 'zvaito', ADMIN_PASSWORD), 200);
});

test('login: entrar bien no gasta el límite de intentos y borra los fallos de la cuenta', async () => {
  for (let i = 0; i < 25; i++) {
    assert.equal(await loginFrom('203.0.113.20', CLIENT.email, CLIENT.password), 200);
  }
  for (let i = 0; i < 9; i++) assert.equal(await loginFrom('203.0.113.21', CLIENT.email, 'incorrecta'), 401);
  assert.equal(await loginFrom('203.0.113.21', CLIENT.email, CLIENT.password), 200);
  // Tras un acierto la cuenta empieza de cero: otros 9 fallos no la bloquean
  for (let i = 0; i < 9; i++) assert.equal(await loginFrom('203.0.113.22', CLIENT.email, 'incorrecta'), 401);
});

test('las páginas legales del pie existen y cargan sus estilos y datos', async () => {
  for (const page of ['/condiciones', '/privacidad', '/cookies', '/aviso-legal', '/legal.css', '/legal.js']) {
    const res = await fetch(BASE + page);
    assert.equal(res.status, 200, `${page} devolvió ${res.status}`);
  }
  const home = await (await fetch(BASE + '/')).text();
  assert.ok(!/href="#" id="legal-/.test(home), 'el pie todavía tiene enlaces legales vacíos');
});

// Token de cliente firmado con el secreto de las pruebas (sirve para medir el límite por cuenta sin tocar cuentas reales)
function userTokenFor(id) {
  const payload = Buffer.from(JSON.stringify({ id, email: `limite${id}@example.com`, ts: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `rmu_usr.${payload}.${signature}`;
}

async function meFrom(ip, token) {
  const res = await fetch(BASE + '/api/auth/me', { headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': ip } });
  return res.status;
}

test('límite por cuenta: quien abusa se bloquea aunque cambie de IP, y las demás cuentas siguen bien', async () => {
  const abusive = userTokenFor(9001);
  let blockedAt = 0;
  for (let i = 1; i <= 320 && !blockedAt; i++) {
    // Una IP distinta en cada petición: solo el límite por cuenta puede pararlo
    if ((await meFrom(`198.51.100.${(i % 250) + 1}`, abusive)) === 429) blockedAt = i;
  }
  assert.ok(blockedAt > 0 && blockedAt <= 305, `no se bloqueó la cuenta (bloqueo en ${blockedAt})`);
  assert.notEqual(await meFrom('198.51.100.77', userTokenFor(9002)), 429);
});

test('sesión de cliente: caduca a los 7 días y cerrar sesión la anula en el servidor', async () => {
  const email = 'sesion@example.com';
  const tokenAged = (days) => {
    const payload = Buffer.from(JSON.stringify({ id: 3, email, ts: Date.now() - days * 24 * 60 * 60 * 1000 })).toString('base64url');
    return `rmu_usr.${payload}.${crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')}`;
  };
  // 8 días: caducada; 6 días: todavía vale
  assert.equal(await meFrom('198.51.100.201', tokenAged(8)), 401);
  assert.equal(await meFrom('198.51.100.202', tokenAged(6)), 200);

  // Iniciar sesión, usarla, cerrar sesión: el mismo token ya no sirve
  const first = (await call('POST', '/api/auth/login', { email, password: 'ClaveSesion!2030' })).data.token;
  assert.equal(await meFrom('198.51.100.203', first), 200);
  const out = await fetch(BASE + '/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${first}`, 'X-Forwarded-For': '198.51.100.204' } });
  assert.equal(out.status, 200);
  assert.equal(await meFrom('198.51.100.205', first), 401);
  // También las sesiones anteriores de otros dispositivos
  assert.equal(await meFrom('198.51.100.206', tokenAged(1)), 401);

  // Una sesión nueva después de cerrar sí funciona
  await new Promise(r => setTimeout(r, 5));
  const second = (await call('POST', '/api/auth/login', { email, password: 'ClaveSesion!2030' })).data.token;
  assert.equal(await meFrom('198.51.100.207', second), 200);

  // Cerrar sesión sin sesión válida no falla
  assert.equal((await fetch(BASE + '/api/auth/logout', { method: 'POST' })).status, 200);
});

test('/healthz responde para las herramientas de vigilancia sin datos privados', async () => {
  const res = await fetch(BASE + '/healthz');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(Object.keys(body).sort(), ['db', 'ok']);
});

test('CORS: un origen que no está en la lista blanca se rechaza', async () => {
  const res = await fetch(BASE + '/api/vans', { headers: { Origin: 'https://sitio-malicioso.example' } });
  assert.ok(res.status >= 400, `se aceptó un origen no permitido (${res.status})`);
  assert.ok(!res.headers.get('access-control-allow-origin'), 'se devolvió Access-Control-Allow-Origin a un origen no permitido');
});

test('SEO local: las páginas de zona existen, tienen su título y la ficha de empresa no inventa horarios', async () => {
  for (const [page, titulo] of [['/alquiler-furgonetas-huescar', 'Huéscar'], ['/alquiler-furgonetas-granada', 'provincia de Granada'], ['/alquiler-furgonetas-baza', 'Baza'], ['/alquiler-furgonetas-guadix', 'Guadix']]) {
    const res = await fetch(BASE + page);
    assert.equal(res.status, 200, `${page} devolvió ${res.status}`);
    const html = await res.text();
    assert.ok(html.includes('<title>') && html.includes(titulo), `${page} sin título con "${titulo}"`);
    assert.ok(html.includes(`rel="canonical" href="https://rentmeuskar.com${page}"`), `${page} sin canonical`);
  }
  const home = await (await fetch(BASE + '/')).text();
  assert.ok(home.includes('"@type": "AutoRental"'), 'falta la ficha de empresa');
  assert.ok(!home.includes('"priceRange"'), 'la ficha no debe llevar un rango de precios inventado');
  assert.ok(!/Más de\s*<span id="reviews-count-placeholder"/.test(home), 'el contador de reseñas no debe decir "Más de"');
  const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
  assert.ok(sitemap.includes('/alquiler-furgonetas-baza'), 'el sitemap no lista las páginas de zona');
});

test('condiciones de las furgonetas: se editan desde el panel, se validan y salen en los ajustes públicos', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const card = (extra = {}) => ({ icon: 'road', title: 'Kilómetros', value: '350 km al día', text: 'Incluidos en el precio.', ...extra });

  // Sin sesión de administrador no se pueden cambiar
  assert.equal((await call('PUT', '/api/settings', { conditions: [card()] })).status, 401);

  // Con sesión se guardan; un icono que no está en la lista se sustituye por uno seguro
  const ok = await call('PUT', '/api/settings', { conditions: [card(), card({ icon: 'icono-raro', title: 'Fianza', value: '{fianza} €' })] }, admin);
  assert.equal(ok.status, 200);
  const list = JSON.parse((await call('GET', '/api/settings')).data.conditions_json);
  assert.equal(list.length, 2);
  assert.equal(list[0].title, 'Kilómetros');
  assert.equal(list[1].icon, 'circle-check');

  // Datos no válidos: 400 y no se cambia nada
  const invalid = [[], 'texto', [card({ title: '' })], [card({ title: 'a'.repeat(41) })], [card({ value: 'v'.repeat(41) })],
    [card({ text: 't'.repeat(301) })], [card({ title: 5 })], [null], Array(13).fill(card())];
  for (const bad of invalid) {
    assert.equal((await call('PUT', '/api/settings', { conditions: bad }, admin)).status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(JSON.parse((await call('GET', '/api/settings')).data.conditions_json).length, 2);
});

test('las rutas de API inexistentes responden 404 en JSON', async () => {
  const res = await call('GET', '/api/no-existe');
  assert.equal(res.status, 404);
  assert.ok(res.data && res.data.error);
});

test('una petición demasiado grande devuelve 413, no 500', async () => {
  const res = await call('POST', '/api/contact', { name: 'x', contact: 'x', message: 'a'.repeat(200 * 1024) });
  assert.equal(res.status, 413);
});

test('ajustes: se normalizan teléfono y fianza y se rechazan valores no válidos', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const ok = await call('PUT', '/api/settings', { contact_phone: '614 767 411', fianza_amount: '450' }, admin);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.settings.contact_phone, '34614767411');
  assert.equal(ok.data.settings.fianza_amount, '450,00');
  assert.equal((await call('PUT', '/api/settings', { fianza_amount: 'abc' }, admin)).status, 400);
  assert.equal((await call('PUT', '/api/settings', { contact_phone: '123' }, admin)).status, 400);
  assert.equal((await call('PUT', '/api/settings', { contact_email: 'no-es-correo' }, admin)).status, 400);
  assert.equal((await call('PUT', '/api/settings', { hours_weekdays: 5 }, admin)).status, 400);
  await call('PUT', '/api/settings', { fianza_amount: '500,00' }, admin);
});

function redsysSign(order, params) {
  const cipher = crypto.createCipheriv('des-ede3-cbc', Buffer.from(REDSYS_TEST_KEY, 'base64'), Buffer.alloc(8, 0));
  cipher.setAutoPadding(false);
  const buf = Buffer.from(order); const padded = Buffer.alloc(Math.ceil(buf.length / 8) * 8, 0); buf.copy(padded);
  const key = Buffer.concat([cipher.update(padded), cipher.final()]);
  return crypto.createHmac('sha256', key).update(params).digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

test('un pago que llega tarde se registra aunque las fechas ya estén ocupadas, y no se puede cancelar después', async () => {
  const order = '261099999999';
  const params = Buffer.from(JSON.stringify({ Ds_Order: order, Ds_Response: '0000', Ds_Amount: '10000', Ds_MerchantCode: REDSYS_MERCHANT })).toString('base64');
  const res = await fetch(BASE + '/api/redsys/notification', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ Ds_SignatureVersion: 'HMAC_SHA256_V1', Ds_MerchantParameters: params, Ds_Signature: redsysSign(order, params) })
  });
  assert.equal(res.status, 200);
  await call('POST', '/api/redsys/cancel-payment', { orderId: order });
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const booking = await call('GET', '/api/bookings/50', null, admin);
  assert.equal(booking.data.payment_status, 'paid');
  // Firma incorrecta: se rechaza
  const bad = await fetch(BASE + '/api/redsys/notification', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ Ds_SignatureVersion: 'HMAC_SHA256_V1', Ds_MerchantParameters: params, Ds_Signature: 'x' + redsysSign(order, params) })
  });
  assert.equal(bad.status, 400);
});

test('cambio de credenciales de admin con tipos incorrectos devuelve 400', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  assert.equal((await call('POST', '/api/admin/request-credential-change-code', { new_username: 123, new_password: ['x'] }, admin)).status, 400);
});

test('fotos de inspección: se guardan sin BD y no quedan archivos huérfanos si la reserva no existe', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const upload = (id) => {
    const form = new FormData();
    form.append('type', 'before');
    form.append('photos', new Blob([Buffer.from('89504e47', 'hex')], { type: 'image/png' }), 'foto.png');
    return fetch(`${BASE}/api/bookings/${id}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${admin}` }, body: form });
  };
  const uploadsDir = path.join(tmpDir, 'uploads');
  const ok = await upload(50);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).booking.photos_before.length, 1);
  const before = fs.readdirSync(uploadsDir).length;
  assert.equal((await upload(9999)).status, 404);
  await new Promise(r => setTimeout(r, 200));
  assert.equal(fs.readdirSync(uploadsDir).length, before);
  // Furgoneta con precio no válido: se rechaza y su imagen no se queda en disco
  const form = new FormData();
  form.append('van_type', 'nueva'); form.append('name', 'Nueva'); form.append('price_sin', '-5');
  form.append('images', new Blob([Buffer.from('89504e47', 'hex')], { type: 'image/png' }), 'van.png');
  const van = await fetch(`${BASE}/api/vans`, { method: 'POST', headers: { Authorization: `Bearer ${admin}` }, body: form });
  assert.equal(van.status, 400);
  await new Promise(r => setTimeout(r, 200));
  assert.equal(fs.readdirSync(uploadsDir).length, before);
});

test('con conductor: km y horas de espera se validan y se guardan como números', async () => {
  const token = await login('otro@example.com', 'OtraClave!2030');
  assert.equal((await call('POST', '/api/bookings', booking(futureDate(130), futureDate(130), { pickup_time: '09:00', return_time: '12:00', rental_mode: 'con', estimated_kms: 'abc', waiting_hours: 1e9 }), token)).status, 400);
  assert.equal((await call('POST', '/api/bookings', booking(futureDate(130), futureDate(130), { rental_mode: 'otro' }), token)).status, 400);
  const ok = await call('POST', '/api/bookings', booking(futureDate(131), futureDate(131), { pickup_time: '09:00', return_time: '12:00', rental_mode: 'con', estimated_kms: '50', waiting_hours: '1.5' }), token);
  assert.equal(ok.status, 201);
  assert.equal(ok.data.booking.estimated_kms, 50);
  assert.equal(ok.data.booking.waiting_hours, 1.5);
});

test('la reserva guarda el contacto de la cuenta, no uno enviado en la petición', async () => {
  const token = await login(CLIENT.email, CLIENT.password);
  const res = await call('POST', '/api/redsys/process-test-payment', {
    payMethod: 'card', cardDetails: { cardNumber: '4548810000000003' },
    bookingData: booking(futureDate(140), futureDate(141), { client_email: 'tercero@example.com', client_phone: 12345, client_dni: 'x'.repeat(500) })
  }, token);
  assert.equal(res.status, 201);
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const saved = (await call('GET', `/api/bookings/${res.data.booking.id}`, null, admin)).data;
assert.equal(saved.client_email, CLIENT.email);
  assert.equal(saved.client_dni, '00000000T');
});

test('opiniones demasiado largas se rechazan antes de llegar a la BD', async () => {
  const res = await call('POST', '/api/reviews', { booking_code: 'RMU-X', client_name: '&'.repeat(90), rating: 5, comment: 'ok' });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /demasiado larga/);
});

test('datos del contrato que no caben en la columna se rechazan con un mensaje claro', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const long = await call('PUT', '/api/bookings/50', { client_postal_code: '1'.repeat(60) }, admin);
  assert.equal(long.status, 400);
  assert.match(long.data.error, /Código postal/);
  assert.equal((await call('PUT', '/api/bookings/50', { km_out: 1e12 }, admin)).status, 400);
  assert.equal((await call('PUT', '/api/bookings/50', { client_postal_code: '18830' }, admin)).status, 200);
});

test('bloqueos con datos que la BD no acepta se rechazan', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const base = { van_type: 'medium', start_date: futureDate(150), end_date: futureDate(151), reason: 'Taller' };
  assert.equal((await call('POST', '/api/blockages', { ...base, start_date: '2026-13-45' }, admin)).status, 400);
  assert.equal((await call('POST', '/api/blockages', { ...base, reason: 'x'.repeat(300) }, admin)).status, 400);
  assert.equal((await call('POST', '/api/blockages', { ...base, van_type: 'no-existe' }, admin)).status, 400);
  assert.equal((await call('POST', '/api/blockages', base, admin)).status, 201);
});

test('furgonetas con identificador o textos no válidos se rechazan', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const van = { van_type: 'nueva-1', name: 'Nueva', plate: '1111 AAA', m3: '8m³', price_sin: 80, min_price_con: 50, km_price_con: 1 };
  assert.equal((await call('POST', '/api/vans', { ...van, van_type: 'a"><img src=x>' }, admin)).status, 400);
  assert.equal((await call('POST', '/api/vans', { ...van, name: 'x'.repeat(300) }, admin)).status, 400);
  assert.equal((await call('POST', '/api/vans', { ...van, max_mass: 1e12 }, admin)).status, 400);
  assert.equal((await call('PUT', '/api/vans/1', { plate: 'x'.repeat(60) }, admin)).status, 400);
  assert.equal((await call('POST', '/api/vans', van, admin)).status, 201);
});

test('FAQ con tipos u orden no válidos se rechazan', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  assert.equal((await call('POST', '/api/faqs', { question: ['x'], answer: 'y' }, admin)).status, 400);
  assert.equal((await call('POST', '/api/faqs', { question: 'x', answer: 'y', display_order: 1e12 }, admin)).status, 400);
  assert.equal((await call('POST', '/api/faqs', { question: '¿Prueba?', answer: 'Sí', display_order: 9 }, admin)).status, 201);
});

test('no se reactiva una reserva cancelada si sus fechas ya están ocupadas', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  assert.equal((await call('POST', '/api/blockages', { van_type: 'medium', start_date: futureDate(160), end_date: futureDate(160), reason: 'ITV' }, admin)).status, 201);
  // Bloqueo encima de una reserva activa: se guarda, pero avisa de cuál
  const overlap = await call('POST', '/api/blockages', { van_type: 'medium', start_date: futureDate(30), end_date: futureDate(31), reason: 'Avería' }, admin);
  assert.equal(overlap.status, 201);
  assert.match(overlap.data.warning || '', /#\d+/);
  assert.equal((await call('PUT', '/api/bookings/52', { status: 'confirmed' }, admin)).status, 409);
  assert.equal((await call('PUT', '/api/bookings/52', { client_city: 'Huéscar' }, admin)).status, 200);
});

test('si el correo no sale, registro y recuperación lo dicen en vez de dar el envío por hecho', async () => {
  const reg = await call('POST', '/api/auth/register', { name: 'Sin Correo', email: 'sincorreo@example.com', phone: '611999888', dni: '12345678Z', password: 'ClaveLarga!2030' });
  assert.equal(reg.status, 503);
  assert.equal((await call('POST', '/api/auth/forgot-password', { email: 'otro@example.com' })).status, 503);
  // Correo sin cuenta: misma respuesta de éxito, pero no se envía nada
  assert.equal((await call('POST', '/api/auth/forgot-password', { email: 'sincorreo@example.com' })).status, 200);
});

test('editar solo el precio de una furgoneta no borra sus extras ni imágenes', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const res = await call('PUT', '/api/vans/1', { price_sin: 120 }, admin);
  assert.equal(res.status, 200);
  assert.equal(res.data.van.custom_extras.length, 1);
  assert.equal((await call('PUT', '/api/vans/1', { custom_extras: '{mal' }, admin)).status, 400);
  await call('PUT', '/api/vans/1', { price_sin: 100 }, admin);
});

test('ids no numéricos o enormes devuelven 404, no 500', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  for (const url of ['/api/bookings/abc', '/api/faqs/99999999999', '/api/blockages/1e5']) {
    assert.equal((await call('DELETE', url, null, admin)).status, 404, url);
  }
});

test('un token con id de otra cuenta no da acceso a esa cuenta', async () => {
  const payload = Buffer.from(JSON.stringify({ id: 1, email: 'otro@example.com', ts: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const me = await call('GET', '/api/auth/me', null, `rmu_usr.${payload}.${sig}`);
  assert.equal(me.status, 200);
  assert.equal(me.data.email, 'otro@example.com');
  assert.equal(me.data.id, 2);
});

test('el calendario de disponibilidad responde (no lo tapa la ruta /api/bookings/:id)', async () => {
  const res = await call('GET', '/api/bookings/unavailable-dates?van_type=medium');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.data));
});

test('un segundo intento de pago suelta el anterior sin pagar en vez de bloquear al cliente', async () => {
  const token = await login('otro@example.com', 'OtraClave!2030');
  const first = await call('POST', '/api/redsys/create-payment', { bookingData: booking(futureDate(170), futureDate(171)) }, token);
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const second = await call('POST', '/api/redsys/create-payment', { bookingData: booking(futureDate(170), futureDate(171)) }, token);
  assert.equal(second.status, 200, JSON.stringify(second.data));
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const mine = (await call('GET', '/api/bookings', null, admin)).data.filter(b => b.user_id === 2 && b.status === 'pending_payment');
  assert.equal(mine.length, 1);
});

test('el vehículo de la opinión sale del código, no del navegador', async () => {
  const admin = await login('zvaito', ADMIN_PASSWORD);
  const gen = await call('POST', '/api/admin/generate-review-code', { van_name: 'Furgoneta Test', rental_days: 1, rental_mode: 'sin' }, admin);
  const res = await call('POST', '/api/reviews', { booking_code: gen.data.codeObj.code, client_name: 'Ana', rating: 5, comment: 'Bien', van_name: 'Texto inventado' });
  assert.equal(res.status, 201);
  assert.equal(res.data.review.van_name, 'Furgoneta Test • 1 día (Sin Conductor)');
});

test('no se pueden probar códigos de reserva sin límite', async () => {
  let last;
  for (let i = 0; i < 65; i++) last = await call('GET', `/api/bookings/50?auth=RMU-${String(i).padStart(6, '0')}`);
  assert.equal(last.status, 429);
});
