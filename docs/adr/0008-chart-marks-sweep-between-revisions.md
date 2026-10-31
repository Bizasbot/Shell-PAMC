# ADR 0008: Transición gradual de marcas en gráficos entre revisiones, revirtiendo la regla 5 de la §7

- Estado: Aceptado
- Fecha: 2026-09-17

## Contexto

La regla 5 de la sección §7 de `docs/design.md` establecía: **"Los gráficos no se animan. La geometría de los minigráficos (sparklines) se intercambia en la revisión de datos sin transición ni animación de entrada; una línea que salta a los nuevos datos se lee como honesta, no como artificial."**
Tres componentes la cumplían pasando `animate: false` a la biblioteca, y el texto explicativo justificaba la intención como una preferencia por la honestidad frente al adorno, el mismo instinto que el carácter "crudo y similar a una terminal" de `DESIGN.md` y su rechazo a las animaciones de entrada artificiales.

Dos cosas cambiaron después, y solo una de ellas fue un cambio de criterio estético.

**Los azulejos (tiles) sobre las marcas ahora se desplazan (roll).** El ADR 0007 otorgó a los seis números de KPI del panel una transición de 240ms, lo cual satisface la propia prueba de movimiento de la §7 —un cambio de estado que debe sentirse continuo—, pero dejó al panel inconsistente consigo mismo: el número indicaba "esta lectura se ha movido" mientras que el gráfico dibujado a partir de ese mismo número realizaba un corte seco, de modo que una sola revisión se interpretaba como dos eventos diferentes, uno de los cuales era un reemplazo.

**Medido, el comportamiento de la biblioteca no es lo que implica "animate".** El contenedor de React de `@ant-design/plots` no destruye ni reconstruye un gráfico cuando cambian sus propiedades: `useChart` construye el objeto de opciones y luego llama a `Plot.update()` seguido de `Plot.render()` en la *misma* instancia de ejecución de G2; nunca llama a `changeData` ni vuelve a montar el componente. Por lo tanto, una animación de `update` habilitada interpola la marca que el lector ya está viendo. Es una metamorfosis (morph), no un redibujado, y una entrada mediante dibujo (draw-in) no es lo que costaría activarla. Esa distinción es toda la decisión, porque "un repintado disfrazado de datos nuevos" era exactamente lo que la regla 5 protegía.

La medición en el minigráfico de peticiones, con un contenedor desplazado y el resto de configuraciones idénticas:

| `animate` | Fotogramas pintados durante una revisión | Forma |
| --- | --- | --- |
| `false` (regla 5 tal como estaba escrita) | 2 | la lectura anterior, luego la nueva |
| `update: { type: 'morphing' }` en el token de desplazamiento | 11-12, incluyendo intermedios | una transición gradual entre ambas |

Había que establecer dos hechos sobre estos datos antes de que valiera la pena realizar el cambio, ya que ambas eran sorpresas que una demo de aspecto convincente habría ocultado:

- **Un cambio de nivel uniforme es invisible con o sin animación.** El minigráfico no tiene eje y su dominio en el eje y está normalizado al máximo de la propia ventana (`scale.y.nice: false`, `domainMin: 0`), por lo que escalar cada contenedor por el mismo factor repinta el lienzo *píxel por píxel* (medido, no inferido). Estos son gráficos de formas: la animación es visible ante un cambio de composición, y una ventana tranquila que simplemente se vuelve más activa no mueve nada.
- **Ni `@antv/g2` ni `@ant-design/plots` leen `prefers-reduced-motion` en ninguna parte**, y la animación de actualización predeterminada de la biblioteca es un resorte (spring) de 900ms. Un gráfico que habilitara la animación sin su propio interruptor de movimiento reducido se movería con mayor intensidad precisamente para el lector que solicitó no tener movimiento.

## Decisión

1. **Se reescribe la regla 5 en lugar de eliminarla.** Una marca se transforma (morph) hacia su nueva geometría durante el `roll`, y se desvanece en lugar de crecer cuando una serie entra o sale (el contenido aparece; no vuela, y una marca que crece desde un eje reclama una dirección que los datos no poseen). El caso de entrada/salida es un desvanecimiento exactamente por la razón por la que `DESIGN.md` rechaza los adornos de entrada.

