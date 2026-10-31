# ADR 0088: Una conversación elige su endpoint de inferencia en el compositor

- Estado: Aceptado
- Superado en parte: la página Playground, sus rutas y los ADR 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agente se mantiene (lista de modelos `GET /agent/models`, ejecuciones `/agent/runs/...`).
- Los enlaces al ADR 0022 a continuación están rotos: dicho ADR se eliminó junto con el Playground.
- Fecha: 2026-10-09
- Extiende el ADR 0022 (eliminado) y el
  [ADR 0041](0041-agent-runs-speak-ag-ui-and-render-with-assistant-ui.md): el Playground y el
  Agente todavía se comunican con CPA únicamente a través del cliente de pasarela y rutas fijas; ahora son tres.
- Completa lo que [ADR 0076](0076-the-agent-has-its-own-shell-and-names-its-model-in-the-composer.md)
  dejó abierto: `TargetChip` ahora da servicio al Playground y se elimina `TargetPicker`.

## Contexto

CPA ofrece una clave de cliente en tres endpoints de inferencia: Chat Completions
(`/v1/chat/completions`), Responses (`/v1/responses`) y Messages (`/v1/messages`). Cada
uno corresponde a lo que utiliza una familia diferente de clientes, y CPA traduce cada uno al proveedor que
enrute el modelo. El Playground y el Agente enviaban todas las conversaciones a Chat Completions, por lo
que un operador que depuraba un cliente que utiliza Responses o Messages no podía reproducir la
ruta de ese cliente a través de CPA —la traducción que necesitaba probar nunca se ejecutaba— y un
modelo que se comporta mejor en su endpoint nativo no podía ser dirigido a través del mismo.

Por otro lado, el Playground elegía su clave y modelo mediante dos selectores en la cabecera de la página y su
esfuerzo de razonamiento en un campo de texto libre en el panel lateral, mientras que el Agente elegía los tres
mediante chips en el compositor. Dos páginas hacían la misma pregunta —con qué se envía el siguiente mensaje—
en dos lugares y dos idiomáticas diferentes.

## Decisión

**Una conversación se envía a uno de los tres endpoints de CPA, elegido por su nombre.**
Una solicitud del Playground y una ejecución del Agente llevan cada una el campo `endpoint`: `chat` (el predeterminado, y lo que significa un campo ausente),
`responses` o `messages`. Es un nombre de un conjunto cerrado, nunca una ruta o una URL; el
cliente de pasarela lo mapea a una ruta fija, por lo que se mantiene la regla en contra de destinos arbitrarios.

**La solicitud de la consola y sus eventos mantienen un único formato.** La conversación del operador se
escribe una sola vez, en el formulario de mensajes propio de la consola. `internal/cpa/gateway` la convierte en el
cuerpo del endpoint —`input` e `instructions` para Responses, `messages`, `system` y un
`max_tokens` obligatorio para Messages— y decodifica el flujo (stream) de ese endpoint de vuelta en los mismos eventos
`delta`, `thought`, `usage` y `done`. Nada aguas abajo de la pasarela sabe qué
endpoint respondió: los turnos, los diagnósticos, el tiempo, el uso y la recuperación no cambian.

**El esfuerzo de razonamiento se traduce, no se reenvía.** Chat Completions acepta
`reasoning_effort`. Responses acepta `reasoning.effort`, enviado con `summary: "auto"` porque
sin un resumen el flujo no transporta texto de razonamiento. Messages no tiene un único campo de esfuerzo:
`none` envía `thinking.type: "disabled"`, cualquier otro nivel envía `thinking.type: "adaptive"`
con `output_config.effort`. Un operador que necesite una sintaxis diferente la escribe en el
cuerpo de solicitud personalizado, el cual sigue ganando ante cualquier colisión.

