---
name: Shell-PAMC
description: A quiet developer console for AI resource identity & organization
colors:
  primary: "#0579bd"          # dark mode's filled-control step; light mode uses #004a73
  primary-accent: "#00a2fb"   # dark mode's link step; light mode uses #005d8f
  primary-active: "#025e94"   # dark mode's pressed step; light mode uses #023b5d
  primary-on: "#ffffff"       # label on a filled accent control; computed per palette, near-black where white cannot clear 4.5:1
  neutral-bg: "#121214"
  neutral-surface: "#1c1c1f"
  neutral-border: "#2c2c30"
  neutral-border-soft: "#212124"
  neutral-fg: "#f4f4f6"
  neutral-fg-subtle: "#a1a1aa"
  neutral-muted: "#71717a"
  neutral-meta: "#52525b"
  status-success: "#10b981"
  status-warn: "#f59e0b"
  status-danger: "#ef4444"
  cache-yellow: "#f59e0b"
  cache-green: "#10b981"
  series-1: "#3b82f6"
  series-2: "#10b981"
  series-3: "#8b5cf6"
  series-4: "#f43f5e"
  series-5: "#f59e0b"
  series-6: "#06b6d4"
  route-1: "#3b82f6"          # live routing lanes, cool identities only; light mode uses the darker steps
  route-2: "#8b5cf6"
  route-3: "#06b6d4"
  route-4: "#ec4899"
  route-5: "#d946ef"
  route-6: "#94a3b8"
  effort-1: "#94bfce"         # reasoning-effort scale, minimal → max; light mode uses the darker steps
  effort-2: "#4eccd3"
  effort-3: "#91b7fe"
  effort-4: "#bda7fe"
  effort-5: "#f08dee"
  effort-6: "#ff8cc1"
  brand-openai: "#10A37F"
  brand-codex: "#60A5FA"
  brand-claude: "#D97757"
  brand-gemini: "#A78BFA"
  border-light: "rgba(15, 0, 0, 0.12)"
typography:
  display:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "42px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  tile:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  kpi:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
  tile-sm:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  sub:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  data:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
  label:
    fontFamily: '"Sarasa Mono SC", "Sarasa UI SC", "Berkeley Mono", "IBM Plex Mono", monospace'
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.16em"
rounded:
  none: "0"
  xs: "2px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.primary-accent}"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "32px"
  button-secondary:
    backgroundColor: "color-mix(in srgb, {colors.neutral-fg} 6%, transparent)"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "32px"
  input-base:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.sm}"
    padding: "4px 11px"
    height: "32px"
  card-base:
    backgroundColor: "{colors.neutral-bg}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Sistema de diseño: Shell-PAMC

## Visión general

**Norte creativo: "El panel silencioso"**

Shell-PAMC es un plano de control dedicado para desarrolladores enfocado en recursos de IA y telemetría de proxy. Basado en una filosofía de consola minimalista inspirada en OpenCode, el sistema ofrece una visibilidad operativa densa, honesta y de alta frecuencia sin saturación estética. Rechaza los degradados decorativos, el glassmorphism y las animaciones de entrada llamativas: el trabajo descansa sobre un panel silencioso y solo lo que el lector convoca se eleva por encima de él.

La navegación descansa sobre un lienzo un paso por detrás de la página (`--canvas`); la cabecera y el contenido de la ruta comparten un único panel insertado en `--bg`, con esquinas redondeadas de 12px. Las superficies estáticas son un relleno y una línea fina; los menús, popovers, notificaciones, diálogos y hojas laterales llevan una sombra suave porque se sitúan por encima del trabajo. La tipografía predeterminada es Sarasa Mono SC para caracteres latinos, cirílicos y CJK; los operadores eligen los roles de interfaz y monoespaciado por separado, y el código junto con los datos alineados utilizan el rol monoespaciado con números tabulares. La interfaz sigue la doctrina de "Cromo silencioso, datos destacados": la estructura circundante permanece oscura y atenuada, reservando los acentos cromáticos saturados exclusivamente para estados operativos genuinos.

