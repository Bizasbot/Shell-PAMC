# Operaciones y manual de procedimientos de SQLite

Este manual de procedimientos está destinado a administradores de sistemas y operadores que ejecutan Shell-PAMC en entornos de producción. Cubre respaldos diarios, simulacros de recuperación ante desastres, gobierno de claves de cifrado, barreras de seguridad en migraciones y mantenimiento de almacenamiento para una base de datos SQLite de réplica única que opera en modo WAL.

---

## 1. Restricciones de arquitectura central e invariantes de réplica única

1. **Principio exclusivo de escritor único**:
   - La capa de persistencia de Shell-PAMC utiliza SQLite embebido con Write-Ahead Logging (`journal_mode=WAL`) y `busy_timeout=5000`;
   - Compartir el directorio `/data` entre múltiples réplicas de Shell-PAMC mediante sistemas de archivos de red (NFS, SMB/CIFS, GlusterFS) está estrictamente prohibido;
   - En orquestadores de contenedores (como Kubernetes o Docker Swarm/Compose), asegúrese de que como máximo se programe una réplica a la vez (por ejemplo, utilizando `strategy: { type: Recreate }` en despliegues de Kubernetes).

2. **Actualización desde el nombre anterior**: una instalación que aún contenga `oh-my-cpa.db` se renombra a `shell-pamc.db`, junto con sus archivos `-wal` y `-shm`, en el primer inicio. Si ambos archivos existen, el proceso rechaza iniciar en lugar de elegir; elimine el que no contenga sus datos. Respaldos escritos como `shell-pamc/sqlite-backup-v1` aún se restauran; nuevos respaldos se escriben como `shell-pamc/sqlite-backup-v1`.

3. **Integridad de la tríada WAL**:
   - El directorio de datos contiene tres archivos estrechamente vinculados: `shell-pamc.db` (base de datos primaria), `shell-pamc.db-wal` (registro write-ahead) y `shell-pamc.db-shm` (índice de memoria compartida);
   - Copiar únicamente `shell-pamc.db` mientras el servicio está en ejecución puede omitir transacciones que residen solo en el archivo `-wal`, produciendo una instantánea incompleta o inconsistente.

4. **Diseño de conexión única**:
   - El grupo de conexiones de Go está fijado a `MaxOpenConns(1)` y `MaxIdleConns(1)`, con `busy_timeout=5000`, `foreign_keys=1`, `journal_mode=WAL` y `synchronous=NORMAL`;
   - Las escrituras concurrentes se serializan dentro del proceso de la aplicación en lugar de depender de reintentos de bloqueo de SQLite.

5. **El modo demo está fuera de todas las reglas anteriores**:
   - Un despliegue con `SHELLPAMC_DEMO_MODE=true` utiliza su propio archivo, `shell-pamc-demo.db`, en el mismo directorio de datos, y lo elimina junto con sus hermanos WAL en cada inicio. Nada en él requiere respaldo, restauración o migración, y tiene un nombre propio para que una demo dirigida a un directorio con datos reales no los borre (`internal/demo.ResetDatabase`);
   - El resto de este manual describe la base de datos autoalojada. Consulte `docs/ops/cloudflare-demo.md` para las operaciones propias de la demo.

---

## 2. Estrategias seguras de respaldo en línea y en frío

### 2.1 Respaldos en línea mediante `VACUUM INTO` de SQLite

Mientras el servicio continúa procesando solicitudes de lectura y escritura, se puede generar una instantánea consistente utilizando el comando `VACUUM INTO` de SQLite. Tenga en cuenta que el contenedor Alpine de producción mínimo (`FROM alpine:3.21`) no incluye la CLI de `sqlite3`; ejecute este comando en el host apuntando al directorio montado en volumen o desde un contenedor sidecar administrativo:

```bash
# Ejecutado en el host apuntando al directorio montado en volumen:
BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "${BACKUP_DIR}" && chmod 700 "${BACKUP_DIR}"

sqlite3 /path/to/data/shell-pamc.db "VACUUM INTO '${BACKUP_DIR}/shell-pamc-backup-${TIMESTAMP}.db';"
chmod 600 "${BACKUP_DIR}/shell-pamc-backup-${TIMESTAMP}.db"
```

