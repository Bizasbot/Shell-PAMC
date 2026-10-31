# ADR 0054: El progreso de carga y la actividad de espera están separados

- Estado: Aceptado
- Fecha: 2026-10-03
- Modifica: La presentación de la barra de carga, el valor accesible y el ciclo de vida de finalización del ADR 0052.
  La contabilidad de tareas, el retraso de 200 ms, los marcadores de posición de carga inicial y la retención de datos en la actualización se mantienen sin cambios.

## Contexto

Las consultas (queries) y las importaciones diferidas revelan su inicio y resolución, pero no su duración total. El crédito pendiente limitado es una estimación: una sola tarea pendiente se acerca al 85%, y agregar tareas puede reducir el objetivo mientras un llenado que nunca retrocede espera a que lo alcance. En una reproducción de la directiva existente, una tarea agregada a los dos segundos retuvo el llenado durante aproximadamente 1,3 segundos. Un llenado estático puede parecer bloqueado incluso cuando el cliente todavía está esperando. Anunciar esta estimación como un porcentaje accesible implica una precisión que la fuente no puede proporcionar.

## Decisión

Mantener el llenado aproximado impulsado por tareas y separar la actividad de espera del trabajo completado. La barra compartida de 2 px utiliza su pista existente con tinte de acento al 18%, un relleno de acento al 65% de opacidad y un marcador de acento sólido dentro de la frontera del relleno. La ventana recortada es de como máximo 64 px y el 16% del ancho de la pista; el marcador es de como máximo 16 px y el 25% de la ventana. Su ciclo lineal de transformación/opacidad en CSS de 1200 ms se desvanece al completarse el ciclo y continúa de manera independiente cuando el llenado se detiene. Indica trabajo pendiente del cliente, no un latido (*heartbeat*) ascendente, una predicción de tiempo restante o trabajo completado adicional.

Mantener el nombre localizado `progressbar` y omitir `aria-valuenow`. Las tareas pendientes reales controlan `aria-busy`. La resolución final detiene la actividad y cierra el llenado en un pulso de movimiento base ya resuelto, seguido de la retención de un pulso y el desvanecimiento de un pulso existentes. El contenido no espera a la animación; los fallos y cancelaciones son resoluciones en lugar de veredictos de éxito.

Inyectar el reloj del ciclo de vida y el planificador (*scheduler*) en `web/src/utils/progressController.ts`. Las notificaciones de origen no deben reiniciar el reloj de dibujo ni la animación de actividad. El movimiento reducido elimina la actividad y las estimaciones pendientes, realiza actualizaciones basadas únicamente en eventos de tareas y retira el trabajo completado de inmediato. Los cambios en vivo preservan el lote y nunca reducen su llenado. Los documentos ocultos suspenden los fotogramas, muestran temporizadores y actividad; el trabajo inacabado se reanuda desde su estado, mientras que el trabajo completado no se vuelve a reproducir. Reactไม่ se vuelve a renderizar por fotograma de animación y los fotogramas no realizan lecturas de diseño (*layout reads*).

## Consecuencias

El llenado sigue siendo aproximado, pero una estimación detenida ya no carga con toda la responsabilidad de expresar la espera. El ciclo de actividad es una excepción estrecha y documentada del presupuesto de movimiento con cobertura obligatoria para movimiento reducido (*reduced motion*). Las decisiones sobre el ciclo de vida se prueban con tiempo inyectado; las sondas del navegador controlan la animación real, el recorte, el color, la geometría y la cancelación de transiciones. Los valores de la paleta y las asignaciones de *tokens* de temas permanecen inalterados.
