# ADR 0018: Las lecturas que contienen credenciales se auditan con política de fallo cerrado (fail-closed), una vez por revelación

- Estado: Aceptado
- Fecha: 2026-09-20

## Contexto

El flujo de auditoría registraba cada cambio de credenciales, pero ninguna lectura de estas. La fuente de configuración sin procesar ya estaba cubierta por `config.reveal_source`, y `/management/config` devuelve únicamente `safe_yaml`, por lo que ninguna de estas dos opciones representa la brecha restante. Las dos respuestas de listado que pueden transportar credenciales en texto plano son:

- `GET /management/api-keys?include_keys=true`, que la página de claves necesita para asociar alias y uso con el texto de la clave; y
- `GET /management/providers?include_keys=true`, que el editor de proveedores necesita para editar las claves de upstream.

Sin un registro de lectura, el registro de auditoría no podía responder a la pregunta ante un incidente sobre "quién leyó las claves y cuándo". La decisión no es trivial porque un fallo en la escritura de la auditoría puede hacer que una lectura no esté disponible, y porque estas listas pueden ser consultadas mediante sondeos (polling).

## Decisión

1. **Auditar la respuesta que realmente transporta material de credenciales.** Un listado enmascarado es una lectura de metadatos y no se registra. `include_keys=true` en los dos endpoints de listado constituye el límite de auditoría; la fuente sin procesar continúa utilizando `config.reveal_source`.
2. **Aplicar fallo cerrado (fail-closed).** El registro de auditoría se escribe después de que las credenciales han sido leídas, pero antes de que se emita la respuesta. Si el almacén de auditoría no está operativo, la respuesta es un `500` y no se devuelve ninguna credencial. Esto refleja la regla existente en el repositorio para exportaciones sensibles y revelaciones desde la fuente sin procesar.
3. **Registrar un evento por revelación, no uno por credencial.** El evento identifica el listado e incluye recuentos (`key_count` y `provider_count` cuando corresponda), de modo que una revisión de auditoría pueda ver el alcance sin convertir la carga de una página en una fila por cada clave. El sondeo enmascarado permanece fuera del registro.
4. **Asignar a cada superficie su propia acción y objetivo.** Las lecturas de claves de llamadas utilizan `api_key.reveal` con el objetivo `client_api_key/list`; las lecturas de claves de proveedores utilizan `provider.reveal_keys` con el objetivo `provider/list`.

## Consecuencias

- Las páginas de claves y proveedores no pueden cargar su estado de edición mientras el almacén de auditoría no esté disponible. Dicha pérdida de disponibilidad se acepta para una revelación explícita de credenciales; el listado enmascarado sigue estando operativo mientras el almacén de auditoría no funcione correctamente.
- Una actualización de página o una nueva consulta (refetch) registra una nueva lectura. El registro se mantiene acotado mediante la activación explícita (opt-in) y a razón de un registro por respuesta, en lugar de un registro por cada clave.
- Los detalles de la auditoría contienen únicamente recuentos e identificidades de las listas. Ningún valor de credencial, huella digital (fingerprint) de clave u otro material que contenga secretos se copia en la fila de auditoría.
