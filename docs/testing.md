# Probar un cambio

Esta es la guía de trabajo para escribir y ejecutar pruebas en este repositorio. Indica
dónde corresponde una prueba nueva, qué ejecutar durante el desarrollo y qué debe pasar un
cambio antes de publicarse. `docs/architecture.md` §12 explica por qué las capas se
dividen como se dividen; `docs/adr/0032-ci-owns-the-full-browser-catalog.md` registra la
decisión detrás de los momentos de verificación.

El objetivo es una retroalimentación corta con la misma o mayor capacidad de detectar
fallos. Una prueba nueva que es lenta, usa esperas o duplica una afirmación que otra capa
ya hace es un costo que paga cada cambio posterior. Prefiera las capas y los ejecutores
existentes; añadir uno nuevo es una decisión deliberada con una razón, no una opción por
defecto.

**Cómo usar este documento.** Las secciones 1–4 son las reglas: dónde corresponde una
prueba, cómo se registra, qué ejecutar y cuándo, y qué hacer cuando falla la CI. Las
secciones posteriores al §4 son un mapa, no un mandato: registran qué capa es dueña de cada
afirmación hoy y por qué se colocó allí. Cuando exista un dueño mejor, mueva la
afirmación y actualice el mapa en el mismo cambio; conserve la fuerza de la afirmación, no
su ubicación. Nada del mapa está congelado.

## 1. Dónde corresponde una prueba nueva

Coloque cada afirmación en la **capa más baja que pueda hacerla fallar por la razón que
indica su nombre**. Suba una afirmación de capa solo cuando la inferior no pueda observarla.

| La afirmación trata de | Capa | Dónde | Se ejecuta en |
| --- | --- | --- | --- |
| Comportamiento del servidor: handlers, listas permitidas de DTO, redacción, autenticación, consultas del repositorio, migraciones, serialización de escrituras, bucles en segundo plano | Prueba de Go | `*_test.go` junto al paquete | `go test ./...` |
| Una decisión del frontend que es una función pura: derivación de URL/estado, formateo, política de sondeo y debounce, ordenamiento, validación | Suite de lógica (ejecutor de pruebas de Node + tsx) | `scripts/test-<topic>.ts`, importando desde `web/src` | `pnpm test:logic` |
| Cableado de React renderizado: suscripciones de QueryClient, estado compartido optimista, propiedad asíncrona de hooks e integración de provider a componente | Integración de componentes (Vitest + jsdom + RTL) | `web/tests/**/*.component.test.tsx`, con `web/vitest.config.ts` | `pnpm test:components`, `test:fast` afectado, estática completa/CI |
| Transporte tipado del frontend frente a un corpus de red certificado por handlers: métodos, rutas, semántica de JSON/null/error/autenticación | Contrato de API (Vitest Node + Go + autoprueba de fixtures) | `web/tests/**/*.contract.test.ts`, junto con `internal/api/*_test.go` y `scripts/acceptance/contracts/` | `pnpm test:components`, `go test ./...`, `pnpm test:self`; estática completa/CI |
| Algo que solo muestra un motor de navegador real: geometría, apilamiento, hit-testing, scroll, foco, Atrás, toque, pintado, orden de solicitudes y navegación a nivel de página e integración con el servidor de desarrollo | Escenario de sonda | un módulo bajo `scripts/acceptance/probes/` más una entrada en `scripts/acceptance/scenarios.mjs` | `pnpm check:ui`, `probes` de CI |
| El binario compilado, la SPA embebida, un CPA falso y SQLite con datos de ejemplo en conjunto: inicio de sesión, renderizado de rutas, límites de secretos, escrituras de pila completa | Aceptación de pila completa | el módulo de dominio bajo `scripts/acceptance/` | `pnpm verify:browser` (suite completa en pull requests y master) |
| La demostración pública | Aceptación de la demo | tabla de rutas en `scripts/demo-readiness.mjs` | `pnpm verify:demo` |
| El modo de demostración propio del binario de Go: ajustes aislados, rechazos de solo lectura, ediciones permitidas no duraderas | Smoke de la demo de Go | `scripts/demo-smoke.mjs` | `pnpm verify:demo:go` (opcional; no forma parte de la CI ni de `verify:full`) |
| Un script o compuerta del repositorio en sí mismo | Autoprueba de scripts (`node:test` + tsx) | `scripts/<name>.test.ts` (el `.test.mjs` existente sigue siendo detectable) o `deploy/cloudflare/*.test.mjs` | `pnpm test:self` |

La evidencia de service tier la cubren `internal/pricing/service_tier_test.go`
(identidad de proveedor/ejecutor, precedencia saliente, auto explícito y fallback heredado),
`internal/repository/usage_service_tier_test.go` (ambas rutas de ingesta, selecciones
inmutables, migraciones 045/046 que preservan explicaciones históricas, filtros y facetas),
`internal/repository/usage_outbound_migration_test.go` (todas las columnas históricas,
índices, triggers de inmutabilidad, claves foráneas y secuencia de ids retenidos a través de
046), y `internal/api/usage_service_tier_test.go` (campos de red sin procesar frente a
resueltos y semántica de filtros). `scripts/test-usage-event-view.ts` y
`scripts/test-request-export.ts` cubren el marcador Fast compartido, las pistas específicas
de cada origen y las exportaciones enmascaradas. La cobertura de las filas de solicitudes
renderizadas está en `web/tests/request-service-tier.component.test.tsx`; la sonda de
interacción de la lista de solicitudes conecta en el navegador una solicitud de prioridad de
Codex con una respuesta predeterminada y selecciona su faceta de tier resuelto, comprueba el
chip activo traducido y elimina el chip y su filtro de URL.

Reglas que mantienen la suite rápida y honesta:

- **Use por defecto Go o una suite de lógica.** La mayoría de la lógica de una funcionalidad
  es una función de sus entradas. Extráigala del componente y pruébela directamente; el
  navegador solo necesita entonces una comprobación representativa de que la página la
  conecta, no una por permutación.
- **Un dueño por afirmación.** Antes de añadir una comprobación de navegador, busque una
  existente que ya la afirme. Ample ese escenario en lugar de añadir un casi duplicado.
- **Sin esperas fijas.** Espere algo observable: una respuesta (`page.waitForResponse`, una
  ruta que usted retiene y libera), un estado de elemento, `until(...)` de
  `scripts/acceptance/harness.mjs`, un canal de Go o un intervalo o reloj inyectado.
  `scripts/fixed-waits.test.mjs` falla cuando se añade una espera fija.
  Tras cambiar el viewport, espere a que los controles responsivos adopten su estado de
  destino y llame a `settleLayout(page)` antes de medir la geometría. Una confirmación del
  viewport puede preceder a la actualización de breakpoint de React y al layout dirigido por
  ResizeObserver.
  Los widgets de terceros pueden programar más trabajo: un popup visible puede seguir en su
  paso de preparación de alineación, y los anchos coincidentes del editor y del shell pueden
  pertenecer ambos al layout de escritorio anterior. Espere el estado de preparación del
  widget o a que su superficie de renderizado adopte el viewport actual antes de leer la
  aserción final de geometría.
  Las comprobaciones de rueda del popup de modelos del compositor esperan el foco de búsqueda
  desde el callback de apertura completada, y luego exigen que el centro de la lista gane el
  hit-testing antes de enviar la entrada. Un conteo de opciones y dos animation frames por sí
  solos no establecen la alineación del popup, especialmente cuando se reabre un popup
  destruido. Las aserciones de distancia de la rueda van después de ese límite de
  disponibilidad, no antes.
- **Haga que el tiempo sea inyectable en Go.** Una duración que una prueba tiene que esperar
  pertenece a la configuración del componente con un valor de producción por defecto, como
  lo es `ingest.Config.ReadinessGrace`, para que la prueba pueda fijarla en milisegundos.
- **Toda comprobación nueva debe fallar contra una implementación rota.** Rompa el código a
  propósito, vea fallar la prueba y luego restáurelo. Una comprobación que no puede fallar se
  elimina, no se conserva por cobertura.
- **Pruebe el comportamiento, no la redacción.** No afirme que un archivo fuente contiene una
  cadena. Inyecte los efectos secundarios y afirme la decisión, como hace
  `scripts/install-chromium.test.mjs`.
- **Mantenga los fixtures herméticos.** Los fixtures de navegador construyen su entorno con
  `scripts/acceptance/environment.mjs`; nunca lea el `.env`, la red ni el directorio de datos
  del operador. La base de datos con datos de ejemplo compartida en
  `internal/demo/demo_test.go` usa el mismo reloj de referencia UTC fijo que la exportación de
  la demo; el tiempo real cambia la carga diaria generada y no debe cambiar la muestra detrás
  de las aserciones de concentración de modelos. Las lecturas del estado de captura en esas
  pruebas usan ese mismo reloj de semilla.
  Los fixtures de calendario deben usar la zona horaria configurada de la consola y no la del
  host; los fixtures del mapa de calor del dashboard usan el calendario UTC por defecto, con
  una autoprueba de script que abarca hosts a lados opuestos de un límite de fecha UTC.

### Guardados de proveedores con múltiples claves

`internal/api/management_provider_multikey_test.go` es dueño de los guardados multi-clave
nuevos y editados de la misma familia en cada familia de claves de API de configuración
registrada: ciclos completos de credencial y de proxy/peso por clave, una escritura a CPA,
preservación de ajustes compartidos y no modelados, ids devueltos, propagación de metadatos y
posiciones vecinas estables. También es dueño del manejo de filas en blanco y de los rechazos
de credenciales vacías/duplicadas/en colisión antes de cualquier escritura a CPA.
`web/tests/provider-multikey.component.test.tsx` monta el editor, el hook y el cliente de API
reales para afirmar payloads multi-clave completos, la pista de fila dividida y las
escrituras de iconos para cada fila devuelta tanto al crear como al editar.

### Cambios de protocolo de proveedores

`internal/api/management_provider_family_move_test.go` es dueño de la matriz completa de
pares de protocolos, la preservación de credenciales y ajustes comunes, la división multi-clave,
el movimiento posicional de metadatos y los rechazos de guardados inválidos u obsoletos.
También fija que los ajustes compartidos sigan siendo editables tras la migración y que la
política de runtime específica de una clave prevalezca sobre la política compartida editada
cuando un proveedor multi-clave se divide en filas separadas. El `provider_family_move_test.go`
del cliente de gestión es dueño de la preservación de grupos almacenados no relacionados y de
claves ocultas en runtime, un único PATCH de dos familias, respaldos exactos previos a la
escritura y el manejo de conflictos con `If-Match`.
`web/tests/provider-protocol.component.test.tsx` monta el editor, el hook y el cliente de API
reales para ser dueño de la selección de protocolo, los payloads de guardado adaptados y la
reconciliación de la caché de iconos antes de escrituras de preferencias posteriores. Los
escenarios de navegador de proveedores existentes conservan las afirmaciones del drawer, del
selector, del layout y de integración a nivel de página.

`web/tests/provider-opencode-session.component.test.tsx` monta el mismo editor para la guía del
endpoint de OpenCode: la sugerencia sigue la URL base escrita en el borrador y no el proveedor
desde el que se abrió el drawer, un clic revela el grupo colapsado Custom Headers con el literal
`x-opencode-session: $CPA-SESSION-ID`, abandonar la edición no escribe nada y reabrir restaura
el borrador almacenado, y Save envía ese par. Un borrador con dos ids distintos se reporta con
una acción de revisión en lugar de resolverse, y un duplicado en blanco se rellena con el id
configurado para que el guardado no pueda llevar un valor en blanco. La detección exacta del
host y esa fusión subyacente pertenecen a `scripts/test-provider-console.ts`.

### Integración de componentes renderizados

`pnpm test:components` ejecuta la capa completa de integración del frontend, detectada
automáticamente: suites `*.component.test.tsx` renderizadas y suites `*.contract.test.ts` en
entorno Node.
Usa Vitest, jsdom y React Testing Library solo de desarrollo, no Chromium, ni un listener HTTP
de Vite del producto, ni Go, ni un CPA falso. La configuración separada realiza transformaciones
Vite/JSX en proceso sin cargar los plugins de build/proxy/assets del producto. Los archivos
aislados y un solo worker acotan los recursos; el ejecutor reutiliza la cancelación de grupo de
procesos y la retención de diagnósticos existentes. Los cambios desconocidos o de dependencias
siguen ampliando las comprobaciones rápidas; todos los cambios de frontend ejecutan esta pequeña
capa hasta que las mediciones justifiquen un selector de impacto de componentes conservador. La
detección en estática/CI siempre es completa. Los archivos de contrato declaran
`@vitest-environment node`; la configuración compartida importa RTL solo en un entorno DOM. Las
pruebas y la configuración viven bajo `web/tests`, fuera del grafo de runtime del producto, y se
incluyen en la verificación de tipos del frontend. Se reutiliza la misma propiedad de
transformación/worker/proceso en lugar de añadir otro ejecutor o una dependencia de DOM a las
afirmaciones de transporte.

El piloto de preferencias en `web/tests/preferences.component.test.tsx` monta el hook,
QueryClient, cliente de API, superficie de retroalimentación, provider de visualización de tokens
y lectura de contexto reales. Retiene respuestas para demostrar el estado optimista compartido,
el orden de escritura local por clave, la reversión a la última intención, la recuperación tras
fallos, la disponibilidad del fallback, la estabilidad de referencias tras un renderizado
observado provocado por la caché y que una escritura admitida sobreviva al desmontaje del
componente. Las colas locales de la prueba se vacían incluso tras fallos antes de liberar los
globales, la caché y los árboles desmontados. No haga mock del hook, la caché ni el transporte
bajo prueba, ni suprima los errores de consola.

`web/tests/credential-quota.component.test.tsx` aplica la misma capa al panel de cuota de
credenciales del dashboard. Fija como funciones simples el orden de urgencia del tablero y la
aritmética de recuperación, y luego la máquina de estados del panel renderizado - una primera
carga que no afirma nada, una lista de credenciales no leída reportada como desconocida con un
reintento y no como una flota vacía, y un refresco fallido que conserva las filas con una
advertencia adicional - más las dos lecturas de la fila, el único enlace del pie que resuelve bajo
el basename del despliegue, las filas que no son interactivas y el control de refresco con las
credenciales sobre las que se le puede preguntar. Chromium sigue siendo dueño de lo que solo él
puede medir: la geometría del panel frente a la cuadrícula, el propio scroll de la cuadrícula y el
ciclo de vida real del refetch.

