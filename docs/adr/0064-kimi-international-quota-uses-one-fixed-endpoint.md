# ADR 0064: La cuota internacional de Kimi utiliza un endpoint fijo

- Estado: Aceptado
- Fecha: 2026-10-06

## Contexto

La consola admite credenciales internacionales de Kimi además de las credenciales de Kimi. La observación de cuotas debe utilizar el sistema de cuentas que emitió la credencial; intentar con ambos hosts enviaría el mismo token de portador (`bearer token`) a dos sistemas de cuentas diferentes. La fachada de cuotas ya restringe las solicitudes `api-call` de CPA iniciadas por el servidor a una lista blanca de HTTPS compilada y no expone ningún destino arbitrario a la consola ni a un agente.

## Decisión

Añadir únicamente `https://api.kimi.ai/coding/v1/usages` a `AllowedURLPrefixes`. A diferencia de una entrada que termina en `/`, esta entrada designa un único endpoint: `IsAllowedQuotaURL` permite su límite de consulta/fragmento, pero rechaza segmentos de ruta añadidos, sufijos similares y recorridos de directorios (`traversal`). La observación internacional es un `GET` iniciado por el servidor utilizando el marcador de sustitución de credenciales de CPA, no un token o URL proporcionados por el navegador.

`kimiUsageURLFor` selecciona el endpoint internacional a partir de los metadatos seguros de las credenciales (`type`, `provider` o nombre de archivo) que contengan `kimi-ai`, `kimi_ai` o `kimi.ai`; las demás credenciales de Kimi conservan el endpoint de uso existente `api.kimi.com`. La selección no descarga el contenido de las credenciales ni prueba con otro host tras un fallo.

## Consecuencias

Esto otorga a un destino upstream adicional la autoridad para recibir la credencial seleccionada a través de CPA. Su ruta es deliberadamente más restrictiva que la entrada existente para la familia de endpoints de Kimi. La lista blanca sigue estando en tiempo de compilación y las respuestas de cuota continúan siendo DTOs normalizados; esto no introduce una capacidad general de llamadas a la API (`API-call`). Los futuros destinos upstream requerirán una revisión de seguridad independiente.

`internal/quota/kimi_test.go` fija la selección del sistema de cuentas y los límites del endpoint. No se utiliza ninguna credencial de operador real (`live`) para establecer este contrato.
