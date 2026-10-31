# ADR 0093: Las conversaciones portátiles conservan el orden de las respuestas en vivo

- Estado: Aceptado
- Fecha: 2026-10-10
- Modifica: La limitación de exportación del ADR 0082 y el límite de conversación portátil del ADR 0043.

## Contexto

El agente en vivo ubica las figuras generadas entre las partes ordenadas de las respuestas y agrupa las llamadas adyacentes de razonamiento y capacidades en líneas de tiempo de trabajo. La instantánea de exportación aplanaba dichas partes en texto, llamadas y vistas separadas, por lo que el HTML portátil no podía reconstruir dicho orden. La ruta PNG renderizaba un documento externo con scripts deshabilitados: sus marcos de lienzo opacos anidados no podían aportar la interfaz de usuario generada a la imagen final `foreignObject` de SVG.

## Decisión

Conservar los segmentos ordenados en una instantánea aislada y censurada. El módulo hoja `answerLayout.ts` se encarga de la agrupación de razonamientos/llamadas; `callFacts.ts` gestiona los resúmenes de llamadas y los datos de estado/tiempo sin una dependencia de tiempo de ejecución en una página. El framework en vivo adapta dicha agrupación y el renderizador portátil consume los mismos segmentos. Las figuras mantienen su posición y encuadre; las figuras fallidas siguen siendo filas de diagnóstico. Los detalles de resultados permitidos conservan las reglas de censura existentes.

Para el PNG, se deja un espacio (slot) por cada lienzo generado, se dibuja su documento congelado en un marco opaco separado y bloqueado de la red con el ancho medido del espacio, se solicita el protocolo existente de imágenes SVG acotadas y se reemplaza el espacio con una imagen de datos PNG. La transcripción externa sigue teniendo los scripts deshabilitados. Las descargas de imágenes de figuras en vivo y el PNG de conversación utilizan las mismas primitivas de `canvasCapture.ts`. Se siguen aplicando la identidad del remitente, la identidad de la solicitud, las restricciones de dimensiones y los presupuestos ráster; una figura fallida mantiene una nota explícita de imagen no disponible. Cada página de transcripción debe codificarse antes de que comience cualquier descarga.

El HTML mantiene la interfaz de usuario generada en ejecución únicamente dentro de su sandbox opaco existente. Sus controles de divulgación fijos operan localmente. Las fuentes empaquetadas existentes, los tokens de paleta resueltos, las reglas de privacidad y la CSP (Política de Seguridad de Contenido) de exportación sin red permanecen inalterados.

## Consecuencias

El HTML y el PNG portátiles conservan la misma respuesta ordenada, las líneas de tiempo de trabajo y la ubicación de las figuras. El PNG representa el documento generado congelado en lugar de mutaciones de un marco interactivo que ya está en pantalla. Los documentos largos conservan la paginación basada en los límites de los bloques. Los marcos de sandbox adicionales solo existen durante la captura y se eliminan en caso de éxito o fallo. Las pruebas puras de agrupación/instantáneas y el contenido configurado por scripts en navegadores reales, los píxeles PNG de colores exactos, el diseño móvil y la limpieza de marcos respaldan estas afirmaciones.
