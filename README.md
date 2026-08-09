# RentMeUskar

Este proyecto es una copia exacta local del sitio web de **RentMeUskar** (https://rentmeuskar.netlify.app/), un servicio de alquiler de furgonetas sin conductor en Huéscar y el Altiplano Granadino.

## Estructura del Proyecto

El sitio web está estructurado como una aplicación web estática pura (HTML5, CSS3, JavaScript nativo):

- `index.html`: La estructura principal y contenido semántico del sitio.
- `styles.css`: Estilos visuales premium, variables de marca, animaciones de scroll y adaptabilidad móvil.
- `app.js`: Lógica interactiva que incluye:
  - Navegación interactiva y activación de clases activas por scroll.
  - Efecto de revelado gradual al hacer scroll (Intersection Observer).
  - Acordeón interactivo para las preguntas frecuentes (FAQ).
  - Simulador interactivo de presupuesto en tiempo real.
  - Integración directa del formulario de reserva con WhatsApp.
- `assets/`: Imágenes de la flota y logotipos oficiales descargados del servidor original.

## Ejecución Local

Para visualizar el proyecto localmente, simplemente abre el archivo `index.html` en cualquier navegador web, o utiliza un servidor local ligero:

### Opción 1: VS Code Live Server
Si usas Visual Studio Code, puedes hacer clic derecho en `index.html` y seleccionar **Open with Live Server**.

### Opción 2: Usar HTTP Server con Node/npm
Si tienes Node.js instalado, puedes ejecutar en la terminal:
```bash
npx http-server ./
```

## Tecnologías Utilizadas

- **HTML5** & **CSS3** (Variables CSS nativas, Grid, Flexbox).
- **JavaScript ES6** (Nativo, sin dependencias de frameworks pesados).
- **Google Fonts** (Plus Jakarta Sans y Space Grotesk).
- **FontAwesome v6** (Librería de iconos vectoriales).
- **OpenStreetMap** (Localizador integrado para Huéscar).