**Características clave:**
- **Un panel sobre un lienzo**: La barra lateral sobre `--canvas`, el trabajo sobre un panel insertado; las superficies estáticas permanecen planas, las capas convocadas se elevan (ADR 0103).
- **Roles tipográficos configurables**: Sarasa Mono SC es el valor por defecto para ambos roles, con respaldos en Berkeley Mono e IBM Plex Mono. El rol monoespaciado se reserva para cadenas leídas carácter por carácter — identificadores, claves, rutas y código —, mientras que nombres, modelos y cifras siguen el rol de interfaz.
- **Cromo silencioso, datos destacados**: El andamiaje de carbón oscuro garantiza que las insignias verdes, ámbar, rojas y azules transmitan instantáneamente la salud del sistema.
- **Retroalimentación suave y contenida**: Movimiento en una escala de 120 · 160 · 180 · 240ms (`fast`, `float`, `base`, `slow`) con curva desacelerada y cero físicas de resorte; los paneles aparecen gradualmente asentando su último porcentaje, nada vuela. Junto a ello, el `roll` de 240ms compartido por las lecturas de KPI del panel y las marcas de gráficos dibujadas a partir de ellas, y un token de `scroll` exclusivo de JavaScript de 160ms para ruedas y teclas de dirección que se deslizan con suavidad hacia donde habrían saltado; los tokens de salto/brillo/presencia del mapa de enrutamiento en vivo se reproducen completos para cada lector, porque el trayecto es la lectura del panel y no decoración (ADR 0102); los estados hover se completan dentro del token rápido de 120ms, porque un hover más largo resulta pesado en lugar de responsivo.

## Colores

La paleta se ancla en tonos oscuros de carbón cálido con pigmentos de estado puramente semánticos y una escala de caché continua interpolada en OKLCH. Una paleta consta de **nueve tokens autorados y dieciocho derivados**: `web/src/theme/palette.ts` declara el conjunto autorado y calcula el resto, de modo que las seis paletas registradas — OMC Dark, Midnight y Forest para el modo oscuro; OMC Light, Porcelain y Sandstone para el modo claro — y la creada por un operador son el mismo tipo de objeto. La paleta resuelta alimenta Ant Design, variables CSS, gráficos, el mapa de calor, el editor Monaco, la vista previa de ajustes y el arte de marca desde ese único lugar. Cada modo de tema (claro, oscuro o según el sistema) mantiene una paleta propia, y una paleta creada por el operador se etiqueta como «Personalizada» en el idioma de lectura. `omc-theme` almacena todo el documento de preferencias y lee también IDs simples de paletas de versiones anteriores. Consulte `docs/adr/0011-theme-modes-and-derived-palettes.md`.

### Primario
- **Azul de acento profundo** (`#0579bd` oscuro / `#004a73` claro): Utilizado para botones de acción primaria rellenos y controles de confirmación. Proporciona un punto de enfoque decisivo sin abrumar el modo oscuro.
- **Escala de acento** (tono 201, por modo): `#00a2fb` / `#005d8f` son los pasos de enlace para oscuro y claro, `#0579bd` / `#004a73` los pasos para controles rellenos. El acento deliberadamente *no* es invariante al modo: el paso brillante lee 6.74:1 sobre fondo oscuro pero solo 2.78:1 sobre fondo claro, por lo que la paleta de cada modo usa el paso legible en ella. Utilizado para enlaces interactivos, resaltados de migas de pan, barras de progreso activas, anillos de foco `:focus-visible`, trazo hover y presionado de botones con contorno, el logotipo de marca, la esquina posterior de la marca cuadrada y la rampa del mapa de calor de tokens. La escala es *derivada*: un paso de luminosidad proporcional en OKLCH desde el acento autorado, profundizado hasta que el blanco o el casi negro supere 4.5:1 como etiqueta del control relleno. Ratios medidos en `docs/design.md` §2.
- **Azul presionado** (`#025e94` oscuro / `#023b5d` claro): El relleno de un botón activo bajo el puntero y mientras se presiona. Está calculado para situarse debajo de la etiqueta `primary-on`.