`web/tests/list-view-preferences.component.test.tsx` es dueño del análisis de la vista OAuth, de
la restauración de filtro/orden/tamaño de página guardados con un QueryClient nuevo, de la
precedencia de enlaces explícitos, del reinicio persistido, de la reversión de escrituras
rechazadas y de controles utilizables solo por URL tras una lectura fallida de preferencias, sin
sobrescribir preferencias no leídas. También cubre la agrupación de registros de solicitudes, el
auto-refresco y la restauración de filtros avanzados desde rutas de entrada simples y explícitas.
Las sondas de gestión OAuth y de interacción de solicitudes conservan las afirmaciones del
cableado real de controles, la recarga y el orden de colección renderizado.

Esta capa es dueña del estado renderizado, no de los hechos del motor. La sonda de ajustes de
Shell-PAMC sigue siendo dueña de su cableado real de radios, la recarga y la geometría en
teléfono; la geometría de la lectura de contexto y la navegación/keepalive reales siguen siendo
afirmaciones del navegador. No se elimina ninguna aserción solo porque pase una prueba de
componente. El ADR 0089 y el registro de la fase dos en `docs/plans/architecture-governance.md`
registran la decisión y la evidencia negativa.

### Contratos de API certificados por handlers

El piloto de preferencias usa `scripts/acceptance/contracts/preferences.json` como un corpus de
red pequeño y revisado, no como un esquema generado desde ninguna de las dos implementaciones.
`TestPreferencesSharedWireContract` ejecuta sus solicitudes ordenadas a través del router,
el middleware de autenticación, los handlers y el repositorio SQLite aislado reales. Compara
estados exactos y JSON semántico, verifica la lista permitida completa de claves públicas, el
content type y la política no-store autenticada, y comprueba de forma independiente un
despliegue no UTC. Los límites ordinarios de DTO y de permisos no cambian.

`web/tests/preferences.contract.test.ts` importa el cliente tipado real y comprueba
método/ruta/cuerpo/credenciales/cabeceras, la decodificación de éxito, los datos de ApiError, la
notificación de no autorizado, los prefijos de despliegue anidados y la admisión de keepalive
UTF-8. El Browser Mock usa el fixture por contexto en
`scripts/acceptance/preferences-fixture.mjs`; su autoprueba ejecuta el despachador
`installRoutes` real además del corpus. Los cambios en el corpus o el fixture seleccionan juntas
las comprobaciones de Go, de integración del frontend y del repositorio; la CI completa sigue
detectando a todos los dueños de forma independiente.

Un contrato es evidencia acotada, no una segunda implementación del repositorio. La validación de
referencias de iconos personalizados, los límites de cuerpo, la protección de escrituras de mismo
origen, los fallos de base de datos y los alias completos de zona horaria siguen siendo asuntos
de pruebas reales de Go; el streaming, la cancelación y la navegación real siguen siendo asuntos
del navegador o de pila completa. Un método de mock no soportado aún registra un fallo del
arnés (501), en lugar de fingir que reproduce el 405 del router. Añada un caso de handler
independiente antes de afirmar una nueva semántica del mock. Mantenga los corpus nuevos
pequeños y junto a los fixtures compartidos; no se requiere una conversión completa a OpenAPI ni
un validador en runtime para este piloto.

Paridad enfocada: `go test ./internal/api -run TestPreferencesSharedWireContract -count=1`,
`pnpm test:components` y `node --test scripts/preferences-contract.test.mjs`.
El registro de aserciones y fallos está en `docs/plans/architecture-governance.md`.

### Afirmaciones compartidas de conversación

`scripts/test-conversation-primitives.ts` es dueño del fallback de ID, de las permutaciones de
inline-thinking y de sobrescritura de modelo, y de la admisión de imágenes antes de la
decodificación del navegador. Las aserciones existentes de ID y de thinking viven en esa suite.
Las sondas de navegador conservan las afirmaciones de admisión real de FileReader/Image/canvas,
cargas normalizadas, streaming, layout de razonamiento, adjuntos, exportación, scroll y foco.
El archivo `scripts/conversation-boundaries.test.mjs`, detectado automáticamente, comprueba el
grafo de imports de runtime emitido, con fixtures negativos eager/lazy y un grafo real no vacío;
los adaptadores solo de tipos no crean una dependencia de runtime. Consulte el registro de
afirmaciones y evidencia en `docs/plans/architecture-governance.md`.

### Aceptación de contenedores y de lanzamientos

`scripts/release-plan.test.mjs` prueba la validación de tags/paquetes, la identidad de imágenes,
la selección numérica de latest, los backports, las revisiones inmutables de acciones, el
aislamiento de credenciales del checkout y el aprovisionamiento del navegador antes de las
compuertas completas de lanzamiento, además del orden analizado de los jobs de lanzamiento,
incluidas mutaciones negativas. `scripts/deployment.test.mjs` analiza la topología de Compose
entregada y prueba los valores por defecto de la imagen `latest`, los bindings a loopback, las
instalaciones solo con imagen, los ajustes de recolección/proxy y la configuración de arranque
del gateway. Ambos son autopruebas del repositorio detectadas automáticamente.

`internal/config/config_test.go` fija el fallback de versión de compilación embebida y la
precedencia del operador. Las pruebas existentes de `internal/release` son dueñas del orden de
versiones, del feed de GitHub, la caché y el límite de tasa, y de la retención de
comprobaciones fallidas; las aserciones de versión empaquetada no reemplazan esas pruebas.

`scripts/docker-smoke.mjs` es opcional en local y obligatorio antes de publicar la imagen en
`.github/workflows/release.yml`. Necesita Docker y una imagen nativa compilada, crea solo
contenedores/volúmenes aislados, espera eventos de estado de salud y prueba el runtime real de
la imagen sin root y de solo lectura, las escrituras en SQLite, las rutas base normalizadas, el
inicio de sesión, la SPA embebida y los endpoints de versión en ejecución. También ejecuta la
imagen como updater: la propia sonda de salud de la imagen debe reportar ese rol como sano, y
`updater install` debe crear un updater endurecido junto a una consola en ejecución, dejar la
consola en su lugar y permitir que la consola lea el estado del updater sin ningún ajuste en
ninguno de los dos lados. Esa comprobación reemplaza un contenedor llamado
`shell-pamc-updater`, por lo que se niega a iniciar en un host que ya tenga uno. No forma parte
de `test:fast` ni de las compuertas estáticas ordinarias.
Primero se resuelve la identidad del lanzamiento y luego se ejecutan en paralelo, sobre la
revisión exacta, la estática, el navegador compilado/demo completo y tres shards de sondas. El
agregado `verify` exige que todos los resultados tengan éxito antes del empaquetado nativo o de
la publicación de contenedores. Los carriles de navegador aprovisionan y prueban el arranque de
Chromium con `scripts/install-chromium.mjs`; la paridad local es `pnpm verify:full`. La sola
instalación de dependencias no instala el binario del navegador.

La planificación de lanzamientos nativos, los payloads de archivos, la integridad del manifiesto
y el orden del workflow son autopruebas del repositorio en `scripts/native-release.test.mjs` y
`scripts/release-plan.test.mjs`, detectadas automáticamente. No compilan Go ni lanzan
navegadores. Las autopruebas de payloads de archivos usan GNU tar, zip y unzip, igual que el
ejecutor de empaquetado de Linux, y fallan por nombre cuando falta una herramienta requerida.
Las autopruebas del constructor y de los payloads fuerzan rutas locales de GNU tar, de modo que
los dos puntos de una letra de unidad de Windows nunca soliciten un shell remoto; las
regresiones de comandos inyectados conservan los ajustes deterministas del archivo. Las
comprobaciones de permisos de ejecutables extraídos se ejecutan en hosts Unix, que pueden
representar esos bits de permiso; las aserciones de payload y de checksum se ejecutan en todos
los hosts. El job **native** del workflow de tags ejecuta `scripts/native-release.mjs` para
compilar los ocho destinos sin CGO tras embeber la SPA, y luego `scripts/native-release-smoke.mjs`
para extraer y ejecutar el archivo Linux del host y comprobar disponibilidad HTTP, SQLite, inicio
de sesión, manejo de prefijos, JavaScript local y versión inyectada. Usa directorios
temporales nuevos, puertos asignados por el SO y esperas basadas en condiciones. Este smoke de
paquete es independiente del smoke de contenedor y de las compuertas completas de navegador; la
compilación cruzada a otra plataforma no prueba el comportamiento de runtime en esa plataforma.
El job de lanzamiento vuelve a comprobar la completitud y la integridad SHA-256 tras la
transferencia del artefacto fijado; las regresiones del workflow rechazan cachés compartidas de
pnpm/Go y pasos de caché directos en el job de publicación nativa; los lanzamientos nuevos
permanecen como borradores hasta que se suben todos los adjuntos y se vuelve a comprobar la
política de latest.

Las referencias a jobs de workflows reutilizables externos, como los pasos de acciones, deben
usar SHA de commit inmutables; las rutas de workflows reutilizables del mismo checkout usan la
revisión local verificada. Las cargas de evidencia de tiempos no pueden suavizar un fallo con
`continue-on-error`. Las mutaciones negativas del workflow fijan ambos límites.

### Detección de fallos del arnés de navegador y su propiedad

`scripts/acceptance/browser-guard.mjs` registra excepciones de página, errores de consola,
fallos de transporte y orígenes de red denegados de cada página en un contexto. El éxito de una
sonda exige un registro vacío de problemas inesperados además de aserciones que pasen. Las
rutas de API sin coincidencia y los métodos incorrectos devuelven 501 y registran un fallo de
fixture; los matchers de fixture solo por URL describen lecturas GET. Los fixtures de escritura
declaran su método. Las respuestas fallidas explícitas usan `fulfillFixture` o `abortFixture`,
autorizando solo la URL exacta del recurso y una cantidad acotada de errores. Los fallos de
renderizado inyectados declaran localmente su propio marcador y los diagnósticos del error
boundary de React. La cancelación de navegación (`net::ERR_ABORTED`) no es un veredicto de
recurso no disponible.

Los orígenes permitidos incluyen esquema, host y puerto. La intercepción de HTTP y WebSocket
cubre los popups, y los service workers están bloqueados. Las rutas de fixture posteriores deben
cumplir o hacer fallback, nunca continuar más allá del guard. `pnpm verify:browser:harness`
ejecuta escenarios negativos reales mediante el proceso real de Playwright Test: las aserciones
ajenas que pasan no deben borrar fallos de runtime, de método, de ruta desconocida, de HTTP
saliente o de socket. Es una compuerta de CI de navegador compilado y local completa, no una
autoprueba de script; Chromium nunca entra en `test:fast`.

Playwright Test es dueño del grupo de procesos de Vite y espera un nonce emitido por ese hijo
tras un bind estricto de puerto y tras transformar, a través de la API de Vite, el grafo de
módulos críticos seleccionado. Ninguna página se ejecuta en un navegador como parte de esa
preparación. La respuesta HTTP de un worktree distinto no puede establecer la disponibilidad; el
fallo de arranque y la cancelación usan la limpieza de procesos nativa del ejecutor. Cada
escenario es dueño de un contexto, fixtures y registro de fallos nuevos. Los presupuestos de
prueba se mantienen en 120 segundos con un plazo de 480 segundos por partición, compartido entre
sus invocaciones nativas. Los escenarios compartidos usan como máximo dos workers; las
afirmaciones de frames se ejecutan después con un solo worker sin contención (ADR 0095). La
compuerta de inyección de fallos verifica el aislamiento de almacenamiento, cookies,
preferencias y veredictos con uno y dos workers. La aceptación de pila completa conserva sus
helpers acotados del ciclo de vida de BrowserServer; la ruta de sondas usa la gestión nativa del
ciclo de vida del ejecutor.
Las comprobaciones locales en paralelo almacenan la salida bajo `tmp/check-output`, imprimen los
veredictos al terminar, registran tiempos estructurados bajo `tmp/check-timings` y terminan sus
grupos de procesos propios al cancelar. Al inicio de cada ejecución, los archivos reconocidos de
salida/tiempos con más de 30 días se eliminan solo si su PID propietario está inactivo; se
preservan la evidencia reciente de éxitos y fallos, los propietarios activos y los archivos no
relacionados. `scripts/parallel-checks.test.mjs` fija este límite de retención.

### Verificación de mantenimiento

`.github/workflows/maintenance.yml` se ejecuta semanalmente y por despacho manual con permisos de
solo lectura. Estos carriles de diagnóstico no reemplazan ni retrasan las compuertas herméticas
de los PR:

- `pnpm verify:race`: paquetes completos de usage/CPA/Agent/MCP bridge con concurrencia de
  paquetes acotada; los contratos de concurrencia, compuerta, plazo, cancelación, ejecución de
  navegador y apagado de repository/API se seleccionan explícitamente. Las pruebas ordinarias
  completas de Go siguen siendo obligatorias. El barrido race completo adicional de
  repository/API superó el presupuesto de tres minutos por paquete en el host de desarrollo; el
  carril enfocado tiene autopruebas que fijan la propiedad crítica.
- `pnpm verify:fuzz`: tres presupuestos independientes de 10 segundos y dos workers para la
  redacción de URL, la redacción de secretos JSON y la paridad de precios. Las pruebas semilla
  siguen ejecutándose normalmente.
- `pnpm verify:advisories`: pnpm audit y govulncheck fijado, preservando ambos veredictos de
  salida y los logs. `scripts/advisory-triage.json` registra identificadores exactos, dueños,
  justificación y plazos de revisión; estos registros nunca suprimen fallos de auditoría. Un
  documento de triaje vencido o ilegible añade su propio veredicto/log fallido mientras ambos
  escáneres siguen ejecutándose y preservan sus diagnósticos independientes. Corrija los
  hallazgos alcanzables sin demora; los hallazgos no reconocidos y las revisiones vencidas
  requieren investigación del mantenedor. La disponibilidad del registro o de la base de datos
  no es una entrada de prueba hermética.
- El smoke nativo de macOS y Windows en el host compila la SPA antes de un binario sin CGO y
  comprueba SQLite, rutas anidadas, assets embebidos y autenticación con
  `scripts/native-runtime-smoke.mjs`. La compilación cruzada a otra plataforma por sí sola no
  prueba ninguna de esas afirmaciones de runtime. La publicación nativa sigue rechazando
  cachés compartidas.

Los logs de mantenimiento se retienen 30 días. Un carril que falla pertenece al mantenedor del
repositorio: distinga una aserción/race, un fallo de infraestructura del escáner y una
advertencia reportada, preserve la evidencia y vuelva a ejecutar solo ese carril tras la
remediación.

### Compatibilidad de la ruta de base de datos de solo lectura

