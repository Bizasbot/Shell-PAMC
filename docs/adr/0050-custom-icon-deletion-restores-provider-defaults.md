# ADR 0050: La eliminación de iconos personalizados restaura los valores predeterminados del proveedor

- Estado: Aceptado
- Fecha: 2026-10-02
- Reemplaza: La política de eliminación de protección por referencias en el ADR 0049. Sus decisiones sobre almacenamiento de activos, validación y marcas permanecen sin cambios.

## Contexto

Un activo compartido puede tener varias asignaciones de proveedores, incluidas anulación por claves de nombres heredadas. Exigir a los operadores que localicen y cambien cada asignación antes de eliminar un icono no deseado dificulta innecesariamente el mantenimiento de la biblioteca. Simplemente eliminar la obra de arte dejaría referencias huérfanas, mientras que sustituir un ID de catálogo fijo anularía los valores predeterminados apropiados para diferentes familias de proveedores e identidades de complementos.

## Decisión

Permitir la eliminación de iconos personalizados referenciados previa confirmación explícita. El selector muestra el activo, su recuento de referencias actual y la consecuencia: todos los proveedores afectados vuelven a su icono predeterminado normal o marcador de posición. El botón Cancelar recibe el foco inicial. La edición, la exploración de la biblioteca y la confirmación de eliminación siguen siendo vistas dentro del selector existente en lugar de superposiciones adicionales.

El repositorio elimina cada anulación exacta `custom:<id>` del mapeo persistido `provider_icons` y elimina el activo en una sola transacción. Las asignaciones no relacionadas y las claves de preferencias permanecen sin cambios. El fallo en la eliminación del activo, los activos faltantes y la aprobación obsoleta ligada a revisión revierten todo el restablecimiento. Las escrituras de preferencias continúan validando los ID personalizados dentro de su propia transacción, por lo que la selección/eliminación concurrente no puede crear referencias huérfanas.

La eliminación por parte de Agentes/MCP sigue siendo destructiva y de alto riesgo. Su confirmación incluye el recuento de referencias y el impacto del restablecimiento predeterminado, nunca los bytes de la obra de arte; la aprobación se aplica a la revisión del activo y restablece todas las asignaciones presentes en el momento de la ejecución. La eliminación invalida tanto los metadatos de los iconos como las preferencias. El selector refleja solo las anulaciones coincidentes en su caché de preferencias compartidas, evitando una nueva obtención de todo el documento por ediciones optimistas no relacionadas, y borra cualquier selección de borrador en el panel del proveedor que coincida.

## Consecuencias

Los operadores pueden eliminar obras de arte no deseadas sin tener que navegar a cada proveedor. La eliminación de una anulación preserva la autoridad del complemento y la resolución predeterminada por superficie en lugar de congelar una elección del catálogo. La eliminación borra permanentemente el activo y sus asignaciones; la recuperación requiere la copia de seguridad de la base de datos existente o volver a importar la obra de arte. Los recuentos de referencias son una instantánea explicativa, no un bloqueo en las asignaciones mientras la confirmación está abierta.
