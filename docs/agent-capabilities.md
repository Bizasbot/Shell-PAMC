# Capacidades del agente

La página **Agente** de la consola (`/agent`), el endpoint remoto de MCP (`/api/mcp`) y el
puente stdio `shell-pamc mcp` operan Shell-PAMC a través de un único registro de capacidades. Este documento es el contrato para agregar
nuevas capacidades; consulte `docs/adr/0026-one-capability-registry-over-shared-operations.md` para entender por qué el
registro existe con esta estructura.

## Estructura

```text
Página del Agente ──▶ internal/agent.Runtime ──▶ Pasarela CPA (modelo + llamadas a herramientas)
                            │
                            ▼
                      internal/capability.Executor
                            │  validar → autorizar → confirmar → auditar
                            ▼
                      internal/operations.Service
                            │
              cliente de repositorio / precios / cuota / administración
```

- `internal/operations` contiene las operaciones de negocio. Un controlador HTTP de la consola y una
  capacidad invocan el mismo método; ninguno reimplementa validación, barreras de escritura,
  revisiones o relectura de CPA.
- `internal/capability` es propietario de las declaraciones, la inferencia de JSON Schema, la validación
  de argumentos y resultados, las reglas de permisos y riesgos, el almacenamiento de operaciones pendientes y el
  registro de auditoría.
- `internal/agent` es propietario del bucle del modelo: persistencia de conversaciones, presupuestos, streaming
  y reanudación, además de las dos cosas que pertenecen a la conversación y no a Shell-PAMC:
  `ask_question` y las herramientas de visualización. Nunca accede a la base de datos, la configuración o
  el cliente de CPA directamente. La consola se comunica con él mediante AG-UI (`internal/agui`, ADR 0041).
- `internal/mcpbridge` mapea el registro a herramientas MCP para agentes externos, una sola vez, para
  ambos transportes MCP (ADR 0070). No contiene lógica de negocio ni políticas de aprobación.

## Declarar una capacidad

### Lo que se ofrece al modelo

Cada capacidad registrada se declara al modelo como una herramienta desde la primera ronda de
cada turno, en orden alfabético, con su descripción y esquema de entrada inferido. El descubrimiento no es
un paso aparte: condicionar la lista de herramientas tras una búsqueda y cargar un subconjunto por conversación es
la forma obvia de reducir una solicitud, pero cuesta un viaje de ida y vuelta completo del modelo antes de que
pueda comenzar cualquier trabajo — al tiempo que hace que "el agente no hace esto" sea indistinguible de "al
agente aún no se le ha informado sobre esto".

La consecuencia a tener en cuenta al agregar capacidades es la opuesta a la habitual:
**el catálogo se paga en cada llamada del modelo de cada turno**, por lo que una descripción larga es un
costo recurrente en lugar de un pago único. `TestAgentCatalogueFitsTheSchemaBudget` en
`internal/api/agent_http_test.go` mantiene el catálogo completo dentro de los 64 KiB como una aserción
de regresión. No es una barrera de rechazo al inicio ni en tiempo de ejecución: el entorno de ejecución siempre declara el catálogo
completo y no trunca las solicitudes a un presupuesto de contexto estimado. Los límites reales de contexto
del proveedor siguen aplicándose.

El prompt del sistema se paga de la misma manera. Está construido a partir de secciones nombradas en
`internal/agent/prompt.go` — identidad, enfoque, datos, seguridad, redacción, presentación, contexto — limitadas por
`agent.MAX_PROMPT_BYTES` (6 KiB), y cada turno registra el `agent.PROMPT_VERSION` con el que se ejecutó.
La guía de una capacidad pertenece a su `Description`, donde es pagada solo por la herramienta que
la necesita; una regla que aplica a múltiples capacidades pertenece a una sección común, y cambiar la redacción
de una sección incrementa la versión.

La sección de redacción es un contrato sobre las respuestas, no sobre las capacidades: nombre un proveedor o canal por
su nombre para mostrar, una clave de cliente por su alias, una credencial por su etiqueta, un modelo por el nombre
que solicitan los clientes, y mantenga los identificadores fuera a menos que se soliciten explícitamente; describa un campo en lugar de citarlo;
escriba los conteos de tokens en el estilo de unidad del operador (`console_token_style`: `en-compact`, `zh` o
`full`), costos en USD, duraciones en ms / s / min, porcentajes y horas como horas de reloj en
la zona horaria del despliegue. Una capacidad ayuda devolviendo el nombre para mostrar junto a cada
identificador que devuelve; un resultado que porta solo IDs no deja nada legible que el modelo pueda decir.

Una declaración es una llamada a `capability.Register` con:

| Campo | Significado |
| --- | --- |
| `Name` | Nombre estable de herramienta en `snake_case` de cara al adaptador; duplicados fallan al inicio |
| `Description` | Qué hace la herramienta y qué no revela; visible para el modelo |
| `Version` | Se incrementa cuando cambia el significado de una operación pendiente |
| `Permission` | `read`, `write`, o `destructive` |
| `Risk` | `low` o `high`; `high` requiere una función de preparación y confirmación humana |
| `HumanInput` | Transferencia opcional al navegador: `secret` o `oauth` en escrituras de riesgo `high`, o `answer` en lecturas que esperan la respuesta del operador (`ask_question`) |
| `Adapters` | `agent`, `mcp`, o ambos; la exposición es explícita, nunca implícita |
| `Invalidates` | Claves de React Query que la interfaz debe actualizar tras una escritura exitosa |

El controlador recibe una estructura de entrada tipada. El registro infiere los esquemas JSON
de entrada y salida a partir de esos tipos, valida los argumentos contra ellos (los campos desconocidos son
rechazados), vuelve a validar los argumentos sin procesar en el momento de la ejecución y valida el resultado
tipado antes de que llegue al modelo. Ambas cargas útiles están limitadas a 32 KiB.

### Capacidades de lectura

Las lecturas se ejecutan de inmediato y devuelven su resultado validado. Deben agregar o
paginar en el servidor: una página acotada, un conteo acotado de grupos o un resumen, nunca una
tabla completa. Siga las convenciones de presupuesto existentes: 20 filas por página de solicitud (máximo
100), 50 grupos con el resto agrupado en `other`, 120 intervalos de tendencia.

### Capacidades de escritura

Las escrituras de bajo riesgo (metadatos exclusivos de visualización, como el alias de una clave de cliente) pueden
ejecutarse automáticamente. Todo lo que modifique el enrutamiento, las credenciales, la disponibilidad o
la configuración es de riesgo `high` y pasa por el flujo de confirmación del ejecutor:

1. El modelo invoca la herramienta.
2. La función `Prepare` lee el estado actual y devuelve una vista previa estructurada:
   `Target`, `Revision` (la identidad y versión a la que está vinculada la aprobación), y
   `Changes`.
3. El ejecutor almacena la operación pendiente cifrada, escribe un evento de auditoría
   `prepared` y devuelve `{status: "pending", operation_id: ...}` al invocador.
