# Configuración y operaciones

Lo que necesita un operador después de `docs/install.md`: los ajustes que lee Shell-PAMC, las
restricciones que debe respetar un despliegue y el comportamiento de las partes que sobreviven a una
visita de página. La copia de seguridad, restauración y mantenimiento de la base de datos desde el host
tienen su propio manual de procedimientos, `docs/ops/sqlite-operations.md`.

## Despliegues nativos

Las versiones nativas admiten Darwin, Windows, Linux y FreeBSD en amd64/arm64. El
ejutable integra la SPA y la base de datos de zonas horarias IANA, pero HTTPS sigue usando las
raíces de certificados del sistema operativo. La plantilla de entorno incluida enlaza al loopback y guarda
SQLite en `./data`; ejecútalo con un usuario o cuenta de servicio dedicados, conserva su directorio de
trabajo y restringe el acceso al entorno y los datos con permisos Unix o ACL de Windows.
El uid/gid `10001:10001` del contenedor no es un requisito para instalaciones nativas. Deja
`SHELLPAMC_VERSION` sin definir para conservar la etiqueta de versión inyectada. Detiene Shell-PAMC antes de reemplazar
el ejecutable, conserva la clave maestra y el directorio de datos, y haz una copia de seguridad de ambos antes de una
actualización. Solo una copia de seguridad de datos que coincida puede deshacer las migraciones de avance. Los pasos de descarga,
suma de comprobación y configuración del host están en `docs/install.md`.

## Ajustes

> **Cambio incompatible: se renombraron las variables de entorno.** Cada variable `OMCPA_*` es ahora `SHELLPAMC_*` (por ejemplo, `OMCPA_MASTER_KEY` es ahora `SHELLPAMC_MASTER_KEY`). Los nombres antiguos no se leen, por lo que una instalación actualizada in situ debe renombrarlos en su `.env`, archivo Compose o unidad de servicio antes del primer inicio; sin `SHELLPAMC_MASTER_KEY` el proceso se niega a arrancar.

Todo es una variable de entorno. El binario también lee `.env` desde su directorio de trabajo
(`SHELLPAMC_ENV_FILE` nombra otro archivo); las variables de entorno reales tienen prioridad.
`internal/config/config.go` es autoritativo, y un valor mal formado detiene el inicio con
un mensaje que nombra la variable.

### Obligatorias

| Variable | Propósito |
| --- | --- |
| `SHELLPAMC_CPA_BASE_URL` | Dirección de CPA, por ejemplo `http://127.0.0.1:8317` |
| `SHELLPAMC_CPA_MANAGEMENT_KEY` | Clave de administración de CPA en texto plano. También es la contraseña de inicio de sesión de la consola |
| `SHELLPAMC_MASTER_KEY` | Clave de cifrado en reposo: una clave hexadecimal de 64 caracteres (`openssl rand -hex 32`) o al menos 32 bytes |

### Servicio

