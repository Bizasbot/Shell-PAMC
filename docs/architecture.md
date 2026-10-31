# Arquitectura de Shell-PAMC

Mapa de módulos, flujos de datos e invariantes que los mantienen unidos. El
vocabulario del dominio está en `CONTEXT.md`; las reglas visuales están en
`docs/design.md`; las decisiones detrás de la forma descrita abajo se registran
en `docs/adr/`.

## 1. Forma en tiempo de ejecución

```text
browser ──▶ direct listener, existing HTTPS ingress or Vite ──▶ Go process (one binary)
                                        ├─ chi router under the base path
                                        ├─ embedded React SPA (internal/web/dist)
                                        ├─ SQLite (WAL, one connection)
                                        ├─ usage collector  ──▶ CPA
                                        └─ pricing sync loop ──▶ openrouter.ai

Go process ──▶ CPA management API (/v8/management; CPA v8+) ──▶ upstream providers
Go process ──▶ CPA RESP usage channel
```

Un proceso, un archivo SQLite, una réplica de Shell-PAMC. El proceso de Go es
dueño del contrato de la ruta base: la SPA se sirve en `<base>/`, la API en
`<base>/api/v1` y los medios en `<base>/media`. Los recursos con hash del bundle
embebido se sirven desde `<base>/assets/` y los SVG de proveedores desde
`<base>/lobe-icons/`; las rutas desconocidas que no son de la API vuelven a la
carcasa de la SPA. El proxy debe preservar el prefijo en lugar de eliminarlo
(ADR 0001).

El bundle de React se compila en `internal/web/dist` y se embebe con
`go:embed`, por lo que un despliegue no depende de ningún CDN ni de archivos
estáticos externos. Todo lo que el navegador puede alcanzar es un endpoint JSON
escrito a mano; no existe un paso directo genérico hacia CPA.

La consola es instalable como aplicación web. El archivo
`web/public/manifest.webmanifest`, escrito a mano, se sirve en
`<base>/manifest.webmanifest` como `application/manifest+json`, y los íconos que
nombra se sirven desde `<base>/icons/`; esos íconos son renderizados de la marca
en `web/public/favicon.svg`; hay que volver a renderizarlos desde ese dibujo
cuando cambie. Toda URL dentro del manifiesto es relativa, y `start_url`, `scope`
y las fuentes de los íconos se resuelven contra la URL del manifiesto, de modo
que un único archivo versionado es correcto en la raíz del sitio, bajo
`/shell-pamc` y bajo una ruta base anidada, sin generación por despliegue. El
manifiesto no lleva `id`: un id relativo se resuelve contra el origen de
`start_url` y no contra la URL del manifiesto, así que `"./"` daría a cada punto
de montaje la misma identidad instalada; al omitirlo, la identidad es el
`start_url` resuelto, que es específico de cada montaje. El manifiesto y los
íconos se sirven con `Cache-Control: no-cache` porque sus nombres son estables y
no llevan hash de contenido (véase `internal/api/pwa.go`). No se registra ningún
service worker: la aplicación no añade caché sin conexión de respuestas de la API
ni de contenido del usuario, así que un bundle nuevo nunca queda retenido detrás
de uno antiguo y las reglas existentes de caché HTTP y de sesión no cambian. Por
tanto, la instalación requiere que el despliegue sea accesible, por HTTPS o
localhost según exija el navegador; `docs/install.md` cubre los pasos por
navegador.

### Distribución de binarios/imágenes y flujo de publicación

`Dockerfile` compila el frontend embebido en la plataforma del constructor,
compila Go de forma cruzada para la arquitectura de destino e inyecta
`internal/config.BuildVersion` a partir de la etiqueta de la versión. La imagen
final de Alpine se ejecuta como uid/gid `10001:10001` con `/data` como único
directorio persistente con escritura. Su propio `deploy/healthcheck.sh`
normaliza el prefijo mediante `deploy/base-path.sh`; `degraded` indica
disponibilidad del proceso, no conectividad con el gateway. La misma imagen es el
actualizador cuando su comando es `updater serve` (ADR 0099): entonces la sonda
consulta al actualizador, de modo que ese rol no necesita su propia comprobación
de salud, y ambos archivos Compose de publicación lo declaran como un segundo
servicio que es el único que monta el socket de Docker.

GitHub Container Registry distribuye `ghcr.io/bizasbot/shell-pamc` para amd64 y
arm64. El archivo Compose completo descarga CPA y Shell-PAMC con puertos de host
en loopback; el Compose solo de Shell-PAMC se conecta a una red externa nueva o
seleccionada explícitamente. Ninguno compila localmente ni instala un proxy.
`deploy/cpa.config.example.yaml` es exclusivamente para gateways nuevos; las
instalaciones existentes conservan su configuración, paneles y propiedad de la
recolección. Véase `docs/install.md`.

`.github/workflows/release.yml` valida una etiqueta de versión estable contra
ambas versiones de paquete, supera las compuertas de verificación completa y de
prueba de humo de la imagen empaquetada, publica las imágenes y compila y prueba
paquetes nativos en un trabajo separado de solo lectura. La publicación en GitHub
exige tanto el push de Docker como los activos nativos completos, cuyos hashes
SHA-256 se vuelven a comprobar tras la transferencia de artefactos. Luego publica
notas, archivos e instaladores en un borrador que solo se hace visible cuando
terminan las subidas, antes de promover Docker latest al digest inmutable. La
publicación y la promoción vuelven a comprobar el índice estable para que
reintentar una ejecución antigua no haga retroceder ninguno de los punteros
latest. Solo el trabajo de publicación tiene permiso de escritura en el
repositorio. `scripts/release-plan.mjs` impide que los backports hagan retroceder
latest. GitHub Releases sigue siendo la fuente de observaciones de versión;
Docker Hub distribuye imágenes y GitHub distribuye ejecutables nativos. Las
compilaciones nativas igualan la cobertura de CPA para Darwin/Windows/Linux/FreeBSD
amd64/arm64. Compilan la SPA una sola vez y después compilan de forma cruzada Go
sin CGO con la misma inyección de versión y con los datos de zonas IANA embebidos.
El paquete Linux del host, una vez extraído, se prueba con una prueba de humo; los
destinos foráneos son cobertura de compilación, no afirmaciones de ejecución
nativa en el destino. El ADR 0066 registra el contrato de los activos. El trabajo
de publicación también firma `release-manifest.json` (versión, repositorio de la
imagen y el digest multiplataforma enviado) con la clave Ed25519 de su secreto
`RELEASE_SIGNING_KEY`, después de verificar los activos nativos y antes de subir
nada; el trabajo falla cuando falta la clave o no coincide con
`internal/updater/release_public_key.txt`, que es la clave compilada en el
binario. `scripts/release-workflow.mjs` mantiene ese orden y el confinamiento del
secreto al trabajo de publicación como invariantes del flujo de trabajo.
`docs/releasing.md` registra el flujo de trabajo del mantenedor y el ADR 0056 el
orden de publicación y la identidad inmutable de la versión.

### El modo demo es el mismo proceso con el gateway reemplazado

`SHELLPAMC_DEMO_MODE=true` ejecuta este binario contra su propio fixture; véase
el §13. La forma anterior lo sigue describiendo, con dos bordes reemplazados y
uno añadido:

```text
browser ──▶ Go process (one binary, demo mode)
              ├─ chi router + the demo policy (internal/api/demo_policy.go)
              ├─ embedded React SPA
              ├─ SQLite (temporary, rebuilt on every boot)
              ├─ CPA management API ──▶ internal/demo's in-process fixture (loopback)
              └─ usage collector: not started; pricing sync: not started
```

No hay flecha hacia openrouter.ai ni hacia ningún proveedor, porque la demo no
inicia ni la sincronización de precios ni ningún bucle de captura, y el fixture
responde las lecturas de cuota desde su propio catálogo en lugar de reenviarlas.
Sí escucha: la consola se sirve en el puerto al que enruta la plataforma. Lo que
nunca hace es conectarse a algo que no sea su propio fixture.

## 2. Mapa de paquetes de Go

La dirección de dependencias es acíclica a nivel de paquete. `internal/usage`
(decodificación de payloads) e `internal/usage/ingest` (el bucle de captura) son
paquetes separados, de modo que `repository → usage` y `usage/ingest → repository`
no forman un ciclo de importación aunque el directorio `internal/usage` aparezca
en ambas direcciones.

| Paquete | Responsabilidad | Depende de |
| --- | --- | --- |
| `internal/config` | Análisis de entorno y valores por defecto; carga de `.env` | — |
| `internal/domain` | Entidades duraderas (`CPAInstance`, recursos) | — |
| `internal/crypto` | Envoltura AES-GCM para secretos en reposo | — |
| `internal/iconasset` | Validación de imágenes estáticas, decodificación acotada, verificación de MIME y reconstrucción de SVG con lista de XML permitido | — |
| `internal/fontasset` | Reconocimiento del contenedor de fuentes por firma, descripción de peso/estilo/familia a partir de `OS/2`, `fvar` y `name`, y el instalador de Google Fonts (análisis de la hoja de estilos, descarga de fragmentos confinada al host) | — |
| `internal/security` | Redacción, huellas HMAC con clave, máscaras de visualización | — |
| `internal/applog` | El registro del servicio Shell-PAMC: un handler de `slog` que copia cada registro que acepta el handler de stderr a un anillo en memoria acotado y redactado que lee la consola | `security` |
| `internal/auth` | Cookie de sesión de administrador: firmar, verificar, rotar | — |
| `internal/usage` | Decodifica los payloads de uso/error de CPA en eventos tipados | `security` |
| `internal/usage/resp` | Cliente RESP mínimo para el subconjunto subscribe/LPOP de CPA | — |
| `internal/pricing` | Obtención y decodificación de OpenRouter, coincidencia de modelos, cotizaciones por niveles (ventanas leídas en la zona horaria de facturación de cada nivel), servicio de sincronización, modos y multiplicadores de canal | — |
| `internal/modelcatalog` | Hechos de referencia canónicos de models.dev incluidos en el binario, alias de origen exactos y enlaces seguros a pesos/recursos para Model Square | — |
| `internal/cpa/management` | Cliente tipado de la API de gestión de CPA (`/v8/management`, tras la compuerta v8; las lecturas ordinarias de `/v0/management` en `client_v0.go`, más el Plugin Host nativo acotado del ADR 0067), conjuntos de cambios de configuración con el gancho de respaldo previo a la escritura, y envoltura del flujo RESP | `configyaml`, `internal/usage/resp` |
| `internal/cpa/gateway` | Cliente CPA de endpoint fijo para el Agent y Model Square: autenticación con clave de cliente, directorio de modelos, líneas SSE acotadas y ensamblado completo de llamadas a herramientas para el bucle del Agent | — |
| `internal/cpa/discovery` | Normaliza los recursos de CPA al modelo de identidad local | `management`, `crypto`, `domain`, `security` |
| `internal/cpa/configyaml` | La vista enmascarada de la configuración y la restauración de secretos por valor, la detección de archivos v8 y la edición de los ajustes del sistema de plugins | — |
| `internal/repository` | Esquema de SQLite, migraciones, consultas, invariantes transaccionales | `iconasset`, `fontasset`, `crypto`, `domain`, `pricing`, `security`, `usage` |
| `internal/usage/ingest` | Bucle del recolector, procesador de decodificación, plegado de hechos de uso y mantenimiento del ciclo de vida de los datos | `repository`, `management`, `security`, `usage` |
| `internal/quota` | Sondas de cuota por proveedor y normalización | `management` |
| `internal/release` | Observación de versiones publicadas: comparación de versiones, cliente del feed de publicaciones, el índice almacenado y el conteo de estrellas del proyecto para el enlace del encabezado | `repository` |
| `internal/updater` | El rol de actualizador del binario (`shell-pamc updater serve\|install\|healthcheck`, ADR 0099): un cliente de la API de Docker Engine sobre el socket unix, reemplazo de contenedores con reversión, verificación de manifiestos firmados, el servicio de control de dos solicitudes, el instalador de un solo comando y el cliente que usa la consola para alcanzarlo | `release` |
| `internal/demo` | El fixture de publicación: un sustituto de CPA en proceso, el historial sembrado y el estado de captura que renderiza la consola | `domain`, `pricing`, `quota`, `repository`, `security`, `usage`, `usage/ingest` |
| `internal/capability` | Declaraciones de capacidades del Agent, validación de JSON Schema, reglas de permisos/riesgo, almacén de operaciones pendientes, auditoría del ejecutor | `repository`, `crypto` |
| `internal/operations` | Operaciones de gestión compartidas (análisis de uso, solicitudes, proveedores, OAuth, cuota, claves, configuración, precios, sistema, directorio de modelos) usadas tanto por los handlers de la consola como por las capacidades | `capability`, `cpa/management`, `cpa/gateway`, `modelcatalog`, `pricing`, `quota`, `repository` |
| `internal/agent` | Runtime del Agent del lado del servidor: persistencia de conversaciones, el catálogo de herramientas que declara al modelo, el prompt de sistema por secciones, herramientas de visualización, bucle del modelo, reanudación | `capability`, `cpa/gateway`, `repository` |
| `internal/agui` | El protocolo de transmisión AG-UI 1.0 para ejecuciones del Agent: decodificación estricta de `RunAgentInput`, el traductor de eventos y el enmarcado SSE; no sabe nada de Shell-PAMC | — |
| `internal/mcpbridge` | Definición del servidor MCP sobre el registro de capacidades, su handler HTTP Streamable y el puente stdio sobre los endpoints HTTP de capacidades; sin lógica de negocio ni política de aprobación | `capability` |
| `internal/api` | Rutas, listas de campos permitidos de los DTO, revelaciones sensibles auditadas, escrituras de auditoría, la política de demo, endpoints de capacidades/Agent | todos los anteriores, `internal/web` |
| `internal/web` | `go:embed` de la SPA compilada, con una página de entrada de marcador de posición versionada para un binario compilado sin ella (ADR 0033) | — |
| `internal/app` | Cableado, bucles en segundo plano, apagado ordenado | todos los anteriores |

Dos reglas mantienen significativa la frontera:

- `internal/repository` es dueño de los límites de las transacciones. Todo lo que
  deba ser atómico con una escritura (bloqueo de costos, promoción de bandeja de
  entrada a evento, el plegado de hechos de uso y su punto de control) es un
  método del repositorio, no una secuencia de llamadas desde un servicio.
- `internal/api` es dueño de la lista de campos permitidos. Un campo nuevo en una
  respuesta es un cambio deliberado de DTO; de lo contrario fallan las pruebas de
  la lista permitida. Cada superficie de gestión declara su propia forma de
  respuesta (`ProviderItemDTO`, `QuotaItemDTO`, `PluginItemDTO`,
  `managementAuthFileResponse`, …) en lugar de reenviar el modelo de fachada en el
  que decodificó CPA, de modo que un campo añadido allí para la decodificación no
  pueda llegar a un llamador sin una decisión en esta frontera. La proyección de
  plugins es también donde se acota el texto del manifiesto
  (`management_plugin_projection.go`), porque ese texto llega desde un plugin
  instalado o un registro; además deriva el enlace al repositorio de cada entrada
  y si una entrada es de origen propio, de modo que ninguna superficie decida la
  confianza por su cuenta.

**Gestión de plugins** (ADR 0029, ADR 0038). `internal/api/management_plugins.go`
asigna a las rutas de plugins de CPA la lista de instalados con el interruptor
global, los campos de configuración declarados de cada plugin y su eliminación.
La consola no tiene tienda de plugins ni página de marketplace: no se ofrece
explorar ni instalar desde un registro (se eliminaron la interfaz de la tienda,
`/plugin-store` y las rutas de fachada de tienda/instalación). El interruptor por
plugin y el documento de ajustes son claves de la configuración: el interruptor se
escribe en `plugins.configs.<id>.enabled` y el documento de ajustes (pasado sin
proyectar porque su forma es la del plugin) se lee y se escribe en
`plugins.configs.<id>` mediante la API de configuración v8, bajo la compuerta de
escritura de proveedores y el mutex de configuración que mantiene un guardado de
configuración; una escritura para un plugin que no está instalado ni configurado
se rechaza como `plugin_not_found`. Los códigos de error de plugins de CPA
(`plugin_not_found`, `plugin_delete_requires_restart`,
`plugin_store_rate_limited`, …) se conservan en lugar de fundirse en el error
genérico de la fachada. Los ajustes propios del sistema de plugins -
`plugins.enabled`, `plugins.store-sources` y `plugins.store-auth` - no tienen una
ruta de plugin dedicada en CPA, así que
`internal/api/management_plugin_settings.go` los escribe como un conjunto de
cambios de configuración en sus rutas `plugins.*` (`configyaml.PluginSettingsEdit`),
bajo la compuerta de escritura de proveedores, el mutex de configuración y la
revisión que cargó la página, exactamente como un guardado de configuración.

El registro propio de Shell-PAMC es una entrada gestionada de esa lista y no una
configurada (`internal/api/management_plugin_source.go`, ADR 0104).
`internal/pluginregistry` compila la dirección publicada desde
`plugins/registry.json`; el servidor lee la preferencia
`omc_plugin_source_enabled` (activada por defecto) y mantiene
`plugins.store-sources` en concordancia con ella. Un guardado de ajustes de
plugins y ambas rutas de guardado de configuración agregan o quitan la dirección
bajo la compuerta y el mutex, y un guardado de configuración que la haya quitado
se repara dentro del propio alcance de bloqueo del guardado, de modo que la
revisión que informa ya la contiene. La pestaña de ajustes de plugins nombra la
fuente `Shell-PAMC` en lugar del host de la URL de CPA, como una línea fija.

La fachada preserva el campo de protocolo `supports_oauth` de CPA. CPA lo deriva
de la presencia de un proveedor de autenticación, así que la insignia de plugin
instalado nombra la capacidad **Auth provider** en lugar de afirmar un método de
inicio de sesión OAuth. No se aplica ninguna clasificación específica de plugin.
El selector de conexiones usa los nombres de plugin sin sufijo OAuth y rotula su
método como gestionado por el plugin. Cuando un plugin en ejecución registra una
página, su acción de conexión abre la primera página registrada a través del host
de plugins existente en lugar de iniciar OAuth. Los proveedores de autenticación
sin página conservan una solicitud de inicio de sesión explícita con texto neutro
respecto a la capacidad; solo una respuesta de inicio de sesión exitosa activa los
controles de dispositivo o de callback. Las etiquetas de flujo reconocidas de CPA
son la autoridad. Cuando la respuesta de un plugin omite la etiqueta o usa una
desconocida, un código de dispositivo identifica el flujo de dispositivo; de lo
contrario, una URL de inicio de sesión junto con el estado de sesión establece una
redirección. Las respuestas incompletas siguen siendo gestionadas por el plugin.
Los flujos declarados integrados conservan su alternativa de compatibilidad. No se
inicia ningún inicio de sesión para sondear la capacidad, y la pertenencia a la
colección de credenciales y los logotipos de plugins siguen siendo independientes
de las acciones de conexión.

**Host de plugins** (ADR 0067, que extiende el ADR 0060). `projectPluginPages`
lista páginas solo para plugins en ejecución y bajo su propio id de recurso.
`internal/api/management_plugin_host.go` las sirve tras la sesión de la consola
bajo `/api/v1/plugin-host/`. Los recursos usan `/v0/resource/plugins/<id>/...` sin
credenciales. Las llamadas de gestión usan `/v0/management/*` y
`/v8/management/*` del origen fijo de CPA, incluidas las rutas nativas del núcleo
y las rutas de plugins con espacio de nombres; el directorio de modelos es solo
`GET /v1/models`. Las llamadas de gestión alcanzan a CPA únicamente con la clave
de gestión del servidor almacenada. Una página que envía Authorization o
X-Management-Key, aunque esté vacía, tiene esa credencial leída con la precedencia
de CPA y comparada con la clave almacenada en `PluginRoute`; una discrepancia se
responde con `401` en la forma de protocolo de CPA antes de cualquier solicitud
upstream, respaldo o escritura (ADR 0069). CPA bloquea una dirección de cliente
tras repetidas autenticaciones de gestión fallidas y todas las páginas alojadas
comparten la dirección de este proceso, así que una credencial de página nunca le
corresponde contarla a CPA. Los modelos reciben solo la Authorization del
llamador. Las cookies y Set-Cookie nunca cruzan; no se siguen las redirecciones.
Las rutas limpiadas rechazan el recorrido de directorios, las barras invertidas y
los caracteres de control, y se rechazan los puentes `api-call` salientes de
ambas versiones. Las listas de campos permitidos de los DTO ordinarios de la
fachada permanecen sin cambios.

Las respuestas nativas pueden contener secretos de proveedores y de clientes.
Cada llamada a la API registra el intento y el resultado de `plugin.route_call`
solo con su superficie de API fija, método y estado; se omiten los sufijos de
ruta, las consultas, los cuerpos y los errores de transporte. Si falla la
auditoría del intento, se impide la ejecución upstream; si falla la auditoría del
resultado de una lectura, se retiene el cuerpo. Los rechazos de auditoría usan el
código de error existente `audit_write_failed`. Una escritura exitosa sigue siendo
exitosa cuando falla la auditoría del resultado. Las respuestas de la API usan
`no-store`. Las escrituras nativas se unen a `providerWriteGate`, validan la
autenticación del llamador antes de tomar la instantánea, mantienen la
configuración almacenada cifrada con la compuerta de respaldo existente y llaman a
`afterConfigWrite` en caso de éxito. La clasificación es conservadora para todas
las escrituras v8 y las escrituras v0 del núcleo; las acciones profundas ordinarias
de plugins no toman la compuerta de configuración. Las solicitudes nativas
conservan la semántica de última escritura de CPA en lugar de añadir campos de
revisión de Shell-PAMC al contrato externo de protocolo.

Las referencias HTML/CSS/JavaScript y las solicitudes de ejecución con fetch,
Request, XMLHttpRequest y EventSource se reubican para las mismas superficies. Los
cuerpos de Request reubicados se almacenan en búfer antes de hacer fetch, para que
reconstruir un Request no convierta un cuerpo JSON en una subida en streaming
incompatible con HTTP/1; se conservan el método, las cabeceras, las sobrescrituras
y la señal de cancelación. Las solicitudes del mismo origen hacia estas
superficies del host llevan la sesión de la consola incluso cuando un plugin usa
`credentials: 'omit'`; las cabeceras Authorization explícitas de gestión y de
cliente conservan sus reglas de validación existentes y separadas. Esto incluye
las URL reubicadas estáticamente y las que ya están alojadas; los orígenes
externos y las rutas no relacionadas conservan su modo de credenciales original.
`management_plugin_host_shim.js` está embebido en el binario de Go y se prueba
directamente en Node. El JavaScript ejecutable en línea y externo se analiza con
`tdewolff/parse`: el acceso directo a `location.pathname` (también mediante los
globales `window`, `self`, `globalThis` o `document`) usa una vista en vivo de la
ruta de recurso nativa de CPA. El adaptador de pathname reemplaza solo el token de
la propiedad coincidente por el accesor `_omcPath` de igual ancho en el Location
nativo; todos los demás bytes del script, los comentarios y las coordenadas del
source map se conservan en ese paso. La URL real del frame permanece bajo el
montaje de la consola; las URL de recursos nativos pasadas a history push/replace
también se reubican, de modo que quitar una clave de la cadena de consulta
mantenga funcionando los recursos relativos, las recargas y las cookies de sesión
acotadas. Los objetos enlazados localmente, los literales de cadena/regex y los
datos de script no ejecutables no se reescriben en cuanto a pathname. Los scripts
que necesiten adaptación deben analizarse correctamente; el rechazo devuelve
`502` con `code: plugin_adaptation_refused` y no expone fragmentos de código del
analizador. El frame del mismo origen opera con la autoridad del operador con
sesión iniciada; la instalación es la decisión de confianza. La demo rechaza todo
el host. Este árbol de rutas no ofrece inferencia de modelos ni un puente hacia
destinos arbitrarios.

### Runtime del Agent, registro de capacidades y el puente MCP

El Agent no es una segunda implementación de gestión. Cada capacidad a la que
puede llamar es una declaración en `internal/capability` cuyo handler llama a un
método compartido de `internal/operations`; los handlers HTTP de la consola llaman
a esos mismos métodos, de modo que las compuertas de escritura, las comprobaciones
de revisión y la relectura de CPA no pueden divergir entre los dos puntos de
entrada. `internal/agent` es dueño únicamente del bucle del modelo: construye el
prompt de sistema, el historial y los esquemas de herramientas, transmite la
respuesta del modelo, ejecuta cada llamada mediante `capability.Executor` y
persiste el resultado antes de continuar. Nunca toca directamente la base de
datos, el archivo de configuración ni el cliente de CPA, y la solicitud que envía
upstream se ensambla del lado del servidor: un cliente no puede inyectar
resultados de herramientas, aprobaciones ni historial.

`POST /agent/run` habla AG-UI 1.0 (ADR 0041). `internal/agui` decodifica un
`RunAgentInput` estricto - un mensaje de usuario o una lista `resume` que nombra
las interrupciones que continúa, nunca historial, estado ni resultados de
herramientas; la clave, el modelo, el esfuerzo, la revisión que la página vio por
última vez y, para un reintento o una edición, el turno más reciente que el
mensaje reemplaza (`replace_turn`, respetado solo cuando `isReplaceable` encuentra
el turno asentado y de solo lectura) como `forwardedProps`; y, cuando un comando
del compositor pidió una, la presentación de la respuesta (`present`: `ui` o
`text`, aceptando `canvas` heredado) como `forwardedProps`; el idioma de la
consola y su estilo de unidad de tokens (`console_language`,
`console_token_style`) como únicas entradas de `context` - e
`internal/api/agent_http.go` traduce los eventos del runtime, independientes del
transporte, al flujo. `RUN_STARTED` se envía solo una vez persistido el turno, así
que una ejecución rechazada antes de eso emite únicamente `RUN_ERROR` y la consola
devuelve el mensaje al compositor. Cada ronda del modelo es un paso; una llamada
de capacidad se anuncia (`TOOL_CALL_START`/`ARGS`/`END`) antes de ejecutarse y su
recibo la sigue como `TOOL_CALL_RESULT`; el razonamiento (`reasoning_content` o
`reasoning`) se transmite como mensajes de razonamiento y nunca entra en los
mensajes con los que se construyen las rondas posteriores. La ejecución termina
con un `STATE_SNAPSHOT` de la conversación proyectada para la consola y
`RUN_FINISHED`, cuyo resultado es `success` o `interrupt` con una interrupción por
cada operación en espera (`approval`, `question`, `secret` u `oauth`, nombrando la
llamada que la originó), o con `RUN_ERROR`; el uso de tokens viaja en el último
evento. Una reanudación debe nombrar exactamente las operaciones en espera, cada
una ya decidida en el endpoint de decisión (`confirmation_pending` en caso
contrario).

`internal/api/agent_projection.go` proyecta las lecturas de sesión y las
instantáneas finales en DTO explícitos para la consola: el historial del modelo
(`messages`) y las llamadas al modelo en cola (`pending`) permanecen del lado del
servidor. Para `database_query`, tanto el recibo transmitido como el rastro
almacenado omiten los `data` sin procesar y cualquier `view`, conservando el
estado, los diagnósticos, los argumentos y los tiempos. La proyección nunca muta
la conversación persistida: el bucle del modelo y las herramientas de
visualización siguen resolviendo el resultado completo de la consulta. El texto de
la respuesta y las vistas de visualización generadas explícitamente permanecen
visibles y pueden incluir datos seleccionados por el modelo.

El turno registra su salida como `parts` ordenadas - razonamiento, texto y
llamadas de capacidades, en orden de llegada, con una parte nueva por cada ronda
del modelo - además de sus rondas, el uso de tokens (sumado sobre las rondas, y
`context_tokens`, la entrada de la última ronda que informó una), cualquier
`suggestions` de seguimiento, la presentación que se le pidió y el
`agent.PROMPT_VERSION` con el que se ejecutó. El prompt de sistema se construye a
partir de secciones con nombre (identidad, enfoque, datos, seguridad, redacción,
presentación, contexto) en `internal/agent/prompt.go`, acotado por
`agent.MAX_PROMPT_BYTES` porque se reenvía en cada ronda. La sección de redacción
es lo que hace que una respuesta se lea como la consola que tiene al lado: las
cosas se llaman por sus nombres para mostrar, alias o etiqueta en lugar de por
identificadores, los campos se describen en lugar de citarse, y los números siguen
formas fijas - dígitos agrupados, conteos de tokens en el estilo de unidad del
operador (`TOKEN_STYLES`), USD, duraciones, porcentajes y horas en la zona del
despliegue. Los términos del dominio, las ventanas de análisis semiabiertas
compartidas y la identidad de solicitud configurada son explícitos; los alias de
modelo no certifican la identidad upstream. Los turnos asentados anteriores aportan
su pregunta, imágenes, conclusión y metadatos de procedencia acotados en orden
cronológico (`buildCompletedTurnMessages`, ADR 0078), sin reproducir SQL, HTML ni
transcripciones de reparación; un turno que falló o se detuvo también aporta, de
modo que las escrituras que ejecutó sigan siendo visibles para la siguiente
pregunta. Por cada turno completado siguen disponibles hasta ocho referencias de
conjuntos de datos y ocho resultados recientes de mutación/rechazo; las
referencias ya usadas por una visualización tienen prioridad. Los resultados
omitidos se informan, nunca se interpretan como escrituras exitosas. El turno
activo mantiene cada
mensaje y resultado del modelo. El runtime ni trunca las solicitudes a un presupuesto de contexto
estimado ni descarta turnos almacenados para cumplir un tope de tamaño de sesión; los límites reales
de contexto del proveedor aún pueden rechazar una solicitud. La inclusión de imágenes tiene su propia
política de las ocho más recientes, descrita más abajo.
La herramienta de visualización `render_ui` (`internal/agent/display.go`, ADR 0042, 0072, 0073, 0082) se ofrece
solo cuando el cliente la declara. `presentedTools` ofrece `render_ui` para las presentaciones `ui` (y la
heredada `canvas`), ninguna visualización para `text`, y mantiene `suggest_next` declarada en ambos casos.
Un canvas hace referencia a filas de un resultado de capacidad anterior mediante
`source {data_ref}` con `fields` de nivel superior; el runtime aporta metadatos `data_sources` acotados
y sin valores en mensajes privados del modelo (`internal/agent/data_sources.go`).
El formato heredado `source {call_id, path}` sigue aceptándose, con un id de llamada a herramienta y una ruta dentro de los datos del resultado.
Estos manejadores no otorgan acceso fuera de la conversación retenida. El servidor los resuelve y los comprueba, congela el conjunto de datos en el rastro de la llamada como su `view`, y devuelve
un recibo pequeño en lugar de las filas. Las llamadas de visualización nunca pasan por el ejecutor. `render_chart`, `render_table`, `render_view`
y `render_canvas` están retiradas (`RETIRED_DISPLAY_TOOLS`): un rastro almacenado que nombre alguna se sigue
leyendo como llamada de visualización, y nada nuevo puede llamarla ni referenciarla. `suggest_next` se
declara del mismo modo pero no es una llamada que haga el turno: `takeSuggestions` la quita de las
llamadas de una ronda, por lo que no tiene rastro, ni llamada a herramienta almacenada, ni otra ronda del modelo, y sus preguntas se
conservan en el turno solo cuando esa ronda lo termina. Los paneles `render_view` almacenados (ADR 0079) siguen
siendo legibles junto a los canvases almacenados (ADR 0072); las nuevas llamadas `render_ui` congelan el marcado del modelo
junto a las filas resueltas. Las nuevas llamadas usan por defecto componentes en línea y persisten `frame: none`,
lo que quita el marco de tarjeta sin cambiar el sandbox. `card` explícito sigue omitiéndose en el almacenamiento,
de modo que las vistas anteriores conservan su marco original (ADR 0087). `AgentMessage` excluye
las visualizaciones de la agrupación en cadena y `DisplayCall` dibuja la vista borrador o congelada en la
parte ordenada de la llamada; las visualizaciones fallidas siguen siendo filas de llamada de diagnóstico. El razonamiento usa el
`ReasoningBlock` compartido sin marco, siguiendo la última línea hasta que el lector se desplaza hacia arriba y plegándose al completarse.
Su ResizeObserver, propiedad del efecto, observa tanto el contenido Markdown sin límite como su viewport de desplazamiento,
de modo que las confirmaciones diferidas de Markdown y el reflujo permanecen anclados tras alcanzar el cuerpo en vivo su tope de altura.
Los callbacks de desplazamiento y de redimensionado comparten una comprobación de movimiento antes de corregir el final, así que una confirmación
de diseño no puede borrar un desplazamiento hacia atrás pendiente. Un contenido que se encoge ajusta el desplazamiento previo sin
confundir ese ajuste con una intención del lector. Las correcciones son instantáneas. Cerrar el desplegable en vivo
desconecta el observador, y reabrirlo continúa en el final. El desplegable del Agent
nombra el proceso de pensamiento, mientras que la fila de actividad separada es dueña de la fase en vivo y del tiempo transcurrido.
La consola construye el documento de un canvas en `web/src/agent/canvasDocument.ts` - la política de seguridad de contenido, las variables del tema,
las filas congeladas, luego el kit en `web/src/agent/canvasKit.ts` (`OMC.rows`, `OMC.fmt`, `OMC.chart`,
`OMC.table`, `OMC.diagram`, `OMC.icon` y `OMC.compose`, configurado con el estilo de tokens,
el idioma y la zona horaria del operador; `OMC.compose` solo redacta un borrador de mensaje del compositor; un gráfico se dibuja al
ancho de su marco entre 280px y 760px y de nuevo cuando ese ancho cambia, para que su texto conserve
su tamaño en un teléfono) antes del
marcado del modelo - y lo muestra en un marco `srcdoc` con sandbox solo de scripts.
Los borradores dibujan marcado parcial bajo una política de scripts nueva basada solo en nonce, que permite ejecutar únicamente el
bootstrap del host: ni los scripts del modelo ni los manejadores de eventos en línea se ejecutan hasta que el
componente completado reemplaza su vista previa. Las observaciones de altura se agrupan tras el redimensionado y la
mutación, creciendo o encogiéndose entre 48px y 16384px sin conservar el viewport anterior
como mínimo. `tools/CanvasView.tsx` puede proyectar la misma figura sobre el viewport mediante un portal, y la guarda como
imagen enviando una solicitud de captura que el kit responde con un SVG de su propio documento; `canvasImage`
valida esa respuesta antes de rasterizarla. `web/index.html` declara `frame-src 'self' blob:` para que ese marco no pueda navegar a otro sitio.
Los íconos de los paneles se resuelven contra `web/src/generated/lucideIcons.json`, generado por
`scripts/generate-lucide-icons.mjs` y cargado en el primer uso.

El espacio de trabajo sobre ese bucle es `web/src/pages/agent`, sobre el runtime `ExternalStore` de assistant-ui
y la carcasa compartida en `web/src/components/workspace`. Los archivos de texto adjuntos en el compositor se pliegan en el mensaje mediante `web/src/pages/agent/attachments.ts` (ADR 0074), de modo que el servidor los almacena y reanuda como parte de la única cadena que ya conserva. La lista `/` del compositor se construye en `AgentPage.tsx` a partir de lo que la página puede hacer en ese momento;
`/ui` y `/text` retienen una presentación hasta que el siguiente mensaje la toma (`takeSendOptions`). La capa de ejecución sin framework es
`web/src/agent/`: el constructor de solicitudes y el analizador de eventos (`protocol.ts`), el lector SSE seguro frente a fragmentos
(`sse.ts`), el transporte (`transport.ts`), un reductor puro que pliega los eventos en las partes que el
servidor almacena (`runReducer.ts`) y las exportaciones (`export.ts`). `useAgentRun.ts` conduce una ejecución y
publica su marco con una cadencia de 40ms; `thread.ts` convierte la conversación almacenada y el marco en vivo
en mensajes del hilo; `runtime.ts` es el único módulo que conoce la API de runtime de assistant-ui, y
encamina cada acción del framework - enviar, detener, aprobar, responder - de vuelta al código de Shell-PAMC. Un mensaje enviado
durante una ejecución espera en una cola detrás de ella. Las llamadas de capacidades se renderizan mediante un toolkit de
entradas `backend` solo de renderizado (`tools/registry.tsx`) entregado al proveedor del runtime: un desplegable por llamada (`tools/CapabilityCall.tsx`), unido en una línea de tiempo plegable, cada uno abriendo sus argumentos y el recibo
que recibió el modelo bajo su propia fila (ADR 0084); las llamadas de visualización se renderizan como un
panel o un canvas dentro de la respuesta. Una operación preparada se decide en una tarjeta bajo
la llamada que la originó (`interrupts/ApprovalCard.tsx`, ADR 0043), y una llamada `ask_question` se
responde en un panel que ocupa el lugar del compositor (`interrupts/QuestionPanel.tsx`); decidir
cualquiera de las dos reanuda la ejecución (ADR 0035). Una conversación se exporta como página HTML autocontenida, imagen PNG o JSON, una respuesta como HTML,
y un canvas como HTML o PNG (véase «Exportaciones de conversación» más abajo). Las reglas de presentación - vocabulario de estados,
texto de fallos, resúmenes de argumentos, vista previa de cambios - son funciones puras en `state.ts`,
`thread.ts` y `web/src/agent/`, lo que permite a `scripts/test-agent-workspace.ts` verificarlas
sin un navegador.

No hay indicador de consentimiento: la página indica adónde van los datos (ADR 0027). Restablecer una conversación
conserva su clave, modelo y esfuerzo. El propio selector es la preferencia `agent_target`, de modo que una elección
hecha antes de enviar nada sobrevive a una recarga; una conversación que espera una aprobación restaura su
propio destino, porque solo ese destino puede reanudarla.

`internal/capability.Executor` es la compuerta de autoridad. Las lecturas se ejecutan de inmediato; una
capacidad marcada como de alto riesgo devuelve una operación pendiente generada por el servidor con una
vista previa estructurada y la revisión de destino; la aprobación es una única decisión de permitir o denegar tomada solo
en el navegador y se revalida contra la versión de la capacidad, la autoridad del llamador y la revisión
actual mientras se mantiene la compuerta de escritura. Una escritura no verificada o interrumpida se informa
como `uncertain` en lugar de reintentarse. Los secretos y la autorización OAuth nunca entran en los argumentos de herramientas
ni en resultados visibles para el modelo: la consola los envía directamente al aprobar la
operación. `ask_question`, que registra `internal/agent`, usa la misma ruta de operación pendiente
con una entrada `answer` y es la única capacidad que pertenece a la conversación y no
a `internal/operations`.

`database_schema` y `database_query` leen la propia base de datos de Shell-PAMC a través de un segundo pool de SQLite de solo lectura
que `internal/repository` abre en el primer uso (`mode=ro`, `query_only`, sin bases de datos
adjuntas). Su URI de archivo absoluta escapada conserva las letras de unidad de Windows en la ruta
(`file:///C:/...`), con los caracteres reservados de nombres de archivo escapados y los ajustes de
conexión sin cambios. El repositorio comprueba el programa `EXPLAIN` compilado de cada sentencia contra una clasificación de tablas y
columnas antes de ejecutarla, y acota y enmascara lo que devuelve (ADR 0036,
`docs/agent-capabilities.md`).

Los agentes externos usan el mismo registro mediante MCP (ADR 0070). `mcpbridge.NewServer` declara
una herramienta por cada capacidad ofrecida al adaptador `mcp`, más `omc_operation_status`, a partir de un
`Backend`, y dos transportes sirven esa única definición:

- `POST <base>/api/mcp` (`serveMCP` en `internal/api/agent_mcp.go`) es HTTP Streamable en
  el proceso de la consola. Su backend llama directamente a `capability.Executor`. La ruta queda
  fuera de `/api/v1` y de su middleware de sesión: acepta la clave de gestión solo como token
  bearer, gasta el límite de intentos de inicio de sesión ante una incorrecta, no tiene estado, usa respuestas
  JSON simples y la política de demo la rechaza.
- `shell-pamc mcp` es un proceso stdio cuyo backend reenvía a los endpoints de `/api/v1/capabilities`
  con la misma credencial bearer. El subcomando se despacha antes de la inicialización de configuración, base de datos
  y cliente de CPA, así que no abre ningún directorio de datos.
  Las URL que no sean loopback deben usar HTTPS, se rechazan las redirecciones, las respuestas están acotadas y solo se
  repiten al agente los códigos de rechazo propios de Shell-PAMC.

Ninguno puede aprobar operaciones, enviar secretos ni completar OAuth. Una operación preparada
devuelve su id y un enlace a `<console>/authorize/<id>`. Esa ruta es
`web/src/pages/agent/AuthorizePage.tsx`, la única ruta de la consola fuera de `AppLayout`: una
pantalla de consentimiento en la columna de la página de inicio de sesión (clases `auth-*`), tras el mismo
`AuthGate`, que nombra al solicitante, el despliegue y la capacidad y lleva la tarjeta de
aprobación en su variante `consent`, enviando al mismo endpoint de decisión que las aprobaciones del
Agent integrado. La acción Connect de la página del Agent abre
`web/src/pages/agent/ExternalAgentGuide.tsx` en un panel lateral, mostrando el endpoint del despliegue
y la configuración por cliente construida por `web/src/pages/agent/connect.ts`.

#### Qué gasta el bucle del modelo, y dónde

Las ejecuciones del Agent no tienen tope a nivel de aplicación de tokens, rondas, llamadas, cantidad de visualizaciones ni duración
(ADR 0083).
La cancelación se comprueba entre llamadas al modelo y llamadas a capacidades. El proveedor es dueño de sus límites reales de
contexto y de salida; la ventana de contexto de referencia es una lectura del compositor, no una compuerta de
dimensionado de solicitudes de Shell-PAMC. La salud del transporte sigue acotada: el gateway espera como máximo 120 segundos
las cabeceras de respuesta y cancela un flujo del Agent tras 120 segundos sin bytes recibidos;
las líneas SSE individuales siguen limitadas a 1 MiB. La validación de payloads y los límites de seguridad de las capacidades
siguen siendo independientes:

| Frontera | Límite | Cuenta |
| --- | --- | --- |
| `agent.MAX_MESSAGE_BYTES` | 48 KiB | Un mensaje del operador, incluidos los archivos de texto adjuntos (ADR 0074) |
| Imágenes adjuntas | Cuatro por mensaje, 5 MiB cada una; las ocho más recientes se incluyen en una solicitud al modelo | Contenido de imagen validado (ADR 0075) |
| Regresión del catálogo de herramientas | 64 KiB | `TestAgentCatalogueFitsTheSchemaBudget` comprueba la compacidad de las declaraciones; no es una compuerta de rechazo en tiempo de ejecución |
| `agent.MAX_PROMPT_BYTES` | 6 KiB | Presupuesto de regresión del prompt de sistema, incluidos los metadatos dinámicos |

Tres propiedades se cumplen a lo largo del bucle:

- **El catálogo de herramientas se declara desde la primera ronda.** Cada capacidad registrada
  llega al modelo en la ronda uno con su descripción y esquema inferido. El descubrimiento no es
  un paso: diferir el catálogo tras una búsqueda cuesta un viaje de ida y vuelta completo al modelo por acción,
  y hace que una solicitud que el agente no puede atender parezca una capacidad que no posee.
- **Una huella se resuelve una vez por turno.** La resolución lee la lista de claves de cliente de CPA; el
  turno conserva el cliente resultante en un mapa por turno, porque el destino de la conversación
  no puede cambiar dentro de un turno. La consola también guarda en caché en memoria, durante una ventana corta, la unión de
  huella y clave (`agentState.catalog`), lo que evita que una llamada a `providers_list`
  vuelva a leer una lista que CPA está mutando de forma concurrente; la caché se descarta en la misma
  pasada de mantenimiento perezoso que purga los documentos caducados.
- **El historial completado se resume, no se expulsa.** Cada turno asentado aporta contexto previo al modelo,
  en orden cronológico, como conclusiones y metadatos acotados. Eso incluye un turno que
  falló, se detuvo o se halló obsoleto: las escrituras que ejecutó antes de terminar son hechos que la siguiente
  pregunta tiene que ver. La transcripción almacenada y los intercambios del turno activo siguen siendo la referencia autorizada.
- **Un intento de inferencia fallido se reintenta como máximo tres veces.** `agent.UPSTREAM_RETRIES`
  acota el bucle; cada reintento primero revierte el texto transmitido y las partes del turno al
  punto de control del que partió, y luego emite `omc.upstream_retry` (un evento `CUSTOM` de AG-UI que lleva
  el intento y las partes autorizadas) para que la consola no dibuje ningún borrador descartado. Los rechazos
  deterministas - desbordamiento de contexto, solicitudes sobredimensionadas o inválidas, imágenes, un modelo ausente o no autorizado,
  parámetros no admitidos, llamadas a herramientas sobredimensionadas, una respuesta que el proveedor terminó antes de `stop`,
  los estados 4xx sin clasificar, además de los conflictos y rechazos locales - se informan sin reintento,
  porque repetir gastaría generaciones de pago para llegar a la misma respuesta; un 5xx sin clasificar es una
  caída y no un veredicto sobre la solicitud, así que conserva sus reintentos. Un marco de error de flujo se lee
  de la misma manera una vez enviada ya la línea de estado, según las palabras del propio marco: uno que nombra
  una falla transitoria (un error de servidor, una sobrecarga, un límite de tasa) conserva sus reintentos, mientras que uno que
  nombra un rechazo o no nombra nada que este gateway conozca se informa como `upstream_stream_rejected` en
  el primer intento. El fallo lleva el código de vocabulario cerrado, el estado upstream cuando lo
  hubo, el parámetro que nombró y si se agotó el límite de intentos.

La última sesión del Agent, las imágenes y las operaciones pendientes o terminales viven en `agent_documents`
(migraciones 026 y 036), cifradas con `SHELLPAMC_MASTER_KEY`. Las sesiones están exentas del
límite de documento de 8 MiB del repositorio y permanecen hasta el restablecimiento o el reemplazo explícito de un turno; las operaciones
terminales se conservan 7 días. La admisión de imágenes es dueña solo de las filas que acaba de guardar: los fallos de validación,
de almacenamiento de imágenes o del guardado inicial de la sesión intentan eliminar esas filas con un contexto de limpieza desacoplado de
cinco segundos. Las imágenes reutilizadas y las referenciadas por una sesión aceptada sobreviven a
fallos posteriores. Un restablecimiento confirmado elimina las imágenes de los turnos que descartó en el mismo contexto
desacoplado, de modo que un cliente que se desconecta tras el guardado no pueda cancelar una eliminación que la nueva transcripción
ya debe. Es una limpieza de mejor esfuerzo, no una transacción entre las escrituras de imágenes y de sesión.
La purga de documentos caducados es perezosa durante las solicitudes del Agent, sin un bucle adicional en segundo plano.
Por tanto, las conversaciones largas incrementan los costos de base de datos, memoria y solicitudes; véase `docs/operations.md`.

### Brechas de cobertura conocidas

- La suite del navegador tenía un historial de fallos intermitentes sensibles al tiempo en la sección de filtros de
  eventos de uso, ajenos a la ruta de escritura de proveedores: `the list is back to the
  unfiltered page` y `the queued search still lands` fallaron cada uno una vez en ejecuciones
  repetidas antes de extraer de la página las políticas de la vista de solicitudes. Se corrigieron
  en lugar de tolerarse - véase el §12.3 - y el diagnóstico se confirmó reproduciéndolos
  en el commit base sin modificar, dos ejecuciones de cada tres, bajo una restricción
  de 2 CPU. La suite ahora pasa ocho pruebas consecutivas en la configuración en la que
  falló la base, incluso con las sondas ejecutándose de forma concurrente.
- La regresión de actualización perdida es la prueba de Go, no la comprobación del navegador. El entrelazado
  que pierde una escritura depende de que dos solicitudes se solapen en CPA, y una ejecución del navegador
  no puede forzarlo: quitar la compuerta aún producía una ejecución verde del navegador, porque
  la primera escritura aterrizó antes de la segunda lectura. Por tanto, la comprobación del navegador
  verifica solo el resultado visible para el operador, y
  `TestConcurrentProviderTogglesDoNotLoseAWrite` (que controla el orden en
  el gateway falso) es la comprobación que falla cuando se quita la compuerta.
- La protección contra lecturas de lista obsoletas (una lectura emitida antes de una confirmación se descarta
  en lugar de publicarse sobre ella) está razonada e implementada pero no tiene ninguna comprobación
  automatizada: la lectura de la lista de la consola y la lectura interna de un interruptor son el mismo endpoint
  de CPA, así que un fixture no puede retrasar una sin retrasar la otra, y el
  orden aún no puede producirse de forma determinista. Por tanto, la suite del navegador
  cubre las rutas de interruptores concurrentes y de ráfaga rápida, no esta.
- El rechazo `503 write_busy` se cubre donde se decide (la prueba de la compuerta en
  `internal/api` y la prueba de clasificación de reintentos del controlador), pero no
  de extremo a extremo: producirlo en el navegador exige mantener la compuerta abierta desde fuera
  de la página, algo que el fixture no puede expresar. Su mensaje visible para el usuario lo comprueban
  solo `pnpm check-i18n` y la comprobación de tipos.
- `isRetryableWriteFailure` en `web/src/api/client.ts` es el clasificador del que dependen los
  reintentos del interruptor, y no tiene pruebas unitarias directas: el módulo
  importa todo el grafo de tipos de la aplicación (una de sus importaciones solo de tipos es
  irresoluble bajo el cargador del ejecutor de pruebas), así que el arnés no puede importarlo.
  Su comportamiento se ejercita solo mediante el propio predicado de las pruebas del controlador,
  que lo replica. Moverlo a un módulo sin importaciones de la aplicación lo haría
  comprobable.

### Los recursos acotados a un efecto deben sobrevivir a un remontaje de StrictMode

React ejecuta montar, desmontar y montar de nuevo para cada componente bajo `React.StrictMode`
en una compilación de **desarrollo**. `web/src/main.tsx` habilita StrictMode, así que todo recurso que un
hook posee tiene que crearse donde se crea el efecto que lo posee, y su
limpieza tiene que liberar el recurso en lugar de dejar instalado uno ya descartado.

Un recurso creado durante el renderizado y descartado en la limpieza de un efecto es descartado por
el desmontaje simulado y luego reinstalado por el remontaje, de modo que los consumidores conservan un objeto
muerto. Ese fallo es silencioso y unilateral: las operaciones sobre él se vuelven no-ops, así que un
control sigue animándose mientras no se envía nada, y todas las comprobaciones del bundle de producción
pasan porque las comprobaciones de StrictMode no se ejecutan en una compilación de producción. Llegó a
un usuario como «el interruptor del proveedor ya no cambia» en el servidor de desarrollo mientras la suite
determinista del navegador estaba en verde.

`web/src/hooks/disposableSlot.ts` implementa la regla (la preparación construye e instala,
el desmontaje descarta y libera, una preparación que reemplaza descarta lo que reemplaza) y
`scripts/test-provider-toggle-queue.ts` ejercita directamente la secuencia montar/desmontar/remontar.
Al añadir un hook que posea un recurso descartable, use el slot en lugar de
una ref que se descarta en el sitio.

### Compuerta de escritura de la configuración de proveedores

`internal/api` serializa toda escritura de configuración de proveedores de lista completa a través de
una compuerta única de todo el proceso (`management_provider_writes.go`): el interruptor de estado, las
rutas de crear/actualizar/eliminar proveedores y el escritor de la fuente de configuración, que
reemplaza el mismo documento.

Esto es un invariante de corrección y no una decisión de rendimiento. CPA no expone ninguna
escritura por entrada para una familia de proveedores, así que un cambio significa leer la
lista de esa familia, editarla y volver a escribir la lista completa. Dos escrituras de ese tipo que se solapan
leen la misma base y la posterior descarta la anterior, lo que pierde un
cambio que ambas solicitudes informaron como exitoso. La cola de última intención por proveedor en el navegador
no puede cerrar esa ventana: ejecuta deliberadamente en paralelo las escrituras de
proveedores distintos, y esas son justamente las escrituras que colisionan
sobre la lista de una familia. La comprobación de revisión en la ruta de la fuente de configuración
detecta un cambio que ya aterrizó pero no uno que aterrice entre su lectura y su
escritura, razón por la cual esa ruta toma la misma compuerta.

Propiedades que deben preservarse al cambiar este código:

- La lectura ocurre dentro de la compuerta, junto con la escritura. Adquirirla solo
  alrededor de la escritura mantiene una instantánea obsoleta y reproduce la actualización perdida.
- El permiso es una única ranura, por lo que el ayudante que realiza el leer-modificar-escribir
  no debe llamarse mientras ya se mantiene; el reingreso produce un interbloqueo contra la
  propia adquisición del llamador y se manifiesta como un rechazo por ocupado.
- La adquisición está acotada y es cancelable. A un llamador que no puede entrar se le responde
  `503` con `code: write_busy` y sin que haya empezado ninguna escritura al gateway, lo que
  hace seguro que el cliente repita el rechazo.
- El permiso se libera en toda ruta de salida, incluido un pánico en los callbacks.
- La compuerta es local al proceso. Ordena las escrituras propias de esta consola; no puede ordenar
  las escrituras hechas a CPA por otro cliente, y no hace que el orden de los clics sea
  autoritativo entre clientes.
- Un proveedor se direcciona por su posición en la familia, de modo que una escritura lleva la
  identidad que vio el operador (`expected_auth_index`, o `expected_name` para la
  familia sin índice de autenticación) y el handler rechaza la escritura cuando la entrada
  en esa posición ya no es esa. Un reintento repite la posición, y las posiciones
  se desplazan cuando se elimina un proveedor; sin esta comprobación un reintento alternaría
  un proveedor distinto e informaría éxito. La precondición es opcional, así que un
  llamador sin identidad que enviar sigue funcionando, y una discrepancia responde `409`
  en lugar de escribir.
- El nombre, el sitio web y el ícono que el operador da a un proveedor se almacenan bajo el
  mismo id posicional (`provider_names`, `provider_websites`, `provider_icons`).
  Por tanto, una eliminación reasigna la clave de cada entrada posterior de esa familia
  (`shiftPositionalProviderIDs`), porque de lo contrario el nombre dado a una
  credencial reetiquetaría a la credencial que tomara el índice liberado, y la marca de la
  fila eliminada reaparecería en ella. La superposición de íconos la escribe
  la consola mediante la API de preferencias y no un guardado de proveedor, así que
  el servidor reasigna las claves del documento almacenado y la consola reproduce el mismo
  desplazamiento en su caché local - una caché que conservara la clave eliminada la
  volvería a escribir en el siguiente cambio de ícono. Las superposiciones de nombre y sitio web de una actualización se
  escriben en la propia escritura con compuerta, después de que el gateway aceptó la actualización y
  antes de liberar el permiso de escritura. La fila, la etiqueta de proveedor de la lista de solicitudes
  y el resolvedor de nombres leen estos mapas, así que una entrada registrada antes de una
  escritura rechazada dejaría a la consola nombrando una credencial que CPA nunca aceptó; registrarla
  después del permiso permitiría que dos actualizaciones aceptadas invirtieran su orden de superposición.
  Si la escritura local de la superposición falla después de que CPA aceptó la lista, la compuerta responde
  `500` con `code: provider_commit_partial` en lugar de informar éxito. La
  escritura de la superposición toma un contexto corto desacoplado de la solicitud del cliente, porque un
  cliente desconectado no debe abandonar la mitad local de una escritura aceptada. El
  rechazo deliberadamente no es una instrucción de reintento: una creación puede haber agregado ya
  su fila, así que el cliente debe recargar antes de decidir qué hacer a continuación.
  Una confirmación parcial notifica al gestor de precios antes de devolver el rechazo,
  porque el catálogo de modelos de CPA puede haber cambiado ya aunque la transacción de metadatos
  de la consola no lo hiciera.
  Los valores de ícono los redacta la consola mediante la API de preferencias; un guardado de proveedor
  nunca los establece. Una eliminación es la excepción a esa división de autoría: reasigna la clave del
  ícono almacenado junto con los mapas de nombre y sitio web en la misma transacción
  de metadatos con compuerta.

### La base de CPA v8

Shell-PAMC requiere CPA v8.0.0 o posterior (ADR 0034, que reemplaza al ADR 0028; la correspondencia y
las mediciones están en `docs/cpa-v8-compat.md`). El cliente de gestión direcciona
`/v8/management` para toda operación y nunca sigue una redirección: la clave de gestión
viaja en cada solicitud, así que una redirección se devuelve al llamador como la respuesta que es
en lugar de reproducirse hacia donde apunte el gateway. Que un gateway lo sirva se observa, nunca se
infiere de una cadena de versión: `Client.SupportsManagementV8` lee
`/v8/management/config/config-version` y exige el valor `8`; cuando esa ruta
falta, `/v0/management/debug` distingue a un gateway más antiguo (`unsupported`) de uno cuya
API de gestión está deshabilitada por no tener secreto de gestión (`disabled`). La respuesta
se guarda en caché por URL base (`API_SUPPORT_TTL` para v8, el más corto `API_UNSUPPORTED_TTL`
en caso contrario) y se descarta cuando una ruta v8 responde «no existe»; una sonda sin respuesta detiene
el reintento de sondeo de la compuerta durante `API_UNDECIDED_TTL`. Toda solicitud pasa por esa compuerta
(`requireManagementV8` en `internal/cpa/management/v8_gate.go`): frente a un gateway que
respondió «no es v8» devuelve `ErrManagementV8Required` sin enviar nada, error que
la capa de la API informa como `cpa_v8_required`, y frente a uno `disabled`
`ErrManagementDisabled` (`cpa_management_disabled`). `/api/healthz` lleva la respuesta de la compuerta
como `cpa_management_api`, y la carcasa de la consola reemplaza cada página con guía de actualización
mientras lee `unsupported` (`CpaUpgradeRequired`), o con el ajuste del
secreto de gestión mientras lee `disabled` (`CpaManagementDisabled`).

Fuera de la excepción del Plugin Host de confianza (ADR 0067), `/v0/management` se direcciona
mediante `internal/cpa/management/client_v0.go` solo para lecturas: las listas de credenciales por familia, que son las únicas que llevan el
`auth-index` de cada clave upstream, y el archivo de configuración tal como está almacenado (`StoredConfigYAML`), que solo v0
devuelve. Toda escritura ordinaria de configuración de la fachada pasa por la API de configuración v8
(ADR 0037, ADR 0038). Las páginas de plugins de confianza preservan los contratos de escritura nativos v0/v8 con
respaldos previos a la escritura y serialización (ADR 0067).

### Edición de la configuración en la API de configuración v8

Los editores de configuración leen y escriben solo el diseño v8 (ADR 0037).
`GET /management/config` devuelve el renderizado v8 de CPA (`GET /v8/management/config.yaml`)
con los secretos enmascarados (`configyaml.SanitizeSafeYAML`), su revisión (el SHA-256 de ese
renderizado) y si el archivo almacenado sigue siendo uno anterior a v8 (`stored_layout`). El
editor visual y la página de Claves comparan su borrador con el documento que cargaron
(`web/src/components/config/configPatch.ts`) y envían `PATCH /management/config` con
las rutas modificadas; la vista de código fuente envía el renderizado completo a
`PUT /management/config/source`. Ambos guardados toman la compuerta de escritura de proveedores y el
mutex de configuración, rechazan una revisión que se movió (`409 config_conflict`), restauran los secretos
enmascarados desde el documento almacenado y responden con el nuevo renderizado de CPA, que se convierte en la
base del editor. Una escritura de auditoría de éxito fallida se registra pero el guardado igualmente devuelve
`200` con esa base, porque la escritura de configuración ya aterrizó; si la
relectura falla, la respuesta omite la base para que el editor recargue.
El esquema del frontend resuelve los campos omitidos a los valores por defecto del runtime de CPA, no a los valores
de la configuración de ejemplo: los reintentos de solicitud omitidos y la espera máxima de enfriamiento significan ambos
`0`. Revertir una edición visual a esa base semántica quita la ruta añadida,
restaurando el YAML original en lugar de materializar un valor por defecto.
Los dos controles de comportamiento de Codex reubicados declaran las rutas canónicas `client.codex` y
`upstream.codex` con una alternativa histórica `oauth.providers.codex` en el
esquema del frontend. El lector y el escritor del campo eligen la ruta canónica por su
presencia, nunca por su veracidad; un campo omitido usa el alias histórico para que los
primeros gateways CPA v8 sigan siendo escribibles. Un campo reubicado entre sus
rutas admitidas en el borrador de código fuente también se usa en esa ubicación en las ediciones visuales,
y revertir su valor preserva la reubicación independiente. El rebase del borrador visual mueve una edición
de campo pendiente a la ruta que contiene la base más nueva de CPA, sin cambiar ajustes no relacionados.
Las rutas medidas y la regla de compatibilidad están en `docs/cpa-v8-compat.md`.
`Client.ApplyConfigChanges` envía un conjunto de cambios como un
`PATCH /v8/management/config` de fusión para escalares y listas, un `PUT /config/<path>` por
valor de mapa y un `DELETE /config/<path>` por eliminación. CPA rechaza un nombre heredado, una
sección desconocida o un valor de tipo erróneo sin escribir esa solicitud; cuando ninguna solicitud
anterior del conjunto de cambios aterrizó, la fachada informa `422 config_rejected` con el motivo de CPA en
`reason`. Las solicitudes válidas anteriores no se revierten.

Antes de cada escritura de configuración el cliente lee el archivo almacenado y lo entrega, sea cual sea
su diseño (`configyaml.IsV8Document`), al `ConfigBackup` configurado
(`internal/cpa/management/config_backup.go`), de modo que toda operación pueda deshacerse (ADR 0051).
La capa de la API lo almacena cifrado en `cpa_config_backups` (`repository.ConfigBackupStore`)
con su diseño y el tipo de escritura que precedió (`management.WithBackupReason`; el
método del cliente lo nombra, y una operación externa como una restauración conserva su propio nombre). Una
copia idéntica a la más reciente del gateway no se almacena dos veces, así que los reintentos rechazados no dejan
copias adicionales. Las copias v8 se conservan según la retención del operador
(`cpa_config_backup_settings`, por defecto `CONFIG_BACKUP_RETENTION_DEFAULT`, entre
`CONFIG_BACKUP_RETENTION_MIN` y `CONFIG_BACKUP_RETENTION_MAX`); las copias anteriores a v8 se conservan
aparte (`CONFIG_LEGACY_BACKUP_RETENTION`), de modo que las escrituras cotidianas nunca desplacen la copia tomada
antes de una conversión. Una escritura cuya copia no puede conservarse se rechaza antes de enviar nada
(`503 config_backup_failed`); solo un archivo v8 sin almacén configurado se escribe sin copia.
El archivo se lee antes de cada escritura en lugar de recordarse, lo que también captura una edición
hecha fuera de Shell-PAMC desde la última. Las escrituras v8 tras las cuales el propio CPA guarda el
archivo (`InstallPlugin`, `DeletePlugin`, `PatchAuthFileStatus`) toman primero la misma copia. Un
conjunto de cambios que CPA detiene a medias es `ErrConfigPartiallyApplied`
(`502 config_partially_applied`), y el motivo de CPA para un guardado rechazado tiene los valores
ocultos del documento almacenado eliminados (`configyaml.ScrubStoredSecrets`).

Las rutas de respaldo viven en `internal/api/management_config_backups.go`:
`GET /management/config/backups` lista las copias (solo metadatos) con los ajustes de
retención; `POST /management/config/backups` conserva ahora el archivo almacenado
(`config.create_backup`, respondiendo `created: false` cuando coincide con la copia más reciente);
`PUT /management/config/backups/settings` fija la retención y poda de inmediato
(`config.backup_settings`); `GET /management/config/backups/{id}` devuelve un documento,
auditado con cierre ante fallos como `config.reveal_backup`; `DELETE /management/config/backups/{id}`
elimina uno (`config.delete_backup`, con cierre ante fallos); y
`POST /management/config/backups/{id}/restore` descifra una copia v8 y la escribe mediante
`UpdateConfigYAML` bajo la compuerta de escritura de proveedores y `configMu`, sin comprobación de revisión
(`config.restore_backup`, con cierre ante fallos). La propia escritura de la restauración conserva primero el archivo reemplazado,
de modo que una restauración es en sí misma reversible; una copia anterior a v8 responde `409 config_backup_legacy`
porque la API v8 rechaza sus nombres de campo. El diálogo de respaldos de la página de configuración
(`web/src/components/config/ConfigBackupsButton.tsx`) retiene la restauración mientras el editor
esté modificado y recarga después la base del editor.

### Guardado de múltiples credenciales de proveedor

El editor envía cada fila de clave de API en `keys`. Los proveedores compatibles con OpenAI conservan
estas credenciales dentro de un único objeto de proveedor. Para las siete familias de claves de API de configuración,
`management_provider_keys.go` expande un guardado en una fila de proveedor por cada clave no vacía,
preservando el proxy y el peso de cada clave y aplicando los ajustes compartidos del proveedor.
Una primera clave en blanco en una edición retiene el secreto almacenado; las filas adicionales en blanco se
ignoran. Una creación vacía o una clave enviada repetida se rechaza con `400`, y una clave
que coincide con una credencial almacenada se rechaza con `409` cuando sus URL base son iguales
o alguna está en blanco, antes de escribir. Cada rechazo lleva un `code` estable
(`provider_key_required`, `provider_duplicate_key`, `provider_credential_exists` y
`provider_stale_identity` para una edición cuya identidad observada se movió), de modo que el editor
nombra el problema en el idioma del operador; el mensaje `error` en inglés se conserva para
registros y clientes agente.

La creación y la edición dentro de la misma familia guardan todas las credenciales en una escritura de configuración con respaldo
y protegida por revisión bajo la compuerta de proveedores. Editar mantiene la fila de origen en su lugar
y añade las credenciales adicionales, así que los ids posicionales vecinos y sus metadatos
permanecen sin cambios. La respuesta conserva el `id` principal e incluye `ids` cuando se guardaron
varias filas. Los nombres y sitios web se confirman para todas las filas guardadas en una sola transacción
local; las filas añadidas heredan el ícono existente de la fila editada. El navegador asigna
el ícono seleccionado a cada id devuelto. Cada fila de la familia de configuración sigue siendo editable
de forma independiente tras guardarse.

### Edición del controlador de protocolo de un proveedor

El editor de proveedores puede cambiar la familia de una fila existente. `PUT /management/providers/{id}`
usa el id para el origen y la `family` de la solicitud para el destino; una familia omitida
mantiene el protocolo de origen. El guardado lleva el `expected_auth_index`
o `expected_name` observado, y un origen obsoleto se rechaza con `409`.

`management_provider_family_move.go` convierte los campos comunes del proveedor editado al
esquema de destino. Las credenciales, los pesos y proxies de las claves, las cabeceras, los alias de modelos,
los ajustes de razonamiento y las opciones de modelo admitidas sobreviven; los ajustes antiguos específicos del protocolo
se eliminan, y el editor lo explica antes de guardar. La política de runtime explícita a nivel de clave
sigue siendo la autoridad sobre la política compartida editada cuando las claves se dividen en filas separadas.
Un traslado a compatible con OpenAI mantiene los ajustes compartidos en el proveedor en lugar de
fijar sobrescrituras duplicadas a nivel de clave, de modo que las ediciones posteriores del proveedor siguen siendo efectivas. Un
proveedor compatible con OpenAI con varias claves se convierte en una fila por clave en una familia
de claves de API de configuración. La respuesta
nombra la primera fila de destino en `id` y cada fila nueva en `ids`.

`management.Client.MoveProviderFamily` hace coincidir el origen visible con su grupo o clave
almacenados, mantiene sin cambios todos los grupos almacenados no relacionados y las claves ocultas en runtime, y envía
ambos arreglos de familia en un único `PATCH /v8/management/config` disperso. El origen puede quedar
como un arreglo vacío: un añadido y una eliminación por separado no serían atómicos. La escritura toma la
compuerta de proveedores, conserva la configuración exacta previa a la edición como respaldo y protege esa
instantánea con `If-Match`. Las identidades de origen ambiguas y las colisiones de destino rechazan
el traslado. Tras aceptar CPA, los nombres, sitios web e íconos pasan a cada fila de destino,
y los ids de origen posteriores
se desplazan en una sola transacción local; un fallo de metadatos informa `provider_commit_partial`.
El navegador refresca esas superposiciones antes de escribir un ícono recién elegido, y las sondas o
las descargas de modelos sobre un borrador modificado usan el protocolo seleccionado en lugar del id de origen.

### Las familias de proveedores son datos, no rutas de código

CPA almacena las credenciales de `claude`, `codex`, `gemini`, `meta`, `xai`, `vertex` e `interactions`
como siete listas con un núcleo de entrada compartido y una forma de escritura compartida.
La consola lo refleja: `internal/cpa/management/config_keys.go` es dueño de los valores de
familia (`ConfigKeyFamilies`), los endpoints y la decodificación, e `internal/api/management_providers.go` contiene una
declaración por familia (`providerConfigFamilies`) que aporta las constantes de presentación,
con la proyección de lista que alimenta a su lado. Las escrituras viven en
`internal/api/management_provider_crud.go`, el interruptor de habilitar/deshabilitar en
`management_provider_status.go` y la descarga de la lista de modelos en
`management_provider_models.go`, y todas están escritas una sola vez contra esa
tabla.

Añadir una familia así es una constante más una fila, y las piezas que deben mantenerse
sincronizadas son las mismas tres en ambos stacks: la lista de credenciales de la familia en CPA, su
fila en esa tabla y su etiqueta en `PROVIDER_FAMILIES`
(`web/src/types/providerFamilies.ts`). Una familia que llega a la API pero no a la
tabla del frontend se renderiza como una fila sin etiqueta de protocolo, de modo que tanto la prueba de
contrato en `internal/cpa/management/config_keys_test.go` como la comprobación de aceptación del navegador
sobre la tabla de proveedores renderizada verifican la etiqueta y no el módulo.

Las familias difieren solo en los campos alrededor de ese núcleo (los `websockets` de una entrada estilo Codex,
el `cloak` de una entrada Claude, `request-retry` en la mayoría). La
consola no los modela, pero cada escritura que hace reemplaza una familia completa, por lo que
`ConfigAPIKey` (y `OpenAICompatibility`, sus entradas de clave y `ModelAlias`) conservan
sus campos no modelados tal cual y los escriben de vuelta (`wire_extras.go`); una edición en
la consola no puede eliminar un ajuste que el operador escribió en `config.yaml`.

El archivo almacena cada familia como grupos v8 (`api-keys.<family>`: un nombre, una URL base
y ajustes compartidos sobre una lista de claves), mientras que la consola direcciona los proveedores por
su posición en la lista de runtime aplanada de CPA, la única que lleva `auth-index`
(ADR 0038, `internal/cpa/management/provider_groups.go`). Por tanto, una escritura lee
ambas: `EditableConfigAPIKeys` hace coincidir las claves almacenadas con las entradas de runtime en
orden, de modo que cada entrada editable contiene los valores propios del archivo, su `auth-index` y el
grupo del que procede. `UpdateConfigAPIKeys` escribe la familia de vuelta como grupos en el
orden exacto de la lista: una clave permanece en su grupo, declarando su propio valor donde difiere
de un ajuste que almacena el grupo; una clave que su grupo no puede expresar (otra URL base, un
`disable-cooling` o `request-retry` borrado) y un proveedor nuevo se convierten en grupos
propios. Los proveedores compatibles con OpenAI son un grupo por proveedor
(`EditableOpenAICompatibility`, `UpdateOpenAICompatibility`). El formulario de edición muestra los
valores de runtime, por lo que una edición parte de la entrada almacenada: los ajustes de una clave y de un modelo
que el formulario no muestra se conservan (coincidencia por clave de API y nombre de modelo), una
URL base igual al valor por defecto del runtime para una clave que el archivo almacena sin ella permanece
sin declarar (`ConfigAPIKey.SubmittedBaseURL`), y un campo de grupo fuera de los ajustes
compartidos permanece en el grupo. El motivo de CPA para rechazar cualquier escritura v8 se depura de
los secretos del archivo almacenado y de los que envió la escritura antes de que la respuesta o el
registro de auditoría lo vean (`ApplyConfigChanges`).
La política de runtime de un proveedor (enfriamiento, número de reintentos, reglas de error con alcance de solicitud) y los
interruptores de comportamiento de solicitud de su familia viajan como `runtime_policy` y `behavior` en el
DTO del proveedor y en la solicitud de guardado (`internal/api/management_provider_policy.go`). CPA
decodifica la configuración de forma estricta y omite sin informar una regla de error que no puede aplicar,
por lo que el guardado rechaza un interruptor que la familia no tiene, una regla que nunca
se ejecutaría y una expresión regular que Go no puede compilar; un guardado que no nombra política deja
intacta la almacenada.
Los ajustes avanzados de una fila de modelo viajan del mismo modo, como `options` en la entrada del modelo
(`internal/api/management_provider_model_options.go`): con ellos una fila declara la entrada completa
que modela CPA; sin ellos el modelo almacenado del mismo nombre conserva sus ajustes, y
en ambos casos un campo que la consola no modela sobrevive a la escritura.
Dos constantes por familia en el registro llevan las diferencias restantes:
`RequiresBaseURL` (Codex y xAI, cuyas entradas CPA descarta sin error cuando la
URL base está vacía, por lo que la consola las rechaza de antemano) y `PullProtocol` (el
dialecto de autenticación que usa una descarga de lista de modelos).

Una familia que un CPA instalado no tiene responde `404`; eso es una capacidad ausente
y no una lista vacía o rota (`IsMissingCapability`), de modo que una
versión de la consola que conoce una familia más nueva sigue funcionando contra un gateway más antiguo.

Dos llamadores obtienen una dirección que el proceso no construyó: una descarga de lista de modelos, cuya
URL escribió el operador para un proveedor que ejecuta, y un logotipo de plugin, cuya URL declara el
manifiesto de un plugin instalado. `internal/api/outbound_fetch.go` es dueño de la
regla de redirección que ambos obedecen - una redirección que cambia de esquema o de host se rechaza antes de que
salga la siguiente solicitud del proceso, de modo que ni la clave del proveedor ni las cabeceras
personalizadas del proveedor puedan llegar a un destino que el operador no introdujo - y las dos
políticas de destino están en sus propios llamadores, porque la autoridad detrás de la URL
no es la misma. Una descarga de modelos acepta HTTP para localhost, loopback y literales
privados, ya que un relé autoalojado en la LAN del operador es el caso normal;
una política de URL inválida responde `400 invalid_model_pull_url` y una redirección rechazada
responde `502 model_pull_redirect_refused`. Un logotipo de plugin se permite solo por
HTTPS público, o HTTP hacia la propia máquina, y la dirección resuelta se comprueba en
el dialer contra todo lo que no sea espacio público de internet - la red del operador, el rango de
direcciones compartidas que entrega una red superpuesta (`100.64.0.0/10`), los
bloques reservados de IANA y un endpoint de metadatos de nube - de modo que un nombre de host que resuelva a
cualquiera de ellos se rechaza donde se haría realmente la conexión en lugar de confiar en él
porque el nombre parecía público. No se confía en que un plugin elija a qué se conecta este proceso, que es también
la razón por la que esta obtención se conecta directamente en lugar de mediante un proxy de
entorno: con uno, al dialer se le consultaría la dirección del proxy y
el destino sería inverificable.

El logotipo de un plugin se obtiene por una razón distinta a la de una lista de modelos: no para llegar al
host del plugin desde el navegador, sino para mantener al navegador alejado de él.
`internal/api/management_plugin_logos.go` obtiene la URL que publica un plugin,
exige un tipo de medio de imagen de una lista permitida acotada, limita la respuesta - tanto para un logotipo
publicado en línea como para uno obtenido - y lo informa como una URL `data:`
en línea tanto en `logo` como en `metadata.logo`; el ícono de un registro de tienda se incrusta del mismo
modo, en la lista de la tienda. Cada lista comparte un plazo de obtención,
porque lo que tiene que permanecer acotado es el endpoint que sondea la consola y no
cada solicitud; el resultado se guarda en caché, fallos incluidos, de modo que una lista de plugins que nombre un
host inalcanzable no vuelva a obtenerlo en cada sondeo. Un presupuesto agotado es el único
resultado que no se guarda en caché, ya que quedarse sin tiempo no es una respuesta sobre el
logotipo. Un logotipo que no puede incrustarse se informa como ausente y no como una URL, que
es lo que hace que cada superficie de proveedores recurra a la marca del catálogo incluido; véase el §3.

La navegación de plugins, las tarjetas/paneles de gestión y los encabezados de páginas alojadas comparten
`PluginIcon`: las URL de datos SVG son máscaras alfa aisladas pintadas con `currentColor`,
de modo que su tinta sigue los estados de tema, hover y selección sin insertar el marcado SVG del plugin
en el DOM del host. Las marcas de gestión enmarcadas pierden su fondo y borde
para los glifos SVG. Las URL de datos raster conservan sus colores originales como imágenes; el arte ausente
o fallido usa el glifo genérico de plugin. Las superficies de marca de proveedor conservan
los colores originales del arte del plugin.

CPA informa del nombre, autor, versión y logotipo de un plugin solo una vez que su host lo ha cargado, por lo que
un plugin instalado que está deshabilitado o esperando un reinicio llega solo con su id.
`internal/api/management_plugin_identity.go` rellena esos campos vacíos - nunca un valor que el
plugin registró - a partir del listado de la tienda del plugin instalado, antes de incrustar los logotipos.
Cada lectura de la tienda refresca esa copia en memoria; la lista de plugins lee la tienda
solo cuando queda un hueco que la copia no puede cerrar, como máximo una vez cada diez minutos y
dentro de cinco segundos, de modo que un plugin que ningún registro lista cuesta una lectura de la tienda, no una por sondeo.

### Los proveedores OAuth son un solo registro

`internal/cpa/management/oauth_providers.go` es la única declaración de qué
autorizaciones existen, la forma de cada una (`redirect` o `device`) y si CPA
debe abrir para ella su reenviador de callback en loopback (`UsesLoopbackCallback`, enviado
como `is_webui`). La lista de proveedores de la fachada y la solicitud del cliente son ambas
proyecciones de ese registro, y el registro de tarjetas del navegador
(`web/src/pages/oauthProviderLogic.ts`) lleva la presentación correspondiente más las
reglas para juzgar una redirección pegada.

El registro deliberadamente no es una lista de permitidos: los plugins de CPA registran sus propios
proveedores de inicio de sesión en tiempo de ejecución, servidos por el mismo endpoint de inicio de sesión v8 compartido
(`/v8/management/oauth/auth-url?provider=`), la consola los descubre a partir de la
lista de plugins, y un id que el registro no conoce se reenvía sin cambios y sin
indicadores por proveedor. Los dos registros se mantienen unidos por un id, de modo que un proveedor
se añade en ambos o en ninguno.

Un proveedor que nombra el propio registro de la consola también necesita una marca, porque una
superficie que no puede dibujarla recurre a un marcador neutro - que se lee como
«este proveedor no tiene identidad» aunque su arte viene incluido en el bundle. Las
marcas del catálogo se declaran en `web/src/components/common/providerMetadata.ts` y
`web/src/types/providerIconIds.ts`; en cambio, un proveedor registrado por un plugin trae
el logotipo que publica (§3).

### La gestión de OAuth es un espacio de trabajo centrado en la credencial

`/oauth-management` es el único destino de navegación de OAuth. Su colección se
proyecta a partir de la lista de archivos de autenticación, de modo que las entradas importadas, solo de runtime, respaldadas por plugins,
de proveedor desconocido y sin capacidad de inicio de sesión permanecen todas visibles. La cuota se une
solo cuando tanto el archivo de autenticación como la respuesta de cuota llevan un único `auth_index`
no vacío; los estados faltante, duplicado y de carrera solo de cuota siguen siendo diagnósticos en
la misma superficie, y no se autoriza ninguna escritura desde un destino ambiguo. La proyección pura
vive en `web/src/pages/oauthManagement/oauthWorkspaceLogic.ts`.

Los enlaces SIWC son una operación distinta con alcance de credencial, no un inicio de sesión de proveedor.
`internal/api/management_siwc.go` resuelve un único destino gestionado, admite como máximo
128 sesiones retenidas y serializa el callback, la cancelación y la relectura de finalización
por intento. Fija en memoria la URL del gateway y la identidad de la credencial; los cuerpos
de callback no se retienen. Cada mutación requiere una auditoría de intento exitosa. Los cuatro campos de resumen
no secretos tienen listas permitidas explícitas en la consola y en las capacidades. CPA es dueña del intercambio
de tokens, la preservación del archivo y la publicación.
`web/src/hooks/useSIWCBindings.ts` mantiene los intentos por encima de la selección de credencial,
con clave por nombre e índice de autenticación, de modo que cerrar o cambiar el panel de detalle no pueda
mezclar destinos. A la finalización de CPA le sigue una relectura segura del destino antes del éxito;
si la relectura falla, la mutación completada queda en verificación. Véase
[compatibilidad de SIWC](cpa-v8-compat.md#credential-scoped-siwc-binding).

Las sesiones de autorización viven por encima del Connect Drawer en
`useOAuthSessions`, con clave por id de proveedor, de modo que minimizar o cerrar el panel de tareas
no detiene el sondeo, no duplica un verificador ni cancela una sesión upstream. Una lectura de
estado que falla antes de que CPA responda es una nota sobre un intento aún en espera y no
un estado terminal: el panel conserva su acción de cancelar y el sondeo armado sigue ejecutándose,
porque solo el estado `error` propio de CPA termina un intento. Todo sitio que arma el temporizador del sondeo
borra primero el anterior, lo que sostiene la regla de un solo verificador. El
drawer presenta un verificador de estado serializado por intento. El espacio de trabajo renuncia a la
notificación de finalización por defecto del hook y informa la finalización una sola vez, mediante su
toast consciente de credenciales una vez que se asienta la actualización de la lista. El detalle de la credencial,
la configuración y los modelos comparten un Drawer protegido. Los alias con alcance de proveedor y las
exclusiones OAuth globales comparten un Drawer separado de reglas de modelos, con borradores independientes por
sección; cambiar de proveedor o cerrar no puede descartar una sección sin guardar
sin una protección. Sus nombres y marcas coinciden con las pestañas de filtro de proveedor. `CredentialQuotaBody` es el único renderizador de cuota usado por el
espacio de trabajo y su panel de detalle. La lista siempre renderiza un resumen compacto de cuota;
la pestaña Cuota siempre renderiza el cuerpo completo de la cuota. Las credenciales de Codex y Claude exponen
una pestaña separada de Calentamiento de ventana para reglas, estado y ejecuciones manuales confirmadas. Los borradores de calentamiento
sobreviven a los cambios de pestaña. Configuración y Modelos son pestañas separadas con la elegibilidad de consulta
ligada a la pestaña seleccionada. El formulario de
configuración permanece montado para que los borradores sobrevivan a los cambios de pestaña; su protección de cierre con cambios pendientes se aplica
a todo el Drawer. La identidad de la credencial incluye el índice de autenticación al restablecer
las sesiones del formulario y al guardar modelos en caché. Los valores históricos de densidad en la URL y los campos de preferencia
siguen siendo datos de compatibilidad legibles, pero no cambian el diseño de la vista general.
`oauth_management_view_v1` almacena el tamaño de página, el estado, la condición de cuota y el orden.
Las dimensiones explícitas de la URL sobrescriben los valores por defecto guardados sin persistir la navegación;
editar un control guarda la vista efectiva y reinicia la paginación. Restablecer filtros
persiste el estado, la cuota y el orden por defecto conservando el tamaño de página. Si la
lectura de la preferencia falla, los controles siguen usables mediante el estado de la URL; los guardados permanecen
deshabilitados hasta que el documento almacenado se haya leído correctamente.

Una actualización de cuota informa su resultado una sola vez, como toast, de modo que nunca empuja hacia abajo la
lista de credenciales (ADR 0045). Una ejecución sin destino fallido - incluida una
que omitió credenciales que nunca fueron elegibles - se reconoce con un toast
que se cierra solo. Una ejecución con un destino fallido o desconocido muestra un toast de informe
que lista el motivo de cada destino bajo su grupo (fallido, sin resultado, omitido) y
permanece hasta que se cierra; la siguiente actualización lo reemplaza en lugar de apilarse. Las acciones destructivas y de exportación sobre una
credencial nombran su destino en la confirmación y no en la etiqueta del menú, que
permanece corta para cualquier longitud de nombre de archivo.


Las antiguas rutas `/oauth`, `/auth-files` y `/quota` se conservan solo como
redirecciones de reemplazo seguras en cuanto a parámetros. Preservan la intención documentada de filtro y
conexión mientras descartan el material de callback, estado, sesión y código.

### Registros y la pista de auditoría: tres registros, mantenidos por separado

La página de Registros (`/logs`, con `?source=service`) lee los dos registros de log y monta solo
el que se está leyendo para que el otro no haga sondeo; la pista de auditoría es su propia página (`/audit`,
`pages/AuditPage.tsx`), porque se lee filtrando y contando sobre un lapso largo en lugar de
seguir una cola. Un enlace antiguo `/logs?source=audit` redirige allí.

- **Registro del gateway** — el propio archivo de log de CPA y los archivos de error de solicitudes, intermediados a través del
  cliente de gestión tipado (`/management/logs`, `/management/logs/status`,
  `/management/request-error-logs`, `/management/request-logs/{id}`). La consola sigue su cola;
  no es dueña de nada de él. El id de solicitud de una línea abre el archivo de log de esa solicitud en un panel
  lateral (`components/logs/LogFileViewer.tsx`), como también un archivo de log de error: el archivo se
  obtiene una vez por apertura, se dibuja hasta `MAX_LOG_PREVIEW_BYTES`, se guarda desde la misma
  copia y se elimina de la caché de consultas cuando se cierra el panel porque cita
  contenido de solicitudes. `downloadRequestLogByID` acepta solo un id de token simple, audita la
  lectura como `request_log.download` y se rechaza en modo demo. Esta ruta, y no la
  lista de solicitudes, es cómo se lee una solicitud sin registro de uso (véase Detalle de fallo (Failure Detail) en
  `CONTEXT.md`).
- **Registro del servicio** — el propio log de proceso de Shell-PAMC. `cmd/shell-pamc` construye el logger como
  `applog.NewHandler(jsonStderrHandler, buffer)`, de modo que stderr sigue siendo el log duradero que
  recoge un despliegue, y `NewHandler` en `internal/api` encuentra el búfer mediante
  `applog.BufferOf`. El búfer conserva los últimos `applog.DefaultCapacity` registros,
  los numera con una secuencia que solo crece durante la vida del proceso, y se
  sirve mediante `GET /api/v1/management/service-logs?after=<seq>&limit=`. Un lector que se quedó
  más de una página atrás salta a los registros más recientes y se le indica `gap: true` en lugar de
  reproducir un atraso. Los valores pasan por `security.RedactText`, todo campo cuyo
  nombre indique una credencial (incluido todo nombre `*key`) se reemplaza por completo, y
  los tamaños de mensaje y de campos están acotados, de modo que un error enorme no pueda hacer crecer el anillo. Un
  proceso compilado sin la copia responde `capturing: false`.
- **Pista de auditoría** — `audit_events`, servida por `GET /api/v1/management/audit/events`
  con `category` (prefijos de acción, identificadores validados), `outcome`
  (`succeeded` / `failed` / `unfinished` — una fila `attempt`, que con el plegado activado es una
  cuyo resultado nunca llegó), `q` (una subcadena de acción, destino o id de solicitud),
  `since_ms`, `limit` (como máximo 200) y `before`, un cursor de conjunto de claves opaco `<occurred_at_ms>_<id>`
  que la página anterior devolvió como `next_cursor`. `fold` (activado por defecto) oculta
  una fila `attempt` una vez que existe un resultado para el mismo id de solicitud y acción; las filas
  escritas antes de que los ids de solicitud fueran estables por solicitud se emparejan por acción, destino y
  un resultado dentro de un minuto (`auditFoldWindowMS`), y solo cuando ambas filas son anteriores
  al momento en que se aplicó la migración 027, que es cuando los ids se volvieron estables. `idx_audit_events_request_action`
  (migración 027) sirve esa búsqueda. `GET /api/v1/management/audit/export` toma los
  mismos filtros, devuelve todas las filas incluidos los intentos salvo con `fold=1`, se detiene en
  `repository.AuditPageMax` filas con `truncated` establecido, y es en sí misma auditada y
  se retiene cuando ese registro no puede escribirse. `GET /api/v1/management/audit/summary`
  (`repository.SummarizeAuditEvents`) cuenta las filas que la pista mostraría para los
  mismos `since_ms`, `q` y `fold` como una matriz de prefijo de acción por clase de resultado; ignora
  `category`, `outcome` y el cursor, porque la página deriva los conteos de ambas facetas de
  esa matriz (`auditFacets`) y cada faceta debe contar bajo la selección de la otra.
  La página mantiene sus filtros (`category` como el nombre de categoría de la consola, `outcome`, `q`,
  `range` de `24h`/`7d`/`30d`/`all`) en su URL, de modo que las acciones «solo este destino» y
  «solo esta solicitud» de una entrada, y cualquier enlace, abran una pista acotada.

A cada solicitud se le asigna un id generado por el servidor al llegar (`assignRequestID`, que
lo devuelve como `X-Request-ID`). Por tanto, las filas de intento y de resultado de una escritura lo comparten;
antes cada llamada de auditoría generaba su propio id y no se podía emparejar ningún par. El
`X-Request-ID` propio de un llamador nunca es la clave de emparejamiento - un mismo valor enviado en dos solicitudes
emparejaría un intento con el resultado de otra solicitud - y en su lugar se registra en la fila de
auditoría como `client_request_id` para correlación.

### Resolución de cuota y límite de éxito parcial

La resolución de cuota de plugins requiere un identificador de cuota, un ID de plugin o un proveedor de autenticación
coincidente; una credencial sin coincidencia nunca se envía a otro plugin. Un canje de
Codex exitoso con una limpieza fallida del enfriamiento del gateway sigue siendo exitoso y
devuelve `cooldown_cleared: false` más `cooldown_error: "cooldown_clear_failed"`;
solo el estado HTTP se conserva en el diagnóstico del servicio, y la consola
renderiza orientación localizada.

## 3. Forma del frontend

El motor de desplazamiento de la consola distingue las listas de opciones nativas por su overflow calculado, no solo por la estructura DOM compartida del contenedor. Los contenedores `auto`/`scroll` nativos de la biblioteca conservan el desplazamiento de rueda gestionado por el navegador porque su reconciliación diferida del desplazamiento en React competiría con las escrituras fotograma a fotograma; las regiones nativas ordinarias siguen deslizándose mediante `scrollTop`, y los contenedores virtuales con overflow oculto se conducen mediante su handler de rueda. Esto mantiene desplazables los popups Select no virtualizados sin eludir el virtualizador de la lista de solicitudes.

`web/src` es una aplicación de una sola página en React + TypeScript + Ant Design, con TanStack
Query para el estado del servidor.

| Área | Contenido |
| --- | --- |
| `App.tsx` | Router, páginas cargadas de forma diferida, proveedores de tema y de locale; el proveedor de tema queda por encima de `ConfigProvider` (los tokens de Ant Design son una proyección de la paleta resuelta) mientras que `ThemeServerSync` queda dentro de `App`, porque un guardado rechazado se informa mediante un toast (`useToast`), que necesita el contexto `App` de antd. En modo demo ni envía ni adopta: el tema permanece en el navegador del visitante |
| `api/client.ts` | El único cliente HTTP tipado y la infraestructura compartida de sesión/errores; todo endpoint ordinario se declara aquí. El `agent/transport.ts` del Agent envuelve `requestResponse` y `agent/sse.ts` para sus rutas SSE, sin duplicar la política de autenticación ni de reintentos |
| `agent/` | La capa de ejecución del Agent sin framework (ADR 0041): construcción de solicitudes AG-UI y análisis de eventos (`protocol.ts`), el lector SSE seguro frente a fragmentos (`sse.ts`), el transporte, el reductor de ejecución, los tipos de protocolo y el documento y kit del canvas (`canvasDocument.ts`, `canvasKit.ts`) y las exportaciones del lado del navegador (`export.ts`: nombres de archivo; `conversationSnapshot.ts`, `conversationHtml.ts`, `conversationStyles.ts`, `conversationControls.ts` y `conversationDownload.ts`: la página portátil de la conversación y la imagen) |
| `types/` | Tipos de protocolo, incluido el modelo de vista del registro de solicitudes dividido por responsabilidad (`usageEventQuery.ts` para el contrato de URL y filtros, `usageEventViewPreference.ts` para la vista almacenada, `usageEventIdentity.ts` para la credencial y el proveedor detrás de una fila, `usageEventGrouping.ts` para cómo se agrupan los registros, `usageEventLabels.ts` para lo que imprime una fila, `usageEventMetrics.ts` para sus números y `usageEventCadence.ts` para las constantes de temporización de la página), `usageEventViewActions.ts` (las reescrituras de URL y de persistencia de la vista), `pluginOAuthProviders.ts` (qué logotipo publica un plugin instalado para el proveedor de autenticación que registra, y si una URL puede renderizarse como imagen), `tokenDisplay.ts` (la única capa por la que se formatea todo número de tokens visible al usuario) y `rollingNumber.ts` (la forma animada de una lectura) |
| `hooks/` | `usePreference`, `useProgressTask` (cuenta la vida de un componente, como la de un fallback de Suspense, como trabajo de la barra de carga), `useCustomIcons` (metadatos de íconos personalizados compartidos y con revisión), `useLastIntentQueue` (enlace con React) sobre `lastIntentQueue` (el controlador sin framework) y `disposableSlot` (vida de un recurso acotado a un efecto), `useLogTail` (la cola del gateway de CPA, posicionada por el cursor de CPA), `useServiceLogTail` (el log del servicio, posicionado por su número de secuencia), `useVisibleNow`, `useLiveRevision` (enlaza el canal de uso en vivo compartido en `api/usageLive.ts` con una revisión de consulta, §6 «La señal de cambio en vivo»), `useIsNarrowViewport` (900px, la carcasa), `useIsPhoneViewport` (640px, listas y tamaños de controles), `useVisibleViewport` (límites del viewport utilizable gestionados por el efecto; política pura en `types/visibleViewport.ts`), `useFocusedRegion` (aislamiento del espacio de trabajo en sitio y limpieza de foco), `useOverlayHistory` (enlace con React) sobre `overlayHistory` (la política sin framework de overlay/historial: un centinela por cada Drawer o Modal abierto, de modo que el Atrás de la plataforma descarta el superior), `usePluginOAuthLogos` (la lista de plugins leída una vez, proyectada a logotipos por clave de proveedor), `usePrefersReducedMotion` (el interruptor de movimiento reducido propio de la aplicación que necesitan las marcas del canvas, ya que ni `@antv/g2` ni `@ant-design/plots` leen la preferencia) |
| `i18n/` | `index.tsx` es dueño del diccionario base `[zh, en]` y del contexto `t()`; `language.ts` es el registro de idiomas de lectura y los ayudantes de locale; `locales/zh-Hant.ts` y `locales/ms.ts` son los catálogos adicionales completos |
| `theme/` | `palette.ts` (los nueve tokens creados, la derivación de dieciocho tokens, las paletas registradas y la resolución de un modo más una selección en una paleta), `themePreference.ts` (el documento de preferencia almacenado, su análisis y su migración desde el id de paleta simple anterior), `ThemeContext.tsx` (la preferencia, el seguimiento del sistema, la edición en curso y la sincronización con el servidor), `themeConfig.ts` (tokens de antd y proyección de variables CSS), `colorMath.ts` (mezcla OKLCH, luminancia y contraste - la única autoridad para toda razón de la consola), `cacheScale.ts` y `heatmapRamp.ts` (las paradas de las dos rampas secuenciales) |
| `utils/` | `scrollSmoothing.ts` (el deslizamiento de rueda y teclado de toda la consola, ADR 0046: las muescas discretas de rueda y las teclas de desplazamiento se deslizan sobre el token `scroll`, las listas virtualizadas se conducen mediante su propio manejo de rueda y reciben el primer paso de un deslizamiento dentro del evento de entrada, para que el deslizamiento no añada latencia a su propio salto (ADR 0047), los trackpads y el tacto nunca se deslizan; se carga bajo demanda mediante `hooks/useScrollSmoothing.ts` y se activa con la preferencia `omc_scroll_smoothing`, cuyas palabras viven en `scrollSmoothingPreference.ts` para que el motor quede fuera de la entrada principal), `maskKey.ts` (la única forma de máscara de clave de llamador de la consola, mantenida rama por rama con el `security.MaskSecret` del servidor), `externalUrl.ts` (la regla de enlaces http/https), `modelOptions.ts` (filtrado de entradas de modelo), `smoothScroll.ts` (la programación de gestos/correcciones de desplazamiento), `clipboard.ts` (la única ruta de copia, más abajo), `download.ts` (`saveBlob`, la única ruta de descarga: adjunta el ancla y libera la URL del objeto con retraso, porque revocarla en la propia tarea del clic cancela el guardado en Firefox y Safari), `format.ts` (`formatBytes`), `loadProgress.ts` (el modelo puro de la barra de carga con reloj inyectado: lotes, crédito resuelto y pendiente, el retraso de aparición y el suavizado que nunca retrocede), `progressController.ts` (el reloj inyectado, la programación y el ciclo de vida de oculto/movimiento reducido) y `progressTasks.ts` (el registro a nivel de módulo del trabajo en curso que no es de consultas, y la forma de la fuente que lee la barra) |
| `components/common/` | Lo que renderiza más de una página: las primitivas compartidas que una página compone en lugar de un componente de antd - `AppDrawer` (todo panel lateral: tres anchos, cierre con nombre, pie de dos ranuras), `SearchInput` (todo campo de filtro mientras se escribe), `EmptyState` (toda región vacía), `SectionHeading` (todo encabezado de sección, tres pesos), `Tag` y `ToggleTag` (un dato breve sobre una fila, cinco tonos), `ConfirmAction` (una confirmación anclada a su disparador), `SelectionBar` (las acciones sobre filas marcadas), `Toolbar` (la fila sobre una lista), `Panel` (la superficie enmarcada), `FactList` (una lista de etiqueta/valor), `Pager` (navegación de páginas), `Meter` (una lectura sobre una pista), `Count` (un conteo de filas junto a su etiqueta), `CopyButton`, `ToolButton` (una acción secundaria como un cuadrado con glifo nombrado por su tooltip, etiquetada de nuevo dentro de `ActionMenu`) y `Fold` (el cuerpo de divulgación que se despliega desde su propia altura); la carcasa (`AppLayout`, `HeaderNav`, `AuthGate`, `PreferenceMenus` y `HeaderAction`, el único control con el que se construye toda acción de encabezado y de inicio de sesión); el chrome de página con el que abre toda ruta - `PageHeader` (título, subtítulo o resumen en vivo, `actions` de escritorio y `mobileActions` explícitas), `ActionMenu` (herramientas secundarias que se abren con clic, foco e historial de overlay), `FilterDisclosure` (filtros adicionales solo para teléfono con resumen del estado seleccionado), `timeRange/TimeRangePicker` (el único selector de ventana que adaptan el panel y la lista de solicitudes: primero los preajustes y un calendario de rango en línea un nivel más abajo, en un popover o una hoja inferior; sus reglas son `timeRange/rangeDraft.ts`), `RefreshButton` (el único glifo y tamaño de actualización, que gira en lugar de bloquearse mientras una lectura está en curso), `PanelTitle` (el glifo de una tarjeta, su título y su único control), `StatusLabel` (un estado como punto + palabra), `Switch` (el único control de encendido/apagado, un botón nativo `role="switch"` con el dibujo propio de la consola; `pnpm check:feedback` rechaza el de antd), `FactList` (filas de etiqueta/valor), `StatTiles` (mosaicos contados que además sirven de filtro de una lista), la retroalimentación de carga (ADR 0052 y 0054: `ProgressBar` dibuja el progreso aproximado de tareas a partir de `utils/loadProgress.ts` mediante `utils/progressController.ts`, con un segmento CSS independiente de actividad de espera, `DataProgress` le alimenta las lecturas que espera el lector (`isQueryProgressWork`) y `utils/progressTasks.ts`; `Placeholder.tsx` contiene el kit ansioso de carcasa/inicio de sesión, mientras que `ContentPlaceholder.tsx` mantiene las composiciones de párrafo/tabla tras importaciones de ruta; `utils/progressSources.ts` clasifica las lecturas de consultas y fusiona fuentes solo para la carcasa cargada; el kit lo componen `PageLoading`, `RouteLoading`, `SuspenseFallback` y el `ShellLoading` de la carcasa), `CodeFrame` con `CopyButton` (un bloque de código y su acción de copia, compartido por las transcripciones y los fragmentos de configuración); `SecretInput` (un secreto que no es el inicio de sesión de la consola, enmascarado por estilo para que el gestor de contraseñas del navegador lo deje en paz); y la lista que una superficie renderiza en ambos anchos - `ResponsiveList.tsx` (tabla en un viewport ancho, filas por debajo de 640px, con carga antes que vacío, bloqueado-no-es-vacío y paginación acotada decididos una sola vez) sobre `PhoneRow.tsx` (titular, resumen, campos etiquetados, controles) y `phoneRowFields.ts` (deriva los campos de una fila, y la celda renderizada de una columna, del arreglo de columnas *propio de la tabla*, de modo que una lista tiene una sola descripción de un registro en ambos anchos y una columna no puede desaparecer en silencio en un teléfono; véase el ADR 0012) |
| `components/workspace/` | El espacio de trabajo de conversación sobre el que se construye el Agent: `WorkspaceLayout` (el marco: cabecera con título y acciones; columna principal; panel lateral redimensionable que pasa a ser un Drawer consciente de Atrás por debajo de 900px), `useResizablePanel` (redimensionado con puntero y teclado que escribe el ancho en el DOM durante un arrastre y lo confirma una sola vez), `AssistantThread` (el viewport del hilo de assistant-ui: sigue el mensaje más nuevo mientras el lector está al final, mantiene su lugar cuando se desplaza hacia arriba y ofrece «volver al último» solo entonces), `AssistantComposer` (el compositor de assistant-ui con controles de Ant Design: adjuntos, la cola de mensajes enviados durante una ejecución, las listas de comandos `/` y menciones `@` que una página puede entregarle, recuperación de mensajes enviados con la flecha arriba, y Enter y el botón de enviar que piden ambos al runtime que envíe, porque los controles de envío propios del framework deciden a partir de un estado que les llega una tarea después de que la página lo cambió), `ContextReadout` (la proporción de la ventana de contexto de referencia del modelo que ocupa una conversación, a partir de `contextShare.ts`), `ModelMarkdown` (renderizado seguro de `@ant-design/x-markdown` con resaltado de código de lista permitida dentro del `CodeFrame` compartido), `ReasoningBlock` (un desplegable de razonamiento plegable que sigue su salida más nueva mientras se transmite y se pliega cuando termina el flujo), `ReasoningEffortPicker`, `ComposerPicker` (la única lista navegada con teclado detrás de los comandos `/` y las menciones `@` del compositor, navegada mediante `pickerNavigation.ts`), `TargetChip` (el destino del compositor como un chip), `EndpointPicker` (el endpoint de inferencia como un chip, ADR 0088), `ModelMark` (la marca del fabricante de un punto de llamada) y `GenerationLoader` (la figura de espera que muestra una ejecución en curso). El Agent tiene su propia carcasa (ADR 0076), abre los detalles de una llamada bajo la llamada (ADR 0084) y mantiene su directorio de capacidades y su guía de conexión en un Drawer |
| `components/feedback/` | Toda superficie de notificación y de fallo (ADR 0045): `useToast` (el resultado de una acción, incluidos los toasts de informe con motivos por destino), `LoadFailure` (la lectura fallida de una región, en su lugar, con Reintentar) y `Notice` (una condición, o un rechazo junto a su entrada; dibujado por el propio módulo como un callout encabezado por un código de tono sin traducir, sin el `Alert` de antd). `toastContent.ts` contiene las partes puras - `readableReason`, agrupación, duraciones. `pnpm check:feedback` mantiene fuera del resto de `web/src` los `Alert`, `message`, `notification` y diálogos solo informativos en bruto de antd |
| `components/logs/` | Las dos fuentes de la página de Registros: `CpaLogPanel` (la cola del gateway y los archivos de error), `ServiceLogPanel` (el log del servicio) y `LogList`, la cola desplazable en la que ambos renderizan - sigue la línea más nueva hasta que el lector se desplaza y monta solo el fragmento más nuevo. `CpaLogPanel` renderiza en un elemento anfitrión que mueve al body del documento para su visor a pantalla completa, porque una página enrutada se sitúa dentro de un contenedor transformado que confinaría `position: fixed`. Los tipos de protocolo y los ayudantes puros (análisis de líneas, los filtros y sus conteos por valor) viven en `types/logs.ts` |
| `components/audit/` | El `AuditTrail` de la página de auditoría: la cabecera de página con actualizar y exportar, los mosaicos de resultado (`StatTiles`, cada conteo es un filtro), los filtros de búsqueda, categoría y rango, y la pista como un marco `ResponsiveList` por día (en un teléfono, una fila tocable por entrada: la frase y su resultado sobre su hora y destino); `AuditEventDrawer` muestra una entrada completa y pasa a sus vecinas; `auditText.ts` convierte una acción y un resultado en la frase y la palabra que ve un lector. Los tipos de protocolo, el estado de URL y el conteo de facetas viven en `types
| `components/plugins/` | Las pestañas de la página de gestión de plugins: `InstalledPluginsPanel` (el estado de cada plugin en palabras - en ejecución, habilitado pero sin ejecutarse, deshabilitado - su interruptor, acción directa de ajustes y un menú de desbordamiento para enlaces externos seguros y eliminación confirmada), `PluginSettingsPanel` (el interruptor del sistema de plugins, los registros de terceros y las reglas de autenticación de la tienda) y `PluginConfigDrawer` (los campos declarados de un plugin como controles tipados, con la vista JSON del mismo documento). Las reglas puras están junto a ellos: `pluginConfigForm.ts` (borrador a documento, validación por campo, claves no declaradas y el registro de instalación `store` de CPA transportado), `pluginConfig.ts` (análisis JSON que rechaza una clave duplicada) y `pluginStoreLogic.ts` (la validación del borrador de ajustes). `pluginRuntime.ts` espera a que el gateway cargue o descargue un plugin conmutado. `pages/PluginsPage.tsx` es dueña de la pestaña, que es la ruta (`/plugins`, `/plugins/settings`). `pluginPages.ts` convierte la lista de plugins en las páginas que registraron los plugins; `AppLayout` las lista en el grupo Plugins de la navegación, leyendo la lista de plugins una vez por carcasa, y `pages/PluginPageHost.tsx` muestra una en `/plugin-pages/<id>/<n>` en un marco sobre el host de plugins, dentro de un documento padre escrito por la consola que declara el modo de color como `data-theme` (ADR 0060) |
| `components/`, `pages/` | UI de funcionalidades; una página por ruta, ninguna página es dueña de otra. Una página compone su superficie en lugar de cargarla: `pages/UsageEventsPage.tsx` renderiza la barra de herramientas, la cabecera y las filas de `components/usage/` y toma su estado de los hooks de ese directorio; cada uno de esos componentes importa la hoja de estilos que lo dibuja (`RequestList.css` para las filas y su cabecera, `RequestToolbar.css`, `RequestFilterChips.css`, `RequestFoldControls.css`, `RequestExportDialog.css`, `UsageEventDrawer.css`, `RequestFailureDetail.css` y `requestMarks.css` para las marcas que comparten la lista y el detalle), de modo que `pages/UsageEventsPage.css` contiene solo el diseño propio de la página. El panel, el panel de configuración, la gestión de claves y el visor de logs hacen lo mismo con una hoja de estilos por directorio (`components/dashboard/dashboard.css`, `components/config/config.css`, `components/keys/keys.css`, `components/logs/logs.css`), lo que deja a `web/src/index.css` los tokens, las sobrescrituras de Ant Design, la carcasa, las primitivas compartidas y las clases que usa más de una superficie; `pages/ProvidersPage.tsx` renderiza la tabla y el editor de `components/providers/`, y `pages/ConfigPage.tsx` renderiza los renderizadores de `components/config/`. Las políticas sin framework de una superficie permanecen a su lado: `components/usage/` lleva `searchDebounce.ts`, `pollingPolicy.ts`, y `components/dashboard/routing/` lleva `routingPackets.ts` (el reproductor imperativo de paquetes, §7 regla 9 en `docs/design.md`), `usePresence.ts` y `rowMotion.ts` (filas que entran, salen y se deslizan en el mapa) junto al modelo de enrutamiento en `types/usageRouting.ts`; `timeRangePolicy.ts`, `syncPresentation.ts`, `chipDisplay.ts`, `requestListTouch.ts` (la lista de solicitudes bajo un dedo: sigue al dedo, se desliza por inercia y pliega la cabecera, en lugar de la emulación táctil del virtualizador, ADR 0048) y la exportación de solicitudes seleccionadas (`requestSelection.ts` decide la selección y lo que una redacción retiene, `requestSheetModel.ts` dispone la imagen como datos, `requestExportJson.ts` construye el documento JSON, y solo `requestSheetPainter.ts` toca un canvas - de modo que lo que una exportación puede contener se verifica sin un navegador), y `components/config/` lleva `payloadRules.ts`, `configDirty.ts` y `configPatch.ts` |

La ordenación del espacio de trabajo de OAuth construye de forma diferida su colador de nombres sensible a numéricos/base
dentro de una sola invocación de ordenación, resolviendo de nuevo el locale por defecto del runtime. El ranking
numérico, los valores por defecto de respaldo y los empates estables de nombre no cambian. No comparta este
comparador a ciegas con `components/authFiles/authFileLogic.ts`: los empates de ranking numérico de esa lista heredada
usan una política de comparación de nombres simples distinta. El oráculo diferencial
y el benchmark opcional están documentados en `docs/testing.md`.

Las primitivas de conversación compartidas no dependen de una página en tiempo de ejecución: `utils/ids.ts`
es dueño de un contador de ids de respaldo, `utils/thinking.ts` analiza el razonamiento en línea,
`types/requestModel.ts` lee el modelo efectivo del cuerpo personalizado, y
`components/workspace/imageAttachments.ts` es dueño de la admisión, la decodificación y la codificación acotada de imágenes
del Agent. El Agent y las exportaciones portátiles importan directamente estas hojas.
`components/workspace/conversationLabels.ts` es dueño de la admisión de estados, los vocabularios de error
del Agent y la presentación de duraciones para el hook de exportación compartido.
Los módulos de página conservan sus exportaciones públicas, mientras que los módulos de runtime del espacio de trabajo compartido
no deben importar internos de páginas.
La guarda de grafo de runtime en `scripts/conversation-boundaries.test.mjs` impide
invertir estas dependencias.

La frase de un fallo pasa por `describeError` (`api/client.ts`) en lugar de la propia escalera
`instanceof` de cada sitio de llamada: un `ApiError` ya lleva el mensaje del servidor
(o el rechazo localizado de demo de la consola), y el mensaje de un `Error` de transporte es la parte
útil - `String(error)` anteponía `Error: ` a todos ellos.

Todo control de copia pasa por `utils/clipboard.ts` en lugar de llamar él mismo a la
API del Portapapeles. Esa API existe solo en un contexto seguro, y un origen HTTP simple
es un despliegue admitido de esta consola (`deploy/nginx.conf` escucha en
:80 sin TLS, y el servidor de desarrollo es alcanzable desde un dispositivo de LAN o Tailscale),
donde `navigator.clipboard` es sencillamente `undefined`. Por tanto, el ayudante recurre
a la ruta de selección y devuelve si el texto realmente llegó al
portapapeles, y ningún control puede anunciar una copia que no hizo.

Ese respaldo conlleva dos restricciones de las que depende un control dentro de un diálogo. Un diálogo -
el Drawer y el Modal de antd por igual - devuelve el foco a su propio subárbol, así que el elemento
temporal por el que la ruta de selección escribe tiene que unirse a ese subárbol y no a
`document.body`: adjunto fuera de él, el elemento nunca mantiene el foco que su selección
necesita y la selección queda vacía. Y `execCommand('copy')` responde `true` ante una
selección vacía, así que el ayudante comprueba que el elemento temporal tenga foco y su propia
selección antes de creer el resultado.

Todas las rutas de página y el `AppLayout` autenticado son límites de importación
`React.lazy`. `AuthGate`, `ShellLoading` y el fallback de recuperación de rutas permanecen
ansiosos para que el inicio de sesión y la recuperación no esperen al código autenticado. Las marcas de marca/proveedor se copian del paquete fijado
`@lobehub/icons-static-svg` a `web/public/lobe-icons` y se referencian
como URL SVG. El pequeño catálogo usado para búsqueda y agrupación está incluido en
`web/src/generated/lobeIconCatalog.json`; el paquete de íconos de React no es una
dependencia, porque importarlo arrastraría cientos de componentes al
bundle ansioso; la página de Ajustes de Shell-PAMC es diferida por la misma razón, porque el editor de paletas que lleva
arrastra el selector de color de Ant Design. Las tarjetas KPI del panel usan `@ant-design/charts` en un chunk
`vendor-charts` dedicado, cargado de forma diferida para que el bundle de entrada siga siendo pequeño. Sus
números se animan mediante `@number-flow/react`, que la página del panel importa
directamente en lugar de mediante un chunk de proveedor: solo esa ruta lo usa, y al estar en
un límite de ruta diferido nunca entra en el grafo estático de módulos de la entrada. Las propias marcas
se transforman entre revisiones con el mismo token de movimiento, controlado por el hook de
movimiento reducido citado arriba. Las reglas 5 y 8 del §7 de `docs/design.md`
son dueñas del movimiento que se les permite ejecutar, y los ADR 0007 y 0008 son dueños de los
compromisos.

La creación de gráficos del panel se dosifica mediante `utils/chartMountQueue.ts` y `charts/ChartMount.tsx`:
un montaje en cola se confirma en una tarea posterior a cada fotograma de animación, dejando oportunidades
de pintado y de entrada entre las ocho inicializaciones de G2. El llamador reserva la geometría
existente del gráfico, el trabajo en cola se cancela al desmontar (incluida la limpieza de StrictMode), y
las pestañas ocultas se pausan con los fotogramas de animación del navegador. Una vez montados, los gráficos conservan sus
instancias y reciben normalmente actualizaciones de datos, tema, zona horaria, locale y estilo de unidades; la
cola no difiere las actualizaciones ni cambia la especificación de movimiento. Los selectores y
formateadores de KPI tienen referencias estables, y los límites de gráficos memoizados evitan reprocesar
series sin cambios en las actualizaciones de estado de consultas.

Los íconos proceden de `lucide-react`, a través de la capa de envoltorios en
`web/src/components/icons/index.tsx` y no por importación directa, de modo que la consola conserva los nombres de íconos de Ant
Design y las clases `anticon` sobre las que ya selecciona su CSS. Esos envoltorios son reenviadores finos,
así que el conjunto de íconos se reduce por tree-shaking a los íconos realmente referenciados; el ADR 0025 registra el
cambio desde `@ant-design/icons` y las dos declaraciones de hoja de estilos que asumió la consola para que
sus íconos ya no dependan de la inyección en runtime de otro paquete.

**El logotipo publicado de un plugin prevalece sobre la marca del catálogo para el proveedor que
registra.** Un plugin que declara `supports_oauth` puede publicar su propio logotipo, y
cuando publica arte utilizable esa marca es la que se dibuja: el plugin es la única
autoridad sobre cómo se ve su propio proveedor, y el catálogo incluido no puede
actualizarse instalando un plugin, de modo que adivinar una marca a partir de la clave del proveedor
rotularía la credencial del propio operador con la marca de otro.
Sin embargo, no se carga desde el host del plugin - el despliegue no debe
depender de un CDN, y la CSP de la consola permite imágenes solo desde sí misma o en línea -
así que el proceso de Go lo incrusta (§2) y `types/pluginOAuthProviders.ts` resuelve la
lista de plugins en logotipos por clave de proveedor (incluido un plugin cuyas autenticaciones se tipan por
su propio id y no por `oauth_provider`). El `ProviderBrandIcon` de `LobeIcon.tsx`
lo renderiza - un solo componente para las pestañas de proveedores, los registros unificados de credenciales,
los registros de solicitudes, la tabla de proveedores y las filas de proveedores del panel, de modo que
esas superficies no puedan discrepar sobre el mismo proveedor. Solo se renderiza arte en línea:
un proveedor que ningún plugin posee, un logotipo que no pudo incrustarse y un valor
con un esquema que el navegador no puede cargar recurren todos a la marca del catálogo, y una
fila propiedad de un plugin muestra la marca del plugin incluso cuando hay almacenada una sobrescritura de ícono
del operador para esa clave, y no depende de que el plugin esté habilitado — la marca
identifica al proveedor detrás de una credencial o de una solicitud pasada, lo cual no deja de ser
cierto cuando el plugin se apaga (ADR 0014). El ADR 0013 es dueño de los compromisos detrás de las
otras decisiones aquí, incluido por qué la URL de un logotipo declarada por un plugin se somete a una política de
destino más estricta que una escrita por el operador.
El modelo de descubrimiento/enlace del backend que renderizaba la consola de triaje retirada sigue
vigente tras Proveedores y la gestión de OAuth; la consola ya no lleva un
componente propio para ello.

`components/icons/index.tsx` es la capa de íconos de la consola, y la referencian todas las
superficies que dibujan un ícono: envuelve componentes de Lucide en los nombres de íconos de Ant Design que importa
el resto del código (`<ApiOutlined />`, `<SyncOutlined spin />`) en lugar de
dejar que los componentes importen directamente una biblioteca de íconos. Conserva los nombres de clase `anticon` y
la prop `spin`, porque el CSS propio y los componentes de antd seleccionan sobre ellos, y
`web/src/index.css` es dueño de las dos declaraciones que antes llegaban de la hoja de estilos
inyectada en runtime de esa biblioteca (el modelo de caja base y los keyframes de giro). El ADR 0025 registra
el cambio; la consola no tiene dependencia directa de `@ant-design/icons`, mientras que antd conserva
la suya transitiva.

Los nombres de clase CSS son kebab-case en todas partes, incluidas las exportaciones de `*.module.css`,
que se consumen como `styles['kebab-case']`. Eso no es cosmético: `tsc` tipa un
módulo CSS como `Record<string, string>`, así que una referencia de clase obsoleta compila y
falla en silencio en runtime. `pnpm check-css-modules` es la guarda que cierra
esa brecha.

El presupuesto de movimiento se hace cumplir del mismo modo. `pnpm check:motion` lee las
hojas de estilos y las cadenas `transition:` en línea de los componentes, y falla ante una
duración que no es un token `--motion-*`, una transición sobre una propiedad de layout (o
sobre `all`), una animación keyframe sin contraparte `prefers-reduced-motion`, y
un hover que transiciona color fuera del token rápido; los desplegables que necesitan una
animación de layout, y el flujo de carriles del mapa de enrutamiento que se reproduce con movimiento reducido
(ADR 0102), figuran en su tabla `EXCEPTIONS` con un motivo cada uno, y una
entrada obsoleta es en sí misma un fallo. El presupuesto que hace cumplir está declarado en
`docs/design.md` §7, y el razonamiento detrás del límite de hover es el ADR 0009.

Las escalas de tipografía y de radios se mantienen del mismo modo. `pnpm check:style-tokens` lee
cada hoja de estilos y falla ante un tamaño de fuente que la escala posee pero está escrito como
número, un tamaño de fuente fraccionario, una esquina de la escala 2 · 6 · 8 · 12 escrita como
número, una esquina de 5px fuera de escala, y una referencia `--text-*` o `--radius-*`
que ninguna hoja de estilos define o que lleva un valor de respaldo (`docs/design.md` §3 y §4).

La fuente de la consola se distribuye completa (ADR 0094). `web/src/assets/fonts/sarasa/` contiene Sarasa
Mono SC cortada en fragmentos de `unicode-range` por `pnpm subset-font` (`scripts/subset-font.mjs`,
con la planificación pura en `scripts/font-shards.mjs`), más `manifest.json`, `core.css` y
`shardUrls.ts` (una importación estática `?url` por fragmento, de modo que los módulos compilados solo contienen URL con hash).
`index.css` importa `core.css`, que declara solo el fragmento 000 de cada peso, así que el arranque
espera un archivo por peso. Al arrancar, `main.tsx` también inicia una importación asíncrona de
`web/src/theme/sarasaFont.ts`, que registra todos los demás fragmentos mediante la API
`FontFace`; un navegador descarga uno solo cuando una página dibuja un carácter que contiene. Las exportaciones incrustan los
fragmentos que dibuja su texto mediante el mismo módulo (`shardsForText` en
`web/src/theme/fontShards.ts`). `scripts/font-shards.test.mjs` sujeta entre sí los fragmentos versionados, el
manifiesto, la hoja de estilos core y el módulo de URL.


### Recuperación de errores de ruta

La ruta de datos raíz en `web/src/App.tsx` proporciona `RouteErrorPage` como su
`errorElement`. Los errores de renderizado descendientes, las importaciones diferidas de páginas rechazadas y los errores de renderizado
de la carcasa burbujean hasta este fallback de página completa importado de forma ansiosa, fuera de
`AppLayout` pero dentro de los proveedores existentes de tema e idioma. No hace ninguna lectura de
API. El `AppLayout` autenticado se carga de forma diferida dentro del límite Suspense de la ruta raíz,
con `ShellLoading` (el contorno propio de la carcasa como marcadores de posición)
mientras está pendiente. El mismo marcador ocupa su lugar mientras `TimeZoneProvider` espera las
preferencias almacenadas. Su región de marcador expone un rol de estado nombrado por la traducción
existente `common.loading`, y lee el locale independientemente de la construcción del router. El código de
la carcasa no hace falta para el inicio de sesión ni la recuperación de errores; una importación rechazada de la carcasa llega al
mismo límite de error ansioso. `web/src/utils/routeErrorDiagnostics.ts` proyecta
un nombre de error, mensaje y pila acotados, más el pathname de la ruta, la versión de compilación, la hora UTC de
ocurrencia y el estado HTTP para las respuestas de ruta. Nunca serializa objetos lanzados arbitrarios ni
cuerpos de respuesta; solo se proyecta un cuerpo de cadena o su campo `message` de cadena.
Las formas comunes de credenciales y los valores de credenciales/consulta/fragmento de las URL se eliminan
antes de renderizar o copiar. La redacción es de mejor esfuerzo y no una garantía
de que un texto de excepción arbitrario no contenga contenido sensible. El `CopyButton` existente usa la
ruta compartida del portapapeles y su política de retroalimentación.
Ambas acciones de recuperación reemplazan el documento: recargar reintenta la URL actual, mientras que
el ancla del panel incluye la ruta base de runtime. Reemplazar el documento también
borra las importaciones diferidas rechazadas en la caché de React. Los fallos de proveedor/bootstrap fuera
del router, las excepciones de manejadores de eventos y los fallos asíncronos desacoplados no son
capturados por este límite de ruta. Las rutas desconocidas de la consola conservan su redirección
existente al panel.

El relleno de la barra de carga es una estimación de tareas contadas, no un porcentaje medible: las solicitudes
pendientes y las importaciones de módulos no tienen una duración total conocida. Su `progressbar` localizado omite
`aria-valuenow`; `aria-busy` describe solo las tareas pendientes. El CSS anima un breve marcador de espera
independientemente del relleno. `progressController.ts` inyecta relojes, programación, visibilidad y
preferencias de movimiento; las notificaciones de la caché de consultas actualizan la contabilidad sin reiniciar el reloj de fotogramas.
La última resolución (incluido un fallo o una cancelación) detiene la actividad y cierra el relleno dentro
del token de movimiento base resuelto, luego la barra completada se mantiene y se desvanece. El contenido se renderiza de inmediato.
`ProgressBar` es dueña de su transición de DOM y de los manejadores de visibilidad y los elimina al desmontar. El movimiento
reducido solo actualiza ante eventos de tarea, preserva el progreso pendiente y oculta de inmediato el trabajo
completado; los documentos ocultos suspenden fotogramas/temporizadores y retiran el trabajo completado sin repetición. El
fin o la cancelación de la transición de opacidad retira un desvanecimiento completado independientemente de las notificaciones de la fuente.

### Costos de renderizado de navegación y calendario

`web/src/routePages.ts` es dueño de los módulos de página diferidos y sus cargadores compartidos;
`web/src/routePreload.ts` asigna la intención de navegación a esos cargadores y permanece tras
la importación de la carcasa autenticada. El menú de
navegación precarga el código de un destino al pasar el puntero, al enfocar con teclado o al iniciar el toque. No
precarga datos autenticados, no monta el destino ni carga el editor YAML de la página de configuración.
La pantalla de inicio de sesión no tiene menú de navegación y no inicia ninguna de estas importaciones especulativas.
`web/src/utils/routeLoader.ts` comparte una importación entre la intención y la navegación, reutilizando el éxito
y borrando un intento especulativo fallido para que una navegación posterior pueda reintentar.
La columna de contenido registra si se ha desplazado mediante sus propios eventos de scroll.
La navegación de rutas la restablece solo tras un desplazamiento real; una columna que ya está arriba
evita la llamada `scrollTo` por lo demás redundante y su vaciado síncrono de layout.
Los widgets desplazables anidados no cambian el estado registrado de la columna de contenido.

El mapa de calor de tokens resuelve sus instantes de primer almacenamiento y de «a la fecha de» a días de calendario una vez por
revisión de observación/zona horaria, en lugar de una vez por celda. `createHeatmapCellClassifier`
conserva la misma interpretación de zona horaria/DST de dayjs por instante. Los nombres localizados de celdas y
los relojes del Agent reutilizan la caché acotada de formateadores en `web/src/utils/dateTimeFormat.ts`;
las claves de fecha civil usan un portador UTC para que la zona del navegador no pueda desplazar ni omitir una fecha.
Las celdas son nodos DOM simples memoizados. El primer clic crea un tooltip de antd, proyectado mediante portal
dentro de la celda seleccionada a través de un ancla estacionaria y transparente al puntero; cambiar de día
reemplaza esa única instancia sin reemplazar el DOM de las celdas ni el foco. La celda activa es dueña de la
descripción ARIA y del anillo de apertura. El puntero exterior y Escape lo descartan; Escape desde su
enlace restaura el foco de la celda. Cerrar conserva el movimiento de salida de antd, con el contenido del popup destruido
al ocultarse. La instancia y los listeners se eliminan al navegar o al cambiar el calendario.
El posicionamiento inicial observa el primer layout no nulo del contenedor de desplazamiento y fija la posición
de desplazamiento al extremo limitado por el navegador una vez por montaje, en lugar de leer de forma síncrona el layout
pendiente de todo el panel. Las actualizaciones preservan la posición de desplazamiento del operador.
Véase `docs/performance.md` para la auditoría medida y los cuellos de botella restantes.

Las filas de solicitudes generan su etiqueta corta y su tooltip con precisión de milisegundos en
`web/src/components/usage/requestTimestamp.ts` a partir de un único `Intl.DateTimeFormat` que se
construye por zona horaria de visualización y es compartido por todas las filas, de modo que montar una fila mientras se desplaza
no vuelve a resolver la zona. El memo de la fila conserva ambas cadenas hasta que su marca de tiempo
o la zona horaria de visualización compartida cambian, de modo que la selección y los cambios de estilo de unidades no
repiten el formateo. Las marcas de tiempo de protocolo no cambian.

`ProviderBrandIcon` se suscribe a la lista de plugins solo para el arte personalizado del despliegue en
un proveedor con claves, el único caso que decide la propiedad de un plugin. Una marca del catálogo se renderiza
sin observador de consultas, lo que importa donde se monta una marca por fila de solicitud.

Las celdas de solicitud llevan la etiqueta exacta de su tooltip como atributo de datos en lugar de crear
un árbol de disparadores de antd por celda. `web/src/components/usage/RequestTooltip.tsx` delega
la intención de puntero y foco dentro del host de la lista a un único tooltip bajo demanda. Su ancla fija
y transparente al puntero se proyecta mediante portal al body del documento para que el DOM de las filas, el layout de la cuadrícula
y el foco permanezcan sin cambios. Las etiquetas se actualizan mientras el destino sigue montado; la eliminación de filas
virtuales, el desplazamiento, el redimensionado, Escape y la limpieza de ruta liberan la descripción activa
y el popup. El retraso de intención de puntero existente de 100 ms y el movimiento de salida de antd permanecen;
el foco de teclado muestra la pista de la acción de precio sin esperar a la intención del puntero.

La estimación inicial de filas virtuales de Listy se alinea con el mínimo existente de 68 px de las filas de solicitud
mediante su token de componente. El CSS de las filas de solicitud sigue siendo dueño del relleno visible y la
geometría; el virtualizador sigue midiendo las alturas reales de los elementos y de las cabeceras de grupo.


## 4. Flujo de solicitudes y de sesión

1. `POST <base>/api/auth/login` con la clave de gestión de CPA. El handler
   la compara con `SHELLPAMC_CPA_MANAGEMENT_KEY`; no existe una segunda contraseña.
   Los intentos fallidos se limitan por la dirección directa del par. Las cabeceras de reenvío
   solo se consultan cuando ese par pertenece a `SHELLPAMC_TRUSTED_PROXY_CIDRS`, y
   se usa la dirección no confiable más a la derecha de la cadena, de modo que un valor
   más a la izquierda aportado por el cliente no pueda crear un nuevo cubo del limitador.
2. En caso de éxito, el gestor de sesiones deriva una clave HMAC de la clave de gestión
   y emite una cookie HttpOnly, SameSite=Strict (`Secure` cuando
   `SHELLPAMC_PUBLIC_URL` es HTTPS) con una caducidad de 12 horas.
3. `requireAuthentication` envuelve cada ruta de `/api/v1` y rechaza con 401 una cookie
   ausente u obsoleta.
4. Rotar la clave de gestión de CPA cambia la clave de firma derivada, de modo que toda
   sesión existente falla la verificación sin necesidad de un almacén de sesiones en el servidor.
5. Las exportaciones sensibles (archivo de autenticación sin procesar, registros de solicitudes) escriben una fila `audit_events`,
   y un fallo de escritura de auditoría bloquea la exportación (cierre ante fallos).

   **El YAML de configuración sin procesar deliberadamente no está tras una segunda credencial.** Antes
   requería una concesión de revelado de corta duración obtenida volviendo a introducir la clave
   de gestión de CPA, mientras que `PUT /config/source` - que escribe el mismo archivo - solo exigía
   la sesión. Como la clave de gestión es la única credencial de la consola, la
   concesión volvía a comprobar exactamente la autoridad que la sesión ya llevaba, así que añadía
   un paso sin añadir una frontera. Leer el código fuente sin procesar sigue estando tras
   `requireAuthentication`, se sirve con `no-store` y mantiene la escritura de auditoría con
   cierre ante fallos. Esto es una eliminación deliberada de la autenticación escalonada, no un
   cambio de aviso solo en el frontend: el endpoint de concesión y su estado ya no existen.

6. Los dos endpoints de lista que pueden llevar credenciales en texto plano bajo petición,
   `/management/api-keys?include_keys=true` y
   `/management/providers?include_keys=true`, escriben `api_key.reveal` o
   `provider.reveal_keys` antes de emitir la respuesta. El registro identifica
   la lista y lleva conteos en lugar de un evento por credencial. Un fallo de escritura
   de auditoría responde `500` y no se devuelve ninguna credencial; las lecturas enmascaradas no se
   auditan porque ninguna credencial sale del servidor (ADR 0018).

La propia clave se cifra con `SHELLPAMC_MASTER_KEY` y se almacena en la fila de
`cpa_instances`, donde `bootstrapDefaultInstance` la refresca en cada
arranque, de modo que una rotación no requiere cirugía de SQLite.

### Compresión de respuestas

`internal/api/compression.go` negocia gzip a partir de `Accept-Encoding`, incluidos los rechazos con calidad cero
y la precedencia del comodín. El middleware de la API comprime el JSON ordinario con codificadores en pool
de máxima velocidad; SSE, descargas de archivos, solicitudes HEAD/range, cuerpos ya codificados,
respuestas `no-transform`, revelados explícitos de credenciales con `include_keys=true` y respuestas que establecen
cookies pasan sin cambios. Los vaciados de streaming
y las operaciones de `http.ResponseController` llegan al writer original. La compresión de JSON
elimina la longitud de contenido original, y tanto las variantes codificadas como las de identidad llevan
`Vary: Accept-Encoding` sin descartar otros campos vary.

Los recursos JS, CSS, SVG y JSON embebidos conservan su política de caché inmutable. Los recursos de al menos
1 KiB se comprimen en el primer uso negociado, solo cuando gzip ahorra bytes. Sus representaciones
comprimidas se reutilizan en una caché de todo el proceso limitada a 8 MiB; inventarios mayores pueden
seguir sirviéndose sin aumentar los bytes retenidos. La compresión se ejecuta fuera del mutex de la caché;
la publicación vuelve a comprobar si hay una entrada concurrente antes de cargar el presupuesto de bytes retenidos.
Los fallos solapados pueden calcular el mismo recurso, pero un resultado retenido se publica y se cuenta
una sola vez. Las fuentes y otros recursos binarios no se
comprimen. GET y HEAD seleccionan la misma representación y longitud de contenido tanto bajo el
montaje raíz como bajo la subruta configurada. No se requiere ningún ajuste de compresión del proxy inverso.

## 5. Flujo de descubrimiento e identidad

```text
POST /api/v1/instances/default/discover
  → internal/cpa/management reads auth-files, the codex API-key list, and
    openai-compatibility entries
  → cpa/discovery derives a stable resource key and binding fingerprint
  → repository upserts discovered_resources + cpa_bindings (served via /api/v1/resources)
```

El orden de resolución de la clave de recurso y la prohibición de usar la posición en un arreglo quedan fijados por el
ADR 0002: id upstream inmutable, luego `auth_index` con alcance de familia, luego un
HMAC con clave y versión del material de la credencial, luego una huella de
metadatos no sensibles y, por último, un marcador explícito `identity_collision`
en lugar de una fusión silenciosa. Los secretos nunca entran en una clave ni en la entrada de una huella
almacenada, y un DTO de respuesta lleva uno solo para la superficie que lo edita y solo
cuando lo pide (`?include_keys=true`, ADR 0015); toda otra respuesta lleva
una máscara de visualización. (La lista de Proveedores y el espacio de trabajo unificado de gestión de OAuth
inspeccionan y gestionan directamente las entradas de runtime de CPA mediante
`/api/v1/management/providers` y `/api/v1/management/auth-files`, superponiendo
metadatos de preferencias locales en la lectura.)
Las ediciones de archivos de autenticación usan el parche de campos de CPA pero no tratan su `200` como prueba:
la fachada relee la entrada de runtime y una proyección del lado del servidor del
JSON descargado antes de devolver éxito. La proyección expone solo
prefijo, URL de proxy, caducidad, disable-cooling, WebSockets, using-API, nota, prioridad,
peso, modelos excluidos, el número de reintentos, las reglas de error con alcance de solicitud y los
alias de modelos propios de la credencial; los tokens
y demás material de credenciales permanecen dentro del proceso de Go. Una actualización manual
(`POST /api/v1/management/auth-files/refresh`) resuelve su selector a exactamente una
credencial antes de consultar a CPA, e informa solo del resultado: la respuesta de CPA lleva
los tokens renovados, así que el cliente de gestión nunca la decodifica. Una importación de cuenta de servicio de Vertex
(`POST /api/v1/management/auth-files/vertex-import`) reenvía la clave subida a
`oauth/import?provider=vertex` de CPA como un formulario multipart, tras rechazar un cuerpo que no es
una clave y un `location` que no es un nombre de región; se audita, y su respuesta
nombra solo el archivo almacenado, el proyecto, la dirección de la cuenta y la ubicación. El diálogo de importación
mantiene los bytes de la clave fuera de las variables de mutación en caché e invalida las lecturas de archivo pendientes
al cerrarse, de modo que una lectura tardía no pueda restaurar una selección de clave cancelada. La actualización y la importación
se abortan si no puede almacenarse la auditoría del intento, pero un fallo de la auditoría del resultado tras la
mutación exitosa de CPA no convierte la escritura ya aterrizada en una respuesta de error ni invita a
una mutación duplicada. Las reglas globales de modelos OAuth son independientes de esos campos por credencial:
`/api/v1/management/auth-files/model-aliases` lee y reemplaza los alias de un proveedor,
y `/api/v1/management/auth-files/excluded-models` lee y reemplaza
las exclusiones de un proveedor (`oauth.model-alias` y `oauth.excluded-models` en CPA).
Las listas vacías eliminan la configuración de ese proveedor. Ambas escrituras adquieren la compuerta de escritura
de toda la configuración, toman el respaldo ordinario de configuración previo a la escritura, releen CPA antes de
informar éxito, notifican la pertenencia a precios y registran el resultado de auditoría. Las capacidades
del agente reutilizan la misma normalización y ruta de escritura, con una revisión comprobada
dentro de la compuerta de escritura. La actualización de exclusiones por HTTP exige que su auditoría del intento tenga éxito
antes de contactar a CPA. Una vez que CPA ha persistido las reglas y la relectura coincide,
un fallo de escritura de la auditoría de éxito se registra pero el endpoint devuelve `200` con el
proveedor y las reglas verificados; la actualización ya aterrizada no debe informarse como fallida.

`GET /api/v1/management/auth-files/provider-models?provider=<key>` proyecta solo
los ID de modelos y los nombres para mostrar del catálogo que CPA sirve en
`/routing/model-definitions/{channel}`: su catálogo estático para un canal integrado, y
para cualquier otro canal los modelos del host de plugins o del registro de proveedores. La clave
del proveedor se valida (letras minúsculas, dígitos y guiones, como máximo 64 caracteres) y
se escapa como un único segmento de ruta antes de llegar a CPA. No le afectan los alias ni
las exclusiones y nunca lee secretos de credenciales. El 400 de CPA (canal desconocido) o el 404
(un gateway sin la ruta) devuelve `available: false`; los demás fallos upstream
siguen siendo fallos. Los editores conservan la entrada manual sin catálogo.
Las lecturas de exclusiones usan las reglas de CPA recortadas, en minúsculas y sin duplicados. La fachada limita
el número de proveedores, el número de reglas (512) y la longitud de las reglas (256 caracteres).
Los alias y las exclusiones siguen siendo configuración propiedad de CPA, sin una nueva tabla de Shell-PAMC.

`cpa_bindings` lleva `missing_at_ms` y `ON DELETE SET NULL` para que la eliminación
upstream marque un enlace como ausente sin propagarse en cascada al historial.

## 6. Flujo de uso

```text
CPA queue / subscription
  → ingest.Runner        pop or receive, persist immediately
  → usage_inboxes        raw payload, status pending, durable before decoding
  → ingest.Processor     decode via internal/usage, one event per inbox row
  → usage_events         typed row + request-time price snapshot (one tx)
  → ingest.Maintenance   fold into usage_facts_15m + usage_facts_daily
                         (permanent), then the data-lifecycle pass that
                         rolls request records and decoded payloads out
  → /management/dashboard, /management/dashboard/tail,
    /management/dashboard/token-heatmap, /management/dashboard/models,
    /management/dashboard/providers, /usage/events, /usage/routing
  → ingest.Changes       "stored data changed" → GET /usage/live (SSE)
```

El pipeline existe porque la cola de CPA es destructiva y de corta vida: el único
orden seguro es «persistir primero el payload sin procesar, interpretarlo después». Una escritura
local fallida registra una fila `ingest_gaps` para que la pérdida de cobertura sea visible en lugar de
silenciosa, y `usage_inboxes.status` (`pending → processed | failed | discarded`)
hace que un fallo de decodificación sea reintentable sin perder telemetría.

`usage_inboxes` es el único lugar desde el que se puede reproducir un payload, de modo que el paso de
decodificación se serializa: `ClaimUsageInboxBatch` simplemente selecciona filas pendientes y
`usage_events.event_key` intencionalmente no es único (CPA informa los reintentos bajo un
mismo `request_id`), así que dos decodificadores concurrentes confirmarían cada uno su propia copia del
mismo payload. `ingest.Processor.drain` es esa compuerta, razón por la cual tanto el
bucle en segundo plano como una sincronización manual pasan por ella; es un canal y no un
mutex para que una sincronización manual que espera al bucle en segundo plano aún regrese dentro de su propio
plazo.

`internal/usage/ingest.Runner` elige su transporte en modo `auto` sondeando
solo `AUTH` — nunca extrayendo, porque un sondeo que consumiera un registro lo
destruiría. Se prefiere la suscripción; los fallos repetidos de `SUBSCRIBE` degradan a
RESP `LPOP`, y un endpoint RESP inalcanzable degrada a la cola de uso HTTP
(`/v8/management/observability/usage/queue`). Las extracciones vacías retroceden mediante `pullPacer` (1s → 2s →
4s → 8s → 10s, y luego tope) mientras que un lote completo se drena sin retraso. Una clave de
gestión incorrecta desencadena un enfriamiento largo en lugar de reintentar, porque CPA bloquea la
IP de un cliente tras fallos repetidos.

### La señal de cambio en vivo

Una página que muestra registros de solicitudes se entera de que se almacenó uno por una señal, no
por una cadencia. El camino de CPA a la pantalla no tiene ninguna espera fija:

- En modo `subscribe` el runner escribe un registro recibido por push en `usage_inboxes` tan pronto
  como el búfer de la suscripción está vacío, en lugar de en el tick de vaciado. Un registro
  recibido por el canal destructivo no existe en ningún otro lugar, así que la escritura no lleva
  plazo mientras el recolector se ejecuta; solo un apagado inicia el
  tiempo de espera de vaciado final que la acota.
- Los handlers de captura del runner despiertan al procesador de decodificación, que de otro modo queda inactivo en
  su intervalo, y el procesador publica en `ingest.Changes` tras cada confirmación
  que almacenó un evento. Los eventos de error se leen según llegan, no en el tick de
  vaciado, y cada captura también publica, ya que un enfriamiento cambia lo que dibuja el panel de
  enrutamiento.
- `ingest.Changes` es un hub de coalescencia: cada suscriptor mantiene un canal de una ranura y
  una publicación nunca bloquea, de modo que una ráfaga de confirmaciones se convierte en una señal pendiente por
  lector y un lector lento no puede bloquear al decodificador. Los lectores están limitados a
  `MAX_CHANGE_SUBSCRIBERS`; pasado ese límite `/usage/live` responde 503.
- `GET /usage/live` es un flujo de eventos enviados por el servidor que no lleva datos: `ready` al
  conectar, `usage` cuando algo cambió (como máximo uno cada 250 ms) y un latido en forma de comentario
  cada 20 s. Termina a los cinco minutos para que una sesión que cerró sesión
  no pueda conservar un flujo; el navegador se reconecta y la reconexión vuelve a autenticarse.
  Sin recolector (ingesta desactivada, modo de demostración) responde 204; el Worker de la demostración pública
  transmite en su lugar señales para su tráfico simulado.
- En el navegador, `web/src/api/usageLive.ts` abre un flujo por pestaña, compartido por
  todos los lectores, lo cierra mientras la pestaña está oculta y reintenta por sí mismo un 204 o un 503
  tras 30 s porque EventSource no lo hace. `useLiveRevision` convierte las señales en una
  revisión sobre la que se basa una consulta, reteniendo una señal que llega durante una lectura para que cueste
  exactamente una lectura posterior. Todo lector trata `ready` como una señal, de modo que lo que
  cambió mientras estaba desconectado se lee al reconectar, y cada lector mantiene su
  sondeo de 10 s mientras no haya ningún flujo abierto.

Una señal nunca lleva filas: cada lector vuelve a leer con sus propios filtros y cursor,
de modo que una señal fusionada o perdida no puede hacer perder un registro.

### Enrutamiento en vivo

`GET /usage/routing` responde los intentos de una ventana móvil `USAGE_ROUTING_WINDOW` (un
minuto), enteramente a partir de registros de solicitudes: CPA escribe uno por intento, así que un registro es una
ruta que tomó una solicitud, y los registros que comparten un `request_id` son una solicitud que CPA reenrutó
(contada una vez, y como error que vio un llamador solo cuando falló su último intento). Un
intento pertenece al minuto en que terminó (`timestamp_ms + latency_ms`). Sin
`after` la respuesta es el minuto completo, el más reciente primero y limitado a
`MAX_ROUTING_RECORDS` (`has_more` indica que se alcanzó el tope); con `after=<record id>` es
solo lo registrado desde entonces. Las credenciales en reposo ahora provienen de la fila más reciente de
`error_events` por índice de autenticación cuyo momento de reintento o recuperación aún está por delante.
Los registros se proyectan exactamente como los proyecta la lista de solicitudes, de modo que el panel de
enrutamiento del dashboard (`components/dashboard/routing/`) nombra modelos y credenciales igual que
la lista.

El panel mantiene el minuto en el navegador: lee el minuto completo una vez y luego, en
cada señal de uso en vivo, lee después del registro más reciente que tiene, fusiona y retira
los registros envejecidos con un reloj de un segundo alineado con el `as_of_ms` del servidor; una lectura
incremental que alcanzó el tope reinicia la ventana desde ella. El modelo que dibuja
(`types/usageRouting.ts`) agrupa los intentos en solicitudes, pliega modelos y credenciales
más allá del límite dibujado en un conteo, y concilia las filas en entrando, presente y
saliendo para que una fila pueda animarse al salir antes de eliminarse. No se infiere nada de la
configuración, y nada se dibuja como en vuelo: una solicitud recorre el mapa una vez que su
registro está almacenado. El viaje y el movimiento de las filas se reproducen para todo lector, incluido uno
cuyo sistema informa `prefers-reduced-motion: reduce`, porque el recorrido es la lectura del
panel; la excepción está acotada en `docs/design.md` §7 regla 9 y en el ADR 0102.

### Sincronización manual frente a recolección en segundo plano

La lista de solicitudes lee la propia base de datos de Shell-PAMC, de modo que una actualización manual que solo
la releyera nunca podría mostrar una solicitud que CPA aceptó hace un momento. `POST
/usage/ingest/refresh` por tanto drena CPA primero: `ingest.Pipeline.RefreshNow`
entrega una solicitud a la goroutine del recolector (un segundo consumidor desviaría
registros de una suscripción en vivo y competiría con el bucle de sondeo por la misma cola
destructiva), espera a la pasada y luego ejecuta una barrera de decodificación hasta que las filas de bandeja
que esa pasada pudo haber producido dejen de estar `pending`.

Cinco propiedades son deliberadas:

- La pasada manual la atiende la goroutine del recolector, nunca el handler HTTP, y
  persiste bajo el contexto del recolector mientras solo *pregunta* a CPA
  bajo el del llamador: los payloads ya extraídos no pueden devolverse, así que un llamador que
  deja de esperar no debe abortar la escritura, pero un llamador que dejó de esperar también
  deja de pedir más.
- Un fallo manual se devuelve a `Run` en lugar de tragarse, de modo que el retroceso y
  el enfriamiento por clave incorrecta lo siguen gobernando. Un operador que hace clic en actualizar cinco
  veces no debe gastar el presupuesto de cinco strikes de bloqueo de CPA.
- En modo `subscribe` la pasada mueve lo que el lector ya ha almacenado en búfer
  al lote y luego drena el residuo de la brecha de reconexión mediante el mismo bucle
  acotado de varios lotes que usa la ruta de sondeo. Una suscripción en vivo suprime el
  encolado de CPA, así que una sola extracción informaría «nada nuevo» mientras registros recién enviados
  esperaban al siguiente tick de vaciado; y una sola extracción informaría una sincronización limpia con
  un atraso más antiguo todavía en cola.
- La barrera de decodificación se delimita por una marca de agua (`MAX(usage_inboxes.id)` tomada después de
  la pasada), y sus conteos de decodificados y descartados por el mismo valor leído antes de
  la pasada, de modo que el resultado describe las capturas de esta sincronización incluso cuando el
  decodificador en segundo plano termina antes de que comience la barrera. Esperar a `pending == 0` en su lugar solo terminaría durante una calma,
  porque los registros siguen llegando mientras se ejecuta la actualización.
- `synced` exige que nada capturado en la marca de agua o por debajo se haya aparcado como
  no decodificable. Un payload venenoso no deja evento, así que una barrera que ignorara
  los descartes prometería registros que la lista nunca podrá mostrar.

El endpoint responde con `synced` más el motivo por el que no pudo sincronizar, y una
sincronización ya en ejecución recibe un 409 en lugar de encolar un segundo drenaje idéntico.
`auth_rejected` describe el fallo propio de esta sincronización, o el actual del recolector
cuando el recolector no se está ejecutando; un fallo de autenticación del que el recolector se
ha recuperado desde entonces es historia, no un veredicto.

El estado del recolector separa el estado actual de ese historial: `failing` lo establece
una captura fallida y lo borra la siguiente exitosa, mientras que `last_error` conserva
el mensaje más reciente. `healthy` requiere un modo funcional, un recolector en ejecución y
`failing` sin establecer. Una suscripción que se cierra entrega a la bandeja los payloads que ya recibió
antes de reconectar, y también lo hace un recolector que se está apagando;
la cola de CPA es destructiva, así que un lote descartado en cualquiera de esos puntos se pierde.

### Quién resuelve la ventana de la lista de solicitudes

Una sincronización solo ayuda si la lectura que sigue puede ver lo que almacenó. Los registros llevan
el propio `timestamp` de CPA, que comparte el reloj del servidor; el reloj del navegador es uno
distinto y puede ir minutos por detrás. Por tanto, la lista de solicitudes y sus facetas
envían la ventana tal como la eligió el lector - `preset`, o `from` más un
`to` solo para un rango cerrado - mediante `eventWindowQuery` en
`web/src/types/usageEventQuery.ts`, y `dashboardWindowFromRequest` resuelve
«ahora» en el servidor, el mismo contrato que sigue el `dashboardRangeParams` del dashboard.
Cuando la lista enviaba un fin resuelto con el reloj del navegador, un navegador
retrasado filtraba todo registro más nuevo que ese reloj: una solicitud que
acababa de completarse se quedaba fuera de la lista tras cualquier número de actualizaciones, y
aparecía solo cuando el reloj del navegador superaba su marca de tiempo. La ventana impresa en
la cabecera sigue estimándose en el navegador, porque es solo de visualización.
Su plazo está limitado por debajo del tiempo de espera de escritura del servidor, de modo que una sincronización lenta no pueda
sobrevivir a la conexión que lleva su respuesta.

Las marcas de tiempo de las tablas de uso son **milisegundos** de época; las tablas de identidad
más antiguas usan segundos de `unixepoch()`.

### Hechos de uso: qué lee el dashboard, y por qué sobrevive a los registros de solicitudes

Los registros de solicitudes (`usage_events`) y sus payloads capturados (`usage_inboxes`) crecen con
el tráfico y salen de la retención. Los números del dashboard no deben irse con ellos, así que cada
panel del dashboard lee **hechos de uso** (ADR 0062): `usage_facts_15m` y `usage_facts_daily`,
con clave por cubo, grupo de clave de cliente, modelo, alias de modelo, credencial, proveedor y tipo de autenticación,
y que llevan cada medida que imprime un panel (solicitudes, fallos, las columnas de tokens, sumas de latencia y
de primer token, y el costo en el momento de la solicitud con sus conteos de valoradas y de costeadas). Nunca
se podan. Crecen con las *combinaciones distintas de dimensiones por cubo*, no con las solicitudes.

`Repository.QueryUsageFacts` es la lectura única por la que pasa cada panel; las anteriores
`QueryUsageAnalytics`, `QueryUsageModelBuckets`, `QueryUsageProviderTotals`,
`QueryUsageCostWindow` y `QueryDailyTokenTotals` son proyecciones finas de ella. Un panel nuevo
añade allí una agrupación o una medida en lugar de escribir otro escaneo de `usage_events`.

Tres reglas mantienen exacta la lectura:

- **Ambas granularidades se pliegan en una transacción bajo un punto de control** (`facts` en
  `usage_aggregation_checkpoints`), de modo que las dos tablas siempre cubren el mismo conjunto de ids
  de evento. `AggregateUsageFacts` lo avanza en lotes acotados.
- **La división entre hechos y registros de solicitudes es un id de evento, nunca una marca de tiempo.** Un
  registro en el punto de control o por debajo está en los hechos; uno por encima no. Los tiempos de evento de CPA
  llegan desordenados, y una frontera por marca de tiempo contaría un registro tardío en ambos lados -
  de forma silenciosa en un total, y visiblemente errónea en un ranking por modelo. Los hechos y los
  registros sin plegar se leen en **una sola sentencia SQL**, de modo que el punto de control no puede moverse
  entre las dos mitades.
- **Un cubo solo se sirve desde una granularidad que lo divide.** Los días completos provienen de la tabla
  diaria, los cuartos de hora completos restantes de la tabla de quince minutos, y los bordes irregulares de la ventana de los registros de
  solicitudes en el punto de control o por debajo. Una cuadrícula más fina que
  quince minutos se lee solo de los registros de solicitudes, porque una fila de hechos no puede dividirse.

La granularidad fina es de quince minutos porque todo desfase UTC civil en uso es un múltiplo de
ella: un día de calendario local es un número entero de cubos en cualquier zona horaria de despliegue, lo
que una granularidad horaria no puede ofrecer (`+05:30`, `+05:45`).

**El horizonte de detalle.** Una vez que la pasada del ciclo de vida ha eliminado los registros de solicitudes anteriores a un
instante, los bordes irregulares y las cuadrículas finas más allá de él ya no pueden leerse. El instante se
persiste (`data_lifecycle_state.horizon_ms`, política `usage_detail`) en lugar de inferirse
de la fila superviviente más antigua, y siempre es un día UTC completo. `AlignUsageWindow` ensancha una
ventana que llega más allá de él a cubos de hechos completos y engrosa su cuadrícula a al menos
quince minutos; el `window` de la respuesta informa de los límites que realmente se leyeron.

**La ventana de todo el tiempo.** `preset=all` lo resuelve el servidor (`Handler.dashboardWindow`)
para empezar en el primer uso que el despliegue registró (`FirstUsageRecordMS`) y terminar ahora.
Solo los endpoints del dashboard lo aceptan: la lista de solicitudes lee registros de solicitudes, así que
conserva sus preajustes acotados y rechaza `all`. Un rango personalizado sigue limitado a 365 días.

### Por qué el desglose por modelo es su propio endpoint

Los dos paneles de modelos del dashboard - la tendencia de tokens por modelo y el anillo de uso por modelo - se sirven desde
su propio endpoint, `GET /management/dashboard/models`, con su propia consulta, su propia cadencia de actualización y
su propio modo de fallo. Tres propiedades lo hacen inadecuado para adjuntarlo a la respuesta de KPI, y cada una
es el mismo razonamiento que el ADR 0005 registró para la cuadrícula de tokens.

**Es la lectura más ancha de la página.** `QueryUsageModelBuckets` agrupa la ventana por modelo y
cubo, de modo que devuelve una fila por modelo por cubo donde los mosaicos devuelven una por cubo. Pasa
por la misma lectura de hechos de uso que los mosaicos, y la división por id descrita arriba es lo que hace seguro
un *ranking* por modelo: un registro tardío se cuenta una vez, así que no puede reordenar los modelos.

**Se mueve con su propia cadencia.** Los mosaicos de KPI sondean mediante `/management/dashboard/tail` hasta cada
cinco segundos; ese sondeo recalcula los agregados de la ventana. Adjuntarle la lectura agrupada
multiplicaría por doce la consulta más ancha de la página para redibujar un ranking que cambia cuando un llamador
cambia de modelo, lo que no es un evento de segundo a segundo. Los paneles sondean en un intervalo de un minuto para una
ventana deslizante y en absoluto para una cerrada.

Un rango cerrado tiene **límites** fijos, no contenido inmutable: los registros siguen llegando. Sus paneles simplemente no se releen con un temporizador, así que muestran lo que el rango contenía
cuando se obtuvo por última vez - razón por la que el botón de actualizar de la página los alcanza.

**Se le permite fallar solo.** Una lectura no disponible deja legibles los seis mosaicos y la cuadrícula de actividad a su
lado, que es el mismo razonamiento que puso `partial_errors` en la vista general y dio al mapa de calor
su propio endpoint.

**La agrupación es de la solicitud, no del panel.** El endpoint toma `group_by=call|model` (por defecto
`model`, y un valor desconocido es un 400 en lugar de una vuelta silenciosa al valor por defecto, para que un error tipográfico no pueda cambiar discretamente
lo que significan los números). La vista por llamada particiona las filas por punto de llamada - el alias de modelo que un cliente
solicitó, recurriendo al nombre del modelo upstream cuando no se estableció alias - de modo que un punto de llamada servido por
varias variantes upstream se lee como una línea, como lo nombra el vocabulario propio del despliegue; la
vista por modelo particiona por el nombre del modelo upstream exactamente como lo registró CPA. La elección viaja en la
consulta porque el ranking y el plegado son la respuesta única del servidor para exactamente una agrupación - una
reagrupación en el cliente de un ranking no podría además reordenar, replegar y reasignar colores sin
duplicar la lógica de plegado y dejar que se desvíe de la del servidor. La respuesta también lleva el gasto valorado de cada
grupo (`cost_usd`, nulo cuando nada del grupo estaba valorado) y `priced_requests`,
sumados solo sobre filas valoradas en el momento de la solicitud, de modo que una ventana con mucho sin valorar no pueda presentar un gasto
parcial como si fuera el total.

Dos detalles del plegado son críticos. El grupo del remanente lleva un booleano `folded` en lugar de un
nombre para mostrar reservado, porque la etiqueta la traduce el frontend y un despliegue puede
legítimamente servir un modelo cuyo nombre coincida con esa etiqueta; una prueba basada en el nombre
fusionaría tráfico real en el remanente o lo dividiría en dos. Y el ranking se desempata por nombre de modelo,
porque los volúmenes iguales son habituales (dos alias de un modelo, o una ventana donde cada uno recibió una solicitud)
y sin un orden total el orden vendría de la iteración del mapa, reordenando la leyenda bajo el
operador en cada sondeo.

`BenchmarkUsageModelBuckets` fija el costo de ambas rutas sobre 100 000 registros dentro de la ventana en una
máquina de desarrollo: unos 0,74 s mientras ninguno está plegado, y unos 0,02 s una vez que los hechos
los contienen. La primera cifra es el estado transitorio tras una actualización, antes de que el plegado se ponga al día;
la segunda es el estado estable, y sigue el número de filas de hechos, no el de solicitudes.

### Por qué la cuadrícula diaria de tokens pliega sus propios días

La lectura con ventana del dashboard y la cuadrícula de tokens de todo un año parecen la misma pregunta a
dos niveles de zoom, y no lo son - razón por la cual
`/management/dashboard/token-heatmap` es un endpoint separado con su propia consulta.

Dos propiedades de la lectura con ventana la hacen inadecuada para un calendario. Su ventana
se desliza, de modo que la misma serie es un lapso distinto cada vez que se pide. Y su cuadrícula es una
cuadrícula de *cubos* (`dashboardBucketWidth`), elegida para que un sparkline se mantenga cerca de 48 puntos.

Un día no es un cubo. Una granularidad horaria no puede dividir una hora UTC que cruza una medianoche
local con un desfase fraccionario: la India es `+05:30`, así que la medianoche local cae a las 18:30 UTC.
La misma aritmética es errónea para todos los días al otro lado de una transición
de horario de verano, no solo los dos días de transición, porque un único desfase no puede describir un
lapso que cruza una.

`Repository.QueryDailyTokenTotals` por tanto toma los días como rangos de instantes exactos,
construidos por el handler a partir de la zona IANA efectiva de Shell-PAMC con `time.Date`/`AddDate`. Como
todo desfase civil es múltiplo de quince minutos, cada uno de esos días es un número entero
de cubos de `usage_facts_15m`: la cuadrícula es una lectura de hechos de quince minutos sobre el lapso,
plegada en días en Go. Los días que no son contiguos o no están alineados a cuartos de hora se leen
uno a uno mediante la misma consulta de hechos.

La cuadrícula ya no depende de la retención de registros de solicitudes: un día cuyos registros han salido
sigue conservando sus totales. Un día anterior al primer uso del despliegue, o posterior en esta semana
a hoy, se informa como sin nada y se dibuja como *sin registrar*, en lugar de como un
cero medido que afirmaría que el gateway estuvo inactivo.
El panel la llama en un intervalo de cinco minutos y en una actualización explícita de la página, no con la cadencia del
sondeo de cola. La ventana del último día se detiene en el instante de lectura y no en la
medianoche siguiente, de modo que un registro con marca de tiempo futura no pueda inflar el total de hoy.

### Por qué la lista de solicitudes se ordena por `timestamp_ms`

El orden de la lista es la columna por la que el lector ordena a ojo, así que ambos deben coincidir.
`ListUsageEvents` ordena por `timestamp_ms DESC, id DESC`: primero la hora de solicitud
más reciente, con el id de fila como desempate.

`timestamp_ms` es cuándo *empezó* la solicitud, que es lo que imprime la columna de hora,
y por eso mismo la columna visible tiene que ser la clave de ordenación. Una
solicitud del agente puede durar minutos, así que ordenar por cualquier otra cosa pone una solicitud de larga duración
por encima de solicitudes que empezaron después de ella: el lector ve
`14:53:34`, luego `14:52:57`, luego `14:53:36` y concluye que la ordenación está rota.
Medido contra una instancia real, ordenar por id de fila invirtió **1329 de 5464** filas
adyacentes — aproximadamente una cuarta parte de la lista.

El desempate por `id` no es opcional. Varios registros pueden compartir una hora de inicio (un
cliente que se ramifica, o una fuente con granularidad de segundos), y sin un orden total la
frontera del conjunto de claves omitiría o repetiría filas mientras el lector pagina. El cursor es
por tanto una posición compuesta `(timestamp_ms, id)` aplicada como la comparación de filas
`(e.timestamp_ms, e.id) < (?, ?)`, no un predicado de una sola columna. Los cursores escritos
antes de que existiera este orden llevan solo un `id`; `resolveEventCursor` busca la marca de tiempo de la fila
para convertirlos, y un cursor que nombra una fila que ya no existe se
rechaza con `ErrUsageCursorStale` (HTTP 409) para que la consola reinicie en la página uno
en lugar de servir en silencio una página desde el lugar equivocado.

Este orden lo sirve `idx_usage_events_instance_time` (migración 018),
`(instance_id, timestamp_ms DESC, id DESC)`: el predicado del conjunto de claves y la ventana de
instancia/tiempo leen ambos de él, y el plan es una búsqueda de índice cubriente sin
B-tree temporal. El `idx_usage_events_instance_id` de la migración 021 ya no sirve el orden de
la lista; sigue siendo el índice para las búsquedas por `id` como la marca de agua de ingesta
detrás de la píldora «N registros llegaron» de la consola.

Esa píldora es el único lugar donde aún hay que distinguir los dos órdenes, porque
«registros nuevos» significa recién *registrados*, no la hora de solicitud más reciente. Una solicitud que
empezó hace una hora y terminó justo ahora es genuinamente nueva aunque se ordene muy por debajo de
la primera página, así que la consola cuenta las llegadas contra un id de ingesta
(`?since=<row id>`) en lugar de comparar las filas que ha cargado — lo que informaría
«nada nuevo» mientras los registros seguían entrando. En una instancia real **5415 de 5515**
registros se ordenan por debajo de la página uno, así que esa distinción es el caso normal, no un caso
límite. El conteo de llegadas se resuelve antes del escaneo de la lista, y el conjunto de resultados de la lista
se cierra antes de que la función regrese. Con una sola conexión SQLite, emitir el
conteo después de la lista podría mantener ambas sentencias en la misma instantánea WAL,
de modo que un registro confirmado entre sondeos seguiría invisible hasta que una
transacción posterior lo reemplazara. La aceptación compilada precomitea una llegada dedicada
ya dentro de la ventana del servidor. Su compuerta de disponibilidad del fixture retiene
solo esa fila hasta que el lector entra en Hold, preservando la línea base con lecturas reales de la API,
y luego reenvía sin cambios las respuestas posteriores. El sondeo ejercita por tanto
el conteo real basado en ID sin depender de la duración del arranque ni de un segundo escritor.

La *hora* de solicitud es también la clave de ventana (`timestamp_ms >= from AND <= to`) y el
eje de cada agregación y gráfico, así que la lista, la ventana y los gráficos coinciden todos en
qué significan los números.

### Alias de claves de cliente: una identidad, dos propósitos

Los nombres asignados por el operador a las claves de cliente del gateway viven en `client_key_aliases`
(migración 022), con clave `(instance_id, key_fingerprint)`.

La huella es `usage_events.api_group_key`, que es `security.Fingerprint`
bajo el propósito **`usage-api-key`** (`repository.UsageClientKeyPurpose`). El
propósito forma parte de la entrada del HMAC, de modo que la misma clave con hash bajo otro
propósito es un valor sin relación - y eso es exactamente lo que hacía antes la lista de claves:
calculaba la huella bajo `client-key`, produciendo una identidad que no coincidía con **ningún**
registro de solicitud. Un alias escrito contra ese valor nunca podía etiquetar nada.
`ClientAPIKeyItemDTO` por tanto lleva ambas: `fingerprint` (el valor heredado de la página,
conservado por compatibilidad) y `usage_fingerprint` (la identidad que permite el join).

Tres consecuencias dan forma a la implementación:

- **La identidad es la huella, nunca un índice de arreglo ni una máscara.** Reordenar la lista
  `api-keys` de CPA mueve un índice, y una máscara conserva solo una cabeza y una cola cortas, de modo que
  dos claves pueden compartir una. Cualquiera de las dos pondría el nombre de una clave en los registros de otra.
- **Los alias nunca se podan.** Las solicitudes conservan su `api_group_key` para siempre, así que el
  historial de una clave eliminada sigue necesitando su nombre; un alias pertenece a la identidad, no
  a la configuración actual. Renombrar es resolución en tiempo de lectura, de modo que cambia cómo se leen
  las filas históricas sin reescribir un solo registro de uso.
- **Las escrituras de alias nunca tocan la configuración de CPA.** Nombrar una clave son
  metadatos de Shell-PAMC con su propio endpoint, porque encaminarlo por `PUT /config.yaml`
  rotaría la revisión para todos los demás editores y reescribiría un secreto que el
  operador no tocó.

La resolución es una única búsqueda `IN` por lotes por página (deduplicada, dividida en fragmentos de 500
parámetros), no una consulta por fila, y es de mejor esfuerzo: un fallo deja
`api_key_alias` vacío y la consola recurre a la máscara en lugar de hacer fallar
la lista. La huella sigue siendo la identidad del filtro, de modo que un cambio de nombre no puede alterar
lo que selecciona un filtro guardado o un enlace de profundización.

Como ni una máscara ni un índice pueden sustituir al valor, la lista de claves es
el único lector que se lo pide a la API de gestión: `/management/api-keys` envía
`ClientAPIKeyItemDTO.Key` como máscara de visualización salvo que el llamador opte por
`?include_keys=true`, que es la bandera que ya usa la lista de proveedores. La página de claves
opta por ella, une la superposición por ese valor y mantiene su propia entrada de caché de consultas
para que al selector de claves del dashboard — que solo necesita la máscara — no se le puedan servir
los valores, y a la página de claves no se le puedan servir las máscaras (ADR 0015).

### El tráfico de un proveedor se acredita a la clave que lo sirvió

El número de tráfico de la fila de un proveedor responde «cuánto sirvió este proveedor», y la
etiqueta `provider` de CPA en un registro de uso no puede responderlo. Para una solicitud con clave de API CPA escribe
la *familia* de la credencial (`codex`, `claude`, `xai`, ...) — la misma palabra que escribe para
el canal OAuth de la familia — de modo que una etiqueta cubre a varios proveedores distintos a la vez, y
la coincidencia que invita (familia, nombre para mostrar o subcadena) acredita a un proveedor que no
ha servido nada con el tráfico de otra superficie. El dato que sí identifica la clave
ya está en el registro: el `auth_index` de runtime de la credencial.

`/management/dashboard/providers` por tanto responde con dos listas en lugar de una.
`QueryUsageProviderTotals` lee los hechos de uso agrupados por `UsageGroupProviderCredential`
(`usageFactGroupExpressions` en `internal/repository/usage_facts.go`): la etiqueta de proveedor
que escribió CPA y `CASE WHEN auth_type = 'apikey' THEN auth_index ELSE '' END`;
`internal/api/management_dashboard_providers.go` pliega las filas de índice vacío en
`providers[]` por la etiqueta que escribió CPA — los canales OAuth, y los registros que no nombran
ninguna credencial — y el resto en `credentials[]`, una entrada por clave que sirvió tráfico.
El tráfico de un proveedor configurado es la suma sobre los índices de sus propias claves, que
el DTO del proveedor publica como `auth_indexes` (`internal/api/management_providers.go`),
más lo que una etiqueta le atribuya — nunca una reclamación general sobre registros sin índice, que
no llevan ninguna identidad de proveedor. Solo una fila de `openai-compatibility` toma una etiqueta: exactamente
la etiqueta `openai-compatible-<name>` que CPA deriva del propio nombre de ese proveedor, o, cuando la
fila es una que la consola presenta como canal OAuth, la etiqueta de ese canal como siempre se han
emparejado las filas de canal. Un proveedor `{family}-api-key` no toma ninguna — ni siquiera cuando su nombre para mostrar
escribe una familia — porque esos registros los sirvieron credenciales distintas, y las etiquetas de familia
pertenecen al canal OAuth de la familia. Solo un nombre que **CPA** lleva convierte una fila en canal:
el nombre para mostrar es una preferencia del operador que el navegador puede cambiar, así que un cambio de nombre no debe entregar a un
relé el canal cuyo nombre toma prestado.

Seis propiedades son críticas:

- **El join es una identidad, nunca una heurística.** Ni coincidencia de familia, ni de nombre
  para mostrar, ni de subcadena, ni «la única clave del proveedor»: cada una de ellas es errónea en el
  caso para el que existe esta regla — un segundo proveedor de la misma familia, o un proveedor
  creado hace un momento — y un número confiadamente erróneo es peor que uno estrecho.
- **Cada proveedor configurado es su propia fila.** Las filas ya no se fusionan ni se omiten por
  nombre, así que dos proveedores con el nombre por defecto de CPA, y dos claves de una misma familia, cada uno
  informa su propio conteo en lugar de colapsar en una fila y un guion. Solo una fila de
  `openai-compatibility` reclama para su propio nombre las filas de etiqueta del gateway, que es
  la identidad que llevan sus solicitudes; un proveedor de claves configurado cuyo nombre para mostrar escribe un
  canal es otra cosa y deja en pie la fila de ese canal.
- **El conteo de credenciales de un proveedor es el suyo propio** (`key_entries`, o `auth_indexes` para una
  clave que CPA informa sin máscara). El recuento por tipo del gateway cuenta archivos de autenticación,
  y varios de esos ids de tipo se comparten con las familias de claves de API, así que tomar el conteo
  de allí informaba credenciales que el proveedor no posee. Lo inverso vale para una
  fila de canal: CPA también lista una entrada de runtime (tipo de cuenta `api_key`) por cada
  clave `{family}-api-key` configurada bajo el tipo de la familia, de modo que el
  `credentials.by_type` de la vista general informa esa parte como `api_keys` / `api_keys_disabled`. Una
  fila de canal cuenta y lee solo los archivos de autenticación, una fila de familia configurada lee solo
  sus claves, y un tipo que no contiene más que claves configuradas no tiene fila de canal.
  Una vez leído `credentials`, el recuento es la única evidencia de que existe un canal OAuth
  — incluido un `by_type` vacío. El bucket `providers[]` en vivo de la vista general cuenta
  cada clave que el uso de CPA lista bajo la etiqueta de una familia, claves de API incluidas, así que
  sustituye a una fila o conteo de canal solo mientras falló la lectura de archivos de autenticación (`credentials` es
  `null`).
- **Un registro que no nombra índice no se acredita a nadie.** El historial escrito antes de que se capturara el
  índice, y un registro cuya credencial CPA ya no tiene — conserva el índice bajo el que
  se sirvió, que ningún proveedor configurado publica — no cuentan para ningún proveedor configurado.
  Permanecen en los totales y en la lista de solicitudes. La alternativa es la inferencia, y la inferencia es
  lo que produjo el defecto para el que existe esta regla.
- **Un índice que dos proveedores publican no se acredita a ninguno.** CPA deriva el índice de runtime de una credencial
  de la propia credencial, así que una clave introducida dos veces bajo un mismo nombre se resuelve en
  un solo índice. Acreditar a la fila que la lista ponga primero imprimiría un número que
  cambia con el orden de la lista de proveedores.
- **Una etiqueta es una identidad, con la precisión de CPA.** `deep-seek` y `deepseek` son dos etiquetas para
  CPA y siguen siendo dos filas aquí; la consola no debe plegarlas mediante un normalizador que elimine
  separadores para buscar una etiqueta, y debe conservar la etiqueta que plegó el servidor en lugar de
  volver a derivarla de un nombre para mostrar.

El panel muestra las primeras ocho filas de ese orden y pliega el resto tras un
interruptor de «mostrar todo», para que una flota de decenas de proveedores no empuje cada panel
debajo de ella fuera de la página; el orden pone primero los canales que sirven por volumen, de modo que el plegado oculta
la cola silenciosa.

La página de proveedores reutiliza esta agregación en lugar de reimplementarla
(`providerTrafficById` en `web/src/components/providers/providerOverview.ts`), de modo que el
panel del dashboard y la lista de proveedores no puedan acreditar una solicitud a dos filas
distintas.

### Máscaras de claves de proveedor: qué clave upstream respondió

Un registro de solicitud nombra a su proveedor, y un operador que lo lee necesita un dato más
— por cuál de las claves de ese proveedor pasó realmente la solicitud. CPA
no pone esa clave en el payload de uso: publica el `auth_index` de runtime de la credencial
y nada más. Las claves existen solo en la configuración de CPA, así que la
máscara se resuelve en el servidor mientras se lee la lista de solicitudes, y se devuelve en cada
registro como `provider_key_mask`.

`internal/api/usage_provider_key_masks.go` es responsable de esa resolución. Lee las
listas de credenciales que CPA informa actualmente — las familias de claves de API de la configuración y los
proveedores `openai-compatibility` — e indexa cada una por índice de autenticación.

**La propia etiqueta de proveedor del registro elige la lista, y una etiqueta no reconocida no es
candidata en absoluto.** CPA etiqueta una credencial de clave de API de la configuración con el nombre de la familia
(`codex`, `claude`, `gemini`, `meta`, `xai`, `vertex`, `interactions`) y una credencial de compatibilidad con
`openai-compatible-<upstream name>`
(`management.OpenAICompatibilityLabelPrefix`, la misma constante que usa la agrupación de proveedores del
dashboard). Esas dos formas son las de una solicitud atribuible;
cualquier otra cosa — un proveedor solo OAuth, una familia que la consola no gestiona —
no lee nada, de modo que un índice que casualmente colisione entre listas nunca puede ser respondido
por la equivocada. Dentro de cada lista la coincidencia es solo por índice, deliberadamente:
renombrar un proveedor de compatibilidad en CPA cambia la etiqueta de los registros posteriores mientras la
credencial, y el índice de CPA para ella, siguen igual, así que una coincidencia limitada por nombre
dejaría huérfano un historial que sigue siendo perfectamente identificable.

Cuatro propiedades son críticas:

- **Se resuelve contra la configuración tal como se lee, no como estaba en el momento de la
  solicitud.** Una credencial que se ha rotado o eliminado desde la solicitud deja
  de ofrecerse como propietaria de ese índice, de modo que ese registro no imprime nada una vez que la lectura
  en caché de su lista caduca — de inmediato si el operador la eliminó mediante esta consola,
  y dentro del TTL si se cambió fuera de ella. La consola no puede reconstruir una
  clave que ya no puede leer, y una máscara de aspecto plausible sería una invención
  y no una etiqueta de visualización.

  Un proveedor que simplemente ha sido **desactivado** deliberadamente no se trata como una
  eliminación. CPA no informa índice de autenticación para un proveedor de compatibilidad desactivado, de modo que esa
  entrada no reclama nada de todos modos, mientras que filtrar por la bandera además ocultaría la
  clave de una solicitud servida *antes* de desactivar el proveedor — el estado actual del proveedor
  no forma parte de la identidad de la credencial, y esa etiqueta es un hecho verdadero
  sobre la solicitud y no uno erróneo. Un índice reclamado tanto por una entrada desactivada como por una
  activa se resuelve en nada, de modo que se conserva la protección que importa.
- **No se adivina nada.** Un índice que ninguna entrada reclama, una clave que CPA informa sin
  índice (el arreglo heredado `api-keys` de la lista de compatibilidad), un índice que reclaman dos entradas,
  un registro sin ningún índice y un proveedor que tiene exactamente una clave pero
  no reclama el índice del registro se dejan todos vacíos. El caso duplicado se resuelve
  en nada incluso cuando las dos máscaras son idénticas, porque ni un índice ni una
  máscara son una identidad — la misma regla que sigue el join de recursos.
- **Solo una credencial de clave de API tiene una.** Un registro OAuth nombra en su lugar la cuenta que usó,
  y su índice vive en la misma columna, de modo que una comprobación del tipo de autenticación se interpone
  ante la búsqueda. La máscara es solo de visualización, no se almacena en ninguna fila, nunca es
  un valor de filtro, y la propiedad está ausente y no vacía cuando nada se resolvió;
  solo la salida de `security.MaskSecret` sale jamás del proceso, y una lectura fallida se informa mediante el mismo clasificador público
  que usa todo otro fallo del gateway, porque el cuerpo de un error de gestión puede repetir la credencial que rechazó.
- **Es de mejor esfuerzo y está acotada.** Las listas se leen como máximo una vez por TTL, una
  lectura la comparten las páginas concurrentes, los fallos se almacenan en caché negativa, y todo el
  enriquecimiento tiene su propio plazo corto. Un gateway caído, lento o sin una
  familia deja las máscaras vacías y devuelve la lista de solicitudes sin cambios, porque una
  etiqueta de visualización no debe poder hacer fallar la página cuyo trabajo es mostrar el historial de
  solicitudes. Una escritura mediante esta consola descarta la lectura en caché, de modo que una edición se
  refleja de inmediato; una lectura que ya estaba en vuelo cuando esa escritura aterrizó se
  retiene además de no almacenarse, ya que la lista que vio es la que se está reemplazando.

### Derivación del estado de streaming y del rendimiento (TPS)

Los payloads de uso de CPA incluyen un campo booleano `stream` que indica si la solicitud
se ejecutó en modo streaming. Shell-PAMC lo registra en `usage_events.stream`
(migración 023) como un entero anulable: `1` para streaming, `0` para no streaming,
y `NULL` para filas históricas donde no se capturó la bandera.

La bandera es metadato operativo, no un clasificador suficiente de la validez del TTFT.
Un ejecutor upstream puede capturar un evento real de primer token incluso cuando el cliente
solicitó `stream: false`, mientras que una solicitud aparentemente de streaming aún puede recibir
todo su payload en un solo fragmento. `eventTokensPerSecond` en
`web/src/types/usageEventMetrics.ts` deriva las tasas de tokens de salida usando la preferencia
`omc_tps_calculation_mode` del despliegue:

- `exclude_ttft` (por defecto): resta un `ttft_ms` finito y positivo solo cuando es menor que la
  latencia total y `latency_ms - ttft_ms >= MIN_STREAMING_GENERATION_WINDOW_MS` (50 ms).
  El TPS es entonces `output_tokens * 1000 / (latency_ms - ttft_ms)`. En caso contrario usa
  `output_tokens * 1000 / latency_ms` e identifica el resultado como alternativo (fallback).
- `include_ttft`: usa siempre `output_tokens * 1000 / latency_ms`, incluso cuando el TTFT es
  medible. Esto no oculta ni invalida la lectura independiente del TTFT.
- Los registros que no son de generación, los tokens de salida no positivos o no finitos y la latencia
  total inválida no tienen TPS. El tiempo transcurrido restante puede incluir llamadas a herramientas del lado del servidor;
  la resta no es una medida del tiempo puro de generación.

`TokenDisplayProvider` es dueño del ajuste mediante el hook de preferencias existente, optimista y serializado
por clave. Los Ajustes de Shell-PAMC y las filas de solicitudes comparten
un solo valor; cambiarlo recalcula las lecturas históricas sin tocar las observaciones almacenadas.
El resultado del cálculo expone `basis` (`exclude_ttft`, `include_ttft`, `fallback_total`
o `null`) para que ambas superficies seleccionen el mismo tooltip de fórmula exacto. La lista cerrada de permitidos de
la API de preferencias acepta la nueva clave usando su contrato existente de documento JSON. Los valores ausentes o
no admitidos se resuelven a `exclude_ttft`; no se necesita migración.

`internal/operations/tps_calculation.go` registra `tps_calculation_get` y
`tps_calculation_set` para los administradores tanto del Agent como de MCP. La escritura de bajo riesgo valida
sus dos valores de modo, devuelve `invalid_parameters` en caso contrario, persiste mediante el mismo
repositorio e invalida `preferences`. Las lecturas devuelven el modo efectivo usando
`internal/repository/tps_calculation.go`.

La lista de solicitudes y el drawer de detalle muestran una insignia de no streaming cuando un registro
explícito `stream: false` no tiene TTFT medible o cuando la ventana residual observada
colapsó. Los registros históricos (`stream IS NULL`) usan la misma heurística de ventana residual,
preservando las observaciones genuinas heredadas de primer token sin inferir un
límite de primer token a partir de una medición solo de finalización.

### 6.1 El vocabulario de filtros de registros de solicitudes

`UsageEventFilter` en `internal/repository/usage_events.go` es el único vocabulario de filtros
para todo el conjunto de funciones de registros de solicitudes. Las dimensiones se combinan con AND;
los valores dentro de una dimensión se combinan con OR, de modo que una lista vacía significa «no estrechar
esta dimensión» y un multiselector vaciado es indistinguible de uno que
nunca se estableció.

La consola envía un multiselector como un **parámetro de consulta repetido**
(`?model=a&model=b`), nunca como una lista delimitada. Una coma es un carácter legal en
un nombre de modelo, una etiqueta de origen y una máscara de llamador, así que dividir por ella corrompería
los valores exactos por los que se filtra. Una sola aparición todavía se interpreta, lo que mantiene
funcionando sin cambios los enlaces de profundización escritos antes de que existiera el multiselector.

| Dimensión | Parámetro de red | Coincidencia |
| --- | --- | --- |
| Modelo / alias / proveedor / clave del llamador / índice de autenticación / origen / tipo de autenticación / ejecutor / esfuerzo de razonamiento / nivel de servicio | mismo nombre, repetible | exacta, OR dentro de la dimensión |
| Nivel de servicio resuelto | `resolved_service_tier`, repetible | evidencia de modo consciente del proveedor; el nivel de la solicitud original sigue siendo `service_tier` |
| Búsqueda de identidad | `q` | subcadena literal en las columnas de `usageEventSearchColumns` |
| Endpoint, user agent | `endpoint`, `ua` | subcadena literal |
| Id de solicitud | `request_id` | exacta |
| Patrón | `regex` como `field:pattern` | RE2, sin anclar, contra uno de `model`, `model_alias`, `response_model`, `provider`, `endpoint`, `ua`, `request_id`; un valor ausente coincide como cadena vacía |
| Latencia / tokens | `latency_min`…`tokens_max` | límites enteros inclusivos |
| Costo | `cost_min`, `cost_max` | límites inclusivos en USD decimal, con a lo sumo nueve dígitos fraccionarios |
| Disponibilidad de precio | `cost` | `priced` (`cost_nanos IS NOT NULL`) o `unpriced` |
| Modelo servido | `served` | `substituted` (`model_substituted = 1`) o `matched` (un modelo informado por upstream que es el solicitado); un registro cuyo upstream no informó modelo no está en ninguno |
| Resultado | `result` | `all`, `success`, `failed` |

El filtro de patrón es el único lugar donde el texto de un llamador se ejecuta en lugar de compararse,
y tres decisiones lo mantienen seguro. El motor es `regexp` de Go (RE2), registrado como la función
`REGEXP` de SQLite en `internal/repository/usage_regex.go`, de modo que la coincidencia es lineal en la
entrada y un patrón no puede detener un escaneo; los patrones se limitan a 256 caracteres y se compilan
una vez por patrón distinto. El campo es un nombre buscado en un mapa cerrado, nunca texto colocado
en la sentencia, y las columnas con huella (`source`, la clave del llamador) están ausentes de
él porque ningún patrón que escriba un lector puede describir una huella. Y el campo y el patrón
viajan como un solo parámetro, de modo que ninguno puede aplicarse sin el otro. Un campo desconocido, un
patrón demasiado grande o uno que RE2 rechaza (lookaround, referencias hacia atrás) es un 400 con el motivo.
Las funciones de usuario pertenecen a la instancia del driver que registra el paquete SQLite, razón por la cual
`openGatedPool` envuelve esa instancia en lugar de construir la suya.

Tres propiedades son críticas y no incidentales:

- **La búsqueda es literal.** `%` y `_` se escapan con un
  `ESCAPE '\'` explícito, porque el `LIKE` de SQLite no tiene carácter de escape por defecto:
  sin tratar, buscar `50%` coincidiría con todas las filas y `gpt_5` también
  coincidiría con `gpt-5`. La disyunción entre columnas va entre paréntesis, o sus `OR`
  sueltos se unirían más débilmente que los `AND` circundantes y descartarían en silencio
  todos los demás filtros.
- **Los límites son punteros.** `0` es un límite con significado (`max_cost=0` selecciona los
  registros valorados en nada), así que no puede hacer de «sin establecer». `cost_nanos` se
  compara directamente, lo que significa que una fila sin valorar no satisface ni un límite inferior ni uno
  superior — solo es alcanzable pidiendo `cost=unpriced`. Los límites de costo
  llegan como USD decimal y se escalan a nanos enteros en forma de cadena, de modo que un
  límite de `0.1` no pueda caer por debajo del valor que pretendía incluir. La precisión
  se **rechaza en lugar de redondearse**: un límite de `0.0000000001` excede lo que almacena la
  columna, y redondearlo a cero respondería una restricción real con «ningún
  costo en absoluto». La consola por tanto lleva los límites de costo como cadenas decimales de extremo
  a extremo — campo, URL y documento de preferencias — porque una cantidad en nano-dólares no
  sobrevive a un viaje de ida y vuelta por un double.
- **Los valores de diagnóstico están protegidos, no son campos de lista.** `client_ip` y
  `x_forwarded_for` se conservan como la dirección exacta del par y la cadena de proxy válida
  completa para la vista de detalle de un solo registro, mientras que las cargas de lista y el
  cuadro de búsqueda compartido omiten ambos. `endpoint` está igualmente disponible solo en el detalle.
  `source` y `api_group_key` se convierten en huella en la frontera de persistencia, de modo que
  un filtro coincide con la huella almacenada que ofreció la faceta, nunca con el texto plano.
  Las filas históricas escritas bajo la política anterior de `/24` y `/64` siguen enmascaradas;
  no se adivinan ni se rellenan.
- **La proyección de direcciones tolera formas y es explícita.** `NormalizeClientIP`
  acepta IPv4, IPv6 y formas válidas host:puerto y elimina el puerto de transporte;
  `NormalizeForwardedFor` conserva en orden cada salto válido. Un endpoint llega como
  la línea de solicitud que CPA atendió (`POST /v1/chat/completions`), no como una ruta desnuda,
  de modo que `PublicEndpoint` conserva el método mientras elimina la consulta, el fragmento y las
  credenciales de la autoridad. Las pruebas de ida y vuelta pasan un payload sin procesar por la decodificación *y* la
  inserción, demostrando que el valor protegido del detalle sobrevive a ambas fronteras sin
  ampliar el contrato de la lista.

### 6.2 Facetas

`GetUsageFacets` enumera los valores realmente presentes en una ventana para que un desplegable
nunca ofrezca una opción que no devuelva nada. Una sola sentencia SQL materializa una CTE
estrecha `facet_window` a partir de la ventana indexada de instancia/tiempo, y luego agrupa cada una de
las diez dimensiones sobre esa relación en lugar de recorrer diez veces la tabla ancha de detalle.
Cada dimensión sigue excluyendo solo los valores vacíos, ordena por conteo descendente
y valor ascendente, y limita a 200. Las máscaras de claves de llamador conservan la máscara almacenada no vacía
máxima y la normalización; los resultados vacíos siguen siendo arreglos. Todas las dimensiones comparten una
instantánea de sentencia. La materialización usa almacenamiento temporal de SQLite proporcional a
las filas seleccionadas; no se introduce ningún mapa de cardinalidad ilimitado en Go ni cambio de conexión.
`BenchmarkUsageFacets`, `BenchmarkUsageFacetsStrategies` y
`BenchmarkUsageFacetsNarrowWindow` siguen ventanas dispersas, pobladas/de alta cardinalidad y selectivas.
El endpoint y el user agent deliberadamente **no** son facetas: ambos son valores
largos y de alta cardinalidad donde una subcadena escrita supera a una lista limitada de 200 filas,
y el endpoint nunca debe entregarse al navegador en absoluto.

Las facetas se leen con su propia revisión de ventana y no con el contador de sondeo de la lista, y se almacenan en caché con un `staleTime` de cinco minutos. Describen qué valores
existen en una ventana, de modo que cambian solo cuando se redefine la ventana (un nuevo preajuste
o rango absoluto) o el operador actualiza explícitamente — no en cada sondeo de la lista.
Esa actualización manual es la misma sincronización descrita en §6: la página espera la extracción
y la barrera de decodificación, y luego vuelve a leer la lista, las facetas y el estado del pipeline.
La ventana se envía sin resolver (véase «Quién resuelve la ventana de la lista de solicitudes»), de modo que un
preajuste son los mismos parámetros en cada visita. La clave de consulta de facetas por tanto también
lleva una revisión estampada cuando se define la ventana y en cada actualización manual,
y nada más: un cambio de filtro conserva la entrada en caché, porque la lectura de facetas
no lleva filtro, mientras que un preajuste reintroducido o una actualización nunca se responde desde una
entrada aún dentro de su `staleTime`.
El escenario `refresh-sequencing` en `scripts/acceptance/scenarios.mjs` afirma esto
directamente mediante `refreshRecords`: una actualización manual emite
un `POST` a `/usage/ingest/refresh` *y las lecturas de lista y facetas esperan a que termine*.
Los conteos de solicitudes por sí solos no pueden establecer ese orden — una página que disparara las tres
en paralelo aún emitiría las tres — así que la sonda mantiene abierta la respuesta de la extracción
y exige que no ocurra ninguna lectura de lista o facetas mientras se mantiene. Como la
respuesta está limitada a 200 valores por dimensión, un valor que está seleccionado pero ausente
de ella se fusiona de nuevo en las opciones, de modo que un filtro que sigue aplicado nunca
se renderiza como un control en blanco.

### 6.3 Agrupación de la lista de solicitudes

La lista ofrece tres modos: cronológico (`time`, el predeterminado), `source` y
`ua`. `source` fusiona lo que antes eran dos modos separados, «por proveedor» y «por
credencial»: eran el mismo eje a dos niveles de zoom, así que un modo agrupa por
proveedor más credencial y decide, por proveedor, si vale la pena imprimir la mitad de la credencial.
Esa decisión es una propiedad de la *página*, no de un cubo —
`providersWithMultipleAuthSources` la responde para cada proveedor en la ventana
cargada — de modo que una línea servida por una sola credencial se lee como el proveedor solo,
mientras que una dividida entre dos nombres muestra ambos.

Las claves y etiquetas de agrupación se calculan en `web/src/types/usageEventGrouping.ts` y
`web/src/types/usageEventLabels.ts`, que es lo que carga el arnés de pruebas de lógica,
y se fijan allí y no leyendo el DOM. Dos propiedades importan más allá de
las etiquetas:

- **La preferencia almacenada migra.** `parseUsageEventsView` asigna los valores retirados
  `provider` y `credential` a `source`, de modo que un operador que vuelve a una
  vista guardada la conserva en lugar de ser movido en silencio al orden cronológico. Un
  valor ilegible recurre a `time`, que es el modo que nunca oculta un
  registro.
- **Desconocido es un cubo, no un descarte.** Un registro sin proveedor, sin credencial o
  sin user agent se agrupa bajo `unknown` y conserva su propio encabezado, porque
  «no se registró nada» es un hecho sobre el registro que vale la pena ver.

El modo UA usa el `user_agent` almacenado literalmente: el valor ya se redujo
a una etiqueta corta de producto en la ruta de persistencia, así que la agrupación no debe volver a analizar una
cabecera sin procesar ni ampliar lo que deliberadamente se minimizó.

## 7. Flujo de precios

El catálogo, el precio actual editable y el historial inmutable de versiones son
cosas separadas (ADR 0003); OpenRouter es la única fuente automática, y un precio
lleva niveles y se escala por canal (ADR 0030). El diseño, la cadena de coincidencia
y los límites están en `docs/plans/model-prices.md`.

El barrido de descubrimiento de CPA devuelve tanto los destinos de alias como la pertenencia no secreta a proveedores. La migración 029 añade `pricing_catalog_state.providers_json`; el repositorio publica esos metadatos en la misma transacción que `pricing_model_catalog`, y el acceso a precios requiere la migración 029. Los destinos de precio vacíos representan alias ambiguos y son entradas de catálogo válidas, pero no pueden coincidir automáticamente. Los metadatos del proveedor llevan solo el nombre de host del endpoint para la resolución de íconos de marca existente, nunca credenciales de URL, rutas ni cadenas de consulta. La respuesta de precios proyecta localmente las superposiciones de nombre para mostrar e ícono del proveedor; el espacio de trabajo no hace solicitudes de red por modelo ni por credencial. La capacidad existente `pricing_list` también devuelve la pertenencia de los modelos de su página actual.

El libro de precios agrupa por los proveedores de clave de API/OAuth realmente configurados, ordena los grupos por prioridad de enrutamiento y luego por nombre, y renderiza como máximo 20 pertenencias de modelo por página entre todos los grupos. Las marcas de proveedor aparecen solo en los encabezados de grupo, con los modelos individuales renderizados como texto. La búsqueda y los filtros reinician la paginación en ambos diseños de viewport. El `ResponsiveList` compartido también controla y acota de forma coherente el estado de página en escritorio y teléfono.

```text
CPA catalog read ──▶ pricing_model_catalog      (last complete snapshot)
                          │
openrouter.ai/api/v1/models ──▶ pricing_upstream_catalog (last complete download)
                          │
                          ▼
                   pricing.Service ──▶ model_prices ──triggers──▶ model_price_versions
                   (auto match, pins in                           (immutable, time-effective)
                    pricing_model_links;
                    custom rows win)
operator ──▶ pricing_channels ──triggers──▶ pricing_channel_versions (immutable)
operator ──▶ channel_model_prices ──triggers──▶ model_price_versions (channel-scoped)
```

`usage_events` almacena, en la propia transacción de inserción del evento y por la marca de tiempo
de la solicitud, el id de versión de precio, el id de versión de canal (ausente significa 1×), el
índice del nivel para el que calificó la solicitud y los nanos de USD enteros calculados por
`pricing.Quote`. `pricing.ResolveServiceTier` interpreta la evidencia registrada:
Codex usa primero un `effective_service_tier` saliente final no vacío, capturado por
CPA v8.0.39 tras la traducción y las reglas de payload. Un `auto` saliente no selecciona ningún carril
y no recurre a la elección del cliente. Sin esta evidencia, Codex mantiene
su política de nivel solicitado incluso cuando su respuesta dice `default`/`auto`: un nivel de
cliente ausente puede usar la respuesta, mientras que un `auto` explícito del cliente no selecciona ningún carril.
Los demás proveedores siguen priorizando la respuesta con la solicitud como respaldo. La identidad del proveedor o un ejecutor concreto de Codex identifica esta política,
nunca un nombre de modelo ni una etiqueta para mostrar del proveedor.

La migración 045 fija el `billed_service_tier` seleccionado y su
`billed_service_tier_source` junto al monto, incluida una selección vacía.
Ambos son inmutables. NULL identifica instantáneas históricas, cuyo desglose conserva
la política original que prioriza la respuesta. La API expone la interpretación actual
como `resolved_service_tier`/`resolved_service_tier_source` para indicadores de modo y
exportaciones; una función determinista de SQLite llama al mismo resolvedor para filtros y
facetas, incluidas las filas históricas. El desglose de costo en cambio explica la
selección originalmente fijada. La migración 046 preserva todos los campos de solicitud, índices,
triggers de inmutabilidad y la marca de agua máxima de id de solicitud mientras añade
`effective_service_tier` y permite la fuente de instantánea `outbound`. La telemetría
ausente mantiene la política existente por registro, incluso para CPA más antiguo, colas
mixtas y degradaciones de CPA. CPA omite los niveles salientes vacíos, así que un campo ausente
no puede distinguir a un publicador más antiguo de una regla de payload que eliminó el nivel;
Shell-PAMC no infiere ese hecho de la versión del gateway, la configuración ni la latencia.
Los totales históricos nunca se unen a las tablas mutables, de modo que una edición posterior
no pueda reescribir una factura. Una solicitud sin versión de precio vigente se almacena
con estado de precio `unpriced` (`legacy_unpriced` para filas anteriores a la migración
019), costo ausente, y nunca se rellena retroactivamente. El detalle de la solicitud recalcula un
desglose a partir de las versiones fijadas para mostrarlo; el monto almacenado sigue
siendo la autoridad.

La migración 043 añade precios personalizados opcionales con clave por el canal CPA registrado y el
modelo upstream (ADR 0101). El bloqueo de la solicitud resuelve primero el historial de ese alcance;
un override ausente o con lápida selecciona el historial de modelo compartido. El multiplicador
de canal existente se sigue aplicando. Los historiales compartidos usan un canal vacío, de modo que los ids de
versión antiguos y los montos fijados no cambian. El editor lleva el canal
por separado del modelo y valida las escrituras contra la pertenencia al proveedor.

Una sincronización descarga fuera del bloqueo de escritura y luego vuelve a leer precios y fijaciones bajo él,
de modo que se respeta una fijación del operador hecha durante la descarga. La conciliación del catálogo
cada cinco minutos valora un modelo que CPA empieza a servir a partir de la instantánea almacenada,
sin llegar a la red. Toda superficie que muestra un costo abre el mismo
editor de precios en el lugar (`web/src/components/pricing/`).

## 8. Flujo de cuota

`internal/quota` llama al `/api-call` de CPA con la credencial bajo observación para
llegar al propio endpoint de uso del proveedor. Los destinos se restringen a
`AllowedURLPrefixes` — una lista de permitidos en tiempo de compilación de endpoints HTTPS oficiales — y
la instantánea resultante se normaliza y se almacena en `quota_snapshots`. Las observaciones de cuota
y los adaptadores fijos de calentamiento de credenciales son los únicos proxies de solicitudes de CPA iniciados por el servidor
(ADR 0097): no existe ninguna URL suministrada por el usuario ni superficie genérica de `/api-call`.

Las credenciales internacionales de Kimi usan el único endpoint permitido
`https://api.kimi.ai/coding/v1/usages` en lugar del host nacional de Kimi.
`kimiUsageURLFor` selecciona el sistema de cuenta a partir de metadatos seguros de la credencial sin
leer tokens ni intentar un segundo host. Las entradas de endpoint rechazan rutas añadidas;
las entradas que terminan en `/` cubren una familia (ADR 0064).

Las observaciones de Meta y las lecturas de suscripción de xAI/Antigravity usan cuatro endpoints
individuales adicionales (ADR 0065); los dos documentos de facturación de xAI comparten uno de ellos,
distinguidos por una consulta que esa entrada ya admite. El endpoint de claves de Meta requiere el token DCA almacenado,
de modo que solo esta sonda descarga su credencial seleccionada en el servidor; un intento de auditoría
con cierre ante fallos precede a la descarga y al intercambio. Puede acuñar una clave upstream, pero
solo se decodifican los campos de suscripción/ventana y ninguna clave devuelta se retiene ni
se escribe de vuelta. Sus errores de transporte, HTTP y decodificación nunca citan payloads sin procesar.
Las demás sondas usan la sustitución de tokens de CPA. xAI lee ambos documentos de facturación
— el documento de créditos lleva la ventana de una suscripción y el libro mayor
lleva las cifras mensuales medidas — y mantiene atómico el período de cada documento
en lugar de fusionar las cifras de uno en la ventana del otro (ADR 0071). Lee su
suscripción solo después de que la facturación de la CLI tenga éxito, preservando campos de facturación independientes; Antigravity
lee `loadCodeAssist` y ya no asume Pro ante una observación fallida del nivel.
Los fallos de suscripción suplementarios preservan las lecturas de uso exitosas. El
`subscription_active` opcional de Meta distingue falso de una lectura desconocida, y
la consola muestra un estado inactivo explícito junto al plan.

Una actualización que tiene éxito sin publicar una ventana se registra como una
observación `unpublished` en lugar de quedar indistinguible de una credencial que
nadie ha leído, y la identidad de una ventana — su id, etiqueta y tipo — proviene de la
duración que declara el payload y no de la ranura en que llegó (ADR 0071).

Un proveedor se observa solo cuando `internal/quota` tanto lo reconoce
(`DetectProvider`) como implementa su sonda; una credencial cuyo proveedor no tiene
sonda se informa con `refresh_supported: false` y no como una lectura fallida.

La normalización nunca permite que una ventana agotada haga que otra parezca agotada. Codex
marca un límite de tasa completo como alcanzado (`limit_reached` / `allowed: false`) sin
decir qué ventana lo activó, aunque sigue informando el `used_percent` propio de cada ventana.
`ParseCodexUsage` por tanto atribuye la bandera por ventana
(`exhaustedFlags`): una ventana con lectura propia la conserva, una ventana sin
uso legible se fija en 100%, y cuando todas las ventanas informan uso por debajo de 100
(upstream redondea) solo la más usada se fija. La regla se aplica igual a los
límites de tasa estándar, de revisión de código y adicionales por modelo; la definición de dominio
es **Quota Window** en `CONTEXT.md`.

El instante de renovación de un plan se lleva con su procedencia. Codex sondea el
endpoint de suscripción en cada actualización y registra `expires_source:
live_subscription` cuando responde, de modo que una caducidad que el payload de uso casualmente
lleve se reemplaza igualmente por la lectura más fresca. Cuando ese sondeo falla, una caducidad
que el payload de uso ya suministró se conserva sin fuente — es actual pero
no tiene procedencia verificada — y solo un plan sin caducidad todavía recurre a la
afirmación `id_token` de la credencial, registrada como `credential_snapshot`, porque upstream
solo mueve esa ventana hacia adelante y un token puede acuñarse después del período que
sigue describiendo. La consola renderiza una instantánea como un límite `≥` con una marca de no verificado
y nunca como una cuenta regresiva, de modo que una afirmación obsoleta no pueda leerse como una fecha de renovación
verificada.

La **Estimated Window Capacity** y la **Previous-Cycle Capacity Reference**
(`CONTEXT.md`) de una ventana se unen en la lectura mediante `Handler.attachWindowCapacity` en `internal/api`,
para la vista general, el detalle de credencial, las respuestas de actualización y las salidas de cuota del Agent/MCP.
`internal/quota` contiene funciones puras de rango, alcance, evidencia de reinicio, observación previa y
aritmética; `internal/repository` suministra el uso y las observaciones retenidas.

El uso global se suma mediante `QueryCredentialWindowUsage`; el uso con alcance se agrupa
por `COALESCE(NULLIF(response_model, ''), model)` mediante
`QueryCredentialModelWindowUsage`, y luego se empareja con `SelectWindowUsage`. Ambas consultas
usan el índice de credencial/tiempo y límites semiabiertos que terminan en la lectura. Las ventanas de la
familia Claude usan identidades canónicas de familia; las ventanas de modelo exacto toleran versiones con fecha
usando la misma regla de identidad que la observabilidad del modelo servido. Antigravity
normaliza solo nombres de grupo exactos revisados a `model_families`; un período no reconocido
sigue siendo desconocido en lugar de adoptar por defecto un ciclo diario. Las etiquetas de período fijo
se comparan exactamente; un mes calendario no se trata como treinta días. Los alias o
metadatos de alcance sin resolver retienen toda la lectura con alcance. No se introducen lecturas
de modelos/alias vivos de CPA: el enrutamiento de hoy no puede explicar de forma fiable un alias histórico.

El historial se lee una vez por credencial elegible, en orden determinista de observación/inserción.
`HasWindowCycleReset` detecta caídas a lo largo de la secuencia y reemplazos prematuros de
límites, no solo un pico por encima del porcentaje actual. Antes de que se persista una
observación exitosa, su evidencia de reinicio se lleva en el `windows_json` existente como `has_mid_cycle_reset`; la evidencia sobrevive a la retención y se borra solo
con el siguiente ciclo programado. Las actualizaciones fallidas o deshabilitadas conservan el tiempo de observación previo
y no se persisten, incluidos los fallos enmascarados por el estado de enfriamiento.
El historial corrupto/ilegible y las consultas de uso fallidas producen motivos explícitos de no disponibilidad.
Una lectura fallida del historial aún permite guardar la observación fresca, llevando un
marcador persistente `has_incomplete_history` para ese ciclo en lugar de inventar evidencia de reinicio.
El marcador impide estimaciones y referencias hasta el siguiente ciclo programado.

Un ciclo actual fresco con `low_usage`, `no_traffic` o `no_reading` puede usar
`PreviousWindowObservation` para seleccionar la última observación retenida de su ciclo programado
inmediatamente anterior. El alcance y el período deben coincidir, su reinicio debe encontrarse con el inicio actual
dentro de un segundo, y el ciclo anterior no debe tener evidencia de reinicio retenida.
La estimación previa se recalcula a partir de su propio rango de uso fijado y se marca
`basis: previous_cycle`, con `observed_at_ms`, `from_ms` y `reset_at_ms`. El
`usage` y el `capacity_unavailable` actuales siguen siendo actuales; los ciclos obsoletos, caducados, reiniciados o sin resolver
nunca invocan el respaldo. Es una estimación histórica, no un total real.

`usage`, `capacity` y `capacity_unavailable` en tiempo de lectura se eliminan antes del almacenamiento de la instantánea,
y los joins operan sobre un slice copiado. Los eventos ingeridos tarde dentro del rango de una observación
por tanto revisan tanto las estimaciones actuales como las referencias históricas en la siguiente
lectura. La detección de reinicios se limita a la evidencia observada/retenida, no a un ciclo de vida upstream
completo. No hay nuevas tablas, migraciones ni entradas de enrutamiento (ADR 0058 y ADR 0059).

**Una lectura fallida no es una lectura, pero se registra.** Toda superficie que lee una
credencial — la actualización manual, el bucle en segundo plano, la sonda de calentamiento y la capacidad del
Agent — pasa por `Handler.refreshQuotaReading`
(`internal/api/management_quota.go`), que clasifica el resultado con
`quota.ReadOutcome` y hace upsert de una fila por credencial en `quota_refresh_attempts`
(migración 044: `auth_index`, `attempted_at_ms`, `outcome`, `error`; un intento más antiguo nunca
sobrescribe uno más nuevo). La vista general y el detalle de credencial sirven esa fila como `last_refresh` junto a la
observación retenida, y `quota.ApplyReadingHealth` deriva
el estado que presenta la consola: un intento fallido más nuevo que la lectura la supera —
los fallos de tipo autenticación pasan a `error` con la recomendación `reauth`, los demás a `stale` con
los números previos vigentes, y una credencial sin ninguna observación almacenada pasa a
`error` y no a `stale`, porque no hay nada en pantalla que llamar desactualizado — un
enfriamiento activo sigue superando a ambos, y una lectura sana o de advertencia cuyo propio
límite anunciado ha pasado sin verse (más allá de `reset_at_ms` + la gracia de reinicio, y tomada antes de ese
límite) pasa a `stale` sin error asociado. `exhausted` conserva su estado: es lo que detiene la credencial, y la
lectura impulsada por el reinicio la responde en minutos. El espacio de trabajo por tanto declara un fallo
que sobrevive a su toast, cuenta una lectura obsoleta aparte del total sano, ofrece una
actualización de una sola credencial en la fila que la informa, y nunca presenta una lectura de hace
días como la respuesta actual.

Las lecturas también se actualizan en segundo plano (ADR 0094). `Handler.RunQuotaAutoRefresh`
en `internal/api/quota_auto_refresh.go` despierta cada minuto, lee la preferencia
`omc_quota_auto_refresh`, lista las credenciales y sus últimas instantáneas,
y pregunta a `quota.AutoRefreshTrigger` (`internal/quota/auto_refresh.go`) cuáles corresponden: una
lectura impulsada por el reinicio una vez que el `reset_at_ms` de una ventana almacenada más una gracia de un minuto
ha superado la observación (una fallida se reintenta cada diez minutos durante la hora siguiente),
y una lectura programada una vez que la más nueva entre la observación y el último intento del proceso
tiene `interval_minutes` de antigüedad, menos una holgura de treinta segundos porque la observación se
estampa después de su tick. Las credenciales pendientes - primero las impulsadas por el reinicio,
luego la lectura más antigua primero, como máximo dieciséis por ronda y cuatro a la vez - pasan por
`Handler.refreshQuotaReading` y `persistNormalizedQuotaSnapshot`, exactamente como una
actualización manual, de modo que el intento se registra junto a la lectura que no pudo reemplazar. Solo el
retroceso de reintentos se recuerda en la memoria del proceso, porque una lectura fallida nunca se almacena como
observación; un fallo de ronda se registra cuando comienza o cambia y no cada minuto. `app.Run` une el bucle antes de regresar, como hace con el pipeline. Se omiten las credenciales deshabilitadas, los proveedores sin sonda, las reclamaciones duplicadas de `auth_index`
y Meta (cuya observación es un intercambio de clave auditado). La
API de preferencias rechaza cualquier documento para esta clave distinto de
`{"interval_minutes": 0 | 5-1440, "refresh_on_reset": bool}` con
`invalid_quota_auto_refresh`, y `internal/operations/quota_auto_refresh.go` registra
`quota_auto_refresh_get` y `quota_auto_refresh_set` sobre la misma preferencia. El espacio de trabajo de gestión
OAuth sondea la vista general almacenada cada minuto, como ya hace el panel de Cuota de credenciales
del dashboard, de modo que una lectura en segundo plano aparece en una página abierta.

Un enfriamiento de CPA se libera automáticamente en dos casos (ADR 0094). `refreshQuotaReading`
libera una credencial que aún tiene evidencia de `quota_exceeded` una vez que una lectura fresca y utilizable
muestra margen en cada ventana publicada (`quota.HasRestoredCapacity`), y cada ronda del bucle
libera una credencial habilitada cuyos `next_recover_at_ms` y
`next_retry_after_ms` almacenados han pasado todos (`Repository.BatchExpiredCooldowns`), pueda o no
leerse su proveedor. Cualquiera de las liberaciones llama a `routing/cooldown/reset` de CPA, borra la
evidencia mediante `Repository.ClearCooldownEvidence`, como hace el Clear Cooldown del operador,
registra el `auth_index` y guarda un evento de auditoría `quota.clear_cooldown.automatic`.

El canje de créditos de reinicio de Codex se ofrece en la pestaña Cuota del Drawer de credencial y nunca
desde una fila de lista, porque gasta un derecho irreversible; se ofrece siempre que el
conteo de créditos disponibles de la credencial sea positivo. El `applicable_available_count` de upstream no es la
compuerta, y la respuesta del consumo es la que declara el resultado. El POST de canje lleva el mismo
`Chatgpt-Account-Id` que envían las sondas de lectura, de modo que el canje queda acotado a la misma
cuenta que la lectura de la que se decidió.

## 9. Almacenamiento

| Grupo de tablas | Tablas | Notas |
| --- | --- | --- |
| Instancias e identidad | `cpa_instances`, `discovered_resources`, `resource_overrides`, `connections`, `cpa_bindings` | Clave de gestión cifrada; los enlaces sobreviven a la eliminación upstream. `connections` la aprovisiona la migración 006 para la entidad Connection pero ningún código la lee ni escribe todavía — trátela como reservada, no como una tabla viva |
| Uso | `usage_inboxes`, `usage_events`, `error_events`, `ingest_gaps`, `usage_facts_15m`, `usage_facts_daily`, `usage_aggregation_checkpoints`, `data_lifecycle_state` | Milisegundos; los payloads sin procesar se cifran y se almacenan una vez: con un cifrador configurado `raw_message` queda vacío y solo se conserva el texto cifrado. La migración 035 reemplaza las agregaciones horarias y diarias de la vista general por los hechos de uso permanentes y añade `data_lifecycle_state` (qué ha eliminado cada política móvil, y hasta qué instante). Cada tabla declara su ciclo de vida en `TABLE_LIFECYCLES` (`internal/repository/lifecycle.go`). La migración 034 añade `usage_events.response_model` (el modelo que el upstream informó servir, vacío cuando se desconoce) y `model_substituted`, decidido en la ingesta por `usage.IsModelSubstituted`, con un índice parcial para las filas sustituidas; las filas anteriores quedan desconocidas. La migración 037 añade `usage_events.fail_status_code` y `fail_body` (el estado con el que terminó una solicitud fallida y el cuerpo de error acotado y redactado del upstream, del bloque `fail` del registro de uso de CPA); `0` y vacío significan desconocido, y la proyección de la lista lleva solo el estado. La migración 038 añade `usage_events.response_headers`, la instantánea filtrada de cabeceras upstream como objeto JSON (`usage.FilterResponseHeaders` descarta las cabeceras de transporte y las que llevan credenciales y acota el resto); solo `GetUsageEvent` la lee. La migración 039 añade `usage_events.access_provider` e `is_native_key` (qué proveedor de acceso autenticó al llamador y si la clave del llamador es la clave nativa configurada de CPA, del registro de uso de CPA); un `access_provider` vacío significa un gateway anterior a ellos, mientras que `is_native_key` tiene significado siempre que haya una ruta, y solo `GetUsageEvent` los lee |
| Íconos personalizados | `custom_icons` | La migración 032 añade BLOBs de imagen saneados y duraderos, IDs estables y revisiones de contenido; la eliminación confirmada borra de forma atómica las anulaciones de proveedor coincidentes y elimina el recurso |
| Biblioteca de fuentes | `fonts`, `font_faces` | Migración 042: una fila por familia instalada (`source` `google` o `upload`) y una por `@font-face` (rango de peso, estilo, `unicode-range`, formato de contenedor, BLOB del archivo, posición). Las caras se eliminan en cascada con su familia; la eliminación borra los roles de `omc_fonts` que la usaban en la misma transacción. Ambas tablas están ocultas de `database_query` |
| Precios | `model_prices`, `model_price_versions`, `pricing_sync_state`, `pricing_model_catalog`, `pricing_catalog_state`, `pricing_model_links`, `pricing_upstream_catalog`, `pricing_channels`, `pricing_channel_versions`, `pricing_match_reviews` | Las versiones de precio y de canal son solo de anexado mediante triggers; la migración 028 añadió niveles, enlaces, la instantánea almacenada de OpenRouter y canales, y `usage_events.channel_version_id`/`price_tier`. La migración 029 añadió `pricing_catalog_state.providers_json`; el repositorio de precios se niega a ejecutarse antes de la migración 29. La migración 031 añadió `pricing_match_reviews` (el modelo de OpenRouter que respondió por última vez para un precio personalizado o enlazado); las lecturas y escrituras de revisión de coincidencias se niegan a ejecutarse antes de la migración 31 |
| Agent | `agent_documents` | Última sesión cifrada del Agent, operaciones de capacidades e imágenes adjuntas (migraciones 026 y 036). Las sesiones retienen todo el historial hasta el reinicio o el reemplazo explícito, sin tope de tamaño de sesión; las imágenes siguen sus referencias y se eliminan solo después de que se persista un reinicio. Las operaciones terminales se retienen 7 días y se purgan de forma perezosa durante las solicitudes del Agent |
| Operaciones | `audit_events`, `ui_preferences`, `quota_snapshots`, `schema_migrations` | La auditoría no tiene ruta de actualización ni de eliminación — solo `RecordAuditEvent` escribe y existen consultas de lectura (`ListAuditEvents`, `QueryAuditEvents`), y la propia exportación se audita; el esquema no lleva ningún trigger de cumplimiento, así que la garantía vive en la API del repositorio. La migración 027 añade `idx_audit_events_request_action`, que consulta el plegado de intentos de la pista |
| Configuración de CPA | `cpa_config_backups`, `cpa_config_backup_settings` | Copias cifradas del archivo de configuración de CPA almacenado, conservadas antes de cada escritura de configuración (migración 030, ADR 0037; la migración 033 añade el `layout` y el `reason` de cada copia y la tabla de retención de una sola fila, ADR 0051). Las copias v8 se conservan según la retención del operador (por defecto 20, de 5 a 100), las anteriores a v8 hasta las últimas diez; `cpa_config_backups` está oculta de `database_query` |
| Observación de versiones | `release_index`, `release_check_state` | Migraciones 024 y 025; `truncated` lo añade la 025, de modo que una base de datos que aplicó la 024 antes de que existiera también gana la columna. `release_index` contiene una fila por versión publicada (etiqueta, nombre, hora de publicación, indicador de prerelease) y **se reemplaza como unidad por producto** mediante `PublishReleaseSnapshot`, porque un feed que deja de listar una versión retirada debe dejar de hacer que la consola afirme que existe. `release_check_state` contiene una fila por producto — los tiempos del último intento y del último éxito, el motivo de fallo redactado, la última etiqueta, el ETag y el indicador de truncamiento — y la escriben `RecordReleaseCheckAttempt`/`PublishReleaseSnapshot`/`RecordReleaseCheckFailure` y la leen `ListReleases` y `GetReleaseCheckState(ForRepository)`. El cuerpo en prosa de una versión **nunca se almacena**: vive en memoria de proceso acotada mientras dure el proceso, de modo que un índice sin notas sigue nombrando las versiones y enlazando a la fuente (véase §10) |

`GET /management/system` resuelve el cliente del gateway una vez y ejecuta sus lecturas en paralelo
- los estados de versión de ambos productos, el viaje de ida y vuelta de salud del gateway, la lista de credenciales (leída
una vez para la cabecera de versión del gateway y para su conteo de credenciales), los conteos de plugins y
proveedores, y las lecturas de base de datos, recolector, conteo de registros y admisión - de modo que la página
espera a su lectura más lenta y no a la suma de todas.

La superficie de sistema de gestión son nueve rutas: `GET /management/system` (la página),
`GET /management/system/releases` (el registro de cambios fusionado de un producto), `GET
/management/system/repository` (el conteo de estrellas del proyecto para el enlace de la cabecera), `GET
/management/system/updates` (las respuestas de versión almacenadas de ambos productos para el indicador
de actualización de la carcasa), `GET /management/system/updater` (si este despliegue puede aplicar actualizaciones,
por producto, y la actualización en curso o la última), `POST /management/system/updater/apply`
(iniciar una; véase [Actualizaciones de la consola](#actualizaciones-de-la-consola-adr-0099)), `POST
/management/system/check-updates` (una comprobación, sujeta al piso), `GET
/management/system/maintenance` (el trabajo en curso o el último) y `POST
/management/system/maintenance/{checkpoint,vacuum}`. La comprobación responde `200` con los estados
de los dos productos y `served_from_cache`; un POST de mantenimiento responde `202` al ser admitido,
`409` cuando ya hay un trabajo en ejecución, `507` cuando una reconstrucción no puede admitirse por falta de espacio, y
`503` una vez que el servicio se está apagando. Todas responden `503` cuando el handler se
construyó sin el servicio correspondiente, que es cómo se comporta un despliegue que no ofrece la
superficie. Las rutas de repositorio y de actualizaciones son la excepción, porque la carcasa las lee
en cada página: siempre responden `200`, la primera con un `stargazers_count` nulo
siempre que no se conozca ningún conteo y la segunda con ambos productos `indeterminate` /
`not_checked_yet` cuando no hay servicio de versiones. La ruta de estado del actualizador es la otra
excepción: responde `200` con `state: disabled` cuando no hay actualizador conectado, porque un
actualizador ausente es un estado del despliegue que la página explica.

La ruta de actualizaciones nunca lee el feed. Informa lo que el barrido o la propia comprobación de la página
almacenó por última vez, con la misma forma por producto que usa la página, de modo que la carcasa pueda preguntar en cada página
sin gastar el presupuesto compartido; una consola abierta la relee cada hora
(`UPDATE_STATUS_REFRESH_MS`). La carcasa marca la entrada de navegación Información del sistema cuando
cualquiera de los productos está `update_available` y esa versión no ha sido descartada. Un descarte es
la preferencia `update_dismissals`, un mapa de producto a etiqueta escrito desde la página: nombra una
etiqueta publicada, de modo que una versión posterior vuelve a marcarse, y al ser una preferencia se mantiene entre
navegadores y reinicios. La comparación de ambas vive en el navegador
(`web/src/utils/updateDismissals.ts`); el servidor almacena el documento y nada más.

Las migraciones se incrustan desde `migrations/` y se aplican en orden de nombre de archivo, cada una dentro de
una transacción. Una migración contra una base de datos existente en disco primero
escribe una copia AES-GCM más un archivo auxiliar SHA-256, la restaura como prueba de humo y
conserva las cinco más recientes. La compuerta que decide si hace falta una copia lee
primero `schema_migrations`, y un estado de esquema ilegible - una búsqueda fallida en
`sqlite_master`, o una tabla que existe pero no puede contarse - se trata
como «hacer copia primero» y no como «aún no se ha aplicado nada». La prueba de humo igualmente
se niega a pasar cuando falta el digest del archivo auxiliar, porque una copia no verificable
no es una recuperable. La migración 004 además ejecuta un hook de gobernanza en Go
dentro de su transacción para sanear filas históricas. La reversión es solo hacia adelante:
se corrige un defecto con una nueva migración, nunca editando `schema_migrations`
(`docs/ops/sqlite-operations.md`).

## 10. Bucles en segundo plano

| Bucle | Responsable | Comportamiento ante fallos |
| --- | --- | --- |
| Servidor HTTP | `app.Run` | Fatal; el apagado drena 10 s |
| Pipeline de uso | `app.Run` → `ingest.Pipeline` | Fatal; un recolector detenido no debe servir en silencio números obsoletos. `Run` regresa solo después de que cada etapa se haya detenido, y `app.Run` espera a que lo haga antes de que se cierre la base de datos, sea cual sea el bucle que terminó primero |
| Sincronización de precios | `app.Run` → `pricing.Service` | De mejor esfuerzo; los precios se vuelven obsoletos, la captura continúa |
| Barrido de versiones | `app.Run` → `release.Service` | De mejor esfuerzo; el índice almacenado y sus marcas de tiempo se vuelven obsoletos, y la página lo dice. Cada seis horas, con la primera ejecución retrasada un intervalo para que un bucle de reinicios no pueda convertirse en un bucle de solicitudes |
| Actualización automática de cuota | `app.Run` → `api.Handler.RunQuotaAutoRefresh` | De mejor esfuerzo; una ronda que no puede llegar a CPA deja las lecturas almacenadas y la evidencia de enfriamiento como estaban y el minuto siguiente lo intenta de nuevo. Lee solo lo que la política `omc_quota_auto_refresh` hace vencer, y libera los enfriamientos cuyos tiempos de recuperación han pasado todos mediante el `routing/cooldown/reset` de CPA (§8, ADR 0094) |
| Pliegue de hechos de uso + ciclo de vida de datos | `ingest.Maintenance` dentro del pipeline | Se reintenta en su propio intervalo; los errores aparecen en el estado de ingesta |
| Mantenimiento de la base de datos | `repository.MaintenanceService`, iniciado por una solicitud del operador | Nunca se inicia automáticamente; el resultado de un trabajo se retiene en memoria de proceso y se registra en la pista de auditoría. El registro retenido lo sirven ambas lecturas, y la consola muestra solo un trabajo que observó y no ese registro — véase §11 |

Un despliegue de demostración inicia solo el servidor HTTP: su historial es el fixture, así que no
hay recolector que perder ni bucle de sincronización que deje obsoletos los precios. §13 e
`internal/demo` explican qué los reemplaza.

El barrido de versiones es el único bucle que habla con un host fuera del propio
gateway del despliegue, y es el único bucle cuya ausencia es invisible y no dañina:
sin él la página muestra el último índice conocido. Puede desactivarse con
`SHELLPAMC_UPDATE_CHECK_ENABLED=false`, lo que detiene el barrido pero deja funcionando la propia
comprobación de la página y el botón manual — son un operador que hace una pregunta, no
el proceso que decide llegar a internet.

`SHELLPAMC_UPDATE_CHECK_ON_PAGE_LOAD=false` es independiente porque responde a una pregunta independiente: ¿puede
abrir una página gastar una solicitud de un presupuesto compartido por dirección? Un despliegue autoalojado quiere
eso activado — la página existe para responder «¿hay una versión más nueva?» — mientras que una instalación aislada
o una suite de pruebas lo quiere desactivado, ya que una visita a la página allí no es un lector que pregunte nada. El botón
manual no se ve afectado por ninguno de los dos interruptores. El arnés de aceptación establece ambos, y vale la pena
registrar la razón: desactivar solo el barrido no detiene el tráfico, porque la primera ejecución del barrido está a un
intervalo completo de distancia y la suite visita la página que comprueba al abrirse.

### Qué puede contener un fallo almacenado

Una comprobación fallida registra un motivo redactado: una sola copia de `security.RedactText` sirve al
`last_error` almacenado, al `CheckError` que renderiza la página y a cada línea de registro, porque los tres pueden filtrar y
conservar una forma sin procesar para uno de ellos anula los otros dos. El motivo es una respuesta remota, y un feed o
un proxy puede devolver como eco un token que se le envió.

La regla de prefijos de proveedor del redactor tenía una brecha que vale la pena registrar: solo coincidía con un separador
con guion, de modo que `ghp_...` - la forma que realmente lleva un error de la API de GitHub, y esta función lee GitHub - pasaba
sin tocar. Ahora acepta los separadores que usan los prefijos reales, y tiene controles positivos y
negativos; no tenía ninguna prueba antes, razón por la cual la brecha sobrevivió.

### Por qué una comprobación tiene un piso

`CheckFloor` es de quince minutos, y toda ruta que lee el feed lo respeta. El feed es
un único presupuesto compartido por dirección — sesenta solicitudes por hora para la API de GitHub sin autenticar —
mientras que la página se carga con mucha más frecuencia de la que se publica una versión. Una comprobación cuesta una
solicitud por producto y una segunda solo cuando la primera página de un feed está llena, de modo que una comprobación sin limitar
al cargar la página gasta hasta cuatro solicitudes por vista: quince vistas agotan la cuota para
todos los clientes detrás de esa dirección. Eso es lo que ocurrió, y así se calibró el piso.

Dentro del piso una comprobación se responde desde el índice almacenado e informa `served_from_cache`,
de modo que el botón dice que el resultado estaba en caché en lugar de afirmar una comprobación que no hizo. El
piso se mide desde el último intento y no desde el último éxito, porque un feed que falla
es cuando más recarga un operador, y volver a aprender el mismo error gastaría el presupuesto dos veces.
El barrido de seis horas está exento por construcción: está muy por encima de cualquier piso.

### El conteo de estrellas de la cabecera

El enlace al repositorio de la carcasa muestra el conteo de estrellas de `release.ProjectRepository`, una constante
y no la fuente de versiones de Shell-PAMC configurada: el enlace nombra este proyecto, así que un conteo leído
del fork de un operador describiría un repositorio distinto del que abre. El
navegador nunca le pregunta a GitHub. `Service.Stargazers` lee `GET /repos/{owner}/{name}` mediante el
mismo cliente de host fijo y mantiene la respuesta solo en memoria; un reinicio cuesta una solicitud para
volver a saberla.

La lectura tiene su propio piso, `StargazerFloor`, de una hora medida desde el último intento,
porque la cabecera está montada en cada página y la lectura gasta el mismo presupuesto compartido. Una
carga de página puede dispararla solo cuando `SHELLPAMC_UPDATE_CHECK_ON_PAGE_LOAD` permite que las visitas a la página
comprueben; el barrido de seis horas la actualiza de todos modos, de modo que un despliegue que prohíbe las solicitudes por visita a la página
igualmente conoce el conteo. Una lectura fallida conserva el conteo anterior. La lectura es una
interfaz opcional de la fuente del feed (`release.StargazerSource`), que el fixture de la demostración no implementa:
la demostración muestra el enlace sin conteo en lugar de un número inventado sobre un repositorio real. `formatStarCount` en `web/src/utils/format.ts` es dueño de
la regla de visualización — exacto por debajo de mil, miles truncados con dos decimales por encima.

La página aplica los DTO de producto devueltos a su caché de consultas antes de actualizar la lectura del
sistema y cualquier registro de cambios abierto. Las reglas de presentación privadas de la página viven en
`web/src/pages/SystemPage/versionPresentation.ts`, con cobertura de regresión de funciones puras. Las comprobaciones manuales clasifican el `check_error` de cada producto antes de
informar éxito o una respuesta en caché; un producto fallido nunca se convierte en un toast de éxito solo
porque la ruta devolvió HTTP 200. Las comprobaciones automáticas al cargar la página informan mediante las filas de producto
sin toasts. Una guarda local en vuelo impide que una comprobación de montaje y un clic se envíen
juntos. Un estado `checking` observado en segundo plano se sondea cada dos segundos hasta que se asienta;
esto relee el estado local y no gasta otra solicitud al feed de versiones.

### La comprobación de versiones no almacena notas de versión

El cuerpo Markdown de una versión se mantiene en memoria de proceso y en ningún otro lugar. El índice —
etiquetas, nombres, horas de publicación, indicadores de prerelease — se almacena, porque eso es lo que
responde «¿hay una versión más nueva?» tras un reinicio o sin conexión. Las notas no,
y la página declara cuál de las dos tiene: un índice sin notas sigue nombrando
las versiones y enlazando a la fuente, mientras que un registro vacío afirmaría que nada cambió.

De esa división se derivan dos detalles. Un `304` de una solicitud condicional solo se
confía mientras el proceso aún tenga el cuerpo que describe el validador, de modo que los ETag almacenados
se borran al arrancar y la primera comprobación tras un reinicio es incondicional.
Y una comprobación fallida nunca borra el índice almacenado ni la hora del último éxito: la página
conserva la respuesta anterior e informa el fallo con su motivo y la hora del
intento, en lugar de quedarse en blanco o presentar datos obsoletos como actuales. Un intento fallido
sin ningún éxito previo no puede establecer que un repositorio no tiene versiones: ese veredicto
requiere `last_success_at_ms`. Hasta entonces la comparación lleva `not_checked_yet` y el
fallo se informa por separado. Cuando se conserva un índice, el aviso de fallo incluye la
hora de la última comprobación exitosa para que el lector pueda juzgar su antigüedad. La lectura rutinaria
de «última comprobación» se eliminó deliberadamente de las tarjetas - era la misma
marca de tiempo en todas - de modo que la obsolescencia es ahora algo que la página declara cuando una
comprobación falla y no un número que el lector tenga que interpretar.

### Actualizaciones de la consola (ADR 0099)

Aplicar una actualización es trabajo de un segundo proceso. El contenedor de la consola no puede reemplazarse
a sí mismo y no debe tener el socket de Docker, así que `internal/updater` se ejecuta como sidecar desde
la misma imagen y la consola le habla por la red de Docker:

```text
System Information page
  └─ POST /management/system/updater/apply {product}
       ├─ updater status: ready? product available? (else 409 with the reason as `code`)
       ├─ omc only: stored release answer says update_available
       │            └─ internal/release downloads release-manifest.json + .sig (forwarded unread)
       ├─ audit system.update.apply = admitted   (a failed audit write refuses the update)
       └─ POST http://shell-pamc-updater:8090/v1/update   Authorization: Bearer HMAC(master key)
            ├─ omc: verify signature, repository and non-regressing version; pull repo@digest; tag
            ├─ cpa: pull the configured tag
            ├─ stop old, rename it to <name>-omc-previous, create + start replacement, await healthy
            │      └─ on failure: remove replacement, rename back, start old, re-point the tag
            └─ omc only: replace the updater itself, handing the finished job to its successor
```

`GET /management/system/updater` reduce toda forma de no tener un actualizador a un estado
que la página puede explicar: `ready`, `not_installed` (una consola en contenedor sin respuesta,
que el comando de instalación corrige), `not_containerised` (una instalación nativa), `disabled`
(`SHELLPAMC_UPDATER_ENABLED=false`) y `rejected` (un actualizador que no acepta el token de esta
consola). La lectura es `200` en todos ellos. Los productos llevan `action` y
`reason`: `pinned`, `not_a_local_container`, `signature_unavailable`,
`container_not_found`, `ambiguous_container`. El modo demo no conecta ningún actualizador: la lectura
responde `disabled` y la política de demo rechaza la ruta de aplicación.

Tres invariantes sostienen el diseño:

- **El actualizador decide qué toca.** Su superficie de control toma un nombre de producto. El
  contenedor de la consola, el contenedor del gateway y la referencia de imagen los resuelve el
  actualizador a partir del propio estado de Docker, nunca los suministra el llamador.
- **La verificación ocurre donde está la autoridad.** La consola reenvía el manifiesto y la
  firma como bytes; el actualizador, que tiene el socket, los comprueba contra la clave
  compilada en su propio binario.
- **El resultado lo registra quien siga vivo.** Una actualización del gateway termina mientras el
  proceso que la admitió sigue ejecutándose, y una goroutine escribe `system.update.completed`. Una
  actualización de la consola mata ese proceso, así que `Handler.RecordInterruptedUpdate` sigue el
  último trabajo del actualizador desde el momento en que arranca el siguiente proceso. Ese proceso arranca mientras
  el trabajo aún lo está verificando, y el actualizador luego se reemplaza a sí mismo, de modo que el seguimiento
  espera a través de etapas sin terminar y lecturas fallidas, durante como máximo quince minutos. El
  evento de auditoría lleva como clave el ID del trabajo para que las dos rutas no puedan registrarlo ambas. El apagado
  termina ambas esperas antes de que se cierre la base de datos (`Handler.CloseUpdateWatchers`); un resultado
  que quede sin registrar lo recoge el siguiente proceso.

El rol de actualizador tiene un bucle propio, `Service.KeepLinked`: un actualizador instalado
vive fuera del proyecto Compose del despliegue, así que sigue los eventos de inicio de contenedores de Docker
y vuelve a conectar la consola a la red compartida cada vez que Compose la recrea.
Un actualizador declarado en Compose comparte la red del proyecto y no ejecuta tal bucle.

El actualizador mantiene un trabajo solo en memoria. Un reinicio a mitad de un reemplazo lo termina
`Service.Reconcile`, que busca un contenedor `-omc-previous`: con un reemplazo sano
se elimina el sobrante, sin uno se restaura. Un reemplazo cuya
comprobación de salud aún no ha pasado cuenta como inexistente, ya que se interrumpió
a mitad de la verificación. El par propio del actualizador es la excepción: un sucesor que ejecuta
`Reconcile` está arriba, sea lo que sea que informe aún su comprobación de salud.

En la página, `useConsoleUpdate` sigue un trabajo. Mientras lo hace, una lectura fallida o una
respuesta `not_installed` no se muestra, porque ambas son lo que parece un reinicio de la consola
desde el navegador; la última respuesta de un actualizador funcional se mantiene hasta que el trabajo informa
su fin, el actualizador lo olvida, o pasan diez minutos sin respuesta. Una actualización informa
un solo fin, con clave por su id de trabajo: ni la respuesta aún retenida mientras la consola se rinde ni
un actualizador que vuelve nombrando el trabajo que había perdido pueden hacer que la página termine la misma actualización
dos veces, o la siga de nuevo. Una actualización de la consola terminada recarga la página, ya que los scripts que
tiene pertenecen a la versión antigua.

## 11. Mantenimiento de la base de datos y la compuerta de escritura

### El estado retenido de un trabajo no es el resultado del lector

El servicio de mantenimiento conserva el estado del último trabajo en memoria de proceso durante la vida del
proceso, y **ambas** lecturas responden con él: `GET /management/system` y `GET
/management/system/maintenance` describen un servidor que tiene un trabajo. Esa retención es lo que
permite que una recarga tras una reconstrucción siga mostrando sus números, pero no es un resultado que el lector
haya pedido, y presentarlo directamente tiene un defecto que la retención no puede arreglar: el panel
pertenece entonces a un trabajo de una sesión anterior, y recargar lo relee, de modo que el lector nunca
puede descartarlo.

La consola por tanto separa el **estado retenido** del servidor del **resultado mostrado** de la propia
página. El banner de ejecución se dibuja a partir del estado vivo del servidor y siempre se
muestra, incluso para un trabajo que ya estaba en ejecución cuando se abrió la página: es la única
evidencia de que una Acción de mantenimiento tiene la compuerta de escritura, y no debe poder descartarse. El
panel de completado se dibuja en cambio a partir de una instantánea local, establecida solo cuando un trabajo que esta
página observó alcanza su estado terminal. Un trabajo se observa cuando la página lo inicia, o cuando una
instantánea del servidor lo informa en ejecución y la página lo adopta — de modo que la pestaña de otro
cliente o el trabajo de otro cliente se sigue igualmente hasta su resultado. La adopción mira **cada** instantánea y no
solo la primera, porque un trabajo admitido en otro lugar después de abrirse la página es
invisible hasta que una relectura lo informa; omitir el trabajo ya observado es lo que impide
que una relectura repetida reinicie un sondeo que ya lo está siguiendo. Un estado terminal se
acepta solo para el trabajo observado, o para un trabajo que lo sustituyó, reconocido por el
`job_id` del servidor — la reserva bajo la que se admitió el trabajo, que es monótona dentro del
proceso. Ese id es lo que la página compara y no la hora de inicio, porque la hora de inicio
es el reloj de pared: dos trabajos pueden compartir un milisegundo, y un reloj sincronizado puede retroceder,
y cualquiera de las dos cosas haría que un trabajo posterior pareciera uno ya tratado y perdiera su
resultado. Un trabajo que **empezó después** que el observado también se acepta, y se convierte en el
trabajo observado: un trabajo rápido puede terminar y ser reemplazado dentro de un solo intervalo de sondeo, de modo que la primera
señal de su reemplazo es el propio registro terminal de ese reemplazo. Sin esa regla la página
descartaría el resultado más nuevo y seguiría sondeando un trabajo que el servidor ya había dejado atrás —
verificado en el navegador, donde la guarda de coincidencia exacta informó `0` paneles de resultado a lo largo de `23`
sondeos. «Admitido después» es la expresión precisa aquí, no «empezó después»: los ids se reparten
en la reserva, que precede al lanzamiento.

Adoptar un trabajo en ejecución también **siembra la caché del sondeo** con ese trabajo antes de que se
active el sondeo, porque mientras el sondeo está activo la tarjeta lee esa caché y no la instantánea propia de la página.
Una caché que aún contuviera el registro terminal de un trabajo anterior ocultaba en cambio trabajo vivo: ningún banner
de progreso, y acciones de mantenimiento que parecían disponibles mientras un trabajo tenía la compuerta
de escritura. Las sondas del navegador mantienen abierto el primer sondeo diez segundos y afirman el banner y las
acciones deshabilitadas dentro de esa ventana, ya que después de que el sondeo responde el registro es correcto
de cualquier modo.

Descartar el resultado borra solo esa instantánea local, y tanto el control de cierre como el
botón Actualizar de la página la borran. Como la instantánea es local, ni el registro retenido del servidor
ni una relectura posterior pueden resucitar un resultado que el lector ha descartado, mientras que el siguiente
trabajo real sí produce uno nuevo.

El estado terminal se trata **una vez por trabajo**, y la guarda va antes de establecer el resultado
y no después. Ese orden es toda la garantía: el efecto nombra la función de
traducción entre sus dependencias, de modo que cambiar el idioma de la interfaz lo vuelve a ejecutar mientras
el registro terminal sigue en caché, y una guarda colocada después de establecer el resultado
devolvería un resultado que el lector ya había descartado. El trabajo se reconoce por el
`job_id` del servidor y no por su hora de fin, que el backend asigna a partir del reloj de pared y
no promete que sea única.

Como los ids provienen de un contador que vuelve a empezar con cada proceso, la página también registra
a qué proceso describen esos ids (`runtime.started_at_ms`) y borra su trabajo observado e informado
cuando eso cambia. Un reinicio de otro modo puede acuñar un id que la página ya ha tratado, y el
trabajo del nuevo proceso parecería uno ya atendido — su resultado nunca se mostraría. La sonda
afirma esto **sin recargar**, ya que una recarga reinicia el estado propio de la página y ocultaría
la confusión que se prueba.

Dos acciones emitidas por el operador reescriben la base de datos: `PRAGMA wal_checkpoint(TRUNCATE)`
y `VACUUM`. Ambas se ofrecen desde la página Información del sistema y ambas están
protegidas por una compuerta de escritura, porque el modo de fallo sin una no es una solicitud lenta:
el vaciado de `internal/usage/ingest` registra una brecha de ingesta y devuelve un error, y
`app.Run` trata un pipeline detenido como fatal a propósito, de modo que un escritor que perdiera una
carrera contra una reconstrucción se llevaría consigo al proceso.

El propio bloqueo de SQLite no puede expresar la frontera. Bajo WAL un lector nunca bloquea a un
escritor y un escritor nunca bloquea a un lector, y `busy_timeout` hace que una llamada bloqueada
reintente en lugar de impedir que un escritor empiece. Así que `internal/repository` envuelve
su driver: una sentencia que no es demostrablemente una lectura pasa por una compuerta que el mantenimiento
mantiene en exclusiva, los escritores esperan en lugar de fallar, y un escritor en cola puede abandonar su
espera cuando termina su propio contexto.

La clasificación es deliberadamente asimétrica y deliberadamente estrecha — solo `SELECT`,
`VALUES` y `EXPLAIN` cuentan como lecturas. `PRAGMA` pasa por la compuerta sea cual sea su argumento, porque
la familia mezcla lecturas y escrituras. `WITH` pasa por la compuerta incluso cuando la sentencia selecciona,
porque una expresión de tabla común puede introducir un `UPDATE`, `DELETE` o `INSERT` y
su primera palabra clave no dice cuál. Una cadena que contiene una segunda sentencia pasa por la compuerta
sin importar cómo empiece, porque un clasificador por primera palabra clave no puede ver más allá de la primera
sentencia en absoluto. Cada uno de esos rechazos cuesta una espera durante una reconstrucción; la dirección
que sería barata es la dirección que puede terminar el proceso.

Siete propiedades de la disposición son críticas:

- El mantenimiento se ejecuta en un contexto marcado como propio del titular (`withMaintenanceContext`),
  porque una sentencia de mantenimiento que pasara de nuevo por la compuerta se pondría en cola tras la
  exclusividad que ya mantiene.
- El mantenimiento usa su propia conexión de base de datos en lugar de la del pool. Un escritor toma
  la compuerta dentro de su llamada al driver, momento en que `database/sql` ya le ha entregado una
  conexión, de modo que un escritor en espera *retiene* una conexión mientras espera; con una sola conexión
  en el pool, el mantenimiento que necesitara esa conexión esperaría a un escritor que a su vez
  espera al trabajo. Esto se observó como un interbloqueo real, y
  `TestMaintenanceDoesNotDeadlockAgainstAWriterHoldingAConnection` lo reproduce.
- Una transacción de escritura mantiene la compuerta hasta que termina, no por sentencia: el bloqueo
  de escritura de SQLite sobrevive a las sentencias dentro de una transacción. La pista
  `driver.TxOptions.ReadOnly` no exime a una transacción, porque modernc.org/sqlite solo la usa para elegir
  la cadena de modo de `BEGIN` — una transacción así aún puede escribir.
- Ninguna solicitud realiza trabajo de base de datos después de admitir un trabajo. El handler registra la
  *admisión* y devuelve el estado que devolvió el inicio; el trabajo registra su propia
  finalización mediante un observador una vez que ha liberado la exclusividad. Una solicitud que escribiera
  algo después retendría una conexión mientras el trabajo tuviera la compuerta, de modo que su `202`
  no llegaría hasta que terminara la reconstrucción.
- Los envoltorios de fila de la compuerta reenvían las interfaces opcionales de metadatos de columna del driver y
  lo afirman en tiempo de compilación, porque un envoltorio que satisficiera solo `driver.Rows` compila
  mientras descarta en silencio lo que el driver informa sobre el tipo de cada columna.
- La compuerta pertenece a un `repository.DB` y no al proceso, de modo que una reconstrucción en una
  base de datos no pueda detener las escrituras a otra. Todo pool derivado de ese mismo `DB` comparte su
  compuerta — en lo que se apoya el servicio de mantenimiento — mientras que dos llamadas `Open` separadas sobre
  el mismo archivo mantienen compuertas separadas y por tanto no son mutuamente excluyentes. Ese es el
  contrato que implementa el código, y un despliegue ejecuta un solo `Open`.
- El estado del trabajo vive en memoria (`MaintenanceService`), no en una tabla. Un endpoint de estado
  que leyera la base de datos no podría responder mientras un trabajo tuviera la conexión — que es
  exactamente cuando lo pregunta un operador. El servicio es dueño de un contexto derivado del de la
  aplicación, de modo que un trabajo no puede sobrevivir al proceso, y `Close` lo cancela y lo une
  antes de liberar la conexión.

`VACUUM` se ejecuta como un `VACUUM` simple en lugar de `VACUUM INTO` más un intercambio de archivos. El
pool mantiene un handle abierto, así que reemplazar el archivo por debajo exigiría cerrar todas las
conexiones y reconstruir el pool mientras otras goroutines aún tienen referencias
a él. Un `VACUUM` simple copia a un archivo temporal y sobrescribe el original
dentro de una transacción ordinaria, de modo que una reconstrucción interrumpida deja intacto el original;
`TestInterruptedVacuumLeavesTheDatabaseUsable` cancela una y luego comprueba tanto las filas
supervivientes como `PRAGMA integrity_check`. Su requisito documentado — hasta el doble
del archivo de la base de datos en espacio libre — se mide y se muestra en la confirmación antes de que se ejecute la
acción, como una comprobación previa y no como una garantía. Un checkpoint que SQLite informa
como bloqueado se presenta como un resultado incompleto, no como un éxito: `wal_checkpoint`
devuelve su resultado en una fila de tres enteros y no lanza un error cuando no
puede proceder, y una reconstrucción que en sí está bien pero no puede truncar el registro informa
ese resultado parcial en lugar de éxito o fallo.

## 12. Capas de pruebas

El análisis local de impacto en el navegador sigue los imports transpilados en runtime, preservando los tipos de arista
ansiosos y diferidos. El registro central `web/src/routePages.ts` es una frontera solo
para imports literales diferidos de páginas mapeadas. La identidad de la página se descubre a partir de los elementos de ruta de
`createBrowserRouter` de App mediante los componentes `React.lazy` exportados por el registro
y sus imports literales de `createPageLoader`, no a partir de prefijos de directorio o
nombre de archivo. Otros imports del registro, incluidos los helpers en directorios de páginas,
los cambios del registro y el cableado no reconocido siguen siendo cambios de catálogo completo. Las pruebas del planificador sobre el árbol real
exigen independientemente que App importe el registro y que el conjunto de páginas
demostrado del registro no esté vacío. La cobertura completa de CI no depende de la selección local.
Véase `docs/plans/architecture-governance.md` para la auditoría medida y el trabajo por etapas.

La suite se divide por lo que cada capa puede realmente demostrar, no por qué ejecutor está
de moda. `docs/testing.md` es la guía de trabajo (dónde va una prueba nueva, cómo se
registra, qué ejecutar y cuándo); esta sección registra el porqué. La regla es **Browser Everything → Browser Only Where Browser
Matters**: una aserción baja de capa cuando una capa inferior puede hacer la misma
afirmación, y se queda en Chromium solo cuando la afirmación trata del motor.

| Capa | Comando | Qué demuestra |
| --- | --- | --- |
| Lógica pura | `pnpm test:logic` | Decisiones sobre la propia entrada del operador: reescrituras de URL, derivación de vistas guardadas, invalidación de debounce, la decisión de sondeo, validación de rangos, mapeo de visualización de chips, presentación de actualización. Se ejecuta bajo Node sin bundler, sin servidor HTTP, sin binario de Go y sin navegador. Se descubre cada `scripts/test-*.ts`; no hay lista de suites que registrar. |
| Integración de componentes React | `pnpm test:components` | Afirmaciones de hook/proveedor/componente renderizadas, descubiertas automáticamente, bajo jsdom con QueryClient/cableado de API reales, respuestas retenidas, archivos aislados y limpieza explícita. Separada de la lógica pura de Node y del comportamiento del motor Chromium (ADR 0089). |
| Contrato de red de la API | `pnpm test:components` + `go test ./...` + `pnpm test:self` | Un corpus revisado se comprueba independientemente por handlers de Go autenticados y SQLite reales, el cliente tipado real en Vitest Node, y el despacho Browser Mock por contexto. Reutiliza el ejecutor de integración sin simular DOM ni cambiar los contratos de la API (ADR 0090). |
| Compuertas mecánicas del repositorio | `pnpm test:self` | Cada `*.test.mjs` bajo `scripts/` y `deploy/cloudflare/`, descubierto: referencias de rutas, claves de traducción, referencias a clases CSS, el destino del proxy de desarrollo, la sincronización de la distribución embebida, la decisión del instalador de Chromium, ambos planificadores, los shards de sondas, la estructura de los workflows y el trinquete de esperas fijas. |
| **Ruta rápida de UI** (solo desarrollo) | `pnpm check:ui` | El subconjunto de afirmaciones de navegador que un cambio puede afectar, contra el **servidor de desarrollo** con rutas simuladas. Sin `pnpm build`, sin binario de Go, sin CPA falso. Igual que el catálogo completo de sondas, ejecuta comprobaciones de doble invocación de `React.StrictMode` que una compilación de producción no puede exponer. |
| Smoke de pila completa | `pnpm verify:browser:smoke` | Una comprobación local rápida de la ruta delgada: redirección de `/shell-pamc`, rechazo y éxito de inicio de sesión, el dashboard y la lista de solicitudes renderizando sus filas sembradas, sin errores de consola ni de página. |
| Aceptación local enfocada de pila completa | `pnpm verify:browser:p0` | Un carril local enfocado opcional: la ruta smoke y sus comprobaciones, luego la suite de registros de solicitudes/cola en vivo y la suite de campos de programación de gestión OAuth, usando el mismo binario compilado y el fixture determinista. |
| Aceptación de pila completa | `pnpm verify:browser` | Toda la pila contra el CPA falso: autenticación, el renderizado y la frontera de secretos de cada ruta, alias de claves, habilitar/deshabilitar proveedores y su ruta concurrente, sondeo de cola en vivo y el espacio de trabajo unificado de gestión OAuth. |
| Sondas solo de navegador | `pnpm verify:probes` | El catálogo completo de escenarios en el servidor de desarrollo de Vite con rutas simuladas; no es cobertura de artefactos compilados. CI lo ejecuta como tres shards balanceados por peso (`--shard i/3`) en cada pull request y push a master. Los catálogos locales completos reutilizan secuencialmente las tres particiones de CI. Playwright Test ejecuta los escenarios compartidos con a lo sumo dos workers aislados (`--workers 1` para reproducción en serie), y luego los escenarios marcados de temporización de fotogramas por separado; el ejecutor nativo es dueño de los presupuestos, la limpieza y los informes, mientras que los fixtures del proyecto conservan comprobaciones estrictas de fallos de runtime/red y artefactos de fallo. Apilamiento y pruebas de impacto de drawers/modales, geometría y truncamiento de columnas, la anulación de alineación responsiva, el pintado de marcas de tendencia del dashboard, la secuenciación de actualizaciones bajo una respuesta retenida, el Back de la plataforma descartando cada clase de overlay, el renderizado en teléfono de cada superficie de lista frente a su tabla, y las reglas táctiles en un contexto deliberadamente grueso y sin hover. |
| Aceptación de demo | `pnpm verify:demo` | La consola de producción preparada y el handler real del Worker servidos en proceso, o una URL de despliegue explícita. Cada ruta debe completar sus lecturas iniciales y renderizar el encabezado y el contenido de su página, sin errores de API, transporte o script. |
| Smoke de demo en Go | `pnpm verify:demo:go` | Cobertura separada del modo demo del binario: ajustes aislados, rechazos de solo lectura y ediciones permitidas no duraderas. Este comando opcional no forma parte de `verify:full`. |

Los pull requests y master ejecutan toda la aceptación de pila completa y la compuerta de inyección de fallos del
arnés de navegador real (ADR 0068). Ambos ejecutan luego la aceptación de demo. El catálogo de sondas es su
propio trabajo fragmentado en ambos eventos, tras una comprobación agregada `probes` (ADR 0032).

### 12.0 Cobertura de desarrollo y de artefactos compilados

`check:ui` y `verify:probes` ejecutan los **mismos escenarios** de
`scripts/acceptance/scenarios.mjs`, ordenados bajo `scripts/acceptance/probes/`.
Ambos delegan en Playwright Test mediante `scripts/testing/probes.ts`, con propiedad nativa de procesos
de Vite y fixtures de API locales al contexto de `scripts/acceptance/probe.mjs`. La diferencia es la selección: `check:ui` selecciona los escenarios afectados
(o un escenario explícito), mientras que `verify:probes` ejecuta el catálogo completo.

Ninguno sustituye a la aceptación de artefactos compilados. La resolución de rutas de producción,
la minificación, la carga de chunks y la superficie embebida de Go las ejercita
`verify:browser`; `verify:demo` también maneja la consola de producción. A la inversa,
las compilaciones de producción no pueden exponer la doble invocación de `React.StrictMode`. El
escenario `search-dev-server` protege contra una regresión real de limpieza del controlador que
dejaba verdes las comprobaciones de producción pero detenía las confirmaciones de búsqueda en el servidor de desarrollo.
Trasladar el catálogo completo de sondas a artefactos de producción exigiría conservar
cobertura explícita de desarrollo; no es como funciona actualmente el arnés.

### 12.0.1 Tres momentos de verificación

La verificación se organiza por *cuándo se ejecuta*, porque lo que un desarrollador paga es esperar
y una compuerta que cuesta minutos se rodea. La tabla de momentos y las reglas que
mantienen honestas las compuertas viven en `AGENTS.md` §5; `docs/testing.md` es la guía de trabajo.
El ADR 0032 registra por qué el catálogo completo pasó de ser un deber local previo al push a una comprobación
obligatoria de CI: antes solo lo imponían la disciplina local y el CI de master tras la fusión,
mientras que cada desarrollador lo pagaba en serie antes de cada push.

La regla que lo mantiene honesto es que un plan *estrecho* nunca debe ser **silencioso**.
`scripts/affected-checks.mjs` y `scripts/acceptance/check-ui-plan.mjs` amplían ambos
en lugar de adivinar, y toda regla que estrecha tiene un caso negativo en su autoprueba.
El planificador de UI estrecha solo con evidencia:

- **Imports en runtime.** `scripts/acceptance/ui-impact.mjs` construye el grafo inverso de imports
  de `web/src` a partir de la salida de `transpileModule` de TypeScript, de modo que los imports usados solo
  como tipos no son aristas. Los escenarios de un archivo son los de cada módulo mapeado en las
  cadenas que lo importan. Una cadena que llega a la capa compartida, o una página enrutada
  sin regla, selecciona todo; también cualquier import local sin resolver, un recurso
  que el grafo no puede ver (un `url()` de CSS, `web/index.html`), una dependencia o un cambio de Vite.
  `scripts/ui-impact.test.mjs` exige por separado la arista App-registro, el descubrimiento de páginas del
  registro no vacío, la regla de escenario de cada página enrutada y la resolución completa
  del árbol real. Los helpers de directorio y el descubrimiento incompleto de rutas son casos negativos.
- **Adiciones de traducción.** Una edición de catálogo cuyas entradas preexistentes y cuyas líneas
  fuera de los objetos del catálogo no cambian no selecciona nada: una entrada nueva solo la
  renderiza el código que la referencia, que el planificador coloca por separado.
- **Código de sondas.** `scripts/acceptance/probe-impact.mjs` atribuye la edición de un módulo de sonda o del
  registro a los escenarios que lo usan. El ejecutor (`probe.mjs` y los dos scripts de entrada)
  sigue seleccionando todo; los planificadores no seleccionan nada, porque deciden
  qué escenarios se ejecutan, no qué observa un escenario, y están fijados por autopruebas.
- **Manifiestos.** Una edición de `package.json` confinada a `scripts` no es una entrada de runtime.

`test:fast` compara contra `HEAD` por defecto. `--base <ref>` incluye las diferencias confirmadas
además de los archivos preparados, no preparados y sin seguimiento; los renombrados conservan tanto
la ruta de origen como la de destino. `--plan` solo imprime la selección. Cada archivo aporta
un conjunto conservador de comprobaciones y el plan final es su unión: una migración más
una edición de Markdown aún debe ejecutar las pruebas de Go. Las entradas de dependencias amplían los planificadores
estático y de UI; las referencias de TS/TSX también seleccionan el verificador de módulos CSS; una edición de prueba de Go
también ejecuta las autopruebas, que incluyen el trinquete de esperas fijas. La comprobación de tipos del frontend
es incremental solo en `test:fast` (información de compilación bajo `tmp/tsc/`); `verify` y
CI siempre ejecutan un `tsc` nuevo.

`scripts/fixed-waits.test.mjs` es un trinquete unidireccional sobre las pausas fijas en pruebas de navegador
y pruebas de Go: añadir una falla, y quitar una falla hasta que su conteo registrado
se reduzca, de modo que una mejora no pueda deshacerse en silencio.

`test:self` descubre los archivos de prueba de Node en `scripts/` y `deploy/cloudflare/`,
usa una invocación de Node con aislamiento de proceso por archivo de prueba y concurrencia dos, y
ejecuta junto a él la comprobación de frescura de la demo. Esto elimina el arranque repetido del gestor de paquetes
sin reducir el conjunto de pruebas. Los fixtures compartidos no deben escribir en las mismas
rutas entre archivos; los directorios temporales aislados siguen siendo la convención.

Dos propiedades de esta división son críticas.

**Una aserción de navegador nunca se elimina sin reemplazo.**
`scripts/acceptance/MIGRATION.md` clasifica una vez cada aserción de
`scripts/browser-acceptance.mjs` - `PURE`, `COMPONENT`, `BROWSER` o
`CROSS-STACK` - y toda aserción que salió del navegador nombra la prueba que la
reemplazó. Una aserción puede moverse; no puede desaparecer en silencio.
`scripts/browser-acceptance.mjs` es ahora el punto de entrada de ciclo de vida/orquestación.
Los dominios de versión viven en módulos enfocados bajo `scripts/acceptance/`: gestión OAuth,
gestión de claves, registros de uso y comportamiento de cola en vivo, proveedores,
observabilidad, configuración y plugins, y tema y arte de marca. Cada módulo
recibe el arnés de navegador compartido que necesita y es dueño de una superficie de producto en lugar
de convertirse en otro script comodín.

**`pnpm test:fast` nunca paga por el navegador.** Ningún cambio ordinario puede compilar la
SPA, compilar un binario de Go, iniciar el listener HTTP de Vite del producto, iniciar Chromium ni
iniciar el CPA falso. Las transformaciones de Vite en proceso usadas por las pruebas de integración del frontend
permanecen dentro de esta frontera. La
selección vive en `scripts/affected-checks.mjs` para poder afirmarla directamente,
incluida esa propiedad negativa, y un archivo que las reglas no pueden ubicar selecciona
las compuertas amplias en lugar de nada.

### 12.1 Por qué algunas afirmaciones viven donde viven

- **El orden de las solicitudes pertenece a Go.** `TestListUsageEventsOrdersByRequestTime` en
  `internal/repository` inserta una solicitud que se registró última pero empezó
  primero, de modo que una regresión al orden de registro invierte la aserción. Una
  recomprobación en JavaScript leería lo que el servidor ya ordenó y no podría fallar por
  la razón que da su nombre.
- **La paginación y el scroll se quedan en el navegador.** Una lista virtualizada que mantiene un
  DOM acotado, un sondeo que deja intactos el desplazamiento y la identidad de fila del lector,
  y un gesto de volver arriba que aterriza exactamente en la cima son comportamientos de renderizado.
  El *calendario* del scroll es una función pura y se prueba como tal
  (`scripts/test-scroll-intent.ts`); su efecto sobre una lista real no.
- **Algunas esperas del navegador son irreductibles, y una se investigó en lugar de
  suponerse.** El bloque de cola en vivo espera la cadencia de autoactualización de diez segundos de la
  app. Manejarla con `page.clock` funciona - el intervalo se dispara antes, 11 s de tiempo
  de la app en unos 900 ms - pero el mismo simulacro cubre `requestAnimationFrame` y
  `performance.now`, con lo que está construido el calendario de gestos de `smoothScroll`:
  con el reloj instalado el gesto de volver arriba aterrizó en 37 px en lugar de en la
  cima, sin error de página, rompiendo la aserción para la que existe el bloque. Aislar
  el intervalo del reloj de fotogramas no es expresable mediante esa API, de modo que la
  espera se queda y la justificación se registra en el sitio de la llamada.
- **El debounce se divide en lugar de moverse.** `createSearchDebounce` lleva la
  política y se prueba directamente. La única afirmación que se queda en el navegador es que un
  temporizador pendiente real sobrevive a un borrado total real, porque depende de que una actualización de estado de React
  y una escritura de URL ocurran entre ambos.
- **La secuenciación de actualizaciones no puede sustituirse por una prueba de política de lectura.** Una
  prueba unitaria de `createLiveReadPolicy()` no dice nada sobre si la página serializa la extracción
  antes de las lecturas, así que la sonda retiene la respuesta y observa el orden.
- **La ruta de copia se divide entre una prueba unitaria y el navegador.** Qué ruta toma una copia
  - la API asíncrona del portapapeles, o la ruta de selección que necesita un origen HTTP plano -
  es una decisión sobre globales simulados (`scripts/test-clipboard.ts`), incluido el punto en que la trampa
  de foco de un diálogo exige que el elemento temporal esté adjunto. Que esa ruta de selección ponga el texto en
  el portapapeles no lo es: necesita un documento real, así que la aceptación vuelve a pegar el valor
  desde la propia canalización de pegado del navegador desde dentro de un diálogo y desde un drawer, que son los contenedores
  que atrapan el foco. A ese contexto no se le concede permiso de portapapeles a propósito - concederlo impediría
  que la aceptación ejercitara el respaldo en absoluto.

### 12.2 Costo de ejecución y aislamiento

El arranque del navegador, la entrega de módulos, la navegación y el layout dominan el costo de la aceptación.
Eliminar aserciones no elimina esos costos. La propiedad de la ejecución mantiene estrecha la retroalimentación
rutinaria y las compuertas completas independientes:

| Frontera | Política de ejecución |
| --- | --- |
| Trabajo estático local | Comprobaciones afectadas; tipos incrementales del frontend y tipos estrictos de herramientas |
| Trabajo local de UI | Escenarios afectados del catálogo en Vite con fixtures de API locales al contexto |
| Cobertura estática completa alojada | Ejecutores separados de Go, frontend y repositorio tras el agregado `static` con cierre ante fallos |
| Catálogo de sondas | Workers de Playwright Test, contextos de escenario nuevos y Vite propiedad de la invocación; tres particiones de CI revisadas |
| Sondas a nivel de fotograma | Un worker sin contención tras los escenarios compartidos, dentro del mismo plazo de partición |
| Cobertura completa local de navegador | El arnés, la aceptación compilada, las sondas y la demo se ejecutan consecutivamente porque comparten la CPU del host |
| Distribución embebida | La compilación termina antes de que los lectores estáticos de Go enumeren las rutas embebidas |

Las mejoras de ruta crítica alojada y de costo del ejecutor requieren ejecuciones alojadas equiparables; los
tiempos locales con caché caliente por sí solos no establecen ninguna de las dos.

La eliminación actual de esperas es más acotada que cambiar los relojes del navegador. La navegación de la demo espera
lecturas iniciales completadas con éxito y contenido de página visible, con tiempos de espera explícitos
por ruta; nunca espera a un silencio global de red mientras continúa el sondeo.
La sonda de caché obsoleta de información del sistema retiene su primera respuesta hasta que terminan las
aserciones en vuelo, y luego la libera en `finally` en lugar de dormir diez segundos.
Ahora cada sonda imprime su propia duración transcurrida, incluidos los escenarios fallidos.

Las observaciones numéricas de esta sección describen perfilados anteriores, no garantías actuales de
runtime. Vuelva a perfilar el catálogo actual antes de fijar un presupuesto de velocidad.
Otras dos palancas se evaluaron previamente:

**Sondeo guiado por reloj.** `page.clock` sí hace que el intervalo de diez segundos se dispare antes
(11 s de tiempo de la app en unos 900 ms), pero el mismo simulacro cubre `requestAnimationFrame`
y `performance.now`, con lo que está construido el calendario de gestos de `smoothScroll`:
con el reloj instalado el gesto de volver arriba aterrizó en 37 px en lugar de en
la cima, sin error de página, rompiendo la aserción para la que existe el bloque. Aislar
el intervalo del reloj de fotogramas no es expresable mediante esa API, de modo que la espera
se queda.

**`tsc --incremental`.** Adoptado solo para `test:fast`. La información de compilación registra un
hash de cada archivo del programa y de las opciones del compilador, de modo que un archivo cambiado, un archivo
eliminado o un `tsconfig` editado invalidan lo que deben; un `tsc` nuevo en `verify` y
CI sigue siendo la red de seguridad ante cualquier defecto de caché. Medido en una máquina de 4 CPU: unos 16 s
en frío, 6 s sin cambios, 9 s tras editar una utilidad ampliamente importada.

### 12.3 Los flakes eran reales, y estaban en las aserciones

La suite arrastraba un historial registrado de fallos intermitentes en la sección de filtros.
Ejecutar la misma suite bajo una restricción de 2 CPU en el **commit base sin modificar** los
reprodujo dos veces de cada tres, lo que zanjó la cuestión de si los causó
el refactor: no los causó.

La forma común es una lectura tomada inmediatamente después de un cambio de estado, sin esperar
al evento que hace significativa la lectura:

- **Una lectura del pie compitiendo con la relectura.** `the list is back to the unfiltered page`
  leía el pie de paginación inmediatamente después de una escritura de URL. Una URL sin filtros y una
  lista que ha vuelto a emitir su solicitud son estados distintos, y la lectura podía ver
  el tamaño de página del filtro anterior.
- **Una espera de sondeo con tres intervalos de margen.** El bloque de cola en vivo esperaba 30 s
  para una cadencia de 10 s. Eso no son tres intervalos de margen bajo contención; son
  tres intervalos antes de rendirse, y expiró en una página que solo era lenta.
  Ahora se deriva de `EVENT_AUTO_REFRESH_MS` con seis intervalos, y un límite más largo
  no cuesta nada en una máquina sana porque la espera regresa tan pronto como aparece
  la píldora.
- **Un conteo de filas leído antes de que las filas pudieran llegar.** `the list still runs on the
  usable filters` leía el conteo de filas un renderizado después del aviso.

Una afirmación negativa aún no puede esperarse: `a clean URL shows no notice` sigue siendo un
`check` simple, porque esperar la ausencia de un aviso pasaría en el primer
sondeo, se hubiera renderizado la página o no. Lo que lo hace significativo es el await
anterior - que las filas sean visibles es la evidencia de que la página se renderizó, y se
renderizó sin aviso.

Tras las correcciones, la suite pasa ocho pruebas consecutivas bajo la configuración más estricta
disponible aquí (2 CPU, con las sondas ejecutándose concurrentemente), que
es la configuración en la que falló la línea base.

Las preferencias segmentadas tienen una frontera propia de estado de animación. La sonda del modo de vista de modelos
del dashboard leía la clase CSS seleccionada de antd como valor de agrupación, pero el
componente suprime esa clase mientras se mueve su pulgar, independientemente del estado checked del
radio nativo. Una inversión rápida puede dejar a la sonda esperando a que termine la animación
en lugar de probar la preferencia. La sonda lee los radios marcados y
retiene la escritura rechazada del modo de vista de modelos hasta que se observa la selección optimista,
y luego libera el rechazo y afirma la reversión.

### 12.4 Preparación de CI y compuertas de artefactos de fallo temprano

Un perfilado anterior del paso de preparación del trabajo `browser` fue de unos 99 s, limitado por
`playwright-core install --with-deps chromium`: casi todo era apt instalando las
bibliotecas compartidas contra las que enlaza Chromium. La compilación de la SPA (29,5 s) y los binarios de Go
(1,3 s) se ejecutan concurrentemente con ese trabajo y quedan totalmente ocultos tras él, razón
por la cual solapar más con el paso no puede acortarlo.

El costo de apt es real pero no siempre es necesario. `scripts/install-chromium.mjs`
descarga el navegador sin `--with-deps`, sondea un lanzamiento real e instala las
dependencias solo cuando ese lanzamiento falla. Una imagen de ejecutor que ya trae las
bibliotecas por tanto se ahorra los ~100 s, y una que no las trae obtiene exactamente el comando que
el workflow ejecutaba antes incondicionalmente, de modo que el peor caso es el costo anterior
y no un nuevo modo de fallo. Un segundo fallo de lanzamiento se informa en lugar de
ignorarse, porque la alternativa es un trabajo de navegador sin navegador, que aflora
como un fallo de prueba y no de entorno.

Lo que decide es la sonda, no el estado de salida de la descarga. Una descarga que informa
éxito mientras el binario no puede arrancar es precisamente el estado que `--with-deps` existe para
reparar, así que confiar en el estado de salida reintroduciría el error que previene la bandera.
`scripts/install-chromium.test.mjs` afirma ambas mitades.

Eliminar el costo de apt expuso entonces lo que había estado ocultando: la compilación de Go pasó a ser el
piso de ese paso medido, unos 60 s localmente con una caché de compilación fría frente a 92 s en el
ejecutor. Dos ideas para ello se midieron y se rechazaron en lugar de dejarlas aparentando estar abiertas:
calentar los paquetes sin embebido concurrentemente con la compilación de la SPA es *más lento*
(48 s frente a 46 s), porque el calentamiento compite por los mismos núcleos que usa la compilación;
e iniciar el seeder junto a la compilación de la SPA también es más lento (34 s para dos
llamadas `go build` concurrentes frente a 23 s más unos 5 s en serie), porque ambas comparten
un módulo y una caché de compilación y compiten por su bloqueo.

Dos restricciones mantienen la forma del paso de preparación:

- **El binario de la aplicación debe compilarse después de la compilación de la SPA**, porque embebe
  `internal/web/dist`. Compilarlo junto con `pnpm build` puede embeber un bundle a medio escribir,
  de modo que la secuenciación es un requisito de corrección y no una preferencia.
  Solo el seeder, que no embebe nada, se ejecuta en paralelo.
- **Un acierto de caché en `~/.cache/ms-playwright` demuestra que los archivos del navegador están presentes y
  no dice nada sobre las bibliotecas compartidas.** Por eso las dependencias del SO
  siguen garantizadas en cada ejecución, solo que mediante sonda y no incondicionalmente.

`pnpm check:bundle` es responsable de la verificación de fronteras de carga de producción y del informe de tamaño
(ADR 0053). `web/vite.config.ts` usa `scripts/bundle-graph.mjs` para registrar la propiedad de
módulos de Rollup, las aristas de import estáticas/dinámicas y los hashes SHA-256 de los chunks fuera de la
distribución servida, en `tmp/bundle/graph.json`. `scripts/bundle-report.mjs` valida
el grafo contra los archivos compilados y recorre la entrada de módulo del HTML y las raíces de modulepreload,
deduplicando las dependencias estáticas. Rechaza módulos ansiosos de página, carcasa autenticada,
gráficos, Markdown y Monaco; la ruta de configuración también debe diferir el editor de
YAML. Renombrar un chunk no puede cambiar esas comprobaciones de propiedad. Las estimaciones sin procesar y de gzip de nivel 6
cubren la entrada, el JS/CSS de arranque, el JS más grande, todo el JS, los SVG y la distribución.
Las estimaciones de gzip no son mediciones de transferencia HTTP ni garantías de tiempo de ejecución.

El crecimiento ordinario es informativo. Los techos duros de anomalía permiten un margen sustancial:
JS de arranque 3 MiB sin procesar / 1 MiB gzip, CSS de arranque 256 / 96 KiB, JS más grande 4 MiB sin procesar,
todo el JS 16 MiB sin procesar, distribución 32 MiB sin procesar (ADR 0094: la fuente completa) y SVG de Lobe 2 MiB sin procesar. Los informes conservan
los tamaños por archivo, la propiedad de fuente y los archivos JS más grandes para investigación.
`scripts/bundle-baseline.mjs` compara solo contra una referencia de revisión exacta: un archivo
`BUNDLE_BASELINE` explícito o el artefacto de CI de push exitoso para `BUNDLE_BASE_SHA`.
`scripts/bundle-reference.json` arranca el commit previo a la política; se usa solo
cuando su revisión coincide. Sin un artefacto válido, el informe marca explícitamente
la comparación como no disponible; las comprobaciones de propiedad y los techos de anomalía aún se ejecutan.
CI compara los PR con su SHA base y los pushes con su SHA precedente, publica
`tmp/bundle/report.json` y `tmp/bundle/summary.md` durante 30 días y añade la tabla
al resumen del trabajo. Las ejecuciones locales usan por defecto `origin/master`; no contactan a GitHub
sin el repositorio y las variables de entorno del token.

CI compila la app embebida independientemente del veredicto del bundle y comprueba la limpieza de lo generado
antes de la ejecución en navegador. Un fallo capturado del bundle no impide la evidencia de navegador/demo
de producción, pero el veredicto final basado en resultados aún hace fallar
el trabajo `browser` requerido. Los `verify:full` y `verify:full:serial` locales comparten
esa orquestación que preserva el veredicto. Los fallos estáticos/de toolchain, de secretos y de compilación
siguen siendo prerrequisitos; los fallos de navegador/sondas aún permiten evidencia independiente de demo.
La aceptación de navegador independiente no tiene una segunda política de bundle. Las autopruebas de workflow y ejecutor
ejercitan compuertas ausentes, reordenadas y que no se imponen, además de rutas de fallo serie/paralelo.
La estructura de sondas sigue siendo shards `1..n` que coinciden con el denominador,
sin filtro de eventos ni fail-fast, diagnósticos retenidos y un agregado que exige que todos
los shards tengan éxito.

Los shards de sondas no necesitan compilación ni Go: cada uno instala dependencias y Chromium y
ejecuta su parte del catálogo en su propio ejecutor, de modo que las comprobaciones sensibles al tiempo de los escenarios
no ven contención de un navegador hermano. Una comprobación fallida escribe la misma
captura de pantalla, DOM, URL y evidencia de error de página que un error lanzado, y cada ejecución borra
primero la evidencia anterior.

Los procesos de aplicación lanzados por la aceptación de pila completa y el smoke de demo en Go usan
`scripts/acceptance/environment.mjs`: las variables heredadas `SHELLPAMC_*`, `PORT` y de proxy de transporte
se eliminan, las anulaciones del fixture son explícitas, y `SHELLPAMC_ENV_FILE` apunta
al dispositivo vacío de la plataforma. El arranque no debe registrar un archivo dotenv cargado. Esto
impide que un `.env` del directorio de trabajo de un desarrollador o los ajustes de un operador cambien en silencio
el fixture. El smoke explícito contra un sistema vivo sigue siendo independiente.

## 13. Modo demo

Una demostración pública tiene que mostrar el producto sin un gateway detrás, sin
ninguna credencial, y sin convertirse en un segundo frontend que mantener. El modo demo es
eso, expresado como una capa delgada sobre el proceso ordinario: `SHELLPAMC_DEMO_MODE=true`
cambia de dónde vienen los datos y rechaza lo que no debe ocurrir, y nada
se declara demo en tiempo de compilación.

Está desactivado salvo que se pida, y todo lo que cambia queda acotado a él, de modo que la
ruta autoalojada es exactamente el mismo código byte a byte (el ADR 0016 registra la decisión y
las alternativas).

| Aspecto | Autoalojado | Demo |
| --- | --- | --- |
| Upstream | La instancia de CPA configurada | El fixture de `internal/demo`, sobre un socket de loopback, con una clave acuñada por proceso |
| Clave de gestión | `SHELLPAMC_CPA_MANAGEMENT_KEY` | La clave propia del fixture; una heredada se descarta, nunca se cifra en la fila de la instancia |
| Base de datos | `shell-pamc.db` bajo `SHELLPAMC_DATA_DIR` | `shell-pamc-demo.db`, eliminada y reconstruida en cada arranque |
| Captura y sincronización | Se ejecutan el recolector y el bucle de precios | Ninguno arranca; el fixture es el historial y la lista de precios |
| Inicio de sesión | La clave de gestión de CPA | Una sesión al primer vistazo, para que cualquiera pueda abrir un enlace |
| Rutas peligrosas | Servidas | Rechazadas por `internal/api/demo_policy.go` |

### Por qué el upstream es un fixture y no un adaptador separado

La consola lee el gateway mediante `internal/cpa/management` en unos veinte
handlers. La forma más barata de mantenerlos todos funcionando - incluidas las listas de permitidos de DTO,
la proyección de credenciales y la resolución del catálogo de modelos - es conservar
el cliente y reemplazar lo que hay al otro extremo, así que `internal/demo` sirve la
API de gestión en un puerto de loopback y la aplicación apunta a él exactamente como
apuntaría a un gateway real. Un adaptador en la capa de handlers habría tenido
que reproducir cada forma de respuesta a partir de structs de Go y habría crecido una rama en
cada handler que lee una.

El fixture nunca marca la URL que se le entrega: resuelve el endpoint de proveedor solicitado
contra su propio catálogo y rechaza cualquier otra cosa, lo que hace que
«la demostración no contacta a ningún proveedor» sea una propiedad del código y no una promesa
sobre el entorno. Esa propiedad se cumple en ambos despliegues - el modo demo de Go y
el Worker tras la página pública - y ninguno reenvía una solicitud a ningún lado. La página
pública sí lleva una baliza de analítica, que la plataforma de alojamiento inyecta en el HTML y que
no emite nada de este repositorio; el ADR 0021 lo registra como una propiedad aceptada del
host. Las URL que responde están fijadas a la
lista de permitidos de `internal/quota` mediante una prueba, de modo que la duplicación no pueda desviarse hasta
responder a una solicitud que la consola nunca haría.

### La frontera es una clasificación, no una lista de botones deshabilitados

El servidor clasifica cada ruta que sirve. `internal/api/demo_policy.go` contiene una
tabla de `method + chi pattern + verdict`, gana la primera coincidencia, y la suite de pruebas recorre
la tabla de enrutamiento **real** afirmando que toda ruta registrada está clasificada: un
endpoint añadido sin veredicto hace fallar la suite en lugar de heredar uno. En
runtime una ruta sin clasificar se rechaza, de modo que el modo de fallo de una brecha es una
función bloqueada.

La tabla va ordenada de lo específico a lo general, y el comodín final
que sirve la SPA va al último. Ese orden es crítico: mientras el comodín
estuvo primero, clasificaba como público cada `GET` de la aplicación - incluidos la
descarga de credenciales y el registro de solicitudes - y ambos estaban permitidos.

Que vaya al último no basta por sí solo, sin embargo. Un comodín que se resuelve antes del rechazo
de una ruta de API sin clasificar hace que la prueba de cobertura no sea falsable para las lecturas: un
`GET` no listado coincide con el comodín y parece clasificado. El respaldo y la
consola son por tanto listas separadas, y la prueba de cobertura rechaza una coincidencia de respaldo como
veredicto - de modo que un endpoint de lectura añadido sin uno hace fallar la suite, y se rechaza
en runtime mientras tanto.

Los rechazos responden `403` con `{"error": ..., "code": "demo_operation_refused"}` - el
código que ya llevan los demás fallos de la fachada - más `X-OMCPA-Demo-Blocked` para un
llamador que nunca analiza un cuerpo. Las lecturas se marcan con `X-OMCPA-Demo: active`, y una
escritura lleva `X-OMCPA-Demo-Persistence: none`, que es como una respuesta puede decir que su
resultado no es duradero sin que la página tenga que saberlo.

La clasificación se resuelve en tres pasadas - los veredictos de endpoint, luego los
respaldos, luego la propia consola - y la tercera existe porque un comodín final
coincide con toda ruta por debajo de él. Ese orden es lo que impide que el respaldo de la SPA
responda por una ruta de API: `/api/v1/...` lo rechaza el respaldo, mientras que `/api-keys`
es una página y sigue siendo pública. Escribir la prueba de cobertura contra esa disposición encontró
dos lecturas - la lista de claves del gateway y la lista de archivos del registro de errores - que habían estado coincidiendo con
el comodín de la SPA, es decir, se estaban sirviendo sin que nadie hubiera decidido
que debieran.

Lo que la demo rechaza es todo lo que mueve material de credenciales, inicia un inicio de sesión real,
ejecuta un plugin, escribe la configuración del gateway, gasta un derecho de cuota,
devuelve un registro sin procesar de solicitudes o errores, o saldría del proceso - las lecturas de
modelos del proveedor, la sincronización del catálogo de precios, el bundle de diagnóstico. En su lugar realiza
escrituras que se quedan dentro de esta instancia: metadatos de credenciales y el estado habilitado
en el fixture, y nombres de claves de cliente, preferencias, filas de precios, anulaciones de recursos y
un barrido de descubrimiento en la base de datos. Una edición del estado de una credencial y una edición de preferencia
por tanto se almacenan en lugares distintos, y ambas desaparecen cuando se reemplaza la instancia.

### El fixture se siembra mediante la ruta de escritura real

`internal/demo` construye el historial que habría acumulado un despliegue - unas
catorce mil solicitudes a lo largo de 371 días, en aumento hacia el presente, entre catorce
modelos de tráfico y ocho proveedores, con tokens en caché y de razonamiento, latencia y
TTFT, una proporción de fallos, claves de llamador con nombre y una lista de precios - y lo escribe mediante
`repository.InsertUsageEvents`, la misma llamada que usa la ruta de captura. Eso es lo que mantiene al fixture sujeto al bloqueo de
precio en el momento de la solicitud, a las reglas de máscara de visualización y al esquema en lugar de desviarse de ellos.

La consecuencia es que el historial fabricado necesita la versión de precio que
finge haber existido: el bloqueo de precio resuelve una versión por la propia marca de tiempo de la solicitud,
y el trigger que refleja cada escritura de precio estampa el momento de la
escritura. `Repository.SeedModelPriceHistoryBackfill` y su contraparte de canal son los
únicos que escriben una versión en un momento explícito, y existen para que el fixture
pueda mantenerse bajo el bloqueo real en lugar de escribir directamente una columna de costo.

La lista de precios se siembra con el catálogo contra el que se resuelve la página de precios,
porque un despliegue real llena ese catálogo a partir de la propia lista de modelos del gateway
durante una sincronización y la demo deliberadamente no ejecuta ninguna. Sin él la página
intersectaría sus precios almacenados con un catálogo vacío y no renderizaría nada. Los precios
mismos provienen de una copia recortada de la lista real de OpenRouter
(`internal/demo/openrouter_snapshot.json`), decodificada y emparejada por el código de
producción, junto a un modelo fijado, tarifas fijadas a mano para los modelos de relé, un multiplicador de canal
y un modelo del catálogo dejado sin valorar en el libro de precios agrupado.
`Repository.SeedChannelHistoryBackfill` hace por el multiplicador de canal lo que el
backfill de precios hace por los precios.

Sembrar es también la razón por la que la base de datos de la demo se reconstruye en cada arranque. Una plataforma que
escala a cero devuelve el proceso horas después; una base de datos que quedara atrás terminaría
su historial horas antes, y las ventanas de quince minutos y de una hora - los paneles que
hacen que la consola parezca viva - estarían vacías.

### El estado de captura se informa, no se falsea

La lista de solicitudes imprime el estado de captura en su propia cabecera, y una demo no tiene
recolector sobre el que informar. En lugar de renderizar «captura desactivada» sobre una página llena de
solicitudes, la demo responde con el despliegue que describe su fixture - un
recolector en modo suscripción que capturó por última vez hace segundos - mientras que todo número que
describe datos almacenados se lee de la base de datos. Una sincronización manual se responde del mismo
modo: informa una pasada que encontró una cola vacía, que es lo que responde un despliegue real
cuando nada llegó entretanto.

### Dónde se despliega la demostración pública

La demostración pública se ejecuta como un Cloudflare Worker: la misma consola como recursos
estáticos, con su API respondida desde un conjunto de datos generado a partir de los handlers reales. No
es un segundo frontend - el bundle es el que embebe este binario - y la razón por la que
se genera y no se escribe a mano es que cada respuesta servida ha pasado entonces
por la misma proyección de DTO que produce una instalación autoalojada.

`deploy/cloudflare/` lo contiene: `worker.mjs` responde y rechaza, `routes.mjs` asigna una
solicitud a una respuesta capturada, `time.mjs` reubica el historial capturado en el
reloj del espectador, y `data/responses.json` es el conjunto de datos. `internal/api/demo_export_test.go`
es el generador, y `scripts/generate-demo-data.mjs` es el comando que lo ejecuta.

Dos propiedades son críticas y no incidentales. Toda respuesta se reubica con
un solo delta antes de servirse, porque la consola pide una ventana por nombre y una
captura congelada estaría visiblemente vacía en un día. Una celda del calendario de la
cuadrícula de actividad de tokens se mueve como una unidad bajo ese delta - su clave `day`, su inicio y
su fin con el mismo desfase de días completos - porque la clave es por lo que se empareja, etiqueta y enlaza una celda,
mientras que los dos instantes junto a ella son los límites propios del día: movidos
en cantidades distintas describirían días distintos. La propia cuadrícula se captura en el calendario del
historial sembrado y no en el de la máquina de exportación, ya que es la única lectura
cuya ventana se deriva de un reloj en lugar de tomarse de la solicitud. Y la cobertura del conjunto de datos es una
compuerta y no una instrucción: `scripts/check-demo.ts` falla cuando una ruta de la consola
no tiene lecturas capturadas, cuando cambió una fuente de la que deriva, o cuando lleva un
valor que no debe ser público. Esa última comprobación importa porque el conjunto de datos lo
puede descargar cualquiera.

Un rechazo se informa una sola vez. El servidor lo responde con prosa en inglés pensada para un registro
(«demo mode - uploading a credential is disabled»), y la consola emite su propio aviso
localizado para el rechazo; repetir además la frase del servidor ponía dos mensajes
en pantalla para una acción, en dos idiomas, leyéndose como dos fallos distintos. La capa de API
sustituye la frase de la consola por la de una llamada rechazada, de modo que cualquier llamador que la informe
informa la misma.

La demostración no ejecuta el producto: no hay detrás gateway, base de datos, pipeline
de captura ni autenticación, lo que
[ADR 0021](adr/0021-the-public-demonstration-is-generated-data-behind-the-real-console.md)
registra como una concesión deliberada. `docs/ops/cloudflare-demo.md` es el runbook, incluidos
los pasos de cuenta que ningún comando puede realizar y los modos de fallo que parecen otra
cosa.

## Ciclo de vida de ejecución gestionado por el navegador

`internal/api/browser_runs.go` envuelve los POST del Agent de la consola que llevan
`X-OMC-Run-ID` con un diario de repetición guiado por notificaciones. Los handlers existentes
siguen siendo dueños de la validación, la inferencia y las capacidades; el envoltorio es dueño del ciclo de vida desacoplado, la admisión
del mismo id, la repetición y la cancelación explícita. La admisión del cuerpo del Agent usa el mismo límite
`MAX_AGENT_RUN_BYTES` que el handler interno, incluido el contenido de imagen en base64; añadir un
ID de ejecución nunca estrecha las cargas que el handler acepta. `GET /agent/runs/active`,
`GET /agent/runs/{id}` y `POST /agent/runs/{id}/cancel` se autentican con la consola
(antes `/{agent|playground}/runs/...`; el espacio de trabajo Playground se eliminó). La pérdida del socket nunca cancela la ejecución gestionada.
`internal/app/app.go` une estas tareas antes de cerrar las dependencias. Cada diario retiene la
última ejecución completada durante 15 minutos y tiene latidos de socket de 15 segundos. Los diarios del Agent no tienen
tope de bytes ni plazo de ejecución. Los ids reemplazados/caducados tienen un límite de admisión de lápidas de 24 horas y 1024 entradas.
Antes de almacenar en búfer el cuerpo de una solicitud gestionada, el envoltorio rechaza un id distinto mientras una ejecución
está activa y rehúsa la admisión tras el apagado. Una compuerta compartida de cuatro permisos acota las lecturas
de cuerpo concurrentes, la validación y la entrega, incluidas las cargas con el mismo id; la saturación devuelve HTTP 429
con el código de ocupado del Agent. Los permisos se liberan antes de transmitir una suscripción. La admisión
se comprueba de nuevo tras leer porque otra solicitud puede iniciar una ejecución o puede comenzar el apagado
mientras una carga está en curso.

`web/src/agent/runConnection.ts` es la máquina de estados de transporte inyectable; `reconnect.ts` la vincula
al cliente de API autenticado y consciente de subrutas. Reintenta las suscripciones GET con retroceso de 500 ms a 8 s,
espera a los eventos de conexión y reconecta las lecturas detenidas de 45 segundos. La repetición completa primero reinicia
el fotograma transitorio. Nunca repite automáticamente un POST de generación inicial. La limpieza aborta
las suscripciones, mientras que Stop envía el comando idempotente de cancelación al servidor. La sesión persistida del Agent
incluye `active_run_id` cuando una tarea gestionada está en ejecución; leer un turno almacenado vivo no lo marca como
interrumpido. Los runtimes reiniciados siguen exponiendo como interrumpidos los turnos almacenados en ejecución.

Los descriptores de reintento/edición identifican el turno que reemplazan. Son garantías de recuperación locales al
proceso, no ejecución duradera. El ADR 0044 registra esta frontera y su comportamiento de apagado.

## 14. Espacio de trabajo de conversación del Agent y cliente de inferencia

El Agent (`web/src/pages/agent/AgentPage.tsx`) se compone sobre el marco de conversación compartido
(`web/src/components/workspace`): transcripción, compositor, divulgación del razonamiento, bloques de código y drawers
laterales. Su capa de ejecución es `web/src/agent/` (§3 «Forma del frontend»). La lista de modelos que ofrece es
`GET /agent/models` (antes `/playground/models`; la antigua ruta Playground y su endpoint de chat
se eliminaron), y las ejecuciones son `/agent/runs/...` (antes `/{agent|playground}/runs/...`).

**Exportaciones de conversación.** El Agent exporta mediante una sola ruta
(`web/src/components/workspace/useConversationExport.ts`). `conversationSnapshot.ts` proyecta lo que muestra la
página en un `ConversationSnapshot` - nunca la sesión almacenada - y descarta las identidades de ejecución
(huellas de claves, tokens, ids de operación y de ejecución) a cualquier profundidad. `conversationHtml.ts` renderiza
esa instantánea en una sola cadena HTML: los tokens resueltos de la paleta como propiedades personalizadas, los shards de fuente
que dibuja su texto embebidos como datos, Markdown renderizado sin HTML sin procesar, imágenes remotas degradadas a enlaces, un canvas como el mismo
marco aislado, y una Content-Security-Policy que no permite red. Su único script es el fijo
`conversationControls.ts` (búsqueda, panel lateral, copia, ordenación de tablas, impresión). El PNG es el mismo
documento maquetado como una tarjeta para compartir de 840 px en un iframe aislado y sin scripts. Las interfaces generadas se dibujan primero en marcos separados de origen opaco y con red bloqueada usando la ruta compartida `canvasCapture.ts`, se insertan como imágenes de datos PNG, y luego el documento se rasteriza mediante un
`foreignObject` de SVG a 2x (`conversationDownload.ts`); una transcripción larga se convierte en varios archivos
numerados, cada uno cortado en un límite de bloque por `snapshotImageSlices`. El módulo de descarga se carga bajo demanda,
de modo que la compilación de servidor del renderizador de Markdown se queda fuera del chunk del espacio de trabajo.
`internal/cpa/gateway` es el cliente de inferencia, separado del cliente de gestión. Admite
solo el `/v1/models` del origen configurado y las tres rutas de inferencia que nombra un
`Endpoint` - `/v1/chat/completions`, `/v1/responses` y `/v1/messages` - establece la
clave de cliente resuelta en el servidor y rechaza las redirecciones. `endpoints.go` contiene lo que difiere
entre los tres (ADR 0088): el cuerpo que toma cada uno y un decodificador de flujo para cada uno. Las rondas del bucle del Agent
toman las mismas tres formas (`agent_endpoints.go`): las herramientas, las llamadas y los resultados se escriben
en el esquema del endpoint, las llamadas se ensamblan completas a partir de cada flujo, y el razonamiento firmado de una respuesta de Messages
viaja en su mensaje del asistente hasta que termina el turno. Una ejecución del Agent nombra su
endpoint en `forwardedProps.endpoint`; la conversación lo almacena y un turno reanudado lo conserva.
Los IDs de modelo provienen del directorio vivo de claves de cliente, no de precios ni del tráfico histórico. Cada entrada
lleva el `id` de OpenAI más un `call_point` explícito (el mismo identificador visible para el cliente que devuelve
CPA); el selector usa ese punto de llamada. La capacidad de visión es desconocida. Las imágenes del Agent se
normalizan en el navegador a WebP, de a lo sumo 2048 píxeles en el borde largo y 512 KiB, antes del
almacenamiento y la repetición. Los errores contienen códigos seguros, el estado HTTP upstream y nombres de parámetros
permitidos y no cuerpos upstream. El uso ausente sigue ausente. La ingesta de CPA permanece sin cambios.

El ADR 0022 registró la frontera de derechos y privacidad del antiguo playground de modelos; los ADR 0022-0024
se eliminaron cuando se eliminó el Playground. Las pruebas unitarias del gateway, las pruebas de la fachada y las sondas de escritorio/teléfono
cubren el flujo del Agent. Las lecturas de modelos de la demo pública se generan mediante la fachada real;
la inferencia se rechaza explícitamente, mientras que un ejemplo grabado local al navegador demuestra el flujo (ADR 0092).

## 15. Dónde mirar a continuación

- Vocabulario del dominio: `CONTEXT.md`
- El despliegue y sus compromisos: `docs/adr/0001-go-react-sqlite-modular-monolith.md`
- Claves de identidad y revinculación: `docs/adr/0002-cpa-binding-and-identity-hierarchy.md`
- Inmutabilidad del costo: `docs/adr/0003-request-time-price-snapshots.md`
- Sistema visual: `docs/design.md`
- Compuertas de copia de seguridad, restauración y migración: `docs/ops/sqlite-operations.md`
- Estado de paridad de funciones frente a CPAMC: `docs/cpamc-parity.md`
- Base de CPA v8, tabla de reubicación y mediciones: `docs/cpa-v8-compat.md`

## Hora de calendario de todo el despliegue

`internal/timezone` resuelve el calendario del despliegue a partir de `TZ`, el nombre de la zona del sistema o el archivo de zona local, e incrusta los datos IANA de Go para la carga sin conexión de zonas con nombre. `Repository` es dueño de una ubicación de runtime atómica y serializa las confirmaciones de la preferencia de zona horaria antes de publicar la nueva ubicación. El arranque carga `omc_timezone` de la tabla de preferencias existente; no se necesita migración ni reescritura de marcas de tiempo. Las anulaciones inválidas fallan la validación en lugar de reemplazar un calendario que funciona. La API de preferencias sigue con lista de permitidos: `PUT /preferences/omc_timezone` acepta un nombre IANA o una cadena vacía, y `GET /preferences` incluye metadatos `time_zone` (`timezone`, `server_timezone`, `effective_timezone`).

La aplicación envuelve su handler de registros con un resolvedor de ubicación por registro, de modo que las escrituras de zona horaria exitosas afectan las nuevas marcas de tiempo de registros de Shell-PAMC sin cambiar el `time.Local` global del proceso. La retención, la caducidad de autenticación, las marcas de agua del recolector y las marcas de tiempo almacenadas siguen usando instantes absolutos. El contexto de sistema del Agent integrado nombra el calendario efectivo; `timezone_get` y `timezone_set` usan la misma validación del repositorio mediante `internal/operations`.

`web/src/utils/time.ts` es dueño de la construcción de fechas consciente de la zona horaria y de la conversión de marcas de tiempo del gateway. `TimeZoneProvider` hidrata el ajuste del despliegue dentro de la carcasa autenticada; los lectores suscritos se actualizan ante cambios de preferencia y reversión de escrituras fallidas. La configuración de gráficos memoizada y la agrupación de auditoría incluyen la zona como dependencia. Las claves de día usan ese calendario; el selector de rango de tiempo (`web/src/components/common/timeRange/`) prepara fechas civiles y horas de reloj y las resuelve a instantes una sola vez, al Aplicar, de modo que el desfase aplicado es el vigente en la fecha elegida. El mapa de calor acepta un `tz` explícito opcional para consumidores de la API y por defecto usa la zona efectiva de Shell-PAMC del lado del servidor; la consola envía su zona efectiva compartida.

`web/src/components/common/TimeZoneSelect.tsx` es un selector controlado y reutilizable, independiente de la persistencia de preferencias. Acepta `value`, `onChange`, `serverTimezone` opcional, `isDisabled`, `id` y una etiqueta accesible. La zona del servidor se fija primero y se anota; el llamador decide si elegirla borra una anulación. Las opciones y los desfases con clave por minuto se almacenan en caché, y las filas virtuales de altura fija acotan la lista renderizada preservando la búsqueda y la navegación por teclado.

## Biblioteca de íconos personalizados

`internal/iconasset` valida PNG/JPEG/WebP estáticos y reconstruye SVG a partir de una lista de permitidos de elementos/atributos XML. Las importaciones aceptan Base64 estándar con o sin relleno y URL de datos de imagen Base64. El MIME del cliente no es de confianza; el MIME declarado de una URL de datos debe coincidir con la imagen decodificada. El arte decodificado y reconstruido está acotado a 512 KiB, las dimensiones raster a 1024 píxeles por eje y los cuerpos JSON HTTP a 1 MiB. Se rechazan PNG/WebP animados, scripts, eventos, directivas XML, objetos foráneos, recursos externos y atributos de estilo SVG. Solo el arte validado se previsualiza en el navegador.

`web/src/types/customIcons.ts` es dueño del análisis de referencias personalizadas, el filtrado de la biblioteca y la resolución de arte seguro para plugins; `web/src/hooks/useCustomIcons.ts` comparte metadatos con revisión con todas las superficies de proveedor renderizadas.

La migración 032 crea `custom_icons`: `id` aleatorio estable, `name`, `mime_type`, `content` de imagen, `revision` monótona y marcas de tiempo de creación/actualización en milisegundos. El despliegue contiene como máximo 100 íconos, con nombres recortados de a lo sumo 80 caracteres Unicode. El arte se almacena por separado de `ui_preferences`; `provider_icons` preserva los ID de catálogo existentes y añade referencias `custom:<id>`. Las preferencias validan las referencias dentro de su transacción de escritura, mientras que la eliminación quita cada mapeo almacenado coincidente, incluidas las claves de nombre heredadas, dentro de la misma transacción que la eliminación del recurso. Quitar las anulaciones, en lugar de escribir un ID de catálogo fijo, preserva la resolución por defecto/marcador de posición de cada superficie y la autoridad de marca del plugin. Una sola conexión SQLite serializa estas operaciones, impidiendo carreras de asignación/eliminación. El arte está oculto de la capacidad de base de datos de forma libre.

Las rutas autenticadas por sesión son `GET`/`POST /custom-icons`, `POST /custom-icons/preview`, `PATCH`/`DELETE /custom-icons/{id}` y `GET`/`HEAD /custom-icons/{id}/content`, bajo la base de API configurada. Crear acepta `{name,data}`; actualizar acepta `name` y `data` opcionales; la vista previa acepta `{data}`. La lista devuelve `{icons}` con metadatos/conteos de referencias, no bytes. Las respuestas de contenido usan MIME validado, nosniff, una CSP de sandbox y revalidación privada con un ETag de revisión. La vista previa no es persistente y es no-store. Las importaciones inválidas devuelven 400, las demasiado grandes 413, los íconos ausentes 404 y el agotamiento de la biblioteca 409, con códigos de error estables. Los errores de la consola nunca citan la entrada de imagen.

Operations registra el mismo CRUD respaldado por repositorio para Agent/MCP. Las listas están acotadas a veinte registros de metadatos por página; las cargas de capacidades siguen sujetas al sobre de herramienta existente de 32 KiB. La eliminación requiere una confirmación atada a la revisión de contenido del ícono, con una vista previa de conteo de referencias/restablecimiento al valor por defecto. Su transacción vuelve a comprobar la revisión y quita todas las anulaciones coincidentes actuales. Las entradas de auditoría omiten argumentos/resultados. El renderizador de íconos compartido del frontend resuelve el arte personalizado usando una sola consulta de metadatos y URL de imagen autenticadas del mismo origen, con marcadores de posición seguros ante lecturas fallidas. La invalidación por mutación actualiza todas las referencias montadas. Los logos de plugins conservan la precedencia; un proveedor propiedad de un plugin nunca recurre al arte subido por el operador.

## Biblioteca de fuentes

Los dos roles tipográficos de la consola (`ui`, `mono`) se almacenan como la preferencia `omc_fonts` y `web/src/types/fonts.ts` los resuelve en pilas CSS; `web/src/theme/fontLibrary.ts` los escribe en `--font-ui` y `--font-mono` en el elemento raíz, declara las caras de la biblioteca con `FontFace` (nombre de familia `omc-font-<id>`, el `unicode-range` almacenado, archivos del endpoint de caras) y refleja la elección resuelta en localStorage (`omc-fonts`) para que `main.tsx` la pinte antes del primer renderizado. `useConsoleFonts` lee la biblioteca solo cuando un rol la usa. Los controles de ajustes viven en `web/src/components/settings/FontSettings.tsx`: dos selectores de rol en Apariencia, con la instalación, la carga y la eliminación de familias en un diálogo modal de biblioteca (ADR 0100).

`internal/fontasset` reconoce WOFF2, WOFF, TrueType y OpenType por firma y describe una cara a partir de su peso `OS/2` y su bit de cursiva, su eje de peso `fvar` y su familia `name` (primero la familia tipográfica); las tablas WOFF se descomprimen, WOFF2 recurre al nombre de archivo. Los archivos están acotados a 32 MiB. El instalador de Google solicita `css2?family=<name>:wght@400;700` (recurriendo solo a la familia para las de un único peso) con una identidad de navegador que produce fragmentos woff2, fusiona las reglas que comparten un archivo en una sola cara que abarca ambos pesos, y descarga con ocho en paralelo bajo un presupuesto de tres minutos y un techo de familia de 96 MiB. Toda URL de hoja de estilos y toda redirección deben permanecer en los hosts de fuentes de Google o en el sitio de la base configurada.

Las rutas autenticadas por sesión son `GET /fonts` (familias con declaraciones de caras, sin bytes), `POST /fonts/google` (`{family}`), `POST /fonts/upload` (partes multipart `file` y un `family` opcional, como máximo doce archivos y 96 MiB), `DELETE /fonts/{id}` y `GET`/`HEAD /fonts/{id}/faces/{faceId}`. Las dos rutas de transferencia elevan los plazos de lectura y escritura de 30 segundos del servidor a cuatro minutos para su propia solicitud. Las respuestas de caras llevan el tipo MIME de fuente, nosniff, una CSP de sandbox y `private, max-age=31536000, immutable`, porque los bytes de una cara nunca cambian bajo su id. Los archivos y nombres de familia inválidos devuelven 400, los demasiado grandes 413, una familia o cara ausente 404 (también para una familia de Google que no existe), una biblioteca llena (32 familias) 409 y un Google inalcanzable 502, con códigos `font_*` estables. Las escrituras de preferencias validan las referencias `font:` dentro de su transacción. La demo permite las lecturas, tiene una biblioteca vacía y rechaza instalaciones, cargas y eliminaciones.

## Configuración en teléfono y ciclo de vida del editor

`ConfigPage` es dueña de una anulación de ajuste de línea de la sesión de código fuente y del estado de enfoque, independientemente de `useConfigDraft`.
La edición enfocada cambia la geometría fija del contenedor de código fuente existente, nunca la clave del editor ni la ruta
del modelo. `YamlSourceEditor` sigue cargándose de forma diferida y la misma instancia de Monaco preserva la pila de deshacer,
la selección y el scroll. Los valores por defecto del teléfono siguen los 640 px salvo que el operador haya elegido el ajuste de línea para esta
sesión de código fuente. El modo visual borra esa anulación. Los workers locales de YAML siguen sin conexión con las solicitudes de esquema
desactivadas; el adaptador Monaco-YAML suministra un worker concreto a Monaco 0.56 y entrega los
mensajes de arranque/ajustes del gestor heredado antes de que comience el RPC. Vite preempaqueta los imports de dependencias CommonJS del worker que de otro modo serían inalcanzables, para que el worker de desarrollo coincida con el bundle sin conexión compilado.

`useVisibleViewport` sigue el redimensionado y el scroll solo mientras es necesario, ignora la escala de pellizco y recurre
al viewport de layout. `ConfigDirtyBar` informa la altura medida mediante un ResizeObserver para que la página
reserve espacio real; la edición enfocada monta la barra de acciones compartida en la región enfocada. Los hermanos
de la aplicación quedan inertes mientras los portales modales a nivel de body siguen siendo interactivos. El enfoque, las herramientas y la confirmación de guardado
se unen a `useOverlayHistory`; un conflicto permanece por encima del enfoque, y salir del enfoque preserva el borrador.
El `WorkspaceLayout` compartido también acota su propia altura al viewport visible del teléfono para que el Agent conserve su scroller de transcripción y su compositor por encima del teclado. Todos los observadores y escuchas de eventos son propiedad de efectos, incluida la limpieza/reconfiguración de StrictMode.

## Directorio Model Square

La ruta diferida `/model-square` lee `GET /management/model-square` mediante
`web/src/api/client.ts`. El adaptador HTTP de `internal/api/model_square.go` y la
capacidad de solo lectura `models_list` comparten `operations.Service.ListModelSquare`.
El servidor lee las claves de cliente configuradas de CPA, selecciona la primera no vacía y
llama al `/v1/models` del gateway. Las claves de cliente nunca entran en el resultado ni en el estado del frontend;
un despliegue sin ninguna devuelve HTTP 409 con `client_key_required`. Los fallos del gateway
usan la proyección de errores segura existente. Este directorio no hace ninguna solicitud de inferencia.

Los ID anunciados por CPA son la única autoridad de disponibilidad. Los mapeos configurados preservan
el fanout independientemente del mapa de ambigüedad de alias de precios. Las entradas nativas sin mapeos
explícitos pueden leer los catálogos fijos `/routing/model-definitions/{channel}` de CPA, aplicando
exclusiones y prefijos. Las listas OAuth aportan solo puntos de llamada publicados; la inversión de
alias suministra la identidad upstream donde se conoce. Toda procedencia se interseca con
los ID anunciados en vivo. Los modelos vivos sin coincidencia conservan identidades de proveedor/upstream vacías;
un enriquecimiento fallido emite condiciones `partial` con nombre sin ocultar la lista viva. Esta
proyección adicional en memoria no cambia la persistencia de precios.

La instantánea de gestión compartida también lee una vez las reglas globales de alias OAuth saneadas
cuando existen credenciales habilitadas. Solo las reglas que coinciden con el ID registrado de una credencial
añaden su upstream al mapa de identidad de precios y a la procedencia de rutas OAuth.
Los `Models` del proveedor siguen siendo visibles para el cliente; `internal/app` adapta la pertenencia OAuth
mediante `ConfiguredModelProvider.ListPricingModelIDs` para el libro de precios. Una lectura fallida de alias
hace incompleto el descubrimiento de precios, preservando su catálogo persistido;
Model Square sigue intersecando la procedencia con la lista anunciada en vivo.

El handler HTTP proyecta listas de permitidos de DTO propiedad de la API para el directorio, sus referencias
de modelo y sus hechos/enlaces anidados, independientemente del crecimiento de tipos de operación/catálogo.
El DTO contiene `models` anunciados, `providers` seguros, `routes` exactas, `partial`,
`model_info` y `metadata_updated_at`. No se proyectan claves, metadatos de credenciales/cuentas ni la URL
upstream completa; los endpoints de conexión se reducen a nombres de host. Las superposiciones existentes de
nombre/ícono del proveedor se aplican por ID de proveedor estable.

`internal/modelcatalog` embebe una instantánea de referencia de models.dev, independiente del
catálogo de precios de OpenRouter (ADR 0061). La instantánea contiene hechos canónicos de modelos y
alias declarados por la fuente sin ambigüedad, sin costos de revendedores. La evidencia en `Catalog.Match`
es siempre una identidad canónica exacta o un alias declarado por la fuente. Un nombre que no es ninguno de los dos
se reintenta solo en formas que denotan el mismo modelo, cada una de las cuales debe coincidir exactamente:
sin etiqueta de router (`:free`), sin un sufijo de la lista cerrada `VARIANT_SUFFIXES`
(esfuerzo de razonamiento, `-thinking`) y sin espacios de nombres de enrutamiento iniciales (`relay/model`).
El nombre literal siempre se prueba primero, de modo que una variante que la fuente publica como su propio
modelo conserva su propio registro; la similitud y la eliminación de versiones nunca son evidencia. Los enlaces de pesos/recursos admiten solo URL
HTTPS sin credenciales. `pnpm models:sync` regenera la instantánea desde fuentes fijas de models.dev;
las solicitudes ordinarias nunca obtienen catálogos de terceros. Los metadatos se devuelven solo para
las identidades representadas en las rutas vivas de este despliegue. Los desconocidos siguen siendo desconocidos.

`web/src/types/modelSquare.ts` agrupa los nombres de cliente por fabricante, ordena los fabricantes con nombre por delante de los
grupos múltiples y no identificados, preserva múltiples destinos dando un perfil por modelo de origen distinto, busca en el conjunto anunciado,
aplica el filtro de fabricante, decide qué referencia puede rotular una fila, clasifica la apertura
(código cerrado, pesos abiertos, código abierto según una lista de permitidos de licencias) y construye una
navegación de referencia segura. La página dibuja secciones abiertas de fabricante y un Drawer de detalle de modelo consciente de Back
que nombra las conexiones que sirven y recorre la lista filtrada. La búsqueda y el
fabricante se reflejan en `q` y `maker`; la paginación está
acotada a 120 filas. Los enlaces externos van al detalle canónico de
models.dev, a la búsqueda de OpenRouter o a la búsqueda por `name` de pi.dev; se abren
solo por acción explícita del operador. Todo el arte de marca se sirve localmente.

### Vínculo con precios y solicitudes

El directorio también muestra el precio y las solicitudes recientes de cada modelo, y remite al
editor de precios y a la lista de solicitudes. No es dueño de ninguno de esos datos. El acoplamiento se confina a
un módulo puro, `web/src/types/modelSquareLedger.ts`, y descansa en un contrato:

- **Claves de join.** Los conteos de solicitudes usan el nombre de llamada del cliente como `model_alias`. Las lecturas y
  ediciones de precio siguen la ruta explícita del directorio hacia su modelo upstream y el canal registrado
  del proveedor. No se elimina ningún prefijo heurísticamente. Varios destinos de ruta siguen
  siendo opciones separadas, y un resumen de precio único queda desconocido cuando esos destinos difieren.
- **Lecturas.** `GET /pricing` bajo la clave de caché compartida `PRICING_QUERY_KEYS.book`
  (`web/src/components/pricing/pricingQueries.ts`), de modo que un precio guardado en el editor llega
  a las filas sin una lectura propia; y `GET /usage/facets?preset=24h`, cuya faceta
  `model_aliases` es el conteo de solicitudes por nombre de llamada. No se añadió ningún endpoint.
- **Acciones.** `useOpenPriceEditor` (el editor de toda la consola) y `modelRequestsLink`, que
  construye la propia consulta `preset` + `model_alias` de la lista de solicitudes; la suite del libro mayor analiza ese
  enlace con el lector de la lista de solicitudes, de modo que un filtro renombrado hace fallar una prueba, no un clic.
- **Degradación.** El directorio es la autoridad y se renderiza solo. Un vecino que falló
  o no ha respondido produce `unknown` - una celda en blanco y ninguna acción de precio - nunca «sin valorar»
  ni cero. Un nombre que el libro cargado no lista está sin valorar por definición. El vínculo es por modelo
  solamente, y toda cifra de uso comparte la única ventana de 24 horas (`MODEL_REQUEST_PRESET`); el uso a 30 días
  del libro de precios no se lee, porque se agrupa por el modelo upstream registrado y no
  por el nombre de llamada: la página no agrega nada sobre el libro, cuyo resumen pertenece a Costo y uso. La faceta devuelve
  como máximo 200 valores, los más activos primero (`USAGE_FACET_VALUE_CAP`), de modo que una lista llena deja
  desconocido el conteo de un modelo ausente en lugar de cero.

Un cambio en la respuesta del libro de precios, en la forma o el tope de la faceta, o en los
nombres de filtro de la lista de solicitudes se responde en ese módulo y en `scripts/test-model-square-ledger.ts`; la página
solo renderiza un `ModelLedgerEntry`.

### Propiedad de la verificación de CI y de versiones (ADR 0068)

La identidad de la versión precede a tres carriles paralelos de verificación de solo lectura: estático,
navegador compilado/demo completo y el catálogo de sondas completo en tres shards. El agregado final
`verify` rechaza prerrequisitos fallidos, cancelados u omitidos. Todo consumidor de publicación
hace checkout de la revisión verificada, y la concordancia etiqueta-commit se
resuelve de nuevo en las fronteras de publicación externa. Las dependencias nativas y las salidas
de compilación permanecen frescas; esto no cambia la frontera de confianza de caché del ADR 0066.

La selección local de lógica afectada es conservadora y solo de desarrollo; la verificación estática final
conserva el descubrimiento automático de la suite completa. Los contextos de navegador rechazan
endpoints no declarados, errores de runtime inesperados y tráfico HTTP/WebSocket saliente.
Los ciclos de vida de Vite y BrowserServer son explícitamente propios y están acotados. Las temporizaciones estructuradas de sondas
respaldan pesos de shard deterministas revisados en lugar de una selección en runtime.
El workflow independiente de mantenimiento semanal es dueño de las comprobaciones dirigidas de race/fuzz/advisory
y de la evidencia de runtime de Windows/macOS sin añadir auditorías dependientes de la red a las compuertas de PR.
Véase `docs/testing.md` para presupuestos, propiedad de fallos y registro.

### Repetición de la demostración y fidelidad de respuestas portables

`web/src/demo/agentReplay.ts` transmite la `agentRecording.json` curada mediante AG-UI;
la grabación se carga bajo demanda solo en modo demo, con ritmo local y respetando las señales de aborto. El `session.ts` del Agent
retiene la conversación asentada a través de las relecturas de consultas hasta la recarga/reinicio.
`recordingTemplate.ts` localiza el texto y reubica las fechas grabadas al ancla de la ejecución. El
Worker sigue rechazando las escrituras del servidor y no tiene ruta de inferencia. El ADR 0092 registra esta frontera.

La instantánea de exportación usa `answerLayout.ts` y `callFacts.ts` para preservar el orden de los bloques de respuesta,
los resúmenes de llamadas, el estado, las temporizaciones y las líneas de tiempo de razonamiento/llamadas. La agrupación
del framework en vivo sigue siendo propiedad de la página y se prueba con esos mismos casos. La captura de canvas nunca combina
el permiso de script con el permiso de mismo origen: el marcado del modelo se ejecuta solo en el sandbox opaco existente,
su respuesta acotada se convierte en una imagen, y la instantánea externa tiene los scripts deshabilitados.
Una figura ausente conserva una nota explícita de imagen no disponible; todas las páginas de la transcripción deben codificarse
antes de que se descargue ningún PNG.

## Calentamiento de ventanas de credenciales (ADR 0097 y 0098)

`internal/warmup` es dueño de las políticas, la evidencia explícita de facturación/activación, las decisiones puras de calendario y
ciclo, y los adaptadores fijos de solicitudes diminutas. `internal/api/warmup.go` orquesta
la elegibilidad de credenciales, la auditoría antes del envío, la exclusión de ejecución por credencial, las lecturas
frescas de cuota y la verificación de la finalización. Operations expone la misma implementación a
las escrituras confirmadas del Agent/MCP. CPA conserva la sustitución de tokens y el transporte específico de la credencial;
ni el navegador ni el modelo pueden suministrar una URL upstream ni leer tokens OAuth.

El servicio de cuota analiza `warmup_evidence` de la misma lectura de uso exitosa del proveedor.
Lleva el respaldo de pago como un valor de tres estados en lugar de colapsar campos omitidos o falsos.
`quota_snapshots.warmup_json` preserva esa evidencia a través de la actualización programada,
la actualización manual y el canje de créditos de reinicio. Una copia del servicio por lectura mantiene la evidencia
aislada cuando la actualización por lotes existente comparte un servicio de forma concurrente.

La migración 041 añade `credential_warmup_policies` (instancia/alcance/identidad),
`credential_warmup_state` (un registro de programación por instancia/credencial) y
`credential_warmup_runs` (los 100 recibos más recientes por instancia/credencial). Las políticas requieren
confirmación y una revisión; las anulaciones de credencial incluyen una huella de identidad con clave y el proveedor
en su clave de almacenamiento. El campo de cuenta opaco de CPA se hashea, nunca se persiste ni se devuelve. El reemplazo de identidad descarta las observaciones de activación previas y el estado de programación. Las tres
tablas sin secretos se clasifican explícitamente para el ciclo de vida y las consultas de solo lectura.

La aplicación inicia y une el bucle de calentamiento por minuto junto con la actualización automática de cuota.
Las políticas deshabilitadas no provocan lecturas de uso upstream. Las credenciales habilitadas se comprueban en
rondas acotadas de 16 con a lo sumo cuatro contextos concurrentes, buscando evidencia fresca
cada cinco minutos y reutilizando evidencia de cuota almacenada más reciente. Todo intento que consume
realiza primero una lectura fresca. Las solicitudes automáticas y manuales comparten un bloqueo de credencial y recibos
duraderos. Un rechazo de revalidación previo al envío restaura el ciclo, la tarea diaria y la base de
activación anteriores porque no ocurrió ninguna solicitud que consumiera. Los recibos en ejecución abandonados por un reinicio son
inciertos; no se reenvían. Un error transitorio de recuperación al arrancar se diagnostica y
se reintenta en los ticks de minuto; las rondas que consumen esperan a una recuperación exitosa.
Los rechazos definitivos por límite de tasa usan retroceso de uno/cinco/quince minutos, con a lo sumo tres
reintentos; una respuesta exitosa se comprueba de inmediato y a lo sumo dos veces más sin
reenviar. Una ejecución manual mientras esa comprobación sigue pendiente se rechaza (`activation_pending`)
sin enviar y sin acortar la comprobación pendiente. El backend de Codex transmite
cada elemento de salida en `response.output_item.done` y normalmente deja vacía la salida de `response.completed`,
así que el adaptador juzga la finalización a partir de ambos. Una ventana de Codex inactiva informa un
reinicio que se desliza con cada lectura; la activación es un reinicio que dejó de deslizarse, movido solo
por el retraso entre la primera lectura y el envío, observado al menos 30 segundos después. Una política habilitada aprobada admite el primer intento automático y un
modelo nuevo seleccionado explícitamente mediante evidencia fresca de cuota y facturación. Los campos de estado heredados `protocol_verified`
y `verified_model` registran la activación observada; no admiten ni suprimen
la ejecución. Una respuesta observada de protocolo no admitido pausa las solicitudes automáticas para el
mismo modelo, mientras que una acción manual confirmada puede volver a comprobar la compatibilidad. Su `protocol_pause`
opcional de modelo/motivo se persiste independientemente del último resultado en el JSON de
estado existente; los rechazos heredados del último resultado se trasladan antes del reemplazo. Una nueva comprobación con límite de tasa
o sin resolver conserva la pausa; la activación observada para ese modelo la borra.
Un modelo distinto seleccionado explícitamente se evalúa de forma independiente. Un modelo cambiado
no se sustituye en silencio. Las proyecciones de lectura preservan la ventana actual o el motivo de facturación
en lugar de reemplazarlos con el estado de activación histórico (ADR 0098).

La fachada añade ajustes de calentamiento, política/estado de credencial y rutas de ejecución manual bajo
`/management/quota/warmup`. La demo pública exporta los ajustes y un estado representativo de
credenciales pero rechaza las escrituras de políticas y el consumo, y nunca inicia el bucle.

El orden de las rondas de calentamiento es la observación más antigua primero. Las flotas que exceden la capacidad de una ronda
permanecen en cola en lugar de aumentar la concurrencia u omitir la protección.
