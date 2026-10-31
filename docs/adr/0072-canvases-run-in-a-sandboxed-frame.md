# ADR 0072: Los lienzos se ejecutan en un marco aislado (sandboxed)

- Estado: Aceptado
- Enmendado por
  [ADR 0073](0073-charts-and-tables-are-canvases-and-a-command-can-hold-an-answer-to-one.md),
  que nombra a esta herramienta `render_ui` y retira `render_canvas` hacia los rastros almacenados, y por
  [ADR 0083](0083-agent-runs-retain-the-work-the-task-needs.md), que elimina el
  límite en el recuento de visualizaciones que se indica más abajo.
- Fecha: 2026-10-08
- Extiende [ADR 0042](0042-display-tools-draw-referenced-frozen-data.md) y
  [ADR 0079](0079-panels-are-a-block-vocabulary-with-open-icons.md): `render_canvas`
  es la cuarta herramienta de visualización, para aquello que las otras tres no pueden expresar.

## Contexto

Un vocabulario cerrado no puede dibujar todo lo que vale la pena dibujar: un diagrama de enrutamiento, una
línea de tiempo con su propia geometría, una explicación interactiva. Para eso, el modelo tiene
que escribir marcado. El marcado escrito por un modelo no es de confianza en el sentido más estricto: el
modelo lee los resultados de las capacidades y las notas de los proveedores; los alias de claves y los nombres de modelos
son cadenas que otras partes controlan, por lo que no puede formar parte del documento de la consola,
donde comprometería la sesión del operador.

## Decisión

`render_canvas` toma un título, un cuerpo de HTML con estilos y scripts en línea (de como
máximo 48 KiB) y opcionalmente `source {call_id, path}` con `fields`, resueltos y congelados
exactamente igual que las filas de un gráfico. Un turno dibuja como máximo dos.

La consola nunca interpreta el marcado. Construye un documento separado a su alrededor y
muestra ese documento en un marco (frame), con tres límites independientes:

1. **Sin origen.** El marco es `sandbox="allow-scripts"` y nada más. Su
   documento tiene un origen opaco: sin cookies, sin almacenamiento, sin acceso al DOM
   de la consola, sin formularios, ventanas emergentes (popups), descargas o navegación de nivel superior.
2. **Sin red.** El primer elemento del documento es una política de seguridad de contenido (CSP)
   de `default-src 'none'`, permitiendo únicamente scripts y estilos en línea, e imágenes y
   fuentes de tipo `data:`. Se declara antes de que se analice cualquier parte del marcado del modelo, y una
   política posterior solo puede restringirla.
3. **Sin vía de escape mediante navegación.** Un marco aislado (sandboxed) aún puede navegar por sí mismo, y
   ninguna de las medidas anteriores detiene eso: un lienzo podría llevarse sus datos en una URL. Por lo tanto,
   el propio documento de la consola declara `frame-src 'self' blob:`, lo cual el
   navegador aplica a cada navegación de un marco anidado. Esto se midió en lugar
   de asumirlo: sin ello, un marco `srcdoc` aislado alcanzaba otro host al
   asignar `location.href`; con ello, se rechaza la navegación.

Al lienzo se le proporcionan dos cosas. El tema, en forma de variables CSS de la consola con sus
valores resueltos, de modo que el marcado coloreado con `var(--accent)` se vea como la consola
y se reconstruya cuando cambia el tema. Y sus filas, como `window.OMC_DATA`, serializadas de
tal forma que ninguna fila pueda cerrar el elemento de script en el que se encuentran.

El marco informa su altura de contenido mediante `postMessage`. La consola acepta un reporte
únicamente de la propia ventana del marco, solo cuando es un número finito, y lo acota (clamp).

El marco es un documento `srcdoc`, no una ruta. Se consideró un punto final dedicado con una
cabecera de respuesta `sandbox` (el precedente del icono personalizado): habría necesitado una
conversación almacenada desde la cual servir, por lo que no habría podido dibujar un lienzo que todavía está transmitiendo (streaming),
y habría añadido una ruta a la fachada, a la demostración y a la página HTML guardada,
las cuales el formato `srcdoc` sirve con un único constructor
(`web/src/agent/canvasDocument.ts`).

## Consecuencias

- El marcado se almacena tal como fue escrito y no se sanitiza. La seguridad no depende de
  reconocer qué hay de peligroso en él, algo que nada podría hacer de forma fiable.
- `frame-src 'self' blob:` se aplica ahora a toda la consola. Las páginas de plugins se enmarcan
  desde este origen y no se ven afectadas; una característica futura que enmarque otro origen
  debe revisar esta política de manera deliberada.
- La fuente propia de la consola no está disponible dentro de un lienzo (no puede cargar una), por lo que un
  lienzo se renderiza con la tipografía monoespaciada del sistema.
- Una página HTML guardada incrusta cada lienzo en el mismo sandbox, y su propia política no tiene
  ninguna concesión `frame-src`. Una imagen PNG, así como la impresión, muestran una nota en su lugar: un
  script no puede ejecutarse dentro de una imagen.
- El modelo paga por un lienzo en tokens en cada ronda posterior del turno, ya que el
  marcado forma parte de la llamada a herramienta almacenada. Los límites de tamaño y cantidad acotan eso,
  y el presupuesto de solicitudes lo omite al igual que cualquier otro intercambio de herramientas antiguo.
