require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de transporte SMTP para envío de emails de confirmación
let mailTransporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('[SMTP] Transporte de correo configurado vía SMTP.');
} else if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });
  console.log('[SMTP] Transporte de correo configurado vía Gmail.');
}

// Asegurar que existe la carpeta de subidas (uploads)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configuración de Multer para la subida de fotos antes/después
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Password hashing function (SHA256)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Rate limiting para prevenir ataques de fuerza bruta y DDoS
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // Límite de 300 peticiones por ventana por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde esta IP. Por favor, inténtalo más tarde.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, // Límite estricto de 15 intentos de login/registro
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación. Por favor, inténtalo en 15 minutos.' }
});

// Security & Optimization Middleware
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false, // Permitir CDN estáticos de FontAwesome y Flatpickr
  crossOriginEmbedderPolicy: false
}));
app.use(globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/admin/login', authLimiter);
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '7d' }));

// Conexión a la base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

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
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '[]'::jsonb;"
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

    // Pre-poblar furgonetas por defecto si está vacía
    const countVans = await client.query('SELECT COUNT(*) FROM vans');
    if (parseInt(countVans.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO vans (van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status) VALUES
        ('medium', 'Ford Transit Custom L2H2 (8m³)', '3681 MCC', '8m³', 79.00, 50.00, 1.00, 'active'),
        ('large', 'MAN TGE L4H3 Gran Volumen (14m³)', '3758 MDW', '14m³', 107.44, 60.00, 1.40, 'active')
      `);
      console.log('Furgonetas por defecto insertadas.');
    }

    // Pre-poblar FAQs por defecto si está vacía
    const countFaqs = await client.query('SELECT COUNT(*) FROM faqs');
    if (parseInt(countFaqs.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO faqs (question, answer, display_order) VALUES
        ('¿Qué requisitos necesito cumplir para alquilar sin conductor?', 'Necesitas tener al menos 23 años (21 para furgonetas compactas) y estar en posesión del permiso de conducir tipo B vigente con una antigüedad mínima de 2 años. Deberás presentar el DNI/NIE y el carnet de conducir originales al retirar el vehículo.', 1),
        ('¿Hay que dejar alguna fianza o depósito?', 'Sí, se requiere una fianza de 500€ que se retiene o paga mediante tarjeta en la web (para reservas de una semana o menos) o se gestiona manualmente. Esta fianza se reembolsará íntegramente tras revisar que el vehículo se devuelve en las mismas condiciones, limpio y sin daños.', 2),
        ('¿Cómo funciona la política de combustible?', 'Nuestra política es Lleno-Lleno (Full-to-Full). Te entregamos la furgoneta con el depósito de combustible lleno (diésel) y debes devolverla de la misma forma. De lo contrario, se cobrará el coste del combustible faltante más un cargo de gestión de repostaje.', 3),
        ('¿Qué seguro está incluido en el precio base?', 'El precio incluye seguro obligatorio de responsabilidad civil y seguro de colisión básico con franquicia. Esto significa que en caso de accidente o daños, la responsabilidad máxima del cliente está limitada al importe de la franquicia establecida (salvo negligencia).', 4),
        ('¿Puedo viajar fuera de España con la furgoneta?', 'Por defecto, el uso de las furgonetas está autorizada en territorio nacional (Península Ibérica). Si tienes pensado viajar a Portugal, Francia u otros países de Europa, debes comunicarlo con antelación para tramitar la cobertura del seguro correspondiente y asistencia en el extranjero.', 5)
      `);
      console.log('FAQs por defecto insertadas.');
    }

    // Pre-poblar opiniones por defecto si está vacía
    const countReviews = await client.query('SELECT COUNT(*) FROM reviews');
    if (parseInt(countReviews.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO reviews (booking_code, client_name, rating, comment, role_or_city) VALUES
        ('MOCK-1', 'Francisco M.', 5, 'Alquilé la furgoneta mediana para trasladar unos muebles desde Granada a Huéscar. El trato fue inmejorable y el vehículo estaba limpísimo. Repetiré seguro.', 'Particular (Huéscar)'),
        ('MOCK-2', 'María José S.', 5, 'Necesitábamos una furgoneta de 9 plazas para un viaje de fin de semana con amigos de la Puebla de Don Fadrique. El viaje fue comodísimo y el precio muy razonable.', 'Viaje Familiar'),
        ('MOCK-3', 'Antonio G.', 5, 'Como autónomo, a veces necesito un vehículo de gran volumen para repartos extra. RentMeUskar me soluciona la papeleta rápidamente y sin burocracia pesada.', 'Autónomo (Castril)')
      `);
      console.log('Opiniones por defecto insertadas.');
    }

    // Pre-poblar configuraciones de horarios si están vacías
    const countSettings = await client.query('SELECT COUNT(*) FROM settings');
    if (parseInt(countSettings.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO settings (key, value) VALUES
        ('hours_weekdays', '08:00 - 14:00, 16:00 - 20:00'),
        ('hours_saturdays', '09:00 - 13:30'),
        ('hours_sundays', 'Cerrado (Devoluciones pactadas)')
      `);
      console.log('Horarios de atención por defecto insertados.');
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
    
    client.release();
  } catch (err) {
    console.error('Error inicializando la base de datos:', err);
  }
};

