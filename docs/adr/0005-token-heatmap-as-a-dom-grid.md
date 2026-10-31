# ADR 0005: El mapa de calor de tokens es una cuadrícula DOM y agrupa los días de una sola fuente

- Estado: Aceptado
- Fecha: 2026-09-14

## Contexto

El ADR 0004 adoptó `@ant-design/charts` como el entorno de ejecución de visualización y nombró a los "mapas de calor de densidad de tokens" como una de las capacidades que motivaron dicha elección. El siguiente incremento del panel de control es precisamente ese mapa de calor: un campo de volumen diario de tokens ubicado debajo de los seis mosaicos de KPI.

Debían resolverse tres preguntas antes de construirlo, y dos de ellas tienen respuestas que contradicen la lectura obvia del ADR 0004.

**¿Cómo debe dibujarse?** La biblioteca ofrece una marca `Heatmap`, que es la lectura directa de "adoptar un entorno de ejecución de gráficos para mapas de calor". Pero este panel es una cuadrícula de días direccionables individualmente, y todo su modelo de interacción es "leer un día, abrir un día". Una marca de lienzo (canvas) no ofrece nada de eso: no hay texto por celda, ni celdas enfocables, ni destino de clic por celda, ni estructura legible para tecnologías de asistencia.

**¿Qué debe representar?** `/management/dashboard` responde a una *ventana deslizante* (sliding window) —de quince minutos a noventa días, reconsultada mediante sondeo de cola (tail poll) con una frecuencia de hasta cinco segundos. Este panel cubre un año rodante fijo, porque un campo cuya anchura es la antigüedad de sus propios datos no es un calendario; con el valor predeterminado de 24 horas, sería una sola columna. Incluir un año de historial diario en la respuesta con ventana requeriría agregarlo en cada sondeo de cola, y los parámetros de la ventana se comparten con la lista de solicitudes.

**¿Qué forma debe tener?** Un gráfico de contribuciones es bidimensional: siete filas de días de la semana por una columna por semana. Las filas son el objetivo principal: convierten un ritmo semanal en una fila y una tendencia en una dirección; además, la forma y el intervalo son una sola decisión, ya que con siete filas, los días equivalentes a un trimestre sumarían trece columnas en lugar de un campo completo.

**¿Cómo deben resolverse los días?** Este es el aspecto que resultó ser más importante. Un día es un día calendario local, y las implementaciones obvias de este concepto son incorrectas: agrupar una consolidación horaria (rollup) mediante el inicio de un segmento desplazado por un desfase no puede dividir una hora UTC que abarca una medianoche local con un desfase fraccionario (el `+05:30` de India sitúa la medianoche local a las 18:30 UTC, dentro de la hora de las 18:00); asimismo, cualquier desplazamiento fijo único es incorrecto para todos los días posteriores a una transición de horario de verano, y no solo para los dos días en que ocurre dicha transición.

## Decisión

1. **Renderizar la cuadrícula como DOM.** Una celda por día en una cuadrícula CSS (CSS grid), con siete filas de días de la semana y una columna por semana; cada celda cuenta con un `title`, un `aria-label` y un `tabindex` dinámico (roving). El panel nunca importa el entorno de ejecución de gráficos, por lo que `vendor-charts` permanece sin cambios y solo se accede a él mediante las marcas de tendencia.

2. **Servirlo desde un endpoint dedicado**, `GET /management/dashboard/token-heatmap`, con su propia consulta, su propia frecuencia de actualización y su propio modo de fallo.

3. **Construir los días en el servidor a partir de la zona horaria IANA del visor.** El cliente envía `tz`; el servidor resuelve cada día utilizando `time.Date`/`AddDate` en dicha zona y devuelve cada día del intervalo con sus límites exactos e inclusivos de instante. Por lo tanto, un día local dura 23, 24 o 25 horas según lo requiera la zona, y los límites que agrega una celda son los mismos límites que abre su vista de detalle (drill-down).

4. **Recorrer el intervalo como fechas civiles y resolver los límites de cada día de forma independiente.** Chile adelanta su hora *exactamente a* medianoche, por lo que `2020-09-06` no tiene una hora `00:00` local y Go normaliza dicha fecha civil a `2020-09-05 23:00`. Por consiguiente, recorrer el intervalo con `AddDate` sobre un instante resuelto emite `2020-09-05` dos veces y nunca emite `2020-09-06`: la cuadrícula informa sus 371 días totales mientras contiene 370 días distintos, y cada día posterior a la transición desplaza una columna. La clave de cada día proviene de la fecha aritmética, y su inicio proviene del primer instante cuyo reloj local marca esa fecha —lo cual, en una transición a medianoche, ocurre una hora después de la medianoche, haciendo que ese día dure 23 horas en lugar de 24—.

