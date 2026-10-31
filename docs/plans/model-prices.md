# Precios de modelos

El libro de precios: cómo se asigna un costo a cada solicitud que sirve la pasarela, contra
qué tarifas queda bloqueado ese costo y cómo un operador puede modificarlas. El
registro de decisión es ADR 0030; el bloqueo al momento de la solicitud que este extiende es ADR 0003.

## Principios

1. **Cero configuración por defecto.** El servicio de precios descarga la lista pública
   de modelos de OpenRouter (`https://openrouter.ai/api/v1/models`, sin clave) al inicio y luego
   en un intervalo del lado del servidor que por defecto es diario; el operador puede cambiarlo
   (desactivado / 1h / 6h / 12h / 24h) sin reiniciar. Cada modelo actual de CPA que
   coincida con un modelo de OpenRouter se tarifica automáticamente, y un modelo que CPA comience
   a servir se tarifica dentro de la conciliación de catálogo de cinco minutos a partir de la
   instantánea almacenada, sin esperar a la siguiente descarga.
2. **Fuente única.** OpenRouter es la única fuente automática. La URL es una
   constante en tiempo de compilación; nunca se consulta ninguna URL provista por el operador.
3. **La tarificación sigue el catálogo actual de CPA.** Una instantánea completa del catálogo se
   persiste por separado del historial de uso; los modelos eliminados abandonan el libro mientras
   sus instantáneas inmutables de solicitudes permanecen consultables.
4. **Tres modos, y el del operador siempre prevalece.** Un modelo se tarifica
   automáticamente (`auto`), sigue a un modelo de OpenRouter elegido por el operador
   (`linked`), o utiliza las tarifas propias del operador (`custom`). Las sincronizaciones actualizan filas auto
   y linked y nunca tocan las custom; una sincronización nunca reemplaza un modelo
   fijado con su propia coincidencia.
5. **Sin precio no significa cero.** Una solicitud sin versión de precio informa `cost_usd`
   ausente, y cada total que la excluye indica que es parcial.
6. **Los costos de solicitud se bloquean una sola vez.** La transacción de inserción selecciona la versión de precio
   y la versión de canal vigentes en la marca de tiempo de la solicitud, aplica
   el nivel para el que la solicitud califica, y almacena nanos de USD, el índice de nivel y
   ambos IDs de versión. Ediciones posteriores no pueden reescribir el historial.

## Estructura de precios

El precio compartido de un modelo puede anularse con tarifas y niveles personalizados para un
canal de CPA registrado (`usage_events.provider`). La migración 043 almacena esto en
`channel_model_prices`, indexado por `(channel, model)`, y añade su historial a
`model_price_versions` con un discriminador de canal. Las solicitudes eligen primero una versión
de canal disponible, o de lo contrario la versión compartida, ambas al momento de la solicitud. Eliminar
una anulación añade un tombstone y restaura la tarificación compartida para solicitudes posteriores.
El multiplicador de canal existente aplica a cualquiera de los dos precios. La coincidencia automática compartida,
los enlaces y precios personalizados conservan su semántica; las anulaciones de canal son personalizadas.

El endpoint `GET|PUT|DELETE /v1/pricing/models/{model}` del editor acepta un parámetro
opcional de consulta `channel`. Una escritura debe nombrar un modelo en la membresía persistida de ese canal.
Lecturas con alcance devuelven el precio efectivo e `is_inherited`; el libro de precios incluye
`channel_models` cuando existen anulaciones. Model Square mapea nombres de llamada a través de sus
rutas reales y membresía de proveedores, manteniendo prefijos, alias y nombres
de upstream por separado. Múltiples destinos se ofrecen individualmente en lugar de seleccionar uno solo.

Un precio consta de cuatro tarifas por cada 1M de tokens (prompt, completado, lectura de caché, escritura
de caché), un multiplicador de modelo y una lista opcional de **niveles (tiers)**:

- un **nivel de contexto largo** (`min_prompt_tokens`) aplica cuando la entrada completa
  de la solicitud, incluidos tokens en caché, alcanza el umbral;
