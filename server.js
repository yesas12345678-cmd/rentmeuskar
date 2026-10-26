require('dotenv').config();
const express = require('express');
const { Pool, types } = require('pg');

// Las columnas DATE se leen como texto 'AAAA-MM-DD': convertirlas a Date (medianoche local)
// y luego a UTC desplazaba las fechas un día en servidores con zona horaria española
types.setTypeParser(1082, value => value);
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Manejadores globales de resiliencia del proceso contra caídas inesperadas
process.on('uncaughtException', (err) => {
  console.error('[SERVER RESILIENCE - UNCAUGHT EXCEPTION PREVENTED]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER RESILIENCE - UNHANDLED REJECTION PREVENTED]', reason);
});

// Configuración de transporte SMTP para envío de emails de confirmación
let mailTransporter = null;
const smtpHost = process.env.SMTP_HOST || 'smtp.zoho.eu';
const smtpPort = parseInt(process.env.SMTP_PORT || '465');
const smtpSecure = process.env.SMTP_SECURE ? (process.env.SMTP_SECURE === 'true') : true;
const smtpUser = process.env.SMTP_USER || 'confirmacion@rentmeuskar.com';
const smtpPass = process.env.SMTP_PASS || '';
if (!smtpPass) {
  console.warn('[SMTP] Falta SMTP_PASS en el entorno: el envío de correos fallará hasta configurarlo.');
}

mailTransporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: smtpUser,
    pass: smtpPass
  }
});
console.log(`[SMTP] Transporte de correo Zoho Mail activado para ${smtpUser}`);

mailTransporter.verify((error, success) => {
  if (error) {
    console.error('[SMTP ERROR] Error de autenticación/conexión con Zoho Mail SMTP:', error.message);
  } else {
    console.log('[SMTP SUCCESS] Conexión SMTP verificada correctamente con Zoho Mail (confirmacion@rentmeuskar.com)');
  }
});

// Asegurar que existe la carpeta de subidas (uploads) y datos (data)
// UPLOADS_DIR / DATA_DIR permiten usar otras carpetas (p. ej. en los tests); por defecto, las del proyecto
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const adminStorePath = path.join(dataDir, 'admin_store.json');
const adminInitFlagPath = path.join(dataDir, 'admin_initialized.flag');
const vansInitFlagPath = path.join(dataDir, 'vans_initialized.flag');

// Datasets globales en memoria
let fallbackUsers = [];
// Sin reservas ni opiniones de ejemplo: publicar testimonios inventados no está permitido
let fallbackBookings = [];
let fallbackBlockages = [];
let fallbackSettings = {
  hours_weekdays: '08:00 - 14:00, 16:00 - 20:00',
  hours_saturdays: '09:00 - 13:30',
  hours_sundays: 'Cerrado (Devoluciones pactadas)',
  contact_phone: '34614767411',
  contact_email: 'info@rentmeuskar.com',
  fianza_amount: '500,00',
  show_reviews_count: 'true'
};
let fallbackVans = [
  {
    id: 1,
    van_type: 'medium',
    name: 'Ford Transit Custom L2H2 (8m³)',
    plate: '3681 MCC',
    m3: '8m³',
    price_sin: 79.00,
    min_price_con: 50.00,
    km_price_con: 1.00,
    status: 'active',
    extra_gps_price: 5.00,
    extra_driver_price: 10.00,
    extra_moving_price: 10.00,
    images: ['assets/ford_transit_custom.png'],
    custom_extras: [
      { name: 'GPS Navegador', price: 5.00, type: 'daily' },
      { name: 'Segundo Conductor', price: 8.00, type: 'daily' },
      { name: 'Kit Mudanza', price: 10.00, type: 'once' }
    ],
    max_occupants: 3,
    eco_label: 'C',
    daily_km_limit: 350,
    max_mass: 2800,
    fuel_type: 'GASOIL',
    waiting_hour_price: 30.00,
    custom_features: []
  },
  {
    id: 2,
    van_type: 'large',
    name: 'MAN TGE L4H3 Gran Volumen (14m³)',
    plate: '3758 MDW',
    m3: '14m³',
    price_sin: 107.44,
    min_price_con: 60.00,
    km_price_con: 1.40,
    status: 'active',
    extra_gps_price: 5.00,
    extra_driver_price: 10.00,
    extra_moving_price: 10.00,
    images: ['assets/man_tge.png'],
    custom_extras: [
      { name: 'GPS Navegador', price: 5.00, type: 'daily' },
      { name: 'Segundo Conductor', price: 8.00, type: 'daily' },
      { name: 'Kit Mudanza', price: 10.00, type: 'once' }
    ],
    max_occupants: 3,
    eco_label: 'C',
    daily_km_limit: 350,
    max_mass: 2800,
    fuel_type: 'GASOIL',
    waiting_hour_price: 30.00,
    custom_features: []
  }
];
let fallbackReviews = [];
let manualReviewCodes = [];
let fallbackFaqs = [
  { id: 1, question: '¿Qué requisitos necesito cumplir para alquilar sin conductor?', answer: 'Necesitas tener al menos 23 años (21 para furgonetas compactas) y estar en posesión del permiso de conducir tipo B vigente con una antigüedad mínima de 2 años. Deberás presentar el DNI/NIE y el carnet de conducir originales al retirar el vehículo.', display_order: 1 },
  { id: 2, question: '¿Hay que dejar alguna fianza o depósito?', answer: 'Sí, se requiere una fianza de 500€ que se deposita en persona al recoger el vehículo (mediante tarjeta o efectivo). Esta fianza se reembolsará íntegramente tras revisar que el vehículo se devuelve en las mismas condiciones, limpio y sin daños.', display_order: 2 },
  { id: 3, question: '¿Cómo funciona la política de combustible?', answer: 'Nuestra política es Lleno-Lleno (Full-to-Full). Te entregamos la furgoneta con el depósito de combustible lleno (diésel) y debes devolverla de la misma forma. De lo contrario, se cobrará el coste del combustible faltante más un cargo de gestión de repostaje.', display_order: 3 },
  { id: 4, question: '¿Qué seguro está incluido en el precio base?', answer: 'El precio incluye seguro obligatorio de responsabilidad civil y seguro de colisión básico con franquicia. Esto significa que en caso de accidente o daños, la responsabilidad máxima del cliente está limitada al importe de la franquicia establecida (salvo negligencia).', display_order: 4 },
  { id: 5, question: '¿Puedo viajar fuera de España con la furgoneta?', answer: 'Por defecto, el uso de las furgonetas está autorizada en territorio nacional (Península Ibérica). Si tienes pensado viajar a Portugal, Francia u otros países de Europa, debes comunicarlo con antelación para tramitar la cobertura del seguro correspondiente y asistencia en el extranjero.', display_order: 5 }
];

// Registro en memoria de solicitudes de cambio de credenciales de administrador
const pendingAdminCredentialChanges = {};

function saveAdminStoreToFile() {
  try {
    const store = {
      fallbackUsers,
      fallbackBookings,
      fallbackBlockages,
      fallbackSettings,
      fallbackVans,
      fallbackReviews,
      manualReviewCodes,
      fallbackFaqs
    };
    // Escritura atómica: se escribe un temporal y se renombra, así un corte a mitad no deja el JSON roto
    const tmpPath = adminStorePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmpPath, adminStorePath);
    console.log('[PERSISTENCE] Todos los datos del panel de administración guardados en disco (admin_store.json)');
  } catch (e) {
    console.error('[PERSISTENCE ERROR] Error al guardar admin_store:', e.message);
  }
}

function loadAdminStoreFromFile() {
  if (fs.existsSync(adminStorePath)) {
    try {
      const data = fs.readFileSync(adminStorePath, 'utf8');
      const store = JSON.parse(data);
      if (Array.isArray(store.fallbackUsers)) fallbackUsers = store.fallbackUsers;
      if (Array.isArray(store.fallbackBookings)) fallbackBookings = store.fallbackBookings;
      if (Array.isArray(store.fallbackBlockages)) fallbackBlockages = store.fallbackBlockages;
      if (store.fallbackSettings) fallbackSettings = { ...fallbackSettings, ...store.fallbackSettings };
      if (Array.isArray(store.fallbackVans) && store.fallbackVans.length > 0) {
        fallbackVans = store.fallbackVans;
      }
      if (Array.isArray(store.fallbackReviews)) fallbackReviews = store.fallbackReviews;
      if (Array.isArray(store.manualReviewCodes)) manualReviewCodes = store.manualReviewCodes;
      if (Array.isArray(store.fallbackFaqs)) {
        const seenFaqQ = new Set();
        fallbackFaqs = store.fallbackFaqs.filter(f => {
          const q = (f.question || '').trim().toLowerCase();
          if (!q || seenFaqQ.has(q)) return false;
          seenFaqQ.add(q);
          return true;
        });
      }
      console.log(`[PERSISTENCE] Carga completa desde disco (admin_store.json): ${fallbackVans.length} vans, ${fallbackBookings.length} reservas, ${fallbackFaqs.length} FAQs, ${fallbackReviews.length} reseñas.`);
    } catch (e) {
      console.error('[PERSISTENCE ERROR] Error al cargar admin_store:', e.message);
      // Se aparta el archivo dañado para que el siguiente guardado no lo sobrescriba con datos vacíos
      try {
        const corruptPath = adminStorePath + '.corrupt-' + Date.now();
        fs.renameSync(adminStorePath, corruptPath);
        console.error('[PERSISTENCE ERROR] Copia del archivo dañado guardada en ' + corruptPath);
      } catch (renameErr) {
        console.error('[PERSISTENCE ERROR] No se pudo apartar el archivo dañado:', renameErr.message);
      }
    }
  }
}

loadAdminStoreFromFile();

async function syncDatabaseWithDisk(clientOrPool) {
  const targetPool = clientOrPool || pool;
  try {
    // 1. Furgonetas (SAFE 2-WAY MERGE)
    try {
      if (Array.isArray(fallbackVans) && fallbackVans.length > 0) {
        for (const van of fallbackVans) {
          await targetPool.query(
            `INSERT INTO vans (van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status, images, custom_extras, max_occupants, eco_label, daily_km_limit, max_mass, fuel_type, waiting_hour_price, custom_features)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             ON CONFLICT (van_type) DO UPDATE SET
               name = EXCLUDED.name, plate = EXCLUDED.plate, m3 = EXCLUDED.m3, price_sin = EXCLUDED.price_sin,
               min_price_con = EXCLUDED.min_price_con, km_price_con = EXCLUDED.km_price_con, status = EXCLUDED.status,
               images = EXCLUDED.images, custom_extras = EXCLUDED.custom_extras, max_occupants = EXCLUDED.max_occupants,
               eco_label = EXCLUDED.eco_label, daily_km_limit = EXCLUDED.daily_km_limit, max_mass = EXCLUDED.max_mass,
               fuel_type = EXCLUDED.fuel_type, waiting_hour_price = EXCLUDED.waiting_hour_price, custom_features = EXCLUDED.custom_features`,
            [
              van.van_type, van.name, van.plate, van.m3, van.price_sin, van.min_price_con, van.km_price_con,
              van.status || 'active', van.images || [], JSON.stringify(van.custom_extras || []),
              van.max_occupants || 3, van.eco_label || 'C', van.daily_km_limit || 350, van.max_mass || 2800,
              van.fuel_type || 'GASOIL', van.waiting_hour_price || 30.00, JSON.stringify(van.custom_features || [])
            ]
          ).catch(e => console.warn('Error syncing van to DB:', e.message));
        }
      }
      const vansRes = await targetPool.query("SELECT * FROM vans ORDER BY id ASC");
      if (vansRes.rows.length > 0) {
        vansRes.rows.forEach(dbV => {
          const idx = fallbackVans.findIndex(v => String(v.id) === String(dbV.id) || v.van_type === dbV.van_type);
          if (idx !== -1) {
            fallbackVans[idx] = { ...fallbackVans[idx], ...dbV };
          } else {
            fallbackVans.push(dbV);
          }
        });
      }
    } catch (e) {
      console.warn('[SYNC WARN] Error al sincronizar furgonetas:', e.message);
    }

    // 2. Bloqueos de Disponibilidad (SAFE 2-WAY MERGE)
    try {
      if (Array.isArray(fallbackBlockages) && fallbackBlockages.length > 0) {
        for (const block of fallbackBlockages) {
          // Solo si no existe ya el mismo bloqueo: antes se duplicaban en cada reconexión
          await targetPool.query(
            `INSERT INTO van_blockages (van_type, start_date, end_date, reason)
             SELECT $1, $2, $3, $4
             WHERE NOT EXISTS (
               SELECT 1 FROM van_blockages WHERE van_type = $1 AND start_date = $2::date AND end_date = $3::date
             )`,
            [block.van_type, block.start_date, block.end_date, block.reason || 'Bloqueo Manual']
          ).catch(e => console.warn('Error syncing blockage to DB:', e.message));
        }
      }
      const blockRes = await targetPool.query("SELECT * FROM van_blockages ORDER BY id ASC");
      if (blockRes.rows.length > 0) {
        const dbBlocks = blockRes.rows.map(b => ({
          ...b,
          start_date: formatDateISO(b.start_date),
          end_date: formatDateISO(b.end_date)
        }));
        dbBlocks.forEach(dbB => {
          const idx = fallbackBlockages.findIndex(b => String(b.id) === String(dbB.id));
          if (idx !== -1) {
            fallbackBlockages[idx] = { ...fallbackBlockages[idx], ...dbB };
          } else {
            fallbackBlockages.push(dbB);
          }
        });
      }
    } catch (e) {
      console.warn('[SYNC WARN] Error al sincronizar bloqueos:', e.message);
    }

    // 3. FAQs (SAFE 2-WAY MERGE CON DEDUPLICACIÓN ESTRICTA)
    try {
      if (Array.isArray(fallbackFaqs) && fallbackFaqs.length > 0) {
        for (const faq of fallbackFaqs) {
          if (!faq.question) continue;
          await targetPool.query(
            `INSERT INTO faqs (question, answer, display_order)
             SELECT $1, $2, $3
             WHERE NOT EXISTS (
               SELECT 1 FROM faqs WHERE LOWER(TRIM(question)) = LOWER(TRIM($1))
             )`,
            [faq.question, faq.answer, faq.display_order || 0]
          ).catch(e => console.warn('Error syncing faq to DB:', e.message));
        }
      }
      const faqsRes = await targetPool.query("SELECT * FROM faqs ORDER BY display_order ASC, id ASC");
      if (faqsRes.rows.length > 0) {
        const seenFaqSet = new Set();
        const cleanDbFaqs = [];
        faqsRes.rows.forEach(dbFaq => {
          const q = (dbFaq.question || '').trim().toLowerCase();
          if (!seenFaqSet.has(q)) {
            seenFaqSet.add(q);
            cleanDbFaqs.push(dbFaq);
          }
        });
        fallbackFaqs = cleanDbFaqs;
      }
    } catch (e) {
      console.warn('[SYNC WARN] Error al sincronizar FAQs:', e.message);
    }

    // 4. Configuraciones (SAFE 2-WAY MERGE)
    try {
      for (const [key, value] of Object.entries(fallbackSettings)) {
        await targetPool.query(
          "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
          [key, String(value)]
        ).catch(e => console.warn('Error syncing setting to DB:', e.message));
      }
      const settingsRes = await targetPool.query("SELECT * FROM settings");
      if (settingsRes.rows.length > 0) {
        settingsRes.rows.forEach(row => {
          fallbackSettings[row.key] = row.value;
        });
      }
    } catch (e) {
      console.warn('[SYNC WARN] Error al sincronizar settings:', e.message);
    }

    // 5. Reservas (SAFE 2-WAY MERGE - PRESERVE DISK BOOKINGS)
    try {
      if (Array.isArray(fallbackBookings) && fallbackBookings.length > 0) {
        for (const b of fallbackBookings) {
          // Solo reservas identificables (código o pedido) que aún no estén en la BD, con todos sus datos;
          // antes las que no tenían código se duplicaban en cada reconexión y perdían pago y contacto
          if (!b.review_code && !b.payment_id) continue;
          await targetPool.query(
            `INSERT INTO bookings (name, van_type, van_name, pickup_date, pickup_time, return_date, return_time, days, extras, total_price, status, rental_mode, estimated_kms, waiting_hours, van_plate, van_m3, review_code,
                                   payment_id, payment_status, payment_method, fianza_status, client_email, client_phone, client_dni)
             SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
             WHERE NOT EXISTS (
               SELECT 1 FROM bookings WHERE ($17::text IS NOT NULL AND review_code = $17) OR ($18::text IS NOT NULL AND payment_id = $18)
             )
             ON CONFLICT DO NOTHING`,
            [
              b.client_name || b.name || 'Cliente', b.van_type || 'medium', b.van_name || 'Ford Transit',
              b.pickup_date || '2026-01-01', b.pickup_time || '09:00', b.return_date || '2026-01-02', b.return_time || '19:00',
              parseInt(b.days) || 1, JSON.stringify(b.extras || []), parseFloat(b.total_price) || 0,
              b.status || 'pending', b.rental_mode || 'sin', parseInt(b.estimated_kms) || 0,
              parseFloat(b.waiting_hours) || 0, b.van_plate || '', b.van_m3 || '', b.review_code || null,
              b.payment_id || null, b.payment_status || 'pending', b.payment_method || null, b.fianza_status || 'pending',
              b.client_email || null, b.client_phone || null, b.client_dni || null
            ]
          ).catch(e => console.warn('Error syncing booking to DB:', e.message));
        }
      }
      const bookingsRes = await targetPool.query("SELECT * FROM bookings ORDER BY id DESC");
      if (bookingsRes.rows.length > 0) {
        bookingsRes.rows.forEach(dbB => {
          const idx = fallbackBookings.findIndex(b => String(b.id) === String(dbB.id));
          if (idx !== -1) {
            fallbackBookings[idx] = { ...fallbackBookings[idx], ...dbB };
          } else {
            fallbackBookings.push(dbB);
          }
        });
      }
    } catch (e) {
      console.warn('[SYNC WARN] Error al sincronizar reservas:', e.message);
    }

    // 6. Reseñas (SAFE 2-WAY MERGE)
    try {
      if (Array.isArray(fallbackReviews) && fallbackReviews.length > 0) {
        for (const rev of fallbackReviews) {
          await targetPool.query(
            `INSERT INTO reviews (booking_code, client_name, rating, comment, role_or_city)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (booking_code) DO NOTHING`,
            [rev.booking_code, rev.client_name, rev.rating || 5, rev.comment || '', rev.role_or_city || '']
          ).catch(e => console.warn('Error syncing review to DB:', e.message));
        }
      }
      const reviewsRes = await targetPool.query("SELECT * FROM reviews ORDER BY id DESC");
      if (reviewsRes.rows.length > 0) {
        reviewsRes.rows.forEach(dbR => {
          const idx = fallbackReviews.findIndex(r => String(r.id) === String(dbR.id));
          if (idx !== -1) {
            fallbackReviews[idx] = { ...fallbackReviews[idx], ...dbR };
          } else {
            fallbackReviews.push(dbR);
          }
        });
      }
    } catch (e) {
      console.warn('[SYNC WARN] Error al sincronizar reseñas:', e.message);
    }

    // 7. Usuarios registrados (SAFE 2-WAY MERGE)
    try {
      if (Array.isArray(fallbackUsers) && fallbackUsers.length > 0) {
        for (const u of fallbackUsers) {
          await targetPool.query(
            `INSERT INTO users (name, email, password, phone, dni)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (email) DO NOTHING`,
            [u.name, u.email, u.password, u.phone || '', u.dni || '']
          ).catch(e => console.warn('Error syncing user to DB:', e.message));
        }
      }
      const usersRes = await targetPool.query("SELECT * FROM users ORDER BY id ASC");
      if (usersRes.rows.length > 0) {
        usersRes.rows.forEach(dbUser => {
          const idx = fallbackUsers.findIndex(u => u.email.toLowerCase() === dbUser.email.toLowerCase());
          if (idx !== -1) {
            fallbackUsers[idx] = { ...fallbackUsers[idx], ...dbUser };
          } else {
            fallbackUsers.push(dbUser);
          }
        });
      }
    } catch (e) {
      console.warn('[SYNC WARN] Error al sincronizar usuarios:', e.message);
    }

    // 8. Reajustar secuencias de ID de PostgreSQL
    await targetPool.query(`
      SELECT setval('vans_id_seq', COALESCE((SELECT MAX(id) FROM vans), 1), true);
      SELECT setval('bookings_id_seq', COALESCE((SELECT MAX(id) FROM bookings), 1), true);
      SELECT setval('van_blockages_id_seq', COALESCE((SELECT MAX(id) FROM van_blockages), 1), true);
      SELECT setval('faqs_id_seq', COALESCE((SELECT MAX(id) FROM faqs), 1), true);
      SELECT setval('reviews_id_seq', COALESCE((SELECT MAX(id) FROM reviews), 1), true);
      SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true);
    `).catch(e => console.warn('[SYNC SEQ WARN] Error al reajustar secuencias PostgreSQL:', e.message));

    saveAdminStoreToFile();
    console.log(`[PERSISTENCE SAFE SYNC] Sincronización bidireccional completa: ${fallbackVans.length} furgonetas, ${fallbackBookings.length} reservas, ${fallbackFaqs.length} FAQs, ${fallbackBlockages.length} bloqueos, ${fallbackUsers.length} usuarios.`);
  } catch (err) {
    console.warn('[PERSISTENCE SYNC WARN] Error al sincronizar PostgreSQL:', err.message);
  }
}

// Configuración de Multer para la subida de fotos e imágenes
const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const cleanExt = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + '-' + uniqueSuffix + cleanExt);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  if (allowedExts.includes(ext) && allowedMimes.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se admiten imágenes JPG, PNG, WEBP o AVIF.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Máximo 10MB por archivo
  fileFilter
});

// Password hashing function (SHA256)
// Contraseñas nuevas: scrypt con sal ('scrypt$sal$hash'). Las antiguas (SHA-256 sin sal)
// se siguen aceptando y se migran a scrypt en el siguiente inicio de sesión correcto.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function legacySha256(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function verifyPassword(password, stored) {
  if (!password || !stored || typeof stored !== 'string') return false;
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;
    const candidate = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  }
  if (/^[a-f0-9]{64}$/.test(stored)) {
    const candidate = Buffer.from(legacySha256(password));
    const expected = Buffer.from(stored);
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  }
  return false;
}

