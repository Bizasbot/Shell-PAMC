# ADR 0080: El trabajo en curso se muestra donde va a aterrizar

- Estado: Aceptado
- Fecha: 2026-10-08
- Modifica: design.md §7 regla 3 para una superficie, una etiqueta de texto corto que nombra el trabajo que sigue
  ejecutándose. Los marcadores de posición siguen respirando como decidió
  [ADR 0052](0052-loading-is-measured-and-first-load-placeholders-breathe.md), y el presupuesto de movimiento no cambia.

## Contexto

Una llamada de visualización es escrita por el modelo como argumentos, y un lienzo puede tardar la mayor parte de un
minuto en llegar. Hasta que la llamada se completaba, la respuesta mostraba una fila de llamada y una línea de actividad, y
luego la figura aparecía de golpe. La primera carga de una conversación almacenada dibujaba un marco vacío. La
única señal de trabajo en un turno en ejecución era un punto (pip) de 6px, por lo que una pasada de razonamiento larga o
una lectura de capacidad lenta se interpretaban como una página bloqueada.

§7 regla 3 prohíbe el brillo de gradiente (gradient shimmer) por dos razones declaradas: un fondo barrido repinta todo su
cuadro en cada fotograma, y desentona con la estética plana en bloques de marcadores de posición grandes.

## Decisión

1. **Una llamada de visualización que se está escribiendo es una figura en borrador.** Toma el propio marco de la figura al final
   de la respuesta, con un borde discontinuo, el título tan pronto como su cadena se haya cerrado en los argumentos
   parciales, y un escenario que contiene el cargador de generación sobre su etiqueta. La figura establecida la reemplaza
   en su lugar.
2. **La primera carga de una conversación almacenada es un marcador de posición con forma de hilo** al ancho de la columna
   del hilo, en una región de estado con nombre.
3. **Una etiqueta para el trabajo en ejecución lleva un resaltado a través de sus glifos**: el "Pensando" (Thinking)
   de la divulgación de razonamiento, el título de una llamada en ejecución, la línea de actividad y la etiqueta de la figura
   en borrador. El resaltado es un destello (glint) de 3.2em de ancho sin importar la longitud de la etiqueta, y este y la
   propia tinta de la etiqueta son dos capas de un fondo recortado a los glifos, por lo que no se pinta nada fuera de los
   glifos y cada glifo se dibuja una sola vez. Enmascarar el elemento a su texto y mover un pseudo-elemento sobre él
   mantenía el barrido en el compositor, pero dibujaba cada glifo a través de su propio contorno, lo que diluía los trazos
   hasta el punto de que el texto oscuro sobre fondo claro era difícil de leer; repintar una línea corta es el coste más
   barato. Ambas razones de la regla 3 se refieren a bloques; ninguna se aplica a una línea de texto. Cuando la máscara de
   texto no esté disponible, y bajo movimiento reducido, la etiqueta es texto plano. El bucle es una excepción de `duration`
   en `pnpm check:motion`.
4. **Una figura, su borrador, una fila de llamada y una pregunta de seguimiento llegan con opacidad y un desplazamiento vertical (rise) de 4px**
   dentro de `base`, las preguntas de seguimiento separadas por un paso `fast`. Nada cambia de escala, y no se deja ningún
   modo de relleno (fill mode) en una figura establecida.
5. **La generación tiene un cargador**: un campo de tres por tres puntos con una serie de celdas encendidas
   viajando a través de él, dibujado en `--fg`. Se sitúa en el escenario de la figura en borrador y, al tamaño de marca,
   encabeza la línea de actividad en lugar de un punto pulsante. Las nueve celdas comparten un fotograma clave de opacidad
   y entran en él en diferentes pasos, por lo que no se ejecuta ningún temporizador.
6. **El texto de respuesta que llega se desvanece (fade in), y un cursor (caret) marca su final.** Mientras una parte de texto fluye, cada
   nueva racha de palabras comienza desde `--accent` al 20% de opacidad y alcanza la tinta en 220ms, y un cursor `--accent` de 2px
   pulsa después de la última palabra. Ambos se detienen con el flujo; una respuesta almacenada es texto plano.
   El desvanecimiento es más largo que `base` a propósito: las palabras están en pantalla a tamaño completo desde el primer
   fotograma, por lo que nunca retrasa la lectura, y a 100ms la llegada no es perceptible. No es más largo que eso porque
   cada racha que aún se está desvaneciendo está tintada: a los 600ms un flujo rápido mantenía un párrafo en el acento y se
   interpretaba como una respuesta arrastrando su cola.

## Consecuencias

- La técnica es la que usa `tw-shimmer` para texto. El paquete en sí es un plugin de Tailwind y
  la consola no tiene Tailwind, por lo que está escrito en la hoja de estilos del espacio de trabajo contra los tokens del tema.
- El borrador se deriva de los rastros (traces) de la ejecución en vivo, por lo que no requiere cambios en el servidor y una
  recarga a mitad de ejecución lo muestra de nuevo.
- El cargador y el texto entrante siguen los elementos de estado de carga y texto en streaming de assistant-ui,
  escritos contra los tokens del tema; el desvanecimiento de texto utiliza la propia animación de streaming del renderizador
  de markdown con el fotograma clave del hilo en lugar del predeterminado.
- Un resaltado barrido en un bloque de marcador de posición, una tarjeta o un botón sigue siendo el brillo (shimmer) de la regla 3.