2. **Las tres marcas adoptan la misma especificación:** los seis minigráficos de KPI, la tendencia del token del modelo y el anillo de uso del modelo. Una definición compartida (`web/src/charts/chartMotion.ts`) y un token (`MOTION_ROLL`), de modo que los dígitos de un azulejo y la marca debajo de ellos se muevan al mismo ritmo y no puedan desincronizarse en la revisión.

3. **El interruptor de movimiento reducido es gestionado por la aplicación y es obligatorio.** `web/src/hooks/usePrefersReducedMotion.ts` lee la consulta de medios (media query) y la vuelve a leer cuando cambia, porque una preferencia que solo surtiera efecto al recargar rompería la promesa a mitad de sesión. `resolveChartAnimation` devuelve `false` (ni un objeto vacío ni `undefined`), ya que la biblioteca interpreta una especificación faltante como "usa tus propios valores predeterminados", que es el resorte de 900ms.

4. **La metamorfosis está limitada por la reutilización de la instancia que la convierte en tal.** Si un gráfico se vuelve a montar en una revisión (un cambio de `key`, una referencia imperativa que controle el ciclo de vida, una reescritura mediante `changeData`), la animación se convierte silenciosamente en un dibujo de entrada (draw-in) y esta decisión deja de tener validez. `dashboard-chart-motion` asegura que existan estados intermedios; un dibujo de entrada al volver a montar el componente aun así superaría esa prueba, por lo que la restricción se registra aquí y en el comentario propio del componente.

5. **El coste se acepta de forma explícita.** Una marca en lienzo se redibuja fotograma a fotograma; no es una propiedad de `transform` gestionada exclusivamente por el compositor, por lo que la regla 1 de la §7 no se cumple en estas ocho marcas. La excepción se limita a 240ms en ocho pequeños lienzos, y la regla 1 sigue aplicándose en todo lo demás, incluidos los dígitos, que son transformaciones reales.

6. **El sondeo (poll) puede mover una lectura y la marca detrás de ella, y nada más.** La fila de actualización automática de la §7 se actualiza en el mismo cambio: la vista aún no debe volver a montarse, restablecer la paginación ni reetiquetar los datos.

7. **Las aserciones se trasladan al lugar donde la afirmación es observable.** Una prueba lógica fija la especificación y su rama de movimiento reducido; el escenario del navegador `dashboard-chart-motion` ejecuta una revisión con el movimiento permitido y nuevamente después de cambiar la preferencia sobre la marcha, y valida que existan fotogramas intermedios en el primer caso y ninguno en el segundo. Ambas rutas de prueba que ya existían siguen ejecutándose con movimiento reducido, por lo que sus aserciones de píxeles se mantendrán deterministas, lo cual es una segunda razón por la cual el control es gestionado por la aplicación en lugar de ser opcional.

## Consecuencias

### Positivas

- Una revisión que el lector no solicitó ahora se interpreta como un movimiento en toda la tarjeta, y no como el reemplazo de la mitad de ella: el número se desplaza y el gráfico que describe se desliza a su lado.
- La animación es una metamorfosis porque la biblioteca reutiliza la instancia, y ese mecanismo ahora está documentado en el lugar donde un cambio futuro podría romperlo.
- La brecha de movimiento reducido es cubierta por nosotros y respaldada por una prueba, en lugar de asumir que es tarea de la biblioteca. Esa suposición habría sido incorrecta, y de manera invisible.
- La geometría del gráfico y las aserciones de renderizado en el resto de la suite no se ven afectadas: se ejecutan bajo movimiento reducido, donde las marcas siguen pintándose en un solo fotograma.

### Compensaciones (Trade-offs)

