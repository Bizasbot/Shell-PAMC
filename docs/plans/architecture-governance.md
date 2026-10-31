# Gobierno de arquitectura y verificación preservando el comportamiento

> **Estado: registro histórico de auditoría.** Este documento preserva la evidencia, mediciones
> y registro de migración de la refactorización del gobierno de arquitectura y verificación. No es
> un manual de reglas permanente: sus prohibiciones describen el alcance de esa refactorización, y
> ADRs posteriores (0089, 0090, 0091) reemplazan cualquiera que entre en conflicto con la práctica actual. Léalo
> para contexto; no lo trate como una lista de restricciones.
>
> **Superado: Playground eliminado.** Toda mención al Playground (su página, estado, rutas,
> escenarios y mediciones) a continuación describe el repositorio tal como estaba cuando se ejecutó la auditoría. La
> página, sus rutas `/playground/*` y sus pruebas han sido eliminadas desde entonces; las mediciones se
> conservan sin editar como evidencia histórica.

## Alcance y línea base

Línea base: `02b29672f0dde5a6aa91d88f940afbd425cdd33a` (2026-10-09).
El trabajo procede en `refactor/architecture-governance`. El usuario autorizó enviar
únicamente esta rama y abrir un PR en borrador (Draft PR) para medir el CI alojado; no se autorizó
ninguna fusión, tag, publicación, cambio de acceso ni conexión a producción. Se preservan decisiones de negocio, DTOs, semántica
de permisos y persistencia, estructura DOM, estilos, movimiento y comportamiento responsivo.
Correcciones observables de errores son propuestas separadas, no refactorizaciones incidentales.

Esta auditoría combina inspección de código fuente actual, análisis de grafos de importación, descubrimiento de pruebas,
observaciones de solo lectura de CI alojado y mediciones locales. No constituye una afirmación de que cada
línea haya sido auditada o que una verificación local certifique cada carga de trabajo de producción.
`docs/plans/ci-testing-optimization.md` y los ADRs 0032/0068 cubren el gobierno previo;
se conservan esas decisiones en lugar de reconstruir sus ejecutores o reducir la cobertura.

### Inventario

En la línea base, excluyendo distribución embebida y pruebas de Go: 29 paquetes internos de Go,
87 relaciones de dependencia internas, 214 archivos de implementación en Go (60.270 líneas), 370
archivos frontend TS/TSX (76.463 líneas, incluidos catálogos generados), 185 archivos de prueba de Go,
69 suites de lógica de TypeScript descubiertas más la suite de rutas de despliegue, 50 archivos de
autopruebas de Node en el repositorio y 65 escenarios registrados de navegador. El grafo de
tiempo de ejecución del frontend transpilado contiene 416 fuentes/recursos, 1.487 dependencias, cero importaciones locales no resueltas
y cero componentes fuertemente conectados entre múltiples módulos. La compilación de paquetes de Go prohíbe
ciclos; no se encontraron ciclos de paquetes en tiempo de compilación.

Los archivos grandes no constituyen inherentemente límites rotos. Los catálogos de traducción y
el esquema de configuración son datos; dividirlos únicamente por recuento de líneas añadiría indirección innecesaria.
La fachada de la API compone deliberadamente 25 paquetes internos, mientras que `operations`
coordina la ejecución de capacidades. Dependencias del repositorio respecto a precios y uso reflejan
atribución persistida. No traslade barreras de seguridad, propiedad de escritor único ni listas permitidas
ordinarias de DTO en pos de reducir superficialmente el fan-in.

## Hallazgos y prioridades

