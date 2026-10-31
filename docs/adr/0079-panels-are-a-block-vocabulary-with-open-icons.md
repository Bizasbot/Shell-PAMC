# ADR 0079: Los paneles son un vocabulario de bloques con iconos abiertos

- Estado: Aceptado
- Reemplazado para nuevas llamadas por
  [ADR 0073](0073-charts-and-tables-are-canvases-and-a-command-can-hold-an-answer-to-one.md),
  [ADR 0085](0085-a-generated-ui-is-composed-from-components-and-drawn-as-it-is-written.md) y
  [ADR 0087](0087-new-generated-interfaces-default-to-inline-components.md): `render_view` se
  retira hacia los seguimientos almacenados que ya lo nombran, y el vocabulario de bloques a
  continuación es de donde se extraen esos paneles almacenados. Una nueva visualización es una
  única llamada a `render_ui`.
- Fecha: 2026-10-08
- Extiende [ADR 0042](0042-display-tools-draw-referenced-frozen-data.md): `render_view` era una tercera
  herramienta de visualización. Los gráficos y las tablas siguen haciendo referencia a sus filas exactamente
  como decidió el ADR 0042; nada cambia en ese aspecto.

## Contexto

El Agente podía mostrar datos de dos maneras: un gráfico de uno de cinco tipos, o una tabla.
Cualquier otra cosa tenía que decirla en Markdown, donde el HTML se escapa y las imágenes son enlaces.
Una respuesta como "tres cifras que importan, una credencial que requiere atención
y la página que se debe abrir a continuación" tiene una forma natural, y el modelo no tenía forma de
otorgársela. Los iconos en la página eran la decoración propia de la consola; el modelo no tenía
ningún canal para iconos en absoluto.

Se consideraron dos formas de abordar esto y se rechazaron como la primera respuesta:

- **Permitir que el modelo escriba marcado (markup).** Flexible, pero cada respuesta parece entonces la
  de su autor en lugar de la de la consola, no sigue ningún tema y debe aislarse de
  la página. Esa es una necesidad real para una clase pequeña de elementos visuales y constituye el ADR 0072; es
  la opción predeterminada incorrecta para un resumen.
- **Adoptar una biblioteca de componentes de interfaz generativa.** El vocabulario y su validación
  pertenecerían a la biblioteca, sus propiedades llegarían sin verificar desde el modelo, y
  ninguno de los candidatos utiliza los tokens de OMC sin un segundo sistema de estilos.

## Decisión

`render_view` toma un título y de uno a ocho **bloques**, dibujados de arriba a abajo como un
**panel**. El vocabulario es cerrado y pequeño:

| Bloque | Qué expresa |
| --- | --- |
| `stats` | Cifras principales: etiqueta, valor, cambio opcional, tono e icono |
| `fields` | Los hechos de un elemento, como etiquetas y valores |
| `callout` | Un mensaje destacado, con tono de información, éxito, advertencia o peligro |
| `steps` | Etapas ordenadas, cada una completada, activa, pendiente o fallida |
| `meters` | Porciones de un límite, como una fracción rellenada con un tono opcional |
| `links` | Páginas de la consola para abrir a continuación |

El modelo elige los bloques y escribe su texto. La consola decide cada píxel: un
bloque se dibuja a partir de los mismos tokens que el resto del espacio de trabajo, por lo que un panel sigue
un cambio de tema, se lee a cualquier ancho y se exporta como el resto de la conversación.

**Una sola forma para cada bloque.** Todos los tipos de bloques comparten una única estructura JSON (`type`, `title`,
`tone`, `text`, `items`), y todos los elementos comparten otra. El esquema que se envía al modelo
en cada ronda ocupa, por tanto, unos pocos cientos de bytes sin importar cuántos tipos de bloques existan. Qué
campos lee un tipo se aplica en `resolveView`; un campo que un tipo no lee se descarta,
no se almacena, y se rechaza cualquier campo desconocido.

**Los iconos son abiertos y nunca pueden hacer que una vista falle.** El `icon` de un elemento es cualquier nombre de Lucide,
o `brand:<maker>` para la marca de un creador. El servidor solo verifica su longitud y
conjunto de caracteres. La consola lo resuelve —tolerando las grafías que producen los modelos
y mapeando un nombre de Lucide retirado a su reemplazo— y dibuja una marca neutral para
un nombre que no coincida con nada. El conjunto de Lucide es un documento JSON generado
(`web/src/generated/lucideIcons.json`, escrito por `pnpm icons:generate` y fijado al
paquete instalado mediante una autoprueba), que se carga la primera vez que un panel muestra un icono:
importar el conjunto como componentes pondría dos mil módulos en el gráfico de inicio,
e importar cada uno bajo demanda incrustaría dos mil fragmentos en el binario.

**Los enlaces nombran páginas, nunca URLs.** Un elemento de tipo `links` contiene una `route` procedente de una
lista cerrada de páginas de la consola. La consola la resuelve bajo su propia ruta base, por lo que un panel
no puede conducir fuera del despliegue.

## Consecuencias

- **Las cifras de un panel son afirmaciones del modelo.** Un gráfico o tabla muestra filas que el
  servidor resolvió a partir del resultado de una capacidad; un panel muestra texto que escribió el modelo,
  de la misma manera que las oraciones que lo acompañan. Esto es deliberado —una cifra principal suele
  ser derivada (un total, una proporción, una cantidad con formato) y no tiene una sola celda a la cual
  hacer referencia—, pero significa que un panel transmite la precisión del modelo, no la de la
  capacidad. El mensaje del sistema (system prompt) indica al modelo que copie las cifras exactamente y nombre su ventana, y
  los datos que deban ser estrictamente las cifras de la capacidad siguen pertenecienddo a un gráfico o una tabla.
- Las reglas de presentación ya no retienen las visualizaciones hasta que el operador solicita una.
  Solicitan la única visualización que encaja mejor cuando la estructura es más clara que
  las oraciones, y mantienen la disciplina anterior: las visualizaciones son artefactos de respuesta final,
  nunca informes de progreso, y constituyen el conjunto complementario más pequeño.
- Un nuevo tipo de bloque implica una rama de validación en el servidor, un componente de consola, una rama de exportación
  y una línea en la descripción de la herramienta. No tiene costo en bytes de esquema.
- Una página HTML exportada incrusta los iconos de Lucide como SVG. Las marcas de los creadores son archivos que
  la página no puede transportar y se omiten; los enlaces se conservan como los nombres de las páginas a las que conducían.
