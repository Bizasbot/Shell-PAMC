# ADR 0045: Las superficies de retroalimentación se eligen según lo que describe el mensaje

- Estado: Aceptado
- Fecha: 2026-09-30

## Contexto

La consola informaba sobre resultados y fallos a través de cuatro mecanismos sin relación entre sí: la API `message` de antd para la mayoría de los resultados de acciones, banners `Alert` planos de antd colocados ad hoc dentro de las páginas, diálogos de información `modal.warning` / `modal.info` para fallos por lotes, y un informe de operaciones dentro de la página en el espacio de trabajo de credenciales para una actualización de cuotas que tenía objetivos fallidos. Cuál de ellos usaba una página dependía de quién la había escrito, no de lo que se estaba comunicando. Los efectos eran visibles:

- El mismo resultado podía aparecer dos veces. Un guardado de configuración rechazado generaba un mensaje y además dejaba un banner de error encima del editor.
- El resultado de una acción que terminaba como un banner dentro de la página empujaba el contenido que describía hacia abajo y se quedaba allí después de que el operador lo hubiera leído; el informe de cuotas es el caso más claro.
- La lectura fallida de un panel era un banner sin forma de reintentar, por lo que reparar un gráfico significaba recargar la página.
- Los fallos por lotes interrumpían con un modal que el operador tenía que descartar antes de hacer cualquier otra cosa.
- `message` admite una sola línea, por lo que un motivo por objetivo (la única parte útil de un informe por lotes) no podía ser transportado por este, razón por la cual existía el informe dentro de la página.

## Decisión

La superficie se elige según lo que describe el mensaje, no según su gravedad, y cada superficie reside en `web/src/components/feedback/`:

| Lo que describe el mensaje | Superficie |
| --- | --- |
| El resultado de algo que el operador acaba de hacer | un toast, `useToast()` |
| Una región que no se pudo leer | `LoadFailure` en el lugar de esa región, con Reintentar |
| Una condición que se mantiene mientras la región está en pantalla | `Notice`, donde corresponda |
| Un rechazo de la entrada frente al operador | `Notice` (o el error de campo del formulario), junto a esa entrada |

- El toast se basa en `notification` de antd, no en `message`, porque una notificación puede llevar una segunda línea, una lista y acciones. El resultado de un lote con motivos por objetivo es un *toast de informe*: los motivos se enumeran bajo los encabezados de grupo y el toast permanece visible hasta que se cierra. Esto reemplaza al informe de cuotas dentro de la página y a los diálogos de fallo de solo información.
- Un resultado llega a una sola superficie. `modal.confirm` sigue pidiendo confirmación antes de una acción; nada abre un diálogo para informar después de ella.
- El contenido del toast nunca cambia de altura después de abrirse. antd posiciona las notificaciones a partir de las alturas que mide al llegar, por lo que un grupo expansible se deslizaría debajo del toast inferior; en su lugar, un grupo largo de contexto se resume a una línea por motivo.
- `pnpm check:feedback` rechaza los componentes `Alert`, `message`, `notification` de antd y los diálogos `modal.*` de solo información en cualquier parte de `web/src` fuera del módulo de retroalimentación.

## Consecuencias

- Una actualización de cuotas ya no mueve la lista de credenciales: cada resultado, incluidos aquellos con objetivos fallidos, es un toast. Un informe que el operador no ha cerrado es reemplazado, no apilado, por la siguiente actualización porque reutiliza una clave de notificación.
- Cada lectura fallida en la consola ofrece Reintentar solo para esa región.
- Las pruebas de aceptación verifican `.omc-toast` en lugar de las clases de mensajes de antd, y una prueba que continúe después de un toast de informe debe cerrarlo, ya que este permanece visible.
- Una página nueva no puede reintroducir un banner plano o una segunda API de notificación sin que la validación estática falle; el único lugar autorizado para ampliar la retroalimentación es `components/feedback`.
- Un toast de informe se limita a lo que cabe en un panel flotante (su lista se desplaza dentro de una altura máxima). Un resultado que requiera ordenamiento, filtrado o exportación necesitaría su propia región de página, y constituiría una nueva decisión.