| Prioridad | Hallazgo y evidencia | Tratamiento compatible |
| --- | --- | --- |
| P1 | El registro real de páginas con carga diferida (lazy) falta en el límite de rutas del planificador. Un cambio en `web/src/pages/playground/state.ts` selecciona los 65 escenarios a través de `web/src/routePages.ts`, a pesar de que su regla de ruta está acotada. La prueba existente de árbol real busca únicamente importaciones directas de páginas en App y por lo tanto pasa de forma vacua. | Reconocer importaciones dinámicas literales probadas en el registro, retener ampliación total para ediciones del registro, importaciones ansiosas, rutas no mapeadas e incertidumbre; verificar que el registro real sea no vacío y acotado. |
| P1 | El Agente utiliza el estado de Playground para generación de IDs, razonamiento en línea, imágenes y lectura del modelo en la transcripción. Trece módulos de tiempo de ejecución importan un módulo de dominio de página de 728 líneas. | Trasladar primitivas compartidas a módulos hoja neutros; preservar las exportaciones de la página para invocadores y pruebas; mantener los adaptadores de dominio explícitamente tipados. Medir alcance de importaciones y equivalencia visual y en bytes. |
| P2 | Los costos de navegador incluyen comprobaciones repetidas de diseño/foco/pintura, decodificación real de imágenes y carreras de ciclo de vida. Los escenarios de Playground, OAuth y sistema contienen aserciones tanto lógicas como de integración. | Conservar aserciones específicas del motor. Migrar permutaciones de decisión solo cuando existan un responsable de capa inferior y una aserción de cableado representativa; registrar cada aserción en la tabla de cobertura, no un objetivo de conteo de pruebas. |
| P2 | El cliente de API tiene 57 importadores directos en tiempo de ejecución; módulos de retroalimentación global, i18n e iconos tienen alto fan-in. Una edición monolítica del cliente amplía legítimamente muchas páginas. | Mantener política compartida de transporte/autenticación/errores. Considerar puntos de entrada de dominio solo con un beneficio medido de edición local y fachada pública estable; evitar clientes duplicados y cambios de comportamiento en la caché de consultas. |
| P2 | Catálogos locales completos reinician Vite y Chromium en tres lotes secuenciales delimitados por watchdog. | Medir inicio frente a trabajo de escenarios antes de cambiar la propiedad. No añadir concurrencia de navegador en el host de cuatro CPUs, ni aumentar timeouts, ni reutilizar contextos de escenarios. |
| P2 | Las rutas críticas de tiempo de ejecución ya utilizan transportes compartidos, uniones indexadas, caché de consultas, proyecciones memorizadas, diarios de eventos acotados y una barrera de escritura SQLite FIFO cancelable. | Medir rutas críticas reales antes de modificar bloqueos, agrupamientos, sondeos, SQL o cadencia de renderizado. La cadencia existente de cuotas y el orden de solicitudes son contratos, no parámetros de ajuste libre. |
| P3 | Orquestación compleja permanece en OAuth, gestión de proveedores y componentes del sistema, pero muchas decisiones ya tienen responsables como funciones puras. | Extraer únicamente responsabilidades independientemente verificables. Preservar orden de hooks, ciclos de vida de suscripciones y semántica de cancelación; no reemplazar archivos con capas de envoltorio vacías. |

## Registro de propiedad de pruebas y migración

