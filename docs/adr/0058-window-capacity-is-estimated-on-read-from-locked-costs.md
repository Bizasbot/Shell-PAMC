# ADR 0058: La capacidad de la ventana se estima al leer de los costos bloqueados

- Estado: Aceptado
- Fecha: 2026-10-05

## Contexto

Una credencial de suscripción informa qué porcentaje de una ventana de cuota se utiliza, pero nunca en cantidad. Los operadores quieren saber el valor de una ventana: cuántos dólares de tráfico con precio de API, o cuántos tokens, compra el 100% de esta. OMC ya posee ambas Mitades de esa respuesta. `internal/quota` normaliza la parte utilizada, el instante de restablecimiento y el período de cada ventana, y `usage_events` registra cada solicitud atendida por una credencial con un costo bloqueado en el momento de la solicitud.

Dos herramientas existentes derivan la cifra de la misma manera (el uso registrado dividido por la parte utilizada) y difieren en aquello de lo que se protegen. Una la calcula en el navegador para la ventana de un solo proveedor sin otra protección que una parte positiva. La otra también la calcula en el navegador, re-cotiza el historial a los precios actuales y mantiene un ciclo de vida persistente de los ciclos de ventana (tres tablas y sus transacciones) para saber dónde comienza un ciclo y si se restableció antes de tiempo. Ninguna de las dos retiene una estimación cuando el porcentaje de uso es bajo, donde el redondeo de puntos enteros del proveedor domina el resultado.

## Decisión

Estimar la capacidad de una ventana en el servidor, cuando se lee una cuota.

- **La aritmética es pura y reside en `internal/quota`**; `internal/api` suministra sus entradas desde `internal/repository`. La consola, las capacidades del agente y la demostración generada leen un único resultado.
- **El rango de uso termina en la observación**, `[reset − period, observed_at)`. La parte utilizada y el uso describen entonces el mismo intervalo sin una regla que rechace una estimación cada vez que una solicitud sea más reciente que la lectura.
- **El costo es la suma de las instantáneas de costo de solicitud (Request Cost Snapshots).** Una estimación no se reescribe por un cambio de precio posterior, y un ciclo con más del 5% de sus solicitudes sin precio obtiene únicamente una estimación de tokens.
- **No se persiste nada.** Los campos se unen después de almacenar una instantánea y nunca entran en `quota_snapshots`, por lo que el uso ingerido después de una observación se cuenta en la siguiente lectura y no se necesita migración.
- **Un restablecimiento a mitad de ciclo se lee de las instantáneas que una credencial ya conserva**: una lectura anterior dentro del mismo ciclo que sea mayor que la actual retiene la estimación. No se almacena ningún ciclo de vida.
- **Se retiene una estimación por debajo del 5% de uso**, y cada estimación incluye el error relativo que medio punto porcentual le imprime.
- **El alcance son las ventanas de las que depende cada solicitud**: Codex y Claude de 5 horas y semanales. Las ventanas con alcance de modelo y de características quedan excluidas hasta que el uso pueda coincidir con su alcance.

## Consecuencias

- La cifra es honesta acerca de su precisión y está ausente cuando podría inducir a error, a costa de no mostrar nada al principio de un ciclo.
- El tráfico que omitió la pasarela es invisible para el numerador, por lo que la estimación es un límite inferior para una credencial utilizada también en otros lugares. La consola lo indica junto a la cifra.
- La cuota que mide no se contabiliza en dólares de API en el origen, por lo que la estimación se mueve con la combinación de modelos. Es una lectura para el operador y no debe alimentar el enrutamiento ni el estado de una credencial.
- Cada lectura de resumen cuesta un agregado indexado por ventana elegible y una lectura de historial de instantáneas por cada credencial que tenga una. Esto es proporcional al número de credenciales de suscripción, que es pequeño.
- Sin un ciclo de vida almacenado no hay alternativa para el ciclo anterior: justo después de un restablecimiento, una ventana no muestra estimación hasta que se usa el 5%. Se puede agregar una alternativa derivada del historial de instantáneas sin cambiar esta decisión.
- Un ciclo cuyo instante de restablecimiento es solo aproximado no obtiene estimación, porque su inicio no puede ubicarse.
