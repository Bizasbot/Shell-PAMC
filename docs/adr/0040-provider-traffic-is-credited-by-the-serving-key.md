# ADR 0040: El tráfico del proveedor se acredita mediante la clave que lo atendió

- Estado: Aceptado
- Fecha: 2026-09-29

## Contexto

El panel de proveedores del dashboard y la lista de proveedores informan sobre el tráfico por proveedor,
y ambos lo estaban reportando al incorrecto.

**La etiqueta de proveedor de CPA no puede identificar a un proveedor configurado.** Para una solicitud atendida por
una clave de API, CPA escribe la *familia* en el campo `provider` del registro de uso — `codex`
para cada clave de Codex, `claude` para cada clave de Claude —, y escribe la misma palabra para una
solicitud atendida por la credencial OAuth de esa familia. Por lo tanto, una etiqueta cubre varias
cosas distintas a la vez: cada familia de claves configurada con ese nombre y el canal OAuth
junto a ellas. La etiqueta responde "¿qué familia upstream?", lo cual no es la
pregunta que hace una lista de proveedores.

**De la coincidencia con dicha etiqueta se derivaron dos consecuencias.** Un proveedor que el operador acababa
de crear, sin tráfico propio, reclamaba el tráfico OAuth de la familia y lo mostraba
como suyo, anunciando solicitudes que nadie le había enviado. Y debido a que la primera fila en
reclamar una etiqueta la consumía, un segundo proveedor de la misma familia mostraba "sin solicitudes"
mientras que el primero mostraba todas, incluso cuando ambos estaban atendiendo tráfico.

**Las filas también se fusionaban por nombre.** La agregación omitía a un proveedor configurado cuyo
nombre para mostrar, id o nombre upstream ya había sido reclamado por una fila anterior. Dos proveedores dejados
con el nombre predeterminado de CPA ("Codex / Responses") colapsaban por lo tanto en uno: el panel de proveedores
del dashboard listaba al primero y descartaba al segundo, y la página de proveedores —que
dibuja una fila por proveedor configurado y asocia el tráfico por id— mostraba al segundo
como un guion, la misma marca que utiliza para una ventana que no pudo leer. Un proveedor que estaba
atendiendo tráfico aparecía como uno cuyo tráfico no se pudo determinar.

**Los ids de familia duplican a los ids de canal.** La tabla de canales OAuth de la consola utiliza como clave
los mismos ids cortos (`codex`, `claude`, `xai`, `meta`) que nombran a las familias de claves de API de CPA, y un
proveedor de claves de API configurado estaba siendo clasificado como un canal OAuth a través de esa
superposición. Tomaba entonces el recuento de credenciales del canal —el número de archivos OAuth— y
el tráfico del canal, por lo que un proveedor de claves de API informaba credenciales que no posee.

**El dato que sí identifica a la clave ya existe en el registro.** Cada registro de uso
lleva el `auth_index` de tiempo de ejecución de la credencial cuando una clave de API lo atendió, y CPA informa
el mismo índice en cada clave configurada de un proveedor a través de la API de gestión. La
etiqueta es inutilizable; el índice es una identidad.

## Decisión

1. **El tráfico de un proveedor de claves de API configurado es lo que sus propias claves atendieron.** Los totales
   de la ventana se dividen del lado del servidor: los registros con `auth_type = 'apikey'` se agrupan por su
   índice de autenticación de tiempo de ejecución y se devuelven como `credentials[]`; cualquier otro registro se agrupa por
   su etiqueta de proveedor como antes. El tráfico de un proveedor es la suma de los índices que informan sus propias
   claves, asociados de forma exacta, un índice reclamado por un proveedor.
2. **Un proveedor compatible con OpenAI también cuenta la etiqueta que CPA reserva para él.** CPA
   etiqueta las solicitudes de un proveedor de compatibilidad como `openai-compatible-<name>`, convirtiendo a minúsculas
   el nombre propio del proveedor, y dichos registros no llevan ningún índice de clave. Esa etiqueta exacta se agrega
   al tráfico de las propias claves del proveedor, para el proveedor cuyo `upstream_name` la produce.
3. **Nada se acredita por familia o por nombre para mostrar.** Las etiquetas de familia pertenecen al canal OAuth
   que comparte el nombre; una coincidencia de familia acredita a un proveedor con el tráfico de otra superficie. Un
   proveedor configurado de una de las familias de claves de API de CPA es un proveedor de claves de API por
   construcción, y toma la identidad del canal únicamente a través del nombre que CPA lleva para él —
   el nombre con el que se etiquetan sus propias solicitudes —, nunca a través del nombre con el que la consola lo muestra,
   el cual un operador puede sobrescribir en el navegador. Una fila de canal mantiene la coincidencia de etiqueta
   que siempre ha usado, incluyendo su respaldo de contención para un canal cuyo nombre de etiqueta
   tiene una ortografía diferente.
4. **Cada proveedor configurado es su propia fila.** Dos proveedores dejados con el nombre
   predeterminado de CPA, y dos claves de una familia, son proveedores distintos con tráfico distinto y
   credenciales distintas; ninguno se fusiona en el otro, y ninguno se omite.
5. **El recuento de credenciales de un proveedor es propio.** El recuento proviene del número de entradas de claves
   que posee el proveedor, no del recuento de archivos de autenticación del gateway para un tipo que
   casualmente comparte un id.
6. **`auth_indexes` no es un secreto y viaja en la proyección sanitizada.** El índice de
   tiempo de ejecución es un identificador opaco que CPA asigna a una credencial en tiempo de ejecución; no es material
   de clave, y el ADR 0017 ya lo devuelve por registro de solicitud. El DTO del proveedor transporta
   los índices de las claves del proveedor para que el navegador pueda realizar la asociación sin leer ninguna clave.