**Semántica**: `VACUUM INTO` lee páginas confirmadas de la base de datos principal y del WAL, produciendo un archivo de instantánea único, autónomo y transaccionalmente consistente una vez que la operación finaliza exitosamente. No incluye transacciones no confirmadas, ni realiza puntos de control ni trunca el archivo `-wal` de origen activo.

### 2.2 Procedimiento de respaldo en frío (Mantenimiento programado)

Al realizar mantenimiento programado durante una ventana fuera de línea:

1. Detenga de forma controlada el contenedor del servicio Shell-PAMC:
   ```bash
   docker compose --env-file deploy/.env -f deploy/compose.full.yml stop shell-pamc
   ```
2. Espere a que el proceso finalice por completo. Con `SIGTERM`, el proceso Go deja de aceptar tráfico HTTP y cierra la conexión de la base de datos; SQLite realiza un punto de control de las páginas WAL pendientes y limpia los archivos `-wal` y `-shm` al cerrar el último manejador.
3. Archive todo el directorio de datos en un destino fuera del directorio de origen:
   ```bash
   BACKUP_DIR="/path/to/backups"
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   mkdir -p "${BACKUP_DIR}" && chmod 700 "${BACKUP_DIR}"

   tar -czf "${BACKUP_DIR}/omc-data-${TIMESTAMP}.tar.gz" -C /path/to/data .
   sha256sum "${BACKUP_DIR}/omc-data-${TIMESTAMP}.tar.gz" > "${BACKUP_DIR}/omc-data-${TIMESTAMP}.sha256"
   chmod 600 "${BACKUP_DIR}/omc-data-${TIMESTAMP}.tar.gz" "${BACKUP_DIR}/omc-data-${TIMESTAMP}.sha256"
   ```

---

## 3. Simulacro de recuperación ante desastres (Manual de restauración)

Al recuperarse de fallos del host o corrupción de la base de datos, elija el procedimiento correspondiente a su artefacto de respaldo:

### 3.1 Restaurar desde una instantánea de `VACUUM INTO` (`.db`)

1. **Detener el contenedor del servicio**:
   ```bash
   docker compose --env-file deploy/.env -f deploy/compose.full.yml stop shell-pamc
   ```

2. **Verificar la integridad de la instantánea en el host**:
   ```bash
   sqlite3 /path/to/backups/shell-pamc-backup-YYYYMMDD_HHMMSS.db "PRAGMA integrity_check;"
   # La salida esperada debe ser: "ok"
   ```

3. **Reemplazar el directorio de datos de forma segura**:
   - Aparte el directorio de datos dañado para asegurarse de que ningún archivo `-wal` o `-shm` residual se adhiera a la base restaurada:
     ```bash
     mv /path/to/data "/path/to/data_damaged_$(date +%Y%m%d_%H%M%S)"
     mkdir -p /path/to/data
     ```
   - Copie la instantánea verificada como `shell-pamc.db`:
     ```bash
     cp /path/to/backups/shell-pamc-backup-YYYYMMDD_HHMMSS.db /path/to/data/shell-pamc.db
     ```
   - Asigne la propiedad al usuario del contenedor (`10001:10001` según el Dockerfile) y restrinja permisos:
     ```bash
     chown -R 10001:10001 /path/to/data
     chmod 700 /path/to/data
     chmod 600 /path/to/data/shell-pamc.db
     ```

### 3.2 Restaurar desde un archivo comprimido en frío (`.tar.gz`)

1. **Detener el contenedor del servicio**:
   ```bash
   docker compose --env-file deploy/.env -f deploy/compose.full.yml stop shell-pamc
   ```

2. **Verificar la suma de comprobación del archivo**:
   ```bash
   cd /path/to/backups
   sha256sum -c omc-data-YYYYMMDD_HHMMSS.sha256
   ```

3. **Desempaquetar en un directorio limpio**:
   - Aparte el directorio dañado:
     ```bash
     mv /path/to/data "/path/to/data_damaged_$(date +%Y%m%d_%H%M%S)"
     mkdir -p /path/to/data
     ```
   - Extraiga el archivo verificado:
     ```bash
     tar -xzf /path/to/backups/omc-data-YYYYMMDD_HHMMSS.tar.gz -C /path/to/data
     chown -R 10001:10001 /path/to/data
     chmod 700 /path/to/data
     ```

