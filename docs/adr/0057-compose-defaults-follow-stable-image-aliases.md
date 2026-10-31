# ADR 0057: Los valores predeterminados de Compose siguen los alias de imágenes estables

- Estado: Aceptado
- Fecha: 2026-10-04
- Reemplaza: Únicamente la política de imágenes predeterminadas de Compose del ADR 0056.

## Contexto

Las plantillas de instalación deben instalar las imágenes actuales sin requerir una
nueva plantilla para cada versión. Las identidades de las versiones, las reversiones (rollbacks) reproducibles y
el control del operador siguen requiriendo imágenes versionadas y hashes (digests) inmutables.

## Decisión

Se establece por defecto OMC como `wiziscool/oh-my-cpa:latest` en ambas topologías de Compose y CPA como
`eceasy/cli-proxy-api:latest` en la topología de pila completa (full-stack). Se conservan las variables de sustitución `OMCPA_IMAGE` y
`CPA_IMAGE` para fijar versiones o digests específicos. Los recursos de Compose descargados se
versionan independientemente de los alias de imagen predeterminados a los que hacen referencia.

El flujo de trabajo de publicaciones sigue subiendo los alias de versión antes de publicar una GitHub
Release, y luego promueve únicamente el digest estable más nuevo de OMC a `latest`. No
controla la política de publicación upstream de CPA. La verificación de la instalación comprueba la
versión de la imagen resuelta en lugar de asumir que la versión de la plantilla es la versión en tiempo de ejecución.

## Consecuencias

- Una descarga (pull) nueva obtiene las imágenes actuales; los contenedores existentes no se actualizan
  por sí mismos. Los operadores descargan explícitamente y vuelven a crear el servicio seleccionado.
- Los operadores deben fijar ambos servicios cuando se requiera reproductibilidad y actualizar
  CPA por separado de OMC tras comprobar su compatibilidad.
- El estado existente de la pasarela (gateway), las claves maestras, la propiedad de las colecciones y los valores predeterminados
  de los oyentes (listeners) privados permanecen sin cambios.