### Series (categóricas)

Los paneles de modelos del panel de control colorean una **categoría**, no un estado: un modelo es cualquier nombre de upstream que el despliegue sirva, por lo que su tono aporta identidad y ningún veredicto. Junto con la paleta de carriles de enrutamiento a continuación, estas son las familias cromáticas decorativas de la aplicación, y la única excepción a la regla de solo color semántico; consulte `docs/adr/0006-categorical-series-palette.md` y `docs/design.md` §2.

- **Ranuras** (`--series-1` … `--series-6`): azul `#3b82f6` / `#2563eb`, esmeralda `#10b981` / `#059669`, púrpura `#8b5cf6` / `#7c3aed`, coral `#f43f5e` / `#e11d48`, ámbar `#f59e0b` / `#b45309`, cian `#06b6d4` / `#0891b2` (oscuro / claro). Cumple con los estándares de visualización de datos de AntV, Tremor y ZCode/Codex.
- **Pista** (`--series-track`, `#2c2c30` oscuro / `#dcdce1` claro): la base de trazado de la tendencia y la pista vacía del anillo de uso, que corresponde al paso de borde de cada modo.
- Cada ranura supera 3:1 contra la tarjeta, las entradas adyacentes de la leyenda están a una distancia mínima de ΔE 25 en CIE Lab, y los tokens de la hoja de estilos coinciden exactamente con la paleta derivada. Todas las restricciones están aseguradas por `scripts/test-chart-marks.ts`.

### Reglas nombradas
**La regla del color semántico.** El color nunca se aplica como decoración visual casual. El verde, el ámbar y el rojo comunican estrictamente salud booleana, degradación o errores activos. El andamiaje, los iconos y los contenedores permanecen neutros.

**La regla de la escala de caché honesta.** Los indicadores de tasa de caché nunca muestran rojo de peligro. Una falla de caché o una tasa baja es una característica inherente a prompts novedosos, no un defecto de infraestructura. El rojo se reserva exclusivamente para ejecuciones fallidas.

**La regla de la tinta de paleta.** El cromo de los gráficos que el entorno de ejecución pintaría desde su propio tema — líneas de cuadrícula, ejes y marcas, etiquetas de ejes y la mira del tooltip — se toma de la paleta y se dibuja con la opacidad propia de la paleta, y el tema del gráfico sigue el modo de la consola en lugar del valor predeterminado claro. Ambas variantes se verifican a nivel de píxeles pintados.

## Tipografía

**Fuente de interfaz (predeterminada):** "Sarasa Mono SC", "Sarasa UI SC", "Sarasa Term SC", "Berkeley Mono", "IBM Plex Mono", ui-monospace, monospace
**Fuente monoespaciada (predeterminada):** "Sarasa Mono SC", "Sarasa UI SC", "Sarasa Term SC", "Berkeley Mono", "IBM Plex Mono", ui-monospace, monospace

**Fuente embebida:** Sarasa Mono SC completa en Regular y Bold, dividida en fragmentos woff2 con `unicode-range`: el fragmento central (ASCII, puntuación y los textos propios de la consola) carga con el primer fotograma, el resto solo cuando una página dibuja uno de sus caracteres (ADR 0094). `pnpm subset-font` las regenera.

**Carácter:** Unificado, técnico y preciso. El conjunto de caracteres monoespaciados en chino, inglés, malayo y símbolos de código otorga a Shell-PAMC el ritmo de un monitor de terminal interactivo conservando alta legibilidad en CJK. Los dos roles difieren en su propósito: un operador que elija una fuente proporcional de interfaz la obtiene para nombres, modelos y cifras, mientras que identificadores, claves, rutas y código conservan el rol monoespaciado.