### 3.3 Comprensión de respaldos cifrados de migración (`backups/*.db`)

Los archivos bajo `SHELLPAMC_DATA_DIR/backups/` generados por Shell-PAMC antes de las migraciones son respaldos cifrados con AES-GCM acompañados de sumas de comprobación `.sha256`. Se gestionan internamente por la aplicación; no pueden inspeccionarse directamente con `sqlite3` sin descifrarlos utilizando la clave `SHELLPAMC_MASTER_KEY` configurada.

### 3.4 Verificar la operatividad del servicio tras la restauración

Inicie el contenedor e inspeccione el endpoint de salud:

```bash
docker compose --env-file deploy/.env -f deploy/compose.full.yml start shell-pamc
```

- Al acceder a través de un ingress HTTPS del operador, donde `BASE_PATH` es el `SHELLPAMC_BASE_PATH` normalizado (`/shell-pamc` por defecto):
  ```bash
  BASE_PATH=/shell-pamc
  PUBLIC_ORIGIN=https://console.example.com
  curl -sf "${PUBLIC_ORIGIN}${BASE_PATH}/api/healthz" | jq .
  ```
- Al acceder directamente en el host (ambos archivos Compose publican puertos en loopback):
  ```bash
  BASE_PATH=/shell-pamc
  curl -sf "http://127.0.0.1:8080${BASE_PATH}/api/healthz" | jq .
  ```
- O mediante container exec:
  ```bash
  docker compose --env-file deploy/.env -f deploy/compose.full.yml exec shell-pamc wget -q -O - "http://127.0.0.1:8080${BASE_PATH}/api/healthz" | jq .
  ```

Confirme que la respuesta JSON informe `"database_status": "ok"` y `"status": "ok"` (o `"degraded"` si CPA está temporalmente fuera de línea).

---

## 4. Gobierno de `SHELLPAMC_MASTER_KEY` y prevención de desastres

- **Rol de la clave maestra**:
  `SHELLPAMC_MASTER_KEY` es una clave de alta entropía de 32 bytes (64 caracteres hexadecimales), utilizada para cifrar en reposo la clave de administración de CPA y las cargas útiles de uso mediante AES-GCM.
- **Consecuencias de su pérdida**:
  Si la clave maestra se pierde o se corrompe, todos los campos cifrados en la base de datos se vuelven **permanentemente irrecuperables**. El servidor fallará al descifrar credenciales y cargas útiles existentes.
- **Requisitos operativos**:
  1. Nunca confirme claves en texto plano en repositorios de código ni en Dockerfiles;
  2. Inyecte claves mediante variables de entorno seguras, gestores de secretos o bóvedas de orquestación;
  3. Conserve una copia de seguridad fuera de línea en una bóveda de contraseñas de custodia compartida (como 1Password, HashiCorp Vault o un sobre físico seguro).

---

## 5. Barreras de seguridad previas a la migración y rollbacks hacia adelante

Al actualizar Shell-PAMC, la aplicación inspecciona y aplica automáticamente los scripts de migración SQL inmutables no ejecutados durante el arranque:

1. **Barreras de seguridad automatizadas**:
   - **Verificación de espacio en disco**: Comprueba el espacio disponible en disco antes de iniciar; requiere al menos `database_size + 4 KiB` de espacio libre por defecto (o configurado mediante `BackupConfig.MinFreeBytes`);
   - **Respaldo cifrado previo a la migración**: Para bases de datos existentes con migraciones registradas en `schema_migrations`, la aplicación toma una instantánea `VACUUM INTO` (que lee marcos WAL confirmados además del archivo principal) y la escribe como un respaldo cifrado con AES-GCM con suma de comprobación `.sha256` en `SHELLPAMC_DATA_DIR/backups` (permisos `0700/0600`). La comprobación es fail-closed: si el estado del esquema no se puede leer, el respaldo se toma en lugar de asumir una base de datos nueva;
   - **Prueba de humo de restauración**: Descifra el respaldo en una base de datos temporal y verifica que las tablas del esquema sean legibles antes de continuar; si la verificación falla o no se puede leer el archivo `.sha256`, la migración se aborta con `ErrBackupRestoreFailed`;
   - **Retención**: Mantiene los 5 respaldos de migración más recientes de forma predeterminada (configurable mediante `repository.WithMigrationBackup`).
