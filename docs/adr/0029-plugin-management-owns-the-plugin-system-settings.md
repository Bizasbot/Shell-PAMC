# ADR 0029: La gestión de plugins es propietaria de la configuración del sistema de plugins

- Estado: Aceptado
- Supersedido en parte: la pestaña de la tienda de plugins y la redirección `/plugin-store` fueron eliminadas; las pestañas de instalados y configuración permanecen.
- Fecha: 2026-09-28

## Contexto

Los plugins abarcaban dos páginas de la consola y un grupo de configuración. `/plugins` listaba lo que estaba instalado, `/plugin-store` listaba lo que se podía instalar, y el interruptor que decide si CPA carga algún plugin (`plugins.enabled`), las fuentes de la tienda adicionales (`plugins.store-sources`) y las reglas de autenticación de la tienda (`plugins.store-auth`) se encontraban en la sección avanzada de la página de configuración —las reglas como un editor JSON plano—. Encontrar un plugin, instalarlo, configurarlo y encender el sistema requería pasar por tres lugares, y el último paso era el menos perceptible.

La fachada detrás de las dos páginas también se había desalineado respecto al gateway que sirve de interfaz. Decodificaba campos que la lista de plugins de CPA no incluye (un nombre de nivel superior, descripción, permisos y el documento de configuración), alternaba un plugin a través de una ruta que CPA no expone, y no leía nada de lo que CPA sí envía: el interruptor global, los campos de configuración declarados de cada plugin, el registro de origen de una entrada de la tienda, sus etiquetas, icono, página principal y si hay una actualización disponible.

CPA no ofrece una ruta de gestión más específica para los tres ajustes del host. Son claves de `config.yaml`, legibles y escribibles únicamente como el documento completo.

## Decisión

1. **Una sola página.** `/plugins` contiene tres pestañas —instalados, tienda, configuración— seleccionadas mediante `?tab=`. `/plugin-store` es una redirección de compatibilidad hacia `/plugins?tab=store`, y la página de configuración ya no muestra el grupo de plugins.

2. **La fachada utiliza la API real de plugins de CPA.** La lista, el interruptor por plugin (`PATCH /plugins/{id}/enabled`), el documento de configuración por plugin (`GET`/`PUT /plugins/{id}/config`), la desinstalación y la tienda con instalación desde un registro nombrado en una versión nombrada. Las respuestas se proyectan en los DTOs propios de esta consola; el enlace al repositorio y si una entrada es de primera parte (*first-party*) se derivan en el servidor, de modo que cada superficie lee la misma respuesta. Una entrada de la tienda es oficial únicamente cuando el registro integrado de CPA la proporcionó *y* su repositorio pertenece a la organización de GitHub de primera parte, ya que un registro de terceros puede copiar el nombre de un repositorio.

3. **Los ajustes del host se editan en el documento, del lado del servidor.**
   `PUT /api/v1/management/plugins/settings` lee `config.yaml`, reescribe únicamente `plugins.enabled`, `plugins.store-sources` y `plugins.store-auth` (se conservan los comentarios y todas las demás claves, incluidos `plugins.dir` y `plugins.configs`), y vuelve a escribir el documento. Es la misma transacción que un guardado de configuración: mantiene el bloqueo de escritura (*write gate*) del proveedor y el mutex de configuración, y transporta la revisión que la página cargó, por lo que un cambio realizado en otro lugar durante el ínterin se rechaza como `config_conflict` en lugar de sobrescribirse. Las reglas se validan tal como CPA las lee, y solo se escriben los nombres de variables de entorno que utiliza el tipo de regla.

4. **Los campos declarados de un plugin constituyen el editor.** El panel lateral de configuración (*drawer*) renderiza cada campo que CPA reporta como un control tipado, marca lo que el borrador modificó y permite restablecer un campo al valor por defecto del plugin. Las claves que el plugin no declara se transmiten intactas y se muestran; la vista JSON edita el mismo documento.

## Consecuencias

- La consola ahora escribe `config.yaml` desde un segundo lugar. La verificación de revisión y el bloqueo de escritura compartido son los que mantienen esto seguro, y son la razón por la cual la escritura no se realiza en el navegador aplicando un parche al borrador de la página de configuración.
- El navegador nunca llega a conocer una credencial de la tienda: una regla nombra variables de entorno, y CPA lee los valores de su propio entorno al realizar la solicitud.
- El icono de un registro es obtenido e incrustado en línea (*inlined*) por el servidor bajo las mismas reglas que el logotipo de un plugin instalado (ADR 0013), por lo que la tienda no añade ninguna solicitud del navegador a un host de terceros.
- La tienda se lee únicamente una vez que se abre su pestaña: leerla hace que CPA obtenga cada registro y, para los plugins instalados, sus últimas versiones, lo cual es lento y está sujeto a limitación de tasa (*rate limited*), y la lista de instalados no debe esperar por ello.