function needsPasswordRehash(stored) {
  return typeof stored === 'string' && !stored.startsWith('scrypt$');
}

// Códigos de 6 cifras enviados por correo (registro, recuperación, cambio de credenciales)
const MAX_CODE_ATTEMPTS = 5;

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

// Devuelve 'ok', 'expired', 'locked' o 'invalid'; cada fallo consume un intento
function checkPendingCode(pending, inputCode) {
  if (!pending) return 'invalid';
  if (pending.expires && pending.expires < Date.now()) return 'expired';
  if ((pending.attempts || 0) >= MAX_CODE_ATTEMPTS) return 'locked';
  if (!safeEqual(String(pending.code), String(inputCode || '').trim())) {
    pending.attempts = (pending.attempts || 0) + 1;
    return pending.attempts >= MAX_CODE_ATTEMPTS ? 'locked' : 'invalid';
  }
  return 'ok';
}

const CODE_ERRORS = {
  expired: 'El código de verificación ha caducado. Solicita uno nuevo.',
  locked: 'Demasiados intentos fallidos. Solicita un código nuevo.',
  invalid: 'El código de verificación introducido no es correcto.'
};

// Token secreto para firma criptográfica de sesiones de usuario
// Sin SESSION_SECRET se genera uno aleatorio por arranque (las sesiones se cierran al reiniciar)
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[AUTH] Falta SESSION_SECRET en el entorno: se usa uno temporal y las sesiones caducarán al reiniciar.');
}

const USER_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function generateUserToken(userId, email) {
  const payload = Buffer.from(JSON.stringify({ id: userId, email: email || '', ts: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `rmu_usr.${payload}.${signature}`;
}

function verifyUserToken(token) {
  if (!token || typeof token !== 'string') return null;
  if (token.startsWith('rmu_usr.')) {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = parts[1];
      const signature = parts[2];
      const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
      if (signature.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        try {
          const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
          // Las sesiones de cliente caducan a los 30 días de iniciarse
          if (!data.ts || Date.now() - data.ts > USER_TOKEN_TTL_MS) return null;
          return data; // { id, email, ts }
        } catch (e) {
          return null;
        }
      }
    }
  }
  return null;
}

// Credenciales de administrador: las guardadas desde el panel tienen prioridad; si no, las del entorno
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function getAdminUsername() {
  return (fallbackSettings.admin_username || process.env.ADMIN_USERNAME || 'zvaito').toLowerCase();
}

// Valor estable que identifica la contraseña de admin vigente (entra en la firma del token)
function getAdminPasswordHash() {
  if (fallbackSettings.admin_password_hash) return fallbackSettings.admin_password_hash;
  return process.env.ADMIN_PASSWORD ? 'env:' + legacySha256(process.env.ADMIN_PASSWORD) : null;
}

function verifyAdminPassword(password) {
  if (fallbackSettings.admin_password_hash) return verifyPassword(password, fallbackSettings.admin_password_hash);
  return !!process.env.ADMIN_PASSWORD && safeEqual(String(password), process.env.ADMIN_PASSWORD);
}

function signAdminPayload(payload) {
  // El hash de la contraseña entra en la firma: al cambiarla se invalidan los tokens anteriores
  return crypto.createHmac('sha256', SESSION_SECRET)
    .update(`${payload}:${getAdminUsername()}:${getAdminPasswordHash() || ''}`)
    .digest('base64url');
}

function getCurrentAdminToken() {
  const payload = String(Date.now());
  return `admin_token_${payload}.${signAdminPayload(payload)}`;
}

function isValidAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('admin_token_')) return false;
  if (!getAdminPasswordHash()) return false;
  const [payload, signature] = token.slice('admin_token_'.length).split('.');
  if (!payload || !signature) return false;
  const issuedAt = parseInt(payload, 10);
  if (isNaN(issuedAt) || Date.now() - issuedAt > ADMIN_TOKEN_TTL_MS) return false;
  const expected = signAdminPayload(payload);
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Middleware de verificación estricta de Administrador
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado. Falta token de autenticación.' });
  }
  const token = authHeader.replace('Bearer ', '').trim();

  if (isValidAdminToken(token)) {
    req.isAdmin = true;
    return next();
  }

  return res.status(401).json({ error: 'La sesión de administrador no es válida o ha caducado.' });
};

// Helper para obtener el usuario autenticado (admin o cliente) en cualquier endpoint
const getAuthUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  
  if (isValidAdminToken(token)) {
    return { id: 0, isAdmin: true, email: getAdminUsername() };
  }

  const tokenData = verifyUserToken(token);
  if (!tokenData) return null;
  const userId = tokenData.id;
  const tokenEmail = tokenData.email;

  // Un token emitido antes del último cambio de contraseña ya no vale
  const issuedBeforePasswordChange = (changedAt) => {
    const changed = changedAt ? new Date(changedAt).getTime() : 0;
    return changed > 0 && tokenData.ts < changed;
  };

  let dbAnswered = false;
  try {
    if (userId && typeof userId === 'number') {
      const uRes = await pool.query('SELECT id, name, email, phone, dni, password_changed_at FROM users WHERE id = $1', [userId]);
      dbAnswered = true;
      if (uRes.rowCount > 0) {
        const { password_changed_at, ...user } = uRes.rows[0];
        return issuedBeforePasswordChange(password_changed_at) ? null : { ...user, isAdmin: false };
      }
    }
    if (tokenEmail) {
      const uEmailRes = await pool.query('SELECT id, name, email, phone, dni, password_changed_at FROM users WHERE LOWER(email) = LOWER($1)', [tokenEmail.trim()]);
      dbAnswered = true;
      if (uEmailRes.rowCount > 0) {
        const { password_changed_at, ...user } = uEmailRes.rows[0];
        return issuedBeforePasswordChange(password_changed_at) ? null : { ...user, isAdmin: false };
      }
    }
  } catch (e) {}

  const fbUser = fallbackUsers.find(u => (userId && u.id === userId) || (tokenEmail && u.email && u.email.toLowerCase() === tokenEmail.toLowerCase()));
  if (fbUser) {
    if (issuedBeforePasswordChange(fbUser.password_changed_at)) return null;
    const { password: _password, ...user } = fbUser;
    return { ...user, isAdmin: false };
  }

  // Usuario que no existe: solo se acepta la identidad del token si la BD no ha podido responder
  return dbAnswered ? null : { id: userId, email: tokenEmail, isAdmin: false };
};

// Sanitizador de texto contra inyección HTML en correos y plantillas
// Validación de entradas de formularios públicos (evita 500 con números/listas y datos basura)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function areStrings(...values) {
  return values.every(v => typeof v === 'string');
}

function areOptionalStrings(...values) {
  return values.every(v => v === undefined || v === null || typeof v === 'string');
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Rate limiting para prevenir ataques de fuerza bruta y DDoS
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // Límite de 500 peticiones por ventana por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde esta IP. Por favor, inténtalo más tarde.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // Límite estricto de 20 intentos de autenticación/códigos
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación. Por favor, inténtalo en 15 minutos.' }
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has alcanzado el límite de envío de mensajes de contacto. Por favor, espera unos minutos.' }
});

const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has alcanzado el límite de envío de opiniones. Por favor, espera unos minutos.' }
});

// Security & Optimization Middleware
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://accounts.google.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.googleusercontent.com", "https://images.unsplash.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://*.redsys.es:25443", "https://sis-t.redsys.es:25443", "https://sis.redsys.es", "https://wa.me", "https://api.whatsapp.com"],
      // El pago real se envía con un formulario POST al TPV de Redsys
      formAction: ["'self'", "https://sis-t.redsys.es:25443", "https://sis.redsys.es"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(globalLimiter);

// Rate limits específicos por endpoint crítico
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verify-registration', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/admin/request-credential-change-code', authLimiter);
app.use('/api/admin/confirm-credential-change', authLimiter);
app.use('/api/contact', contactLimiter);
app.use('/api/reviews/verify-code', reviewLimiter);
// Iniciar pagos o solicitudes de reserva: 15 intentos cada 15 minutos por IP
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de reserva. Espera unos minutos.' }
});
app.post('/api/redsys/create-payment', bookingLimiter);
app.post('/api/bookings', bookingLimiter);
// Sin límite, alguien podría probar números de pedido hasta dar con un pago en curso (para cancelarlo)
// o uno ya pagado (su código abre contrato y factura). La página de éxito consulta hasta 15 veces.
const bookingCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera unos minutos.' }
});
// Contrato y factura con ?auth=código: mismo límite para no poder probar códigos a ciegas
app.get('/api/bookings/:id', (req, res, next) => (req.query.auth ? bookingCodeLimiter(req, res, next) : next()));
app.post(['/api/redsys/cancel-payment', '/api/redsys/confirm-payment'], bookingCodeLimiter);

// Una reserva por furgoneta a la vez: comprobar disponibilidad y guardar no es atómico, así que
// dos clientes pagando las mismas fechas a la vez podían colarse los dos (el servidor es un solo proceso)
const vanBookingLocks = new Map();
function serializeBookingsByVan(req, res, next) {
  const body = req.body || {};
  const vanType = String((body.bookingData && body.bookingData.van_type) || body.van_type || '');
  if (!vanType) return next();
  const previous = vanBookingLocks.get(vanType) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  const chained = previous.then(() => current);
  vanBookingLocks.set(vanType, chained);
  let released = false;
  const done = () => {
    if (released) return;
    released = true;
    release();
    if (vanBookingLocks.get(vanType) === chained) vanBookingLocks.delete(vanType);
  };
  res.on('finish', done);
  res.on('close', done);
  previous.then(() => next());
}
app.post('/api/reviews', reviewLimiter);

app.use(compression());

// CORS restringido por lista blanca segura
const allowedOrigins = [
  'https://rentmeuskar.com',
  'https://www.rentmeuskar.com',
  'http://rentmeuskar.com',
  'http://www.rentmeuskar.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
// Otros dominios donde se publique la web (p. ej. el de Dokploy): ALLOWED_ORIGINS separados por comas
// y el origen de BASE_URL. Sin esto, los formularios fallaban con 403 desde cualquier otro dominio
(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean)
  .forEach(origin => { if (!allowedOrigins.includes(origin)) allowedOrigins.push(origin); });
try {
  if (process.env.BASE_URL) {
    const baseOrigin = new URL(process.env.BASE_URL).origin;
    if (!allowedOrigins.includes(baseOrigin)) allowedOrigins.push(baseOrigin);
  }
} catch (e) {
  console.warn('[CORS] BASE_URL no es una URL válida:', e.message);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Bloqueado por política CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Tras los parsers: el cerrojo necesita leer van_type del cuerpo
app.post(['/api/redsys/create-payment', '/api/redsys/process-test-payment', '/api/redsys/simulate-payment', '/api/bookings'], serializeBookingsByVan);
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '7d' }));

// Conexión a la base de datos PostgreSQL con redundancia inteligente y failover automático
function maskDbUrl(url) {
  if (!url) return '';
  return url.replace(/:([^:@]+)@/, ':****@');
}

const rawConfiguredDbUrl = process.env.DATABASE_URL || '';

// Lista de URLs candidatas (vital dentro de Docker/Dokploy donde el hairpin NAT a la IP pública se bloquea)
const candidateDbUrls = rawConfiguredDbUrl ? [
  rawConfiguredDbUrl,
  rawConfiguredDbUrl.replace(/@187\.127\.233\.89:5440/, '@172.17.0.1:5440'),
  rawConfiguredDbUrl.replace(/@187\.127\.233\.89:5440/, '@host.docker.internal:5440'),
  rawConfiguredDbUrl.replace(/@187\.127\.233\.89:5440/, '@dokploy-postgres:5432')
].filter((url, index, self) => url && self.indexOf(url) === index) : [];

let currentCandidateIndex = 0;
let isDbConnected = false;
let isInitializingDb = false;

let activePool = candidateDbUrls.length > 0 ? new Pool({
  connectionString: candidateDbUrls[0],
  connectionTimeoutMillis: 5000,
  ssl: false
}) : null;

// Proxy adapter para que todas las llamadas existentes a pool.query/pool.connect usen siempre la conexión activa
const pool = {
  query: (...args) => activePool ? activePool.query(...args) : Promise.reject(new Error('Base de datos PostgreSQL no configurada')),
  connect: (...args) => activePool ? activePool.connect(...args) : Promise.reject(new Error('Base de datos PostgreSQL no configurada')),
  on: (...args) => activePool && activePool.on(...args),
  end: (...args) => activePool ? activePool.end(...args) : Promise.resolve()
};