5. **Agrupar a partir de una única fuente: la tabla de detalles.** Sin división entre consolidación y cola (rollup-plus-tail), y sin redondeo de la ventana al límite de un segmento (bucket).

6. **Limitar el día final al instante de lectura** en lugar de a la medianoche local siguiente, de modo que un registro con marca de tiempo en el futuro no pueda inflar el total del día de hoy.

7. **El color es una rampa continua del acento del tema**, no una escala semántica o escalonada. El brillo es la raíz cuadrada del volumen del día frente al día con más actividad de la ventana, mezclado en espacio OKLCH desde el relleno vacío de la celda hasta el color de acento. Los cortes escalonados cuantificaban y eliminaban las diferencias diarias que el panel existe para mostrar; un tono de estado implicaría un veredicto para el cual el panel no tiene fundamentos.

8. **Una sola vista.** El panel muestra el volumen de tokens propio del día y nada más. Se construyeron lecturas semanales y acumulativas que posteriormente fueron eliminadas: responden a "¿cómo fue esa semana?" y "¿con qué rapidez se acumuló el intervalo?", que son preguntas distintas a la que se le plantea a la cuadrícula; además, un control que modifica el significado de los colores hace que el campo sea ilegible a simple vista.

9. **La información emergente (tooltip) se abre al hacer clic y contiene la vista de detalle como enlace.** La celda en sí misma no navega. Cada celda es interactiva, incluso una sin datos almacenados: su tooltip lo indica y no contiene ningún enlace, ya que no habría nada que abrir.

## Consecuencias

### Positivas

- El panel es operable mediante teclado y lector de pantalla, y sus celdas son elementos reales: las pruebas automatizadas (probes) comprueban los rellenos calculados, el recuento de atributos y el texto renderizado en lugar de leer píxeles de un lienzo.
- Los límites de los días son exactos ante desfases fraccionarios, horario de verano y zonas horarias del visor que difieren de la del servidor (los tres casos que falla una agrupación basada en consolidaciones).
- La celda y su vista de detalle no pueden entrar en contradicción: ambas provienen del mismo intervalo devuelto.
- Una lectura no disponible no puede dejar en blanco los mosaicos superiores, y una *actualización* que falla mantiene la franja visible en pantalla.

### Compensaciones y contrapartidas (Trade-offs)

