# ADR 0043: La aprobación del agente se decide en línea, bajo la llamada que la originó

- Estado: Aceptado
- Fecha: 2026-09-29
- Reemplaza a: la presentación en diálogo de [ADR 0035](0035-agent-authorization-is-one-decision.md)

## Contexto

El ADR 0035 estableció que una aprobación es una única decisión de permitir o denegar, y la presentó como un diálogo que se abría en cuanto una ejecución se detenía para solicitarla. La decisión se mantiene; el diálogo no. Este último cubría la respuesta sobre la cual el operador estaba decidiendo —a menudo la explicación del modelo sobre por qué deseaba el cambio— y cubría por completo la conversación en un teléfono. Dado que las ejecuciones ahora se detienen en una interrupción explícita de AG-UI que nombra la llamada que la originó (ADR 0041), el lugar natural para tomar la decisión es dicha llamada.

## Decisión

Una aprobación se representa como una tarjeta en la transcripción, directamente debajo de la llamada de capacidad que la preparó, mediante la aprobación de herramientas nativa de assistant-ui:

- La tarjeta muestra lo que exige el ADR 0035: la capacidad, su permiso, el destino, los cambios preparados y, para una capacidad destructiva, la línea de "no se puede deshacer", junto con un botón de Permitir y uno de Denegar. Una entrada privada (un secreto, un traspaso de OAuth) se recopila en la tarjeta y se envía únicamente al endpoint de decisión.
- Mientras una decisión esté pendiente, el compositor se niega a enviar mensajes y lo indica mediante un aviso, acompañado de un control que trae la tarjeta a la vista y la enfoca; la cadena de llamadas que la contiene se abre automáticamente.
- Tomar una decisión reanuda la ejecución: la página reanuda la interrupción sobre la cual se decidió. Una decisión tomada en otra pestaña se detecta mediante sondeo (*polling*) de la operación abierta y también reanuda la ejecución aquí.
- Una pregunta (`ask_question`) mantiene su lugar en el compositor, tal como lo decidió el ADR 0035; ahora llega a la ejecución a través del canal de reanudación de llamadas de herramientas del framework, el cual aterriza en la misma continuación.

Todo lo demás en el ADR 0035 sigue en pie: una única decisión, sin desafío tipado, el enlace de revisión, el consumo de un solo uso, la traza de auditoría (*audit trail*) y la regla de que los agentes externos no pueden aprobar.

## Consecuencias

- El operador lee la razón de un cambio y toma la decisión en un solo lugar, y nada oculta la conversación.
- Una aprobación en espera puede quedar fuera de la pantalla al desplazarse; el aviso del compositor es lo que evita que se pase por alto.
