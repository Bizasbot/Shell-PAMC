# ADR 0084: Las llamadas son una línea de tiempo de revelaciones en la respuesta

- Estado: Aceptado
- Fecha: 2026-10-09
- Modifica: [ADR 0076](0076-the-agent-has-its-own-shell-and-names-its-model-in-the-composer.md), cuyo
  panel lateral ya no muestra los detalles de las llamadas, y
  [ADR 0081](0081-the-conversation-thread-has-its-own-shape-and-fill-scale.md), que dibujaba la
  cadena de capacidades sin un carril.

## Contexto

Una llamada a capacidad era una fila en la respuesta, y sus argumentos y recibo se abrían en un panel
en el lateral de la página. Leer lo que devolvía una llamada significaba cubrir parte de la
respuesta a la que pertenecía, y comparar dos llamadas implicaba abrir y cerrar el panel dos veces.
El tramo de razonamiento y llamadas situado sobre una respuesta era una lista indentada bajo "Used N capabilities",
abierta durante todo un turno en ejecución, por lo que una respuesta larga era desplazada hacia abajo
por su propio trabajo hasta que el turno terminaba.

## Decisión

1. **Una llamada es una revelación.** Su fila —marca de estado, título, argumentos breves, duración,
   flecha— abre un panel debajo de sí misma con el identificador de la capacidad, el estado y la hora
   de inicio, los argumentos completos y el recibo que se le dio al modelo. El panel lateral conserva
   el directorio de capacidades y la guía de conexión, los cuales tratan sobre la página en lugar de
   sobre una sola llamada.
2. **Un tramo de razonamiento y llamadas es una línea de tiempo.** Una línea de resumen indica cuántas
   capacidades se utilizaron y cuántas fallaron; debajo de ella, los pasos cuelgan de un solo carril en
   el orden en que ocurrieron, incluido el razonamiento, con la marca de cada paso en el carril.
3. **La línea de tiempo está abierta donde se realiza el trabajo.** Permanece abierta mientras se
   encuentra al final de una respuesta en ejecución, o mientras una llamada en ella espera al operador,
   y se pliega a su resumen una vez que la respuesta ha avanzado más allá de ella. Al plegarse a mitad
   de la ejecución, el resumen muestra "Working…" con el resaltado de trabajo en curso de
   [ADR 0080](0080-work-in-flight-is-shown-where-it-will-land.md). El control manual del lector prevalece.
4. **Una fase recibe su nombre donde se dibuja.** El razonamiento que se está escribiendo muestra "Thinking…"
   en su propia revelación y una llamada en ejecución lleva el resaltado en su título; la línea de actividad
   bajo la respuesta mantiene el indicador de carga y el tiempo transcurrido, y nombra una fase solo cuando
   ningún elemento de la respuesta lo hace.
5. **Ambas revelaciones se abren mediante una fila de cuadrícula que crece desde cero** dentro de `base`,
   la única forma de animar hacia una altura que no se conoce de antemano sin medirla mediante script. Es
   una excepción de `layout` en `pnpm check:motion`, al igual que el acordeón de configuración, y el movimiento
   reducido lo elimina. Un panel plegado se oculta del foco y de la tecnología asistiva.

## Consecuencias

- Los detalles de una llamada se leen junto a la respuesta y se pueden abrir varios a la vez. Un recibo
  grande se desplaza dentro de su propio bloque de 280px en lugar de alargar la respuesta indefinidamente.
- El identificador de la capacidad está un clic más lejos de la vista de lo que estaba en la fila. El
  título de la fila es el nombre localizado; una capacidad para la que la consola no tiene texto se sigue
  leyendo como su identificador.
- Los pasos de una línea de tiempo completada se dibujan la primera vez que se abre y se conservan a
  partir de entonces, por lo que una conversación almacenada larga no consume recursos por líneas de
  tiempo que nadie abre.
- Una consulta a la base de datos se abre mostrando sus argumentos SQL y su tiempo, y carece de bloque
  de recibo; sus filas permanecen en el servidor ([ADR 0078](0078-agent-results-carry-data-references-and-completed-turns-keep-conclusions.md)).
- Los elementos siguen a los elementos tool-call y tool-timeline de assistant-ui, escritos utilizando
  los tokens de tema y el propio modelo de trazas de la consola en lugar de tomarse como componentes.