- **`QueryDailyTokenTotals` escanea la tabla de detalles en todo el intervalo.** No consulta la consolidación horaria, lo que consume más filas que una lectura basada en consolidaciones. Dos factores lo limitan: el escaneo se limita a la ventana de retención (400 días por defecto, dentro de la cual encaja el año rodante del panel), y la agregación se realiza íntegramente dentro de SQLite, por lo que como máximo una fila por día pasa a Go. El panel realiza esta lectura una vez por visita con un intervalo de cinco minutos, no en la frecuencia de sondeo del panel de control.
- **La división de consolidación (rollup split) deliberadamente no se reutiliza.** `QueryUsageAnalytics` divide su ventana en el punto de control horario y lee ambas mitades de tablas diferentes, lo cual es correcto para una cuadrícula de *segmentos* (buckets). No es correcto para un día: una solicitud que llega con una marca de tiempo anterior después de que su hora ya ha sido consolidada —los tiempos de eventos de CPA pueden llegar desordenados— se sitúa en el lado de los detalles del límite de la marca de tiempo, mientras que su propia hora ya se encuentra dentro de la consolidación; por lo tanto, una lectura híbrida la cuenta dos veces. Una sola fuente evita tener un límite susceptible de errores. La ruta propia del panel de control permanece inalterada.
- **El panel no utiliza una marca del entorno de ejecución de gráficos**, lo que representa una divergencia real respecto al planteamiento del ADR 0004, limitada a este panel y documentada en `docs/design.md`.
- **Un segundo endpoint en el panel de control.** La página realiza tres lecturas. La de la franja se ejecuta en un intervalo de cinco minutos y utiliza una invalidación por prefijo de clave desde el botón de actualización, por lo que añade una solicitud cada cinco minutos en lugar de una por cada sondeo.
- **En un área de visualización estrecha (viewport), la cuadrícula se desplaza horizontalmente abriéndose en la columna de hoy**, y su área táctil solo se expande verticalmente. Un año de semanas y un objetivo táctil de 44px no caben simultáneamente en un teléfono; el intervalo representa el significado del panel, mientras que el objetivo táctil es una comodidad: cada celda es accesible mediante las teclas de flecha y abre su propio tooltip, por lo que ningún elemento es inaccesible. Consulte `docs/design.md` §2 para ver la regla medida y el problema de superposición horizontal.
- **Cualquier parte de la cuadrícula anterior al horizonte de retención informa que no hay registros almacenados.** Con el horizonte predeterminado de 400 días, los 371 días de la cuadrícula caben dentro de él, por lo que esta situación solo se presenta cuando `OMCPA_USAGE_RETENTION_DAYS` se configura con un valor menor que el intervalo. Esas celdas se dibujan como no registradas con un texto explicativo. Acortar la cuadrícula para adaptarla a un horizonte menor fue una alternativa que se descartó: un cuarto de año son trece columnas, lo cual no posee la forma a partir de la cual se obtiene la lectura.
- **La rampa es relativa al intervalo.** Las franjas de dos despliegues no son comparables basándose únicamente en el tono; los recuentos en el tooltip de cada celda y su nombre accesible son lo que las hace comparables. Se eligió una escala relativa porque una absoluta saturaría un despliegue con mucha actividad o aplanaría uno silencioso, y se prefirió la raíz cuadrada de la proporción del día sobre un mapeo lineal o logarítmico por las razones expuestas en `docs/design.md` §2.
- **El horizonte de retención predeterminado se elevó a 400 días para este panel** (desde los noventa anteriores). La ventana es un año rodante, por lo que un horizonte de noventa días mostraría el inicio de la ventana como carente de datos durante la mayor parte del año. El coste es lineal: aproximadamente cuatro veces la cantidad de filas de detalles y consolidaciones en comparación con un horizonte de noventa días.
- **Un día sin registro almacenado no significa que no haya ocurrido nada.** La respuesta informa el primer registro *almacenado*, y cualquier día anterior se dibuja como no registrado. Si el colector estaba en ejecución y si perdió algún dato no es visible a partir del registro; el texto solo afirma que no hay nada almacenado.

## Alternativas consideradas

- **Una marca `Heatmap` de `@ant-design/charts`.** Se descartó porque el panel es un calendario y no una trama de píxeles (raster): el texto por celda, el foco y los objetivos de clic son su función y no una decoración, y un lienzo requeriría una capa DOM paralela para los tres elementos; es decir, la implementación basada en DOM más un lienzo.
- **Agrupar los días en Go a partir de la ruta de segmentos existente.** `QueryUsageAnalytics` lee su consolidación siempre que la cuadrícula solicitada no sea más gruesa que el grano de dicha consolidación, por lo que una cuadrícula diaria se serviría a partir de filas horarias y heredaría exactamente el error de desfase fraccionario que esta decisión evita.
- **Agrupar a partir de la consolidación horaria en el calendario del visor.** Es una alternativa más económica, pero incorrecta para cualquier desfase que no sea una hora exacta y para cualquier día que atraviese una transición de horario de verano.
- **Una línea de tiempo de una sola fila de los últimos noventa días.** Se ajusta al ancho del panel sin desplazamiento horizontal y fue la primera implementación. Se descartó tras evaluarla: una fila de cuadrados es una línea de tiempo, no un gráfico de contribuciones, y es incapaz de mostrar un ritmo semanal.
- **Una cuadrícula de año calendario** (de enero a diciembre) en lugar de una ventana rodante. Su forma es estable durante todo el año, lo cual resulta agradable, pero muestra cada mes de enero casi vacío y no dice nada sobre el mes de diciembre anterior, que es exactamente la comparación que un lector busca en ese momento. Una ventana rodante siempre abarca un año y siempre termina en el día de hoy.
- **Enviar un desfase UTC en lugar de un nombre de zona.** Es más sencillo, pero incorrecto para cualquier día situado al otro lado de una transición. La base de datos de zonas horarias ya está presente en la imagen del entorno de ejecución.
- **Devolver únicamente los días que tuvieron tráfico y dejar que el cliente rellene los huecos.** Se descartó: la forma de la franja es su intervalo, y un cliente que reconstruye los huecos constituye una segunda implementación del calendario que puede entrar en desacuerdo silencioso con el servidor.
