# ADR 0077: La configuración del compositor utiliza listas de selección con nombre

- Estado: Aceptado
- Fecha: 2026-10-08
- Reemplaza la presentación de la escala de razonamiento y el selector de claves de cliente en
  [ADR 0076](0076-the-agent-has-its-own-shell-and-names-its-model-in-the-composer.md).
  El shell de conversación y la semántica de las solicitudes de destino permanecen sin cambios.

## Contexto

El modelo y el razonamiento son configuraciones del mismo mensaje. Los operadores necesitan leer la
elección actual, explorar alternativas y confirmar un cambio mediante la misma interacción.
El razonamiento tiene nombres cortos y discretos, mientras que un modelo puede tener un nombre de punto de llamada largo;
por lo tanto, las superficies comparten el comportamiento sin compartir un ancho fijo.

## Decisión

`ComposerPicker` gestiona el elemento flotante (popover), el disparador (trigger) y la directiva de foco para ambas configuraciones.
`ComposerPickerList` ofrece opciones con nombre mediante una parada de tabulación móvil (*roving tab stop*). Las flechas, Inicio (Home) y
Fin (End) permiten la exploración sin cambiar la solicitud; Intro (Enter), Espacio (Space) o un clic confirman la selección. La confirmación
y Escape cierran la superficie y devuelven el foco al disparador.

Las listas de modelos utilizan una superficie de 304px, marcas del fabricante y búsqueda cuando hay más de ocho nombres.
La clave del cliente es una acción secundaria de pie de página (*footer*): su lista reemplaza a la lista de modelos en la
misma superficie, y al elegir una clave diferente se regresa a los modelos disponibles para dicha clave.

Las listas de razonamiento utilizan una superficie de 180px con el valor predeterminado del modelo en primer lugar, seguido de los nombres de los parámetros
y descripciones localizadas secundarias. El disparador de texto muestra el nombre del parámetro actual
(`Low`, `High`, `Max`, `xHigh`) en todos los idiomas con tinta de primer plano a un peso regular de 400.
Estas grafías de visualización no cambian el valor de la solicitud almacenado o transmitido.
Una fila seleccionada rellena y un nombre en negrita identifican la opción actual. El razonamiento encabeza
con el nombre del parámetro; su descripción localizada está alineada al final en tinta atenuada.
Se omiten las descripciones idénticas. Las filas de modelos también muestran una marca de verificación del color de la tinta.

Ambas superficies están acotadas al *viewport* y reutilizan los tokens existentes de paleta, tipografía y movimiento.
Las filas táctiles mantienen un área de impacto (*hit target*) de 44px.

## Consecuencias

El nombre del punto de llamada del modelo, la huella digital de la clave y el valor de razonamiento se transmiten sin cambios.
El valor de razonamiento vacío sigue omitiendo el campo de solicitud; un valor almacenado específico del proveedor
permanece visible y seleccionable. El menú presenta los valores de la solicitud en lugar de garantías de velocidad del modelo o calidad de respuesta.
