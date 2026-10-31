# ADR 0081: El hilo de conversación tiene su propia escala de forma y relleno

- Estado: Aceptado
- Sustituido en parte: la página Playground, sus rutas y los ADR 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agent se mantiene (lista de modelos `GET /agent/models`, ejecuciones `/agent/runs/...`).
- Fecha: 2026-10-08
- Modifica: el radio único de 4px de la sección §4 de design.md, exclusivamente para los espacios de trabajo de conversación y la tarjeta de aprobación. El color, la tipografía, la regla de sombra cero y el presupuesto de movimiento de la sección §7 permanecen inalterados.

## Contexto

El Agent y el Playground se diseñaron con la geometría de tablas y formularios de la consola: esquinas de 4px, un marco de 1px alrededor de cada objeto, una barra lateral en cada elemento desplegable y una barra de borde de 2px en cada notificación. Esa geometría es adecuada para registros densos. En una transcripción, hacía que una respuesta se leyera como una pila de cajas: el mensaje del operador, una fila de llamada, el razonamiento, una aprobación y un fallo llevaban cada uno su propio marco, por lo que las líneas superaban en número al contenido y nada distinguía un objeto presionado de la salida impresa.

assistant-ui, la biblioteca sobre la que se construye el hilo, publica un lenguaje de diseño y un catálogo de elementos de hilo (filas de herramientas, tarjetas de aprobación, sugerencias, estados de error y de pensamiento) que responden a esto: la forma se elige según lo que es un elemento, los grupos son rellenos en lugar de marcos, y las líneas se presupuestan. Sus componentes están escritos con utilidades de Tailwind y su propia paleta neutral.

## Decisión

1. **El hilo adopta los registros de ese lenguaje, pero no su código.** Forma según el tipo (material impreso de 6px, controles presionados de 8px, paneles de campos y listas flotantes de 10px, el compositor, la burbuja del operador, tarjetas y sugerencias de 16px); agrupación mediante un relleno tenue del primer plano; como máximo un borde fino (*hairline*) en un objeto; filas separadas por espaciado y un relleno al pasar el ratón (*hover*).
2. **Cada valor es un token derivado de la paleta**, declarado una sola vez en `web/src/index.css` (`--radius-document`, `--radius-control`, `--radius-surface`, `--radius-thread`, `--thread-field`, `--thread-field-hover`, `--thread-hairline`). El acento sigue siendo el acento de la paleta; los colores de estado siguen siendo `--success`, `--warn` y `--danger`.
3. **Los elementos son módulos CSS propios (*first-party*) sobre los primitivos de assistant-ui.** No entran en la compilación ni Tailwind, ni el registro de componentes, ni un segundo conjunto de iconos.
4. **La escala se detiene en el borde del espacio de trabajo.** La consola mantiene su radio de 4px y sus paneles con marcos; la conversación exportada sigue al hilo, porque es el hilo en papel.
5. **El movimiento mantiene el presupuesto de la sección §7.** No se adoptan las transiciones de 150-300ms del lenguaje de origen; una pulsación escala ligeramente su objeto mediante `--motion-fast`.

## Consecuencias

- Una respuesta contiene muchas menos líneas: sin barra lateral junto al razonamiento o la cadena de capacidades, sin barra de borde en un fallo o una aprobación, sin línea divisoria (*rule*) sobre las preguntas de seguimiento.
- Ahora existen dos geometrías en una sola consola. El límite es una superficie completa (la conversación), no widgets individuales, que es lo que evita que la diferencia se perciba como una incoherencia.
- Una aprobación destructiva ya no se marca con un borde grueso; su etiqueta de permiso, su aviso y la opción Allow coloreada con `--danger` transmiten esto, con el borde fino tintado con `--danger`.
- Los nuevos elementos del hilo se dibujan a partir de esta escala; un marco de 4px dentro del hilo es un defecto.

## Alternativas consideradas

- **Instalar los elementos basados en Tailwind y mapear sus variables de tema a las nuestras.** Rechazado: añade un segundo sistema de estilos y su reseteo a un paquete sin conexión con presupuesto de tamaño, sus utilidades transportan tonalidades fijas (azul para activo, esmeralda para completado) que eluden los valores preestablecidos de la paleta, y sus duraciones rompen el control de movimiento (*motion gate*).
- **Mantener la geometría de 4px y eliminar únicamente las líneas.** Rechazado: a 4px una burbuja o compositor con relleno y sin bordes se lee como una celda de tabla; el radio mayor es lo que permite que un relleno sustituya a un marco.
