# ADR 0068: Evidencia de navegador con fallo cerrado y verificación de lanzamientos en paralelo

- Estado: Aceptado
- Fecha: 2026-10-07
- Línea base: dc2002c0bec2968a99c0361526734fd0742d09df
- Refina: Cobertura de CI del ADR 0032 y flujo de publicación del ADR 0066

## Contexto

Las tres particiones (shards) de sondas actuales ofrecen cobertura completa en modo de desarrollo, pero la verificación de lanzamientos serializaba el catálogo dentro de un único trabajo local de verificación completa. Una sonda podía pasar a pesar de una excepción de página capturada o de una API no declarada que recibiera un mock exitoso y vacío. Los consumidores de las publicaciones podían extraer (checkout) una etiqueta mutable después de la verificación y etiquetar código fuente distinto con la revisión verificada. La iteración de lógica local también pagaba el costo de cada suite y retenía los veredictos de comprobación rápida hasta que los pares terminaban.

## Decisión

1. Mantener las comprobaciones de fusión requeridas `static`, `browser` y el agregado de `probes`. Ejecutar la aceptación compilada completa tanto en PR como en `master`, junto con el catálogo completo de desarrollo de tres particiones y la cobertura de la demo de producción. Los comandos P0/smoke siguen siendo herramientas locales opcionales.
2. Resolver la identidad del lanzamiento una sola vez, distribuir (fan out) la verificación estática/de navegador/de sondas en modo de solo lectura y agregar cada veredicto antes del empaquetado/publicación. Las extracciones posteriores (checkouts) utilizan exactamente esa revisión; se vuelve a resolver el acuerdo de etiquetas en los límites de publicación. Preservar el aislamiento de la caché nativa, la instalación limpia de dependencias, las sumas de verificación (checksums), el *smoke* en tiempo de ejecución y la promoción de la última versión (*latest*) exclusivamente por resumen (*digest*).
3. Convertir en fallos de escenario los problemas inesperados de tiempo de ejecución/consola/transporte y los contratos de API desconocidos. Los fallos deliberados declaran el recurso/marcador exacto y recuentos acotados localmente. Denegar orígenes HTTP y WebSocket no declarados, bloquear *service workers* y probar el veredicto del arnés utilizando escenarios negativos de navegadores reales.
4. Gestionar la disponibilidad de Vite con un token específico de la ejecución y Chromium a través de BrowserServer. Acotar el escenario y el tiempo de vida del cierre; escalar únicamente los procesos hijos/grupos de procesos propios. Mantener el *watchdog* por lotes existente en lugar de aumentar las esperas de aserción.
5. Separar los flujos largos de OAuth y del sistema en contextos aislados con reclamaciones (claims) sin cambios y precondiciones explícitas. Conservar los tiempos estructurados y revisar los pesos deterministas; los tiempos nunca deciden si se ejecuta un escenario.
6. Estrechar las suites de lógica únicamente en el carril rápido local mediante un grafo de importación conservador. Los elementos desconocidos amplían la ejecución y las suites opacas siempre se ejecutan; el descubrimiento final estático/de CI sigue siendo completo. Imprimir los veredictos completados inmediatamente y almacenar en búfer (*spool*) la salida detallada.
7. Añadir carriles semanales/manuales de solo lectura para *race conditions*, pruebas de fuzzing (*fuzz*), advertencias y tiempos de ejecución de macOS/Windows. La disponibilidad de avisos dependientes de la red no es un requisito previo normal y hermético de los PR. Los plazos de propiedad/revisión no suprimen los fallos de advertencia.

## Consecuencias y validación

La aceptación completa de PR compilados aumenta deliberadamente el trabajo de ese carril a cambio de cubrir dominios que el subconjunto P0 anterior omitía. La verificación de lanzamientos puede solapar carriles independientes, pero el rendimiento real alojado (*hosted throughput*) y el costo del ejecutor deben medirse a través de ejecuciones compatibles antes de declarar una ganancia porcentual. Los nuevos pesos divididos siguen siendo provisionales hasta que existan muestras suficientes.

El paralelismo de objetivos nativos, el intercambio de artefactos SPA de confianza y la especulación de paquetes/verificación son experimentos, no cambios automáticos en la caché o en los límites de publicación. No se restaura ninguna caché nativa compartida. Las pruebas de ejecución en entornos extranjeros no certifican la firma de código ni todas las arquitecturas. Las comprobaciones de etiquetas estrechan la ventana de referencias mutables, pero no pueden hacer que la publicación entre servicios sea transaccional.

Los validadores semánticos rechazan las puertas omitidas, las extracciones mutables, las particiones incompletas y la evidencia perdida. Las autoeprobaciones de los scripts, la inyección real de fallos en el navegador y las puertas completas del catálogo y de compilación/demo son obligatorias para la entrega. Los hallazgos de las revisiones y los resultados locales reproducibles se encuentran en `docs/plans/ci-testing-optimization.md`; la evaluación comparativa alojada (*hosted benchmarking*) sigue siendo una medición de seguimiento explícita en lugar de un resultado local reivindicado.
