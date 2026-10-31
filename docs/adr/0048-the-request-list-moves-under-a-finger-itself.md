# ADR 0048: La lista de peticiones se desplaza directamente bajo el dedo

- Estado: Aceptado
- Fecha: 2026-10-01

## Contexto

En un teléfono, la lista de peticiones se desplazaba mal de tres formas distintas, todas medidas en
la lista real a 390×664 con entrada táctil enviada a través del protocolo DevTools:

- **La página alrededor de la lista se desplazaba y rebotaba.** En los teléfonos, la página se
  mantenía en al menos 760px, más alta que la mayoría de las pantallas de teléfonos, por lo que el panel
  de contenido también se desplazaba. Un arrastre que comenzaba en los filtros desplazaba el panel, y
  un arrastre que llegaba a cualquiera de los extremos de la lista se transfería al panel. El panel
  entonces rebotaba en su propio extremo, o recargaba la página al tirar hacia abajo en la parte
  superior. La cabecera de filtro desplegada ocupaba 399px de un panel de 608px, y el pie de página
  se encontraba fuera de la pantalla.
- **La lista se adelantaba al dedo.** La lista está virtualizada, por lo que su contenedor recorta su
  desbordamiento y el navegador no puede desplazarla directamente para un dedo.
  `@rc-component/virtual-list` emula el desplazamiento táctil en su lugar: cada movimiento táctil
  desplaza la lista según el recorrido del dedo y reinicia un deslizamiento inercial (*coast*) en un
  intervalo de 16ms. Dicho deslizamiento sigue ejecutándose entre movimientos mientras el dedo sigue
  presionando, por lo que un arrastre de 200px movía la lista hasta 370px.
- **Un dedo podía plegar la cabecera pero no desplegarla.** El primer desplazamiento plegaba la
  cabecera después de que la lista ya se hubiera movido bajo el dedo. Las únicas formas de volver atrás
  eran usar la rueda del ratón hacia arriba en la parte superior y el botón flotante de volver arriba,
  el cual no se muestra en la parte superior.

## Decisión

1. **En pantallas táctiles, la página se ajusta a la pantalla y la lista es su único elemento de
   desplazamiento.** Por debajo de 640px, y siempre que un dedo sea el puntero principal, la página y
   la lista eliminan sus alturas mínimas. Sobre la lista, el navegador solo mantiene el paneo
   horizontal y el zoom (`touch-action: pan-x pinch-zoom`), por lo que un arrastre en cualquiera de
   los extremos no tiene a dónde ir.
2. **La consola mueve la lista bajo el dedo** (`web/src/components/usage/requestListTouch.ts`). Cada
   movimiento táctil sobre la lista se intercepta de la librería usando su indicador `_virtualHandled`
   (que la librería ya comprueba para los movimientos táctiles) mediante un listener en fase de captura
   en la página. La lista se desplaza exactamente lo que se mueve el dedo y se dibuja de forma
   síncrona, de modo que aparece en pantalla en el mismo fotograma en que el dedo se movió.
3. **Al soltar, se desliza por inercia a la velocidad con la que el dedo se retiró**, medida durante
   los últimos 100ms y decayendo a la velocidad normal de iOS (98% de la velocidad retenida por cada
   10ms). Un dedo que se detuvo antes de levantarse no genera deslizamiento inercial. Un toque
   (*tap*) sobre una lista en deslizamiento la detiene y no se propaga como un clic, al igual que en un
   componente de desplazamiento nativo; un toque fuera de la lista detiene el deslizamiento y sí se
   propaga. Un movimiento de rueda, una tecla, un cambio de página y el retorno al inicio también
   detienen el deslizamiento.
4. **La cabecera se pliega y se despliega con los gestos de la rueda.** Un arrastre hacia arriba en
   una cabecera desplegada la pliega y no mueve nada más, sin importar dónde comience, tal como lo
   hace el primer nivel de la rueda. Un tirón hacia abajo de 48px más allá de la parte superior de la
   lista la despliega, al igual que el rebote superior de la rueda. Un solo gesto modifica la
   cabecera como máximo una vez. El plegado requiere que la lista esté en la página: una página que
   está cargando o no ha encontrado resultados nunca pliega la cabecera, y una cabecera plegada antes
   de que la lista desapareciera se despliega con un tirón de 48px en cualquier parte de la página.

El deslizamiento inercial es el único aspecto en el que la consola imita la física de la plataforma.
Un mecanismo de desplazamiento nativo evitaría esto, pero requeriría que la lista fuera un elemento
con desbordamiento ordinario. Con entre 100 y 500 filas por página, cada una con una altura de fila
etiquetada en un teléfono, la lista debe permanecer virtualizada.

## Consecuencias

- En un teléfono de 390×664, la lista plegada llena la pantalla con su pie de página visible. Un
  arrastre mueve la lista exactamente la misma distancia que el dedo, y nada alrededor de la lista se
  mueve en ninguno de los extremos.
- La capa depende de un detalle adicional de `@rc-component/virtual-list`: un movimiento táctil
  marcado como `_virtualHandled` no es desplazado por la librería. La prueba (`probe`)
  `request-list-touch` simula entrada táctil real y falla si la lista deja de seguir al dedo, de
  deslizarse por inercia, de detenerse ante un toque o de plegar y desplegar su cabecera. La
  implementación anterior falla en todas estas comprobaciones.
- La velocidad y la tasa de decaimiento del deslizamiento son funciones puras con pruebas lógicas
  (`scripts/test-request-list-touch.ts`).
- Solo la lista de peticiones se mueve de esta manera. Una ventana emergente de selección
  (*Select*) virtualizada sigue utilizando la emulación de la librería; es corta y se abre brevemente,
  y no es el lugar donde se lee la consola.