`internal/repository/readonly_query_test.go` es dueño de la construcción de URI de archivo
absolutas para rutas de Unix y de unidades de Windows, incluidos espacios, Unicode y caracteres
reservados de URI. Su prueba real de SQLite lee un marcador insertado mediante el pool
escribible desde un nombre de archivo escapado, y luego afirma tanto el rechazo de escritura tras
desactivar `query_only` (el límite independiente `mode=ro`) como el rechazo de attach. Las
suites de consultas existentes conservan la cobertura de admisión de programas compilados,
rechazos de tablas/columnas ocultas, resultados acotados y enmascaramiento. Estas pruebas se
ejecutan en `go test ./...`, sin Chromium ni un ejecutor nuevo. Los casos de URI con letra de
unidad se ejecutan en todos los hosts; el comportamiento real del sistema de archivos de Windows
sigue requiriendo una ejecución en Windows.

## 2. Registrar una prueba nueva

La detección es automática siempre que es posible, de modo que una prueba no pueda escribirse y
luego no ejecutarse nunca:

| Prueba | Registro |
| --- | --- |
| Prueba de Go | ninguno |
| Suite de lógica `scripts/test-*.ts` | ninguno: `scripts/testing/logic.ts` detecta los archivos |
| Integración del frontend `web/tests/**/*.component.test.tsx` / `web/tests/**/*.contract.test.ts` | ninguno: detección recursiva en `scripts/test-components.mjs` y en la configuración independiente de Vitest; una detección vacía falla |
| Autoprueba de script `*.test.ts` / `*.test.mjs` | ninguno: `scripts/testing/repository.ts` las detecta |
| Escenario de sonda | una entrada en `scripts/acceptance/scenarios.mjs` (`id` único). Opcionalmente sus segundos medidos en `scripts/acceptance/probe-weights.json`, que solo afecta al balance de los shards |
| Página nueva de la consola | una regla en `SCENARIO_PATHS` de `scripts/acceptance/check-ui-plan.mjs` que nombre los escenarios que cargan su ruta, o `scenarios: []` si ninguno lo hace. `scripts/ui-impact.test.mjs` falla hasta que exista la regla |
| Cambio de versión del paquete Lucide | `pnpm icons:generate`, haga commit de `web/src/generated/lucideIcons.json`; `scripts/generate-lucide-icons.test.mjs` falla hasta que el archivo coincida con el paquete instalado |
| Cambio en una lectura de la consola o en la forma de una respuesta | `pnpm demo:generate` (fija `TZ=UTC` para metadatos de despliegue deterministas), revise el diff y haga commit del conjunto de datos (vea `docs/ops/cloudflare-demo.md`) |

## 3. Qué ejecutar y cuándo

El grafo de runtime de la UI distingue los imports dinámicos literales de los imports eager. Las
páginas mapeadas que `web/src/routePages.ts` carga de forma diferida terminan su cadena de
alcance en ese registro, igual que las páginas enrutadas directamente terminan en App. El grafo
descubre la identidad de las páginas a partir de los componentes JSX importados en los elementos
de ruta de `createBrowserRouter` de App, siguiendo los bindings `React.lazy` exportados por el
registro hasta los imports literales de `createPageLoader`. No mantiene otra lista de páginas ni
deduce la identidad de una página a partir de una regla de directorio. Una receta distinta de
loader/router exige evidencia y casos negativos en el mismo cambio; la sintaxis no reconocida
amplía la selección en lugar de adivinarse. El propio registro, los helpers de directorios de
páginas, otros imports del mismo módulo resuelto, las aristas mixtas eager/lazy, las páginas sin
mapear, las fuentes ilegibles y la falta de evidencia de ruta o arista siguen ampliando la
selección a todos los escenarios. `scripts/ui-impact.test.mjs` exige de forma independiente la
arista de runtime App-registro y un conjunto no vacío de páginas del registro demostradas, y luego
comprueba la regla de escenarios de cada página. Los fixtures negativos garantizan que las páginas
de App importadas directamente no puedan ocultar un registro desconectado o vacío, y que un
directorio mapeado no pueda certificar un helper como página de ruta. El host de plugins se
asigna a los escenarios de navegador de plugins existentes; los contratos nativos compilados de
credenciales, frames y escrituras permanecen en la aceptación de pila completa.

El carril rápido local pasa los archivos modificados a `scripts/logic-plan.mjs`, que sigue los
imports de runtime relativos hacia las suites detectadas automáticamente. Los cambios
desconocidos o sin dueño y los cambios de infraestructura o dependencias amplían la selección a la
suite completa. Las suites con imports calculados, alias sin resolver o detección por sistema de
archivos siempre se incluyen; no hay un mapa de registro de suites mantenido a mano. `pnpm test:logic --plan --files
'["web/src/utils/maskKey.ts"]'` inspecciona una selección. El comando por defecto y toda ejecución
estática final o de CI siguen ejecutando todas las suites.

El desmontaje del ejecutor nativo drena los contextos y recupera los procesos propios al
terminar, ante fallos de arranque y al cancelar. Los fixtures del proyecto comprueban el registro
de fallos tras cerrar el contexto, de modo que los eventos tardíos no puedan ser borrados por el
cuerpo de una prueba que pasa. El JSON de tiempos mal formado se conserva como artefacto inválido,
hace fallar el veredicto final del reportero y no impide que los escenarios posteriores registren
evidencia. Los IDs faltantes o duplicados hacen fallar el adaptador del catálogo de forma
independiente.

Las muestras de sondas bajo `tmp/probe-timings/<port>.json` incluyen el ID del escenario, el
veredicto, el tiempo transcurrido y los pasos con nombre. La evidencia de fallos queda aislada bajo
`tmp/probe-failure/<port>/`; el arnés de navegador negativo tiene sus propios espacios
`tmp/browser-harness-failure/` y `tmp/browser-harness-report.json`. La CI sube las muestras de
sondas incluso tras un fallo. `pnpm report:probe-timings` calcula pesos candidatos de mediana/p95 a
partir de muestras exitosas compatibles; no edita la instantánea. Revise la cobertura de muestras
y la compatibilidad de plataforma antes de actualizar `scripts/acceptance/probe-weights.json`. Los
escenarios divididos provisionales se marcan explícitamente; la falta de pesos afecta al balance,
nunca a la detección ni a la cobertura.


La verificación completa local termina `pnpm build` antes de iniciar cualquier carril estático de
Go. El embebido de Go enumera rutas, de modo que podar assets de distribución obsoletos al mismo
tiempo que la compilación puede invalidar archivos ya descubiertos. Los jobs de CI independientes
tienen checkouts separados; esta regla local de propiedad no serializa esos jobs. El ejecutor
local también ejecuta de forma consecutiva el arnés, el navegador compilado, las sondas y la demo,
conservando cada veredicto tras un fallo. Sus aserciones de frames y de disponibilidad no deben
competir con otro carril de Chromium en el mismo host; las comprobaciones estáticas siguen en
paralelo.

La aceptación compilada de live-tail siembra su llegada dedicada dentro de la ventana del
servidor. `scripts/acceptance/usage-events/arrival-fixture.mjs` retiene solo esa solicitud exacta
de las respuestas reales de lista antes de Hold, obteniendo una fila real adicional para preservar
la página base. Una vez que la ventana del lector es estable, libera sin cambios las lecturas
siguientes. La API real sigue siendo dueña del orden y de los conteos de llegada basados en ID; el
fixture controla la disponibilidad en lugar de depender del tiempo de arranque transcurrido. Las
pruebas de Node fijan el alcance exacto del endpoint, la preservación de filas y conteos y la
liberación. La aceptación compilada exige el ID de la solicitud liberada, no solo una marca de
tiempo más reciente primero, en la primera fila renderizada. No interviene un segundo escritor de
base de datos ni una sobrescritura del reloj de la aplicación.

Los worktrees independientes pueden seleccionar explícitamente un puerto libre con
`pnpm verify:probes --port 5183` o `pnpm verify:full --probe-port 5183`. Los valores por defecto
siguen siendo 5180 para el catálogo y 5181 para las comprobaciones de UI afectadas. El ejecutor
nunca selecciona en silencio otro puerto ni confía en un listener existente; cambiar el puerto
explícito no altera la cobertura ni los veredictos.

Las autopruebas del empaquetado de la demo llaman a `stageDemo` de `scripts/build-demo.mjs` con
directorios temporales privados de origen y de staging. Ejercitan las reescrituras de
HTML/módulos/fuentes, la configuración de runtime, los fallos por entradas faltantes y el staging
concurrente sin borrar los assets de runtime de la demo ni omitirse cuando no existe un build del
producto. `verify:demo` conserva la cobertura de rutas profundas de la consola compilada.

`pnpm benchmark:native` es un experimento de compilación local opcional, fuera de todas las
compuertas. Compara la ejecución en serie y la acotada de dos workers de los mismos ocho destinos
nativos sin CGO, comprobando los metadatos de compilación del binario. `--linux-only` acota el
experimento (no la cobertura de lanzamiento), y `--warm` precalienta cada destino medido antes de
medir ambos casos. Los casos por defecto usan cachés de compilación nuevas por caso con descargas
de módulos existentes. Los reportes bajo `tmp/build-benchmarks/` registran la revisión de origen,
el estado sucio, la plataforma, el número de CPU, la toolchain, las condiciones de caché, el
precalentamiento y los veredictos de cada destino. Ambos casos compilan desde la misma instantánea
inmutable de `cmd/`, `internal/`, `migrations/`, `go.mod` y `go.sum`, incluidos los assets de SPA
embebidos. La consistencia de la instantánea se comprueba antes de compilar, y los fallos conservan
su reporte y los diagnósticos por destino. La cancelación detiene la admisión de destinos, une los
grupos de procesos de compilación propios y registra los resultados interrumpidos antes de eliminar
la instantánea privada. Compare condiciones de caché equivalentes antes de interpretar los tiempos;
estos binarios no son entradas de publicación.

| Momento | Comando | Qué hace |
| --- | --- | --- |
| Al editar | `pnpm test:fast` | Solo las comprobaciones estáticas que necesitan los archivos modificados; la verificación de tipos del frontend es incremental. `--plan` imprime la selección, `--base <ref>` incluye los cambios confirmados |
| Al editar la UI | `pnpm check:ui` | Solo los escenarios de sonda que el cambio puede alcanzar, en el servidor de desarrollo. `--plan` explica la selección; `--scenario <id>` ejecuta uno |
| Una funcionalidad está completa, y antes de publicar | `pnpm verify` y `pnpm check:ui` | Las compuertas estáticas completas, el escaneo de secretos del worktree y los escenarios de navegador afectados |
| Pull request (CI) | automático | Carriles estáticos aislados de Go/frontend/repositorio tras el agregado `static` requerido, escaneos de secretos, build, límites de carga y reportes de bundle, la aceptación de pila completa, **todo** el catálogo de sondas en tres shards y la aceptación de la demo |
| Opcional en local | `pnpm verify:full` | Todo lo que ejecuta la CI, en un solo comando local. Úselo para cambios en el build, el arnés de navegador o el workflow, o para reproducir un fallo de CI |
| Opcional (opt-in) | `pnpm verify:demo:go` | El modo demo propio del binario de Go: un navegador contra un binario iniciado localmente con sus propias aserciones de rutas. Genera el conjunto de datos, por lo que no forma parte de la CI |

Cómo elige escenarios `check:ui` (`scripts/acceptance/check-ui-plan.mjs`):

- Una regla de ruta nombra los escenarios de una página o directorio de componentes.
- Cualquier otro archivo de `web/src` se sigue a través del grafo de imports de **runtime**
  (`scripts/acceptance/ui-impact.mjs`) hasta las páginas que lo importan. Los imports usados solo
  como tipos no son aristas, por lo que un cambio puro de tipos no selecciona nada y lo cubre la
  verificación de tipos.
- Alcanzar la capa compartida (`web/index.html`, el shell de `App.tsx`, `components/common/`, el
  tema, el cliente de API, la hoja de estilos global) selecciona todos los escenarios, igual que
  una página enrutada sin regla, un import sin resolver, un cambio de dependencia o de Vite, o un
  asset que el grafo no puede ver.
- Un cambio en el catálogo de traducciones que solo añade entradas no selecciona nada; cambiar o
  eliminar textos existentes selecciona todos los escenarios.
- Un cambio en un módulo o en el registro de sondas selecciona los escenarios que lo usan
  (`scripts/acceptance/probe-impact.mjs`); un cambio en el ejecutor de sondas, o en cualquier módulo que el ejecutor importe, selecciona todos. Cada
  ruta bajo `scripts/acceptance/` se atribuye así y no a partir de una lista de nombres, de modo
  que un helper nuevo no pueda seleccionar nada.

El catálogo de sondas se ejecuta mediante Playwright Test, configurado en
`scripts/testing/probe-config.ts`. `scripts/testing/probes.ts` aplica la misma partición de shards
revisada a la CI y delega la ejecución en el ejecutor nativo; `check:ui` solo aporta sus IDs
afectados. Los catálogos locales completos usan las mismas tres particiones de la CI de forma
secuencial. Cada partición tiene un plazo de 480 segundos compartido por sus fases nativas; cada
fase conserva su propio directorio de artefactos.
Los escenarios compartidos se ejecutan con como máximo dos workers, cada uno con un contexto nuevo
y fixtures locales al contexto. Los escenarios fotograma a fotograma marcados `shouldRunAlone` se
ejecutan en una invocación posterior de un solo worker aunque las pruebas compartidas hayan
fallado. Los reintentos son cero y las pruebas con solo-enfoque están prohibidas. La recolección
nativa se comprueba contra el registro en `scripts/probe-runner.test.ts`; la evidencia de tiempos
faltante o duplicada falla de forma independiente del código de salida del ejecutor.

Playwright es dueño de los presupuestos de prueba, la programación, la limpieza de
contextos/navegador, los pasos y el reporte de resultados. Los fixtures del proyecto son dueños de
las listas permitidas de API, los fallos esperados acotados, el estado sembrado y el registro de
fallos posterior al cierre. Los fallos conservan reportes de error nativos y adjuntos finales de DOM
y PNG bajo `tmp/probe-failure/`. El trazado continuo está desactivado para que la instrumentación del
servidor de desarrollo, con mucho código fuente, no distorsione las mediciones de rutas y frames.
`pnpm verify:browser:harness` inyecta fallos reales de runtime, fixture, saliente, aserción y
configuración, y comprueba la salida distinta de cero del ejecutor real y los controles positivos
con uno y dos workers. El programador del ejecutor nativo no se reimplementa ni se prueba
unitariamente aquí.

