# ADR 0037: La edición de configuración utiliza la API de configuración de v8

- Estado: Aceptado
- Fecha: 2026-09-29
- Implementa: [ADR 0034](0034-cpa-v8-is-the-baseline.md), decisión 4

## Contexto

El ADR 0034 estableció CPA v8 como la base pero dejó los editores de configuración en `/v0/management`:
la página de configuración, la vista de código fuente y la página de Claves leían el archivo almacenado,
ubicaban cada campo según el diseño del archivo (legado, v8 o mixto) con una tabla de reubicación copiada de
CPA, y volvían a escribir todo el documento YAML mediante `PUT /v0/management/config.yaml`. Un
guardián de guardado rechazaba los documentos que CPA v8 aceptaría e ignoraría parcialmente. Dicho diseño existía
para evitar un evento: una escritura de configuración de v8 migra un archivo legado, reescribiéndolo en el
propio diseño de CPA (indentación de cuatro espacios, valores predeterminados añadidos, secciones desconocidas comentadas
y comentarios de claves reubicadas movidos).

La API de configuración de CPA v8 hace innecesaria la mayor parte de ese mecanismo. Medido en v8.0.2
(`docs/cpa-v8-compat.md` §4):

- `GET /v8/management/config` y `/config.yaml` renderizan el archivo almacenado en el diseño v8,
  independientemente del diseño en el que esté almacenado, y nunca lo modifican.
- `PATCH /v8/management/config` fusiona valores, `PUT /config/<path>` reemplaza una ruta y
  `DELETE /config/<path>` la elimina. Cada una afecta únicamente a su ruta; el resto del archivo
  se mantiene tal como lo renderiza CPA.
- Una escritura que nombra un campo legado, una sección desconocida o un valor del tipo incorrecto es
  rechazada (`400`/`422 invalid_config`) con un mensaje que indica la ruta infractora, y
  no se escribe nada.
- La primera escritura en un archivo legado convierte todo el archivo, una sola vez.

El operador decidió (2026-09-28) que la primera versión requiere CPA v8, que un archivo
anterior a v8 se convierte en lugar de conservarse en su diseño antiguo y que no se debe perder ninguna
capacidad de edición en el proceso.

## Decisión

1. **Los editores leen y escriben únicamente el diseño v8.** El esquema del editor nombra rutas v8.
   `GET /management/config` devuelve el renderizado v8 de CPA con los secretos enmascarados, y su
   revisión es el SHA-256 de dicho renderizado. Se eliminan la tabla de reubicación, la detección de diseño,
   los respaldos de sintaxis legada y el guardián de guardado.
2. **El editor visual y la página de Claves guardan únicamente lo que cambió.** La consola compara el
   borrador con el documento desde el cual se cargó y envía `PATCH /management/config`
   con `{revision, changes}`, un cambio por ruta editada (`value` o `remove`). El
   backend verifica la revisión bajo la compuerta de escritura del proveedor, restaura los secretos enmascarados
   por valor y aplica el conjunto como un `PATCH` para escalares y listas, un `PUT` por cada
   valor de mapa y un `DELETE` por cada eliminación. La respuesta incluye el nuevo renderizado de CPA, el cual
   se convierte en la línea base del editor; un borrador con ediciones más recientes se transfiere sobre este.
3. **La vista de código fuente escribe todo el documento a través de `PUT /v8/management/config.yaml`.**
   Edita el renderizado v8 de CPA, por lo que un nombre legado escrito allí es rechazado por CPA con su
   propia explicación (`422 config_rejected`, mostrada en el idioma de la consola citando la razón de CPA).
   El guardado restauró los valores ocultos en lo que envió, por lo que cualquiera de ellos que
   la razón mencione se elimina primero.
4. **Se realiza una copia de seguridad de un archivo legado antes de convertirlo.** Antes de cualquier escritura
   de configuración en v8, el cliente lee el archivo almacenado a través de `GET /v0/management/config.yaml` (la
   única ruta que devuelve el archivo tal como está almacenado) y, cuando no es un archivo v8, lo almacena
   encriptado en `cpa_config_backups` (migración 030, se conservan los últimos diez; un guardado
   reintentado del mismo archivo reutiliza su copia). El archivo se lee antes de cada escritura de este tipo
   en lugar de recordarse como convertido, ya que un operador puede volver a colocar un archivo legado. Las
   otras escrituras en v8 tras las cuales CPA guarda el archivo (instalar o eliminar un plugin,
   habilitar o deshabilitar una credencial) toman la misma copia primero. Si la copia no se puede
   conservar, la escritura se rechaza antes de enviar nada (`503 config_backup_failed`). La consola marca un archivo legado en la página de
   configuración y ofrece las copias conservadas para su descarga (`GET /management/config/backups`,
   `GET /management/config/backups/{id}`, siendo este último auditado como `config.reveal_backup`).
5. **Las escrituras escalares utilizan la misma ruta.** `PUT /management/config/{key}`, que el
   `config_set` del Agente también utiliza, escribe la ruta v8 de la clave a través del conjunto de
   cambios en lugar de un configurador plano de v0.

## Consecuencias

- El archivo ya no se conserva byte por byte a partir del primer guardado. La conversión de CPA
  conserva cada valor que conoce y los comentarios de las claves que mueve, añade sus valores predeterminados
  y convierte las secciones desconocidas en comentarios. El original se puede recuperar a partir de la copia de seguridad,
  y cada guardado posterior es una escritura por ruta.
- Una edición concurrente de una configuración no relacionada ya no se sobrescribe mediante un guardado:
  la revisión sigue rechazando un guardado preparado contra un documento movido, y la recarga del
  diálogo de conflictos ahora mantiene las ediciones del editor visual por encima del documento más reciente.
- Un conjunto de cambios no es atómico en todas sus solicitudes. Está ordenado de modo que las solicitudes que CPA
  tiene más probabilidades de rechazar (la fusión que transporta valores tipados) van primero, pero un conjunto
  cuya solicitud posterior falla deja aplicadas las anteriores. Dicho fallo se reporta como
  `config_partially_applied` (auditado como un fallo con `partially_applied`), no como un
  rechazo que no cambió nada, y el siguiente guardado del editor se encuentra con el diálogo de conflicto
  de revisión, el cual recarga el estado que mantiene CPA.
- `/v0/management` mantiene tres roles (`internal/cpa/management/client_v0.go`): las
  listas de credenciales por familia (la única fuente de `auth-index`), la lectura del archivo almacenado
  que necesita la copia de seguridad y las escrituras cuyos editores aún no se han movido (credenciales
  de proveedores, alias de modelos OAuth, habilitación y configuración por plugin).
- La vista enmascarada ahora también enmascara los valores de `api-key` ascendentes donde sea que aparezcan;
  los grupos `api-keys.<family>` del diseño v8 los convirtieron en parte del documento del editor.

## Alternativas consideradas

- **Seguir escribiendo archivos completos a través de v0 y preservar el diseño legado (regla del
  ADR 0028).** Rechazado: mantiene una tabla de reubicación copiada, un editor dependiente del diseño y un
  guardián de guardado vivos únicamente para evitar la conversión única de CPA, y cada guardado sigue
  sobrescribiendo las ediciones concurrentes.
- **Escribir todo el documento v8 a través de `PUT /v8/management/config.yaml` desde el editor
  visual.** Rechazado: presenta el mismo problema de sobrescritura y envía toda la configuración por
  un cambio de un solo campo.
- **Convertir sin una copia de seguridad.** Rechazado: la conversión descarta los comentarios y las
  secciones desconocidas, y un operador que adopte OMC en una pasarela existente debe poder recuperar el original.
