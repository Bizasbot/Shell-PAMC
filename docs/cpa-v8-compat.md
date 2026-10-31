# Compatibilidad con CPA v8

Shell-PAMC requiere CLIProxyAPI (CPA) v8.0.0 o posterior y utiliza su API de administración
v8 (ADR 0034, que reemplaza la decisión de compilación única para v7 y v8 de ADR 0028). Este
documento registra qué cambió en v8, qué se midió contra binarios reales, cómo determina Shell-PAMC
que una pasarela es v8, cómo edita la configuración (ADR 0037), a qué rutas llama
y qué permanece sin verificar. Las mediciones contra v7.3.20 a continuación se conservan como registro de cómo
trata v8 un archivo de configuración de v7, que es el punto de partida de un despliegue actualizado.

## Política OpenAPI por modelo en Vertex

El contrato fuente de CPA en `d44f8682bc1438ac0f06159207435bd997bca4c9`
agrega booleanos opcionales `openapi` a las entradas de modelo de claves API de Vertex y a los
alias/ajustes de OAuth, y `openapi` / `openapi-location` a las entradas de claves API de Vertex.
Shell-PAMC edita los valores predeterminados de claves API y filas de modelos en Proveedores de IA, los alias
de OAuth para todo el proveedor en Reglas de Modelos, y los alias de credenciales en el detalle de la credencial. La fachada
mantiene diferenciados no definido, false explícito y true; las anulaciones de modelo/alias tienen prioridad sobre
los valores predeterminados de la credencial, que a su vez tienen prioridad sobre la detección automática de nombres de modelos de CPA. Dos
alias de un mismo modelo upstream pueden tener diferentes anulaciones. Limpiar una anulación
restaura la herencia. Renombrar uno de varios alias del mismo modelo preserva su
política después de que las rutas hermanas sin cambios coincidan; los cambios de nombre simultáneos ambiguos
se rechazan antes de escribir. Solo CPA selecciona endpoints y ejecuta solicitudes.

El DTO de comportamiento del proveedor usa `openapi: inherit|enabled|disabled` y un `openapi_location`
opcional (vacío limpia); las opciones de modelo y los DTOs de alias usan un booleano opcional
`openapi` (omitido/null hereda). Las opciones de modelo del proveedor declaran la entrada completa del
modelo; otros campos y grupos conservan su contrato de preservación existente.
Las escrituras reutilizan barreras de revisión, respaldos cifrados y lectura acotada de la política almacenada.
Los reemplazos de alias de OAuth y los parches de campos de credenciales también comparan la anulación
al releer. Se rechazan las anulaciones que no sean de Vertex. Los controles existentes de cuentas de servicio
siguen siendo independientes. Agente/MCP usa las operaciones confirmadas existentes de proveedor/alias/credencial
con estos ajustes acotados, nunca metadatos sin procesar ni llamadas de inferencia.
Este contrato se verifica contra el código fuente y fixtures herméticos, no con una cuenta de Vertex en vivo.

## Estado local y uso de SIWC

El contrato fuente de CPA en `06fd5b8bc2807af5fceb6f39d2c5808c52e76034`
añade `siwc_status: off|valid|invalid` a los resúmenes de credenciales. Shell-PAMC lee esta
enumeración permitida desde la lista de credenciales y las lecturas de credenciales existentes de Agente/MCP.
Los valores faltantes o desconocidos siguen siendo desconocidos; ni la expiración almacenada ni el material vinculado
implican validez. CPA evalúa la expiración y el rechazo recordado localmente sin
actualización, inferencia ni verificación en upstream. Esto no representa la salud del proveedor.

El selector `use_siwc` exclusivo de Codex utiliza el endpoint existente de parche de campos de credencial,
con un selector único, auditoría de intento fail-closed y relectura de disco/tiempo de ejecución. False
modifica solo ese selector y preserva ambas particiones de credenciales. True utiliza una
partición SIWC ya vinculada; habilitarlo sin material vinculado se rechaza, mientras que
deshabilitarlo permanece disponible. No vincula ni establece validez. Agente/MCP
usa `oauth_set_credential_fields` confirmado, mientras que la autorización sigue dirigida por el operador.
Las pasarelas más antiguas sin metadatos de estado muestran desconocido y ningún control de selector habilitado.
La consulta de estado de credenciales de CPA (`GET /v8/management/oauth/siwc/status?name=...`
o `auth_index`) es distinta del sondeo de sesión de vinculación de Shell-PAMC en
`/management/oauth/siwc/status?state=...`; Shell-PAMC no llama a la consulta dedicada
porque su lectura de la lista de credenciales ya suministra el resumen local.

## Huella de observación de Antigravity

La línea base del código fuente revisado de CPA `02e9e85204052dfed9bf73b7075c7b414111a4b3`
utiliza Hub 2.24.0 y su changelist verificado 1000335682. El User-Agent fijo de cuota y
suscripción de Shell-PAMC es
`antigravity/hub/2.24.0 (aidev_client; os_type=darwin; arch=arm64; cl=1000335682)`.
Actualice la versión y el changelist verificado juntos. El POST diario de suscripción
`loadCodeAssist` omite `Accept`; las lecturas del resumen de cuota retienen `Accept: application/json`.
Un fallo en la suscripción complementaria mantiene ventanas de cuota independientes y un plan desconocido.
No hay búsqueda dinámica de versiones de proveedor ni nueva autoridad de salida.

## Vinculación de SIWC delimitada por credencial

CPA v8.0.35 añade `POST /v8/management/oauth/siwc/bind` y los resúmenes de credenciales
de Codex `siwc_bind_supported`, `use_siwc`, `siwc_bound` y el RFC3339 opcional
`siwc_expires_at`. Shell-PAMC proyecta estos resúmenes a través de su lista de
credenciales y la lectura existente de credenciales de Agente/MCP. La falta de metadatos de soporte
deshabilita la vinculación. La presencia de material almacenado y la expiración no son verificaciones
de validez en vivo.

El detalle de la credencial ofrece Vincular SIWC y un Revincular SIWC confirmado explícitamente.
El servidor resuelve una identidad de credencial única y envía solo el ID/nombre administrado
por CPA al endpoint de vinculación fijo. Esto es exclusivo para archivos locales independientes;
el modo Home, backends que no sean archivos y pasarelas más antiguas no están disponibles. No hay
recurso al inicio de sesión ordinario de Codex. Solo CPA preserva la credencial existente,
intercambia tokens, guarda la partición SIWC y la publica en su administrador de autenticación.

Las sesiones de vinculación son locales al proceso y delimitadas al objetivo. El navegador pega la
URL completa `http://127.0.0.1:1455/auth/callback`, incluido el `client_id` emitido,
incluso cuando esa página no puede cargar: este flujo no inicia ningún listener en loopback.
Shell-PAMC reenvía la URL sin cambios después de verificar su estado y el origen/ruta de redirección.
Los valores de callback nunca se almacenan en preferencias ni en registros de auditoría.
Las auditorías de intentos son fail-closed para inicio, callback y cancelación. La aceptación
del callback permanece pendiente; solo el estado completado seguido de una lectura segura de la credencial
constituye un éxito. Un fallo de relectura tras la finalización permanece en verificación
sin ofrecer una segunda mutación. La cancelación preserva `cancelled:false`.
Los intentos no completados expiran después de cinco minutos. Shell-PAMC retiene registros locales durante
diez minutos para conciliación terminal, sin retener valores de callback.

Fuente: contrato de administración de CPA v8.0.35.

## Precedencia de exclusión de modelos de OAuth

