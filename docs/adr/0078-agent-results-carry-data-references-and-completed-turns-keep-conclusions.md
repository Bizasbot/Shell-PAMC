# ADR 0078: Los resultados del agente transportan referencias de datos y los turnos completados conservan las conclusiones

- Estado: Aceptado
- Fecha: 2026-10-08
- Extiende: ADR 0042, ADR 0072, ADR 0073

## Contexto

Una ejecución exportada de análisis de uso consumió 24 rondas del modelo y 35 llamadas para responder a una sola pregunta estadística. Once llamadas a Canvas fallaron mientras el modelo confundía los IDs de operación con los IDs de llamadas a herramientas, las rutas de envoltorios de resultados (`result-envelope`) con rutas relativas a datos, y campos anidados con campos de nivel superior. Las investigaciones completadas también volvieron a ejecutar SQL y generaron HTML en mensajes posteriores triviales.

El Agente ya declara el catálogo completo de capacidades, preserva trazas autoritativas, utiliza la autorización del ejecutor y congela las filas referenciadas en artefactos de visualización aislados (`sandboxed`). Estos límites son valiosos; la mejora corresponde a la interfaz entre los resultados de las herramientas y las solicitudes posteriores del modelo.

## Decisión

El motor de ejecución (`runtime`) del Agente añade descriptores de conjuntos de datos acotados y libres de valores a los mensajes privados del modelo. Un descriptor incluye un `data_ref` estable derivado del ID de la llamada a la herramienta y la ruta relativa a los datos, las coordenadas de origen heredadas, los campos escalares seleccionables y el recuento de filas. Los identificadores (`handles`) se resuelven únicamente contra trazas exitosas que no sean de visualización retenidas en la misma conversación. No son tokens de autorización, direcciones de red ni identificadores de operación del ejecutor.

Canvas acepta `source {data_ref}` con `fields` de nivel superior. Las coordenadas heredadas siguen siendo compatibles. Los errores de esquema explican las rutas y tipos de campos declarados sin hacer eco de los valores enviados. Las llamadas fallidas a Canvas reciben los descriptores disponibles; las fallas consecutivas reciben orientación de reparación específica. El motor de ejecución no corrige silenciosamente las llamadas ni impone un límite fijo de rondas/llamadas.

Los turnos exitosos completados contribuyen con su pregunta, imágenes, conclusión y metadatos acotados de conjuntos de datos y operaciones a las solicitudes posteriores. Los conjuntos de datos mostrados tienen prioridad. Los resultados de mutación y las negativas del operador permanecen explícitos, y los resultados omitidos nunca implican éxito. Los mensajes sin procesar, las trazas y las vistas congeladas permanecen almacenados; la asignación de presupuesto para el contexto del turno actual no cambia. Los detalles faltantes se pueden consultar a través de las capacidades existentes.

El prompt del sistema establece el vocabulario del dominio, ventanas semiabiertas consistentes, requisitos de evidencia de costos, y el alias de solicitud configurado junto con el esfuerzo como metadatos no confiables. Los alias de solicitud no son afirmaciones sobre la identidad real del modelo upstream. Los recibos de visualización reconocen la validación y el almacenamiento del lado del servidor, no la ejecución exitosa en el navegador.

## Consecuencias

- Un modelo puede reutilizar un identificador de datos proporcionado sin reconstruir IDs y rutas.
- Las solicitudes posteriores evitan reproducir transcripciones de reparación de SQL/HTML completadas mientras preservan las fuentes.
- Los resúmenes son deterministas y acotados, no una solicitud adicional de un modelo de resumen.
- Algunos detalles históricos que no son de visualización requieren otra lectura de capacidad. Se retienen hasta ocho descriptores y ocho resultados recientes de mutación/negativa por turno completado.
- La inferencia de conjuntos de datos está acotada a ocho referencias por resultado, seis niveles de objetos, 256 nodos visitados, doce campos escalares por descriptor y el límite de filas renderizables existente.
- Las proyecciones de la consola, los resultados de MCP, las puertas de aprobación, el catálogo completo de capacidades y el sandbox offline de Canvas conservan sus contratos existentes.
- Los datos vinculados a la fuente siguen siendo exactos; el marcado personalizado sin vincular sigue estando disponible. La aplicación de la procedencia para JavaScript generado arbitrario y la verificación del renderizado en el navegador requieren trabajo adicional.

## Verificación

Las pruebas de Go en `internal/agent/data_sources_test.go` ejercitan la resolución de referencias, los límites de retroalimentación privada, la reparación de esquemas, el historial acotado y un modelo de prueba (`fixture-model`) de seguimiento que dibuja las filas originales sin otra lectura. Las pruebas de prompt incluyen los alias ordinarios máximos y metadatos altamente escapados. Las proyecciones existentes de la API del Agente, la autorización, la reanudación y los escenarios de navegador siguen siendo los controles de regresión.