4. La ejecución del Agente finaliza con una interrupción AG-UI indicando la operación y la llamada que
   la originó. La consola dibuja una tarjeta de aprobación debajo de esa llamada (ADR 0043), y un operador
   con sesión iniciada toma una decisión: permitir o denegar (ADR 0035). La aprobación vuelve a validar
   la versión de la capacidad, la autoridad del invocador y la revisión del recurso dentro de la misma
   barrera de escritura que realiza el cambio; decidir reanuda la ejecución del Agente sin un paso separado.
5. El resultado se registra (`success`, `partial`, `error` o `uncertain`) y se audita.
   Una operación se consume una sola vez; una aprobación repetida devuelve el resultado almacenado.

Reglas no opcionales:

- Una capacidad destructiva se marca como `destructive`, lo cual la tarjeta de aprobación indica como un
  cambio irreversible. Una operación por lotes debe mostrar la lista de objetivos resueltos y su
  conteo, y nunca debe expandir un comodín en tiempo de ejecución.
- La aprobación está vinculada a la revisión capturada por `Prepare`; si el objetivo cambió,
  el ejecutor devuelve `resource_conflict` y el operador debe volver a confirmar.
- Una escritura que pudo haber llegado a CPA pero no puede verificarse se reporta como `uncertain`
  (`operation_outcome_unknown`), nunca como un error simple y nunca se reintenta automáticamente.
- Una escritura cuyo resultado falla la validación de salida también es `uncertain`, ya que el cambio
  podría haber sido aplicado.
- Una operación que este proceso está ejecutando ahora mismo se lee como `executing`. Solo un registro
  `executing` sin nada ejecutándose — que un reinicio dejó atrás — se lee como `uncertain`.

Precios es el ejemplo desarrollado de una escritura vinculada a revisión. `pricing_set` decide cómo
se tasa un modelo (`auto`, `linked` a un ID de OpenRouter o tarifas `custom` con
niveles opcionales) y `pricing_channel_set` establece un multiplicador de canal; ambos son de riesgo
`high` y están vinculados a la revisión de la lista actual de precios o de canales, de modo que una
edición realizada en la consola entre la preparación y la aprobación devuelve `resource_conflict`.
`pricing_delete` y `pricing_channel_delete` son destructivos. Ninguno retasa una solicitud ya registrada (ADR 0030).

Un rechazo que el invocador puede corregir explica qué cambiar. `operations.invalidParameters`
mantiene el código estable `invalid_parameters` e implementa `capability.DetailedError`,
y el ejecutor devuelve un rechazo detallado generado por `Prepare` como un resultado de `error`
con ese `detail` en lugar de un fallo genérico — en ambos adaptadores, antes de que exista cualquier
operación pendiente o aprobación. Precios lo usa para cada tarifa, nivel, zona, modo e ID de OpenRouter
rechazado; reutilícelo en lugar de devolver un código simple desde una nueva capacidad cuyos argumentos
un agente podría equivocarse razonablemente.

### Consultar al operador

`ask_question` es la única capacidad que pertenece a la conversación y no a Shell-PAMC:
`internal/agent` la registra, exclusivamente para el Agente integrado. El modelo realiza de 1 a 4 preguntas en una
sola llamada, cada una con 0 o de 2 a 6 opciones etiquetadas (selección simple o múltiple), y el operador siempre puede
escribir una respuesta en su lugar. Es una lectura (`read`) con `HumanInput: "answer"`: el ejecutor la almacena como una
operación pendiente que expira después de 24 horas, la consola la dibuja en lugar del compositor y la respuesta
del operador se valida contra las preguntas antes de reclamar la operación, por lo que una respuesta malformada
la deja abierta. El modelo recibe cada pregunta con las etiquetas elegidas y el texto escrito; Omitir es un
resultado `rejected`. No es una vía para solicitar aprobación (las escrituras ya la solicitan) ni para solicitar secretos.

### Herramientas de visualización

`render_ui` es la forma en que el Agente da forma a una respuesta y muestra datos en lugar
de relatarlos (ADR 0042, 0072, 0073, 0082).
`internal/agent` es su propietario y se ofrece únicamente cuando el cliente declara que puede dibujarlo
— la consola sí puede, el puente MCP no. No es una capacidad: no modifica nada,
nunca pasa por el ejecutor y nunca interrumpe una ejecución. `render_chart`, `render_table`,
`render_view` y `render_canvas` han sido retirados; una llamada a cualquiera de ellos se rechaza, y un registro
almacenado que nombre uno se sigue interpretando como una llamada de visualización.

El entorno de ejecución complementa los resultados exitosos de capacidades en **mensajes privados del modelo** con hasta
ocho entradas `data_sources` (`internal/agent/data_sources.go`, ADR 0078). Cada una nombra un `data_ref`
estable delimitado a la conversación, el `call_id` de la llamada a la herramienta, la ruta relativa a los datos del resultado,
hasta doce campos escalares seleccionables y el conteo de filas. No contiene valores de fila y no altera el
resultado del ejecutor de capacidades, el DTO de la consola, el recibo transmitido o el contrato de MCP. Las rutas de objetos
se inspeccionan determinísticamente con profundidad y conteo de nodos acotados; los conjuntos de datos sobredimensionados
o malformados no se anuncian.

Un Canvas copia `source {data_ref}` de esos metadatos y coloca `fields` junto a `source`.
El servidor resuelve la referencia contra un registro exitoso retenido de la capacidad, proyecta y
comprueba los campos, congela el conjunto de datos y devuelve un recibo (`rendered`, `rows`, `fields`)
en lugar de las filas. La forma heredada `source {call_id, path}` sigue aceptándose: `call_id` es un ID de
traza de llamada a herramienta, no `operation_id`; las rutas comienzan dentro de los datos del resultado (`data.groups` para `usage_aggregate`,
`rows` para SQL). Formas de referencia en conflicto, identificadores faltantes o externos, resultados de visualización y
resultados no exitosos de capacidades son rechazados. Una vista está acotada a 1000 filas y 96 KiB.

Los rechazos indican el campo, tipo requerido o forma de referencia válida sin citar el HTML enviado
ni los valores de las filas. Los fallos de Canvas reciben metadatos de origen disponibles en retroalimentación privada al modelo;
fallos consecutivos reciben además una instrucción de reparación. Esto es orientación, no un límite fijo de llamadas
ni una ejecución automática de argumentos corregidos. Un recibo certifica la validación y el almacenamiento;
no certifica el renderizado en el navegador. Los diagramas personalizados aún pueden usar un Canvas sin un conjunto de datos.

Los turnos completados y asentados — exitosos, fallidos o detenidos — ingresan a solicitudes posteriores como preguntas,
imágenes, conclusiones y metadatos acotados de conjuntos de datos/mutaciones en lugar de su transcripción completa de herramientas,
de modo que una escritura ejecutada antes de finalizar una ejecución sigue siendo visible para la siguiente pregunta. Se conservan hasta ocho referencias,
priorizando conjuntos de datos utilizados por un Canvas exitoso; se retienen hasta ocho resultados recientes de mutación/rechazo
y se comunica cualquier omisión. Los mensajes almacenados, las trazas y las vistas congeladas permanecen intactos,
por lo que las referencias retenidas funcionan entre seguimientos y recargas. Los detalles que no sean de visualización se vuelven
a leer mediante una capacidad dedicada; no se añade ninguna superficie de recuperación de resultados sin procesar.