La nueva orquestación y las autopruebas usan TypeScript. `pnpm type-check:tooling` comprueba los
puntos de entrada migrados, fixtures, configuración, reporteros y autopruebas con tipado estricto
NodeNext; se ejecuta tanto en la verificación estática como en la verificación de tipos incremental
de `test:fast`. `tsx` ejecuta TypeScript y resuelve imports, pero no reemplaza esa verificación de
tipos. Las suites de lógica existentes se ejecutan como archivos de prueba de Node aislados, con
programación nativa acotada y detección automática. Los fixtures de dominio en JavaScript
existentes y las compuertas restantes pueden migrarse en cambios acotados; añadir otro cargador o
programador de pruebas ad hoc no es el camino de migración.

Los controles negativos de la demo copian sus entradas declaradas completas en árboles temporales
por prueba. Nunca reescriben el conjunto de datos vivo, la tabla de rutas, la grabación ni la
compuerta. Por tanto, la comprobación de frescura y el pool de autopruebas pueden seguir siendo
concurrentes sin depender de tiempos ni de reintentos de restauración.
`scripts/check-demo.test.ts` incluye controles positivos y negativos concurrentes y comprobaciones
de preservación de bytes contra el conjunto de entradas vivo.

Nunca añada un interruptor de omisión ni estreche una regla del planificador para que desaparezca
una ejecución lenta. Si la selección es más amplia de lo que justifica el cambio, añada una regla
de ruta o un mapeo de escenarios, con una prueba en `scripts/ui-impact.test.mjs` o
`scripts/check-ui-plan.test.mjs`.

Las aserciones de referencias de datos y de eficiencia de contexto del Agent pertenecen a pruebas
de Go junto a `internal/agent`: `data_sources_test.go` cubre handles estables y acotados a la
conversación, filas posicionales y vacías de SQL, límites de metadatos, descripciones de fuentes
sin valores, errores de esquema accionables y retroalimentación de reparación. Una integración con
modelo fixture verifica que los metadatos se mantienen fuera de los eventos de la consola, que los
turnos completados dejan de reproducir resultados sin procesar y que un Canvas posterior resuelve el
conjunto de datos original sin otra lectura. Los rechazos de operaciones, los resultados inciertos,
las referencias de imágenes, las prioridades de fuentes y los avisos de omisión sobreviven a los
resúmenes acotados; el historial almacenado no cambia. `prompt_test.go` fija la guía de
dominio/ventana/evidencia de costos, la semántica de alias configurados y el presupuesto del prompt,
incluidos los metadatos de identidad escapados. Estas no necesitan Chromium ni llamadas a modelos
reales y el carril de pruebas de Go existente las detecta automáticamente.

Las aserciones de recuperación del Agent pertenecen al límite más bajo que es dueño del
comportamiento: pruebas de facade dirigidas por canales para la vida de la ejecución y la
reproducción, pruebas de lógica con transporte inyectable para los fallos de conexión, y la sonda
`agent-live` existente para la recarga y el renderizado reales del navegador. Las etiquetas de
tiempo transcurrido en vivo son consumidores independientes de un almacenamiento externo: su reloj
y la suspensión en pestaña oculta son pruebas de lógica, mientras que la sonda del Agent comprueba
las décimas visibles y el borde claro de Stop. Las sondas de coalescencia de streaming excluyen
solo las mutaciones de la etiqueta de tiempo transcurrido, no las de la respuesta, porque el reloj
no publica a través del hook de ejecución de la transcripción.

La inyección de fallos de admisión de imágenes en `internal/agent/runtime_test.go` cubre el fallo de
validación/almacenamiento de una imagen posterior y el fallo del INSERT/UPDATE inicial de la sesión.
Comprueba que solo se eliminan las imágenes recién admitidas y que un reemplazo fallido conserva las
imágenes del turno anterior. La inyección de fallos de reinicio también cubre el rechazo por
operación pendiente y un guardado fallido de la sesión reiniciada: la conversación original y sus
imágenes referenciadas deben seguir siendo legibles. `internal/api/browser_runs_test.go` admite una
solicitud de imagen validada mayor que el antiguo sobre solo de texto con `X-OMC-Run-ID`, comprobando
que el wrapper preserva el cuerpo para el handler; un caso aparte rechaza cuerpos por encima del
límite compartido. Estas aserciones de persistencia y admisión pertenecen a Go, no a las sondas de
carga del navegador.

### Displays en línea y razonamiento progresivo

`internal/agent/display_test.go` valida el `render_ui.frame` opcional, la compatibilidad de tarjetas
con el campo ausente, `none` congelado y el rechazo legible de valores inválidos. La suite de lógica
del workspace del Agent verifica que un canvas sin marco cambie solo su fondo conservando la misma
política de sandbox; la suite de lógica del tema fija el radio del hilo y las proyecciones del relleno
del primer plano.
La sonda `agent-views` existente es dueña de varias figuras intercaladas con el texto de la respuesta,
de su eliminación de la cadena de capacidades, y del fondo, borde, tratamiento del título y nombre
accesible de la figura sin marco, además de la restauración del foco tras cerrar la pantalla completa.
La sonda `agent-stream` existente observa el razonamiento antes de añadir una llamada de capacidad al
mismo grupo de partes, comprueba que la línea de tiempo preserva la página y verifica que el caret del
razonamiento sigue el estado de su despliegue. También mantiene una respuesta AG-UI válida en streaming
en límites observables para afirmar la legibilidad del texto corto, una sola etiqueta de pensamiento en
vivo, actividad solo de fase/tiempo transcurrido y geometría separada de título/cuerpo/actividad.
Comprueba el resaltado de solo glifos de 900ms y el fallback de movimiento reducido, el seguimiento
incremental de Markdown y del layout de contenido diferido, el reflujo en teléfono, el scroll manual hacia
atrás (incluido un commit de layout en el mismo frame antes de su evento de scroll), la reanudación al
final, los remontajes de despliegues en vivo tras el scroll hacia atrás, el plegado al completarse y la
reapertura del texto ya asentado. Los fixtures de inicio/fin de razonamiento llevan los mismos IDs de
mensaje requeridos que el protocolo. No se necesita una espera fija ni un ejecutor adicional.
La sonda de adjuntos afirma el payload WebP normalizado de red y no la codificación de la carga
original. Las exportaciones de conversaciones preservan el orden de los displays en línea y las líneas
de tiempo de trabajo; el ADR 0093 extiende el límite de exportación registrado en el ADR 0082.

### Regresiones de la lectura de la consola y de los despliegues

La sonda `agent` existente comprueba la navegación por teclado de los selectores del compositor, la
confirmación y la restauración del foco, el menú compacto de razonamiento, los nombres de parámetros
primarios con descripciones localizadas secundarias, el disparador de peso regular y el relleno de la
fila seleccionada.
La suite de lógica de los selectores del compositor, detectada automáticamente, es dueña de la indexación
de navegación.

El barrido de breakpoints del encabezado en teléfono observa la finalización del layout tras cada cambio
de tamaño del viewport antes de contar los controles renderizados, incluido el límite de 640/641px. La
comprobación sigue exigiendo las formas exactas de dos herramientas en teléfono y cinco en escritorio.

Las sondas `dashboard-charts` y `dashboard-model-panels` existentes miden los márgenes compactos de los
tooltips, los centros de las filas, las columnas de marcador/nombre y los bordes numéricos, incluida la
lectura compartida de la dona, mientras que las pruebas de lógica cubren los nombres completos
escapados, los valores exactos y las unidades localizadas. `scroll-smoothing` ejercita los popups de
modelos nativos del Agent con la estructura de holder compartida de la biblioteca de listas, muescas
repetidas/invertidas, filtrado y reapertura, junto con el popup virtual de zona horaria y la lista de
solicitudes. `provider-model-picker` verifica que los modelos personalizados recién añadidos permanezcan
colapsados hasta un despliegue explícito; `oauth-management` y la suite de lógica de enfriamiento de
cuota, detectada automáticamente, distinguen las condiciones de cuota reconocidas de los motivos
inesperados, usan la explicación genérica para los tooltips de enfriamiento en blanco y preservan los
diagnósticos completos del Drawer.

`dashboard-model-panels` también estrecha y vuelve a ensanchar el marco del anillo sin cambiar el tamaño
de la ventana y exige que el anillo lo rellene de nuevo en el centro de la lectura, el caso que el
reajuste de G2 solo por ventana no cubría cuando la fuente de la consola llegaba después del primer
pintado.

### Regresiones de la vista de modelos del Dashboard

La sonda `dashboard-model-panels-states` existente es dueña de la selección de ventana, el refresco
manual, la persistencia de la agrupación de modelos, la selección optimista y la reversión de
escrituras rechazadas. Las aserciones de agrupación leen el estado checked de los radios nativos, no la
clase CSS de selección de antd gobernada por la animación: un thumb en movimiento quita
temporalmente esa clase sin cambiar el valor seleccionado. El fixture de rechazo retiene solo el PUT de
la vista de modelos hasta observar el radio optimista, luego libera explícitamente su respuesta 500 y
espera la reversión. No depende de la finalización de una animación ni de una espera fija.

### Regresiones de filas de plugins

La sonda `plugin-management` existente es dueña de la geometría coincidente de las acciones de la fila
instalada, la redacción de capacidades del proveedor de autenticación, los enlaces de desbordamiento y
el traspaso de desinstalación. Verifica que abrir o descartar la confirmación no envíe ningún delete,
que cancelar/Escape devuelvan el foco a la acción de la fila y que confirmar elimine solo el plugin
elegido. `plugin-management-narrow` comprueba la fila, el desbordamiento y la confirmación a 320px, además
del barrido existente de pestañas en teléfono. La geometría del portal se mide después de que el layout
se asienta, no tras una espera fija.

### Regresiones de conexión de plugins

`scripts/test-oauth-providers.ts` es dueño de la distinción entre capacidad de proveedor de
autenticación y método de inicio de sesión, la precedencia de páginas registradas, la deduplicación de
deshabilitados/integrados y la resolución del flujo a partir de respuestas exitosas de CPA (incluidas
etiquetas ausentes o desconocidas, la precedencia del device-code, ambos campos de session-token y las
respuestas incompletas que siguen gestionadas por el plugin). La sonda `oauth-management` existente es
dueña del cableado de la conexión: un plugin de clave de API abre su página alojada sin una solicitud de
inicio de OAuth, y los plugins interactivos sin página cambian a controles de device o de callback solo
tras un Start explícito. La pertenencia de credenciales y la identidad siguen cubiertas por las suites de
lógica de workspace y de logos de plugins.

### Regresiones de retroalimentación

- `scripts/test-feedback-surfaces.ts` fija las duraciones de los acuses breves, los presupuestos de
  lectura de segunda línea y de atajos, la precedencia del reporte persistente y las sobrescrituras
  explícitas de duración. Estas decisiones de política pertenecen a la suite de lógica y no a pruebas
  de navegador que esperan tiempo real.
- `web/tests/notice.component.test.tsx` es dueño del contrato renderizado del aviso en línea: el tono
  nombrado como código de estado, una descripción única promovida a titular, el control de cierre presente
  solo con `onClose`, y `LoadFailure` con su motivo y Retry.
- `web/tests/switch.component.test.tsx` es dueño del contrato compartido de `Switch`: el valor controlado
  y su `onChange`, la activación mediante una etiqueta envolvente, el rechazo mientras está deshabilitado
  o pendiente, un `aria-busy` propiedad del llamador que sigue siendo clicable, y el binding de
  `Form.Item valuePropName="checked"`. Su geometría dibujada pertenece al navegador.
- `web/tests/shared-primitives.component.test.tsx` es dueño de los contratos de `SearchInput` (nombre
  accesible, fallback del placeholder, `onChange` con valor de texto, limpieza), `EmptyState` (la marca
  por tamaño, la segunda línea opcional y la acción), `SectionHeading` (elemento de esquema, conteo,
  descripción y `extra` por peso), `AppDrawer` (cierre con nombre, pie de dos ranuras, sin pie si no hay
  contenido, el escalón de ancho), `Tag` y `ToggleTag` (clases de tono y tamaño, glifo oculto, estado
  pulsado), `ConfirmAction` (etiqueta de cancelar fija, confirmación con nombre y color), `SelectionBar`
  (conteo en vivo, nota, acciones finales), `Toolbar` (la ranura final y la variante con regla), `Panel`
  (encabezado desde `title`, sin inset en línea), `Meter` (proporción, acotado, semántica con y sin
  etiqueta) y `Pager` (ausente con una sola página, sin menú de tamaño de página, la variante por
  pasos). Su geometría dibujada pertenece al navegador.
- `scripts/check-feedback.test.mjs` también fija las reglas `raw-switch`, `raw-empty`, `raw-tag`, `raw-drawer`, `raw-popconfirm`, `raw-card`, `raw-descriptions`, `raw-pagination` y `raw-progress` en ambas direcciones, incluidas las exenciones de archivo por regla para los componentes que son dueños de una primitiva antd sin envolver. Comprueba los bindings y alias de retroalimentación de Ant Design (imports con nombre y de espacio de nombres,
  resultados de `App.useApp()` y hooks de modal), el sombreado de ámbito, falsos positivos en comentarios,
  cadenas e imports solo de tipos, confirmaciones legítimas, ubicaciones de diagnóstico y la
  exención del módulo de retroalimentación. El ejecutor de autopruebas del repositorio lo detecta
  automáticamente.
- `scripts/check-style-tokens.test.mjs` fija las reglas de escala tipográfica y de radios en ambas
  direcciones: tamaños de fuente de la escala y fraccionarios, tamaños de display que se mantienen
  literales, propiedades personalizadas que solo terminan en `font-size`, radios pequeños en forma
  abreviada y extendida, referencias a tokens indefinidos y con fallback, declaraciones comentadas y un
  árbol vacío. El ejecutor de autopruebas del repositorio lo detecta automáticamente.
- `scripts/font-shards.test.mjs` fija el sharding de fuentes (ADR 0094): formatos `cmap` 4 y 12,
  directorios de tablas WOFF2 y sfnt, formato de `unicode-range` y el orden del plan de shards (núcleo,
  niveles de frecuencia, resto) con cada punto de código en exactamente un shard. También mantiene
  unidas las salidas confirmadas: `core.css` y `shardUrls.ts` igualan lo que renderiza el manifiesto, los
  archivos de shard son exactamente los del manifiesto, cada shard dibuja todos los caracteres que
  declara, los rangos nunca se solapan y cada carácter de `web/src` (salvo el emoji a color) está en
  algún shard. El ejecutor de autopruebas del repositorio lo detecta automáticamente. La suite de
  lógica `scripts/test-font-shards.ts` fija qué shards incrusta una exportación para su texto.