// Inicialización de la base de datos (crear tablas y actualizar esquema si no existe)
const initDb = async () => {
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      dni VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  const createBookingsTableQuery = `
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      van_type VARCHAR(50) NOT NULL,
      van_name VARCHAR(255) NOT NULL,
      pickup_date DATE NOT NULL,
      pickup_time VARCHAR(50) NOT NULL,
      return_date DATE NOT NULL,
      return_time VARCHAR(50) NOT NULL,
      days INTEGER NOT NULL,
      extras JSONB DEFAULT '[]'::jsonb,
      total_price NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createVansTableQuery = `
    CREATE TABLE IF NOT EXISTS vans (
      id SERIAL PRIMARY KEY,
      van_type VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      plate VARCHAR(50) NOT NULL,
      m3 VARCHAR(50) NOT NULL,
      price_sin NUMERIC(10, 2) NOT NULL,
      min_price_con NUMERIC(10, 2) NOT NULL,
      km_price_con NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      extra_gps_price NUMERIC(10, 2) DEFAULT 5.00,
      extra_driver_price NUMERIC(10, 2) DEFAULT 10.00,
      extra_moving_price NUMERIC(10, 2) DEFAULT 10.00
    );
  `;

  const alterBookingsQueries = [
    'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;',
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fianza_status VARCHAR(50) DEFAULT 'pending';",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';",
    'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255);',
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS photos_before TEXT[] DEFAULT '{}';",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS photos_after TEXT[] DEFAULT '{}';",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rental_mode VARCHAR(50) DEFAULT 'sin';",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_kms INTEGER DEFAULT 0;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS waiting_hours NUMERIC(5, 2) DEFAULT 0.00;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS van_plate VARCHAR(50);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS van_m3 VARCHAR(50);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS review_code VARCHAR(50) UNIQUE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contract_applied_rate VARCHAR(100) DEFAULT '1 dia';",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_birthdate DATE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_address TEXT;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_postal_code VARCHAR(50);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_city VARCHAR(255);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_province VARCHAR(255);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_license_num VARCHAR(100);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_license_exp DATE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS second_driver_name VARCHAR(255);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS second_driver_dni VARCHAR(100);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS second_driver_phone VARCHAR(100);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS second_driver_license_num VARCHAR(100);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS second_driver_license_exp DATE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS km_out INTEGER DEFAULT 0;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS km_in INTEGER DEFAULT 0;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS km_included INTEGER DEFAULT 350;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS km_price_extra NUMERIC(10, 2) DEFAULT 0.28;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS km_extra_package BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fuel_out VARCHAR(50) DEFAULT 'Lleno';",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fuel_in VARCHAR(50) DEFAULT 'Lleno';",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adblue_out VARCHAR(50) DEFAULT 'Lleno';",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adblue_in VARCHAR(50) DEFAULT 'Lleno';",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100) DEFAULT 'tarjeta';",
    // Datos de contacto que guardan todos los INSERT de reservas (no se creaban en ninguna migración)
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_email VARCHAR(255);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_dni VARCHAR(50);",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fianza_returned_full BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fianza_returned_partial BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fianza_retained_amount NUMERIC(10, 2) DEFAULT 0.00;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fianza_retained_reason TEXT;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS clean_interior_yes BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS clean_interior_no BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS clean_exterior_yes BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS clean_exterior_no BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cleaning_price NUMERIC(10, 2) DEFAULT 0.00;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_permiso BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_ficha BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_llave BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_llave_repuesto BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_v16 BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_adaptador BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_gancho BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_chaleco BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_rueda BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_gato BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_manual BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accessory_others TEXT;"
  ];

  const alterVansQueries = [
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS extra_gps_price NUMERIC(10, 2) DEFAULT 5.00;",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS extra_driver_price NUMERIC(10, 2) DEFAULT 10.00;",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS extra_moving_price NUMERIC(10, 2) DEFAULT 10.00;",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS custom_extras JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS max_occupants INTEGER DEFAULT 3;",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS eco_label VARCHAR(100) DEFAULT 'C';",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS daily_km_limit INTEGER DEFAULT 350;",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS max_mass INTEGER DEFAULT 2800;",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(100) DEFAULT 'GASOIL';",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS waiting_hour_price NUMERIC(10, 2) DEFAULT 30.00;",
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE vans ALTER COLUMN van_type TYPE VARCHAR(100);"
  ];

  const createSettingsTableQuery = `
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;

  const createReviewsTableQuery = `
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      booking_code VARCHAR(100) UNIQUE NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
      comment TEXT,
      role_or_city VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const alterReviewsQueries = [
    "ALTER TABLE reviews ALTER COLUMN comment DROP NOT NULL;"
  ];

  const createBlockagesTableQuery = `
    CREATE TABLE IF NOT EXISTS van_blockages (
      id SERIAL PRIMARY KEY,
      van_type VARCHAR(50) NOT NULL REFERENCES vans(van_type) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createFaqsTableQuery = `
    CREATE TABLE IF NOT EXISTS faqs (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      display_order INTEGER DEFAULT 0
    );
  `;

  try {
    const client = await pool.connect();
    console.log('Conectado a la base de datos PostgreSQL.');
    
    // Crear tabla de usuarios
    await client.query(createUsersTableQuery);
    // Fecha del último cambio de contraseña: las sesiones emitidas antes dejan de valer
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;');
    console.log('Tabla "users" verificada/creada.');
    
    // Crear tabla de reservas
    await client.query(createBookingsTableQuery);
    console.log('Tabla "bookings" verificada/creada.');
    
    // Crear tabla de furgonetas
    await client.query(createVansTableQuery);
    console.log('Tabla "vans" verificada/creada.');

    // Crear tabla de bloqueos
    await client.query(createBlockagesTableQuery);
    console.log('Tabla "van_blockages" verificada/creada.');

    // Crear índices de rendimiento para consultas ultrarrápidas
    await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_van_status ON bookings(van_type, status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(pickup_date, return_date);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_blockages_van ON van_blockages(van_type);');

    // Crear tabla de FAQs
    await client.query(createFaqsTableQuery);
    console.log('Tabla "faqs" verificada/creada.');

    // Crear tabla de opiniones
    await client.query(createReviewsTableQuery);
    console.log('Tabla "reviews" verificada/creada.');

    // Crear tabla de configuraciones
    await client.query(createSettingsTableQuery);
    console.log('Tabla "settings" verificada/creada.');

    // Pre-poblar furgonetas por defecto SOLO la primera vez (vía flag persistente en PostgreSQL settings)
    const vanInitCheck = await client.query("SELECT value FROM settings WHERE key = 'vans_initialized'");
    const countVans = await client.query('SELECT COUNT(*) FROM vans');
    if (vanInitCheck.rowCount === 0) {
      if (parseInt(countVans.rows[0].count) === 0) {
        await client.query(`
          INSERT INTO vans (van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status) VALUES
          ('medium', 'Ford Transit Custom L2H2 (8m³)', '3681 MCC', '8m³', 79.00, 50.00, 1.00, 'active'),
          ('large', 'MAN TGE L4H3 Gran Volumen (14m³)', '3758 MDW', '14m³', 107.44, 60.00, 1.40, 'active')
        `);
        console.log('Furgonetas por defecto insertadas por primera vez en PostgreSQL.');
      }
      await client.query("INSERT INTO settings (key, value) VALUES ('vans_initialized', 'true') ON CONFLICT (key) DO NOTHING");
    }

    // Pre-poblar FAQs por defecto si está vacía
    const countFaqs = await client.query('SELECT COUNT(*) FROM faqs');
    if (parseInt(countFaqs.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO faqs (question, answer, display_order) VALUES
        ('¿Qué requisitos necesito cumplir para alquilar sin conductor?', 'Necesitas tener al menos 23 años (21 para furgonetas compactas) y estar en posesión del permiso de conducir tipo B vigente con una antigüedad mínima de 2 años. Deberás presentar el DNI/NIE y el carnet de conducir originales al retirar el vehículo.', 1),
        ('¿Hay que dejar alguna fianza o depósito?', 'Sí, se requiere una fianza de 500€ que se deposita en persona al recoger el vehículo (mediante tarjeta o efectivo). Esta fianza se reembolsará íntegramente tras revisar que el vehículo se devuelve en las mismas condiciones, limpio y sin daños.', 2),
        ('¿Cómo funciona la política de combustible?', 'Nuestra política es Lleno-Lleno (Full-to-Full). Te entregamos la furgoneta con el depósito de combustible lleno (diésel) y debes devolverla de la misma forma. De lo contrario, se cobrará el coste del combustible faltante más un cargo de gestión de repostaje.', 3),
        ('¿Qué seguro está incluido en el precio base?', 'El precio incluye seguro obligatorio de responsabilidad civil y seguro de colisión básico con franquicia. Esto significa que en caso de accidente o daños, la responsabilidad máxima del cliente está limitada al importe de la franquicia establecida (salvo negligencia).', 4),
        ('¿Puedo viajar fuera de España con la furgoneta?', 'Por defecto, el uso de las furgonetas está autorizada en territorio nacional (Península Ibérica). Si tienes pensado viajar a Portugal, Francia u otros países de Europa, debes comunicarlo con antelación para tramitar la cobertura del seguro correspondiente y asistencia en el extranjero.', 5)
        ON CONFLICT DO NOTHING
      `);
      console.log('FAQs por defecto insertadas.');
    }


    // Pre-poblar configuraciones de horarios SOLO la primera vez
    const setInitCheck = await client.query("SELECT value FROM settings WHERE key = 'settings_initialized'");
    const countSettings = await client.query('SELECT COUNT(*) FROM settings');
    if (setInitCheck.rowCount === 0) {
      if (parseInt(countSettings.rows[0].count) === 0) {
        await client.query(`
          INSERT INTO settings (key, value) VALUES
          ('hours_weekdays', '08:00 - 14:00, 16:00 - 20:00'),
          ('hours_saturdays', '09:00 - 13:30'),
          ('hours_sundays', 'Cerrado (Devoluciones pactadas)')
        `);
        console.log('Horarios de atención por defecto insertados.');
      }
      await client.query("INSERT INTO settings (key, value) VALUES ('settings_initialized', 'true') ON CONFLICT (key) DO NOTHING");
    }

    // Alterar tabla de reservas para añadir columnas adicionales
    for (const query of alterBookingsQueries) {
      await client.query(query);
    }
    console.log('Columnas de "bookings" verificadas/actualizadas.');

    // Alterar tabla de furgonetas para añadir imágenes
    for (const query of alterVansQueries) {
      await client.query(query);
    }
    console.log('Columnas de "vans" verificadas/actualizadas.');

    // Alterar tabla de opiniones para permitir comentarios opcionales
    for (const query of alterReviewsQueries) {
      try {
        await client.query(query);
      } catch (err) {
        // Ignorar si ya se quitó la restricción
      }
    }
    console.log('Restricción de comentarios de "reviews" verificada/actualizada.');
    
    await syncDatabaseWithDisk(client);
    isDbConnected = true;
    console.log(`[DB CONNECTED] PostgreSQL inicializado y sincronizado con éxito (${maskDbUrl(candidateDbUrls[currentCandidateIndex])}).`);

    client.release();
  } catch (err) {
    isDbConnected = false;
    console.warn(`[DB WARN] Falló conexión con candidato ${currentCandidateIndex + 1}/${candidateDbUrls.length} (${maskDbUrl(candidateDbUrls[currentCandidateIndex])}): ${err.message}`);
    
    // Probar siguiente candidato si hay más disponibles
    if (candidateDbUrls.length > 1) {
      currentCandidateIndex = (currentCandidateIndex + 1) % candidateDbUrls.length;
      try {
        await activePool.end().catch(() => {});
      } catch (e) {}
      activePool = new Pool({
        connectionString: candidateDbUrls[currentCandidateIndex],
        connectionTimeoutMillis: 5000,
        ssl: false
      });
      console.log(`[DB FAILOVER] Conmutando al siguiente candidato de conexión: ${maskDbUrl(candidateDbUrls[currentCandidateIndex])}`);
    }
  } finally {
    isInitializingDb = false;
  }
};

initDb();

// Intentar reconectar y sincronizar periódicamente si la base de datos está offline
setInterval(() => {
  if (!isDbConnected) {
    console.log('[DB RETRY] Intentando reconectar a la base de datos PostgreSQL...');
    initDb();
  }
}, 15000);

// --- RUTAS DE LA API ---

// Validador oficial DNI / NIE / CIF
const validateSpanishID = (idString) => {
  if (!idString) return false;
  const value = idString.trim().toUpperCase();
  const dniRegex = /^(\d{8})([A-Z])$/;
  const nieRegex = /^([XYZ])(\d{7})([A-Z])$/;
  const cifRegex = /^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([0-9A-J])$/;
  const validLetters = "TRWAGMYFPDXBNJZSQVHLCKE";

  if (dniRegex.test(value)) {
    const match = value.match(dniRegex);
    return match[2] === validLetters[parseInt(match[1], 10) % 23];
  }
  if (nieRegex.test(value)) {
    const match = value.match(nieRegex);
    const prefixMap = { 'X': '0', 'Y': '1', 'Z': '2' };
    const fullNumber = prefixMap[match[1]] + match[2];
    return match[3] === validLetters[parseInt(fullNumber, 10) % 23];
  }
  return cifRegex.test(value);
};

// Almacenamiento temporal de registros pendientes de verificación por email
const pendingRegistrations = {};

// 1. Registro de usuarios con verificación previa de correo electrónico
// Mismo mensaje para email, teléfono o DNI repetidos: no revela cuál de los tres existe
const DUPLICATE_ACCOUNT_ERROR = 'Ya existe una cuenta con alguno de estos datos (correo, teléfono o DNI). Si es tuya, inicia sesión o recupera la contraseña.';

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone, dni } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
  }
  if (!areStrings(name, email, password) || !areOptionalStrings(phone, dni)) {
    return res.status(400).json({ error: 'Los datos del formulario no son válidos.' });
  }
  if (!EMAIL_PATTERN.test(email.trim()) || email.trim().length > 254) {
    return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido.' });
  }
  if (name.trim().length > 100 || (phone && phone.trim().length > 20) || password.length > 200) {
    return res.status(400).json({ error: 'Alguno de los datos es demasiado largo.' });
  }
  // Los identificadores del administrador no pueden ser cuentas de cliente (se mezclarían login y recuperación)
  const reservedLogins = [getAdminUsername(), 'info@rentmeuskar.com', (process.env.ADMIN_EMAIL || '').toLowerCase()].filter(Boolean);
  if (reservedLogins.includes(email.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Ese correo no se puede usar para una cuenta de cliente. Usa otro.' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
  }

  if (dni && !validateSpanishID(dni)) {
    return res.status(400).json({ error: 'El DNI / NIE introducido no es válido (comprueba los 8 números y la letra).' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const cleanPhone = phone ? phone.trim() : '';
  const cleanDni = dni ? dni.trim().toUpperCase() : '';
  const passHash = hashPassword(password);
  
  // Verificación estricta de duplicados (Email, Teléfono, DNI) en BD y fallback
  try {
    const checkEmail = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (checkEmail.rowCount > 0 || fallbackUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: DUPLICATE_ACCOUNT_ERROR });
    }

    if (cleanPhone) {
      const checkPhone = await pool.query('SELECT id FROM users WHERE phone = $1', [cleanPhone]);
      if (checkPhone.rowCount > 0 || fallbackUsers.some(u => u.phone === cleanPhone)) {
        return res.status(400).json({ error: DUPLICATE_ACCOUNT_ERROR });
      }
    }

    if (cleanDni) {
      const checkDni = await pool.query('SELECT id FROM users WHERE UPPER(dni) = $1', [cleanDni]);
      if (checkDni.rowCount > 0 || fallbackUsers.some(u => u.dni && u.dni.toUpperCase() === cleanDni)) {
        return res.status(400).json({ error: DUPLICATE_ACCOUNT_ERROR });
      }
    }
  } catch (e) {
    if (fallbackUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: DUPLICATE_ACCOUNT_ERROR });
    }
    if (cleanPhone && fallbackUsers.some(u => u.phone === cleanPhone)) {
      return res.status(400).json({ error: DUPLICATE_ACCOUNT_ERROR });
    }
    if (cleanDni && fallbackUsers.some(u => u.dni && u.dni.toUpperCase() === cleanDni)) {
      return res.status(400).json({ error: DUPLICATE_ACCOUNT_ERROR });
    }
  }

  // Generar código de activación de 6 dígitos
  const code = generateVerificationCode();
  pendingRegistrations[cleanEmail] = {
    name: cleanName,
    email: cleanEmail,
    passHash,
    phone: cleanPhone,
    dni: cleanDni,
    code,
    expires: Date.now() + 15 * 60 * 1000
  };

  console.log(`[SECURITY - REGISTRATION CODE] Código de verificación generado para ${cleanEmail}`);

  try {
    const senderAddress = process.env.SMTP_USER || 'confirmacion@rentmeuskar.com';
    await mailTransporter.sendMail({
      from: `"RentMeUskar" <${senderAddress}>`,
      to: cleanEmail,
      subject: '🔐 Código de Verificación de Registro | RentMeUskar',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #070e24; color: #ffffff; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <h1 style="color: #82d105; margin: 0; font-size: 24px;">RentMeUskar</h1>
            <p style="color: #a0aec0; margin-top: 5px; font-size: 14px;">Bienvenido a RentMeUskar</p>
          </div>
          <div style="padding: 24px 0;">
            <h2 style="color: #ffffff; font-size: 18px; margin-bottom: 12px;">Verifica tu Correo Electrónico</h2>
            <p style="color: #cbd5e0; line-height: 1.6;">Hola <strong>${cleanName}</strong>,</p>
            <p style="color: #cbd5e0; line-height: 1.6;">Para completar la creación de tu cuenta en <strong>RentMeUskar</strong> y verificar que la dirección de correo te pertenece, introduce este código de activación:</p>
            
            <div style="font-size: 32px; font-weight: bold; background: #0c1838; padding: 18px; text-align: center; border-radius: 8px; color: #82d105; letter-spacing: 6px; margin: 24px 0; border: 1px dashed #82d105;">
              ${code}
            </div>
            
            <p style="color: #a0aec0; font-size: 13px;">Si tú no solicitaste este registro, por favor ignora este mensaje.</p>
          </div>
          <div style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; color: #718096; font-size: 12px;">
            &copy; ${new Date().getFullYear()} RentMeUskar. Todos los derechos reservados.
          </div>
        </div>
      `
    });
    console.log(`[SMTP REGISTRATION SUCCESS] Correo de activación enviado a ${cleanEmail} desde ${senderAddress}`);
  } catch (mailErr) {
    console.error('[SMTP REGISTRATION ERROR] Error al enviar correo de verificación:', mailErr.message);
  }

  return res.json({
    success: true,
    requiresVerification: true,
    message: `Hemos enviado un código de confirmación a ${cleanEmail} para activar tu cuenta.`
  });
});

// 1.b Confirmar código de registro y activar inicio de sesión automático
app.post('/api/auth/verify-registration', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code || !areStrings(email, code)) {
    return res.status(400).json({ error: 'El email y el código de verificación son obligatorios.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const pending = pendingRegistrations[cleanEmail];

  if (!pending) {
    return res.status(400).json({ error: 'No hay ninguna solicitud de registro pendiente para este correo.' });
  }

  const codeStatus = checkPendingCode(pending, code);
  if (codeStatus !== 'ok') {
    if (codeStatus !== 'invalid') delete pendingRegistrations[cleanEmail];
    return res.status(400).json({ error: CODE_ERRORS[codeStatus] });
  }

  // Código correcto: Crear usuario en la base de datos e iniciar sesión automáticamente
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, password, phone, dni) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, dni, created_at',
      [pending.name, pending.email, pending.passHash, pending.phone, pending.dni]
    );
    
    const user = result.rows[0];
    fallbackUsers.push({ ...user, password: pending.passHash });
    saveAdminStoreToFile();
    delete pendingRegistrations[cleanEmail];

    return res.status(201).json({
      message: 'Cuenta activada e inicio de sesión automático.',
      token: generateUserToken(user.id, user.email),
      user
    });
  } catch (err) {
    console.warn('Base de datos offline al confirmar registro, activando usuario localmente:', err.message);
    const mockId = fallbackUsers.length > 0 ? Math.max(...fallbackUsers.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: mockId,
      name: pending.name,
      email: pending.email,
      password: pending.passHash,
      phone: pending.phone,
      dni: pending.dni,
      created_at: new Date()
    };
    fallbackUsers.push(newUser);
    saveAdminStoreToFile();
    delete pendingRegistrations[cleanEmail];

    const { password: _, ...userWithoutPass } = newUser;
    return res.status(201).json({
      message: 'Cuenta activada e inicio de sesión automático.',
      token: generateUserToken(newUser.id, newUser.email),
      user: userWithoutPass
    });
  }
});

// 1.c Formulario de contacto (Copia por correo al administrador con sanitización de contenido)
app.post('/api/contact', async (req, res) => {
  const { name, contact, reason, message } = req.body;
  if (!name || !contact || !message || !areStrings(name, contact, message) || !areOptionalStrings(reason)) {
    return res.status(400).json({ error: 'Nombre, forma de contacto y mensaje son obligatorios.' });
  }

  const safeName = escapeHtml(name.trim());
  const safeContact = escapeHtml(contact.trim());
  const safeReason = escapeHtml((reason || 'General').trim());
  const safeMessage = escapeHtml(message.trim());

  console.log(`[CONTACT FORM SUBMISSION] Nombre: ${safeName} | Contacto: ${safeContact} | Motivo: ${safeReason}`);

  if (mailTransporter) {
    try {
      const senderAddress = process.env.SMTP_USER || 'confirmacion@rentmeuskar.com';
      const adminEmail = process.env.CONTACT_EMAIL || senderAddress;
      await mailTransporter.sendMail({
        from: `"RentMeUskar Web" <${senderAddress}>`,
        to: adminEmail,
        subject: `📩 Nuevo Mensaje Web de ${safeName} (${safeReason})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #070e24; color: #ffffff; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
            <h2 style="color: #82d105; margin-top: 0;">Nuevo Mensaje desde RentMeUskar.com</h2>
            <p><strong>Nombre:</strong> ${safeName}</p>
            <p><strong>Contacto:</strong> ${safeContact}</p>
            <p><strong>Motivo:</strong> ${safeReason}</p>
            <div style="background: #0c1838; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #82d105;">
              <p style="margin: 0; white-space: pre-wrap;">${safeMessage}</p>
            </div>
          </div>
        `
      });
    } catch (e) {
      console.error('[SMTP CONTACT ERROR] Error al enviar copia por email:', e.message);
    }
  }

  return res.json({ success: true, message: 'Mensaje recibido con éxito.' });
});

// 2. Inicio de sesión
// Bloqueo por cuenta: el límite por IP no frena un ataque repartido entre muchas IPs
const LOGIN_FAILURE_LIMIT = 10;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map();

function isLoginLocked(identifier) {
  const entry = loginFailures.get(identifier);
  if (!entry) return false;
  if (Date.now() - entry.first > LOGIN_FAILURE_WINDOW_MS) {
    loginFailures.delete(identifier);
    return false;
  }
  return entry.count >= LOGIN_FAILURE_LIMIT;
}

function recordLoginFailure(identifier) {
  if (loginFailures.size > 5000) {
    // Limpieza de entradas caducadas para que el mapa no crezca sin límite
    for (const [key, value] of loginFailures) {
      if (Date.now() - value.first > LOGIN_FAILURE_WINDOW_MS) loginFailures.delete(key);
    }
  }
  const entry = loginFailures.get(identifier);
  if (!entry || Date.now() - entry.first > LOGIN_FAILURE_WINDOW_MS) {
    loginFailures.set(identifier, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email y contraseña no válidos.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (isLoginLocked(cleanEmail)) {
    return res.status(429).json({ error: 'Demasiados intentos fallidos con esta cuenta. Espera 15 minutos o recupera la contraseña.' });
  }

  // Login de Administrador (usuario del panel, info@ o ADMIN_EMAIL del entorno)
  const adminLogins = [getAdminUsername(), 'info@rentmeuskar.com', (process.env.ADMIN_EMAIL || '').toLowerCase()].filter(Boolean);

  if (adminLogins.includes(cleanEmail) && verifyAdminPassword(password)) {
    return res.json({
      token: getCurrentAdminToken(),
      user: { id: 1, name: 'Administrador', email: cleanEmail, is_admin: true }
    });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (result.rowCount > 0) {
      const user = result.rows[0];
      if (verifyPassword(password, user.password)) {
        if (needsPasswordRehash(user.password)) {
          const upgraded = hashPassword(password);
          await pool.query('UPDATE users SET password = $1 WHERE id = $2', [upgraded, user.id]).catch(() => {});
          const fbUser = fallbackUsers.find(u => u.id === user.id);
          if (fbUser) { fbUser.password = upgraded; saveAdminStoreToFile(); }
        }
        return res.json({
          message: 'Inicio de sesión exitoso.',
          token: generateUserToken(user.id, user.email),
          user: { id: user.id, name: user.name, email: user.email, phone: user.phone, dni: user.dni }
        });
      }
    }
  } catch (err) {
    console.warn('Base de datos offline al iniciar sesión, buscando en fallback:', err.message);
  }

  // Buscar en usuarios registrados en memoria / fallback
  const user = fallbackUsers.find(u => u.email.toLowerCase() === cleanEmail && verifyPassword(password, u.password));
  if (user) {
    if (needsPasswordRehash(user.password)) {
      user.password = hashPassword(password);
      saveAdminStoreToFile();
    }
    const { password: _, ...userWithoutPass } = user;
    return res.json({
      message: 'Inicio de sesión exitoso.',
      token: generateUserToken(user.id, user.email),
      user: userWithoutPass
    });
  }

  recordLoginFailure(cleanEmail);
  return res.status(401).json({ error: 'Correo electrónico o contraseña incorrectos.' });
});

// 3. Sistema de recuperación y restablecimiento de contraseña vía email
const pendingPasswordResets = {};

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email, isAdmin } = req.body;
  if ((!email && !isAdmin) || !areOptionalStrings(email)) {
    return res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
  }

  const cleanEmail = email ? email.trim().toLowerCase() : 'info@rentmeuskar.com';
  const code = generateVerificationCode();

  const currentAdminUser = getAdminUsername();
  const isAdminRequest = !!(isAdmin || cleanEmail === 'info@rentmeuskar.com' || cleanEmail === currentAdminUser || cleanEmail === 'admin');

  // Un código por destinatario cada 2 minutos: evita bombardear el buzón y que cualquiera
  // invalide sin parar el código vigente del administrador
  const previous = pendingPasswordResets[isAdminRequest ? 'info@rentmeuskar.com' : cleanEmail];
  if (previous && previous.createdAt && Date.now() - previous.createdAt < 2 * 60 * 1000) {
    return res.json({ success: true, message: 'Ya te hemos enviado un código hace poco. Revisa tu correo (también la carpeta de spam) o inténtalo de nuevo en unos minutos.' });
  }

  // isAdmin marca los códigos enviados a info@: solo esos pueden restablecer el administrador
  const pendingEntry = {
    code,
    isAdmin: isAdminRequest,
    createdAt: Date.now(),
    expires: Date.now() + 15 * 60 * 1000
  };

  if (isAdminRequest) {
    pendingPasswordResets['info@rentmeuskar.com'] = pendingEntry;
    pendingPasswordResets[currentAdminUser] = pendingEntry;
  } else {
    pendingPasswordResets[cleanEmail] = pendingEntry;
  }

  console.log(`[SECURITY - FORGOT PASSWORD] Código generado para ${cleanEmail} (isAdmin: ${isAdminRequest})`);

  const senderAddress = process.env.SMTP_USER || 'confirmacion@rentmeuskar.com';

  if (isAdminRequest) {
    // Si la solicitud viene de /admin o es para la cuenta de administración, se envía a info@rentmeuskar.com
    const destinationAddress = 'info@rentmeuskar.com';

    if (mailTransporter) {
      try {
        await mailTransporter.sendMail({
          from: `"RentMeUskar Seguridad" <${senderAddress}>`,
          to: destinationAddress,
          subject: `🔐 Código de Verificación | Cambio de Credenciales del Panel Admin - RentMeUskar`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #070e24; color: #ffffff; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
              <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <h1 style="color: #82d105; margin: 0; font-size: 24px;">RentMeUskar - Panel de Administración</h1>
                <p style="color: #a0aec0; margin-top: 5px; font-size: 14px;">Solicitud de Cambio / Restablecimiento de Credenciales de Admin</p>
              </div>
              <div style="padding: 24px 0;">
                <h2 style="color: #ffffff; font-size: 18px; margin-bottom: 12px;">Código de Verificación de Administrador</h2>
                <p style="color: #cbd5e0; line-height: 1.6;">Se ha solicitado un código de confirmación desde <strong>${senderAddress}</strong> para modificar el usuario y la contraseña del panel de administración.</p>
                <p style="color: #cbd5e0; line-height: 1.6;">Introduce el siguiente <strong>código de 6 dígitos</strong> en la pantalla de administración para proceder al cambio:</p>
                
                <div style="font-size: 32px; font-weight: bold; background: #0c1838; padding: 18px; text-align: center; border-radius: 8px; color: #82d105; letter-spacing: 6px; margin: 24px 0; border: 1px dashed #82d105;">
                  ${code}
                </div>
                
                <p style="color: #a0aec0; font-size: 13px;">Este código caduca en 15 minutos. Si no has solicitado este cambio, por favor revisa la seguridad de tu panel de administración.</p>
              </div>
              <div style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; color: #718096; font-size: 12px;">
                &copy; ${new Date().getFullYear()} RentMeUskar. Todos los derechos reservados.
              </div>
            </div>
          `
        });
        console.log(`[SMTP ADMIN FORGOT PASS SUCCESS] Correo de verificación enviado desde ${senderAddress} a ${destinationAddress}`);
      } catch (mailErr) {
        console.error('[SMTP ADMIN FORGOT PASS ERROR] Error enviando email admin:', mailErr.message);
      }
    }

    return res.json({
      success: true,
      message: `Hemos enviado un código de verificación desde ${senderAddress} a info@rentmeuskar.com para restablecer las credenciales del panel de administración.`
    });
  } else {
    // Si la solicitud es de un usuario cliente normal (desde el formulario web), se envía al correo introducido
    const destinationAddress = cleanEmail;

    if (mailTransporter) {
      try {
        await mailTransporter.sendMail({
          from: `"RentMeUskar" <${senderAddress}>`,
          to: destinationAddress,
          subject: '🔐 Código de confirmación - Restablecer Contraseña | RentMeUskar',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #070e24; color: #ffffff; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
              <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <h1 style="color: #82d105; margin: 0; font-size: 24px;">RentMeUskar</h1>
                <p style="color: #a0aec0; margin-top: 5px; font-size: 14px;">Alquiler de Vehículos en Huéscar y Altiplano Granadino</p>
              </div>
              <div style="padding: 24px 0;">
                <h2 style="color: #ffffff; font-size: 18px; margin-bottom: 12px;">Restablecimiento de Contraseña</h2>
                <p style="color: #cbd5e0; line-height: 1.6;">Hola,</p>
                <p style="color: #cbd5e0; line-height: 1.6;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta registrada en <strong>RentMeUskar</strong> (<strong>${cleanEmail}</strong>).</p>
                <p style="color: #cbd5e0; line-height: 1.6;">Introduce el siguiente <strong>código de confirmación de 6 dígitos</strong> en la pantalla de la aplicación:</p>
                
                <div style="font-size: 32px; font-weight: bold; background: #0c1838; padding: 18px; text-align: center; border-radius: 8px; color: #82d105; letter-spacing: 6px; margin: 24px 0; border: 1px dashed #82d105;">
                  ${code}
                </div>
                
                <p style="color: #a0aec0; font-size: 13px;">Este código expirará en <strong>15 minutos</strong>. Si no solicitaste este cambio, puedes ignorar este correo con total tranquilidad.</p>
              </div>
              <div style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; color: #718096; font-size: 12px;">
                &copy; ${new Date().getFullYear()} RentMeUskar. Todos los derechos reservados.
              </div>
            </div>
          `
        });
        console.log(`[SMTP CLIENT FORGOT PASS SUCCESS] Correo de confirmación enviado a ${destinationAddress}`);
      } catch (mailErr) {
        console.error('[SMTP CLIENT FORGOT PASS ERROR] Error enviando email cliente:', mailErr.message);
      }
    }

    return res.json({
      success: true,
      message: `Hemos enviado un código de verificación a ${destinationAddress} para restablecer tu contraseña.`
    });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, new_password, newPassword, new_username } = req.body;
  const targetPassword = new_password || newPassword;

  if (!code || !targetPassword) {
    return res.status(400).json({ error: 'El código de verificación y la nueva contraseña son obligatorios.' });
  }
  if (!areStrings(code, targetPassword) || !areOptionalStrings(email, new_username)) {
    return res.status(400).json({ error: 'Los datos del formulario no son válidos.' });
  }
  if (targetPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
  }

  const cleanEmail = email ? email.trim().toLowerCase() : 'info@rentmeuskar.com';
  const pending = pendingPasswordResets[cleanEmail] || pendingPasswordResets['info@rentmeuskar.com'];

  if (!pending) {
    return res.status(400).json({ error: 'No hay ninguna solicitud de restablecimiento activa o el código ha caducado.' });
  }

  const codeStatus = checkPendingCode(pending, code);
  if (codeStatus !== 'ok') {
    if (codeStatus !== 'invalid') {
      Object.keys(pendingPasswordResets).forEach(k => { if (pendingPasswordResets[k] === pending) delete pendingPasswordResets[k]; });
    }
    return res.status(400).json({ error: CODE_ERRORS[codeStatus] });
  }

  const passHash = hashPassword(targetPassword);

  // Restablecer admin solo con un código emitido para la cuenta de administración (enviado a info@)
  if (pending.isAdmin) {
    const finalAdminUser = new_username && new_username.trim() ? new_username.trim() : getAdminUsername();
    if (finalAdminUser.length < 3 || finalAdminUser.length > 100) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener entre 3 y 100 caracteres.' });
    }
    try {
      await pool.query("INSERT INTO settings (key, value) VALUES ('admin_username', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [finalAdminUser]);
      await pool.query("INSERT INTO settings (key, value) VALUES ('admin_password_hash', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [passHash]);
      await pool.query("DELETE FROM settings WHERE key = 'admin_password'");
    } catch (e) {
      console.warn('Base de datos offline al guardar credenciales admin:', e.message);
    }
    fallbackSettings.admin_username = finalAdminUser;
    delete fallbackSettings.admin_password;
    fallbackSettings.admin_password_hash = passHash;
    saveAdminStoreToFile();
    delete pendingPasswordResets[cleanEmail];
    delete pendingPasswordResets['info@rentmeuskar.com'];
    return res.json({ success: true, token: getCurrentAdminToken(), message: '¡Credenciales de Administrador restablecidas correctamente! Ya puedes acceder.' });
  }

  // Restablecer cliente normal
  try {
    await pool.query("UPDATE users SET password = $1, password_changed_at = $3 WHERE LOWER(email) = $2", [passHash, cleanEmail, new Date()]);
  } catch (e) {
    console.warn('Base de datos offline al actualizar contraseña de usuario:', e.message);
  }

  const userInFallback = fallbackUsers.find(u => u.email.toLowerCase() === cleanEmail);
  if (userInFallback) {
    userInFallback.password = passHash;
    userInFallback.password_changed_at = new Date().toISOString();
    saveAdminStoreToFile();
  }

  delete pendingPasswordResets[cleanEmail];
  delete pendingPasswordResets['info@rentmeuskar.com'];
  return res.json({ success: true, message: '¡Contraseña restablecida correctamente! Ya puedes iniciar sesión.' });
});

