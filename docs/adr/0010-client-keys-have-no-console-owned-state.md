# ADR 0010: La consola no posee ningún estado de clave de cliente; el campo `api-keys` de CPA es el único modelo

- Estado: Aceptado
- Fecha: 2026-09-18

## Contexto

CPA autentica las solicitudes de llamadas entrantes contra su lista `api-keys:` y nada más. Por lo
tanto, una clave de cliente tiene exactamente dos estados allí: presente (aceptada) o ausente
(rechazada con `401 Unauthorized`). No obstante, la consola había desarrollado un tercer estado propio:
las claves "temporalmente deshabilitadas" se eliminaban del borrador de `api-keys` y se recordaban en
la clave de `ui_preferences` llamada `omc_disabled_client_keys`.

Dicho estado no se podía persistir. `omc_disabled_client_keys` nunca se añadió a `knownPreferences` en
`internal/api/management_preferences.go`, que es toda la superficie pública de la API de preferencias:
la escritura respondía con `400 unsupported preference key`, `listPreferences` filtraba la clave de
cada lectura y el valor optimista en la caché de consultas compartida se revertía. De modo que el
comportamiento alcanzable era el opuesto al pretendido: deshabilitar una clave la eliminaba del
documento de configuración, la consola no registraba rastro de ello y el mensaje flotante (toast)
informaba que la clave había sido estacionada y que la acción era reversible.

El modelo erróneo era económico de describir y costoso de mantener: un estado que Oh My CPA almacena
pero que CPA no respeta no es un control, es una afirmación. Si el indicador se hubiera persistido,
CPA habría seguido aceptando la clave mientras la consola mostraba "deshabilitada" (el modo de fallo
de una etiqueta con apariencia de seguridad pero sin cumplimiento que la respalde).

## Decisión

1. **Una clave de cliente no tiene estado deshabilitado.** La consola modela una clave como presente o
   ausente. Detener una clave significa eliminarla de `api-keys`, a través de la misma transacción de
   borrador protegida por revisión que cualquier otra escritura de configuración.

2. **La eliminación es irreversible para el secreto, y la consola lo advierte.** Oh My CPA no
   almacena ninguna copia del valor de una clave, por lo que la confirmación de eliminación indica que
   el valor no se puede recuperar y que debe copiarse primero si se necesita. Un alias y el tráfico
   histórico de la clave sobreviven a la eliminación, porque `client_key_aliases` y `usage_events` se
   identifican mediante la huella digital de uso en lugar del texto de la clave.

3. **El panel de configuración apunta en lugar de editar.** El grupo `grp_apikeys` renderiza un panel
   de redirección —el recuento de claves configuradas más un salto a la página dedicada— en lugar de
   un segundo editor para el mismo campo. Esto reemplaza el manejo anterior que ocultaba el grupo por
   completo, lo cual dejaba al panel sin mención alguna sobre un campo del cual es propietario. Se
   evitó deliberadamente introducir dos editores para un mismo documento, y este ADR lo mantiene así:
   ninguna superficie escribe claves fuera del propio flujo de borrador de la página de claves.

4. **No se registra ninguna clave de preferencia para el estado de la clave.** La eliminación no
   requirió ninguna migración, ya que la escritura nunca había tenido éxito ni una sola vez.

5. **Una única forma de máscara de visualización, calculada independientemente de la longitud del
   secreto.** La lista de claves renderiza la misma máscara de forma constante que la lista de
   solicitudes (`security.MaskSecret`: un inicio corto, una ejecución fija de viñetas, un final
   corto), de modo que la misma clave se lee de la misma manera en ambas superficies, y la máscara
   nunca revela la longitud del secreto.

## Consecuencias

### Positivas

- La consola deja de reportar un estado que CPA no posee. "Deshabilitada" ya no aparece en ningún
  lugar donde el gateway de hecho seguiría aceptando llamadas.
- La ruta destructiva es la explícita. Eliminar una clave es visiblemente destructivo en el momento
  en que se confirma, en lugar de llegar como un estado que eliminó silenciosamente la clave del
  documento.
- Un documento, un escritor. Las claves se editan únicamente en la página de gestión de claves, por
  lo que cada superficie mantiene como máximo un borrador de `config.yaml` y el control de revisión
  no tiene nada ambiguo que arbitrar.
- El panel de configuración ya no omite `api-keys`: a un operador que lo consulte se le indica dónde
  reside el campo y cuántas claves existen.
- La lista de claves perdió el concepto de estado junto con él: un indicador de estado sin etiqueta,
  un filtro de habilitar/deshabilitar y una columna de estado existían únicamente para dar servicio al
  estado que ahora ha desaparecido.

### Compensaciones (Trade-offs)

- **No hay forma de estacionar una clave.** Un operador que desee detener el tráfico sin perder el
  secreto debe copiar primero el valor. Esa es una pérdida real de capacidad, y representa el límite
  honesto del modelo de CPA en lugar de una elección de la consola.
- **La detectabilidad (discoverability) ahora depende de un enlace.** Un panel que muestra un
  recuento y un botón está un clic más lejos del campo de lo que habría estado el campo en sí.
- **El estado eliminado no está cubierto por una prueba automatizada**, porque nunca fue alcanzable a
  través de la ruta de escritura aceptada; no hay comportamiento contra el cual hacer aseveraciones.
  La garantía es la ausencia del código, y los dos nombres que lo reintroducirían
  (`omc_disabled_client_keys`, una preferencia de estado de clave) son lo suficientemente específicos
  como para buscarlos con `grep`.

## Alternativas consideradas

- **Registrar la preferencia y persistir las claves estacionadas.** Rechazado por tres motivos:
  contradice el modelo, ya que CPA seguiría aceptando la clave; convierte la tabla de preferencias
  en un almacén de secretos para las claves del gateway, en contra del límite que mantiene los
  secretos de los llamadores fuera del almacenamiento de la consola; y habría convertido la etiqueta
  de "deshabilitada" de la consola en una falsa afirmación de seguridad en lugar de un error.
- **Mantener un indicador del lado de la consola que oculte la clave sin tocar `api-keys`.**
  Rechazado: una fila oculta sigue autenticando. Este es el fallo específico de la característica
  eliminada en una forma que finalmente persistiría, lo cual es estrictamente peor que la versión que
  falló ruidosamente.
- **Hacer cumplir la desactivación a nivel de protocolo de CPA, de la forma en que funciona la
  desactivación de proveedores (`excluded-models: ['*']`).** Rechazado: una clave de llamada entrante
  no es una credencial que se enrute hacia arriba, por lo que no hay exclusión ascendente que
  configurar.
- **Mantener el grupo oculto en el panel de configuración.** Rechazado: un campo que el panel posee
  pero del que nunca habla es el defecto de detectabilidad que soluciona el panel de redirección, y
  es lo que dejaba una entrada muerta de `api-keys` en el entorno de trabajo visual.
