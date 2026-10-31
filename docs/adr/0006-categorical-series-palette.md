# ADR 0006: Una paleta de series categóricas es una excepción delimitada al color exclusivamente semántico

- Estado: Aceptado
- Fecha: 2026-09-15
- Puntero de archivo (2026-09-18): las seis ranuras ahora residen en `MODE_SEMANTICS` dentro de `web/src/theme/palette.ts`,
  adonde el ADR 0011 trasladó las paletas, y `seriesTrack` es el paso de `border` del modo, asignado por
  `derivePalette`. **Cualquier referencia a
  `themeConfig.ts` en la Decisión y Consecuencias a continuación es histórica**; ese archivo ahora es únicamente la proyección de Ant
  Design. La decisión en sí no ha cambiado y este ADR sigue siendo su registro.
- Paleta complementaria (2026-10-17): los carriles del mapa de enrutamiento en vivo constituyen un segundo uso categórico del tono.
  Utilizan sus propias ranuras `--route-*` exclusivamente frías en lugar de las ranuras de series, porque un carril no tiene
  leyenda a su lado y una línea con color de estado se interpretaría como un veredicto sobre la conexión. La
  separación de roles en este ADR se mantiene: `success`/`warn`/`danger` siguen siendo operacionales, y las superficies
  de los nodos —no las líneas— transmiten el resultado de una solicitud. Véase `docs/design.md` §2 y el ADR 0102.

## Contexto

La sección §1 de `docs/design.md` establece la regla de color de la aplicación como **"Color exclusivamente semántico: verde/rojo/ámbar significan habilitado/error/advertencia, nunca decoración"**, y cada token de color en `themeConfig.ts` y `index.css` la cumple: `success`, `warn`, `danger` y `accent` transmiten un veredicto o una posibilidad de interacción. El script `scripts/test-chart-marks.ts` consolida esta consecuencia, afirmando que cada `ChartTone` se resuelve en un token de paleta distinto y que `neutral` nunca se resuelve en el acento.

El siguiente incremento del panel de control añade dos gráficos sobre la cuadrícula de actividad de tokens: una **tendencia de tokens por modelo** (una línea por modelo en la ventana seleccionada) y un **anillo de uso de modelos** (la cuota de tokens de la ventana correspondiente a cada modelo, junto con una lista ordenada). Leídos conjuntamente, responden a la pregunta "¿en qué modelos está gastando realmente este despliegue y cuándo?", una pregunta que los seis paneles de KPI ocultan al sumar todos los modelos en un único número.

Esto infringe la regla de color existente en lugar de ampliarla, y la presión surge de dos direcciones simultáneas:

1. **La identidad de un modelo no es un veredicto.** Una lista de modelos es simplemente aquello que el despliegue sirve en un momento dado: nombres ascendentes, revisiones fechadas, alias por proveedor. Es abierta y carece de un eje bueno/malo. No hay nada a lo que un tono semántico pueda *dar significado*.
2. **Los tokens existentes no se pueden reutilizar para este propósito.** Alternar `accent`/`success`/`warn`/`danger` entre series situaría una línea verde etiquetada como "modelo B" junto al indicador verde que significa "credencial saludable" y a la insignia verde de tasa de aciertos que significa "alta tasa de aciertos". Un mismo tono transmitiría entonces tanto una categoría como un estado, y ambas lecturas se degradarían —lo cual es peor que infringir la regla, ya que también destruye los colores semánticos de los que depende el resto de la consola.

Por lo tanto, la elección consistía en descartar el requisito de múltiples series, alternar los tonos de estado o admitir una segunda familia de colores claramente separada que transmita identidad y nunca un veredicto.

## Decisión

**Introducir una paleta de series categóricas como una excepción delimitada y documentada —no como una relajación de la regla.**

1. **Seis tokens de serie, `series 1`–`series 6`, en ambos temas**, definidos en
   `web/src/theme/themeConfig.ts` (`palette[mode].series`) y reflejados como
   `--series-1`…`--series-6` en `web/src/index.css`. Se consumen únicamente a través de
   `seriesColor(mode, index)` en `web/src/charts/chartTheme.ts`.