- El escenario de navegador `oauth-management` comprueba que los acuses ordinarios de copia no pueden
  desalojar un reporte persistente de cuota, que otro refresco lo reemplaza y que su acción de cierre
  lo elimina. También comprueba un toast de autorización consciente de credenciales para una credencial
  nueva única, un resultado ambiguo y un refresco fallido de la lista de credenciales, incluida la acción
  que revela la colección de proveedores. La aceptación de pila completa de OAuth descarta el toast de
  finalización antes de ejercitar la reapertura del drawer, de modo que la notificación no pueda cubrir
  la acción de cierre ni consumir la ventana acotada del estado de éxito.
- El escenario `agent-failure` reintenta una lectura fallida del directorio de capacidades sin perder
  el borrador del compositor, y luego comprueba el reintento del mensaje rechazado y las superficies de
  fallo de la ejecución aceptada.

## 4. Cuando falla la CI

- Los shards de sondas suben `tmp/probe-failure/`: por cada escenario fallido, ya sea que una
  comprobación fallara o lanzara una excepción, una captura de pantalla, el DOM, la URL, los errores de
  página y las advertencias de consola y navegaciones de la página. Un escenario que lanzó una
  excepción también imprime lo último de eso en el log del job. Reproduzca con
  `pnpm check:ui --scenario <id>`.
- La aceptación de pila completa sube `tmp/browser-acceptance-failure/`. Reproduzca con `pnpm build` y
  `pnpm verify:browser`.
- Vuelva a ejecutar solo el comando fallido. Un fallo que pasa al repetir es un flake que se arregla en
  su aserción, nunca una razón para añadir un reintento o alargar una espera.

### Regresiones de capacidad de respuesta

- `scripts/test-date-time-format.ts` comprueba la reutilización de formateadores, el aislamiento de
  configuración regional y zona, las fechas civiles en hosts con medianoches omitidas, la paridad del
  reloj del Agent y exactamente dos conversiones de zona horaria por observación del mapa de calor,
  sin importar el número de celdas.
- `scripts/test-route-loader.ts` comprueba que no hay imports eager, la reutilización de importaciones
  en curso o exitosas y la recuperación tras un import especulativo fallido.
- El escenario de navegador `route-preloading` observa las solicitudes de módulos a partir de eventos
  reales de hover, foco y toque en el menú, verifica que el inicio de sesión no carga módulos de
  página y que la intención no dispara lecturas de negocio ni la carga del editor YAML, y luego navega
  a la página precargada.
- `internal/api/compression_test.go` comprueba la negociación gzip, la paridad de la respuesta
  decodificada, las cabeceras de estado/caché preservadas, la variación de identity, la paridad de
  representación GET/HEAD, la caché concurrente acotada de assets, el trabajo de compresión sin
  bloqueo, las nuevas comprobaciones antes de publicar en fallos fríos superpuestos, el enrutamiento de
  subpath y la entrega inmediata del flush de SSE.

- `scripts/test-chart-mount-queue.ts` inyecta la programación de tareas para comprobar un solo montaje
  FIFO por tarea, la cancelación, la limpieza/configuración de StrictMode y la recuperación tras un
  montaje fallido.
- La sonda `dashboard-charts` existente observa frames distintos del navegador para la creación del
  canvas de KPI, espera a que se pinten todas las seis marcas y cuenta las mediciones del contenedor
  de gráficos durante un refresco idéntico. Las sondas `dashboard-chart-motion` y de paneles de modelo
  siguen siendo dueñas de las morfosis de actualización, el movimiento reducido, el hover y las
  lecturas exactas.
- `internal/repository/usage_facets_test.go` compara la lectura SQL combinada con consultas agrupadas
  independientes en diferentes ventanas, instancias, valores vacíos o con solo espacios, ordenamiento
  binario, límites por dimensión y máscaras normalizadas, y comprueba las lecturas canceladas o no
  inicializadas. Sus benchmarks de estrategia comparan ventanas pobladas y de alta cardinalidad sin
  duplicar la creación del fixture del benchmark dentro de la porción cronometrada.

- La sonda `dashboard-heatmap` existente es dueña de la geometría del ancla del popup activo, la
  propiedad de un solo popup, la descripción ARIA de su celda, el cierre por puntero/teclado, la
  restauración del foco, el cambio rápido, el refresco de datos de la celda activa y la limpieza de
  rutas. También mide la fila de actividad que comparte la cuadrícula: la cuadrícula y el panel de
  cuota de credenciales como mitades iguales en escritorio, apilados en ese orden en teléfono, con las
  semanas más recientes alcanzando el borde del panel. El escenario de fallo es dueño de los estados
  del panel de cuota junto a una cuadrícula que no pudo leerse: desconocido con un reintento cuando la
  lista de credenciales nunca se leyó, las filas conservadas con una advertencia cuando falla un
  refresco, y la advertencia limpiada por un reintento exitoso. Tras un cambio rápido, espera el
  estado activo de la última celda y su propio popup vinculado a ARIA visible, no un tooltip saliente;
  las aserciones de ancla, conteo de popups y de identidad del DOM siguen ejecutándose después.
  Instrumenta los getters de extensión de scroll antes de navegar para detectar mediciones síncronas
  de montaje; estas afirmaciones de portal, foco y layout requieren Chromium y no una prueba de lógica
  pura. El escenario en teléfono sigue siendo dueño de la visibilidad inicial del día de hoy, el
  deslizamiento y la preservación del scroll durante un refresco.

- `route-preloading` también comprueba las llamadas de reinicio de scroll del shell: la navegación al
  principio de una página no debe emitir ninguna, mientras que abandonar un Dashboard genuinamente
  desplazado reinicia la columna de contenido una vez. Sus lecturas del Dashboard usan los fixtures
  compartidos de gráficos y mapa de calor, manteniendo el escenario hermético mientras ejerce
  contenido real que se desborda.

- `scripts/test-request-timestamp.ts` fija las dos etiquetas de la fila contra la interpretación
  existente de dayjs en desplazamientos fraccionarios, cambios de fecha, milisegundos y ambos
  límites de horario de verano, y afirma que formatear una fila no construye ninguna fecha con zona.
  La sonda `column-alignment` cambia la zona horaria compartida mientras una fila de solicitudes sigue
  montada, detectando un memo obsoleto sin reemplazar el nodo del DOM. Esa afirmación de suscripción
  requiere el navegador.
- `scripts/test-theme-presets.ts` fija la estimación de Listy al mínimo CSS de la fila de solicitudes
  en cada paleta integrada usando la altura de fuente calculada de antd. `request-list-interactions`
  observa el pico inicial de filas montadas contra la geometría del contenedor, luego comprueba los
  primeros y últimos registros bajo la agrupación por origen y cliente antes de volver a las filas
  cronológicas. Sus aserciones de fondo de lista, redimensionado y drawer y los escenarios existentes
  de suavizado y toque siguen validando las alturas medidas.

- Las sondas de solicitudes también son dueñas de las pistas exactas de marca de tiempo/caché del
  tooltip compartido, la propiedad de un solo popup, la geometría del ancla estacionaria, la
  preservación del DOM y de ARIA de la celda, la transferencia del hover a su texto, el cierre por
  Escape con el foco en el botón de precio conservado, las revisiones de etiqueta activas, el scroll
  de la lista virtual y la limpieza de rutas. `column-alignment` mantiene el popup abierto mientras
  cambia la zona horaria compartida, afirmando tanto la etiqueta corta como el tooltip completo en la
  misma celda montada. La comprobación de limpieza entre páginas usa los fixtures compartidos de
  System y espera a que se renderice su tarjeta antes de navegar de vuelta, de modo que los tiempos de
  caché del módulo no puedan ocultar un fixture de respuesta incompleto. Estas afirmaciones de evento,
  portal y virtualizador pertenecen a Chromium.

### Cobertura de regresiones de iconos personalizados

El análisis de imágenes, los límites, la consistencia de MIME, la detección de formato estático y la
seguridad de SVG pertenecen a `internal/iconasset/image_test.go`. Las pruebas del repositorio cubren la
persistencia, la cuota, los conteos del mapeo heredado, el borrado atómico de referencias con assets y
preferencias no relacionados preservados, los guards de eliminación de obsoletos o faltantes, la
resersión del fallo de eliminación y la asignación/eliminación concurrente; las pruebas de handler
cubren CRUD autenticado, revalidación de ETag privado, entrada acotada y proyección de metadatos. Las
pruebas de operaciones ejercitan las declaraciones de Agent/MCP y la confirmación de eliminación. La
suite de lógica de iconos personalizados, detectada automáticamente, comprueba el análisis de
referencias, la búsqueda, la limpieza de asignaciones inmutables, la elegibilidad para guardar y la
política de selección fallida.

La sonda `custom-icon-library` es dueña de la selección de archivos, la vista previa validada, el
reemplazo en Base64, el repintado inmediato de un proveedor montado, el fallo de selección, la
prevención de guardado de reemplazos inválidos, la conservación de entradas tras un fallo de guardado o
de eliminación, la persistencia tras recarga, la eliminación de referencias con restauración del
valor por defecto, la cancelación, la persistencia de reinicios tras recarga, los estados vacíos de
ancho completo, la restauración del foco en la superposición estrecha de edición/confirmación sobre el
drawer del proveedor y el reinicio automático de su selección de icono no guardada. Las reglas del
planificador de la consola de proveedores lo incluyen junto a los escenarios del selector existentes,
con casos unidos y negativos fijados. Las aserciones esperan en estado observable y no en esperas fijas.

La restauración del valor por defecto compara la marca del proveedor con su máscara CSS monocromática
original, tanto inmediatamente después de la eliminación como tras recargar; una imagen personalizada
restante, una marca faltante o un fallback neutro no pueden satisfacerla. La imagen personalizada
seleccionada es un caso negativo explícito para ese predicado de restauración.

### Cobertura de regresiones de ruta de configuración

`scripts/test-config-patch.ts` es dueño de las lecturas y escrituras de campos canónicos e históricos,
la precedencia de false/null canónico, la restauración de la línea base con comentarios, los ajustes
omitidos, las reubicaciones de ruta de origen seguidas de ediciones visuales y llevar las ediciones
posteriores al readback reubicado de CPA. El CPA falso comienza con valores canónicos de
`client.codex` y `upstream.codex`; sus escrituras raíz normalizan los dos alias históricos antes de
fusionar. `scripts/fake-cpa.test.mjs` comprueba de forma independiente el JSON y el readback YAML
resultantes. La aceptación de pila completa de configuración existente guarda ambos interruptores
activados y desactivados en sus rutas canónicas y recarga la página tras cada guardado. El guard de
revisión, el respaldo y la restauración de secretos de la API siguen cubiertos por sus pruebas de Go
existentes.

La misma suite es dueña del único ajuste cuya ausencia es un valor por defecto y cuyo cero es un
ajuste: `upstream.claude.session-date-pin-days` lee los 7 días de CPA cuando se omite, de modo que
una gateway no modificada nunca se escribe, mientras que un `0` explícito se guarda en su propia ruta
y se lee de vuelta como `0` y no como el valor por defecto, y vaciar el cuadro numérico
restaura la clave omitida en lugar de almacenar un cero. El campo llegó después de la reubicación
de la sección de Claude, por lo que la suite también fija que la ortografía previa a la
reubicación nunca se escribe. La aceptación de pila completa guarda ese `0` y recarga, que es la
única comprobación que detecta un readback que cae de vuelta al valor por defecto.

### Cobertura de regresiones de respaldo de configuración

`internal/repository/config_backups_test.go` es dueño del cifrado en reposo, la deduplicación frente
a la copia más reciente, la retención separada previa a v8, la retención del operador y su poda
inmediata, y la eliminación. `internal/cpa/management/client_config_test.go` es dueño del hook
previo a la escritura: una copia antes de cada escritura, la razón que nombra cada escritura (el
nombre de la operación exterior gana) y el rechazo cuando no se puede conservar una copia.
`internal/api/management_config_backups_test.go` es dueño de las rutas: la restauración del lado del
servidor y su escritura de documento completo, el `409` previo a v8, el indicador `created` de la
copia manual, los límites de retención y la eliminación. La sonda `config-backups` es dueña del
diálogo: las etiquetas de razón, la restauración previa a v8 retenida, la escritura de retención, el
apilamiento de la confirmación de restauración sobre el diálogo, la solicitud de restauración y la
recarga del editor tras ella. La página de configuración y las reglas del planificador de
`web/src/components/config/` la seleccionan, con un caso negativo para el esquema.

### Cobertura de reconciliación de fuentes de plugins gestionados

`internal/api/management_plugin_source_test.go` es dueño del registro de Shell-PAMC como fuente de
almacenamiento (ADR 0104): una lectura del almacenamiento añade la dirección, ambas rutas de guardado
de configuración la restauran, el guardado de ajustes del plugin la mantiene fuera de la lista
editable, una instalación la añade de nuevo antes de llamar a CPA, el interruptor la elimina y una
demostración filtra sus entradas sin escribir su fixture. También es dueño de las obligaciones de
Tier-1 de la reparación: un respaldo de `plugin_settings` antes de la escritura y un registro de
auditoría de `plugin.source`, además de los dos bordes de preferencia: un `null` JSON almacenado se
lee como el valor por defecto (activo), y un guardado que deja la sección de plugins ilegible indica
que la configuración se aterrizó en lugar de leerse como un rechazo simple.
`internal/cpa/configyaml/plugins_test.go` es dueño de la edición de la lista con preservación del
orden e `internal/pluginregistry/registry_test.go` es dueño de
la forma y el fijado de dirección a ID de fuente. `internal/demo/demo_test.go` es dueño de la mitad
del fixture de la misma cadena: cada entrada del almacenamiento nombra la URL del registro del que
provió, el campo que la proyección lee para marcar, fijar y retener las entradas gestionadas, y el
catalogo del fixture lleva una. Las suites de ruta de configuración y de respaldo conservan sus
afirmaciones sobre el guardado propio del operador: su fixture comienza en el estado estable
gestionado, de modo que ese guardado es la única escritura que esas pruebas observan.

### Valores por defecto de configuración y desgloses de Payload

`scripts/test-dirty.ts` cubre los valores por defecto de reintento omitidos, los valores de ejemplo
explícitos y la reversión sin pérdida tanto para las líneas base YAML omitidas como para las
explícitas. `web/tests/payload-rules.component.test.tsx` renderiza el editor real de Payload bajo
StrictMode: las categorías vacías y pobladas comienzan colapsadas, las actualizaciones externas de
YAML preservan las opciones de despliegue y la validación del guardado abre una categoría inválida
sin mutar el documento. Ambas suites se detectan automáticamente; los escenarios de navegador
conservan la cobertura de layout y de edición de reglas.

### Cobertura de regresiones de cuota y de secreto TURN

