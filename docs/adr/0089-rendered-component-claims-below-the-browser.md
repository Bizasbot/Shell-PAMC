# ADR 0089: Declaraciones de componentes renderizados por debajo del navegador

- Estado: Aceptado
- Fecha: 2026-10-09

Las capas existentes de Go y Node no pueden observar las suscripciones de React Query,
las actualizaciones optimistas compartidas por lectores montados, la propiedad de hooks
asíncronos o la conexión real entre proveedor y componente. Las sondas del navegador
sí pueden hacerlo, pero añadir cada interacción a un escenario de página completa hace que
el feedback y el diagnóstico sean innecesariamente costosos. El primer piloto renderiza
el hook de preferencias real, QueryClient, cliente API, superficie de retroalimentación,
proveedor de visualización de tokens y lectura de contexto; las respuestas controladas
exponen el estado intermedio en lugar de limitarse a llamar a funciones puras.

Utilice un carril separado de Vitest/jsdom/React Testing Library para estas declaraciones,
junto con (no en lugar de) las pruebas lógicas de Node existentes. Descubra automáticamente
archivos `*.component.test.tsx` bajo `web/src`. Mantenga entornos aislados y un solo worker
inicialmente, limpieza explícita de desmontaje/globales/caché/peticiones, fallo ante un
descubrimiento vacío, y reutilice la propiedad de procesos acotados y los diagnósticos
del repositorio. Ejecute la capa de componentes completa en la verificación estática/CI
y para cambios frontend afectados; añada una selección conservadora solo cuando el
crecimiento medido haga que valga la pena.

Una configuración separada evita el servidor de desarrollo del producto, el proxy, la
preparación de assets y los workers del editor. La transformación de Vite dentro del proceso
de Vitest no es un listener HTTP de producto. Todas las dependencias son exclusivamente para
desarrollo; los puntos de entrada de producción, los estilos, los contratos de API y la
programación del navegador permanecen sin cambios.

jsdom no es evidencia de geometría, foco real, desplazamiento (scroll), renderizado (painting),
codificación de imágenes, historial del navegador o ciclo de vida de navegación. Mantenga
esos aspectos en Chromium, incluido el comportamiento real de cableado/recarga/teléfono
del control de configuración y la persistencia entre pilas. Mueva una declaración del
navegador solo después de registrar su propietario de capa inferior y una mutación que
pruebe que el reemplazo detecta el fallo. El piloto inicial fortalece la cobertura
asíncrona y no elimina ninguna aserción del navegador. Esto evita un reemplazo masivo al
estilo Jest y la falsa economía del diseño simulado o la supresión generalizada de errores.

Las mediciones, inyecciones de fallos, mapeo de declaraciones y obligaciones de despliegue
se encuentran en `docs/plans/architecture-governance.md`; los comandos y el descubrimiento
viven en `docs/testing.md`.
