# Shell-PAMC · Tokens de marca y de tema

Única fuente de verdad del sistema visual. La densidad de información y los patrones pensados para
ingenieros se inspiran en consolas minimalistas para desarrolladores; el logotipo tipográfico de la marca, las paletas, la arquitectura
de información de CPA y los límites de seguridad pertenecen a Shell-PAMC.
La paleta se declara y se deriva en código en:

- `web/src/theme/palette.ts` — los nueve tokens autorados por paleta, los dieciocho tokens derivados y
  las paletas registradas
- `web/src/theme/themeConfig.ts` — la proyección de `ThemeConfig` de antd
- `web/src/index.css` — las propiedades personalizadas del respaldo previo a la hidratación en `:root`

**Regla: nunca escribas un color fijo en los componentes.** Lee la paleta resuelta o usa la variable CSS.

**Regla: las tablas de §2 se generan, no se redactan a mano.** Dieciocho de los tokens de una paleta se calculan
a partir de los otros nueve (`derivePalette`), de modo que un valor de aquí que discrepe de la función es un defecto de
este documento. Cambiar un token *autorado* es un cambio de una línea más las tablas que mueve; cambiar una
*relación* - cómo se relaciona un relleno de hover con la página, qué tan profundo llega un control relleno - implica cambiar una
constante en `palette.ts`, y los números de las tablas de abajo y de `DESIGN.md` se mueven con ella. Nada
de esto se ajusta ya a mano, y eso es lo que hace que la paleta propia de un operador sea el mismo tipo de objeto que una
paleta registrada; véase `docs/adr/0011-theme-modes-and-derived-palettes.md`.

## 1. Lenguaje de diseño

Un panel tranquilo sobre un lienzo (ADR 0103). La navegación se apoya en el lienzo; la página se dibuja sobre
un único panel redondeado y empotrado; todo lo que el lector invoca se eleva de ese panel con una sombra suave.
La estructura estática es un relleno y una línea fina, la agrupación es un recinto y no una división, el texto
de la interfaz se lee en la Sarasa Mono SC incluida salvo que el operador elija otra tipografía, y el movimiento es breve,
desacelerado y nunca decorativo. Denso donde los datos son densos, generoso donde se lee una página.

| Principio | Significado |
| --- | --- |
| Dos capas de marco | La barra lateral sobre `--canvas`, el trabajo sobre el panel `--bg`; el borde del panel es la única separación entre ambos |
| Plano hasta que se invoca | Las tarjetas, las tablas y el layout no llevan sombra; los menús, popovers, avisos, diálogos y hojas se elevan con `--shadow-float` / `--shadow-overlay` |
| Recinto, no división | Un grupo es un recinto de línea fina sobre el fondo propio de la página; las filas de su interior se separan con una regla discontinua empotrada |
| Controles discretos | Un control secundario es un velo de primer plano, no un contorno; las líneas finas pertenecen a lo que encierra contenido |
| Roles tipográficos | El texto de la interfaz usa la pila UI (Sarasa Mono SC por defecto); el código y los datos alineados usan la pila mono, con numerales tabulares |
| Marco discreto, datos llamativos | El andamiaje de la interfaz permanece atenuado; el color de estado se reserva para el estado real |
| Solo color semántico | Verde/rojo/ámbar significan habilitado/error/advertencia — nunca decoración |

## 2. Paleta de colores

Una paleta son **nueve tokens autorados y dieciocho derivados**. `web/src/theme/palette.ts` declara el
conjunto autorado y calcula el resto; `docs/adr/0011-theme-modes-and-derived-palettes.md` registra la
fórmula, sus constantes calibradas y los lugares donde aplicarla cambió los valores de abajo. Nada de
esta sección se ajusta ya a mano, de modo que un valor de aquí que discrepe de `derivePalette` es un defecto de
este documento y no una excepción de paleta - `scripts/test-theme-presets.ts` comprueba el respaldo de la
hoja de estilos contra la misma función, aunque no puede leer esta tabla.

**Un paso visible en ambos modos.** Las mezclas de la derivación son fracciones de las distancias propias de una paleta,
y las distancias de una paleta clara son cortas, de modo que una regla suave y la cuadrícula de un gráfico
derivada de ella solían quedar en aproximadamente la mitad del paso perceptual que los mismos tokens alcanzan en una página oscura,
y la cuadrícula de la tendencia desaparecía en modo claro. Por eso `--border-soft` se sitúa al menos 0.06 de luminosidad OKLCH
separado de `--bg` (`BORDER_SOFT_FLOOR` en `palette.ts`). La luminosidad OKLCH es perceptual, así que un
umbral es un paso visible en cualquiera de los modos; las paletas oscuras integradas ya lo superan, y la paleta clara tenue
de un operador se eleva hasta él. El borde y la superficie de OMC Light se profundizaron hasta los pasos de la paleta
oscura por la misma razón. El hover conserva su mezcla: es el fondo contra el que se ajustan los tonos
fijos de las insignias de esfuerzo.

### Los tokens autorados

| Token | Rol | Umbral de contraste frente a `--bg` |
| --- | --- | --- |
| `--bg` | la página misma | - |
| `--surface` | tarjetas y paneles | paso de capa |
| `--elevated` | menús, popovers, diálogos | paso de capa |
| `--fg` | texto principal | 4.5:1 |
| `--fg-2` | texto secundario | 4.5:1 |
| `--muted` | pistas, leyendas, etiquetas, texto de ejes de gráficos | 3:1 |
| `--meta` | etiquetas de grupo, notas al pie, texto de marcas de gráficos | 2:1 |
| `--border` | bordes de 1px, divisores de fila, reglas de la cuadrícula de gráficos | paso de capa |
| `--accent` | enlaces, información, barras activas, la rampa del mapa de calor | 4.5:1 |

Los umbrales son los que las seis paletas registradas cumplen en la práctica, y son aquellos contra los que informa el editor
de paletas personalizadas. Una paleta nunca se *rechaza* por no cumplir uno: el editor indica la razón y la
consola muestra lo que el operador pidió.

### OMC Dark (predeterminada)

| Token | Valor | Mapeo en antd | Uso |
| --- | --- | --- | --- |
| `--bg` | `#121214` | `colorBgBase`, `colorBgLayout`, `colorBgContainer` | Fondo de la aplicación, entradas, tablas |
| `--surface` | `#1c1c1f` | `colorBgElevated`, `colorFillQuaternary` | Tarjetas, paneles, desplegables, estados de hover |
| `--elevated` | `#222226` | `colorBgElevated` para superposiciones | Menús, popovers, diálogos |
| `--fg` | `#f4f4f6` | `colorText`, `colorTextBase` | Texto principal |
| `--fg-2` | `#a1a1aa` | `colorTextSecondary` | Texto secundario |
| `--muted` | `#71717a` | `colorTextTertiary` | Pistas, leyendas, etiquetas, reglas de la mira del gráfico |
| `--meta` | `#52525b` | `colorTextQuaternary` | Etiquetas de grupo, notas al pie |
| `--border` | `#2c2c30` | `colorBorder` | Bordes principales de 1px |
| `--accent` | `#00a2fb` | `colorInfo`, `colorLink` | Enlaces, información, barras activas, selección |
| `--accent-hover` | `#0579bd` | `colorPrimary` | Botones primarios rellenos |
| `--accent-active` | `#025e94` | `colorPrimaryHover/Active` | Un control relleno, con hover o presionado |
| `--accent-on` | `#ffffff` | `Button.primaryColor` | Etiqueta dibujada sobre un control de acento relleno |
| `--success` | `#10b981` | `colorSuccess` | Indicador de habilitado / sano / ok |
| `--warn` | `#f59e0b` | `colorWarning` | Degradado / advertencia de cuota |
| `--danger` | `#ef4444` | `colorError` | Fallido / deshabilitado / eliminar |

**Derivados** (calculados, listados como referencia): `--canvas` `#09090a`, `--border-soft` `#212124`, `--hover`/`--row-hover` `#272729`,
`--selected-inset` `#2e2e37`, `--hover-inset` `#121214`, `--tooltip-bg` `#1c1c1f`, `--heatmap-quiet`
`#212124`, `--heatmap-busy` `#00a2fb`, `--heatmap-zero-recorded` `#2c2c30`,
`--heatmap-zero-unrecorded` `#212124`, `--heatmap-tip-link` `#00a2fb`, `--series-track` `#2c2c30`,
`--cache-rate-yellow` `#f59e0b`, `--cache-rate-green` `#10b981`. Los seis pasos `--effort-*` son
constantes por modo; véase la escala de esfuerzo de razonamiento más abajo.

### OMC Light

| Token | Valor |
| --- | --- |
| `--bg` | `#ffffff` |
| `--surface` | `#f1f1f3` |
| `--elevated` | `#ffffff` |
| `--fg` | `#1c1c1e` |
| `--fg-2` | `#505055` |
| `--muted` | `#787880` |
| `--meta` | `#98989f` |
| `--border` | `#dcdce1` |
| `--accent` | `#005d8f` |
| `--accent-hover` | `#004a73` |
| `--accent-active` | `#023b5d` |
| `--accent-on` | `#ffffff` |

**Derivados**: `--canvas` `#f5f5f5`, `--border-soft` `#ebebee`, `--hover`/`--row-hover` `#f3f3f3`, `--selected-inset` `#eaedef`,
`--hover-inset` `#f2f2f2`, `--tooltip-bg` `#1c1c1e`, `--heatmap-quiet` `#ebebee`, `--heatmap-busy`
`#005d8f`, `--heatmap-zero-recorded` `#dcdce1`, `--heatmap-zero-unrecorded` `#ebebee`,
`--heatmap-tip-link` `#005d8f`, `--series-track` `#dcdce1`, `--cache-rate-yellow` `#b45309`,
`--cache-rate-green` `#059669`.

### Paletas registradas

Tres por modo. Una paleta pertenece a un modo - sus nueve tokens se eligen para las superficies de ese modo, y
su escala de texto apunta en una sola dirección - por lo que la página de ajustes ofrece una paleta oscura solo mientras la consola
lee paletas *para* oscuro, sea cual sea el modo en vigor.

| Paleta | Modo | `bg` autorado | Acento |
| --- | --- | --- | --- |
| OMC Dark | oscuro | `#121214` | `#00a2fb` |
| Midnight | oscuro | `#0d1117` | `#58a6ff` |
| Forest | oscuro | `#0e1411` | `#6ee7a8` |
| OMC Light | claro | `#ffffff` | `#005d8f` |
| Porcelain | claro | `#f7f8fa` | `#0b6e99` |
| Sandstone | claro | `#f8f3e8` | `#0f766e` |

Un **modo de tema** es claro u oscuro; cada modo guarda una paleta. El encabezado y los ajustes ofrecen solo estas dos opciones. Las preferencias heredadas de seguir al sistema siguen siendo legibles hasta que se selecciona un modo explícito. La paleta resuelta es
la única fuente para el `ConfigProvider` de Ant Design, las propiedades personalizadas CSS escritas en la raíz del documento,
las series categóricas de gráficos/anillos, el tema de Monaco y la rampa del mapa de calor de tokens. `web/src/index.css` conserva
OMC Dark y OMC Light como respaldo previo a la hidratación y `themePaletteCssVariables` aporta los valores de
ejecución de cada paleta; ambos se comprueban iguales para esas dos paletas, de modo que el primer fotograma pinta la
misma consola a la que se resuelve la paleta. `omc-theme` guarda el documento completo de preferencias - modo, una referencia de paleta
por modo y cualquier paleta autorada - y un id de paleta suelto o un `dark`/`light` suelto de una
compilación anterior se sigue leyendo.

Una **paleta autorada por el operador** lleva consigo la paleta registrada de la que partió, que es a lo que vuelve su
restablecimiento, y ningún nombre: se etiqueta `omc.palette_custom` en el idioma de lectura, porque la muestra
junto a la etiqueta ya dice cómo se ve y un nombre sería la única cadena de la consola que
no podría traducirse. Tanto la paleta de partida como los tokens a los que se restablece proceden del mismo modo,
por la razón por la que se agrupan las paletas. El editor informa del contraste de cada token autorable frente a la página, juzgado
contra el umbral que lleva el rol propio de ese token (véase la tabla anterior) - los pasos de superficie y borde son
capas y no responden a ningún umbral de texto, por lo que una paleta correcta no muestra ninguna advertencia.

Una paleta también declara `accentOn`: el color de etiqueta de un control de acento relleno. Llega a Ant
Design como `Button.primaryColor` y a la hoja de estilos como `--accent-on`, porque el valor por defecto propio de
`Button.primaryColor` en Ant Design es `colorTextLightSolid` - blanco en todas las paletas - y una paleta cuyo
relleno de acento es claro no puede llevar una etiqueta blanca. Se **calcula, nunca se autora**: la derivación elige
el que mejor se lea sobre el relleno entre blanco y casi negro, y el relleno se profundiza hasta que uno de ellos
alcanza **4.5:1**. La etiqueta de toda paleta lo alcanza, y la comprobación del registro rechaza una paleta que no lo haga.

La página de Ajustes de Shell-PAMC presenta dos grupos de tarjetas con nombre con una vista previa de cuatro muestras, uno por modo, y
la última tarjeta de cada grupo es la propia del operador. El control del encabezado presenta únicamente el modo. Los controles
de apariencia no deben introducir una segunda fuente de paletas: ambos leen el registro, por lo que las paletas nuevas extienden
`web/src/theme/palette.ts`, y las comprobaciones de derivación, contraste y espejo de
`scripts/test-theme-presets.ts` fallan si una paleta está incompleta o es ilegible.

### Escala de acento

El acento **no** es invariable entre modos. Es un solo tono (201) en tres pasos de luminosidad, y cada tema
usa una asignación distinta porque el mismo azul no puede ser a la vez legible como texto en una página clara y
legible como texto en una oscura:

| Paso | Oscuro | Claro | Uso medido |
| --- | --- | --- | --- |
| `--accent` | `#00a2fb` | `#005d8f` | texto de enlace: **6.74:1** sobre el fondo oscuro, **7.09:1** sobre el claro |
| `--accent-hover` | `#0579bd` | `#004a73` | etiqueta blanca sobre un control relleno: **4.69:1** y **9.43:1** |
| `--accent-active` | `#025e94` | `#023b5d` | estado presionado: la misma etiqueta se lee a **6.93:1** y **11.76:1** |
| `--accent-on` | `#ffffff` | `#ffffff` | la etiqueta sobre un control relleno — el color contra el que se miden los dos pasos de control relleno anteriores |

Los dos modos comparten el tono y ningún valor. Cada paleta autora su propio paso de enlace, y `derivePalette`
calcula a partir de él los dos pasos de control relleno: un paso proporcional de luminosidad OKLCH, y luego ambos rellenos
se profundizan juntos hasta que una tinta de etiqueta alcanza 4.5:1 tanto sobre el relleno en reposo como sobre el presionado. El paso de enlace de
Shell-PAMC Light es el más profundo `#005d8f` porque el brillante `#00a2fb` se lee a **2.78:1** contra blanco -
que es tanto la página clara como la etiqueta de un control relleno - por lo que solo puede ser el
color de texto del tema oscuro.

El arte de la marca sigue los mismos tokens: los acentos del logotipo tipográfico y sus letras se dibujan a partir de
la paleta resuelta, de modo que un cambio aquí mueve el logotipo con él — incluido el acento propio de un operador. Véase
`web/src/assets/brand/markup.ts`.

La marca tiene dos dibujos. El logotipo tipográfico se usa dondequiera que haya ancho para él. El símbolo es el
dibujo cuadrado para la barra lateral contraída, la página de autorización del Agent y el favicon: un anillo sobre la
cuadrícula de letras del logotipo (borde exterior redondeado, hueco interior casi cuadrado, trazo de un cuarto de la caja), cortado
dos veces, con su esquina inferior final en el acento — un indicador con parte de su asignación ya gastada. El
anillo es `--fg` y la esquina es `--accent`. `web/public/favicon.svg` se escribe a partir del mismo dibujo
con `pnpm sync-brand` y contiene las dos paletas predeterminadas detrás de `prefers-color-scheme`, porque una
pestaña del navegador no tiene un tema de consola que seguir; `pnpm check-brand` falla cuando está desactualizado.

Éxito, advertencia y peligro son constantes por modo y no tokens derivados (`MODE_SEMANTICS` en
`web/src/theme/palette.ts`): `#10b981` / `#f59e0b` / `#ef4444` en modo oscuro, `#059669` / `#b45309` /
`#dc2626` en modo claro.

### Semántica de los indicadores de estado

`ok/loaded → success` · `degraded/quota → warn` · `invalid/error/401 → danger`
· `inactive/offline/disabled → meta (gris)`. Los indicadores son puntos redondos de 6–7px.

**Un indicador por veredicto.** Un indicador etiqueta el estado del número sobre el que está, de modo que una
fila que muestra una tasa y sus dos componentes lleva un solo indicador — sobre la tasa. Los componentes
llevan el estado con su propio color: un recuento de fallos es `danger`
cuando es mayor que cero y `meta` cuando no lo es, porque "0 fallos" no es un
éxito digno de pintarse de verde.

**Solo un veredicto recibe indicador.** Los segmentos del filtro de resultado de la consola de solicitudes
(Success / Failed) reutilizan la viñeta cuadrada de la columna Result en su token success/danger,
pero el segmento All no lleva ninguna: es la ausencia de un veredicto, y
ambas viñetas juntas se leerían como un tercer resultado combinado. Misma regla que las
bandas de la tasa de éxito — el estado de "todo" no es un estado.

**La tasa de éxito es un veredicto sobre una banda publicada.** Toda superficie que muestra una tasa de éxito
la colorea mediante `successRateTone`
(`web/src/types/usageEventMetrics.ts`), de modo que el mismo número no puede ser verde en una
página y ámbar en otra:

| Tasa | Veredicto |
| --- | --- |
| sin tráfico, o una tasa ilegible | `neutral` — nada que juzgar |
| ≥ 80% | `success` — sirviendo |
| 50% – < 80% | `warn` — degradado |
| < 50%, incluido exactamente 0% | `danger` — averiado |

El mosaico de solicitudes del panel toma ese tono para su indicador; las filas de proveedores lo toman
como el color de las dos marcas que leen una misma tasa — el número de la tasa y el
medidor contiguo. El número lo lleva además del medidor porque el relleno de un medidor *es* la tasa:
con un 0% medido no tiene ancho, así que sin el número la peor fila de la página no mostraría nada de rojo
y se leería como una inactiva. Una ventana sin tráfico es *incognoscible* y no mala, por lo que permanece `neutral` y
no cae en el paso de alarma, mientras que un 0% medido es una caída real y sí cae.
La lista de solicitudes no muestra un veredicto propio, por la razón siguiente.

### La latencia no es un veredicto

La lista de solicitudes imprime la latencia en `--fg` plano en todos los valores. Una duración larga
no es un fallo cuando la carga incluye agentes: una solicitud que piensa durante
minutos está haciendo su trabajo, y la antigua regla `>= 4000 ms → amber` pintaba el tráfico normal
como degradado. La latencia se lee contra su propia línea base (la cascada TTFT/stream
del panel de detalle), nunca contra un umbral absoluto, y los tonos
semánticos se reservan para el estado.

### La lista de solicitudes no lleva franja de resumen

La página solía abrir con una fila de agregados — recuento de páginas, tasa de éxito con un
indicador, latencia media, tokens, coste estimado. Se eliminó, y la regla que
vulneraba merece conservarse:

- **Cuatro de los cinco números repetían las filas situadas justo debajo.** El recuento
  de páginas está en el pie, y los totales son sumas de la página visible, no de la
  ventana — así que cambiaban de significado cada vez que el lector paginaba o filtraba, sin
  avisarlo, y medían solo la página cargada en lugar de lo que el lector
  cree que miden.
- **La única lectura que no era una repetición era el indicador de la tasa de éxito, y
  respondía a una pregunta que la lista ya responde por fila.** La tasa de fallos de una pasarela
  es una preocupación del panel: es una propiedad de una *ventana*, y el panel
  es dueño de las ventanas. La lista es dueña de las solicitudes individuales. Poner un veredicto de ventana
  sobre una muestra del tamaño de una página (100 filas) hacía que un fallo entre 100 se leyera como un fallo del 1%
  — exactamente la mala lectura que produjo la queja de que el 98% aparece en ámbar.
- **Una lista no es una vista de KPI.** La franja consumía una fila completa de espacio vertical
  sobre los datos que resumía, de modo que en una ventana de 900px el 10% de la altura se iba en
  información ya disponible más abajo.

Los totales pertenecen allí donde entra toda la ventana: los mosaicos del panel y el
panel de detalle de una solicitud. Si alguna vez vuelve a hacer falta una cifra por página,
pertenece al pie junto al recuento de páginas, enunciada como cifra de página.

### Una celda de solicitud responde una sola pregunta

Cada columna de la lista de solicitudes responde una pregunta sobre la solicitud, y una celda que empieza a
responder una segunda se divide. La celda de modelo solía llevar el nombre del modelo, un icono de no streaming,
una etiqueta de preflight, el modelo sustituido y el esfuerzo de razonamiento; tres líneas apiladas hacían que la fila fuera
más alta que sus vecinas, y quien buscaba "qué modelo" tenía que leer "cómo se
pidió" para encontrarlo.

| Columna | Pregunta | Contiene |
| --- | --- | --- |
| Provider | ¿Qué proveedor respondió y con qué credencial? | El nombre del proveedor con una insignia `OAuth` cuando la credencial lo es, y luego la credencial en la segunda línea: la cuenta para OAuth, la clave enmascarada para una clave de API. Ambas líneas se componen igual en cada fila, de modo que la primera es siempre un proveedor y la segunda siempre una credencial. |
| Model | ¿Qué modelo respondió? | El modelo de la llamada por defecto (el modelo solicitado en la vista de modelo solicitado). Un alias muestra su upstream enrutado en una segunda línea neutra `--fg-2`; una sustitución servida tiene prioridad en esa línea en `--warn`, y el detalle del enrutamiento se conserva en el tooltip. Una etiqueta de preflight se queda aquí porque califica lo que es el registro. |
| Mode | ¿Cómo se hizo la solicitud? | La insignia de esfuerzo de razonamiento en su escala, y luego una marca rellena de 18px por cada desviación de una llamada ordinaria en streaming: un rayo relleno en `--accent` cuando el nivel de servicio de la respuesta fue `fast` o `priority`, y el glifo de difusión tachado para una respuesta sin streaming. Un guion largo cuando no hay nada que decir. |

Reglas:

- **Una fila ocupa dos líneas como máximo**, de modo que todas las filas miden lo mismo, 72px, y la estimación de la lista virtual
  se cumple. Un tercer dato necesita otra columna o el panel de detalle, nunca una tercera línea.
- **Una marca enuncia una desviación, nunca lo habitual.** Una solicitud en streaming no lleva marca de "streaming",
  y el nivel de servicio solicitado (`auto`) se queda en el panel.
- **Toda marca tiene una lectura textual**: la insignia de esfuerzo imprime su nivel, y una marca de icono lleva un
  nombre accesible y el tooltip compartido de la lista.
- **Solo las dos columnas de nombre se flexibilizan.** Provider y model toman el ancho sobrante; toda columna de cifras, insignias
  y marcas es una pista rígida, porque su contenido tiene un ancho conocido y cualquier parte que tomara
  saldría de los nombres que se truncan.

### Las opciones de filtro llevan la marca que llevan sus filas

Una opción de modelo, proveedor o credencial en la barra de filtros y en el panel "More filters" está
encabezada por una marca de 16px: un modelo toma la marca de su fabricante según la regla de Model Square (el glifo genérico de caja
en `--muted` donde no se conoce fabricante), y un proveedor o una credencial se resuelve mediante el
resolvedor propio de la fila de solicitud, de modo que un icono personalizado definido en la página de proveedores o el logotipo de un plugin
es la misma imagen en la opción y en las filas que deja en pantalla. La etiqueta sigue siendo el
texto buscable y asume el truncado; la marca nunca se encoge. Los vocabularios cerrados de palabras
(tipo de autenticación, esfuerzo de razonamiento, nivel de servicio, ejecutor) no llevan marca.

### El filtro por patrón

"More filters" termina sus campos de texto con un control compuesto: un selector de campo unido a un
campo de patrón en la tipografía mono. Es un solo filtro - un chip ("Model matches ^claude-"),
un recuento, una eliminación - porque un patrón sin su campo no significa nada. La pista bajo
él enuncia las tres cosas que un lector no puede adivinar: la sintaxis es RE2, la coincidencia es en cualquier punto
del campo, y distingue mayúsculas de minúsculas salvo que el patrón empiece por `(?i)`. El panel
rechaza solo lo que es seguro antes de un viaje de ida y vuelta (longitud, lookaround, referencias inversas); el
servidor es la autoridad en el resto.

### Seleccionar solicitudes y exportarlas

Cada fila empieza con una casilla en su propia pista de 20px, y la casilla del encabezado habla por
la página cargada. Marcar una casilla nunca abre el registro que tiene debajo; Shift extiende la serie desde el último
clic simple, seleccionándola o limpiándola. La selección sobrevive a la paginación y se descarta cuando
cambian los filtros o la ventana, porque entonces nombraría filas que el lector ya no puede ver.

- **La casilla se dibuja desde la paleta, no se deja al navegador.** Una casilla nativa es el
  relleno propio del sistema en cualquiera de los temas. En reposo: `--bg` con un borde de 1px `--muted` (el límite de un control
  supera 3:1 donde `--border`, un divisor, no lo hace). Marcada o mixta: el
  paso de control relleno `--accent-hover` con una marca `--accent-on`, `--accent-active` al pasar el cursor -
  el mismo par que usa el botón primario, legible en ambos temas. Con colores forzados
  vuelve al dibujo del sistema.
- **La barra de selección existe solo mientras haya algo seleccionado.** Enuncia el recuento, repite
  "select all" (el diseño apilado no tiene fila de encabezado), limpia, y lleva la única acción
  primaria, Export. Se sitúa dentro del marco de la lista sobre el encabezado, de modo que las columnas no se mueven.
- **El encabezado no lleva canal de barra de desplazamiento.** La lista virtual dibuja su propia barra superpuesta
  y no cede ancho a ninguna, de modo que el encabezado y las filas son la misma cuadrícula con el mismo ancho.
  Rellenar el encabezado para una barra nativa desplazaba progresivamente todas las pistas flexibles.
- **Las columnas se separan por 16px.** Las cifras alineadas a la derecha terminan en el mismo borde que su
  encabezado, y el hueco evita que una cifra alineada a la derecha toque la columna alineada a la izquierda que la sigue.

Export ofrece dos formatos bajo un mismo conjunto de opciones de redacción:

| Formato | Para | Contenido |
| --- | --- | --- |
| Imagen (PNG) | Mostrar a otras personas lo que hizo un modelo o una fuente | Las columnas de la lista como una hoja, bajo el logotipo tipográfico y un pie (recuento, hora), dibujada en el vocabulario propio de la lista - la regla suave de cabecera, el punto de veredicto, las etiquetas rellenas y el mosaico de proveedor, y la marca del fabricante del modelo cuando la lista muestra marcas de modelo. Las 100 filas seleccionadas más recientes. |
| JSON | Un programa | Valores almacenados (milisegundos, recuentos, dólares), todas las filas seleccionadas, con un nombre de `schema` y la lista de lo que se redactó. |

- **La redacción es según lo que un lector podría averiguar.** Los nombres de cuenta OAuth y las claves (la clave del llamador
  y la clave del proveedor que respondió) se ocultan por defecto; los ids de solicitud y columnas enteras
  bajo petición. La fuente y el modelo permanecen, porque son el motivo de compartir.
- **Un valor redactado es una barra neutra** (`--fg` al 20%, 96x10px, radio de 2px), no una etiqueta
  sustituta, y está ausente de los datos de la exportación en lugar de cubierto: la hoja se construye sin
  él antes de dibujar nada, y el campo JSON se omite.
- **La imagen se dibuja, no se captura.** La hoja se pinta en un canvas desde la paleta, de modo que cien
  filas cuestan un pintado en lugar del clon de varios miles de elementos, y la vista previa
  es el canvas que se guarda. Es más ancha que la lista (1480px como mínimo, hasta 2x) para que ninguna
  columna quede apretada, y usa las marcas propias de la lista: ilustración del proveedor, la píldora de resultado, la
  lectura de la tasa de caché, y los glifos de no streaming y de modelo sustituido.

Una respuesta sin streaming se marca con el glifo de difusión tachado (`NonStreamOutlined`)
y se etiqueta "Non-streaming response". El glifo de cajas apiladas pertenece a Model Square y no
se reutiliza para ello.

### Escala de tasa de caché

La tasa de caché de la lista de solicitudes es la única lectura continua de la aplicación:
el valor mismo es una cualidad, así que la lista lo pinta en lugar de agruparlo en cubos.
`0%` amarillo → `100%` verde, sin umbrales ni escalones. **El rojo no está en la
escala**: una tasa de aciertos baja no es un fallo, y el tono de peligro se reserva para las
solicitudes fallidas, de modo que una solicitud con poca caché nunca se lee como un error.

| Token | Oscuro | Claro | Rol |
| --- | --- | --- | --- |
| `--cache-rate-yellow` | `#f59e0b` | `#b45309` | extremo del 0% |
| `--cache-rate-green` | `#10b981` | `#059669` | extremo del 100% |

Reglas:

1. **Interpola en OKLCH**, mediante `color-mix(in oklch, …)`. Dejar que el navegador
   mezcle mantiene los extremos como tokens de diseño en lugar de valores hex incrustados en un
   componente, y OKLCH mantiene uniforme el barrido de tono. El componente nunca nombra un
   color: `cacheScale.ts` devuelve los dos extremos como referencias `var()` más el peso
   del extremo bajo, y el CSS los mezcla.
2. **Los extremos son pasos de la paleta, no colores nuevos.** `derivePalette` fija
   `--cache-rate-yellow` en el `--warn` del modo y `--cache-rate-green` en su
   `--success` (`scripts/test-theme-presets.ts` comprueba ambos), de modo que los extremos claros
   son la lectura más oscura de los mismos dos tonos (el extremo bajo es ocre — un
   amarillo saturado tampoco puede ser legible en una página clara). La lectura es
   texto de 13px/500 en su tono con un punto, directamente sobre la fila, sin caja: el
   relleno y el borde de una insignia eran un segundo marco dentro de cada fila y costaban contraste a
   los extremos claros. Medido con `contrastRatio`
   (`web/src/theme/colorMath.ts`) sobre la página: OMC Dark se lee a **8.71:1** en el
   extremo del 0% y a **7.38:1** en el del 100%; OMC Light se lee a **5.02:1** y
   **3.77:1**. Son mediciones y no un límite fijado: ninguna comprobación
   las verifica.
3. **El extremo superior de la escala es política de presentación.** El `100%` no se muestra: la
   lectura se detiene en **99.9%** (`MAX_CACHE_RATE`; el agregado del panel en Go aplica el mismo
   tope) para que la aplicación nunca afirme una tasa de aciertos perfecta. Las lecturas llevan **un
   decimal**; una tasa que se redondea a cero se lee como `0%`, nunca `0.0%`.
4. **Sin datos no es 0%.** Un registro sin datos de tokens recibe la misma forma de insignia
   en el paso neutro (`--muted`) con un guion largo, nunca un cero: "nada
   en caché" y "nada medido" son hechos distintos. El mosaico del panel muestra
   el mismo guion largo cuando la ventana no registró tokens de prompt.
5. El tono es una codificación redundante — el porcentaje se imprime en la insignia — de modo que
   la rampa no necesita leyenda ni una lectura basada solo en el color.

**Diferido: contabilidad de escritura en caché.** Un proveedor que contabiliza los cubos de caché
por separado (al estilo Anthropic) informa los tokens de prompt como `input + cache_read +
cache_creation`, de modo que su tasa de aciertos actualmente se lee alta porque los tokens
escritos quedan fuera del denominador. Contarlos necesita evidencia que la aplicación
no conserva: CPA clasifica cada carga por proveedor/ejecutor y emite un desglose
canónico, pero el decodificador persiste solo los recuentos en bruto, y los hechos de uso
no llevan columnas de tokens por convención, de modo que una ventana no puede dividirse por convención.
Corregirlo significa persistir el desglose (o columnas de tokens por convención en los hechos
de uso) antes de cualquier cambio aritmético. Hasta entonces la tasa es una estimación acotada
para los proveedores que escriben en caché, y la lista de solicitudes es exacta solo para los proveedores
cuya entrada ya incluye el prefijo en caché.

### Escala de esfuerzo de razonamiento

La lista de solicitudes colorea el esfuerzo de razonamiento de una solicitud, porque el esfuerzo es el único parámetro de solicitud
que un operador compara a lo largo de una columna: una página de llamadas `high` y `xhigh` cuesta y espera de forma distinta
que una página de llamadas `low`. El esfuerzo es una lectura **ordinal** - cada nivel es más razonamiento que el
anterior - así que toma una escala secuencial en lugar de un color sin relación por nombre.

Ni OpenAI ni Anthropic publican un color para estos niveles, así que la escala sigue la regla general
para datos ordenados: un barrido cuyo tono y saturación crecen con el valor, y una
etiqueta impresa para que el color nunca sea el único portador (WCAG 1.4.1).

| Token | Nivel | Oscuro | Claro | Familia |
| --- | --- | --- | --- | --- |
| - | `none`, sin rango | `--fg-2` | `--fg-2` | neutro: la ausencia de razonamiento, o un nivel que la escala no ordena (`instant`, `ultra`, un presupuesto de tokens) |
| `--effort-1` | `minimal` | `#94bfce` | `#39626e` | pizarra |
| `--effort-2` | `low` | `#4eccd3` | `#00686c` | verde azulado |
| `--effort-3` | `medium` | `#91b7fe` | `#3057a3` | azul |
| `--effort-4` | `high` | `#bda7fe` | `#6343a4` | violeta |
| `--effort-5` | `xhigh` | `#f08dee` | `#8a2b8a` | magenta |
| `--effort-6` | `max` | `#ff8cc1` | `#9b2065` | rosa |
| `--effort-tint` | | `14%` | `12%` | relleno de la insignia = paso sobre el fondo; la insignia no tiene borde |

Reglas:

1. **El barrido se mantiene frío.** Va del verde azulado al rosa y nunca entra en verde, ámbar ni rojo. Esos tonos
   son veredictos en esta consola, y una solicitud que pensó mucho no tuvo éxito, ni se degradó ni falló
   por ello - el mismo razonamiento que mantiene la latencia sin color y el rojo fuera de la escala de tasa de caché.
2. **Un solo orden para ambos proveedores.** La escala de OpenAI va de `none` a `xhigh` y la de Anthropic de `low` a
   `max`; coinciden donde se solapan, así que `effortStep` (`web/src/theme/effortScale.ts`) los ordena
   en una sola escala. La coincidencia ignora mayúsculas y los espacios circundantes.
3. **Un nivel sin rango permanece neutro, y neutro es liso y no tenue.** Un
   valor específico del proveedor (`instant`, `ultra`, `auto`, un presupuesto de tokens) se imprime tal como se registró en
   el paso neutro. Pintarlo como el extremo superior de la escala enunciaría un orden que nadie publicó. El
   paso neutro es `--fg-2`, texto secundario: el tinte de la insignia es fino por diseño, y
   `--muted` a través de él dejaba el nivel casi ilegible.
4. **Los pasos son constantes por modo, no tokens derivados**, por la misma razón que las ranuras de serie: el
   acento de un operador no debe rotar el aspecto de un nivel. Toda paleta hereda el conjunto de su modo.
