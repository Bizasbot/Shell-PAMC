# ADR 0073: Los gráficos y las tablas son lienzos (canvases), y un comando puede contener la respuesta para uno

- Estado: Aceptado
- Fecha: 2026-10-08
- Reemplaza las herramientas `render_chart` y `render_table` de la
  [ADR 0042](0042-display-tools-draw-referenced-frozen-data.md), y las contrapartes de
  los bloques `chart` y `table` en la lista de herramientas de la
  [ADR 0079](0079-panels-are-a-block-vocabulary-with-open-icons.md). Se mantiene su regla de que
  una visualización dibuja filas congeladas y referenciadas.
- Extiende la [ADR 0072](0072-canvases-run-in-a-sandboxed-frame.md): el lienzo incorpora
  un kit de dibujo, una vista que ocupa todo el viewport y exportación de imágenes.

## Contexto

El Agente contaba con cuatro herramientas de visualización. Dos de ellas, `render_chart` y
`render_table`, dibujaban una figura fija cada una a partir de filas referenciadas; una página
escrita por el propio modelo podía dibujar esas mismas figuras y cualquier otra cosa, pero
únicamente de forma manual: un modelo que quisiera un gráfico de barras allí tenía que escribir
su propia aritmética SVG y su propio formato de números, y por lo general escribía ambas
cosas con ligeros errores.

Cuatro herramientas que se solapan cuestan más que sus esquemas. El modelo tiene que elegir
entre ellas en cada respuesta, el prompt tiene que explicar la elección en cada ronda, y cada
tipo de figura necesita un renderizador de consola, un renderizador de exportación y pruebas.
Las herramientas fijas también suponían un límite: un gráfico al lado de su tabla, dos
gráficos compartiendo una leyenda o una tabla con una fila resaltada eran, o bien una
herramienta adicional innecesaria, o bien un lienzo escrito desde cero.

Por separado, la lista `/` del compositor ofrecía preguntas predefinidas. Una pregunta
predefinida es texto que el operador podría haber escrito; no es algo que el espacio de
trabajo ejecute. Lo que un operador no puede escribir es una garantía: "responde a esto
como un lienzo" es una solicitud que el modelo puede cumplir o no cuando es solo una frase.

## Decisión

**Una única herramienta de visualización realiza el dibujo.** `render_ui` recibe un título,
el marcado de la página y, opcionalmente, las filas a las que hace referencia; la consola lo
dibuja como un marco aislado en un entorno seguro (*sandbox*) dondequiera que el modelo lo haya
invocado (ADRs 0072, 0082, 0085). Se retiran `render_chart`, `render_table`, `render_view`
(ADR 0079) y `render_canvas`: ya no se declaran, ofrecen ni aceptan, y un registro almacenado
que mencione alguna de ellas se sigue leyendo como una llamada de visualización que no cambió nada.

**El documento del lienzo incluye un kit.** Antes del marcado del modelo, la consola inyecta
un script propio, expuesto como `OMC` dentro del marco (*frame*):

- `OMC.rows` - las filas congeladas a las que hizo referencia la llamada (`OMC_DATA` se mantiene como un alias);
- `OMC.fmt(value, unit)` - números escritos tal como los escribe la consola, para
  `tokens`, `usd`, `ms`, `percent`, `bytes`, `time` y `number`, siguiendo el estilo de
  unidades de tokens del operador, el idioma y la zona horaria del despliegue;
- `OMC.chart(target, options)` - de líneas, áreas, columnas, barras y circular (*pie*), opcionalmente dividido
  por un campo de serie o apilado, con ejes formateados y leyenda;
- `OMC.table(target, options)` - una tabla con columnas etiquetadas, con formato de unidades y ordenables.

El kit es texto fuente dentro del documento aislado, por lo que no posee más autoridad
que el marcado que lo acompaña: lee `OMC.rows` y escribe en el propio DOM del marco.
Dibuja utilizando las variables de tema que el documento ya posee, de modo que una figura
del kit sigue la paleta y sus esquemas claro y oscuro sin que el modelo deba especificar un color.