2. **Evolución del esquema por expansión / contracción**:
   - Las modificaciones del esquema se adhieren estrictamente a principios de expansión primero, evitando romper consultas antiguas.
3. **Rollbacks solo hacia adelante**:
   - En producción, revertir cambios editando manualmente `schema_migrations` o rebobinando archivos de esquema está estrictamente prohibido;
   - Si se descubre un defecto en una migración, despliegue una migración correctiva hacia adelante (ej. `008_fix_xxx.sql`) para corregir el esquema.

---

## 6. Retención de datos y mantenimiento periódico

1. **Ciclo de vida de los datos de uso**:
   - Cada tabla declara un ciclo de vida en `TABLE_LIFECYCLES` (`internal/repository/lifecycle.go`): `permanent`, `rolling`, `owner_bounded` o `replaced`. Una migración que añada una tabla sin declararla falla `TestEveryTableDeclaresItsLifecycle`;
   - **Permanente**: `usage_facts_15m` y `usage_facts_daily`, leídas por todos los paneles del tablero. Crecen con combinaciones de modelo/credencial/clave por intervalo, no con solicitudes individuales, y nunca se purgan;
   - **Deslizante (Rolling), `SHELLPAMC_USAGE_RETENTION_DAYS`** (por defecto 90, `0` conserva todo): registros de solicitudes (`usage_events`), `error_events`, `ingest_gaps` y cargas útiles descartadas. El corte se redondea hacia abajo a un día UTC completo;
   - **Deslizante (Rolling), `SHELLPAMC_USAGE_INBOX_RETENTION_DAYS`** (por defecto 7, `0` sigue el horizonte de registros de solicitudes): cargas útiles en `usage_inboxes` que fueron decodificadas en un registro de solicitud. Constituyen la parte más grande de la base de datos;
   - La pasada se ejecuta cada hora dentro de `ingest.Maintenance` en lotes de 2000 filas, como máximo 25 lotes completos a la vez; una pasada no finalizada continúa en el siguiente ciclo de agregación (`SHELLPAMC_USAGE_AGGREGATE_INTERVAL`, por defecto 15 segundos) para no retener la barrera de escritura en una eliminación prolongada;
   - Un registro de solicitud se elimina solo cuando su ID es menor o igual al punto de control de `facts`, garantizando que nada se elimine antes de que los hechos permanentes lo contengan. Lo que cada política ha eliminado y hasta qué instante se registra en `data_lifecycle_state`;
   - Eliminar filas libera páginas para su reutilización pero no reduce el tamaño del archivo (`auto_vacuum` está desactivado). Tras acortar un horizonte, recupere el espacio con la compactación detallada en *Recuperación de espacio y compactación* a continuación;
   - **Nota de actualización**: el valor por defecto de registros de solicitudes era de 400 días y ahora es de 90, y las cargas útiles decodificadas se conservan durante 7 días. Un despliegue que no configure ninguna de las dos variables tendrá sus registros y cargas útiles más antiguos eliminados por las pasadas posteriores a la actualización, una vez que los hechos de uso los hayan absorbido; las estadísticas del tablero no se ven afectadas. Para mantener el comportamiento anterior, configure `SHELLPAMC_USAGE_RETENTION_DAYS=400` y `SHELLPAMC_USAGE_INBOX_RETENTION_DAYS=0` antes de actualizar;
   - Al actualizar, la migración 035 inicia los hechos vacíos y el bucle de mantenimiento pliega los registros almacenados en ellos desde el primer ID. Los totales se mantienen exactos provisionalmente porque los registros no plegados se leen directamente; las estadísticas de solicitudes ya eliminadas por una pasada de retención anterior no pueden recuperarse.
