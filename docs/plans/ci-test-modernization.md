# Ejecución tipada y aislada de CI y pruebas

## Alcance

Modernizar la ejecución de verificaciones sin modificar el comportamiento de la aplicación, los contratos
de API/esquema, las barreras de publicación ni los nombres de comprobación requeridos `static`, `browser` y `probes`.
El desarrollo rutinario mantiene la selección afectada de estáticos/UI; el CI alojado retiene la cobertura
completa de estáticos, navegador compilado, sondeos y demostración. Este cambio ni publica
ni altera la protección de ramas del repositorio.

## Evidencia de fallos

La auditoría inspeccionó los últimos 60 registros de flujos de trabajo de CI el 20 de octubre de 2026 a las
03:36 MYT (UTC+08:00), correspondiente al 19 de octubre de 2026 a las 19:36 UTC. Los registros
cubren desde el 17 de octubre de 2026 a las 08:56:45 UTC hasta el 19 de octubre a las 19:23:40 UTC.
Sus conclusiones finales fueron 48 exitosos, nueve fallidos y tres cancelados. Dos de los
registros exitosos tuvieron un segundo intento, por lo que esas conclusiones finales no miden
la fiabilidad en el primer intento. Se inspeccionaron los registros de tareas y los registros de fallos del primer intento para
el subconjunto fallido/reejecutado.

| Evidencia | Interpretación |
| --- | --- |
| Ejecución de Master `39310607590`, ejecuciones de PR `39286380321` y `39164421549`: lista de solicitudes `By client` se detiene en `req_interaction_0090`, luego el localizador back-to-top agota el tiempo de espera | Un defecto real de preparación en la prueba: ambas agrupaciones tienen la misma primera solicitud. Ese predicado puede observar el contenedor saliente antes de que React lo reemplace. Espere al título renderizado del grupo objetivo antes de desplazarse. |
| Ejecuciones estáticas de PR `39283973329` y `39286168669`: importación de React no utilizada | Un fallo genuino de TypeScript. Una migración del ejecutor no debe convertir esto en un fallo ignorado. |
| Ejecución de PR `39041111704`: miembro de tipo de fixture faltante | Un fallo genuino de contrato de fixture/tipo. |
| Los controles negativos de frescura de demo editan respuestas en vivo, procedencia, código fuente, grabación y verificadores mientras las comprobaciones de frescura/tipos se ejecutan concurrentemente | Una condición de carrera estructural por árbol de trabajo compartido. Árboles de entrada temporales por prueba la eliminan; no establece que cada fallo histórico de demo desactualizada fuera intermitente. |
| Ejecución `39131339847`: aserciones del interruptor de actualización automática; ejecución `39031891843`: clic en control de barra lateral | Evidencia adicional de estado/interacción del navegador a retener y diagnosticar, no una prueba de que reejecutar solucione el comportamiento subyacente. |

Una ejecución local exitosa y una reejecución tras un commit modificado no son prueba de estabilidad
alojada. En particular, ejecuciones canceladas y fallos de tipos deterministas no deben
contabilizarse como correcciones de intermitencias.

## Arquitectura de ejecución

- **Aislamiento estático alojado:** líneas independientes de matriz para Go, frontend y repositorio,
  `fail-fast: false`, seguidas de un agregado `static` que siempre se ejecuta y falla de forma estricta (fail-closed).
  Escaneos de secretos de historial completo/árbol de trabajo, herramientas/acciones fijadas y comprobaciones de árbol limpio se conservan.
- **Sondeos de navegador:** Playwright Test fijado coincidiendo con la versión de Chromium/núcleo existente;
  el catálogo completo y los fragmentos ponderados revisados se conservan. Workers nativos, contextos,
  tiempos límite, pasos, aserciones e informes reemplazan la cola manual, lotes y el temporizador de vigilancia (watchdog).
  Los escenarios de marcos compartidos y exclusivos tienen invocaciones nativas separadas; una prueba compartida fallida no omite aserciones exclusivas. Los catálogos
  locales completos conservan las mismas tres particiones secuenciales de CI y el límite por partición,
  en lugar de aplicar el límite de una partición a todo el catálogo. Fases compartidas y
  exclusivas consumen un presupuesto de partición; reiniciar el ejecutor nativo
  no reinicia ese tiempo límite.
- **Fixtures de dominio:** Listas de permitidos de API, estado local sintético, expectativas de fallos acotadas
  y un registro posterior al cierre del contexto siguen siendo propiedad del proyecto. Un nonce de preparación de Vite emitido a través del pipe hijo propio tras un enlace estricto
  a puerto evita que las pruebas se conecten silenciosamente a otro árbol de trabajo. Vite prepara la
  entrada común y los módulos seleccionados de conversación antes de emitir la señal de preparación, de modo que la transformación de código fuente
  en frío es asumida por el inicio del servidor y no por el presupuesto de localizadores de la página.
- **Lógica:** El ejecutor de pruebas de Node gobierna los archivos aislados y la ejecución acotada. `tsx` reemplaza
  el cargador personalizado de extensiones ESM/JSON. El planificador de grafos de importación afectados se conserva.
- **Componentes/contratos:** se mantiene la pila existente de Vitest, jsdom y Testing Library.
  No existe beneficio en reemplazar una herramienta adecuada únicamente por uniformidad de marca.
