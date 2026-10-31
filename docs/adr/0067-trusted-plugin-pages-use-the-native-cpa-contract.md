# ADR 0067: Las páginas de plugins de confianza usan el contrato nativo de gestión de CPA

- Estado: Aceptado
- Fecha: 2026-10-07
- Reemplaza: La negativa al directorio raíz del núcleo, el reemplazo de credenciales, el alcance de gestión exclusivo para v0 y la auditoría de solo escritura del ADR 0060; conserva su decisión de confianza de alojamiento y origen cruzado (same-origin).
- Las listas blancas de DTO ordinarias en el ADR 0038 permanecen sin cambios.

## Contexto

El issue #151 expuso un desajuste de protocolo en lugar de una funcionalidad faltante específica del plugin.
Las páginas nativas pueden leer la configuración efectiva, los grupos de proveedores v8 y el directorio
de modelos del gateway antes de llamar a las rutas con espacios de nombres para el estado del plugin y la sincronización de credenciales.
La antigua lista negra del primer segmento rechazaba tanto las lecturas de configuración nativas como `/plugins/<id>/state`.
Reemplazar las credenciales explícitas de la página con la clave de servidor almacenada también hizo que una entrada de inicio de sesión de plugin inválida pareciera aceptada. El rebasamiento en tiempo de ejecución (runtime rebasing) no cubría la gestión v8 ni los modelos.

La configuración enmascarada no es equivalente a la configuración nativa para las páginas que derivan
identidades de credenciales a partir de material de claves, proxy, prefijos y cabeceras. El operador aprobó
abrir este límite de plugins de confianza en el issue #151. Instalar un plugin ya permite
que su código se ejecute con los secretos de CPA, y su página con el mismo origen (same-origin) cuenta con la sesión del operador.

## Decisión

Mantener el host protegido por sesión en `<base>/api/v1/plugin-host/` y permitir únicamente las
superficies de origen fijo de esta instancia:

- Recursos de complemento (plugin) bajo `/v0/resource/plugins/<id>/`, sin credenciales.
- Rutas nativas `/v0/management/*` y `/v8/management/*` con GET, HEAD, POST, PUT, PATCH y DELETE.
- Solo GET `/v1/models`, con el Authorization del cliente llamante y sin respaldo de clave de servidor (server-key fallback).

Denegar los puentes salientes arbitrarios `/v0/management/api-call` y
`/v8/management/requests/api-call` y sus descendientes. Rechazar rutas impuras,
recorridos de directorios (traversal), barras invertidas y caracteres de control. No aceptar URLs de destino. Las redirecciones no se siguen;
las cookies y Set-Cookie nunca se cruzan, y las cabeceras de contenido se mantienen en lista blanca.

Preservar los encabezados Authorization y X-Management-Key explícitos en las llamadas de gestión, incluso si están vacíos, para que CPA autentique la clave elegida por el llamante. Inyectar la clave de gestión almacenada solo cuando no se haya proporcionado ninguna cabecera. Nunca colocar dicha clave de servidor en recursos de página, almacenamiento del navegador o en el directorio de modelos. Un plugin puede solicitar por separado una clave al operador.

Las respuestas de la API nativa no están proyectadas y pueden contener secretos de configuración. Registrar cada
intento y resultado de lectura y escritura de la API como `plugin.route_call`, conservando únicamente la superficie fija,
el método y el estado. No registrar sufijos de llamadas, consultas, cuerpos, credenciales ni cadenas de errores de transporte. Los intentos fallidos de auditoría anulan la ejecución ascendente; los resultados de lectura fallidos de la auditoría retienen el cuerpo. Preservar el éxito de una escritura que ya se haya completado si falla la auditoría de resultados. Forzar las respuestas de la API a `Cache-Control: no-store`.

Las escrituras nativas se unen a la puerta de escritura de configuración/proveedores existente a nivel de proceso. Autenticar al
llamante frente a la versión fija leída antes de crear una copia de configuración preescritura cifrada;
el fallo de la copia de seguridad bloquea la mutación. Todas las escrituras v8 y las escrituras v0 del núcleo están controladas de forma conservadora,
incluyendo las operaciones de configuración, estado, cuota y almacenamiento del plugin. Las acciones profundas ordinarias del plugin, como
la sincronización de credenciales, conservan la ejecución propiedad del plugin sin la puerta de configuración.
Las escrituras nativas exitosas invalidan las cachés existentes derivadas de la configuración. No añadir
campos de revisión de OMC al contrato de red (wire contract) de CPA: las escrituras nativas conservan la semántica nativa de última escritura.

Rebasar solicitudes HTML/CSS/JavaScript y peticiones same-origin de fetch, Request, XHR y EventSource
para las tres superficies de API. Dejar los origenes externos y las URLs ya alojadas sin cambios.
Demo rechaza todo el host; las herramientas de Agent/MCP siguen siendo las capacidades declaradas desinfectadas.

## Consecuencias y compensaciones (trade-offs)

Una página de plugin de confianza ahora puede leer la configuración sin procesar, incluidos los secretos de clientes/proveedores.
Este es un límite administrativo documentado e intencional, no una relajación ordinaria de DTO.
La disponibilidad de auditoría es obligatoria incluso para las lecturas nativas. La clasificación conservadora de copias de seguridad de escrituras nativas puede generar capturas instantáneas de escrituras operativas que finalmente no guardan la configuración; la deduplicación existente evita copias duplicadas. Las mutaciones profundas genéricas de los plugins siguen siendo propiedad del plugin.

El host proporciona compatibilidad de protocolo, no inferencia arbitraria, transporte WebSocket o
un proxy de URL externo. Las rutas EventSource se rebasan pero los cuerpos ascendentes permanecen acotados
y almacenados en búfer; esto no promete streaming indefinido. El comportamiento del plugin y su propia política
de almacenamiento siguen siendo responsabilidad del autor del plugin. Las pruebas de inicio genéricas integradas y el
humo de un plugin real aislado se complementan en lugar de reemplazarse mutuamente.