CPA v8.0.33 es la primera versión que contiene
el cambio de prioridad en la exclusión de credenciales.
Una lista no vacía de `excluded_models` en la credencial reemplaza
`oauth.excluded-models` del proveedor; si falta, está vacía o es null, hereda las reglas actuales del proveedor.
El ayudante de v8.0.33 almacena solo reglas de credenciales, y el tiempo de ejecución resuelve el
respaldo del proveedor. Compilaciones anteriores compatibles con v8 pueden combinar las listas;
actualícelas antes de depender de anulaciones de credenciales. Este es un límite de comportamiento
específico de la característica, no un cambio en la línea base de la API de administración v8.0.0 de Shell-PAMC.
La guía de la consola y de Agente/MCP establece el requisito, y la lista de modelos por credencial de CPA
sigue siendo autoritativa. Consulte [Reglas de modelos de OAuth](operations.md#oauth-model-rules).

## Compatibilidad de rutas de comportamiento de Codex

CPA trasladó el comportamiento compartido de proveedores de Codex, Claude y xAI fuera de
`oauth.providers.*` hacia `upstream.*` (la tabla `v8SharedPaths` en internal/config/config_v8.go de CPA), y la optimización multi-agente a `client.codex.optimize-multi-agent-v2`. El conjunto canónico que sigue el editor es:
`upstream.codex` redirección de respuestas, desactivación de camuflaje de Codex, enfriamiento a nivel de modelo,
buffering/timeout de arranque de flujo y compatibilidad de delegación huérfana;
`upstream.claude` enfriamiento a nivel de modelo, desactivación del modo de camuflaje de Claude,
desactivación de lista de modelos de camuflaje y todo el subárbol de encabezados predeterminados;
`upstream.xai` inyección de búsqueda x; más `client.codex.optimize-multi-agent-v2`.

Los ajustes de live-media-relay y header-defaults de Codex, Antigravity, aistudio y Devin
permanecen bajo `oauth.providers.*`: son exclusivos de OAuth y no fueron
reubicados. Las escrituras de configuración raíz aceptan las escrituras históricas
de `oauth.providers.*` y normalizan los valores enviados antes de fusionarlos en el
documento canónico. Los valores canónicos prevalecen por presencia cuando se envían
ambas variantes, incluyendo `false` y `null` explícitos.

El editor visual lee y edita un campo canónico cuando ese campo está presente.
De lo contrario, utiliza su ruta v8 histórica, también cuando ambas variantes están ausentes:
las versiones tempranas de CPA v8 rechazan las secciones raíz más nuevas, mientras que el alias
histórico es aceptado por ambos diseños. La relectura, no la ruta enviada, determina la
siguiente línea base. Si la edición en fuente reubica un campo entre las rutas admitidas
antes de guardar, las ediciones visuales usan su ubicación de borrador, y revertir un valor
visual preserva la reubicación independiente de la fuente. Las ediciones realizadas durante un guardado siguen al campo si CPA lo reubica
en esa relectura. No se requiere adivinación de cadena de versión de pasarela ni migración de todo el documento.
`ConfigFieldDefinition.legacyYamlPath` declara esta compatibilidad para
cada control reubicado: la ruta canónica `upstream.*` / `client.codex.*` con
la variante histórica `oauth.providers.*` como respaldo.

Esto fue verificado con el binario oficial sin plugins Linux ARM64 de CPA v8.0.16:
un PATCH raíz histórico devolvió `200`, ambos valores canónicos permanecieron habilitados
tras reiniciar CPA, y las escrituras canónicas posteriores deshabilitaron ambos ajustes.
Las rutas históricas estuvieron ausentes de la relectura raíz. El lector de interfaz fijado
y el escritor de conjuntos de cambios también se probaron contra binarios oficiales sin plugins
Linux ARM64 verificados por suma de comprobación tanto para v8.0.2 como para v8.0.16: los ajustes
habilitados se leyeron, deshabilitaron y habilitaron mediante PATCH raíz, se releyeron y se
verificaron nuevamente tras cada reinicio. Las configuraciones aisladas usaron
`oauth.auth-dir`, directorios temporales de credenciales y puertos de loopback independientes.
Referencias de código fuente:

- Rutas de configuración de v8.0.16
- Normalización de alias de administración de v8.0.16

Las siguientes mediciones y tablas de mapeo conservan su línea base de CPA v8.0.2;
las rutas canónicas `upstream.*` / `client.codex.*` anteriores reemplazan las
ubicaciones correspondientes del editor en esa tabla.

## Semántica de las opciones de configuración

El editor visual usa los valores predeterminados en tiempo de ejecución de CPA para campos YAML omitidos, no los
valores mostrados en su configuración de ejemplo. En CPA v8.0.16, omitir
`routing.retry.request-retry` y `routing.retry.max-retry-interval` significa
`0` en ambos; el ejemplo establece explícitamente `3` y `30`. Las rondas de reintento cuentan rondas adicionales
tras la primera ronda de intento de credencial. El intervalo limita la espera de enfriamiento
entre rondas, y `max-retry-credentials` limita las credenciales distintas por
ronda, incluido el primer intento (`0` deja ese límite sin restricción). Revertir una
edición visual a una línea base omitida elimina la ruta agregada y preserva el
documento original.

`requests.passthrough-headers` reenvía los encabezados filtrados de **respuesta de upstream** al
cliente. No reenvía encabezados de solicitud del cliente. `force-model-prefix`
restringe solicitudes sin prefijo a credenciales sin prefijo, excepto cuando el prefijo
de una credencial coincide con el nombre del modelo solicitado. El timeout predeterminado de encabezados de Claude suministra
`X-Stainless-Timeout`, no un timeout local de cliente HTTP. Con el almacenamiento en caché de firmas
deshabilitado, habilitar `signature-bypass-strict` selecciona una validación de firmas de Claude más estricta.
Deshabilitar las actualizaciones automáticas del panel detiene las comprobaciones periódicas; un panel ausente
se descarga de todos modos en el primer acceso.

Fuentes en el tag `v8.0.16`:

- Valores predeterminados de configuración en tiempo de ejecución
- Rondas de reintento y selección de credenciales
- Registro de prefijos de modelo
- Filtrado de encabezados de respuesta
- Encabezados de ejecutor de Claude
- Validación de firmas de Claude
- Actualizaciones del panel de administración

Fuentes de upstream, todas en el tag `v8.0.2` (commit `4a2c818`):

- management-api-v8.md — la API de administración v8.
- config.example.yaml — la plantilla v8; su sección de cierre
  "Legacy compatibility reference" enumera únicamente las reubicaciones más comunes.
- config_v8.go — la tabla completa de reubicaciones
  (`buildV8Paths`, `v8KeyFamilies`) y el código de precedencia y migración. **Este archivo,
  no la plantilla, es autoritativo**: la referencia de la plantilla omite la mayoría de las entradas.
- server_management_v8.go — las rutas v8
  y el controlador en el que está registrada cada una.

`v7.3.20 → v8.0.2` son siete commits, todos en estructura de configuración y en la API
de administración. Los protocolos de proxy de cara al cliente (`/v1`, `/v1/responses`, websocket) permanecen sin cambios.

## 1. Qué cambió en v8

**Diseño de configuración.** La mayoría de los ajustes se trasladaron bajo nueve secciones v8 (`server`,
`management`, `access`, `credentials`, `routing`, `requests`, `oauth`, `multimedia`,
`observability`); `config-version: 8` marca un archivo migrado. La clave raíz `api-keys`
cambió de significado: en v7 es la lista de claves de cliente, en v8 es un mapa de grupos
de proveedores upstream (`api-keys.codex`, …), y las claves de cliente se movieron a `access.api-keys`. CPA
las distingue por su forma (lista frente a mapa).

**API de administración.** Un nuevo árbol `/v8/management`: lecturas y escrituras
de configuración direccionadas por ruta (`/config/<sección>/<campo>`), rutas operativas agrupadas
y una entrada unificada de OAuth. `/v0/management` se conserva por completo, incluidos los configuradores planos (`/debug`,
`/request-retry`, …) y las listas de credenciales por familia (`/codex-api-key`, …), que
existen únicamente bajo v0.

### Semántica de migración y precedencia (medida)

Medido en `eceasy/cli-proxy-api:v8.0.2` con un archivo heredado derivado del `config.example.yaml`
de v7.3.20 (claves de cliente, una entrada `codex-api-key`, una sección desconocida añadida).

| Regla | Resultado |
| --- | --- |
| Iniciar v8 sobre un archivo heredado no modifica el archivo | Aprobado: idéntico byte a byte tras el inicio |
| Solicitudes GET de v8 no modifican el archivo | Aprobado: idéntico byte a byte tras `GET /v8/management/config`, `/config/config-version`, `/config/access/api-keys` y GETs operativos |
| Una escritura v8 exitosa (`PUT /v8/management/config/observability/logs/debug`) migra y reescribe todo el archivo | Aprobado: 1025 → 377 líneas, `config-version: 8` agregado, cada ajuste reubicado trasladado, sangría cambiada a cuatro espacios, comentarios de claves trasladadas conservados |
| Las claves heredadas se eliminan en la migración | Aprobado: ninguna clave heredada reubicada permanece en la raíz |
| Las secciones desconocidas se conservan como comentarios | Aprobado: `omc-operator-notes` se convirtió en un bloque comentado al final del archivo |
| Cuando existen ambas escrituras, prevalece la v8 y se descarta la heredada | Aprobado: ver §4 — los valores heredados se descartaron y estuvieron ausentes del archivo tras guardar |
| `PUT /v0/management/config.yaml` acepta cualquier formato | Aprobado, **y responde `200` descartando cada clave heredada superpuesta** |
| Los configuradores planos v0 en un archivo migrado escriben en la ubicación v8 | Aprobado para `debug`, `proxy-url`, `request-retry`, `max-retry-interval`, `max-retry-credentials`, `routing/strategy`, `force-model-prefix`, `ws-auth`, `logging-to-file`, `usage-statistics-enabled`, `logs-max-total-size-mb`, `error-logs-max-files` |
| …cuando la ubicación v8 no está presente en el archivo | El configurador escribe la clave **heredada** en la raíz y surte efecto (`request-log` tras la migración, que el archivo migrado no contenía) |
| `PUT /v0/management/api-keys` en un archivo migrado | Aprobado: escrito en `access.api-keys`; los grupos de proveedores no se tocan |
| `PUT /v0/management/codex-api-key` en un archivo migrado | Aprobado: escrito como grupos `api-keys.codex` (`codex-1`, `codex-2`); sin `codex-api-key` en raíz |
| Una pasarela v7 responde a `/v8/*` | 404 para cada ruta, incluyendo `/v8/management/config/config-version` |

Dos afirmaciones más precisas que el resumen habitual:

- Las escrituras heredadas se eliminan al cargar o guardar **solo cuando su gemela v8 está presente**.
  Un ajuste solo heredado sigue funcionando en su lugar antiguo hasta que una escritura de configuración v8
  migre el archivo. La precedencia es por hoja: un `tls.cert` heredado junto a un `server.tls.enable`
  v8 se respeta, mientras que un mapa `oauth-model-alias` heredado pierde por completo
  frente a cualquier mapa `oauth.model-alias` v8, sin importar qué proveedores nombre cada uno.
- `GET /v8/management/config.yaml` devuelve la *vista migrada* del archivo, no el archivo real;
  `GET /v0/management/config.yaml` devuelve el archivo tal como está almacenado. Shell-PAMC edita la primera y
  lee el segundo solo para conservar un archivo heredado antes de su primera escritura v8 (§4).

### Escrituras de configuración v8 (medidas)

Medido en el binario v8.0.2 con contraseña de administración configurada.

| Solicitud | Resultado |
| --- | --- |
| `PATCH /v8/management/config` con documento de combinación JSON | Combinado; las claves que no nombra se conservan |
| `PUT /v8/management/config/<ruta>` | Reemplaza esa ruta; el cuerpo es el valor JSON sin procesar (un envoltorio `{"value": …}` es rechazado) |
| `DELETE /v8/management/config/<ruta>` | Elimina esa ruta; una ruta no definida responde `404 not_found` |
| Un `null` en una combinación | Escribe el valor cero del tipo, no una eliminación |
| Un nombre de campo heredado (`debug`, en combinación o en `PUT /config.yaml`) | `400 invalid_config`, "legacy field debug is not accepted by v8; use observability.logs.debug"; nada escrito |
| Una sección desconocida | `400 invalid_config`, "unknown v8 configuration section …"; nada escrito |
| Un valor de tipo incorrecto | `422 invalid_config` indicando la línea y el tipo; nada escrito |
| Una ráfaga de escrituras secuenciales | Todos los valores conservados |
| `PATCH` con `{"api-keys": {"claude": [...]}}` | Reemplaza los grupos de esa familia; se conservan las demás familias |
| Una clave que anula un ajuste de grupo (`models: []`, `priority: 0`, `excluded-models`, `disable-cooling: false`) | Aceptada; la lista de ejecución v0 muestra el valor propio de la clave |
| `base-url` en una clave | Rechazado: solo un grupo puede portarlo |
| `GET /config/api-keys/<familia>/0/keys` | `404 not_found`: los elementos de lista no son rutas direccionables, por lo que una familia se escribe completa |
| `PUT /config/plugins/configs/<id>`, `PUT /config/plugins/configs/<id>/enabled` | Reemplaza los ajustes de ese plugin, o solo su interruptor |
| `PATCH` de `oauth.model-alias.<proveedor>`, `DELETE /config/oauth/model-alias/<proveedor>` | Reemplaza o elimina los alias de un proveedor |

Observado pero no parte del cambio de v8: varias escrituras v0 enviadas consecutivamente sin una
pausa pueden perder todas excepto la última (cada escritura recarga la configuración asincrónicamente).
Se observó en v8.0.2 durante una ráfaga con script; no se probó en v7. Las escrituras propias de Shell-PAMC
son serializadas por su barrera de escritura de proveedores y se ejecutan una acción de operador a la vez.

## 2. Revisión de la lista de reubicaciones

El mapeo se comprobó contra `config_v8.go` en lugar de la plantilla. Cada
entrada que se marcaba como conocida es correcta excepto una; cada entrada de baja confianza
queda resuelta a continuación.

| Entrada | Real | Nota |
| --- | --- | --- |
| `host`/`port` → `server.*` | Correcto | |
| `remote-management.*` → `management.*` | Correcto | |
| `api-keys` → `access.api-keys` | Correcto | Solo mientras el valor raíz sea una lista; un mapeo raíz son grupos de proveedores v8 |
| `codex-api-key` → `api-keys.codex` | Correcto, con cambio de estructura | Un grupo por entrada heredada (`name: codex-N`, `base-url` a nivel de grupo y campos compartidos, material de clave en `keys:`); lo mismo ocurre con `gemini`, `interactions`, `vertex`, `claude`, `xai`, `meta` y `openai-compatibility` (cuyos `api-key-entries` se convierten en `keys`) |
| `request-retry` → `routing.retry.request-retry` | Correcto | `max-retry-credentials`, `max-retry-interval` se mueven a su lado |
| `debug` → `observability.logs.debug` | Correcto | |
| `proxy-url` → `requests.proxy-url` | Correcto | |
| `auth-dir` → `oauth.auth-dir` | Correcto | |
| `codex.*` → `oauth.providers.codex.*` | Correcto | |
| `antigravity-credits` → `oauth.providers.antigravity.antigravity-credits` | **Ruta de origen incorrecta** | La clave heredada es `quota-exceeded.antigravity-credits`, no una clave raíz |
| `auth-auto-refresh-workers` (baja confianza) | `oauth.auth-auto-refresh-workers` | Confirmado |
| `payload.*` (baja confianza) | `requests.payload.*` | Bajo `requests`, no un `payload` raíz |
| `passthrough-headers` (baja confianza) | `requests.passthrough-headers` | Confirmado |
| `streaming.*` (baja confianza) | `requests.streaming.*` | Confirmado |
| `commercial-mode` (baja confianza) | `server.commercial-mode` | Confirmado |
| `disable-cooling` (baja confianza) | `routing.cooldown.disable-cooling` | Confirmado |
| `quota-exceeded.switch-project`, `switch-preview-model` | No reubicados | Permanecen bajo `quota-exceeded` en ambos formatos. CPA los omite de su plantilla v8 solo por compatibilidad: un `PATCH` v8 todavía los escribe, pero a partir de v8.0.31 nada en la ruta de solicitud de CPA los lee, por lo que la página de ajustes ya no los ofrece (el editor de código fuente los conserva) |

Las reubicaciones que no se listaban incluyen `nonstream-keepalive-interval` →
`requests.nonstream-keepalive-interval`, `ws-auth` → `oauth.providers.aistudio.ws-auth`,
`force-model-prefix` → `routing.force-model-prefix`, los demás ajustes de `observability.logs.*` y
`observability.usage.*`, `tls` → `server.tls`, ambas secciones de valores predeterminados de encabezados,
las claves planas `antigravity-signature-*`, `multimedia.*`, y `oauth.model-alias` /
`oauth.excluded-models` / `oauth.request-scoped-errors`. `routing.strategy`,
`routing.session-affinity*` y `plugins.*` conservan sus rutas. La lista completa está en §3.

Comprobar el editor de Shell-PAMC contra la tabla real también expuso dos rutas de editor que eran
incorrectas también para v7, ahora corregidas: los interruptores de firma de Antigravity escribían
`antigravity.signature-cache-enabled` / `antigravity.signature-bypass-strict`, que CPA
nunca lee (las claves reales son las planas `antigravity-signature-cache-enabled` /
`antigravity-signature-bypass-strict`), y el keepalive sin streaming escribía una cadena
de duración bajo `streaming`, mientras que CPA lee un número entero de segundos en la raíz.

## 3. Mapeo completo heredado ↔ v8

Esta es la tabla propia de CPA (`config_v8.go` en v8.0.2), que aplica cuando convierte un
archivo heredado. Shell-PAMC no conserva una copia: su esquema de editor (`web/src/types/configSchema.ts`)
indica la columna v8. La última columna indica el campo del editor; un `—` significa que ningún campo
del editor modifica ese ajuste.

Cada ruta del esquema se midió contra el binario v8.0.2 (compilación en Go del tag `v8.0.2`,
commit `4a2c818`, el 2026-09-29): cada una se escribió con un `PATCH
/v8/management/config` portando el valor predeterminado del propio campo, y luego se leyó de nuevo del
`config.yaml` persistido. Las 36 rutas agregadas por los campos de proveedor OAuth, descubrimiento y pprof
fueron aceptadas con `200` y sobrevivieron en el archivo. La supervivencia es la parte fundamental
de esa verificación, ya que CPA vuelve a serializar el documento desde su configuración analizada:
una clave que no reconoce se descarta en el camino al disco. Medido en el mismo binario, un
hermano mal escrito descarta toda la solicitud — `oauth.providers.codex.live-media-relay.enabledd`
se rechaza con `400 invalid_config` ("field oauth not found in type config.legacyConfig"),
al igual que una hoja mal escrita bajo una sección que CPA sí reconoce — por lo que la comprobación puede fallar.

Tres rangos de valores en el esquema se midieron de la misma forma en lugar de asumirse:
`redis-usage-queue-retention-seconds` se limita a 3600 del lado del servidor (9999 se almacena como
3600, por lo que el editor lo limita), `transient-error-cooldown-seconds` acepta `-1` (por lo que el
mínimo es `-1`, no `0`), y `request-retry` no tiene límite superior en CPA (50 se almacena
sin cambios, por lo que el editor no establece un máximo).

### Ajustes (hojas)

Una hoja es la unidad de la regla de precedencia de CPA. "Campo de editor de Shell-PAMC" indica el campo
de la página de configuración que lo edita.

| Sección v8 | Ruta heredada | Ruta v8 | Campo de editor de Shell-PAMC |
| --- | --- | --- | --- |
| `server` | `commercial-mode` | `server.commercial-mode` | `commercialMode` |
| `server` | `discovery.advertise-management` | `server.discovery.advertise-management` | `discoveryAdvertiseManagement` |
| `server` | `discovery.auth-required` | `server.discovery.auth-required` | `discoveryAuthRequired` |
| `server` | `discovery.enabled` | `server.discovery.enabled` | `discoveryEnabled` |
| `server` | `discovery.interfaces.exclude` | `server.discovery.interfaces.exclude` | — |
| `server` | `discovery.interfaces.include` | `server.discovery.interfaces.include` | — |
| `server` | `discovery.service-name` | `server.discovery.service-name` | `discoveryServiceName` |
| `server` | `discovery.service-type` | `server.discovery.service-type` | — |
| `server` | `discovery.subtypes` | `server.discovery.subtypes` | — |
| `server` | `github-token` | `server.github-token` | `githubToken` |
| `server` | `host` | `server.host` | `host` |
| `server` | `port` | `server.port` | `port` |
| `server` | `tls.cert` | `server.tls.cert` | `tlsCert` |
| `server` | `tls.enable` | `server.tls.enable` | `tlsEnable` |
| `server` | `tls.key` | `server.tls.key` | `tlsKey` |
| `server` | `trusted-proxies` | `server.trusted-proxies` | `trustedProxies` |
| `client` | — | `client.codex.enable-apply-patch` | `codexEnableApplyPatch` |
| `client` | — | `client.codex.web-search-result-cache.enabled` | `codexWebSearchCacheEnabled` |
| `client` | — | `client.codex.web-search-result-cache.limit` | `codexWebSearchCacheLimit` |
| `client` | — | `client.codex.web-search-result-cache.ttl` | `codexWebSearchCacheTtl` |
| `management` | `remote-management.allow-remote` | `management.allow-remote` | `rmAllowRemote` |
| `management` | `remote-management.base-url` | `management.base-url` | `rmBaseUrl` |
| `management` | `remote-management.disable-auto-update-panel` | `management.disable-auto-update-panel` | `rmDisableAutoUpdatePanel` |
| `management` | `remote-management.disable-control-panel` | `management.disable-control-panel` | `rmDisableControlPanel` |
| `management` | `remote-management.panel-github-repository` | `management.panel-github-repository` | `rmPanelRepo` |
| `management` | `remote-management.secret-key` | `management.secret-key` | `rmSecretKey` |
| `access` | `api-keys` | `access.api-keys` | `apiKeys` |
| `credentials` | `credential-concurrency.busy-retry-max` | `credentials.concurrency.busy-retry-max` | — |
| `credentials` | `credential-concurrency.busy-retry-min` | `credentials.concurrency.busy-retry-min` | — |
| `credentials` | `credential-concurrency.cleanup-interval` | `credentials.concurrency.cleanup-interval` | — |
| `credentials` | `credential-concurrency.cpa-cancel-bound` | `credentials.concurrency.cpa-cancel-bound` | — |
| `credentials` | `credential-concurrency.cpa-heartbeat-timeout` | `credentials.concurrency.cpa-heartbeat-timeout` | — |
| `credentials` | `credential-concurrency.lifecycle-config-revision` | `credentials.concurrency.lifecycle-config-revision` | — |
| `credentials` | `credential-concurrency.max-limit` | `credentials.concurrency.max-limit` | — |
| `credentials` | `credential-concurrency.observation-barrier-revision` | `credentials.concurrency.observation-barrier-revision` | — |
| `credentials` | `credential-concurrency.reclaim-grace` | `credentials.concurrency.reclaim-grace` | — |
| `credentials` | `credential-concurrency.release-flush-interval` | `credentials.concurrency.release-flush-interval` | — |
| `credentials` | `credential-concurrency.release-max-backoff` | `credentials.concurrency.release-max-backoff` | — |
| `credentials` | `credential-in-flight.max-aggregate-groups` | `credentials.in-flight.max-aggregate-groups` | — |
| `credentials` | `credential-in-flight.max-details` | `credentials.in-flight.max-details` | — |
| `credentials` | `credential-in-flight.max-part-bytes` | `credentials.in-flight.max-part-bytes` | — |
| `credentials` | `credential-in-flight.max-part-count` | `credentials.in-flight.max-part-count` | — |
| `credentials` | `credential-in-flight.max-revision-bytes` | `credentials.in-flight.max-revision-bytes` | — |
| `credentials` | `credential-in-flight.max-string-bytes` | `credentials.in-flight.max-string-bytes` | — |
| `credentials` | `credential-in-flight.snapshot-interval` | `credentials.in-flight.snapshot-interval` | — |
| `credentials` | `credential-in-flight.staging-retention` | `credentials.in-flight.staging-retention` | — |
| `credentials` | `credential-in-flight.stale-after` | `credentials.in-flight.stale-after` | — |
| `routing` | `disable-cooling` | `routing.cooldown.disable-cooling` | `disableCooling` |
| `routing` | `save-cooldown-status` | `routing.cooldown.save-cooldown-status` | `saveCooldownStatus` |
| `routing` | `transient-error-cooldown-seconds` | `routing.cooldown.transient-error-cooldown-seconds` | `transientErrorCooldownSeconds` |
| `routing` | `force-model-prefix` | `routing.force-model-prefix` | `forceModelPrefix` |
| `routing` | `max-retry-credentials` | `routing.retry.max-retry-credentials` | `maxRetryCredentials` |
| `routing` | `max-retry-interval` | `routing.retry.max-retry-interval` | `maxRetryInterval` |
| `routing` | `request-retry` | `routing.retry.request-retry` | `requestRetry` |
| `requests` | `nonstream-keepalive-interval` | `requests.nonstream-keepalive-interval` | `streamingNonstreamKeepalive` |
| `requests` | `passthrough-headers` | `requests.passthrough-headers` | `passthroughHeaders` |
| `requests` | `payload.default` | `requests.payload.default` | `payloadDefaultRules` |
| `requests` | `payload.default-raw` | `requests.payload.default-raw` | `payloadDefaultRawRules` |
| `requests` | `payload.filter` | `requests.payload.filter` | `payloadFilterRules` |
| `requests` | `payload.override` | `requests.payload.override` | `payloadOverrideRules` |
| `requests` | `payload.override-raw` | `requests.payload.override-raw` | `payloadOverrideRawRules` |
| `requests` | `proxy-url` | `requests.proxy-url` | `proxyUrl` |
| `requests` | `streaming.bootstrap-retries` | `requests.streaming.bootstrap-retries` | `streamingBootstrapRetries` |
| `requests` | `streaming.keepalive-seconds` | `requests.streaming.keepalive-seconds` | `streamingKeepaliveSeconds` |
| `oauth` | `auth-auto-refresh-workers` | `oauth.auth-auto-refresh-workers` | `authAutoRefreshWorkers` |
| `oauth` | `auth-dir` | `oauth.auth-dir` | `authDir` |
| `oauth` | `oauth-excluded-models` | `oauth.excluded-models` | — |
| `oauth` | `oauth-model-alias` | `oauth.model-alias` | — |
| `oauth` | `ws-auth` | `oauth.providers.aistudio.ws-auth` | `wsAuth` |
| `oauth` | `quota-exceeded.antigravity-credits` | `oauth.providers.antigravity.antigravity-credits` | `antigravityCredits` |
| `oauth` | `antigravity.connection-pool.enabled` | `oauth.providers.antigravity.connection-pool.enabled` | `antigravityPoolEnabled` |
| `oauth` | `antigravity.connection-pool.idle-conn-timeout` | `oauth.providers.antigravity.connection-pool.idle-conn-timeout` | `antigravityPoolIdleConnTimeout` |
| `oauth` | `antigravity.connection-pool.max-idle-conns-per-host` | `oauth.providers.antigravity.connection-pool.max-idle-conns-per-host` | `antigravityPoolMaxIdleConnsPerHost` |
| `oauth` | `antigravity.sensitive-words` | `oauth.providers.antigravity.sensitive-words` | `antigravitySensitiveWords` |
| `oauth` | `antigravity-signature-bypass-strict` | `oauth.providers.antigravity.signature-bypass-strict` | `antigravitySignatureBypassStrict` |
| `oauth` | `antigravity-signature-cache-enabled` | `oauth.providers.antigravity.signature-cache-enabled` | `antigravitySignatureCacheEnabled` |
| `upstream` | `claude-code.disable-cloaking-model-list` | `upstream.claude.disable-cloaking-model-list` | `claudeDisableCloakingModelList` |
| `upstream` | `disable-claude-cloak-mode` | `upstream.claude.disable-claude-cloak-mode` | `claudeDisableCloakMode` |
| `upstream` | `claude-header-defaults.arch` | `upstream.claude.header-defaults.arch` | `claudeHeaderArch` |
| `upstream` | `claude-header-defaults.os` | `upstream.claude.header-defaults.os` | `claudeHeaderOs` |
| `upstream` | `claude-header-defaults.package-version` | `upstream.claude.header-defaults.package-version` | `claudeHeaderPackageVersion` |
| `upstream` | `claude-header-defaults.runtime-version` | `upstream.claude.header-defaults.runtime-version` | `claudeHeaderRuntimeVersion` |
| `upstream` | `claude-header-defaults.stabilize-device-profile` | `upstream.claude.header-defaults.stabilize-device-profile` | `claudeHeaderStabilizeDeviceProfile` |
| `upstream` | `claude-header-defaults.timeout` | `upstream.claude.header-defaults.timeout` | `claudeHeaderTimeout` |
| `upstream` | `claude-header-defaults.timezone` | `upstream.claude.header-defaults.timezone` | `claudeHeaderTimezone` |
| `upstream` | `claude-header-defaults.user-agent` | `upstream.claude.header-defaults.user-agent` | `claudeHeaderUserAgent` |
| `upstream` | `claude.model-level-cooling` | `upstream.claude.model-level-cooling` | `claudeModelLevelCooling` |
| `upstream` | `codex.disable-codex-cloaking` | `upstream.codex.disable-codex-cloaking` | `codexDisableCloaking` |
| `oauth` | `codex-header-defaults.beta-features` | `oauth.providers.codex.header-defaults.beta-features` | `codexHeaderBetaFeatures` |
| `oauth` | `codex-header-defaults.user-agent` | `oauth.providers.codex.header-defaults.user-agent` | `codexHeaderUserAgent` |
| `oauth` | `codex.identity-confuse` | `oauth.providers.codex.identity-confuse` | `codexIdentityConfuse` |
| `oauth` | `codex.live-media-relay.disable-private-remote-ips` | `oauth.providers.codex.live-media-relay.disable-private-remote-ips` | `codexLiveDisablePrivateRemoteIps` |
| `oauth` | `codex.live-media-relay.enabled` | `oauth.providers.codex.live-media-relay.enabled` | `codexLiveEnabled` |
| `oauth` | `codex.live-media-relay.ice-servers` | `oauth.providers.codex.live-media-relay.ice-servers` | — |
| `oauth` | `codex.live-media-relay.max-sessions` | `oauth.providers.codex.live-media-relay.max-sessions` | `codexLiveMaxSessions` |
| `oauth` | `codex.live-media-relay.public-ip` | `oauth.providers.codex.live-media-relay.public-ip` | `codexLivePublicIp` |
| `oauth` | `codex.live-media-relay.udp-port-max` | `oauth.providers.codex.live-media-relay.udp-port-max` | `codexLiveUdpPortMax` |
| `oauth` | `codex.live-media-relay.udp-port-min` | `oauth.providers.codex.live-media-relay.udp-port-min` | `codexLiveUdpPortMin` |
| `upstream` | `codex.model-level-cooling` | `upstream.codex.model-level-cooling` | `codexModelLevelCooling` |
| `client` | `codex.optimize-multi-agent-v2` | `client.codex.optimize-multi-agent-v2` | `codexOptimizeMultiAgentV2` |
| `upstream` | `codex.orphan-delegation-compatibility` | `upstream.codex.orphan-delegation-compatibility` | `codexOrphanDelegationCompatibility` |
| `upstream` | `codex.response-steering` | `upstream.codex.response-steering` | `codexResponseSteering` |
| `upstream` | `codex.stream-bootstrap-buffering` | `upstream.codex.stream-bootstrap-buffering` | `codexStreamBootstrapBuffering` |
| `upstream` | `codex.stream-bootstrap-timeout` | `upstream.codex.stream-bootstrap-timeout` | `codexStreamBootstrapTimeout` |
| `oauth` | `devin.sensitive-words` | `oauth.providers.devin.sensitive-words` | `devinSensitiveWords` |
| `upstream` | `xai.inject-x-search` | `upstream.xai.inject-x-search` | `xaiInjectXSearch` |
| `oauth` | `oauth-request-scoped-errors` | `oauth.request-scoped-errors` | — |
| `multimedia` | `disable-image-generation` | `multimedia.disable-image-generation` | `disableImageGeneration` |
| `multimedia` | `gpt-image-2-base-model` | `multimedia.gpt-image-2-base-model` | `gptImage2BaseModel` |
| `multimedia` | `video-result-auth-cache-ttl` | `multimedia.video-result-auth-cache-ttl` | `videoResultAuthCacheTTL` |
| `observability` | `debug` | `observability.logs.debug` | `debug` |
| `observability` | `error-logs-max-files` | `observability.logs.error-logs-max-files` | `errorLogsMaxFiles` |
| `observability` | `logging-to-file` | `observability.logs.logging-to-file` | `loggingToFile` |
| `observability` | `logs-max-total-size-mb` | `observability.logs.logs-max-total-size-mb` | `logsMaxTotalSizeMb` |
| `observability` | `request-log` | `observability.logs.request-log` | `requestLog` |
| `observability` | `pprof.addr` | `observability.pprof.addr` | `pprofAddr` |
| `observability` | `pprof.enable` | `observability.pprof.enable` | `pprofEnable` |
| `observability` | `redis-usage-queue-retention-seconds` | `observability.usage.redis-usage-queue-retention-seconds` | `redisUsageQueueRetentionSeconds` |
| `observability` | `usage-statistics-enabled` | `observability.usage.usage-statistics-enabled` | `usageStatisticsEnabled` |

### Secciones

Secciones completas heredadas que se trasladan, con todo su contenido (el constructor
de reglas de payload edita `requests.payload`).

| Sección heredada | Sección v8 |
| --- | --- |
| `antigravity` | `oauth.providers.antigravity` |
| `antigravity.connection-pool` | `oauth.providers.antigravity.connection-pool` |
| `claude` | `oauth.providers.claude` |
| `claude-code` | `oauth.providers.claude.claude-code` |
| `claude-header-defaults` | `oauth.providers.claude.header-defaults` |
| `codex` | `oauth.providers.codex` |
| `codex-header-defaults` | `oauth.providers.codex.header-defaults` |
| `codex.live-media-relay` | `oauth.providers.codex.live-media-relay` |
| `credential-concurrency` | `credentials.concurrency` |
| `credential-in-flight` | `credentials.in-flight` |
| `devin` | `oauth.providers.devin` |
| `discovery` | `server.discovery` |
| `discovery.interfaces` | `server.discovery.interfaces` |
| `payload` | `requests.payload` |
| `pprof` | `observability.pprof` |
| `remote-management` | `management` |
| `streaming` | `requests.streaming` |
| `tls` | `server.tls` |
| `xai` | `oauth.providers.xai` |

### Listas de credenciales de upstream

Estas se trasladan bajo el mapeo raíz `api-keys` **y cambian de estructura**: cada familia es una lista
de grupos (`name`, `base-url`, ajustes compartidos, `keys`), y la vista en tiempo de ejecución de CPA, la lista
v0 por familia, son esos grupos aplanados a una entrada por clave. Shell-PAMC edita la lista
aplanada y escribe la familia de vuelta como grupos, conservando la agrupación del operador (ADR 0038,
§4). La vista de configuración enmascarada oculta cada valor `api-key` en ellos.

| Lista heredada | Ubicación v8 |
| --- | --- |
| `gemini-api-key` | `api-keys.gemini` |
| `interactions-api-key` | `api-keys.interactions` |
| `vertex-api-key` | `api-keys.vertex` |
| `codex-api-key` | `api-keys.codex` |
| `claude-api-key` | `api-keys.claude` |
| `xai-api-key` | `api-keys.xai` |
| `meta-api-key` | `api-keys.meta` |
| `openai-compatibility` | `api-keys.openai-compatibility` |

### Sin cambios en v8

`routing.strategy`, `routing.session-affinity`, `routing.session-affinity-ttl`,
`routing.session-affinity-subagents`, `plugins.*`, `quota-exceeded.switch-project` y
`quota-exceeded.switch-preview-model` (los dos últimos están ausentes de la plantilla v8 de CPA y
no tienen lector en tiempo de ejecución, ver arriba). Las cuatro entradas `routing.*` aquí son editadas por
la página de ajustes (`routingStrategy`, `routingSessionAffinity`,
`routingSessionAffinityTTL`, `routingSessionAffinitySubagents`).

### Añadido después de v8.0.16

Ajustes que CPA introdujo entre v8.0.16 y v8.0.32, todos únicamente en su ruta v8 y todos
editados por la página de ajustes. Una pasarela anterior a la versión que introdujo un ajuste
rechaza una escritura en él (`config_rejected`); un ajuste no tocado nunca se escribe.

| Ruta v8 | Desde | Ajuste |
| --- | --- | --- |
| `server.max-request-body-bytes` | v8.0.26 | `maxRequestBodyBytes`; limita también las rutas de administración, que la consola informa como `cpa_request_too_large` |
| `routing.session-affinity-rebind-on` | v8.0.25 | `routingSessionAffinityRebindOn` (`any` o `quota`) |
| `requests.streaming.send-keepalive-before-ft` | v8.0.27 | `streamingSendKeepaliveBeforeFt` |
| `requests.tls-handshake-timeout-seconds` | v8.0.29 | `tlsHandshakeTimeoutSeconds` |
| `upstream.claude.tool-search` | v8.0.24 | `claudeToolSearch` |
| `upstream.claude.session-date-pin-days` | v8.0.32 | `claudeSessionDatePinDays`; CPA lo almacena como puntero, por lo que omitido son sus 7 días y un `0` explícito mantiene la fijación de continuidad. El editor usa por defecto `7` y escribe un `0` como ajuste real |
| `upstream.claude.header-defaults.anthropic-beta-strip`, `anthropic-beta-append`, `inject-diagnostics`, `client-request-id` | v8.0.30 | `claudeHeaderAnthropicBetaStrip`, `claudeHeaderAnthropicBetaAppend`, `claudeHeaderInjectDiagnostics`, `claudeHeaderClientRequestId` |
| `oauth.providers.codex.signin-with-chatgpt-identifier` | v8.0.25 | `codexSigninWithChatgptIdentifier` |
| `api-keys.claude[].keys[].native-tool-search` | v8.0.24 | El interruptor "Búsqueda nativa de herramientas" por clave del editor de proveedores |

## 4. Ruta de escritura de configuración de Shell-PAMC

ADR 0037. Medido de extremo a extremo el 2026-09-29: Shell-PAMC compilado a partir de este cambio, CPA v8.0.2,
y un archivo heredado con un comentario superior, claves de cliente, una entrada `codex-api-key`, reglas de payload
y una sección desconocida `omc-operator-notes`.

| Paso | Resultado |
| --- | --- |
| `GET /management/config` sobre el archivo heredado | `stored_layout: legacy`; `safe_yaml` es la representación v8 de CPA (claves de cliente en `access.api-keys`, la entrada codex como un grupo `api-keys.codex` con su `api-key` enmascarada, la sección desconocida como comentario); el archivo es idéntico byte a byte después |
| `PATCH /management/config` con tres cambios (`observability.logs.debug`, `routing.retry.request-retry`, `access.api-keys`) | `200` con la nueva revisión y representación. Se conservó un respaldo primero, idéntico byte a byte al archivo original; CPA convirtió el archivo (`config-version: 8`, sangría de cuatro espacios, valores predeterminados añadidos, la sección desconocida comentada) y los tres valores surtieron efecto; la clave codex de upstream se conservó |
| El mismo guardado con una revisión obsoleta | `409 config_conflict`, nada escrito |
| Un conjunto de cambios cuya combinación contiene un valor con error tipográfico | `422 config_rejected` con la razón de CPA; nada escrito, incluida la eliminación del conjunto |
| Una eliminación en el archivo convertido | `200`; la clave desaparece y CPA lee su valor predeterminado |
| Un guardado posterior en el archivo convertido | Ninguna segunda copia del archivo heredado (medido bajo ADR 0037; desde ADR 0051 cada escritura posterior también conserva el archivo v8 que reemplaza) |
| `PUT /management/config/source` con un nombre heredado | `422 config_rejected`: "legacy field debug is not accepted by v8; use observability.logs.debug"; archivo sin cambios |

Un conjunto de cambios se envía como una combinación para escalares y listas, un `PUT` por valor de mapa y un
`DELETE` por eliminación, en ese orden (`Client.ApplyConfigChanges`). No es atómico
a través de esas solicitudes (§9).

Las escrituras de proveedores, alias de OAuth y plugins usan los mismos conjuntos de cambios (ADR 0038). Medido
de extremo a extremo el 2026-09-29 con un archivo heredado que contenía dos entradas `claude-api-key` (una con
`request-retry: 0`), un proveedor compatible con OpenAI con `support-prompt-cache-key` y los
`input-modalities` de un modelo, un alias de OAuth y los ajustes de un plugin:

| Paso | Resultado |
| --- | --- |
| Deshabilitar la segunda clave de Claude | Un respaldo, luego el archivo convertido; la clave es `api-keys.claude[1]` con `excluded-models: ["*"]` en la clave y el `request-retry: 0` de su grupo conservado |
| Con la familia reagrupada a mano (`team`: dos claves que comparten URL base, prioridad y modelos; `solo`), deshabilitar la segunda clave de `team` | `team` conservado; la exclusión está únicamente en esa clave |
| Cambiar la URL base de la primera clave | Esa clave se convierte en `team-2`, antes de `team`; orden de lista y cada otro `auth-index` sin cambios |
| Crear un proveedor | Agregado como su propio grupo |
| Eliminar un proveedor | Su clave se elimina de su grupo; los otros grupos sin cambios |
| Deshabilitar el proveedor compatible con OpenAI | `disabled: true`; `support-prompt-cache-key`, `input-modalities` y su clave conservados, sin `auth-index` en el archivo |
| Reemplazar, agregar y vaciar alias de OAuth | `oauth.model-alias.codex` reemplazado; `claude` agregado y luego eliminado |
| Habilitar un plugin, luego reemplazar sus ajustes | `plugins.configs.foo.enabled`, luego el objeto completo; un plugin desconocido se lee como `plugin_not_found` |
| Cada escritura después de la primera | Ninguna segunda copia del archivo heredado (medido bajo ADR 0037; desde ADR 0051 cada escritura también conserva el archivo v8 que reemplaza) |

## 5. Detección

Dos hechos independientes, ambos observados en lugar de inferidos a partir de una cadena de versión:

- **Generación de la API de administración** (la puerta): `GET /v8/management/config/config-version`
  debe responder el valor `8`. Un 2xx con cualquier otro cuerpo significa que la pasarela es anterior a
  v8; el cuerpo se verifica para que un proxy comodín no pueda pasar. Un 404/405/501 significa lo mismo
  a menos que `GET /v0/management/debug` también falte: CPA responde 404 en cada ruta de administración
  mientras no tenga secreto de administración, por lo que esa pasarela se reporta como `disabled`
  en lugar de antigua. Cualquier otro estado no es una respuesta y no se recuerda; la puerta entonces
  permite el paso de solicitudes sin sondear de nuevo durante quince segundos (`API_UNDECIDED_TTL`),
  mientras `/api/healthz` sigue preguntando. Una respuesta v8 se almacena en caché por URL base de la pasarela
  durante cinco minutos (`API_SUPPORT_TTL`), una respuesta de "no v8" durante quince segundos
  (`API_UNSUPPORTED_TTL`, para que una actualización levante el bloqueo rápidamente), y la caché se descarta
  siempre que una ruta v8 responda "missing" (`internal/cpa/management/v8_gate.go`). Frente a una
  pasarela que respondió "no v8", cada operación de cliente devuelve
  `ErrManagementV8Required` sin enviar una solicitud; la capa de API lo informa como
  `cpa_v8_required`, `/api/healthz` informa `cpa_management_api: unsupported`, y la
  consola muestra una guía de actualización en lugar de cada página. Frente a una pasarela `disabled`
  devuelve `ErrManagementDisabled` (`cpa_management_disabled`), y la consola muestra el
  ajuste del secreto de administración en su lugar. Un sondeo indeciso no bloquea nada.
- **Diseño del archivo almacenado** (`configyaml.IsV8Document` sobre `GET /v0/management/config.yaml`):
  `v8` cuando el archivo contiene `config-version: 8` o posterior, `legacy` en caso contrario. Decide
  si la siguiente escritura de configuración convierte el archivo, y queda registrado en el respaldo
  que esa escritura conserva primero: una copia heredada tiene su propia retención y solo se puede descargar
  (ADR 0051). Se expone como `stored_layout` y se lee de nuevo antes de cada escritura de configuración.

## 6. Dónde se escribe un ajuste

Cada editor indica la ruta v8, cualquiera sea el diseño almacenado: CPA representa cualquier archivo en el
diseño v8, y una escritura v8 en un archivo heredado lo convierte. Las claves de cliente son
`access.api-keys`; el mapa raíz `api-keys` corresponde a los grupos de proveedores upstream, escritos una
familia a la vez por el editor de proveedores (`api-keys.<familia>`). Las reglas de payload son `requests.payload`, una categoría por
cambio.

No hay barrera de guardado propia de Shell-PAMC. CPA rechaza un nombre heredado, una sección desconocida o un
valor mal escrito sin escribir esa solicitud (§1). La consola informa
`config_rejected` con el motivo de CPA si ninguna solicitud anterior en el conjunto de cambios se aplicó, o
`config_partially_applied` si las solicitudes anteriores ya se habían escrito. Las claves heredadas
superpuestas no pueden surgir de un editor que solo escribe rutas v8.

**Las escrituras escalares** (`PUT /management/config/{key}`, utilizadas también por `config_set` del Agente)
son conjuntos de un solo cambio en la ruta v8 de la clave. Los alias de modelo de OAuth son
`oauth.model-alias.<proveedor>`, los ajustes por plugin `plugins.configs.<id>` y su
interruptor `plugins.configs.<id>.enabled`.

## 7. Rutas

Cada operación se dirige a su ruta `/v8/management`, sin respaldo alternativo:

| Operación | Ruta |
| --- | --- |
| Archivos de credenciales: listar, subir, eliminar, descargar, modelos, estado, campos | `/credentials`, `/credentials/download`, `/credentials/models`, `/credentials/status`, `/credentials/fields` |
| Inicio de sesión OAuth, estado, cancelación, callback | `/oauth/auth-url?provider=`, `/oauth/status`, `/oauth/session`, `/oauth/callback` |
| Vinculación de credenciales SIWC (estado OAuth compartido, cancelación y callback) | `/oauth/siwc/bind` |
| Plugins: listar, eliminar, tienda, instalar | `/plugins`, `/plugins/<id>`, `/plugins/store`, `/plugins/store/<id>/install` |
| Cola de uso (extracción HTTP) | `/observability/usage/queue` |
| Uso de claves API | `/observability/usage/api-keys` |
| Registros de aplicación (leer, limpiar) | `/observability/logs` |
| Lista de registros de errores y descarga | `/observability/logs/errors[/<nombre>]` |
| Registro de solicitud por ID | `/observability/logs/requests/<id>` |
| Llamada autenticada a upstream (sondeos de cuota) | `/requests/api-call` |
| Restablecimiento de enfriamiento de credenciales | `/routing/cooldown/reset` |
| Versión más reciente | `/server/latest-version` |

El endpoint de inicio de sesión compartido llama a Claude `claude`, mientras que la consola y los archivos
de credenciales de CPA lo llaman `anthropic`; `OAuthProvider.LoginProvider` maneja la diferencia. Los proveedores
de inicio de sesión de plugins son atendidos por el mismo endpoint.

Fuera de la excepción del Plugin Host confiable (ADR 0067), `/v0/management`, que v8 atiende
sin cambios, se consulta a través de `internal/cpa/management/client_v0.go` solo para leer:

- las listas de credenciales por familia (`/<familia>-api-key`, `/openai-compatibility`), que
  son la única fuente del `auth-index` de cada clave de upstream: la vista de configuración v8 es
  el documento almacenado y no porta campos de tiempo de ejecución;
- `/config.yaml`, el archivo tal como está almacenado, leído antes de cada escritura de configuración v8 para conservar
  un respaldo de este.

El canal de uso RESP no forma parte de la API de administración y no se modifica.

## 8. Matriz de compatibilidad

"Medido" significa probado contra el binario real; "no verificado" significa no probado de extremo
a extremo. La columna v7.3.20 es el registro del cambio de ADR 0028 y ya no describe una
pasarela compatible: Shell-PAMC ahora rechaza v7 antes de cualquier solicitud.

| Superficie de Shell-PAMC | CPA v8.0.2, archivo heredado | CPA v8.0.2, archivo v8 |
| --- | --- | --- |
| Guardado de página de configuración (conjunto de cambios) | Medido: respaldo, luego CPA convierte el archivo | Medido, escrituras por ruta |
| Guardado en editor de código fuente | Rechazado por CPA ante un nombre heredado (medido) | Medido |
| Página de claves | Medido, `access.api-keys` (convierte el archivo, como cualquier guardado) | Medido, `access.api-keys` |
| Rutas del esquema del editor | — | Medido: las 36 rutas recién añadidas, cada una escrita con el valor predeterminado de su campo y reída del archivo persistido |
| Escrituras escalares (`config_set`) | Probado por unidad, conjunto de un solo cambio | Probado por unidad, conjunto de un solo cambio |
| Credenciales de proveedores, alias de OAuth, ajustes de plugins | Medido: respaldo, luego convertido en la primera escritura | Medido, escrituras que preservan grupos |
| Uso: suscripción RESP | Medido | Independiente del diseño |
| Uso: cola HTTP, logs, logs de errores, uso de claves API | Medido, rutas v8 | Independiente del diseño |
| Registro de solicitudes, restablecimiento de enfriamiento, api-call, versión más reciente | Medido, rutas v8 | Independiente del diseño |
| Archivos de credenciales, inicio de sesión OAuth, plugins (rutas v8) | Probado por unidad y navegador contra fixtures | Independiente del diseño |
| Puerta contra una pasarela v7 | Probado por unidad (cada ruta de una pasarela v7 responde 404) | — |

Las filas "Independiente del diseño" no dependen del archivo.

Las rutas de credenciales, OAuth y plugins están registradas en los mismos controladores de CPA que sus
contrapartes v0 (`server_management_v8.go`), por lo que los fixtures las reemplazan. No fue
posible realizar inicios de sesión reales de proveedores ni tráfico de upstream en el entorno de pruebas, por lo que esos
flujos y el contenido de los registros de uso no se probaron contra un binario real.

## 9. Riesgos

- **El esquema del editor nombra las rutas de una versión específica.** Una versión de CPA que mueva o renombre un
  ajuste hace que CPA rechace la solicitud inválida (`config_rejected` si ninguna solicitud
  anterior se aplicó). Las solicitudes válidas anteriores en el mismo conjunto de cambios ya pueden haberse
  escrito; esos guardados devuelven `config_partially_applied` sin revertirlos.
  Vuelva a comprobar el esquema (§10) al mover la versión fijada.
- **El primer guardado convierte el archivo.** El formato, los comentarios de claves no trasladadas y las secciones
  desconocidas no se recuperan de la conversión de CPA; el original se conserva como un respaldo previo a v8
  hasta que diez copias previas a v8 posteriores lo hayan desplazado (las escrituras cotidianas de v8 no cuentan
  para eso). Cualquier otro escritor de configuración v8 (CPAMC, un script) convierte el archivo
  de la misma forma, sin el respaldo de Shell-PAMC.
- **Un conjunto de cambios no es atómico.** La combinación se envía primero y es donde CPA rechaza un
  valor con error tipográfico; un valor de mapa o una eliminación que falle después de ella deja la combinación aplicada.
  La respuesta del guardado vuelve a leer CPA, por lo que el editor muestra lo que CPA contiene.
- **Una familia se escribe completa.** CPA no tiene ruta para una sola clave de un grupo, por lo que una escritura
  de proveedor devuelve los grupos de la familia. La barrera de escritura de proveedores serializa las escrituras
  propias de Shell-PAMC. Contra CPA v8.0.31 o posterior, cada escritura también porta `If-Match` con la etiqueta
  de entidad de CPA para el archivo que Shell-PAMC leyó y respaldó justo antes (el SHA-256 de sus bytes exactos),
  y cada solicitud posterior de un conjunto de cambios indica la etiqueta que CPA informó para su
  guardado anterior. Cuando la respuesta de un guardado no porta etiqueta (CPA no pudo releer el archivo),
  las solicitudes posteriores en ese conjunto de cambios son incondicionales. Un escritor externo a
  Shell-PAMC que guarde en el intervalo hace que CPA responda `412`,
  lo que la consola informa como `config_conflict` (nada escrito) o
  `config_partially_applied` (una solicitud anterior del conjunto se había aplicado). Las pasarelas
  más antiguas ignoran el encabezado, por lo que allí un escritor concurrente que edite la misma familia
  entre la lectura y la escritura todavía es sobrescrito.
- **Caché de sondeo.** Una actualización desde v7 se detecta dentro de `API_UNSUPPORTED_TTL` (quince
  segundos); una reversión a v7 se detecta en la primera ruta v8 que responde "missing".

## 10. Comprobación de una nueva versión de CPA

1. Ejecute la versión con una contraseña de administración y una copia de un archivo de configuración real.
2. Para cada campo en `web/src/types/configSchema.ts`, envíe su valor actual (o un
   valor de su tipo) a `PATCH /v8/management/config` en su `yamlPath`. Un `400` indica una
   ruta que la versión ya no acepta; mueva el campo a la ruta que le asigna el `config_v8.go`
   de la versión, y agregue la fila a §3.
3. Compare `server_management_v8.go` de la versión con las rutas en §7 y actualice
   este documento.