// 3. Obtener perfil del usuario actual (blindado contra IDOR)
app.get('/api/auth/me', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'No autorizado. Token inválido o expirado.' });
  }
  
  if (authUser.isAdmin) {
    return res.json({ id: 0, name: 'Admin', email: authUser.email, is_admin: true });
  }
  
  const { password: _, ...userWithoutPass } = authUser;
  return res.json(userWithoutPass);
});

// 3.b Actualizar perfil del usuario actual (blindado contra IDOR)
app.put('/api/auth/me', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'No autorizado. Token inválido o expirado.' });
  }

  const { name, phone, dni } = req.body;

  if (!areOptionalStrings(name, phone, dni) || (name && name.trim().length > 100) || (phone && phone.trim().length > 20)) {
    return res.status(400).json({ error: 'Los datos del perfil no son válidos.' });
  }
  if (dni && !validateSpanishID(dni)) {
    return res.status(400).json({ error: 'El DNI / NIE introducido no es válido.' });
  }

  const userId = authUser.id;

  // Teléfono y DNI son únicos por cuenta, igual que en el registro
  const cleanPhone = phone ? phone.trim() : '';
  const cleanDni = dni ? dni.trim().toUpperCase() : '';
  if (cleanPhone || cleanDni) {
    let taken = false;
    try {
      const dup = await pool.query('SELECT id FROM users WHERE id <> $1 AND (($2 <> \'\' AND phone = $2) OR ($3 <> \'\' AND UPPER(dni) = $3)) LIMIT 1', [userId, cleanPhone, cleanDni]);
      taken = dup.rowCount > 0;
    } catch (e) {
      taken = fallbackUsers.some(u => u.id !== userId && ((cleanPhone && u.phone === cleanPhone) || (cleanDni && String(u.dni || '').toUpperCase() === cleanDni)));
    }
    if (taken) {
      return res.status(400).json({ error: 'Ese teléfono o DNI ya pertenece a otra cuenta.' });
    }
  }
  try {
    const result = await pool.query(
      'UPDATE users SET name = COALESCE(NULLIF($1, \'\'), name), phone = COALESCE(NULLIF($2, \'\'), phone), dni = COALESCE(NULLIF($3, \'\'), dni) WHERE id = $4 RETURNING id, name, email, phone, dni, created_at',
      [name ? name.trim() : null, phone ? phone.trim() : null, dni ? dni.trim().toUpperCase() : null, userId]
    );

    const fbIndex = fallbackUsers.findIndex(u => u.id === userId);
    if (fbIndex !== -1) {
      if (name) fallbackUsers[fbIndex].name = name.trim();
      if (phone) fallbackUsers[fbIndex].phone = phone.trim();
      if (dni) fallbackUsers[fbIndex].dni = dni.trim().toUpperCase();
    }

    if (result.rowCount > 0) {
      return res.json({ message: 'Perfil actualizado con éxito.', user: result.rows[0] });
    }
  } catch (err) {
    console.warn('Base de datos offline al actualizar perfil, actualizando memoria fallback:', err.message);
  }

  const fbIndex = fallbackUsers.findIndex(u => u.id === userId);
  if (fbIndex !== -1) {
    if (name) fallbackUsers[fbIndex].name = name.trim();
    if (phone) fallbackUsers[fbIndex].phone = phone.trim();
    if (dni) fallbackUsers[fbIndex].dni = dni.trim().toUpperCase();
    const { password: _, ...userWithoutPass } = fallbackUsers[fbIndex];
    return res.json({ message: 'Perfil actualizado con éxito.', user: userWithoutPass });
  }

  return res.json({ message: 'Perfil actualizado con éxito.', user: { id: userId, name, phone, dni } });
});



// Helper para dar formato a fechas locales YYYY-MM-DD
const formatDateISO = (d) => {
  if (!d) return '';
  if (typeof d === 'string') {
    const match = d.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toISOString().split('T')[0];
  } catch (e) {
    return String(d);
  }
};

// 4. Obtener fechas no disponibles (ocupadas o bloqueadas por el administrador)
app.get('/api/bookings/unavailable-dates', async (req, res) => {
  const { van_type } = req.query;
  
  let ranges = [];
  try {
    let query = `
      SELECT pickup_date AS from_date, return_date AS to_date FROM bookings
      WHERE ${ACTIVE_BOOKING_SQL}
      UNION ALL
      SELECT start_date AS from_date, end_date AS to_date FROM van_blockages
    `;
    let params = [];

    if (van_type) {
      query = `
        SELECT pickup_date AS from_date, return_date AS to_date FROM bookings 
        WHERE van_type = $1 AND ${ACTIVE_BOOKING_SQL}
        UNION ALL
        SELECT start_date AS from_date, end_date AS to_date FROM van_blockages 
        WHERE van_type = $1
      `;
      params = [van_type];
    }

    const result = await pool.query(query, params);
    
    ranges = result.rows.map(row => ({
      from: formatDateISO(row.from_date),
      to: formatDateISO(row.to_date)
    }));
  } catch (err) {
    console.warn('Base de datos offline al obtener disponibilidad, usando fallback:', err.message);
    const bookingsRange = fallbackBookings
      .filter(b => (!van_type || b.van_type === van_type) && isActiveFallbackBooking(b))
      .map(b => ({ from: formatDateISO(b.pickup_date), to: formatDateISO(b.return_date) }));
    const blockagesRange = fallbackBlockages
      .filter(b => (!van_type || b.van_type === van_type))
      .map(b => ({ from: formatDateISO(b.start_date), to: formatDateISO(b.end_date) }));
    ranges = [...bookingsRange, ...blockagesRange];
  }
  res.json(ranges);
});

// 5. Crear una nueva reserva
app.post('/api/bookings', async (req, res) => {
  let {
    name,
    van_type,
    van_name,
    pickup_date,
    pickup_time,
    return_date,
    return_time,
    days,
    extras,
    total_price,
    user_id,
    fianza_status,
    payment_status,
    payment_id,
    payment_method,
    status,
    rental_mode,
    estimated_kms,
    waiting_hours
  } = req.body;

  if (!name || !van_type || !van_name || !pickup_date || !pickup_time || !return_date || !return_time || !days || total_price === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios en el formulario.' });
  }

  // Reservar exige sesión (como en la web) y un cliente solo crea solicitudes pendientes
  const requester = await getAuthUser(req);
  if (!requester) {
    return res.status(401).json({ error: 'Inicia sesión para solicitar una reserva.' });
  }
  if (!requester.isAdmin) {
    if ((await countOpenBookings(requester.id, 'pending')) >= MAX_OPEN_REQUESTS_PER_USER) {
      return res.status(429).json({ error: 'Ya tienes solicitudes de reserva pendientes de confirmar. Espera a que te respondamos antes de enviar otra.' });
    }
    fianza_status = 'pending';
    payment_status = 'pending';
    payment_id = null;
    status = 'pending';
    user_id = requester && typeof requester.id === 'number' ? requester.id : null;
    const quote = await computeBookingQuote(req.body);
    if (quote.error) {
      return res.status(400).json({ error: quote.error });
    }
    total_price = quote.total;
    days = quote.days;
    extras = quote.extras;
    van_name = quote.van.name || van_name;
    name = String(name).trim().slice(0, 100);
  }

  // Declaradas fuera del try: el catch de modo sin BD también las usa
  let realPlate = '';
  let realM3 = '';
  // Datos de contacto calculados antes de tocar la BD para que el modo sin BD también los guarde
  const clientEmail = String(req.body.client_email || requester.email || '').trim().toLowerCase();
  const clientPhone = String(req.body.client_phone || requester.phone || '').trim();
  const clientDni = String(req.body.client_dni || requester.dni || '').trim().toUpperCase();
  try {
    // Obtener matrícula y volumen de la base de datos para la furgoneta
    try {
      const vanRes = await pool.query('SELECT plate, m3 FROM vans WHERE van_type = $1', [van_type]);
      if (vanRes.rowCount > 0) {
        realPlate = vanRes.rows[0].plate;
        realM3 = vanRes.rows[0].m3;
      } else {
        // Fallback histórico
        realPlate = van_type === 'medium' ? '3681 MCC' : '3758 MDW';
        realM3 = van_type === 'medium' ? '8m³' : '14m³';
      }
    } catch (e) {
      console.error('Error al consultar matrícula de furgoneta:', e);
      realPlate = van_type === 'medium' ? '3681 MCC' : '3758 MDW';
      realM3 = van_type === 'medium' ? '8m³' : '14m³';
    }

    // Verificar colisión de fechas (solo para alquiler SIN conductor, con conductor no bloquea)
    if ((rental_mode || 'sin') === 'sin' && !(await isVanAvailable(van_type, pickup_date, return_date))) {
      return res.status(400).json({ error: 'La furgoneta seleccionada no está disponible en las fechas elegidas.' });
    }

    // Resolver usuario autenticado y detalles de cliente
    const authUser = requester;

    // Validar user_id frente a la tabla users para no violar la Foreign Key constraint
    let validUserId = null;
    if (user_id && typeof user_id === 'number') {
      try {
        const uRes = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);
        if (uRes.rowCount > 0) validUserId = uRes.rows[0].id;
      } catch (e) {
        validUserId = null;
      }
    }
    if (!validUserId && authUser && authUser.id && typeof authUser.id === 'number' && authUser.id !== 9999) {
      try {
        const uRes = await pool.query('SELECT id FROM users WHERE id = $1', [authUser.id]);
        if (uRes.rowCount > 0) validUserId = uRes.rows[0].id;
      } catch (e) {}
    }
    if (!validUserId && clientEmail) {
      try {
        const uRes = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [clientEmail]);
        if (uRes.rowCount > 0) validUserId = uRes.rows[0].id;
      } catch (e) {}
    }

    const reviewCode = generateReviewCode();
    const query = `
      INSERT INTO bookings (
        name, van_type, van_name, pickup_date, pickup_time, 
        return_date, return_time, days, extras, total_price,
        user_id, fianza_status, payment_status, payment_id, status,
        rental_mode, estimated_kms, waiting_hours, van_plate, van_m3,
        review_code, payment_method, client_email, client_phone, client_dni
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *;
    `;

    const values = [
      name,
      van_type,
      van_name,
      pickup_date,
      pickup_time,
      return_date,
      return_time,
      days,
      JSON.stringify(extras || []),
      total_price,
      validUserId,
      fianza_status || 'pending',
      payment_status || 'pending',
      payment_id || null,
      status || 'pending',
      rental_mode || 'sin',
      estimated_kms || 0,
      waiting_hours || 0.00,
      realPlate,
      realM3,
      reviewCode,
      payment_method || 'tarjeta',
      clientEmail || null,
      clientPhone || null,
      clientDni || null
    ];

    const result = await pool.query(query, values);
    
    // Sincronizar catálogo local
    fallbackBookings.push(result.rows[0]);
    saveAdminStoreToFile();

    res.status(201).json({
      message: 'Reserva registrada con éxito.',
      booking: result.rows[0]
    });
  } catch (err) {
    console.error('Error al insertar reserva, simulando en memoria:', err);
    const reviewCode = generateReviewCode();
    const mockId = fallbackBookings.length > 0 ? Math.max(...fallbackBookings.map(b => b.id)) + 1 : 1;
    const mockBooking = {
      id: mockId,
      name,
      van_type,
      van_name,
      pickup_date,
      pickup_time,
      return_date,
      return_time,
      days,
      extras: extras || [],
      total_price: parseFloat(total_price),
      user_id: user_id || null,
      fianza_status: fianza_status || 'pending',
      payment_status: payment_status || 'pending',
      payment_id: payment_id || null,
      payment_method: payment_method || 'tarjeta',
      status: status || 'pending',
      rental_mode: rental_mode || 'sin',
      estimated_kms: estimated_kms || 0,
      waiting_hours: waiting_hours || 0.00,
      van_plate: realPlate,
      van_m3: realM3,
      review_code: reviewCode,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      client_dni: clientDni || null,
      created_at: new Date().toISOString()
    };
    fallbackBookings.push(mockBooking);
    saveAdminStoreToFile();
    res.status(201).json({
      message: 'Reserva registrada temporalmente (Modo offline sin BD).',
      booking: mockBooking
    });
  }
});

// 6. Obtener una reserva por ID (con control de acceso por usuario/admin y failover transparente a memoria)
app.get('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const authUser = await getAuthUser(req);

  let booking = null;
  try {
    const query = `
      SELECT b.*, u.name as user_name, u.email as user_email, u.phone as user_phone, u.dni as user_dni,
             v.price_sin, v.min_price_con, v.km_price_con, v.max_occupants, v.eco_label, v.daily_km_limit, v.max_mass, v.fuel_type
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN vans v ON b.van_type = v.van_type
      WHERE b.id = $1
    `;
    const result = await pool.query(query, [id]);
    if (result.rowCount > 0) {
      booking = result.rows[0];
    }
  } catch (err) {
    console.warn(`[BOOKING GET WARN] Base de datos no disponible o error al consultar reserva #${id}:`, err.message);
  }

  // Fallback transparente a disco/memoria (fallbackBookings)
  if (!booking) {
    const fb = fallbackBookings.find(b => String(b.id) === String(id));
    if (fb) {
      const isFord = fb.van_type === 'medium' || (fb.van_name && fb.van_name.toLowerCase().includes('transit'));
      const van = fallbackVans.find(v => v.van_type === fb.van_type || String(v.id) === String(fb.van_id)) || (isFord ? fallbackVans[0] : fallbackVans[1]);
      
      booking = {
        ...fb,
        user_name: fb.user_name || fb.client_name || fb.name || '-',
        user_email: fb.user_email || fb.client_email || '-',
        user_phone: fb.user_phone || fb.client_phone || '-',
        user_dni: fb.user_dni || fb.client_dni || '-',
        price_sin: fb.price_sin !== undefined && fb.price_sin !== null ? fb.price_sin : (van ? van.price_sin : (isFord ? 79.00 : 107.44)),
        min_price_con: fb.min_price_con !== undefined && fb.min_price_con !== null ? fb.min_price_con : (van ? van.min_price_con : (isFord ? 50.00 : 60.00)),
        km_price_con: fb.km_price_con !== undefined && fb.km_price_con !== null ? fb.km_price_con : (van ? van.km_price_con : (isFord ? 1.00 : 1.40)),
        max_occupants: van ? van.max_occupants : 3,
        eco_label: van ? van.eco_label : 'C',
        daily_km_limit: van ? van.daily_km_limit : 350,
        max_mass: van ? van.max_mass : (isFord ? 2800 : 3500),
        fuel_type: van ? van.fuel_type : 'GASOIL'
      };
    }
  }

  if (!booking) {
    return res.status(404).json({ error: 'Reserva no encontrada.' });
  }

  // Acceso: admin, titular de la reserva o enlace con su código secreto (?auth=review_code/payment_id)
  const authParam = typeof req.query.auth === 'string' ? req.query.auth.trim() : '';
  const hasSecret = !!authParam && [booking.review_code, booking.payment_id]
    .some(secret => secret && safeEqual(String(secret).toUpperCase(), authParam.toUpperCase()));
  const isOwner = !!(authUser && !authUser.isAdmin && (
    (booking.user_id && String(booking.user_id) === String(authUser.id)) ||
    (authUser.email && [booking.client_email, booking.user_email].some(e => e && e.toLowerCase() === authUser.email.toLowerCase()))
  ));
  if (!(authUser && authUser.isAdmin) && !isOwner && !hasSecret) {
    return res.status(404).json({ error: 'Reserva no encontrada.' });
  }

  // Entrega de datos para documentos oficiales (Contrato de Alquiler y Factura)
  return res.json(booking);
});

// 7. Obtener reservas (Aislamiento estricto: admin ve todas, cliente solo ve las suyas)
app.get('/api/bookings', async (req, res) => {
  const { user_id, email } = req.query;
  const authUser = await getAuthUser(req);

  // Si no se especifica user_id, es una petición de catálogo completo (REQUERIDO SER ADMIN)
  if (!user_id) {
    if (!authUser || !authUser.isAdmin) {
      return res.status(401).json({ error: 'No autorizado. Se requieren permisos de administrador.' });
    }

    try {
      const query = `
        SELECT b.*, u.name as client_name, u.email as client_email, u.phone as client_phone, u.dni as client_dni
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        ORDER BY b.created_at DESC
      `;
      const result = await pool.query(query);
      return res.json(result.rows);
    } catch (err) {
      console.warn('Base de datos offline al consultar todas las reservas, usando fallback:', err.message);
      return res.json(fallbackBookings);
    }
  }

  // Un cliente solo ve sus reservas: id y email salen siempre de su sesión, nunca de la URL
  if (!authUser) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión para ver tus reservas.' });
  }
  const requestedUserId = authUser.isAdmin ? parseInt(user_id) : authUser.id;
  if (!authUser.isAdmin && parseInt(user_id) !== authUser.id) {
    return res.status(403).json({ error: 'Acceso denegado a las reservas de otro usuario.' });
  }
  const cleanEmail = authUser.isAdmin
    ? (typeof email === 'string' ? email.trim().toLowerCase() : '')
    : (authUser.email || '').toLowerCase();

  const targetUserId = requestedUserId || 0;

  try {
    const query = `
      SELECT b.*, 
             COALESCE(b.name, u.name) as client_name, 
             COALESCE(b.client_email, u.email) as client_email, 
             COALESCE(b.client_phone, u.phone) as client_phone, 
             COALESCE(b.client_dni, u.dni) as client_dni
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE (b.user_id = $1 ${cleanEmail ? 'OR LOWER(TRIM(COALESCE(b.client_email, u.email))) = LOWER(TRIM($2))' : ''})
      ORDER BY b.created_at DESC
    `;
    const params = cleanEmail ? [targetUserId, cleanEmail] : [targetUserId];
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.warn('Base de datos offline al consultar reservas de usuario, usando fallback:', err.message);
  }

  // Fallback seguro: filtrar estrictamente por user_id o email
  const userBookings = fallbackBookings.filter(b => {
    if (requestedUserId && b.user_id && String(b.user_id) === String(requestedUserId)) return true;
    if (authUser && authUser.id && b.user_id && String(b.user_id) === String(authUser.id)) return true;
    const targetEmail = cleanEmail || (authUser && authUser.email ? authUser.email.toLowerCase() : '');
    if (targetEmail && ((b.client_email && b.client_email.toLowerCase() === targetEmail) || 
                       (b.user_email && b.user_email.toLowerCase() === targetEmail))) return true;
    return false;
  });
  return res.json(userBookings);
});