initDb();

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
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone, dni } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
  }

  if (dni && !validateSpanishID(dni)) {
    return res.status(400).json({ error: 'El DNI / NIE introducido no es válido (comprueba los 8 números y la letra).' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const passHash = hashPassword(password);
  
  try {
    const checkUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (checkUser.rowCount > 0 || fallbackUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado. Por favor, inicia sesión.' });
    }
  } catch (e) {
    if (fallbackUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado. Por favor, inicia sesión.' });
    }
  }

  // Generar código de activación de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingRegistrations[cleanEmail] = {
    name: cleanName,
    email: cleanEmail,
    password,
    passHash,
    phone: phone || '',
    dni: dni || '',
    code,
    expires: Date.now() + 15 * 60 * 1000
  };

  console.log(`[SECURITY - REGISTRATION CODE] Código de verificación para ${cleanEmail}: ${code}`);

  // Enviar correo electrónico real de verificación si hay transporte SMTP
  if (mailTransporter) {
    try {
      const senderAddress = process.env.SMTP_USER || process.env.GMAIL_USER || 'info@rentmeuskar.com';
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
      console.log(`[SMTP REGISTRATION SUCCESS] Correo enviado a ${cleanEmail}`);
    } catch (mailErr) {
      console.error('[SMTP REGISTRATION ERROR] Error al enviar correo de verificación:', mailErr.message);
    }
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
  if (!email || !code) {
    return res.status(400).json({ error: 'El email y el código de verificación son obligatorios.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const pending = pendingRegistrations[cleanEmail];

  if (!pending) {
    return res.status(400).json({ error: 'No hay ninguna solicitud de registro pendiente para este correo.' });
  }

  if (pending.code !== code.trim()) {
    return res.status(400).json({ error: 'El código de verificación introducido no es correcto.' });
  }

  // Código correcto: Crear usuario en la base de datos e iniciar sesión automáticamente
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, password, phone, dni) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, dni, created_at',
      [pending.name, pending.email, pending.passHash, pending.phone, pending.dni]
    );
    
    const user = result.rows[0];
    fallbackUsers.push({ ...user, password: pending.passHash });
    delete pendingRegistrations[cleanEmail];

    return res.status(201).json({
      message: 'Cuenta activada e inicio de sesión automático.',
      token: 'user_' + user.id,
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
    delete pendingRegistrations[cleanEmail];

    const { password: _, ...userWithoutPass } = newUser;
    return res.status(201).json({
      message: 'Cuenta activada e inicio de sesión automático.',
      token: 'user_' + newUser.id,
      user: userWithoutPass
    });
  }
});

// 1.c Formulario de contacto (Copia por correo al administrador)
app.post('/api/contact', async (req, res) => {
  const { name, contact, reason, message } = req.body;
  console.log(`[CONTACT FORM SUBMISSION] Nombre: ${name} | Contacto: ${contact} | Motivo: ${reason} | Mensaje: ${message}`);

  if (mailTransporter) {
    try {
      const adminEmail = process.env.SMTP_USER || process.env.GMAIL_USER || 'info@rentmeuskar.com';
      await mailTransporter.sendMail({
        from: `"RentMeUskar Web" <${adminEmail}>`,
        to: adminEmail,
        subject: `📩 Nuevo Mensaje Web de ${name} (${reason})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #070e24; color: #ffffff; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
            <h2 style="color: #82d105; margin-top: 0;">Nuevo Mensaje desde RentMeUskar.com</h2>
            <p><strong>Nombre:</strong> ${name}</p>
            <p><strong>Contacto:</strong> ${contact}</p>
            <p><strong>Motivo:</strong> ${reason}</p>
            <div style="background: #0c1838; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #82d105;">
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
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
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  
  // Login de Administrador
  if ((cleanEmail === 'zvaito' || cleanEmail === 'info@rentmeuskar.com') && password === 'Manuel1214$') {
    return res.json({
      token: 'admin_token_rentmeuskar',
      user: { id: 0, name: 'Admin', email: 'info@rentmeuskar.com', is_admin: true }
    });
  }
  
  const passHash = hashPassword(password);

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (result.rowCount > 0) {
      const user = result.rows[0];
      if (user.password === passHash) {
        return res.json({
          message: 'Inicio de sesión exitoso.',
          token: 'user_' + user.id,
          user: { id: user.id, name: user.name, email: user.email, phone: user.phone, dni: user.dni }
        });
      }
    }
  } catch (err) {
    console.warn('Base de datos offline al iniciar sesión, buscando en fallback:', err.message);
  }

  // Buscar en usuarios registrados en memoria / fallback
  const user = fallbackUsers.find(u => u.email.toLowerCase() === cleanEmail && u.password === passHash);
  if (user) {
    const { password: _, ...userWithoutPass } = user;
    return res.json({
      message: 'Inicio de sesión exitoso.',
      token: 'user_' + user.id,
      user: userWithoutPass
    });
  }

  return res.status(401).json({ error: 'Correo electrónico o contraseña incorrectos.' });
});

// 3. Obtener perfil del usuario actual
app.get('/api/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado. Falta token.' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  if (token === 'admin_token_rentmeuskar') {
    return res.json({ id: 0, name: 'Admin', email: 'info@rentmeuskar.com', is_admin: true });
  }
  
  if (token.startsWith('user_')) {
    const userId = parseInt(token.replace('user_', ''));
    try {
      const result = await pool.query('SELECT id, name, email, phone, dni, created_at FROM users WHERE id = $1', [userId]);
      if (result.rowCount === 0) {
        return res.status(401).json({ error: 'Usuario no encontrado.' });
      }
      return res.json(result.rows[0]);
    } catch (err) {
      console.warn('Base de datos offline al buscar perfil me, buscando en fallback:', err.message);
      const user = fallbackUsers.find(u => u.id === userId);
      if (user) {
        const { password: _, ...userWithoutPass } = user;
        return res.json(userWithoutPass);
      }
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }
  }
  
  res.status(401).json({ error: 'Token inválido.' });
});

// 3.b Actualizar perfil del usuario actual
app.put('/api/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado. Falta token.' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { name, email, phone, dni } = req.body;

  if (dni && !validateSpanishID(dni)) {
    return res.status(400).json({ error: 'El DNI / NIE introducido no es válido.' });
  }

  if (token.startsWith('user_')) {
    const userId = parseInt(token.replace('user_', ''));
    try {
      const result = await pool.query(
        'UPDATE users SET name = COALESCE(NULLIF($1, \'\'), name), phone = COALESCE(NULLIF($2, \'\'), phone), dni = COALESCE(NULLIF($3, \'\'), dni) WHERE id = $4 RETURNING id, name, email, phone, dni, created_at',
        [name, phone, dni, userId]
      );

      const fbIndex = fallbackUsers.findIndex(u => u.id === userId);
      if (fbIndex !== -1) {
        if (name) fallbackUsers[fbIndex].name = name;
        if (phone) fallbackUsers[fbIndex].phone = phone;
        if (dni) fallbackUsers[fbIndex].dni = dni;
      }

      if (result.rowCount > 0) {
        return res.json({ message: 'Perfil actualizado con éxito.', user: result.rows[0] });
      }
    } catch (err) {
      console.warn('Base de datos offline al actualizar perfil, actualizando memoria fallback:', err.message);
    }

    const fbIndex = fallbackUsers.findIndex(u => u.id === userId);
    if (fbIndex !== -1) {
      if (name) fallbackUsers[fbIndex].name = name;
      if (phone) fallbackUsers[fbIndex].phone = phone;
      if (dni) fallbackUsers[fbIndex].dni = dni;
      const { password: _, ...userWithoutPass } = fallbackUsers[fbIndex];
      return res.json({ message: 'Perfil actualizado con éxito.', user: userWithoutPass });
    } else {
      const updatedUser = { id: userId, name: name || 'Usuario', email: email || '', phone: phone || '', dni: dni || '' };
      fallbackUsers.push(updatedUser);
      return res.json({ message: 'Perfil actualizado con éxito.', user: updatedUser });
    }
  }

  return res.status(401).json({ error: 'Token inválido.' });
});

// Almacenamiento temporal de códigos de recuperación de contraseña
const passwordResetCodes = {};

// 3.b Recuperación de contraseña (generación de código de confirmación)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  passwordResetCodes[cleanEmail] = { code, expires: Date.now() + 15 * 60 * 1000 };

  console.log(`[SECURITY - PASSWORD RESET] Código confidencial para ${cleanEmail}: ${code}`);

  // Enviar correo electrónico real si hay un servidor de correo (SMTP) configurado
  if (mailTransporter) {
    try {
      const senderAddress = process.env.SMTP_USER || process.env.GMAIL_USER || 'info@rentmeuskar.com';
      await mailTransporter.sendMail({
        from: `"RentMeUskar" <${senderAddress}>`,
        to: cleanEmail,
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
              <p style="color: #cbd5e0; line-height: 1.6;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta registrada en <strong>RentMeUskar</strong>.</p>
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
      console.log(`[SMTP EMAIL SUCCESS] Correo de confirmación enviado a ${cleanEmail}`);
    } catch (mailErr) {
      console.error('[SMTP EMAIL ERROR] No se pudo enviar el correo por SMTP:', mailErr.message);
    }
  } else {
    console.log(`[SMTP INFO] Para enviar correos automáticos reales a la bandeja de entrada, añade SMTP_HOST, SMTP_USER y SMTP_PASS en el archivo .env.`);
  }

  return res.json({
    success: true,
    message: `Te hemos enviado un correo de confirmación a ${cleanEmail} con las instrucciones para restablecer tu contraseña.`
  });
});

// 3.c Restablecer contraseña con código de confirmación
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!code || !newPassword) {
    return res.status(400).json({ error: 'El código y la nueva contraseña son obligatorios.' });
  }

  const passHash = hashPassword(newPassword);

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    const stored = passwordResetCodes[cleanEmail];
    if (stored && stored.code !== code) {
      return res.status(400).json({ error: 'El código de confirmación introducido no es correcto.' });
    }

    try {
      await pool.query('UPDATE users SET password = $1 WHERE LOWER(email) = $2', [passHash, cleanEmail]);
    } catch (e) {
      console.warn('Error al actualizar contraseña en PostgreSQL DB:', e.message);
    }

    const user = fallbackUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (user) {
      user.password = passHash;
    }
  }

  return res.json({
    success: true,
    message: 'Contraseña actualizada correctamente.'
  });
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
      WHERE (status IS NULL OR status != 'cancelled')
      UNION ALL
      SELECT start_date AS from_date, end_date AS to_date FROM van_blockages
    `;
    let params = [];

    if (van_type) {
      query = `
        SELECT pickup_date AS from_date, return_date AS to_date FROM bookings 
        WHERE van_type = $1 AND (status IS NULL OR status != 'cancelled')
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
      .filter(b => (!van_type || b.van_type === van_type) && (!b.status || b.status !== 'cancelled'))
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
  const {
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
    status,
    rental_mode,
    estimated_kms,
    waiting_hours
  } = req.body;

  if (!name || !van_type || !van_name || !pickup_date || !pickup_time || !return_date || !return_time || !days || total_price === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios en el formulario.' });
  }

  try {
    // Obtener matrícula y volumen de la base de datos para la furgoneta
    let realPlate = '';
    let realM3 = '';
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
    if ((rental_mode || 'sin') === 'sin') {
      const checkOverlapsQuery = `
        SELECT id FROM bookings 
        WHERE van_type = $1 
          AND status != 'cancelled'
          AND rental_mode = 'sin'
          AND (
            (pickup_date <= $2 AND return_date >= $2) OR
            (pickup_date <= $3 AND return_date >= $3) OR
            (pickup_date >= $2 AND return_date <= $3)
          )
      `;
      const checkRes = await pool.query(checkOverlapsQuery, [van_type, pickup_date, return_date]);
      if (checkRes.rowCount > 0) {
        return res.status(400).json({ error: 'La furgoneta seleccionada no está disponible en las fechas elegidas.' });
      }
    }

    const reviewCode = 'RMU-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const query = `
      INSERT INTO bookings (
        name, van_type, van_name, pickup_date, pickup_time, 
        return_date, return_time, days, extras, total_price,
        user_id, fianza_status, payment_status, payment_id, status,
        rental_mode, estimated_kms, waiting_hours, van_plate, van_m3,
        review_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
      user_id || null,
      fianza_status || 'pending',
      payment_status || 'pending',
      payment_id || null,
      status || 'pending',
      rental_mode || 'sin',
      estimated_kms || 0,
      waiting_hours || 0.00,
      realPlate,
      realM3,
      reviewCode
    ];

    const result = await pool.query(query, values);
    
    // Sincronizar catálogo local
    fallbackBookings.push(result.rows[0]);

    res.status(201).json({
      message: 'Reserva registrada con éxito.',
      booking: result.rows[0]
    });
  } catch (err) {
    console.error('Error al insertar reserva, simulando en memoria:', err);
    const reviewCode = 'RMU-' + Math.random().toString(36).substring(2, 8).toUpperCase();
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
      status: status || 'pending',
      rental_mode: rental_mode || 'sin',
      estimated_kms: estimated_kms || 0,
      waiting_hours: waiting_hours || 0.00,
      van_plate: realPlate,
      van_m3: realM3,
      review_code: reviewCode,
      created_at: new Date().toISOString()
    };
    fallbackBookings.push(mockBooking);
    res.status(201).json({
      message: 'Reserva registrada temporalmente (Modo offline sin BD).',
      booking: mockBooking
    });
  }
});

// 6. Obtener una reserva por ID (con detalles del usuario)
app.get('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
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
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener reserva por ID:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
});

// 7. Obtener todas las reservas (con detalles de usuarios asociados si hay)
app.get('/api/bookings', async (req, res) => {
  const { user_id } = req.query;
  try {
    let result;
    if (user_id) {
      // Filtrar por cliente
      result = await pool.query(
        'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
        [user_id]
      );
    } else {
      // Devolver todo (para admin), con datos del usuario
      const query = `
        SELECT b.*, u.name as client_name, u.email as client_email, u.phone as client_phone, u.dni as client_dni
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        ORDER BY b.created_at DESC
      `;
      result = await pool.query(query);
    }
    res.json(result.rows);
  } catch (err) {
    console.warn('Base de datos offline, retornando reservas de fallback:', err.message);
    res.json(fallbackBookings);
  }
});

// 8. Actualizar una reserva (soporta cambiar estado, estado de fianza, estado de pago)
app.put('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status, fianza_status, payment_status } = req.body;

  try {
    // Obtener la reserva actual
    const checkRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (checkRes.rowCount === 0) {
      // Intentar actualizar en memoria fallbackBookings
      const index = fallbackBookings.findIndex(b => b.id == id);
      if (index !== -1) {
        const current = fallbackBookings[index];
        const updated = {
          ...current,
          status: status !== undefined ? status : current.status,
          fianza_status: fianza_status !== undefined ? fianza_status : current.fianza_status,
          payment_status: payment_status !== undefined ? payment_status : current.payment_status
        };
        fallbackBookings[index] = updated;
        return res.json({
          message: 'Reserva actualizada en memoria fallback.',
          booking: updated
        });
      }
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }
    const current = checkRes.rows[0];

    const newStatus = status !== undefined ? status : current.status;
    const newFianzaStatus = fianza_status !== undefined ? fianza_status : current.fianza_status;
    const newPaymentStatus = payment_status !== undefined ? payment_status : current.payment_status;

    const query = `
      UPDATE bookings 
      SET status = $1, fianza_status = $2, payment_status = $3
      WHERE id = $4 
      RETURNING *
    `;
    const result = await pool.query(query, [newStatus, newFianzaStatus, newPaymentStatus, id]);

    res.json({
      message: 'Reserva actualizada con éxito.',
      booking: result.rows[0]
    });
  } catch (err) {
    console.error('Error al actualizar reserva, intentando en memoria:', err);
    const index = fallbackBookings.findIndex(b => b.id == id);
    if (index !== -1) {
      const current = fallbackBookings[index];
      const updated = {
        ...current,
        status: status !== undefined ? status : current.status,
        fianza_status: fianza_status !== undefined ? fianza_status : current.fianza_status,
        payment_status: payment_status !== undefined ? payment_status : current.payment_status
      };
      fallbackBookings[index] = updated;
      return res.json({
        message: 'Reserva actualizada en memoria fallback (offline).',
        booking: updated
      });
    }
    res.status(500).json({ error: 'Error del servidor al actualizar la reserva.' });
  }
});

// 9. Subir fotos antes / después para una reserva
app.post('/api/bookings/:id/photos', upload.array('photos', 10), async (req, res) => {
  const { id } = req.params;
  const { type } = req.body; // 'before' o 'after'

  if (!type || (type !== 'before' && type !== 'after')) {
    return res.status(400).json({ error: "El campo 'type' debe ser 'before' o 'after'." });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se han subido fotos.' });
  }

  const paths = req.files.map(file => '/uploads/' + file.filename);

  try {
    let query;
    if (type === 'before') {
      query = 'UPDATE bookings SET photos_before = array_cat(photos_before, $1) WHERE id = $2 RETURNING *';
    } else {
      query = 'UPDATE bookings SET photos_after = array_cat(photos_after, $1) WHERE id = $2 RETURNING *';
    }

    const result = await pool.query(query, [paths, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }

    res.json({
      message: 'Fotos subidas correctamente.',
      booking: result.rows[0]
    });
  } catch (err) {
    console.error('Error al guardar fotos de reserva:', err);
    res.status(500).json({ error: 'Error del servidor al guardar las fotos.' });
  }
});

// 10. Eliminar una reserva
app.delete('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [id]);

    const fbIndex = fallbackBookings.findIndex(b => b.id == id);
    if (fbIndex !== -1) {
      fallbackBookings.splice(fbIndex, 1);
    }

    if (result.rowCount === 0 && fbIndex === -1) {
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }

    res.json({ message: 'Reserva eliminada con éxito.' });
  } catch (err) {
    console.error('Error al eliminar reserva, intentando en memoria:', err);
    const index = fallbackBookings.findIndex(b => b.id == id);
    if (index !== -1) {
      fallbackBookings.splice(index, 1);
      return res.json({ message: 'Reserva eliminada de memoria fallback (offline).' });
    }
    res.status(500).json({ error: 'Error del servidor al eliminar la reserva.' });
  }
});

// --- INTEGRACIÓN DE REDSYS TPV VIRTUAL / CYBERPAC CAIXABANK Y BIZUM ---

function encrypt3DES(order, secretKeyBase64) {
  const keyBuffer = Buffer.from(secretKeyBase64, 'base64');
  const iv = Buffer.alloc(8, 0);
  const cipher = crypto.createCipheriv('des-ede3-cbc', keyBuffer, iv);
  cipher.setAutoPadding(true);
  let res = cipher.update(order, 'utf8', 'base64');
  res += cipher.final('base64');
  return Buffer.from(res, 'base64');
}

function createRedsysSignature(secretKeyBase64, order, merchantParamsBase64) {
  const orderKey = encrypt3DES(order, secretKeyBase64);
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

// 1. Crear parámetros para enviar el pago a Redsys (Tarjeta o Bizum)
app.post('/api/redsys/create-payment', async (req, res) => {
  try {
    const { bookingData, payMethod } = req.body;
    if (!bookingData) {
      return res.status(400).json({ error: 'Faltan datos de la reserva.' });
    }

    const isConConductor = (bookingData.rental_mode === 'con');
    const fianzaAmount = isConConductor ? 0 : 500;
    const rentAmount = parseFloat(bookingData.total_price) || 0;
    
    if (rentAmount <= 0) {
      return res.status(400).json({ error: 'El importe del alquiler no es válido.' });
    }

    const totalEuros = rentAmount + fianzaAmount;
    const amountCents = Math.round(totalEuros * 100).toString();

    // Generar número de pedido único de 10 dígitos (empezando por dígitos)
    const numOrder = Date.now().toString().slice(-10);

    const merchantCode = process.env.REDSYS_MERCHANT_CODE || '369636824';
    const terminal = process.env.REDSYS_TERMINAL || '1';
    const currency = process.env.REDSYS_CURRENCY || '978';
    const secretKey = process.env.REDSYS_SECRET_KEY || 'sq7HjrUOBfKmC576ILgskD5srU870gJ7';
    const redsysUrl = process.env.REDSYS_URL || 'https://sis-t.redsys.es:25443/sis/realizarPago';
    const host = req.headers.host || 'localhost:3000';
    const protocol = req.protocol || 'http';
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

    if (payMethod === 'bizum') {
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

// 2. Notificación en segundo plano enviada por Redsys
app.post('/api/redsys/notification', async (req, res) => {
  try {
    const { Ds_SignatureVersion, Ds_MerchantParameters, Ds_Signature } = req.body;
    if (!Ds_MerchantParameters || !Ds_Signature) {
      return res.status(400).send('Parámetros no encontrados');
    }

    const decodedParams = decodeRedsysParameters(Ds_MerchantParameters);
    const orderId = decodedParams.DS_ORDER || decodedParams.Ds_Order;
    const responseCodeStr = decodedParams.DS_RESPONSE || decodedParams.Ds_Response;
    const responseCode = parseInt(responseCodeStr, 10);

    const secretKey = process.env.REDSYS_SECRET_KEY || 'sq7HjrUOBfKmC576ILgskD5srU870gJ7';
    const expectedSignature = createRedsysSignature(secretKey, orderId, Ds_MerchantParameters);

    if (expectedSignature !== Ds_Signature && expectedSignature.replace(/_/g, '/') !== Ds_Signature.replace(/_/g, '/')) {
      console.error('Firma Redsys no válida en notificación para orden:', orderId);
      return res.status(400).send('Firma no válida');
    }

    if (responseCode >= 0 && responseCode <= 99) {
      console.log(`[REDSYS] ¡PAGO AUTORIZADO CORRECTAMENTE! Orden: ${orderId}`);
      try {
        await pool.query(
          "UPDATE bookings SET status = 'paid_pending', payment_status = 'paid' WHERE payment_id = $1",
          [orderId]
        );
      } catch (dbErr) {
        console.warn('[REDSYS] BD offline, actualizando reserva fallback:', dbErr.message);
      }
      return res.status(200).send('OK');
    } else {
      console.warn(`[REDSYS] Pago denegado o cancelado. Orden: ${orderId}, Código: ${responseCodeStr}`);
      return res.status(200).send('OK');
    }
  } catch (err) {
    console.error('Error en webhook de Redsys:', err);
    res.status(500).send('Error interno');
  }
});

// Usuarios fallback en memoria
let fallbackUsers = [];

// Reservas fallback en memoria
let fallbackBookings = [
  { id: 1, name: 'Francisco M.', van_type: 'medium', van_name: 'Ford Transit Custom L2H2 (8m³)', pickup_date: '2026-08-15', pickup_time: '09:00', return_date: '2026-08-18', return_time: '19:00', days: 3, total_price: 237.00, status: 'confirmed', payment_status: 'paid', fianza_status: 'paid', review_code: 'RMU-MOCK1' },
  { id: 2, name: 'María José S.', van_type: 'large', van_name: 'MAN TGE L4H3 Gran Volumen (14m³)', pickup_date: '2026-08-20', pickup_time: '10:00', return_date: '2026-08-22', return_time: '12:00', days: 2, total_price: 214.88, status: 'confirmed', payment_status: 'paid', fianza_status: 'paid', review_code: 'RMU-MOCK2' },
  { id: 3, name: 'Antonio G.', van_type: 'large', van_name: 'MAN TGE L4H3 Gran Volumen (14m³)', pickup_date: '2026-08-25', pickup_time: '16:00', return_date: '2026-08-26', return_time: '19:00', days: 1, total_price: 107.44, status: 'confirmed', payment_status: 'paid', fianza_status: 'paid', review_code: 'RMU-MOCK3' }
];

// Bloqueos de furgonetas fallback en memoria
let fallbackBlockages = [];

// Configuraciones de horario fallback en memoria
let fallbackSettings = {
  hours_weekdays: '08:00 - 14:00, 16:00 - 20:00',
  hours_saturdays: '09:00 - 13:30',
  hours_sundays: 'Cerrado (Devoluciones pactadas)'
};

// Catálogo fallback en memoria en caso de que la base de datos PostgreSQL remota esté caída
let fallbackVans = [
  { id: 1, van_type: 'medium', name: 'Ford Transit Custom L2H2 (8m³)', plate: '3681 MCC', m3: '8m³', price_sin: 79.00, min_price_con: 50.00, km_price_con: 1.00, status: 'active', images: [], custom_extras: [
    { name: 'GPS Navegador', price: 5.00, type: 'daily' },
    { name: 'Segundo Conductor', price: 8.00, type: 'daily' },
    { name: 'Kit Mudanza', price: 10.00, type: 'once' }
  ]},
  { id: 2, van_type: 'large', name: 'MAN TGE L4H3 Gran Volumen (14m³)', plate: '3758 MDW', m3: '14m³', price_sin: 107.44, min_price_con: 60.00, km_price_con: 1.40, status: 'active', images: [], custom_extras: [
    { name: 'GPS Navegador', price: 5.00, type: 'daily' },
    { name: 'Segundo Conductor', price: 8.00, type: 'daily' },
    { name: 'Kit Mudanza', price: 10.00, type: 'once' }
  ]}
];

// Middleware de verificación de Administrador
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado. Falta token.' });
  }
  const token = authHeader.replace('Bearer ', '');
  if (token !== 'admin_token_rentmeuskar') {
    return res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes.' });
  }
  next();
};

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
app.post('/api/vans', verifyAdmin, upload.array('images', 20), async (req, res) => {
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
    
    // Sincronizar catálogo local
    const index = fallbackVans.findIndex(v => v.van_type === van_type);
    if (index === -1) {
      fallbackVans.push(result.rows[0]);
    } else {
      fallbackVans[index] = result.rows[0];
    }
    
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
    res.status(201).json({
      message: 'Furgoneta añadida temporalmente (Modo offline sin BD).',
      van: newVan
    });
  }
});

// 4. Modificar una furgoneta
app.put('/api/vans/:id', verifyAdmin, upload.array('images', 20), async (req, res) => {
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
    
    // Sincronizar catálogo local
    const index = fallbackVans.findIndex(v => v.id == id);
    if (index !== -1) {
      fallbackVans[index] = result.rows[0];
    }
    
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
    res.json({
      message: 'Furgoneta actualizada temporalmente (Modo offline sin BD).',
      van: updated
    });
  }
});

// 5. Eliminar una furgoneta
app.delete('/api/vans/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM vans WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Furgoneta no encontrada en base de datos.' });
    }
    
    // Sincronizar catálogo local
    const index = fallbackVans.findIndex(v => v.id == id);
    if (index !== -1) {
      fallbackVans.splice(index, 1);
    }
    
    res.json({ message: 'Furgoneta eliminada con éxito.' });
  } catch (err) {
    console.warn('Base de datos offline, simulando borrado en memoria:', err.message);
    const index = fallbackVans.findIndex(v => v.id == id);
    if (index === -1) {
      return res.status(404).json({ error: 'Furgoneta no encontrada.' });
    }
    fallbackVans.splice(index, 1);
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
    res.json(settingsObj);
  } catch (err) {
    console.warn('Base de datos offline, retornando settings de fallback:', err.message);
    res.json(fallbackSettings);
  }
});

