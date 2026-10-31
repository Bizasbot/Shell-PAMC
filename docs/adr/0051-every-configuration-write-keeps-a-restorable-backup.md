# ADR 0051: Toda escritura de configuración conserva una copia de seguridad restaurable

- Estado: Aceptado
- Fecha: 2026-10-02
- Reemplaza a: Decisión 4 de [ADR 0037](0037-configuration-editing-uses-the-v8-configuration-api.md) (una copia de seguridad solo antes de convertir un archivo anterior a v8). Sus otras decisiones permanecen sin cambios.

## Contexto

El ADR 0037 conservaba el `config.yaml` almacenado de CPA únicamente antes de la escritura que convierte un archivo anterior a v8, debido a que dicha conversión es irreversible desde CPA. Cualquier otra escritura tampoco se podía recuperar desde Oh My CPA: una edición incorrecta de un proveedor, la instalación de un complemento que reescribía el archivo o el guardado de una vista de código que eliminaba una sección obligaban al operador a reconstruir el archivo anterior a mano. El *hook* que leía el archivo almacenado antes de cada escritura ya se ejecutaba antes de todas ellas; simplemente descartaba lo leído cuando el archivo ya era v8.

## Decisión

1. **Cada escritura tras la cual CPA guarda el archivo conserva primero el archivo almacenado.** El *hook* del cliente (`management.ConfigBackup`) se ejecuta antes de un conjunto de cambios, de un guardado de documento completo, de la instalación o eliminación de un complemento y de un cambio de estado de credenciales, y entrega el archivo tal como está almacenado (`GET /v0/management/config.yaml`) al almacenamiento sin importar su estructura. Una copia idéntica a la más reciente de la pasarela no se almacena dos veces, por lo que los reintentos rechazados no consumen la retención. Una escritura cuya copia no se pueda conservar se rechaza antes de enviar nada (`503 config_backup_failed`), excepto un archivo v8 sin ningún almacenamiento configurado en absoluto.
2. **Cada copia registra a qué antecede y su estructura.** El método del cliente nombra el tipo de escritura (`config_changes`, `config_source`, `provider_keys`, `client_keys`, `oauth_aliases`, `plugin_settings`, `plugin_install`, `plugin_delete`, `credential_status`, `restore`, `manual`); el nombre de una operación externa prevalece sobre el método al que llama (`management.WithBackupReason`). Las copias tomadas antes de la migración 033 son `legacy_conversion`.
3. **La retención pertenece al operador.** Las copias v8 se conservan según una retención elegida en la página de configuración (predeterminado 20, entre 5 y 100, almacenada en `cpa_config_backup_settings`); reducir este valor elimina las copias más antiguas de inmediato. Las copias anteriores a v8 se mantienen separadas (las últimas diez), de modo que las escrituras cotidianas nunca desplacen el único registro de un archivo no convertido.
4. **La restauración ocurre en el servidor.** `POST /management/config/backups/{id}/restore` descifra la copia y la escribe mediante `PUT /v8/management/config.yaml` bajo el control de escritura del proveedor, sin comprobación de revisión: reemplazar lo que haya es la solicitud. Dicha escritura conserva el archivo que reemplaza como cualquier otra, por lo que una restauración se deshace restaurando esa copia. El documento nunca llega al navegador. Solo se puede restaurar una copia v8, ya que la API v8 rechaza cualquier nombre de campo anterior a v8; una copia anterior a v8 permanece solo para descarga en lugar de reabrir una ruta de escritura v0. La consola bloquea la restauración mientras el editor tenga cambios sin guardar.
5. **El resto del ciclo de vida es explícito y auditado.** Una copia manual (`POST /management/config/backups`, `config.create_backup`), la retención (`PUT /management/config/backups/settings`, `config.backup_settings`), la eliminación de una copia (`DELETE /management/config/backups/{id}`, `config.delete_backup`, con fallo seguro), la restauración (`config.restore_backup`, con fallo seguro) y la descarga (`config.reveal_backup`, con fallo seguro) dejan cada una una fila de auditoría. Ninguna de ellas es una capacidad de agente: una restauración es una escritura de documento completo, las cuales no se conceden a los agentes.

## Consecuencias

- Cada escritura de configuración cuesta una inserción cifrada además de la lectura del archivo almacenado que ya realizaba. Las copias son de como máximo 2 MiB; el peor de los casos para la tabla está acotado por la retención.
- Una base de datos con fallos ahora bloquea cada escritura de configuración, no solo la conversión de un archivo anterior a v8: la promesa de que cada operación se puede deshacer se mantiene con fallo seguro.
- Una copia captura una edición realizada fuera de Oh My CPA, debido a que se lee justo antes de la siguiente escritura en lugar de recordarse desde la última.
- Un archivo restaurado es el archivo v8 de CPA tal como está almacenado; CPA lo vuelve a validar, y una copia que CPA ya no acepta (tras una versión que cambió el nombre de un ajuste) se rechaza con su motivo, dejando el archivo sin cambios.

## Alternativas consideradas

- **Crear una instantánea (*snapshot*) después de cada escritura.** Rechazado: no detecta las ediciones realizadas fuera de Oh My CPA entre escrituras, y una instantánea fallida tras una escritura exitosa ya no se puede rechazar.
- **Restaurar una copia anterior a v8 mediante `PUT /v0/management/config.yaml`.** Rechazado: reabre una ruta de escritura v0 que la línea base de v8 retiró, y CPA descarta silenciosamente las claves heredadas ensombrecidas en ella.
- **Mantener la retención en `ui_preferences`.** Rechazado: las preferencias describen cómo el operador lee la consola y son escritas por un extremo genérico autorizado; la retención cambia lo que el servidor elimina y necesita su propia escritura validada.
