# ADR 0087: Las nuevas interfaces generadas usan componentes inline por defecto

- Estado: Aceptado
- Fecha: 2026-10-08
- Modifica: [ADR 0082](0082-a-display-is-drawn-where-the-model-calls-it.md) para el encuadre de nuevas llamadas y
  [ADR 0085](0085-a-generated-ui-is-composed-from-components-and-drawn-as-it-is-written.md) para
  el límite de altura y el contrato de diseño (*layout*).

## Contexto

Las interfaces generadas son partes de una respuesta, no solo artefactos de gráficos independientes. Un filtro, calculador o explorador de flujos de trabajo debe ubicarse junto al texto que lo explica sin agregar otra tarjeta (*card*), encabezado y ventana de desplazamiento (*viewport*) con scroll. El límite de altura anterior de 1600px también obligaba a los paneles ordinarios a desplazarse dentro de la conversación, estrechando los gráficos en las barras de desplazamiento clásicas. Las conversaciones existentes deben conservar la presentación con la que fueron guardadas.

## Decisión

Las nuevas llamadas a `render_ui` utilizan `frame: none` por defecto. El servidor almacena explícitamente esa elección; `frame: card` se sigue almacenando como ausencia, preservando la interpretación de las vistas más antiguas. Los borradores utilizan el mismo valor predeterminado para `render_ui`; los borradores de visualización heredados conservan el encuadre de tarjeta. Se instruye a los modelos para que escriban el encuadre antes del marcado (*markup*), elijan controles locales con forma de tarea, compongan a partir del kit de componentes offline y utilicen un diseño de documento natural y responsivo.

La altura del contenido crece y se contrae dentro del rango de 48px–16384px, coincidiendo con el límite superior de altura de la imagen guardada. Las observaciones de cambio de tamaño (*resize*) y mutación se fusionan en una única medición de fotograma de animación (*animation frame*), excluyendo la altura del viewport para que un componente previamente más alto pueda encogerse después de filtrar. Una medición producida únicamente por un cambio de diseño y que repite el último desbordamiento (*overflow*) no se envía: el contenido dimensionado a partir del propio marco (`min-height:100vh`, `height:100%`) es más alto en cada fotograma que se le asigna, por lo que reportarlo haría crecer el marco hacia un espacio en blanco sin fin. Una mutación de contenido siempre se reporta, por lo que un componente que aún se está escribiendo continúa creciendo. Por encima del límite, el contenido sigue siendo desplazable en lugar de desaparecer. Los componentes incrustados comparten los valores de la superficie de la consola y el radio de control en las vistas en vivo, vistas previas transmitidas y exportaciones.

Un borrador procesa marcado parcial con un *nonce* de script fresco concedido solo al bootstrap del host; los scripts del modelo, los controladores de eventos en línea y las URL de JavaScript no se pueden ejecutar durante la transmisión (*streaming*). El componente completado activa sus scripts únicamente en el sandbox existente de origen opaco y red bloqueada. Las interacciones locales utilizan contenido congelado. `OMC.compose` ofrece un borrador de mensaje revisado para nuevas lecturas o escrituras; no envía el mensaje ni elude la aprobación de capacidades.

## Consecuencias

El modelo puede componer múltiples componentes complementarios entre los párrafos de respuesta manteniendo las respuestas simples en formato de texto. El encuadre histórico y el límite de seguridad existente se mantienen estables. Un límite más alto permite una mayor asignación de diseño a partir de mensajes de marcos no confiables, pero dicha asignación es finita y validada. Los controles dependientes de scripts se activan únicamente cuando la generación se completa; el marcado progresivo no es un compilador de scripts incremental de propósito general.
