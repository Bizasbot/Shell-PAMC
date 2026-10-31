# ADR 0041: Las ejecuciones del Agent hablan AG-UI, la consola las renderiza con assistant-ui y OMC mantiene el estado

- Estado: Aceptado
- Supersedido en parte: la página Playground, sus rutas y los ADRs 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agent se mantiene (lista de modelos `GET /agent/models`, ejecuciones `/agent/runs/...`).
- Fecha: 2026-09-29

## Contexto

El endpoint de ejecución del Agent transmitía (streamed) un vocabulario de eventos propio (`delta`, `thought`, `tool`, `state`, `error`) y la página lo representaba con `Bubble.List`, `Sender` y `ThoughtChain` de Ant Design X. Ambas mitades habían llegado a sus límites.

**El formato de transporte era privado y con pérdidas.** Una llamada a capacidad aparecía solo cuando terminaba, por lo que una lectura de capacidad lenta se interpretaba como si no pasara nada. Una ejecución que se detenía para el operador terminaba con un evento `state` cuyo significado el navegador tenía que inferir a partir del turno almacenado. Una ejecución que el servidor rechazaba antes de persistir nada respondía con un flujo idéntico al de la aceptación, y el mensaje que el operador había escrito se perdía detrás de este. Nada fuera de este repositorio podía leer el flujo.

**Los componentes de chat poseía un estado que la consola necesitaba.** `Sender` mantenía su propia copia de si un mensaje podía ser enviado, un renderizado por detrás del de la página, y rechazaba la tecla Enter dentro de esa brecha; la lista anclaba su desplazamiento (scroll) de forma inversa, lo cual cada sondeo de geometría tenía que conocer; la aprobación, las preguntas, los mensajes en cola, las citas (quoting) y las acciones de mensaje necesitaban una solución alternativa a medida (*bespoke workaround*) sobre componentes que no tenían ningún concepto de ellos.

Dos piezas establecidas cubren ahora exactamente estas partes. AG-UI (versión de protocolo 1.0) es un protocolo de eventos abierto para ejecuciones de agentes: ciclo de vida tipado, texto, eventos de razonamiento y llamadas a herramientas, instantáneas de estado (*state snapshots*) y un resultado de ejecución que es un éxito o una lista de interrupciones desde las cuales reanudar. assistant-ui es un conjunto de primitivas React sin interfaz gráfica (*headless*) para un hilo de chat —viewport, mensajes, compositor, barras de acción, UIs de herramientas, aprobaciones, cola de mensajes— con un runtime `ExternalStore` que renderiza el estado que posee una aplicación.

## Decisión

**El endpoint de ejecución habla AG-UI 1.0.** `POST /agent/run` toma un `RunAgentInput` estricto y transmite eventos AG-UI (`internal/agui`: el decodificador, el traductor y el empaquetado SSE; `internal/api` mapea los eventos del runtime sobre él).

- La solicitud transporta como máximo un mensaje de usuario, o una lista `resume` que nombra las interrupciones desde las cuales continúa, nunca ambos. El historial, el estado, los mensajes de asistente o de herramientas, las herramientas desconocidas, las entradas de contexto desconocidas y los campos desconocidos se rechazan como `invalid_parameters`: el servidor es dueño de la conversación, y un cliente que pudiera proporcionar historial podría falsificar resultados de herramientas. La clave, el modelo, el esfuerzo y la revisión que la página vio por última vez viajan como `forwardedProps`; el idioma de la consola es el de la única entrada de `context` (`console_language`). Las únicas herramientas que un cliente puede declarar son las herramientas de visualización (ADR 0042).
- `RUN_STARTED` se envía solo después de que el turno está persistido. Una ejecución rechazada antes de eso emite únicamente `RUN_ERROR`, que la consola lee como "no aceptado" y devuelve el mensaje al compositor.
- Una llamada a capacidad se anuncia (`TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`) antes de que se ejecute, y su recepción llega a continuación como `TOOL_CALL_RESULT`. Cada ronda del modelo es un paso.
- Una ejecución que se detiene para el operador termina con un resultado de tipo `interrupt` que nombra cada operación en espera (`approval`, `question`, `secret` o `oauth`) y la llamada que la provocó. La decisión en sí misma se sigue tomando en el endpoint de decisión (ADR 0035); una reanudación debe nombrar exactamente las operaciones que están esperando, y una que aún esté indecisa se rechaza como `confirmation_pending`.
- El `STATE_SNAPSHOT` final es la conversación almacenada, y el uso de tokens viaja en `RUN_FINISHED` o `RUN_ERROR`. Los eventos propios del runtime se mantienen independientes del transporte; solo el traductor conoce ambos vocabularios.

**La consola renderiza con assistant-ui sobre el estado de OMC.** `web/src/agent/` contiene la capa de ejecución libre de frameworks —el constructor de solicitudes AG-UI y el analizador de eventos, un lector SSE seguro para fragmentos, un reductor puro (*pure reducer*) que reconstruye las partes que el servidor almacena, y las exportaciones—. Las páginas utilizan `useExternalStoreRuntime`: la conversación almacenada y el fotograma (*frame*) de la ejecución en vivo se convierten en mensajes de hilo, y cada acción que el framework ofrece —enviar, detener, aprobar, responder, regenerar, editar— regresa a través de un callback hacia el propio código de OMC. assistant-ui nunca contiene la conversación, las operaciones o el destino; `web/src/pages/agent/runtime.ts` es el único módulo que conoce su API de runtime. El shell compartido (`AssistantThread`, `AssistantComposer`) también es utilizado por el Playground, el cual mantiene su protocolo con forma de OpenAI y su propio hook de ejecución.

El compositor le pide al runtime que envíe —al presionar Enter y en el botón— en lugar de usar los controles de envío propios del framework, ya que estos deciden a partir del estado que vio su último renderizado, el cual les llega con una tarea posterior a cuando la página lo cambió. Un mensaje enviado durante una ejecución se pone en cola detrás de esta (`createMessageQueue`, sin opción de cancelación, por lo que nunca interrumpe la ejecución en curso).

## Consecuencias

- El flujo es legible por cualquier cliente AG-UI, y el reductor de la consola es un pliegue puro (*pure fold*) que el conjunto de pruebas verifica evento por evento.
- Una llamada aparece en pantalla como en ejecución antes de que exista su resultado, una detención para el operador es un resultado explícito, y un mensaje rechazado nunca se pierde.
- `@ag-ui/core` se utiliza únicamente por sus tipos y su enumeración de eventos, por lo que sus validadores de runtime nunca llegan al bundle; `@assistant-ui/react` reemplaza los componentes de chat de Ant Design X (`@ant-design/x` se mantiene para el resaltado de código y `@ant-design/x-markdown` para Markdown).
- El vocabulario de eventos anterior del endpoint ha desaparecido; la consola es su único cliente y se distribuye en el mismo binario, por lo que no se mantiene ninguna capa de compatibilidad.
- El puente de MCP no se ve afectado: mapea el registro de capacidades, no el flujo de ejecución del Agent.
