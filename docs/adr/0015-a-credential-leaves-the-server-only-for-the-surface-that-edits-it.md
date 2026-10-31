# ADR 0015: Una credencial sale del servidor solo para la superficie que la edita, y solo cuando lo solicita

- Estado: Aceptado
- Fecha: 2026-09-19

## Contexto

Dos respuestas de gestión transportaban material de credenciales que ningún componente necesitaba en texto plano:

1. **La lista de claves de llamadas devolvía las claves almacenadas literalmente.** `ClientAPIKeyItemDTO.Key` era la entrada de `api-keys` de CPA tal cual, y la respuesta de creación hacía eco de la clave que acababa de recibir. Tanto el selector de claves del panel de control como la página de claves leían ese campo.
2. **La tabla de proveedores colocaba la clave del proveedor en un atributo `title`.** La celda mostraba `maskKeyText(record.api_key)` mientras que el `title` del elemento era el valor en sí, por lo que el secreto completo residía en el documento —legible desde una instantánea del DOM, al pasar el cursor o por cualquier extensión— sin ninguna acción de revelado de por medio. La página retiene los valores deliberadamente (`getManagementProviders(true)`), porque el editor de proveedores los edita.

La decisión 2 del ADR 0002 establece que las claves de API en texto plano "nunca deben ingresar a claves principales, claves externas de bases de datos, registros regulares o respuestas estándar del navegador". La única excepción sancionada es `internal/cpa/configyaml/configyaml.go`, cuyo `SanitizeSafeYAML` declara que las claves de API ascendentes/descendentes se devuelven intencionalmente en texto plano: el modo de configuración visual es la superficie que las edita, por lo que debe verlas.

Dicha excepción no se extiende a ninguna de las dos superficies anteriores. Tampoco puede simplemente extenderse a la lista de claves en forma enmascarada, porque la página de claves necesita el valor para una tarea que la máscara no puede realizar: une el alias y la capa de uso en esta lista con el texto de la clave del documento de configuración que está editando. CONTEXT.md ya descartó ambos sustitutos: "nunca un índice de matriz de configuración y nunca la máscara de visualización", porque un índice se desplaza cuando se edita la lista de `api-keys` de CPA y una máscara conserva solo un inicio y un final cortos, por lo que dos claves pueden compartir una. Unirse a través de cualquiera de los dos imprimiría el nombre asignado por el operador de una clave en la fila de otra, y el cambio de nombre que se lee de esa fila escribiría el alias contra una huella digital de uso, por lo que se almacenaría el nombre incorrecto en la clave incorrecta.

## Decisión

1. **Una respuesta de gestión transporta una credencial únicamente para la superficie que es propietaria de su edición, y solo bajo solicitud explícita.** `include_keys=true` —ya utilizado por la lista de proveedores— es lo que hace que `/management/api-keys` devuelva los valores almacenados. Sin él, `ClientAPIKeyItemDTO.Key` es `security.MaskSecret` del valor. `Length`, `fingerprint` y `usage_fingerprint` se calculan a partir del valor en ambos casos, por lo que la identidad y la capa de alias no se ven afectadas por lo que se envía.
2. **Cada lector declara qué contrato lee, en su propia entrada de caché.** La página de claves solicita los valores (`['management-client-keys', 'with-keys']`) porque los une; el selector de claves del panel de control lee la lista enmascarada en el ámbito base `['management-client-keys']` y continúa usando `maskKeyText` sobre lo que se le proporcione. Una sola entrada no puede satisfacer ambos contratos, ya que la página que obtenga los datos primero decidiría lo que ve la otra —y una máscara que llegue a la página de claves no solo se mostraría incorrectamente, sino que vaciaría cada columna de alias y uso sin generar un error—.
3. **Una respuesta nunca hace eco de un secreto que el solicitante acaba de enviar.** La respuesta de creación de claves devuelve el índice de la fila y la máscara, no la clave.
4. **Una superficie que solo muestra una clave nunca transporta el valor.** La información sobre herramientas (tooltip) de la tabla de proveedores repite la máscara de la celda, por lo que el valor llega al navegador únicamente a través del editor que lo edita.
5. **La máscara sigue teniendo la forma que fijó la decisión 5 del ADR 0010 y permanece idempotente.** Enmascarar una máscara la devuelve sin cambios, lo que permite que un lector que enmascare todo lo que recibe renderice ambas formas de respuesta de manera idéntica; `scripts/test-mask-key.ts` fija esa propiedad en cada rama.

