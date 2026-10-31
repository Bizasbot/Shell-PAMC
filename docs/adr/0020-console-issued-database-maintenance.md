# ADR 0020: Las ejecuciones de mantenimiento de bases de datos iniciadas desde la consola se realizan detrás de una compuerta de escritura a nivel de controlador

- Estado: Aceptado
- Fecha: 2026-09-22

## Contexto

La página de información del sistema ofrece dos acciones para los operadores sobre el archivo SQLite:
un punto de control que trunca WAL y una reconstrucción (`VACUUM`). Ambas afectan a toda la base de
datos, y la segunda reescribe cada página.

El obstáculo no es el rendimiento. El vaciado (flush) de `internal/usage/ingest` registra una brecha de
ingesta y devuelve un error, y `app.Run` trata deliberadamente a una canalización detenida como un error fatal
("tratarlo como fatal en lugar de servir números obsoletos silenciosamente"). Por lo tanto, un escritor
que pierde una condición de carrera (race condition) contra una reconstrucción no produce una solicitud
lenta: termina el proceso. Ofrecer estos botones sin un mecanismo de coordinación equivaldría a desplegar un
activador de fallos (crash trigger).

Tres hechos descartaron los mecanismos obvios:

- **El propio bloqueo de SQLite no puede expresarlo.** Bajo WAL, un lector nunca bloquea a un escritor y
  un escritor nunca bloquea a un lector, por lo que el enfoque habitual de "la base de datos los serializará"
  no se aplica a una sentencia que necesita el archivo exclusivamente para ella.
- **`busy_timeout` no es el mecanismo.** Hace que una llamada bloqueada a SQLite se reintente; no impide
  que un escritor comience y no puede hacer que un VACUUM espere nada.
- **Los plazos (deadlines) del contexto tampoco son una protección.** Con una sola conexión en pool, un llamador
  en cola espera en el pool de Go, que `busy_timeout` no rige, y el contexto de su solicitud puede expirar
  mientras espera, produciendo exactamente el error que es fatal.

## Decisión

**Una compuerta de escritura en el límite del controlador (driver), cuyo valor predeterminado es "esto es una escritura".**
`internal/repository` envuelve su controlador de SQLite. Una sentencia cuya palabra clave inicial no sea
inequívocamente una lectura (`SELECT`, `WITH`, `VALUES`, `EXPLAIN`) pasa por una compuerta que el mantenimiento
mantiene en exclusiva. Cada `PRAGMA` pasa por la compuerta sin importar su argumento, ya que la familia
mezcla lecturas y escrituras (`journal_mode` lee, `journal_mode=WAL` escribe, `wal_checkpoint(TRUNCATE)`
escribe mientras informa una fila de resultado). La asimetría es deliberada: bloquear una lectura solo hace
que espere, mientras que dejar pasar una escritura puede terminar el proceso, por lo que el clasificador
está escrito para fallar en la dirección segura.

**Los escritores esperan, y un escritor en cola puede retirarse.** Un escritor que devolviera un error aquí
se trataría como un fallo fatal en la canalización, por lo que los escritores se bloquean. La espera es
cancelable, algo que `sync.RWMutex` no puede ofrecer: `VACUUM` se ejecuta durante minutos, y un escritor que
no pueda abandonar la espera mantendría ocupado un controlador HTTP más allá del propio tiempo de espera
de escritura del servidor. Por lo tanto, la compuerta se ha diseñado específicamente para este propósito, es
FIFO y es consciente del contexto en ambos lados.

**Una transacción mantiene la compuerta hasta que termina.** El bloqueo de escritura de SQLite perdura más
que las sentencias dentro de una transacción, por lo que una compuerta liberada por sentencia permitiría que
una reconstrucción entrara mientras el archivo todavía estaba bloqueado para escritura.

**El mantenimiento se ejecuta en su propia conexión y sus propias sentencias omiten la compuerta.**
Dos razones distintas. La omisión (bypass) existe porque de lo contrario se produciría un auto-interbloqueo
(self-deadlock): una sentencia de mantenimiento que pasara por la compuerta que ya posee se pondría en cola
detrás de sí misma. La conexión separada existe debido a un interbloqueo que se observó realmente: un escritor
toma la compuerta dentro de la llamada a su controlador, momento en el cual `database/sql` ya le ha entregado
una conexión, por lo que un escritor que espera por la compuerta está *reteniendo* una conexión mientras espera.
Con una conexión compartida, el mantenimiento necesita esa conexión y el escritor necesita la compuerta.
Darle al mantenimiento su propia conexión rompe el ciclo: la conexión de un escritor en espera está inactiva
para SQLite, porque su sentencia no se ha ejecutado y no hay ninguna transacción abierta en ella.
`TestMaintenanceDoesNotDeadlockAgainstAWriterHoldingAConnection` reproduce el escenario.

