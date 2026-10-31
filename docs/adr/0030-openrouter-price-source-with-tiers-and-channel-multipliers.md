# ADR 0030: OpenRouter es la fuente de precios, y un precio incluye niveles (tiers) y un multiplicador de canal

- Estado: Aceptado
- Fecha: 2026-09-28
- Extiende: ADR 0003 (capturas de precios en el momento de la solicitud), el cual permanece sin cambios

## Contexto

Los precios se sincronizaban desde models.dev. Su catálogo lista cada modelo una vez por cada *relay* y agregador que lo revende, por lo que la coincidencia requería una tabla mantenida a mano de IDs de proveedores de "primer nivel" por familia, y aun así tarificaba algunos modelos a la tarifa de un revendedor. Un precio consistía en cuatro tarifas fijas y un multiplicador: no podía expresar que un *prompt* de más de 200K tokens cuesta el doble, o que un modelo es más económico durante la noche, a pesar de que los proveedores publican exactamente eso. Una tarifa de caché omitida por el catálogo se almacenaba como cero, lo que facturaba los tokens en caché como gratuitos.

La consola también trataba el precio como una página independiente. Una solicitud sin precio mostraba un guion sin forma de solucionarlo en el lugar donde se visualizaba; la única guía de la página era una pestaña de models.dev y un gráfico de presupuesto simulado.

Por último, CPA enruta un modelo a través de varios canales (una suscripción OAuth, la propia API del proveedor, un *relay* que revende con descuento) y un único multiplicador por modelo no puede expresar que el mismo modelo cuesta el 30% del precio de lista a través de uno de ellos.

## Decisión

1. **La lista pública de modelos de OpenRouter es la única fuente automática.** Lista un modelo una vez bajo el espacio de nombres de su creador, incluye *slugs* canónicos fechados y publica anulaciones (*overrides*) para contextos largos y horarios del día. La URL es una constante y no requiere clave. Se elimina models.dev; las filas que este tarificaba conservan su tarifa y fuente `modelsdev` hasta que una sincronización las coincida, y las versiones escritas bajo este siguen siendo tarificables.
2. **Una tarifa de caché faltante es la tarifa del *prompt*, no cero.** Una omisión significa que no se publica ningún descuento.
3. **Un precio incluye niveles (*tiers*).** Un nivel se aplica cuando se cumple cada condición que contiene: un umbral de *prompt* contado sobre la entrada completa, una ventana UTC semiabierta leída de la propia marca de tiempo de la solicitud; y exactamente un nivel rige una solicitud: el umbral más alto, luego un nivel con ventana, y finalmente el orden almacenado. El nivel se elige dentro de la transacción de inserción y su índice se almacena junto con el costo, de modo que una solicitud ingerida tarde se tarifa según cuándo se ejecutó, no cuándo llegó.
4. **Un multiplicador de canal se bloquea como un precio.** Los canales son las etiquetas de proveedores que CPA registra en una solicitud. Los multiplicadores están versionados y son de solo adición (*append-only*), la versión vigente en la marca de tiempo de la solicitud se almacena junto con la versión del precio, y un canal faltante o retirado es 1×. Costo = base por niveles × multiplicador del modelo × multiplicador del canal, redondeado una vez.
5. **Tres modos de tarificación.** `auto` sigue la coincidencia automática, `linked` sigue un modelo de OpenRouter elegido por el operador, `custom` utiliza las tarifas del operador. Una sincronización actualiza los dos primeros y nunca toca el tercero, y nunca reemplaza una fijación (*pin*) con su propia coincidencia. Un nombre que solo se asemeja a un modelo listado se sugiere, nunca se empareja automáticamente.
6. **La tarificación ocurre donde se visualiza un costo.** Un editor se abre *in situ* desde el libro de precios, la lista de solicitudes, el panel lateral de solicitudes y la clasificación de modelos del panel de control. El detalle de una solicitud explica su importe almacenado a partir de las versiones que bloqueó.

## Consecuencias

- La migración 028 reconstruye `model_prices` y `pricing_sync_state` (SQLite no puede relajar una restricción CHECK) descartando los desencadenadores (*triggers*) de versión, por lo que las filas existentes se copian textualmente y no se retarifica nada; `model_price_versions` solo se amplía porque las instantáneas de solicitudes la referencian.
- El control del esquema de precios pasa a la versión 28.
- El costo registrado de una solicitud ahora puede diferir de `tarifas × tokens` de su precio base: el desglose nombra el nivel y ambos multiplicadores para que la diferencia se explique en lugar de resultar sorprendente.
- Los precios automáticos cambian cuando lo hacen los de OpenRouter, en la siguiente sincronización. Ese es el propósito de `auto`; un operador que desee una tarifa fija elige `custom`.
- La demo ya no incluye tarifas escritas a mano para los modelos sincronizados: los tarifa a partir de una copia recortada de la lista real de OpenRouter con el decodificador y el comparador de producción.
