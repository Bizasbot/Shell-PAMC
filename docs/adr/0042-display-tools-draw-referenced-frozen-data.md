# ADR 0042: Las herramientas de visualización representan datos referencionados, congelados en la llamada

- Estado: Aceptado
- Fecha: 2026-09-29

## Contexto

Una respuesta sobre uso suele ser una tendencia o una comparación, y el Agente solo podía escribirla en prosa o como una tabla en Markdown generada por el modelo. Ambas tienen los mismos dos defectos. Los números son la reinterpretación que hace el modelo del resultado de una capacidad, por lo que un error de transcripción es indistinguible de los datos; y cada fila cuesta tokens dos veces: una cuando la capacidad los devuelve y otra cuando el modelo los repite.

Permitir que el modelo emita una especificación de gráfico con sus propios datos dibujaría las figuras pero mantendría ambos defectos. Permitir que el navegador lea el resultado de una capacidad directamente dibujaría datos reales, pero vincularía la imagen a lo que ese resultado signifique la próxima vez que se abra la página, y requeriría un análisis con la forma de la capacidad en el navegador para cada capacidad.

## Decisión

El Agente tiene dos herramientas de visualización, `render_chart` y `render_table`, que solo se ofrecen cuando el cliente declara que puede representarlas (la consola lo hace; el puente MCP no).

- **Los datos se referencian, no se transcriben.** El modelo nombra un `source {call_id, path}`: una llamada a capacidad exitosa de esta conversación y una ruta con puntos (dot path) hacia sus filas (objetos, o arreglos posicionales junto con una lista `columns`, que es la forma en que se referencia el resultado de una `database_query`). El servidor resuelve la referencia, proyecta los campos nombrados y los valida: los campos `y` de un gráfico deben ser numéricos, un campo debe existir en alguna fila y se rechazan los valores anidados. Las filas `inline` (como máximo 200) existen solo para figuras que el modelo derivó por sí mismo y que ninguna capacidad devolvió.
- **La vista se congela en el registro (trace).** El conjunto de datos resuelto (tipo, título, especificación de gráfico, columnas, filas y su fuente) se almacena en el registro de la llamada, de modo que una recarga muestra las mismas figuras sin importar lo que los datos del despliegue hayan cambiado desde entonces, y una exportación incluye exactamente lo que se dibujó.
- **El modelo recibe un recibo, no las filas**: `{rendered, rows, fields}`. Un rechazo es un resultado ordinario de tipo `invalid_tool_arguments` con un detalle que nombra el campo de la solicitud que debe modificarse, y nunca cita datos almacenados.
- **No son capacidades.** No cambian nada, por lo que nunca pasan por el ejecutor, nunca preparan una operación, nunca interrumpen una ejecución y no se auditan como operaciones.
- Límites: 1000 filas, 12 columnas de tabla, 8 series de gráficos, 96 KiB por vista; un arreglo más grande se rechaza con la instrucción de agregar primero.

La consola dibuja una vista únicamente a partir de un turno que tuvo éxito: las figuras forman una sección de resultados después de la respuesta, fuera de la cadena de llamadas colapsada (una tabla con ordenamiento, copia y descarga en CSV; un gráfico en la pila de gráficos de la consola con paleta de series, información sobre herramientas compartida y reglas de movimiento), cargada de forma perezosa (lazy), con un interruptor para ver las filas detrás de ella y descarga en PNG. Mientras se ejecuta el turno, una respuesta detenida o una referencia rechazada mantienen la llamada de visualización en el registro como trabajo ordinario; un gráfico o tabla que el modelo dibujó mientras investigaba no se publica como resultado de una respuesta.

## Consecuencias

- Las cifras de un gráfico son las cifras de una capacidad. Lo que el modelo puede hacer mal es a qué resultado apunta y cómo lo describe, los cuales el operador puede verificar en los detalles de la llamada.
- Las visualizaciones son artefactos de respuesta final: la investigación permanece en el registro, por lo que una tarea larga no puede convertir la transcripción en una galería de figuras intermedias.
- Un gráfico o tabla cuesta sus datos una sola vez en tokens.
- Una conversación almacenada crece según las filas congeladas; el límite de bytes por vista y el recorte existente de la sesión por turnos completos mantienen esto acotado.
- Una nueva capacidad no necesita nada para poder ser representada: cualquier resultado que mantenga sus filas como objetos, o como arreglos posicionales junto con los nombres de sus columnas, puede ser referenciado.