// Campos que el panel admin puede actualizar en una reserva, con el tipo de su columna.
// Antes solo se guardaban status/fianza_status/payment_status y los datos del contrato se perdían
const BOOKING_STATUS_VALUES = ['pending', 'pending_payment', 'paid_pending', 'confirmed', 'cancelled'];
const FIANZA_STATUS_VALUES = ['pending', 'paid', 'refunded'];
const PAYMENT_STATUS_VALUES = ['pending', 'paid', 'failed', 'refunded'];
const ADMIN_BOOKING_FIELDS = {
  contract_applied_rate: 'text', client_address: 'text', client_postal_code: 'text', client_city: 'text',
  client_province: 'text', client_license_num: 'text', second_driver_name: 'text', second_driver_dni: 'text',
  second_driver_phone: 'text', second_driver_license_num: 'text', fuel_out: 'text', fuel_in: 'text',
  adblue_out: 'text', adblue_in: 'text', payment_method: 'text', fianza_retained_reason: 'text', accessory_others: 'text',
  client_birthdate: 'date', client_license_exp: 'date', second_driver_license_exp: 'date',
  km_out: 'int', km_in: 'int', km_included: 'int',
  km_price_extra: 'number', cleaning_price: 'number', fianza_retained_amount: 'number',
  km_extra_package: 'bool', fianza_returned_full: 'bool', fianza_returned_partial: 'bool',
  clean_interior_yes: 'bool', clean_interior_no: 'bool', clean_exterior_yes: 'bool', clean_exterior_no: 'bool',
  accessory_permiso: 'bool', accessory_ficha: 'bool', accessory_llave: 'bool', accessory_llave_repuesto: 'bool',
  accessory_v16: 'bool', accessory_adaptador: 'bool', accessory_gancho: 'bool', accessory_chaleco: 'bool',
  accessory_rueda: 'bool', accessory_gato: 'bool', accessory_manual: 'bool'
};

// Devuelve { updates } con los valores ya convertidos, o { error } si alguno no es válido
function parseAdminBookingUpdates(body) {
  const updates = {};
  const enums = { status: BOOKING_STATUS_VALUES, fianza_status: FIANZA_STATUS_VALUES, payment_status: PAYMENT_STATUS_VALUES };
  for (const [field, allowed] of Object.entries(enums)) {
    if (body[field] === undefined) continue;
    if (!allowed.includes(body[field])) return { error: `Valor no válido para ${field}.` };
    updates[field] = body[field];
  }
  for (const [field, type] of Object.entries(ADMIN_BOOKING_FIELDS)) {
    if (body[field] === undefined) continue;
    const raw = body[field];
    const empty = raw === null || raw === '';
    if (type === 'text') {
      if (!empty && typeof raw !== 'string') return { error: `Valor no válido para ${field}.` };
      updates[field] = empty ? null : raw.trim().slice(0, 500);
    } else if (type === 'date') {
      if (!empty && !/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) return { error: `Fecha no válida en ${field}.` };
      updates[field] = empty ? null : String(raw);
    } else if (type === 'int' || type === 'number') {
      const num = empty ? 0 : Number(raw);
      if (!Number.isFinite(num) || num < 0) return { error: `Número no válido en ${field}.` };
      updates[field] = type === 'int' ? Math.round(num) : Math.round(num * 100) / 100;
    } else if (type === 'bool') {
      updates[field] = raw === true || raw === 'true' || raw === 1 || raw === '1' || raw === 'on';
    }
  }
  return { updates };
}

// 8. Actualizar una reserva (Protegido por Administrador): estado, fianza, pago y datos del contrato
app.put('/api/bookings/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { updates, error } = parseAdminBookingUpdates(req.body || {});
  if (error) {
    return res.status(400).json({ error });
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No hay cambios que guardar.' });
  }

  const applyToFallback = (message) => {
    const index = fallbackBookings.findIndex(b => b.id == id);
    if (index === -1) return res.status(404).json({ error: 'Reserva no encontrada.' });
    fallbackBookings[index] = { ...fallbackBookings[index], ...updates };
    saveAdminStoreToFile();
    if (updates.status) sendBookingStatusEmail(fallbackBookings[index], updates.status);
    return res.json({ message, booking: fallbackBookings[index] });
  };

  try {
    const columns = Object.keys(updates);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const result = await pool.query(
      `UPDATE bookings SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
      [...columns.map(col => updates[col]), id]
    );
    if (result.rowCount === 0) {
      return applyToFallback('Reserva actualizada en memoria fallback.');
    }

    const fbIndex = fallbackBookings.findIndex(b => b.id == id);
    if (fbIndex !== -1) {
      fallbackBookings[fbIndex] = result.rows[0];
    }
    saveAdminStoreToFile();
    if (updates.status) sendBookingStatusEmail(result.rows[0], updates.status);

    res.json({
      message: 'Reserva actualizada con éxito.',
      booking: result.rows[0]
    });
  } catch (err) {
    console.error('Error al actualizar reserva, intentando en memoria:', err.message);
    return applyToFallback('Reserva actualizada en memoria fallback (offline).');
  }
});

// 9. Subir fotos antes / después para una reserva (Protegido por Administrador con validación de tipo/tamaño)
// Borra del disco las fotos subidas en una petición que no llega a guardarse
function discardUploadedFiles(files) {
  (files || []).forEach(file => fs.unlink(file.path, () => {}));
}

app.post('/api/bookings/:id/photos', verifyAdmin, upload.array('photos', 10), async (req, res) => {
  const { id } = req.params;
  const { type } = req.body; // 'before' o 'after'

  if (!type || (type !== 'before' && type !== 'after')) {
    discardUploadedFiles(req.files);
    return res.status(400).json({ error: "El campo 'type' debe ser 'before' o 'after'." });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se han subido fotos.' });
  }
  if (!/^\d+$/.test(id)) {
    discardUploadedFiles(req.files);
    return res.status(404).json({ error: 'Reserva no encontrada.' });
  }

  const paths = req.files.map(file => '/uploads/' + file.filename);
  const column = type === 'before' ? 'photos_before' : 'photos_after';

  try {
    const result = await pool.query(
      `UPDATE bookings SET ${column} = array_cat(${column}, $1) WHERE id = $2 RETURNING *`,
      [paths, id]
    );

    if (result.rowCount === 0) {
      discardUploadedFiles(req.files);
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }

    const fBooking = fallbackBookings.find(b => b.id == id);
    if (fBooking) fBooking[column] = result.rows[0][column];
    res.json({
      message: 'Fotos subidas correctamente.',
      booking: result.rows[0]
    });
  } catch (err) {
    console.warn('Base de datos offline al guardar fotos, usando fallback:', err.message);
    const fBooking = fallbackBookings.find(b => b.id == id);
    if (!fBooking) {
      discardUploadedFiles(req.files);
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }
    fBooking[column] = [...(fBooking[column] || []), ...paths];
    saveAdminStoreToFile();
    res.json({ message: 'Fotos subidas correctamente (modo offline).', booking: fBooking });
  }
});

// 10. Eliminar una reserva (Protegido por Administrador)
app.delete('/api/bookings/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [id]);

    const fbIndex = fallbackBookings.findIndex(b => b.id == id);
    if (fbIndex !== -1) {
      fallbackBookings.splice(fbIndex, 1);
    }
    saveAdminStoreToFile();

    if (result.rowCount === 0 && fbIndex === -1) {
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }

    res.json({ message: 'Reserva eliminada con éxito.' });
  } catch (err) {
    console.error('Error al eliminar reserva, intentando en memoria:', err);
    const index = fallbackBookings.findIndex(b => b.id == id);
    if (index !== -1) {
      fallbackBookings.splice(index, 1);
      saveAdminStoreToFile();
      return res.json({ message: 'Reserva eliminada de memoria fallback (offline).' });
    }
    res.status(500).json({ error: 'Error del servidor al eliminar la reserva.' });
  }
});

// --- INTEGRACIÓN DE REDSYS TPV VIRTUAL / CYBERPAC CAIXABANK Y BIZUM ---

function encrypt3DES_zeroPad(order, secretKeyBase64) {
  const keyBuffer = Buffer.from(secretKeyBase64, 'base64');
  const iv = Buffer.alloc(8, 0);

  const orderBuf = Buffer.from(order, 'utf8');
  const padLen = 8 - (orderBuf.length % 8);
  const totalLen = (padLen === 8) ? orderBuf.length : orderBuf.length + padLen;
  const padded = Buffer.alloc(totalLen, 0);
  orderBuf.copy(padded);

  const cipher = crypto.createCipheriv('des-ede3-cbc', keyBuffer, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]);
}

function createRedsysSignature(secretKeyBase64, order, merchantParamsBase64) {
  const orderKey = encrypt3DES_zeroPad(order, secretKeyBase64);
  const hmac = crypto.createHmac('sha256', orderKey);
  hmac.update(merchantParamsBase64);
  const signatureBase64 = hmac.digest('base64');
  return signatureBase64.replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeRedsysParameters(merchantParamsBase64) {
  let normalized = merchantParamsBase64.replace(/-/g, '+').replace(/_/g, '/');
  const jsonStr = Buffer.from(normalized, 'base64').toString('utf8');
  return JSON.parse(jsonStr);
}

// Fechas 'AAAA-MM-DD' o 'DD/MM/AAAA', igual que parseSpanishDate en app.js
function parseBookingDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  let parts;
  if (dateStr.includes('-')) {
    parts = dateStr.split('-').map(n => parseInt(n, 10));
    if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  if (dateStr.includes('/')) {
    parts = dateStr.split('/').map(n => parseInt(n, 10));
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
}

// Precio calculado en el servidor con la misma fórmula que la calculadora de app.js:
// el total enviado por el navegador nunca se usa para cobrar
async function computeBookingQuote(bookingData) {
  const vanType = bookingData && bookingData.van_type;
  if (!vanType) return { error: 'Falta el tipo de furgoneta.' };

  let van = null;
  try {
    const vRes = await pool.query('SELECT * FROM vans WHERE van_type = $1', [vanType]);
    if (vRes.rowCount > 0) van = vRes.rows[0];
  } catch (e) {
    // BD no disponible: se usa el catálogo en memoria
  }
  if (!van) van = fallbackVans.find(v => v.van_type === vanType) || null;
  if (!van) return { error: 'La furgoneta seleccionada no existe.' };
  // Solo se reservan furgonetas activas (un borrador no aparece en la web, pero se podía pedir por la API)
  if (van.status && van.status !== 'active') return { error: 'La furgoneta seleccionada no está disponible.' };

  const start = parseBookingDate(bookingData.pickup_date);
  const end = parseBookingDate(bookingData.return_date);
  if (!start || !end || isNaN(start) || isNaN(end) || end < start) {
    return { error: 'Las fechas de la reserva no son válidas.' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start < today) {
    return { error: 'La fecha de recogida no puede ser anterior a hoy.' };
  }
  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const days = diffDays > 0 ? diffDays : 1;

  // Horas en formato HH:MM: se pintan en el panel admin y en el área de cliente
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if ([bookingData.pickup_time, bookingData.return_time].some(t => t !== undefined && t !== null && t !== '' && !timePattern.test(String(t)))) {
    return { error: 'Las horas de recogida y devolución no son válidas.' };
  }
  // Mismo día: la devolución tiene que ser después de la recogida
  if (end.getTime() === start.getTime() && bookingData.pickup_time && bookingData.return_time && String(bookingData.return_time) <= String(bookingData.pickup_time)) {
    return { error: 'La hora de devolución debe ser posterior a la de recogida.' };
  }

  const extras = [];
  let baseTaxable;
  if ((bookingData.rental_mode || 'sin') === 'sin') {
    let totalBase = parseFloat(van.price_sin) * days;
    if (days >= 3 && days <= 7) totalBase *= 0.95;

    let customExtras = van.custom_extras || [];
    if (typeof customExtras === 'string') {
      try { customExtras = JSON.parse(customExtras); } catch (e) { customExtras = []; }
    }
    // Los extras llegan como texto ("GPS Navegador (+5.00€/día)"); el precio y la etiqueta
    // guardada salen del catálogo, así nunca se almacena texto arbitrario del cliente
    let extrasCost = 0;
    const requested = Array.isArray(bookingData.extras) ? bookingData.extras : [];
    requested.forEach(label => {
      const extra = customExtras.find(x => x && x.name && String(label).startsWith(x.name));
      if (!extra || extras.some(e => e.startsWith(extra.name))) return;
      const price = parseFloat(extra.price) || 0;
      extrasCost += extra.type === 'daily' ? price * days : price;
      extras.push(`${extra.name} ${extra.type === 'daily' ? `(+${price.toFixed(2)}€/día)` : `(+${price.toFixed(2)}€ pago único)`}`);
    });
    baseTaxable = totalBase + extrasCost;
  } else {
    const kms = parseInt(bookingData.estimated_kms, 10) || 20;
    const wait = Math.max(0, parseFloat(bookingData.waiting_hours) || 0);
    const extraKmCost = kms > 20 ? (kms - 20) * parseFloat(van.km_price_con) : 0;
    const waitingRate = van.waiting_hour_price !== undefined && van.waiting_hour_price !== null ? parseFloat(van.waiting_hour_price) : 30.00;
    baseTaxable = parseFloat(van.min_price_con) + extraKmCost + (wait * waitingRate);
  }

  const total = Math.round(baseTaxable * 1.21 * 100) / 100;
  if (!(total > 0)) return { error: 'No se pudo calcular el importe de la reserva.' };
  return { total, days, van, extras };
}

function generateRedsysOrderId() {
  const now = new Date();
  const prefix = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');
  // 8 dígitos aleatorios criptográficos: el número de pedido sirve de llave para ver la reserva
  const suffix = String(crypto.randomInt(0, 100000000)).padStart(8, '0');
  return `${prefix}${suffix}`;
}

// Avisos de reserva pagada: confirmación al cliente y alta a la empresa. Nunca bloquea la respuesta
// Aviso al cliente cuando el admin confirma o cancela su reserva (antes no se enteraba)
async function sendBookingStatusEmail(booking, status) {
  if (!mailTransporter || !booking || !booking.client_email) return;
  if (status !== 'confirmed' && status !== 'cancelled') return;
  const senderAddress = process.env.SMTP_USER || 'confirmacion@rentmeuskar.com';
  const field = value => escapeHtml(String(value === undefined || value === null ? '' : value));
  const dates = `${field(String(booking.pickup_date).slice(0, 10))} ${field(booking.pickup_time)} → ${field(String(booking.return_date).slice(0, 10))} ${field(booking.return_time)}`;
  const confirmed = status === 'confirmed';
  try {
    await mailTransporter.sendMail({
      from: `"RentMeUskar" <${senderAddress}>`,
      to: booking.client_email,
      subject: confirmed ? `Reserva #${booking.id} confirmada · RentMeUskar` : `Reserva #${booking.id} cancelada · RentMeUskar`,
      html: `<div style="font-family: Arial, sans-serif;"><h2>${confirmed ? '¡Tu reserva está confirmada!' : 'Tu reserva ha sido cancelada'}</h2>
        <p>Hola ${field(booking.name)},</p>
        <p><strong>Vehículo:</strong> ${field(booking.van_name)}<br><strong>Fechas:</strong> ${dates}</p>
        <p>${confirmed ? `Te esperamos en la recogida. Recuerda traer DNI, carnet de conducir y la fianza de ${field(fallbackSettings.fianza_amount || '500,00')} €.` :'Si tienes cualquier duda o habías pagado online, contacta con nosotros y te ayudamos.'}</p></div>`
    });
  } catch (e) {
    console.error('[SMTP RESERVA] No se pudo enviar el aviso de cambio de estado:', e.message);
  }
}

async function sendBookingPaidEmails(booking, { dateConflict = false } = {}) {
  if (!mailTransporter || !booking) return;
  const senderAddress = process.env.SMTP_USER || 'confirmacion@rentmeuskar.com';
  const companyAddress = process.env.CONTACT_EMAIL || 'info@rentmeuskar.com';
  const field = value => escapeHtml(String(value === undefined || value === null ? '' : value));
  const dates = `${field(String(booking.pickup_date).slice(0, 10))} ${field(booking.pickup_time)} → ${field(String(booking.return_date).slice(0, 10))} ${field(booking.return_time)}`;
  const total = `${(parseFloat(booking.total_price) || 0).toFixed(2)} €`;
  const summary = `
    <p><strong>Reserva:</strong> #${field(booking.id)} · Pedido ${field(booking.payment_id)}</p>
    <p><strong>Vehículo:</strong> ${field(booking.van_name)}</p>
    <p><strong>Fechas:</strong> ${dates}</p>
    <p><strong>Importe pagado:</strong> ${total} (la fianza de ${field(fallbackSettings.fianza_amount || '500,00')} € se deposita al recoger)</p>`;

  const messages = [{
    from: `"RentMeUskar Reservas" <${senderAddress}>`,
    to: companyAddress,
    subject: `${dateConflict ? '⚠ CONFLICTO DE FECHAS · ' : ''}Nueva reserva pagada #${booking.id} (${total})`,
    html: `<div style="font-family: Arial, sans-serif;"><h2>Nueva reserva pagada</h2>${dateConflict
      ? '<p style="color:#b91c1c;"><strong>Atención:</strong> el pago llegó cuando la reserva ya había caducado y sus fechas están ocupadas por otra reserva o un bloqueo. Revisa el calendario y contacta con el cliente.</p>' : ''}${summary}
      <p><strong>Cliente:</strong> ${field(booking.name)} · ${field(booking.client_email)} · ${field(booking.client_phone)}</p>
      <p>Revísala y confírmala en el panel de administración.</p></div>`
  }];
  if (booking.client_email) {
    messages.push({
      from: `"RentMeUskar" <${senderAddress}>`,
      to: booking.client_email,
      subject: `Pago recibido · Reserva #${booking.id} RentMeUskar`,
      html: `<div style="font-family: Arial, sans-serif;"><h2>¡Gracias, ${field(booking.name)}!</h2>
        <p>Hemos recibido el pago de tu reserva. Te confirmaremos la recogida en breve.</p>${summary}
        <p>Puedes ver tu factura y contrato en tu área de cliente de rentmeuskar.com.</p></div>`
    });
  }
  for (const message of messages) {
    try {
      await mailTransporter.sendMail(message);
    } catch (e) {
      console.error('[SMTP RESERVA] No se pudo enviar el aviso de reserva pagada:', e.message);
    }
  }
}

// Modo de cobro online: 'test' (TPV simulado), 'redsys' (pasarela real) u 'off'
function getPaymentMode() {
  if (process.env.ENABLE_TEST_PAYMENTS === 'true') return 'test';
  if (process.env.REDSYS_MERCHANT_CODE && process.env.REDSYS_SECRET_KEY) return 'redsys';
  return 'off';
}

// Minutos que una reserva a la espera de pago en Redsys bloquea las fechas
const PENDING_PAYMENT_HOLD_MINUTES = 30;

// Las reservas canceladas o con el pago abandonado no ocupan la furgoneta
const ACTIVE_BOOKING_SQL = `(status IS NULL OR (status != 'cancelled' AND NOT (status = 'pending_payment' AND created_at < NOW() - INTERVAL '${PENDING_PAYMENT_HOLD_MINUTES} minutes')))`;

function isActiveFallbackBooking(b) {
  if (!b.status) return true;
  if (b.status === 'cancelled') return false;
  if (b.status === 'pending_payment') {
    const created = new Date(b.created_at).getTime();
    return !isNaN(created) && Date.now() - created < PENDING_PAYMENT_HOLD_MINUTES * 60 * 1000;
  }
  return true;
}

// Libre = sin reservas activas que se solapen y sin bloqueos del admin (mantenimiento, etc.)
async function isVanAvailable(vanType, pickupDate, returnDate) {
  try {
    const checkRes = await pool.query(`
      SELECT id FROM bookings
      WHERE van_type = $1
        AND ${ACTIVE_BOOKING_SQL}
        AND rental_mode = 'sin'
        AND pickup_date <= $3 AND return_date >= $2
      UNION ALL
      SELECT id FROM van_blockages
      WHERE van_type = $1 AND start_date <= $3 AND end_date >= $2
    `, [vanType, pickupDate, returnDate]);
    return checkRes.rowCount === 0;
  } catch (e) {
    const start = parseBookingDate(pickupDate);
    const end = parseBookingDate(returnDate);
    const overlaps = (from, to) => {
      const bStart = parseBookingDate(String(from).slice(0, 10));
      const bEnd = parseBookingDate(String(to).slice(0, 10));
      return bStart && bEnd && start <= bEnd && end >= bStart;
    };
    const bookingClash = fallbackBookings.some(b =>
      b.van_type === vanType && (b.rental_mode || 'sin') === 'sin' && isActiveFallbackBooking(b) && overlaps(b.pickup_date, b.return_date));
    const blockageClash = fallbackBlockages.some(b => b.van_type === vanType && overlaps(b.start_date, b.end_date));
    return !bookingClash && !blockageClash;
  }
}

// Solicitudes abiertas de un cliente en un estado ('pending' o 'pending_payment' aún vigente):
// limita que una cuenta bloquee el calendario con reservas que nunca paga
async function countOpenBookings(userId, status) {
  try {
    const r = await pool.query(
      `SELECT COUNT(*) FROM bookings WHERE user_id = $1 AND status = $2 AND ${ACTIVE_BOOKING_SQL}`,
      [userId, status]
    );
    return parseInt(r.rows[0].count, 10) || 0;
  } catch (e) {
    return fallbackBookings.filter(b => String(b.user_id) === String(userId) && b.status === status && isActiveFallbackBooking(b)).length;
  }
}

