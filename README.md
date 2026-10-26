# RentMeUskar

Web de alquiler de furgonetas en Huéscar y el Altiplano Granadino: catálogo, calculadora de precio, reservas con pago online (Redsys), área de cliente, contratos, facturas y panel de administración.

## Arquitectura

No es una web estática: necesita el servidor Node.js para funcionar.

- `server.js`: servidor Express con toda la API (`/api/...`), autenticación, pagos Redsys, correos (Zoho SMTP) y PostgreSQL. Si la base de datos no responde, sigue funcionando con `data/admin_store.json`.
- `index.html` + `app.js` + `styles.css`: web pública (calculadora, reservas, área de cliente, opiniones).
- `admin.html` + `admin.js`: panel de administración (`/admin`).
- `contract.html`, `invoice.html`: contrato y factura de cada reserva (`/contract/:id`, `/invoice/:id`).
- `payment-success.html`, `payment-error.html`: vuelta desde la pasarela de pago.
- `assets/`: imágenes y tipografías. `uploads/`: fotos subidas desde el panel (no están en git).

Solo se sirven al navegador los archivos públicos anteriores; el código del servidor y `data/` no son accesibles desde la web.

## Ejecución local

```bash
npm install
cp .env.example .env   # y rellena los valores
npm start              # http://localhost:3000
```

Sin `DATABASE_URL` el servidor arranca en modo sin base de datos (todo se guarda en `data/admin_store.json`).

## Tests

```bash
npm test
```

Arranca el servidor real en una carpeta temporal (sin base de datos ni correo) y comprueba lo esencial de seguridad y reservas: archivos privados, login de admin, precio calculado en el servidor, acceso a reservas ajenas, fechas bloqueadas, validaciones y opiniones. No toca `data/`.

## Configuración (`.env`)

Todas las variables están explicadas en `.env.example`. Las importantes:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | PostgreSQL de producción |
| `SESSION_SECRET` | Firma de sesiones (cadena aleatoria larga) |
| `ADMIN_PASSWORD` (`ADMIN_USERNAME`, `ADMIN_EMAIL`) | Acceso al panel si no se han cambiado desde el propio panel |
| `SMTP_USER`, `SMTP_PASS` | Correos de verificación, avisos de reserva y contacto |
| `REDSYS_MERCHANT_CODE`, `REDSYS_SECRET_KEY`, `REDSYS_URL` | Pago real con tarjeta/Bizum |
| `BASE_URL` | Dirección pública https; Redsys envía ahí la notificación de pago |
| `ALLOWED_ORIGINS` | Otros dominios desde los que se sirve la web |
| `ENABLE_TEST_PAYMENTS` | TPV simulado para pruebas. **Nunca `true` en producción**: marca reservas como pagadas sin cobrar |

Modo de cobro (se consulta en `/api/payment-config`):
- `redsys`: hay credenciales de Redsys → el cliente paga en la página de Redsys y la reserva se confirma con la notificación firmada.
  `REDSYS_URL` vale por defecto el entorno de **pruebas** (`https://sis-t.redsys.es:25443/sis/realizarPago`); para cobrar de verdad hay que poner `https://sis.redsys.es/sis/realizarPago` junto con el código de comercio y la clave reales.
- `test`: `ENABLE_TEST_PAYMENTS=true` → TPV simulado (solo pruebas).
- `off`: ninguno de los dos → las reservas se piden por WhatsApp y se paga al recoger.

## Despliegue

Producción en Docker con Dokploy. `rentmeuskar.netlify.app` es una versión estática antigua sin servidor (solo WhatsApp) y no refleja esta web.

Antes de desplegar, revisar que en el servidor estén `SESSION_SECRET`, `ADMIN_PASSWORD`, `SMTP_PASS`, las claves de Redsys y `BASE_URL`, que `REDSYS_URL` apunte a `sis.redsys.es` (no a `sis-t`) y que `ENABLE_TEST_PAYMENTS` no esté activado.

## Tecnologías

Node.js, Express 5, PostgreSQL (`pg`), Nodemailer, Multer, Helmet, express-rate-limit; en el navegador, JavaScript sin frameworks, Flatpickr, Font Awesome y Google Fonts.