**Un lienzo puede ocupar todo el viewport y guardarse como imagen.** La barra propia de
la figura ofrece ambas opciones. La vista a pantalla completa es el mismo marco, dibujado
sobre la consola y cerrado con Escape o con el gesto de retroceso de la plataforma. La
imagen es generada por el kit: la consola envía una solicitud de captura al marco, el kit
responde con un SVG de su propio documento, y la consola valida la forma y el tamaño de la
respuesta para rasterizarla. El marco permanece tan aislado como antes; la consola nunca lee
el DOM del marco y la respuesta se trata como datos no confiables.

**Las conversaciones almacenadas conservan sus registros (*traces*).** Una conversación guardada
antes de este cambio puede contener llamadas a `render_chart` o `render_table` con sus respectivas
vistas. Esos nombres siguen reconociéndose como llamadas de visualización —por lo que la
reemplazabilidad del turno y el orden del registro se juzgan como antes—, pero no pueden actuar
como origen de filas para una nueva llamada y la consola no dibuja nada para sus vistas. La
llamada permanece listada en los pasos de la respuesta.

**Un comando del compositor puede contener una respuesta para una presentación.** `/ui` y
`/text` configuran cómo se presenta la respuesta del siguiente mensaje. La elección viaja como
`forwardedProps.present`, se almacena en el turno y se preserva limitando lo que se le ofrece
al turno en lugar de solicitarlo: a un turno `ui` se le ofrece `render_ui` y la nota de
seguimiento; a un turno de texto, únicamente la nota de seguimiento; y a un turno `ui` que
termina sin una interfaz de usuario dibujada se le deja tal como está. El comando no ofrece
la garantía de que se dibuje una; lo que elimina es la posibilidad de responder únicamente
en prosa. `canvas`, la denominación anterior del comando, sigue aceptándose en la red y se
interpreta como `ui`. Un reintento (*retry*) vuelve a enviar la presentación del turno.

**`/` lista comandos, no prompts.** Cada fila define la presentación del siguiente mensaje
o ejecuta una acción de la página —detener, reintentar, editar, nueva conversación, exportar,
abrir el directorio de capacidades o la guía de conexión— y una fila que no se puede ejecutar en
ese momento no aparece listada.

## Consecuencias

- Un solo renderizador por figura en lugar de tres. Se eliminan las vistas de gráficos y tablas
  de la consola, su exportación a CSV, así como los gráficos SVG y las tablas de datos de la
  exportación de conversaciones; un lienzo se exporta tal como era: el marco aislado.
- Un gráfico es ahora un marcado escrito por el modelo que invoca a un kit, lo cual requiere
  un poco más de esfuerzo por parte del modelo que una especificación de gráfico, y una
  llamada incorrecta dibuja nada en lugar de fallar la validación. El prompt y la descripción
  de la herramienta nombran las llamadas del kit; el kit ignora lo que no comprende y muestra un
  estado vacío si no hay filas.
- La exportación de imágenes de conversaciones sigue mostrando un lienzo como un marcador
  de posición con título; la opción "guardar como imagen" propia del lienzo es el medio para
  obtener la imagen de una figura.
- Los gráficos y tablas en conversaciones almacenadas antes de este cambio ya no se dibujan.
  La conversación almacenada es un estado de trabajo de corta duración, y volver a ejecutar la
  pregunta los dibuja como lienzos; migrar vistas congeladas a marcado de lienzo generado
  habría supuesto mantener un segundo renderizador vivo para tal fin.
- El kit forma parte de cada documento de lienzo, incluidos los exportados, ocupando unos
  pocos kilobytes cada uno.
- `present` es la primera propiedad reenviada que modifica lo que se le ofrece a un turno.
  Se valida contra un conjunto cerrado, se acepta únicamente con un mensaje nuevo, y se rechaza
  una solicitud `ui` cuando la consola no ha declarado `render_ui`.