- un **nivel horario del día** (`utc_start`/`utc_end`, HHMM) aplica cuando la
  marca de tiempo propia de la solicitud cae en la ventana `[start, end)`, que envuelve pasada
  la medianoche cuando el fin no es posterior al inicio. La ventana se interpreta en la
  **zona horaria de facturación** del nivel (`time_zone`, un nombre IANA como
  `Asia/Shanghai`) y en UTC cuando el nivel no indica ninguna, de modo que un proveedor que
  publique horas no pico en hora de Beijing se ingresa tal como se publica. La solicitud
  se ubica en el reloj de pared de esa zona en su propio instante, permitiendo que el horario
  de verano de una zona desplace la ventana con el proveedor. La zona es independiente de la
  Zona Horaria de Shell-PAMC, que solo rige cómo muestra el tiempo la consola (ADR 0063);
- un **nivel de servicio** (`service_tiers`, como `["priority","fast"]`)
  aplica cuando la solicitud fue facturada en uno de los niveles de servicio upstream
  indicados. Para Codex, rige el `effective_service_tier` final saliente cuando
  no esté vacío; de lo contrario, el `service_tier` del cliente sigue siendo la evidencia. Su respuesta
  puede reportar `default` o `auto` incluso para Fast. Un `auto` saliente explícito no selecciona
  ningún carril. Otros proveedores prefieren un `response_service_tier` distinto de `auto`,
  recurriendo a la solicitud como respaldo. Un campo faltante en la solicitud de Codex puede recurrir
  a la respuesta; un `auto` explícito no nombra ningún carril y no realiza fallback. `auto` y vacío nunca coinciden. Los nombres se comparan
  en minúsculas y sin espacios laterales. Las variantes de grafía de proveedores que comparten una tarifa
  se enumeran en el propio precio: no existe un mapeo integrado entre `fast` y `priority`;
- un nivel que contiene varias condiciones aplica solo cuando se cumplen todas ellas.

Exactamente un nivel rige una solicitud: un nivel de servicio sobre uno que no lo sea, luego
el umbral aplicable más alto, luego un nivel con ventana temporal sobre uno sin ventana,
y finalmente el orden almacenado. Los proveedores publican carriles prioritarios como su propia lista de tarifas, por lo que un
precio prioritario de contexto largo es un nivel que porta tanto `service_tiers` como
`min_prompt_tokens`; sin él, una solicitud prioritaria por encima del umbral paga las
tarifas del carril prioritario, nunca una combinación de ambas. Las tarifas que un nivel
omite heredan el precio base. `pricing.Quote` es la única implementación; la vista
previa del editor en la consola la replica en `web/src/types/pricingDisplay.ts` y
la suite lógica asegura ambas contra los mismos casos de prueba.

Un **multiplicador de canal** escala cada solicitud que un proveedor de CPA respondió
(`usage_events.provider`, ej. `codex`, `openai-compatible-deepseek`). El
costo de la solicitud es:

```
costo base por nivel × multiplicador de modelo × multiplicador de canal
```

Ambos multiplicadores se aplican como fracciones exactas antes de un único
redondeo hacia arriba (half-up) a nanos de USD, de modo que una solicitud sin niveles y con canal 1× cuesta exactamente
lo que calculaba la fórmula previa a niveles (`FuzzQuoteLegacyParity`).

El nivel de servicio resuelto y su origen (outbound/request/response) se almacenan con los nuevos
costos de solicitud (migración 045). Registros históricos sin esa selección retienen
la política original centrada en la respuesta cuando se explica su costo bloqueado. Ni los
importes ni las versiones de precios se reescriben. Indicadores de modo y el
filtro `resolved_service_tier` utilizan la interpretación actual consciente del proveedor;
`service_tier` continúa filtrando la solicitud original del cliente.

