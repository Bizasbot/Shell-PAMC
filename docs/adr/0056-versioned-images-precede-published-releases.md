# ADR 0056: Las imágenes versionadas preceden a los lanzamientos publicados

- Estado: Aceptado
- Fecha: 2026-10-04
- Extiende: ADR 0019 con automatización de distribución y lanzamientos; sus políticas de comparación, caché, restricción de fuentes y notas de lanzamiento permanecen sin cambios.

## Contexto

La fuente de actualización de OMC es GitHub Releases, pero los despliegues de Docker construidos desde el código fuente no incorporaban una identidad de lanzamiento. Un lanzamiento anunciado antes de que su imagen esté disponible invitaría a realizar una actualización que no se puede instalar. Las pasarelas existentes y otros paneles de gestión también hacen que una topología de proxy "todo en uno" obligatoria no sea segura como valor predeterminado de instalación.

## Decisión

Distribuir compilaciones estables para amd64/arm64 desde `wiziscool/oh-my-cpa` en Docker Hub. Incrustar la etiqueta exacta validada `vMAJOR.MINOR.PATCH` en el binario de Go, conservando la identidad de desarrollo para las compilaciones sin etiqueta y la precedencia explícita de anulación del operador.

Una etiqueta de confianza inicia la verificación, seguida de la aceptación nativa de la imagen empaquetada y la publicación multiplataforma, y posteriormente la creación de un GitHub Release que contiene los activos de instalación y el resumen (*digest*) de la imagen. La subida de la imagen es un requisito previo para la visibilidad del lanzamiento. Serializar la publicación y ordenar las versiones numéricamente para que una corrección retrocompatibles (*backport*) no haga retroceder el puntero "latest" de Docker o GitHub. El contenido modificado requiere una nueva identidad de lanzamiento; las etiquetas publicadas no se mueven para describir código fuente diferente.

Compose consume una imagen fijada (*pinned*), publica oyentes de bucle invertido (*loopback*) directos y ofrece topologías separadas de pila nueva y exclusiva para OMC. Las pasarelas, paneles, reglas de red, claves y la propiedad de la colección existentes se conservan por defecto. La entrada HTTPS es responsabilidad del operador. Las plantillas de Caddy empaquetadas y el punto de entrada (*entrypoint*) se retiran; las actualizaciones desde esa topología deben coordinar el acceso con la infraestructura existente en lugar de asumir que Compose proporciona TLS.

## Consecuencias

- Una actualización anunciada se corresponde con una imagen subida y una versión en ejecución comparable. Una etiqueta independiente sin un GitHub Release permanece invisible para el comprobante.
- La instalación desde una imagen ya no requiere una cadena de herramientas de frontend/Go ni la clonación del código fuente.
- Los mantenedores deben proteger la creación de etiquetas de versión y configurar un token de inserción de Docker Hub en Actions; solo el trabajo de publicación de lanzamiento necesita acceso de escritura a GitHub.
- El registro de Docker y GitHub son sistemas separados: una imagen puede subirse antes de que falle la creación del lanzamiento. La recuperación reintenta la publicación con la misma fuente en lugar de reescribir la etiqueta; los resúmenes inmutables permiten a los operadores identificar la compilación subida.
- El acceso directo por bucle invertido (*loopback*) es sencillo y seguro a nivel local, pero el HTTPS público debe ser proporcionado por el operador. Una configuración mínima y nueva de CPA nunca debe reemplazar el estado existente.