**Una reserva tiene un nombre, y solo su titular puede actuar sobre ella.** `Reserve` devuelve un identificador
(handle) que `Launch` y `Release` requieren. Una liberación sin nombre era un peligro real en lugar de una
cuestión de pulcritud: se llama cuando una auditoría de admisión falla, y un borrado incondicional podría
borrar una reserva *más nueva* que una solicitud posterior acababa de hacer; por lo tanto, un trabajo que al
operador se le había dicho que fue aceptado nunca comenzaría, mientras que la página lo mostraba como en
ejecución. Una liberación que nombra una reserva superpuesta (superseded) no hace nada, y se rechaza un
segundo lanzamiento del mismo identificador.

**Ninguna solicitud realiza trabajo en la base de datos después de admitir un trabajo.** La solicitud inicial
mide la admisión, registra *dicha admisión* en la pista de auditoría, inicia el trabajo y devuelve el estado
que devolvió el inicio. No realiza más lecturas ni escrituras en la base de datos, porque cualquiera de ellas
se pondría en cola para la compuerta que el trabajo ahora posee y el código `202` del operador no llegaría hasta
que la reconstrucción hubiera terminado.

**La compuerta se libera antes de que se anuncie el resultado de un trabajo.** El servicio publica su estado
terminal solo después de haber abandonado la sección exclusiva. Este orden se aprendió de la manera difícil:
un observador de un trabajo terminado escribe en la base de datos —la pista de auditoría lo hace— y una
escritura espera por la compuerta que el trabajo posee, por lo que publicar desde el interior de la sección
exclusiva provocaba un interbloqueo del trabajo contra su propio observador. Los síntomas eran un punto de
control cuyo registro de auditoría fallaba con un contexto cancelado y una respuesta HTTP que nunca llegaba,
mientras que el endpoint de estado mostraba el trabajo todavía en ejecución.
`TestCompletionObserverMayWriteToTheDatabase` realiza exactamente esa escritura y falla si el orden se degrada.

**La finalización la registra el trabajo, no la solicitud que lo inició.** Un `202` describe la admisión, no el
éxito, por lo que la admisión y la finalización son dos eventos de auditoría con resultados diferentes; el segundo
lleva el resultado medido y cualquier error redactado.

**El estado reside en la memoria.** Un endpoint de estado que leyera la base de datos no podría responder
mientras un trabajo mantuviera la conexión, exactamente cuando un operador lo solicita. El precio a pagar es
que el estado no sobrevive a un reinicio, lo cual se indica en la interfaz de usuario y es cierto de todos modos:
un trabajo no puede sobrevivir al proceso que lo ejecuta.

**La reconstrucción es un `VACUUM` plano, no un `VACUUM INTO` más un intercambio de archivos.** El pool
mantiene un identificador abierto al archivo, por lo que reemplazarlo por debajo requeriría cerrar cada
conexión y reconstruir el pool mientras otras goroutines aún mantienen referencias a él, cambiando una acción
de mantenimiento por una ventana en la que los escritores ordinarios ven una base de datos cerrada. SQLite
documenta que un `VACUUM` plano se copia en un archivo temporal y sobrescribe el original dentro de una
transacción ordinaria, por lo que una reconstrucción interrumpida deja el original intacto. Esa propiedad
está garantizada por una prueba que cancela una reconstrucción y luego verifica tanto las filas supervivientes
como `PRAGMA integrity_check`.

**La admisión se mide y se muestra antes de la acción.** Una reconstrucción necesita hasta el doble del tamaño
del archivo de base de datos en espacio libre; la confirmación muestra el requisito medido frente a la
disponibilidad medida y se rechaza cuando no se puede cumplir. Esto es una comprobación previa, no una
garantía, y se presenta como tal.

**Un punto de control que no se completó se informa como incompleto, no como exitoso.**
`PRAGMA wal_checkpoint(TRUNCATE)` devuelve una fila de tres enteros y no genera ningún error cuando está
bloqueado por un lector concurrente, por lo que se leen los contadores y el resultado se deriva de ellos.

Incompleto es un tercer resultado y se presenta como tal: un resultado parcial conlleva una advertencia,
no una marca de éxito con una salvedad debajo. La distinción importa porque las dos afirmaciones difieren
—"el registro fue truncado" y "el registro no fue truncado"— y una consola que dibuja la marca de éxito le
ha dicho al operador la primera mientras quería decir la segunda. La misma regla rige qué instantánea cree
la página: el estado del trabajo consultado (polled) es autoritativo solo mientras se consulta, porque
después es el trabajo *anterior*, y dejar que prevalezca fijaría el panel en un trabajo que el operador ya
ha superado.