**En Responses y Messages, el cuerpo de solicitud personalizado no puede reemplazar la conversación.**
Las comprobaciones de imágenes —solo URLs de datos en línea, tamaño y dimensiones acotados— se ejecutan en los mensajes
de la consola antes de ser convertidos. Para Chat Completions, el cuerpo combinado es el esquema propio de la consola
y se valida por completo, por lo que una sobreescritura de `messages` también se comprueba. Los otros dos
esquemas son los que la consola solo escribe; en lugar de modelarlos por segunda vez para
su validación, se rechaza por nombre una sobreescritura de `input` (Responses) o `messages` (Messages).
Cualquier otro campo pasa intacto.

**El bucle del Agente se ejecuta en cualquiera de los tres.** Las herramientas, llamadas y resultados de una ronda se escriben
en el esquema del endpoint —ítems `function_call` y `function_call_output` para Responses,
bloques `tool_use` y `tool_result` para Messages, cada resultado de una respuesta devuelto en un
solo mensaje de usuario— y las llamadas de cada flujo se ensamblan por completo antes de ejecutar ninguna. Los bloques de razonamiento
firmados de una respuesta de Messages se conservan en el mensaje del asistente y se envían de vuelta
antes de sus llamadas, lo cual exige dicho esquema una vez que el pensamiento está activado; los otros dos endpoints
nunca los ven. Una ronda de Messages establece un límite de 16384 tokens. El endpoint es fijo durante
un turno: una ejecución que se reanuda tras una aprobación continúa en el endpoint con el que comenzó el turno,
debido a que sus llamadas se reproducen en el esquema en el que se realizaron.

**El contenido con el que se envía un mensaje se elige en el compositor, en ambas páginas.** El pie
del compositor lleva tres chips: el endpoint que lo encabeza, luego el esfuerzo de razonamiento y el modelo junto
al botón de enviar. El chip de modelo del Playground es el `TargetChip` del Agente, con la clave de cliente al
pie de su lista; su cabecera conserva el título y las acciones de página. El chip de endpoint lleva una
marca neutral y el nombre corto del endpoint; su lista muestra el nombre completo y la ruta. El
Playground almacena el endpoint junto con la clave y el modelo en `playground_session` y en cada
instantánea de solicitud de cada turno, por lo que un reintento vuelve a utilizar el endpoint que se empleó; el Agente lo almacena en la
preferencia `agent_target` y en la conversación.

## Consecuencias

- El cliente de pasarela transporta tres formas de solicitud y tres decodificadores de flujos para cada una de las
  dos interfaces, cada uno con sus propias pruebas. Un cambio que CPA realice en el flujo de un endpoint es un cambio en un único decodificador.
- Una solicitud de Messages siempre especifica un límite de tokens: 4096 cuando el operador no estableció ninguno, debido
  a que el esquema no puede expresar "el valor predeterminado del modelo".
- El mapeo para el esfuerzo de Messages sigue el esquema actual (`adaptive` thinking con un
  esfuerzo de salida). Un modelo o compilación de CPA anterior a esto rechaza el par; el recurso
  del operador es el cuerpo de solicitud personalizado o dejar el esfuerzo en su valor predeterminado.
- El esfuerzo deja de ser texto libre. Un nivel almacenado que esté fuera de los nombrados sigue siendo seleccionable, y
  un nivel específico del proveedor se configura de otro modo a través del cuerpo de solicitud personalizado.
- El botón de restablecer (Reset) del panel ya no borra el esfuerzo de razonamiento, ya que este ya no se muestra.
- La cabecera del Playground no tiene acción de actualización; actualizar las listas de claves y modelos se encuentra en la
  lista del chip de modelo, al igual que en la página del Agente.
- En un teléfono, el compositor del Playground tiene una fila inferior donde antes no tenía ninguna, por lo que es una fila
  más alto; en un pie estrecho, lo que se acorta es el nombre del modelo.
- Una conversación del Agente almacena razonamiento firmado durante la duración del bucle de herramientas de un turno de Messages.
- Un modelo cuyo límite de salida sea inferior a 16384 tokens rechaza una ronda del Agente en Messages.
