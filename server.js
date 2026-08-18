require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

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
    "ALTER TABLE vans ADD COLUMN IF NOT EXISTS waiting_hour_price NUMERIC(10, 2) DEFAULT 30.00;"
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

// 1. Registro de usuarios
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone, dni } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
  }
  
  try {
    const checkUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkUser.rowCount > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }
    
    const passHash = hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, phone, dni) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, dni, created_at',
      [name, email, passHash, phone, dni]
    );
    
    const user = result.rows[0];
    res.status(201).json({
      message: 'Usuario registrado con éxito.',
      token: 'user_' + user.id,
      user
    });
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor al registrar el usuario.' });
  }
});

// 2. Inicio de sesión
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }
  
  // Login de Administrador
  if (email === 'zVaito' && password === 'Manuel1214$') {
    return res.json({
      token: 'admin_token_rentmeuskar',
      user: { id: 0, name: 'Admin', email: 'info@rentmeuskar.com', is_admin: true }
    });
  }
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
    
    const user = result.rows[0];
    const passHash = hashPassword(password);
    if (user.password !== passHash) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
    
    res.json({
      message: 'Inicio de sesión exitoso.',
      token: 'user_' + user.id,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, dni: user.dni }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
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
      console.error('Error al obtener perfil:', err);
      return res.status(500).json({ error: 'Error del servidor.' });
    }
  }
  
  res.status(401).json({ error: 'Token inválido.' });
});

// Helper para dar formato a fechas locales YYYY-MM-DD
const formatDateISO = (d) => {
  const date = new Date(d);
  const year = date.getFullYear();
  let month = '' + (date.getMonth() + 1);
  let day = '' + date.getDate();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
};

// 4. Obtener fechas de disponibilidad no disponibles (ocupadas) para una furgoneta
app.get('/api/bookings/unavailable-dates', async (req, res) => {
  const { van_type } = req.query;
  if (!van_type) {
    return res.status(400).json({ error: 'El parámetro van_type es obligatorio.' });
  }
  
  let ranges = [];
  try {
    const query = `
      SELECT pickup_date AS from_date, return_date AS to_date FROM bookings 
      WHERE van_type = $1 AND status != 'cancelled'
      UNION ALL
      SELECT start_date AS from_date, end_date AS to_date FROM van_blockages 
      WHERE van_type = $1
    `;
    const result = await pool.query(query, [van_type]);
    
    ranges = result.rows.map(row => ({
      from: formatDateISO(row.from_date),
      to: formatDateISO(row.to_date)
    }));
  } catch (err) {
    console.warn('Base de datos offline al obtener disponibilidad, usando fallback:', err.message);
    const bookingsRange = fallbackBookings
      .filter(b => b.van_type === van_type && b.status !== 'cancelled')
      .map(b => ({ from: b.pickup_date, to: b.return_date }));
    const blockagesRange = fallbackBlockages
      .filter(b => b.van_type === van_type)
      .map(b => ({ from: b.start_date, to: b.end_date }));
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

// --- RUTAS DE GESTIÓN DE FLOTA (FURGONETAS) ---

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

  try {
    // Comprobar si ya existe el tipo
    const checkRes = await pool.query('SELECT id FROM vans WHERE van_type = $1', [van_type]);
    if (checkRes.rowCount > 0) {
      return res.status(400).json({ error: 'Ya existe un tipo de furgoneta registrado con ese identificador.' });
    }

    const query = `
      INSERT INTO vans (van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status, images, custom_extras, max_occupants, eco_label, daily_km_limit, max_mass, fuel_type, waiting_hour_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *;
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
      parseFloat(waiting_hour_price) || 30.00
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
      waiting_hour_price: parseFloat(waiting_hour_price) || 30.00
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

  try {
    const checkRes = await pool.query('SELECT * FROM vans WHERE id = $1', [id]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Furgoneta no encontrada en base de datos.' });
    }
    const current = checkRes.rows[0];

    const query = `
      UPDATE vans 
      SET van_type = $1, name = $2, plate = $3, m3 = $4, price_sin = $5, min_price_con = $6, km_price_con = $7, status = $8, images = $9,
          custom_extras = $10, max_occupants = $11, eco_label = $12, daily_km_limit = $13, max_mass = $14, fuel_type = $15, waiting_hour_price = $16
      WHERE id = $17 RETURNING *;
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
      waiting_hour_price: waiting_hour_price !== undefined ? parseFloat(waiting_hour_price) : current.waiting_hour_price
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

let fallbackReviews = [
  { id: 1, booking_code: 'MOCK-1', client_name: 'Francisco M.', rating: 5, comment: 'Alquilé la furgoneta mediana para trasladar unos muebles desde Granada a Huéscar. El trato fue inmejorable y el vehículo estaba limpísimo. Repetiré seguro.', role_or_city: 'Particular (Huéscar)' },
  { id: 2, booking_code: 'MOCK-2', client_name: 'María José S.', rating: 5, comment: 'Necesitábamos una furgoneta de 9 plazas para un viaje de fin de semana con amigos de la Puebla de Don Fadrique. El viaje fue comodísimo y el precio muy razonable.', role_or_city: 'Viaje Familiar' },
  { id: 3, booking_code: 'MOCK-3', client_name: 'Antonio G.', rating: 5, comment: 'Como autónomo, a veces necesito un vehículo de gran volumen para repartos extra. RentMeUskar me soluciona la papeleta rápidamente y sin burocracia pesada.', role_or_city: 'Autónomo (Castril)' }
];

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
  const { booking_code, client_name, rating, comment, role_or_city } = req.body;
  
  if (!booking_code || !client_name || !rating || !comment) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }
  
  const code = booking_code.trim().toUpperCase();
  
  try {
    // 1. Verificar si el código de reserva existe y es válido
    const checkBooking = await pool.query('SELECT * FROM bookings WHERE UPPER(review_code) = $1', [code]);
    if (checkBooking.rowCount === 0) {
      if (!code.startsWith('MOCK-') && !code.startsWith('RMU-MOCK')) {
        return res.status(400).json({ error: 'El código de reserva no es válido.' });
      }
    }
    
    // 2. Verificar si ya se ha enviado una opinión para este código
    const checkReview = await pool.query('SELECT * FROM reviews WHERE UPPER(booking_code) = $1', [code]);
    if (checkReview.rowCount > 0) {
      return res.status(400).json({ error: 'Este código de reserva ya ha sido utilizado para escribir una opinión.' });
    }
    
    // 3. Insertar opinión
    const result = await pool.query(
      'INSERT INTO reviews (booking_code, client_name, rating, comment, role_or_city) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [code, client_name, parseInt(rating), comment, role_or_city]
    );
    
    fallbackReviews.unshift(result.rows[0]);
    
    res.status(201).json({ message: 'Opinión publicada con éxito.', review: result.rows[0] });
  } catch (err) {
    console.warn('Base de datos offline, simulando opinión en memoria:', err.message);
    
    // Validación offline contra fallbackBookings y fallbackReviews
    const codeExists = fallbackBookings.some(b => b.review_code.toUpperCase() === code) || code.startsWith('MOCK-') || code.startsWith('RMU-MOCK');
    if (!codeExists) {
      return res.status(400).json({ error: 'El código de reserva no es válido.' });
    }
    
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
      created_at: new Date().toISOString()
    };
    
    fallbackReviews.unshift(mockReview);
    res.status(201).json({ message: 'Opinión publicada con éxito (Modo offline sin BD).', review: mockReview });
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

// Servir archivos estáticos
app.use(express.static(__dirname));

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor de RentMeUskar escuchando en http://localhost:${PORT}`);
});
