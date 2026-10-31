# ADR 0065: Las observaciones de cuota utilizan puntos de conexión fijos de Meta y de suscripción

- Estado: Aceptado
- Fecha: 2026-10-06

## Contexto

La comparación de CPAMC en `ee79a794526a30c03748a8864a9ac6589a31833b`
identificó observaciones faltantes de cuota para Meta Muse y lecturas en vivo de planes
de xAI y Antigravity. La superficie general de llamadas API de CPA puede enviar solicitudes
portadoras de credenciales a destinos arbitrarios. Por lo tanto, añadir estas observaciones
modifica una frontera de seguridad existente, a pesar de que la consola aún no ofrece ninguna
herramienta general de llamadas API.

Meta es un caso especial: `/muse-code/key` devuelve el uso de la suscripción junto con una
clave LLM acuñada. El token de acceso OAuth de CPA ya puede ser esa clave LLM; el punto de
conexión requiere el token de Acceso de Cliente de Dispositivo (DCA) de la credencial guardado por
separado. Su solicitud POST no es una lectura pura y puede acuñar una clave en el servidor upstream.
Un marcador de credencial no debe sustituir silenciosamente el token incorrecto.

## Decisión

Añadir cuatro rutas individuales de puntos de conexión HTTPS a la lista blanca de cuotas compilada:

| Punto de conexión | Solicitud propiedad del servidor |
| --- | --- |
| `https://api.meta.ai/muse-code/key` | POST `{}` con el bearer DCA almacenado y `x-api-version: 1.0.0` |
| `https://cli-chat-proxy.grok.com/v1/user` | GET con el parámetro de consulta fijo `include=subscription` |
| `https://cli-chat-proxy.grok.com/v1/settings` | GET |
| `https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` | POST con `metadata.ideType: ANTIGRAVITY` |

Estas entradas no admiten ningún segmento de ruta adicional ni sufijos similares; la validación de
URL existente rechaza el recorrido (`traversal`). Ni el navegador ni Agent/MCP proporcionan un
destino, método, bearer o cuerpo de solicitud arbitrario. Las lecturas de suscripción de xAI
enriquecen una observación de facturación exitosa de la CLI, no un respaldo (*fallback*) de salud de
claves API. Antigravity utiliza únicamente el punto de conexión diario de Code Assist, sin probar
servidores de suscripción adicionales. Ambos proveedores continúan utilizando la sustitución de
credenciales del lado del servidor de CPA.

Solo para Meta, el servicio de cuotas en Go descarga la credencial almacenada seleccionada desde
CPA y extrae exactamente su `dca_token`. Los tokens DCA faltantes o inválidos y las credenciales
que solo existen en tiempo de ejecución fallan sin realizar una llamada upstream; nunca se sustituye
una clave LLM ni otro campo de token. El material del token es local a la solicitud y nunca se incluye
en el DTO normalizado, la instantánea (`snapshot`), los detalles de auditoría, el estado del navegador
o la salida del Agente. La consola debe registrar una auditoría de intento antes de esta descarga e
intercambio, tanto para observaciones individuales como por lotes. La selección por lotes se recorta y
desduplica antes de auditar o llamar a CPA, de modo que una credencial se intercambia una vez por
solicitud, actualizando como máximo diez credenciales distintas. El motor de capacidades existente
audita las escrituras de Agent/MCP antes de su ejecución. Un fallo en la auditoría de resultados no
deshace ni reintenta un intercambio que ya tuvo éxito. Ninguna clave API devuelta se guarda de vuelta
en CPA ni es retenida por OMC.

Decodificar únicamente el nombre del plan, el estado explícito de suscripción activa y las dos
ventanas de cuota del documento de éxito de Meta. Descartar las claves acuñadas y los datos de cuenta.
Todo transporte de Meta, fallo HTTP o de decodificación utiliza texto de diagnóstico acotado en lugar
de cuerpos/errores upstream, los cuales pueden hacer eco de tokens, claves o datos personales. El uso
desconocido permanece desconocido, nunca cero. El estado de suscripción activa desconocido permanece
ausente, no falso.

Las observaciones de suscripción son suplementarias: su fallo no debe descartar una lectura
independiente y exitosa de cuota/facturación. xAI retiene su etiqueta de respaldo de facturación y los
datos de uso adicional cuando ninguno de los puntos de conexión del plan responde. Antigravity nunca
asume Pro tras una lectura fallida de suscripción; un nivel en vivo no reconocido se etiqueta con su
nombre/id upstream pero se califica como desconocido, y un nivel en vivo ausente se considera desconocido.

## Consecuencias y verificación

La nueva autoridad consta de cuatro rutas, no de cuatro servidores o familias de puntos de
conexión abiertos. La actualización de Meta es explícitamente una observación respaldada por intercambio
de claves, no promocionada como una lectura libre de efectos secundarios. La consola y las herramientas
existentes `quota_list`/`quota_refresh` exponen únicamente campos normalizados de suscripción/ventana;
no se introduce ninguna nueva capacidad de proxy general ni capacidad de Agente que maneje secretos.

El contrato se basa en el código fuente fijado de CPAMC y de CPA v8.0.2, no en un experimento con una
cuenta de proveedor en vivo. Las pruebas de cuotas herméticas fijan las formas de solicitud, la selección
de DCA, los límites de los puntos de conexión, las lecturas desconocidas y los fallos de suscripción
independientes. La regresión real del enrutador de Meta verifica la auditoría de fallo seguro y la
ausencia de secretos en las respuestas y las instantáneas almacenadas. Las respuestas de demostración
siguen siendo observaciones de fixtures locales y nunca contactan a un proveedor.