Los paneles `render_view` almacenados siguen siendo legibles mediante el renderizador de bloques de la consola (ADR 0079),
y las vistas `render_canvas` almacenadas siguen siendo legibles mediante el renderizador en sandbox. Las nuevas llamadas usan
`render_ui` para HTML, SVG y scripts creados por el modelo (como máximo 48 KiB por carga útil, sin límite
en la cantidad de visualizaciones). El servidor almacena el marcado tal como fue escrito y nunca lo sanitiza; la consola solo
lo muestra en un marco con `sandbox="allow-scripts"` cuyo documento prohíbe cualquier carga de red, y
la política `frame-src` de la consola impide que el marco navegue fuera (ADR 0072). La descripción del parámetro `html`
establece la geometría del marco como un contrato de diseño, porque un modelo al que no se le indica el tamaño del marco
diseña para una página: unos 720px de ancho en escritorio y 320px en móvil, con altura adaptada al contenido (acotada a 16384px).
El componente en línea predeterminado no proporciona relleno, fondo de tarjeta ni título visible; un `frame: card` explícito
los proporciona. Utilice la altura natural del documento, no unidades de viewport, una altura de página fija o un contenedor de página
con desplazamiento vertical; anchos fluidos que pasen a una columna por debajo de 560px, ninguna tarjeta dentro de otra tarjeta,
tablas anchas en un bloque con desplazamiento horizontal y cualquier elemento con partes y conexiones dibujado con
`OMC.diagram` en lugar de una cuadrícula de cajas. La descripción también indica las clases de componentes del marco,
a partir de las cuales el modelo compone antes de escribir CSS propio (ADR 0085): `omc-stack`, `omc-row`, `omc-grid`,
`omc-card`, `omc-stat`, `omc-badge`, `omc-callout`, `omc-kv`, `omc-field` y `omc-tabs` (conectadas mediante `data-omc-tabs`,
`data-tab` y `data-panel`). Los estilos base del marco mantienen los medios y el texto preformateado dentro de su ancho. Mientras
los argumentos de la llamada siguen llegando, la consola dibuja el marcado escrito hasta el momento en una vista previa sin scripts
del mismo marco, de modo que el componente se completa a medida que se escribe. Los scripts del modelo se activan solo después de que
el componente completado reemplaza su vista previa. La política de borrador concede un nonce nuevo únicamente al bootstrap del host,
por lo que los controladores de eventos en línea y las URLs de JavaScript no pueden ejecutar código del modelo durante el streaming.
Los controles locales operan sobre filas congeladas; las solicitudes de nuevos datos o escrituras pasan por `OMC.compose` y el flujo
ordinario de capacidades y aprobaciones. Dentro del marco la consola proporciona un kit (ADR 0073), de modo que un gráfico o una
tabla es una llamada en lugar de marcas dibujadas a mano:

| Llamada | Dibuja |
| --- | --- |
| `OMC.rows` | Las filas congeladas de `source`, como objetos indexados por campo (`window.OMC_DATA` es el mismo arreglo) |
| `OMC.fmt(value, unit)` | Un número tal como lo formatea la consola: `tokens`, `usd`, `ms`, `percent` (una porción 0-1), `bytes`, `time` (ms de época), `number` |
| `OMC.chart(target, {type, x, y, series, stacked, unit, rows})` | `line`, `area`, `column`, `bar` o `pie`; `y` uno o varios campos, `series` un campo para dividir. Dibujado al ancho del marco, de modo que el texto de los ejes mantiene su tamaño en móviles |
| `OMC.table(target, {columns: [{field, label, unit}], rows})` | Una tabla ordenable con celdas formateadas |
| `OMC.compose(message)` | Ofrece un mensaje de seguimiento en el compositor para revisión del operador; no envía, no lee datos en vivo ni ejecuta escrituras |
| `OMC.diagram(target, {nodes: [{id, label, note, detail, tone, icon}], edges: [{from, to, label}], direction})` | Una arquitectura, flujo o topología: nodos distribuidos por distancia desde un origen y unidos por flechas, uno al lado del otro en marcos anchos y como árbol sangrado en marcos estrechos; seleccionar un nodo muestra su detalle y conexiones |

`rows` usa por defecto `OMC.rows`. El kit sigue el estilo de unidad de tokens del operador, el idioma y la
zona horaria del despliegue, y toma colores de las variables del tema.

Un turno puede ser condicionado a una presentación mediante un comando del compositor, enviado como `forwardedProps.present`:
`ui` (`/ui`) ofrece al turno `render_ui`; `text` (`/text`) no ofrece ninguna visualización. Ambos conservan
`suggest_next` cuando está declarado. El valor de transmisión `canvas` sigue aceptándose por compatibilidad y
tiene la misma selección de herramientas que `ui`.

Las visualizaciones son artefactos selectivos de la respuesta, no informes de progreso, y el modelo dibuja una sin que se le pida
siempre que la respuesta tenga una forma geométrica o estructural: el prompt del sistema enumera las formas — una tendencia o una
comparación de tres o más elementos es un gráfico (con una tabla cuando importan las cifras exactas), el estado de varios recursos
son tarjetas de estadísticas, una arquitectura, flujo o dependencia es `OMC.diagram`, un escenario hipotético son controles ajustables —
y reserva el texto para un hecho aislado, una lista corta o un error. Enuncia la conclusión junto a la figura y no repite los números
de la figura en una tabla Markdown. El modelo investiga y verifica antes de preparar una, usa `render_ui` cuando la estructura o la
interacción es más clara que oraciones (filtros, formularios, calculadoras, estados, exploradores de flujo de trabajo, gráficos, tablas
o diagramas), utiliza el conjunto complementario más pequeño y deja la exploración en la traza. La consola dibuja una vista congelada
en el lugar donde el modelo realizó la llamada, entre el texto escrito antes de ella y el texto posterior (ADR 0082), de modo que el
modelo ubica una figura donde el lector la necesita y puede dibujar más de una. `render_ui` toma un `frame` opcional: `none` (el
predeterminado para nuevas llamadas) coloca la interfaz directamente en la conversación sin borde, fondo ni barra de título; `card`
explícito es una figura con título y borde. El servidor almacena el nuevo valor predeterminado como `none`, mientras que card sigue
almacenándose como ausencia, de modo que las conversaciones anteriores conservan su encuadre original (ADR 0087). Una llamada fallida
permanece como fila de llamada con su código y detalle.

`suggest_next` acompaña la misma declaración y no es una llamada de visualización. El modelo la invoca en la
respuesta que porta su conclusión final, con una a tres preguntas de seguimiento (80 caracteres cada una);
el tiempo de ejecución la extrae de las llamadas de la ronda antes de que cualquier otra cosa las lea, por lo que no genera
traza, recibo ni una ronda adicional del modelo, y las preguntas se almacenan en el turno como
`suggestions`. Una llamada malformada, o realizada junto a otras llamadas — antes de que exista la respuesta —, se
descarta sin generar rechazo. La consola ofrece las sugerencias del turno más reciente debajo de su respuesta.

