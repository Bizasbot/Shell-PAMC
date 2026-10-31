# ADR 0082: Se dibuja una visualización donde el modelo la invoque, con o sin marco

- Estado: Aceptado
- Fecha: 2026-10-08
- Modifica: la ubicación dentro de la línea de decisiones de visualización del [ADR 0042](0042-display-tools-draw-referenced-frozen-data.md), el cual agrupaba todas las figuras en una sección de resultados posterior a la respuesta. Qué es una visualización, cómo se congela y cómo se aísla un lienzo (canvas) permanecen sin cambios.

## Contexto

Cada figura se dibujaba en una única sección al final de la respuesta, dentro de una tarjeta con borde y barra de título, mientras su invocación aparecía como una fila en la cadena de capacidades. El modelo podía decidir qué dibujar, pero no dónde el lector se encontraba con ello: una respuesta que explica, muestra y luego concluye terminaba mostrando toda su prosa seguida de todas sus figuras. Un elemento visual pequeño e integrado (una barra de estado, una única comparación) también recibía el peso de una tarjeta con título.

## Decisión

1. **Una llamada a visualización se dibuja en su propia posición dentro de las partes de la respuesta.** Sale de la cadena de razonamiento y de las llamadas a capacidades, y se renderiza —en el lugar donde el modelo la creó— como un borrador mientras llegan sus argumentos y como la figura una vez que se ha consolidado. El texto que el modelo escribe antes y después de la llamada la rodea, y un turno puede contener varias.
2. **`render_ui` acepta un parámetro opcional `frame`.** `card` es el valor por defecto; representa la figura con borde y título, y se almacena como ausencia de valor, por modo que las vistas almacenadas y las nuevas se leen de la misma manera. `none` coloca la interfaz directamente sobre el fondo de la conversación, sin borde ni barra de título; su título sigue siendo el nombre accesible del marco, y sus controles (código fuente, guardar, pantalla completa) se mantienen disponibles con un peso visual reducido. Cualquier otro valor se rechaza con un detalle legible.
3. **Una visualización fallida permanece como una fila de llamada**, donde se pueden leer su código y los detalles del fallo; nunca deja un hueco silencioso.
4. **El razonamiento es un desplegable flotante sin marco.** Se abre mientras llega el razonamiento, sigue la línea más reciente hasta que el lector se desplaza hacia arriba, y reanuda el seguimiento cuando vuelve al final. Se pliega cuando el razonamiento termina; reabrir un bloque finalizado queda a discreción del lector.
5. **El *system prompt* indica dónde se ubica una interfaz y para qué sirve `frame: none`**, en una sola oración dentro del presupuesto existente de la sección de presentación.

## Consecuencias

- La ubicación no requiere ningún nuevo campo almacenado: el orden de las partes de un turno ya lo registra, por lo que las conversaciones almacenadas previamente se vuelven a dibujar con sus figuras en el lugar donde fueron invocadas.
- La acción de copiar la respuesta y las citas omiten las figuras tal como lo hacían antes.
- El HTML y el PNG exportados todavía agrupan las vistas después del texto de la respuesta; llevarlos al mismo orden es una tarea de seguimiento en `web/src/agent/conversationHtml.ts`.
- Un lienzo sin marco depende de que el modelo utilice variables de temas para integrarse visualmente en la página; el aislamiento (*sandbox*) y la política de seguridad de contenido (*content security policy*) son idénticos en ambos marcos.
