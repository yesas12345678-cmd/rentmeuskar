# Regla: Confiabilidad Absoluta, Verificación 100%, No-Regresión y CI/CD

## 1. Prioridad Fundamental: Confiabilidad > Velocidad
- La calidad, estabilidad y solidez del código SIEMPRE tienen prioridad sobre la rapidez de respuesta.
- Nunca des por finalizada una tarea basándote en suposiciones, código teórico o respuestas superficiales.
- Si una solución está al 90%, NO es suficiente: rediseña, depura y ajusta hasta que esté al 100% verificada.

## 2. Protocolo de Verificación Pre-Entrega (100% Funcional)
Antes de presentar cualquier resultado o dar una tarea por concluida:
1. **Comprobación de Sintaxis y Compilación**: Verificar `node -c`, linters, compiladores o builds locales sin advertencias ni errores fatales.
2. **Prueba en Tiempo de Ejecución (Runtime)**: Ejecutar peticiones HTTP reales (curl, scripts de prueba o subagente de navegador) tanto con datos exitosos como con casos límite (datos vacíos, errores de red).
3. **Persistencia Real**: Si intervienen bases de datos o almacenamiento en disco, validar físicamente que el dato se escribió en PostgreSQL / archivo y persiste tras reiniciar el proceso o recargar la página.
4. **Verificación Visual / UI**: En tareas de interfaz, usar screenshots para verificar legibilidad, responsividad y ausencia de elementos rotos o solapados antes de informar al usuario.

## 3. Control Estricto de No-Regresión ("Que TODO LO DEMÁS no se haya roto")
- Cada vez que se añade, modifica o configura algo nuevo:
  - Validar activamente que los flujos adyacentes siguen operativos (ej: si se ajusta la flota, verificar que el simulador de tarifas, el login, la base de datos y la pasarela siguen respondiendo).
  - Comprobar que variables de entorno, puertos, rutas y esquemas de base de datos existentes no hayan sido alterados negativamente.

## 4. Pipeline CI/CD en Cada Tarea
1. **Continuous Integration (CI)**:
   - Validar sintaxis y ejecutar pruebas funcionales automatizadas antes de cualquier commit.
   - Garantizar que los archivos esenciales de persistencia y configuración (`.env.example`, respaldos de estructura) se mantengan sincronizados.
2. **Continuous Deployment (CD)**:
   - Realizar commits atómicos y descriptivos.
   - Tras hacer `git push`, monitorizar la respuesta del entorno de producción (`HTTP 200 OK`, endpoints de salud y APIs activas).
   - Si la producción falla tras un despliegue, aplicar rollback inmediato o hotfix con failover transparente.