Lo que esto significa para una nueva capacidad: un resultado que contenga sus filas como un arreglo de objetos con
campos escalares — o, como `database_query`, como arreglos posicionales junto a una lista de `columns` — puede ser
graficado y tabulado sin trabajo adicional. Un resultado estructurado solo para prosa — filas comprimidas en
cadenas, cifras anidadas dentro de objetos — no puede.

### Consultas a bases de datos de solo lectura

`database_schema` lista lo que `database_query` puede leer, y `database_query` ejecuta una consulta SQLite
`SELECT` contra la propia base de datos de Shell-PAMC (ADR 0036). Ambas se ofrecen únicamente al Agente integrado
(`Adapters: ["agent"]`); los clientes MCP no las ven. La política reside en
`internal/repository/readonly_query.go`, no en la capacidad:

- una conexión de solo lectura separada (`mode=ro`, `query_only`, sin bases de datos adjuntas, tamaños de valor acotados);
- exactamente una instrucción `SELECT` o `WITH`;
- el programa compilado se lee antes de ejecutarse: cada tabla o índice abierto debe pertenecer a una tabla
  en `QUERY_READABLE_TABLES`, ninguna columna en la lista de redacción de esa tabla puede ser leída, ningún índice
  que cubra una columna redactada puede ser abierto, y las escrituras en tablas almacenadas, tablas virtuales (como
  `json_each` y `pragma_*`) y bases de datos distintas de `main` son rechazadas; los árboles b temporales de SQLite
  (`ORDER BY ... LIMIT`, `UNION`, `DISTINCT`, CTEs recursivas) siguen utilizables;
- un máximo de 200 filas, 24 KiB, 500 caracteres por celda y 5 segundos; textos con forma de credencial, información
  de usuario en URLs y direcciones de correo electrónico se enmascaran en celdas y mensajes de error. El enmascaramiento es de
  mejor esfuerzo (un valor transformado en SQL pasa sin enmascarar), por lo que una columna que contenga secretos se redacta, no se confía al enmascaramiento.

Un rechazo o error de SQL es un resultado de `error` cuyo `detail` indica qué modificar. Cada tabla
debe estar clasificada: legible en `QUERY_READABLE_TABLES` u oculta en `QUERY_HIDDEN_TABLES` con un
motivo, y `TestEveryTableIsClassifiedForOperatorQueries` falla hasta que una nueva tabla sea clasificada. Una migración
que añada una columna capaz de portar un secreto a una tabla legible la añade a la lista redactada de esa tabla en el mismo cambio.

La consola dibuja una consulta como una fila normal de llamada a capacidad, sin vista previa del resultado sin procesar. Las
lecturas de sesión del Agente, las instantáneas finales y los recibos de consulta transmitidos omiten los datos sin procesar de la consulta;
el DTO de sesión también omite el historial privado del modelo y las llamadas en cola del modelo. Esto aplica tanto a sesiones
restauradas como a nuevas ejecuciones. El estado de la consulta, los diagnósticos, los argumentos SQL y los tiempos siguen siendo
inspeccionables. El resultado completo permanece en la conversación del lado del servidor para rondas posteriores del modelo y llamadas
explícitas a `render_ui`. Este es un límite de vista previa del navegador, no una restricción de datos de upstream: el modelo
seleccionado sigue recibiendo las filas de la consulta y puede citarlas en su respuesta o elegirlas para una visualización final.

### Secretos y OAuth

- Los secretos nunca ingresan en los argumentos de las herramientas. Una capacidad que necesite uno declara
  `HumanInput: "secret"`: el agente prepara los parámetros no secretos y el formulario privado de la consola
  envía el valor directamente al servidor mientras se aprueba la operación.
- Los flujos de OAuth usan `HumanInput: "oauth"`. El servidor de la capacidad inicia el flujo, conserva
  la URL de autorización, el estado y el código del dispositivo en el servidor, y los expone únicamente al navegador
  con sesión iniciada. El modelo ve el ID de la operación y su estado.
- Los resultados de las herramientas no deben contener credenciales, tokens, cuerpos sin procesar de errores de upstream,
  direcciones de correo electrónico ni rutas del sistema de archivos. Reutilice las proyecciones de `safety` de
  `internal/operations` en lugar de inventar una nueva estructura.

## Lo que no está expuesto

Las capacidades son de inclusión explícita (opt-in). Las siguientes operaciones deliberadamente no son accesibles para un agente,
y una nueva capacidad no debe agregarlas:

- política en tiempo de ejecución del proveedor y ediciones avanzadas de modelos a través de la fachada de edición completa
  de proveedores de la consola, que también maneja material de credenciales. Se requiere una operación compartida dedicada
  libre de secretos antes de que esas ediciones se conviertan en herramientas del Agente;
- contenido de archivos de registro de solicitudes y registro de errores: citan cuerpos de solicitudes, por lo que el visor
  de la página de Registros sigue siendo de solo lectura en la consola;
- lecturas de credenciales sin procesar, descargas de archivos de autenticación o revelación de claves; la importación de cuentas de
  servicio de Vertex sigue siendo una transferencia de archivos exclusiva de la consola, no material de clave en crudo suministrado
  a través de argumentos o vistas previas de capacidades visibles para el modelo;
- proxy arbitrario a URLs, CPA o HTTP; SQL más allá de la superficie de consulta de solo lectura descrita (sin escrituras,
  sin tablas ocultas, sin columnas redactadas); sistema de archivos; shell; o mantenimiento del host;
- aplicar una actualización a Shell-PAMC o CLIProxyAPI. Reemplazar un contenedor es mantenimiento del host:
  sigue siendo una acción de consola con su propia confirmación (ADR 0099), y la capacidad de información del sistema
  únicamente informa que existe una versión más reciente;
- instalación, ejecución o configuración de plugins, incluidos los ajustes del sistema de plugins;
- escrituras directas de YAML de configuración — solo la lista de permitidos escalar nombrada
  (`request_retry`, `max_retry_interval`, `max_retry_credentials`, `routing_strategy`, `force_model_prefix`),
  cada una escrita como un conjunto de cambios de una sola ruta en la API de configuración v8. Al igual que cualquier
  guardado de configuración, cada uno conserva primero un respaldo del archivo almacenado, y el primero en un archivo previo a v8
  hace que CPA lo convierta (ADR 0051);
- restauración, eliminación y retención de respaldos de configuración: una restauración es una escritura de todo el documento,
  y las otras dos descartan las copias de las que depende una restauración (ADR 0051);
- los campos de credenciales que pueden transportar secretos: `oauth_set_credential_fields` acepta `prefix`, `priority`,
  `weight`, `note`, `excluded_models`, `expired`, `disable_cooling`, `websockets`, `using_api`, `request_retry`,
  `request_scoped_errors` y `model_aliases`, además de `openapi`, `openapi_location` y `openapi_models` de una cuenta
  de servicio de Vertex (rechazados en vista previa para cualquier otra credencial), mientras que `headers` y `proxy_url`
  permanecen exclusivos de la consola porque cualquiera de ellos puede portar credenciales a una vista previa;
- aprobación, envío de secretos o finalización de OAuth para una operación que preparó un agente externo;
- qué entradas muestra la barra de navegación de esta consola: es un estado de consola almacenado en el documento de preferencias
  y no una capacidad de despliegue, ninguna capacidad lo lee o escribe, y las páginas que oculta siguen siendo accesibles por URL.