2. **Historial de precios (`model_price_versions`, `pricing_channel_versions`)**:
   - Las versiones de precios y canales son append-only y nunca se purgan: cada costo de solicitud registrado referencia las versiones con las que quedó bloqueado, y eliminar una dejaría un costo que ya no se puede explicar. Crecen con los cambios de precio, no con el tráfico, por lo que su tamaño es insignificante;
   - La migración 028 (precios de OpenRouter) reconstruye `model_prices` y `pricing_sync_state` copiando sus filas exactamente sin los activadores de versión, por lo que la actualización no genera nuevas versiones ni altera costos registrados. El intervalo de sincronización automática se mantiene; el historial de sincronización de models.dev no. El respaldo previo a la migración lo cubre como a cualquier otra migración;
   - La migración 029 añade la instantánea JSON de membresía de proveedores a `pricing_catalog_state`; el acceso a precios la requiere. La siguiente conciliación completa con CPA puebla las instalaciones existentes. La actualización es aditiva y deja todas las versiones de precios y bloqueos intactos;
   - La migración 031 añade `pricing_match_reviews`, el modelo de OpenRouter que el operador respondió por última vez para cada precio personalizado o vinculado. Es aditiva, no contiene precios ni bloquea costos; restaurar una copia anterior solo implica que el libro volverá a anunciar coincidencias existentes una vez más;
   - `pricing_upstream_catalog` contiene la última descarga completa de OpenRouter y se reemplaza íntegramente en cada sincronización exitosa; restaurar una copia anterior solo significa que el selector de modelos mostrará una lista más antigua hasta la próxima sincronización.
3. **Documentos del agente (`agent_documents`, migraciones 026 y 036)**:
   - La sesión más reciente cifrada del Agente y sus operaciones de capacidades residen aquí; el texto cifrado de la sesión se escribe con el mismo sobre `SHELLPAMC_MASTER_KEY` que otras cargas útiles protegidas, por lo que la clave debe existir para reanudar conversaciones o leer operaciones pendientes;
   - Las sesiones conservan su historial hasta reiniciarse o reemplazarse el turno explícitamente y están exentas del límite de 8 MiB de documentos del repositorio; conversaciones largas aumentan el tamaño de la base de datos y de los respaldos. Una operación terminal se conserva durante 7 días. La purga es diferida (lazy) — ocurre durante solicitudes del Agente con un límite de una por minuto —, por lo que el Agente no añade bucles en segundo plano ni requiere tareas de mantenimiento programadas;
   - La migración 036 reconstruye la tabla para admitir el tipo `image` (ADR 0075), copiando cada fila textualmente; el respaldo normal previo a la migración la cubre. Una imagen adjunta a un mensaje es una fila cifrada, con un contenido máximo de 5 MiB, conservada mientras la conversación la referencie y eliminada al reiniciar. Reemplazar un turno reutiliza sus imágenes. Intentos fallidos de admisión intentan eliminar solo las filas de imágenes recién escritas; esta limpieza de mejor esfuerzo puede fallar si la base de datos no está disponible. El almacenamiento de imágenes crece con la conversación retenida;
   - Restaurar esta tabla desde un respaldo restaura el historial de conversaciones y operaciones, pero la aprobación requiere una nueva decisión: una operación que estaba en ejecución (`executing`) cuando el proceso se detuvo se reporta como incierta (`uncertain`) en lugar de repetirse.
4. **Respaldos de configuración de CPA (`cpa_config_backups`, migración 030; `cpa_config_backup_settings`, migración 033)**:
   - Antes de cada escritura de configuración, Shell-PAMC almacena el `config.yaml` de CPA tal como estaba, cifrado con el sobre de `SHELLPAMC_MASTER_KEY`; sin la clave una copia no puede leerse ni restaurarse. Una escritura cuya copia no pueda almacenarse se rechaza, de modo que una clave faltante o una base de datos no escribible bloquea escrituras de configuración en lugar de hacerlas irrecuperables;
   - La migración 033 añade a cada copia el `layout` (`v8` o `legacy`) y `reason` (el tipo de escritura que precedió); copias anteriores se marcan como `legacy` / `legacy_conversion`. La actualización es aditiva y está cubierta por el respaldo de migración normal;
   - Copias v8 se conservan según la retención elegida en la página de configuración (por defecto 20, entre 5 y 100, la única fila de `cpa_config_backup_settings`); copias anteriores a v8 se guardan por separado, las diez más recientes (`CONFIG_LEGACY_BACKUP_RETENTION`). Una copia idéntica a la más nueva de la pasarela la reutiliza en lugar de añadir una nueva, evitando que intentos rechazados expulsen copias antiguas. Copias anteriores se eliminan en la misma transacción que la inserción, y reducir la retención las elimina de inmediato, por lo que la tabla no requiere tareas de mantenimiento. Una copia tiene como máximo 2 MiB, el archivo más grande que acepta la API de administración de CPA;
   - La página de configuración lista las copias, toma una a demanda, restaura una copia v8 en la pasarela (el archivo reemplazado se conserva primero), descarga y elimina copias; la restauración, descarga y eliminación son auditadas fail-closed (`config.restore_backup`, `config.reveal_backup`, `config.delete_backup`). `cpa_config_backups` permanece oculta para `database_query` del Agente;
   - Restaurar estas tablas desde un respaldo de base de datos restaura las copias y la retención. Una copia anterior a v8 no puede reescribirse mediante la API v8; colocarla nuevamente en la pasarela es una acción del operador directamente sobre el archivo de CPA, fuera de Shell-PAMC.
