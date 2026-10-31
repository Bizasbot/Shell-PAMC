# ADR 0062: Las estadísticas del panel son hechos de uso permanentes; los registros de solicitudes rotan

- Estado: Aceptado
- Fecha: 2026-10-06
- Reemplaza: El razonamiento de "una sola fuente, leer la tabla de detalles" en el ADR 0005 para la consulta de la cuadrícula de tokens, y las agregaciones (*rollups*) generales por hora/día. La decisión de la cuadrícula DOM del ADR 0005 permanece sin cambios.

## Contexto

El uso se almacena tres veces en tres tamaños distintos. En un despliegue con 121 302 registros de solicitudes durante 23.5 días, las cargas útiles capturadas (`usage_inboxes`) ocupaban el 82.5% de una base de datos de 710 MB, los registros de solicitudes tipados (`usage_events`) y sus índices aproximadamente el 16%, y las agregaciones por hora y día una fracción del uno por ciento.

La retención eliminaba los tres componentes en el mismo horizonte temporal. Las agregaciones (*rollups*) no incluían costo, proveedor ni credencial, por lo que el mosaico de costos, los paneles de modelos, la lista de proveedores y la cuadrícula de tokens leían los registros de solicitudes directamente. En consecuencia, un panel nunca podía mostrar un período mayor al horizonte de retención, y mantener las estadísticas por más tiempo significaba conservar las dos tablas más grandes durante más tiempo. El horizonte predeterminado era de 400 días únicamente para que la cuadrícula de tokens de un año se mantuviera legible.

Los operadores prefieren el acoplamiento inverso: estadísticas durante todo el tiempo que exista el despliegue, y detalles solo durante el tiempo que resulten útiles.

## Decisión

1. **Dos tablas de hechos permanentes.** `usage_facts_15m` y `usage_facts_daily` están indexadas por intervalo (*bucket*), grupo de claves de cliente, modelo, alias de modelo, credencial, proveedor y tipo de autenticación, y almacenan cada métrica que un panel muestra, incluida la instantánea del costo en el momento de la solicitud. Nunca se depuran.
2. **Quince minutos es la granularidad fina.** Cualquier desfase horario civil UTC en uso es un múltiplo de quince minutos, por lo que un día calendario local equivale a un número exacto de intervalos en cualquier zona horaria. Una granularidad por hora no puede dar soporte a `+05:30`.
3. **Un consolidado (*fold*), un punto de control (*checkpoint*), dividido por ID de evento.** Ambas granularidades se escriben en una sola transacción bajo el punto de control `facts`. Una lectura toma los hechos para los ID iguales o anteriores al punto de control y los registros de solicitudes posteriores a este, en una sola sentencia SQL. Los tiempos de los eventos llegan desordenados, por lo que un límite basado en marcas de tiempo contaría un registro tardío dos veces.
4. **Una capa de consulta.** `Repository.QueryUsageFacts` da servicio a todos los paneles; un nuevo panel añade una agrupación o una métrica a esta función en lugar de realizar otro recorrido (*scan*) sobre los registros de solicitudes.
5. **Cada tabla declara un ciclo de vida.** `TABLE_LIFECYCLES` clasifica cada tabla como permanente, rotativa, limitada por el propietario o reemplazada, aplicando la regla que expira sus filas. Una prueba falla si una tabla no está declarada, asegurando que cada nueva característica especifique cómo finaliza su vida útil al ser añadida. Un único motor, `RunLifecycle`, elimina registros en lotes pequeños, nunca borra un registro de solicitud que los hechos no hayan absorbido y registra el instante alcanzado.
6. **Las cargas útiles se eliminan primero.** Una carga útil que ha sido decodificada en un registro de solicitud se conserva durante siete días por defecto (`OMCPA_USAGE_INBOX_RETENTION_DAYS`), y se almacena una sola vez: el texto cifrado, sin una segunda copia redactada al lado.
7. **Una ventana de panel histórico completo.** `preset=all` comienza desde el primer uso registrado. Esta opción es ofrecida únicamente por el panel; la lista de solicitudes lee los registros de solicitudes y mantiene sus ventanas acotadas.
8. **Los registros de solicitudes se establecen en noventa días por defecto**, reduciéndose desde los 400 anteriores. El horizonte más largo existía únicamente para la cuadrícula de tokens, la cual ya no lee los registros de solicitudes. Noventa días es la ventana más amplia que ofrece la lista de solicitudes, por lo que cada valor predeterminado (*preset*) que muestra está completamente respaldado.

## Consecuencias

- Las lecturas del panel escalan en función de las combinaciones de dimensiones distintas por intervalo en lugar de hacerlo según el número de solicitudes: la lectura agrupada de modelos sobre 100 000 registros pasó de aproximadamente 0.74 s a unos 0.02 s una vez consolidada.
- Más allá del horizonte de detalles, la ventana se amplía a intervalos completos de quince minutos y no se puede representar con mayor precisión. La respuesta informa los límites que fueron leídos.
- Las estadísticas de las solicitudes eliminadas antes de este cambio no se pueden recuperar; los hechos se retroalimentan a partir de los registros de solicitudes que aún existen mediante el proceso de consolidación ordinario.
- Las dimensiones de una fila de hechos son fijas en el momento de la consolidación. Una nueva dimensión requiere una migración y solo puede retroalimentarse hasta donde los registros de solicitudes aún alcancen.
- La eliminación de filas no reduce el tamaño del archivo. El espacio se libera en el sistema de archivos únicamente mediante la compactación iniciada por el operador.
- Volver a decodificar tras una corrección en el decodificador solo es posible dentro del período de retención de la carga útil.
- Al actualizar, un despliegue que no configure ninguna de las dos variables perderá los registros de solicitudes anteriores a noventa días y las cargas útiles decodificadas de más de siete días, una vez que los hechos las hayan absorbido. Las estadísticas no se verán afectadas. Configurar `OMCPA_USAGE_RETENTION_DAYS=400` y `OMCPA_USAGE_INBOX_RETENTION_DAYS=0` antes de actualizar mantiene el comportamiento previo.
