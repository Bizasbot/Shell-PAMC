# ADR 0012: Una lista es un conjunto de datos renderizado de forma responsiva, no un selector de vista para el operador

- Estado: Aceptado
- Fecha: 2026-09-19

## Contexto

La sección §7 de `docs/design.md` y la Regla de Lista Abierta de `DESIGN.md` establecían lo siguiente: *"Una sola tabla sirve para cualquier ancho de pantalla; se desplaza horizontalmente en pantallas estrechas en lugar de convertirse en un segundo diseño"*. Dicha frase se escribió en `b9cf688`, en el cambio que eliminó el **selector de vista de tabla/tarjeta** de la página de gestión de claves y, con él, el diseño de tarjetas para pantallas estrechas junto con su hoja de estilos. El razonamiento registrado en ese momento era sólido y lo sigue siendo: dos vistas de un mismo conjunto de datos implican dos descripciones del mismo, el operador tiene que encontrar el selector, y el selector eliminado ya había generado una columna de estado y un modal de cambio de nombre que podían entrar en contradicción con la tabla situada al lado.

Lo que nunca se midió fue el costo de mantener dicha frase en su lugar. En un teléfono, según una auditoría de 390×844 de la consola compilada, el resultado es el siguiente:

| Superficie | Desplazador interno en una tarjeta de 316px | Consecuencia |
| --- | --- | --- |
| Gestión de claves | 316 → 980px | los controles para revelar, copiar y editar —que §2 exige que estén "a la vista" porque un secreto oculto tras un menú requiere un clic adicional— quedaban 664px más lejos |
| Proveedores de IA | 316 → 1081px | la etiqueta del protocolo se cortaba a mitad de palabra ("Codex (Res"), lo que se lee como texto roto |
| Plugins | 316 → 537px | la columna de nombres se reducía a un carácter por línea |
| Precios | columnas reducidas | el encabezado 价格 / 倍率 se renderizaba a un carácter por línea |

y, según esa misma medición, ninguno de estos desplazadores contaba con ningún indicador visual de que *fuera* un desplazador: `hasFadeOrHint: false`, y `scrollbar-width: thin` es invisible en un dispositivo táctil. Una regla que obligaba a todas las páginas de listas a desplazarse horizontalmente también había eliminado el único elemento que lo indicaba.

Por lo tanto, la frase estaba cumpliendo su propósito —rechazar un segundo diseño— pero a un costo que no se había evaluado.

## Decisión

**La regla se modifica de "una sola tabla, desplazada horizontalmente" a "un conjunto de datos, renderizado de forma responsiva".**

Una superficie de lista ahora se renderiza como una tabla por encima de **640px** y como filas etiquetadas a 640px y por debajo.
El cambio se realiza únicamente en función del *ancho* — `useIsPhoneViewport` es una consulta `(max-width: 640px)` y no interviene ninguna consulta de puntero (`pointer query`), por lo que una ventana de escritorio estrecha obtiene filas y una tableta ancha obtiene la tabla, que es lo que cada una de ellas puede utilizar realmente. Nunca es un control que el operador tenga que buscar, y ambas representaciones se derivan de una única descripción del registro:

- Las columnas siguen siendo la única descripción de lo que muestra un registro: su orden, sus títulos y sus propias funciones de renderizado. `phoneRowFields` las convierte en las etiquetas y valores de la fila, de modo que una columna añadida a la tabla llega a la fila, y un valor no puede formatearse de dos maneras distintas.
- El conjunto de datos, los filtros, la URL, las acciones, los estados vacíos y los recuentos conforman una única implementación. Nada acerca de *qué* se lista, o qué significa seleccionarlo, difiere según el ancho.
- No hay ningún selector, preferencia ni modo recordado. Un operador no puede configurar la consola en una disposición para teléfono en un escritorio, ni viceversa.

Lo que `b9cf688` rechazó no regresa: no hay columna de estado, ni modal de cambio de nombre, ni vocabulario de tarjetas con estilos independientes, ni un segundo lugar donde deba residir una lista de campos.

## Consecuencias

- **Se liberan las facilidades táctiles de la tabla para pantallas estrechas.** Una fila deja de ser un grupo con una separación de 4px de controles de 28px, que es el grupo para el cual las reglas táctiles tenían que aceptar áreas de impacto superpuestas; las acciones obtienen su propia línea.
- **El punto de interrupción (`breakpoint`) de 640px ahora es fundamental para el diseño**, no solo para el tamaño. Se une a 900px (la shell cambia de forma) y a la consulta de contenedor de `920px` de la lista de peticiones (el ancho de esa lista ya no se ajusta a sus columnas), y los tres se documentan juntos en la sección §8 de `docs/design.md`. Un cuarto número necesita una justificación explícita al lado.
- **Cada superficie de lista ahora tiene dos representaciones que mantener sincronizadas**, lo cual es el costo real y la razón de la derivación en lugar de una segunda lista de campos escrita a mano. `scripts/test-phone-rows.ts` fija la propiedad de omisión silenciosa de la derivada: una columna que sea direccionable y no se omita explícitamente se convierte en un campo.
- **La sección §7 de `docs/design.md`, `DESIGN.md` y el propio comentario de la lista de claves se modifican en el mismo cambio**, debido a que la frase anterior se cita en los tres lugares.
- La tabla se mantiene para viewports anchos, y el desplazamiento horizontal dentro de su tarjeta sigue siendo la convención de la consola *ahí* —donde un puntero puede arrastrarla y la barra de desplazamiento es visible.

## Alternativas consideradas

**Mantener una sola tabla y hacer que el desplazamiento horizontal sea usable** — una columna de identidad fija, una columna de acción fija, un desvanecimiento en los bordes y sin controlador de cambio de tamaño en dispositivos táctiles. Esto preserva la frase exactamente y era la opción más económica. Se rechazó porque las mediciones anteriores no se deben a que el desplazamiento sea difícil de realizar, sino a que los controles están *fuera de la pantalla*: fijar dos columnas de una tabla de 980px en 316px deja la parte central inutilizable, y la lista de claves seguiría necesitando un desplazamiento antes de poder revelar un secreto.

**Un resumen de solo lectura en teléfonos** — la opción más económica y la menos útil: un operador en un teléfono suele estar ahí precisamente para actuar, razón por la cual la consola es accesible en primer lugar.

**Restablecer el selector de tabla/tarjeta** — se rechaza por las razones registradas en `b9cf688`, las cuales este ADR respalda en lugar de revocar: una opción orientada al operador entre dos vistas constituye una segunda descripción del conjunto de datos, y el operador tiene que saber que existe.