| Riesgo | Responsable de capa más baja actual | Propiedad retenida en navegador | Tratamiento planificado |
| --- | --- | --- | --- |
| La selección local omite o amplía páginas enrutadas | `scripts/ui-impact.test.mjs`, `scripts/check-ui-plan.test.mjs` | Catálogo completo de CI independiente de la selección local | Añadir casos literales diferidos, ansiosos, desconocidos, de cambios mixtos y de árbol real. |
| Endpoint/cuerpo de solicitud, instantáneas de reintento, redacción de imágenes almacenadas, límites de stream | `scripts/test-playground.ts`; pruebas de pasarela y API en Go | `playground`, `playground-narrow`, aceptación de inferencia compilada | Mantener semántica de solicitudes; reubicar primitivas compartidas sin descartar aserciones. |
| Estado de exportación, vocabulario de fallos y presentación de duración | `scripts/test-conversation-labels.ts` más aserciones de integración de página | Descargas de Agente/Playground, controles independientes, imágenes e impresión | Mover políticas exactas por debajo de las páginas; conservar ambos vocabularios, exportaciones de página y contenido de exportación. |
| Partes del Agente, reanudación, capacidades y permisos | Suites de lógica del Agente y pruebas en `internal/agent`, `internal/capability`, `internal/mcpbridge`, `internal/api` | Catálogo del Agente, flujos compilados de aprobación/escritura | Preservar reductores y barreras nativas de capacidades. |
| Ambigüedad de unión de OAuth, filtros y elegibilidad de objetivo de cuota | `scripts/test-oauth-workspace.ts`, `scripts/test-quota*.ts`, pruebas de cuota/API en Go | Siete contextos de OAuth más reglas de modelos; secuenciación de imagen/archivo/foco y solicitudes | La extracción existente es sustancial; no duplicar reglas puras en un nuevo entorno DOM. |
| Atribución de proveedores y escrituras serializadas | Suites de lógica de tablero/proveedores, pruebas de barrera de escritura de API | Selector de proveedores, comprobaciones móviles y superposiciones | Retener identidad exacta y reglas de ambigüedad; sin cambios de normalización. |
| Series de panel y reglas de mapa de calor | Suites de lógica de tablero/mapa de calor y pruebas de repositorio | Geometría, pintura, movimiento de gráficos, secuenciación de consultas en vivo | No migrar geometría de canvas/DOM a un entorno simulado. |
| Excepciones de navegador, solicitudes no declaradas, aislamiento de red, desmontaje | Autopruebas de entorno y entorno real de navegador negativo | Entorno completo y sondeos | Todos los registros de fallos, tiempos límite y evidencia permanecen obligatorios. |

### Evaluación del marco de pruebas de componentes

El descubrimiento actual de pruebas ya admite TypeScript puro sin requerir un marco de transformación adicional. Vitest proporciona entornos de Node, jsdom/happy-dom y Browser Mode real; distingue explícitamente la simulación de DOM frente al diseño real, foco y APIs del navegador. React Testing Library sería una herramienta de conexión de componentes, no un sustituto del motor de navegador.

Decisión para los pilotos iniciales: no introducir Vitest/RTL ni un DOM simulado en esta fase.
La ruta crítica identificada es un límite incorrecto de alcanzabilidad, no la ausencia de un ejecutor de componentes. La reubicación de primitivas compartidas puede demostrarse con suites de lógica existentes, conexiones reales de navegador y artefactos de producción. Se evaluará una capa de componentes solo cuando una aserción de integración concreta de hook/componente no pueda probarse como función pura y trasladarla fuera del navegador produzca ahorros medidos.

## Implementación por etapas

1. **Límite de auditoría y selección:** establecer línea base completa local y alojada, corregir la alcanzabilidad de rutas conservadoramente, añadir pruebas no vacuas e informar planes afectados reales. Modifica únicamente aspectos internos de verificación.
2. **Primitivas compartidas de conversación:** separar la generación de IDs, razonamiento y manejo de imágenes independientes de la página respecto al Playground, conservando reexportaciones e implementaciones de funciones. Comparar grafo de importaciones, retroalimentación acotada y evidencia visual/en bytes de artefactos de producción.
3. **Piloto de tiempo de ejecución guiado por evidencia:** seleccionar un punto crítico medido de CPU/asignación, conservar una sola instancia perezosa de `Intl.Collator` por invocación de ordenamiento en OAuth, medir la mejora en microbenchmarks sin alterar ordenamientos ni el consumo de memoria a largo plazo.
4. **Propiedad compartida de presentación de exportaciones:** el hook `useConversationExport` traslada sus dependencias de formato y estado a `conversationLabels.ts`, protegiendo el límite de módulos compartidos de la importación de aspectos internos de páginas.

`web/src/pages/playground/usePlaygroundRun.ts` y `web/src/pages/agent/useAgentRun.ts` conservan la propiedad de cancelación (abort), publicación acotada y mecanismos de validación y actualización.

## Registro de commits

