# ADR 0007: Las lecturas de KPI rotan, una excepción acotada al presupuesto de movimiento

- Estado: Aceptado
- Fecha: 2026-09-17

## Contexto

**Los seis números de KPI del panel son las lecturas más consultadas de la consola y cambian mediante un sondeo
(poll) que el lector no solicitó.** `/management/dashboard` responde a una ventana deslizante y se vuelve a cargar mediante
un sondeo de cola adaptado a la resolución proporcionada —con un mínimo de cinco segundos y un límite máximo de dos minutos—.
Las seis celdas (tiles) son también el único lugar de la consola donde un *valor* es todo el contenido del elemento
que lo transporta: un total de peticiones que pasa de 1.600 a 1.614 repinta un número de idéntico ancho en
una caja idéntica, y nada distingue "esta lectura se movió" de "esto es lo que siempre decía".

`docs/design.md` §7 prohíbe exactamente ese tipo de movimiento. Su tabla de movimiento limita cada token a `base`
(100ms/0.1s) excepto `fast` y `float`, su regla 5 establece que los gráficos no se animan porque "una línea
que salta a nuevos datos se lee como honesta", y su tabla "Nunca hagas un intercambio brusco (hard-swap) de una vista"
establece que un sondeo de actualización automática no mueve nada. La filosofía detrás de los tres se expone en la
misma sección: "La interfaz es deliberadamente cruda y similar a una terminal. El movimiento existe solo para hacer que los
cambios de estado se sientan continuos y **alineados con la mano** —nunca para impresionar." `DESIGN.md` establece el
mismo presupuesto como una característica de la marca: ≤ 100ms, cero física de resortes (spring physics).

Un número rodante no está alineado con la mano: el lector no es quien cambia el valor, lo hace el reloj.
Por lo tanto, adoptarlo requiere una excepción explícita y acotada en lugar de una ampliación silenciosa de la regla, y
la excepción debe responder a cuatro preguntas que la regla existe para proteger: ¿anima únicamente propiedades del
compositor?, ¿mantiene el área animada diminuta?, ¿sobrevive a `prefers-reduced-motion`? y ¿deja intacta la regla 5
(la tinta del gráfico no se anima)?

También fue necesario resolver dos cuestiones menores antes de que se pudiera permitir el movimiento.

**¿Quién es el propietario del texto del número?** `web/src/types/tokenDisplay.ts` está documentado como la única capa
por la que pasa cada número de token visible para el usuario, y admite tres estilos de unidades: compacto internacional
(`300M`, `1.2B`), la escala china (`30万`, `1.2亿`) y una forma agrupada neutral en cuanto al idioma. La escala
china no se puede expresar como opciones de `Intl.NumberFormat`, por lo que una biblioteca de animación de números que formatea
a partir de su propia propiedad `format` (las opciones admitidas incluyen `notation: 'compact'`) solo podría reproducir dos
de los tres estilos. Reformatear las celdas a través de la biblioteca habría supuesto una segunda autoridad de formato además
de la compartida, precisamente el defecto que la capa existe para prevenir.

**¿Qué pasa cuando cambia la unidad?** Tanto `en-compact` como `zh` imprimen una palabra de unidad diferente en una
magnitud diferente. Una lectura que oscilara entre ambas convertiría `1.2` en `900` mientras la palabra de unidad cambiaba
de `B` a `M` debajo de los dígitos, por lo que los dígitos en movimiento nunca describieron la ventana en ningún instante
excepto en el último.

## Decisión

1. **La excepción se concede a las seis lecturas de KPI y a nada más.** Ninguna otra superficie acepta
   `roll`, y la §7 regla 5 nombra el alcance. La tinta de los gráficos, las filas de las listas, los totales de los libros
   contables y los paneles de modelos se mantienen sin cambios: la regla 5 sigue vigente y el minigráfico (sparkline)
   dibujado debajo de una celda rodante sigue saltando.

2. **La transición es `roll`: 240ms utilizando la función `cubic-bezier(0.2, 0, 0, 1)` existente en la consola.** Es
   más larga que `base` porque el movimiento de un dígito en 100ms es indistinguible de un redibujado —el lector tiene
   que ver *qué* dígito cambió para que el movimiento explique algo— y se mantiene muy por debajo del punto
   en el que esperar por un número en el pie de página se convierte en una tarea pesada. La presencia de glifos (un dígito
   que entra o sale del número) se mantiene en el token `base`, por lo que un `,000` que llega no se retrasa respecto al
   barrido que lo explica. Solo `opacity` y `transform`, dentro de una caja de 34px de altura: las reglas 1 y 2 no se modifican.

3. **El texto animado se deriva del formateador que ya lo imprime.** Cada lectura se divide en las
   partes propias del formateador propietario (`Intl.NumberFormat.formatToParts` para las formas compacta, plana
   y agrupada; la tabla de pasos compartida `万`/`亿` para la escala china), de modo que el número que anima la biblioteca
   y el número que imprime la celda no pueden diferir. Un conjunto de pruebas (logic suite) afirma la equivalencia en
   todos los estilos y un rango de magnitudes, incluidos los límites en los que divergiría una segunda regla de redondeo.

4. **Un cambio en la palabra de unidad se imprime en su lugar.** La lectura transporta su palabra de unidad por separado
   de su número, y el fotograma en el que cambia dicha palabra no se anima. El siguiente cambio con la misma unidad realiza
   la transición normalmente. Esto es lo que evita que un cambio en la escala de la leyenda se dibuje como un cambio de magnitud.

5. **`prefers-reduced-motion` afecta a la lectura.** Se mantiene habilitado el respeto propio de la biblioteca por
   la preferencia del usuario, por lo que un lector que haya solicitado reducir el movimiento obtiene el nuevo valor sin desplazamiento.
   La anulación de la §7 se aplica a la excepción exactamente igual que a todo lo demás.

