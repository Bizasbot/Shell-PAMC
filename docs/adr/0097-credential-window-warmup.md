# ADR 0097: Calentamiento de la ventana de credenciales mediante solicitudes CPA acotadas

- Estado: Aceptado

## Contexto

Las ventanas de suscripción de Codex and Claude pueden permanecer sin iniciar después de que pase su límite anterior. Una pequeña solicitud de consumo puede iniciar la siguiente ventana, pero una solicitud de modelo normal podría enrutarse a otra credencial. El estado de facturación desconocido, la ejecución duplicada y la confusión de una respuesta HTTP exitosa con la activación son riesgos materiales.

## Decisión

OMC es propietario de los valores predeterminados del proveedor configurados de forma optativa, las anulaciones completas de credenciales y la programación persistente.
La API de gestión de CPA existente transporta únicamente dos POST construidos internamente:
Codex Responses y Claude Messages en los endpoints oficiales exactos. Ninguna URL arbitraria, prompt, cuerpo de solicitud o secreto de credencial entra en esta interfaz. La sustitución de tokens y la selección del proxy de credenciales siguen siendo responsabilidad de CPA. La lista blanca de observación de cuotas no se amplía para convertirse en un proxy de inferencia.

La automatización requiere una activación confirmada manualmente y observada para la credencial exacta y el modelo seleccionado. Esta es una puerta de aceptación en tiempo de ejecución, no una afirmación de que las solicitudes simuladas establezcan compatibilidad con el upstream. Un respaldo de pago desconocido o habilitado pausa tanto las solicitudes de consumo manuales como automáticas. Los proveedores sin evidencia afirmativa de facturación permanecen en pausa. No se gasta ningún crédito de restablecimiento ni subsidio de restablecimiento de Claude.

El uso cero de una ventana por sí solo no es evidencia de inactividad. Las ventanas no utilizadas explícitas, y las lecturas repetidas de cero cuyo límite de duración completa se desplaza con el tiempo de observación, distinguen la inactividad de una ventana en ejecución con uso cero. Los límites fijos permanecen activos. Solo participan las cinco ventanas principales de cinco horas y las ventanas semanales generales; las ventanas específicas de modelos y de revisión de código no participan.

Los inicios diarios utilizan el calendario efectivo de OMC. Una solicitud de restablecimiento que se superpondría al siguiente inicio diario espera a este, incluido un desencadenante semanal que también iniciaría la ventana de cinco horas. La recuperación diaria se limita a una hora. Los recibos de solicitud, la supresión de ciclos y una identidad diaria sobreviven al reinicio del proceso. Los resultados de consumo desconocidos nunca se reproducen automáticamente. Una solicitud completada se verifica con una lectura de cuota fresca, luego como máximo con otras dos comprobaciones por minuto; un resultado no confirmado permanece explícitamente incierto.

## Consecuencias

Esto añade tablas operativas en SQLite, un bucle en segundo plano y escrituras de alto riesgo en Agent/MCP.
Las políticas están separadas de las preferencias de visualización. El adaptador de upstream inicial debe ser verificado por un operador con consentimiento explícito; los despliegues no necesitan un nuevo endpoint de CPA ni una instalación de Claude Code. Un cambio en el protocolo del proveedor pausa la activación en lugar de seleccionar silenciosamente otro modelo o omitir la protección. Los registros de auditoría y los recuentos de tokens devueltos por el proveedor describen las solicitudes de consumo sin fabricar eventos de uso ordinario de CPA. El éxito del canje de restablecimiento existente sigue siendo independiente del calentamiento.