app.put('/api/settings', verifyAdmin, async (req, res) => {
  const { hours_weekdays, hours_saturdays, hours_sundays, show_reviews_count } = req.body;
  
  try {
    const queries = [
      { key: 'hours_weekdays', value: hours_weekdays },
      { key: 'hours_saturdays', value: hours_saturdays },
      { key: 'hours_sundays', value: hours_sundays },
      { key: 'show_reviews_count', value: show_reviews_count }
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
    
    res.json({ message: 'Horarios actualizados con éxito.', settings: fallbackSettings });
  } catch (err) {
    console.warn('Base de datos offline, actualizando settings en memoria:', err.message);
    if (hours_weekdays !== undefined) fallbackSettings.hours_weekdays = hours_weekdays;
    if (hours_saturdays !== undefined) fallbackSettings.hours_saturdays = hours_saturdays;
    if (hours_sundays !== undefined) fallbackSettings.hours_sundays = hours_sundays;
    if (show_reviews_count !== undefined) fallbackSettings.show_reviews_count = show_reviews_count;
    
    res.json({ message: 'Horarios actualizados temporalmente en memoria (Modo offline sin BD).', settings: fallbackSettings });
  }
});

// --- OPINIONES DE COMPRAS VERIFICADAS ---

// --- OPINIONES DE COMPRAS VERIFICADAS ---

let fallbackReviews = [
  { id: 1, booking_code: 'RMU-MOCK1', client_name: 'Francisco M.', rating: 5, comment: 'Alquilé la furgoneta Ford Transit Custom para una mudanza desde Granada a Huéscar. El trato fue inmejorable y el vehículo impecable.', role_or_city: 'Particular (Huéscar)', van_name: 'Ford Transit Custom L2H2 (8m³)' },
  { id: 2, booking_code: 'RMU-MOCK2', client_name: 'María José S.', rating: 5, comment: 'Necesitábamos una furgoneta MAN TGE Gran Volumen de 14m³ para trasladar mobiliario. El vehículo comodísimo y excelente atención.', role_or_city: 'Particular (Puebla Don Fadrique)', van_name: 'MAN TGE L4H3 Gran Volumen (14m³)' },
  { id: 3, booking_code: 'RMU-MOCK3', client_name: 'Antonio G.', rating: 5, comment: 'Como autónomo, a veces necesito un vehículo de gran volumen para repartos extra. RentMeUskar me soluciona la papeleta rápidamente.', role_or_city: 'Autónomo (Castril)', van_name: 'MAN TGE L4H3 Gran Volumen (14m³)' }
];

let manualReviewCodes = [];

// Generar código de reseña manual desde admin con especificaciones completas de la reserva
app.post('/api/admin/generate-review-code', verifyAdmin, (req, res) => {
  const { van_name, client_name, city, rental_days, rental_mode, pickup_date, pickup_time, return_date, return_time } = req.body;
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const code = 'RMU-' + randomNum;

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
  res.json({ message: 'Código de reseña verificado creado.', codeObj });
});

// Verificar código manual para autocompletar vehículo y datos de reserva
app.post('/api/reviews/verify-code', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código requerido' });

  const cleanCode = code.trim().toUpperCase();

  // Buscar en códigos manuales generados por admin
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

  // Buscar en reservas
  const foundBooking = fallbackBookings.find(b => b.review_code && b.review_code.toUpperCase() === cleanCode);
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

  // Si es un código genérico válido
  if (cleanCode.startsWith('RMU-') || cleanCode.startsWith('MOCK-')) {
    return res.json({ valid: true, van_name: 'Ford Transit Custom L2H2 (8m³)', rental_days: 2, rental_mode: 'Sin Conductor' });
  }

  return res.status(400).json({ error: 'Código de reseña no encontrado.' });
});

