# ADR 0083: Las ejecuciones del Agente conservan el trabajo que la tarea necesita

- Estado: Aceptado
- Sustituido en parte: la página del Playground, sus rutas y los ADR 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agente permanece (lista de modelos `GET /agent/models`, ejecuciones `/agent/runs/...`).
- Fecha: 2026-10-08
- Modifica: las políticas de dimensionamiento de solicitudes/sesiones del Agente en los ADR 0042, 0072, 0074, 0075 y 0078,
  y las políticas de tamaño de diario y duración de ejecución del Agente en el ADR 0044. El Playground mantiene sus propios
  límites y contrato de persistencia.

## Contexto

Una investigación puede requerir más rondas, resultados o evidencia retenida de lo que permite una
estimación a nivel de aplicación. El contrato del Agente adoptado permite que la tarea y el operador determinen cuándo termina el trabajo,
mientras que el proveedor externo determina si una solicitud cabe en su ventana de contexto real. Una estimación local
de bytes a tokens no puede establecer ese límite de forma fiable.

## Decisión

El Agente no tiene un límite máximo a nivel de aplicación de tokens, rondas del modelo, llamadas a herramientas, conteo de visualización o duración de ejecución.
Las solicitudes al modelo incluyen los intercambios del turno activo en su totalidad. Los turnos anteriores ya consolidados
aportan conclusiones y metadatos de procedencia acotados a través de `buildCompletedTurnMessages`;
la transcripción almacenada sigue siendo la autoridad y no se recorta para ajustarse a un presupuesto de tamaño de sesión.
Los documentos de sesión están exentos del límite de bytes por documento del repositorio.

Los diarios de ejecución del navegador del Agente crecen con la ejecución en lugar de cancelarla al alcanzar un límite de bytes.
Permanecen locales al proceso, retienen la última ejecución completada durante 15 minutos y son reemplazados por ejecuciones posteriores.
La detención y el cierre de la aplicación aún cancelan la ejecución; la desconexión de una suscripción del navegador
no lo hace. Los llamadores de transmisión directa (*direct-stream*) conservan la cancelación por contexto de solicitud.

La validación de cargas útiles, la autorización, las aprobaciones vinculadas a revisiones y el sandbox no cambian.
Los límites de mensajes/imágenes, la inclusión de las ocho imágenes más recientes, los límites de resultados de capacidades, la validación de cargas útiles de visualización,
las líneas SSE de 1 MiB y los tiempos de espera de inactividad de encabezados/transmisión de 120 segundos de la pasarela (*gateway*) siguen aplicándose.
Las comprobaciones de compacidad del prompt y del catálogo son aserciones de regresión, no presupuestos de tareas en tiempo de ejecución.

## Consecuencias

Las conversaciones largas aumentan el tamaño de la base de datos y de las copias de seguridad, el costo de serialización, la memoria, el tamaño de las solicitudes al modelo
y los costos del proveedor. Un proveedor puede rechazar un contexto sobredimensionado; OMC no elimina silenciosamente
la investigación activa para hacer que encaje. Los operadores supervisan los recursos, detienen el trabajo activo
cuando es apropiado e iniciam una nueva conversación para liberar el historial y las imágenes retenidas.

Esto cambia un límite fijo de recursos de la aplicación por la preservación del trabajo. No proporciona
una ejecución en segundo plano duradera: un reinicio del proceso pierde los diarios e interrumpe las ejecuciones activas.
Los efectos de las capacidades ya realizados nunca se repiten mediante reproducción. La guía operativa pertenece
a `docs/operations.md`; las pruebas ordinarias de Go y de recuperación del navegador continúan aplicando la cancelación,
los límites de permisos y el comportamiento diferenciado de los diarios del Agente y del Playground.