### Jerarquía
- **Display** (700, 42px, interlineado 1.1, espaciado entre letras -0.04em): El KPI principal destacado del tablero (ej. Solicitudes totales, Costo estimado).
- **Headline** (700, 22px, interlineado 1.2): Título de veredicto de la página principal (ej. `Healthy.` o nombre de navegación de sección).
- **Title** (600, 16px, interlineado 1.3): Encabezados de sección de tarjetas, títulos de paneles laterales y franjas de grupo de tablas.
- **Body** (400, 14px, interlineado 1.5): Texto estándar de cuerpo, etiquetas de formularios, valores de entrada y explicaciones de estado.
- **Data / Mono** (400, 12–13px, interlineado 1.4): Celdas de tablas, líneas de registro, rutas, valores JSON/YAML y métricas de latencia.
- **Caption** (500, 11–12px, tipo oración): Encabezados de columnas, etiquetas sobre mosaicos de KPI y nombres de grupos de navegación.

### Reglas nombradas
**La regla de un solo veredicto.** Se permite exactamente un título de nivel superior por página. Un subtítulo es una sola línea que indica el tema de la superficie (ej. `Administra endpoints de proveedores de IA…`) o porta datos dinámicos en vivo (ej. `CPA predeterminado · Conectado`), nunca una repetición del título ni texto de marketing.

**La regla de los numerales tabulares.** Todos los números, valores financieros, cifras de latencia y marcas de tiempo deben heredar `font-variant-numeric: tabular-nums` para asegurar columnas estables durante actualizaciones continuas en streaming.

## Diseño y distribución (Layout)

El viewport de la aplicación utiliza una arquitectura de shell fija (`100dvh`, `body { overflow: hidden }`), evitando saltos de desplazamiento a nivel de ventana:

```text
┌──────────┬──────────────────────────────────────────┐
│ wordmark │╭────────────────────────────────────────╮│
│          ││ nav / breadcrumb     GitHub + acciones ││ 52px, sin línea
│ nav      ││                                        ││
│ (236px)  ││ contenido página  ← se desplaza solo   ││
│ canvas   ││ (ancho máx: 1440px)        panel: --bg ││
│          │╰────────────────────────────────────────╯│ margen 8px, esquinas 12px
└──────────┴──────────────────────────────────────────┘
```

- **Cabecera superior**: Altura fija de 52px (48px en 640px o menos, `--app-header-height`), la parte superior del panel de contenido, sin línea divisoria propia. Contiene el alternador de navegación, la jerarquía de migas de pan y cinco acciones alineadas a la derecha: enlace a GitHub del proyecto, actualización, control de modo de tema, menú de idioma y cerrar sesión.
- **Barra lateral de navegación**: Ancho fijo de 236px (58px colapsada), sobre `--canvas` sin borde: el borde del panel actúa como separación. Por debajo de 900px el panel pierde sus márgenes y esquinas adaptándose a la pantalla. Alberga categorías agrupadas: `Operar`, `Pasarela`, `Observar`, `Control`.
- **Hoja de navegación (móvil)**: Por debajo de 900px la barra se convierte en una hoja lateral izquierda de `min(320px, 86vw)`, manteniendo las mismas dos secciones: marca y navegación agrupada. No hay barra inferior ni menú exclusivo para móviles: un teléfono tiene menos espacio, no menos elementos que navegar.
- **Área de contenido**: Contenedor con desplazamiento único y espaciado adaptativo (32px escritorio / 24px tablet / 16px móvil), dentro de una columna de contenido de 1440px.

### Vistas pequeñas y funcionalidad táctil

La consola se opera tanto desde móviles como desde escritorio, tratándose el teléfono como un dispositivo propio y no como un escritorio estrecho.