2. **La ranura representa la identidad, y la *familia* sobrevive a un cambio de tema.** `seriesColor(mode, 0)` es
   la familia azul en ambos temas, `1` la familia esmeralda, y así sucesivamente; solo difiere el paso de luminosidad,
   ya que los pasos brillantes son ilegibles sobre una tarjeta clara (el propio paso brillante del acento ofrece una relación de contraste de 2.78:1
   en ese entorno, la misma medición que produjo la escala de acentos). Por consiguiente, un modelo conserva su color cuando el operador cambia de tema, lo cual permite que los colores de ambos paneles sean comparables ante un cambio de preferencias.

3. **Separación de roles entre datos categóricos y estado operacional.** Los colores de series categóricas codifican categorías cualitativas, no estados de salud booleanos; por lo tanto, la restricción **no** consiste en evitar que el tono de una serie coincida con los tonos de estado (una línea ámbar no es una advertencia cuando la leyenda contigua nombra a un modelo).
   La restricción exige que ambos roles nunca dependan de la misma señal. `success`/`warn`/`danger` se reservan exclusivamente para la operación, y cada panel que muestre una categoría la indica explícitamente en formato de texto: la leyenda de la tendencia nombra a cada grupo y la lista de uso imprime el nombre, volumen y participación de cada grupo. La secuencia alterna familias cálidas y frías (azul, esmeralda, púrpura, coral, ámbar, cian) para que un tono cálido aparezca en una ventana ordinaria de dos o tres modelos en lugar de quedar relegado únicamente a una cola larga.

   Las restricciones que sí se comprueban mecánicamente mediante `scripts/test-chart-marks.ts` son las siguientes: cada color de serie se resuelve en su propio valor y supera el umbral de contraste para objetos gráficos de WCAG 3:1 frente a la tarjeta sobre la que se dibuja; las entradas de leyenda adyacentes difieren al menos en 25 ΔE en el espacio CIE Lab para evitar que dos vecinas se confundan en una sola muestra; y las seis propiedades personalizadas de la hoja de estilos coinciden carácter por carácter con `themeConfig.ts` para impedir que ambas copias diverjan.

   Estas son **limitaciones, no garantías de accesibilidad.** La distancia Lab y el contraste WCAG son medidas ordinarias de percepción y luminancia: descartan que dos colores sean efectivamente idénticos o que un color sea demasiado oscuro para leerse, pero no indican cómo percibe la paleta una persona con deficiencia en la visión del color. Validar esto requiere una simulación validada y, preferiblemente, una revisión humana, recursos de los que este repositorio carece, por lo que no se formula tal afirmación.

4. **El color se asigna a partir de una clasificación compartida, no por panel.** El dominio es una *clave* por grupo —`model:<name>` o el discriminador agrupado— en lugar de la etiqueta de presentación, de modo que un modelo real cuyo nombre coincida con la etiqueta traducida del resto no pueda apropiarse del color del resto. A continuación, el rango se genera en orden de clasificación, lo que significa que el color de un grupo sigue a su rango: se mantiene estable mientras lo haga la clasificación y puede cambiar cuando esta varíe. Lo que aporta esta clasificación compartida es que la línea de tendencia y la porción del anillo correspondientes a un grupo nunca presenten dos tonos diferentes, ya que son dos vistas de una misma respuesta, y la leyenda situada junto a cada panel siempre especifica qué color pertenece a cada modelo.

5. **La excepción se limita a los gráficos categóricos.** El mapa de calor continuo de tokens, la escala de tasas de acierto, los indicadores de estado y cualquier color interactivo permanecen inalterados y conservan su naturaleza semántica. La sección §2 de `docs/design.md` documenta tanto la paleta como este límite.

## Consecuencias

### Positivas

