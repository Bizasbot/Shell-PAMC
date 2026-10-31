# ADR 0036: Los agentes pueden ejecutar SQL de solo lectura sobre un esquema clasificado

- Estado: Aceptado
- Superado en parte: la página del Playground, sus rutas y los ADR 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agente se mantiene (lista de modelos `GET /agent/models`, ejecuciones `/agent/runs/...`).
- Fecha: 2026-09-28

## Contexto

El registro de capacidades no exponía deliberadamente SQL: cada lectura pasaba por una capacidad declarada y de agregación, y `docs/agent-capabilities.md` enumeraba a SQL entre las cosas que un agente no debe alcanzar. En la práctica, los operadores hacían preguntas para las cuales las lecturas declaradas nunca fueron diseñadas —uniones entre solicitudes y versiones de precios, un conteo agrupado por una columna por la que ninguna capacidad agrupa, el historial de un vacío de ingesta— y el agente solo podía responder que no podía verlas.

La base de datos contiene material que ninguna respuesta debería incluir: la clave de administración de CPA (encriptada, en `cpa_instances`), cargas útiles de uso sin procesar que pueden contener claves de cliente (`usage_inboxes`), las propias sesiones y operaciones encriptadas del Agente (`agent_documents`), preferencias de operador incluyendo la conversación guardada del Playground (`ui_preferences`), y cuerpos de errores de upstream sin procesar (`error_events.body`).

## Decisión

Dos capacidades de lectura, `database_schema` y `database_query`, proporcionan SQL a los agentes bajo una política que el repositorio posee (`internal/repository/readonly_query.go`), en cuatro capas independientes:

1. **La conexión no puede escribir.** Las consultas se ejecutan en un grupo (*pool*) separado abierto con `mode=ro` y `query_only`, con `SQLITE_LIMIT_ATTACHED` en cero y tamaños acotados de valores, declaraciones, compuestos y expresiones.
2. **El texto es un único SELECT.** Un pequeño tokenizador encuentra el límite real de la declaración (incluyendo comillas y comentarios) y acepta exactamente una declaración `SELECT` o `WITH`.
3. **Se valida el programa compilado, no el texto.** Antes de ejecutarse, se lee el programa `EXPLAIN` de la declaración: cada árbol B (*b-tree*) que abre debe pertenecer a una tabla clasificada como legible, cada columna que lee —a través de una tabla o un índice— no debe ser una columna redactada, ningún índice que abra puede cubrir una columna redactada (una búsqueda en uno responde sí o no sobre el valor oculto sin leerlo), y se rechaza cualquier escritura en una tabla almacenada, transacción de escritura, tabla virtual o base de datos que no sea `main`. Se permiten escrituras de filas en los propios árboles B temporales de SQLite, que utilizan `ORDER BY ... LIMIT`, `UNION`, `DISTINCT` y CTEs recursivas. Validar el programa es lo que hace que los alias, vistas, subconsultas y CTEs no puedan sortear la política; el precio a pagar es que las funciones valor-tabla (`json_each`, `pragma_*`) no están disponibles.
4. **El resultado está acotado y enmascarado.** Como máximo 200 filas y 24 KiB, 500 caracteres por celda y 5 segundos por consulta; el texto con formato de credencial, información de usuario de una URL y direcciones de correo electrónico se enmascara en las celdas y en los mensajes de error. El enmascaramiento coincide con patrones, por lo que es un esfuerzo óptimo: un valor transformado en SQL (`hex`, `replace`, `substr`) pasa sin enmascarar. Lo que nunca debe salir se mantiene fuera mediante la capa 3, razón por la cual una columna capaz de albergar un secreto se redacta en lugar de enmascararse.

Las tablas son de inclusión voluntaria (*opt-in*). Cada tabla es legible (con sus columnas redactadas nombradas) o está oculta con una razón registrada, y una prueba falla cuando una migración agrega una tabla que no es ninguna de las dos, por lo que una tabla nueva nunca es legible por defecto.

Ambas capacidades se ofrecen únicamente al Agente integrado. Un cliente MCP posee una clave equivalente a un administrador, pero se ejecuta fuera de OMC, en un host y un modelo que el operador no eligió en la página del Agente, y el SQL de forma libre alcanza más registros de OMC en una sola llamada que cualquier lectura declarada. Los clientes MCP conservan las lecturas declaradas.

## Consecuencias

Un agente puede responder preguntas ad-hoc sobre los propios registros de OMC sin necesidad de una nueva capacidad por cada pregunta, y las capacidades declaradas siguen siendo la ruta preferida —el mensaje del sistema lo indica, debido a que se agregan en el servidor y transportan la semántica de la consola—. Los resultados de las consultas siguen yendo al modelo seleccionado y a su upstream, como ocurre con el resultado de cualquier capacidad (ADR 0027). Agregar una tabla ahora incluye una decisión de clasificación, y agregar una columna capaz de portar un secreto a una tabla legible debe incluirse en la lista de redacción de esa tabla en el mismo cambio.