CPA v8.0.39 añade telemetría opcional `effective_service_tier` procedente de la solicitud saliente
final tras la traducción y reglas de payload. Codex prefiere esta evidencia, incluyendo
degradaciones explícitas a `default`; un `auto` saliente no selecciona precio de nivel de servicio
y nunca revive la prioridad original del cliente. La evidencia de salida faltante o vacía
retiene el solucionador existente consciente de solicitudes, sin requerir una barrera por versión de pasarela.
Otros proveedores retienen la tarificación priorizando la respuesta. La migración 046 añade el campo sin procesar
y extiende el origen de la instantánea inmutable con `outbound`, preservando filas antiguas,
importes y explicaciones. CPA omite un nivel saliente vacío, por lo que un publicador antiguo
y una regla de payload que haya eliminado el nivel son indistinguibles. Shell-PAMC no
infiere evidencia faltante a partir de la configuración actual o de la latencia de la solicitud.

## Decodificación de OpenRouter

`internal/pricing/openrouter.go` reduce el envoltorio a precios de lista:

- cadenas decimales por token se escalan a precios por 1M exactamente;
- variantes (`:free`, `:batch`, cada variante con `:`), los enrutadores propios de OpenRouter y
  cualquier entrada cuyo precio sea negativo o faltante se omiten;
- alias `~vendor/…-latest` se conservan pero solo coinciden como último recurso;
- anulaciones con `min_prompt_tokens` o `utc_start`/`utc_end` se convierten en niveles,
  siempre sin zona horaria, dado que OpenRouter publica sus ventanas en UTC; cualquier otra
  anulación se descarta;
- **una tarifa de caché que OpenRouter omita resuelve a la tarifa de prompt**, nunca a cero:
  la omisión indica que no se publica descuento por caché, y cero facturaría los tokens
  en caché como gratuitos. Un nivel hereda su propia tarifa de prompt de la misma forma cuando la base
  la heredó.

Los niveles se almacenan en una única grafía canónica (`pricing.EncodeTiers`), debido a que el
activador de versión compara el texto almacenado y dos grafías de los mismos niveles
generarían una versión en cada sincronización. Un nivel sin zona horaria conserva la grafía que
tenía antes de admitirse zonas, y el editor guarda una ventana UTC sin zona, por la misma razón.

## Regla de coincidencia

`Catalog.MatchModel` clasifica candidatos por precisión de coincidencia, luego por autor
de primera parte, luego por longitud de slug y finalmente por ID — un orden total, asegurando que el ganador
sea estable entre sincronizaciones:

1. `exact` — el ID de OpenRouter sin su espacio de nombres de autor;
2. `canonical` — el slug canónico con fecha (`claude-opus-5.5-20260921`);
3. `normalized` — normalización de mayúsculas/minúsculas y separadores (`GLM-5.3 Flash` = `glm-5.3-flash`), preservando límites de componentes numéricos para que `5.1` nunca equivalga a `51`;
4. `date_stripped` — tras remover una fecha de lanzamiento (`-YYYYMMDD`,
   `-YYYY-MM-DD`, `-MM-YYYY` o `-MMDD` cuando se lee como mes y día reales, de modo que
   el YYMM `2507` de Qwen sobreviva);
5. `alias` — un alias flotante `~…-latest`.

La tabla de autores de primera parte mapea familias de modelos a espacios de nombres de OpenRouter
(`gpt` → `openai`, `glm` → `z-ai`, `kimi` → `moonshotai`, …). Un nombre de CPA se
divide con `StripProviderPrefix`; un ID de OpenRouter se divide en su primera `/`
y su variante `:` nunca se trata como un modelo.

Un nombre que solo se parece a un modelo listado — típicamente una decoración de esfuerzo
de razonamiento como `gpt-5.4-mini-high` — no se empareja. `Catalog.Suggest`
lo ofrece en su lugar, restringido a los autores de primera parte de la familia. Un control reconocido de esfuerzo final o thinking se remueve solo para la clasificación de sugerencias; una identidad base resuelta (incluyendo nombres canónicos o fechados) clasifica primero. La consola permite al operador adoptar una sugerencia con un solo clic (un enlace).

