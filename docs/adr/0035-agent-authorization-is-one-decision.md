# ADR 0035: La autorización del agente es una única decisión de permitir o denegar, y el agente puede preguntar al operador

- Estado: Aceptado; su presentación de diálogo ha sido reemplazada por [ADR 0043](0043-agent-approval-is-decided-inline.md)
- Fecha: 2026-09-28

## Contexto

Una capacidad invocada por el Agente que modifica el enrutamiento, las credenciales, la disponibilidad o la configuración
espera al operador. Hasta ahora, eso requería tres acciones separadas: buscar la tarjeta de aprobación en el
registro (*transcript*) debajo de la llamada que la preparó; para una capacidad destructiva, escribir el
identificador de destino en un campo de desafío (*challenge*) antes de que el botón de aprobación se habilitara;
y luego presionar Continuar (*Resume*) en el compositor para que el modelo pudiera continuar. Los operadores
encontraron que este flujo era más pesado que la decisión que registra, y el desafío de escritura era la parte más pesada.

El desafío protegía menos de lo que parecía. El operador lee el destino en la misma tarjeta
desde la cual lo escribe, por lo que escribir demuestra atención a una cadena de texto, no comprensión del cambio.
Lo que realmente evita que una aprobación se aplique a lo incorrecto es la revisión en la que se leyó la vista previa:
el ejecutor la revalida dentro de la puerta de escritura y rechaza con `resource_conflict`
cuando el destino ha cambiado en el ínterin. Esas protecciones no dependen del desafío.

Por otro lado, el modelo no tenía forma de preguntarle nada al operador. Cuando una solicitud era ambigua,
o bien adivinaba —y una suposición incorrecta costaba un turno entero corregir— o bien escribía una pregunta en su
respuesta, lo cual terminaba el turno y perdía el plan que estaba siguiendo.

## Decisión

Una aprobación es una única decisión: permitir o denegar.

- La vista previa ya no incluye un desafío, y el endpoint de decisión solo toma `approve`, además de un
  `secret` o una `answer` cuando la operación lo solicita. Las capacidades destructivas conservan su
  permiso, su estilo de advertencia de peligro y una línea explícita de "no se puede deshacer"; la vinculación
  de revisión, el consumo de un solo uso y la pista de auditoría permanecen inalterados.
- La consola abre la solicitud como un diálogo tan pronto como una ejecución se detiene por ella, y tomar una
  decisión continúa la ejecución. Continuar (*Resume*) permanece únicamente como alternativa de respaldo cuando la ejecución
  no puede continuar por sí misma (por ejemplo, la clave seleccionada ya no existe).

El Agente puede hacer preguntas al operador a través de `ask_question`, registrada por `internal/agent`
porque pertenece a la conversación en lugar de a las operaciones de negocio de OMC:

- De 1 a 4 preguntas por llamada, cada una con de 0 a 6 opciones etiquetadas, de opción única o múltiple, y una
  respuesta escrita siempre disponible; el formato que utilizan los agentes de programación establecidos,
  porque una pregunta abierta por ronda cuesta un viaje redondo (*round trip*) por detalle, mientras que las
  opciones fijas por sí solas atrapan al operador cuando ninguna encaja.
- Reutiliza el almacén de operaciones pendientes con un nuevo tipo de entrada humana, `answer`, que el registro
  permite únicamente en una capacidad de tipo `read` (lectura). Una pregunta expira después de 24 horas en lugar de 10 minutos,
  ya que responderla no cambia nada. La respuesta se valida contra las preguntas antes de que la operación sea reclamada,
  por lo que una respuesta malformada deja la pregunta abierta.
- Se ofrece únicamente al Agente integrado; un cliente MCP tiene su propia forma de preguntar a su usuario.
- La consola la dibuja en lugar del compositor en lugar de como un diálogo, porque el texto de la respuesta
  arriba de este suele ser lo que el operador necesita leer para responder, y con el formato de los agentes
  de programación establecidos: una pestaña por pregunta, opciones numéricas que se seleccionan con una tecla
  dígito, "Otra cosa" como última opción y un paso de revisión antes de enviar. Omitir (*Skip*) es una denegación
  sobre la cual se le informa al modelo.

## Consecuencias

Aprobar un cambio es un solo clic en un diálogo que aparece por sí solo, y la conversación
continúa sin otro paso adicional. Un operador ya no puede ser ralentizado deliberadamente por una confirmación
escrita; un despliegue que requiera recuperar esa fricción necesitaría una nueva decisión, ya que el
ejecutor ya no acepta un desafío. El texto visible para el modelo correspondiente a una operación pendiente, la
regla de `uncertain` y la regla de que los agentes externos no pueden aprobar permanecen inalterados.
