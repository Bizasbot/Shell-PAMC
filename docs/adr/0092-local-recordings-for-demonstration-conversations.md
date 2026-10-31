# ADR 0092: Grabaciones locales para conversaciones de demostración

- Estado: Aceptado
- Sustituido en parte: la página Playground, sus rutas y los ADRs 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agente permanece (lista de modelos `GET /agent/models`, ejecuciones `/agent/runs/...`).
- Fecha: 2026-10-10
- Modifica: La demostración pública de solo lectura del ADR 0021 con reproducción de conversaciones local del navegador.

## Contexto

Una demostración pública estática no puede exponer credenciales de proveedores ni consumir cuotas de modelos. Deshabilitar el Agente y el compositor del Playground también oculta su comportamiento de *streaming*, la cadena de capacidades y el comportamiento de la interfaz generada, que son partes importantes de la consola.

## Decisión

Ofrecer una pregunta grabada localizada por espacio de trabajo. La grabación del Agente es una transcripción optimizada y limpia de una ejecución grabada: las fechas son marcadores de posición relativos, los identificadores (*handles*) de ejecución no otorgan autoridad y los resultados de las herramientas contienen datos de demostración. Las reproducciones emiten el mismo vocabulario de eventos de AG-UI o Playground que leen los *reducers* de producción, incluyendo el *streaming* de argumentos, razonamiento, recibos de capacidad, uso y capturas instantáneas finales de la conversación.

El navegador controla el ritmo y la cancelación. No realiza inferencias ni peticiones de escritura al Agente. Otros mensajes se rechazan antes de ser aceptados. Las conversaciones del Agente viven únicamente durante el tiempo de vida de la página; el Playground conserva su comportamiento existente de sesión de demostración local en el navegador. La recarga, cancelación, reintento y una nueva conversación nunca crean una petición al proveedor. Los rechazos de escritura en el lado del servidor del Worker siguen siendo autoritativos.

La *fixture* de token público abarca todo el año calendario. El volumen diario es una extracción normal determinista alrededor de una tendencia estable, con días de inactividad explícitos y fines de semana más tranquilos; las peticiones fallidas aún preservan semánticas de uso plausibles. El resultado es tráfico sintético, no de producción.

## Consecuencias

El visitante puede observar el renderizador de producción sin un proveedor activo. Una reproducción es un ejemplo seleccionado, no una respuesta a una petición arbitraria del visitante. Las grabaciones son activos públicos y pasan controles de privacidad junto con las respuestas de los controladores generados. Las pruebas de Node controlan la fidelidad de los eventos y la cancelación; la aceptación de la demo compilada controla la cadena renderizada, la interfaz de usuario generada y la respuesta.