const MAX_OPEN_PAYMENTS_PER_USER = 1;
const MAX_OPEN_REQUESTS_PER_USER = 2;

// Inserta la reserva en PostgreSQL o, sin BD, en el almacén en memoria/disco
async function saveBookingRecord(record) {
  const columns = [
    'name', 'van_type', 'van_name', 'pickup_date', 'pickup_time',
    'return_date', 'return_time', 'days', 'extras', 'total_price',
    'user_id', 'fianza_status', 'payment_status', 'payment_id', 'status',
    'rental_mode', 'estimated_kms', 'waiting_hours', 'van_plate', 'van_m3',
    'review_code', 'payment_method', 'client_email', 'client_phone', 'client_dni'
  ];
  try {
    const values = columns.map(c => c === 'extras' ? JSON.stringify(record.extras || []) : record[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(`INSERT INTO bookings (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`, values);
    const saved = result.rows[0];
    fallbackBookings.push(saved);
    saveAdminStoreToFile();
    return saved;
  } catch (dbErr) {
    console.warn('Reserva guardada en memoria (BD no disponible):', dbErr.message);
    const mockId = fallbackBookings.length > 0 ? Math.max(...fallbackBookings.map(b => b.id)) + 1 : 1;
    const saved = { id: mockId, ...record, created_at: new Date().toISOString() };
    fallbackBookings.push(saved);
    saveAdminStoreToFile();
    return saved;
  }
}

function generateReviewCode() {
  // El código abre contrato y factura: 10 hex (~1 billón de combinaciones). Los antiguos de 6 siguen valiendo.
  return 'RMU-' + crypto.randomBytes(5).toString('hex').toUpperCase();
}

app.get('/api/payment-config', (req, res) => {
  res.json({ mode: getPaymentMode() });
});

// 1. Crear la reserva pendiente y los parámetros firmados para redirigir al TPV de Redsys
app.post('/api/redsys/create-payment', async (req, res) => {
  try {
    const { bookingData, payMethod } = req.body;
    if (!bookingData) {
      return res.status(400).json({ error: 'Faltan datos de la reserva.' });
    }

    const merchantCode = process.env.REDSYS_MERCHANT_CODE;
    const terminal = process.env.REDSYS_TERMINAL || '1';
    const currency = process.env.REDSYS_CURRENCY || '978';
    const secretKey = process.env.REDSYS_SECRET_KEY;
    if (!merchantCode || !secretKey) {
      return res.status(503).json({ error: 'La pasarela de pago no está configurada.' });
    }

    // Solo alquiler sin conductor de hasta 7 días se paga online (mismo criterio que app.js)
    if ((bookingData.rental_mode || 'sin') !== 'sin') {
      return res.status(400).json({ error: 'El alquiler con conductor no se paga online.' });
    }
    const quote = await computeBookingQuote(bookingData);
    if (quote.error) {
      return res.status(400).json({ error: quote.error });
    }
    if (quote.days > 7) {
      return res.status(400).json({ error: 'Los alquileres de más de 7 días se gestionan por WhatsApp.' });
    }
    // Reservar exige sesión y como mucho un pago pendiente a la vez por cliente
    const payer = await getAuthUser(req);
    if (!payer || payer.isAdmin) {
      return res.status(401).json({ error: 'Inicia sesión con tu cuenta de cliente para pagar la reserva.' });
    }
    if ((await countOpenBookings(payer.id, 'pending_payment')) >= MAX_OPEN_PAYMENTS_PER_USER) {
      return res.status(429).json({ error: 'Ya tienes un pago en curso. Complétalo o espera unos minutos antes de iniciar otro.' });
    }

    if (!(await isVanAvailable(bookingData.van_type, bookingData.pickup_date, bookingData.return_date))) {
      return res.status(400).json({ error: 'La furgoneta seleccionada no está disponible en las fechas elegidas.' });
    }

    const totalEuros = quote.total;
    const amountCents = Math.round(totalEuros * 100).toString();

    // Número de pedido Redsys: 12 dígitos, también es la llave de la reserva
    const numOrder = generateRedsysOrderId();

    const authUser = payer;
    const isBizum = payMethod === 'bizum';
    await saveBookingRecord({
      name: String(bookingData.name || (authUser && authUser.name) || 'Cliente').trim().slice(0, 100),
      van_type: bookingData.van_type,
      van_name: quote.van.name || bookingData.van_name,
      pickup_date: bookingData.pickup_date,
      pickup_time: bookingData.pickup_time || null,
      return_date: bookingData.return_date,
      return_time: bookingData.return_time || null,
      days: quote.days,
      extras: quote.extras,
      total_price: totalEuros,
      user_id: authUser && !authUser.isAdmin && typeof authUser.id === 'number' ? authUser.id : null,
      fianza_status: 'pending',
      payment_status: 'pending',
      payment_id: numOrder,
      status: 'pending_payment',
      rental_mode: 'sin',
      estimated_kms: 0,
      waiting_hours: 0,
      van_plate: quote.van.plate || '',
      van_m3: quote.van.m3 || '',
      review_code: generateReviewCode(),
      payment_method: isBizum ? 'Bizum (Redsys)' : 'Tarjeta (Redsys)',
      client_email: (bookingData.client_email || (authUser && authUser.email) || '').trim().toLowerCase() || null,
      client_phone: (bookingData.client_phone || (authUser && authUser.phone) || '').trim() || null,
      client_dni: (bookingData.client_dni || (authUser && authUser.dni) || '').trim().toUpperCase() || null
    });

    const redsysUrl = process.env.REDSYS_URL || 'https://sis-t.redsys.es:25443/sis/realizarPago';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'rentmeuskar.com';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : (isLocal ? 'http' : 'https'));
    const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;

    const merchantParamsObj = {
      DS_MERCHANT_AMOUNT: amountCents,
      DS_MERCHANT_ORDER: numOrder,
      DS_MERCHANT_MERCHANTCODE: merchantCode,
      DS_MERCHANT_CURRENCY: currency,
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: terminal,
      DS_MERCHANT_MERCHANTURL: `${baseUrl}/api/redsys/notification`,
      DS_MERCHANT_URLOK: `${baseUrl}/payment-success.html?order=${numOrder}`,
      DS_MERCHANT_URLKO: `${baseUrl}/payment-error.html?order=${numOrder}`,
      DS_MERCHANT_MERCHANTNAME: 'RentMeUskar'
    };

    if (isBizum) {
      merchantParamsObj.DS_MERCHANT_PAYMETHODS = 'z';
    }

    const merchantParamsJsonStr = JSON.stringify(merchantParamsObj);
    const merchantParamsBase64 = Buffer.from(merchantParamsJsonStr).toString('base64');
    const signature = createRedsysSignature(secretKey, numOrder, merchantParamsBase64);

    res.json({
      actionUrl: redsysUrl,
      params: {
        Ds_SignatureVersion: 'HMAC_SHA256_V1',
        Ds_MerchantParameters: merchantParamsBase64,
        Ds_Signature: signature
      },
      orderId: numOrder,
      totalAmount: totalEuros
    });
  } catch (err) {
    console.error('Error al crear pago Redsys:', err);
    res.status(500).json({ error: 'Error al generar los datos de pago seguro de Redsys.' });
  }
});

// 2. Procesamiento de pago seguro CaixaBank en entorno de demostración (solo tarjetas de prueba autorizadas)
const handleTestPayment = async (req, res) => {
  try {
    // El TPV simulado marca reservas como pagadas sin cobrar: solo se activa expresamente (local/pruebas)
    if (process.env.ENABLE_TEST_PAYMENTS !== 'true') {
      return res.status(503).json({ error: 'El pago online no está disponible en este momento. Contacta con nosotros por WhatsApp o teléfono para completar tu reserva.' });
    }

    const { bookingData, payMethod, cardDetails } = req.body;
    if (!bookingData) {
      return res.status(400).json({ error: 'Faltan datos de la reserva para procesar el pago.' });
    }
    if (payMethod !== 'bizum' && !(cardDetails && cardDetails.cardNumber)) {
      return res.status(400).json({ error: 'Faltan los datos de la tarjeta.' });
    }

    // Doble validación de seguridad: en entorno de pruebas ÚNICAMENTE se autorizan tarjetas de test de Redsys / CaixaBank
    if (payMethod === 'card' && cardDetails && cardDetails.cardNumber) {
      const cleanCard = String(cardDetails.cardNumber).replace(/\s+/g, '');
      const isApprovedTestCard = /^(454881|519999)\d{10}$/.test(cleanCard) ||
                                 cleanCard === '4548810000000003' ||
                                 cleanCard === '4548810000000004' ||
                                 cleanCard === '5199999999999999' ||
                                 cleanCard === '4548810000000000';
      const isDeniedTestCard = cleanCard === '1111111111111117';

      if (!isApprovedTestCard && !isDeniedTestCard) {
        return res.status(400).json({
          error: 'Operación denegada (Error SIS0054): En este entorno de demostración únicamente se autorizan tarjetas de prueba oficiales de CaixaBank (Aprobada: 4548 8100 0000 0003 | Denegada: 1111 1111 1111 1117). Por seguridad de su cuenta bancaria, las tarjetas reales no están permitidas.'
        });
      }

      // Si es la tarjeta oficial de prueba denegada, simular denegación bancaria SIS0051 / 101
      if (isDeniedTestCard) {
        const deniedOrder = 'TPV-DENIED-' + generateRedsysOrderId();
        return res.status(402).json({
          error: 'Operación denegada por la entidad emisora (Código SIS0051 / 101: Tarjeta rechazada).',
          orderId: deniedOrder,
          redirectUrl: `/payment-error.html?order=${deniedOrder}`
        });
      }
    }

    // Solo alquiler sin conductor de hasta 7 días se paga online (mismo criterio que app.js)
    if ((bookingData.rental_mode || 'sin') !== 'sin') {
      return res.status(400).json({ error: 'El alquiler con conductor no se paga online.' });
    }
    const quote = await computeBookingQuote(bookingData);
    if (quote.error) {
      return res.status(400).json({ error: quote.error });
    }
    if (quote.days > 7) {
      return res.status(400).json({ error: 'Los alquileres de más de 7 días se gestionan por WhatsApp.' });
    }
    const rentAmount = quote.total;
    bookingData.days = quote.days;
    bookingData.extras = quote.extras;
    bookingData.van_name = quote.van.name || bookingData.van_name;
    bookingData.name = String(bookingData.name || 'Cliente').trim().slice(0, 100);

    const numOrder = 'TPV-' + generateRedsysOrderId();
    const methodName = payMethod === 'bizum' ? 'Bizum CaixaBank (Test)' : 'Tarjeta CaixaBank (Test)';

    // Validar colisión de fechas
    if (!(await isVanAvailable(bookingData.van_type, bookingData.pickup_date, bookingData.return_date))) {
      return res.status(400).json({ error: 'La furgoneta seleccionada no está disponible en las fechas elegidas.' });
    }

    // Obtener matrícula y volumen m3
    let realPlate = '';
    let realM3 = '';
    try {
      const vanRes = await pool.query('SELECT plate, m3 FROM vans WHERE van_type = $1', [bookingData.van_type]);
      if (vanRes.rowCount > 0) {
        realPlate = vanRes.rows[0].plate;
        realM3 = vanRes.rows[0].m3;
      } else {
        realPlate = bookingData.van_type === 'medium' ? '3681 MCC' : '3758 MDW';
        realM3 = bookingData.van_type === 'medium' ? '8m³' : '14m³';
      }
    } catch (e) {
      realPlate = bookingData.van_type === 'medium' ? '3681 MCC' : '3758 MDW';
      realM3 = bookingData.van_type === 'medium' ? '8m³' : '14m³';
    }

    // Resolver usuario autenticado y detalles de contacto
    const authUser = await getAuthUser(req);
    const clientEmail = (bookingData.client_email || (authUser && authUser.email) || '').trim().toLowerCase();
    const clientPhone = (bookingData.client_phone || (authUser && authUser.phone) || '').trim();
    const clientDni = (bookingData.client_dni || (authUser && authUser.dni) || '').trim().toUpperCase();

    // Validar user_id frente a tabla users (solo el usuario autenticado, nunca el enviado en el cuerpo)
    let validUserId = null;
    if (authUser && authUser.id && typeof authUser.id === 'number' && authUser.id !== 9999) {
      try {
        const uRes = await pool.query('SELECT id FROM users WHERE id = $1', [authUser.id]);
        if (uRes.rowCount > 0) validUserId = uRes.rows[0].id;
      } catch (e) {}
    }
    if (!validUserId && clientEmail) {
      try {
        const uRes = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [clientEmail]);
        if (uRes.rowCount > 0) validUserId = uRes.rows[0].id;
      } catch (e) {}
    }

    const reviewCode = generateReviewCode();
    let savedBooking = null;

    try {
      const query = `
        INSERT INTO bookings (
          name, van_type, van_name, pickup_date, pickup_time, 
          return_date, return_time, days, extras, total_price,
          user_id, fianza_status, payment_status, payment_id, status,
          rental_mode, estimated_kms, waiting_hours, van_plate, van_m3,
          review_code, payment_method, client_email, client_phone, client_dni
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        RETURNING *;
      `;
      const values = [
        bookingData.name,
        bookingData.van_type,
        bookingData.van_name,
        bookingData.pickup_date,
        bookingData.pickup_time,
        bookingData.return_date,
        bookingData.return_time,
        bookingData.days,
        JSON.stringify(bookingData.extras || []),
        rentAmount,
        validUserId,
        bookingData.rental_mode === 'sin' ? 'pending' : 'refunded',
        'paid',
        numOrder,
        'paid_pending',
        bookingData.rental_mode || 'sin',
        bookingData.estimated_kms || 0,
        bookingData.waiting_hours || 0.00,
        realPlate,
        realM3,
        reviewCode,
        methodName,
        clientEmail || null,
        clientPhone || null,
        clientDni || null
      ];
      const result = await pool.query(query, values);
      savedBooking = result.rows[0];
      fallbackBookings.push(savedBooking);
      saveAdminStoreToFile();
    } catch (dbErr) {
      console.warn('Simulación con guardado en memoria fallback:', dbErr.message);
      const mockId = fallbackBookings.length > 0 ? Math.max(...fallbackBookings.map(b => b.id)) + 1 : 1;
      savedBooking = {
        id: mockId,
        name: bookingData.name,
        van_type: bookingData.van_type,
        van_name: bookingData.van_name,
        pickup_date: bookingData.pickup_date,
        pickup_time: bookingData.pickup_time,
        return_date: bookingData.return_date,
        return_time: bookingData.return_time,
        days: bookingData.days,
        extras: bookingData.extras || [],
        total_price: rentAmount,
        user_id: validUserId,
        fianza_status: bookingData.rental_mode === 'sin' ? 'pending' : 'refunded',
        payment_status: 'paid',
        payment_id: numOrder,
        payment_method: methodName,
        status: 'paid_pending',
        rental_mode: bookingData.rental_mode || 'sin',
        estimated_kms: bookingData.estimated_kms || 0,
        waiting_hours: bookingData.waiting_hours || 0.00,
        van_plate: realPlate,
        van_m3: realM3,
        review_code: reviewCode,
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
        client_dni: clientDni || null,
        created_at: new Date().toISOString()
      };
      fallbackBookings.push(savedBooking);
      saveAdminStoreToFile();
    }

    sendBookingPaidEmails(savedBooking);

    res.status(201).json({
      success: true,
      orderId: numOrder,
      redirectUrl: `/payment-success.html?order=${encodeURIComponent(numOrder)}`,
      booking: savedBooking
    });
  } catch (err) {
    console.error('Error al procesar pago Redsys test:', err);
    res.status(500).json({ error: 'Error en el procesamiento del pago. Inténtalo de nuevo.' });
  }
};

app.post('/api/redsys/simulate-payment', handleTestPayment);
app.post('/api/redsys/process-test-payment', handleTestPayment);

// 3. Confirmación de pago desde el cliente (llamado al cargar payment-success.html)
app.post('/api/redsys/confirm-payment', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Se requiere orderId' });
    }

    // Solo lectura: el pago lo marcan la notificación firmada de Redsys o el TPV de pruebas,
    // nunca esta llamada pública desde la página de éxito
    let booking = null;
    try {
      const bRes = await pool.query(
        "SELECT * FROM bookings WHERE payment_id = $1 AND payment_status = 'paid'",
        [String(orderId)]
      );
      if (bRes.rowCount > 0) {
        booking = bRes.rows[0];
      }
    } catch (dbErr) {
      console.warn('Error consultando pago en PostgreSQL:', dbErr.message);
    }

    if (!booking) {
      booking = fallbackBookings.find(b => b.payment_id == orderId && b.payment_status === 'paid') || null;
    }

    if (!booking) {
      return res.status(404).json({ error: 'No se encontró ningún pago confirmado con este identificador.' });
    }

    res.json({
      success: true,
      orderId,
      booking: {
        id: booking.id,
        name: booking.name,
        van_name: booking.van_name,
        pickup_date: booking.pickup_date,
        return_date: booking.return_date,
        total_price: booking.total_price,
        review_code: booking.review_code,
        payment_id: booking.payment_id
      }
    });
  } catch (err) {
    console.error('Error al confirmar pago:', err);
    res.status(500).json({ error: 'Error al consultar el pago. Inténtalo de nuevo.' });
  }
});

// 4. Cancelación de pago (llamado al cargar payment-error.html o cancelar)
app.post('/api/redsys/cancel-payment', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (orderId) {
      try {
        // Solo se cancela lo que aún espera pago: una reserva pagada nunca se toca desde aquí
        await pool.query(
          "UPDATE bookings SET status = 'cancelled', payment_status = 'failed' WHERE payment_id = $1 AND payment_status != 'paid'",
          [String(orderId)]
        );
      } catch (dbErr) {
        console.warn('Error cancelando pago en PostgreSQL:', dbErr.message);
      }
      const fBooking = fallbackBookings.find(b => b.payment_id == orderId);
      if (fBooking && fBooking.payment_status !== 'paid') {
        fBooking.status = 'cancelled';
        fBooking.payment_status = 'failed';
        saveAdminStoreToFile();
      }
    }
    res.json({ success: true, message: 'Pago cancelado y disponibilidad liberada.' });
  } catch (err) {
    console.error('Error al cancelar pago:', err);
    res.status(500).json({ error: 'Error al cancelar pago.' });
  }
});

// 5. Notificación webhook en segundo plano enviada por Redsys
app.post('/api/redsys/notification', async (req, res) => {
  try {
    const { Ds_SignatureVersion, Ds_MerchantParameters, Ds_Signature } = req.body;
    if (typeof Ds_MerchantParameters !== 'string' || typeof Ds_Signature !== 'string') {
      return res.status(400).send('Parámetros no encontrados');
    }

    let decodedParams;
    try {
      decodedParams = decodeRedsysParameters(Ds_MerchantParameters);
    } catch (parseErr) {
      return res.status(400).send('Parámetros no válidos');
    }
    const orderId = decodedParams.DS_ORDER || decodedParams.Ds_Order;
    const responseCodeStr = decodedParams.DS_RESPONSE || decodedParams.Ds_Response;
    const responseCode = parseInt(responseCodeStr, 10);

    const secretKey = process.env.REDSYS_SECRET_KEY;
    if (!secretKey) {
      console.error('[REDSYS] Notificación recibida pero falta REDSYS_SECRET_KEY en el entorno');
      return res.status(503).send('Pasarela no configurada');
    }
    const expectedSignature = createRedsysSignature(secretKey, orderId, Ds_MerchantParameters);

    if (expectedSignature !== Ds_Signature && expectedSignature.replace(/_/g, '/') !== Ds_Signature.replace(/_/g, '/')) {
      console.error('Firma Redsys no válida en notificación para orden:', orderId);
      return res.status(400).send('Firma no válida');
    }

    // El comercio y el importe cobrado deben coincidir con la reserva pendiente
    const notifiedMerchant = String(decodedParams.Ds_MerchantCode || decodedParams.DS_MERCHANTCODE || '');
    const notifiedAmount = parseInt(decodedParams.Ds_Amount || decodedParams.DS_AMOUNT, 10);
    let booking = null;
    try {
      const bRes = await pool.query('SELECT * FROM bookings WHERE payment_id = $1', [String(orderId)]);
      if (bRes.rowCount > 0) booking = bRes.rows[0];
    } catch (dbErr) {
      console.warn('[REDSYS] BD offline, buscando reserva fallback:', dbErr.message);
    }
    const fBooking = fallbackBookings.find(b => b.payment_id == orderId);
    if (!booking) booking = fBooking || null;
    if (!booking) {
      console.error(`[REDSYS] Notificación para un pedido sin reserva: ${orderId}`);
      return res.status(200).send('OK');
    }
    if (booking.payment_status === 'paid') {
      return res.status(200).send('OK');
    }

    const amountMatches = notifiedAmount === Math.round(parseFloat(booking.total_price) * 100);
    const merchantMatches = notifiedMerchant === String(process.env.REDSYS_MERCHANT_CODE);
    const authorized = responseCode >= 0 && responseCode <= 99 && amountMatches && merchantMatches;
    if (responseCode >= 0 && responseCode <= 99 && !authorized) {
      console.error(`[REDSYS] Pago autorizado pero no coincide con la reserva (importe: ${amountMatches}, comercio: ${merchantMatches}). Orden: ${orderId}`);
    }

    // Pago llegado tarde: la reserva ya había soltado sus fechas (cancelada o reserva caducada) y
    // otra puede haberlas ocupado. El cobro se registra igual, pero se avisa a la empresa.
    let dateConflict = false;
    if (authorized && (booking.rental_mode || 'sin') === 'sin' && !isActiveFallbackBooking(booking)) {
      dateConflict = !(await isVanAvailable(booking.van_type, String(booking.pickup_date).slice(0, 10), String(booking.return_date).slice(0, 10)));
      if (dateConflict) {
        console.error(`[REDSYS] Pago recibido para la orden ${orderId} pero sus fechas ya están ocupadas por otra reserva o un bloqueo. Revisar a mano.`);
      }
    }

    const newStatus = authorized ? 'paid_pending' : 'cancelled';
    const newPaymentStatus = authorized ? 'paid' : 'failed';
    try {
      await pool.query(
        "UPDATE bookings SET status = $1, payment_status = $2 WHERE payment_id = $3 AND payment_status != 'paid'",
        [newStatus, newPaymentStatus, String(orderId)]
      );
    } catch (dbErr) {
      console.warn('[REDSYS] BD offline, actualizando reserva fallback:', dbErr.message);
    }
    if (fBooking) {
      fBooking.status = newStatus;
      fBooking.payment_status = newPaymentStatus;
      saveAdminStoreToFile();
    }

    if (authorized) {
      console.log(`[REDSYS] ¡PAGO AUTORIZADO CORRECTAMENTE! Orden: ${orderId}`);
      sendBookingPaidEmails({ ...booking, status: newStatus, payment_status: newPaymentStatus }, { dateConflict });
    } else {
      console.warn(`[REDSYS] Pago denegado o cancelado. Orden: ${orderId}, Código: ${responseCodeStr}`);
    }
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Error en webhook de Redsys:', err);
    res.status(500).send('Error interno');
  }
});