`internal/quota/plugin_test.go` es dueño de la resolución exacta de plugins y del rechazo de enviar
el índice de autenticación de una credencial sin coincidencia a un plugin no relacionado, incluso
cuando es el único candidato. `internal/api/management_quota_test.go` es dueño del contrato de red
de la redención: un borrado de enfriamiento fallido sigue devolviendo HTTP 200 con una redención
exitosa y el código fijo `cooldown_clear_failed`, sin el cuerpo bruto de CPA.
`web/tests/ice-servers-editor.component.test.tsx` es dueño del estado renderizado del secreto:
Replace y un reemplazo vaciado conservan el centinela; el texto no vacío escrito lo reemplaza, y
solo Clear explícito emite un valor vacío. Las sondas de navegador de configuración existentes
conservan la cobertura de layout y del flujo de guardado.

### Route error recovery regression coverage

`scripts/test-route-error-diagnostics.ts` owns diagnostic projection, HTTP route
responses, unknown/cyclic/hostile thrown values, bounded output, credential
redaction (including query/fragment removal on bracketed relative paths) and the
copied report's fields. It is automatically discovered.
The `route-render-error` and `route-lazy-error` probes intercept a real page module
to cause a render exception or an import failure; the render probe also fails the
shell to prove the fallback is independent of it. The lazy-import probe holds
and rejects the shell download, checking its placeholder, localized accessible
status name and the rough-progress bar reporting the held download as unfinished, diagnostic copy and full-document recovery after the
shell becomes available. They assert the
root route's brand, localized title and diagnostic copy in all four languages, light/dark
rendering, phone overflow and touch-sized controls, heading focus, stack
expansion, redacted clipboard output, and keyboard-driven full-document reload
y la navegación al dashboard por teclado bajo el subpath del despliegue. La recuperación se observa
tras reemplazar el módulo fallido con un fixture sano; no se introduce ninguna ruta de inyección de
fallos en producción. Estas afirmaciones de router, foco y duración del documento requieren Chromium.
La aceptación de tema/marca del artefacto compilado espera el contenido del shell renderizado (y el
logotipo de escritorio) así como la hidratación del tema antes de medir la geometría y los rellenos
SVG, porque la descarga del shell puede completarse después de la hidratación del tema.

### Cobertura de la aplicación web instalable

`internal/api/pwa_test.go` es dueño del contrato servido: los miembros del manifiesto (URL relativa
`start_url` y `scope`, sin `id`, display standalone, los tamaños de icono declarados), cada icono
decodificado al tamaño que declara, `application/manifest+json` con `Cache-Control: no-cache`, la
paridad de HEAD, un icono faltante respondiendo 404 en lugar del shell de la SPA, las mismas rutas
en la raíz, `/shell-pamc` y una base anidada, y el límite permitir/rechazar de la demostración
alrededor de ellas. `scripts/acceptance/pwa.mjs` es dueño de lo que solo Chromium puede establecer:
`Page.getAppManifest` analiza el manifiesto desplegado por el binario compilado sin errores,
`Page.getInstallabilityErrors` está vacío en un contexto de navegador que bloquea los service
workers, de modo que la instalación no depende de uno; la identidad procesada del navegador es el
`start_url` del montaje (de modo que la raíz y un montaje anidado no pueden presentarse como una sola
app), todos los iconos nombrados en el manifiesto cargan y un enlace profundo resuelve el mismo
manifiesto mediante el elemento base inyectado.

### Cobertura de regresiones de retroalimentación de carga

`scripts/test-load-progress.ts` es dueño del conteo de tareas y la estimación aproximada (ADRs 0052
y 0054): apertura/finalización de lotes, crédito completo asentado, crédito pendiente acotado, tareas
tardías/reiniciadas, el retraso de aparición de 200ms, el suavizado monótono independiente del
fotograma, el límite de la última tarea pendiente y la fusión de registros/fuentes.
`scripts/test-progress-controller.ts` inyecta el reloj, el renderizado y el programador para ser
dueño de los lotes rápidos invisibles, las notificaciones frecuentes sin reinicios del reloj, el
trabajo tardío que retiene el progreso, la finalización en un tiempo base, los episodios nuevos
durante la finalización/desvanecimiento, el movimiento reducido solo de eventos, los cambios de
preferencia en vivo, los documentos ocultos/reanudados y la eliminación. Ninguna prueba espera
tiempo de reloj real.

La sonda `route-lazy-error` existente es dueña del cableado real del navegador. Su helper en
`scripts/acceptance/probes/loadingProgress.mjs` retiene tareas reales y muestrea la animación CSS de
actividad real con un reloj de animación controlado: movimiento durante un relleno retenido, envoltura
invisible, recorte en la frontera aproximada, geometría 2px/64px/16%/16px, color y opacidad del tema,
identidad de raíz/animación, estabilidad del layout y afirmaciones de accesibilidad numérica omitidas.
Ejercita las barras de shell, inicio de sesión y consola a anchos de escritorio y teléfono, y el control
de tema del inicio de sesión selecciona claro y oscuro. Un refresco real retenido del dashboard
comprueba la actividad dirigida por consultas y la retención de datos. La sonda conserva el
fallo/recuperación de módulo retenido, la preservación de lotes de movimiento reducido en vivo y el
congelamiento de la animación tanto del marcador de posición como de la actividad, además de la
cancelación del desvanecimiento de opacidad real de la barra de inicio de sesión completada. Las
aserciones observan el estado o los frames de animación, nunca esperas fijas. Los escenarios de
página existentes conservan su cobertura de sondeos silenciosos y geometría del marcador de posición.

La autoprueba del verificador de movimiento fija la excepción de duración de actividad de espera
local en ambas direcciones, incluido su requisito de movimiento reducido y el rechazo de duraciones
bruta no relacionadas. También fija la exención `reduced` del mapa de rutas: el selector nombrado pasa
sin contraparte, otra animación en el mismo archivo sigue fallando y una exención no usada falla.
La excepción existente del respirado del marcador de posición se fija de forma independiente.

## Límites de carga en producción y reportes de bundle

`pnpm build` escribe un grafo de propiedad/imports de Rollup en `tmp/bundle/graph.json`, no en la
distribución servida o embebida. `pnpm check:bundle` comprueba sus hashes de chunk y aristas de
dependencia, y luego recorre la entrada/modulepreloads HTML y los imports estáticos. Las páginas, el
shell autenticado, los gráficos, Markdown y Monaco deben mantenerse fuera del arranque. La página de
configuración debe diferir su editor YAML hasta que se solicite.

Las comprobaciones de tamaño estrictas son topes amplios de anomalías, no cuotas de funcionalidades
por chunk: JS de arranque 3 MiB raw / 1 MiB gzip; CSS de arranque 256 / 96 KiB; JS más grande 4 MiB
raw; todo el JS 16 MiB raw; distribución 32 MiB raw (ADR 0094); SVGs de Lobe 2 MiB raw. Los valores
gzip son estimaciones por archivo a nivel 6, incluidos archivos binarios en estimaciones agregadas, no
bytes servidos reales ni mediciones de rendimiento del navegador. Un crecimiento mayor que el 10% y
16 KiB a la vez para métricas de entrada/arranque, o 128 KiB para otras métricas, es orientativo.

La CI selecciona el reporte del push exitoso exacto de la revisión base del PR o del push precedente,
con `scripts/bundle-reference.json` como arranque de un commit. Los artefactos faltantes o vencidos se
reportan como no disponibles, no se reemplazan por otra revisión. En local, un `BUNDLE_BASE_SHA`
omitido toma por defecto `origin/master`; un valor explícitamente vacío desactiva la comparación,
como hace la verificación de lanzamientos hasta que resuelve una base de lanzamiento anterior. El
candidato en sí mismo no es una base de comparación válida.
`BUNDLE_BASELINE` supplies
a saved report for that exact revision. GitHub retrieval additionally requires
`GITHUB_REPOSITORY` and `GH_TOKEN`. JSON and Markdown evidence live in `tmp/bundle/`
and CI retains reports for 30 days. The JSON includes per-file raw/gzip sizes and
propiedad de fuente del chunk; el resumen identifica los archivos JS más grandes y la pertenencia al
arranque. Los artefactos de referencia son datos, nunca código fuente ejecutado.

Las autopruebas se detectan automáticamente:
- `scripts/bundle-report.test.mjs`: cierres/ciclos estáticos, preloads HTML, editor diferido,
  propiedad independiente de los nombres de chunk, recursos faltantes/obsoletos incluido CSS
  diferido, cálculos de tamaño y compresión, crecimiento orientativo y todos los límites estrictos.
- `scripts/bundle-baseline.test.mjs`: selección exacta de SHA/evento/conclusión, referencias de
  arranque y explícitas, recuperación de artefactos y evidencia faltante/inválida.
- `scripts/lint-workflows.test.mjs`: detección de workflows relativos al repositorio desde un
  directorio de trabajo no relacionado, con ejecución inyectada de actionlint.
- `scripts/test-logic-runner.test.mjs`: fallos accionables de operando `--files`/esquema antes de
  cualquier ejecución de suite y planificación conservadora para una lista explícitamente vacía.
- `scripts/build-demo.test.mjs`: fixtures privados de origen/staging, empaquetado real y rechazo
  recursivo de assets/fuentes relativos residuales en cada módulo JS/CSS montado.
- `scripts/workflow-checks.test.mjs`: evidencia independiente del navegador y un veredicto
  obligatorio de resultado final del bundle, reportes conservados y compuertas existentes de
  navegador/sondas.
- `scripts/verify-full.test.mjs`: fallos inyectados del ejecutor, requisitos previos, toda la
  evidencia independiente e identidad de cobertura serial/paralela.

Un fallo del bundle sigue siendo bloqueante, pero ya no impide la aceptación de navegador/demo en
producción tras un build válido. El veredicto final de CI lee `steps.bundle.outcome`, no su
conclución con forma de éxito tras `continue-on-error`. Los ejecutores locales completos igualmente
devuelven fallo tras recopilar los demás veredictos. Esto preserva el fallo y lo hace diagnosticable.
Un fallo de secreto o de build sigue deteniendo el servicio. Para cambios aquí, ejecute las
autopruebas afectadas, `pnpm verify`, `pnpm check:ui` y `pnpm verify:full`; no añada un escenario de
navegador para una decisión pura de grafo o ejecutor.

### Cobertura de regresiones del selector de rango de tiempo

- `scripts/test-time-range-draft.ts` fija las reglas del selector como lógica pura, detectada
  automáticamente: la cuadrícula de seis semanas, el rango de dos pulsaciones y su reinicio, los
  extremos inclusivos a granularidad de día y minuto, el desplazamiento en vigor en la fecha elegida
  a través de un cambio de horario de verano, los tres rechazos (incompleto, invertido, futuro) y el
  ciclo de ida y vuelta desde una ventana confirmada hasta su borrador.
- `scripts/test-usage-events-view-policy.ts` fija que cada preset de la lista de solicitudes aparece
  una vez.
- Las secciones de aceptación de la lista de solicitudes cubren solo el cableado: el selector se
  mantiene dentro del viewport como popover y como hoja con su rango personalizado abierto, el
  calendario permanece cerrado hasta que se le pide, un preset y un rango personalizado llegan cada
  uno a la URL, y un rango a medio elegir no lo hace.

### Cobertura de la consola móvil y del YAML enfocado

- `scripts/test-source-wrap.ts` fija los valores por defecto de teléfono/escritorio y la precedencia
  de la elección manual.
- `scripts/test-visible-viewport.ts` prueba los límites utilizables, el desplazamiento de teclado y
  cursor, las lecturas inválidas o ausentes, el overscroll y el fallback de pellizco para hacer zoom
  como lógica pura, detectada automáticamente.
- `mobile-console` navega las 15 rutas de la consola en vivo a través de la navegación en teléfono a
  320/375/390px, espera el contenido propio de cada ruta y mide el desbordamiento de contenido y
  encabezado y las herramientas de encabezado alcanzables, luego comprueba el estado de preferencia
  seleccionado, las filas de menú de 44px, la restauración de Atrás/foco, los límites 640/641 y
  900/901, escritorio y horizontal, más los límites simulados del teclado y el hit-testing de Send
  para ambos espacios de trabajo de conversación. Cada ruta montada se redimensiona en los tres
  anchos de teléfono sin repetir la navegación. Los mapeos de rutas directas conservan el barrido
  (incluido Model Square); las pruebas del planificador fijan los casos positivos y negativos.
- `config-source-editor` es dueño de los widgets reales de Monaco, la fuente/gutter/ajuste, las URL
  largas y la indentación, la búsqueda en teléfono, la edición enfocada en el lugar, la continuidad
  de borrador/deshacer/foco, el Atrás anidado, los límites del viewport con teclado simulado, la
  entrada inválida, el conflicto de revisión, los guardados fallidos y la confirmación exitosa única.
  La geometría en teléfono se mide después de que el paso de renderizado de Monaco haya redimensionado
  las capas dentro del editor. También obliga al editor a ser más ancho que su shell y exige que la
  página no se ensanche: Monaco corrige su ancho en píxeles solo cuando se ejecuta su observer de
  redimensionado, y el shell lo recorta hasta entonces. Ni los cambios de opción de React ni la propia
  caja del editor certifican eso: su paso de layout dimensiona primero la caja, y hasta que sigue el
  paso de renderizado el cuadro de búsqueda cerrado conserva su desplazamiento de escritorio.
  `scripts/acceptance/configuration-plugins.mjs` también formatea un documento desde la SPA compilada
  para ejercitar las rutas de assets del worker de producción y el RPC, complementando el escenario
  de fuente del servidor de desarrollo. Ambos requieren el espaciado nativo de delimitadores de
  secuencia de flujo, que el fallback del serializador no puede producir; un toast o un estado sucio
  por sí solos no establecen la salud del worker. La captura de pantalla de la fuente usa una ruta
  absoluta desde la raíz del repositorio bajo `tmp/`, independiente del directorio de trabajo del
  llamador. `pricing-book` también comprueba el título del grupo de sincronización traducido en las
  herramientas del teléfono. Las aserciones existentes de lista y toque se conservan; `config-backups`
  también ejercita el diálogo del menú del teléfono, el scroll local de la tabla y el cierre con
  Atrás.
- La simulación automatizada del viewport visible no certifica el comportamiento del teclado/selección
  en iPhone. Cuando un cambio toca estas rutas y hay un dispositivo real disponible, ejercite el
  colapso de la barra de dirección, el teclado de software, la selección con pulsación larga y el
  movimiento del cursor en edición normal y enfocada, y anote lo que se comprobi; ninguna ejecución
  automatizada puede suplirlo.


### Cobertura de lectura de cuota

