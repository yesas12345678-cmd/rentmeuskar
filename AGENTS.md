# Normas Operativas de Ingeniería: RentMeUskar

## 1. Confiabilidad > Velocidad
- La estabilidad, solidez y precisión del código prevalecen sobre cualquier prisa.
- No se entrega ninguna solución sin antes haberla probado y validado al 100%. Si algo está al 90%, se rediseña hasta alcanzar el 100%.

## 2. Verificación Exhaustiva Pre-Entrega
- **Sintaxis y Linters**: Comprobar `node -c` o validadores de código.
- **Pruebas en Runtime**: Comprobar endpoints reales (con curl o tests) y respuestas HTTP esperadas.
- **Persistencia Comprobada**: Comprobar que los datos escritos en base de datos PostgreSQL o disco sobreviven reinicios del servidor.
- **Chequeo Visual**: En cambios de interfaz, inspeccionar capturas de pantalla reales en navegador.

## 3. Garantía de No-Regresión
- Al añadir o cambiar cualquier característica, validar que el resto de componentes (flota, calculadora, reservas, login, pasarela Redsys/CaixaBank) siguen funcionando al 100%.

## 4. Prácticas CI/CD Continuas
- Pruebas antes de commits.
- Commits atómicos y claros.
- Monitorización post-despliegue en producción (`rentmeuskar.com`) tras cada push.
