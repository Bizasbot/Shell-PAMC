# ADR 0100: Una biblioteca de fuentes servida desde el propio origen de la consola

- Estado: Aceptado
- Fecha: 2026-10-16

## Contexto

La consola renderiza todo utilizando una única tipografía empaquetada, Sarasa Mono SC, dividida en
fragmentos de `unicode-range` (ADR 0094). Los lectores consideraron que una interfaz monoespaciada resulta cansada para
lecturas prolongadas y solicitaron que la tipografía sea una opción configurable, ofreciendo familias comunes
(issue #208).

Dos restricciones moldean la respuesta. La consola no carga nada desde otro origen (sin CDN,
y su propia política permite fuentes únicamente desde sí misma o en línea (`font-src 'self' data:`), por lo que
enlazar una hoja de estilos de Google Fonts desde la página no está disponible. Además, un despliegue debe
seguir funcionando sin red una vez configurado, por lo que una tipografía no puede depender de que un host
sea accesible cada vez que se carga una página.

## Decisión

**Una biblioteca, dos roles.** El operador elige una fuente de interfaz (`ui`) y una
fuente monoespaciada (`mono`) por separado, en OMC Settings → Appearance, almacenadas como la
preferencia `omc_fonts`. Cada rol nombra una tipografía integrada (la Sarasa Mono SC
empaquetada, que sigue siendo la predeterminada, o la propia pila sans-serif, serif o monoespaciada de la plataforma) o
una familia de la biblioteca de fuentes del despliegue. El formato sigue la Biblioteca de Fuentes de WordPress:
instalar una familia y elegir una para un rol son actos separados, por lo que una elección nunca
descarga nada y vuelve a pintar la consola en el fotograma en que se realiza. La página de configuración
contiene únicamente los dos selectores de roles; la instalación, carga y eliminación de familias se realizan en un
diálogo de biblioteca que esta abre.

**La biblioteca se llena desde el servidor y se sirve desde el propio origen de la consola.** Una familia
llega de una de estas dos maneras:

- *Carga (Upload).* Archivos WOFF2, WOFF, TrueType o OpenType, reconocidos por su firma en lugar de
  por su nombre o tipo declarado. El peso, estilo, eje de peso y familia se leen de las
  propias tablas `OS/2`, `fvar` y `name` de la fuente cuando el contenedor las expone (las tablas comprimidas con Brotli
  de WOFF2 se leen a partir del nombre del archivo).
- *Google Fonts.* El servidor solicita la hoja de estilos de la familia con la identidad de
  un navegador actual, lo que produce archivos woff2 divididos en fragmentos de `unicode-range`, y descarga cada
  archivo que esta nombra. Solo se instalan regular y bold (normal y negrita), los dos pesos que utiliza la
  escala tipográfica de la consola. Las descargas se limitan a los hosts de fuentes de Google o al dominio registrable
  del espejo configurado (`OMCPA_GOOGLE_FONTS_URL`), respetando los sufijos públicos y los límites de inquilinos privados.
  Se permiten los subdominios del mismo sitio; los hosts IP y los espejos locales
  requieren una coincidencia exacta del nombre de host. La misma restricción se aplica a las redirecciones, por lo que una
  hoja de estilos no puede dirigir al servidor fuera de este límite.

Ambos se almacenan en SQLite (`fonts`, `font_faces`, migración 042) y se sirven desde
`/fonts/{id}/faces/{faceId}`, inmutables bajo sus ids. El navegador declara cada cara
con su `unicode-range` almacenado, por lo que, al igual que con la tipografía empaquetada, solo descarga
los fragmentos que una página dibuja. Una familia se declara bajo su id de biblioteca en lugar de su propio nombre,
por lo que una copia local de la misma familia no puede suplantar a la almacenada. Cada rol recurre
a la tipografía empaquetada como respaldo, la cual dibuje cualquier carácter que le falte a la familia elegida.

**La elección dibuja el primer fotograma.** Los roles resueltos se reflejan en localStorage,
tal como se hace con el tema, de modo que la próxima visita y la pantalla de inicio de sesión se renderizan con la cara
elegida antes de cualquier solicitud.

**Eliminar una familia borra los roles que la utilizaban** en la misma transacción, y
se verifica la referencia de un rol contra la biblioteca en el momento de ser escrita.

## Consecuencias

- El servidor realiza una solicitud saliente únicamente cuando un operador instala una familia desde
  Google Fonts. Un despliegue que no pueda acceder a Google puede nombrar un espejo compatible o
  cargar los archivos; una vez instalada, ninguna característica de una familia requiere red.
- El contrato offline de la página permanece inalterado: cada archivo de fuente que carga el navegador proviene
  del origen de la consola.
- Una familia china cuesta alrededor de 10–20 MB de base de datos por instalación. La biblioteca está limitada
  a 32 familias, una instalación a 96 MiB y un archivo a 32 MiB.
- Las conversaciones exportadas siguen incrustando la cara monoespaciada empaquetada (su aspecto portable
  es el predeterminado de la consola, no la preferencia del lector).
- La demostración tiene una biblioteca vacía y rechaza instalaciones, cargas y eliminaciones.