`internal/quota` es dueño de lo que significan los documentos de cada proveedor. Eso incluye el par
de xAI (un documento de créditos que suministra la ventana con las cifras del libro mayor junto a
él, cualquiera de los dos documentos utilizable solo, un par sin configuración fallando), los límites
contados y pools de ratios de Kimi (el período leído de la clave de cada pool, un límite contado que
gana su propio período, una clave desconocida que conserva su nombre, cualquiera de las dos escalas
de ratio) y una ventana estándar de Codex que toma su identidad del período que indica el payload.
El mismo paquete es dueño de la lectura vacía: un refresco exitoso que no publicó ninguna ventana es
`unpublished`, sobrevive a la evaluación y a un ciclo de instantánea, y una ventana posterior la
reemplaza. `scripts/test-quota-empty-state.ts` es dueño del texto que lleva una credencial sin
ventana, y `scripts/test-oauth-workspace.ts` es dueño de su grupo de triaje. El renderizado de esas
lecturas se mantiene con la sonda `oauth-management` existente.

`internal/quota/antigravity_test.go` owns period aliases, calendar-month versus
fixed-duration semantics, display ordering and persisted bucket identities, including
mixed explicit and fallback IDs. `internal/quota/antigravity_history_test.go` matches
fresh readings against pre-upgrade snapshot IDs so resets and evidence gaps cannot
cross quota windows when period recognition changes.

A failed read is a separate fact from a reading, and the split is covered at the layer
that can fail for the right reason. `internal/repository/quota_test.go` owns the attempt
record: the upsert, the batch read, a later success clearing the reason it followed, and
an attempt older than the stored one losing to it. `internal/quota/attempt_test.go` owns
what a read produced (`quota.ReadOutcome`) and the presented status
(`quota.ApplyReadingHealth`): an auth failure becoming `error` with the reauth action, a
transient failure and a reading that outlived its own reset boundary becoming `stale`
with no error attached, an attempt older than the reading ignored, a cooldown and a
disabled credential left alone, a fresh reading of an ended cycle not flickering, and
`exhausted` keeping its status. `internal/api/management_quota_attempt_test.go` owns the
wire: a failing refresh leaves the overview reporting `error`/`stale` with `last_refresh`
and the previous observation's windows and observed time, an auth failure counts as
attention, the next successful read clears it, and a credential with no stored observation
reports its failed first read as `error`/reauth in both the overview and the credential
detail - with no history row, because a failed read is not an observation.
`internal/api/management_quota_attempt_order_test.go` owns the ordering of two overlapping
reads of one credential: the first is held inside a gated gateway, the second completes, and
the stored attempt must be the later *start* rather than the later response, because a slow
read that began first may finish last. `scripts/test-quota-attempt.ts` owns
the row's two lines (failed attempt versus outlived reset, and silence when neither
applies), and `web/tests/credential-quota.component.test.tsx` renders the statement beside
the retained numbers and the row's own refresh control.

Automatic cooldown release follows the same split. `internal/quota/attempt_test.go` owns
`quota.HasRestoredCapacity`, which excludes stale, disabled, unpublished and used-up
readings. `internal/quota/auto_refresh_test.go` owns the trigger order: a due reset read
goes first, an expired cooldown is cleared for providers the loop never reads, and a
failed clear waits out the retry backoff.
`internal/repository/quota_test.go` owns `BatchExpiredCooldowns`: evidence past the
six-hour lookback still counts, while cleared rows, rows without a recovery time and a
credential with a newer cooldown or retry time still ahead do not.
`internal/api/quota_auto_refresh_test.go` owns the wire against a gateway that counts
`routing/cooldown/reset` calls: a read with room left releases the credential, wipes its
evidence and audits the release, an exhausted read keeps all three, and a round releases
only the credential whose cooldown fully recovered.

### Quota capacity coverage

- `internal/quota/capacity_scope_test.go` owns complete family/exact identity matching,
  dated model releases and fail-closed aliases/groups. `internal/quota/capacity_test.go`
  pins provider/scope eligibility, including Antigravity group windows. `internal/quota/capacity_history_test.go`
  owns adjacent-cycle selection, final-reading precedence and reset/period/scope refusals.
- `internal/repository/quota_test.go` pins half-open aggregates and served-model precedence.
  `internal/api/management_quota_capacity_test.go` owns current-vs-previous provenance,
  scoped joins, failed refreshes masked by cooldown, unreadable/corrupt history, snapshot
  stripping, fresh observation persistence despite corrupt history, and sticky reset/
  incomplete-history evidence surviving retention until a scheduled reset.
- `scripts/test-quota-capacity.ts` owns historical labels and unavailable copy selection;
  the existing `oauth-management` probe owns current/previous rendering and wrapping at
  desktop and 320/375px, including long token-only previous-cycle estimates in full-digit
  style constrained to their own compact window. This extends the existing scenario without a new runner or list.
- `internal/demo/quota_test.go` pins real normalized observations in the seeded demo
  and credential-specific snapshot/marshal errors that preserve their underlying causes.
  `internal/api/demo_export_test.go` checks scoped and previous-cycle examples from the
  generated handlers, the injected quota clock and preserved half-open usage bounds;
  calendar-day normalization must not erase quota usage ends. Runtime numeric
  measurements remain deterministic with both ordinary and `UseNumber` JSON decoders,
  without altering schema properties, seeded request latency or source-file sizes.
  Measurement classification includes the owner shape, not just a field name.
  Seeded creation/update metadata keeps its reference-clock timestamps.
  Runtime text stamps use the same minute
  precision as shifted numeric stamps, so response latency does not create dataset drift.
  `deploy/cloudflare/worker.test.mjs` verifies usage/reference bounds rebase together without
  changing amounts or basis. The demo freshness digest includes quota parsing, estimation,
  repository joins and observation seeding through `scripts/demo-inputs.mjs`.

### Request selection and export coverage

What an export may contain is a logic claim: `scripts/test-request-export.ts` builds the image's
sheet and the JSON document from records and asserts that a redacted account, key or request id
is absent from every string either would carry, alongside the selection rules (Shift runs,
page-scoped select-all, the row cap, the canvas ceiling). The `request-export` probe covers only
what needs a browser: a tick does not open the record, select-all reaches unmounted rows, the
header checkbox sits over the rows', the canvas is drawn and redrawn when a redaction changes,
and both formats download. `request-facet-marks` compares a provider option's mark with the mark on the rows it filters,
using a provider with artwork of its own so a mark resolved from the wrong key is a different
picture. `column-alignment` emulates a classic scrollbar so the header and the
rows are compared at the width a desktop gives them. At 600px it asserts that the
request-ID text is hidden and the visible copy control puts the full fixture ID on
the clipboard without opening the detail drawer. Clipboard permissions are scoped
to the probe origin, and completion waits on the copied value.

### Built request-record filter coverage

The built request-record filter flow explicitly selects a 50-record page in its
initial URL before asserting clear-all restores that page. The assertion must not
depend on asynchronous preference hydration or the console's default page size.

### Model Square

`scripts/test-model-square.ts` owns advertised-identity grouping, maker ordering, shared-name
fanout, search, the maker filter, the row's reference caption, openness classification,
manufacturer artwork, unknown profiles and encoded external reference links.
`scripts/test-model-square-ledger.ts` owns the join with the price book and the request
records: the call-name key, unlisted-means-unpriced, unknown versus zero when a neighbour is
unread or its facet list is full, and a request link the request list's own reader accepts.
Go tests beside `internal/operations/model_square.go`, `internal/api/model_square.go`,
`internal/cpa/management/client_model_definitions.go` and `internal/modelcatalog/catalog.go`
own route projection, server-side client-key authentication, secret-safe responses,
live authority through failed enrichment, native defaults/exclusions, fixed-channel
reads, API-owned response field allowlists, metadata matching (exact evidence, the enumerated
request-variant forms and their negative cases) and safe
weight/resource links. The snapshot generator's self-test checks that ambiguous source aliases and reseller costs are not retained.

The `model-square` probe owns vertically stacked manufacturer sections and their order, the
card's price and connection with no usage figure in the list, the mark-and-count form of
a model served by several connections, the several-column card
grid on a wide page and its single column on phones, click-to-copy of the call name without opening the details, the absence of a page-level
price-book banner, the "Set price" hand-off to the shared editor, the maker filter with its count and URL state,
the details' price and 24-hour figures and request-list link, wrapping names, model profile wiring,
stepping to the next model inside the Drawer, responsive detail geometry, reachable touch
targets and native Back dismissal. Its price book and request counts come from
`modelSquareLedgerFixtures`, kept apart from the directory fixture so `mobile-console` can
pair the directory with its own pricing and facet routes. `mobile-console` includes the populated directory fixture. Planner tests select
both for directory-source changes and retain the detail scenario for shared overlay
changes. Built acceptance waits for the populated `/model-square` directory and opens
a model to check its three lookup destinations. `scripts/fake-cpa.test.mjs` owns the
fixture's gateway/management authentication separation, live client-key rotation and
revocation, identity-only responses and configured model aliases/prefixes. Both demo
checks exercise `/model-square`; the Worker dataset captures the same safe live
directory and models.dev facts. New logic checks, the populated built-directory
assertion and the section geometry check are mutation-tested before delivery.

### OAuth model rules

`scripts/test-oauth-excluded-models.ts` owns normalization, exact/wildcard matching,
validation, catalog coverage and independent exact rules under wildcard coverage.
`scripts/test-oauth-model-alias.ts` pins the new mapping's retain-original default.
`web/tests/oauth-exclusion-guidance.component.test.tsx` mounts the real rule and
credential drawers with provider `*` and a non-empty credential override. It owns
the scoped introduction, alias/catch-all/deletion warnings, CPA v8.0.33 requirement and the clearing hint,
plus the empty-array safe-field PATCH that restores inheritance.
`TestOAuthExclusionCapabilityGuidanceExplainsCredentialPrecedence` checks the
registered Agent/MCP descriptions for the same scope and CPA authority.
Go tests beside the OAuth exclusion facade own provider replacement/deletion,
allowlisted catalog projection, request validation and refused readback. Audit fault
injection checks that a rejected attempt audit prevents the upstream write, while a
rejected success audit still returns the verified rules after the write has landed.
`scripts/fake-cpa.test.mjs` checks that provider exclusion updates and deletions stay
consistent across dedicated reads, JSON configuration and runtime/stored YAML snapshots.
It also owns global exact, wildcard and catch-all OAuth exclusions before alias mapping,
independent credential exclusions, unaffected static catalogs and API-key routes, and
restoration after clearing rules.
The `oauth-model-rules` probe owns provider tab names/artwork in the picker,
independent section drafts, section-only saves, trailing-edge close placement, native Back guards and 1440/375/320px
Drawer geometry. It also owns the alias table's row removal control: in view without sideways
scrolling at desktop width, and pinned in view on a phone while the fields scroll. Built auth-file acceptance owns both sections' verified
save/close/reopen/clear paths against fake CPA. The generated Worker dataset includes
provider-wide exclusions and static catalogs separately from credential fields.
Demo coverage requires both maps and each exported catalog; Worker tests pin
provider-specific catalog routing, unknown-catalog handling and mutation refusal.
Demo browser acceptance opens both rule sections and checks read-only controls.

### CPAMC management catch-up

`scripts/test-error-rules.ts`, `scripts/test-model-options.ts`,
`scripts/test-credential-policy.ts` and `scripts/test-vertex-import.ts` own pure
validation and request normalization. `scripts/test-log-lines.ts` owns method/path
matching, facet counts, wrapping preference parsing, the Escape decision, which
request ids are offered as a link, the viewed file's name and the preview limit.
Go tests beside the management facades own provider policy/model projections,
credential field readback, token-free manual refresh and Vertex multipart import.
`internal/quota/kimi_test.go` owns account-system selection and the international
endpoint boundary; Codex tests own plan labels and prepaid credit projection.

The existing `logs-sources` probe owns the disclosed gateway request filters,
method wiring, wrapping persistence and fullscreen portal/Escape ordering. It also
owns the log file viewer's browser claims: a request id opening its file without
unfolding the row, the panel stacking above the fullscreen viewer, a long body
wrapping inside it, Escape closing it before fullscreen, the retention wording for
a file CPA did not keep and an error log file read in place.
`web/tests/log-file-viewer.component.test.tsx` owns the viewer's states against the
real typed client - the route each target reads, retention versus a retryable
failure, the preview limit and no read while closed - and
`TestRequestLogByIDServesAuditsAndExplainsAbsence` owns id validation before CPA,
the audit record and the `request_log_not_found` answer. The
existing `oauth-management` probe owns credential-alias draft retention across
tabs, phone geometry, Vertex identity-only preview, region validation and key
selection clearing when reopened, including a held file read released after cancellation. Its screenshots use only synthetic fixture
identities; no live credential is imported. Both scenarios remain automatically
selected through their existing ownership and importer rules.

Credential mutation audit fault injection refuses the attempt before CPA is
called and preserves a successful refresh/import response when outcome auditing
fails after the upstream mutation. The gateway popup Escape probe also catches a
retained, painted leave node under reduced motion.

### Trusted native plugin-host contract

`internal/cpa/management/client_plugin_host_test.go` owns fixed-origin path validation,
credential separation, local refusal of wrong page credentials with no upstream request,
redirects, body bounds and native backup classification.
`internal/api/management_plugin_host_test.go` covers session/CSRF protection, invalid explicit
credentials that must cost the upstream no failed authentication, native config/group/model startup, namespaced state/sync, audit failure gates,
backup failures, native-write serialization and rebasing across base paths.
`internal/api/management_plugin_host_script_test.go` owns executable pathname adaptation,
lexical binding preservation, source-map comments and byte positions, script-data exclusion
and sanitized parse refusal.
`scripts/plugin-host-shim.test.mjs` exercises the embedded runtime shim across root and nested
base paths: omitted credentials on native/already-hosted URLs, isolation of unrelated and
external requests, Request body/header/signal overrides, live native path reads/writes and
history updates that keep the resource URL inside the console mount.
The fixture uses
an independent upstream server so version probing cannot hide caller authentication defects.
The existing built acceptance in `scripts/acceptance/configuration-plugins.mjs` exercises the
same generic startup chain via fetch, Request, XHR and EventSource, valid/invalid credentials,
Request POST body preservation on HTTP/1, omitted-credential startup, inline/external
provider self-identification from the resource pathname, bounded finite EventSource completion,
no duplicate rebasing and no host-provided key
in storage. The hosted-page check is shared with the full configuration acceptance flow
for focused regression diagnosis. The response observer separates only exact same-origin
native host API responses from ordinary DTO leak sweeps, while still checking native startup
bodies for the server management key and OAuth fixture credentials; unreadable native
response evidence fails the check, and all native response audits settle before the final
verdict, including error-path teardown after browser shutdown; rejected audit tasks remain
failed verdicts without bypassing owned fixture/process cleanup. Client/provider keys needed by native startup are permitted on that surface. `scripts/plugin-host-contract.test.mjs`
pins both policies, including ordinary APIs, resources, similar paths, external origins and
unexpected protected credentials as negative cases.
No additional runner or registration list is required. Changes to this built harness require
`pnpm verify:full`; live plugin smoke should use isolated synthetic configuration and avoid
billable evaluation calls.

