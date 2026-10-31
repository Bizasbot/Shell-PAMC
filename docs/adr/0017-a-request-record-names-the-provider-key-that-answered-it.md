# ADR 0017: Un registro de solicitud nombra la clave de proveedor que lo respondió, resuelta en el momento de la lectura

- Estado: Aceptado
- Fecha: 2026-09-20

## Contexto

Dos interfaces diferían en lo que un operador necesita saber sobre una credencial
upstream.

**La lista de proveedores mostraba una clave por proveedor.** La celda de nombre
mostraba `security.MaskSecret` de `record.api_key`, que es la primera entrada de clave
de CPA para ese proveedor. Por lo tanto, un proveedor configurado con varias claves
mostraba una de ellas, sin etiqueta, junto al nombre del proveedor; un hecho que es
incorrecto para cada solicitud que las otras claves atendieron, y que invitaba al
lector a creer que ese proveedor tenía una sola credencial. La decisión 4 del ADR 0015
ya había reducido esa celda a una máscara (la información sobre herramientas repetía la
máscara en lugar del valor), por lo que la exposición restante no era un secreto,
sino una afirmación falsa.

**Un registro de solicitud no podía nombrar la clave que lo respondió.** La lista
muestra el proveedor y, para un registro OAuth, la cuenta y el archivo que utilizó,
pero un registro de clave de API mostraba únicamente el nombre del proveedor. Cuando un
proveedor posee varias claves, un operador que diagnostica un fallo o una factura no
podía saber cuál se utilizó.

El obstáculo es que dicho dato no existe en el registro. La carga útil de uso de CPA
lleva el `auth_index` de ejecución de la credencial, que `usage_events` almacena, pero
ningún material de clave. Las claves existen únicamente en la configuración de CPA,
la cual la consola lee a través de la API de gestión. Había dos formas disponibles:

1. **Resolver en el momento de la lectura.** Leer las listas de credenciales de CPA,
   indexarlas por índice de autenticación y adjuntar una máscara de visualización a
   cada registro a medida que se sirve la lista.
2. **Capturar en la ingesta.** Resolver el índice mientras se almacena un registro y
   persistir la máscara en `usage_events`.

## Decisión

1. **Un registro de solicitud nombra la clave de proveedor que lo respondió, resuelta
   en el momento de la lectura.** La lista de uso y la vista de registro único devuelven
   un `provider_key_mask` opcional resuelto a partir de las listas de credenciales que
   CPA reporta actualmente: las cuatro familias de claves de API de configuración y
   los proveedores de `openai-compatibility`. El navegador lo renderiza debajo del
   nombre del proveedor y no almacena ninguna credencial para hacerlo.
2. **La resolución corresponde a la configuración actual, nunca a una
   instantánea.** La respuesta indica qué credencial configurada reclama el índice
   del registro *ahora*. Una credencial que desde entonces haya sido rotada o eliminada
   deja de reclamar su índice, por lo que la fila no imprime nada (de forma inmediata
   para un cambio realizado a través de esta consola, y dentro del breve TTL de la
   lectura en caché para uno realizado fuera de ella). Un proveedor que simplemente ha
   sido desactivado no se trata como una eliminación: no reporta ningún índice que
   reclamar, y la clave que atendió una solicitud anterior permanece nombrada, porque
   el estado actual del proveedor no forma parte de la identidad de la credencial. La
   consola nunca reconstruye una clave que no puede leer, y una máscara nunca se infiere
   a partir de un nombre de proveedor, una posición, una única clave configurada o la
   clave del llamador.
3. **No se adivina nada cuando la identificación es ambigua.** Un índice no reclamado,
   una clave que CPA reporta sin índice, un índice que dos entradas reclaman (incluso
   cuando sus máscaras son iguales) y un registro sin índice se resuelven a nada. Solo
   un registro de clave de API cuya etiqueta de proveedor nombra una lista de
   credenciales es candidato en absoluto: el índice de un registro OAuth identifica un
   archivo de autenticación, no una clave de proveedor, y un proveedor fuera de cada
   lista respaldada por claves no tiene ninguna clave que nombrar. El campo resuelto
   está ausente en lugar de vacío cuando no hay ninguno, de modo que un consumidor
   puede distinguir "ninguna clave identificada" de "una clave cuya máscara se renderiza
   como nada".
4. **La máscara es lo único que sale del proceso.** La resolución utiliza los valores
   configurados de CPA y `security.MaskSecret`; el texto plano no llega a ninguna
   entrada de caché que sobreviva a la lectura, a ninguna respuesta ni a ningún
   navegador. El ADR 0015 se mantiene sin cambios para cualquier otra superficie: el
   editor de proveedores sigue siendo la única página que solicita los valores.
5. **La lista de proveedores ya no imprime ninguna clave.** El recuento de claves del
   propio proveedor permanece visible en la columna de modelos/cabeceras, y el panel
   del editor enumera cada entrada, enmascarada, detrás de su propio mecanismo para
   revelarla. La premisa de la decisión 4 del ADR 0015 (que la celda mostraba la máscara
   de una clave) deja de ser válida, porque la celda no muestra ninguna.