// Soporte para redirecciones POST de vuelta desde Redsys hacia URLOK y URLKO
app.post('/payment-success.html', (req, res) => {
  let orderId = req.query.order || '';
  if (req.body && req.body.Ds_MerchantParameters) {
    try {
      const decoded = decodeRedsysParameters(req.body.Ds_MerchantParameters);
      orderId = decoded.DS_ORDER || decoded.Ds_Order || orderId;
    } catch (e) {}
  }
  res.redirect(`/payment-success.html?order=${encodeURIComponent(orderId)}`);
});

app.post('/payment-error.html', (req, res) => {
  let orderId = req.query.order || '';
  if (req.body && req.body.Ds_MerchantParameters) {
    try {
      const decoded = decodeRedsysParameters(req.body.Ds_MerchantParameters);
      orderId = decoded.DS_ORDER || decoded.Ds_Order || orderId;
    } catch (e) {}
  }
  res.redirect(`/payment-error.html?order=${encodeURIComponent(orderId)}`);
});


// 1. Obtener furgonetas activas (público)
app.get('/api/vans', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM vans WHERE status = 'active' ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.warn('Base de datos offline, enviando furgonetas fallback:', err.message);
    res.json(fallbackVans.filter(v => v.status === 'active'));
  }
});

// 2. Obtener todas las furgonetas (admin)
app.get('/api/admin/vans', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM vans ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.warn('Base de datos offline, enviando furgonetas fallback para admin:', err.message);
    res.json(fallbackVans);
  }
});

// 3. Crear una nueva furgoneta
// Precios de una furgoneta: números válidos, no negativos y tarifa diaria mayor que cero
function vanPriceError(body) {
  const fields = { price_sin: 'Tarifa diaria', min_price_con: 'Tarifa mínima con conductor', km_price_con: 'Precio por km', waiting_hour_price: 'Hora de espera' };
  for (const [field, label] of Object.entries(fields)) {
    if (body[field] === undefined || body[field] === '') continue;
    const value = Number(String(body[field]).replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) return `${label}: introduce un número válido (0 o mayor).`;
    if (field === 'price_sin' && value === 0) return 'La tarifa diaria debe ser mayor que 0.';
    // "89,50" se guarda como 89.50 (parseFloat lo habría dejado en 89)
    body[field] = String(value);
  }
  return null;
}

app.post('/api/vans', verifyAdmin, upload.array('images', 20), async (req, res) => {
  // Primero: valida y normaliza los precios (la desestructuración de abajo ya lee los valores limpios)
  const postPriceError = vanPriceError(req.body || {});
  if (postPriceError) {
    return res.status(400).json({ error: postPriceError });
  }
  const { van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status, max_occupants, eco_label, daily_km_limit, max_mass, fuel_type, waiting_hour_price } = req.body;
  if (!van_type || !name || !plate || !m3 || price_sin === undefined || min_price_con === undefined || km_price_con === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la furgoneta.' });
  }

  const newImages = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
  
  let finalImages = [];
  if (req.body.image_order) {
    try {
      const order = JSON.parse(req.body.image_order);
      finalImages = order.map(item => {
        if (item.startsWith('server:')) {
          return item.substring(7);
        } else if (item.startsWith('file:')) {
          const fileIndex = parseInt(item.substring(5));
          return newImages[fileIndex];
        }
      }).filter(Boolean);
    } catch (e) {
      console.error('Error parsing image_order:', e);
      finalImages = newImages;
    }
  } else {
    finalImages = newImages;
  }
  
  let customExtras = [];
  if (req.body.custom_extras) {
    try {
      customExtras = typeof req.body.custom_extras === 'string' ? JSON.parse(req.body.custom_extras) : req.body.custom_extras;
    } catch (e) {
      console.error('Error parsing custom_extras:', e);
    }
  }

  let customFeatures = [];
  if (req.body.custom_features) {
    try {
      customFeatures = typeof req.body.custom_features === 'string' ? JSON.parse(req.body.custom_features) : req.body.custom_features;
    } catch (e) {
      console.error('Error parsing custom_features:', e);
    }
  }

  try {
    // Comprobar si ya existe el tipo
    const checkRes = await pool.query('SELECT id FROM vans WHERE van_type = $1', [van_type]);
    if (checkRes.rowCount > 0) {
      return res.status(400).json({ error: 'Ya existe un tipo de furgoneta registrado con ese identificador.' });
    }

    const query = `
      INSERT INTO vans (van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status, images, custom_extras, max_occupants, eco_label, daily_km_limit, max_mass, fuel_type, waiting_hour_price, custom_features)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *;
    `;
    const values = [
      van_type, 
      name, 
      plate, 
      m3, 
      parseFloat(price_sin), 
      parseFloat(min_price_con), 
      parseFloat(km_price_con), 
      status || 'active', 
      finalImages,
      JSON.stringify(customExtras),
      parseInt(max_occupants) || 3,
      eco_label || 'C',
      parseInt(daily_km_limit) || 350,
      parseInt(max_mass) || 2800,
      fuel_type || 'GASOIL',
      parseFloat(waiting_hour_price) || 30.00,
      JSON.stringify(customFeatures)
    ];
    const result = await pool.query(query, values);
    
    // Sincronizar catálogo local y guardar en disco
    const index = fallbackVans.findIndex(v => v.van_type === van_type);
    if (index === -1) {
      fallbackVans.push(result.rows[0]);
    } else {
      fallbackVans[index] = result.rows[0];
    }
    saveAdminStoreToFile();
    
    res.status(201).json({
      message: 'Furgoneta registrada con éxito.',
      van: result.rows[0]
    });
  } catch (err) {
    console.warn('Base de datos offline, simulando inserción en memoria:', err.message);
    if (fallbackVans.some(v => v.van_type === van_type)) {
      return res.status(400).json({ error: 'Ya existe una furgoneta con ese identificador (tipo ID).' });
    }
    const newVan = {
      id: fallbackVans.length > 0 ? Math.max(...fallbackVans.map(v => v.id)) + 1 : 1,
      van_type,
      name,
      plate,
      m3,
      price_sin: parseFloat(price_sin),
      min_price_con: parseFloat(min_price_con),
      km_price_con: parseFloat(km_price_con),
      status: status || 'active',
      images: finalImages,
      custom_extras: customExtras,
      max_occupants: parseInt(max_occupants) || 3,
      eco_label: eco_label || 'C',
      daily_km_limit: parseInt(daily_km_limit) || 350,
      max_mass: parseInt(max_mass) || 2800,
      fuel_type: fuel_type || 'GASOIL',
      waiting_hour_price: parseFloat(waiting_hour_price) || 30.00,
      custom_features: customFeatures
    };
    fallbackVans.push(newVan);
    saveAdminStoreToFile();
    res.status(201).json({
      message: 'Furgoneta añadida temporalmente (Modo offline sin BD).',
      van: newVan
    });
  }
});

// 4. Modificar una furgoneta
app.put('/api/vans/:id', verifyAdmin, upload.array('images', 20), async (req, res) => {
  const putPriceError = vanPriceError(req.body || {});
  if (putPriceError) {
    return res.status(400).json({ error: putPriceError });
  }
  const { id } = req.params;
  const { van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status, max_occupants, eco_label, daily_km_limit, max_mass, fuel_type, waiting_hour_price } = req.body;

  const newImages = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
  
  let finalImages = [];
  if (req.body.image_order) {
    try {
      const order = JSON.parse(req.body.image_order);
      finalImages = order.map(item => {
        if (item.startsWith('server:')) {
          return item.substring(7);
        } else if (item.startsWith('file:')) {
          const fileIndex = parseInt(item.substring(5));
          return newImages[fileIndex];
        }
      }).filter(Boolean);
    } catch (e) {
      console.error('Error parsing image_order:', e);
      let existingImages = [];
      if (req.body.existing_images) {
        try {
          existingImages = JSON.parse(req.body.existing_images);
        } catch (err) {
          existingImages = req.body.existing_images.split(',').filter(Boolean);
        }
      }
      finalImages = [...existingImages, ...newImages];
    }
  } else {
    let existingImages = [];
    if (req.body.existing_images) {
      try {
        existingImages = JSON.parse(req.body.existing_images);
      } catch (err) {
        existingImages = req.body.existing_images.split(',').filter(Boolean);
      }
    }
    finalImages = [...existingImages, ...newImages];
  }

  let customExtras = [];
  if (req.body.custom_extras) {
    try {
      customExtras = typeof req.body.custom_extras === 'string' ? JSON.parse(req.body.custom_extras) : req.body.custom_extras;
    } catch (e) {
      console.error('Error parsing custom_extras:', e);
    }
  }

  let customFeatures = [];
  if (req.body.custom_features) {
    try {
      customFeatures = typeof req.body.custom_features === 'string' ? JSON.parse(req.body.custom_features) : req.body.custom_features;
    } catch (e) {
      console.error('Error parsing custom_features:', e);
    }
  }

  try {
    const checkRes = await pool.query('SELECT * FROM vans WHERE id = $1', [id]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Furgoneta no encontrada en base de datos.' });
    }
    const current = checkRes.rows[0];

    const query = `
      UPDATE vans 
      SET van_type = $1, name = $2, plate = $3, m3 = $4, price_sin = $5, min_price_con = $6, km_price_con = $7, status = $8, images = $9,
          custom_extras = $10, max_occupants = $11, eco_label = $12, daily_km_limit = $13, max_mass = $14, fuel_type = $15, waiting_hour_price = $16,
          custom_features = $17
      WHERE id = $18 RETURNING *;
    `;
    const values = [
      van_type !== undefined ? van_type : current.van_type,
      name !== undefined ? name : current.name,
      plate !== undefined ? plate : current.plate,
      m3 !== undefined ? m3 : current.m3,
      price_sin !== undefined ? parseFloat(price_sin) : current.price_sin,
      min_price_con !== undefined ? parseFloat(min_price_con) : current.min_price_con,
      km_price_con !== undefined ? parseFloat(km_price_con) : current.km_price_con,
      status !== undefined ? status : current.status,
      finalImages,
      JSON.stringify(customExtras),
      max_occupants !== undefined ? parseInt(max_occupants) : current.max_occupants,
      eco_label !== undefined ? eco_label : current.eco_label,
      daily_km_limit !== undefined ? parseInt(daily_km_limit) : current.daily_km_limit,
      max_mass !== undefined ? parseInt(max_mass) : current.max_mass,
      fuel_type !== undefined ? fuel_type : current.fuel_type,
      waiting_hour_price !== undefined ? parseFloat(waiting_hour_price) : current.waiting_hour_price,
      JSON.stringify(customFeatures),
      id
    ];

    const result = await pool.query(query, values);
    
    // Sincronizar catálogo local y guardar en disco
    const index = fallbackVans.findIndex(v => v.id == id);
    if (index !== -1) {
      fallbackVans[index] = result.rows[0];
    }
    saveAdminStoreToFile();
    
    res.json({
      message: 'Furgoneta actualizada con éxito.',
      van: result.rows[0]
    });
  } catch (err) {
    console.warn('Base de datos offline, simulando edición en memoria:', err.message);
    const index = fallbackVans.findIndex(v => v.id == id);
    if (index === -1) {
      return res.status(404).json({ error: 'Furgoneta no encontrada.' });
    }
    const current = fallbackVans[index];
    const updated = {
      ...current,
      van_type: van_type !== undefined ? van_type : current.van_type,
      name: name !== undefined ? name : current.name,
      plate: plate !== undefined ? plate : current.plate,
      m3: m3 !== undefined ? m3 : current.m3,
      price_sin: price_sin !== undefined ? parseFloat(price_sin) : current.price_sin,
      min_price_con: min_price_con !== undefined ? parseFloat(min_price_con) : current.min_price_con,
      km_price_con: km_price_con !== undefined ? parseFloat(km_price_con) : current.km_price_con,
      status: status !== undefined ? status : current.status,
      images: finalImages,
      custom_extras: customExtras,
      max_occupants: max_occupants !== undefined ? parseInt(max_occupants) : current.max_occupants,
      eco_label: eco_label !== undefined ? eco_label : current.eco_label,
      daily_km_limit: daily_km_limit !== undefined ? parseInt(daily_km_limit) : current.daily_km_limit,
      max_mass: max_mass !== undefined ? parseInt(max_mass) : current.max_mass,
      fuel_type: fuel_type !== undefined ? fuel_type : current.fuel_type,
      waiting_hour_price: waiting_hour_price !== undefined ? parseFloat(waiting_hour_price) : current.waiting_hour_price,
      custom_features: customFeatures
    };
    fallbackVans[index] = updated;
    saveAdminStoreToFile();
    res.json({
      message: 'Furgoneta actualizada temporalmente (Modo offline sin BD).',
      van: updated
    });
  }
});

// 5. Eliminar una furgoneta
app.delete('/api/vans/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  // No se borra una furgoneta con reservas futuras activas: quedarían sin vehículo ni precio
  const van = fallbackVans.find(v => String(v.id) === String(id));
  if (van) {
    const today = new Date().toISOString().slice(0, 10);
    let pendingRentals = 0;
    try {
      const r = await pool.query(`SELECT COUNT(*) FROM bookings WHERE van_type = $1 AND return_date >= $2 AND ${ACTIVE_BOOKING_SQL}`, [van.van_type, today]);
      pendingRentals = parseInt(r.rows[0].count, 10) || 0;
    } catch (e) {
      pendingRentals = fallbackBookings.filter(b => b.van_type === van.van_type && String(b.return_date).slice(0, 10) >= today && isActiveFallbackBooking(b)).length;
    }
    if (pendingRentals > 0) {
      return res.status(409).json({ error: `No se puede eliminar: tiene ${pendingRentals} reserva(s) futura(s) activa(s). Cancélalas o espera a que terminen.` });
    }
  }

  try {
    const result = await pool.query('DELETE FROM vans WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Furgoneta no encontrada en base de datos.' });
    }
    
    // Sincronizar catálogo local y guardar en disco
    const index = fallbackVans.findIndex(v => v.id == id);
    if (index !== -1) {
      fallbackVans.splice(index, 1);
    }
    saveAdminStoreToFile();
    
    res.json({ message: 'Furgoneta eliminada con éxito.' });
  } catch (err) {
    console.warn('Base de datos offline, simulando borrado en memoria:', err.message);
    const index = fallbackVans.findIndex(v => v.id == id);
    if (index === -1) {
      return res.status(404).json({ error: 'Furgoneta no encontrada.' });
    }
    fallbackVans.splice(index, 1);
    saveAdminStoreToFile();
    res.json({ message: 'Furgoneta eliminada temporalmente de memoria (Modo offline sin BD).' });
  }
});

// --- CONFIGURACIÓN DE SETTINGS (HORARIOS) ---

app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    const settingsObj = {};
    result.rows.forEach(row => {
      settingsObj[row.key] = row.value;
    });
    res.json(publicSettings(settingsObj));
  } catch (err) {
    console.warn('Base de datos offline, retornando settings de fallback:', err.message);
    res.json(publicSettings(fallbackSettings));
  }
});

// Las credenciales de administración nunca salen en el endpoint público
function publicSettings(settings) {
  return Object.fromEntries(Object.entries(settings).filter(([key]) => !key.startsWith('admin_')));
}

app.put('/api/settings', verifyAdmin, async (req, res) => {
  let { hours_weekdays, hours_saturdays, hours_sundays, show_reviews_count, contact_phone, contact_email, fianza_amount } = req.body;
  const fields = { hours_weekdays, hours_saturdays, hours_sundays, show_reviews_count, contact_phone, contact_email, fianza_amount };
  if (Object.values(fields).some(v => v !== undefined && (typeof v !== 'string' || v.length > 200))) {
    return res.status(400).json({ error: 'Valores de configuración no válidos.' });
  }
  if (show_reviews_count !== undefined && !['true', 'false'].includes(show_reviews_count)) {
    return res.status(400).json({ error: 'Valores de configuración no válidos.' });
  }
  if (contact_phone) {
    // Se usa en enlaces tel: y de WhatsApp: solo dígitos y con prefijo de país (34 si se omite)
    contact_phone = contact_phone.replace(/\D/g, '');
    if (contact_phone.length === 9) contact_phone = '34' + contact_phone;
    if (contact_phone.length < 11 || contact_phone.length > 15) {
      return res.status(400).json({ error: 'El teléfono de contacto no es válido (ej. 614767411 o 34614767411).' });
    }
  }
  if (contact_email && !EMAIL_PATTERN.test(contact_email)) {
    return res.status(400).json({ error: 'El correo de contacto no es válido.' });
  }
  if (fianza_amount) {
    // "1.000,50" o "500,00" (coma decimal) y también "500.50"
    const raw = fianza_amount.trim().replace(/\s|€/g, '');
    const amount = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
      return res.status(400).json({ error: 'El importe de la fianza no es válido (ej. 500,00).' });
    }
    fianza_amount = amount.toFixed(2).replace('.', ',');
  }

  try {
    const queries = [
      { key: 'hours_weekdays', value: hours_weekdays },
      { key: 'hours_saturdays', value: hours_saturdays },
      { key: 'hours_sundays', value: hours_sundays },
      { key: 'show_reviews_count', value: show_reviews_count },
      { key: 'contact_phone', value: contact_phone },
      { key: 'contact_email', value: contact_email },
      { key: 'fianza_amount', value: fianza_amount }
    ];
    
    for (const q of queries) {
      if (q.value !== undefined) {
        await pool.query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [q.key, q.value]
        );
        fallbackSettings[q.key] = q.value;
      }
    }
    
    saveAdminStoreToFile();
    res.json({ message: 'Configuración actualizada con éxito.', settings: fallbackSettings });
  } catch (err) {
    console.warn('Base de datos offline, actualizando settings en memoria:', err.message);
    if (hours_weekdays !== undefined) fallbackSettings.hours_weekdays = hours_weekdays;
    if (hours_saturdays !== undefined) fallbackSettings.hours_saturdays = hours_saturdays;
    if (hours_sundays !== undefined) fallbackSettings.hours_sundays = hours_sundays;
    if (show_reviews_count !== undefined) fallbackSettings.show_reviews_count = show_reviews_count;
    if (contact_phone !== undefined) fallbackSettings.contact_phone = contact_phone;
    if (contact_email !== undefined) fallbackSettings.contact_email = contact_email;
    if (fianza_amount !== undefined) fallbackSettings.fianza_amount = fianza_amount;
    
    saveAdminStoreToFile();
    res.json({ message: 'Configuración actualizada temporalmente en memoria (Modo offline sin BD).', settings: fallbackSettings });
  }
});

// --- CAMBIO DE CREDENCIALES DE ADMINISTRADOR CON CÓDIGO DE VERIFICACIÓN POR EMAIL ---

