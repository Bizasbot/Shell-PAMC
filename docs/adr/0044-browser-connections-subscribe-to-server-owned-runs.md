# ADR 0044: Las conexiones del navegador se suscriben a ejecuciones gestionadas por el servidor

- Estado: Aceptado
- Superado en parte: la página de Playground, sus rutas y los ADRs 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agent se mantiene (`GET /agent/models`, ejecuciones en `/agent/runs/...`).
- Fecha: 2026-09-30

## Contexto

Un flujo (stream) del navegador no es un límite de ejecución. Una conexión débil, una pestaña desconectada o una recarga de página pueden hacer que se pierda la respuesta mientras CPA o una capacidad terminan su trabajo. Tratar cada flujo perdido como una tarea detenida es engañoso; iniciar automáticamente otra generación puede incurrir en otra llamada de pago o repetir una escritura externa. El estado del Agent ya pertenece al servidor (ADR 0041), mientras que Playground persiste su última sesión de visualización como una preferencia (ADR 0024).

## Decisión

Las solicitudes de generación de la consola transportan `X-OMC-Run-ID`. La API admite una ejecución gestionada por espacio de trabajo (`agent` o `playground`), desvincula su contexto del suscriptor y escribe el protocolo existente en un búfer en memoria acotado (journal). Los clientes existentes sin esta cabecera conservan la semántica de flujo directo. El mismo ID y una solicitud idéntica a nivel de bytes se adjuntan a la ejecución existente; una solicitud modificada con ese ID constituye un conflicto. Un ID en competencia no puede reemplazar a una tarea en ejecución.

Las rutas autenticadas por sesión bajo la base de la API configurada proporcionan:

- `GET /agent/runs/active` y `GET /playground/runs/active`: el descriptor recuperable más reciente.
- `GET /agent/runs/{id}` y `GET /playground/runs/{id}`: reproducción desde el principio y, a continuación, suscripción.
- `POST /agent/runs/{id}/cancel` y `POST /playground/runs/{id}/cancel`: cancelación explícita de la ejecución.

Los suscriptores esperan notificaciones de cambios; sus sockets reciben latidos (heartbeats) SSE de 15 segundos. El navegador utiliza un retroceso exponencial acotado para la reconexión (de 500 ms a 8 s), espera a que se restablezca la conexión (`online`) cuando está desconectado y reconecta una lectura de cabecera o cuerpo estancada durante 45 segundos. La reproducción restablece primero el reductor transitorio, por lo que ni los fotogramas parciales ni los tokens ya mostrados se añaden dos veces. El POST de generación inicial nunca se repite automáticamente, incluso cuando se perdió su confirmación (acknowledgement). El rechazo codificado de una fachada, un journal faltante o una autenticación caducada finalizan la recuperación en lugar de iniciar otra generación. La cancelación reintenta únicamente el comando de cancelación idempotente. Abandonar una vista aborta únicamente su suscripción.

El journal completado más reciente está disponible durante 15 minutos, hasta que sea reemplazado o hasta que finalice el proceso. Cada journal almacena como máximo 4 MiB de salida transmitida más un pequeño error de desbordamiento terminal. El desbordamiento cancela la tarea en lugar de retener una salida sin acotar. Las ejecuciones desvinculadas tienen un límite máximo de 30 minutos; Playground mantiene su límite estricto existente de 10 minutos. Los ID reemplazados o caducados se marcan como lápida (tombstoned) durante 24 horas con un límite de admisión de 1.024 entradas; un historial lleno rechaza nuevo trabajo gestionado. Los trabajadores desvinculados conservan el límite de pánico HTTP original y emiten únicamente errores de máquina que no revelan secretos. El apagado de la aplicación detiene la admisión, cancela y une (joins) las tareas antes de cerrar sus dependencias.

El Agent sigue persistiendo su transcripción autoritativa antes de la instantánea final. Su proyección en la consola excluye los mensajes privados del modelo, las llamadas pendientes y las celdas de resultado de consultas a bases de données (database-query). El descriptor de recuperación de Playground deriva su solicitud y el mensaje del usuario del POST aceptado real, no de una transcripción proporcionada por el cliente. Solo se toman metadatos de visualización acotados (`keyLabel`, `replaces_id`) de `recovery_turn`; las imágenes grandes en línea se redactan en cada copia de descriptor retenida. Al recuperar, la interfaz de usuario restaura el destino y la configuración del turno, reproduce el journal y persiste la sesión consolidada a través del escritor de preferencias existente. `last_run_id` registra qué journal completado ya ha reconocido esa sesión, incluso después de "Nueva conversación"; un journal antiguo no puede resucitar una conversación borrada. No existe ningún escritor de preferencias de backend en competencia.

## Consecuencias

- La pérdida del navegador no cancela la inferencia ni un flujo de trabajo. La detención es ahora un comando del servidor en lugar de un aborto HTTP local; los efectos externos ya completados permanecen completados.
- Se trata de una recuperación acotada y local al proceso, no de una cola de trabajos duradera. Reiniciar OMC finaliza las tareas en memoria; el Agent expone los resultados almacenados inciertos o interrumpidos y nunca vuelve a reproducir una escritura externa. Un resultado de Playground no recuperado dentro del período de retención puede perderse si su pestaña nunca lo persistió.
- Una reproducción puede repetir invalidaciones de vista, las cuales son lecturas de caché inofensivas, pero nunca ejecuta una capacidad. Solo la tarea original posee la propiedad de ejecución.
- Todas las rutas de recuperación comparten la autenticación de la consola, respuestas `no-store` y el límite existente de DTO y privacidad. La demostración pública no devuelve ninguna ejecución activa y rechaza las suscripciones y cancelaciones.
- Las pruebas en Go basadas en canales cubren la admisión, reproducción, cancelación, caducidad, límites de salida y apagado. Las pruebas de transporte herméticas cubren las confirmaciones perdidas, flujos parciales, estado desconectado/conectado, aborto y autenticación; los sondeos del navegador cubren la actualización (refresh), la recuperación de una sola generación, el comportamiento de borrado de sesión, el borde ligero de Stop y las etiquetas de tiempo transcurrido en décimas de segundo.