5. **Cada paso, el neutro incluido, alcanza 4.5:1** como texto de insignia de 11px sobre su propio tinte, sobre la página, la tarjeta y el
   relleno de hover de la fila, en toda paleta registrada. `scripts/test-effort-scale.ts` comprueba eso, el
   orden, y que los valores de respaldo de la hoja de estilos coinciden con la paleta.

### Mapa de calor de actividad de tokens

La cuadrícula de tokens del panel es la única codificación secuencial de *cantidad* de la aplicación, y deliberadamente
no se construye con los tonos semánticos de estado.

**Forma.** Un campo de gráfico de contribuciones: una fila por día de la semana (lunes primero), una columna por semana,
cincuenta y tres semanas completas que terminan en la semana que contiene hoy. Siete filas de días de la semana son todo el punto —
hacen que un ritmo semanal sea una *fila* y una tendencia una *dirección*, algo que una franja de una sola fila no puede mostrar.
La extensión y la forma son una sola decisión: con siete filas, los días de un trimestre serían trece
columnas, lo que se lee como un bloque pequeño y no como un campo.

**La rampa es continua, no escalonada.** Un tono con luminosidad que varía de forma continua, desde el relleno vacío
propio de la celda hasta el acento. Sustituyó a cuatro tonos fijos, que pintaban de forma idéntica todos los días comprendidos entre dos
de ellos — la diferencia día a día que el panel existe para mostrar quedaba cuantizada. La
asignación es la **raíz cuadrada** del volumen del día frente al día más ocupado de la propia ventana
(`web/src/theme/heatmapRamp.ts`): el volumen de tokens abarca varios órdenes de magnitud en una ventana, de modo que una
rampa lineal colapsa toda la parte media del rango en un tono invisible, mientras que un logaritmo
sobreamplifica la parte baja hasta que un día con casi ningún tráfico parece de escala media. La raíz cuadrada mantiene
visibles las diferencias día a día en el extremo tranquilo sin aplanar el extremo ocupado.

**La ventana es móvil.** Un año hacia atrás, no un año natural. Una cuadrícula natural gasta cada enero
casi vacía y no dice nada del diciembre anterior, que es justo la comparación que un lector
quiere en ese momento; una ventana móvil siempre contiene un año de historia y siempre termina hoy. Es
también la forma de GitHub. La consecuencia es que no hay días por venir en la ventana,
salvo la cola de la semana en curso — y esos no tienen tráfico, así que se dibujan exactamente como
cualquier otro día sin registro almacenado. Siguen siendo pulsables: su tooltip indica que no hay nada
almacenado, que es la misma respuesta que da un día purgado, y solo falta el enlace de detalle
porque no habría nada que abrir. El panel distingue "hay datos
almacenados" de "no los hay"; no le pide al lector que distinga "aún no ha ocurrido" de
"los registros se purgaron", porque para quien compara días son el mismo hecho.

**Muestra las semanas que caben, a un tamaño legible.** El panel ajusta tantas de las semanas más recientes como
caben en su ancho a `--heatmap-cell-target` (18px con un `--heatmap-gap` de 4px; 14px y 3px por debajo de
900px) y las estira hasta
alcanzar su borde, de modo que un cuadrado es un objetivo cómodo con cualquier ancho. Las semanas más antiguas permanecen en el
campo y se desplazan dentro del panel, detrás de un canal fijo de días de la semana; un desvanecimiento breve sobre la primera
columna visible indica que el campo continúa. El componente escribe el tamaño ajustado como `--heatmap-cell`
(`fitHeatmapCell` en `web/src/types/tokenHeatmap.ts`), redondeado hacia abajo para que las semanas a la
vista nunca excedan el campo. Cuando cabe todo el año, no se escribe tamaño y las pistas vuelven
a `minmax(--heatmap-min-cell, 1fr)`, que divide el panel exactamente. Dividir el año en
el ancho que tuviera el panel era la regla anterior, y en una columna de medio ancho dejaba cuadrados de 8px
en una franja de un tercio de la altura de su vecina.

**Comparte su fila.** Por defecto el campo es la mitad izquierda de una fila del tablero, con la cuota de credenciales
a la derecha (véase Disposición del panel). El campo fija la altura de la fila: la lista de cuotas contigua
toma la altura que sea y se desplaza dentro de su propio panel, y la clave de la rampa se sitúa en el borde inferior del
panel del mapa de calor. Por debajo de 1100px cada uno ocupa una fila propia y los dos paneles se apilan.

**La semana en curso es una columna completa.** Sus días posteriores no han ocurrido, así que no hay nada almacenado para
ellos — el mismo hecho que un día cuyos registros se purgaron, y se dibujan y tratan de forma idéntica
en lugar de darles un estado propio. Dejarlos en blanco era la alternativa y se lee como un hueco de
renderizado: la forma promete una semana completa.

| Token | Oscuro | Claro | Rol |
| --- | --- | --- | --- |
| `--heatmap-quiet` | `#212124` | `#ebebee` | el suelo de la rampa: una celda sin tráfico |
| `--heatmap-busy` | `#00a2fb` | `#005d8f` | el techo de la rampa: el día más ocupado de la ventana |
| `--heatmap-zero-recorded` | `#2c2c30` | `#dcdce1` | registrado, sin tráfico |
| `--heatmap-zero-unrecorded` | `#212124` | `#ebebee` | nada almacenado para ese día |

### Cuota de credenciales

El panel contiguo a la cuadrícula de actividad responde a la única pregunta que un panel puede plantear útilmente sobre una
flota de credenciales: qué puede seguir sirviendo y qué está a punto de detenerse. Un recuento de credenciales diría
que algo va mal y ahí se detendría — la siguiente pregunta del lector es siempre cuál credencial, por qué
y cuándo se recupera — así que el panel las lista.

**Una fila por credencial, la más urgente primero.** Una fila dibuja el plan de su credencial: las dos ventanas de
cuota más cortas como barras de cuota restante, con la cuenta atrás hacia la más ajustada de ellas al reponerse. Cuatro
estados no tienen lectura que dibujar y enuncian la razón en su lugar — inicio de sesión requerido, en enfriamiento,
no disponible y sin lectura de cuota — así que la fila lleva la causa en vez de una barra vacía. Una
credencial agotada conserva sus ventanas, porque *son* el enunciado: toda ventana desde la que puede servir
está en cero, y la cuenta atrás junto a ellas indica cuándo vuelve a servir. El orden es la
lectura: inicio de sesión requerido, en enfriamiento, agotada, no disponible, a punto de agotarse, sana, sin lectura.
Las credenciales deshabilitadas son decisión del propio operador y solo se cuentan, en el encabezado junto a los
recuentos de en servicio y bloqueadas.

**La lista se desplaza dentro del panel.** Se lista toda credencial, de modo que una flota grande se puede leer
sin salir del panel, y el panel conserva la altura de la fila que comparte: la lista toma
la altura que la cuadrícula de actividad da a la fila (nunca menos de tres filas) y se desplaza de forma nativa, con
rueda, barra de desplazamiento o táctil. Apilada por debajo de 1100px muestra hasta cuatro filas y media, siendo la media fila
lo que indica que hay más.

**Muestra, con un solo control.** Una fila no es interactiva — se desplaza bajo un dedo, y una fila
que navegara convertiría un toque pensado para mover la lista en abandonar la página. El encabezado lleva
un glifo de actualización que pide a los proveedores lecturas nuevas: es la única acción que merece estar donde
se leen las lecturas, y ejecuta la misma actualización que el espacio de trabajo de credenciales
(`web/src/utils/quotaRefresh.ts`), informando bajo el mismo aviso. Borrar un enfriamiento, volver a iniciar sesión
y todo lo demás que se haga con una credencial individual permanece en `/oauth-management`, a donde enlaza
el pie. El panel lee
`GET /management/auth-files` y `GET /management/quota` — las lecturas almacenadas, nunca un proveedor —
e interpreta esas dos respuestas en su propio módulo
(`web/src/components/dashboard/credentialQuotaLogic.ts`). Aparte de la ejecución de actualización compartida, no comparte
código con el espacio de trabajo, de modo que este puede cambiar cómo selecciona, etiqueta o actúa sobre la cuota
sin mover el panel.

El tono de una barra es la cuota restante — `--success` desde el 70%, `--warn` desde el 25%, `--danger` por debajo —
y nunca la rampa del mapa de calor: "queda mucho" y "muchos tokens" no deben ser el mismo color. Sus
estados tratan de la frescura: una relectura fallida conserva las filas y lo dice en el tono de advertencia, solo una
lista de credenciales que nunca se leyó se informa como desconocida, con un reintento, y un despliegue sin
credenciales recibe un estado vacío que enlaza a conectar una.

Una celda medida mezcla estos dos extremos en **OKLCH** con un peso que lleva su propio `--heatmap-quiet-share`,
de modo que toda la rampa es una sola declaración y el extremo al que llega es el token de acento anterior.
`--heatmap-quiet` y `--heatmap-zero-unrecorded` tienen el mismo valor a propósito: un día medido en el
extremo inferior de la escala tiene que empezar exactamente donde está el suelo del campo, o la rampa empieza por encima de un día que
no registra nada. `--heatmap-zero-recorded` toma entonces el paso siguiente - el paso de borde - para que una lectura
ordenada sobreviva: nada almacenado (el más tenue), registrado pero vacío, y medido. La derivación mantiene ese
orden (`heatmapQuiet = heatmapZeroUnrecorded = borderSoft`, `heatmapZeroRecorded = border`), por lo que
estos cuatro tokens no son cuatro elecciones independientes.

Los dos estados de cero son un **relleno sólido, nunca un contorno**, y forman una escala ordenada
frente a la tarjeta y no frente a la página. Ambas son propiedades requeridas, no preferencias
de estilo:

- **Sólido, porque una cuadrícula es en su mayoría ceros.** Un despliegue tranquilo tiene muchas más celdas vacías que
  medidas, y dibujadas como contornos de 1px convertían el campo en una malla de alambre. Un trazo también
  llama la atención sobre la *ausencia* de datos, que es lo más ruidoso en un panel cuyo tema es
  el puñado de celdas coloreadas. El estado vacío de GitHub es un muro de bloques discretos, y esto es lo
  mismo.
- **Ordenado frente a la tarjeta.** El panel se dibuja sobre el fondo propio de la página (`--bg`, ADR 0103), y
  ambos pasos son un tono más claro que él en oscuro (más oscuro en claro), de modo que los huecos de 4px se leen como la tarjeta
  que se transparenta. El orden lleva el significado: sin registrar (sin información) es lo más cercano a la tarjeta
  con ~1.17:1 (1.19:1 en claro), vacío (una medición de cero) un paso más lejos con ~1.35:1 (1.37:1), y un
  día medido asciende desde ahí hasta el acento con 6.74:1 (7.09:1). Cada paso debe quedar del lado de la tarjeta
  respecto de la tinta, nunca más allá: un estado de cero más fuerte que el suelo de la rampa se leería como un día
  medido.

Reglas:

1. **El tono de acento, porque la lectura que implicaría un color de estado es errónea.** La rampa continúa
   el acento propio de la interfaz en lugar de introducir una segunda familia de color, y deliberadamente
   *no* es semántica: "muchos tokens" y "esta credencial está sana" no deben ser el mismo
   color, o la cuadrícula implica un veredicto para el que no tiene base. La sonda comprueba que el
   relleno de ninguna celda medida es igual a `--success`, `--warn` o `--danger`.
2. **Continua, no escalonada.** Cuatro tonos fijos pintaban de forma idéntica todos los días comprendidos entre dos de ellos,
   lo que cuantizaba la diferencia día a día que el panel existe para mostrar. La rampa se mezcla en
   OKLCH en lugar de interpolar en sRGB, donde el punto medio entre un azul claro y uno oscuro cae
   en un gris desaturado.
3. **El brillo es la raíz cuadrada de la proporción del día respecto del día más ocupado de la ventana**, no la proporción
   misma. Vea la nota de la rampa anterior para saber por qué una asignación lineal colapsa la parte media del rango y una
   logarítmica sobreamplifica la parte baja.
4. **La rampa es relativa a la ventana, no absoluta.** El volumen diario de un despliegue autoalojado
   abarca varios órdenes de magnitud, de modo que una escala fija pintaría cada celda de una instalación ocupada en
   el techo y cada una de una tranquila en el suelo. El coste es que el mismo tono significa volúmenes
   absolutos distintos en dos instalaciones, por lo que cada celda enuncia sus recuentos en texto.
5. **El color es redundante, y la clave no lleva cantidades.** Cada celda lleva su fecha y ambos
   recuentos en su nombre accesible y en su tooltip, de modo que el tono nunca es la única codificación. La clave
   bajo el campo son cinco muestras entre "Less" y "More": nombra la dirección de la rampa y
   nada más, porque el tono es relativo a la ventana y una escala etiquetada describiría el rango propio
   del campo y no ninguna cantidad
   fija. Los números están a un clic, que es adonde va un lector que los quiere. El
   volumen de tokens del tooltip se imprime en el **Token Unit Style** de la consola — la misma capa que leen los mosaicos de KPI
   situados sobre él — con el recuento exacto en el valor, mientras que el recuento de solicitudes conserva dígitos agrupados
   porque no es un volumen de tokens.
6. **El tooltip se abre al hacer clic, no al pasar el cursor.** En un campo tan denso, un tooltip al pasar el cursor se dispara
   continuamente al cruzarlo el puntero y compite con el anillo de hover por el mismo gesto.
   Un clic es deliberado, y deja el tooltip abierto para leerlo y seguirlo. El detalle es
   **un enlace dentro del tooltip**, no la celda misma: la lista de solicitudes del día es un lugar, así que puede
   abrirse en una pestaña nueva y copiarse, y un clic accidental en un cuadrado no puede sacar al operador
   del panel.
7. **Toda celda es interactiva.** Al hacer clic se abre su tooltip, y un día sin nada registrado
   lo dice — "no requests on this date" es la respuesta a la pregunta que se hace el lector, no un
   motivo para rechazarla. El tooltip omite los dos recuentos en ese caso en lugar de imprimir ceros:
   nada almacenado no es la misma afirmación que un cero medido, y `Requests 0 / Tokens 0` afirmaría
   una medición que el panel no puede hacer. Un día sin tráfico tampoco tiene enlace de detalle, porque
   no habría nada que abrir.
8. **El hover eleva la celda.** Un `transform: scale()` — solo del compositor, según la regla 1 de §7 — con el
   anillo, y `z-index` para que el cuadrado agrandado no quede recortado por sus vecinos. Deliberadamente sin
   transición de color: la regla 7 de §7 la prohíbe, y un fundido tras un barrido rápido se lee como lag. La
   anulación de `prefers-reduced-motion` elimina el movimiento y conserva el anillo y el cursor.
9. **Cada línea del tooltip cumple WCAG AA sobre la superficie propia del popper** (medido, y
   comprobado desde los píxeles pintados en ambos temas). Esto fija dos cosas, porque ambas se publicaron
   rotas: el relleno del tooltip es la superficie de la paleta en *ambos* temas - `colorBgSpotlight` de antd
   estaba fijado a `--fg` para el claro, lo que ponía texto casi negro sobre una caja casi negra con una razón de contraste
   de 1.0 - y el enlace usa su propio paso (`--heatmap-tip-link`) en lugar de cualquiera de los acentos,
   porque el acento brillante se lee a 3.4:1 sobre la superficie oscura y el paso de hover más profundo se lee
   a 1.96:1 allí siendo el único legible sobre la superficie clara.
10. **El campo se desplaza solo cuando debe.** Un panel más estrecho que un año de celdas de tamaño objetivo
   se desplaza dentro de sí mismo con la barra de desplazamiento oculta — una barra dentro de una tarjeta del panel es ruido y el táctil
   no muestra ninguna — y se abre en la columna de hoy. Recortar en su lugar descartaría en silencio las semanas más antiguas.
11. **La cuadrícula es DOM, no una marca de gráfico** — véase `docs/adr/0005-token-heatmap-as-a-dom-grid.md`.

### Paleta de series categóricas

Los paneles de modelos del panel colorean una **categoría**, no un estado. Un modelo es el nombre de upstream que el
despliegue sirva, de modo que no hay eje bueno/malo al que un tono pueda referirse - lo que lo convierte en uno de los
lugares de la aplicación donde el color es decoración, y la razón por la que la regla de solo semántica de §1 lleva una excepción
explícita en lugar de estirarse en silencio. Vea `docs/adr/0006-categorical-series-palette.md`.

La excepción se acota por **rol**, no por tono: estos seis tokens pertenecen a marcas categóricas. Los
indicadores de estado, la escala de tasa de caché, la rampa del mapa de calor de tokens, la máscara del llamador y todo color
interactivo no se tocan y siguen significando exactamente una cosa.

| Ranura | Oscuro | Claro | Familia |
| --- | --- | --- | --- |
| `--series-1` | `#3b82f6` | `#2563eb` | azul |
| `--series-2` | `#10b981` | `#059669` | esmeralda |
| `--series-3` | `#8b5cf6` | `#7c3aed` | púrpura |
| `--series-4` | `#f43f5e` | `#e11d48` | coral |
| `--series-5` | `#f59e0b` | `#b45309` | ámbar |
| `--series-6` | `#06b6d4` | `#0891b2` | cian |
| `--series-track` | `#2c2c30` | `#dcdce1` | el suelo de trazado de la tendencia y la pista sin rellenar del anillo - el paso `border` de cada modo |

Las seis ranuras son **constantes por modo, no tokens derivados**: son semántica y no paleta,
de modo que el acento de un operador no puede rotarlas (`docs/adr/0011-theme-modes-and-derived-palettes.md`). Toda
paleta hereda por tanto el conjunto de su modo mediante `derivePalette`, y `--series-track` es el paso
`border` del modo. La tabla muestra el par OMC Dark/OMC Light, que es también lo que `web/src/index.css`
lleva como respaldo previo a la hidratación; `scripts/test-chart-marks.ts` comprueba en cada paleta registrada
exactamente seis ranuras, contraste gráfico sobre su propia superficie de tarjeta y distancia entre ranuras adyacentes.

**La ranura es la identidad; la familia sobrevive a un cambio de tema.** `seriesColor(mode, 0)` es la familia
azul en ambos temas y solo cambia el paso, porque los pasos brillantes son ilegibles en una tarjeta
clara - el paso brillante del propio acento se lee a 2.78:1 allí, la misma medición que produjo la escala
de acento. Un modelo conserva por tanto su color cuando el operador cambia de tema.

**El color categórico y el color de estado son roles distintos, no tonos distintos.** La restricción no es
que un tono de serie evite `success`/`warn`/`danger`; una línea ámbar no es una advertencia cuando la leyenda
junto a ella nombra un modelo. La restricción es que los dos roles nunca se apoyan en la misma señal: los tokens
de estado conservan esos tonos en exclusiva, y ambos paneles enuncian sus categorías en texto - la leyenda de la tendencia
nombra cada grupo, y la lista ordenada imprime el nombre, el volumen y la proporción de cada grupo. El color nunca es la
única codificación.

Reglas, todas medidas y comprobadas por `scripts/test-chart-marks.ts`:

1. **Cada ranura alcanza 3:1 frente a la tarjeta sobre la que se dibuja** (el umbral de WCAG para un objeto gráfico, no el
4.5:1 del texto de cuerpo - son líneas de 1.6px y muestras de 8px). Medido en ambos temas, el
rango va de 4.01:1 a 7.92:1 sobre la tarjeta oscura y de 3.41:1 a 5.28:1 sobre la clara.
2. **Las entradas adyacentes de la leyenda distan al menos ΔE 25 en CIE Lab**, de modo que dos vecinas no se lean como una
sola muestra. La secuencia existe para ese límite: alterna familias cálidas y frías, lo que también pone
un tono cálido en una ventana ordinaria de dos o tres modelos en lugar de reservarlo para una cola larga.
3. **La proyección en tiempo de ejecución es contra lo que se comprueba cada paleta.** `web/src/theme/palette.ts` es
la única fuente de las seis ranuras. `index.css` lleva los conjuntos oscuro y claro como respaldo previo a la
hidratación, y la suite compara ese respaldo con las paletas derivadas carácter por carácter; las ranuras de cada
otra paleta se proyectan en ejecución mediante `themePaletteCssVariables` y se comprueban contra su propia
derivación. Un token cambiado en un lugar y no en el otro falla en lugar de publicar un gráfico en un color
que la leyenda no muestra.
4. **El color se asigna a partir de una clasificación compartida, no por panel.** El dominio es una *clave* por grupo -
`model:<name>` o el discriminador plegado - y no la etiqueta mostrada, de modo que un modelo real cuyo nombre
iguala la etiqueta traducida del resto no pueda tomar el color del resto. El rango se genera entonces
en orden de clasificación, lo que significa que el color de un grupo sigue su posición: es estable mientras lo sea la clasificación,
y puede cambiar cuando esta cambie. Lo que la clasificación compartida consigue es que la línea de la tendencia y el
segmento del anillo de un mismo grupo nunca sean dos tonos distintos - son dos vistas de una misma respuesta - y
la leyenda junto a cada panel siempre indica qué color corresponde a qué modelo.
5. **Seis ranuras, y una séptima serie volvería al primer color.** Nada pide más: la
clasificación conserva cinco modelos con nombre más un resto. El color nunca es la única codificación en cualquier caso - ambos
paneles imprimen el nombre de cada grupo y la lista imprime los números de cada grupo.

   Los límites de Lab y de contraste anteriores son **límites y no garantías de accesibilidad**: descartan
   colores idénticos o ilegibles, y no establecen cómo se lee la paleta para una persona con una
   deficiencia de visión del color. Vea el ADR 0006 para saber por qué no se hace esa afirmación.

### Paleta de carriles de enrutamiento

El mapa de enrutamiento en vivo tiene un segundo uso categórico del tono, y más estricto. El carril de cada modelo dibujado
hacia la pasarela lleva una ranura `--route-*`, y a diferencia de la leyenda de un gráfico no hay clave de muestras entre
la línea y el ojo: el carril empieza en la fila a la que pertenece y allí está su nombre. Una línea verde, ámbar
o roja se leería por tanto como un veredicto sobre la conexión y no como la identidad del modelo -
la ambigüedad que hizo que los carriles tuvieran color de estado en primer lugar. Cada ranura permanece en el lado frío
del círculo cromático, y los tonos de estado permanecen en las superficies de los nodos, donde un velo o un anillo trata inequívocamente
de la solicitud y no de la línea.

| Ranura | Oscuro | Claro | Familia |
| --- | --- | --- | --- |
| `--route-1` | `#3b82f6` | `#2563eb` | azul |
| `--route-2` | `#8b5cf6` | `#7c3aed` | violeta |
| `--route-3` | `#06b6d4` | `#0891b2` | cian |
| `--route-4` | `#ec4899` | `#db2777` | rosa |
| `--route-5` | `#d946ef` | `#c026d3` | fucsia |
| `--route-6` | `#94a3b8` | `#475569` | pizarra |

`scripts/test-chart-marks.ts` comprueba en cada paleta registrada que las seis ranuras de enrutamiento son
distintas, alcanzan 3:1 frente a la tarjeta, no son uno de los valores `success`/`warn`/`danger` de esa paleta,
y distan al menos ΔE 25 de sus vecinas. Son constantes por modo por la misma razón que las
ranuras de serie, y `web/src/index.css` lleva el par OMC Dark/OMC Light como respaldo previo a la
hidratación.

El carril de una credencial no es una identidad: es siempre el neutro `--fg-2`, y un carril cuya credencial
está en reposo es discontinuo. Ni un carril ni el punto que viaja por él toman nunca un tono de estado; el veredicto
se dibuja en la superficie del extremo (un velo del color del tono y el anillo del puerto) y se enuncia en el texto
de la fila.

### Disposición del panel

El panel es un tablero de cuatro columnas de widgets - los seis mosaicos de KPI, los dos paneles de modelos, el enrutamiento
en vivo, la actividad de tokens, la cuota de credenciales y la lista de proveedores - y su disposición es
del operador: el orden, el ancho de cada widget y qué widgets se ocultan son una sola preferencia almacenada
(`omc_dashboard_layout`, modelada en `web/src/types/dashboardLayout.ts`). El documento lista todos los
widgets que conoce; un widget que añade una versión posterior falta en una anterior y se coloca después del
widget que lo precede en el orden por defecto, y se muestra, de modo que un panel nuevo nunca llega desactivado.

- **Los anchos son columnas de cuatro.** Cada widget ofrece solo los anchos a los que se lee: un mosaico de KPI cualquiera de
  ellos, los paneles de modelos, la cuadrícula de actividad, la lista de cuotas y la lista de proveedores la mitad o más, el mapa de
  enrutamiento tres cuartos o la fila completa. Por debajo de 1100px el tablero tiene dos columnas, de modo que un cuarto sigue siendo
  una mitad y todo lo más ancho ocupa la fila entera; un teléfono no ofrece control de ancho porque nada de lo que
  eligiera se vería.
- **Organizar es un modo.** El botón de cuadrícula del encabezado entra en él; hasta entonces el tablero no lleva
  tiradores. Cada celda se convierte en un marco discontinuo con una barra de herramientas - un tirador de arrastre, el nombre del widget,
  paso anterior y posterior, ocultar y la elección de ancho - sobre una imagen `inert` del widget, de modo que un
  arrastre no pueda abrir un detalle y el operador organice lo que realmente leerá. Un arrastre se
  arma solo desde el tirador, y el marcador de soltado es una barra de acento de 3px en el lado donde el widget
  aterrizará (encima o debajo de una celda que ocupa toda la fila). Los widgets ocultos esperan en una bandeja sobre el
  tablero, con un botón de restauración cada uno.
- **No se almacena nada hasta Done.** Organizar edita un borrador: Cancel lo descarta, Restore default vuelve a poner
  el catálogo en él, y Done escribe el documento completo una vez y lo confirma con un aviso. Los
  seis mosaicos de KPI son los únicos widgets para los que una primera carga dibuja marcadores de posición, en el orden organizado.

### Enrutamiento en vivo del panel

Por defecto, una tarjeta ancha situada justo bajo la fila que comparten los dos paneles de modelos, fuera del alcance del selector de ventana: siempre muestra
el último minuto móvil, porque responde a "qué modelo va a qué credencial ahora mismo", algo que un
intervalo elegido convertiría en un informe. No hay lista de solicitudes recientes; eso es de la lista de solicitudes.