Una capacidad que no pueda implementarse de manera segura debe omitirse aquí y registrarse en el pull request
con el motivo correspondiente, en lugar de añadirse con una comprobación más débil.

## Agregar una característica compatible con el agente

Cuando una nueva característica de Shell-PAMC sea adecuada para un agente:

1. Coloque la operación de negocio en `internal/operations` (o extraiga el cuerpo del controlador existente hacia allí)
   para que la consola y el registro compartan una sola implementación — incluyendo la barrera de escritura, comprobaciones
   de revisión y verificación de relectura.
2. Registre la capacidad con su permiso, riesgo, adaptadores, `Invalidates` y vista previa de confirmación. No agregue código
   específico de la característica a `internal/agent` ni a `internal/mcpbridge`.
3. Añada pruebas para la declaración (esquema y permisos), la ruta de permisos o confirmación, y la operación en sí,
   incluyendo un camino de fallo.
4. Asigne sus textos en el directorio de capacidades de la consola: `agent.capability.<name>` (un título corto)
   y `agent.capability.<name>.description` (qué hace la llamada, para el operador) en `web/src/i18n/index.tsx`
   y cada catálogo bajo `web/src/i18n/locales/`. La `Description` del registro permanece en inglés y está escrita para el modelo;
   la consola la muestra únicamente en una fila expandida. `scripts/capability-copy.test.mjs` falla cuando una capacidad registrada
   no tiene textos o si un texto nombra una capacidad inexistente, leyendo el registro desde el conjunto de datos regenerado de demostración.
5. Si la capacidad deliberadamente no se expone, indíquelo en el pull request.

## Agentes externos (MCP)

El registro se sirve a los clientes MCP de dos maneras, a partir de una única definición de herramienta
(`mcpbridge.NewServer`), por lo que ambas no pueden diferir en herramientas, esquemas ni comportamiento:

**Remoto, por URL.** La consola sirve Streamable HTTP en `<console URL>/api/mcp`:

```bash
claude mcp add --transport http shell-pamc https://shell-pamc.example.com/shell-pamc/api/mcp \
  --header "Authorization: Bearer $SHELLPAMC_CPA_MANAGEMENT_KEY"
```

El endpoint acepta la clave de administración únicamente como token portador (bearer) — una cookie de sesión
de la consola es rechazada — y contabiliza las claves incorrectas contra la limitación de intentos de login. No tiene estado
y responde en JSON simple, por lo que funciona detrás de cualquier proxy inverso que reenvíe la ruta base, y es
rechazado en modo demo. La acción **Conectar** de la página del Agente abre un panel con la dirección propia del
despliegue con configuración para Claude Code, Codex y clientes configurados por JSON.

**Local, sobre stdio.** Para clientes que solo hablan stdio, el binario actúa como puente hacia los endpoints HTTP de capacidades:

```bash
SHELLPAMC_SERVER_URL=https://shell-pamc.example.com/shell-pamc \
SHELLPAMC_CPA_MANAGEMENT_KEY=<su clave de administración de CPA> \
shell-pamc mcp
```

El subcomando se ejecuta antes de la inicialización de la configuración, la base de datos y el cliente de CPA, por lo que
el proceso puente no abre ningún directorio de datos ni posee credenciales de CPA propias. Las URLs que no sean de loopback
deben ser HTTPS, las redirecciones son rechazadas y las respuestas están acotadas. Un rechazo de Shell-PAMC llega al
agente como código propio de Shell-PAMC (`authentication_required`, `capability_unavailable`, ...); cualquier otro cuerpo
de error se reemplaza por `omc_request_refused`.

### Lo que ve un cliente MCP

- Una herramienta por capacidad declarada con el adaptador `mcp`, con su esquema de entrada, el envoltorio del resultado como
  esquema de salida y anotaciones derivadas de la declaración: `readOnlyHint` para `read`, `destructiveHint` para `destructive`,
  `openWorldHint: false`. `ask_question` (un cliente MCP tiene su propia forma de preguntar a su usuario) y las consultas a base
  de datos de solo lectura se ofrecen exclusivamente al Agente integrado.
- Instrucciones del servidor (`mcpbridge.SERVER_INSTRUCTIONS`) que explican los estados de resultado y el flujo de aprobación,
  y la versión de compilación de Shell-PAMC como versión del servidor.
- `omc_operation_status` (`operation_id`, `wait_seconds` opcional hasta 30): el estado de una operación preparada.
  Con `wait_seconds` vuelve a leer hasta que el operador decida o termine la espera, evitando que un agente sondee en un bucle.
  El nombre está reservado en el registro.

### Aprobar lo que preparó un agente externo

Una llamada de alto riesgo devuelve `status: "pending"`, el `operation_id` y un segundo texto
`Operator approval: <console URL>/authorize/<id>`. El enlace únicamente nombra la operación.
Abre la pantalla de autorización (`web/src/pages/agent/AuthorizePage.tsx`), una pantalla de consentimiento
fuera del shell de la consola y tras su barrera de inicio de sesión: quién solicita, en qué despliegue,
la capacidad y su permiso, el cambio preparado, y Denegar y Permitir, con las mismas transferencias privadas
de secretos y OAuth, y envía la decisión única de permitir o denegar al mismo endpoint (ADR 0035). El endpoint de decisión
requiere un origen de navegador y rechaza cualquier solicitud que porte un encabezado `Authorization`, por lo que la clave
que preparó una operación nunca puede aprobarla.

Dado que la clave de administración equivale a privilegios de administrador, un proceso externo que la posea
también puede iniciar sesión en la consola. Utilice MCP únicamente con agentes y hosts en los que confiaría
para la consola misma, sirva la consola sobre HTTPS antes de conectar uno remotamente y rote la clave si esa confianza cambia.

Pruebas: `internal/mcpbridge/bridge_test.go` (ciclo completo stdio, rechazos de transporte, enlace de aprobación, espera de estado,
códigos de rechazo), `internal/api/agent_mcp_test.go` (el endpoint de extremo a extremo: credenciales, catálogo, lectura, preparación, estado)
y el escenario de navegador `agent-external` (pantalla de autorización y guía).

### Membresía de proveedores en precios

`pricing_list` incluye `providers` para los modelos en su página actual acotada. Cada membresía porta el ID de proveedor configurado,
familia, nombre de instantánea, canal, prioridad, marcador OAuth, una sugerencia de endpoint que indica solo el hostname e identidades
exactas de modelos. Esta lectura utiliza el catálogo completo almacenado de CPA y nunca recupera secretos de credenciales. La presentación
específica por proveedor no crea precios separados: `pricing_set` sigue editando la identidad global del modelo, con su política existente
de revisiones y confirmaciones.

`pricing_list` también devuelve `candidates`, indexados por modelo, para los precios personalizados y vinculados en su página para los
cuales OpenRouter ahora ofrece un precio y el operador aún no ha respondido: `kind` `automatic` (el modo automático lo emparejaría)
o `suggested` (una semejanza), con el modelo de OpenRouter y sus tarifas; una búsqueda fallida lo deja vacío en lugar de fallar la lista.
Un agente actúa sobre uno a través de `pricing_set` (modo `auto`, o `linked` al ID del candidato), lo cual registra la respuesta como
un guardado de consola; ignorar un candidato queda en manos de la consola, porque solo silencia un aviso y no cambia ningún precio.

