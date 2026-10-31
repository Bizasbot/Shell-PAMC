# ADR 0085: Una interfaz generada se compone de componentes y se dibuja a medida que se escribe

- Estado: Aceptado
- Fecha: 2026-10-09
- Modifica: [ADR 0072](0072-canvases-run-in-a-sandboxed-frame.md), cuyo marco ahora incluye una vista previa y un límite de altura mayor; [ADR 0073](0073-charts-and-tables-are-canvases-and-a-command-can-hold-an-answer-to-one.md), cuyo kit adquiere componentes y un diagrama; y
  [ADR 0080](0080-work-in-flight-is-shown-where-it-will-land.md), cuya figura preliminar era un indicador de carga hasta que se completaba la llamada.

## Contexto

`render_ui` proporcionaba al modelo una página en un entorno aislado (sandbox), variables de temas y ayudantes para una tabla y un gráfico. Todo lo demás era CSS propio del modelo, escrito sin conocer el marco en el que se renderizaría. Los resultados eran inconsistentes de exactamente las formas que un operador nota: diseños pensados para una página de 1050px comprimidos en un marco de 750px, tarjetas anidadas dentro de tarjetas, un "diagrama de arquitectura" que era una cuadrícula de cajas sin conexiones, contenido más alto que el límite de 720px del marco desplazándose (scroll) en su interior, y un lienzo (canvas) cuya altura medida pasaba por alto el contenido desbordado y generaba una barra de desplazamiento sobre su última columna. Un lienzo también mostraba únicamente un indicador de carga durante todo el tiempo en que se escribía su marcado.

Las interfaces de este tipo que se perciben como un solo producto hacen dos cosas: se ensamblan a partir de una biblioteca de componentes y aparecen mientras se van generando.

## Decisión

1. **El marco incluye componentes, y el modelo compone a partir de ellos.** La hoja de estilos del kit agrega `omc-stack`, `omc-row`, `omc-grid`, `omc-card`, `omc-stat`, `omc-badge`, `omc-callout`, `omc-kv`, `omc-field` y `omc-tabs`, renderizados con los tokens, radios y espaciados de la consola, siendo todos ellos fluidos. Las pestañas (tabs) se conectan desde el marcado (`data-omc-tabs`, `data-tab`, `data-panel`).
2. **Un diagrama es una llamada.** `OMC.diagram` toma nodos y aristas, organiza los nodos en capas según su distancia desde una fuente y dibuja las flechas entre sus cajas: lado a lado en un marco ancho, o como un árbol indentado en uno estrecho. Se puede seleccionar un nodo para leer sus detalles y ver con qué está conectado.
3. **La herramienta define el marco como un contrato de diseño.** La descripción del parámetro `html` indica el ancho del marco en un equipo de escritorio y en un teléfono, especifica que la altura se adapta al contenido y que el relleno (padding), la superficie y el título ya están provistos, y solicita anchos fluidos, evitar tarjetas anidadas y colocar los componentes antes del CSS personalizado. Esto reside en el parámetro en lugar de en el mensaje del sistema (system prompt), cuyo presupuesto es de 6 KiB y el cual consume recursos en cada turno, independientemente de si se dibuja algo o no.
4. **Nada de lo que dibuja un lienzo sale del marco.** Los elementos multimedia se limitan al ancho del marco, el texto preformateado se desplaza dentro de su propio bloque, la altura reportada incluye el contenido que desborda la caja del documento, y el límite máximo aumenta de 720px a 1600px para que un lienzo se lea desplazando la conversación en lugar de una caja dentro de ella.
5. **Un lienzo se dibuja a medida que se escribe.** A medida que llegan los argumentos de la llamada, la figura preliminar mantiene un marco de vista previa con el entorno aislado, la política, los tokens y los componentes del lienzo, pero sin sus scripts. La consola decodifica la cadena `html` hasta el punto en que se haya escrito —recortando hasta su último carácter completo— y la publica cada 120 ms; la vista previa la asigna como marcado, lo cual nunca ejecuta un script y descarta una etiqueta inconclusa. El lienzo final reemplaza a la vista previa a la altura que esta última hubiera alcanzado.

## Consecuencias

- Un lienzo escrito con los componentes se ve como la consola sin importar qué modelo lo haya escrito, y un modelo que los ignore de todos modos obtiene un marco cuyo contenido no puede desbordarse lateralmente.
- Lo que calcula un lienzo —un gráfico, un diagrama, el estado de un control— está ausente en la vista previa y aparece cuando el lienzo se asienta. Lo que se transmite por streaming es la estructura estática que lo rodea.
- La vista previa y el lienzo son dos marcos, por lo que el intercambio vuelve a renderizar la figura una vez. Mantener la altura evita que la conversación se desplace cuando esto ocurre.
- La declaración de la herramienta es más larga. Se envía únicamente en los turnos que ofrecen `render_ui`.
- Los componentes son un contrato con las conversaciones almacenadas: una clase que usa un lienzo guardado debe conservar su significado, por lo que se añaden nuevos componentes en lugar de renombrar los existentes.