7. **Un registro que no nombra ningún índice no se acredita a nadie.** Un registro almacenado antes de que se capturara el índice
   no tiene ninguno, y uno cuya credencial CPA ya no posee conserva el índice bajo el cual fue
   atendido mientras ningún proveedor configurado lo publica; permanece en `credentials[]` bajo
   ese índice y no se acredita a ninguna fila. Ninguno de los dos puede reclamarse por inferencia: un proveedor que
   tiene una clave no es evidencia de que haya atendido un registro sin índice. Estos registros permanecen en
   los totales propios de la ventana y en la lista de solicitudes; solo las filas de proveedores los omiten.
8. **Un índice que dos proveedores configurados publican ambos no se acredita a ninguno.** CPA deriva el
   índice de tiempo de ejecución de una credencial a partir de la propia credencial, por lo que una clave ingresada dos veces bajo
   un mismo nombre se resuelve en un solo índice. Acreditar a la fila que aparezca primero haría que el número
   dependiera del orden de la lista de proveedores.

## Consecuencias

### Positivas

- Un proveedor creado hace un minuto informa cero solicitudes en lugar del tráfico de otra superficie,
- y dos proveedores de la misma familia informan cada uno su propio tráfico.
- El tráfico de un canal OAuth deja de incluir las solicitudes atendidas por las claves de API, de modo que
- los números de canales del dashboard y los registros de solicitudes coinciden.
- Los nombres para mostrar en colisión ya no ocultan a un proveedor: cada proveedor configurado tiene una fila
- y un recuento preciso.
- La asociación es exacta y comprobable sin base de datos: es una búsqueda de mapa sobre un identificador
- que CPA ya publica en ambos lados, sin heurísticas que ajustar.

### Compensaciones (Trade-offs)

- **El historial sin índice no es atribuible.** Los registros escritos antes de que se capturara el índice,
  y los registros cuya credencial se ha eliminado de CPA, no cuentan para ningún
  proveedor configurado. Siguen siendo visibles en los totales y en la lista de solicitudes. La
  alternativa —adivinar a partir de la etiqueta de familia, el nombre para mostrar o la única
  clave de un proveedor— es sistemáticamente errónea en los dos casos que este decisión existe para corregir, y un
  número que es erróneamente seguro es peor que un cero honestamente acotado.
- **El primer renderizado del panel no está particionado.** Mientras la lectura con ventanas está ausente —el fotograma
  antes de que llegue, o un fallo parcial—, las filas recurren a los totales de etiquetas generales, que
  no están divididos por clave de atención, y una fila de canal lleva entonces el total mixto de su familia. La
  lectura con ventanas las reemplaza al llegar; la alternativa habría sido retener las únicas cifras
  disponibles en ese estado.
- **La respuesta del dashboard incorporó una segunda lista.** `credentials[]` es una entrada por cada clave
  que atendió tráfico en la ventana en lugar de por proveedor, por lo que la carga útil escala con
  ambos, proveedores y claves. Cada entrada consta de tres pequeños campos.
- **Las dos mitades solo tienen sentido juntas.** `credentials[]` es la parte de las filas de etiquetas
  que el servidor separó por clave de atención, por lo que un lector que tome las filas de claves sin
  las filas de etiquetas cuenta las mismas solicitudes dos veces; la consola las lee de una sola respuesta y
  acredita las claves solo cuando la lista de etiquetas de esa respuesta está presente.
- **Una entrada que CPA posee sin nombre no se acredita a nadie.** Sus registros llevan la etiqueta compartida
  `openai-compatibility`, que ningún proveedor individual puede reclamar, y CPA debe nombrar una entrada
  para derivar una etiqueta por entrada en absoluto. Las claves de dicho proveedor siguen informando lo que hayan atendido.
- **La consola ahora depende de un dato por clave, no por proveedor.** Una clave que CPA
  informa sin un índice no puede ser acreditada, y el proveedor muestra únicamente el tráfico de sus otras
  claves —la misma omisión honesta que arriba, a menor escala—.

## Alternativas consideradas

- **Coincidir con la etiqueta de familia y dividir por posición.** Rechazado: una etiqueta que cubre tanto
  al canal OAuth como a cada clave de una familia no tiene una posición por la cual dividirse, y el
  orden en que CPA informa las claves no es una afirmación sobre cuál de ellas atendió una solicitud pasada.
- **Acreditar el tráfico de cada familia al proveedor que posee la mayor cantidad de claves, o al primero.**
  Rechazado: inventa una distribución en lugar de leer una, y el número inventado
  se muestra como tráfico medido.
- **Mantener la reclamación de la primera fila sobre una etiqueta y mostrar el resto como cero.** Rechazado: este es
  el defecto que se está corrigiendo. Dos proveedores de una familia que atienden tráfico con solo uno
  de ellos informándolo es una respuesta incorrecta a la única pregunta del panel.
- **Atribuir la etiqueta compatible con OpenAPI por subcadena.** Rechazado: que `deepseek` coincida con
  `deepseek-pro` acreditaría a un proveedor con las solicitudes de otro. Solo cuenta la etiqueta exacta
  que CPA deriva del propio `upstream_name` del proveedor.
- **Resolver la asociación en el navegador a partir de la lista de etiquetas en bruto.** Rechazado: la división basada en índices
  tiene que ocurrir donde se leen los registros, porque la etiqueta por sí sola no se puede dividir
  en claves y canales. Enviar ambas mitad al navegador y asociarlas allí pondría
  la misma regla en un segundo lugar con menos información.

## Referencias

- ADR 0017: un registro de solicitud nombra la clave de proveedor que lo respondió, resuelta en el momento
  de la lectura. Este ADR aplica la misma identidad (`auth_index`) para agregar tráfico.