```text
┌─ LIVE ROUTING  ● Live  [Last 60 s] ────────────────────────────────────────────────────────────────┐
│  MODELS CALLED 3                                   CREDENTIALS & PROVIDERS 3                         │
│  [◎] gpt-5.6-luna     12 req · 1.2 s ●╮                     ╭─● [o] Codex  sk-…c002  Answered last │
│  [✳] claude-opus-5.5   6 req · 2.0 s ●─╲     ┌──────────┐ ╱                                       │
│  [◇] glm-5.3-flash     2 req · 0.6 s ●──▶    │ [Shell-PAMC]    │───● [o] Codex  sk-…c001  Rate limited ·   │
│                                               │ Shell-PAMC│ ╲                      back in 21 s      │
│                                               │ Round    │  ╰─● [A] Claude sk-…cl01  6 req · 2.0 s  │
│                                               └──────────┘                                         │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Es la única superficie iluminada de la consola**, por decisión del producto: en todas las demás partes la profundidad son bordes
y cambios de fondo (§1, §4), pero este mapa muestra tráfico en vivo, y la profundidad es lo que hace que se lea como
algo en marcha y no como un diagrama. La excepción se limita a él y se somete a tres reglas: la profundidad
se sitúa en la pasarela (una placa `--elevated` elevada con un tenue degradado de acento y un destello de acento
a lo largo de su borde superior, elevada por un resplandor de acento en la página oscura y por una sombra de contacto neutra con un
tenue halo de acento en la clara, donde un resplandor de acento solo se vuelve turbio), en las filas (`--elevated` con una sombra baja, y un borde luminoso solo mientras están iluminadas) y en
el punto viajero (un resplandor de su propio color), sobre una tenue cuadrícula de puntos que se desvanece hacia los bordes del panel; ninguna
sombra se anima jamás - cada resplandor es una superposición cuya opacidad es lo único que cambia; y el color sigue
significando algo - los colores de enrutamiento de los modelos en sus carriles, marcas y puertos, los carriles de credencial
neutros, el acento en la pasarela, y el color de estado en la superficie de un nodo donde algo es excepcional.

- **La columna izquierda es solo el modelo llamado** - el alias que nombró el llamador, o si no el modelo - con la marca
  de su fabricante, el recuento de solicitudes y la latencia media. El volumen se lee en esos recuentos y en el ancho de los
  carriles; la fila no imprime porcentaje ni dibuja barra de proporción. No se dibuja ningún llamador, cliente ni clave: el panel trata de
  a dónde van las solicitudes. Cada modelo dibujado toma un color categórico `--route-*` que conserva mientras
  permanezca en el panel; su puerto y su carril hacia la pasarela lo llevan, y el nombre siempre está en
  texto a su lado. La paleta de enrutamiento fría existe para que un carril nunca pueda leerse como un veredicto (§2).
- **La columna derecha es la credencial o proveedor que respondió**, nombrada como la nombra la lista de solicitudes,
  mediante el mismo resolvedor: marca del proveedor, proveedor, y la clave enmascarada o la cuenta OAuth. La
  columna de estado dice lo único excepcional - `Rate limited`, `Quota exceeded` o `Cooling
  down` con una cuenta atrás, en el tono de advertencia - o si no que respondió la última (acento), o su recuento y
  latencia media.
- **La pasarela** es la marca de Shell-PAMC en su propio mosaico pequeño tintado, el nombre de producto `Shell-PAMC`, la
  estrategia de enrutamiento con que está configurado CPA como un chip discreto, y los intentos del minuto. Un riel a cada lado es donde acoplan los carriles, tan largo como
  el abanico de carriles que recibe. Mientras haya alguna solicitud en el mapa, sus rieles y el resplandor se intensifican, y se calman en 600ms cuando la última
  ha vuelto a casa.
- **Un carril por fila.** Un modelo tiene un carril hacia la pasarela y una credencial un carril desde ella, y los
  carriles se encuentran con la pasarela uno junto a otro en el orden de sus filas. Los carriles por cada par de modelo y credencial
  se enredaban en un nudo a partir de un puñado de cada uno; qué modelo fue a qué credencial es lo que muestran las
  solicitudes viajeras, en el color del modelo. El carril de una credencial es siempre el neutro `--fg-2`,
  y discontinuo mientras esa credencial reposa; un carril nunca se vuelve `--warn` ni `--danger`, porque un color en
  una línea se lee como una afirmación sobre la propia conexión. El texto de la fila y el velo del nodo llevan el
  veredicto.
- **Las filas se ordenan por nombre, nunca por volumen**, de modo que un recuento que adelanta a otro no reordene el
  mapa bajo el lector. El volumen solo decide qué siete modelos y siete credenciales se dibujan; el
  resto se cuenta en una línea bajo la columna, y una credencial en reposo siempre se dibuja. Pasadas cuatro
  filas en una columna, las filas se aprietan un paso, nunca por debajo de una fila cómoda de dos líneas. Cuando el propio panel es más estrecho que 940px
  (`@container routingmap`, la barra lateral abierta junto a una ventana de portátil), los carriles se acortan y el estado de una
  credencial baja bajo su nombre en lugar de recortar el nombre a una letra.
- **El encabezado no lleva recuentos**: el título, si el panel está en vivo y la ventana. Las filas
  dicen cuánto fue adonde, y la pasarela cuántos intentos contuvo el minuto.
- **La ventana es móvil con el reloj del navegador.** Un intento pertenece al minuto en que terminó; cuando el último
  intento de un modelo o credencial cumple un minuto, su fila se desvanece y se desplaza hacia su propio
  borde del mapa, y las filas de debajo cierran el hueco. Un modelo llamado por primera vez en el minuto
  entra desde el mismo borde (regla 9 de §7).
- **La luz se mueve con la solicitud, nunca por delante de ella.** Una fila solo se ilumina cuando el punto viajero
  acopla en ella, no cuando se lee su registro, y se calma durante el pulso del resplandor; un carril se intensifica
  tras el punto que lo cruzó y se calma igual (regla 9 de §7). Una fila que ningún punto ha alcanzado
  — toda fila de la primera lectura — permanece en reposo.
- **Un minuto vacío conserva la forma del mapa**: una fila marcadora discontinua a cada lado, unida a la
  pasarela por carriles discontinuos, indica dónde aparecerán modelos y credenciales, y se retira cuando llegan las filas de la primera
  solicitud.
- **Un teléfono no muestra el panel.** El mapa necesita sus tres columnas para decir algo, y una lista reducida
  de modelos y credenciales solo repetiría la lista de solicitudes, así que por debajo del punto de ruptura de teléfono el
  panel no lo monta, ni abre su lectura ni su flujo en vivo.

### Paneles de modelos del panel

Dos widgets pares, que por defecto comparten la fila bajo los mosaicos de KPI y sobre el enrutamiento en vivo, ambos dirigidos
por el selector de ventana. Se colocan de forma independiente y leen una consulta compartida:

```text
┌─ Token trend ──────────────────┐ ┌─ Model usage ─────────────────────────┐
│ ● gpt-5-codex ● claude-... ● … │ │   ╭───╮   ● gpt-5-codex  61.7K   73%    │
│        ╱╲                      │ │  ╱ 84.8K╲  ● deepseek-…    14.3K   17%   │
│   ╱╲__╱  ╲__╱╲___              │ │  ╲tokens╱  ● qwen3-…        6.7K   7.9%  │
│ ──┴────┴────┴────┴──           │ │   ╰───╯   ● …                          │
└────────────────────────────────┘ └────────────────────────────────────────┘
```

**La tendencia es una línea de múltiples series, no un área.** Los mosaicos de KPI de arriba usan un área porque su serie
es una cuadrícula fija rellena de ceros donde un tramo tranquilo es un cero *medido* y un área lo lleva hasta
la línea base. Aquí hasta seis grupos comparten un trazado, y seis rellenos translúcidos superpuestos se acumulan en
un barro que oculta el modelo que queda debajo - que es justo la lectura que el panel existe para ofrecer. Las líneas
se separan; los rellenos se acumulan.

**La línea es suave, y la curva es monótona.** `shapeField="smooth"` se resuelve en la forma `smooth` de G2,
que dibuja con `curveMonotoneX` - un cúbico monótono, no una spline Catmull-Rom simple - y las
minilíneas de KPI usan la misma forma. Esa distinción es toda la razón por la que suavizar es seguro aquí: estas
series están rellenas de ceros, así que la mayoría de los cubos están exactamente en el suelo, y una spline no monótona que los atravesara
se pasaría *por debajo* del eje entre puntos, dibujando una línea donde los datos dicen cero. Una curva monótona
no puede salir del rango abarcado por sus vecinos, así que el suelo sigue siendo el suelo. La sonda
comprueba esto desde los píxeles pintados: no aparece tinta del color de la serie bajo la regla del eje.

**Los cubos de cero medidos permanecen conectados.** Cada línea incluye todos los cubos de la cuadrícula compartida,
incluidos los tramos tranquilos largos, de modo que la inactividad se lee como una línea base continua y no como datos ausentes.
El grupo de mayor posición se pinta el último, de modo que donde las líneas se solapan la primera entrada de la leyenda queda encima.
El tooltip compartido nombra cada elemento por su propia clave de serie y lista explícitamente los ceros medidos.

**Los canvas de los gráficos están sobremuestreados.** Todo gráfico del panel se dibuja a no menos de 2x el tamaño CSS
(`web/src/charts/chartRender.ts`): en una pantalla 1x, una línea de 1.75px rasterizada directamente sobre la cuadrícula de píxeles
se escalonaba visiblemente en cada tramo empinado. El navegador reduce el mapa de bits, de modo que la geometría no cambia
y solo se promedian sus bordes.

**Los canvas de los gráficos siguen a su contenedor.** El `autoFit` de G2 reajusta un gráfico solo al cambiar el tamaño de la ventana, de modo que
`useChartPlugins` también observa el contenedor propio de cada gráfico y lo reajusta cuando esa caja cambia de tamaño por
cualquier otro motivo - la llegada de la fuente de la consola tras el primer pintado y la nueva medición del texto junto a
un gráfico es el más común. Un canvas dejado en su primer tamaño mantenía el anillo del modelo inscrito en un
cuadrado menor que su marco, con el total junto al agujero.

**Sin eje y.** La lectura es la forma de cada línea frente a su propia línea base - qué modelos subieron y
cuándo - y los números están en el tooltip y en la lista de uso contigua. Un eje quitaría el ancho
que necesitan las líneas para añadir una escala a la que nada de la tarjeta se refiere. El suelo del trazado y las etiquetas del eje x permanecen: el
suelo es lo que hace que un tramo tranquilo se lea como cero y no como datos ausentes.

**El marco del trazado es la tinta de la paleta, a la opacidad propia de la paleta.** Las reglas de la cuadrícula, la regla del eje
y la mira del tooltip son la única parte de esta marca que la consola no dibuja por sí misma:
el runtime las pinta desde su propio tema, que es uno de los temas *claros* de la biblioteca salvo que la marca nombre el
modo de la consola, y multiplica las tintas que *recibe* por los tokens de opacidad de ese tema (`alpha45` en
las etiquetas, la regla del eje y las marcas, `alpha10` en la cuadrícula). Un color de paleta pasado por cualquiera de
ellos no es el color que llega a la tarjeta - una cuadrícula casi negra sobre una tarjeta oscura está a un paso de 8 bits de la
superficie sobre la que se dibuja. Por eso cada regla se nombra desde la paleta *y* se fija a opacidad completa, y el modo del
tema sigue al de la consola: `--border-soft` para la cuadrícula, `--border` para la regla del eje y sus
marcas, `--fg-2` para las etiquetas, `--muted` para la mira. La sonda del navegador lee los píxeles pintados de ambos temas
y hace coincidir la tinta con el token, porque la tarjeta clara es exactamente la superficie en la que una tinta equivocada aun así parece correcta.

**Cuatro marcas en x, elegidas por posición.** La cuadrícula de cubos llega a ~48 puntos; una marca por cubo imprimía el mismo
instante cuarenta y ocho veces a lo ancho de una tarjeta de medio ancho. El primer y el último cubo están siempre entre las
cuatro, porque son los dos con que un lector sitúa la ventana. El formato de la etiqueta sigue a la extensión:
`HH:mm` dentro de un día, `MM-DD` más allá, que es el único lugar donde se enuncia la extensión de la ventana,
y mantiene la etiqueta más externa lo bastante estrecha para caber en el canal de la tarjeta.

**La leyenda es DOM propio de la aplicación.** Sigue la escala tipográfica de la consola y la fuente de interfaz elegida.
Además tiene que ser la misma asignación de color que usa la lista de uso, lo cual solo está garantizado si una
sola lista clasificada produce ambas.

**El centro del anillo es DOM**, y es el total propio de la ventana y no el del mosaico de KPI. Ambos se leen
a cadencias distintas, así que tomar prestado el número del mosaico dejaría que el centro discrepara de los segmentos
dibujados a su alrededor. Sus porcentajes derivan del mismo total, de modo que la lista, el anillo y el centro
no pueden divergir.

**La lista clasificada es a la vez la leyenda del anillo y sus valores.** Una leyenda de biblioteca aparte imprimiría
la misma clasificación por segunda vez sin números, y un lector que compara dos modelos necesita los números: el ángulo de un
segmento es una mala manera de comparar 5.9% con 4.6%. Una proporción que se redondea a cero se informa como
inferior al paso más pequeño y no como `0%`, lo que afirmaría que un modelo no llevó nada.

**Una tarjeta estirada sigue centrando su lectura.** Las dos tarjetas de modelos comparten una fila de la cuadrícula, de modo que la
tarjeta de tendencia, más alta, puede dejar a la de uso con más altura de la que necesitan su anillo y su lista. El cuerpo de uso
reclama esa altura restante y centra la fila en ella; dejar el cuerpo con su altura intrínseca situaba
el anillo cerca de la parte superior de la tarjeta e hacía que el espacio sin usar de debajo pareciera un panel ausente.

**Ambas marcas son componentes nativos de `@ant-design/charts`** (`Line` y `Pie`) dentro del fragmento `vendor-charts`
ya cargado de forma diferida, y ambas se transforman entre dos revisiones con el token `roll` de §7 (regla 5 de §7).
El anillo no es un mapa de calor del runtime de gráficos,
así que la cuadrícula DOM del ADR 0005 no se toca.

**Las columnas de la lista de uso son una sola cuadrícula, no una por fila.** Las pistas se declaran en la lista y las
filas las heredan como subcuadrícula. Las pistas por fila se resuelven contra el contenido de cada fila, de modo que un importe un
carácter más ancho que sus vecinos desplaza a la derecha las celdas de volumen y proporción de esa fila y las
columnas numéricas dejan de alinearse a lo largo de la tarjeta - y una columna que no se alinea no puede compararse
hacia abajo, que es toda la razón por la que la lista está clasificada. Una subcuadrícula y no `display: contents`:
disolver la fila para heredar las pistas también disuelve el hueco y el separador propios de la fila, dejando la
muestra pegada al nombre y la regla dibujada en fragmentos entre las columnas.

**El anillo cede ancho a la lista, hasta un mínimo, y los paneles se apilan según el ancho de la tarjeta.** Las
columnas numéricas de la lista no pueden abreviarse, así que la columna de nombre pierde esa carrera siempre que el anillo
insista en su tamaño completo - y un nombre de modelo truncado a un puñado de caracteres no identifica nada.
Por eso el anillo se encoge antes que el nombre, y cuando ninguno cabe, ambos se apilan. Esa decisión
se toma sobre el tamaño en línea de la *tarjeta* mediante una consulta de contenedor, no sobre el viewport: la tarjeta es la mitad de la cuadrícula
en unos viewports y el ancho completo en otros, de modo que un punto de ruptura de viewport apilaría los paneles con un ancho
donde la fila aún cabe y los mantendría lado a lado en uno donde no. El marco del anillo
se mantiene cuadrado mediante CSS en todo el rango, porque un marco limitado en un eje mientras el canvas conserva
el otro dibuja una elipse.

**El hover del anillo enuncia el grupo, su volumen y su proporción**, igual que el tooltip de la tendencia, en lugar de
dejar la proporción solo a la lista. Un segmento se lee como una fracción del anillo, de modo que el porcentaje es
parte de lo que se señala; deriva del mismo total de ventana que informa el centro, de modo que la
lectura y el centro no pueden discrepar. El nombre del grupo procede del dato a través de los elementos propios de tooltip de la marca -
el elemento inferido por la biblioteca se construye desde el canal y, de modo que cada segmento se
etiquetaría con el nombre del campo que representa.

### Máscara de visualización de la clave del llamador

La columna Key de la lista de solicitudes y la faceta de clave del llamador muestran una máscara, nunca la
clave. La forma es una cabeza corta, una serie fija de viñetas y una cola corta:
`sk-1234••••••••7890`. Una clave demasiado corta para que sus extremos la identifiquen se enmascara
por completo (`••••••••`) — exponer cuatro de una clave de ocho caracteres revelaría
la mitad del secreto sin llegar a nombrarla, así que las claves cortas son
deliberadamente indistinguibles entre sí. El relleno tiene una longitud constante, así que la máscara nunca revela la longitud del secreto.

- **Una forma, ambas superficies.** La lista de gestión de claves calcula su máscara a partir del
  valor que tiene, mientras que la lista de solicitudes y la faceta del llamador leen la máscara almacenada
  con el evento. Ambas muestran la misma forma con los mismos umbrales, de modo que una clave
  nunca parece dos claves distintas según la página en que se lea: el
  `web/src/utils/maskKey.ts` de la consola se mantiene rama por rama con el `security.MaskSecret` del servidor.
  Toda clave que genera esta consola (`sk-cpa-` más 32 caracteres hexadecimales)
  son 20 glifos enmascarados.
- **El interruptor de revelar cambia la tinta, no el ancho.** La lista imprime el secreto
  dentro de una caja cuyo ancho no depende del valor que contiene, y la máscara y el
  secreto tienen la misma forma, de modo que revelar una clave no mueve nada en la tabla. Las claves
  enmascaradas llevan `--meta` y un secreto revelado la tinta de contraste completo de la consola: el
  color dice cuál de los dos está en pantalla.
- **La identidad es la huella.** La agrupación, el filtrado y la deduplicación usan el
  HMAC con clave (`api_group_key`), que es también lo que muestra el panel de detalle. La
  máscara existe solo para un humano que lee la lista.
- **Las máscaras heredadas se convierten al leer.** Las filas ingeridas antes de que cambiara el
  relleno aún llevan `xxxxxxx`; las proyecciones de lista, detalle y faceta
  normalizan el relleno y conservan los extremos visibles. Nada reconstruye un
  secreto, y una máscara ausente sigue ausente.
- **Comprobar la forma no es un límite de seguridad.** Una credencial puede contener el
  relleno, de modo que `IsMask` solo impide que un valor obviamente sin enmascarar se escriba
  en una columna de visualización; la procedencia viene de enmascarar en la ingesta.

## 3. Tipografía

```text
Font stack   "Sarasa Mono SC", "Sarasa UI SC", "Sarasa Term SC", "更纱黑体 SC",
             "Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular,
             Menlo, Monaco, Consolas, "Liberation Mono", monospace
Font files   Complete Sarasa Mono SC, Regular & Bold, in unicode-range woff2
             shards embedded in assets; local Sarasa Mono SC takes priority.
