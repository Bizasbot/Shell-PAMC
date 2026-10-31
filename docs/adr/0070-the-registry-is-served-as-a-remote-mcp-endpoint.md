# ADR 0070: El registro de capacidades se sirve como un endpoint MCP remoto

- Estado: Aceptado
- Fecha: 2026-10-07
- Extiende [ADR 0026](0026-one-capability-registry-over-shared-operations.md): la
  clave de gestión ahora se acepta como credencial de tipo *bearer* en una ruta adicional, el
  endpoint MCP. Todo lo demás en el ADR 0026 se mantiene.

## Contexto

Los agentes externos accedían a Oh My CPA únicamente a través de `oh-my-cpa mcp`, un proceso stdio que
reenvía las llamadas a herramientas MCP hacia los endpoints HTTP de capacidades. Eso requiere el binario
de OMC en la máquina donde se ejecuta el agente. La mayoría de las implementaciones se encuentran en un contenedor en un servidor, mientras que
el agente se ejecuta en una computadora portátil o en un entorno alojado: conectarse significaba descargar un
archivo comprimido de la versión para la plataforma del agente solo para hacer un proxy de solicitudes HTTPS que el propio cliente MCP
del agente podría haber realizado por sí mismo. Los clientes que solo aceptan una URL no podían conectarse
en absoluto.

Los endpoints de capacidades ya aceptan la clave de gestión desde cualquier ubicación de red,
por lo que la duda nunca fue si se debía permitir el acceso remoto, sino si este requería un
proceso auxiliar local.

## Decisión

Oh My CPA sirve el registro a través del transporte HTTP Streamable de MCP en
`<base path>/api/mcp`, dentro del proceso de la consola.

- **Una definición de servidor, dos transportes.** `mcpbridge.NewServer` declara las herramientas
  desde un `Backend`; el backend del endpoint llama a `capability.Executor` en el mismo proceso y
  el backend del puente stdio llama a los endpoints HTTP de capacidades. Los nombres de las herramientas, esquemas,
  anotaciones, instrucciones, el enlace de aprobación y `omc_operation_status` no pueden diferir
  entre ellos. El puente stdio se mantiene para los clientes que solo admiten stdio.
- **Únicamente token *Bearer*.** El endpoint acepta `Authorization: Bearer <management key>` y
  nada más. Se rechaza cualquier cookie de sesión de consola, por lo que una página abierta en el navegador del operador
  no puede controlarlo. Las claves incorrectas consumen la misma limitación de tasa (*throttle*) por dirección que el
  formulario de inicio de sesión. El principal es el `mcp` existente: cada capacidad declarada para ese
  adaptador, y nunca la aprobación, el envío de secretos o la finalización de OAuth.
- **Sin estado, respuestas JSON planas.** Ninguna herramienta necesita un mensaje iniciado por el servidor, por lo que el
  endpoint no mantiene ninguna sesión MCP: nada que retener en la memoria, nada que se pierda al reiniciar,
  y una solicitud se completa por sí misma detrás de cualquier proxy inverso. `omc_operation_status`
  toma `wait_seconds` (como máximo 30) para que un agente pueda esperar la decisión del operador
  en una sola llamada en lugar de mantener un flujo abierto.
- **La aprobación permanece en la consola.** El resultado de una operación preparada incluye un enlace a
  `<console>/authorize/<id>`, construido a partir de la dirección a la que llegó el invocador. Se abre una
  pantalla de autorización independiente fuera del shell de la consola, modelada según las
  pantallas de consentimiento de los servicios a los que los agentes ya se conectan: quién solicita, en qué
  implementación, para qué capacidad, el cambio preparado, y Denegar (Deny) y Permitir (Allow) como objetivos equivalentes.
  La operación se originó en otro programa, por lo que no hay una transcripción en la cual
  colocar una tarjeta (ADR 0043), y un operador que llega desde un enlace solo vino a responder una
  pregunta. El control de inicio de sesión se ejecuta primero y la decisión va al mismo endpoint que
  las aprobaciones del agente integrado (ADR 0035), bajo la sesión del operador.
- **Rechazado en modo demo**, al igual que la invocación de capacidades.

## Consecuencias y compensaciones

- La clave de gestión ahora viaja desde dondequiera que se ejecute el agente. Esta es la misma
  exposición que ya tenían los endpoints de capacidades y el formulario de inicio de sesión; la consola advierte
  cuando se está sirviendo a través de HTTP plano fuera de *loopback*, y el puente stdio sigue
  rechazando el HTTP plano que no sea de *loopback*. El endpoint en sí no puede rechazar HTTP plano: detrás
  de un proxy inverso con terminación TLS, cada solicitud le llega como HTTP.
- La protección de reencuadernación de DNS (*DNS-rebinding guard*) del SDK, que rechaza conexiones de *loopback* que transportan un
  encabezado `Host` que no es de *loopback*, está deshabilitada. Rechazaría cada solicitud reenviada por un
  proxy inverso en el mismo host, lo cual es una implementación documentada. Lo que defiende -
  un servidor local no autenticado accesible desde una página web hostil - no aplica:
  el endpoint requiere una credencial que la página no posee e ignora las cookies. La
  verificación de origen cruzado (*cross-origin*) del SDK para solicitudes de navegador se mantiene activa.
- No se ofrece ningún servidor de autorización OAuth. Los clientes que insisten en el descubrimiento de OAuth
  no pueden conectarse por URL y deben usar el puente stdio. Una credencial por agente constituiría un
  segundo modelo de autoridad además del elegido en el ADR 0026, y representa una decisión separada.
- `internal/api` ahora depende de `internal/mcpbridge` y, a través de este, del SDK de MCP.
- Un endpoint sin estado no puede enviar notificaciones `tools/list_changed`. El registro es fijo al
  iniciar, por lo que no hay nada que enviar.
