# ADR 0027: El Agente divulga el destino de sus datos en lugar de condicionarlo a una casilla de verificación de consentimiento

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto

Un turno del Agente envía el mensaje del operador, y los datos de negocio de OMC que el agente lee para responder
a dicho mensaje, al modelo de CPA seleccionado por el operador y de ahí al proveedor upstream de ese modelo. La primera
versión de la página requería una casilla de verificación de consentimiento antes de cada envío: la casilla nunca se restauraba,
se desmarcaba cada vez que cambiaba la clave o el modelo, y el endpoint de ejecución rechazaba cualquier solicitud sin el indicador
`has_consent`.

En la práctica, la casilla no protegía nada que la página ya no indicara. El operador es el
administrador de este despliegue, eligió el modelo y está viendo la declaración sobre el destino de los datos;
la casilla añadía un clic adicional a cada carga de página y a cada cambio de destino, y un botón de envío
deshabilitado era la primera experiencia más común en la página. El indicador que el servidor comprobaba era establecido por
el mismo navegador que el operador ya estaba utilizando, por lo que atestiguaba la realización de un clic en lugar de comprensión.

## Decisión

La página del Agente indica, en la línea situada debajo del campo de entrada (*composer*), que los mensajes y los datos de OMC que el agente lee se envían al modelo de CPA seleccionado y a su upstream, y que no se deben introducir secretos en el chat. El envío es la acción que describe la declaración; no hay ninguna casilla de verificación. La entrada de ejecución ya no transporta
`has_consent`, y el *runtime* ya no rechaza una ejecución por su ausencia —el endpoint rechaza el campo por considerarlo desconocido, al igual que cualquier otro campo que no modele—.

Ningún otro aspecto de los límites cambia: el modelo nunca recibe la clave de gestión de CPA ni los detalles internos de las capacidades, los secretos se introducen únicamente a través de la entrada privada de una tarjeta de operación, y
cada operación de escritura sigue requiriendo la aprobación del operador en el navegador.

## Consecuencias

Un operador puede hacer una pregunta tan pronto como se abre la página. La declaración sobre el destino de los datos es
siempre visible en lugar de mostrarse una vez junto a un control y luego olvidarse. Un despliegue que necesite
un consentimiento registrado por sesión tendría que implementarlo como un registro en el lado del servidor en lugar de restaurar
la casilla de verificación, ya que un indicador establecido por el cliente no puede cumplir ese propósito.