Un alias de CPA con objetivos en conflicto se persiste con un `price_model` vacío. Permanece visible pero no se empareja automáticamente; otros modelos continúan sincronizándose. Un alias recién vuelto ambiguo retira su precio automático previo, mientras que precios personalizados y enlaces del operador siguen siendo autoritativos. Identidades de modelo inválidas siguen rechazando la instantánea completa.

El descubrimiento de OAuth combina los IDs registrados de credenciales habilitadas con las
reglas globales sanitizadas de alias OAuth de su proveedor. Un alias presente en una credencial contribuye
tanto con su punto de llamada como con su upstream resuelto al catálogo de precios, incluso
cuando CPA oculte el nombre original (`fork: false`). Los destinos de alias son identidades
para emparejamiento de precios, no enlaces implícitos: una variante de razonamiento sin coincidencia exacta segura
sigue requiriendo un enlace del operador o un precio personalizado. Reglas inactivas y credenciales
deshabilitadas no aportan nada. Reglas de alias ilegibles rechazan la instantánea y
conservan el último catálogo persistido completo.

La instantánea de administración mantiene `Models` del proveedor visibles para el cliente en Model Square;
sus `Routes` de OAuth conservan el upstream por separado. El adaptador de precios de la aplicación usa
`ListPricingModelIDs` para incluir ambos en la membresía de proveedores, permitiendo que un upstream pueda
editarse en el libro de precios sin publicitarse como invocable. Los bloqueos de solicitudes
continúan usando el `usage_events.model` de upstream registrado; solicitudes históricas no tarificadas
no se retroalimentan cuando un operador vincula ese upstream.

## Componentes

- `migrations/028_openrouter_pricing.sql`: reconstruye `model_prices` (niveles, ID de
  upstream, tipo de coincidencia, la fuente `openrouter`) y `pricing_sync_state` (fuente
  `openrouter`, el cronograma conservado), extiende `model_price_versions`, y añade
  `pricing_model_links`, `pricing_upstream_catalog`, `pricing_channels`,
  `pricing_channel_versions` y `usage_events.channel_version_id`/`price_tier`.
  Las filas existentes se copian sin los activadores de versión, por lo que la actualización no genera
  versiones ni retasará nada.
- `migrations/031_pricing_match_reviews.sql`: `pricing_match_reviews`, el
  modelo de OpenRouter que el operador respondió por última vez para cada precio personalizado o vinculado.
- `migrations/019_request_price_snapshots.sql` y
  `migrations/020_pricing_model_catalog.sql`: las versiones append-only, las columnas de instantánea
  de solicitud y la proyección del catálogo de CPA sobre las que esto se construye.
- `internal/pricing`: `openrouter.go` (obtención y decodificación), `match.go` (índice,
  clasificación, sugerencias), `quote.go` (selección de niveles, `Quote`, codificación de niveles),
  `service.go` (sincronización, modos, canales), `types.go`. El paquete define la
  interfaz `Store`; `internal/repository` la implementa.
- `internal/repository/usage_pricing.go`: el bloqueo de solicitudes (`lockUsagePrice`), el
  desglose en lectura (`GetUsageEventCostBreakdown`) y el historial de precios;
  `pricing_channels.go`, `pricing_upstream.go`, `pricing_usage.go` (tráfico a 30 días
  por modelo y canal, y el perfil mediano de tokens).
- `internal/api/management_pricing.go`: `GET /v1/pricing`,
  `GET /v1/pricing/attention`, `GET /v1/pricing/catalog`,
  `GET|PUT|DELETE /v1/pricing/models/{model}`,
  `POST /v1/pricing/models/{model}/dismiss-candidate`,
  `PUT|DELETE /v1/pricing/channels/{channel}`, `POST /v1/pricing/sync` (409 durante
  ejecución), `PUT /v1/pricing/sync-schedule`. Los parámetros de ruta se decodifican, por lo que un
  modelo nombrado `openai/gpt-5` funciona. La respuesta de detalle de solicitud porta
  `cost_breakdown`.
