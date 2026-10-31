# ADR 0099: Las actualizaciones de la consola se realizan a través de un sidecar que posee el socket

- Estado: Aceptado
- Fecha: 2026-10-14
- Reemplaza: La consecuencia del ADR 0057 de que los contenedores existentes no se actualizan por sí mismos y los operadores descargan y recrean explícitamente el servicio seleccionado. Su valor predeterminado de usar imágenes flotantes `latest`, su guía de fijación (pinning) y su política de publicación siguen vigentes.

## Contexto

La consola ya sabe cuándo existe una versión más reciente de Oh My CPA o CLIProxyAPI (ADR 0019), pero aplicar una implicaba tener una terminal (shell) en el host de Docker. Reemplazar un contenedor requiere la API de Docker Engine, y el contenedor de la consola es deliberadamente lo opuesto a algo que deba poseerla: sistema de archivos raíz de solo lectura, usuario sin privilegios, todas las capacidades eliminadas y una amplia superficie HTTP autenticada.

Los despliegues existentes fueron escritos a mano a partir de tres fragmentos diferentes de Compose, más dos archivos Compose de liberación. Una migración que pidiera a cada operador editar su archivo habría sido el último paso manual que la mayoría nunca habría dado.

## Decisión

**Un segundo contenedor posee el socket.** La misma imagen se ejecuta como `oh-my-cpa updater serve`: `internal/updater`, un pequeño servicio HTTP con el socket de Docker montado, un sistema de archivos de solo lectura, sin capacidades y sin puertos publicados. El contenedor de la consola no cambia. La API de Engine se comunica mediante `net/http` sobre el socket UNIX; no se añade ningún SDK de Docker al módulo.

**La interfaz del updater consta de dos peticiones, ninguna de las cuales nombra una imagen o un contenedor.** `GET /v1/status` informa lo que encontró, y `POST /v1/update` toma un producto, `omc` o `cpa`. El updater resuelve la consola como el contenedor que comparte su propio repositorio de imágenes (en su propio proyecto de Compose cuando tiene uno), y la pasarela (gateway) como el contenedor al que apunta el `OMCPA_CPA_BASE_URL` de la consola. Una pasarela que no sea un contenedor en ese host se reporta como tal y nunca se adivina.

**El reemplazo consiste en renombrar, crear, verificar y luego eliminar.** La configuración del reemplazo se deriva del contenedor en ejecución menos todo lo que suministraba su imagen anterior, por lo que el punto de entrada (entrypoint), el entorno, la verificación de salud y las etiquetas de la nueva imagen surten efecto mientras que la configuración, los montajes, las redes, los alias y las etiquetas de Compose del operador se transfieren. El contenedor viejo se detiene y se renombra, no se elimina, hasta que el reemplazo esté saludable; un reemplazo que sale o informa un estado no saludable se elimina, el contenedor viejo recupera su nombre y se inicia, y la etiqueta de la imagen apunta de nuevo a la imagen vieja.

**Una imagen fijada (pinned) nunca se cambia.** Una etiqueta de versión o un resumen (digest) en la referencia de imagen configurada significa que el operador eligió esa versión. Reemplazar el contenedor de todos modos se revertiría con el siguiente `docker compose up`, que luego iniciaría el binario fijado y más antiguo sobre una base de datos que el más nuevo ya había migrado, y las migraciones son solo hacia adelante. Solo se actualizan las etiquetas flotantes, y la etiqueta se vuelve a apuntar localmente para que Compose no vea ninguna deriva (drift) después.

**Las versiones de la consola se verifican mediante firma; las de la pasarela no.** Cada lanzamiento publica `release-manifest.json`, que nombra el repositorio de imágenes y el resumen multiplataforma, y una firma Ed25519 realizada con una clave guardada en el secreto del trabajo de lanzamiento (release job). La clave pública se compila dentro del binario. La consola descarga ambos archivos y los reenvía sin leerlos; el updater verifica la firma, que el manifiesto nombre el repositorio que la consola ya ejecuta y que la versión no retroceda, y luego descarga (pull) por resumen. La pasarela es un proyecto upstream cuyas versiones este proyecto no puede firmar, por lo que su actualización descarga la etiqueta que su contenedor ya usa y confía en el registro, exactamente como lo hace `docker compose pull`. Una compilación sin la clave pública, que es cualquier compilación desde el código fuente y cualquier bifurcación (fork), informa que no puede verificar y no ofrece ninguna actualización de consola; no recurre a una versión no verificada.

**Los dos contenedores no necesitan ninguna configuración compartida.** La consola busca el updater en `http://oh-my-cpa-updater:8090`. El token portador (bearer token) es un HMAC de `OMCPA_MASTER_KEY`; la consola lo calcula a partir de su propia configuración y el updater lo calcula a partir del entorno del contenedor de la consola, el cual puede leer a través del socket que ya posee.

**Los despliegues existentes se migran con un solo comando.** `docker run --rm --pull always -u 0 -v /var/run/docker.sock:/var/run/docker.sock wiziscool/oh-my-cpa:latest updater install` crea el updater como un contenedor propio en una red propia, adjunta la consola a esa red y actualiza la consola a la versión del instalador. Se coloca fuera del proyecto de Compose del despliegue a propósito: un contenedor que Compose desconoce, conectado a una red de Compose, hace que `docker compose down` falle. El updater vuelve a adjuntar la consola cada vez que Compose la recrea. Las nuevas instalaciones declaran el updater como un servicio en su lugar.

**El updater se reemplaza a sí mismo después de reemplazar la consola,** para que ambos ejecuten la misma versión, y le entrega el trabajo terminado a su sucesor para que la consola reiniciada aún pueda leer cómo terminó su propia actualización y registrarla.

## Consecuencias

- Quien controle el contenedor del updater controla Docker en ese host. Esto se indica en las guías de instalación y en `SECURITY.md`, el servicio se puede eliminar de cualquier archivo Compose, y `OMCPA_UPDATER_ENABLED=false` hace que la consola ignore uno.
- Una sesión de consola robada puede iniciar una actualización a la versión actual firmada de Oh My CPA o a la etiqueta propia de la pasarela, y nada más. No puede elegir una imagen.
- El trabajo de lanzamiento falla de forma segura (fails closed) sin su clave de firma, y el par de claves es una cosa más que mantener: perder la clave privada significa enviar una versión con una nueva clave pública a la que las instalaciones existentes deben acceder manualmente una vez.
- El mantenimiento del host se mantiene fuera de la superficie de capacidades del Agente (`docs/agent-capabilities.md`); una actualización es una acción de consola con su propia confirmación y eventos de auditoría, `system.update.apply` y `system.update.completed`.
- Las instalaciones nativas no se ven afectadas y mantienen la actualización manual en `docs/install.md`.
- Sin migración de base de datos: un trabajo vive en la memoria del updater y su resultado en el registro de auditoría.