## Consecuencias

### Positivas

- La decisión 2 del ADR 0002 vuelve a cumplirse en estas dos respuestas: las respuestas predeterminadas transportan una máscara de visualización, de modo que un panel de herramientas de desarrollo (devtools), una instantánea del DOM, una captura de pantalla al pasar el cursor o una extensión del navegador no leen ninguna credencial de las superficies que no la editan.
- La exposición restante es deliberada, nombrada y solicitada por la página cuya tarea es editar dicha credencial; la misma postura que ya tenía la lista de proveedores, expresada ahora de forma unificada para ambas.
- El panel de control deja de recibir valores de clave que nunca utilizaba, lo cual es un cambio libre de contrapartidas.
- Se preserva la unión exacta de la página de claves. Los nombres, las columnas de tráfico y la acción de "ver solicitudes" siguen funcionando a partir del texto de la clave, sin inventar ninguna identidad nueva para una máscara que no puede transportarla.

### Contrapartidas

- **La lista de claves tiene dos contratos.** Un llamador que la lea sin el indicador y espere valores obtendrá máscaras en su lugar. El fallo es visible en lugar de silencioso —las columnas de alias y uso regresan vacías—, pero representa un detalle adicional que un futuro lector de la lista debe tener en cuenta, y es la razón por la cual el indicador y su motivo se especifican en el campo DTO y en `getClientAPIKeys`.
- **La respuesta enmascarada no constituye un límite frente a la sesión del navegador.** La misma sesión puede leer los valores a través del documento de configuración (la excepción sancionada) y mediante la solicitud de opt-in; esta decisión elimina la copia que carecía de propósito, pero no oculta las claves de la página que las edita.
- **Se elimina el revelado predeterminado en la fila del proveedor.** La información sobre herramientas ahora repite la máscara, por lo que un operador que desee comparar visualmente la clave de un proveedor debe abrir su editor. Esto requiere un clic más que pasar el cursor, y es precisamente para lo que sirve un revelado explícito.

## Alternativas consideradas

- **Enmascarar la lista siempre y volver a unir la capa superpuesta en la página, ya sea por máscara o por índice.** Rechazado: una máscara no es única (dos claves con el mismo inicio y fin comparten una, y cada clave corta comparte la máscara compuesta enteramente por relleno), por lo que una búsqueda ambigua etiquetaría erróneamente una fila o descartaría los metadatos de las claves en colisión; además, un índice no es estable ante las modificaciones que realiza esta página. CONTEXT.md ya prohíbe ambos como elementos de identidad, y una fila mal etiquetada alimenta un cambio de nombre que se almacena vinculado a una huella digital.
- **Devolver la lista en el orden de CPA y permitir que la página coincida por posición.** Rechazado: la lista de claves y el documento de configuración son dos lecturas dinámicas, por lo que una edición concurrente —o un borrador no guardado de la propia página— provoca que la posición discrepe de la identidad. La unión actual es exacta porque ambos lados coinciden con el texto de la clave; esto cambiaría una unión exacta por una aproximada con el fin de evitar un indicador.
- **Dejar la lista en texto plano y documentar el motivo.** Rechazado: el panel de control lee la misma respuesta y no tiene uso para los valores, por lo que la razón solo se aplicaría a uno de sus dos lectores, y la decisión 2 del ADR 0002 mantendría una excepción permanente para una respuesta que no la necesita.
- **Eliminar la información sobre herramientas de los proveedores en lugar de enmascararla.** Rechazado: la celda se trunca a 220px, por lo que la información sobre herramientas sigue siendo el elemento que muestra la máscara completa en una clave larga. Eliminarla quitaría la facilidad de uso junto con el secreto.
