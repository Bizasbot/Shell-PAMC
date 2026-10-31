# ADR 0009: El *hover* está acotado por el *token* rápido en lugar de prohibido

- Estado: Aceptado
- Fecha: 2026-09-17
- Modificado por: ADR 0103, el cual mantiene el límite y mueve el *token* `fast` a 120ms.

## Contexto

`docs/design.md` §7 regla 7 decía: **"El *hover* no es una animación. Un *hover* es la interfaz
reconociendo el puntero, por lo que se pinta en el fotograma en que llega el puntero — nunca una
transición en un color de *hover*."** Su trampa declarada era concreta: Ant Design cuelga el *hover*
de elementos de menú, la expansión de submenús y el colapso del panel lateral de `motionDurationSlow`,
cuyo valor por defecto es 0.3s, y una navegación que se arrastra bajo el puntero se siente rota.

Dos cosas eran ciertas al mismo tiempo que dicha regla:

**Los propios *hovers* de la consola ya eran de 50ms.** Aproximadamente diez reglas en siete archivos
hacen la transición de un color en el *hover* — tarjetas de temas preestablecidos, tarjetas OAuth,
tarjetas de archivos de autenticación, filas de cuotas, etiquetas de pestañas de proveedores, *chips*
de precios y pestañas de filtros, la fila de la tabla de clasificación, los botones de iconos de la
página de solicitudes. La mayoría nombraban `var(--motion-fast, 50ms)`; unos pocos usaban `0.15s` o
`var(--motion-base)`. A 50ms, un cambio de color consta de tres fotogramas: por debajo del umbral
donde un lector percibe movimiento, y por encima del umbral donde un cambio brusco se interpreta como
un repintado. Así que el objetivo declarado de la regla — "se pinta en el fotograma en que llega el
puntero" — ya era cumplido por el código, mientras que el código infringía la regla tal como estaba
escrita.

**Aplicar la regla literalmente tiene un costo amplio e invisible.** Eliminar esas transiciones cambia
el comportamiento del *hover* en cada página de la consola, en los seis temas, y no aporta nada que un
lector pueda percibir. También habría sido lo primero que este repositorio le hacía a los estilos de
*hover* en meses, en un cambio cuyo tema era el *presupuesto* de movimiento — el tipo de refactorización
oportunista que hace que un *diff* sea difícil de revisar y una regresión difícil de acotar.

La evidencia decisiva fue la disparidad entre la regla y su objetivo: la regla fue escrita sobre un
arrastre de navegación de 0.3s, y el código que gobernaba se ejecutaba a 50ms. Una prohibición y un
suavizado de tres fotogramas no son el mismo comportamiento, y la regla los estaba confundiendo.

## Decisión

1. **La regla 7 se convierte en un límite, no en una prohibición.** Un *hover* puede hacer la transición
   de un color, y debe aterrizar dentro del *token* `fast` (50ms). Se reescribe en §7 indicando el
   límite, manteniendo la trampa de antd como la razón por la cual existe el límite, y añadiendo un
   puntero a este ADR.

2. **Se aplica el límite, junto con el resto del presupuesto.** `scripts/check-motion.mjs` falla en un
   *hover* cuya parte de color no nombra exactamente `var(--motion-fast)` — un `50ms` pelado es un número
   que ningún documento posee, y nunca se aplica un valor de respaldo (*fallback*).
   `scripts/check-motion.test.mjs` prueba la regla en ambas direcciones.

3. **Dos prohibiciones más estrictas sobreviven sin cambios.** Un *hover* nunca puede hacer la
   transición de una propiedad de diseño (*layout*) (esa es la regla 1 de §7, y ahora se comprueba para
   cada *hover*), y el único elemento que escala bajo el puntero no puede desvanecer su color: la sonda
   de la marca del mapa de calor (*heatmap mark*) todavía afirma que solo `transform` se anima allí,
   porque un desvanecimiento de color se difuminaría detrás de la escala que lo acompaña. La
   prohibición literal nunca estuvo mal para ese elemento; era demasiado amplia para el resto.

4. **Los sitios que excedían el límite se corrigen en lugar de ser eximidos por derechos adquiridos.**
   Los *hovers* de color de `0.15s` en los botones de iconos de la página de solicitudes y en la fila
   de la tabla de clasificación pasan a ser `var(--motion-fast)`, y el borde `var(--motion-base)` de la
   tarjeta OAuth pasa a ser `fast` — el mismo suavizado de tres fotogramas que cualquier otro *hover*
   en la consola ya tenía.

