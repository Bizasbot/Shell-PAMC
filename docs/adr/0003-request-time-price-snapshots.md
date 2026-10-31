# ADR 0003: Bloquear los costes de las solicitudes a las versiones de precios en el momento de la solicitud

## Estado

Aceptado

## Contexto

La consulta de costes anterior unía cada evento de uso con la fila mutable de `model_prices`.
Por lo tanto, cambiar un precio alteraba las facturas históricas y los totales del panel de control.
El ámbito de sincronización anterior también utilizaba tráfico histórico, lo que hacía que los modelos eliminados permanecieran en la lista de mantenimiento indefinidamente.

## Decisión

Mantener una instantánea duradera del catálogo actual de modelos de CPA separada del historial de uso. Una actualización completa del catálogo de CPA reemplaza atómicamente dicha instantánea; un descubrimiento parcial o fallido deja intacta la última instantánea completa. Un alias de modelo almacena su identidad de precios canónica, por lo que los alias no necesitan un mantenimiento manual separado cuando CPA cambia su destino.

Mantener `model_prices` como la proyección editable actual y añadir filas inmutables a `model_price_versions` cada vez que se cree, modifique o retire un precio.
Cuando se insértelo un evento de uso, seleccionar la última versión efectiva en la marca de tiempo de la solicitud del evento y almacenar su ID de versión junto con un coste en USD-nanos como entero en la misma transacción. Un precio ausente o no válido se almacena como uso con el estado `unpriced`/`invalid_price`, nunca como cero y nunca como una retroalimentación (*backfill*) futura. Las filas anteriores a esta migración se marcan como `legacy_unpriced` porque su precio original no se puede reconstruir.

Las ediciones manuales están restringidas al catálogo actual de CPA y están protegidas tanto en el servicio como en el *upsert* de SQL. Eliminar un precio manual retira su versión actual; la siguiente actualización del catálogo puede recrear un precio automático para futuras solicitudes sin alterar las instantáneas existentes.

## Consecuencias

- Los costes históricos se mantendrán estables ante cambios de precios, eliminación de modelos, entrega retrasada en cola y reintentos.
- La página de precios solo solicita a los usuarios que mantengan los modelos de CPA configurados actualmente.
- Las bases de datos existentes no pierden telemetría de uso, pero a las filas antiguas no se les puede asignar un coste histórico inventado.
- Una actualización del catálogo requiere una lectura exitosa de la gestión de CPA y puede esperar a que la fuente de metadatos configurada identifique las tarifas de un nuevo modelo.
