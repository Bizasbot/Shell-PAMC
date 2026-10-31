# ADR 0049: Los iconos personalizados son activos duraderos con referencias protegidas

- Estado: Aceptado
- Fecha: 2026-10-02

## Contexto

Los operadores necesitan ilustraciones reutilizables más allá del catálogo integrado. Almacenar Data URLs de imágenes completas en la preferencia del proveedor duplicaría las cargas útiles, incrementaría cada lectura de preferencias y evitaría un reemplazo significativo o una eliminación consciente de referencias. Los archivos fuera de SQLite añadirían una segunda frontera de respaldo y restauración. Las importaciones de SVG arbitrarias permitirían contenido activo o cargado remotamente.

## Decisión

Almacenar las ilustraciones estáticas validadas como activos de SQLite con IDs estables y revisiones de contenido monótonas. Las preferencias del proveedor conservan pequeñas referencias de cadenas de texto junto con sus IDs de catálogo existentes. Las importaciones de archivos y Base64 comparten la validación del servidor; el SVG se reconstruye a partir de una lista blanca explícita de XML estático antes de la vista previa o el almacenamiento. Las respuestas de contenido autenticado del mismo origen preservan la operación offline y la revalidación privada basada en revisiones sin enviar toda la biblioteca de imágenes en las respuestas de lista.

Renombrar o reemplazar un activo actualiza cada asignación. Se rechaza la eliminación mientras cualquier mapeo persistido haga referencia a él, incluyendo una clave de nombre heredada. La validación de asignaciones y las comprobaciones de eliminación ocurren dentro de sus respectivas transacciones de repositorio en la única conexión SQLite existente. El agente y MCP comparten las mismas reglas, con una confirmación explícita vinculada a la revisión para la eliminación. La identidad propiedad del plugin sigue siendo autoritativa.

## Consecuencias

Las copias de seguridad de la base de datos incluyen ilustraciones automáticamente. Los estilos y recursos de SVG no compatibles deben ser convertidos a ilustraciones estáticas aceptadas por el operador; la consola no reescribe las importaciones inseguras de manera silenciosa. La biblioteca y los activos individuales tienen tamaños acotados. Las ediciones de proveedores en borrador no retienen referencias persistidas, por lo que un activo eliminado en otra parte antes de la asignación es rechazado cuando se guarda la preferencia. El límite de capacidad existente sigue siendo menor que el límite de importación del navegador.