**Ambas acciones son auditadas, y ambas se rechazan en modo de demostración** por la clasificación de rutas
en `internal/api/demo_policy.go`, ya que un visitante no debe poder cambiar lo que ve el siguiente visitante.

**Un trabajo está acotado por el ciclo de vida de la aplicación.** El servicio posee un contexto derivado
del proceso, por lo que una reconstrucción no puede sobrevivir al proceso, y `Close` cancela y se une (joins)
a un trabajo en curso antes de liberar su conexión. De lo contrario, un trabajo desconectado de su solicitud
inicial pero sin atar a nada estaría ejecutándose mientras se desmantela el pool que utiliza.

## Consecuencias

- Cada sentencia en el proceso ahora paga el coste de una clasificación sobre un literal SQL estático, y
  cada escritura adquiere una compuerta protegida por mutex. Ambos son insignificantes en comparación con
  una llamada a la base de datos.
- La compuerta es a nivel de proceso y es compartida por todos los pools del proceso. Esto es sólido para
  esta aplicación específicamente —el ADR 0001 lo convierte en un monolito modular de una sola réplica con
  un único archivo SQLite— y la sobre-serialización es la única forma en que podría ser incorrecto.
- Una reconstrucción hace que los escritores esperen durante su duración, limitada por un techo de diez minutos.
  Un punto de control es económico y se puede ejecutar con frecuencia.
- Las escrituras de mantenimiento son la única ruta de la consola que puede bloquear las escrituras ordinarias,
  y la página indica que un trabajo no sobrevive a un reinicio.
- Los contenedores de filas (row wrappers) de la compuerta reenvían las interfaces opcionales de metadatos de
  columnas del controlador (`RowsColumnTypeDatabaseTypeName`, `...Length`, `...Nullable`, `...PrecisionScale`,
  `...ScanType`) y afirman en tiempo de compilación que lo hacen. Un contenedor que solo satisfaga `driver.Rows`
  se compila y pasa todas las pruebas de consulta mientras descarta silenciosamente lo que el controlador
  informa sobre el tipo de cada columna; la aserción es lo que evita que una firma de método mal escrita
  —que es como se descubrió esto— elimine los metadatos silenciosamente.
- La compuerta es por base de datos, no por proceso. Cada pool sobre un archivo —el pool de la aplicación y
  la propia conexión del servicio de mantenimiento— comparte la compuerta de ese archivo, por lo que se
  excluyen mutuamente sin que la reconstrucción de una base de datos paralice las escrituras en otra.
- El clasificador es una clasificación del SQL estático de este repositorio, no un analizador sintáctico SQL
  (parser), y es deliberadamente restrictivo en la dirección segura: solo `SELECT`, `VALUES` y `EXPLAIN`
  cuentan como lecturas. `PRAGMA` pasa por la compuerta sin importar su argumento; `WITH` pasa por la compuerta
  incluso cuando la sentencia selecciona, ya que una CTE (Common Table Expression) puede introducir una
  escritura; y una cadena que contenga una segunda sentencia pasa por la compuerta sin importar cómo comience.
  El coste es una espera para el único `WITH` en este repositorio durante una reconstrucción, a cambio de
  una garantía que no necesita volver a comprobarse cuando se añade nuevo SQL.
- `driver.TxOptions.ReadOnly` no exime a una transacción. Es una pista que modernc.org/sqlite utiliza únicamente
  para elegir la cadena de modo `BEGIN`, por lo que dicha transacción aún puede escribir; confiar en este indicador
  dejaría un agujero con la misma forma exacta que la ruta que protege la compuerta.

## Alternativas consideradas

- **Elevar `busy_timeout` y dejar que SQLite lo resuelva.** Rechazado: convierte un problema de coordinación
  en una espera más larga, sigue terminando en el error fatal cuando la reconstrucción toma más tiempo que
  el tiempo de espera, y degrada silenciosamente la contención de bloqueos no relacionados.
- **Pausar el recolector durante el mantenimiento.** Rechazado: necesita una máquina de estados de pausa/reanudación
  que compite con la compuerta contra la cual se ordenaría, y un recolector pausado aún mantiene su lote en memoria.
- **Negarse a ofrecer mantenimiento a menos que la ingesta esté deshabilitada.** Rechazado por considerarse
  inútil para los despliegues que más lo necesitan.
- **Envolver las 45 ubicaciones de llamadas de escritura en lugar del controlador.** Rechazado: la cobertura
  dependería entonces de que nadie añadiera nunca una escritura sin compuerta, y el modo de fallo de una
  ubicación omitida es la terminación del proceso. Un límite de controlador cubre las futuras escrituras
  automáticamente.