### Independently isolated browser scenarios

The OAuth catalog separates workspace/layout, Vertex file lifecycle, model rules,
token capacity, authorization completion, scale/batched cancellation and plugin
connections into fresh contexts. System-information separates its primary surface,
version-feedback flow and health-anomaly states. Extracted scenarios retain the
original assertions and establish their own navigation/fixture preconditions; page
impact rules and negative planner cases select every affected subscenario. Timings
are per subscenario so slow flows can be balanced without shared state.
The token-capacity scenario also owns the credential list's column claim at 1440px: every
record starts each of its six columns where the list header does, which is what the shared
subgrid tracks exist to guarantee.

### External agent access coverage

The MCP tool definition is asserted in `internal/mcpbridge/bridge_test.go` over an in-memory
transport: the approval link on a pending result, refusal codes, error flags for `error` and
`uncertain`, and `omc_operation_status` waiting for a decision (the poll interval is shortened,
not slept). The same file keeps the stdio round trip and the bridge's transport refusals.
`internal/api/agent_mcp_test.go` drives the remote endpoint with the SDK's Streamable HTTP client:
a session cookie and a wrong key are refused, the catalogue omits the Agent-only capabilities, and
a caller cannot choose where its approval link points. The guide's snippets, endpoint and
plain-HTTP warning are pure functions asserted in `scripts/test-agent-workspace.ts`; the
`agent-external` probe opens an approval link's authorization screen, allows the operation,
retries a failed read in place, tells a missing operation and a malformed address apart from it, and
reads the guide and its client tiles in the Agent's drawer.

### Inline interactive component coverage

The existing `agent-views` probe owns tall-content growth and shrinkage without root scrollbars,
shared component corner geometry, local filtering over frozen rows and `OMC.compose` drafting
without sending. The existing `agent-stream` probe holds an argument stream to prove that the
inline preview appears before the tool call ends, model scripts and inline event handlers
remain inactive in the preview, and the completed sandboxed component keeps its framing. `internal/agent/display_test.go` owns
the new inline default, explicit card selection and framing validation;
`scripts/test-agent-workspace.ts` owns draft framing selection and bounded height messages.
`scripts/test-conversation-export.ts` also pins inline framing and conversation ground in HTML
exports while retaining historical card framing. These extend existing owners without adding a
runner, registration list or planner rule.

Agent demo readiness checks its visible welcome identity and content rather than the generic
page-title header. Demo acceptance then opens the capability drawer and requires a concrete
capability before closing it. `scripts/demo-readiness.test.mjs` pins the dedicated identity,
missing content and loading/hidden negative cases while retaining the ordinary-page heading
checks.

### Opt-in sorting measurements

`scripts/test-oauth-sort.ts` compares every OAuth workspace sort with the frozen
baseline oracle in `scripts/fixtures/oauth-sort.ts`, including empty/singleton inputs,
Unicode/numeric/equivalent labels, missing numeric defaults, stable ties, unknown-key
fallback and immutable input/record identity. These are logic claims; OAuth browser
scenarios retain responsive rows, filters, file actions, quota refresh and authorization
wiring. `scripts/benchmark-oauth-sort.ts` is opt-in, not discovered as a test. Run it
with `node --import tsx scripts/benchmark-oauth-sort.ts`;
it alternates both implementations on the same fixtures and reports warm median/p95
plus process/locale/resource metadata without timing thresholds in correctness gates.
Add `--expose-gc` for a separate post-GC retained-heap sample; GC never runs inside
the timed comparisons.


### Conversation presentation ownership

`scripts/test-conversation-labels.ts` owns status admission, Agent
failure keys, duration thresholds/rounding and the identity of compatibility exports.
The duration cases formerly in the Agent workspace suite move here without removing
assertions; page-specific stopped-turn/failure semantics remain there. The runtime
graph guard in `scripts/conversation-boundaries.test.mjs` forbids shared workspace
modules from importing page internals, with eager/lazy negative and erased-type cases
and nonempty real consumers. The existing Agent probes use `scripts/acceptance/probes/conversation-export.mjs` to
own actual downloads, standalone HTML/image rendering, controls, privacy, browser
encoding and responsive behavior. These claims live in the browser today; moving one to
a cheaper layer requires a replacement of equal strength (ADR 0089).


### Bounded probe scheduling

`pnpm check:ui` and `pnpm verify:probes` use at most two native workers for shared
scenarios. Both accept `--workers 1`; selection, assertions and budgets stay the same.
`pnpm verify:full:serial` chooses that serial path. Frame scenarios marked
`shouldRunAlone` (`scroll-smoothing`, `request-list-touch`) run in a subsequent
single-worker invocation even after a shared test fails, without trace instrumentation
(ADR 0095). Native collection and exact timing-evidence checks protect complete coverage.

### Demo replay and generated-UI exports

`scripts/test-demo-replay.ts` owns recording/event fidelity, localization/date templates,
refetch/reset state and cancellation; `internal/demo/demo_test.go` owns full-year synthetic
traffic, idle-day distribution and whole-UTC-date recent-traffic protection, including non-midnight
reference times and equivalent instants in other time zones. `scripts/check-demo.test.ts` owns
public recording privacy. `scripts/test-agent-workspace.ts` owns send admission: target-free
demo replay, required live targets, and approval blocking in both modes.
Built `scripts/verify-demo.mjs` sends the Agent example, whose replay must settle its generated
interface. The Agent example and
capability-directory actions use locale-independent identities; built acceptance exercises the
Agent in English while the other route headings remain Chinese. Because the generated interface
is an opaque sandbox, the check seeds theme storage only in frames with an origin and tolerates
Playwright's own service-worker probe there, bounded to four documents per recorded replay.
The existing heatmap probe owns newest-edge mobile scrolling and resize behavior.

`scripts/test-answer-layout.ts` pins reasoning/call timeline and inline figure grouping;
`scripts/test-conversation-export.ts` owns detached/redacted snapshots and HTML anatomy.
The existing `agent-stream` probe exports a generated component as standalone HTML and PNG:
it requires script-set content in the opaque sandbox and an exact fixture color in PNG
pixels, then checks temporary-frame cleanup. The common conversation-export helper retains
real download/controls/mobile checks. These claims stay in the browser until a
replacement of equal strength exists.

### README screenshot readiness

`scripts/readme-screenshot-readiness.test.mjs` pins the capture predicate: visible
page content, no visible loading surfaces, and no mounted toast (including its exit
motion), and the font predicate that waits for the deferred Sarasa shards (ADR 0094)
before capture. It is automatically discovered by `pnpm test:self`; it does not launch a
browser or certify pixels. `pnpm build && pnpm readme:screenshots` supplies the real
Chromium evidence and regenerates the English/Chinese desktop and mobile images
under `docs/images/readme/`. The dashboard combines light and dark captures in one
rounded window with an opaque angled bevel and a shadow on the light side. Feature
images each use one capture: request records and pricing are light; OAuth management
and AI providers are dark. All desktop images retain the rounded window frame.
README wordmarks follow the GitHub theme. The generator waits on that predicate rather
than a fixed delay, waits on it again immediately before capture, and leaves the
Demo's normal arrival feedback unchanged.
`scripts/readme-screenshots.test.mjs` checks single-capture frames and the paired
dashboard composition, and holds the final wait to pin late-toast
admission, timeout propagation, and context cleanup without launching Chromium;
the immediate-check implementation fails these cases. Image freshness remains
outside verification gates because the sample traffic is rebased to the capture
clock.

### Credential warmup verification

`internal/warmup` tests own calendar, explicit billing evidence, sliding/fixed boundaries,
cycle decisions and fixed adapter terminal responses. API tests exercise real CPA-facade
requests, persistent receipts, confirmed revisions, paid protection and uncertain/concurrent
execution. Handler regressions exercise first reset-driven and daily automatic attempts for
both Codex and Claude, with fresh or absent prior observations, changed-model history,
active-window projection, bounded pending confirmation and persistence of an unsupported-model
refusal across a non-consuming manual recheck and a rate-limited consuming recheck,
including legacy state reload, unchanged retry backoff and immediate or delayed activation
that clears the pause. A refused new request cannot overwrite the observed prior activation. Pure policy tests retain an
observed unsupported-response pause without treating missing activation history as a gate.
`scripts/acceptance/contracts/warmup.json` is certified by a Go handler test and
consumed by the actual typed client in `web/tests/warmup.contract.test.ts`. Rendered tests
own inheritance, draft controls and confirmed manual runs with secure-context UUIDs,
HTTP-compatible random bytes and absent browser crypto. The `oauth-window-warmup` browser
scenario owns the dedicated warmup tab, switch/label alignment in both rule editors,
viewport geometry, manual confirmation without `randomUUID`, and native Back discard
confirmation. It independently checks that
Drawer wrappers transition only transform normally and have no transition under reduced
motion, retaining the unchanged 320px containment assertion after resize in both preferences; adding a delay cannot satisfy the transition-property check.
All are discovered by the
existing runners. Real-account activation is explicitly consented manual acceptance,
never a hermetic test or automatic development step.

Warmup review regressions pin field-by-field run validation (including reordered or changed
refusal bodies), the typed client's emitted confirmation/revision, and credential/provider
fixture isolation. API tests inject pre-send credential/policy refusals and an observable
startup database failure with manually delivered ticks. Rendered tests cover both field-save
close paths with an externally owned draft, a draft flag changing during an in-flight save,
explicit protection facts, a single toast for each manual outcome and a durable last result
for sent requests. The browser warmup scenario also saves another section, retains
its draft and exercises the subsequent native discard decision. These extend existing
owners; no new runner, fixed wait or live consuming test is introduced.

## Console updates (ADR 0099)

The updater is tested against a Docker daemon it cannot tell from a real one.
`internal/updater/fake_daemon_test.go` is an in-memory Engine served over a real unix
socket, so the production client, its API-version negotiation and its wire format are
what run; `internal/updater/updater_test.go` owns replacement (including what is and is
not inherited from the old image), rollback and tag restoration, pinned and unidentified
targets, signature, repository and version checks, token derivation, self-replacement
and the job hand-off, the installer, and reconciliation after an interrupted job.
`internal/api/management_system_updater_test.go` owns the console side: each state a
missing updater reduces to, admission recorded before the updater is asked, refusal when
the audit write fails, and one outcome event across a restart.

The wire corpus is `scripts/acceptance/contracts/system-updater.json`, certified by
`TestSystemUpdaterSharedWireContract` and consumed by the typed client in
`web/tests/system-updater.contract.test.ts` and by
`scripts/acceptance/system-updater-fixture.mjs`, the mock every other layer answers
with. `web/tests/system-update.component.test.tsx` owns what a pure function cannot
observe: the question before the request, the card holding its state while the console
restarts under it, a result reported once - including a job the page has already given up
on and the updater names again - and giving up on an updater that forgot the job or
stopped answering. `scripts/test-system-versions.ts` owns the offer derivation.
The `system-information-narrow` scenario owns the update action's geometry beside the
version comparison at 320px in the longest catalog. Signing is covered by
`scripts/sign-release-manifest.test.mjs` and the release workflow's ordering invariants
by `scripts/release-plan.test.mjs`; `scripts/deployment.test.mjs` holds the Compose
service to its boundary (the socket and nothing else). Real container replacement is
exercised only by `scripts/docker-smoke.mjs`, described above.

### Pricing navigation readiness

Built acceptance retains the three-second pricing guard against the historical
multi-second render freeze. It observes the first visible row's edit action, not an
empty page container, using the browser's monotonic navigation clock. The readiness
sample is collected in the renderer; host-side protocol scheduling and completion of
unrelated load-event resources are not counted as rendering work. The threshold is
unchanged. Bundle loading boundaries and the 20-row page policy remain independent
regression guards; a loaded runner is not evidence of a hosted performance improvement.

### Credential-scoped SIWC binding

`internal/cpa/management/client_siwc_test.go` owns upstream summary decoding,
managed-ID binding requests, full callback preservation and conflict fidelity.
`internal/api/management_siwc_test.go` owns target resolution, callback scoping,
fail-closed mutation audits, safe readback, expiry, gateway isolation and secret
exclusion. `internal/operations/oauth_siwc_test.go` owns the Agent/MCP safe read
projection. `web/tests/siwc-binding.component.test.tsx` owns bind/rebind controls,
target-scoped async ownership across panel dismissal, callback submission and
outer-whitespace trimming with parameter fidelity, completion readback,
cancellation and read-failure/expiry outcomes. The existing
`oauth-authorization-outcomes` probe owns real-browser detail-panel wiring and
callback input persistence across close/reopen, pending-attempt navigation and
unload protection, and removal of those guards after confirmed completion.

### Vertex OpenAPI and SIWC local-policy contracts

`internal/api/management_vertex_alias_overrides_test.go` owns provider-wide and
credential alias explicit-false/true round trips, sibling edits, inheritance clearing,
family refusals and failed readback. `management_provider_vertex_openapi_test.go`
owns API-key/model projection, preservation of unmodelled fields and same-model
aliases, default/location clearing and family validation. `agent_vertex_openapi_test.go`
checks the real confirmed Agent/MCP adapter, revisioned provider edits,
non-Vertex execution refusals and alias-rename preservation.
`management_provider_model_matching_test.go` owns same-model route matching,
reordered sibling renames, explicit inheritance and ambiguous-rename refusal.
`management_siwc_status_test.go` owns the closed local-status enum, missing/unknown
state, session/credential route separation, exact Codex-only switch writes,
partition preservation, activation eligibility and disk/runtime readback. Existing SIWC lifecycle tests
retain their authorization and audit claims; Agent and management-client suites
also assert the safe summary.

`web/tests/vertex-model-openapi.component.test.tsx` renders both alias editors and
the real provider editor/hook/client, preserving explicit false through sibling edits
and clearing to inheritance. `siwc-binding.component.test.tsx` additionally owns
local-state copy, missing metadata, non-optimistic toggling and refused readback.
Existing browser scenarios retain drawer, navigation and responsive-layout ownership.
The quota subscription request-contract suite independently pins both User-Agents,
the daily subscription endpoint, endpoint-specific Accept headers and independent
quota windows on enrichment failure.