- `internal/operations/pricing.go`: las capacidades del agente `pricing_overview`,
  `pricing_list`, `pricing_get`, `pricing_catalog_search`, `pricing_quote`,
  `pricing_set` (modo, enlace, tarifas, niveles), `pricing_delete`, `pricing_sync`,
  `pricing_channel_set`, `pricing_channel_delete`; `requests_cost_breakdown`
  reside junto a las lecturas de solicitudes en `internal/operations/usage.go`.
- `web/src/components/pricing/`: el editor general de la consola (`PricingEditorProvider`,
  `PriceEditorDrawer`), el desglose de costo de solicitudes y partes compartidas.
- `web/src/pages/pricing/`: el libro de precios — cobertura y estado de sincronización en la cabecera,
  la lista de modelos agrupada por proveedores y la pestaña de multiplicadores de canal.

## Dónde se establece un precio

El editor se abre en el lugar desde cada superficie que muestra un costo:

- las filas del libro de precios (donde "Adoptar" vincula una sugerencia, y una nueva coincidencia puede
  seguirse o ignorarse, sin abrir el editor);
- una fila sin precio de la lista de solicitudes, sin abrir el registro;
- el desglose de costos en el panel lateral de solicitudes;
- un grupo sin precio o parcialmente tasado del ranking de modelos del tablero, únicamente en la
  vista de modelos — un punto de llamada puede ser un alias tasado bajo el modelo al que
  resolvió.

El mosaico de costos del tablero enlaza al libro cuando su total es parcial. El editor
previsualiza el cambio sobre la solicitud mediana del modelo en los últimos siete días, y
sobre su prompt reciente más grande cuando alcanza un nivel de contexto largo; cada fila de vista previa
nombra el nivel con el que el nuevo precio la facturaría, y una calculadora tasa cualquier tamaño
de entrada y salida que el operador ingrese ("300K").

## Edición de niveles (tiers)

El formato en transmisión permanece como una lista `tiers`; el editor lo presenta como las dos
preguntas que formulan los operadores. `web/src/components/pricing/PricingParts.tsx` contiene los
componentes y `web/src/types/pricingDisplay.ts` la lógica pura de borrador asegurada por la suite lógica:

- **Precios de contexto largo** enumera niveles con un umbral. El umbral se escribe
  tal como lo publican los proveedores (`200K`, `1M`, `272,000`) o se elige de preajustes, y un
  nivel puede limitarse adicionalmente a una ventana horaria, cubriendo los niveles
  combinados aceptados por el servidor.
- **Precios horarios del día** enumera niveles solo con una ventana. Cada ventana porta su
  propia zona horaria de facturación, elegida de la lista IANA con diferencias horarias actuales; una nueva
  ventana comienza en la Zona Horaria de Shell-PAMC. Las horas se guardan como se ingresan, nunca
  se convierten, y cuando la zona de facturación y la de Shell-PAMC difieren, el editor
  y la escala de precios también muestran la misma ventana tal como la consola la interpreta hoy.
  Si el navegador no puede interpretar una zona de facturación almacenada, el selector conserva su nombre
  y valor originales sin etiqueta de compensación, permitiendo que el editor abra y la zona
  pueda preservarse o modificarse. La vista previa local omite zonas ilegibles;
  la facturación en el servidor sigue siendo autoritativa.
- Las tarifas de un nivel se ingresan como **múltiplos de la base** (predeterminado) o como
  **precios fijos**; un campo en blanco hereda la tarifa base en ambos. Los múltiplos se
  convierten a tarifas al guardar, de modo que el servidor solo almacena tarifas. Un nivel almacenado
  se reabre como múltiplos solo cuando cada tarifa fijada es un múltiplo legible
  (tres decimales) de su base, evitando redondeos indeseados al reabrir y guardar.
  Cambiar el modo de entrada convierte lo escrito conservando el precio.
- Al guardar se escriben los niveles de contexto largo antes que los horarios. La regla del
  servidor solo recurre al orden de lista entre niveles con el mismo umbral y ventana,
  que siempre comparten sección, de modo que el agrupamiento nunca altera el nivel determinante.
  Dos niveles con condiciones idénticas se rechazan, ya que el segundo nunca aplicaría.