6. **La lectura está acotada y es de mejor esfuerzo.** Cada lista de credenciales se
   lee como máximo una vez por TTL, las páginas concurrentes comparten una sola
   lectura, los fallos se almacenan en caché de forma negativa y el enriquecimiento
   tiene su propio tiempo límite (deadline) dentro de la solicitud. Una pasarela que
   no se puede leer deja las máscaras vacías y devuelve la lista de solicitudes sin
   cambios.

## Consecuencias

### Positivas

- La lista de proveedores deja de afirmar algo falso sobre los proveedores de
  múltiples claves, mientras que el recuento de claves y el editor conservan la
  información que es verdadera.
- Un registro de solicitud responde "qué clave respondió a esto" para el caso en el
  que más importa (varias claves detrás de un solo proveedor) sin que el operador
  tenga que abrir nada.
- La resolución se expresa en los datos que la consola ya lee, por lo que no se
  requiere ningún cambio de esquema, ninguna migración ni ninguna dependencia de que
  el descubrimiento esté habilitado, y los registros históricos se cubren desde la
  primera lectura.
- La rotación y la eliminación se degradan hacia el silencio en lugar de hacia una
  reclamación obsoleta, que es la dirección de fallo que debe tener una etiqueta de
  visualización.

### Compensaciones (Trade-offs)

- **La máscara no es un hecho histórico.** Volver a servir una página antigua
  después de una rotación de claves puede mostrar una máscara diferente, o ninguna,
  para el mismo registro. La alternativa (persistir la máscara en la ingesta)
  congelaría un hecho y lo pagaría con una migración, una dependencia en tiempo de
  ingesta de que la configuración de CPA sea legible y una columna permanentemente en
  blanco para cada registro almacenado antes de su implementación.
- **La lista de solicitudes ahora lee las listas de credenciales de CPA.** Esa es una
  nueva dependencia saliente en la ruta de lectura, acotada por un TTL, una lectura
  compartida, una caché negativa y su propio tiempo límite, y solo puede eliminar una
  etiqueta, nunca hacer fallar la página.
- **Una máscara resuelta es una afirmación sobre la configuración actual, no una prueba
  sobre el pasado.** Un operador que haya renombrado o cambiado la clave de una
  credencial desde la solicitud ve la credencial que reclama el índice hoy. Esta es
  la lectura honesta de un índice que la propia CPA trata como la identidad de
  ejecución de la credencial.
- **Dos claves pueden compartir una máscara**, debido a que una máscara conserva solo
  un inicio y un final cortos. Distinguirlas es para lo que sirve la revelación del
  editor; el trabajo de la fila es decir cuál de las claves de un proveedor atendió
  la solicitud, no demostrarlo criptográficamente.

## Alternativas consideradas

- **Persistir la máscara en cada registro en la ingesta.** Rechazado: adquiere un
  hecho congelado a costa de una migración, una columna permanentemente vacía para el
  historial existente y una lectura en tiempo de ingesta de la configuración de CPA (de
  modo que una pasarela que no esté disponible momentáneamente dejaría en blanco la
  etiqueta para el tráfico que de otro modo podría atribuir). También duplica lo que la
  consola ya lee en vivo para cualquier otro dato del proveedor.
- **Resolver en el navegador a partir de la lista de proveedores que ya obtiene.**
  Rechazado como contrato, aunque necesita la misma información: a la página de uso se
  le tendrían que entregar máscaras por entrada en la respuesta del proveedor
  sanitizada, ampliando lo que recibe una superficie que no muestra ninguna clave, y la
  regla de resolución viviría entonces en dos lugares, uno por cliente. Mantenerlo en
  el lado del servidor mantiene una implementación y un DTO únicos, y permite que la
  vista de detalles y la lista los compartan.
- **Coincidir con la identidad del proveedor además del índice de autenticación.**
  Rechazado: la etiqueta de proveedor de CPA para un registro de compatibilidad sigue
  el nombre que el operador le dio, por lo que un cambio de nombre dejaría huérfano
  cada registro realizado antes de él, a pesar de que la credencial —y el índice de
  CPA para ella— no ha cambiado. Por lo tanto, la etiqueta selecciona la *lista* de
  credenciales mientras que el índice es la identidad dentro de ella, lo que permite
  que el historial de un proveedor renombrado siga siendo resoluble.
- **Recurrir a la única clave del proveedor cuando el índice no coincide.** Rechazado:
  "hay una clave configurada, por lo que debe ser esa" es una inferencia, y se vuelve
  incorrecta en el momento en que se añade o reemplaza una clave, imprimiendo la máscara
  de una clave en la solicitud de otra. La omisión es la respuesta que el usuario
  eligió, y es la que permanece verdadera a medida que cambia la configuración.
- **Mantener la máscara en la lista de proveedores y añadirla a la lista de
  solicitudes.** Rechazado: la línea de la lista de proveedores es la que resulta
  estructuralmente engañosa, porque no puede hablar por las otras claves del
  proveedor. Dos superficies imprimiendo la misma máscara no arreglarían cuál de ellas
  es la incorrecta.
