# ADR 0076: El Agente tiene su propia shell y nombra su modelo en el compositor

- Estado: Aceptado
- Supersedido en parte: la página del Playground, sus rutas y los ADR 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agente se mantiene (`GET /agent/models` para la lista de modelos, ejecuciones en `/agent/runs/...`).
- Fecha: 2026-10-08
- Acota el espacio de trabajo compartido del [ADR 0041](0041-agent-runs-speak-ag-ui-and-render-with-assistant-ui.md):
  la transcripción, el compositor y las vistas de mensajes siguen compartidos
  con el Playground; el marco que los rodea ya no lo es.

## Contexto

El Agente fue diseñado dentro del marco construido para el Playground: una cabecera con líneas divisorias que contenía un título, un selector de clave y un selector de modelo; un panel lateral redimensionable abierto por defecto con tres pestañas; y una conversación en el espacio restante. Ese marco es adecuado para el Playground, que actúa como un banco de pruebas —sus parámetros y diagnósticos son el objetivo principal y deben estar junto a la transcripción en todo momento-.

Para el Agente, ese mismo marco transmitía el mensaje incorrecto. La página parecía un arnés alrededor de un chat en lugar de un asistente: dos selectores antes de cualquier pregunta, un listado de registros que ocupaba un tercio de la pantalla y una transcripción vacía sobre un cuadro en la parte inferior. Nada de eso es lo que busca un operador, y el directorio de capacidades —material de referencia— eclipsaba la conversación que documenta.

## Decisión

**La página del Agente es la conversación.** No tiene cabecera de página ni panel en estado de reposo. `AgentPage` define su propia shell; `WorkspaceLayout` sigue siendo la del Playground.

**Una conversación vacía se agrupa en la parte central de la página.** La marca denominativa (`wordmark`), una pregunta a modo de título, un párrafo, el compositor y cuatro preguntas iniciales se ubican juntos un poco por encima del centro. Una vez que se envía un mensaje, el compositor toma su lugar en la parte inferior de la columna de lectura, debajo de la transcripción.

**El modelo se elige allí donde se escribe el mensaje.** El pie del compositor termina con un chip que nombra al modelo, al lado del chip de esfuerzo de razonamiento y el botón de envío. El chip abre una lista de los modelos de la clave, cada uno encabezado por la marca de su creador, con la clave del cliente a la cabeza de la lista: la clave y el modelo siguen siendo una sola decisión, pero solo el modelo está siempre a la vista. Una lista de más de ocho elementos es searchable (permite búsqueda). Si no se ha elegido un objetivo, el chip es el único control dibujado en tono de advertencia, y el botón de envío explica por qué está bloqueado.

**El esfuerzo de razonamiento tiene su propio chip y sus niveles forman un control deslizante (`slider`).** El esfuerzo cambia con más frecuencia que el modelo y de forma independiente a este, por lo que no se integra dentro de la lista de modelos. Su chip nombra el nivel activo y abre una escala entre dos extremos que un operador puede sopesar —más rápido, más inteligente— con una parada por cada nivel nombrado y el control deslizante situado en el nivel activo. "Usar valor predeterminado del modelo" (`Use model default`) omite el campo de la solicitud; no es un punto en la escala, por lo que constituye una opción separada debajo de la barra, y en ese caso la barra no muestra ningún control deslizante.

**El marco del compositor contiene aquello de lo que está hecho y con lo que se envía un mensaje, y nada más.** Su pie cuenta con cuatro controles: un `+` redondo que adjunta elementos, el chip de esfuerzo, el chip de modelo y un único botón redondo relleno de tinta que actúa como envío (una flecha hacia arriba) o parada (un cuadrado). Nada que sirva únicamente para informar se encuentra en el marco: el anillo de contexto se sitúa debajo, en la línea que establece el límite de los datos. `/` y `@` no tienen botones dedicados; el texto de marcador de posición (`placeholder`) los menciona.

**Lo que se sitúa junto a la conversación se solicita explícitamente.** Un panel deslizante (`Drawer`) a la derecha muestra el directorio de capacidades o la guía de conexión, abierto mediante las dos acciones de icono en el borde superior de la página, o mediante `/capabilities` y `/connect`. Los detalles de una llamada específica se abren dentro de la conversación ([ADR 0084](0084-calls-are-a-timeline-of-disclosures-in-the-answer.md)). Se cierra con la tecla Escape, su control de cierre o el gesto de retroceso de la plataforma, en cualquier ancho de ventana (`viewport`).

**Las acciones de página flotan juntas en la esquina superior derecha de la conversación.** "Nueva conversación" encabeza el grupo, etiquetada, una vez que hay una conversación a la que reemplazar; la exportación, el directorio y la guía de conexión le siguen en forma de iconos tras una breve línea divisoria. Un único grupo ofrece un único lugar donde buscar: situado de manera independiente en el borde inicial, el reinicio de la conversación se separa del resto de acciones de la página y se interpreta como parte de la transcripción. Se ubican por encima del acolchado (`padding`) de la transcripción en lugar de dentro de una fila delimitada por líneas.

## Consecuencias

- El Agente y el Playground ya no se parecen a nivel de marco. Los cambios en `WorkspaceLayout` no afectan al Agente; los cambios en la transcripción compartida, el compositor, Markdown y las vistas de razonamiento siguen afectando a ambos.
- El directorio de capacidades está a un solo clic de distancia en lugar de estar siempre visible. Un operador que desee leer lo que el agente puede hacer antes de preguntar debe abrirlo; el párrafo del estado vacío indica que el agente pide confirmación antes de cambiar nada.
- La preferencia de ancho del panel lateral y el divisor ya no aplican al Agente. Un `Drawer` cubre parte de la conversación mientras está abierto, lo cual no ocurría con un panel redimensionable.
- La clave del cliente queda a un clic más de distancia de la vista en comparación con el modelo. La clave de un mensaje sigue estando especificada en el objetivo almacenado de la conversación y se restaura junto con esta.
- `TargetChip` reside en los componentes del espacio de trabajo compartido y podrá dar servicio al Playground más adelante; el Playground mantiene `TargetPicker` en su cabecera por ahora.
