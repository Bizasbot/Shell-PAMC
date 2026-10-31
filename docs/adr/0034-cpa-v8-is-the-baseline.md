# ADR 0034: CPA v8 es la línea base; la consola maneja la API de gestión de v8

- Estado: Aceptado
- Fecha: 2026-09-28
- Reemplaza a: [ADR 0028](0028-one-build-serves-cpa-v7-and-v8.md)

## Contexto

El ADR 0028 hizo que una sola compilación admitiera las pasarelas CPA v7 y v8: las operaciones preferían las rutas agrupadas de `/v8/management` y recurrían a `/v0/management` como alternativa, la ubicación de la configuración seguía el diseño del archivo almacenado, y OMC nunca realizaba una escritura de configuración en v8 para evitar activar la migración del archivo por parte de CPA. En la práctica, las rutas de v8 rara vez se utilizaban, cada operación conllevaba dos rutas y una alternativa, y el editor de configuración incluía una tabla de reubicación y una alternativa de nomenclatura heredada cuyo único propósito era mantener operativo a v7. Su protección de guardado es diferente: aunque los archivos completos se escriben a través de v0 mediante los editores, esto evita que CPA v8 ignore silenciosamente los valores ensombrecidos o reemplace los grupos de proveedores upstream, por lo que se mantiene hasta que dichos editores se actualicen.

Oh My CPA no ha tenido su primer lanzamiento. Declarar el rango de pasarelas compatibles en ese lanzamiento no le cuesta nada a ninguna implementación existente, mientras que CPA v8 ofrece una API de configuración declarativa basada en rutas (`GET/PATCH /v8/management/config`, `/config/<section>/<field>`), grupos de proveedores upstream (`api-keys.<family>`) y un punto de entrada de inicio de sesión OAuth compartido, sobre los cuales la consola puede construirse directamente.

## Decisión

1. **Se requiere CPA v8.0.0 o posterior.** El cliente de gestión determina la versión de la API leyendo `/v8/management/config/config-version` y exigiendo el valor `8`, como antes, pero ahora como un requisito de validación estricta (*gate*): ante una pasarela que responda que "no es v8", cada operación devuelve `management.ErrManagementV8Required` antes de enviar cualquier solicitud. CPA responde con 404 en todas las rutas de gestión, tanto v0 como v8, mientras no tenga un secreto de gestión configurado; por lo tanto, la ausencia de un árbol v8 se confirma consultando `/v0/management/debug`: si este tampoco está disponible, la API de gestión de la pasarela se considera deshabilitada en lugar de obsoleta, y las operaciones devuelven `management.ErrManagementDisabled`. `/api/healthz` reporta `cpa_management_api` (`v8`, `unsupported`, `disabled`, `unknown`), y la consola reemplaza cada página con una guía de actualización mientras lea `unsupported`, o con la configuración del secreto de gestión mientras lea `disabled`. Una sonda no concluyente (inalcanzable, 401, 5xx) no bloquea nada, por lo que la solicitud falla por su propia causa y la puerta de enlace no vuelve a realizar la sonda durante `API_UNDECIDED_TTL`.
2. **Las operaciones utilizan únicamente las rutas de v8.** Las credenciales, OAuth, los complementos, los registros, el uso, las llamadas autenticadas a upstream, el reinicio de enfriamiento (*cooldown*) y la búsqueda de versiones se direccionan en su ruta `/v8/management`. No hay alternativas ni una segunda tabla de rutas.
3. **`/v0/management` se gestiona únicamente a través de `internal/cpa/management/client_v0.go`.**
   Contiene las lecturas que el árbol v8 no ofrece —las listas de credenciales por familia son la única fuente del `auth-index` de cada clave upstream, sobre la cual se basan la atribución de uso, la cuota y la desactivación de claves— y, hasta que los editores correspondientes se actualicen, las lecturas y escrituras de configuración.
4. **La configuración pasa a la API de configuración de v8.** Los editores adoptan las rutas de v8 y escriben a través de `/v8/management/config` en lugar de reemplazar todo el archivo YAML. Una escritura de configuración en v8 migra un archivo heredado; dicha migración se acepta y OMC conserva una copia del archivo tal como estaba antes de su primera escritura en v8. Este es el objetivo final, no lo que esta decisión implementa de inmediato: hasta que los editores se actualicen, OMC no realiza ninguna escritura de configuración en v8 y la copia de seguridad no está implementada.

## Consecuencias

- Se rechaza una pasarela v7 con un mensaje claro en lugar de atenderla. Los operadores actualizan CPA primero; CPA v8 lee un archivo v7 sin modificaciones, por lo que la actualización en sí no requiere ningún cambio de configuración.
- Cada operación es una solicitud en una sola ruta. Una ruta v8 que responda con 404/405/501 descarta la respuesta almacenada en caché de la sonda, por lo que una pasarela revertida a la misma URL vuelve a ser probada y posteriormente rechazada por la validación.
- La fachada de sondeo de capacidades (`/api/v1/management/capabilities/{key}`) existía para diferenciar los puntos de entrada faltantes de un CPA antiguo de una interfaz de usuario no conectada. Con una línea base en v8, ya no tiene nada que reportar y se elimina.
- La migración de los editores de configuración se planifica para después de esta decisión (decisión 4); hasta entonces, conservan las reglas de ubicación del ADR 0028 en v0, las cuales una pasarela v8 atiende sin cambios.
- La tabla de reubicación en `internal/cpa/configyaml/layout_rules.go` permanece como una instantánea de una versión de CPA mientras siga en uso, y se eliminará junto con el editor que la utiliza.

## Alternativas consideradas

- **Seguir atendiendo v7 (ADR 0028).** Rechazado: mantiene dos rutas por operación y una capa de configuración cuyo propósito es evitar la API de v8, para un rango de pasarelas que ninguna versión de OMC ha prometido admitir.
- **Determinar la versión a partir de una cadena de texto (*version string*).** Rechazado por la misma razón que en el ADR 0028: las compilaciones, bifurcaciones (*forks*) y etiquetas (*tags*) no se mapean de manera confiable a las rutas, mientras que una ruta responde o no responde.
- **Eliminar por completo `/v0/management`.** Rechazado: el `auth-index` de las claves upstream solo se encuentra en las listas de credenciales de v0, y eliminarlo haría perder la atribución de uso, la cuota y la desactivación de claves para cada clave de API configurada.