- Los paneles de modelos pueden distinguir seis grupos sin apropiarse de un significado, y los tokens semánticos conservan exactamente un significado en cualquier otra parte de la consola.
- Ambos paneles comparten una clasificación y, por lo tanto, una asignación de color idéntica, por lo que la línea de un modelo y su porción en el anillo no pueden contradecirse —ni siquiera tras un cambio de tema, situación que habría roto silenciosamente una selección de color dependiente de cada componente.
- Los límites mensurables se miden y se comprueban mediante afirmaciones automáticas (legibilidad frente a la tarjeta, separación entre vecinos y concordancia entre las dos copias de los tokens), lo que permite revisar la secuencia sin necesidad de rebatir la regla.
- Ambas representaciones son componentes nativos de `@ant-design/charts` (`Line`, `Pie`) dentro del fragmento (`chunk`) existente de carga diferida `vendor-charts`, por lo que la excepción no genera un coste de ejecución adicional y el presupuesto del paquete (`bundle`) se mantiene intacto.

### Compensaciones y compromisos

- **La sección §1 de `docs/design.md` incluye ahora una excepción, y una excepción constituye un precedente que modificaciones futuras podrían ampliar.**
  La mitigación consiste en que se encuentra documentada en un único lugar junto con su justificación, y en que su ámbito está acotado por roles: estos tokens pertenecen a marcas categóricas, mientras que los roles de estado, interacción y rampa cuantitativa no se ven afectados.
- **El color nunca es el único mecanismo de codificación, y ambos paneles se han diseñado bajo este principio.** Un lector incapaz de diferenciar dos tonos puede recurrir a los nombres de la leyenda y a los números de la lista de uso, razón por la cual a ningún panel se le permite depender exclusivamente de una muestra de color.
- **Existen seis ranuras; una séptima serie volvería a utilizar el primer color.** Actualmente ninguna funcionalidad solicita más —la clasificación conserva cinco modelos nombrados más un remanente— y el ciclo es deliberado, pero es posible que dos modelos compartan un tono si dicho límite se incrementa en el futuro.
- **La paleta representa un segundo conjunto de valores literales de color que deben mantenerse en dos temas.** Consiste en dos arrays de seis valores en `themeConfig.ts` más seis propiedades personalizadas en `index.css`. El script `test-chart-marks.ts` comprueba las propiedades de `themeConfig.ts` y contrasta las copias de la hoja de estilos con este, de modo que modificar un token en un lugar y omitirlo en el otro provoca un fallo en la suite de pruebas.
- **Un tono categórico no es relativo a ningún valor absoluto.** A diferencia de la rampa del mapa de calor, que se escala en función de la ventana, estos colores son etiquetas arbitrarias: el lector aprende la correspondencia a partir de la leyenda en el propio panel y no de alguna propiedad inherente del color. Esto es intrínseco a una codificación categórica y no un defecto de esta elección, pero explica por qué la leyenda se muestra siempre.

## Alternativas consideradas

- **Alternar `accent`/`success`/`warn`/`danger` entre las series.** No requiere nuevos tokens ni cambios en la documentación; se desestimó porque provoca que un mismo tono signifique tanto una categoría como un estado. El indicador verde del panel de tasa de éxito y una línea verde para el "modelo B" convivirían en la misma página.
- **Representar cada serie utilizando el color de acento con diferentes opacidades.** Conserva un único tono y deja la documentación intacta, pero la opacidad constituye una codificación de *cantidad*: dos modelos con volúmenes similares se volverían indistinguibles, que es exactamente la comparación que estos paneles pretenden facilitar. Asimismo, entra en conflicto con la rampa del mapa de calor, la cual ya utiliza la luminosidad del acento para representar una cantidad continua.
- **Una rampa secuencial de un solo tono vinculada a la clasificación.** Solo permite distinguir rangos adyacentes y provoca que el color de un modelo varíe a medida que cambia su rango, introduciendo la misma inestabilidad que la vinculación posicional.
- **Permitir que la biblioteca utilice su valor predeterminado de fábrica.** Implica un sistema visual diferente (el valor predeterminado de G2 es más frío y saturado que el grafito neutral de esta consola), carece de adaptación a temas y situaría valores literales de color fuera de los dos archivos autorizados para definirlos.
- **Agrupar todos los modelos en una única línea y porción.** Representa el cambio más simple y prescinde por completo de la paleta, pero desecha la lectura por modelo que motivó la creación de ambos paneles, dejando el total de los paneles de KPI representado por duplicado.
