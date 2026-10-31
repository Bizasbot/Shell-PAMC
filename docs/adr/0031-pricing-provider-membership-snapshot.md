# ADR 0031: La pertenencia a un proveedor viaja con el catálogo de precios

- Estado: Aceptado; el ADR 0101 propone anulaciones de precios personalizadas específicas de cada canal.
- Fecha: 2026-09-28

## Contexto

El banco de trabajo de Costes y Uso (Cost & Usage workbench) debe agrupar los modelos según los proveedores de IA y OAuth configurados que gestionan los operadores. Un autor de OpenRouter es un creador de modelos, no necesariamente el proveedor que ofrece dicho modelo. Los modelos pueden estar disponibles a través de varios proveedores. El descubrimiento en directo por credencial al abrir la página añadiría dispersión de red (*network fanout*) y permitiría que lecturas parcialmente fallidas tergiversaran la pertenencia.

## Decisión

Recopilar la pertenencia a proveedores (no secretos) durante el mismo barrido completo de descubrimiento de CPA que resuelve los alias de los modelos. Publicarlo de forma atómica con el catálogo de modelos autoritativo en `pricing_catalog_state.providers_json` mediante la migración aditiva 029. Un barrido fallido conserva la instantánea anterior completa. Las proyecciones en tiempo de lectura reutilizan las capas de nombres para mostrar/iconos de gestión, así como los valores predeterminados de proveedores y los logotipos propiedad de los complementos existentes en la consola.

Los proveedores basados en claves API conservan sus IDs de gestión. Las credenciales OAuth activas se agrupan por proveedor, utilizando la prioridad máxima de la credencial para el orden de los grupos. Un modelo compartido aparece bajo cada proveedor configurado pero mantiene una única identidad de precio global. La procedencia faltante se muestra explícitamente como no confirmada en lugar de inferirse a partir del nombre de un modelo. Los destinos de alias en conflicto siguen siendo entradas válidas del catálogo con un destino de precio vacío, lo que evita la coincidencia automática sin bloquear otros modelos.

Los grupos de proveedores se ordenan por prioridad descendente, seguida de nombre natural y ID estable. Dentro de cada grupo, los nombres de los modelos se ordenan de forma natural con un orden primario insensible a mayúsculas/minúsculas y empates resueltos dando prioridad a las mayúsculas. Una única página global limita todos los grupos a 20 filas de pertenencia. Las marcas de los proveedores pertenecen a los encabezados de los grupos; los metadatos de identidad del modelo conservan un punto de extensión para la futura propiedad del directorio de modelos.

## Consecuencias

- Las lecturas del banco de trabajo se mantendrán locales y sobrevivirán a las interrupciones de CPA utilizando la última instantánea completa.
- La pertenencia puede retrasarse respecto a la configuración hasta que se produzca la reconciliación; ninguna instantánea en directo incompleta la reemplazará.
- La instantánea JSON no añade ninguna dimensión de precio por modelo y no puede reescribir los costes históricos.
- La funcionalidad existente `pricing_list` puede exponer la pertenencia para su página delimitada sin lecturas de credenciales ni nuevos permisos de escritura.
- Las identidades de proveedores posicionales conservan los mismos requisitos de cambio de clave (*re-keying*) que los metadatos de gestión de proveedores.