**Dos puntos de quiebre de viewport, un umbral de contenedor.** `900px` — el shell modifica su forma (la barra pasa a ser una hoja lateral, encabezado de página y columnas de cuadrícula se apilan). `640px` — el dispositivo es un teléfono (las listas renderizan filas etiquetadas en vez de tablas, los controles adoptan tamaños táctiles). `920px` **contenedor** (`reqstream`) — el ancho propio de la lista de solicitudes ya no da cabida a sus columnas, convirtiéndose cada registro en una fila apilada.

- **Un dedo no tiene hover.** Cada elemento visible con `:hover` incluye su contraparte `@media (hover: none)` que lo dibuja permanentemente. Un tooltip puede nombrar un control, nunca ser la única forma de alcanzarlo.
- **La base de pulsación es un área de toque, no un tamaño dibujado.** Un control de 28×28 conserva su tamaño visual y adquiere `::before { inset: -4px }` bajo `(pointer: coarse)`.
- **16px es la base de enfoque.** iOS Safari hace zoom en la página cuando un campo enfocado mide menos de 16px, por lo que bajo `(pointer: coarse)` todo control de texto enfocable adopta 16px.
- **El zoom con pellizco nunca se desactiva.** `maximum-scale=1` y `user-scalable=no` están ausentes a propósito.
- **Una página nunca se desplaza horizontalmente.** El panel de contenido se desplaza verticalmente en móviles; bloques de código, tablas anchas y el mapa de calor se desplazan dentro de sus propios marcos con `overscroll-behavior-x: contain`.
- **El compositor comienza en una línea.** Crece hasta diez líneas en escritorio, con la acción en su pie. Por debajo de 640px crece hasta cinco líneas con la acción junto a la entrada.

## Elevación y profundidad

Las superficies estáticas permanecen planas; las capas convocadas se elevan (ADR 0103).

1. **El lienzo y el panel**: la barra lateral descansa sobre `--canvas`; la cabecera y la página comparten un panel insertado en `--bg`, delimitado por su borde de 1px y esquinas de 12px.
2. **Recinto, no división**: una tarjeta o grupo de ajustes se dibuja sobre el fondo propio del panel y se delimita con una línea fina, nunca con un segundo relleno.
3. **Capas convocadas**: menús, popovers, selectores y avisos portan `--shadow-float`; diálogos y hojas laterales portan `--shadow-overlay`.
4. **El compositor**: el elemento en el que escribe el usuario descansa sobre `--shadow-raised` y pasa a `--shadow-float` mientras tiene foco.

## Componentes

### Botones
- **Forma**: radio de 6px (`--radius-sm`).
- **Tamaños**: Estándar 32px de altura; Pequeño 28px de altura; Cuadrado 28×28px para botones de acción por fila.
- **Primario**: Relleno de acento profundo (`#0579bd` oscuro, `#004a73` claro) con la etiqueta en el paso `accentOn`, sin sombra. Hover profundiza un paso sin retraso en la transición.
- **Secundario / Por defecto**: Relleno discreto — lavado del 6% de `--fg` con borde transparente y texto en `--fg`.
- **Fantasma (Ghost)**: Fondo transparente, sin borde, color de texto `#f4f4f6`, hover revela `#1c1c1f`.

### Tarjetas y paneles de grupo de ajustes
- **Estilo de esquinas**: radio de 12px (`--radius-lg`), borde continuo de 1px (`#2c2c30`).
- **Fondo**: el fondo propio del panel, `#121214` (`--bg`).
- **Espaciado interno**: 20px.

### Entradas y selectores
- **Estilo**: Relleno suave (5% de `--fg`, 8% en hover) sin borde en reposo, radio de 6px, altura de 32px.
- **Foco**: Contorno cian distintivo (`0 0 0 2px` del `--accent` del tema), sin desenfoque difuso.

### Pistas de auditoría, registros y espacios de trabajo
- El Agente y la consola comparten primitives visuales, paletas de estados y esquemas de confirmación humana con tarjetas de aprobación acotadas antes de cualquier escritura de alto riesgo.
- Todas las superficies de visualización respetan los modos claro y oscuro garantizando contrastes accesibles WCAG AA.