| Commit | Etapa independientemente reversible | Documentos sincronizados |
| --- | --- | --- |
| `15a418040d2f881502e63fe9df20cf8c28d57a6b` | Selección conservadora de rutas diferidas y evidencia de grafo no vacua | `AGENTS.md`, `docs/architecture.md`, `docs/testing.md`, este registro |
| `4daec6aae10078422e5d655a614c7f31dbbd3b1a` | Primitivas de conversación independientes de página y propiedad de aserciones | `docs/architecture.md`, `docs/testing.md`, este registro |
| `9cd1f899d5f9bd5efe2fdb18511ee3d1d2160ff9` | Configuración de comparación de locale en OAuth medida por invocación | `docs/architecture.md`, `docs/testing.md`, este registro |
| `2baa4f80ce9bfb6d160b0097e178f6273c7909af` | Políticas compartidas de presentación de exportación y protección de límites de página | `docs/architecture.md`, `docs/testing.md`, este registro |

## Auditoría más amplia de contratos, módulos y recursos

| Área | Interfaz actual y responsables más bajos útiles | Decisión de fase dos y riesgo restante |
| --- | --- | --- |
| Preferencias / Estado de UI | `knownPreferences` cerradas en Go; documentos crudos de JSON propiedad del cliente; cadena de escritura por clave en `usePreference` y QueryClient compartido | Corpus compartido y piloto renderizado implementados. Las lecturas de hooks deduplican en StrictMode; los objetos analizados permanecen estables ante actualizaciones no relacionadas de caché. |
| Agente / AG-UI | `internal/api/agent_http.go` y DTOs de proyección; `web/src/agent/protocol.ts`, reductor y conexión de ejecución; pruebas reales de agente en HTTP/proyección, suites existentes de protocolo/reductor/reconexión en Node y sondeos de motor | Diferente del vocabulario de eventos de Playground. Preservar eventos RUN/STATE/TEXT/TOOL, instantáneas, confirmación y transferencias OAuth. |
| Playground / SSE | `internal/api/playground.go`, estado de ejecución y selección de endpoint; `web/src/agent/runConnection.ts`, analizador SSE y adaptador de API de Playground | Pruebas existentes en Go de admisión/timeout/cancelación/endpoints y pruebas en Node de stream/reconexión ya gobiernan permutaciones ajenas al motor. Un POST perdido nunca debe repetirse; GETs de reconexión reintentan suscripciones y la cancelación es explícita. No almacenar en caché ni refactorizar esas rutas sin evidencia de latencia y equivalencia de diarios. |
| OAuth | ciclo de vida de administración/registro de proveedores y proyección segura de credenciales; DTOs tipados de OAuth; sondeos divididos de espacio de trabajo/autorización/reglas de modelo/cuota | Pruebas de API existentes gobiernan la semántica de ciclo de vida y registro; Chrome gobierna el comportamiento de popup/teclado/scroll/recarga. |
| Proveedores | DTOs permitidos específicos por familia y barrera compartida de escritura admitida; cliente tipado de proveedores; pruebas de preservación de configuración/alternancia concurrente/ocupado/identidad | Asimetrías existentes son deliberadas: esquemas de familia, mutaciones de estado, ajustes seguros y metadatos OAuth difieren. No fusionar controladores ni vocabularios de error genéricos solo por existencia de código similar. |
| Cliente de API | manejo compartido de solicitudes/errores/autenticación/demo más métodos tipados de endpoint; dependencias solo en tiempo de ejecución son hojas de análisis existentes de config/auditoría/uso | El tamaño del archivo por sí solo no establece un cuello de botella en tiempo de ejecución. Mantener estables los métodos públicos y la identidad singleton de error/controlador. |
| Repositorio / backend | SQLite WAL, escrituras admitidas explícitas, lecturas acotadas, listas de permitidos de proyección y propiedad de bucles en segundo plano | No se encontraron nuevas rutas críticas de consulta/bloqueo en esta auditoría. Pruebas/vet completas de Go siguen siendo obligatorias. |

El grafo de producción de integración del frontend permanece limpio: únicamente `web/src` se analiza, y pruebas/fixtures reales no pueden alcanzarse sin una importación de producto no resuelta.