- **Un redibujado de lienzo no es exclusivo del compositor.** La regla 1 de la §7 se aplica a todo lo demás en la consola y ahora tiene ocho excepciones nombradas que el lector de la tabla de tokens debe tener en cuenta.
- **La regla 5 de la §7 deja de ser absoluta.** Pasó de ser una prohibición categórica a una afirmación acotada con dos condiciones asociadas; esa es una regla más compleja de retener durante una revisión que "los gráficos no se animan".
- **El interruptor de movimiento reducido es nuestro deber mantenerlo.** Una regresión en este aspecto sería invisible en la configuración predeterminada, razón por la cual la prueba mide ambos estados en una sola página.
- **Las marcas pueden parecer estáticas cuando el nivel cambia.** No es un defecto de esta decisión, sino su lectura errónea más probable: los minigráficos son gráficos de formas normalizadas, por lo que una revisión que escala todo de manera uniforme dibuja exactamente la misma imagen. Interpretarlo como "la animación está rota" sería fácil.
- **La nota de alcance del ADR 0007 queda reemplazada en un punto.** Registraba que "la regla 5 no se toca"; este ADR es la decisión más reciente, y el 0007 no se reescribe: sigue siendo un registro preciso de lo que se decidió en su momento.
- **La cuarta mitigación del ADR 0004 queda reemplazada.** Dicho ADR, al adoptar el entorno de ejecución de gráficos, exigía "deshabilitar explícitamente las animaciones de la biblioteca de gráficos (`animate: false`)" como un invariante visual. La regla 5 anterior reemplaza esa instrucción; las otras tres mitigaciones de la misma lista —el fragmento dedicado `vendor-charts`, la importación diferida (lazy import) y el presupuesto de empaquetado (bundle budget) aplicado— se mantienen sin cambios, y el presupuesto se ha vuelto a verificar con este cambio.

## Alternativas consideradas

- **Mantener la regla 5 y eliminar el desplazamiento de azulejos del ADR 0007, para que el panel permanezca uniformemente estático.** La opción más internamente consistente, la cual fue rechazada por la lectura que produce: un sondeo que mueve un número es precisamente donde el movimiento justifica su presencia, y revertir los azulejos para que salten cambiaría una señal real por la consistencia con una regla que la medición ya había demostrado ser demasiado amplia.
- **Animar solo el anillo.** Los arcos son la metamorfosis más legible, pero se rechazó porque los seis minigráficos son las marcas más llamativas de la página; dejar que realicen un corte seco junto a un anillo en transición genera una inconsistencia peor que la que se intenta solucionar.
- **Usar `Plot.changeData` o una referencia de gráfico imperativa.** Rechazado: el contenedor ya reutiliza el tiempo de ejecución, por lo que no se gana nada, y controlar el ciclo de vida del gráfico en React significaría reimplementar la ruta de actualización (y su validación `isEqual`) para obtener exactamente el comportamiento que ya está presente.
- **Dejar que la biblioteca decida la temporización.** Su animación de actualización predeterminada es un resorte de 900ms, de tres a cuatro veces el presupuesto de la §7 y la única curva que `DESIGN.md` prohíbe explícitamente por su nombre.
- **Controlar el movimiento mediante CSS (`@media (prefers-reduced-motion: reduce)`).** Imposible: la animación ocurre en fotogramas del lienzo, no en transiciones CSS, y la biblioteca no lee ninguna característica multimedia (media feature).
- **Una comprobación de movimiento reducido por gráfico.** Rechazado: tres componentes gestionarían cada uno su propia preferencia, y un cuarto gráfico añadido posteriormente se animaría silenciosamente para todos. Un solo gancho (hook), un solo evaluador (resolver), una sola aserción.
- **Habilitar `enter` con un crecimiento o un trazado inicial.** Rechazado: es el adorno de entrada que `DESIGN.md` rechaza, e implica una dirección que los datos no tienen.
- **Dejar la cuestión del movimiento reducido en manos del arnés de pruebas.** El arnés podría haber forzado `animate: false` en las pruebas y dejado el producto sin control, lo que habría hecho que la suite fuera determinista al tiempo que enviaba a producción el defecto que la suite existe para detectar.