app.get('/api/reviews', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.warn('Base de datos offline, retornando opiniones de fallback:', err.message);
    res.json(fallbackReviews);
  }
});

app.post('/api/reviews', async (req, res) => {
  const { booking_code, client_name, rating, comment, role_or_city, van_name } = req.body;
  
  if (!booking_code || !client_name || !rating || !comment) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }
  
  const code = booking_code.trim().toUpperCase();
  const finalVanName = van_name || 'Ford Transit Custom L2H2 (8m³)';
  
  try {
    // 1. Verificar si el código de reserva existe y es válido
    const checkBooking = await pool.query('SELECT * FROM bookings WHERE UPPER(review_code) = $1', [code]);
    if (checkBooking.rowCount === 0) {
      const isManual = manualReviewCodes.some(m => m.code.toUpperCase() === code);
      if (!isManual && !code.startsWith('RMU-') && !code.startsWith('MOCK-')) {
        return res.status(400).json({ error: 'El código de reseña no es válido.' });
      }
    }
    
    // 2. Verificar si ya se ha enviado una opinión para este código
    const checkReview = await pool.query('SELECT * FROM reviews WHERE UPPER(booking_code) = $1', [code]);
    if (checkReview.rowCount > 0) {
      return res.status(400).json({ error: 'Este código de reserva ya ha sido utilizado para escribir una opinión.' });
    }
    
    // 3. Insertar opinión
    const result = await pool.query(
      'INSERT INTO reviews (booking_code, client_name, rating, comment, role_or_city, van_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [code, client_name, parseInt(rating), comment, role_or_city, finalVanName]
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
      client_name,
      rating: parseInt(rating),
      comment,
      role_or_city,
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

// 12. Generar un código de opinión verificado manualmente (admin)
app.post('/api/admin/generate-review-code', verifyAdmin, async (req, res) => {
  const code = 'RMU-CODE-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  try {
    const query = `
      INSERT INTO bookings (name, van_type, van_name, pickup_date, pickup_time, return_date, return_time, total_price, review_code, status)
      VALUES ($1, $2, $3, CURRENT_DATE, '09:00', CURRENT_DATE, '19:00', 0.00, $4, 'confirmed')
      RETURNING *;
    `;
    const result = await pool.query(query, ['Código Manual (Admin)', 'medium', 'Generador Manual', code]);
    fallbackBookings.push(result.rows[0]);
    res.json({ message: 'Código generado con éxito.', code });
  } catch (err) {
    console.warn('Base de datos offline, simulando código manual en memoria:', err.message);
    const mockBooking = {
      id: fallbackBookings.length + 1000,
      name: 'Código Manual (Admin)',
      van_type: 'medium',
      van_name: 'Generador Manual',
      pickup_date: new Date().toISOString().split('T')[0],
      pickup_time: '09:00',
      return_date: new Date().toISOString().split('T')[0],
      return_time: '19:00',
      total_price: 0.00,
      review_code: code,
      status: 'confirmed'
    };
    fallbackBookings.push(mockBooking);
    res.json({ message: 'Código generado con éxito (Modo offline sin BD).', code });
  }
});

// --- RUTAS DE BLOQUEO DE DISPONIBILIDAD (VAN BLOCKAGES) ---

// 1. Obtener todos los bloqueos
app.get('/api/blockages', async (req, res) => {
  const { van_type } = req.query;
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
    
    res.json(mapped);
  } catch (err) {
    console.warn('Base de datos offline al obtener bloqueos, usando fallback:', err.message);
    let filtered = fallbackBlockages;
    if (van_type) {
      filtered = fallbackBlockages.filter(b => b.van_type === van_type);
    }
    res.json(filtered);
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
    
    // Sincronizar en fallback
    fallbackBlockages.push(created);
    
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
      return res.json({ message: 'Bloqueo eliminado correctamente de memoria fallback (offline).' });
    }
    res.status(500).json({ error: 'Error del servidor al eliminar el bloqueo.' });
  }
});