### Precios que un agente puede gestionar de extremo a extremo

Cinco lecturas rodean las escrituras de precios para que un agente pueda calcular un precio, verificarlo y solo entonces
solicitar aprobación. Todas son lecturas de bajo riesgo en ambos adaptadores, limitadas a 20 filas por página, y ninguna devuelve secretos.

- `pricing_overview` (`offset`): `sync` (`is_known`, `is_running`, `has_failed`, último éxito, próxima ejecución, intervalo,
  `upstream_models`), conteos de `coverage` por modo y los modelos `unpriced` con mayor concurrencia primero con tráfico a 30 días
  y hasta dos sugerencias de OpenRouter. El texto de fallo de sincronización almacenado se retiene porque puede citar una respuesta de
  upstream; `has_failed` indica que existe.
- `pricing_get` (`model`): `price` (ausente cuando no tiene precio), `automatic` (lo que emparejaría el modo automático),
  `suggestions`, `candidate`, `channels` que sirven el modelo, `usage_30d` y `profile_7d` (tamaño mediano de solicitud y el prompt más grande).
  Los campos informativos se omiten cuando su búsqueda falla.
- `pricing_catalog_search` (`query`, `offset`): la instantánea de OpenRouter almacenada que coincide en ID, nombre y slug canónico,
  IDs exactos primero, con tarifas y niveles.
- `pricing_quote`: una solicitud hipotética (`input_tokens`, tokens opcionales de salida y caché, `timestamp_ms`, `channel`, `service_tier`)
  tasada contra el precio almacenado de `model` o un objeto `proposed` estructurado como la entrada de `pricing_set`. Devuelve el `price`
  resuelto, el `breakdown` con el `tier_index` determinante y el `cost_usd`. Nada se escribe.
- `requests_cost_breakdown` (`id`): el estado de fijación de precio de una solicitud registrada, nanosegundos almacenados, versiones
  fijadas de precio y canal, nivel, el `service_tier` facturado con su `service_tier_source` (`outbound`, `response` o `request`) y
  tarifas por tramo; `resource_missing` para un ID desconocido. Los nuevos costos de Codex prefieren evidencia final no vacía de
  `effective_service_tier` de salida; sin ella, aplica el solucionador de solicitud del cliente existente. Un `auto` saliente explícito
  no selecciona precio de nivel de servicio. Otros proveedores mantienen la precedencia de la respuesta. El nivel/origen seleccionado
  se fija con el importe, y las explicaciones históricas conservan su política original.

El `utc_start`/`utc_end` de un nivel horario son HHMM según el reloj indicado por `time_zone`, UTC si se omite (ADR 0063).
Un agente al que se le proporcione la página de precios de un proveedor ingresa las horas publicadas con la zona horaria del proveedor;
convertirlas a UTC es incorrecto para cualquier zona con horario de verano y nunca es necesario. `pricing_set` resuelve un enlace o
una coincidencia automática durante la preparación, por lo que un modelo fuera del catálogo de CPA, un ID de OpenRouter desconocido o
un selector automático sin coincidencias llega como `invalid_parameters` con un detalle en lugar de como una aprobación fallida. Pruebas
en `internal/operations/pricing_test.go` cubren ambos adaptadores, los rechazos, la ejecución simulada y el esquema del desglose.

### Filtros de uso y solicitudes

`usage_aggregate`, `usage_compare` y `requests_list` comparten una misma entrada, por lo que una pregunta acotada para una lista
se delimita de la misma manera para un total. Más allá de las dimensiones exactas (`providers`, `models`, `call_points`, `client_keys`,
`credentials`, `status`) toma `search` (una subcadena literal, como máximo 256 caracteres), `min_latency_ms` y un patrón:
`regex_field` (uno entre `model`, `model_alias`, `response_model`, `provider`, `endpoint`, `ua`, `request_id`) con `regex`, un patrón
RE2 de hasta 256 caracteres. Un patrón sin un campo conocido, o uno que RE2 rechaza, falla con `invalid_regex: <reason>` para que el
modelo pueda corregir la llamada; otras entradas malformadas devuelven `invalid_parameters`. Las tres son lecturas de bajo riesgo
sin transferencia de secretos ni OAuth.

Un elemento de solicitud contiene `request_id`, `ttft_ms`, `user_agent` (la etiqueta del producto ya redactada en la ingesta) y, solo
cuando el upstream sirvió un modelo diferente, `served_model`, junto con proveedor, modelo, punto de llamada, tokens, latencia y costo.
Registros sin procesar, direcciones de clientes, máscaras de claves y nombres de credenciales quedan fuera. Las descripciones de los
campos se mantienen breves a propósito: la entrada se repite en tres herramientas y el catálogo tiene un presupuesto de tamaño
(`TestAgentCatalogueFitsTheSchemaBudget`). Las pruebas cubren el mapeo de filtros y cada rechazo (`internal/operations/validation_test.go`),
la coincidencia en sí (`internal/repository/usage_filter_test.go`) y el parámetro HTTP (`internal/api/usage_events_test.go`).

### Capacidades de zona horaria

`timezone_get` es una lectura de bajo riesgo que devuelve la anulación manual opcional, la zona horaria del despliegue y la zona horaria IANA efectiva.
`timezone_set` es una escritura de bajo riesgo que acepta `{ "timezone": "Asia/Kuala_Lumpur" }`; una cadena vacía restaura la zona horaria del despliegue.
Ambas están disponibles para administradores de Agente y MCP bajo la política de capacidades existente. La escritura comparte la validación del
repositorio de preferencias y la regla de confirmar antes de publicar, devuelve `invalid_timezone` para un nombre inválido e invalida a los lectores
de `preferences` y `timezone`. No interviene ninguna transferencia de secretos u OAuth. Las pruebas cubren escrituras validadas, lecturas a través de
ambos adaptadores y rechazos sin alterar el calendario en tiempo de ejecución.

### Capacidades de cálculo de TPS

`tps_calculation_get` es una lectura de bajo riesgo que devuelve `{ "mode": "exclude_ttft" }` o `{ "mode": "include_ttft" }`. Las preferencias
almacenadas ausentes o no admitidas resuelven a `exclude_ttft`. `tps_calculation_set` es una escritura de bajo riesgo que acepta la misma estructura
de modo, rechaza valores de modo no admitidos o ausentes con `invalid_parameters` y devuelve el modo guardado. Ambas están disponibles para
administradores de Agente y MCP bajo la política existente. La escritura comparte la preferencia `omc_tps_calculation_mode` de la consola e invalida
`preferences`; no interviene ninguna transferencia de secretos u OAuth. Modifica las lecturas de TPS en los registros de solicitudes, no los tiempos
originales ni el uso registrado. La exclusión resta la latencia medible del primer token y, de lo contrario, usa la latencia total, como también hace
para los registros que informan tokens de razonamiento (el razonamiento oculto precede al primer token, por lo que la ventana residual nunca lo contuvo);
la inclusión siempre utiliza la latencia total. Las pruebas cubren ambos adaptadores, lecturas/escrituras de preferencias compartidas, valores por defecto,
valores inválidos y rechazos de administrador.

