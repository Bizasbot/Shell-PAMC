# ADR 0028: Una sola compilación da servicio a CPA v7 y v8, ubicando la configuración según la estructura del archivo

- Estado: Reemplazado por ADR 0034
- Fecha: 2026-09-27

## Contexto

CPA v8 trasladó la mayoría de los parámetros de configuración a nuevas secciones y otorgó a la
clave raíz `api-keys` un nuevo significado (grupos de proveedores *upstream* en lugar de claves de clientes).
Aún lee un archivo v7 sin modificaciones, mantiene toda la API `/v0/management` y añade un
árbol `/v8/management`. Una operación de escritura de configuración en v8 migra y reescribe el archivo completo.

Frente a un archivo migrado, el editor de configuración y la página de Claves de OMC escribían rutas v7
a través de `PUT /v0/management/config.yaml`. CPA aceptaba el guardado, respondía con éxito, conservaba
el valor de v8 y borraba la edición. Escribir la lista de claves de cliente en la raíz también borraba
todas las credenciales de los proveedores *upstream*. Nada en la respuesta revelaba alguna de las dos pérdidas.

Los despliegues ejecutarán ambas generaciones durante algún tiempo, y una sola compilación de OMC tiene que dar
servicio a ambas sin necesidad de un interruptor para el operador.

## Decisión

1. **Detectar, nunca comparar versiones.** La generación de la API se determina leyendo
   `/v8/management/config/config-version` y exigiendo el valor `8`. La estructura del archivo
   (`legacy`, `v8`, `mixed`) se determina a partir del propio documento. Ambos hechos se
   exponen a la consola, y la generación de la API es también una clave de capacidad
   (`management-v8`).
2. **La ubicación sigue al documento, no a la pasarela.** Un archivo heredado (*legacy*) se edita en rutas v7
   en cualquiera de las pasarelas; un archivo v8 o mixto, en rutas v8, leyendo la nomenclatura heredada
   como alternativa (*fallback*) y eliminándola al escribir. OMC nunca realiza una escritura de configuración v8,
   por lo que nunca desencadena la migración en nombre del operador.
3. **Una única tabla de reubicación, la propia de CPA.** La tabla se toma del código fuente de CPA
   (`internal/cpa/configyaml/layout_rules.go`) y se envía a la consola junto con la
   configuración, de modo que el editor y el mecanismo de protección (*guard*) del lado del servidor lean las mismas filas.
4. **Rechazar lo que CPA descartaría silenciosamente.** A menos que se sepa que la pasarela carece de la API v8,
   se rechaza antes de llegar a CPA cualquier guardado de documento completo que contenga una nomenclatura heredada
   junto a su homóloga en v8, o que reemplace los grupos de proveedores almacenados.
5. **Las operaciones prefieren las rutas v8 solo donde v8 reutiliza el *handler* de v0**, y recurren
   a v0 cuando falta la ruta v8. Todo lo demás permanece en v0.

## Consecuencias

- Una pasarela v7 ve exactamente las mismas solicitudes que veía antes, aparte de una sonda en caché.
- La tabla es una instantánea de una versión de CPA y debe volverse a derivar cuando cambie la versión
  fijada (`docs/cpa-v8-compat.md` §10). Un parámetro que CPA mueva en una versión posterior no será ubicado
  por el editor, ni verificado por el mecanismo de protección, hasta entonces.
- El mecanismo de protección puede rechazar un documento que un humano haya escrito a propósito con ambas nomenclaturas.
- El rechazo nombra cada par, y eliminar una de las nomenclaturas lo resuelve.
- Las operaciones en la ruta alternativa (*fallback*) cuestan una solicitud adicional cuando una ruta v8 responde con 404
  por motivos propios (un id desconocido).

## Alternativas consideradas

- **Migrar el archivo a través de `/v8/management/config`.** Rechazado: reescribe todo el archivo del
  operador (formato, secciones desconocidas convertidas en comentarios) como efecto secundario de editar un solo
  parámetro, lo cual contradice el invariante de adopción de que OMC nunca muta la configuración que no posee.
- **Escribir cada parámetro a través de endpoints v8 direccionados por ruta.** Rechazado por la misma razón:
  cualquier escritura exitosa en v8 migra el archivo.
- **Elegir la ubicación según la versión de la pasarela.** Rechazado: una pasarela v8 que sirviera un archivo
  heredado vería su archivo migrado por partes a una estructura mixta.