- **La escala de precios** (`priceSchedule`) muestra la base y cada nivel como las cuatro
  tarifas que paga una solicitud allí, con tarifas heredadas atenuadas y modificadas marcadas
  con su múltiplo. Aparece para precios automáticos y vinculados que contengan niveles,
  así como bajo un precio personalizado en edición.

## Tarificación a través de un agente

Establecer precios es una de las tareas más complejas de la consola, por lo que la superficie de capacidades
está diseñada para que un agente la ejecute en nombre del operador (`docs/agent-capabilities.md`):

1. `pricing_overview` indica por dónde empezar: estado de sincronización, cuántos modelos están tasados
   en cada modo y los modelos sin precio más activos primero con sugerencias.
2. `pricing_get` consulta un modelo completo: precio, coincidencia automática, sugerencias,
   candidato, canales que lo sirven, tráfico a 30 días y solicitud mediana de 7 días.
3. `pricing_catalog_search` localiza el ID de OpenRouter para un enlace, o tarifas y niveles
   publicados para copiar en un precio personalizado.
4. `pricing_quote` tasa una solicitud hipotética contra el precio almacenado o una entrada
   propuesta para `pricing_set` sin guardarla, a través de `pricing.Quote` y
   `Service.PreviewModeChange`, la misma resolución utilizada en la escritura. Variar
   `timestamp_ms` e `input_tokens` verifica una ventana o umbral antes de solicitar
   la aprobación del operador.
5. `pricing_set` escribe tras la aprobación. Un rechazo devuelve `invalid_parameters`
   con un `detail` que indica el campo a corregir, generándose en la preparación de la llamada,
   garantizando que una zona errónea o un ID de OpenRouter desconocido nunca lleguen a aprobación.

`requests_cost_breakdown` responde la pregunta inversa para una solicitud registrada.

## Banco de trabajo agrupado por proveedores

La membresía de modelos se recopila durante el mismo barrido completo de catálogo de CPA que los destinos de alias, persistiendo atómicamente en `pricing_catalog_state.providers_json` (migración 029). El libro de precios lee esta instantánea localmente: abrir la página nunca consulta credenciales individuales en abanico. Proveedores de claves API conservan sus IDs de la página de proveedores; credenciales OAuth se combinan por proveedor, utilizando la prioridad más alta de credencial activa. Credenciales deshabilitadas no aportan membresía. Un barrido fallido preserva la instantánea anterior completa.

`GET /v1/pricing` incluye `providers`, con ID, familia, nombre para mostrar, canal, prioridad, marcador OAuth, membresía de modelos, anulación opcional de icono y una sugerencia de endpoint solo con hostname para el solucionador de iconos existente. Información de usuario en URL, rutas y parámetros de consulta quedan excluidos.

Los grupos se ordenan por prioridad de enrutamiento descendente, luego por nombre natural de proveedor e ID estable. Los modelos se ordenan naturalmente por nombre, primero sin distinguir mayúsculas y minúsculas, y con mayúsculas primero en caso de empate exclusivo. La membresía utiliza identidades exactas de modelo: dos nombres que difieran solo en mayúsculas/minúsculas se mantienen diferenciados. Cada membresía de proveedor/modelo tiene una fila que muestra su anulación de canal cuando esté configurada, o de lo contrario el precio compartido.

La búsqueda, los filtros de modo de precio y el selector de proveedor operan sobre el libro agrupado. Una página global renderiza como máximo 20 filas de membresía a través de todos los grupos tanto en escritorio como en móviles. Modelos sin precio ocupan su posición ordenada normal y muestran cualquier enlace sugerido junto a su nombre. El selector de OpenRouter busca IDs, slugs canónicos y nombres para mostrar con tolerancia a separadores; pagina todas las coincidencias en grupos de 12. Multiplicadores de canal usan páginas de 20 filas y reutilizan alias/iconos conocidos de proveedores.

## Nuevas coincidencias para precios personalizados y vinculados