### Capacidades de actualización automática de cuotas

`quota_auto_refresh_get` es una lectura de bajo riesgo que devuelve `{ "interval_minutes": 360, "refresh_on_reset": true }` de forma predeterminada;
un campo almacenado ausente o ilegible resuelve a su valor por defecto. `quota_auto_refresh_set` es una escritura de bajo riesgo que requiere ambos campos,
acepta `interval_minutes` de 0 (programación desactivada) o de 5 a 1440, devuelve `invalid_parameters` en caso contrario y devuelve la política guardada.
Ambas están disponibles para administradores de Agente y MCP. La escritura comparte la preferencia `omc_quota_auto_refresh` de la consola, que el bucle
de fondo del servidor lee cada minuto (ADR 0094), e invalida `preferences`; no interviene ninguna transferencia de secretos u OAuth. Las pruebas cubren
ambos adaptadores, valores por defecto, valores inválidos y rechazos de administrador.

### Recuperación de conexión del navegador

La ejecución administrada del Agente pertenece al servidor, no a un socket. La recarga de la consola o la recuperación de red reproduce su diario
proyectado y no vuelve a invocar capacidades. Detener invoca el endpoint autenticado de cancelación de ejecuciones; un suscriptor desconectado no
indica la intención del operador. Las aprobaciones pendientes, los secretos y OAuth continúan mediante sus transferencias existentes del lado del
servidor y nunca se deciden automáticamente durante la recuperación. El reinicio del proceso no reanuda escrituras externas inciertas.
Consulte [ADR 0044](adr/0044-browser-connections-subscribe-to-server-owned-runs.md).

### Biblioteca de iconos personalizados

`custom_icons_list` es una lectura de bajo riesgo para Agente/MCP, que acepta un `offset` opcional y devuelve como máximo veinte registros de metadatos
de iconos más `has_more`. Incluye nombres, IDs estables, revisiones y conteos de referencias almacenadas, nunca los bytes de la imagen.
`custom_icon_create` acepta `{name,data}` y `custom_icon_update` acepta `{id,name?,data?}` como escrituras de presentación de bajo riesgo.
Ambas reutilizan la validación de importación del navegador y devuelven solo metadatos. El límite de entrada de 32 KiB para capacidades sigue aplicándose;
imágenes más grandes deben importarse mediante el selector del navegador en lugar de ampliar la carga útil de la herramienta.

`custom_icon_delete` acepta `{id}` y es destructivo/de alto riesgo en ambos adaptadores. Su vista previa contiene el ID/nombre del icono, la revisión
del arte, el recuento de referencias y el impacto de `provider_icons: restore_defaults`; la aprobación vuelve a comprobar la revisión del arte, elimina
todas las anulaciones coincidentes actuales y borra el recurso en una sola transacción. Cada escritura exitosa invalida `custom-icons`; la eliminación
adicionalmente invalida `preferences`. Los rechazos estables son `custom_icon_invalid_image`, `custom_icon_too_large`, `custom_icon_invalid_name`,
`custom_icon_limit`, `custom_icon_not_found`; una aprobación de eliminación obsoleta devuelve `resource_conflict`. No se devuelven imágenes en la salida
de la capacidad, vista previa o detalles de auditoría. Las pruebas verifican ambos adaptadores, permisos de administrador, rechazos, confirmación de
restablecimiento de referencias y eliminación confirmada.

## Salida de capacidad de cuota

`quota_list` y `quota_refresh` exponen los mismos resultados de ventanas seguras que la consola.
Su proyección `plan` contiene únicamente `plan_type`, `plan_label`, `tier` y el opcional `subscription_active`; false denota una suscripción inactiva
explícita, mientras que un campo ausente significa desconocido. La proyección incluye niveles de xAI/Antigravity en vivo y lecturas de planes de Meta,
no metadatos de credenciales, respuestas sin procesar ni claves emitidas. La actualización de Meta utiliza su endpoint de intercambio de claves y puede
emitir una clave en upstream; la descripción de la herramienta de actualización indica este efecto secundario y las claves devueltas se descartan (ADR 0065).
No se requiere ninguna capacidad o permiso nuevo: listar sigue siendo una lectura y refrescar sigue siendo una escritura de bajo riesgo. Las descripciones
de sus herramientas las identifican como estimaciones y no como saldos o instrucciones de enrutamiento.

El `status` de una credencial es `unpublished` cuando el proveedor respondió sin publicar una ventana. Esa es una lectura real, no un fallo ni una credencial
no leída: indica que la lectura ocurrió y el proveedor no informó nada medible, por lo que un agente no debe reintentarla asumiendo que nada fue consultado
ni reportarla como `idle` (ADR 0071).

Cada ventana admitida puede portar `usage` (rango semiabierto del ciclo actual, solicitudes, solicitudes tasadas, tokens y costo fijado), `capacity`
(tokens, estimación opcional de costo fijado y margen de redondeo), y `capacity_unavailable` (por qué no se puede estimar el ciclo actual). La base
(`basis`) de una capacidad es `current_cycle` o `previous_cycle`, y `observed_at_ms`, `from_ms` y `reset_at_ms` identifican la lectura de la que deriva.
Una referencia del ciclo anterior debe describirse como histórica, nunca como el saldo restante actual; su motivo actual de no disponible y el uso
actual registrado permanecen en el resultado. Ninguno de los dos valores es una cuota real denominada por el proveedor ni una previsión de gasto.

`model_families` identifica metadatos de alcance revisados. `has_mid_cycle_reset` es evidencia duradera de reinicio; `has_incomplete_history` preserva
una lectura fallida de evidencia para el ciclo. Ninguno de los dos flags es una estimación. La resolución desconocida de alcance/alias, el historial no
disponible y el uso no disponible devuelven `scope_unknown`, `history_unavailable` y `usage_unavailable`; estos nunca significan cero. Solo un ciclo actual
válido y reciente con `low_usage`, `no_traffic` o `no_reading` puede portar una referencia del ciclo anterior. Historial faltante, alcances/períodos modificados
y ciclos con reinicio anticipado no producen una. Los costos usan precios al momento de la solicitud y requieren una cobertura del 95% de solicitudes tasadas;
los porcentajes de error describen únicamente el redondeo y no deben presentarse como confianza estadística. Consulte ADR 0059.

### Directorio de modelos disponibles

`models_list` es una lectura de bajo riesgo expuesta al Agente y MCP. No toma parámetros, requiere el permiso de lectura existente y no realiza inferencias
ni mutaciones. Su resultado seguro `models`, `providers`, `routes`, `partial`, `model_info` y `metadata_updated_at` se comparte con `GET /management/model-square`.
El `/v1/models` en vivo de CPA es autoritativo; la primera clave de cliente configurada no vacía se utiliza en el servidor y nunca se revela. Sin ella,
la operación devuelve `client_key_required`.

