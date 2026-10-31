# ADR 0075: Los mensajes del Agente aceptan imágenes, guardadas junto a la conversación

- Estado: Aceptado
- Superado en parte: la página de Playground, sus rutas y los ADRs 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agente se mantiene (lista de modelos `GET /agent/models`, ejecuciones `/agent/runs/...`).
- Fecha: 2026-10-08
- Supera la decisión "Images are not taken" de
  [ADR 0074](0074-agent-attachments-are-text-inside-the-message.md). Los archivos de texto siguen
  viajando dentro del mensaje tal como describe ese ADR.
- Extiende el [ADR 0041](0041-agent-runs-speak-ag-ui-and-render-with-assistant-ui.md): el
  único mensaje de usuario de una ejecución puede constar de múltiples partes.

## Contexto

Los operadores sostienen aquello sobre lo que quieren preguntar en forma de imágenes con la misma frecuencia que de texto: una captura de pantalla de la página de error de un servicio upstream, un panel de control (*dashboard*) de otra herramienta, un gráfico de un informe. El ADR 0074 omitió las imágenes porque el Agente reanuda un turno a partir de lo que almacenó el servidor, y una imagen o debe almacenarse o el modelo reanudado ya no ve aquello sobre lo que se le preguntó.

El costo de almacenamiento era el argumento en contra. La conversación es un único documento cifrado que se reescribe en cada ronda de cada turno, con un límite de 900 KiB; una sola captura de pantalla es más grande que eso. Pero el Agente es la superficie principal de la consola, los modelos que impulsa leen imágenes de forma nativa, y "pegarlo en el Playground en su lugar" sacrifica capacidades, historial y aprobaciones por una sola imagen.

## Decisión

**Una imagen viaja junto al mensaje, en forma de bytes.** El mensaje de usuario de una ejecución es una cadena de texto, como antes, o partes de AG-UI: como máximo una parte de tipo `text` y hasta cuatro partes de tipo `binary` que transportan `mimeType` y `data` en base64. Se rechaza cualquier parte que nombre una `url` —el servidor nunca realiza peticiones (*fetches*) en nombre de un mensaje—. Cada imagen de origen tiene como máximo 5 MiB decodificados, debe ser PNG, JPEG o WebP, y sus bytes iniciales deben coincidir con su tipo declarado. Antes del almacenamiento, el navegador normaliza las imágenes del Agente a WebP, con un máximo de 2048 píxeles en su borde largo y 512 KiB, de modo que el contexto repetido permanezca compacto sin alterar el contrato de validación del archivo original. Un mensaje puede constar únicamente de imágenes.

**El servidor almacena cada imagen como su propio documento.** Las imágenes son `agent_documents` del tipo `image` (migración 036), cifradas como cualquier otro documento del Agente y ocupando una fila cada una. La conversación guarda una referencia por imagen —identificador, tipo de medio y tamaño— en el turno que la transporta, por lo que el documento de conversación se mantiene tan pequeño como antes y sigue reescribiéndose por completo en cada ronda.

**Una imagen vive exactamente el mismo tiempo que su turno.** Se elimina cuando el turno es expulsado de la ventana de la conversación o cuando la conversación se reinicia. Un reintento o una edición del turno más reciente conservan las imágenes de ese turno: el mensaje de reemplazo hereda las referencias y los documentos no se reescriben.

**El modelo ve las imágenes más recientes en cada ronda.** Cada solicitud carga los documentos de imagen a los que hacen referencia sus mensajes y los envía como partes de tipo `image_url` con URLs de datos (*data URLs*). Solo se cargan las ocho imágenes más análogas y recientes de la conversación; una más antigua se reemplaza por una nota de texto breve que indica que se adjuntó una imagen y ya no se muestra, de modo que la solicitud de una conversación larga no crezca sin límite y se le informe al modelo lo que no puede ver. Los bytes de las imágenes no se contabilizan para el límite de texto de la solicitud; dicho límite existe para acotar lo que los resultados de las capacidades añaden a una solicitud, mientras que las imágenes se limitan por conteo y tamaño en su lugar.

**La consola lee una imagen desde un único endpoint.** `GET /api/v1/agent/images/{id}` sirve una imagen únicamente mientras la conversación actual haga referencia a ese identificador, bajo la autenticación de sesión que utiliza cada solicitud de la consola, con la directiva `nosniff`, una política de seguridad de contenidos de aislamiento (*sandboxing*) y un tiempo de vida de caché privada e inmutable. La demostración pública rechaza esta ruta.

**El componente de redacción (*composer*) acepta ambos tipos de archivo adjunto a través de un único control.** Un archivo cuyo tipo declarado sea una imagen se verifica como imagen y se previsualiza como miniatura; cualquier otro archivo se verifica como texto (ADR 0074). Las imágenes se pueden seleccionar, arrastrar y soltar, o pegar.

## Consecuencias

- La base de datos del Agente crece hasta en cuatro imágenes de 5 MiB por mensaje mientras sus turnos permanezcan en la ventana de conversación. `repository.MAX_AGENT_DOCUMENT_BYTES` aumenta a 8 MiB para albergar una imagen codificada en base64; el propio límite de 900 KiB de la conversación permanece inalterado.
- El cuerpo de una solicitud de ejecución puede ahora alcanzar decenas de megabytes. El límite de tamaño del cuerpo del endpoint de ejecución se incrementa para ello; cualquier otro límite sobre el texto de un mensaje se mantiene intacto.
- No se verifica antes del envío si el modelo seleccionado lee imágenes. Que un modelo no lo haga es un error del upstream que debe reportarse, mostrado como cualquier ejecución fallida; los datos de modalidades del catálogo de referencia son informativos y bloquearían erróneamente a modelos que este desconoce.
- Las solicitudes que transportan imágenes consumen tokens del upstream en cada ronda del turno y de los turnos posteriores a este, hasta que la imagen quede fuera de las ocho más recientes.
- Una conversación exportada incrusta las imágenes que la consola pudo leer en el momento de la exportación, de modo que el archivo sea independiente; la exportación en JSON solo transporta las referencias.
- Los agentes externos a través de MCP no se ven afectados: las imágenes forman parte del protocolo de ejecución del Agente integrado, no de ninguna capacidad.