5. **`transition: all` se rechaza categóricamente.** No es una cuestión de *hover*, pero surgió con
   ellos: `all` anima cada propiedad que un cambio toca, incluidas las propiedades de diseño que prohíbe
   la regla 1, y hace que la intención de una transición sea ilegible. Cinco sitios fueron enumerados
   en las propiedades que realmente cambian, y uno — un botón de icono de proveedor cuyo estilo es
   enteramente estático — tenía una transición que no animaba nada y fue eliminado.

## Consecuencias

### Positivas

- El presupuesto ahora cubre lo que la consola hace realmente. Antes de esto, un lector no podía saber
   si los *hovers* de 50ms cumplían con la norma o si eran violaciones desatendidas, que es el estado
   en el que una regla deja de consultarse por completo.
- El comportamiento del *hover* no cambia en ninguna página. El único cambio visible es que unos pocos
   *hovers* se volvieron ligeramente más rápidos, moviéndose hacia el límite en lugar de alejarse de él.
- El límite está en el verificador, por lo que el siguiente *hover* que se añada se juzgará en función de
   él y no de la memoria.

### Compensaciones

- **La regla 7 de la §7 es más débil que antes.** Pasó de ser una prohibición absoluta a un límite de
   duración, y un lector que quiera "ninguna transición de *hover* en absoluto" ya no encuentra esa
   regla. Esa es la descripción honesta del comportamiento de la consola, pero es una relajación de
   una restricción documentada.
- **Tres fotogramas de desvanecimiento de color son un juicio, no una medición.** La afirmación es
   que 50ms es imperceptible como movimiento; nadie sentó a lectores frente a él, y una decisión futura
   de prohibir las transiciones de *hover* por completo tendría que tomarse basándose en el gusto y
   no en la evidencia de este ADR.
- **La tabla de excepciones crece.** Las animaciones de diseño que una revelación (*disclosure*) necesita
   son ahora excepciones nombradas, y un presupuesto con excepciones es más difícil de leer que uno sin
   ellas. La mitigación es que cada excepción conlleva una razón y una excepción no utilizada hace que
   la comprobación falle.
- **El verificador es textual.** Lee cadenas `.css` y `transition:` en línea, por lo que una duración
   ensamblada en tiempo de ejecución es invisible para él, y no puede asociar una regla reescrita bajo
   un selector diferente con su movimiento. Ambas limitaciones se indican en la propia cabecera del
   verificador en lugar de dejarse para que las descubra un lector.

## Alternativas consideradas

- **Aplicar la regla 7 literalmente y eliminar las transiciones de *hover*.** La lectura más fiel, y fue
  la primera propuesta. Rechazada: reescribe el comportamiento del *hover* en cada página y en los seis
  temas para eliminar una animación de tres fotogramas de duración, en un cambio sobre el presupuesto —
  un costo sin beneficio medible, y un *diff* grande que oculta las correcciones que sí importan.
- **Mantener la regla y dejar el código como está.** Rechazada: ese es el estado que encontró la
  auditoría de desviaciones, y la razón por la cual existe la auditoría. Una regla que el código ignora
  es peor que una regla que está mal, porque enseña a los lectores a saltarse la sección.
- **Modificar solo la documentación y no añadir ningún verificador.** Rechazada: §7 ya se había desviado
  dos veces (los *tokens* de la hoja de estilos, y esto), y en ambas ocasiones la desviación fue
  invisible porque nada leía la regla. Un límite que no se hace cumplir es un límite que se superará.
- **Acotar el *hover* a `base` (100ms) en su lugar.** Rechazada: a 100ms un desvanecimiento de color
  comienza a interpretarse como movimiento bajo el puntero, que es el arrastre sobre el que se escribió
  la regla.
- **Requerir `prefers-reduced-motion` para eliminar también las transiciones de *hover*.** Rechazada
  por ser una medida excesiva para esta duración: tres fotogramas de color no son el movimiento al que
  se refiere la preferencia, y la consola ya elimina los *hovers* que se mueven (la escala de la marca
  del mapa de calor) en lugar de aquellos que se tiñen. El verificador aplica esa división para las
  animaciones de fotogramas clave (*keyframe animations*), que son las verdaderas intrusiones.