Puntos de llamada exactos pueden conservar varios objetivos upstream. Un `upstream_model` o `provider_id` vacío denota procedencia no resuelta; el enriquecimiento
ilegible no suprime los modelos anunciados. Los datos empaquetados de models.dev se emparejan únicamente por identidad canónica exacta o un alias de origen
inequívoco. No establecen disponibilidad operativa ni una licencia de código abierto. Los nombres/iconos usan superposiciones actuales de despliegue; los
endpoints se reducen a nombres de host. Se excluyen secretos y campos de cuenta. Los resultados que superen las 2.000 rutas se rechazan con `tool_result_too_large`.

### Actualización de credenciales OAuth

`oauth_refresh_credential` es una escritura de alto riesgo que acepta `name` y `auth_index`. Solicita a CPA que renueve los tokens de esa credencial ahora
en lugar de en su actualización programada y devuelve únicamente si tuvo éxito: la respuesta de CPA porta los tokens renovados, por lo que se descarta
dentro del cliente de administración y nunca llega a una vista previa, a un resultado o al registro de auditoría. Invalida `management-auth-files` y `management-quota`.

### Exclusiones de modelos OAuth

`oauth_excluded_models_list` lee el mapa de exclusiones normalizado para todo el proveedor y su revisión. `oauth_set_excluded_models` es una escritura de
alto riesgo que acepta `provider` y `models`. Su vista previa nombra al proveedor y muestra las reglas antes/después; la ejecución requiere la confirmación
del operador y vuelve a comprobar la revisión del mapa bajo la barrera de escritura compartida de toda la configuración. Reutiliza la validación de reglas
de la fachada de la consola y la lectura verificada de CPA, luego invalida el mapa de exclusión, las listas de modelos de credenciales, Model Square y precios.
Una lista vacía elimina solo los valores predeterminados de ese proveedor, dejando intactas las anulaciones de `excluded_models` de credenciales no vacías.
Una lista de credenciales no vacía reemplaza, en lugar de extender, los valores predeterminados del proveedor; una lista faltante, vacía o nula hereda las
reglas actuales del proveedor. Esta precedencia requiere CPA v8.0.33 o posterior; actualice las pasarelas anteriores antes de confiar en anulaciones de credenciales.
El comodín `*` oculta todos los modelos únicamente en las credenciales que heredan, por lo que debe permanecer visible en la vista previa sin sugerir un
bloqueo universal. Por ejemplo, el proveedor `["*"]` con credencial `["model-b"]` no bloquea `model-a` en esa credencial a través de la regla del proveedor.
Limpiar la lista de credenciales restaura la herencia de `*`, no la disponibilidad irrestricta. CPA sigue siendo autoritativo para la disponibilidad; use
su lista de modelos por credencial para verificarla. Estas capacidades están disponibles mediante el Agente integrado y el registro MCP stdio, sin un nuevo
adaptador ni ninguna respuesta que porte secretos.

### Límite nativo de páginas de plugins

El Plugin Host confiable del navegador (ADR 0067) no es una capacidad de Agente/MCP. Expone configuración nativa con secretos únicamente a través de una
sesión autenticada de la consola; los modelos y agentes externos continúan utilizando el registro declarado de capacidades sanitizado y sus reglas de
confirmación/revisión. Ninguna ruta o URL nativa arbitraria se convierte en argumento de una herramienta.

## Capacidades de calentamiento de credenciales

`quota_warmup_settings_get` y `quota_warmup_credential_get` son proyecciones de lectura acotadas de valores predeterminados de proveedores, política efectiva,
modelo, próxima comprobación, observaciones de activación y motivo de pausa. El campo opcional `state.protocol_pause` porta evidencia delimitada de modelo/motivo
independientemente del recibo más reciente; una nueva comprobación con limitación de tasa no restaura la compatibilidad automática.
`quota_warmup_settings_set`, `quota_warmup_credential_set` y `quota_warmup_run` son escrituras de alto riesgo expuestas tanto a Agente como a MCP. Su resultado
de preparación vincula la confirmación a la revisión de la política del proveedor o de la credencial; la aprobación de valores predeterminados de proveedor
indica su impacto en credenciales heredadas actuales y futuras. Guardar una política habilitada autoriza su primer intento automático de consumo a través
de las mismas comprobaciones de facturación y ventana, sin requerir activación manual previa. La aprobación manual autoriza una solicitud de consumo mínima
opcional y la observación de activación posterior a la solicitud, no acceso a tokens ni canje de créditos de reinicio. La implementación compartida aplica
protección de facturación desconocida/paga e idempotencia consciente de la incertidumbre; los resultados inciertos nunca deben repetirse automáticamente.

### Resúmenes de credenciales SIWC

`oauth_credentials_list` incluye `siwc_bind_supported`, `use_siwc`, `siwc_bound`, `siwc_expires_at` opcional y el estado opcional
`siwc_status: off|valid|invalid` para inspección de credenciales. Soporte faltante significa no admitido; estado faltante o desconocido es desconocido.
CPA evalúa la expiración local y el rechazo recordado sin actualizar ni contactar al proveedor; esto no representa salud en vivo. La presencia de material
y la expiración almacenada no son comprobaciones de validez.

`oauth_set_credential_fields` acepta el booleano exclusivo de Codex `use_siwc` a través del parche de campos existente confirmado, auditado y con
verificación de identidad y relectura confirmada. False conserva ambas particiones; true requiere una vinculación existente y no la vincula ni la verifica.
La ausencia de material impide habilitar, pero no deshabilitar. El ciclo de vida de vinculación sigue dirigido por el operador en el detalle de la
credencial: el agente y MCP no reciben capacidades de vinculación, callback o desvinculación.

### Ajustes OpenAPI por modelo en Vertex

`providers_get` y `providers_list` proyectan los valores predeterminados de `openapi` en Vertex como `inherit|enabled|disabled`, `openapi_location`
y entradas de modelos con estados de `openapi` por modelo. La confirmación existente de `providers_create` / `providers_update` acepta esos mismos ajustes,
conservando opciones de modelo y credenciales no relacionadas. Un cambio de nombre de alias de modelo retiene sus ajustes almacenados cuando rutas
hermanas sin cambios identifican unívocamente la fila original; cambios de nombre simultáneos ambiguos son rechazados antes de escribir. Un ajuste omitido
no se modifica; un `inherit` explícito limpia una anulación; una ubicación vacía restaura la ubicación predeterminada. Los objetivos que no sean de Vertex
se rechazan antes de la confirmación y en la ejecución. Las escrituras de proveedores conservan las barreras de revisión y respaldo, y comparan la política
OpenAPI almacenada antes de reportar éxito.

`oauth_model_aliases_list` y la confirmación de `oauth_set_model_aliases` portan el booleano opcional `openapi` en los alias de Vertex. La confirmación
de `oauth_set_credential_fields` también lo acepta dentro de los `model_aliases` de Vertex. False y true son anulaciones explícitas; omitido/null hereda.
Las anulaciones de modelo/alias tienen prioridad sobre los valores predeterminados de la credencial y la detección de nombres de modelos de CPA; alias del
mismo modelo pueden diferir. Reemplazar una lista de alias debe mantener la anulación de cada fila conservada. Ninguna ejecución de enrutamiento se traslada a Shell-PAMC.