Una sincronización nunca sobrescribe un precio personalizado o vinculado, por lo que un modelo tasado
a mano porque OpenRouter aún no lo listaba permanece con sus tarifas manuales cuando OpenRouter
comienza a listarlo. El libro anuncia esto como un **candidato** en su lugar:

- el candidato de un precio personalizado es la coincidencia automática cuando existe, o de lo contrario
  la primera sugerencia (`kind` `automatic` o `suggested`);
- el candidato de un precio vinculado es una coincidencia automática que difiere de su enlace;
  las sugerencias nunca cuestionan un enlace;
- precios automáticos y modelos sin precio no tienen candidato.

`pricing_match_reviews` (migración 031) registra, por modelo, el modelo de OpenRouter que el operador
respondió por última vez. Guardar un precio personalizado o vinculado registra el candidato visible
en ese momento, evitando que un precio fijado mientras ya existía coincidencia vuelva a anunciarse;
"Ignorar" (`POST /v1/pricing/models/{model}/dismiss-candidate` con el `upstream_id` mostrado) lo registra
explícitamente. Cambiar a automático o eliminar el precio limpian el registro.

## Cambios de modo

Un cambio de modo es una escritura (`Repository.ApplyModelPrice`) que reemplaza la fila,
incluyendo personalizadas, y establece o limpia el pin en la misma transacción, generando
exactamente una versión y nunca un tombstone intermedio. Un cambio a `auto` o
`linked` se rechaza cuando la instantánea almacenada no contiene datos para tasarlo,
en lugar de dejar el modelo sin precio. Eliminar un precio retira este y su pin;
la reconciliación siguiente puede volver a tasar el modelo automáticamente.

Sincronización y escrituras del operador comparten un bloqueo. La descarga ocurre fuera
de él, y los precios y pines se releen bajo el bloqueo antes de escribir, respetando
un pin establecido durante una descarga lenta; la protección de upsert rechaza reemplazar una fila
fijada con un modelo upstream diferente.

## Registro y mantenimiento

`updated_at_ms` es estampado por el servidor al escribirse una fila; el reloj del navegador
nunca fecha un cambio de precio. Las columnas de SQLite tienen tipos orientativos, por lo que
`SavePricingSyncState` mantiene cada cláusula `DO UPDATE SET` sobre `excluded.` o la fila
destino, la lectura protege `last_success_at_ms` con `typeof()`, y
`GET /v1/pricing` degrada a `sync.known = false` con el motivo en
`sync.state.last_error` en lugar de fallar.

Un desglose de solicitud preserva su estado e importe almacenados cuando la instantánea
de nivel bloqueada es ilegible, informando `invalid_reason`. El historial de precios rechaza
instantáneas de niveles corruptas en lugar de presentarlas como tarifas exclusivas de base.

## Límites conocidos

- La primera descarga tras iniciar requiere acceso de red a openrouter.ai; un fallo
  conserva la última instantánea completa y precios válidos, continuando la conciliación
  tasando nuevos modelos desde la instantánea almacenada.
- Un modelo que OpenRouter no liste permanece sin precio hasta que un operador lo vincule
  o lo tase manualmente.
- Una instalación actualizada a la migración 031 no tiene respuestas registradas aún, por lo que cada
  precio personalizado o vinculado que ya tenga un candidato se anuncia una vez.
- Filas tasadas desde models.dev antes de la transición conservan su fuente `modelsdev`
  hasta que una sincronización las empareje, permaneciendo tasadas mientras tanto.
- El desglose de costos de una solicitud se recalcula a partir de las versiones que bloqueó. El importe
  almacenado es autoritativo; `recomputed_matches` señala cualquier discrepancia.
- **El modo demo no ejecuta sincronizaciones.** La instantánea de OpenRouter, los precios, un pin, un
  multiplicador de canal y el registro de sincronización son datos de prueba sembrados por
  `internal/demo`; la instantánea es una copia recortada de la lista real
  (`internal/demo/openrouter_snapshot.json`). Consulte `docs/architecture.md` §13.
