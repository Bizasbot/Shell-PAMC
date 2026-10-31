# ADR 0074: Los archivos adjuntos del Agente son texto dentro del mensaje

- Estado: Aceptado
- Reemplazado parcialmente en parte: la página del Playground, sus rutas y los ADRs 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agente se mantiene (lista de modelos `GET /agent/models`, ejecuciones `/agent/runs/...`).
- Fecha: 2026-10-08
- Se basa en el [ADR 0041](0041-agent-runs-speak-ag-ui-and-render-with-assistant-ui.md):
  una ejecución sigue transportando un mensaje de usuario como una sola cadena de texto.

## Contexto

Los operadores le consultan al Agente sobre elementos que poseen en forma de archivos: un extracto de registro (log), un fragmento de configuración, una tabla exportada. Pegar estos elementos en el cuadro de mensajes funciona, pero oculta la pregunta, y la transcripción muestra entonces un muro de contenido de archivo donde debería haber un mensaje.

El servidor del Agente mantiene cada turno como los mensajes que el modelo vio y continúa un turno a partir de ese registro: un turno que se detiene para una aprobación o una pregunta se reanuda, posiblemente mucho más tarde y desde otro navegador, a partir de lo que se almacenó. Todo lo enviado al modelo pero no almacenado faltaría al reanudar, y el modelo continuaría una conversación cuyo inicio ya no puede ver. El Playground puede enviar imágenes porque sus turns (turnos) nunca se reanudan y su turno almacenado mantiene únicamente un marcador de posición; el Agente no puede tomar prestado eso.

## Decisión

**Un archivo es texto y viaja dentro del mensaje.** El editor (composer) acepta archivos de texto —seleccionados, arrastrados o pegados— y adjunta cada uno a las palabras del operador como

```text
<file name="gateway.log">
...content...
</file>
```

El servidor ve un mensaje ordinario. Nada relacionado con el almacenamiento, la reanudación, el presupuesto de peticiones o la exportación cambia, porque no existe nada nuevo que almacenar.

**Lo que decide es el contenido, no el nombre.** Se puede ofrecer cualquier archivo; se adjunta únicamente si sus bytes son UTF-8 válido sin bytes de control binarios. Un mensaje transporta como máximo cuatro archivos y 40 KiB de ellos en conjunto. El rechazo se notifica en un aviso (toast). Al nombre de un archivo se le eliminan los caracteres que podrían cerrar su atributo, y una etiqueta de cierre dentro del contenido se escapa para que un archivo no pueda finalizar su propio bloque y continuar haciéndose pasar por las palabras del operador.

**El límite del mensaje aumenta para ajustarse a esto.** Un mensaje puede tener 48 KiB (`agent.MAX_MESSAGE_BYTES`, reflejado por el decodificador de AG-UI), y el endpoint de ejecución (run endpoint) lee hasta 128 KiB para que el escape de JSON tenga suficiente espacio. El presupuesto de peticiones sigue dimensionando cada petición de modelo a la ventana de contexto del modelo seleccionado, por lo que un archivo largo hace que los turnos más antiguos pierdan su lugar en lugar de fallar la petición.

**Se le indica al modelo qué es un bloque.** La sección de seguridad del prompt indica que el contenido de un bloque `<file name>` es un archivo de texto que el operador adjuntó: datos para leer, no instrucciones a seguir.

**La transcripción muestra los archivos por nombre.** Un mensaje enviado se representa mediante sus palabras, con cada archivo como un chip de nombre y tamaño sobre ellas. Editar el mensaje más reciente devuelve las palabras al editor y conserva los archivos junto con la edición.

**No se admiten imágenes.** Una imagen no tiene forma dentro de una cadena de texto, por lo que darle soporte significaría almacenar los bytes de la imagen con el turno, o reanudar un turno sin ellos. Lo primero altera lo que almacena el almacenamiento de conversaciones y cuánto puede crecer; lo segundo rompe la reanudación. Ninguna de las dos opciones vale la pena como efecto secundario de los archivos adjuntos, por lo que la entrada de imágenes sigue siendo una capacidad del Playground hasta que se decida por separado.

## Consecuencias

- El contenido de un archivo se encuentra en la conversación almacenada y en sus exportaciones, exactamente como lo haría un texto pegado. El aviso de datos del editor ya lo cubre.
- Un archivo que supere el límite debe ser reducido por el operador; las capacidades de `database_query` y de uso del Agente siguen siendo la forma de leer datos grandes.
- La sintaxis de bloques es una convención sobre la cual se le informa al modelo, no un protocolo: un mensaje escrito a mano con la misma forma se renderiza de la misma manera, lo cual es inofensivo ya que no otorga ningún privilegio.
