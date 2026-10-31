# ADR 0060: Las páginas de plugins se sirven en el mismo origen (same-origin) a través de un host de plugins acotado

- Estado: Aceptado
- Restringe la regla de "prohibir proxy arbitrario de endpoints de CPA" para una superficie acotada; la lista blanca de DTOs del ADR 0038 continúa gobernando cualquier otra respuesta de gestión.

## Contexto

Un plugin de CPA puede registrar páginas (`menus` en `GET /v8/management/plugins`). Cada una es un recurso HTML que el plugin sirve en `/v0/resource/plugins/<id>/...`, sin autenticar, y la página llama a las propias rutas de gestión del plugin en `/v0/management/<route>`, las cuales CPA protege con la clave de gestión. El centro de gestión de CPA muestra dicha página en un frame del mismo origen (same-origin) y la página reutiliza la clave que la consola mantiene en el navegador.

Oh My CPA difiere en tres aspectos que hacen imposible el mismo arreglo tal como está: el navegador nunca almacena la clave de gestión; la consola normalmente se sirve bajo una sub-ruta (`/omc`) de un origen que no es el de CPA, por lo que las rutas absolutas a la raíz de CPA de una página no llegan a CPA; y la fachada responde únicamente DTOs proyectados, nunca respuestas sin procesar de CPA.

Las páginas de plugins existentes también asumen su host: construyen peticiones a partir de `location.origin`, y leen el esquema de colores del host desde el atributo `data-theme` de `window.parent.document.documentElement`.

## Decisión

Servir las páginas de plugins a través de un **host de plugins** bajo `<base>/api/v1/plugin-host/`, detrás de la sesión de la consola, y mostrarlas en un frame del mismo origen (same-origin).

- `GET .../plugin-host/v0/resource/plugins/<id>/...` lee el recurso del plugin desde CPA sin la clave de gestión, tal como CPA mismo lo sirve.
- `GET|POST|PUT|PATCH|DELETE .../plugin-host/v0/management/<route>` llama a una ruta que un plugin registró, con la clave de gestión agregada por el servidor. El primer segmento de la ruta no debe ser uno de los propios roots de gestión de CPA (`config`, `config.yaml`, `auth-files`, `api-keys`, `logs`, `plugins`, `plugin-store`, ...; la lista es `coreManagementSegments` en `internal/cpa/management/client_plugin_host.go`), por lo que el host no puede usarse para leer una configuración, credencial o log sin procesar a través de una puerta trasera. Las rutas se limpian y se rechazan ante intentos de path traversal, barras invertidas y caracteres de control.
- Se eliminan los encabezados `Authorization`, `X-Management-Key` y las cookies propias de la página; solo se reenvía en cada dirección una lista corta de encabezados de contenido; nunca se devuelve `Set-Cookie`; las redirecciones no se siguen y se re-basa la cabecera `Location`.
- HTML, CSS y JavaScript ven sus referencias a la raíz de CPA (`/v0/resource/plugins/`, `/v0/management/`) re-basadas al prefijo del host, y HTML recibe un pequeño script que re-basa los mismos prefijos en tiempo de ejecución para `fetch`, `XMLHttpRequest` y `EventSource`.
- Cada llamada a una ruta de plugin que no sea `GET` se audita (`plugin.route_call`: intento y luego resultado), registrando el método y el estado, nunca el cuerpo.
- El elemento padre del frame es un documento escrito por la consola que lleva `data-theme="dark|light"`, de modo que las páginas escritas para el centro de gestión de CPA sigan el modo de color de la consola.
- Solo se listan las páginas de un plugin en ejecución, únicamente aquellas bajo su propio ID, y el modo demo rechaza toda la superficie.

## Compensaciones (Trade-offs)

**Una página de plugin se ejecuta con la autoridad de la consola.** El mismo origen (same-origin) es lo que hace funcionar a las páginas existentes, y significa que el script de una página puede llamar a la API de la consola como el operador con sesión iniciada. Se rechazó un sandbox de origen opaco (opaque-origin) porque rompe `location.origin`, las lecturas del tema padre y el almacenamiento, los cuales son utilizados por las páginas en circulación. La decisión de confianza es, por lo tanto, la instalación: un plugin ya se ejecuta dentro del proceso del gateway con los secretos del gateway, por lo que su página no representa un permiso más amplio que el plugin en sí, y la tienda mantiene la confirmación del ID tipado para plugins de terceros. La clave de gestión sigue sin llegar nunca al navegador.

**El protector de rutas es una lista negra (denylist).** Las rutas de los plugins son segmentos iniciales arbitrarios, por lo que no se pueden incluir en una lista blanca sin consultar a CPA qué rutas registró un plugin, algo que CPA no reporta. La lista negra se deriva de la tabla de rutas de CPA v8.0.15 y debe extenderse cuando CPA agregue un root de gestión; un plugin no puede enmascarar una ruta del núcleo, ya que CPA resuelve sus propias rutas primero. Las respuestas de las rutas de plugins pertenecen al propio plugin y se transmiten sin proyectar por esa razón, tal como ya ocurre con el documento de configuración del plugin.

**La re-base es textual.** Una página que ensambla una ruta a la raíz de CPA a partir de fragmentos en tiempo de ejecución es capturada por el *shim* de peticiones, no por la reescritura; una página que navega en la ventana superior o abre un WebSocket hacia una ruta de la raíz de CPA no es re-basada.

## Consecuencias

Las páginas de plugins aparecen en el grupo Plugins de la navegación y en el panel lateral de configuración del plugin. La matriz de paridad marca las páginas de plugins como cubiertas; la cuota de plugins (`/plugins/:id/quota`) sigue planificada.
