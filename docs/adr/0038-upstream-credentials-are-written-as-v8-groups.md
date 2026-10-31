# ADR 0038: Las credenciales upstream se escriben como grupos v8

- Estado: Aceptado
- Fecha: 2026-09-29
- Completa: [ADR 0034](0034-cpa-v8-is-the-baseline.md), decisión 4, después de
  [ADR 0037](0037-configuration-editing-uses-the-v8-configuration-api.md)

## Contexto

Después del ADR 0037, la página de configuración, su vista de código fuente y la página de Claves realizaban escrituras a través de la API de configuración de v8, pero tres editores aún escribían a través de `/v0/management`:

- las páginas de proveedores, que leían la lista de credenciales de una familia (`/<family>-api-key`,
  `/openai-compatibility`), la editaban y escribían la lista completa de vuelta;
- los alias de modelos OAuth (`PATCH /oauth-model-alias`);
- la habilitación y configuración por plugin (`/plugins/<id>/enabled`, `/plugins/<id>/config`).

CPA v8 almacena las credenciales upstream como grupos. `api-keys.<family>` es una lista de
`{name, base-url, shared settings, keys: [...]}`, y una clave puede sobrescribir cualquier configuración compartida excepto `base-url`. La vista en tiempo de ejecución de CPA, que es la lista v0, consiste en dichos grupos aplanados en una entrada por clave, en orden, cada una con su `auth-index`. La consola hace referencia a los proveedores por su posición en esa lista. La atribución de uso, la cuota y la desactivación de claves se identifican mediante el `auth-index`, y solo la lista v0 lo incluye.

Una escritura en la lista v0 descarta el agrupamiento del operador: CPA reagrupa la familia escrita como un grupo por entrada, nombrado como `<family>-<n>`, y pierde los nombres de grupo y las configuraciones compartidas. Una escritura v0 en un archivo anterior a v8 también omite la copia de seguridad que el ADR 0037 realiza antes de una conversión.

Medido en CPA v8.0.2:

- Una clave puede sobrescribir `models`, `priority`, `excluded-models`, `disable-cooling`
  y `request-retry` de un grupo, incluso con un valor cero (`models: []`, `priority: 0`).
- `PATCH /v8/management/config` con `{"api-keys": {"claude": [...]}}` reemplaza esa
  familia y mantiene las demás.
- `plugins.configs.<id>` y `oauth.model-alias.<provider>` son rutas ordinarias:
  `PATCH`, `PUT` y `DELETE` funcionan en ellas.

## Decisión

1. **Cada escritura de configuración utiliza la API de configuración de v8.** Pasa a través del conjunto de cambios del ADR 0037, el cual conserva un archivo anterior a v8 antes de convertirlo. Las llamadas restantes a `/v0/management` son operaciones de lectura (`client_v0.go`): las listas por familia, para el `auth-index` de cada clave, y el archivo almacenado, para la copia de seguridad.
2. **Una escritura de proveedor edita los valores propios del archivo y los devuelve a sus grupos.**
   `EditableConfigAPIKeys` lee la lista v0, la cual proporciona las posiciones y el `auth-index`, y los grupos almacenados de la familia. Relaciona las claves almacenadas con las entradas en tiempo de ejecución en orden, por clave API y URL base. Por lo tanto, cada entrada incluye la configuración almacenada y el grupo del cual proviene.
   `UpdateConfigAPIKeys` vuelve a escribir la familia como grupos, en el orden exacto de la lista:
   - Una configuración que el grupo almacena toma el valor en el que sus claves ahora coinciden, o mantiene su valor almacenado cuando no están de acuerdo.
   - Una clave que difiere indica su propio valor, y un valor borrado corresponde a su valor cero en los casos donde CPA interpreta la ausencia como cero.
   - Una clave que su grupo no puede expresar se traslada a un grupo propio nombrado según el original. Esto aplica para una clave con otra URL base, o una que borró una configuración basada en punteros (`disable-cooling`, `request-retry`) donde solo la ausencia significa "heredar". Las claves posteriores continúan en un grupo con la misma configuración.
   - Un proveedor nuevo constituye un grupo nuevo.
3. **Los proveedores compatibles con OpenAI se escriben como un grupo por proveedor.** Sus claves se ubican bajo `keys`, y se conservan las configuraciones sin modelar de cada proveedor, clave y modelo.
4. **Los alias de modelos OAuth y las configuraciones de plugins escriben en sus propias rutas:**
   - `oauth.model-alias.<provider>`, el cual se elimina cuando la lista está vacía, junto con cualquier otra variante ortográfica del mismo proveedor;
   - `plugins.configs.<id>.enabled`;
   - `plugins.configs.<id>`.
   La lectura de alias aplica la propia limpieza de CPA, por lo que la consola muestra lo que utiliza el gateway.

## Consecuencias

- Una edición a través de la consola conserva los nombres de grupo y las configuraciones compartidas del operador. Una familia que no se modifica se reescribe exactamente tal como fue almacenada.
- La primera escritura de proveedor, alias o plugin en un archivo anterior a v8 lo convierte, previa realización de la misma copia de seguridad que se genera al guardar la configuración.
- Una clave almacenada que el tiempo de ejecución de CPA omite no forma parte de la lista editable, por lo que una escritura la descarta. Ejemplos de esto son un duplicado o una clave que carece de la URL base que su familia requiere. Una escritura v0 de lista completa también la descartaba.
- Una edición parte de la entrada almacenada, por lo que se conservan la configuración de una clave y de un modelo que el formulario no muestra, y una URL base predeterminada de familia reportada por el tiempo de ejecución no se escribe en una clave que el archivo almacena sin una.
- Una escritura de proveedor envía cada clave de su familia, incluyendo aquella agregada únicamente por esa solicitud, y el motivo de rechazo por parte de CPA puede citar un valor. El motivo es depurado de los secretos del archivo almacenado y de los enviados antes de que la respuesta o el registro de auditoría lo visualicen.
- Una clave cuya URL base cambia sale de su grupo, por lo que el archivo puede adquirir un grupo nombrado como `<group>-<n>`. El orden de la lista, y por ende cada ID de proveedor, permanece sin cambios.

## Alternativas consideradas

- **Mantener las escrituras de listas v0.** Rechazado: reagrupan a toda la familia en cada escritura y convierten un archivo anterior a v8 sin una copia de seguridad.
- **Editar grupos en la consola.** Rechazado por ahora: cada ID de proveedor, superposición y unión de uso es posicional en la lista aplanada. Introducir grupos allí altera el modelo del proveedor en lugar de su almacenamiento, y ninguna acción que el operador realice hoy en día lo requiere.
- **Escribir un grupo por entrada.** Rechazado: eso es exactamente el comportamiento de v0 y descarta el agrupamiento del operador.