- **Herramientas tipadas:** orquestación migrada, configuración, fixtures, generadores de informes y nuevas
  autopruebas se ejecutan a través de `tsx` y un proyecto estricto de TypeScript para herramientas. Fixtures de dominio `.mjs`
  existentes, barreras de distribución y aceptación entre pilas no se renembran mecánicamente; la migración restante es incremental, con los mismos responsables de aserciones de comportamiento.
- **Demo:** copias completas de entrada por prueba hacen que los controles positivos/negativos sean independientes.
  La edición de texto de origen y los reintentos de restauración se reemplazan con entradas semánticas de cobertura y
  comprobaciones reales de códigos de salida de subprocesos. Solo cambia el resumen de procedencia declarado; el
  corpus de respuestas generado permanece idéntico.

## Propiedad de cobertura tras la eliminación

| Mecanismo de implementación/prueba eliminado | Responsable de la aserción |
| --- | --- |
| Cola de workers de lógica manual y solucionador ESM personalizado | Ejecutor de pruebas de Node + tsx; pruebas de CLI/planificador, archivos de lógica sin cambios |
| Pruebas de implementación de cola/lote de sondeos | Recolección nativa de Playwright contrastada contra cada ID del registro; entorno de fallos y validación exacta de evidencia temporal |
| Orquestación manual de watchdog/limpieza/informes de escenarios de sondeo | Tiempos límite/ciclo de vida/informes de Playwright Test; fallos de dominio se verifican tras el cierre del contexto |
| Mutación in situ de origen/dataset de demo y restauración basada en reintentos | Árboles de entrada aislados, controles positivos/negativos, estado de salida de subprocesos y prueba concurrente de preservación de bytes |
| Preparación solo de primera fila en agrupación de solicitudes y retraso fijo de desplazamiento inferior | Título del grupo objetivo y solicitud final real renderizados, utilizando aserciones web-first de Playwright |

## Rendimiento y evidencia de despliegue

Mida comandos equiparables en la misma revisión/cadena de herramientas y máquina inactiva; distinga
configuración en frío/caliente y el catálogo completo de un escenario individual. La comparación alojada debe
incluir tasa de aprobación en el primer intento, p50/p95 del flujo de trabajo, trabajo más lento y suma de tiempo de ejecutores.
La nueva matriz estática consume capacidad adicional de configuración/ejecutor para aislar recursos;
su beneficio en la ruta crítica alojada permanece sin verificar hasta que se envíe y se observe.

Los diagnósticos del navegador utilizan capturas DOM/PNG finales únicamente en fallos, informes nativos de errores, registros
de tiempos y el registro de fallos posterior al cierre. El rastreo continuo del servidor dev con alta carga de código fuente
se excluye de las mediciones de tiempo. Ningún escenario se omite, se reintenta, recibe
una espera mayor o reduce el rigor de sus aserciones para alcanzar un objetivo de velocidad.

## Mediciones locales

Observaciones de ejecución única en el mismo host y cadena de herramientas fijada, con cachés calientes:

| Operación equiparable | Punto de entrada previo | Punto de entrada nativo |
| --- | ---: | ---: |
| Los 86 archivos de lógica, tiempo de pared del proceso | 21.1 s | 23.3 s |

Estos no son puntos de referencia en hosts inactivos: inspecciones posteriores encontraron carga persistente de CPU
no relacionada en el host compartido. Ni la tabla ni la nueva matriz estática establecen una
aceleración alojada. La ruta lógica tiene aproximadamente dos segundos de costo adicional observado de inicio/
ejecutor en esta muestra; queda registrado en lugar de describirse como una optimización.

## Verificación local

La evidencia final a nivel de línea en la cadena de herramientas fijada es:

| Barrera | Resultado |
| --- | --- |
| `pnpm verify` más reejecución de autopruebas afectadas | Pruebas/vet de Go, tipos estrictos de frontend/herramientas, 86 archivos de lógica, 140 pruebas de componentes/contratos, 449 pruebas de repositorio, barreras estáticas de políticas y escaneo de secretos del árbol de trabajo aprobados |
| `pnpm verify:probes` | Los 72 escenarios únicos pasaron, dos workers compartidos y un worker de marco exclusivo, cero reintentos |
| `pnpm verify:browser:harness` | Los nueve controles negativos y cuatro positivos produjeron los veredictos nativos esperados tanto con uno como con dos workers |
| `pnpm verify:browser` | Todas las 381 comprobaciones deterministas de la SPA compilada pasaron; la preparación de la tabla de precios se midió en el renderizador bajo el presupuesto sin cambios de tres segundos |
| `pnpm verify:demo` | Todas las 18 rutas de la demo pública pasaron; el corpus de 129 respuestas permaneció actualizado |
| Compilación, paquete y escaneo de historial | Compilación de producción, límites de carga/topes de anomalías y escaneo de secretos de historial completo aprobados |
| `pnpm verify:workflow:lint` | actionlint fijado aceptó los tres flujos de trabajo |

El comando compuesto de verificación completa se ejercitó durante la implementación. Tras
reparar fallos, las líneas afectadas o fallidas se reejecutaron individualmente según lo requerido por
la política de verificación del repositorio; la tabla representa evidencia final a nivel de línea, no una
afirmación de una invocación final compuesta totalmente verde. La comparación exacta de crecimiento del paquete respecto a la base
y los tiempos en ejecutores limpios permanecen como comprobaciones de CI alojado. La fiabilidad
en el primer intento alojado y el costo p50/p95 requieren observaciones tras la publicación de la rama.
