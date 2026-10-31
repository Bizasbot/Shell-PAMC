# ADR 0096: Las superficies en teléfonos son densas y silenciosas

- Estado: Aceptado
- Fecha: 2026-10-13
- Modifica: La cabecera de la página en teléfonos del ADR 0055 (un título de 18px bajo la barra superior) y la fila de teléfono del ADR 0012 (controles en una línea propia).

## Contexto

Medida a 390×844 con el conjunto de datos de demostración, la consola móvil mostraba poco de lo que contienen sus páginas:

- La cabecera y los filtros de la página de solicitudes ocupaban 430px, y un registro apilado unos 700px: doce campos etiquetados, uno por línea. Una pantalla cabía menos de un registro. El primer arrastre hacia arriba plegaba la cabecera, lo que desplazaba la lista 430px bajo el dedo.
- El panel de control (dashboard) dibujaba un mosaico por fila, de modo que la primera pantalla contenía tres números.
- Cada página dibujaba su título dos veces: en la barra superior y con 18px de altura directamente debajo.
- Una fila de lista colocaba sus controles en una línea con regla propia, y una credencial OAuth consumía seis bloques en seis líneas: unos 320px para una sola credencial.
- Una hoja (sheet) se deslizaba con una opacidad del 70% (movimiento de panel de antd). En un teléfono, una hoja ocupa el ancho de la pantalla, por lo que la página debajo de ella se mantuvo legible a través de ella durante todo el deslizamiento. La hoja de detalle de la solicitud se vaciaba antes de deslizarse hacia fuera.

Una tabla gasta su ancho en columnas, y cada columna otorga a la marca de un tono un lugar propio. Plegadas en unas pocas líneas, las mismas marcas (un relleno de éxito, un tono de esfuerzo, una sustitución, un tipo de credencial, un tono de caché) se perciben de un solo vistazo y ninguna se lee como una señal.

## Decisión

1. **La barra superior nombra a la página; la página no lo repite.** A 640px y por debajo, la barra mide 48px (`--app-header-height`), y el elemento `h1` de `PageHeader` se mantiene en el documento para la estructura (outline) y la tecnología de asistencia, pero no se dibuja. Un subtítulo en directo y las acciones de la página ocupan su fila; una cabecera que solo contenía el título no ocupa espacio.
2. **Un registro de solicitud apilado consta de tres líneas con dos datos cada una**: el modelo con su insignia de esfuerzo de razonamiento y el costo, en peso principal; el proveedor con su cuenta y el total de tokens; la hora y el veredicto, y la latencia, en tono discreto. Un registro en una lista está ahí para ser reconocido, y el cajón de detalles es donde se lee: el tiempo del primer token, el desglose de tokens, la tasa de caché, la velocidad, el tipo de credencial, la clave del llamador (caller's key) y la etiqueta del cliente están únicamente en el cajón. Se probó repetir cada columna de la tabla en cuatro líneas de tipografía pequeña y se percibió como ruido. Es el propio DOM de la fila de tabla: las celdas que contienen dos datos se disuelven con `display: contents`, cada línea tiene una celda de base cero que cede, por lo que ninguna línea se ajusta (wrap) a 320px, y la casilla de verificación se sitúa en el relleno izquierdo para que las tres líneas compartan un mismo borde.
3. **Un registro apilado se dibuja con los colores de texto.** El tono se reserva para aquello que se busca al escanear una lista: el indicador (pip) del veredicto, un fallo por completo, y la insignia de esfuerzo de razonamiento, que mantiene el diseño propio de la tabla y nunca se recorta. La tabla por encima del umbral del contenedor no se modifica.
4. **Los filtros de solicitudes ocupan dos filas.** La búsqueda y el acceso al panel completo de filtros ocupan la primera; la ventana, el veredicto, las dos facetas, la agrupación y la vista de modelo forman una única tira que se desliza horizontalmente dentro de sí misma. Se conservan todos los controles. La lista se extiende hasta los bordes de la pantalla.
5. **Los recuentos y los mosaicos conservan su fila.** `StatTiles` sigue siendo una única tira de mosaicos más estrechos, y la cuadrícula del panel de control mantiene dos columnas con sus mosaicos anchos abarcando ambas.
6. **Los controles de la fila de una lista comparten la línea de su titular** cuando ambos encajan, y caen a una línea propia en el borde posterior cuando no lo hacen. El registro de credenciales OAuth tiene cuatro líneas.
7. **Una hoja se desliza de forma opaca**, y un panel en proceso de salida sigue dibujando lo que contenía.

## Consecuencias

- A 390×844, la página de solicitudes muestra unos siete registros con la cabecera plegada y cinco con ella abierta; la cabecera mide 117px, por lo que el plegado desplaza la lista esa misma cantidad.
- Un registro apilado ya no imprime la clave del llamador, la etiqueta del cliente ni el texto del ID de solicitud; el control de copia del ID permanece, y los tres están en el cajón de detalles.
- La tira de filtros oculta sus controles posteriores hasta que se desliza. Se desborda hacia el borde de la página para que un control cortado señale la dirección, que es la regla existente en la consola para una tira que no puede ajustarse.
- Las capturas de pantalla de teléfonos en `docs/images/readme/` muestran el diseño anterior hasta que se vuelvan a generar.

## Alternativas consideradas

- **Una cabecera compacta persistente en lugar del plegado.** El plegado y su desplazamiento de 48px son el contrato del ADR 0048 y están fijados por `request-list-touch`; una cabecera de 117px hace que el plegado sea económico en lugar de innecesario.
- **Un segundo componente de fila exclusivo para teléfonos.** Dos representaciones de un mismo registro divergen; el DOM de la fila de la tabla, reorganizado, no puede hacerlo.
- **Conservar todos los campos de la tabla en el registro apilado.** Se probó empaquetar cada columna de la tabla en cuatro líneas de tipografía pequeña y se leyó como ruido. El diseño de tres líneas adoptado mantiene al proveedor y su cuenta juntos en la segunda línea, junto al total de tokens; los campos secundarios se leen en el cajón de detalles.