Base size    14px (antd token fontSize)
Line height  1.5
Tabular      font-variant-numeric: tabular-nums on all numeric data
```

**La fuente incrustada está completa, y una página solo descarga lo que dibuja.** Los archivos woff2
de `web/src/assets/fonts/sarasa/` son la totalidad de Sarasa Mono SC cortada en fragmentos con
`unicode-range` (ADR 0094), de modo que cualquier carácter que tenga la fuente - en los textos de la consola, una respuesta del Agent
o un nombre de modelo - se dibuja con ella y no con una fuente del sistema. El fragmento 000 (ASCII,
Latin-1, puntuación común y todos los caracteres de `web/src`) se declara en el CSS
que bloquea el renderizado desde `core.css`; el resto los registra `web/src/theme/sarasaFont.ts`, un
fragmento asíncrono que se inicia al arrancar, y se descargan solo cuando una página dibuja uno de sus
caracteres, que entonces sustituye a la fuente de respaldo. `pnpm subset-font` regenera los
fragmentos, el manifiesto, `core.css` y `shardUrls.ts`; el texto añadido desde entonces sigue dibujándose en
Sarasa, desde un fragmento diferido.

**La tipografía son dos roles, y Sarasa es su valor por defecto.** `--font-ui` (el `font-family` raíz
y el token `fontFamily` de Ant Design) y `--font-mono` (código, claves y
cifras alineadas, y el `fontFamilyCode` de Ant Design) son propiedades personalizadas que
`web/src/theme/fontLibrary.ts` sobrescribe en el elemento raíz a partir de la preferencia
`omc_fonts`. Los componentes nunca nombran una familia: heredan, o leen `var(--font-mono)`, de modo que
la elección de un operador llega a todas las superficies. Los dos que no pueden usar la cascada - el
editor Monaco y las etiquetas de los gráficos en canvas - leen el rol resuelto con `currentFontStack`.
Todo rol termina en la pila de Sarasa, que dibuja cualquier carácter que le falte a una familia elegida
(ADR 0100).

**La escala tipográfica son siete variables**, definidas en `web/src/index.css`:

| Token | Tamaño | Uso |
| --- | --- | --- |
| `--text-2xs` | 10px | Sobretítulos, códigos de insignia, las marcas de tabla más densas |
| `--text-xs` | 11px | Líneas meta, recuentos, cabeceras de columna |
| `--text-sm` | 12px | Filas de datos, registros, texto secundario |
| `--text-md` | 13px | Etiquetas, descripciones, texto de avisos y toasts |
| `--text-base` | 14px | Cuerpo (`fontSize` de antd) |
| `--text-lg` | 16px | Encabezados de sección, títulos de panel lateral y modal, el umbral de foco táctil |
| `--text-xl` | 20px | El título de página, la cifra de un mosaico contado |

Una hoja de estilos escribe un tamaño de esta escala como su token y nunca como un valor de píxel fraccionario. Un
numeral de exhibición (el número héroe, un valor de KPI) o un icono conserva un tamaño literal, porque pertenece
a una sola superficie. `pnpm check:style-tokens` comprueba ambas cosas, y que toda referencia `--text-*`
se resuelva sin valor de respaldo.

| Nivel | Tamaño / peso | Uso |
| --- | --- | --- |
| Título de página (`--text-xl`) | 20px / 600, letter-spacing −0.01em | Uno por página, el veredicto o el nombre de la página |
| h2 de sección | 16px / 600 | Secciones del panel |
| Número héroe | 42px / 700, letter-spacing −0.04em | El gran KPI |
| Valor de KPI | 28px / 700 | Tarjetas de estadísticas |
| Cuerpo | 14px / 400 | Por defecto |
| Datos / mono | 12–13px | Tablas, registros, código |
| Leyenda | 12px / 500, mayúsculas y minúsculas normales, `--muted` | Cabeceras de columna, etiquetas de campo, nombres de grupo; los niveles de registro y las marcas de unidad conservan su propia caja porque etiquetan datos |

**Reglas de jerarquía:**

1. Un título de página por página — el título del panel es el *veredicto* (p. ej. `Healthy.`),
   las demás páginas usan la etiqueta de navegación. Sin subtítulos duplicados que lo repitan.
2. Sin subtítulos decorativos. El subtítulo de una página es una línea que nombra el tema de la superficie
   (`Manage upstream AI provider endpoints, protocol drivers, and models`) o lleva
   datos en vivo (`Default CPA · Connected`, `3 auth files`) — nunca una repetición del
   título, una instrucción ni texto de marketing.
   La misma regla cubre el texto de advertencia: una etiqueta de estado (`CPA file logging disabled`) más
   una acción (`Retry`) es el mensaje completo. Las frases que explican *por qué* existe el interruptor,
   o que prometen lo que hará otra pantalla, son documentación pegada
   en la interfaz — un operador que las necesita está mirando el producto equivocado.
3. Sin traducciones apiladas: una interfaz localizada nunca muestra leyendas de otro
   idioma para lo mismo (todo idioma registrado se localiza por completo; los nombres
   propios como "Provider" pueden permanecer en inglés donde sea el término del sector).
4. Ancho máximo del cuerpo `1440px`; relleno de página de 32px en escritorio / 24px en tableta / 16px en teléfono.

Los anchos de contenido que se derivan de esos dos números son los de la consola, y una página
mide lo mismo que mide toda otra página:

```text
content area         viewport − 236 (the sider)
page column         min(1440, content area)   centred once the cap binds
content column      1440 − 2×32 = 1376  (what the page owns)
list frame          1376, its rows 1376 − 2×1 = 1374  (the frame is the list's container)
```

- **Una sola columna de contenido.** `.terminal-page` la posee. Una clase a nivel de página no debe
  declarar su propio `max-width`: una regla de igual especificidad gana por orden de fuente
  (los estilos de módulos CSS se inyectan después de la hoja de estilos), de modo que una página que fija
  `max-width: 100%` descarta en silencio el tope de 1440px y ocupa todo el ancho del
  área de contenido — medido en 1684px en un viewport de 1920px, es decir 244px más ancho que
  toda otra superficie. Cuando una página necesita realmente una columna distinta, enuncia
  la razón junto a la regla. Dos superficies lo hacen: el banco de trabajo de configuración (una columna de lectura de 920px
  entre una pista de navegación y un canal de equilibrio) y los espacios de trabajo de conversación
  (un marco anclado al viewport alrededor de una columna de lectura de 760px, §5).
- **Las listas no cambian la columna.** Una lista es su propio marco y abarca la
  columna de contenido; su ancho se deriva de la columna, no del viewport ni de
  un número de columnas. Medido en un viewport de 1920px: todo marco de lista mide 1376 y está
  en la misma x, ya esté solo (AI Providers, OAuth, gestión de claves, precios) o sea el
  cuerpo de una tarjeta cuyo encabezado lo nombra.
- **La superficie propia de una página nunca es más ancha que la página.** El desplazamiento lateral de una
  tabla ancha ocurre dentro del marco de la lista, de modo que la columna permanece donde la dejó el lector.

## 4. Forma, espaciado, elevación

```text
radius-xs     2px    marks: bar ends, heatmap swatches, 16px logos
radius-check  4px    check boxes, which the control step would round into a dot
radius-sm     6px    controls: inputs, buttons, tags, row actions, chips
999px                status pips and series dots, which are round
radius-md     8px    menus and their rows, popovers, rail entries, inner boxes, counted tiles
radius-lg     12px   enclosures: cards, lists, settings groups, dialogs, drawers, the content panel
thread scale  8 · 6 · 10 · 12px   document · control · surface · thread (ADR 0086, ADR 0103)
space scale   4 · 8 · 12 · 16 · 20 · 24 · 32 · 48px
section gap   32px (page sections); the dashboard board's cells are 16px apart
card padding  20px (antd Card paddingLG)
page head     title block left, actions right, 24px bottom margin
panel inset   8px from the window's top, right and bottom edges; none on a phone
header        52px tall, inside the panel, no rule under it
sider         236px (58px collapsed), on the canvas, no rule beside it
```

**La escala se anida.** Una forma dentro de otra toma el paso inferior al de su marco, de modo que una esquina interior nunca
parece más redondeada que el borde que la rodea. `pnpm check:style-tokens` rechaza un literal que sea un paso y una
esquina de 4px o 5px, que es un paso que nadie eligió.

**La elevación pertenece a lo que flota.** El layout, las tarjetas y las tablas no llevan sombra. Una capa que el lector
invocó lleva una línea fina *y* una sombra: `--shadow-float` para menús, popovers, paneles de selección y de fecha y toasts;
`--shadow-overlay` para diálogos y la hoja lateral de escritorio; `--shadow-raised` para el
levantamiento de un píxel del botón de un interruptor, un pulgar segmentado, la hoja de estado vacío y el compositor en reposo.
El modo oscuro lleva su propio conjunto, más profundo, porque una sombra clara no se lee sobre una página oscura. La máscara
de modales y paneles laterales (`--overlay-mask`) atenua la página en lugar de ocultarla. El mapa de enrutamiento en vivo del panel
conserva su propia profundidad iluminada, y su alcance se enuncia junto a ella (§2, Enrutamiento en vivo del panel).
`--focus-ring: 0 0 0 2px var(--accent)` es el único anillo, y nunca se dibuja en un campo de texto: un navegador
hace coincidir `:focus-visible` en todo `input`/`textarea` enfocado, y estos están dentro de controles (Input con
afijo, Select, selectores, campos numéricos) que ya marcan el foco en su caja exterior con el borde de acento
y el halo. Rodear también el campo interior dibujaba un segundo rectángulo dentro del control. Un control que llena una tarjeta
recortada a su borde redondeado - una cabecera de disclosure en el editor de proveedores - dibuja el mismo anillo hacia dentro,
siguiendo las esquinas de la tarjeta, porque el anillo hacia fuera se cortaría en un único trazo suelto.

## 5. Estructura del layout

```text
 canvas ─────────────────────────────────────────────────────
│ wordmark  ╭──────────────────────────────────────────────╮ │
│           │ nav / breadcrumb          GitHub + actions   │ │ 52px, no rule
│ nav       │                                              │ │
│ (groups)  │ page content            ← scrolls alone      │ │
│           │                                              │ │
│           ╰──────────────────────────────────────────────╯ │
 ─────────────────────────────────────────────────────────── 8px inset
   236px                  1fr — rail and panel scroll independently
```

El carril se asienta sobre `--canvas`; la cabecera y el contenido de la ruta son un solo panel sobre `--bg`, con un borde
`--border` de 1px y la esquina `lg`. En el punto de corte de teléfono (900px) el panel pierde su inset, borde
y esquina y pasa a ser la pantalla.

- `body { overflow: hidden }` — la carcasa es `100dvh`; la barra lateral y el contenido
  se desplazan de forma independiente (`overscroll-behavior: contain`).
- Las marcas SVG de plugins usan el color de texto circundante en la navegación, en las tarjetas y paneles laterales de gestión
  y en los encabezados de páginas alojadas. Son glifos sin marco: los colores de tema, hover y estado seleccionado
  se aplican sin una paleta de iconos aparte. Las marcas raster de plugins conservan sus colores originales.
- Grupos de navegación: Operate / Gateway / Observe / Control, con el grupo de plugins - gestión, la
  tienda, luego la página propia de cada plugin - antes de Control. Las etiquetas de grupo son 12px / 500 en caja
  de lectura, `--meta`. Elementos: un icono de 16px en `--muted` + etiqueta en `--fg-2`, sin subtítulos, filas de 32px con
  la esquina `md`. El hover es `--fg` atenuado al 5% sobre el carril; el elemento seleccionado es un velo del 8% con
  texto `--fg` a 500 y su icono en `--fg`. Los velos son primer plano sobre aquello en lo que se asiente
  el carril, de modo que la misma regla se lee sobre el canvas y sobre la hoja de teléfono; una barra de color o un
  relleno de acento nunca marca la selección, porque el carril es chrome y el color pertenece a los datos.
- El carril es del operador: cuáles de sus entradas muestra un despliegue es una preferencia almacenada
  (`omc_nav_hidden`, que guarda las rutas *ocultas*, de modo que una entrada que añade una versión posterior llega
  ya visible), establecida desde la página de ajustes de Shell-PAMC - una fila que abre el panel propio del carril,
  en lugar de dieciséis filas añadidas a una página de ajustes de una línea - y aplicada al carril
  expandido, al carril contraído y a la hoja de teléfono desde un mismo modelo filtrado. El panel lista el modelo
  que dibuja el carril, incluidas las páginas que registró un plugin en ejecución, de modo que los dos no pueden discrepar
  sobre qué destinos existen. Un grupo cuyas entradas están todas ocultas se va con
  ellas, la propia entrada de ajustes de Shell-PAMC se muestra activada e inerte - una preferencia que pudiera
  ocultar su propia superficie dejaría a la consola incapaz de deshacerla - y todo lo demás de la
  carcasa lee el modelo sin filtrar, de modo que una página abierta por URL sigue nombrándose en las migas
  y en el título del documento.
- El carril termina con su navegación: la conexión y la versión de CPA se leen en la
  página System Information, no se repiten en la carcasa.

### Patrones inspirados en OpenCode

Shell-PAMC se inspira en la filosofía de consola minimalista, de alta densidad y orientada a ingenieros de OpenCode, preservando la paleta de carbón cálido, los límites de seguridad y la arquitectura técnica de Shell-PAMC:

1. **Patrón de lista abierta**
   - Las listas de modelos, credenciales, elementos de configuración, etc., favorecen filas abiertas sobre contenedores Card externos anidados.
   - Las filas se separan con divisores sutiles de línea fina de 1px (`border-bottom: 1px solid var(--border-soft)`).
   - Estructura clara: nombre e identificador de la entidad a la izquierda, metadatos técnicos / proveedor en el centro y controles interactivos directos a la derecha (p. ej. interruptores, botones de acción).
2. **Densidad unificada del espacio de trabajo de credenciales**
   - Un enfriamiento `credential_quota` identificado se explica con el tooltip de estado de enfriamiento de CPA existente, sin un segundo banner rojo. Los motivos de enfriamiento no reconocidos permanecen visibles en la vista general; la pestaña Quota conserva el motivo completo y los diagnósticos de fallo de acciones.
   - El inicio de sesión OAuth, la gestión de credenciales y la lectura de cuota comparten una misma colección de credenciales. La lista presenta una vista general para escanear primero: identidad, estado de gestión y metadatos, condición de cuota, plan, antigüedad de la observación y la propia familia de modelos de la credencial como sus ventanas de cinco horas y semanal - cada una una barra rotulada que lleva su proporción, con su restablecimiento en la línea inferior. La ventana de un grupo se nombra por el período que cubre cuando el proveedor no envía un tipo, de modo que la fila se lee en el idioma de la consola sea cual sea la etiqueta del proveedor. La fila lleva una acción visible junto a su interruptor de habilitar; los modelos, la edición, un refresco de cuota, la liberación de un enfriamiento, la descarga y el borrado van en el menú de la fila, porque una fila es una lectura y no una pila de botones. Una entrada de menú nombra su acción y nunca el nombre de archivo, que estiraría el menú hasta lo que se llame la credencial más larga; el nombre de archivo pertenece a la confirmación, donde identifica el destino. Un refresco se informa una sola vez, como toast: una ejecución sin fallos es un acuse que se va solo, y una ejecución con un destino fallido es un toast de informe que lista el motivo de cada destino y permanece hasta que se cierra. Canjear un crédito de restablecimiento acumulado no es en absoluto una acción de fila: es irreversible y gasta un derecho, de modo que solo la pestaña Quota del Drawer lo ofrece, junto a los vencimientos de crédito que consume. Una acción Details abre la lectura completa - cada familia, crédito, enfriamiento y diagnóstico - en el Drawer de la credencial. El suelo de la vista general son seis registros completos de credencial a 1440x900: a la fila se le permite su altura, porque leer una credencial importa más que meter tantas como sea posible. El Drawer separa Quota, Configuration y Models en pestañas; solo la tarea seleccionada es visible. Los borradores de configuración sobreviven a los cambios de pestaña y permanecen protegidos al cerrar desde cualquier pestaña. Los campos seguros y los modelos se obtienen solo cuando se seleccionan sus respectivas pestañas. La búsqueda permanece visible, los filtros adicionales se despliegan bajo demanda, y la paginación posee el tamaño de página. Las pestañas de proveedor muestran las familias pobladas más la familia seleccionada; los proveedores vacíos siguen disponibles en Connect. Los límites de registro son visibles, los colores de estado siguen siendo semánticos, y las etiquetas y el orden de modelos/grupos sobreviven al renderizado completo de cuota.  La completitud total de la cuota se verifica en la pestaña Quota, incluidas seis ventanas de modelo/grupo, sin desbordamiento horizontal en la lista ni en el Drawer a 320px. Los pies compactos de ventana ajustan las estimaciones largas de capacidad, incluidos los valores solo de tokens del ciclo anterior en estilo de dígitos completos, dentro de su propia ventana en lugar de recortar dígitos o ensanchar la página.
3. **Densidad según la tarea**
   - Monitorización y telemetría de alta frecuencia (Dashboard, Live Logs, Request Records): densidad alta, compacta, alineación tabular monoespaciada.
   - Configuración y operaciones del sistema (Config, Pricing, System Settings): más espacio en blanco, espaciado de sección de 32–48px y divisores de ancho completo de 1px.
4. **Límites honestos de las tarjetas**
   - Las tarjetas se reservan para: KPI centrales, resúmenes de entidades clave y comparaciones entre pares.
   - Nunca envolver una entrada o un interruptor aislado en su propia caja de tarjeta para evitar el desorden visual.
5. **Panel de comparación entre pares**
   - Patrón de tarjeta de comparación horizontal de varias columnas: cuadrícula exterior limpia + bordes de línea fina de 1px + divisores interiores (métricas principales de comparación arriba, fuentes secundarias y logotipos de proveedor debajo).
6. **Siguientes acciones contextuales**
   - Permitir una sola línea concisa que describa el destino actual o guíe el siguiente paso (p. ej. enlaces subrayados como `Learn more.` o `Documentation`).
   - Evitar texto de marketing o guías extensas dentro de las tarjetas de la UI.
7. **Ranura de contexto superior**
   - El lado izquierdo aloja el conmutador de navegación y las migas del grupo/página actual; el arte de producto pertenece al carril lateral o a la hoja de navegación del teléfono;
   - El lado derecho aloja cinco acciones de ancho fijo: el enlace de GitHub del proyecto, refrescar, el control de modo de tema, el menú de idioma y cerrar sesión. **El control de modo alterna y el control de idioma es un menú**, y esa asimetría es deliberada. El tema era un menú mientras la consola llevaba seis paletas y un conmutador solo podía responder «la otra»; las paletas pertenecen ahora a los modos y se eligen en la página de ajustes de Shell-PAMC, donde cada candidata repinta toda la consola al elegirse, de modo que la pregunta que le queda a la cabecera es claro u oscuro - con seguir al sistema como tercer estado, un icono por estado (un sol, una luna, un escritorio). El tooltip del control es su propio nombre y deliberadamente no una frase sobre su estado; los estados se nombran con palabras en la propia fila de la página de ajustes. El idioma sigue siendo un menú porque cuatro idiomas, uno de los cuales el lector puede no leer, es exactamente el caso que responde una lista: nombra cada opción por su **endónimo** - su propio nombre en su propia escritura, nunca una traducción. El selector de idioma de la página de ajustes lista los mismos endónimos.
   - El enlace de GitHub del proyecto usa la marca Octicons local existente y abre `https://github.com/Bizasbot/Shell-PAMC` en una pestaña nueva con `noopener noreferrer`; no muestra tooltip — la marca lo nombra y el recuento que se despliega responde al hover — mientras que su nombre accesible sigue el idioma de lectura, y permanece disponible en la demostración. En reposo el enlace es solo la marca; al apuntarlo o enfocarlo, despliega el recuento de estrellas del proyecto antes de la marca durante `base` — un glifo de estrella y el recuento, exacto por debajo de mil y miles truncados con dos decimales por encima (`1.23k`) — una vez que el servidor ha leído uno, y con movimiento reducido sigue esperando al puntero o al foco pero aparece de inmediato, sin la transición. Es el primer control de una fila alineada a la derecha y la etiqueta va primero, de modo que al desplegarse se ensancha alejándose de los demás y la marca permanece bajo el puntero; un dispositivo sin hover muestra el recuento todo el tiempo. Una línea fina separa el enlace de las acciones propias de la consola. Las cinco acciones son un solo componente, `web/src/components/common/HeaderAction.tsx`: 32px de alto, sin borde en reposo, el mismo hover y el mismo tratamiento de etiqueta para el recuento de estrellas y el código de idioma. **Toda acción de la cabecera conserva un mismo ancho en todo idioma de lectura.** Las etiquetas son lo único cuya longitud cambia con el idioma, así que cerrar sesión es un botón de icono nombrado por su tooltip, y el disparador de idioma guarda su código en una ranura fija. Un control que cambia de tamaño mueve las acciones que tiene al lado, lo cual es un defecto real y no cosmético: el puntero ya está sobre una de ellas.
   - En teléfonos el grupo de acciones conserva sus anchos de control completos con un hueco de 4px y un relleno de borde de 12px consciente del área segura; el conmutador de navegación no se encoge, y las migas actuales se truncan con puntos suspensivos en lugar de solaparse con las acciones. El estado de conexión y la versión son de la página System Information, no de la cabecera: esta ranura lleva acciones. Nunca mostrar avatares fabricados, saldos ficticios ni selectores de espacio de trabajo simulados antes de que existan las capacidades reales.
8. **Banco de formularios y paneles de grupos de ajustes**
   - **Barra de herramientas de ancho completo y anclaje al viewport**: La barra de acciones superior y su borde inferior de 1px abarcan el 100% del viewport, con las acciones del lado derecho (búsqueda / refrescar / guardar) fijadas al extremo derecho (alineadas verticalmente con las acciones de la cabecera global) para eliminar huecos vacíos incómodos. El banco de formularios inferior mantiene una cuadrícula de tres pistas: navegación de sección fija de 216px + ancho de lectura de 920px + canal de equilibrio de 216px (usado solo para centrar el contenido en viewports anchos), estableciendo un layout anclado que mantiene los formularios enfocados y legibles.
   - **Paneles de grupos de ajustes**: Los ajustes relacionados convergen en **paneles de grupos de ajustes** (un recinto de línea fina de 1px sobre el fondo `--bg` del panel con la esquina `lg`, filas separadas por una regla discontinua con inset de 20px desde el borde) en lugar de una lista plana interminable de campos o tarjetas fragmentadas. Se usan tres estructuras especializadas:
     1. **Cuadrícula de formulario**: Etiquetas y descripciones arriba, controles debajo; los campos cortos relacionados (como Host y Port, recuentos de reintentos y retrasos) se sitúan lado a lado; los campos numéricos cortos se acotan a 120px y los selects de selector a 280px, mientras que el editor de etiquetas de un campo de lista llena su columna y crece a medida que sus etiquetas se ajustan, ya que no tiene desplegable que abrir ni opción más larga con la que dimensionarse;
     2. **Lista de ajustes**: Los interruptores y banderas usan listas de filas dentro de la tarjeta con «título y descripción a la izquierda + Switch a la derecha», acotadas por el contenedor del panel;
     3. **Gestionado en otra parte**: Un grupo cuyo campo se edita en su propia página (las claves de API del cliente proxy) expresa cuánto está configurado y lleva allí con una sola acción, en lugar de llevar un segundo editor que podría discrepar del primero. También se renderiza en los resultados de búsqueda, de modo que buscar ese campo encuentra el panel que lo nombra;
     4. **Panel de divulgación progresiva**: Las secciones TLS alojan un interruptor de habilitar en la cabecera del grupo; cuando está deshabilitado solo se muestra texto explicativo; cuando está habilitado, los campos de ruta del certificado y de la clave privada se expanden con suavidad, preservando los datos YAML y deshabilitando los controles ocultos cuando está plegado.
   - **Barra de herramientas de acción fija**: El título, la píldora de sincronización, el conmutador de modo (`Visual / Source`) y las acciones (búsqueda, refrescar, guardar) convergen en una única barra fija. El botón Save permanece anclado al extremo derecho.
   - **Ergonomía de los objetivos**: Las acciones en línea de alta frecuencia usan botones cuadrados discretos de 32×32px (borde de 1px y fondo sutil), que ofrecen amplios objetivos de clic y retroalimentación por tooltip en lugar de iconos desnudos.
   - **Tamaño de los controles de formulario**: Los controles miden de 38 a 40px de alto con fuente de 14px para una edición cómoda; los campos numéricos se alinean a la izquierda con un relleno derecho de 34px para evitar que los pasos oculten los valores.
   - **Editor de código YAML Monaco**:
     - **Restricción sin conexión y sin CDN**: Inyecta el núcleo `monaco-editor` empaquetado localmente con `editor.worker` y `yaml.worker`; nunca carga recursos mediante CDN; desactiva las solicitudes remotas de esquema (`enableSchemaRequest: false`);
     - **Carga diferida bajo demanda**: La importación dinámica mediante `React.lazy` evita el sobrepeso en las cargas iniciales de página; los alias de Vite eliminan los workers de lenguaje no usados, empaquetando solo `editor.worker` (274 KB) y `yaml.worker` (1017 KB);
     - **Integración con el tema de la consola**: Los temas dedicados `omc-dark` y `omc-light` coinciden con la pila mono de la consola y los bordes de línea fina de 1px, eliminando el contraste brusco de los temas predeterminados de VS Code;
     - **Capacidades completas de IDE**: resaltado de sintaxis YAML, emparejado de corchetes, guías de sangría, plegado, búsqueda/reemplazo con `Ctrl+F`, interceptación nativa de `Ctrl+S` y pistas explícitas de formato/validación.
   - **Barra flotante de acción de cambios sin guardar y semántica de confirmación**:
     - **Disparador**: Aparece solo cuando existen ediciones sin guardar (`isDirty === true`), totalmente oculta en caso contrario; la barra de herramientas superior muestra simultáneamente un botón Discard;
     - **Centrada en el viewport y no intrusiva**: Se centra dinámicamente dentro de la columna de contenido según `--app-sider-width`; el contenedor exterior usa `pointer-events: none` para no bloquear las interacciones de la página inferior;
     - **Tono discreto**: borde de 1px, fondo sólido `--surface`, la esquina `lg` e indicador ámbar de cambios sin guardar;
     - **Reglas de confirmación**: Las acciones de guardado disparan un `ConfirmAction` (y `Ctrl+S`/`Cmd+S` dispara un modal de confirmación); las acciones de descarte revierten de inmediato sin confirmación, descartando limpiamente la barra de cambios; Save se deshabilita con explicaciones en tooltip cuando el YAML tiene errores de sintaxis o faltan campos obligatorios.
   - **Constructor modular de reglas de payload**:
     - **Paneles plegables estructurados**: Sustituye los textareas sin procesar genéricos por paneles estructurados (Default rules, Default Raw rules, Override rules, Override Raw rules, Filter rules); todas las categorías empiezan plegadas, las elecciones explícitas de despliegue sobreviven a las actualizaciones externas del documento, y un guardado fallido abre la primera categoría no válida;
     - **Mapeo AST bidireccional sin pérdidas**: Manipula directamente el AST del documento YAML; los modelos, protocolos, parámetros tipados, fragmentos sin procesar y rutas de filtro usan controles dedicados; preserva las configuraciones que no son de payload, el orden y los comentarios, recorriendo de ida y vuelta los campos desconocidos (`_extra`);
     - **Momento de validación (Pristine → Touched → Submitted)**: Evita errores prematuros al abrir o añadir una regla por primera vez; los campos obligatorios permanecen neutros hasta el blur (`onBlur`) o el envío; los errores se borran de inmediato con una entrada válida;
     - **Modal de coincidencia avanzada**: Admite filtrado por protocolo (`from-protocol`), coincidencia de cabeceras (`headers`), coincidencia de igualdad de ruta (`match`), coincidencia de desigualdad de ruta (`not-match`) y comprobaciones de existencia de ruta.
   - **Fundamento arquitectónico: por qué evitar @ant-design/pro-components**:
     - ProComponents (`FooterToolbar`, `ProFormList`) empaquetan dependencias enormes (`rc-field-form`) y patrones empresariales pesados;
     - Añadirlos introduciría megabytes de peso de bundle, en conflicto con el mandato de binario único, sin CDN y sin conexión, e introduciría sombras incompatibles;
     - Los componentes nativos dedicados se integran sin fricción con el flujo de estado del AST YAML, lo que da un tamaño de bundle mínimo, respuesta instantánea y alta personalización.

### Cabecera de página

Toda ruta se abre con la misma cabecera, construida por `PageHeader` (`web/src/components/common/`), de modo que un
lector que se mueve entre páginas nunca ve saltar ni cambiar de tamaño el control de refrescar:

- **Bloque de título a la izquierda, acciones a la derecha.** Un `h1` (`.terminal-title`), y debajo solo una línea que
  lleva datos en vivo (los recuentos del espacio de trabajo OAuth, los totales de proveedores, modelos, claves y
  cabeceras de la lista de proveedores de IA). Una frase que describa para qué sirve la página repite
  la etiqueta de navegación que tiene al lado y no se dibuja.
- **Sin texto eco.** Una nota al pie que repite la ventana de una columna, una pista bajo un campo que repite su etiqueta, un
  aviso que explica cómo almacena algo la consola: cada una es documentación pegada en la superficie.
  Lo que permanece es una consecuencia que el operador debe ver antes de actuar - una eliminación que no puede deshacerse, un
  secreto cambiado que revoca clientes - y va en la confirmación, donde ocurre la acción.
- **Acciones a la altura de control predeterminada (32px)**, que se ajustan en varias líneas como grupo. La acción primaria, cuando
  la hay, es la *última* acción para que se sitúe en el borde derecho de la página; refrescar va primero.
- **La fila del título está fijada arriba** y se dibuja con la altura de 32px de la fila de acciones, de modo que el título de toda página
  cae en la misma línea tanto si le sigue una línea como si no; alineada abajo, una página con
  subtítulo elevaba su título seis píxeles por encima de una sin él, y al moverse entre ellas saltaba.
- **Las acciones secundarias son glifos** (`ToolButton`): un cuadrado de 32px nombrado por su tooltip y su nombre
  accesible. Una fila de botones rotulados es tan ancha como sus palabras en el idioma de lectura y se recolocaba bajo
  el puntero de una página a otra; los cuadrados no. La acción primaria de la página conserva su etiqueta - es la
  que un lector busca por nombre - y también una fila de menú: dentro de `ActionMenu` un `ToolButton` recupera su
  etiqueta, porque un glifo solo no nombra nada en una lista.
- **Un único control de refrescar** (`RefreshButton`): el glifo de giro propio de la cabecera, un `ToolButton`; conserva
  su etiqueta solo como reintento de una lectura fallida, donde es el camino a seguir de la página. Una lectura en curso *hace girar el glifo* en lugar de
  establecer el `loading` de antd, que se traga los clics y cambia el glifo por un spinner de otra forma.
  `SyncOutlined` se reserva para trabajos de sincronización (el catálogo de precios, un refresco de cuota).
- **Los bloques apilados comparten un ritmo.** Una página de alertas, paneles y listas usa `.terminal-page-stack`
  (16px entre bloques, 24px bajo la cabecera) en lugar de márgenes por bloque.
- **El estado es un indicador y una palabra** (`StatusLabel`: success / warn / danger / accent / neutral), no una
  etiqueta rellena. Una columna de cajas de colores no llevaba ninguna información que la palabra no llevara.
- **Las acciones de fila son cuadrados discretos de 28px** (`.row-actions` / `.row-action-btn`), separados 8px para que los
  insets de impacto de las reglas táctiles se encuentren en lugar de solaparse. En reposo una acción es solo su glifo `--muted`,
  sin marco ni relleno - un botón enmarcado repetido en cada fila era lo más ruidoso de una lista -
  y el puntero hace aparecer bajo ella un velo `--fg` del 7% con el glifo en `--fg`. Una acción destructiva
  muestra el color de peligro, sobre un velo de peligro del 12%, solo al pasar el puntero - una columna de papeleras rojas se leía como una
  columna de errores. Las acciones destructivas se confirman en un `ConfirmAction` cuyo botón de confirmar es el de peligro.
  Las filas de plugins instalados mantienen la configuración directamente accesible junto a un botón de desbordamiento a juego;
  los enlaces de repositorio/página de inicio y la desinstalación viven en ese menú. El interruptor de habilitar se separa del
  par de acciones con una regla discreta, y la desinstalación se confirma contra la misma fila. Estos controles usan
  el dimensionado de acción de fila, la paleta y los tokens de movimiento existentes. Cancel y Escape devuelven
  el foco del teclado a la acción de la fila. La insignia de capacidad de proveedor de autenticación dice «Auth provider»; no rotula como OAuth un método de inicio de sesión no especificado.
  El selector de conexión OAuth muestra los nombres de plugin sin sufijo OAuth y una
  etiqueta de método «Plugin-managed». Un plugin con una página registrada ofrece «Open plugin page»
  en lugar de OAuth Start; los proveedores sin página resuelven los controles de dispositivo/redirección solo tras
  una solicitud de inicio de sesión explícita exitosa.
- **Las cabeceras de tarjeta** usan `PanelTitle`: un glifo atenuado, el título y el único control que actúa sobre esa
  tarjeta por sí sola.
- **Las cabeceras de tabla nunca se ajustan.** Una columna comprimida ajusta sus celdas, no su nombre.
- **Una sola superficie de lista.** Toda lista ancha se dibuja como la lista de credenciales OAuth: un marco `--border`
  de 1px con la esquina `lg`, nombres de columna sin banda propia (la tipografía de leyenda:
  12px, peso 500, caja de lectura, `--muted`, 8px × 16px, sobre la misma regla suave que usan las filas), filas
  sobre `--bg` a 12px × 16px divididas por reglas `--border-soft`, y un velo de hover `--fg` del 3%; la fila
  cuyo registro está abierto en un panel lateral toma un velo del 6%, nunca una barra de borde. La regla compartida `.data-table` de `web/src/index.css` la dibuja
  para `ResponsiveList`; una lista que es todo el cuerpo de una tarjeta añade `.data-table-flush`, de modo que la
  tarjeta es el marco y ninguna lista se sitúa en un marco dentro de un marco.
- **Una lista resumida antes de listarse se abre con `StatTiles`** (`web/src/components/common/`):
  una tira de mosaicos contados sobre `--bg` con un marco `--border` de 1px y la esquina `md`, una etiqueta de 12px (un
  `StatusLabel` para un mosaico tonalizado, simple para el mosaico «todo») sobre un recuento tabular de 20px, que se pinta en su tono
  solo cuando no es cero. Cada mosaico es también el filtro de la lista (`aria-pressed`; el seleccionado toma
  el marco de acento y `--hover-inset`), y el `Toolbar` con regla de búsqueda y selects se sitúa
  justo debajo. Lo usan los resultados del registro de auditoría, los estados de la lista de proveedores de IA y el
  uso de la lista de claves en las últimas 24 horas (todas, usadas, inactivas). Las dos listas de Gateway se construyen con las mismas
  piezas: el resumen bajo el título, los mosaicos, la barra de herramientas con regla con los totales de la ventana en su
  extremo, una tabla cuyas filas se abren sobre un mosaico de velo de 36px y terminan en acciones de fila discretas, y un `AppDrawer`
  para el editor.
- **Las listas se renderizan mediante `ResponsiveList`**: una tabla en un viewport ancho, filas rotuladas por debajo de 640px,
  un estado vacío (un `EmptyState` compacto) y ningún paginador para una sola página.
  Una tabla ancha se desplaza lateralmente dentro de su propia caja y nunca verticalmente: la rueda sobre una lista
  desplaza la página, por muchas listas que apile una página.
- **Un filtro contado sobre un conjunto abierto sigue siendo un `Select`** cuyas opciones llevan el recuento (las
  categorías de auditoría, las familias de proveedores): una tira de mosaicos o pestañas es para un conjunto pequeño y cerrado.
- **Un registro se abre en un Drawer.** Una fila es una lectura; el registro completo - identificadores, el código sin procesar
  detrás de una frase, detalle registrado - se abre desde la acción Details de la fila (o un clic en la fila)
  en un Drawer, nunca expandiendo la fila en el lugar, lo que empujaba hacia abajo en la página cada fila posterior.
  Cuando la lista es una secuencia (solicitudes, registro de auditoría), el Drawer avanza a sus vecinos.
  En un teléfono un registro cuya fila es una frase y un veredicto (el registro de auditoría) es una fila tocable:
  la frase y su estado en la primera línea, la hora y el destino debajo, un chevrón -
  en lugar de una lista de campos rotulados con un botón Details aparte.
- **Una lista agrupada por un encabezado es un marco por grupo** (los proveedores del libro de precios, los días
  del registro de auditoría), con los nombres de columna dibujados una vez, sobre el primer marco; los marcos posteriores conservan su
  fila de cabecera para la tecnología de asistencia y la recortan de la vista (`.data-table-head-hidden`).
- **El código se muestra en un `CodeFrame`**: una cabecera que nombra el lenguaje con la acción de copiar, luego el código
  en la pila mono propia de la consola - nunca el `monospace` predeterminado del navegador.

### Superficies de retroalimentación

Toda notificación, fallo y error llega al operador mediante una de dos superficies, ambas en
`web/src/components/feedback/` (ADR 0045). La elección depende de lo que describe el mensaje, no de
su gravedad:

| El mensaje describe | Superficie | Componente |
| --- | --- | --- |
| El resultado de algo que el operador acaba de hacer - guardado, copiado, rechazado, tres de cinco refrescados | **Toast** | `useToast()` |
| Una región que no pudo leerse - un gráfico, una lista, la pestaña de un panel lateral | **En línea, en el lugar de la región, con Retry** | `LoadFailure` |
| Una condición que se mantiene mientras la región está en pantalla - datos obsoletos, una función desactivada, un diagnóstico sobre un registro | **En línea, donde se aplica** | `Notice` |
| Un rechazo que el operador responde en el lugar - un inicio de sesión, un campo de formulario, un mensaje del Agent rechazado que lleva su propio Retry | **En línea, junto a esa entrada** | `Notice` / el error de campo propio del formulario |

- **Un resultado, una superficie.** Un toast nunca se repite como banner, y un resultado nunca abre un
  diálogo solo informativo: `modal.confirm` pregunta antes de una acción, un toast informa después.
- **Un toast** es un panel flotante como un menú: relleno `--elevated`, un borde `--border` de 1px y
  `--shadow-float` (§4), la esquina `lg`, un ancho (420px, el token `Notification.width`
  de antd) y un icono de 18px. Se abre arriba al centro, nunca se apila en un montón colapsado, y se mantiene
  2s (un éxito breve), 3s (info o un éxito con detalle), 4s (advertencia) o 5s (error); un
  atajo ofrecido recibe 6s, y el hover pausa el temporizador restante en lugar de reiniciarlo.
  Un atajo también debe ser alcanzable desde la página sin temporizador; una acción crítica en el tiempo o exclusiva
  requiere una superficie persistente. Una segunda línea lleva el motivo, con un sobre JSON
  upstream leído hasta su estado y frase (`readableReason`).
- **Un informe es un toast que permanece.** Un resultado por lotes con motivos por destino (un refresco de cuota, una
  habilitación o borrado por lotes, una subida) los lista bajo encabezados de grupo - lo que necesita atención primero -
  con el nombre completo de cada destino en su propia línea y su motivo debajo, y permanece hasta que se cierra.
  Las notificaciones ordinarias nunca desalojan un informe; el siguiente refresco sustituye al informe bajo la misma clave. Un
  grupo largo de contexto (destinos nunca elegibles) se resume en una línea por motivo. Nada en un toast
  cambia de altura tras abrirse: antd coloca los toasts a partir de las alturas que midió al llegar, de modo que un
  grupo que se expandiera en el lugar se deslizaría bajo el toast inferior.
- **Un fallo de carga** nombra lo que no pudo leerse, por qué, y ofrece Retry en el lugar, de modo que el operador
  repara el único panel sin recargar la página a su alrededor. Una relectura fallida sobre datos aún en
  pantalla es el tono de advertencia sobre esos datos; una primera lectura fallida ocupa el lugar de los datos, y lo dice
  una vez.
- **Un rechazo sin nada que responder es un toast.** El Agent rechaza un envío, una repetición o un
  adjunto mediante un toast con clave, de modo que una repetición sustituye al último; una comprobación de actualizaciones que el
  operador pidió informa de su fallo en un toast con el motivo, y solo una comprobación automática
  enuncia su fallo en la tarjeta de versiones.
- **Un aviso es un velo tintado, no un banner con bandera.** Pertenece a la región que describe, de modo que
  se dibuja como parte de la página: su tono mezclado al 8% en `--bg` para el relleno, una línea fina del
  tono al 16%, y la esquina `md`, sin barra en su borde. El código del tono ocupa la primera línea
  (11px, 600, 0,02em) en el color del tono - `INFO` `--accent`, `WARNING` `--warn`, `ERROR` `--danger`, `SUCCESS` `--success` - de modo que
  nunca descansa en el color; el titular sigue a 13px en su propia línea con todo el ancho, con su
  detalle debajo en `--fg-2`, y sus herramientas en el borde final.
- **La acción de un aviso se sitúa junto a la frase; su control de cierre, en la esquina.** Una acción
  es un control discreto del aviso en lugar de un botón puesto encima: 26px de alto, sin relleno propio,
  un borde `--thread-hairline` y el paso `--thread-field-hover` al pasar el puntero, con su glifo en `--muted`.
  Se mantiene en el borde final: centrada junto a la frase, o en la última línea debajo de ella cuando
  a la frase le quedarían menos de 220px. El control de cierre existe solo cuando la condición
  puede descartarse: un cuadrado de 26px con el mismo paso de hover, fijado a la línea del código en un canal final
  de 40px. Un aviso cerrable siempre da a su acción la última línea, llegando hasta el
  canal de modo que el borde final de la acción y el del glifo de cierre sean un mismo borde, de esquina superior a esquina
  inferior. Bajo `(pointer: coarse)` el control de cierre gana un inset de área de impacto de 6px.
- **El código del tono no se traduce.** Son las mismas cuatro palabras en todo idioma de lectura, como lo son
  un nivel de log o un estado HTTP: reconocibles de un vistazo y buscables en una captura de pantalla.
  Todo lo que sigue está en el idioma del lector. Un `icon` es para un aviso que informa de trabajo en
  curso o de una clase de riesgo; se sitúa antes del código y nunca lo sustituye.
  `Notice` se dibuja a sí mismo: el `Alert` de antd no se usa en ninguna parte.
- `pnpm check:feedback` rechaza `Alert`, `message` y `notification` de antd, y los diálogos
  `modal.*`/`Modal.*` solo informativos, en cualquier lugar fuera del módulo de feedback. También rechaza el `Switch` de antd
  en todas partes (Switch, más abajo). Todas las comprobaciones resuelven los enlaces de Ant Design,
  incluidas las importaciones de espacio de nombres, los alias locales y los resultados de `App.useApp()`; se ignoran los comentarios, las cadenas,
  las importaciones solo de tipos y los enlaces no relacionados u ocultos.

#### Justificación del cierre automático

No existe una duración universal compartida por los sistemas de diseño establecidos. La implementación de message de Ant Design
usa 3 segundos para retroalimentación breve; [la guía de toasts de Fluent](https://fluent2.microsoft.design/components/web/react/core/toast/usage)
usa 7 segundos para notificaciones sin acción; [React Spectrum](https://react-spectrum.adobe.com/Toast.html)
usa un mínimo de 5 segundos y mantiene los toasts accionables hasta que se descartan. Son políticas de productos
distintos, no garantías de accesibilidad intercambiables (fuentes comprobadas el 2026-09-30).

Esta consola usa 2 segundos solo para acuses de éxito que se captan de un vistazo, conserva al menos
3 segundos para una segunda línea, y da a los resultados de advertencia/error 4/5 segundos. Los atajos opcionales reciben
6 segundos en lugar de prolongar todos los acuses. Sus destinos siguen disponibles mediante los
controles ordinarios de la página: las credenciales OAuth mediante la colección de proveedores y los ajustes de plugins mediante
el panel de ajustes. [WCAG Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)
permite avisos temporales cuando hay información o funcionalidad equivalente disponible sin temporizador;
el hover por sí solo no sustituye esa alternativa. Los informes importantes por destino siguen siendo persistentes,
el trabajo pendiente se cierra solo cuando se resuelve, y los llamadores pueden elegir explícitamente la persistencia o sustituir
la duración predeterminada. Los cambios de duración no cambian el presupuesto de movimiento de entrada/salida.


### Primitivas compartidas

Los patrones que toda página necesita son un componente cada uno, en `web/src/components/common/`. Una página
aporta el contenido y el ancho del layout; lo que hay dentro del marco no se re-estiliza por página.

- **`AppDrawer` - un panel lateral.** Se abre desde el borde final en uno de tres anchos, cada uno
  limitado al viewport, de modo que un teléfono recibe una hoja a todo el ancho: `narrow` 420px (un formulario de filtros, una lista
  corta), `medium` 600px (un editor, un registro), `wide` 760px (un registro con pestañas, una tabla o un
  documento). El control de cierre está en el extremo final de la cabecera y siempre tiene nombre. El pie
  tiene dos ranuras - `footerStart` para una nota de estado o un restablecimiento, `footer` para las acciones que concluyen el
  trabajo, en el borde final - y se ajusta en varias líneas en lugar de comprimirse. Al cerrarse, conserva el título, el cuerpo y el
  pie que mostró por última vez hasta que termina de deslizarse, de modo que un llamador que lo cierra borrando su
  selección no lo hace salir en blanco; su cuerpo mantiene un canal de barra de desplazamiento estable, de modo que una sección
  que se despliega más allá de la altura del panel no estrecha todas las tarjetas a mitad del despliegue. La hoja de navegación del teléfono
  y la hoja del rango de tiempo no son paneles laterales y conservan el `Drawer` de antd.
- **`SearchInput` - un campo de filtro mientras se escribe.** El glifo de búsqueda en `--muted`, el texto y un
  control de borrado. `label` es su nombre accesible y su placeholder salvo que se dé un placeholder más largo;
  `onChange` recibe el texto. El ancho lo decide el llamador.
- **`EmptyState` - una región que no contiene nada.** Una columna centrada: una marca, el estado en una línea,
  opcionalmente una línea más y una acción. La marca es una hoja de 44px sobre `--bg` con la esquina `md`
  y `--shadow-raised`, que lleva tres reglas de 2px cada vez más cortas en `--border` - las filas que
  no están - con una segunda hoja `--surface` inclinada 9° detrás. Se dibuja en CSS con las capas propias de la
  página en lugar de la bandeja ilustrada de Ant Design: las únicas imágenes de la consola son las formas de las que
  están hechas sus páginas. El título es 14px / 500 en `--fg`, la línea adicional 13px `--muted`. `block` (48px
  de relleno vertical, con la marca) sustituye a una lista o a una sección de página; `compact` (20px, sin marca) va dentro de un panel, un selector o una sección de panel lateral.
  La carga es `PageLoading` y el fallo es `LoadFailure`; ninguno es un estado vacío.
- **`SectionHeading` - la cabecera de una sección**, en tres pesos: `section` (`--text-lg` / 600) abre
  una parte de una página, `group` (`--text-base` / 600) un panel, un grupo de ajustes o una sección de panel lateral, y
  `label` (`--text-xs` / 600, `--muted`, caja de lectura) una serie corta de campos o datos. Admite
  un recuento opcional en numerales tabulares tras el título, una línea de descripción (no en un `label`) y
  un control `extra` en el borde final. El elemento (`h2`-`h4`, `div`) sigue el esquema del documento,
  independientemente del peso. El marco alrededor de una cabecera queda a cargo de su llamador.
- **`Tag` - un dato breve sobre una fila**: un tipo, un estado, un recuento. 22px de alto, `--radius-sm`,
  `--text-sm`, numerales tabulares; `small` es 18px, `--radius-sm`, `--text-xs`. No lleva margen -
  el espaciado es el hueco de la fila - ni borde: una fila de datos con contorno se leía como una tira de cajas. Cinco
  tonos: `neutral` (`--fg-2` sobre un velo del 6% de la tinta) y `success`, `warn`, `danger`, `accent`, cada uno
  con la tinta del tono sobre un tinte del 12%. Un tono expresa salud o énfasis y nada más; un color de marca es una
  propiedad personalizada por sitio, no un sexto tono. `ToggleTag` es la forma pulsable, para un conjunto pequeño de
  filtros mutuamente excluyentes: atenuado y sin relleno en reposo, con un velo del 8% al pulsarse.
- **`ConfirmAction` - una confirmación anclada a su disparador**, para una acción barata de
  confirmar y local a una fila. La etiqueta de cancelar es fija; el botón de confirmar lleva el nombre de la
  acción (`confirmLabel`) y `isDanger` lo colorea para un borrado. Una decisión que necesita un párrafo
  o un nombre escrito es un modal, no esto. El tooltip del disparador se pasa como `tooltip`, nunca lo envuelve
  el llamador alrededor del disparador: se aparta mientras la confirmación está abierta, porque un tooltip
  que se quedaba encima tapaba los botones de la propia confirmación.
- **`SelectionBar` - qué se puede hacer con las filas marcadas.** Se renderiza solo mientras hay algo
  seleccionado. El lado inicial contiene el recuento (una región en vivo), una nota calificativa opcional y los
  controles que cambian la selección; las acciones están en el borde final y bajan a otra línea en una
  pantalla estrecha. `framed` es una tira propia sobre una lista; `inline` es una fila dentro del marco de la
  lista.
- **`Toolbar` - la fila sobre una lista**: búsqueda, luego los filtros que la acotan, luego `end`, los
  controles que actúan sobre todo el resultado, empujados al borde final. Se ajusta en varias líneas en lugar de desplazarse
  y solo posee el hueco (8px entre líneas, 12px entre controles); cada control posee su ancho.
  `ruled` coloca la fila entre dos líneas finas `--border-soft` en `--muted` `--text-md`, para un registro o
  una lista de auditoría cuyos filtros se confundirían con las filas.
- **`Panel` - la superficie enmarcada sobre la que se asienta el contenido**: `--surface`, un borde `--border` y un relleno de
  20px que la hoja de estilos baja a 16px en un teléfono (12px en un mosaico del panel). El relleno no es una
  prop: un padding en línea prevalece sobre la regla del teléfono. `title` y `extra` dibujan una cabecera con regla; un panel
  cuyo encabezado necesita una descripción o un recuento abre su cuerpo con un `SectionHeading`.
- **`FactList` - una lista de etiqueta/valor.** Una lista de descripción con la etiqueta en `--muted` en el borde
  inicial y el valor alineado a la derecha en numerales tabulares, filas separadas por `--border-soft`. `strong`
  dibuja los valores a 600 en `--fg`; `quiet` con peso de lectura en `--fg-2`, para el detalle de un registro en el que
  todos los valores tienen la misma categoría.
- **`CopyButton` - un botón que copia un valor** y lo confirma en el lugar: el glifo se convierte en una
  marca de verificación durante 1,5s, y solo un fallo muestra un toast.
- **`Pager` - navegación de páginas para una lista de longitud conocida.** Controles pequeños, nada en absoluto
  cuando la lista cabe en una página, y sin menú de tamaño de página: el tamaño de página es una preferencia de vista y va
  con los demás controles de vista de la lista. `numbered` lista las páginas; `stepped` es anterior, la página
  sobre el total, siguiente, para un teléfono o una columna estrecha. Una lista paginada por cursor no tiene total y
  conserva su propio pie.
- **`Meter` - una lectura como parte de una pista**: 4px de alto (`thick`: 8px), `--radius-xs`, sobre
  `--border`. El relleno toma el token de la banda en que cae la lectura, o `--fg-2` para una proporción
  sin salud que expresar, y no se anima. Con un `label` es un `meter` para la tecnología de asistencia; junto a la misma cifra en texto
  se oculta para que la cifra no se lea dos veces.
- **`Count` - cuántas filas representa una etiqueta**: `--meta`, numerales tabulares, `--text-sm`, o
  `--text-xs` (`small`) dentro de un segmento de filtro o un chip.

`pnpm check:feedback` rechaza el componente antd que cada uno de estos sustituye: `Empty`, `Tag`,
`Descriptions` y `Progress` en todas partes, `Drawer` fuera de `AppDrawer` y las dos hojas anteriores,
`Popconfirm` fuera de `ConfirmAction`, `Card` fuera de `Panel` y `Pagination` fuera de `Pager`.

### Switch

Todo control de encendido/apagado es `web/src/components/common/Switch.tsx`; el `Switch` de antd no se usa, y
`pnpm check:feedback` rechaza su importación (`raw-switch`). El control es la píldora propia de la consola:

```text
size      track     knob     use
default   36×20     16px     a settings row, a drawer field
small     30×17     13px     a list row, a table cell, a toolbar
touch     44×24     20px     both sizes under `(pointer: coarse)`
```

- **Una píldora con una perilla concéntrica.** La perilla es un círculo 2px dentro de la pista, de modo que los dos contornos
  permanecen concéntricos en todo tamaño; el recorrido y ambas marcas de estado se derivan de tres números.
- **La perilla es un disco elevado.** Es la tinta más clara de la página - `--bg` en una paleta clara, `--fg` en una
  oscura - con `--shadow-raised`, de modo que se lee como el mismo objeto en ambas.
- **Apagado es un velo pálido; encendido es un relleno.** Apagado es `--fg` atenuado al 16% (24% con hover); encendido rellena la pista
  con `--success`.
- **El estado está escrito en la pista.** El tramo que la perilla no cubre lleva una barra en
  `--accent-on` al estar encendido y un anillo `--fg-2` al estar apagado. Lado, relleno y marca coinciden, de modo que la lectura nunca
  depende del color: una pista pálida junto a una perilla clara no alcanza por sí sola el umbral de contraste de un control.
- **Deshabilitado** es 45% de opacidad. **Pendiente** (`loading`) mantiene el estado, rechaza la entrada, informa
  `aria-busy`, vacía la perilla y quita las marcas, a plena intensidad para que una escritura en curso no
  se lea como no disponible; es una marca estática, no un spinner.
- **Movimiento**: la perilla se desliza con `transform` en `base` sobre la curva de desaceleración y se inclina 2px hacia
  su siguiente lado mientras se pulsa; los colores de la pista y de las marcas cambian en `fast`.
- El elemento es un `<button role="switch">` nativo, de modo que un `<label>` envolvente, `htmlFor`, Espacio/Enter,
  el anillo de foco compartido y `Form.Item valuePropName="checked"` no necesitan cableado. Es controlado:
  `checked` y `onChange(checked)`. Un switch sin etiqueta visible propia lleva `aria-label`.

### Control de rango de tiempo

Un botón nombra la ventana (`Last 1 hour`, o `08-11 – open-ended`); el resto vive en una
superficie que él abre. El panel y la lista de solicitudes comparten el control
(`web/src/components/common/timeRange/`) y difieren solo en aquello a lo que se resuelve un rango personalizado.

**La superficie se abre solo con los preajustes, y el rango personalizado está un nivel más abajo.** Una lista corta
de ventanas relativas es lo que el lector quiere casi siempre; un calendario que no pidió
es una pantalla de atención gastada en nada. La última fila de la lista, separada por una
regla y con un signo de despliegue, abre el rango personalizado junto a la lista; al pulsarla de nuevo
se pliega. Se abre allí directamente solo cuando la ventana confirmada ya es personalizada,
porque un lector que reabre esa ventana vino a ajustarla.

Un preajuste es una respuesta completa y se aplica al pulsar. Un rango personalizado son dos pulsaciones sobre
el calendario y, en la lista de solicitudes, dos horas - por eso se prepara y se confirma con
**Apply**. Confirmar cada pulsación consultaría una ventana a medio elegir y movería los datos bajo
el puntero.

**El calendario se dibuja en línea, con los tokens propios de la consola.** Forma parte del panel del selector en lugar de ser una segunda capa flotante: un calendario que
flota junto al panel que lo pidió se lee como dos controles y no puede convertirse en una hoja. Los días se asientan en una cuadrícula de siete columnas sin hueco entre columnas, de modo que un rango es una banda
ininterrumpida por semana: la banda es una mezcla del 16% de `--accent`, los dos días elegidos se rellenan
con `--accent` y texto `--accent-on`, hoy lleva un anillo `--border` de 1px y el acento como color
de texto, y los días posteriores a hoy están deshabilitados, porque toda ventana termina en el instante actual o antes.
La cuadrícula siempre mide seis semanas de alto, de modo que cambiar de mes nunca mueve los controles que tiene debajo.
En escritorio se muestran dos meses, donde un rango que cruza el límite de un mes es el caso
personalizado más común, y uno en la hoja. Mientras falta elegir el final, el día bajo el puntero
previsualiza la banda, y el campo que fijará la siguiente pulsación lleva el borde de acento.

**Dos pulsaciones hacen un rango; una tercera empieza uno nuevo.** Una pulsación anterior al inicio intercambia
los extremos, de modo que el orden nunca importa, y una sola pulsación seguida de Apply es ese único día.
**Until now** deja el final abierto: el calendario entonces solo mueve el inicio.

| Página | Granularidad | Un final elegido significa |
| --- | --- | --- |
| Panel | Día | *Hasta* ese día inclusive, de modo que `08-09 → 08-21` incluye el 21 |
| Lista de solicitudes | Minuto (`HH:mm`, 24 horas, escrito) | Hasta ese minuto, y nunca más allá de ahora |

La hora es un campo escrito en lugar del control de hora propio del navegador, que sigue la
configuración regional del navegador hacia un reloj de 12 horas mientras que toda otra hora de la consola es de 24 horas. El
panel nombra el desfase de la zona de la consola junto a Apply, porque las fechas son fechas civiles en esa
zona y no en la del navegador.

**Por debajo del punto de corte de 900px la superficie es una hoja inferior.** Un popover anclado a un botón de barra de herramientas
no tiene ni el ancho para un calendario ni el alcance de un pulgar. La hoja muestra un nivel a
la vez - los preajustes, o el rango personalizado bajo una fila que lleva de vuelta a ellos -, dibuja los días
a 40px y las filas de preajustes a 44px, pone Cancel y Apply a todo el ancho en el borde inferior,
y es una superposición de clase Drawer: el Back de la plataforma la descarta (§8).

Tres tipos de ventana, y solo los dos primeros se mueven:

| Elegido | Comportamiento |
| --- | --- |
| Preajuste (Last N) | Deslizante: se resuelve de nuevo contra `now` en cada sondeo, de modo que sigue apareciendo el cubo más reciente. |
| Personalizado, **Until now** | Creciente (abierto): inicio fijo, el final sigue a `now`. Se sondea como un preajuste. |
| Personalizado, rango cerrado | Congelado: se muestra exactamente como se eligió, nunca se sondea. |

La elección se guarda en el servidor, no en el navegador: una recarga, un reinicio del
servicio y una reconstrucción del contenedor deben devolver la ventana que el operador estaba
mirando. Un selector de fechas que no está en uso nunca ocupa la barra de herramientas.

El disparador es un campo, no un botón: toma el fondo, el hundimiento, el chevrón y la
altura de un select relleno, y en la barra de herramientas de solicitudes comparte un mismo tamaño con los campos de modelo y proveedor
que tiene al lado. El preajuste seleccionado se marca como el carril lateral marca su página: un velo
suave y el peso del texto. Un rango personalizado cerrado vuelve el relleno y el texto del disparador
del color de acento: es un hecho fijo, y no debe confundirse con una ventana que todavía se mueve. El sondeo se
ajusta a la resolución que se sirve — `bucket / 12`, acotado a 5s–120s — porque refrescar más rápido de lo que puede
cambiar la cuadrícula cuesta consultas y no aporta nada. No hay interruptor «en vivo»: el
preajuste más corto **es** en vivo. Son quince minutos a un cubo por minuto, de modo que
la regla de ritmo cae por sí sola en su suelo de cinco segundos; cinco minutos era demasiado
estrecho para leerse como tendencia y una hora demasiado grueso para sentirse en movimiento.

### Espacios de trabajo de conversación

**El hilo usa una escala de formas y rellenos contenida** (ADR 0081, refinada por ADR 0086). Una conversación se lee como un documento
con unos pocos objetos apoyados en él, de modo que un elemento se redondea según lo que es, y se agrupa con un relleno
donde la consola dibujaría una caja. Los radios se sitúan en la escala de esquinas de la consola (§4): los controles toman
el paso de control, el material impreso y las superficies flotantes los pasos superiores, y el compositor, las burbujas
y las tarjetas el paso de tarjeta:

| Token | Valor | Quién lo toma |
| --- | --- | --- |
| `--radius-document` | 8px | material impreso: una figura, una tabla, un marco de código, un chip de argumento monoespaciado |
| `--radius-control` | 6px | lo que se pulsa dentro del hilo: una fila de llamada, un disparador de selector, un chip, los botones de una tarjeta |
| `--radius-surface` | 10px | un panel de campos o una lista flotante: la lista de cambios de una tarjeta, una nota de fallo, un popover |
| `--radius-thread` | 12px | el compositor, la burbuja del operador, el panel de preguntas, una tarjeta de aprobación, una sugerencia |
| `--thread-field` / `--thread-field-hover` | `--fg` al 5% / 8% | un relleno de agrupación sin borde, y su hover |
| `--thread-hairline` | `--fg` al 12% | el único borde que puede tener un objeto apoyado en la página |

Sus valores predeterminados previos a la hidratación se declaran en `web/src/index.css`; `THREAD_RADII` y
`THREAD_FILL_SHARES` en `web/src/theme/palette.ts` poseen los radios y los porcentajes de primer plano, y `themePaletteCssVariables` en
`web/src/theme/themeConfig.ts` proyecta los tokens de relleno y de radio para cada paleta predefinida y personalizada. Se aplican dentro de los espacios de trabajo de conversación y a la tarjeta de aprobación
dondequiera que se dibuje; las exportaciones HTML de conversaciones leen las mismas constantes `THREAD_RADII`.
Las filas se separan con espaciado y un relleno al pasar el puntero, nunca con una regla entre cada una; un estado colorea su
aviso con suavidad y no añade barra de borde. El compositor es el único objeto que se sitúa sobre el hilo: el
fondo del panel, una línea fina y `--shadow-raised`, que se profundiza a `--shadow-float` mientras tiene foco,
con un borde más firme en lugar de un anillo de acento; las listas `/` y `@` flotan con `--shadow-float`. El movimiento se mantiene dentro del presupuesto de §7, con una pulsación que escala un objeto
pulsado entre un 2 y un 4% durante `--motion-fast`.

El Agent (`/agent`) es un espacio de trabajo de conversación. El marco, la transcripción, el compositor, el
desplegable de razonamiento, los bloques de código y los paneles laterales viven en `web/src/components/workspace`,
de modo que la superficie de conversación conserva un único redimensionador, un único compositor y una única manera de dibujar una respuesta.

**El marco abarca el área de contenido, y la conversación centra su propia columna.** Como el
banco de trabajo de configuración, la regla de la cabecera y el borde del panel están anclados al viewport; limitar
el marco a la columna de la página dejaría el panel flotando a media pantalla en un display ancho. Dentro de la columna
principal, la transcripción, los avisos y el compositor comparten un único ancho de lectura
(`--workspace-column`, 760px): suficientemente largo para un bloque de código, suficientemente corto para leer prosa sin
perder la línea. La caja de desplazamiento en sí conserva todo el ancho, de modo que su barra de desplazamiento queda en el borde del panel.

**Con qué se envía un mensaje se elige en el compositor.** La clave y el modelo son una sola
decisión - la lista de modelos es lo que el gateway sirve a esa clave -, así que son un solo chip: nombra
el modelo, y su lista termina con la clave de cliente. Una clave se nombra por su alias, y por su
máscara solo cuando no tiene (§7, «Nombrar es una acción de primera clase»); la vista de claves muestra ambos, que
es donde se distinguen dos nombres parecidos. Un modelo va encabezado por la marca de su fabricante, en el chip, en la
lista y bajo el wordmark del estado vacío, y por una caja neutra cuando no se reconoce al fabricante;
el nombre sigue siendo el punto de llamada. Ambas filas de pie comienzan con un tercer chip, el
endpoint de inferencia (ADR 0088): el chip lleva una marca neutra de enchufe y el nombre corto (Chat,
Responses, Messages), y su lista el nombre completo del endpoint con su ruta en monoespaciado. Los chips se sitúan
en el compositor a cualquier ancho, de modo que a qué modelo y endpoint llegará un mensaje nunca queda oculto
en un menú o en una fila de cabecera; en el pie de un teléfono, el nombre del modelo es el que se acorta. Los tres
chips expresan sus valores con una misma tinta y peso (`--fg`, regular), y un chip que no puede
cambiarse - durante una ejecución, o mientras un turno del Agent espera una decisión - pasa su valor, marca
y signo de despliegue a `--meta` a la vez, con la marca del fabricante a media opacidad.

**El nombre de una acción es un tooltip solo para un puntero que puede reposar.** Las acciones de icono de los
espacios de trabajo de conversación se nombran mediante `LabelTip`, que no dibuja nada donde el puntero
primario no puede hacer hover: en una pantalla táctil el navegador mantiene un hover en el último lugar tocado, de modo que una
etiqueta se abría sobre lo que el layout hubiera movido allí - Send, cuando un ejemplo tocado levantó
el teclado. Un tooltip que dice más que el nombre del control (el significado de una medición) sigue siendo un
Tooltip ordinario, ya que un toque es la manera en que un lector táctil lo pide.

**El panel es redimensionable y en un teléfono es un Drawer.** El separador es un divisor de ventana ARIA
operable con teclado (las flechas lo mueven, Inicio y Fin saltan a sus límites, un doble clic restaura el
valor predeterminado), y un arrastre escribe el ancho directamente en el panel y lo confirma una vez al soltar, de modo que
arrastrar no vuelve a renderizar la transcripción. El panel nunca ocupa más de la mitad del viewport.
Por debajo de 900px pasa a ser un Drawer unido al gesto Back de la plataforma mediante `useOverlayHistory`. No se
añade ningún punto de corte.

**La transcripción sigue al mensaje más nuevo.** El viewport del hilo (el de assistant-ui) mantiene a la vista una respuesta
en crecimiento mientras el lector está al final, y un lector que se desplaza hacia arriba conserva su lugar
mientras llega contenido por debajo. Alejarse del final muestra un control «volver a lo último», que se desplaza
suavemente salvo que el lector haya pedido movimiento reducido. Al iniciarse una ejecución y al abrirse una conversación,
el lector vuelve al mensaje más nuevo.

**Anatomía de un mensaje.** El mensaje del operador es un bloque relleno `--surface` con un borde de 1px,
alineado al final de la columna. Una respuesta no tiene borde y usa toda la columna: una cabecera que nombra
el modelo y un indicador de estado, el razonamiento como un desplegable sin marco (abierto
mientras el razonamiento se emite y siguiendo su salida más nueva hasta que el lector se aleja, plegado cuando el razonamiento termina y cerrado para una respuesta que ya terminó, y después el del propio lector;
su signo de despliegue gira con el token de movimiento `fast`). El desplegable del Agent dice «Thinking…» mientras el
razonamiento se escribe y «Thought process» una vez que se asienta, de modo que la línea de actividad separada nombra
una fase solo cuando nada en la respuesta lo hace; una etiqueta de fase en vivo lleva el resaltado de trabajo en curso del ADR 0080. La
respuesta en Markdown y un pie completan el mensaje. El pie expresa mediciones - primer contenido, duración,
tokens, TPS - dejando fuera las observaciones ausentes en lugar de mostrarlas como cero, y lleva sus acciones
como botones de icono atenuados con nombres accesibles. Copiar se confirma a sí mismo convirtiendo su glifo en una
marca de verificación; solo una copia fallida muestra un toast.

**La salida del modelo se dibuja con la tipografía de la consola, no con la de la biblioteca.** Los estilos
de elementos propios de `@ant-design/x-markdown` están desactivados. Las tablas se asientan en un marco con borde, con una fila de cabecera `--surface` y
filas con líneas finas, y una columna que el autor alineó a la derecha conserva esa alineación en su cabecera. Un bloque
delimitado tiene una cabecera que nombra su lenguaje con una acción de copia, y se resalta solo para un
conjunto de lenguajes permitidos y solo una vez cerrada su valla: una valla desconocida o aún en emisión es texto
monoespaciado plano. El tema de sintaxis es la tinta de la paleta - claves y palabras clave `--accent`, texto `--fg`,
literales `--fg-2`, puntuación `--muted`, comentarios `--meta` - y deliberadamente no toma prestados los
tonos semánticos, porque una cadena no es un éxito. El HTML sin procesar se escapa, los enlaces se abren fuera de la
consola, y una imagen se renderiza como enlace en lugar de descargarse.

**El compositor es una sola puerta.** Enter y el botón de enviar llegan al mismo envío, decidido según el estado en vivo
del runtime, y el botón de enviar se lee como bloqueado (relleno `--border`, glifo `--meta`,
`aria-disabled`) siempre que enviar no es posible, con el motivo en su tooltip cuando la página
tiene uno que dar. Enviar y detener ocupan una misma ranura de acción y son una misma forma: un círculo de 32px relleno de
`--accent-hover`, con su glifo en `--accent-on` - una flecha hacia arriba para enviar, un cuadrado redondeado de 10px para detener;
el hover profundiza el relleno a `--accent-active`. Es la única forma rellena del marco y el
único botón redondo de la consola, y toma el mismo relleno que toda otra acción primaria, de modo que la
paleta elegida lo colorea. Mientras un turno se ejecuta con un borrador vacío muestra detener;
en el Agent, escribir un borrador sustituye detener por «Queue», y encolar borra el borrador y
restablece detener. Los mensajes en cola esperan en una bandeja apoyada en el marco - la línea fina del marco, abierta
donde se une con la caja, sobre `--thread-field` - bajo una línea `--muted` que los cuenta y dice
que salen cuando termina la respuesta actual; cada uno es una fila con una flecha hacia arriba en `--meta`, su
texto en una sola línea con puntos suspensivos y un control de quitar, y llega con la subida de 4px. El modelo y el
esfuerzo de razonamiento siguen siendo elegibles durante una ejecución, porque pertenecen al mensaje siguiente; solo un
turno que espera una decisión los fija, y un chip fijado toma la tinta de deshabilitado. Bajo el compositor una línea expresa el límite
que el operador está a punto de cruzar: la del Agent nombra
lo que debe permitirse antes de que un mensaje pueda salir.

**`/` ejecuta comandos y `@` completa nombres.** En el Agent, `/` abre los comandos de la página, y
cada fila hace algo: `/ui` y `/text` establecen cómo se presenta la siguiente respuesta,
y el resto son las acciones propias de la página - detener, reintentar, editar, nueva conversación, exportar como HTML o
imagen, abrir el directorio de capacidades o la guía de conexión. Un comando se lista solo mientras
puede ejecutarse, de modo que una conversación vacía no ofrece reintentar y una inactiva no ofrece detener, y ninguna fila es una pregunta
enlatada. `@` completa un nombre que el operador copiaría de otra página - un modelo, un alias de clave
de cliente, una capacidad. La lista se abre hacia arriba desde el borde superior del marco sobre `--elevated` con un
borde de línea fina y sin sombra, una fila por entrada: un icono `--muted` de 16px para un comando, el nombre en
monoespaciado, lo que es en `--muted`, la fila resaltada sobre `--border-soft`. Las flechas mueven, Enter elige, Escape cierra; mientras una fila está
resaltada, Enter pertenece a la lista y no puede enviar. En un teléfono o con un puntero grueso una fila mide 44px
de alto, y la lista nunca es más alta que el espacio que el panel tiene sobre la caja, de modo que bajo un teclado de software
se desplaza dentro de sí misma en lugar de pasar el borde superior del panel. Una mención aterriza como el nombre desnudo. Flecha arriba en una
caja vacía recupera los mensajes ya enviados, el más nuevo primero. Ninguno tiene botón: el placeholder
nombra ambas teclas.

**El marco contiene aquello de lo que se compone un mensaje y con lo que se envía, y nada que solo informe.** El
pie del Agent tiene cinco controles: un `+` redondo de 28px que adjunta y el chip del endpoint al inicio,
y el chip de esfuerzo, el chip de modelo y la ranura de envío al final. Las lecturas van bajo el marco, en la línea de la nota. Lo que el siguiente
mensaje lleva además de su texto se sitúa sobre el campo de entrada como chips de línea fina de 24px sobre `--bg`, cada uno con
su propio quitar: una edición del mensaje más reciente en `--fg-2`, una presentación (`/ui`, `/text`) en
`--accent` con borde de acento. El chip se va cuando se envía el mensaje, y el mensaje enviado
muestra la presentación como un chip de línea fina `--accent` de 26px sobre su burbuja.

**Los bordes del compositor coinciden con los de las respuestas.** La transcripción reserva un canal para la barra de desplazamiento
(`--workspace-gutter`, 8px, cero en táctil), que desplaza su columna centrada la mitad de ese valor; el
compositor se desplaza la misma mitad, de modo que ambos comparten sus bordes izquierdo y derecho.

**Cuán lleno está el contexto, como un anillo y su cifra.** Bajo el compositor del Agent, al final de la línea de la nota, un anillo de 14px
- una pista `--border` de 2px con la parte usada dibujada encima desde las doce en punto - y un porcentaje en
mono pequeño expresan la parte de la ventana de contexto del modelo que ocupaba la conversación cuando terminó el último
turno. Ambos reposan en `--meta` y pasan a `--warn` al 75% y a `--danger` al 90%; la cifra permanece
porque un arco tan pequeño no puede mostrar de qué lado de un umbral está. El tooltip da ambos
recuentos de tokens y dice que la ventana es información de referencia. Está ausente cuando el gateway no informó un recuento de
entrada o el catálogo de referencia no lista ventana para el modelo: una suposición se leería como una medición.

**El compositor empieza con una línea.** Crece hasta diez líneas en escritorio. En el punto de corte de teléfono de
640px la caja crece hasta cinco líneas, el envío se sitúa junto al
campo de entrada en lugar de en una fila de pie, y la fila de pie aparece solo para un control que la necesita (los chips de
endpoint, esfuerzo y modelo); el marco y la nota
se ajustan con ello. En un teléfono la conversación ya comparte su altura con el teclado, y el
layout de escritorio le dejaba una franja entre dos barras. En escritorio la acción permanece en la fila de pie. El texto del mensaje del usuario no tiene márgenes de párrafo
dentro de su burbuja con relleno, de modo que una línea no adquiere una segunda capa de espaciado vertical.

**La transcripción se desplaza solo verticalmente.** Los bloques de código y las tablas se desplazan lateralmente dentro de sus propios
marcos - una tabla nunca parte una palabra para caber, de modo que una cifra permanece entera en un teléfono - y
todo otro elemento queda acotado por la columna (el resumen de un paso de capacidad es una
línea con puntos suspensivos, nunca el ancho de su texto), y la columna queda acotada por la caja de desplazamiento, de modo que un
deslizamiento lateral en una pantalla táctil nunca arrastra la conversación. Una respuesta siempre usa toda la
columna.

**La emisión se publica a un ritmo.** El bucle de ejecución agrupa los deltas en intervalos de 40ms y todo turno
asentado conserva su identidad de objeto, de modo que la transcripción memoizada vuelve a renderizar la respuesta que crece
y omite todas las que tiene por encima.

#### Agent

El panel lateral junto a la conversación contiene el directorio de capacidades o la guía de conexión; los detalles de una llamada se abren en la conversación, bajo la llamada (ADR 0084). El directorio es el registro mismo - la misma lista que se ofrece al modelo -
agrupado en lectura / escritura / destructivo en ese orden fijo, cada grupo marcado con un indicador (`--meta`,
`--warn`, `--danger`). Es una lista abierta, una fila de línea fina por capacidad con su descripción
limitada a dos líneas y expandida al seleccionarla, porque una tarjeta por entrada hacía los bordes más ruidosos
que los nombres. Una fila se lee en el idioma de la consola: un título localizado en `--fg`, el identificador
de la capacidad a su lado en mono pequeño `--meta`, y una descripción localizada; el filtro coincide con ambos.
Una fila expandida añade la descripción propia del registro bajo una regla de línea fina, rotulada como lo que se
le dice al modelo, porque ese es el texto con el que el modelo decide. Una capacidad para la que la consola no tiene
texto propio se lee como su identificador y la descripción del registro.

**Un turno se dibuja en el orden en que ocurrió.** Un modelo puede razonar, decir algo, llamar a
capacidades, razonar de nuevo y responder, de modo que un turno es una secuencia de segmentos - razonamiento, texto de respuesta,
llamadas a capacidades - en lugar de ranuras fijas para cada tipo. El servidor registra la secuencia como las
partes del turno, y el navegador reconstruye las mismas partes a partir de la emisión, de modo que el turno en vivo y el
almacenado son idénticos. Los desplegables de razonamiento apuntan a la derecha al plegarse y hacia abajo al expandirse.
Cada tramo de razonamiento es su propio desplegable donde ocurrió;
el razonamiento y las llamadas a capacidades consecutivos forman una línea de tiempo (ADR 0084): una línea de resumen en `--muted` -
un icono de pasos, «Used N capabilities», los fallos contados en `--danger`, y un signo de despliegue que gira - con
los pasos debajo sobre un riel de `--thread-hairline` de 1px que atraviesa la marca de 14px de cada paso. La
línea de tiempo está abierta mientras es el final de una respuesta en ejecución o una llamada en ella espera al operador, y
se pliega a su resumen una vez que la respuesta ha pasado de largo; plegada a mitad de ejecución, el resumen dice
«Working…» con el resaltado de trabajo en curso. El propio conmutador del lector prevalece en ambos casos. Un turno reanudado tras una aprobación crece en su lugar bajo sus segmentos anteriores
en lugar de aparecer como una segunda respuesta, y copiar la respuesta toma todos los segmentos de texto, sin
el razonamiento.

**Una llamada a una capacidad es un desplegable.** Su fila es una marca en el tono del estado (una marca de verificación `--success`, una
cruz `--danger`, un punto `--meta` de 5px en reposo; un spinner en `--accent` mientras se ejecuta, un glifo de atención `--warn`
cuando la llamada espera al operador o su resultado es parcial, expiró o no está
confirmado), el título localizado en `--fg-2` - con el resaltado de trabajo en curso del ADR 0080
mientras la llamada se ejecuta -, los argumentos en resumen como un chip mono con puntos suspensivos sobre `--thread-field`, el
estado en palabras solo cuando no es un éxito simple, la duración en cifras tabulares y un signo de despliegue.
La fila aparece en el momento en que se anuncia la llamada, antes de tener un resultado. Al abrirla se despliega, bajo
la fila y alineado con su texto, un panel `--thread-field`: el identificador en mono, el estado y
la hora de inicio, luego los argumentos completos y el recibo que se dio al modelo como bloques de código limitados
a 280px. Tanto la línea de tiempo como este panel se abren mediante una fila de cuadrícula que crece dentro de `base`. Una llamada fallida
expone su código y detalle bajo la fila esté o no abierta.

Una consulta a base de datos es el mismo desplegable sin bloque de recibo: su estado, sus argumentos SQL y su
duración son inspeccionables, sus filas permanecen en el servidor, y los datos seleccionados para una presentación explícita
pertenecen a la figura de la respuesta final.

**Las llamadas de presentación forman parte de la respuesta.** Una llamada `render_ui`, o una presentación heredada almacenada, se dibuja fuera
de la cadena en su propio lugar entre las partes de la respuesta, donde la respuesta se lee. Las llamadas nuevas usan por defecto
`frame: none`: un componente sobre el fondo de la conversación, sin marco ni barra de título, que conserva un
título accesible y controles discretos. Un `frame: card` explícito dibuja un marco de línea fina `--border` bajo
un título en `--fg` 600; las presentaciones almacenadas conservan su marco original (ADR 0082, 0087). Un panel almacenado (`render_view`, ADR 0079) contiene bloques, cada uno dibujado solo
con tokens: `stats` como mosaicos en una cuadrícula de línea fina `--border-soft` (etiqueta `--muted` de 12px con un
icono opcional de 13px, valor de 20px 600 tabular, cambio tonalizado por `--success` / `--warn` / `--danger`);
`fields` como filas etiqueta/valor sobre reglas `--border-soft`; `callout` como una regla izquierda tonalizada de 2px sobre un tinte del 7-8%
del mismo tono; `steps` como marcas de 9px sobre un riel `--border` (relleno `--success` hecho, con anillo
`--accent` activo, hueco pendiente, relleno `--danger` fallido); `meters` como una barra `--series-track` de 4px
rellena con `--accent` o el tono; `links` como botones de línea fina de 28px que toman `--accent` al
pasar el puntero. Los iconos son contornos Lucide de trazo 1,5px en `currentColor`; un nombre sin resolver es un pequeño
círculo neutro de la misma caja. Una UI generada (`render_ui`, con las vistas `render_canvas` almacenadas que se mantienen legibles, ADR 0072) es el marco de figura alrededor de un
marco aislado sin borde sobre `--surface`, con cuatro acciones de icono discretas: ver código fuente (el mismo
botón, como un ojo, devuelve a la UI renderizada), guardar como imagen, descargar HTML, pantalla completa. Su
marcado se compone con los propios componentes del marco - pilas, cuadrículas ajustables, tarjetas, estadísticas, insignias
tonalizadas y avisos, listas clave-valor, campos, pestañas y un diagrama de nodos y flechas seleccionable - con estilos
de los tokens de la consola y todo fluido (ADR 0085). Mientras el modelo todavía lo escribe, el
componente de borrador dibuja el marcado hasta ese momento sin ejecutar scripts del modelo. Los borradores de tarjeta muestran un
marco discontinuo, un título y una marca «Drawing…»; los borradores en línea conservan el título accesible y el estado
sin el marco visible de tarjeta, y el lienzo terminado ocupa su lugar a la altura
que había alcanzado el borrador. Su
altura sigue a su contenido entre 48px y 16384px, medida para incluir el contenido desbordado
sin usar el viewport como mínimo, de modo que puede tanto crecer como encogerse tras interacciones locales.
El contenido normal se desplaza con la transcripción, y el documento del marco nunca dibuja una barra de desplazamiento
propia: una barra que aparecía mientras el marco se ponía al día quitaba ancho al lienzo y lo volvía a dibujar.
El contenido por encima del tope, y la vista de pantalla completa, siguen desplazándose con rueda, tacto y teclas. Las superficies de componentes y los nodos de diagrama usan `--radius-surface` (10px);
los controles usan `--radius-control` (6px), también en las vistas previas emitidas y las exportaciones HTML. Los gráficos y tablas que contiene los dibuja el kit de la consola (ADR 0073) a partir de las variables
de tema que se le dan al marco, de modo que siguen la paleta en ambos esquemas: marcas en la paleta
de series, reglas de cuadrícula `--border`, texto de marcas y leyenda `--muted` con el formato que la consola
da a tokens, dinero, duraciones y proporciones; una tabla con cabeceras `--muted` de 12px que ordenan al hacer clic,
reglas de fila `--border-soft` y cifras tabulares alineadas a la derecha. La pantalla completa fija la misma figura sobre
el viewport en `--surface` sin borde, con el marco llenando lo que deja la barra de título; Escape,
el mismo botón o el gesto Back de la plataforma la devuelve, y una caja de línea fina discontinua mantiene su
lugar en la respuesta entretanto. La imagen guardada es el propio documento del marco a 2x. Mientras llegan los
argumentos de una llamada de presentación es una figura borrador en esa posición; una llamada rechazada sigue siendo una fila de llamada ordinaria.

El pie de una respuesta terminada expresa su estado, duración y hora de inicio, sus rondas y llamadas, y los
tokens que informó el gateway, y lleva copiar y «export this answer» (HTML) como acciones de icono
atenuadas. El pie de la respuesta más reciente las antecede con reintentar y editar cuando su turno no cambió nada;
editar devuelve las palabras del mensaje al compositor bajo un chip «editing» con descarte.
Un archivo de texto adjunto a un mensaje (ADR 0074) es un chip de línea fina de 28px con nombre y quitar en el
compositor, y un chip de 26px con clip, nombre y tamaño `--meta` sobre la burbuja enviada. El menú Export de la cabecera guarda toda la conversación como una página HTML, una imagen PNG o JSON.

**Una conversación exportada es el espacio de trabajo, no un informe sobre él.** La página HTML y el PNG se
dibujan a partir de la paleta resuelta y la tipografía mono incrustada (`web/src/agent/conversationStyles.ts`), de modo que
una exportación en la paleta propia de un operador queda en esa paleta. La página conserva la anatomía del espacio de trabajo -
la columna de lectura de 760px, la burbuja del operador alineada a la derecha sobre el campo del hilo con el radio de hilo de 8px, el indicador de estado de 7px, cabeceras y pies discretos
de 12px - bajo una cabecera de wordmark, línea fina y título, y un titular de una línea (modelo,
turnos, tokens, hora de exportación). El razonamiento y la cadena de capacidades son desplegables con un
chevrón giratorio, la cadena sangrada y el razonamiento compuesto en la página en `--fg-2`; un bloque de código es un marco `--surface` cuya cabecera nombra el lenguaje;
una vista de presentación es una figura `--surface`: un panel bloque a bloque, un lienzo como el marco aislado que
es en el espacio de trabajo. Un fallo es una nota sobre un relleno `--danger` al 8% con 10px. El PNG es
el mismo documento como una tarjeta de 840px a 2x con márgenes de 40px: los controles, signos de despliegue y el razonamiento se omiten
y la cadena de capacidades se muestra abierta, porque una imagen no tiene nada que pulsar.

**Una operación preparada se decide donde se planteó** (ADR 0043): una tarjeta bajo la llamada, sobre
`--surface` con un borde `--thread-hairline` al radio de hilo (el borde toma `--danger` al
45% para una capacidad destructiva). Nombra el permiso de la capacidad como una etiqueta, comienza con una frase sobre
lo que hacen Allow y Deny y la descripción localizada, luego el destino en mono y un
cambio con forma de formulario como filas etiqueta/valor en un panel de campos (todo lo más profundo queda en JSON), y termina con una decisión, Deny o Allow;
decidir continúa la ejecución (ADR 0035). Una capacidad destructiva dibuja Allow en el tono de peligro y
añade una línea «cannot be undone»; no se escribe nada para confirmar. En el punto de corte de teléfono de 640px la tarjeta
ajusta su relleno y Deny y Allow comparten la fila como objetivos iguales de 40px de alto, como en la
pantalla de autorización. La entrada privada y el traspaso de OAuth
aparecen en la tarjeta cuando la capacidad los necesita. Mientras hay una decisión abierta, el compositor se niega a
enviar y lo dice en una línea `--warn` dentro de su marco, con un enlace «Show» que lleva la tarjeta a
la vista y le da foco.

**Se puede preguntar sobre el texto seleccionado.** Seleccionar parte de una respuesta muestra una pequeña barra de herramientas sobre
`--elevated` con «Ask about this» - el portal se estiliza a partir de los tokens de tema, porque se renderiza fuera del ámbito de variables de Ant Design; la cita se sitúa entonces dentro del marco del compositor sobre el campo de entrada,
en `--muted` con un control de quitar, y se envía como una cita Markdown antes de la pregunta.

Una pregunta que formula el agente (`ask_question`) ocupa el lugar del compositor en lugar de abrir un diálogo,
porque la respuesta que tiene encima suele ser lo que el operador lee para contestar. Sigue la forma en que
convergieron los agentes de programación (AskUserQuestion de Claude Code, request_user_input de Codex, la herramienta
question de OpenCode). El panel conserva el marco del compositor con el tono de acento. Varias preguntas
son una pestaña cada una más una pestaña Review, y una pestaña lleva una marca de verificación `--success` una vez respondida su pregunta,
de modo que la fila es también el progreso; una sola pregunta no tiene pestañas y muestra su chip corto
junto al texto. Cada opción es una fila de ancho completo con su número como tecla, la etiqueta, y
su consecuencia en texto atenuado debajo; la fila elegida toma el borde de acento, un tinte ligero de acento y
una tecla rellena. «Something else…» es siempre la última fila y abre su campo de respuesta dentro de la
fila cuando se elige; en una pregunta de elección única sustituye a las opciones en lugar de añadirse a una. Un
dígito elige una fila y Enter avanza (la pista y la pista de atajo de las teclas se ocultan sin
teclado); una elección única avanza por sí misma, varias elecciones esperan a Next. La pestaña Review lista
cada pregunta con su respuesta, cada una un enlace de vuelta a su pestaña, y Submit las envía; Skip
las rechaza todas. Solo se desplaza la pregunta, de modo que las acciones permanecen a la vista. El paso de la cadena y el
pie del turno para una pregunta pendiente dicen «Awaiting your answer».

Enviar no necesita una autorización aparte. La línea bajo el compositor expresa que un mensaje, y los datos de Shell-PAMC
que el agente lee para responderlo, van al modelo CPA seleccionado y a su upstream (ADR 0027); enviar
es el acto que esa línea describe. El modelo y el esfuerzo de razonamiento usan el mismo chip discreto de 28px,
un popover de línea fina sin sombra sobre `--surface`, y filas de opción con nombre (ADR 0077). Una superficie se abre
sobre su disparador, o debajo cuando el espacio de arriba es inferior a 280px y el de abajo es mayor, y
se limita al espacio de ese lado menos un margen de 12px, de modo que su lista se desplaza en lugar de salirse de la
ventana. Una relectura conserva la lista que está releyendo, y hasta que se ha leído el destino recordado
el chip de modelo mantiene un marcador de 104px en lugar de nombrar una elección. La superficie de modelos
mide 304px de ancho, acotada al viewport; su lista encabeza cada punto de llamada con la marca de su fabricante,
añade búsqueda a partir de ocho nombres, y ofrece la clave de cliente como acción secundaria de pie que
abre una lista de claves en la misma superficie. La superficie de razonamiento mide 180px de ancho, con el valor predeterminado del modelo
primero seguido de los nombres de parámetro con descripciones secundarias localizadas. Su disparador de texto muestra el
nombre del parámetro actual (`Low`, `High`, `Max`, `xHigh`) en `--fg` con peso regular 400.
Estas grafías de visualización son coherentes entre idiomas; los valores de solicitud conservan su capitalización original.
La fila actual usa `--selected-inset`,
`--fg` y peso 600. Las filas de modelo usan además una marca de verificación del color de la tinta. Las filas de razonamiento emparejan el
nombre del parámetro principal a la izquierda con su descripción localizada en `--muted` en el borde
final. Las descripciones idénticas se omiten. Las filas de escritorio miden 36px; las de teléfono y puntero grueso
miden 44px. Una sola parada de tabulador itinerante sigue la elección seleccionada; las flechas, Inicio y Fin navegan
sin cambiar la solicitud. Enter, Espacio o clic confirman y cierran; Escape cierra
sin cambiar el valor. Ambos devuelven el foco al chip. Se reutilizan los tokens de tema existentes.
La primera carga de una conversación almacenada es un marcador con forma de hilo al ancho de la columna. Una llamada
de presentación se dibuja donde el modelo la hizo, entre el texto anterior y posterior (ADR 0082); una que el
modelo todavía está escribiendo es una figura borrador en ese lugar - el marco de la figura
con borde discontinuo, su título una vez que los argumentos lo contienen, y un escenario `--thread-field` que contiene el
indicador de generación (una cuadrícula de tres por tres de puntos `--fg` con un tramo iluminado que la recorre)
sobre su etiqueta - que la figura asentada sustituye en su lugar. Las figuras, borradores, filas de llamada y
preguntas de seguimiento llegan con opacidad y una subida de 4px dentro de `base`. Una vista en línea (`frame: none`, el valor predeterminado de las llamadas nuevas) no tiene borde, fondo ni
barra de título: su lienzo se sitúa sobre `--bg` y sus controles reposan al 45% de opacidad hasta recibir hover o
foco. El razonamiento se escribe directamente en la página en `--fg-2` 12,5px sin marco; mientras
llega es una ventana de 168px que se mantiene en su línea más reciente tras confirmarse el Markdown y los reflujos del viewport.
El borde superior se desvanece solo mientras se sigue y solo cuando hay historial oculto encima; el texto
corto y el retroceso manual conservan la tinta completa. Desplazarse hasta el final reanuda el seguimiento, y reabrir
un desplegable en vivo muestra la línea más reciente (320px una vez asentado y reabierto). El texto de respuesta que aún
se emite llega desde `--accent` al 20% de opacidad y alcanza la tinta durante `base`, de modo que solo las
últimas palabras están teñidas, con un cursor `--accent` de 2px
que pulsa tras su última palabra; ambos se detienen con la emisión, y el movimiento reducido los elimina (ADR 0080).
El mensaje del operador entra en la transcripción en el momento
en que se envía y el compositor se vacía; un mensaje que el servidor rechaza antes de aceptarlo vuelve a un compositor
vacío. El razonamiento del modelo se emite en el turno en vivo como el mismo desplegable de razonamiento
que usa el espacio de trabajo, abierto mientras se escribe, y permanece con el turno almacenado, separado de
la respuesta. La clave, el modelo y el esfuerzo son elección del operador y se recuerdan entre recargas;
Nueva conversación sustituye la transcripción y nada más. El fallo se expresa
como una frase con su código debajo, y una ejecución que el operador detuvo se lee como detenida y no como
fallida. Una ejecución en vivo lleva una línea de actividad: el indicador de generación a tamaño de marca y cuánto
lleva la ejecución, porque un spinner no puede distinguir trabajar de atascarse. Una fase se nombra donde se
dibuja - el desplegable de razonamiento dice «Thinking…» mientras se escribe, la fila de una llamada en ejecución
lleva su título -, de modo que la línea en sí nombra una solo cuando nada en la respuesta lo hace: esperar al
modelo, o reintentarlo. El tiempo transcurrido cuenta con el reloj del navegador; una ejecución a la que se vuelve a unir tras
abandonar la página parte de la marca del servidor llevada a ese reloj mediante la cabecera `Date` de la respuesta,
de modo que un navegador cuyo reloj va por detrás de su servidor nunca muestra un cero estancado. La línea sigue
al cuerpo del razonamiento en el flujo normal del documento con el hueco de 12px de la respuesta. Los recuentos de rondas permanecen en
las mediciones del turno asentado, no en la línea de actividad en vivo.
Las acciones de página del Agent se agrupan en la esquina final superior de la conversación: Nueva conversación
primero, rotulada y con borde de línea fina, una vez que hay una conversación que sustituir, luego una regla corta y
acciones de icono discretas para exportar, el directorio de capacidades y la guía de conexión. Un teléfono conserva
el icono y quita la etiqueta, y mientras su teclado de software está levantado el grupo y el espacio mantenido
libre para él pasan a la conversación: toda acción es también un comando `/`, y el grupo vuelve
cuando el teclado se va. La cabecera del Agent lleva un botón rotulado, Nueva conversación,
y acciones de icono discretas para exportar y el panel lateral, cuyo icono es
`--accent` mientras el panel está abierto. La conversación vacía ofrece preguntas de ejemplo como
botones alcanzables con teclado que rellenan el compositor sin enviar, y bajo ellas una línea `--meta`
de pistas `kbd` - `/` para comandos, `@` para nombres, Flecha arriba para el último mensaje - que un teléfono omite. En un teléfono
la primera pantalla recibe aire en lugar de llenarse desde arriba: el saludo empieza 13dvh más abajo
(nunca bajo las acciones de página), queda a 32px del compositor, y las preguntas de ejemplo son una
lista sin borde de filas de 48px separadas por reglas `--thread-hairline` a 24px bajo la nota del compositor, de modo que
el compositor es la única caja enmarcada de la pantalla. Bajo un teclado de software se devuelve el desplazamiento superior. La respuesta más reciente puede terminar con hasta
tres preguntas de seguimiento que ofreció el modelo, cada una una pastilla con borde `--thread-hairline` al
radio de hilo que se rellena con `--thread-field` al pasar el puntero; elegir una rellena el compositor sin
enviar, y se van con el siguiente mensaje.

### Despliegue de la fila de modelo

Añadir un modelo personalizado de proveedor crea una fila plegada: su modelo de solicitud y su alias opcional son editables de inmediato, mientras que los controles de capacidad de imagen y esfuerzo de razonamiento se abren solo mediante la acción de despliegue de la fila. Se conserva la expansión de filas existente.

La cabecera de la fila se asienta sobre la propia tarjeta en lugar de sobre una banda `--surface`, porque los dos campos de nombre son pozos rellenos y un pozo sobre su propio color no tiene borde. Su cuerpo - y todo otro desplegable del editor de proveedores, el cuerpo de una clave y el de una sección - se despliega mediante el `Fold` compartido (`components/common/Fold.tsx`): la técnica de cuadrícula 0fr/1fr durante `base`, con el contenido desvaneciéndose con ella, y un solo chevrón que gira en lugar de dos iconos intercambiados. Un cuerpo se monta la primera vez que se abre y permanece, de modo que cerrarlo lo pliega en lugar de cortarlo; el relleno y la regla del llamador se sitúan dentro de la fila recortada, de modo que una tarjeta plegada mide exactamente lo mismo que antes de abrirse. Los niveles de razonamiento son mosaicos dibujados como velos - 4% de la tinta en reposo, 7% bajo el puntero, un tinte de acento del 12% una vez elegido - de modo que ocho mosaicos no dibujan dieciséis contornos.

## 6. Cableado del tema de antd (themeConfig.ts)

Decisiones no obvias, conservarlas al editar:

Las filas de tooltip de KPI del panel, de tendencia de modelos y de dona de modelos comparten `web/src/charts/chartTooltip.ts`: columnas dimensionadas por contenido, muestras decorativas de 8px y canales de 6px mantienen juntos cada marcador, nombre opcional, valor y proporción opcional. Los encabezados de marca de tiempo no estiran esas pistas; los nombres se alinean a la izquierda y los bordes numéricos a la derecha en todas las filas. Los nombres completos y los valores exactos siguen disponibles en títulos escapados. La paleta, la tipografía y los tokens de movimiento existentes no cambian.

- `colorPrimary: accentHover` (`#0579bd` en OMC Dark, `#004a73` en OMC Light) — los controles rellenos
  usan el paso más profundo; `colorInfo/colorLink: accent` (`#00a2fb` / `#005d8f`). Por eso los botones
  no brillan con el azul de antd mientras los enlaces siguen siendo reconocibles.
- Layout: `bodyBg` y `siderBg` son `canvas`, `headerBg` es `bg`, `headerHeight` 52.
- Menu: rellenos de elemento transparentes, `itemHeight` 32, `itemBorderRadius` 8, `itemColor = fg2`,
  `itemSelectedColor = fg`, `activeBarBorderWidth: 0`. Los velos de hover y de selección del carril son
  los de la hoja de estilos (§5), porque son primer plano sobre aquello en lo que se asiente el carril.
- Radios: `borderRadius` y `borderRadiusSM` 6, `borderRadiusOuter` 8, `borderRadiusLG` 12, de modo que una
  tarjeta, una cabecera de tabla y un diálogo toman la esquina `lg` del propio Ant Design; los paneles de Dropdown, Select y
  Popover toman 10 con filas de 6px; Tooltip 8.
- Modal y Drawer: `1px solid var(--border)`, `--shadow-overlay` de la hoja de estilos, la esquina
  `lg`; un Drawer de escritorio a la derecha se inserta 8px desde la ventana como el panel de contenido. Los diálogos
  simples de una sola tarea usan un cuerpo limpio e ininterrumpido («Título → Campo/Contenido →
  Acciones alineadas a la derecha») sin líneas divisorias decorativas de cabecera/pie;
  solo los Drawers complejos conservan divisores de sección.
- Table: `headerBg = surface` sin líneas divisorias de cabecera; el tipo de la cabecera y las reglas de fila son
  la superficie de lista de §5 (`.data-table`).
- Todos los tokens de sombra se fijan en `'none'`: la elevación es el conjunto `--shadow-*` de la hoja de estilos (§4), que
  sigue el modo de la paleta sin reconstruir el tema. Los tokens de movimiento son la escala de §7
  (`motionDurationFast` 0.12s, `Mid` 0.18s, `Slow` 0.24s) con el `motionEaseOut` de desaceleración.
- Componentes fijados: Button 32/28px con `primaryColor = accentOn` e `Input` con anillo activo
  `accent22`, Select optionSelectedBg = hover con peso 500, Tag defaultBg = bg. La etiqueta del botón se fija
  porque Ant Design la predetermina a `colorTextLightSolid`, de modo que una paleta con relleno de acento claro
  dibujaría de otro modo blanco sobre él. `createThemeConfig` toma la paleta *resuelta* en lugar de un id,
  de modo que los tokens de antd son una proyección del mismo objeto que leen la hoja de estilos, los gráficos y el tema de Monaco,
  y la paleta propia de un operador llega a Ant Design por el mismo camino que una registrada.
- Button, secundario (predeterminado): un velo de primer plano, no un contorno. `defaultBg`, `defaultHoverBg` y
  `defaultActiveBg` son `--fg` al 6%, 10% y 13% sobre `transparent`, todo `default*BorderColor` es
  `transparent`, y todo `default*Color` es `fg`: la profundización del relleno es el acuse de recibo, y el
  acento sigue siendo un enlace y una selección. Un botón discontinuo conserva un borde discontinuo `--border` sobre un
  relleno transparente (el `.ant-btn-variant-dashed` de la hoja de estilos), porque dibuja la ranura que llenará el siguiente
  elemento. `scripts/test-theme-presets.ts` compone el velo de cada estado sobre `--bg` como lo
  pinta el navegador con `color-mix` y mide la etiqueta contra él en cada paleta registrada y en un
  barrido de acentos de paletas de operador; el borde de hover de un campo permanece `muted`, porque el acento es el
  estado de foco del campo.
- Las tarjetas KPI del panel usan `@ant-design/charts` (`Area`) para renderizar una tendencia por mosaico.
  **La marca es un área, y es una decisión sobre la forma de los datos, no de estilo.** El
  backend rellena con ceros una cuadrícula fija de cubos (`fillDashboardBuckets`), de modo que una ventana tranquila
  son sobre todo cubos *cero* — seis horas se resuelven en 36 cubos de diez minutos, y una
  ventana real puede tener tráfico en menos de una quinta parte de ellos. Un cero aquí es un valor medido,
  no uno ausente, y una marca de barra dibuja cada uno de esos ceros como un hueco invisible entre
  marcas flotantes, lo que se lee como «sin datos» — lo único que no
  significa. Un área lleva la serie hasta su línea base, de modo que un tramo vacío se renderiza
  como el eje y sigue siendo distinguible de un período no medido.
  La marca son dos trazados a propósito: el relleno es solo relleno y la tendencia es un trazo aparte,
  porque un área con trazo cierra su trazado a lo largo de la línea base y pintaría una
  regla horizontal por el suelo del gráfico. `y.nice` está desactivado y `domainMin` fijado a
  cero por la misma razón — un dominio elevado haría flotar una ventana vacía sobre su eje.
  El runtime de gráficos está aislado en un chunk `vendor-charts` aparte y se carga de forma diferida
  (`React.lazy` con `import()` dinámico) para que solo la ruta del panel lo pague, manteniendo
  compacta la carcasa inicial de inicio de sesión. La paleta resuelta se transfiere a la configuración
  del gráfico (`sparkColor(resolved.palette, tone)`), las marcas se transforman entre dos revisiones con el token
  `roll` de §7 con una salida para movimiento reducido (`chartMotion.ts`, regla 5 de §7), y la lectura al pasar el puntero
  usa la interacción de tooltip compartida de G2 y `web/src/charts/chartTooltip.ts`,
  el mismo renderizador de contenido escapado que Token Trend. G2 se encarga de la detección de impactos por cubo,
  las líneas de cruz y el posicionamiento de la superposición; `.omc-tip` comparte el estilo de paleta entre gráficos.
  Los cuerpos de las tarjetas KPI se estiran dentro de cada fila de la cuadrícula y sus leyendas absorben el espacio sobrante,
  manteniendo los gráficos alineados abajo incluso cuando las notas de costo se ajustan en varias líneas. Las tendencias de tokens por modelo conservan
  los cubos cero medidos como segmentos continuos de línea base en lugar de observaciones ausentes.
  **Cada mosaico representa su propia métrica**, y las seis marcas deben seguir siendo visualmente distintas:
  Requests representa recuentos de solicitudes, RPM esos recuentos por minuto, Tokens representa el volumen
  de tokens, TPM ese volumen por minuto, Cache rate representa las lecturas de caché detrás de la
  tasa, y Total cost representa el gasto tarifado por cubo. El mosaico de tasa de caché representa el
  *numerador* y no la razón a propósito: una tasa necesita ambos términos y la
  serie lleva solo lecturas de caché, de modo que representar la razón inventaría un denominador
  a partir del total de tokens y sobreestimaría la tasa siempre que los tokens de salida fueran muchos.
  Las tasas son por minuto porque el ancho del cubo no es de un minuto en todo rango
  (`dashboardBucketWidth` lo ajusta a un paso cómodo), de modo que dividir por los minutos propios
  del cubo es lo que hace que una lectura de RPM sea un RPM.
  La sonda `dashboard-charts` comprueba que los seis mosaicos pinten seis patrones de píxeles *distintos*;
  sin esa comprobación, un mosaico recableado a la serie de otro pasa
  todas las aserciones por mosaico. `dashboard-chart-motion` es su hermana para el movimiento:
  conduce una revisión con movimiento permitido y otra tras cambiar la preferencia
  en el lugar, y comprueba que las marcas pintan fotogramas intermedios en el primer caso y
  ninguno en el segundo.
- **Los números de los mosaicos son una sola capa de lectura, y ruedan según la regla 8 de §7.** Cada valor se
  deriva del formateador que ya posee esa lectura — `formatTokens` y sus estilos
  `zh`/`full`, `formatCacheRate`, la tasa compacta de tokens, el recuento simple — y uno respaldado por
  `Intl` lee su número y su palabra de unidad de las propias partes de ese formateador
  en lugar de redondear una segunda vez. Los dígitos animados son por tanto los dígitos impresos:
  31,750 no puede llegar como `31.8K` y asentarse como `32K`. La palabra de unidad viaja junto al
  número, y un mosaico cuya palabra de unidad cambia imprime la nueva lectura en su lugar en vez de
  rodar, porque deslizar 1,2 hacia 900 mientras `B` pasa a `M` muestra dígitos que nunca
  describieron la ventana. El recuento exacto permanece en el `title` del mosaico, con el que coincide la lectura
  accesible de la lectura.

## 7. Movimiento

Los contenedores de Drawer hacen transición solo de su transform. El ancho y el ancho máximo adoptan el viewport
actual de inmediato, incluso durante el movimiento de apertura; redimensionar nunca interpola una hoja
más allá del viewport. Con movimiento reducido, la transición del contenedor se desactiva por completo.

```text
hover / state colour   ≤ fast — the acknowledgement must land with the pointer (rule 7)
fast    120ms   antd motionDurationFast: hover, press, colour, a leaving panel
float   160ms   a summoned panel - popover, menu, select or date panel - fading in as it settles
base    180ms   antd motionDurationMid: route and data transitions, disclosures, a switch's knob
slow    240ms   antd motionDurationSlow: a dialog rising into place, a side sheet
roll    240ms   the dashboard's KPI readouts and the marks drawn from them (rules 8 and 5)
route   300ms   one hop of a stored request across the dashboard's routing map (rule 9)
land    420ms   a node's one-off acknowledgement of a hop landing on it (rule 9)
glow    1200ms  a routing-map node or lane lighting as a request reaches it and settling back (rule 9)
enter   300ms   a routing-map row arriving in the minute, drifting in (rule 9)
exit    200ms   a routing-map row leaving the minute, accelerating away (rule 9)
presence 300ms  a routing-map row or heading sliding to close or open a gap (rule 9)
scroll  160ms   a wheel notch or scrolling key gliding to where it would have jumped (easeOutCubic)
ease    cubic-bezier(0.2, 0, 0, 1)      state changes and leaving panels (--ease-standard)
ease-out cubic-bezier(0.16, 1, 0.3, 1)  entrances: most of the move lands in the first third (--ease-out)
```

**La tabla es el presupuesto, y la hoja de estilos se ciñe a ella.** `web/src/index.css` replica `fast`,
`float`, `base` y `slow` como `--motion-fast`, `--motion-float`, `--motion-base` y `--motion-slow`
para toda transición y animación CSS que posee la consola;
`scripts/test-theme-presets.ts` analiza ambos, comprueba que `fast`, `base` y `slow` igualan los tokens de Ant Design
anteriores y fija la propia escala, de modo que las dos grafías de un mismo presupuesto no puedan volver a divergir. `roll` y `route` son los únicos tokens con una
excepción asociada, ambas acotadas al panel: `roll` por las reglas 5 y 8, `route`, `land`, `glow`, `enter`,
`exit` y `presence` por la regla 9. Los tokens de la regla 9 son solo de JavaScript (`MOTION_ROUTE`,
`MOTION_ROUTE_LAND`, `MOTION_ROUTE_GLOW`, `MOTION_ROUTE_ENTER`, `MOTION_ROUTE_EXIT` y
`MOTION_ROUTE_PRESENCE` en `themeConfig.ts`) y gobiernan Web Animations en lugar de una hoja de estilos; el
asentamiento de 600ms del gateway es el `--motion-route-cool` propio del panel de enrutamiento. `scroll` es un token solo de JavaScript
(`MOTION_SCROLL` en `themeConfig.ts`) para el deslizamiento de entrada descrito más abajo; ninguna hoja de estilos anima un desplazamiento.
El token aparte `--motion-live-text` (`MOTION_LIVE_TEXT`) es un bucle lineal de 900ms para etiquetas breves de
trabajo en curso, no un presupuesto de transición de estado. `themePaletteCssVariables` y la hoja de estilos
raíz proyectan el mismo período para toda paleta, fijado por la suite de lógica del tema.

### El presupuesto se aplica, no solo se documenta

`pnpm check:motion` lee cada hoja de estilos y cada `transition:` en línea de un componente, y falla
por cuatro cosas: una duración que no es un token `--motion-*` (o un respaldo de `var()`, que nunca se
aplica y es como se ocultó un valor erróneo durante meses), una transición sobre una propiedad de layout o sobre `all`, una
animación de keyframes sin su contraparte `prefers-reduced-motion`, y un hover que transiciona el color
fuera de `fast`. Las excepciones se listan en la tabla `EXCEPTIONS` del verificador con el motivo por el que cada una lo
es, y una excepción que deja de coincidir con una regla es en sí un fallo — la lista no puede pudrirse hasta convertirse en
cosas que alguna vez fueron ciertas. Existen tres tipos. Una excepción `layout` exime la regla 1 para un desplegable,
donde el reflujo es el objetivo y la alternativa es un acordeón que se abre de golpe. Una excepción `duration`
exime del requisito de token a un bucle cuyo período es lo que dura un ciclo en lugar de
una transición entre dos estados: la barra de relectura del mapa de calor, el spinner de icono, el indicador
de generación, el cursor de emisión, la actividad de espera de la barra de carga y la
respiración de los marcadores de primera carga. §7 los trata congelándolos o quitándolos con movimiento reducido en lugar de acortarlos.
Una excepción `reduced` exime de la contraparte de movimiento reducido a un selector cuyo movimiento es
la lectura y no decoración, o cuyo final espera la biblioteca: el flujo de carriles del mapa de enrutamiento en vivo
(el ADR 0102 registra por qué todo el trayecto se reproduce bajo la preferencia), y la entrada y salida de un diálogo,
que rc-dialog concluye en `animationend` - mueve el foco hacia dentro cuando termina la entrada y desmonta el
contenedor cuando termina la salida -, de modo que hacen un fundido cruzado durante `fast` en lugar de quitarse.
`scripts/check-motion.test.mjs`
ejercita cada regla en ambos sentidos sobre un árbol de prueba y comprueba que el propio repositorio está limpio.
Aplicar la regla de movimiento reducido se pagó de inmediato: antd anima sus paneles flotantes
con un zoom también bajo movimiento reducido, y el panel debe fijarse a su estado asentado en lugar de
simplemente des-animarse, porque rc-motion mantiene el estado de entrada en línea hasta que termina la animación.
Esa superficie se comprueba ahora en el navegador, no solo en la declaración.

**Las entradas se desvanecen y se asientan; nada vuela.** Ant Design hace zoom de un panel desde el 80% (un diálogo desde
el 20%, fuera del puntero) y estira un menú hacia abajo desde el 80% de su altura; la hoja de estilos sustituye
esos keyframes. Un panel invocado se desvanece durante `float` mientras asienta el último 4% hacia su
origen, un panel de menú o select baja además sus últimos 4px hacia su control, un diálogo sube 8px hasta su
lugar durante `slow`, y un panel que sale se desvanece durante `fast` - todo con `--ease-out`, solo opacity y
transform. Sin rebote ni sobrepaso: el lector ve llegar el resultado, no viajar. Con
movimiento reducido un panel se fija a su estado asentado, y un diálogo conserva solo un fundido de opacidad:
quitar su animación dejaría el foco tras él al abrirse y un contenedor transparente sobre la página
al cerrarse.

**Retroalimentación que sigue a la mano.** Un botón cede un poco bajo una pulsación (`scale(0.97)`) y
vuelve al soltar, de modo que un clic se siente antes de que lo que inicia haya respondido; un campo nunca lo hace,
por lo que la ventana de tiempo, dibujada como un campo, está exenta. Una hoja lateral desacelera hasta su lugar con
`--ease-out` y acelera al irse, en lugar del `ease` simétrico de antd. Un cambio de paleta - el
botón de modo de la cabecera, una elección de modo o de paleta en los ajustes de Shell-PAMC - hace un fundido cruzado de toda la página durante
`slow` mediante la View Transitions API, una sola capa compuesta en lugar de que cada elemento suavice
sus propios colores; durante los dos fotogramas que tarda el repintado, `data-theme-switching` en la raíz mantiene apagada la
transición propia de cada elemento, de modo que nada se difumina tras el fundido. Con movimiento reducido, o sin la
API, el cambio se aplica de golpe. La barra de desplazamiento de una lista virtual (la lista de solicitudes, las opciones de un select)
toma el mismo velo discreto que la de la propia página, mediante `--rc-virtual-list-scrollbar-bg`. La onda de clic de antd
y su espacio entre dos caracteres chinos de la etiqueta de un botón están ambos desactivados: ningún control de la
plataforma dibuja ninguno.

### El movimiento es contención, no decoración

La interfaz es silenciosa. El movimiento existe solo para hacer que los cambios de estado se sientan continuos y
**que sigan a la mano** (manipulación directa receptiva) — nunca para impresionar.
Cuando compiten fluidez y floritura, se conserva la fluidez; cuando compiten floritura y
rendimiento, se descarta la floritura.

Reglas estrictas:

1. **Animar propiedades solo de compositor** — `opacity` y `transform`. Nunca
   `width`, `height`, `top`, `margin` ni nada que dispare layout o
   repintado de un subárbol grande.
2. **Mantener diminuta el área animada.** Una barra de progreso de 2px es aceptable; atenuar o
   desvanecer toda una cuadrícula no lo es — obliga al navegador a componer la página
   entera en cada refresco. La única excepción es un marco marcador de primera carga,
   que existe solo mientras nada se ha cargado nunca y por eso nunca se anima sobre
   contenido (ADR 0052).
3. **Sin destello degradado.** El `Skeleton active` de antd y barridos degradados similares
   cuestan fotogramas y chocan con la estética plana. Los marcadores son los
   bloques planos propios de la consola (`Placeholder.tsx`), y *respiran*: un ciclo de
   opacidad, escalonado un `base` por fila, congelado con movimiento reducido (ADR 0052).
   El único destello barrido está en una etiqueta de texto breve para trabajo aún en curso en el
   Agent: un brillo `--fg` de 3,2em cruza la propia tinta de la etiqueta en el bucle lineal de 900ms
   `--motion-live-text`, ambos pintados con un solo fondo recortado a los glifos, de modo que
   repinta una línea y cada glifo se dibuja una vez con todo su peso (ADR 0080). El movimiento reducido y un enmascarado de texto no compatible dejan texto simple legible.
4. **Suprimir el destello del spinner.** Una solicitud que se resuelve rápido nunca debe pintar
   un indicador de carga en absoluto (la barra de carga espera 200ms antes de pintar).
   El refresco automático en segundo plano no debe pintar un estado de carga en absoluto; una lectura que
   cambió aún puede decirlo, que son las reglas 8 y 5 y nada más.
5. **Una marca se desliza entre revisiones en lugar de cortarse de golpe.** Una marca de AntV se transforma a su
   nueva geometría durante `roll`, y se desvanece en lugar de crecer cuando una serie entra o sale.
   Un gráfico que se corta de golpe cada pocos segundos se lee como un redibujado y no como datos nuevos - y
   junto a un mosaico cuyo número ahora rueda (regla 8), una línea que saltaba era el único elemento que aún
   decía «esto se sustituyó a sí mismo». Las marcas son las propias del panel, de modo que esto cubre tanto los
   seis sparklines de KPI como los paneles de modelos, que releen con una consulta propia.
   Dos límites hacen que esto sea una transformación y no un trazado de entrada: existe **solo porque la
   biblioteca reutiliza la instancia del gráfico** (el wrapper entrega la nueva especificación al mismo runtime,
   de modo que una actualización interpola, mientras que un remontaje es un trazado de entrada y sigue prohibido), y un
   canvas no es
   alcanzable por CSS, por lo que el interruptor de movimiento reducido es propio de la app
   (`usePrefersReducedMotion` en `web/src/hooks/`) y debe seguir cableado: la biblioteca no tiene
   manejo propio y su animación de actualización por defecto es un resorte de 900ms, que
   animaría con más fuerza justo para el lector que no pidió ninguna. El costo se enuncia en lugar de ocultarse:
   una marca de canvas se redibuja fotograma a fotograma en lugar de componerse, de modo que la regla 1 *no* se
   cumple con estas ocho marcas, y 240ms en superficies tan pequeñas es todo lo que
   compra la excepción. Véase el ADR 0008.
6. **Acusar recibo de las acciones de inmediato.** El `loading` de un botón y las
   affordances optimistas aparecen en la propia interacción, no tras una transición. La
   barra de progreso sigue en cambio la regla 4: espera 200ms para suprimir los
   destellos de solicitudes rápidas.
7. **Un hover aterriza dentro del token fast.** Un hover es la interfaz acusando recibo del
   puntero, por lo que debe aterrizar cuando llega el puntero — una transición más larga que
   `fast` (120ms) es un arrastre, no un acuse de recibo, y la regla se escribió tras el valor predeterminado de antd
   `motionDurationSlow` de 0.3s en el hover de elementos de menú, la expansión de submenús y el
   colapso del sider. Las entradas propias del carril hacen transición en `fast` en la hoja de estilos por la misma razón,
   sea cual sea lo que gastaría el menú de Ant Design. El límite está en la *duración*, no en la propiedad
   (ADR 0009, ADR 0103): un breve suavizado es el acuse de recibo, y cualquier cosa más larga es el arrastre. Dos reglas más estrechas valen dentro de ella: un
   hover nunca puede animar una propiedad de layout, y el único elemento que escala bajo el
   puntero (la marca del mapa de calor) no puede desvanecer su color, porque el desvanecimiento se difuminaría tras
   la escala a la que debe acompañar.
8. **Los números del panel pueden viajar.** Los seis números KPI del panel ruedan hasta
   su nuevo valor durante `roll` (`MOTION_ROLL` en `themeConfig.ts`), por la razón que da nombre
   a toda la excepción: esos mosaicos cambian por un sondeo que el lector no pidió, un número
   que se intercambia en el lugar es indistinguible de uno que ya estaba allí, y el
   barrido es lo que dice «esta lectura se movió» sin que la página se mueva. La regla 5 da a las marcas
   dibujadas a partir de esos números el mismo token, y la regla 9 deja que una solicitud almacenada viaje por el mapa
   de enrutamiento; nada más en la consola se mueve con un sondeo. Para
   los dígitos la excepción es barata y acotada -
   glifos que se transforman dentro de una caja de 34px de alto, de modo que las reglas 1 y 2 se cumplen tal como están escritas, y un cambio
   de *unidad* se imprime en el lugar, porque rodar 1,2 hacia 900 bajo una palabra de unidad que cambia
   mostraría dígitos que nunca describieron la ventana. `prefers-reduced-motion` lo elimina y el
   valor sigue actualizándose. Véase el ADR 0007 para el token y el ADR 0008 para lo que cuesta la regla 5.
9. **Una solicitud almacenada viaja por el mapa de enrutamiento, y regresa** - el movimiento de Magpie. Cuando el
   panel de enrutamiento en vivo del panel lee una solicitud que no ha mostrado, un punto brillante de 9px en el
   color del modelo emerge del puerto del modelo, recorre su carril hacia el gateway y el carril de la credencial
   que sale de él, movido en fotogramas de animación a lo largo de cada carril tal como se dibuja en ese momento y suavizado a la entrada y a la salida
   durante un pulso `route` por salto (`MOTION_ROUTE`). La luz atraviesa los nodos en lugar de
   reposar en ellos: el punto aparece en el primer quinto de cada salto y se hunde en el siguiente puerto durante
   el último quinto, y el nodo en el que se hunde se ilumina - su borde brilla y su puerto emite un anillo -,
   subiendo rápido y volviendo a asentarse durante el pulso `glow` (`MOTION_ROUTE_GLOW`); un carril se aviva tras
   el punto que lo cruzó y se asienta del mismo modo. Un nodo que se ilumina de nuevo mientras aún brilla sube desde
   la luz que tiene, de modo que una segunda solicitud nunca lo apaga primero. La solicitud espera en la
   credencial un pulso escalado a partir de la latencia real del intento (120-480ms); luego un velo en el
   tono de la respuesta se extiende por la credencial desde su puerto, y el punto - aún en el color
   del modelo - vuela de vuelta por el gateway hasta el modelo, o, en un rechazo, de vuelta al gateway y
   a la siguiente credencial que CPA probó. Un carril y el flujo sobre él nunca toman `--success`, `--warn` ni
   `--danger`: el veredicto es una superficie del nodo, no una propiedad de la conexión (véase la paleta de carriles de enrutamiento
   de §2). Mientras un punto está en un carril o espera en su extremo, las rayas del carril fluyen en la dirección
   en que viaja, y mientras haya cualquier punto en el mapa el brillo y los rieles del gateway se avivan.
   Las filas llegan flotando unos píxeles desde su propio borde del mapa mientras se desvanecen hacia dentro
   (`MOTION_ROUTE_ENTER`), las filas de la primera pintura una tras otra; se van del mismo modo,
   más rápido y acelerando (`MOTION_ROUTE_EXIT`), y solo entonces las filas de alrededor cierran el hueco,
   deslizándose por FLIP medido contra todo el mapa, de modo que una columna que se recentra también se desliza
   (`MOTION_ROUTE_PRESENCE`). Nada escala ni rebota. Mientras las filas se mueven, los carriles se redibujan en cada
   fotograma para que ninguno se separe de su fila. Es el único movimiento que se ejecuta con una señal en vivo y no
   con la acción del lector, y se permite por la razón de la regla 8: un recuento que cambia en el lugar
   no dice *en qué dirección* fue la solicitud, que es la lectura para la que existe el panel. Está acotado
   con rigor: opacidad y transformaciones, salvo el flujo de carriles, que anima el desfase de las rayas de los pocos carriles
   en uso y es el único bucle del mapa; ninguna sombra se anima - todo brillo es una superposición cuya opacidad
   cambia; como máximo ocho solicitudes se reproducen desde una lectura, con 70ms de separación, y como máximo dieciséis están en el mapa
   a la vez, omitiéndose una ráfaga que lo supere en lugar de ponerse en cola; la primera lectura no reproduce nada, porque
   abrir el panel no es el momento en que se ejecutaron esas solicitudes, ni tampoco una solicitud que
   terminó mientras la página estaba oculta - el flujo en vivo se cierra entonces, de modo que la lectura al volver las incluye,
   y se cuentan en las filas. Ocultar la página termina todo trayecto del mapa: una
   página oculta no ejecuta fotogramas de animación, de modo que un trayecto dejado en marcha completaría cada salto perdido en un
   fotograma cada uno al volver y reproduciría el tiempo perdido a toda velocidad. El trayecto es el único movimiento que la consola inicia
   por sí misma que se reproduce completo bajo `prefers-reduced-motion`: el flujo de un carril, el viaje de un punto y la
   entrada de una fila son la lectura misma, y el interruptor «Efectos de animación» de Windows - que muchos lectores
   apagan por velocidad y no por motivos vestibulares - lo informa Chromium como esa consulta. El
   mapa conserva por tanto su animación para todo lector; el ADR 0102 registra la excepción acotada y la
   contrapartida. Los recuentos nunca se animan.

   El mapa se entera de una solicitud cuando CPA guarda su registro, que es cuando terminó: CPA no informa
   nada de una solicitud mientras se ejecuta. El trayecto por tanto empieza en cuanto se lee el registro y
   se mantiene corto (alrededor de un segundo y medio de puerta a puerta) para que se lea como la solicitud que acaba de ocurrir.

### Nunca cambiar una vista de golpe

**Un marco ya pintado nunca debe quedar en blanco entre dos estados.** Esto se aplica a
toda transición: cambios de ruta desde la barra lateral, preajustes de ventana del panel,
cambios de rango personalizado, refresco manual y relectura en segundo plano.

| Situación | Comportamiento requerido |
| --- | --- |
| Cambio de ruta | El contenido se sitúa en un `.route-transition` con clave que aparece con fundido durante `base` (180ms) con una subida de 3px, y la posición de desplazamiento se restablece con la nueva página. |
| Cambio de clave de consulta (preajuste, rango, filtro) | `placeholderData: keepPreviousData` — el resultado anterior permanece en pantalla mientras se carga el siguiente. |
| Cualquier solicitud en curso | La barra `.data-progress` de 2px de toda la app, pintada tras un retraso de 200ms, cuyo relleno sugiere el trabajo contado y cuyo breve marcador de actividad informa de la espera (más abajo). Las regiones nunca se atenúan ni se desmontan. |
| Primera carga sin datos todavía | Renderizar el marco real de la página con marcadores dibujados con la geometría del contenido, no un cambio brusco a un spinner de página completa. |
| Error tras haber existido datos | Mantener visibles los datos obsoletos y mostrar una advertencia; reemplazar la página solo cuando nunca se cargó nada. |
| Sondeo de autorrefresco | La vista no se mueve, aunque una lectura y una marca sí puedan. El sondeo no es un cambio de vista, por lo que no debe restablecer la paginación, remontar la lista, expandir una cabecera plegada ni reetiquetar los datos como «resultados anteriores». Tres cosas pueden moverse: un número KPI del panel que rueda hasta su nuevo valor, cualquier marca de gráfico del panel que se transforma a su propia nueva revisión - los seis sparklines de KPI, y la tendencia de modelos y el anillo de uso, que releen en su propio endpoint y no en el de los mosaicos (reglas 8 y 5) - y una solicitud recién almacenada que viaja por el mapa de enrutamiento (regla 9). |

`prefers-reduced-motion` elimina el fundido, quita la estimación pendiente de la barra (solo
avanza cuando se resuelve una tarea) y congela la respiración de los marcadores, pero la
regla de no dejar en blanco sigue vigente — se recurre a un estado de carga estático.

### Retroalimentación de carga: progreso aproximado, actividad de espera y marcadores con la forma del contenido

Los ADR 0052 y 0054 registran la contabilidad de tareas, el tratamiento de los marcadores y la señal de actividad independiente.

**El relleno sugiere el progreso; el marcador informa de la espera.** Toda lectura de consulta que el lector espera y
toda descarga de módulo tras un límite Suspense es una tarea (`web/src/utils/loadProgress.ts`,
`web/src/utils/progressTasks.ts`). Una lectura de consulta cuenta cuando aún no hay nada en pantalla para ella (una primera
carga, una clave nueva, un reintento tras un fallo), cuando una acción invalidó datos que se leyeron por última vez
con éxito, o cuando se relee una consulta que nadie sondea (un botón de refrescar). Una consulta sondeada que relee
los datos que ya muestra - incluido el sondeo posterior a uno fallido - es refresco en segundo plano y nunca
cuenta. La regla se lee de la consulta (`isQueryProgressWork` en `web/src/utils/progressSources.ts`),
de modo que un sondeo no necesita adhesión explícita; como un tic de intervalo y un `refetch()` manual se ven igual ahí, un
refresco que deba informar de la espera en una consulta sondeada la invalida. `meta: { silent: true }` se mantiene
para lecturas que la consulta no puede clasificar: una lectura en vivo que pasa a una clave nueva por señal, y lecturas en segundo plano
silenciosas incluso en su primera carga. Una tarea resuelta cuenta por completo; una tarea pendiente gana crédito
exponencial acotado hacia el 85% de su parte. Es una estimación aproximada, no una duración restante
ni un porcentaje de bytes medibles. El relleno nunca retrocede, ni siquiera cuando se suma trabajo nuevo.

La pista de 2px conserva su tinte de acento del 18%. Su relleno usa el acento al 65% de opacidad. Dentro del
borde delantero del relleno, una ventana de actividad recortada mide como máximo 64px y el 16% del ancho de la pista; su segmento
sólido de acento mide como máximo 16px y el 25% de esa ventana. El segmento viaja en un ciclo CSS lineal de 1200ms,
apareciendo y desapareciendo al dar la vuelta. Sigue moviéndose cuando el relleno estimado se detiene. Señala una
espera pendiente del cliente, no un latido del upstream ni trabajo completado adicional. Solo se animan transformaciones y opacidad;
no hay renderizados de React por fotograma ni mediciones de layout.

`web/src/utils/progressController.ts` posee el ciclo de vida con reloj inyectado. Las notificaciones de las fuentes no
restablecen el reloj de dibujo ni reinician el ciclo de actividad. La barra espera 200ms antes de pintar.
Cuando se resuelve la última tarea, la actividad se detiene y el relleno se cierra dentro de un pulso
`--motion-base` resuelto, luego se mantiene completo durante un pulso `base` y se desvanece durante otro. El contenido no espera a esta
animación. La resolución incluye fallos y cancelación; que la barra termine no es un veredicto de éxito.

La `progressbar` localizada omite `aria-valuenow`: la tecnología de asistencia no debe anunciar una estimación
como un porcentaje medido. `aria-busy` sigue siendo verdadero solo mientras haya tareas contadas pendientes. El movimiento
reducido elimina el bucle de actividad y el crédito pendiente, deja de dibujar fotogramas y se actualiza a partir de los eventos
de las tareas; cambiarlo en vivo conserva el lote y nunca mueve el relleno hacia atrás. Una barra completada
se oculta de inmediato con ese cambio, incluido un desvanecimiento cancelado. Los documentos ocultos suspenden el dibujo,
el temporizador de mostrar y la actividad; el trabajo pendiente se reanuda desde su estado real, mientras que el trabajo completado se
retira sin repetición. Ni la derivación de la paleta ni el mapeo de tokens del tema cambian.

| Dónde | Qué cuenta |
| --- | --- |
| Bajo la cabecera de la consola (`DataProgress`) | Las consultas de la página, y las descargas de módulos de ruta, editor y panel lateral |
| Bajo la cabecera del marcador de la carcasa (`ShellLoading`) | La lectura de preferencias almacenadas y la descarga de la propia carcasa |
| El borde superior de la página de inicio de sesión | La comprobación de sesión y la solicitud de inicio de sesión |

**Los marcadores se dibujan con la geometría del contenido.** El kit de
`web/src/components/common/Placeholder.tsx` es el vocabulario compartido de marcadores;
`web/src/components/common/ContentPlaceholder.tsx` compone formas de párrafo y tabla exclusivas de páginas
tras la importación de la ruta, manteniéndolas fuera de la entrada de inicio de sesión;
`Skeleton` de antd y `Spin` a nivel de página no se usan en una primera carga. Los bloques se rellenan
con `--border`, usan `--radius-sm`, y las alturas de línea coinciden con la altura de glifo del
texto que representan (título 18px, cuerpo 10px, meta 8px).

| Superficie | Marcador |
| --- | --- |
| Carcasa (`ShellLoading`) | El wordmark real, el carril con su ritmo de etiqueta de 28px / elemento de 36px y los tamaños de grupo, las migas y acciones de la cabecera, y un marco de página |
| Una ruta diferida (`RouteLoading`) | La cabecera de la página (título, subtítulo) y una lista enmarcada de seis filas |
| Una lista (`PageLoading variant="block"`) | Filas de marca, nombre, línea meta y estado final con la altura de fila de 64px de la lista |
| La lista de solicitudes | Filas de tabla con la altura de fila de 44px de la lista (`TablePlaceholder`) |
| Panel | La etiqueta, la lectura y el sparkline de cada mosaico en la cuadrícula real de mosaicos |
| Paneles laterales, paneles, editores | Líneas de párrafo (`ParagraphPlaceholder`) |
| Biblioteca de iconos personalizados | Los mosaicos de arte propios de la biblioteca |

Una región de marcador lleva el nombre de estado localizado `common.loading`; los
bloques son `aria-hidden`. Un fallback de Suspense dentro de una página usa
`SuspenseFallback` para que su descarga se cuente.

### Cola en vivo: seguir arriba, mantener al leer

Una lista sondeada es una cola en vivo, y una cola en vivo tiene que responder una pregunta: ¿quiere
el lector que lo lleven consigo, o está leyendo?

- **Arriba del todo** (a pocos píxeles) el lector está siguiendo. Los registros nuevos aparecen
  de inmediato; el más reciente es siempre la primera fila.
- **Alejado** el lector está leyendo. Las filas en pantalla se mantienen exactamente como
  están, el sondeo sigue ejecutándose en segundo plano, y una píldora sobre el pie
  informa `N new records` — al pulsarla se aplica el atraso y se vuelve arriba.
  Volver arriba a mano reanuda el seguimiento, de modo que la píldora nunca es la
  única salida.

La píldora sustituye al botón simple de volver arriba cuando hay atraso, porque
ambos son el mismo gesto. Llevar al lector arriba en cada sondeo — o
reordenar las filas bajo el cursor — es el modo de fallo que esto existe para
evitar: es lo que se niegan a hacer los registros de Grafana, Datadog, Sentry y Vercel.

Dos reglas de apoyo mantienen honesto el seguimiento:

1. **La paginación sobrevive a un sondeo.** El alcance de la vista son los filtros más la página
   que eligió el lector; el contador de autorrefresco queda deliberadamente fuera. Antes
   estaba dentro, lo que restablecía en silencio a todo lector a la página uno.
2. **La lista se ordena por hora de solicitud, la más reciente primero**, de modo que la columna que el
   lector ordena a ojo es la columna por la que se ordena la lista. Véase
   `docs/architecture.md` para el cursor keyset y el índice que necesita este orden.
   «Llegado» es otra pregunta y se responde por separado: la píldora cuenta
   los registros *grabados* desde que el lector dejó de seguir, porque una solicitud que
   duró una hora es nueva aunque se ordene muy por debajo de la primera página.

### Desplazamiento: un gesto se mueve, una corrección aterriza

La propia lista se desplaza, de modo que sus desplazamientos llevan dos intenciones distintas y
no deben compartir comportamiento:

| Intención | Desplazamientos | Comportamiento |
| --- | --- | --- |
| Gesto | Volver arriba, aplicando el atraso de `N new records` | Animado, salvo `prefers-reduced-motion` |
| Corrección | Fijar la fila uno tras plegarse la cabecera, restablecer al cambiar de página | Instantáneo |

Una corrección no es un gesto más débil, es otro trabajo. Plegar la cabecera
y paginar necesitan la fila uno en pantalla *antes* de que se ejecute la siguiente sentencia, y la
lista vuelve a medir tras confirmar filas nuevas — de modo que una corrección que aún se desliza
es una corrección que no ha aterrizado, y el lector ve entretanto una posición que nadie pidió.
`web/src/utils/smoothScroll.ts` nombra las dos intenciones y posee el
calendario.

**La animación se conduce en JavaScript, no con CSS.** Poner `scroll-behavior:
smooth` en el contenedor de la lista parece la implementación natural y no
funciona: la lista está virtualizada, de modo que el virtualizador posee ese elemento, sigue escribiendo
`scrollTop` según su propio calendario, y gana. Medido contra la lista real, el
contenedor no se movió en absoluto. Por eso `animateScrollToTop` interpola fotograma a fotograma e
inyecta cada fotograma a través del propio `scrollTo` de Listy, lo que deja exactamente una
autoridad sobre el desfase y ninguna pelea que perder. El calendario es una función pura del
tiempo transcurrido y no un acumulador, de modo que un fotograma perdido o tardío no puede hacer que el
gesto derive o se pase, y el último fotograma escribe `0` explícitamente — un
retorno arriba que llega *aproximadamente* arriba no ha vuelto arriba.

Un retorno animado arriba emite eventos de desplazamiento durante todo el ascenso, de modo que la página
mantiene el estado de plegado hasta que llega (acotado por un plazo, por si el
lector lo interrumpe y nunca llega). Sin eso, los primeros fotogramas — que
aún llevan un `scrollTop` grande — volverían a plegar la cabecera en el primer fotograma
del propio gesto que la estaba expandiendo.

### La rueda y las teclas se deslizan; un dedo nunca se suaviza

Los popups de opciones nativos (`overflow-y: auto`, incluido el selector de modelo del Agent) conservan el desplazamiento de rueda gestionado por el navegador incluso cuando comparten la estructura de contenedor de la biblioteca de listas. Su listener de desplazamiento refleja los desfases mediante estado diferido de React, de modo que un segundo escritor de desfase puede deshacer el avance. Solo un contenedor con desbordamiento oculto y esa estructura recibe pasos de rueda sintéticos; la mera similitud estructural no establece desplazamiento virtual.

Una rueda de ratón con muescas entrega un desplazamiento como saltos de 100px, y que el navegador los anime es una
decisión del sistema operativo — los lectores de Windows que apagan «Efectos de animación» obtienen pasos, y la
lista virtualizada de solicitudes daba pasos en todo escritorio de Windows porque aplica ella misma los deltas de rueda. Un
trackpad, un teléfono y macOS entregan un flujo que ya se desliza. Por eso la consola suaviza el *paso*
y deja en paz el *flujo* (`web/src/utils/scrollSmoothing.ts`, ADR 0046):

| Entrada | Comportamiento |
| --- | --- |
| Muesca de rueda (modo línea/página, o una muesca en modo píxel fuera de plataformas Apple) | Se desliza durante `scroll` exactamente hasta donde habría saltado |
| Flechas, Re Pág/Av Pág, Espacio, Inicio, Fin fuera de un control o widget editable | Se deslizan durante `scroll` |
| Trackpad, ruedas en píxeles de plataformas Apple, táctil | Nunca se deslizan. Un dedo sobre la lista de solicitudes la mueve directamente (§8) |
| Rueda con Ctrl/⌘, Mayús o Alt; rueda horizontal | Nativa (zoom, desplazamiento lateral) |
| Desplazamiento programático (una corrección, `scrollIntoView`) | Nativo; también detiene cualquier deslizamiento en ese desplazable |

Cada muesca reorienta el deslizamiento desde donde está, de modo que una rueda que sigue girando acelera en lugar de encolarse;
el deslizamiento sigue al desplazable más cercano bajo el puntero que aún pueda moverse, y deja de encadenar en un
desplazable que contiene su sobredesplazamiento, como hace el desplazamiento nativo. Una lista virtualizada (la lista de
solicitudes, el popup de opciones de un Select) se mueve mediante su propio manejo de rueda, un paso por fotograma, porque
posee su desfase. Aplica un paso en su siguiente fotograma y lo muestra cuando React confirma, dos fotogramas
por detrás en una página ligera, de modo que un desfase en cualquier punto entre donde empezó el deslizamiento y donde se ha pedido
llegar es ese retraso; solo un desfase fuera de ese tramo cuenta como corrección y detiene el deslizamiento.

**Un deslizamiento nunca añade retraso a la mano del lector** (ADR 0047). Todo deslizamiento se mueve en su primer fotograma;
una lista virtualizada recibe su primer paso desde dentro del evento de entrada, de modo que empieza en el fotograma en que lo haría su propio
salto; y una muesca que llega mientras la lista aún se está poniendo al día ni le cuesta un
fotograma ni vuelve a empezar desde donde ha llegado la lista. Una rueda que sigue girando mueve la lista en
cada fotograma hasta que aterriza.

Un componente que convierte una muesca en otra cosa — la lista de solicitudes plegando su cabecera en la
primera muesca — lo declara con `consumeWheel`, pues `preventDefault` desde un manejador de React se ignora.

El deslizamiento está activado por defecto y **no** lo desactiva `prefers-reduced-motion`: es la
propia entrada del lector siguiendo su mano, igual que el desplazamiento inercial sigue activo con Reducir movimiento en
macOS e iOS, y en Windows la señal de movimiento reducido es el mismo interruptor que quitó el
deslizamiento del navegador. La fila **Smooth scrolling** de la página de ajustes de Shell-PAMC (`On` / `Follow system` / `Off`,
la preferencia `omc_scroll_smoothing`) entrega la decisión a esa señal o apaga el deslizamiento.
El gesto de volver arriba descrito antes es un recorrido iniciado por la página y sigue respetando el movimiento reducido.

### Nada costoso viaja con el desplazamiento

Desplazar esta lista es la interacción mediante la que se usa la página, y el costo de un
fotograma se paga en cada fotograma. Por eso dos cosas no se permiten en ningún elemento
que esté en pantalla mientras la lista se desplaza:

| No permitido | Por qué |
| --- | --- |
| `backdrop-filter` | El compositor debe releer los píxeles tras el elemento a medida que esos píxeles cambian bajo él — el peor caso posible para un desenfoque, porque un desplazamiento los cambia en cada fotograma. Chrome en Windows suele resolverlo por software y no en la GPU, por lo que la misma compilación se desplaza con fluidez en macOS y con pesadez en Windows. |
| `box-shadow` | El costo de pintado crece con el radio de desenfoque y el área cubierta, y se repinta cuando el elemento se mueve. Las sombras de la consola pertenecen a capas invocadas (§4), que nunca viajan con un desplazamiento. |

La píldora flotante de volver arriba es el caso que importa: aparece *justo* cuando
el lector se está desplazando. Es un `--surface` opaco con un borde de 1px, que se lee
contra una lista cargada sin ninguno de los dos efectos.

La misma regla gobierna la animación de entrada: un elemento adyacente al desplazamiento anima solo
`opacity` y `transform`, nunca una propiedad que fuerce layout o un repintado.

### Nombrar es una acción de primera clase, no un ajuste oculto

Las claves del gateway se identifican mediante máscaras (`sk-5Yalm••••••••odar`). Una máscara es
ilegible y, como conserva solo un inicio y un final cortos, ambigua: dos claves
pueden compartir una. Por eso el **nombre** de una clave es el identificador principal y la máscara es el
identificador de último recurso.

Por tanto, la tabla de gestión de claves se lee nombre → clave → uso → acciones. El nombre va
primero porque es lo que el operador reconoce y lo que mostrará toda otra superficie. Cuando una clave no tiene nombre, la celda lo dice en lugar de quedar en blanco, porque una
celda en blanco se lee como un dato ausente y no como un nombre que nadie ha puesto aún.

Tres reglas evitan que se confundan los dos identificadores:

| Regla | Por qué |
| --- | --- |
| Un nombre es una **etiqueta**, nunca una identidad | La huella almacenada sigue siendo el valor del filtro. Un filtro que significa algo distinto de lo que muestra es la ambigüedad que el nombre existe para eliminar. Renombrar no debe cambiar lo que selecciona un filtro guardado o un enlace de profundización, y se permiten nombres duplicados porque una etiqueta no necesita ser única. |
| Toda superficie que imprime un llamador imprime el nombre | La lista, el detalle, las opciones de faceta y los chips aplicados lo resuelven desde la misma clave, de modo que el desplegable y las filas que filtra no pueden nombrar una clave de manera distinta. |
| Sin nombre se recurre a la máscara, nunca a una huella | La huella es una identidad con hash; imprimirla nombraría un filtro de una forma que el operador nunca eligió. |

**Los recuentos deben enunciar su alcance.** Los recuentos de solicitudes por clave y las horas de último uso proceden
de los propios eventos almacenados de Shell-PAMC en una ventana, no de CPA ni de
toda la vida de la clave. La tabla lo dice junto a ellos: un recuento que se lee como un total de toda la vida
sería un dato que el sistema no tiene. Una clave sin registros coincidentes
muestra «not linked» en lugar de un `0` fabricado o una fecha de creación inventada — CPA
no publica fecha de creación, de modo que cualquier columna así sería una conjetura presentada como dato.

**Tres acciones a la vista, el resto tras el desbordamiento.** Los controles de revelar, copiar
y editar de una fila son botones cuadrados que el operador puede ver, porque son los que
ponen la propia clave en la mano y un secreto alcanzable solo a través de un menú queda un
clic más lejos de la operación que lo necesita. Seguir el tráfico de una clave y
eliminarla viven en el menú de desbordamiento, ya que ninguna trata de leerla.
La eliminación es la única acción irreversible de la lista — CPA acepta una clave por su presencia en
`api-keys` y la consola no guarda copia del valor — de modo que su confirmación dice que el
valor no puede recuperarse y debe copiarse antes (ADR 0010).

**La lista es un solo contenedor.** La fila de cabecera, su regla y la lista son una sola superficie,
porque una tarjeta que contiene otra tarjeta que contiene una barra de herramientas es exactamente el anidamiento que la regla
de lista abierta existe para evitar. La cabecera lleva el nombre de la superficie, cuántas claves
están configuradas, el cuadro de búsqueda y toda acción que se aplica a la lista en conjunto,
y se ajusta en varias líneas en lugar de desplazarse, de modo que los controles conservan su ancho en todo idioma
de lectura. Una sola línea bajo la lista enuncia la ventana que cubren sus recuentos.

**Un conjunto de datos, renderizado de forma adaptable.** La lista es una tabla por encima de 640px y filas rotuladas a
640px y por debajo, y lo decide el ancho — nunca un control que el operador tenga que encontrar. Las
dos representaciones se derivan de un solo arreglo de columnas
(`web/src/components/common/phoneRowFields.ts`), de modo que una columna añadida a la tabla llega a la fila
y un valor no puede formatearse de dos maneras. La medición que fijó el umbral, y las
alternativas frente a las que se eligió, están en el ADR 0012.

## 8. Viewports pequeños y táctil

La consola se opera desde un teléfono además de desde un escritorio, y un teléfono no es un escritorio
pequeño. No tiene hover, su puntero es un dedo y no un cursor de 1px, su viewport
cambia de altura mientras el lector se desplaza, y en Android tiene un botón Back de hardware que
tiene que significar algo. Ninguno de esos cuatro hechos estaba expresado en ninguna parte del sistema, que
es lo que registra esta sección.

### Dos puntos de corte de viewport y un umbral de contenedor

| Umbral | Tipo | Qué decide |
| --- | --- | --- |
| `900px` | viewport | La carcasa cambia de forma: el carril se convierte en una hoja, la cabecera de página y las columnas de la cuadrícula se apilan. |
| `640px` | viewport | El dispositivo es un teléfono: las superficies de lista renderizan filas rotuladas en lugar de una tabla, y los controles toman sus tamaños táctiles. |
| `920px` | contenedor (`reqstream`) | El ancho propio de la lista de solicitudes ya no cabe en sus columnas, por lo que cada registro pasa a ser un registro apilado de tres líneas. |

El tercero es una consulta de contenedor y no un punto de corte de viewport, y deliberadamente: esa
lista se sitúa dentro de la columna de contenido de la página, de modo que el mismo viewport contiene un ancho de lista distinto
según el carril esté abierto o no. «¿Siguen cabiendo las columnas?» es una pregunta sobre la caja
en la que están las columnas, y solo el contenedor puede responderla. El mismo razonamiento gobierna la
pila de paneles `@container modelusage (max-width: 500px)` del panel y el layout estrecho
`@container routingmap (max-width: 940px)` del mapa de enrutamiento en vivo.

Por encima de ese umbral la lista de solicitudes **pliega columnas en lugar de desplazarse lateralmente**. La cuadrícula
tiene un suelo - la suma del ancho de todas las columnas - y una ventana más estrecha que el suelo antes obtenía una
barra de desplazamiento horizontal, que sacaba de pantalla las cifras de costo y tokens y convertía cada hover en un
desplazamiento. Ahora la lista mide su propio ancho y oculta columnas, una a una, hasta que el resto cabe:
primero el user agent, luego la clave del llamador, la velocidad, la tasa de caché y el modo. Las columnas que dicen qué fue la
solicitud y cuánto costó - hora, resultado, proveedor, modelo, latencia, tokens, costo - nunca se pliegan;
la velocidad va antes de la latencia, de modo que la latencia y los tokens - las dos cifras con una segunda línea - se leen como un
par;
permanecen hasta que la lista pasa a registros apilados. Esto no añade ningún umbral: los puntos de pliegue son los
anchos medidos de las columnas que el operador tiene actualmente (`foldRequestColumns` en
`web/src/components/usage/requestColumns.ts`), de modo que una columna redimensionada los mueve. Una columna plegada está
ausente tanto de la cabecera como de las filas, su valor sigue en el panel de detalle del registro, y una
exportación dibuja todas las columnas de todos modos, porque una hoja no está limitada por la ventana.

Tres umbrales con tres significados distintos es el presupuesto. Un cuarto número necesita un motivo
enunciado junto a él, y dos reglas que calculan lo mismo con anchos ligeramente distintos son
un defecto: la lista de solicitudes llevaba un bloque `@media (max-width: 920px)` de viewport que duplicaba
su consulta de contenedor, y solo podía dispararse donde el contenedor ya lo había hecho (el
contenedor mide como máximo `viewport − 64px`), de modo que se eliminó en lugar de dejarlo como un segundo
punto de corte sin explicar.

### Un registro de solicitud apilado son tres líneas, en los colores de texto

Por debajo del umbral de contenedor un registro son tres líneas de dos datos cada una (ADR 0096):

| Línea | Inicio | Final | Tono |
| --- | --- | --- | --- |
| 1 | modelo, el modelo sustituido o enrutado a su lado, luego la insignia de esfuerzo de razonamiento y las marcas de modo | costo | primario: `--text-base`, peso 600 |
| 2 | proveedor y cuenta | tokens totales | `--fg-2`, peso 400 |
| 3 | hora, el control que copia el id de la solicitud, veredicto | latencia | `--muted`, `--text-sm` |

Un registro en una lista está para ser reconocido; el panel de detalle, a un toque de distancia, es donde se
lee. El tiempo hasta el primer token, el desglose de tokens, la tasa de caché, la velocidad, el tipo de credencial, la
clave del llamador y la etiqueta del cliente no se dibujan por tanto en un registro apilado. Un
registro del ancho de un teléfono que repite toda columna de la tabla en letra pequeña no puede escanearse, por pocos píxeles que
ocupe.

Es el propio DOM de la fila de la tabla. Las celdas que contienen dos datos (hora e id, total y desglose,
latencia y primer token) se disuelven con `display: contents`, y los saltos de línea son los
pseudoelementos de esas celdas. Cada línea tiene una celda con base flex cero que cede primero, de modo que una línea se
recorta en lugar de ajustarse; el registro tiene la misma altura a 320px y a 390px. La casilla de verificación
se sitúa en el relleno izquierdo del registro, de modo que las tres líneas comparten un borde izquierdo y las marcas de modelo y
proveedor forman una columna.

**El tono es para la excepción.** En la tabla el tinte de cada marca tiene una columna para él solo. Plegados en
unas pocas líneas, un relleno de éxito, un tono de esfuerzo y un tipo de credencial llegan de un vistazo y ninguno
se lee como una señal. Un registro apilado se dibuja por tanto en los colores de texto, y tres cosas
conservan un tono: el indicador del veredicto, un veredicto fallido completo, y la insignia de esfuerzo de razonamiento, que
se dibuja exactamente como la dibuja la tabla porque es la única marca que explica de un vistazo el costo y la
latencia de un registro. La insignia nunca se recorta: en su línea cede el nombre del modelo.
La tabla por encima del umbral no cambia.

### Una página nunca se mueve lateralmente

La consola se desplaza dentro de su panel de contenido, y en un teléfono ese panel se desplaza solo verticalmente.
El contenido más ancho que un teléfono se desplaza dentro de su propio marco: un bloque de código, una tabla ancha, el mapa
de calor de tokens, y una tira de opciones que no puede ajustarse (los filtros del libro de precios, la navegación de secciones de la
página de configuración) se desliza dentro de la tira con `overscroll-behavior-x: contain`. Todo lo demás
queda acotado por su columna. Un deslizamiento lateral que mueve toda la página o toda la conversación es un
defecto, y las sondas de lista de teléfono y de espacio de trabajo estrecho miden el propio `scrollWidth` del panel de contenido,
no solo el del documento.

### La lista de solicitudes es el único desplazable de la página, y sigue al dedo

En un teléfono, o dondequiera que un dedo sea el puntero principal, la página de solicitudes es exactamente el panel de contenido
y la lista es lo único que hay en ella que se desplaza. Una página alrededor de la lista que pudiera desplazarse se
apropiaba de todo arrastre que empezaba en los filtros y de todo arrastre que llegaba al final de la lista,
y luego rebotaba en su propio final, o recargaba la página al tirar hacia abajo arriba del todo. Sobre la lista el navegador
conserva solo el paneo lateral y el pellizco de zoom (`touch-action: pan-x pinch-zoom`).

La lista de solicitudes empieza con una estimación de fila virtual de 72px, proyectada mediante el
token de componente de Listy (22px de altura de fuente más dos veces 25px de relleno de bloque). El relleno de su contenedor
se anula a cero en `web/src/pages/UsageEventsPage.css`: esta proyección aporta
una pista de tamaño, mientras que el CSS de fila existente posee el espaciado visible. Las alturas reales de elementos y
de cabeceras de grupo se siguen midiendo, incluidas las filas más altas del teléfono.

Cada fila declara `contain: layout style`. La lista mide cada fila montada tras
cada confirmación, y sin contención medir una fila recalcula el layout de las filas que la rodean;
nada de lo que dibuja una fila depende de sus vecinas, por lo que el límite no cuesta geometría. Una fila
es por tanto el bloque contenedor de todo lo posicionado dentro de ella: los popups a nivel de fila
pertenecen a la lista (el tooltip compartido) o a un portal, nunca a un hijo posicionado de forma
absoluta que deba escapar de la fila.

La lista está virtualizada, de modo que el navegador no puede desplazarla para un dedo, y la propia emulación táctil de la biblioteca
corría hasta cuatro veces por delante del dedo: reiniciaba una inercia de intervalo fijo tras cada
movimiento, y esa inercia seguía disparándose mientras el dedo seguía apoyado. La consola mueve la lista por sí misma
(`web/src/components/usage/requestListTouch.ts`, ADR 0048):

- **La lista se mueve exactamente lo que el dedo**, dibujada en el fotograma en que se movió el dedo.
- **Un golpe de dedo continúa por inercia** a la velocidad con que lo dejó el dedo, frenando al ritmo normal de iOS, y un dedo
  que reposó antes de levantarse no continúa.
- **Un toque sobre una lista en inercia solo la detiene**, como en cualquier desplazable nativo; no abre la fila
  que hay debajo. Un toque en otro sitio, en la paginación o en la píldora de volver arriba, detiene la inercia y aun así
  actúa.
- **La cabecera se pliega y se despliega con los gestos de la rueda.** El primer arrastre hacia arriba la pliega
  y deja la fila uno en su sitio, como hace la primera muesca. Un tirón deliberado hacia abajo pasada la parte superior de la lista
  (48px) la despliega, como hace el rebote superior; llegar arriba no lo hace. Plegar es lo que hace sitio
  en un teléfono, donde los filtros desplegados ocupan la mayor parte de la pantalla; el tirón es la única manera de volver a
  ellos que tiene un dedo, ya que la píldora de volver arriba no se muestra arriba del todo. Una página que está cargando
  o que no encontró nada no tiene lista que tirar, de modo que un arrastre allí nunca pliega la cabecera, y una cabecera plegada
  antes de que la lista desapareciera se despliega con un tirón de 48px hacia abajo en cualquier parte de la página.
- **El pliegue se desliza, y la lista responde una sola vez.** La cabecera se pliega durante `--motion-base` desde
  su propia altura, y la lista llena la altura que se libera, de modo que cada fotograma del pliegue redimensiona la
  caja de la lista. Lo que hacía perder fotogramas - una rueda oscilando por la parte superior de la lista tartamudeaba en
  cada cambio de dirección - era todo lo que respondía a cada fotograma: la página se volvía a renderizar para pasar
  a la lista una altura nueva, y la lista virtual volvía a medir cada fila montada. Ahora nada de eso ocurre.
  Una lista a punto de crecer toma la altura final del pliegue en un solo paso cuando el pliegue empieza, leída de los
  keyframes finales de la propia transición; una lista a punto de encogerse conserva su altura hasta que el pliegue aterriza,
  y su anfitrión recorta el excedente (`useRequestListHeight`). El pliegue y la píldora de volver arriba se
  mantienen fuera del renderizado de la página (`viewFlag.ts`), de modo que un cambio vuelve a renderizar el contenedor de la cabecera y su
  botón y nada más. Medido en el servidor de desarrollo en doce oscilaciones: unos 20 fotogramas de más de 25ms
  antes, unos 10 ahora, y un tercio menos de script; el mismo pliegue sin transición alguna mide
  6, que es el precio del deslizamiento.

### La navegación del teléfono es el carril, en una hoja

No hay barra inferior ni menú específico del teléfono. La hoja lleva las dos partes del propio carril —
marca y navegación agrupada — porque un teléfono no tiene menos que navegar, tiene menos espacio para mostrarlo,
y una segunda navegación sería un segundo lugar donde la agrupación podría divergir.

**La hoja está acotada en `vw` además de en `px`** (`min(320px, 86vw)`). En un viewport de 320px una hoja fija
de 320px no deja página visible tras la máscara, y el lector pierde la sensación de que esto es una
capa sobre donde estaba — que es también lo que le dice que Back la retirará.

Se consideró y se rechazó una barra de pestañas inferior: cuesta 56px de espacio vertical más el inset del indicador de inicio
en cada pantalla, en una consola cuyo tema son las tablas densas, y no puede expresar cuatro grupos
de diecisiete destinos sin un «More» que reintroduce la hoja de todos modos.


### Un dedo no tiene hover

Toda affordance se dibuja donde puede alcanzarse. Un control revelado solo por `:hover` permanece en
`opacity: 0` durante toda la vida de una sesión táctil, de modo que una fila marcada como interactiva por una flecha
de hover es una fila sin ninguna affordance visible. Por eso las reglas de revelar al pasar el puntero llevan una
contraparte `@media (hover: none)` que las dibuja de forma permanente (`.provider-jump-arrow`,
`.req-id-quick-copy`), y la consola no tiene ninguna regla que oculte significado tras un hover.

Un tooltip tampoco es una affordance: puede *nombrar* un control, nunca ser la única manera de
alcanzarlo. Cuando el nombre de un control es suficientemente corto como para importar en un teléfono, el nombre se dibuja.

### El suelo táctil es un área de impacto, no un tamaño dibujado

`space scale 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48px` (§4) es lo que *es* la densidad de la consola.
Agrandar todo control de 28px cambiaría un defecto de alcance por uno de layout, de modo que el área de
impacto crece mientras el control conserva su tamaño dibujado:

**El alcance son los controles que son pequeños en ambas dimensiones.** Un control *ancho* — un botón
rotulado, o cualquiera de los botones de 32px de alto de la consola, que es la altura propia de antd en todas partes — se puede apuntar
incluso siendo bajo, de modo que conserva su caja. Exigir 40px de altura a todo botón sería
afirmar un cambio que el sistema de diseño deliberadamente no hace.

| Situación | Tratamiento |
| --- | --- |
| Botones de icono y los controles densos propios de la consola — `.config-key-action`, la variante solo-icono de antd, el botón de cierre del panel lateral, los pasos de paginación, la affordance de borrado | `::before { inset: -4px }` bajo `(pointer: coarse)`, dejando ~3px de holgura más allá de la caja dibujada una vez contado el borde de 1px |
| Pestañas y elementos segmentados, que se sitúan borde con borde | crecen solo en el eje vertical — un inset horizontal robaría los toques del vecino |
| `Switch` (40×22, o 32×18 en filas) | crece a 44×24: se sitúa junto a otros controles de la fila, de modo que el suelo son dimensiones reales y no un inset |
| Pasos de los campos numéricos (medidos 1×19px) | ocultos: un control que un dedo no puede pulsar es peor que uno ausente, y el teclado numérico permanece |
| El redimensionador de columnas de la lista de solicitudes | oculto: un arrastre cerca del borde de una cabecera significa «desplazar», nunca «redimensionar una columna» |
| Un grupo de acciones cuyo hueco es inferior a 8px | el hueco se ensancha, de modo que dos insets de 4px se encuentran en lugar de solaparse |

**La lista de selectores es una superficie de mantenimiento, y su modo de fallo es silencioso.** La primera versión nombraba
solo la variante solo-icono de antd, lo que dejaba fuera los controles densos propios de la consola — los botones de revelar,
copiar, editar y desbordamiento de la lista de claves son `<button>` simples, de modo que nunca recibieron un área de impacto. Lo
que los encontró fue que la métrica de la sonda del navegador se ajustó para aceptar solo el control y sus
descendientes: la métrica más laxa había contado a un *ancestro* como impacto, que es exactamente donde cae un punto justo
fuera de un botón sin expandir. Un control añadido a la lista debe tener tamaño de icono; añadir uno ancho
robaría los toques de su vecino.

El costo se enuncia en lugar de ocultarse: en un grupo de acciones cuyo hueco es de 4px, dos insets de 4px adyacentes
se solapan 4px y el control posterior en el DOM gana esa banda. Se acepta porque la
banda es más estrecha que el área de contacto del dedo para la que existe el inset, y porque esos grupos
reespacian sus acciones cuando su superficie gana un layout de fila de teléfono.

### 16px es el suelo del foco

iOS Safari hace zoom de toda la página cuando el tamaño de fuente de un campo enfocado es inferior a 16px, y el tamaño
base del sistema de diseño es 14px — así que todo control de texto de la consola lo provocaba. El zoom es el
arreglo del navegador para un campo ilegible, por lo que cambia el *campo*, no la escala de la página: bajo
`(pointer: coarse)` todo control de texto enfocable toma `font-size: 16px`.

La declaración lleva `!important`, lo cual es deliberado y no pereza. antd inyecta los estilos de sus
componentes en el documento en tiempo de ejecución, después de la hoja de estilos, de modo que una regla de igual
especificidad pierde por orden de fuente; y los propios contenedores de campo de esta hoja de estilos vuelven a elevar la especificidad por encima
de ella. Los contenedores de la consola ya no repiten el token de 14px (la regla de componente de antd
ya lo aplica, de modo que el escritorio no cambia), y lo que queda es un suelo a nivel de dispositivo que
está pensado para prevalecer sobre la capa de componentes.

El texto *mostrado* de un Select se deja deliberadamente en su tamaño de token. El navegador lee el
tamaño del elemento que enfoca, y ese es el campo de búsqueda del control, no su etiqueta; agrandar
también la etiqueta cambiaría la densidad de la consola por un zoom que ya está evitado.

El zoom por pellizco nunca se desactiva. `maximum-scale=1` y `user-scalable=no` están ausentes a propósito,
porque el doble toque y el zoom por pellizco son como un lector agranda una tabla densa.

### Herramientas de teléfono centradas en el contenido

A `640px` y por debajo, la cabecera de la carcasa es una sola fila de 48px (`--app-header-height`; 52px por encima):
navegación, el nombre de la página actual con puntos suspensivos, refrescar y un disparador More rotulado. El menú de herramientas, que se abre con un clic, muestra el tema e idioma actuales,
el repositorio y el cierre de sesión; el modo demo conserva su marcador y sus restricciones de escritura. Las filas del menú miden al menos
44px de alto. Back o Escape descartan el menú y restauran el foco de su disparador; una acción que abre un
modal da el foco a ese modal. El punto de corte de hoja de navegación de `900px` no cambia.

`PageHeader.mobileActions` elige explícitamente las acciones principales del teléfono y un `ActionMenu` para las herramientas
secundarias; las `actions` de escritorio no cambian. **La barra superior nombra la página, así que la página no la repite**
(ADR 0096): el `h1` permanece en el documento para el esquema y la tecnología de asistencia y no se
dibuja, un subtítulo en vivo y las acciones ocupan su fila, y una cabecera que solo contenía el título no ocupa
espacio. El contenido tiene 12px de relleno horizontal, y los huecos de página/cabecera/tarjeta usan la escala
existente de 8/12/16px.

**Los recuentos y mosaicos conservan su fila.** `StatTiles` sigue siendo una tira de mosaicos más estrechos, con una etiqueta demasiado
larga para su mosaico recortada en lugar de ajustada. La cuadrícula del panel conserva dos columnas y sus mosaicos anchos
abarcan ambas. Los controles de una fila de lista comparten la línea de su titular cuando caben ambos y pasan a una línea
propia, aún en el borde final, cuando el titular necesita el ancho. Una credencial OAuth son
cuatro líneas: identidad, estado y su interruptor, tráfico y las herramientas del registro, la lectura de cuota.

**Los filtros de solicitudes son dos filas.** La búsqueda y la entrada al panel de filtros completo ocupan la primera.
La ventana, el veredicto, las facetas de modelo y proveedor, la agrupación y la vista de modelo son una sola
tira que se desliza dentro de sí misma y sangra hasta el borde de la página, de modo que un control cortado por el borde
dice que hay más en esa dirección. La cabecera de la página es una fila de estado y herramientas: autorrefresco, el veredicto
de ingesta (el único elemento que cede), el conmutador de pliegue y refrescar. Los límites de la ventana no se
imprimen junto al control de ventana que ya los enuncia. La lista llega hasta los bordes de la pantalla. Los filtros adicionales de proveedor y auditoría usan
`FilterDisclosure`, cuyo resumen mantiene visible el estado seleccionado. Las listas de filas adaptables existentes,
la inercia de la lista de solicitudes y la propiedad del desplazamiento de la conversación permanecen sin cambios. El marco de conversación compartido acota su altura de teléfono al viewport utilizable, manteniendo el campo de entrada y Send sobre el teclado de software.

La barra de herramientas de configuración del teléfono no es fija: el estado y el modo comparten una fila, la búsqueda visual tiene
la suya, y la copia de seguridad y la recarga viven en el menú de herramientas. La navegación por categorías conserva el
desplazamiento horizontal local. Los títulos y descripciones de grupo permanecen; se omite el encabezado redundante de categoría. Solo un
borrador modificado muestra la `ConfigDirtyBar` inferior; su altura medida reserva espacio de contenido para que el
último campo siga siendo alcanzable. La validación, la confirmación única y el comportamiento ante conflictos de revisión siguen a cargo
del flujo de borrador/guardado.

### El editor de código fuente también es una superficie de teléfono

Monaco renderiza texto y widgets con DOM y posee por sí mismo la geometría de ajuste de línea, medianil y desplazamiento.
Configure esas opciones mediante la API del editor en lugar de intentar forzarlas con CSS.

| Opción | En un teléfono | Por qué |
| --- | --- | --- |
| `fontSize` / `lineHeight` | 16 / 24; escritorio 13 / 21 | Legibilidad y el suelo de foco de entrada de iOS |
| `wordWrap` | `on` por defecto; conmutador visible | Las URL largas y la sangría deben seguir siendo legibles; desactivarlo desplaza solo el editor |
| `lineNumbersMinChars` | 2 | Conservar la identidad de línea sin un medianil del ancho de escritorio |
| Plegado, decoraciones, minimapa, regla de vista general y guías de sangría | desactivados | Preservar la columna estrecha de texto |
| `wrappingIndent` | `none` | Las continuaciones no deben heredar una columna con sangría profunda |

Buscar, ajustar y la edición enfocada son acciones directas. Formatear, copiar y estadísticas viven en el menú de herramientas
de código fuente del teléfono; los atajos de escritorio permanecen en el escritorio. Una elección manual de ajuste dura toda la sesión
de código fuente, incluidas la rotación y los cambios de foco; salir de Source la restablece. Sin una elección manual,
el valor predeterminado sigue el punto de corte actual de teléfono.

La edición enfocada fija el **mismo contenedor de código fuente** dentro del viewport utilizable en lugar de montar
otro editor. El borrador, la pila de deshacer, la selección y el desplazamiento sobreviven a la entrada y la salida. Los hermanos
de la aplicación en segundo plano pasan a inertes; los portales de diálogo a nivel de body siguen siendo utilizables. Back sale del foco tras cerrar cualquier
menú interno, confirmación o diálogo de conflicto. El botón de entrada recupera el foco tras salir.
`useVisibleViewport` sigue el redimensionado del teclado y el paneo del cursor mediante los eventos resize/scroll de `visualViewport`,
con respaldo al viewport de layout y el zoom por pellizco dejado al navegador. El editor y las acciones de borrador modificado caben
dentro de esos límites; sus observadores y listeners son propiedad del efecto y se limpian bajo StrictMode.

### Una hoja se desliza opaca

antd inicia el panel de un drawer al 70% de opacidad y lo desvanece hacia dentro durante el deslizamiento. En un teléfono una hoja tiene
el ancho de la pantalla, de modo que la página que cubre sigue siendo legible a través de ella durante todo el deslizamiento: dos
capas de texto en una misma superficie. Las dimensiones del contenedor del Drawer se actualizan de inmediato; solo transform
hace transición normalmente, y el movimiento reducido desactiva por completo la transición del contenedor. La opacidad del panel se mantiene en 1 para todo drawer, y la máscara
conserva su desvanecimiento. Un panel que se va sigue dibujando lo que contenía: el panel de detalle de solicitud
recuerda el registro que mostró, de modo que lo que sale es el registro y no una hoja vaciada.

### El viewport no es un rectángulo fijo

- `viewport-fit=cover` se declara en `web/index.html`, que es lo que hace que
  `env(safe-area-inset-*)` se resuelva en absoluto. Los insets se aplican al chrome que toca el borde de una
  pantalla (cabecera, carril, hoja), nunca a un contenedor de desplazamiento — un desplazable con un inset
  inferior desplaza su propia última línea fuera de debajo de sí mismo.
- Las alturas que deciden cuántos datos caben usan `dvh`, no `vh`: la barra de URL móvil cambia
  `100vh` continuamente, de modo que una cola de registros dimensionada en `vh` crece y se encoge bajo el lector mientras
  este se desplaza. `vh` permanece primero en cada par como respaldo.
- `touch-action: manipulation` se aplica a los controles, donde elimina el retraso del doble toque
  que el lector siente como lag. Deliberadamente *no* se aplica a la página.

### Back descarta la superposición, y es el Back propio de la plataforma

La consola no implementa un gesto de deslizamiento, y la razón no es el esfuerzo. iOS Safari y
el back predictivo de Android ya poseen los bordes de la pantalla: un deslizamiento de borde en JavaScript pierde el
gesto frente al navegador o pelea con él, y solo puede seguir al dedo de forma aproximada. El
Back de la plataforma es nativo, de modo que unirse a él significa que el botón de hardware, la flecha atrás del navegador y
el gesto de borde descartan una superposición a la tasa de fotogramas nativa sin nada que reconciliar.

**El contrato.** Toda superposición de clase Drawer o Modal es una entrada de historial. Abrirla empuja una
entrada que conserva la misma URL y la contabilidad propia del router, marcada con el id de la superposición;
el Back de la plataforma extrae esa entrada, y la extracción descarta la superposición más alta. La ruta nunca
cambia, de modo que Back sobre una superposición abierta no puede navegar. `useOverlayHistory`
(`web/src/hooks/useOverlayHistory.ts`) es todo el cableado, y su política vive en
`web/src/hooks/overlayHistory.ts`:

```tsx
useOverlayHistory({ isOpen, onClose });
```

**El límite es Drawer y Modal.** Los popovers, dropdowns, selects y tooltips no son
superposiciones: los abre un clic que también dice para qué sirven, se cierran con el mismo
gesto que los abrió, y dar a cada uno una entrada de historial haría que Back recorriera la
barra de herramientas en lugar de la página.

Cuatro consecuencias están previstas en el diseño y no descubiertas, y cada una está fijada por
`scripts/test-overlay-history.ts` y el escenario de navegador `overlay-back`:

| Situación | Comportamiento | Por qué |
| --- | --- | --- |
| Ocurrió una navegación del router después de abrir la superposición | El centinela se abandona, no se consume | Las entradas de historial no pueden eliminarse, de modo que consumirlo recorrería la entrada que acaba de escribirse - el Apply del panel de filtros cerrándose sobre sus propios filtros |
| La superposición se cierra con su propia UI | Su centinela se consume, de modo que no queda ninguna entrada muerta | De lo contrario el siguiente Back del lector se gasta en una entrada que no contiene nada |
| La página de la superposición se desmonta mientras está abierta | El centinela se abandona en su lugar | Una entrada muerta cuesta como mucho una pulsación de Back y nunca una navegación equivocada |
| La superposición se niega a cerrar (una confirmación de edición sin guardar) | Su centinela se rearma | Sin esto el siguiente Back sacaría al lector de la página dejando un editor abierto |
| El lector va *hacia adelante* tras un Back | No se reabre nada | Una pulsación hacia adelante se gasta; reabrir superposiciones con ella resucitaría un diálogo que el lector descartó |

`prefers-reduced-motion` no interviene: la plataforma posee la animación, que es una razón más
para que este sea el mecanismo correcto y no un gesto en JS.

### Qué es un layout de teléfono

Un layout de teléfono es una segunda *representación* de una lista, nunca una segunda lista. El conjunto de datos, los
filtros, la URL y las acciones son los mismos; solo cambia la disposición, y lo que la cambia es el ancho
— nunca un control que el operador tenga que encontrar, y nunca un modo que haya que
recordar. El ADR 0012 registra el umbral, su medición y sus alternativas.

## 9. Lista de verificación para nueva UI
- [ ] Colores solo mediante la paleta resuelta / variables CSS; los colores semánticos llevan significado
- [ ] Una *relación* entre dos colores (un paso de hover, un divisor, la superficie sobre la que se asienta un tooltip) es
      parte de la derivación en `web/src/theme/palette.ts`, no un literal en un componente ni una segunda
      fórmula - la paleta propia de un operador tiene que heredarla
- [ ] Una escala continua (tasa de caché) se lee de sus propios tokens, nunca de un hex
      por componente, y se mantiene ≥ 4,5:1 frente al relleno de su propia insignia
- [ ] Sin degradados; una sombra solo en una capa invocada; esquinas de la escala 2 · 6 · 8 · 12, un paso por debajo del marco
- [ ] Tipografías solo de los roles: `--font-ui` para nombres, prosa y cifras, `--font-mono` para identificadores, claves, rutas y código (nunca una nueva font-family)
- [ ] La página abre con `PageHeader`; un refresco es `RefreshButton`; un estado es `StatusLabel`; una lista es `ResponsiveList`
- [ ] El resultado de una acción es un toast de `useToast`; una lectura fallida es un `LoadFailure` con Retry en el lugar de la región; una condición es un `Notice` (§5, Superficies de retroalimentación)
- [ ] Un solo título de página; subtítulos solo con datos en vivo; sin traducciones duplicadas
- [ ] Posición de navegación marcada con una regla-marca izquierda de 2px `--fg`, no un bloque relleno ni un color semántico
- [ ] Los ajustes y la gestión favorecen listas de sección abiertas sobre contenedores de tarjeta pesados
- [ ] Tarjetas reservadas para KPI, resúmenes y comparaciones entre pares
- [ ] Un control de encendido/apagado es `Switch` de `components/common/Switch`, nunca el de antd (§5, Switch)
- [ ] Estado mostrado con indicador + texto, nunca solo con color
- [ ] Números tabulares; los estados vacíos dicen qué falta (sin datos falsos ni marcadores inventados de espacio de trabajo o cuenta)
- [ ] Un nombre es una etiqueta, no una identidad: renombrar nunca cambia lo que selecciona un filtro, y un valor sin nombre recurre a algo reconocible en lugar de un hash
- [ ] Todo recuento enuncia su ventana y su fuente; una observación ausente nunca se renderiza como un cero o una fecha fabricados
- [ ] «Nada que mostrar» distingue sus motivos: bloqueado (no puede servirlo),
      cargando (aún sin respuesta), vacío (una fuente en vivo sin nada). Un
      mensaje compartido hace que una página que funciona parezca rota.
- [ ] La rueda desplaza solo la columna sobre la que está el puntero; la página nunca se desplaza en todo el body
- [ ] Nada es alcanzable solo con hover: una regla de revelar al pasar el puntero lleva una contraparte `(hover: none)`
      (§8)
- [ ] Un control que un dedo debe pulsar mide al menos ~40px tras su área de impacto, y un control de texto enfocable mide
      al menos 16px; ambos se logran sin cambiar el tamaño dibujado (§8)
- [ ] Un nuevo umbral es uno de los dos puntos de corte de viewport o una consulta de contenedor sobre la caja de la que
      trata realmente el layout, y enuncia cuál (§8)

### Agrupación de proveedores en Cost & Usage

El libro de precios usa los tokens existentes de la consola y las primitivas de tabla y fila de teléfono. Los encabezados de proveedor llevan la marca compartida del proveedor y su nombre visible, el tipo de autenticación y la prioridad de enrutamiento; las filas de modelo llevan identidades de texto y acciones de precio en línea. Una única página global de 20 filas acota las pertenencias renderizadas entre grupos. Un único pie fijo muestra el rango de entradas visible y la navegación de páginas; los teléfonos usan un indicador de página compacto de solo lectura con objetivos anterior/siguiente de 40px. La búsqueda y los filtros de proveedor/modo permanecen sobre la lista, con el control de sincronización en la cabecera de la página. El selector de modelos upstream usa páginas acotadas de 12 filas. No se introducen nuevos tokens de paleta, tipografía, espaciado ni movimiento.

### Selector de zona horaria

El `TimeZoneSelect` compartido sigue las filas de ajustes y los tokens de color existentes de la consola. El valor seleccionado nombra la zona IANA real. Las opciones usan dos columnas alineadas: un nombre de zona con ajuste de línea a la izquierda y un desfase UTC tabular alineado a la derecha. La zona del servidor se fija primero con una etiqueta secundaria localizada de origen bajo su nombre. El campo y el popup comparten ancho, limitado por el viewport; los layouts estrechos usan el ancho completo de la fila de ajustes. La descripción es solo «Used for timestamps and calendar-day totals.».

La lista usa filas virtuales fijas de 64 píxeles, con espacio reservado para el indicador de selección en todas las filas para que los desfases no se desplacen al seleccionar. La búsqueda acepta nombres de zona/ciudad, espacios en lugar de guiones bajos y desfases UTC. Las etiquetas de desfase reflejan la fecha actual, incluidos los desfases fraccionarios y el horario de verano. La tipografía, la paleta y los tokens de movimiento existentes no cambian.

### Etiquetas de tiempo transcurrido en vivo y Stop

La actividad del Agent y las filas de capacidades en ejecución usan etiquetas `LiveElapsed`
aisladas. Un reloj de fotogramas de animación compartido, solo visible, cuantiza los milisegundos a 10ms y los segundos
a 0,1s; una instantánea formateada de almacén externo limita los renderizados de etiquetas a escala de segundos a 10Hz sin
volver a renderizar la página ni la transcripción. Los documentos ocultos y las etiquetas asentadas no programan fotogramas.
Stop es la ranura de envío del compositor con un glifo cuadrado (véase «El compositor es una sola puerta»); usa los
tokens existentes `--accent-hover` / `--accent-on` y ninguna sombra. Esto cambia el uso de componentes, no la paleta ni el mapeo de tokens.

### Selector de icono personalizado

El modal de iconos existente tiene los segmentos Built-in y Custom. El catálogo integrado conserva sus filtros de categoría y la carga diferida de ilustraciones. La cabecera de la biblioteca empareja su título/recuento con Add icon; las cabeceras del editor emparejan Back con el título de la acción. La biblioteca personalizada tiene búsqueda por nombre, estados vacío/búsqueda vacía a ancho completo y tarjetas de ilustración con objetivos separados de selección, edición y borrado. Los formularios nuevo/editar sustituyen la cuadrícula dentro del mismo modal: una fuente con nombre de archivo/Base64 se sitúa junto a una vista previa de espécimen a 64px y una vista previa de lista de proveedores a 24px, con un único pie de guardado. Las importaciones de archivo admiten un botón de elegir accesible por teclado y arrastrar y soltar; solo una ilustración validada por el servidor habilita el guardado. La vista previa se convierte en un panel compacto apilado en pantallas estrechas, y el cuerpo del modal se desplaza dentro del viewport. Guardar vuelve a la biblioteca sin asignar el icono. Borrar abre una vista de confirmación dedicada con la ilustración, el recuento de referencias y el impacto del restablecimiento predeterminado; Cancel recibe el foco inicial, y el borrado confirmado elimina el recurso y restaura cada asignación a su valor predeterminado o marcador. Al volver de editar o borrar se restaura el foco en Add icon. Las escrituras en curso impiden descartar y cambiar de pestaña. El modal conserva su capa explícita sobre el panel lateral de proveedores. La paleta, tipografía, espaciado y tokens de movimiento existentes no cambian.

### Superficie de inicio de sesión

`web/src/components/common/AuthGate.tsx` sigue la columna única centrada con la que inician sesión la mayoría de las consolas de operador
(Cloudflare, Vercel, Grafana). Es una columna de 360px sobre el `--bg` propio de la página: sin tarjeta,
sin textura, y sin regla bajo la cabecera de 56px, que contiene solo los menús de tema e idioma a la
derecha. La columna contiene el wordmark de 28px, centrado (el único dibujo de la marca en la página, decorativo
porque el título también nombra el producto), el título de 22px/700, centrado, el campo de clave rotulado y
un botón primario de ancho completo, ambos en el tamaño grande de antd (40px). No hay antetítulo, subtítulo ni
nota al pie. La etiqueta del campo ya dice qué introducir, y la regla 2 de §3 prohíbe una línea que la repita
o que instruya. Una clave rechazada permanece en línea como un `Notice` sobre el campo. La comprobación de sesión dibuja el esquema de la
columna como marcadores con la geometría propia del formulario. La comprobación de sesión y la solicitud de inicio de sesión
dibujan la barra de progreso aproximado con su actividad de espera a lo largo del borde superior de la página.

### Superficie de recuperación de error de ruta

`web/src/components/common/RouteErrorPage.tsx` usa el wordmark de 22px consciente del tema de la consola
y el indicador de peligro de `StatusLabel` sobre una tarjeta plana de Ant Design. El
encabezado reutiliza `terminal-title`; el texto de lectura usa la escala de cuerpo de 13px de la consola,
con bloques de diagnóstico monoespaciados de 12px. El relleno de la tarjeta, el borde, el radio pequeño, el
fondo, la escala de primer plano y el espaciado de acciones reutilizan el sistema actual de la
consola. La acción primaria de recarga alineada a la derecha va al final, después del ancla
al panel. No hay mapeos de paleta ni de tokens específicos de la página de error.

`PanelTitle`, `FactList` y `CopyButton` poseen la cabecera de diagnóstico, las filas de metadatos
y la interacción de copia. El tipo de error, la ruta, la compilación, la hora UTC de ocurrencia y el estado
HTTP opcional permanecen visibles junto al mensaje de error redactado; un control details nativo
revela la traza seleccionable. El código se ajusta y se desplaza dentro de su región.
En teléfonos las acciones se apilan con áreas de impacto de 44px, y los controles de copia/detalle conservan el
mismo suelo táctil. El foco del encabezado y el título de documento localizado identifican la página fallida
para usuarios de teclado y de lector de pantalla. El texto de recuperación y diagnóstico está
disponible en chino simplificado, chino tradicional, inglés y malayo.

### Comparación de versiones del sistema

La tarjeta Versions & Updates es la primera fila de la página y abarca todo su ancho. Una fila de producto es
identidad, comparación, estado y acciones a la vez, y una celda de medio ancho ajustaba cada una de
ellas; la columna completa es lo que permite que cada producto ocupe dos líneas tranquilas en lugar de cuatro apretadas.
La tarjeta mantiene dos filas de producto separadas por una única regla.

Cada fila se abre con la identidad del producto y su repositorio junto a un estado semántico conciso. Debajo,
las versiones en ejecución y la última publicada forman una comparación compacta, acotada a 320px con un
divisor vertical discreto. La etiqueta de versión aparece en la comparación, no de nuevo en el estado.
Los tokens existentes `--fg` y `--fg-2` llevan versiones y etiquetas; solo un destino de actualización conocido usa
`--accent`. En pantallas estrechas la comparación pasa a dos filas etiqueta/valor, con las etiquetas de compilación largas
ajustándose dentro de su propia columna.

Las acciones finales de la fila son un grupo en el borde derecho de la fila: la acción de registro de cambios en su
forma de botón de texto de 32px con un icono de documento, una etiqueta localizada y un recuento atenuado de versiones reales;
un conmutador **Ignore this version** antes de ella cuando existe una versión más nueva conocida, en la misma forma de
botón de texto de 32px con un icono de campana; y, al final, el único control relleno de la fila - la acción de actualizar -,
de modo que la acción primaria se sitúa en el mismo borde derecho que toma la acción primaria de la propia página. La
etiqueta del conmutador de ignorar nunca cambia: el estado pulsado es la campana tachada, tinta `--fg` y
`aria-pressed`, y el resultado de cada pulsación es un toast, de modo que ni la fila ni la tarjeta se mueven
cuando se usa. Está deshabilitado hasta que se han leído los descartes almacenados.

Un reemplazo en curso dibuja las cuatro etapas del actualizador - descarga, parada, arranque,
verificación - como una barra de cuatro segmentos bajo las lecturas, con la frase de la etapa a su lado. La
barra lleva el recuento de pasos, no un porcentaje medido: las etapas son conocidas y ordenadas, sus
duraciones no. Un producto que el actualizador no reemplazará desde la página expone su motivo en una línea
discreta bajo las lecturas, marcada con un glifo de información en lugar de un tono de advertencia,
porque una imagen fijada o un contenedor que se ejecuta en otro lugar es una decisión del operador y no un
fallo. Las explicaciones largas de la comparación van bajo las lecturas y no en la ranura de estado.

Una pista de notas ausentes pertenece solo a un rango de registro de cambios conocido; un feed vacío o sin comprobar
no adquiere una segunda advertencia sobre notas. Una comprobación fallida conserva las lecturas y muestra su
motivo y, cuando está disponible, la hora de la última comprobación exitosa. El registro sigue siendo un Drawer y las imágenes
remotas siguen siendo enlaces, nunca medios descargados automáticamente. El paso de configuración que habilita las actualizaciones de un clic
permanece dentro de esta tarjeta, bajo las filas que explica, y toma su cabecera de
`SectionHeading`. Son disposiciones a nivel de página que usan los tokens visuales existentes, no nuevos
mapeos de tema.

### Indicador de actualización

Una versión disponible y no descartada marca la entrada de navegación System Information con un punto `--warn`
de 6px justo fuera de la esquina superior final de su icono. Va sobre el icono porque
es la única parte de una entrada que conservan el carril expandido, el carril contraído y la hoja de teléfono.
El punto no se anima y no añade ningún control al carril; el nombre accesible de la entrada
gana «Update available». Es el tono de advertencia usado como estado, no como decoración:
dice que el despliegue va por detrás de una versión publicada.

### Tarjetas de estado de la información del sistema

Bajo la tarjeta de versiones, mantenimiento, almacenamiento y salud de componentes se sitúan en una fila - tres tarjetas
pares que comparten la columna, pasan a menos columnas antes de que sus propias lecturas queden comprimidas,
y se apilan en una sola columna por debajo del punto de corte de 900px. Presentan sus lecturas seleccionadas
de inmediato. Los títulos de las tarjetas se ajustan en pantallas estrechas, y estas disposiciones usan los tokens
de tema existentes y la respuesta del sistema sin solicitudes de API adicionales.

Mantenimiento empareja tres nombres de acción cortos con explicaciones de una frase y los botones antd
con contorno estándar de la consola. Las dimensiones, tipografía, borde, fondo y estados de
interacción de los botones heredan la configuración compartida. Los rechazos de admisión sustituyen la explicación
ordinaria; los resultados en ejecución, fallidos y parciales permanecen explícitos. VACUUM requiere confirmación
de la puerta de escritura exclusiva y de los requisitos de disco medidos. Los resultados completados son descartables de forma
independiente; el trabajo en ejecución no.

Almacenamiento prioriza la huella física total sobre una única lista compartida de etiqueta/valor. Los tres
tamaños de archivo medidos, el modo de journal y la generación del esquema comparten columnas idénticas de etiqueta y valor
alineado a la derecha en todo viewport. Los archivos ausentes se leen «not present» en lugar de cero. La huella
física no se repite como páginas asignadas ni recuentos de registros; la geometría interna, las páginas reutilizables
y los ajustes de conexión pertenecen al paquete de diagnóstico saneado.

La salud de componentes tiene cuatro filas divididas, cada una con un nombre de componente, un estado semántico y un
breve resumen operativo en línea. El gateway muestra su recuento de credenciales, Shell-PAMC su antigüedad de inicio
y su memoria, SQLite su recuento de solicitudes, y el recolector la antigüedad del último uso. Cada resumen
usa como máximo dos datos emparejados, con etiquetas junto a valores en lugar de cuadrículas de métricas separadas.
El atraso de ingesta positivo y los huecos de recolección aparecen como lecturas de advertencia; los valores cero saludables
no consumen espacio. Las observaciones ausentes permanecen explícitas.

### Directorio Model Square

Model Square responde una pregunta: qué nombres de modelo puede llamar un cliente ahora mismo. El
subtítulo de la cabecera lleva solo datos en vivo: el recuento de modelos, el recuento de fabricantes y la fuente y fecha
de la instantánea de referencia. Una barra de herramientas contiene el campo de búsqueda (nombres, fabricantes e identidades
de modelo conocidas). Una tira de chips de fabricante, cada uno con su marca y un recuento, filtra por un fabricante; sus
recuentos siguen a la búsqueda, de modo que un recuento es lo que mostrará seleccionar el chip. Un filtro activo
expresa «mostrados de total» y ofrece una única acción de borrado. La búsqueda y el fabricante viven en la URL.

Los fabricantes son secciones abiertas bajo una regla de encabezado. Los fabricantes con nombre se ordenan alfabéticamente; el
grupo de varios fabricantes (un alias compartido que abarca varios fabricantes) y el grupo no identificado los siguen.
Dentro de una sección cada nombre de modelo de cliente es una tarjeta compacta sobre `--surface` con un
`--border` de 1px y el radio de 8px - la esquina de los mosaicos del panel con la densidad de un directorio - y las
tarjetas llenan el ancho de la sección en tantas columnas como quepan (280px mínimo, `auto-fill`, huecos de 12px): un modelo aquí es un
nombre, un precio y una conexión, lo cual es muy poco para justificar una línea de ancho completo. Una tarjeta contiene
solo aquello sobre lo que actúa el operador: el nombre de llamada con su nombre visible de referencia como leyenda
debajo, luego una línea con el precio (entrada / salida; la unidad por 1M de tokens se enuncia una sola vez,
en los detalles) a la izquierda y la conexión que lo sirve a la derecha. Una conexión se nombra; varias
se colapsan en hasta tres de sus marcas y un recuento («3 connections»), de modo que toda tarjeta conserva
la misma altura, y los detalles listan cada una de ellas. Las especificaciones de
referencia - límites, capacidades, apertura - y las cifras de uso no se dibujan en la lista;
pertenecen a los detalles.

El nombre de llamada es en sí el control de copia: al hacer clic se copia exactamente la cadena que envía un cliente,
y el glifo a su lado se convierte en una marca de verificación `--success` durante 1,5s. Todo lo demás de la
tarjeta abre los detalles, de modo que la tarjeta tiene dos objetivos y ningún espacio muerto; el hover eleva su
borde a `--fg-2` sobre `--hover`. Un modelo sin precio muestra un estado `warn` que dice
«Set price» en la posición del precio, que abre el editor de precios compartido en el lugar. El directorio
no muestra ningún aviso a nivel de página sobre modelos sin precio: resumir el libro de precios es tarea de Cost & Usage.
Un precio que no pudo leerse se deja en blanco - nunca se dibuja como sin precio.

El número de columnas sigue el ancho propio de la sección sin punto de corte: tres o cuatro columnas en
un escritorio, una en un teléfono. En teléfonos el nombre y el chevrón de detalles son objetivos táctiles de 44px,
los nombres largos se ajustan dentro de la tarjeta, y la tira de fabricantes se desplaza dentro de sí misma para que la página nunca
se mueva lateralmente.

Un fabricante con ilustración de marca la muestra. Los dos grupos que no son un fabricante dibujan el glifo Lucide
propio de la consola (un cubo para no identificado, capas para varios) con trazo de 1,5px en `--fg-2`,
enmarcado por un `--border` de 1px, `--surface` y el radio de 6px cuando la marca mide 20px o más;
las marcas más pequeñas son el glifo desnudo en `--muted`. Se leen como chrome junto a la ilustración, nunca
como otra marca. La entrada de navegación usa el glifo de cajas, distinto de la cuadrícula del panel.

Los detalles son un Drawer compatible con Back y acotado al viewport, titulado con el nombre del cliente, con copiar
junto al título. Se abre con Cost & Usage: tres mosaicos (precio de entrada, precio de salida, solicitudes
en 24 horas - la única ventana que usan todas las cifras de uso de esta página), luego la acción de precio - «Set price» primario para un
modelo sin precio, «Edit price» predeterminado en caso contrario - y un enlace a la lista de solicitudes acotada a este nombre de llamada
durante las mismas 24 horas. El editor de precios se apila sobre el Drawer y un Back lo cierra
solo. Debajo, el Drawer nombra las conexiones que sirven el modelo (el nombre upstream cuando
difiere), y luego da a cada modelo distinto su propio perfil de models.dev (las conexiones que llegan al mismo
registro de origen con nombres upstream distintos comparten uno): tres mosaicos de
límite (contexto, salida, entrada), un grupo de capacidades (modalidades, razonamiento, herramientas, salida
estructurada, adjuntos) y un grupo de publicación (apertura, licencia, lanzamiento, corte de conocimiento,
fecha de metadatos). La apertura es uno de tres términos: modelo de código cerrado, modelo de pesos abiertos (los pesos
están publicados), modelo de código abierto (los pesos están publicados bajo una licencia
de código abierto reconocida). Una capacidad admitida lleva una marca de verificación `--success`; una no admitida y todo campo
omitido se dibujan en `--meta`, de modo que lo conocido destaca y lo desconocido queda
explícitamente enunciado. Los enlaces de pesos, los enlaces de origen y las búsquedas en models.dev, OpenRouter y pi.dev
son botones de enlace con borde que abren una pestaña nueva con protección opener/referrer. El
pie pasa al modelo anterior o siguiente de la lista filtrada sin cerrar el Drawer;
un Back sigue descartándolo. La nota de origen y la fecha de la instantánea cierran el Drawer. Se reutilizan los iconos locales
y los tokens existentes de paleta, tipografía, espaciado y movimiento sin nuevos tokens globales
de diseño.

### Reglas de modelo de OAuth

La acción Model rules del espacio de trabajo OAuth abre un Drawer acotado al viewport y
compatible con Back. La acción de cierre se sitúa en el borde final de la cabecera, manteniéndola alcanzable
junto a los acuses de guardado centrados; el Drawer de detalle de credencial usa la misma
ubicación de cierre. Su selector de proveedor usa los mismos nombres visibles y marcas de marca locales que
las pestañas de proveedor, incluida la ilustración publicada por plugins, conservando la clave de CPA
como valor seleccionado. La búsqueda acepta tanto el nombre visible como la clave. Las opciones
llevan los recuentos de alias y exclusiones guardados; el selector cerrado muestra solo la
identidad del proveedor. Los proveedores desconocidos conservan una marca neutra y un nombre legible.

Dos pestañas de sección a ancho completo muestran alias y exclusiones con sus recuentos de borrador
y un indicador de sin guardar. Cada sección guarda o revierte de forma independiente, y la selección de
proveedor permanece deshabilitada mientras cualquiera tenga ediciones. Cerrar o el Back nativo preguntan
antes de descartar borradores. Los alias usan el catálogo del proveedor como sugerencias de origen,
mantienen la entrada manual y establecen por defecto que los nuevos mapeos conserven el modelo original (`fork`).
Las exclusiones usan filas de casillas abiertas, acciones masivas de catálogo con búsqueda y una lista
aparte para IDs escritos y reglas con comodines. Una fila cubierta por un comodín identifica su regla
y no puede desmarcarse salvo que exista su propia regla exacta; la regla comodín total avisa
de que todos los modelos quedan excluidos solo en las credenciales que heredan los valores predeterminados del proveedor.
Las listas de credencial no vacías sustituyen esos valores predeterminados; vaciar una lista de credencial
restaura la herencia. Las advertencias de alias y las confirmaciones de borrado de reglas de proveedor
acotan sus afirmaciones en consecuencia y dejan la disponibilidad a CPA. El pie mantiene Clear, Revert y Save alcanzables
en un teléfono. Se reutilizan los tokens existentes de paleta, forma, tipografía y movimiento.

### Políticas de credencial, importación de Vertex y herramientas de registro del gateway

La pestaña Configuration de la credencial edita alias de modelo locales de la credencial como entradas
apiladas: nombre de origen, alias de llamada y nombre visible comparten un grupo, con los controles de conservar el original
y forzar el mapeo debajo. Usa el borrador de configuración protegido existente;
los mapeos OAuth de todo el proveedor siguen siendo un editor aparte. El diálogo de importación de Vertex
muestra el proyecto y la dirección de cuenta del archivo de cuenta de servicio seleccionado antes de importar,
con el campo de región y la consecuencia de reemplazo visibles. El contenido de la clave nunca se
renderiza ni se retiene en las variables de mutación en caché; cerrar también invalida una lectura
de archivo sin terminar para que no pueda restaurar la selección cancelada.

La barra de herramientas del registro del gateway mantiene en su primera fila la búsqueda, el nivel, el recuento de filtros adicionales, el recuento de filas
y las acciones. La clase de estado, el método, la ruta y la visibilidad del tráfico de gestión
pertenecen a su panel de filtros desplegable. Las opciones de método y ruta muestran recuentos de faceta;
el ajuste de línea es una preferencia de visualización persistente. La pantalla completa mueve el mismo visor de registro
sobre el chrome de la página sin sustituir su cola ni su estado de desplazamiento. Escape sale de la pantalla completa solo cuando no hay selector ni confirmación abiertos. En teléfonos los
controles se ajustan dentro del viewport y la lista de registro posee su desplazamiento.

Con movimiento reducido, un panel flotante que se cierra pasa a oculto en cuanto empieza su
fase de salida, incluso mientras la biblioteca conserva su nodo para la limpieza del movimiento.

### Desplazamiento de navegación y fidelidad de respuestas portables

El viewport vertical nativo de la barra lateral tiene un indicador superpuesto de 6px en lugar de consumir una
columna de barra de desplazamiento. El hover, el desplazamiento, el arrastre o el foco de teclado lo revelan; el táctil conserva el
desplazamiento nativo del contenido. El pulgar sigue la proporción viewport/contenido y se puede arrastrar;
pulsar la pista desnuda pagina hacia ella. El movimiento usa los tokens existentes fast/base.
El mapa de calor empieza en el borde más reciente con un desfase de desplazamiento seguro para 32 bits con signo y
permanece fijado durante el redimensionado solo hasta que el lector elige una fecha más antigua.

La demostración anuncia su naturaleza mediante el toast global de llegada, con texto contextual de
repetición del Agent en esa página; no reserva ninguna fila de banner. El HTML portable del Agent
conserva el mismo texto, el razonamiento independiente, las líneas de tiempo de trabajo y las figuras generadas en línea
en orden de lectura. Las filas de llamada conservan los resúmenes de argumentos y los desplegables de resultado y duración.
El PNG captura las interfaces generadas con su ancho de layout, incluidos los gráficos y controles del kit;
las figuras no disponibles conservan una nota de respaldo visible en lugar de desaparecer en silencio.

### Calentamiento de la ventana de credencial

La barra de herramientas de OAuth abre un Drawer de ajustes de Warmup acotado al viewport con pestañas de sección
Codex y Claude. Un borrador impide cambiar de proveedor; cerrar y el Back nativo exigen una
decisión de descarte. Cada proveedor edita un modelo, un modo de restablecimiento y un inicio diario opcional,
mostrando la zona horaria efectiva de Shell-PAMC y la regla de prioridad diaria. Los valores predeterminados son apagado y `06:00`.
Guardar confirma el efecto sobre todas las credenciales actuales y futuras que heredan.

La pestaña Quota de la credencial añade una sección Window warmup con herencia del proveedor o una
sobrescritura completa, política efectiva, siguiente comprobación, último resultado duradero y motivo
seguro de pausa. Dos datos discretos muestran siempre las observaciones de activación del modelo seleccionado y la última
evidencia de respaldo de pago, incluida la evidencia desconocida. La ausencia de una observación de activación es historial
neutro, no una instrucción ni una puerta de preparación. El motivo explica el estado actual de la ventana o de
facturación. Guardar una política habilitada autoriza las solicitudes automáticas elegibles; la activación manual
sigue siendo opcional. Sus borradores sobreviven a los cambios de pestaña, permanecen
abiertos después de que otra sección guarde y participan en la protección de cierre del Drawer padre.
La activación manual requiere una confirmación que nombre la credencial y el modelo y explique el
consumo de cuota. Los resultados pendientes e inciertos nunca se leen como éxito de activación.
Los resultados de ejecución manual permanecen en la sección de la credencial sin un toast duplicado;
la confirmación en segundo plano actualiza ese mismo resultado. La demo pública no puede guardar ni consumir. Se reutilizan los tokens existentes de tipo, forma, espaciado y retroalimentación semántica.