6. **Una lectura faltante sigue siendo un guion medio (dash).** Una tasa o recuento nulo imprime el guion em compartido
   de la consola y no se anima desde o hacia un número, porque "nada medido" no es un número muy pequeño.

7. **El valor exacto de la lectura sigue siendo accesible.** La celda mantiene el atributo `title` con el recuento
   agrupado exacto, y la lectura publica el valor formateado como su nombre accesible, por lo que una ejecución de dígitos
   abreviados nunca es la única forma de leer el número.

## Consecuencias

### Positivas

- Un sondeo que cambia un KPI ahora lo indica. El panel se lee de un vistazo y las celdas son ese
  vistazo; antes de esto, una recarga que movía el total de peticiones en catorce unidades era invisible.
- La excepción consiste en una única transformación de 240ms de glifos en seis cajas pequeñas, por lo que no conlleva
- ningún coste de diseño (layout), ni repintado de la página, ni fotogramas fuera de la celda a la que pertenece.
- El formateo se mantiene en un solo lugar. Las celdas ganaron una animación sin incorporar una segunda regla de redondeo,
  y la equivalencia está garantizada por una prueba en lugar de por una revisión.
- El contrato de movimiento reducido se aplica también en la nueva superficie, y el escenario del navegador
  afirma ambas Mitades: la transición con el movimiento permitido y su ausencia cuando el movimiento es rechazado.

### Desventajas

- **El presupuesto de movimiento de la §7 deja de ser absoluto.** Un lector de la tabla de tokens ahora tiene que
  notar la línea `roll` y su alcance, y "≤ 100ms" es una regla con una salvedad nombrada en lugar de una regla estricta.
  Ese es el precio de cambiar una restricción documentada en lugar de violarla silenciosamente.
- **El panel puede moverse en cada sondeo.** Con un sondeo de cola de cinco segundos en una ventana deslizante,
  un despliegue con mucha actividad puede hacer rodar una celda cada cinco segundos. La mitigación está acotada en lugar de
  ser absoluta: 240ms de movimiento de glifos y nada más se mueve en la página.
- **El DOM de las celdas es ahora un elemento personalizado con un shadow root.** `innerText` en el valor de una celda
  está vacío, por lo que cualquier elemento que lea el número debe pasar por el árbol de accesibilidad; las sondas (probes)
  y el escenario de aceptación lo hacen, y las aserciones anteriores de `innerText` fueron reemplazadas en lugar de conservadas.
- **Una nueva dependencia de frontend y un nuevo shadow root en la ruta del panel.** Se carga en el fragmento (chunk)
  de carga diferida (lazy) del panel en lugar de en la entrada, y el presupuesto del bundle sigue cumpliéndose.
- **La divergencia entre la palabra de unidad de la lectura y una elegida por la biblioteca es imposible por construcción,
  pero solo para las formas que la lectura puede expresar.** La notación científica y de ingeniería quedan fuera del tipo
  de lectura por la misma razón que el motor de animación no puede dibujarlas.

## Alternativas consideradas

- **Ampliar el token `base` para cubrir la transición.** Rechazado tras evaluarlo: a 100ms los dígitos son un desenfoque
  que parece un redibujado, que es precisamente el estado del cual el movimiento pretende distinguirse. El presupuesto es una lista
  de tokens, no un único número, por lo que la excepción puede nombrarse en lugar de absorberse.
- **Dejar que la biblioteca formatee los números (`format={{ notation: 'compact' }}`) y eliminar las palabras de unidad
  de la capa compartida.** Rechazado: eliminaría la escala `zh` y el estilo `full` de la lectura más destacada de la consola,
  e introduciría una segunda autoridad de formato junto a la que el proyecto documenta como autoritaria. En su lugar,
  la lectura se deriva del formateador.
- **Animar toda la celda (fundir la tarjeta, deslizar el valor).** Rechazado por las reglas 1 y 2 de la §7:
  fundir una celda de la cuadrícula compone más que el número, y un valor que aparece volando reintroduce la estética
  de animación de entrada que `DESIGN.md` rechaza.
- **Contar desde cero en el primer renderizado (first paint).** Rechazado: inventa lecturas que nunca se midieron,
  y en una ventana que ya está cargada animaría un número que la API nunca devolvió.
- **Hacer rodar también las lecturas del panel de modelos y del mapa de calor (heatmap).** Rechazado: los números
  de los paneles se sitúan junto a marcas que la regla 5 de la §7 mantiene estáticas, por lo que el movimiento allí separaría
  un valor del gráfico que lo explica.
- **Rotar solo en cambios impulsados por el usuario (ajuste preestablecido de ventana, actualización manual), nunca en un sondeo.**
  Era la lectura más conservadora de la §7 y fue la primera propuesta. Se rechazó porque el sondeo es exactamente el momento
  en que un lector necesita la señal: una actualización manual corresponde a un lector que ya está mirando el número,
  mientras que un sondeo corresponde a alguien que está mirando hacia otro lado. El alcance acotado (seis ejecuciones de glifos,
  solo `transform`, cambios de unidad congelados, respeto por el movimiento reducido) es lo que hace defendible este activador más amplio.
- **Un resorte (spring) al estilo `@react-spring` o un cuentakilómetros (odometer) escrito por nosotros.** Rechazado:
  un resorte es el rebote que `DESIGN.md` prohíbe, y un cuentakilómetros escrito a mano implica mantener una implementación
  de diseño de dígitos para una sola superficie —incluyendo la máscara, la medición y el manejo de movimiento reducido
  que la biblioteca ya incluye de serie—.