// 1. Solicitar código de verificación enviado de confirmacion@rentmeuskar.com a info@rentmeuskar.com
app.post('/api/admin/request-credential-change-code', verifyAdmin, async (req, res) => {
  const { new_username, new_password } = req.body;
  if (!new_username || !new_password) {
    return res.status(400).json({ error: 'El nuevo usuario y la nueva contraseña son obligatorios.' });
  }
  if (!areStrings(new_username, new_password) || new_username.length > 100 || new_password.length > 200) {
    return res.status(400).json({ error: 'Los datos del formulario no son válidos.' });
  }

  const cleanUsername = new_username.trim();
  const cleanPassword = new_password.trim();

  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' });
  }
  if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  const code = generateVerificationCode();
  pendingAdminCredentialChanges['admin'] = {
    newUsername: cleanUsername,
    newPasswordHash: hashPassword(cleanPassword),
    code: code,
    expires: Date.now() + 15 * 60 * 1000
  };

  console.log('[SECURITY ADMIN] Código de verificación para cambio de credenciales de admin generado y enviado por correo');

  try {
    const senderAddress = process.env.SMTP_USER || 'confirmacion@rentmeuskar.com';
    const recipientAddress = 'info@rentmeuskar.com';

    await mailTransporter.sendMail({
      from: `"RentMeUskar Seguridad" <${senderAddress}>`,
      to: recipientAddress,
      subject: '🔐 Código de Verificación | Cambio de Usuario y Contraseña de Administración',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #070e24; color: #ffffff; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <h1 style="color: #82d105; margin: 0; font-size: 24px;">RentMeUskar</h1>
            <p style="color: #a0aec0; margin-top: 5px; font-size: 14px;">Consola de Administración - Seguridad</p>
          </div>
          <div style="padding: 24px 0;">
            <h2 style="color: #ffffff; font-size: 18px; margin-bottom: 12px;">⚠️ Solicitud de Cambio de Credenciales de Administrador</h2>
            <p style="color: #cbd5e0; line-height: 1.6;">Hola <strong>Administrador</strong>,</p>
            <p style="color: #cbd5e0; line-height: 1.6;">
              Se ha solicitado una modificación para <strong>CAMBIAR EL NOMBRE DE USUARIO Y LA CONTRASEÑA DE ACCESO DEL PANEL DE ADMINISTRACIÓN DE RENTMEUSKAR</strong>.
            </p>
            <div style="background: rgba(130, 209, 5, 0.08); border-left: 4px solid #82d105; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0; color: #ffffff; font-size: 14px;"><strong>Nuevo Nombre de Usuario Solicitado:</strong> ${cleanUsername}</p>
            </div>
            <p style="color: #cbd5e0; line-height: 1.6;">
              Este código de verificación es necesario para confirmar que eres el propietario legítimo antes de aplicar el nuevo usuario y la nueva contraseña. Introduce el siguiente código de 6 dígitos en la pantalla de la Consola de Administración:
            </p>
            
            <div style="font-size: 36px; font-weight: bold; background: #0c1838; padding: 18px; text-align: center; border-radius: 8px; color: #82d105; letter-spacing: 8px; margin: 24px 0; border: 2px dashed #82d105;">
              ${code}
            </div>
            
            <p style="color: #ff4d6d; font-size: 13px; font-weight: bold;">
              ⚠️ ATENCIÓN DE SEGURIDAD: Este código caduca en 15 minutos. Si tú no has solicitado este cambio de usuario y contraseña del panel de administración, ignora este mensaje. Nadie podrá acceder ni cambiar las credenciales sin este código.
            </p>
          </div>
          <div style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; color: #718096; font-size: 12px;">
            &copy; ${new Date().getFullYear()} RentMeUskar. Todos los derechos reservados.
          </div>
        </div>
      `
    });
    console.log(`[SMTP SUCCESS] Correo de verificación enviado a ${recipientAddress} desde ${senderAddress}`);
    return res.json({ success: true, message: `Código de verificación enviado a info@rentmeuskar.com desde confirmacion@rentmeuskar.com.` });
  } catch (mailErr) {
    console.error('[SMTP ERROR] Error enviando correo de verificación de admin:', mailErr.message);
    return res.status(500).json({ error: 'Error al enviar el correo de verificación. Comprueba los parámetros SMTP.' });
  }
});

// 2. Confirmar código de verificación y aplicar nuevo usuario y contraseña de Admin
app.post('/api/admin/confirm-credential-change', verifyAdmin, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'El código de verificación es obligatorio.' });
  }

  const pending = pendingAdminCredentialChanges['admin'];
  if (!pending) {
    return res.status(400).json({ error: 'No hay ninguna solicitud de cambio de credenciales pendiente o ha expirado.' });
  }

  const codeStatus = checkPendingCode(pending, code);
  if (codeStatus !== 'ok') {
    if (codeStatus !== 'invalid') delete pendingAdminCredentialChanges['admin'];
    return res.status(400).json({ error: CODE_ERRORS[codeStatus] });
  }

  // Código correcto: Aplicar actualización de credenciales de admin
  try {
    fallbackSettings.admin_username = pending.newUsername;
    fallbackSettings.admin_password_hash = pending.newPasswordHash;
    delete fallbackSettings.admin_password;

    await pool.query(
      "INSERT INTO settings (key, value) VALUES ('admin_username', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [pending.newUsername]
    );
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ('admin_password_hash', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [pending.newPasswordHash]
    );
    // Eliminar rastro de contraseña en texto plano en la base de datos si existía
    await pool.query("DELETE FROM settings WHERE key = 'admin_password'");

    saveAdminStoreToFile();
    delete pendingAdminCredentialChanges['admin'];

    console.log(`[SECURITY ADMIN] Credenciales de administración cambiadas con éxito a usuario: ${pending.newUsername}`);
    return res.json({
      success: true,
      message: '¡Usuario y contraseña del panel de administración actualizados con éxito! Deberás iniciar sesión con tus nuevas credenciales.'
    });
  } catch (err) {
    console.error('Error al guardar credenciales en PostgreSQL DB:', err.message);
    saveAdminStoreToFile();
    delete pendingAdminCredentialChanges['admin'];
    return res.json({
      success: true,
      message: 'Credenciales actualizadas en memoria local.'
    });
  }
});

// --- OPINIONES DE COMPRAS VERIFICADAS ---

// --- OPINIONES DE COMPRAS VERIFICADAS ---

// Generar código de reseña manual desde admin con especificaciones completas de la reserva
app.post('/api/admin/generate-review-code', verifyAdmin, (req, res) => {
  const { van_name, client_name, city, rental_days, rental_mode, pickup_date, pickup_time, return_date, return_time } = req.body;
  const code = generateReviewCode();

  const codeObj = {
    code,
    van_name: van_name || 'Ford Transit Custom L2H2 (8m³)',
    client_name: client_name || '',
    city: city || 'Granada',
    rental_days: rental_days || 2,
    rental_mode: rental_mode || 'Sin Conductor',
    pickup_date: pickup_date || '',
    pickup_time: pickup_time || '09:00',
    return_date: return_date || '',
    return_time: return_time || '19:00',
    created_at: new Date().toISOString()
  };

  manualReviewCodes.push(codeObj);
  saveAdminStoreToFile();
  res.json({ message: 'Código de reseña verificado creado.', codeObj });
});

// Verificar código manual para autocompletar vehículo y datos de reserva
app.post('/api/reviews/verify-code', async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Código requerido' });

  const cleanCode = code.trim().toUpperCase();

  // 1. Buscar en códigos manuales generados por admin
  const manualObj = manualReviewCodes.find(c => c.code.toUpperCase() === cleanCode);
  if (manualObj) {
    return res.json({ 
      valid: true, 
      van_name: manualObj.van_name, 
      client_name: manualObj.client_name, 
      city: manualObj.city,
      rental_days: manualObj.rental_days,
      rental_mode: manualObj.rental_mode,
      pickup_date: manualObj.pickup_date,
      pickup_time: manualObj.pickup_time,
      return_date: manualObj.return_date,
      return_time: manualObj.return_time
    });
  }

  // 2. Buscar en base de datos PostgreSQL
  try {
    const dbRes = await pool.query('SELECT * FROM bookings WHERE UPPER(review_code) = $1', [cleanCode]);
    if (dbRes.rowCount > 0 && isReviewableBooking(dbRes.rows[0])) {
      const b = dbRes.rows[0];
      return res.json({
        valid: true,
        van_name: b.van_name || 'Ford Transit Custom L2H2 (8m³)',
        client_name: b.name,
        rental_days: b.days || 2,
        rental_mode: b.rental_mode || 'Sin Conductor',
        pickup_date: b.pickup_date,
        pickup_time: b.pickup_time,
        return_date: b.return_date,
        return_time: b.return_time
      });
    }
  } catch (e) {
    console.warn('[REVIEWS] Error consultando código en base de datos:', e.message);
  }

  // 3. Buscar en reservas en memoria / fallback
  const foundBooking = fallbackBookings.find(b => b.review_code && b.review_code.toUpperCase() === cleanCode && isReviewableBooking(b));
  if (foundBooking) {
    return res.json({ 
      valid: true, 
      van_name: foundBooking.van_name, 
      client_name: foundBooking.name,
      rental_days: foundBooking.days || 2,
      rental_mode: foundBooking.rental_mode || 'Sin Conductor',
      pickup_date: foundBooking.pickup_date,
      pickup_time: foundBooking.pickup_time,
      return_date: foundBooking.return_date,
      return_time: foundBooking.return_time
    });
  }

  return res.status(400).json({ error: 'Código de reseña no válido o no encontrado en el sistema.' });
});

app.get('/api/reviews', async (req, res) => {
  // El código de reserva abre la factura y el contrato: solo el admin lo recibe
  const authUser = await getAuthUser(req);
  const isAdmin = !!(authUser && authUser.isAdmin);
  const hideCode = r => {
    if (isAdmin) return r;
    const { booking_code, ...publicReview } = r;
    return publicReview;
  };
  try {
    const result = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
    res.json(result.rows.map(hideCode));
  } catch (err) {
    console.warn('Base de datos offline, retornando opiniones de fallback:', err.message);
    res.json(fallbackReviews.map(hideCode));
  }
});

// Una opinión solo vale con un código de admin o de una reserva pagada/confirmada
function isReviewableBooking(b) {
  return !!b && (b.payment_status === 'paid' || b.status === 'confirmed' || b.status === 'paid_pending');
}

async function findReviewableCode(code) {
  if (manualReviewCodes.some(m => m.code.toUpperCase() === code)) return true;
  try {
    const dbRes = await pool.query('SELECT status, payment_status FROM bookings WHERE UPPER(review_code) = $1', [code]);
    if (dbRes.rows.some(isReviewableBooking)) return true;
  } catch (e) {
    // BD no disponible: se comprueba en las reservas en memoria
  }
  return fallbackBookings.some(b => b.review_code && b.review_code.toUpperCase() === code && isReviewableBooking(b));
}

app.post('/api/reviews', async (req, res) => {
  const { booking_code, client_name, rating, comment, role_or_city, van_name } = req.body;
  
  if (!booking_code || !client_name || !rating || !comment) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }
  if (!areStrings(booking_code, client_name, comment) || !areOptionalStrings(role_or_city, van_name)) {
    return res.status(400).json({ error: 'Los datos de la opinión no son válidos.' });
  }

  const numRating = parseInt(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'La valoración debe ser un número entero entre 1 y 5.' });
  }
  
  const code = booking_code.trim().toUpperCase();
  const safeClientName = escapeHtml(client_name.trim());
  const safeComment = escapeHtml(comment.trim());
  const safeRoleOrCity = escapeHtml((role_or_city || '').trim());
  const finalVanName = escapeHtml((van_name || 'Ford Transit Custom L2H2 (8m³)').trim());

  // 1. Verificar que el código es de una reserva pagada/confirmada (también sin BD)
  if (!(await findReviewableCode(code))) {
    return res.status(400).json({ error: 'El código de reseña no corresponde a ninguna reserva pagada o confirmada.' });
  }

  try {
    // 2. Verificar si ya se ha enviado una opinión para este código
    const checkReview = await pool.query('SELECT * FROM reviews WHERE UPPER(booking_code) = $1', [code]);
    if (checkReview.rowCount > 0) {
      return res.status(400).json({ error: 'Este código de reserva ya ha sido utilizado para escribir una opinión.' });
    }
    
    // 3. Insertar opinión sanitizada
    const result = await pool.query(
      'INSERT INTO reviews (booking_code, client_name, rating, comment, role_or_city, van_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [code, safeClientName, numRating, safeComment, safeRoleOrCity, finalVanName]
    );
    
    fallbackReviews.unshift(result.rows[0]);
    res.status(201).json({ message: 'Opinión publicada con éxito.', review: result.rows[0] });
  } catch (err) {
    console.warn('Base de datos offline, simulando opinión en memoria:', err.message);
    
    const reviewExists = fallbackReviews.some(r => r.booking_code.toUpperCase() === code);
    if (reviewExists) {
      return res.status(400).json({ error: 'Este código de reserva ya ha sido utilizado para escribir una opinión.' });
    }
    
    const mockReview = {
      id: fallbackReviews.length > 0 ? Math.max(...fallbackReviews.map(r => r.id)) + 1 : 1,
      booking_code: code,
      client_name: safeClientName,
      rating: numRating,
      comment: safeComment,
      role_or_city: safeRoleOrCity,
      van_name: finalVanName,
      created_at: new Date().toISOString()
    };
    
    fallbackReviews.unshift(mockReview);
    res.status(201).json({ message: 'Opinión publicada con éxito.', review: mockReview });
  }
});

// 11. Eliminar una opinión (admin)
app.delete('/api/admin/reviews/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM reviews WHERE id = $1 RETURNING *', [id]);
    
    // Sincronizar catálogo local
    const index = fallbackReviews.findIndex(r => r.id == id);
    if (index !== -1) {
      fallbackReviews.splice(index, 1);
    }
    
    if (result.rowCount === 0) {
      if (index !== -1) {
        return res.json({ message: 'Opinión eliminada de memoria local (Modo offline).' });
      }
      return res.status(404).json({ error: 'Opinión no encontrada.' });
    }
    
    res.json({ message: 'Opinión eliminada con éxito.' });
  } catch (err) {
    console.warn('Base de datos offline, simulando borrado de opinión en memoria:', err.message);
    const index = fallbackReviews.findIndex(r => r.id == id);
    if (index === -1) {
      return res.status(404).json({ error: 'Opinión no encontrada.' });
    }
    fallbackReviews.splice(index, 1);
    res.json({ message: 'Opinión eliminada de memoria local (Modo offline).' });
  }
});

// --- RUTAS DE BLOQUEO DE DISPONIBILIDAD (VAN BLOCKAGES) ---

// 1. Obtener todos los bloqueos
app.get('/api/blockages', async (req, res) => {
  const { van_type } = req.query;
  // El motivo es una nota interna del admin: al público solo se le dan las fechas
  const requester = await getAuthUser(req);
  const isAdminRequest = !!(requester && requester.isAdmin);
  const visible = b => isAdminRequest ? b : { id: b.id, van_type: b.van_type, start_date: b.start_date, end_date: b.end_date };
  try {
    let query = 'SELECT * FROM van_blockages ORDER BY start_date ASC';
    let params = [];
    if (van_type) {
      query = 'SELECT * FROM van_blockages WHERE van_type = $1 ORDER BY start_date ASC';
      params = [van_type];
    }
    const result = await pool.query(query, params);
    
    // Mapear fechas a formato YYYY-MM-DD
    const mapped = result.rows.map(row => ({
      ...row,
      start_date: formatDateISO(row.start_date),
      end_date: formatDateISO(row.end_date)
    }));
    
    res.json(mapped.map(visible));
  } catch (err) {
    console.warn('Base de datos offline al obtener bloqueos, usando fallback:', err.message);
    let filtered = fallbackBlockages;
    if (van_type) {
      filtered = fallbackBlockages.filter(b => b.van_type === van_type);
    }
    res.json(filtered.map(visible));
  }
});

// 2. Crear un bloqueo
app.post('/api/blockages', verifyAdmin, async (req, res) => {
  const { van_type, start_date, end_date, reason } = req.body;
  if (!van_type || !start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios (van_type, start_date, end_date, reason).' });
  }

  if (end_date < start_date) {
    return res.status(400).json({ error: 'La fecha de fin de bloqueo no puede ser anterior a la fecha de inicio.' });
  }
  
  try {
    const query = `
      INSERT INTO van_blockages (van_type, start_date, end_date, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [van_type, start_date, end_date, reason]);
    const created = {
      ...result.rows[0],
      start_date: formatDateISO(result.rows[0].start_date),
      end_date: formatDateISO(result.rows[0].end_date)
    };
    
    // Sincronizar en fallback y guardar en disco
    fallbackBlockages.push(created);
    saveAdminStoreToFile();
    
    res.status(201).json({ message: 'Bloqueo registrado correctamente.', blockage: created });
  } catch (err) {
    console.warn('Base de datos offline al crear bloqueo, usando fallback:', err.message);
    const mockId = fallbackBlockages.length > 0 ? Math.max(...fallbackBlockages.map(b => b.id)) + 1 : 1;
    const mockBlock = {
      id: mockId,
      van_type,
      start_date,
      end_date,
      reason,
      created_at: new Date().toISOString()
    };
    fallbackBlockages.push(mockBlock);
    saveAdminStoreToFile();
    res.status(201).json({ message: 'Bloqueo registrado correctamente en memoria fallback.', blockage: mockBlock });
  }
});

// 3. Eliminar un bloqueo
app.delete('/api/blockages/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'DELETE FROM van_blockages WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    
    // Eliminar de fallback
    const index = fallbackBlockages.findIndex(b => b.id == id);
    if (index !== -1) {
      fallbackBlockages.splice(index, 1);
    }
    saveAdminStoreToFile();
    
    if (result.rowCount === 0) {
      // Intentar en fallback si no existía en BD
      if (index !== -1) {
        return res.json({ message: 'Bloqueo eliminado correctamente de memoria fallback.' });
      }
      return res.status(404).json({ error: 'Bloqueo no encontrado.' });
    }
    
    res.json({ message: 'Bloqueo eliminado correctamente.' });
  } catch (err) {
    console.warn('Base de datos offline al eliminar bloqueo, intentando en memoria:', err.message);
    const index = fallbackBlockages.findIndex(b => b.id == id);
    if (index !== -1) {
      fallbackBlockages.splice(index, 1);
      saveAdminStoreToFile();
      return res.json({ message: 'Bloqueo eliminado correctamente de memoria fallback (offline).' });
    }
    res.status(500).json({ error: 'Error del servidor al eliminar el bloqueo.' });
  }
});

// --- RUTAS DE PREGUNTAS FRECUENTES (FAQS) ---

// 1. Obtener todas las FAQs
app.get('/api/faqs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM faqs ORDER BY display_order ASC, id ASC');
    res.json(result.rows);
  } catch (err) {
    console.warn('Base de datos offline al obtener FAQs, usando fallback:', err.message);
    res.json(fallbackFaqs);
  }
});

// 2. Crear una nueva FAQ
app.post('/api/faqs', verifyAdmin, async (req, res) => {
  const { question, answer, display_order } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: 'La pregunta y respuesta son obligatorias.' });
  }
  
  try {
    const query = `
      INSERT INTO faqs (question, answer, display_order)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [question, answer, parseInt(display_order) || 0]);
    fallbackFaqs.push(result.rows[0]);
    saveAdminStoreToFile();
    res.status(201).json({ message: 'FAQ creada con éxito.', faq: result.rows[0] });
  } catch (err) {
    console.warn('Base de datos offline al crear FAQ, usando fallback:', err.message);
    const mockId = fallbackFaqs.length > 0 ? Math.max(...fallbackFaqs.map(f => f.id)) + 1 : 1;
    const mockFaq = {
      id: mockId,
      question,
      answer,
      display_order: parseInt(display_order) || 0
    };
    fallbackFaqs.push(mockFaq);
    saveAdminStoreToFile();
    res.status(201).json({ message: 'FAQ creada con éxito en memoria fallback.', faq: mockFaq });
  }
});

// 3. Modificar una FAQ
app.put('/api/faqs/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { question, answer, display_order } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: 'La pregunta y respuesta son obligatorias.' });
  }
  
  try {
    const query = `
      UPDATE faqs 
      SET question = $1, answer = $2, display_order = $3
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [question, answer, parseInt(display_order) || 0, id]);
    
    // Sincronizar fallback
    const index = fallbackFaqs.findIndex(f => f.id == id);
    if (index !== -1) {
      fallbackFaqs[index] = result.rows[0];
    }
    saveAdminStoreToFile();
    
    if (result.rowCount === 0) {
      if (index !== -1) {
        return res.json({ message: 'FAQ actualizada en memoria fallback.' });
      }
      return res.status(404).json({ error: 'FAQ no encontrada.' });
    }
    
    res.json({ message: 'FAQ actualizada con éxito.', faq: result.rows[0] });
  } catch (err) {
    console.warn('Base de datos offline al modificar FAQ, usando fallback:', err.message);
    const index = fallbackFaqs.findIndex(f => f.id == id);
    if (index !== -1) {
      const updated = {
        ...fallbackFaqs[index],
        question,
        answer,
        display_order: parseInt(display_order) || 0
      };
      fallbackFaqs[index] = updated;
      saveAdminStoreToFile();
      return res.json({ message: 'FAQ actualizada con éxito en memoria fallback.', faq: updated });
    }
    res.status(500).json({ error: 'Error del servidor al actualizar FAQ.' });
  }
});

// 4. Eliminar una FAQ
app.delete('/api/faqs/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'DELETE FROM faqs WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    
    const index = fallbackFaqs.findIndex(f => f.id == id);
    if (index !== -1) {
      fallbackFaqs.splice(index, 1);
    }
    saveAdminStoreToFile();
    
    if (result.rowCount === 0) {
      if (index !== -1) {
        return res.json({ message: 'FAQ eliminada de memoria fallback.' });
      }
      return res.status(404).json({ error: 'FAQ no encontrada.' });
    }
    
    res.json({ message: 'FAQ eliminada con éxito.' });
  } catch (err) {
    console.warn('Base de datos offline al eliminar FAQ, intentando en memoria:', err.message);
    const index = fallbackFaqs.findIndex(f => f.id == id);
    if (index !== -1) {
      fallbackFaqs.splice(index, 1);
      saveAdminStoreToFile();
      return res.json({ message: 'FAQ eliminada de memoria fallback (offline).' });
    }
    res.status(500).json({ error: 'Error del servidor al eliminar FAQ.' });
  }
});

// Rutas de API inexistentes: responder en JSON (el frontend siempre hace res.json())
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta de API no encontrada.' });
});

// --- ENRUTAMIENTO FRONTEND ---

// Enrutamiento de páginas dinámicas del cliente (Contrato y Factura)
app.get(['/contract', '/contract/:id', '/contrato', '/contrato/:id'], (req, res) => {
  res.sendFile(path.join(__dirname, 'contract.html'));
});

app.get(['/invoice', '/invoice/:id', '/factura', '/factura/:id'], (req, res) => {
  res.sendFile(path.join(__dirname, 'invoice.html'));
});

// Ruta amigable para la consola de administración (/admin)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Servir favicon.ico de forma directa y explícita con fondo circular azul oscuro
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'favicon.png'));
});

// Servir solo los archivos públicos de la raíz (nunca el código del servidor ni data/)
const PUBLIC_ROOT_FILES = new Set([
  'index.html', 'admin.html', 'contract.html', 'invoice.html',
  'payment-success.html', 'payment-error.html',
  'styles.css', 'app.js', 'admin.js',
  'robots.txt', 'sitemap.xml', 'favicon.jpeg'
]);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:file', (req, res, next) => {
  if (!PUBLIC_ROOT_FILES.has(req.params.file)) return next();
  res.sendFile(path.join(__dirname, req.params.file));
});

// Manejador centralizado de errores de subida de archivos (Multer) y validaciones
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido de 10MB.' });
    }
    return res.status(400).json({ error: 'Error en la subida de archivos: ' + err.message });
  }
  if (err && err.message && err.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message && err.message.includes('Bloqueado por política CORS')) {
    return res.status(403).json({ error: 'Acceso bloqueado por política de seguridad CORS.' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Formato JSON malformado o inválido en la petición.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La petición es demasiado grande.' });
  }
  if (err && err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Petición no válida.' });
  }
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor de RentMeUskar escuchando en http://localhost:${PORT}`);
});
