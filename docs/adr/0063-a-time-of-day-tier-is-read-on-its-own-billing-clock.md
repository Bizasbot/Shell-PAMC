# ADR 0063: Un nivel de tarifa por hora del día se lee en su propio reloj de facturación

- Estado: Aceptado
- Fecha: 2026-10-06
- Extiende: ADR 0030, cuya regla de niveles permanece inalterada aparte del reloj en el que se lee una ventana.

## Contexto

ADR 0030 estableció los niveles de precio por hora del día como una ventana UTC semiabierta, debido a que así es como los publica OpenRouter. El editor permitía a un operador escribir la ventana en la zona horaria del OMC y la convertía a UTC según el desfase de la zona en el día de la edición.

Los proveedores no facturan bajo un mismo reloj. DeepSeek publica sus horas de tarifa valle en hora de Pekín, otros en hora del Pacífico o del Este de EE. UU., y un despliegue enruta solicitudes a varios de ellos. Ni UTC ni la zona horaria del OMC pueden ser correctas para todos al mismo tiempo: la zona horaria del OMC es una preferencia de visualización para toda la consola (ADR 0039), y una ventana convertida a UTC una sola vez se desvía una hora durante medio año en cualquier lugar donde el proveedor observe el horario de verano.

## Decisión

1. **Un nivel nombra su propio reloj.** `PriceTier` adquiere el campo `time_zone`, un nombre IANA validado por `timezone.Load`. Una ventana se evalúa frente al instante propio de la solicitud ubicado en el reloj de pared de dicha zona; si la zona está ausente, se asume UTC. La zona pertenece al nivel, por lo que un precio puede contener ventanas en diferentes relojes, y es independiente de la zona horaria del OMC.
2. **La representación almacenada de los niveles existentes no cambia.** Los campos de la ventana conservan sus nombres `utc_start` / `utc_end` y se omite `time_zone` cuando está vacío. El activador de versiones (`version trigger`) compara el texto del nivel almacenado, por lo que renombrar los campos generaría una nueva versión de precio para cada precio escalonado en la siguiente sincronización. El editor escribe una ventana UTC sin zona por la misma razón.
3. **Las horas se almacenan tal como se publican, sin conversión alguna.** El editor, la API HTTP y las capacidades del agente aceptan las horas del proveedor junto con la zona del proveedor.
4. **Una zona que no se pueda leer nunca se aplica.** La validación la rechaza al escribir; si una zona almacenada fallara al cargarse, se omite el nivel en lugar de leerse como UTC.
5. **El mecanismo de bloqueo (`lock`) no cambia.** `pricing.Quote` sigue siendo la única implementación, la consola la refleja en `web/src/types/pricingDisplay.ts`, y una solicitud registrada conserva el índice del nivel y la versión de precio que bloqueó (ADR 0003).

## Consecuencias

- `utc_start` y `utc_end` son nombres incorrectos (`misnomers`) en un nivel que especifica una zona. Las descripciones de los campos que ve el agente y los comentarios de tipos así lo indican; se consideró que un cambio de nombre no justificaba generar una versión por cada precio escalonado ni mantener una segunda estructura de datos (`wire shape`) de manera indefinida.
- El binario de Go ya incluye la base de datos de zonas horarias (`time/tzdata`), por lo que la regla no depende del sistema host. Las zonas cargadas se almacenan en caché, ya que se selecciona un nivel para cada solicitud ingerida.
- Alrededor de un cambio de horario de verano, una ventana de reloj de pared es una hora más corta o más larga en tiempo absoluto, que es exactamente el comportamiento del medidor propio del proveedor.
- El navegador lee las zonas a través de `Intl`. Si el servidor acepta una zona que un navegador antiguo desconoce, la vista previa del editor omite ese nivel; la cantidad calculada por el servidor es autoritativa en cualquier caso.

## Alternativas rechazadas

- **Una zona de facturación a nivel de despliegue.** Una configuración global adicional que de todos modos sería incorrecta para el segundo proveedor.
- **Un desfase UTC fijo por nivel.** Simple, pero incorrecto ante los cambios de horario de verano, y `Etc/GMT-8` ya expresa un desfase fijo cuando este es deseado.
- **Convertir a UTC en el editor.** El comportamiento que se está reemplazando.