| Variable | Valor predeterminado | Propósito |
| --- | --- | --- |
| `SHELLPAMC_VERSION` | etiqueta estable integrada; `v0.1.0-dev` para compilaciones de código fuente sin etiquetar | Anulación opcional de la versión para visualización y User-Agent; no cambia la compilación instalada |
| `SHELLPAMC_LISTEN_ADDR` | `:8080` | Dirección de escucha |
| `SHELLPAMC_BASE_PATH` | `/shell-pamc` | Subruta bajo la que se sirve la consola. `omc`, `/shell-pamc/` y `/shell-pamc` son equivalentes; `/` la sirve en la raíz |
| `SHELLPAMC_DATA_DIR` | `./data` | Directorio que contiene `shell-pamc.db`. Solo disco local. Una base de datos bajo el nombre antiguo `oh-my-cpa.db` (con sus archivos `-wal` y `-shm`) se renombra en el primer inicio; si existen ambos nombres el inicio falla y se conserva el que contiene los datos |
| `SHELLPAMC_PUBLIC_URL` | no definida | La dirección que usan los navegadores. Un valor `https://` marca la cookie de sesión como `Secure` |
| `SHELLPAMC_TRUSTED_PROXY_CIDRS` | no definida | CIDRs separados por coma de los proxies inversos cuyos encabezados de reenvío pueden ser de confianza para la limitación del inicio de sesión |
| `TZ` | zona del sistema | Calendario del servidor; consulta [Zona horaria](#zona-horaria) |

### Conexión a la pasarela

| Variable | Valor predeterminado | Propósito |
| --- | --- | --- |
| `SHELLPAMC_CPA_USAGE_ADDR` | host y puerto de `SHELLPAMC_CPA_BASE_URL` | `host:port` del flujo de uso de CPA |
| `SHELLPAMC_REQUEST_TIMEOUT` | `15s` | Tiempo de espera para las llamadas ordinarias de administración de CPA |
| `SHELLPAMC_CPA_TLS_SKIP_VERIFY` | `false` | Omitir la verificación del certificado cuando CPA usa un certificado privado |

### Recopilación de uso

| Variable | Valor predeterminado | Propósito |
| --- | --- | --- |
| `SHELLPAMC_USAGE_INGEST_MODE` | `auto` | `auto`, `subscribe`, `resp_pull`, `http_pull` u `off` |
| `SHELLPAMC_USAGE_IDLE_INTERVAL` | `1s` | Primera espera tras un sondeo vacío |
| `SHELLPAMC_USAGE_MAX_IDLE_INTERVAL` | `10s` | Límite máximo al que crece el retroceso en inactividad. Manténlo muy por debajo de `redis-usage-queue-retention-seconds` de CPA |
| `SHELLPAMC_USAGE_BATCH_SIZE` | `1000` | Registros leídos por sondeo (1–10 000) |
| `SHELLPAMC_USAGE_RETENTION_DAYS` | `90` | Días que se conservan los registros de solicitudes (la lista de solicitudes y sus detalles), `0` para conservarlos todos. Noventa coincide con el ajuste preestablecido más largo de la lista de solicitudes. Las estadísticas del panel no dependen de esto: se conservan permanentemente como hechos de uso |
| `SHELLPAMC_USAGE_INBOX_RETENTION_DAYS` | `7` | Días que se conserva una carga útil capturada tras decodificarse en un registro de solicitud, `0` para conservarla tanto como el registro. Las cargas útiles son la parte más grande de la base de datos y nada las lee una vez decodificadas, salvo una redecodificación tras una corrección del decodificador |

### Comprobaciones de actualizaciones y demo

| Variable | Valor predeterminado | Propósito |
| --- | --- | --- |
| `SHELLPAMC_UPDATE_CHECK_ENABLED` | `true` | El barrido de versiones cada seis horas |
| `SHELLPAMC_UPDATE_CHECK_ON_PAGE_LOAD` | `true` | La comprobación que realiza la página Información del sistema al abrirse |
| `SHELLPAMC_OMC_REPO` / `SHELLPAMC_CPA_REPO` | `Bizasbot/Shell-PAMC` / `router-for-me/CLIProxyAPI` | `propietario/nombre` que leen las comprobaciones, para una bifurcación |
| `SHELLPAMC_DEMO_MODE` | `false` | Sirve la consola desde el fixture integrado; consulta [Modo demo](#modo-demo) |
| `SHELLPAMC_UPDATER_ENABLED` | `true` | `false` hace que la consola ignore un actualizador y no ofrezca ninguna acción de actualización; consulta [Actualizaciones desde la consola](#actualizaciones-desde-la-consola) |
| `SHELLPAMC_UPDATER_URL` | `http://shell-pamc-updater:8090` | Dónde busca la consola el actualizador. El valor predeterminado es el nombre de servicio y contenedor que usan todos los métodos de instalación |
| `SHELLPAMC_GOOGLE_FONTS_URL` | `https://fonts.googleapis.com` | La API de hojas de estilo de Google Fonts desde la que instala la biblioteca de fuentes, o un espejo compatible para un despliegue que no puede acceder a Google. Las solicitudes respetan `HTTPS_PROXY`; los archivos de fuentes solo se descargan desde los hosts de fuentes de Google o desde el propio sitio del espejo. Se usa solo cuando un operador instala una familia; la subida no necesita red |

El puente stdio MCP (`shell-pamc mcp`) lee solo `SHELLPAMC_SERVER_URL`,
`SHELLPAMC_CPA_MANAGEMENT_KEY` y el opcional `SHELLPAMC_VERSION`; el endpoint MCP remoto
no tiene ningún ajuste propio. Consulta [Agente y MCP](#agente-y-mcp).

## Restricciones del despliegue

- **Recopilador único**: la cola de uso de CPA es destructiva. Solo un recopilador puede leer
  de una instancia de CPA. Si otro servicio recopila el uso, define
  `SHELLPAMC_USAGE_INGEST_MODE=off`.
- **Réplica única**: SQLite WAL requiere acceso exclusivo de un solo proceso. Ejecuta una
  réplica que monte el directorio de datos; no lo montes sobre sistemas de archivos de red
  (NFS/CIFS).
- **Clave maestra**: `SHELLPAMC_MASTER_KEY` es necesaria para descifrar las credenciales y
  cargas útiles almacenadas. Haz una copia de seguridad de forma segura.
- **Contenido enmarcado**: el documento de la consola declara `frame-src 'self' blob:`. Enmarca páginas de complementos desde su propio origen y los lienzos en sandbox del Agente (ADR 0072); un proxy inverso no debe reemplazar esa política por una que permita otras fuentes de marcos.
- **Seguridad de red**: mantén CPA en una red privada o en la interfaz de loopback. Los archivos
  Compose suministrados publican CPA y Shell-PAMC solo en loopback; usa acceso local directo o un túnel
  SSH. El acceso público requiere HTTPS a través de infraestructura propia del operador.
- **Encabezados del proxy inverso**: define `SHELLPAMC_TRUSTED_PROXY_CIDRS` con los CIDRs de los proxies
  inversos cuyos encabezados de reenvío pueden ser de confianza. Ambos archivos Compose tienen por defecto una
  lista de confianza vacía. Nombra solo los pares proxy reales; déjalo sin definir para clientes directos;
  nunca confíes en un rango público.
- **Versión de la pasarela**: la consola requiere CPA v8.0.0 o posterior y habla su API de
  administración v8; una pasarela anterior a v8 es rechazada y cada página muestra guía de actualización
  en su lugar. CPA v8 lee un `config.yaml` v7 existente sin cambios, así que actualizar
  CPA no necesita ningún cambio de configuración. El primer guardado de configuración de la consola convierte
  dicho archivo al formato v8, después de conservar una copia cifrada del original que la página
  de configuración ofrece para descargar (consulta `docs/cpa-v8-compat.md`).
- **Configuración de la pasarela**: los reintentos de solicitud y el tiempo máximo de espera de
  enfriamiento omitidos equivalen a `0`; el `3` y el `30` del ejemplo se aplican solo cuando se configuran
  explícitamente. El reenvío de encabezados propaga al cliente los encabezados de respuesta de ámbito superior
  filtrados. Consulta `docs/cpa-v8-compat.md` para conocer la semántica de las otras opciones y las fuentes de
  ámbito superior.
- **Ruta base**: el servicio directo de Shell-PAMC admite `/shell-pamc` o `/`. La consola se sirve en
  el prefijo con barra final (`/shell-pamc/`); Shell-PAMC responde al prefijo sin barra (`/shell-pamc`) con
  una redirección 308 hacia él. Un proxy propio del operador debe conservar el prefijo y enrutar
  tanto el prefijo sin barra como todo lo que hay debajo (`deploy/nginx.conf` muestra ambas reglas;
  `docs/install.md` tiene el equivalente de Caddy); CPA conserva su puerto separado
  independientemente de la ruta base de Shell-PAMC.
- **Imagen del contenedor**: Compose descarga `ghcr.io/bizasbot/shell-pamc:latest` de GitHub Container Registry
  por defecto; la imagen CPA de pila completa también usa `:latest` por defecto. Fija `SHELLPAMC_IMAGE` a la
  versión o digest deseados; las actualizaciones recrean solo Shell-PAMC con sus datos y clave maestra
  existentes. La imagen se ejecuta como uid/gid `10001:10001`, incluye su propio sondeo de salud y no
  necesita scripts de despliegue montados. Un resultado de salud `degraded` mantiene el contenedor
  saludable pero no establece acceso a CPA.
- **CPA y paneles existentes**: el Compose solo de Shell-PAMC puede adjuntarse a una red Docker
  externa existente. No reemplaza la pasarela ni otros paneles; la titularidad de la
  recopilación debe resolverse por separado. Consulta `docs/install.md` y `docs/install-for-agents.md`.

## Zona horaria

Define `TZ=Asia/Kuala_Lumpur` (u otra zona horaria IANA) en el entorno del despliegue para
elegir el calendario del servidor. Los archivos Compose suministrados pasan `TZ` a Shell-PAMC y a CPA y
por defecto usan `UTC`. Para un contenedor independiente, pasa `-e TZ=Asia/Kuala_Lumpur`. Los
despliegues nativos usan de lo contrario la zona horaria del sistema operativo.

En **Ajustes de Shell-PAMC → Zona horaria**, la zona del servidor se selecciona automáticamente y se
marca como **Zona horaria del servidor**. Cada opción incluye su desplazamiento UTC actual. Una elección
manual se persiste para el despliegue; seleccionar la zona del servidor restaura el valor
predeterminado del despliegue. Las visualizaciones de marcas de tiempo, las selecciones de calendario, los totales
diarios y los registros del servicio de Shell-PAMC usan este ajuste sin reescribir los instantes almacenados. Mantén
iguales las zonas horarias del despliegue de CPA y Shell-PAMC: las líneas de registro de CPA sin desplazamiento se
interpretan en esa zona horaria compartida. Las descargas de registros en bruto y las reglas de nivel de
precios UTC explícitas conservan la semántica de su fuente.

## Comprobaciones de actualizaciones

La página Información del sistema informa de las versiones en ejecución y publicadas de Oh My
CPA y de la pasarela. Lee los metadatos de las versiones solo desde `api.github.com` — host
fijo, sin URL suministrada por el operador —, siguiendo `HTTP_PROXY`/`HTTPS_PROXY` igual que
hace la sincronización de precios. Un barrido se ejecuta cada seis horas; abrir la página y el botón
**Buscar actualizaciones** también comprueban, sujetos a un mínimo de quince minutos por producto —
dentro de ese intervalo la respuesta proviene del índice almacenado y el mensaje lo indica, porque el
feed es un presupuesto compartido por dirección.

Cuando alguno de los productos tiene una versión publicada más reciente, la entrada **Información del
sistema** en la navegación lleva un pequeño punto ámbar. Refleja la respuesta almacenada y no tiene
costo propio, por lo que aparece una vez que un barrido o comprobación ha encontrado la versión; una
consola abierta relee esa respuesta cada hora. **Ignorar esta versión** en la fila del producto borra el
punto para esa única versión y es recordado por el despliegue, no por el navegador; pulsarlo de nuevo
restablece el recordatorio, y una versión posterior se marca independientemente.

El enlace de GitHub en el encabezado muestra el recuento de estrellas del proyecto, leído por el servidor
desde el mismo host y guardado en memoria. Cuesta como máximo una solicitud por hora: el barrido lo
actualiza, así como una carga de página de la consola cuando se permiten las comprobaciones en la carga
de página. Con ambos interruptores de abajo desactivados, o hasta que una primera lectura haya tenido éxito,
el enlace simplemente no muestra ningún recuento. Una vez que una lectura ha tenido éxito, el recuento
permanece durante la vida del proceso: una actualización que falla conserva el recuento anterior.

Dos interruptores, porque responden a preguntas diferentes.
`SHELLPAMC_UPDATE_CHECK_ENABLED=false` detiene el barrido en un despliegue sin conexión; la página
sigue funcionando a partir de la última respuesta que almacenó, y una comprobación que falla se informa
con su motivo y la hora en que se intentó.
`SHELLPAMC_UPDATE_CHECK_ON_PAGE_LOAD=false` detiene además la comprobación que la página realiza
al abrirse, que es lo que quiere un despliegue en red aislada o de prueba, ya que una visita a la
página no es un operador haciendo una pregunta. El botón **Buscar actualizaciones** funciona de cualquier
forma. El presupuesto no autenticado de GitHub es de 60 solicitudes por hora para la dirección que las
hace, y la página lo indica cuando una comprobación es rechazada por ese motivo. Las notas de versión
se guardan en memoria en lugar de almacenarse, por lo que tras un reinicio la página nombra las versiones
y enlaza a la fuente mientras las notas en sí no están disponibles — consulta `docs/architecture.md` §10.

## Actualizaciones desde la consola

En un despliegue de contenedor con actualizador (ADR 0099), la página Información del sistema ofrece
**Actualizar ahora** junto a un producto que tiene una versión más reciente. `docs/install.md` ("Actualización")
es la guía del operador, incluido el comando único que añade un actualizador a un despliegue
anterior.

El actualizador es la imagen de Shell-PAMC ejecutada como `shell-pamc updater serve`. Escucha en
`:8090` dentro de la red de Docker y no publica ningún puerto. Sus ajustes se leen desde su
propio entorno, y una instalación no necesita ninguno de ellos:

| Variable | Valor predeterminado | Propósito |
| --- | --- | --- |
| `SHELLPAMC_UPDATER_LISTEN_ADDR` | `:8090` | Dirección de escucha dentro del contenedor |
| `SHELLPAMC_UPDATER_SOCKET` | `/var/run/docker.sock` | El socket de Docker tal como está montado en el contenedor |
| `SHELLPAMC_UPDATER_OMC_CONTAINER` | encontrado por imagen | El contenedor de la consola, cuando hay más de un Shell-PAMC en ejecución en el host |
| `SHELLPAMC_UPDATER_CPA_CONTAINER` | encontrado desde `SHELLPAMC_CPA_BASE_URL` | El contenedor de la pasarela, cuando no se puede encontrar de esa forma |
| `SHELLPAMC_UPDATER_LINK_NETWORK` | vacía | Definida por `updater install`: la red a la que el actualizador mantiene conectada la consola. Vacía cuando ambos son servicios de un mismo archivo Compose |
| `SHELLPAMC_UPDATER_PUBLIC_KEY` | integrada | Clave pública Ed25519 en Base64 que reemplaza la clave de versión integrada, para una bifurcación que firma sus propias versiones |

Límite de seguridad:

- The updater holds the Docker socket, which is control of Docker on that host. The
  console does not, and stays read-only and unprivileged. Anyone who can already run
  `docker` on the host gains nothing; anyone who can reach the updater's port without
  its token gets `401`.
- The token is an HMAC of `SHELLPAMC_MASTER_KEY`. Neither container stores it, and it is
  not logged. Changing the master key needs no step here: the updater reads the
  console's current value from Docker.
- The updater accepts a product name only. It never takes an image, a container name or
  a command from the console, updates only the two containers it identified, and
  refuses an image pinned to a version tag or digest.
- Shell-PAMC is replaced only by the image a release's signed manifest names, and never
  by an older version. CLIProxyAPI is an upstream image this project cannot sign: its
  update pulls the tag the container already uses.
- A build without the release public key reports `signature_unavailable` and offers no
  console update for Shell-PAMC.

Network use: applying an Shell-PAMC update makes the console download
`release-manifest.json` and its `.sig` from the release's assets on `github.com`,
following redirects only to GitHub's own asset hosts over HTTPS, through the same proxy
settings as the update check. The image pull is made by the Docker daemon with its own
registry and proxy configuration.

Audit: `system.update.apply` records the admission, or the refusal with its reason,
before the updater is asked; `system.update.completed` records how that admission ended:
the job's outcome, or the updater's refusal or silence when no job started. An Oh
My CPA update ends the process that admitted it, so the next process follows the job
from start-up and records the outcome once the updater reports it finished.

## Database maintenance

The System Information page can truncate the WAL or rebuild the database, and refuses
the second while the first runs. Both wait for in-flight writes rather than interrupting
them, and a rebuild is declined up front when the filesystem lacks the free space SQLite
documents needing (up to twice the database file). A job cannot outlive a restart.
`docs/ops/sqlite-operations.md` §6 covers the same operations from the host.

## Agent and MCP

`/agent` sends the conversation and capability results to the CPA model selected on the
page and its upstream provider; the page states this beneath the message box, and the
choice of key, model and reasoning effort is remembered as a server-side preference.
A message may carry up to four PNG, JPEG or WebP images of at most 5 MiB each, beside up
to four text files (40 KiB together). Images are stored encrypted in `agent_documents`
for as long as their turn is part of the conversation, are sent to the model with every
round while they are among the conversation's newest eight, and are read back by the
console from `GET /api/v1/agent/images/{id}` under the console session only.

Agent runs and sessions are open-ended: Shell-PAMC applies no token, round, tool-call, display-count,
run-duration or session-size ceiling. Provider context/output limits and capability payload and
security checks still apply, as do the gateway's 120-second response-header and stream-idle
timeouts and 1 MiB SSE-line limit. Completed turns send conclusions with bounded metadata to later
rounds, while the stored transcript is retained until reset or explicit replacement. A long
conversation increases SQLite and backup size, serialization work, memory and upstream request
cost. Use Stop to end active work and New conversation to release the retained transcript and
images; monitor disk and process memory on the single replica. Image admission failure attempts
to clean up only newly written image rows; database failures can prevent that best-effort cleanup.

External agents connect over MCP to the same capability registry, in one of two ways:

| Transport | Address | Credential |
| --- | --- | --- |
| Streamable HTTP, served by the console | `<console URL>/api/mcp`, for example `https://shell-pamc.example.com/shell-pamc/api/mcp` | `Authorization: Bearer <CPA management key>` |
| stdio, the `shell-pamc mcp` bridge process | `SHELLPAMC_SERVER_URL` (the console URL, including any base path) | `SHELLPAMC_CPA_MANAGEMENT_KEY` |

The HTTP endpoint needs nothing installed where the agent runs; the **Connect** action at
the top of `/agent` shows the deployment's address and copyable client
configuration. It accepts the management key as a bearer token only (a console session
cookie is refused), throttles wrong keys per client address like the login form, keeps
no MCP session, answers each request in plain JSON, and is refused in demo mode. A
reverse proxy needs no special rule beyond forwarding the base path; serve it over
HTTPS, because the endpoint cannot tell that TLS was terminated in front of it. Clients
that require OAuth discovery cannot use it and use the bridge instead.

The stdio bridge is for clients that only speak stdio. It accepts plain HTTP only for
loopback addresses, refuses redirects, opens no data directory, and prints its usage for
`shell-pamc mcp --help`.

There is no separate external credential: holding the management key is
administrator-equivalent, so an external agent can prepare an operation and read its
status but cannot approve it, submit secrets, or complete OAuth. A prepared change
returns `status: "pending"` with a link to `<console URL>/authorize/<id>`, a
standalone authorization screen where the signed-in operator (signing in first if
needed) allows or denies that one operation; `omc_operation_status` reads the
outcome and can wait up to 30 seconds for the decision (`wait_seconds`). The read-only database queries and `ask_question` are offered to the built-in
Agent only. Raw SQL results and private model history are omitted from Agent session
responses and run snapshots, and query receipts have no raw-result preview; the selected
model still receives the rows and may use them in its answer or an explicit
`render_ui` display. See `docs/agent-capabilities.md`.

## Recovering Agent runs

Weak connections and page refreshes reattach to the original server task rather than
resend a model call or workflow. Stop explicitly cancels that task; closing the page
does not. The latest completed replay journal is retained for 15 minutes, until another
run replaces it or Shell-PAMC restarts. Agent keeps its authoritative transcript. Agent replay journals grow with output and
have no byte ceiling or execution deadline. An active Agent run therefore consumes memory until it finishes
or is stopped, and its completed journal remains subject to the retention window above.

Console-authenticated recovery endpoints under the configured API base are
`GET /agent/runs/active`, `GET /agent/runs/{id}` and `POST /agent/runs/{id}/cancel`
(the former `/playground/runs/` counterparts are removed; the Agent's model list is
`GET /agent/models`, formerly `/playground/models`). Generation POSTs carry `X-OMC-Run-ID`; clients
without that header keep direct-stream semantics. Recovery does not grant extra
capability permissions.

## Custom provider icons

Open the provider icon picker and choose **Custom** to upload a PNG/JPEG/WebP/SVG file
or paste Base64 (with or without an image Data URL prefix). Validate the preview, save a
name, then select the icon. Saved icons can be renamed or replaced; replacement updates
all assignments. Deletion is available even for an icon in use: confirmation shows its
reference count, and deleting it automatically restores affected providers to their
default icons or placeholders. The deployment stores up to 100 static icons, each at
most 512 KiB, with raster dimensions at most 1024 × 1024. Icons persist in SQLite and
are covered by the usual database backup; no separate uploads directory or external
image service is required. Plugin-owned providers retain their plugin branding. Uploads,
edits and deletion are disabled in the public demo.

The authenticated API adds `/custom-icons` (GET/POST), `/custom-icons/preview` (POST),
`/custom-icons/{id}` (PATCH/DELETE) and `/custom-icons/{id}/content` (GET/HEAD) below
the configured API base. Image content is not included in ordinary list or preference
responses.

## TPS calculation mode

Shell-PAMC Settings → Display chooses whether request-record TPS includes
first-token latency. The default excludes it when the remaining window is at least
50 ms; otherwise it falls back to total latency. Including it always uses total latency.
The server-stored `omc_tps_calculation_mode` preference (`exclude_ttft` /
`include_ttft`) also supports Agent/MCP reads and writes; historical timing and usage
remain unchanged.

## Shell-PAMC plugin registry

CPA reads its built-in `official` registry plus the registries in
`plugins.store-sources`; the console no longer has a plugin store page, so the registry
setting is what remains of it. Shell-PAMC's own registry
(`https://raw.githubusercontent.com/Bizasbot/Shell-PAMC/main/plugins/registry.json`)
is a managed entry: the server adds it when the source is on (the default) and restores
it after a configuration save that removed it, so the switch is **Shell-PAMC Settings →
Shell-PAMC plugin registry** (`omc_plugin_source_enabled`, ADR 0104), not the configuration editor
and not the source list on the plugin settings tab. Turning it off removes the
address on the next plugin-settings or configuration save.

## Plugin pages

A trusted installed page loads through `<base>/api/v1/plugin-host/` behind the console
session; CPA need not be reachable from the browser. It can use CPA-native v0/v8 management
routes and the fixed model directory, including configuration containing client and provider
secrets. Install only plugins you trust: the page is same-origin with the console and acts
with the signed-in operator's authority, while the plugin already runs inside CPA.

The host adapts same-origin native API and resource fetches to carry the Shell-PAMC session,
including pages that set `credentials: 'omit'`. This does not grant access without a
console session or change credentials on external requests. Plugin scripts that identify
their provider through direct `location.pathname` access receive the CPA-native resource
path, while the frame itself remains under the configured Shell-PAMC base path.

A plugin page may ask for a management key of its own. The host compares a page's explicit
Authorization or X-Management-Key with the stored CPA management key and answers a wrong one
`401` itself; the wrong key is never sent to CPA, so it cannot count toward CPA's
failed-attempt ban (five failures ban the client address for 30 minutes, and the console
and every hosted page share one address). Only the key stored for the instance is accepted
there. CPA has a single configured key, not a list, but may also honour `MANAGEMENT_PASSWORD`
and a loopback-only `--password`; when those differ from the stored key, enter the stored one. When both
headers are absent, management calls use the stored key; resources carry no key, and
`GET /v1/models` uses only the page's client Authorization. Shell-PAMC does not publish or store its management key in browser storage;
a third-party page may independently ask for and store a key the operator supplies.

API reads and writes are audited as `plugin.route_call` and responses are uncached.
Configuration-affecting native writes are serialized with console writes and require a
pre-write configuration backup; a backup failure blocks the mutation. All v8 writes and known core v0 writes are conservatively
classified for these gates; ordinary deep plugin actions such as credential synchronization
remain plugin-owned. Native config writes retain CPA's last-write semantics, so do
not concurrently edit the same configuration in a plugin and an unsaved console draft.
Cookies and Set-Cookie are excluded, redirects are not followed, and arbitrary outbound
`api-call` bridges are refused. These routes remain unavailable in demo and are not Agent/MCP
capabilities (ADR 0067).

## Demo mode

`SHELLPAMC_DEMO_MODE` (default `false`) serves the console from a built-in fixture instead
of a CPA, so it needs no management key and no provider credential. Its storage is not
durable — the database is deleted and rebuilt on every boot — and the server refuses
sign-in flows, credential movement, plugin execution and plugin pages, gateway configuration writes and
anything that would leave the process. It opens at the site root rather than `/shell-pamc`
unless `SHELLPAMC_BASE_PATH` says otherwise. A visitor's theme stays in their own browser:
a demonstration is shared, so it is neither sent to the server nor read from it.

```bash
pnpm build
SHELLPAMC_DEMO_MODE=true go run ./cmd/shell-pamc
```

This mode is what generates the public demonstration's dataset, so it stays in use even
though the public deployment does not run it; `SHELLPAMC_PUBLIC_URL` states that
deployment's origin. The public demo is the same console as static assets with its API
answered by a Cloudflare Worker from that generated dataset: `docs/ops/cloudflare-demo.md`
is its runbook, `docs/architecture.md` §13 and
[ADR 0021](adr/0021-the-public-demonstration-is-generated-data-behind-the-real-console.md)
record why.

## Available model directory

The authenticated `/model-square` route reads `GET /api/v1/management/model-square`
(relative to the deployment base path). The server uses the first nonempty configured
client key to read CPA's live `/v1/models`; no key returns `client_key_required` (409).
No client or upstream secret is returned. Configuration enriches only advertised IDs,
with partial conditions for unavailable model definitions or mappings. Refresh rereads
CPA; it does not make a paid model request.

Model specifications come from the bundled models.dev snapshot in
`internal/modelcatalog/snapshot.json`. Run `pnpm models:sync` when maintaining a release
to update it from models.dev's canonical model data and exact source aliases, then run
`pnpm demo:generate` because the snapshot changes the demonstration's response. There
is no runtime synchronization loop or new environment setting. The page displays the
snapshot date and unknown fields, and renders without browser catalog/CDN requests.
External reference links are user-initiated navigation. Pricing remains on its existing
OpenRouter source and is not synchronized by viewing Model Square. The page additionally
reads the existing `GET /api/v1/pricing` and `GET /api/v1/usage/facets?preset=24h` to show
each name's price and recent requests; if either fails, the directory still renders and
those cells stay blank.

## OAuth model rules

Open **Model rules** in OAuth management to edit CPA's provider-wide aliases or
model exclusions. Aliases are provider-scoped; exclusions are defaults for
OAuth/file-backed credentials without a non-empty own `excluded_models` list.
A non-empty credential list replaces, rather than extends, the provider's
`oauth.excluded-models`. A missing, empty or null credential list inherits the
current provider rules. Use the credential configuration tab to edit an override;
clearing it restores inheritance, not unrestricted availability.

Exact exclusions and `*` patterns match case-insensitively. Provider `*` excludes
all models only for inheriting credentials: with provider `["*"]` and credential
`["model-b"]`, the credential uses only `["model-b"]`, so `model-a` is not blocked
by provider `*`. Clearing that override makes the credential inherit `*` again.
Exclusions run before alias mapping; an alias cannot restore a source hidden by
the applicable rules. Deleting provider rules removes those defaults but leaves
non-empty credential overrides unchanged; it does not guarantee that models are
served again. CPA's per-credential model list is authoritative for availability.
Disable a credential explicitly when it must stop serving.

This precedence requires **CPA v8.0.33 or later**; upgrade an older gateway before
relying on credential overrides. Shell-PAMC's general v8.0.0 Management API baseline is
unchanged. The behavior follows CPA's credential override change.
The upstream regression
`TestCodexExcludedModelsCredentialPriorityAfterPatchAndReload`
checks immediate PATCH effects, reloads and restored inheritance after clearing.

The facade exposes GET/PATCH at `/api/v1/management/auth-files/model-aliases` and
`/api/v1/management/auth-files/excluded-models`. An exclusion PATCH carries
`provider` and `models`; an empty `models` array removes that provider's rules.
The provider model catalog is read at
`/api/v1/management/auth-files/provider-models?provider=codex`; plugin-owned
providers read the catalog CPA's plugin host publishes (CPA v8.0.34 or later). Without a catalog, the
editors still accept typed names. A successful write requires CPA readback;
changes are serialized with other whole-config writes, backed up and audit logged
(`oauth_model_alias.update` or `oauth_excluded_models.update`). Demo mode allows
reads but refuses durable changes.

## Kimi international quota

The `kimi-ai` connection method uses the international Kimi account system. Its
quota observation is a server-initiated `GET` to the compiled, single-endpoint
allowlist entry `https://api.kimi.ai/coding/v1/usages` (ADR 0064). Domestic Kimi
credentials continue to use `https://api.kimi.com/coding/v1/usages`. Selection
uses credential type, provider and file name; the console does not download the
token to detect an account system or retry the token against the other host.
Neither the browser nor Agent/MCP can supply an arbitrary upstream target.

The usage document is decoded in both shapes Kimi publishes. Counted limits
(`limits[]`, or a lone `usage` object) carry absolute usage, and the newer ratio
pools under `usages` state a share instead: each pool's period is read from its own
key, with the monthly Total pool the common case for a plan without a weekly limit.
A counted limit that already describes a period wins it, because it carries the
absolute usage a share cannot, and a pool states no counts of its own. A pool key
naming no known period keeps its own name as an unclassified window rather than
being filed under a period it does not describe (ADR 0071).

## Antigravity Gemini quota observations

After a successful Antigravity quota summary read, Shell-PAMC supplements missing Gemini
scope with a read-only POST to the single allowlisted daily-host endpoint
`https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`.
The request carries the credential's project ID and CPA's server-injected bearer
marker; Shell-PAMC does not download the OAuth token. A summary with a recognized Gemini
group already supplies that scope, so no additional model query is made.

Gemini entries with `quotaInfo` become model-scoped observations under their raw
upstream model IDs. Numeric `remainingFraction` values from 0 through 1 are
converted to percentages; zero is exhausted, missing/null is unknown, and invalid
fractions are omitted rather than clamped. Valid RFC3339 `resetTime` values retain
their exact instant; absent or invalid resets stay unknown. No five-hour or weekly
period is inferred. Equal model readings are not independent additive account
pools, and a tiered model ID is not evidence that a requested high alias shares
its quota. Auxiliary failures or empty/malformed responses leave valid primary
Claude/GPT windows intact. These observations do not implement model routing or
subscription cascade scheduling.

## Automatic quota refresh

Shell-PAMC Settings → Quota holds the deployment-wide automatic quota refresh policy (the
`omc_quota_auto_refresh` preference, ADR 0094). **Refresh after a quota resets** is on
by default: about a minute after a window a stored reading reported has reset, that
credential is read again once. **Scheduled quota refresh** reads every enabled credential whose reading is
older than the interval - six hours by default, adjustable from 5 minutes to 24 hours,
or off - including credentials nobody has read, so the first minutes after an upgrade
read every such credential. Each automatic read is a provider request made with the credential through CPA
(`api-call`, or the plugin's quota endpoint for a plugin credential), at most sixteen per
minute; a failed reset-driven read is retried every ten minutes for an hour. Meta credentials are only read on a manual
refresh, because that read exchanges a key upstream. Turning both off restores
operator-only reads. A demonstration never runs it.

Any read, manual or automatic, that shows room in every window releases a credential CPA
still holds in cooldown, because providers can reset a quota before the recovery time they
announced. While the policy is on, each round also releases an enabled credential whose
recorded recovery times have all passed, including Meta and providers without a quota
probe. Each release is logged as `CPA cooldown cleared after quota restored` or `expired
CPA cooldown cleared` with the `auth_index`, and appears in the audit log as
`quota.clear_cooldown.automatic`.

## Meta quota and live subscription tiers

A Meta Muse quota refresh requires a stored credential with a valid `dca_token`.
Shell-PAMC downloads that credential server-side and sends a fixed POST to
`https://api.meta.ai/muse-code/key`; runtime-only files and missing DCA tokens are
not replaced with an LLM API key. This endpoint can mint a key while reporting
quota. Shell-PAMC discards returned keys and account fields, does not update the stored
credential, and records an attempt audit before downloading or calling it.
Audit unavailability refuses the operation. Batch refresh trims and deduplicates
auth indexes before auditing or exchanging keys, preserving first-seen order
and refreshing at most ten distinct credentials. The reading includes the usage window,
weekly window, plan name and explicit active/inactive state when supplied. Missing
shares are unknown, not a zero-used or fully-available quota.

xAI reads both CLI billing documents on `cli-chat-proxy.grok.com`: the credits
document (`/v1/billing?format=credits`), which carries a subscription's own window
and the period that percentage belongs to, and the metered ledger (`/v1/billing`),
which carries the account's monthly limit and spend. A subscription account
publishes nothing in the ledger, so both are read and the period stays atomic: a
window and its reset come from one document, and the ledger's figures arrive beside
it as extra usage. Subscription names come from fixed
`/v1/user?include=subscription` and `/v1/settings` requests after a successful
billing read, and API-key health fallback does not initiate them. Antigravity tiers
come from the daily host's `loadCodeAssist` endpoint, with paid tier taking
precedence over current tier. If these supplemental reads fail, usage remains
readable: xAI keeps its billing fallback, while Antigravity shows an unknown tier
rather than assuming Pro. New endpoints are individually allowlisted and neither
console nor Agent/MCP accepts a caller-chosen URL (ADR 0065, ADR 0071).

A refresh that succeeds without publishing any window is recorded as an
`unpublished` reading rather than as a credential nobody has read, and the console
says so with its own status and copy. Every provider's window parser can produce
that reading, and it is what an unrecognized upstream document shape now surfaces
as (ADR 0071).

## Credential management actions

`POST /api/v1/management/auth-files/refresh` accepts `name` and `auth_index` for
one credential. The console's selected-credential action runs bounded individual
refreshes and reports each outcome; CPA still owns its scheduled token renewal.
The response contains status only, never CPA's refreshed token payload.

`POST /api/v1/management/auth-files/vertex-import` accepts the service-account JSON
as its request body and an optional `location` query (CPA defaults to
`us-central1`). A second import for the same project replaces its credential.
The console previews the project/account and accepts files up to 64 KiB; the
backend bounds the body with the existing 16 MiB auth-file upload limit. The
response contains file name, project, account address and location, not key bytes
or CPA's filesystem path. Closing the dialog invalidates an unfinished file read
and clears its selected key; key bytes are not cached as mutation arguments.

Both actions require the console session, are refused in demo mode, and must
record an attempt audit before calling CPA. If the success audit fails after CPA
has completed the action, the successful action remains successful; the audit
failure is logged without tokens or uploaded key material.

## Public demonstration conversations

The public demonstration's Agent offers one browser-local recorded example. Send/retry/cancel do not invoke a provider or write the Worker. Other questions are
refused. The server-side demo security classification is unchanged; ADR 0092 documents replay.

## Credential window warmup

Configure provider defaults from OAuth management's Warmup settings, or a complete
credential override from its Window warmup tab. Reset mode is Off, Weekly, or Weekly and five-hour.
Daily warmup defaults off with 06:00 as its editable time in the effective Shell-PAMC timezone.
Choose an available model; Claude's available Haiku models are listed first. Changing a
model never silently selects a replacement. Saving an enabled policy authorizes automatic
attempts once current billing and window checks permit them; a first manual activation
is not required. Warm up now remains an optional, separately confirmed consuming action.
Previously enabled policies begin participating on the next scheduler round after upgrade,
including credentials with no prior activation observation; defaults remain off.

Paid fallback must be affirmatively disabled by a fresh usage read. Claude uses
`extra_usage.is_enabled`; Codex uses the credits standing (published `has_credits`,
`unlimited` and balance). Missing evidence remains unknown. Shell-PAMC does not change upstream
billing settings or redeem a reset credit to make warmup eligible. A zero reading with
an active fixed boundary is not an idle window. Model-scoped Sonnet, Opus and Fable
limits can pause the selected family without blocking unrelated Haiku. Fable evidence
accepts the legacy `iguana_necktie` (unless it carries dollar amounts, which make it the
cloud session credit pool) or modern model-scoped `limits`; malformed modern
evidence, including a present non-array or null `limits` field, remains unknown rather
than falling back to an apparently available legacy limit.

The background loop checks once per minute, with bounded four-way rounds of 16, and
reuses stored quota observations targeted for refresh every five minutes. Daily starts
missed by more than one hour are not replayed. If starting now would overlap the next
daily time, reset-driven requests wait, including weekly triggers. Changing the Shell-PAMC
zone changes future calendar decisions, not stored instants.

The credential section always shows selected-model activation observations and paid-fallback
evidence. No activation observed is a neutral historical fact, while absent billing evidence
reads Unknown and pauses requests. Current reasons distinguish active windows, missing quota
and billing refusals. An unsupported response pauses automatic requests for the selected
model until a confirmed recheck succeeds or an available replacement model is explicitly
selected. Rechecks still obey unresolved-outcome suppression. Manual actions report an outcome
through a toast; sent requests also update the durable last result in the Window warmup tab.
Warm up now opens its confirmation on both HTTP and HTTPS deployments. Switching tabs or
saving credential fields keeps a separate warmup draft open.

A consuming request is recorded before it is sent. If pre-send revalidation refuses the
request, its provisional cycle and daily identities are restored. A temporary startup
recovery failure is logged and retried on later minute checks, not left stopped until restart. Activated, pending, skipped, failed,
executing and uncertain outcomes are distinct. After a pending completion only quota
reads are repeated; transport timeouts and restart-abandoned requests are uncertain
and are not automatically resent. Definite rate-limit refusals get at most three
retries after one, five and fifteen minutes, each preceded by fresh eligibility checks.
Policy and execution records are included in normal SQLite backups. The latest 100
receipts per credential are kept alongside the durable cycle and daily suppression.

API routes under the configured API prefix:

- `GET/PUT /management/quota/warmup/settings`: provider policy and revision.
- `GET/PUT /management/quota/warmup/credentials/{authIndex}`: effective policy and state.
- `POST /management/quota/warmup/credentials/{authIndex}/run`: confirmed, revision-bound
  manual request with caller-stable `request_id`. Reuse that id only to recover its
  original receipt; never retry an uncertain result with a new id.

These are authenticated, typed projections, not a generic request proxy. Writes require
confirmation and the current revision; no URL, prompt, request body or secret can be
supplied. The public demonstration refuses consuming and policy-write routes.

Warmup round ordering is oldest observation first. Fleets exceeding a round's capacity
remain queued rather than increasing concurrency or skipping protection.