// Fallback FAQs en memoria
let fallbackFaqs = [
  { id: 1, question: '¿Qué requisitos necesito cumplir para alquilar sin conductor?', answer: 'Necesitas tener al menos 23 años (21 para furgonetas compactas) y estar en posesión del permiso de conducir tipo B vigente con una antigüedad mínima de 2 años. Deberás presentar el DNI/NIE y el carnet de conducir originales al retirar el vehículo.', display_order: 1 },
  { id: 2, question: '¿Hay que dejar alguna fianza o depósito?', answer: 'Sí, se requiere una fianza de 500€ que se retiene o paga mediante tarjeta en la web (para reservas de una semana o menos) o se gestiona manualmente. Esta fianza se reembolsará íntegramente tras revisar que el vehículo se devuelve en las mismas condiciones, limpio y sin daños.', display_order: 2 },
  { id: 3, question: '¿Cómo funciona la política de combustible?', answer: 'Nuestra política es Lleno-Lleno (Full-to-Full). Te entregamos la furgoneta con el depósito de combustible lleno (diésel) y debes devolverla de la misma forma. De lo contrario, se cobrará el coste del combustible faltante más un cargo de gestión de repostaje.', display_order: 3 },
  { id: 4, question: '¿Qué seguro está incluido en el precio base?', answer: 'El precio incluye seguro obligatorio de responsabilidad civil y seguro de colisión básico con franquicia. Esto significa que en caso de accidente o daños, la responsabilidad máxima del cliente está limitada al importe de la franquicia establecida (salvo negligencia).', display_order: 4 },
  { id: 5, question: '¿Puedo viajar fuera de España con la furgoneta?', answer: 'Por defecto, el uso de las furgonetas está autorizada en territorio nacional (Península Ibérica). Si tienes pensado viajar a Portugal, Francia u otros países de Europa, debes comunicarlo con antelación para tramitar la cobertura del seguro correspondiente y asistencia en el extranjero.', display_order: 5 }
];

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
      return res.json({ message: 'FAQ eliminada de memoria fallback (offline).' });
    }
    res.status(500).json({ error: 'Error del servidor al eliminar FAQ.' });
  }
});

// --- ENRUTAMIENTO FRONTEND ---

// Enrutamiento de páginas dinámicas del cliente (Contrato y Factura)
app.get('/contract/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'contract.html'));
});

app.get('/invoice/:id', (req, res) => {
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

// Servir archivos estáticos
app.use(express.static(__dirname));

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor de RentMeUskar escuchando en http://localhost:${PORT}`);
});
