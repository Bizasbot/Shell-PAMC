# Los archivos nativos comparten la canalización de lanzamiento sincronizada

OMC publica ejecutables nativos para la matriz amd64/arm64 de Darwin, Windows, Linux y FreeBSD de CPA a través del flujo de trabajo de etiquetas existente, junto con las imágenes de Docker.
La matriz y el contrato de archivos/sumas de verificación son propiedad del repositorio y se prueban: la compilación
utiliza un SPA incrustado, Go sin CGO e identidad de lanzamiento inyectada, mientras que la publicación
requiere una verificación completa, una inserción (push) exitosa de la imagen versionada y activos nativos validados.
Esto amplía la puerta de publicación del ADR 0056 sin delegar la publicación en GitHub
ni la selección de la versión más reciente (*latest*) a un segundo motor de lanzamiento.

Los archivos nativos proporcionan el ejecutable, la licencia, los archivos README, las guías de operador y una plantilla de entorno
sin secretos; las sumas de verificación SHA-256 cubren todos los archivos descargables y de instalación.
La fecha del commit fuente normaliza las marcas de tiempo de los archivos. Una transferencia de artefactos fijada
separa las compilaciones de solo lectura del único trabajo con permisos de escritura en el repositorio, el cual vuelve a verificar
el manifiesto completo antes de publicar. Los nuevos lanzamientos se preparan como borradores hasta que finalizan
todos los archivos adjuntos, y luego se vuelve a verificar la directiva de la versión más reciente (*latest*) inmediatamente antes de volverse visibles.
La promoción de la versión más reciente en Docker y la selección numérica estable de GitHub conservan su orden existente.
Los backports y los reintentos no pueden disminuir ninguno de los punteros de la versión más reciente.
La compilación cruzada se verifica para cada destino, mientras que un paquete de Linux extraído
proporciona evidencia de tiempo de ejecución; los ejecutables de Darwin/Windows sin firmar y la cobertura de tiempo de ejecución
externo siguen siendo restricciones explícitas de distribución.
