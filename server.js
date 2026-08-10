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
      status VARCHAR(50) DEFAULT 'active'
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
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS van_m3 VARCHAR(50);"
  ];

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

    // Alterar tabla de reservas para añadir columnas adicionales
    for (const query of alterBookingsQueries) {
      await client.query(query);
    }
    console.log('Columnas de "bookings" verificadas/actualizadas.');
    
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
      user: { id: 0, name: 'Admin', email: 'rentmeuskar@gmail.com', is_admin: true }
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
    return res.json({ id: 0, name: 'Admin', email: 'rentmeuskar@gmail.com', is_admin: true });
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
  
  try {
    const query = `
      SELECT pickup_date, return_date FROM bookings 
      WHERE van_type = $1 AND status != 'cancelled'
    `;
    const result = await pool.query(query, [van_type]);
    
    // Mapear cada reserva a un rango { from, to }
    const ranges = result.rows.map(row => ({
      from: formatDateISO(row.pickup_date),
      to: formatDateISO(row.return_date)
    }));
    
    res.json(ranges);
  } catch (err) {
    console.error('Error al obtener fechas ocupadas:', err);
    res.status(500).json({ error: 'Error del servidor al obtener disponibilidad.' });
  }
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

    const query = `
      INSERT INTO bookings (
        name, van_type, van_name, pickup_date, pickup_time, 
        return_date, return_time, days, extras, total_price,
        user_id, fianza_status, payment_status, payment_id, status,
        rental_mode, estimated_kms, waiting_hours, van_plate, van_m3
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
      realM3
    ];

    const result = await pool.query(query, values);
    res.status(201).json({
      message: 'Reserva registrada con éxito.',
      booking: result.rows[0]
    });
  } catch (err) {
    console.error('Error al insertar reserva:', err);
    res.status(500).json({ error: 'Error del servidor al registrar la reserva.' });
  }
});

// 6. Obtener una reserva por ID (con detalles del usuario)
app.get('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT b.*, u.name as user_name, u.email as user_email, u.phone as user_phone, u.dni as user_dni,
             v.price_sin, v.min_price_con, v.km_price_con
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
    console.error('Error al obtener reservas:', err);
    res.status(500).json({ error: 'Error del servidor al obtener las reservas.' });
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
    console.error('Error al actualizar reserva:', err);
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

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }

    res.json({ message: 'Reserva eliminada con éxito.' });
  } catch (err) {
    console.error('Error al eliminar reserva:', err);
    res.status(500).json({ error: 'Error del servidor al eliminar la reserva.' });
  }
});

// --- RUTAS DE GESTIÓN DE FLOTA (FURGONETAS) ---

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
    console.error('Error al obtener furgonetas:', err);
    res.status(500).json({ error: 'Error del servidor al obtener furgonetas.' });
  }
});

// 2. Obtener todas las furgonetas (admin)
app.get('/api/admin/vans', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM vans ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener furgonetas de admin:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
});

// 3. Crear una nueva furgoneta
app.post('/api/vans', verifyAdmin, async (req, res) => {
  const { van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status } = req.body;
  if (!van_type || !name || !plate || !m3 || price_sin === undefined || min_price_con === undefined || km_price_con === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la furgoneta.' });
  }

  try {
    // Comprobar si ya existe el tipo
    const checkRes = await pool.query('SELECT id FROM vans WHERE van_type = $1', [van_type]);
    if (checkRes.rowCount > 0) {
      return res.status(400).json({ error: 'Ya existe un tipo de furgoneta registrado con ese identificador.' });
    }

    const query = `
      INSERT INTO vans (van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
    `;
    const values = [van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status || 'active'];
    const result = await pool.query(query, values);
    
    res.status(201).json({
      message: 'Furgoneta registrada con éxito.',
      van: result.rows[0]
    });
  } catch (err) {
    console.error('Error al crear furgoneta:', err);
    res.status(500).json({ error: 'Error del servidor al registrar la furgoneta.' });
  }
});

// 4. Modificar una furgoneta
app.put('/api/vans/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { van_type, name, plate, m3, price_sin, min_price_con, km_price_con, status } = req.body;

  try {
    const checkRes = await pool.query('SELECT * FROM vans WHERE id = $1', [id]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Furgoneta no encontrada.' });
    }
    const current = checkRes.rows[0];

    const query = `
      UPDATE vans 
      SET van_type = $1, name = $2, plate = $3, m3 = $4, price_sin = $5, min_price_con = $6, km_price_con = $7, status = $8
      WHERE id = $9 RETURNING *;
    `;
    const values = [
      van_type !== undefined ? van_type : current.van_type,
      name !== undefined ? name : current.name,
      plate !== undefined ? plate : current.plate,
      m3 !== undefined ? m3 : current.m3,
      price_sin !== undefined ? price_sin : current.price_sin,
      min_price_con !== undefined ? min_price_con : current.min_price_con,
      km_price_con !== undefined ? km_price_con : current.km_price_con,
      status !== undefined ? status : current.status,
      id
    ];

    const result = await pool.query(query, values);
    res.json({
      message: 'Furgoneta actualizada con éxito.',
      van: result.rows[0]
    });
  } catch (err) {
    console.error('Error al actualizar furgoneta:', err);
    res.status(500).json({ error: 'Error del servidor al actualizar la furgoneta.' });
  }
});

// 5. Eliminar una furgoneta
app.delete('/api/vans/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM vans WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Furgoneta no encontrada.' });
    }
    res.json({ message: 'Furgoneta eliminada con éxito.' });
  } catch (err) {
    console.error('Error al eliminar furgoneta:', err);
    res.status(500).json({ error: 'Error del servidor al eliminar la furgoneta.' });
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
