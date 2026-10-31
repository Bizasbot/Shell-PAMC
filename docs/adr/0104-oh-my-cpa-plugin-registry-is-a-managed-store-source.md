# ADR 0104: El registro de plugins de Oh My CPA es una fuente administrada

- Estado: Aceptado
- Superado en parte: la consola ya no tiene una página de tienda de plugins; la fuente del registro, su preferencia y la fila de la pestaña de configuración permanecen. Las menciones a continuación sobre el listado de la tienda, el orden y la confirmación de instalación son históricas.
- Fecha: 2026-10-22

## Contexto

La tienda de plugins de CPA lee su registro integrado `official` además de lo que indique
`plugins.store-sources`. Oh My CPA no tenía un registro propio, por lo que un plugin
publicado por este proyecto tenía que alojarse en el registro de otra persona o ser pegado
manualmente en cada instalación, y la consola que lo incluye no podía ofrecerlo como una
entrada de primera clase.

Dos restricciones moldearon la decisión. CPA solo puede listar e instalar desde un registro que
tenga en su propia configuración, por lo que la dirección debe llegar a `plugins.store-sources`: la
consola no puede servir un catálogo que CPA desconoce. Y la consola cuenta con un
editor de configuración de documento completo, por lo que cualquier elemento almacenado en ese archivo
puede ser eliminado a mano, mientras que un operador espera que la fuente que este producto incluye
funcione como la integrada de CPA.

El modelo de confianza de la tienda ya tiene dos respuestas: una entrada del registro integrado
con un repositorio de primera parte es **official** (oficial), y todo lo demás es **third-party**
(de terceros), instalándose únicamente tras escribir el ID del plugin. Un registro publicado por
este proyecto sigue siendo código ajeno en relación con la pasarela (*gateway*).

## Decisión

1. **El registro es un archivo en este repositorio.** `plugins/registry.json` se publica
   mediante HTTPS desde la rama `master` y se compila como
   `pluginregistry.OMCSourceURL`. No es una configuración de operador ni una variable de
   entorno: cada instalación tiene el mismo registro, y publicar un plugin es un
   cambio en dicho archivo.

2. **Una preferencia, reconciliada por el servidor.**
   `omc_plugin_source_enabled` (activado por defecto) se lee en el lado del servidor. Leer la tienda,
   instalar, guardar la configuración de los plugins y guardar cualquiera de las formas de configuración
   agregan la dirección a `plugins.store-sources` cuando la preferencia está activada y la eliminan
   cuando está desactivada, bajo el mecanismo de control de escritura (*write gate*) del proveedor y el
   mutex de configuración. Una operación de guardado de configuración que eliminara la dirección
   se repara dentro del propio ámbito de bloqueo del guardado, por lo que la revisión que recibe el
   editor ya la contiene. Por lo tanto, la edición directa de la configuración no puede desactivar
   la fuente; solo la preferencia puede hacerlo.

3. **La tienda la marca y la ordena.** Las entradas del registro administrado llevan
   `is_omc`, la fuente se denomina "Oh My CPA" en lugar de usar el valor predeterminado del host URL de CPA,
   y sus entradas se listan antes que las de cualquier otro registro, manteniendo el orden
   propio de cada registro. No son **official**: solo el registro integrado más un repositorio
   de primera parte lo es (ADR 0029), e instalar uno sigue requiriendo escribir el ID del plugin.

4. **El interruptor se encuentra en la página de configuración de OMC.** La pestaña de configuración de plugins
   muestra la fuente como una línea fija —su nombre, renderizado con el mismo glifo que usa la fuente
   oficial de CPA, y un enlace al interruptor— y nunca la incluye en la lista de fuentes editables.
   Una operación de guardado en la configuración de plugins que la omita la mantiene exactamente como
   indica la preferencia, y una que la incluya no almacena una segunda copia.

## Consecuencias

- Una lectura de la tienda ahora puede escribir en la configuración. Es la única operación de lectura que
   lo hace; escribe únicamente cuando el archivo no coincide con la preferencia, y genera una copia de
   seguridad además de escribir una fila de auditoría. Un fallo en este proceso hace que la lectura falle
   en lugar de servir una tienda que no es la configurada por el operador.
- `plugins.store-sources` deja de ser puramente la lista del operador: una entrada está
  administrada, y la página de configuración lo indica. La lectura de la tienda en un despliegue
  repara el archivo o falla; nunca sirve entradas que el interruptor haya desactivado.
- El registro publicado comienza vacío y un documento vacío es válido, por lo que la fuente
  está presente y operativa antes de que exista el primer plugin de Oh My CPA.
- La demostración no puede escribir su fixture, por lo que responde al interruptor filtrando las
  entradas administradas de la respuesta de la tienda; el interruptor produce el mismo efecto visible allí.
- Una dirección de registro modificada cambia silenciosamente el ID de fuente que CPA deriva de ella,
  por lo que la dirección y su ID derivado están fijados (*pinned*) mediante una prueba: mover el
  registro es una edición deliberada, no un accidente en una constante.