5. **Recuperación de espacio y compactación**:
   - La eliminación a gran escala de datos históricos deja páginas libres dentro de SQLite. El archivo no reduce su tamaño por sí solo, y un archivo `-wal` grande es normal y no un fallo: el WAL se reutiliza entre puntos de control en lugar de truncarse continuamente;
   - Existen dos acciones disponibles, y la página de Información del Sistema ejecuta ambas. La vía de la consola es la más segura para un despliegue en ejecución porque utiliza la barrera de escritura descrita en `docs/architecture.md` §11 — los escritores esperan en lugar de fallar, y una escritura fallida detendría el recolector de uso y con él el proceso:
     - **Punto de control WAL** (`PRAGMA wal_checkpoint(TRUNCATE)`) traslada los marcos del log de vuelta a la base de datos y trunca el log. Es económico y seguro de ejecutar con frecuencia. SQLite informa un punto de control bloqueado en la fila de resultado de la instrucción en lugar de lanzar un error, por lo que la página informa ese resultado como *incompleto* en lugar de como éxito;
     - **Reconstrucción** (`VACUUM`) libera páginas libres. SQLite documenta que necesita hasta **el doble del archivo de la base de datos** en espacio libre mientras se ejecuta, y la consola mide ese requisito y lo muestra en la confirmación antes de iniciar la acción. La consola usa un `VACUUM` directo, no un `VACUUM INTO` con intercambio de archivos: el grupo de conexiones mantiene un manejador abierto hacia el archivo, por lo que reemplazarlo por debajo requeriría cerrar cada conexión y reconstruir el grupo mientras otras goroutines aún mantienen referencias a él. Un `VACUUM` directo copia hacia un archivo temporal y sobrescribe el original dentro de una transacción ordinaria, por lo que una reconstrucción interrumpida — por cancelación, por su límite de diez minutos o por reinicio — deja la base de datos original intacta.
   - Las mismas acciones permanecen disponibles directamente a través de `sqlite3` cuando la consola no es accesible. Detenga la aplicación primero o acepte el mismo comportamiento de espera que proporciona la barrera:
     ```bash
     sqlite3 /path/to/data/shell-pamc.db "PRAGMA wal_checkpoint(TRUNCATE);"
     sqlite3 /path/to/data/shell-pamc.db "VACUUM;"
     ```
   - Un trabajo de mantenimiento no sobrevive a un reinicio: el proceso que lo ejecuta finaliza con él. El estado de tareas de la consola se conserva en memoria por este motivo, y la página lo advierte expresamente.

### Escrituras nativas de plugins

Las escrituras nativas de páginas de plugins confiables que afectan la configuración participan en la barrera existente de `cpa_config_backups` cifrada (ADR 0067). La credencial explícita de una página se comprueba contra la clave almacenada (ADR 0069) antes de crear una instantánea, y el fallo de esta impide la mutación. Las copias usan la retención existente y el motivo `config_changes`, con deduplicación; no se introduce ninguna tabla ni migración nueva.

### Registros de programación de calentamiento

La migración 041 añade políticas de proveedores/credenciales, estado de programación por credencial y recibos de solicitudes acotados, además de `quota_snapshots.warmup_json` para observaciones de facturación/activación. Los respaldos completos normales de la base de datos incluyen estas tablas. Conserve el estado de programación y los recibos juntos al restaurar: los intentos consumidos o inciertos no deben reinicializarse eliminando selectivamente una tabla. Los recibos conservan los 100 más recientes por credencial; la supresión de ciclo y diaria residen por separado en el único registro de programación por credencial.
