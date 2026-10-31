# ADR 0019: La observación de versiones es un estado y su registro de cambios se obtiene por producto

- Estado: Aceptado
- Fecha: 2026-09-22

## Contexto

La página de Información del Sistema informaba de una comparación de versiones como un booleano derivado de
la desigualdad de cadenas: `latest_version != cpa_version`. Esto trataba `7.3.5` y `7.3.11`
como diferentes en la dirección correcta por suerte más que por regla, ignoraba la dirección
por completo y no podía expresar el caso que el proyecto realmente distribuye —`OMCPA_VERSION`
tiene por defecto `v0.1.0-dev` y la compilación de demostración pública se compila como `v0.1.0-demo`, ninguno de los cuales
es una versión de lanzamiento en absoluto. Una comprobación fallida era indistinguible de "actualizado",
porque ambos producían un `latest_version` vacío.

La versión del gateway en ejecución también se conocía como un efecto secundario de una búsqueda que
depende de llegar a GitHub, por lo que un despliegue que no pudiera acceder a internet no
podía indicar qué versión del gateway estaba ejecutando.

La incorporación de notas de lanzamiento planteó tres preguntas adicionales que el código no puede responder por
sí mismo:

1. Las notas de lanzamiento provienen de un host de terceros (`api.github.com`), al que accede el
   servidor en lugar del navegador. Su presupuesto sin autenticar es de 60 solicitudes por hora
   por dirección, por lo que "obtener al renderizar" gastaría todo el cupo del operador en
   recargas.
2. Las notas son Markdown remoto no confiable, renderizado en la consola.
3. La consola no tiene su propio historial de lanzamientos: el repositorio no tiene lanzamientos ni
   etiquetas, por lo que su propio registro de cambios está legítimamente vacío hoy en día.

## Decisión

**Una comparación es un estado, no un booleano.** `update_available`, `up_to_date`,
`update_ahead` e `indeterminate`, donde `indeterminate` conlleva un motivo. Solo
se comparan las versiones que se analizan como versiones de lanzamiento simples con puntos. Una versión de compilación con sufijo
(`-dev`, `-demo`, un marcador de bifurcación) informa `indeterminate` con un motivo
en lugar de "actualizado" o "desactualizado": la consola no puede ubicar dicha compilación en
la línea de lanzamiento, e inventar una posición para ella sería una respuesta incorrecta de apariencia precisa.
Una compilación más nueva que cada lanzamiento informa `update_ahead`, porque "adelantado a la publicación"
no es una actualización para instalar.

**La versión del gateway en ejecución se lee desde el gateway**, a partir de las cabeceras de respuesta de
un endpoint de gestión que la página ya llama, independientemente de si alguna comprobación de lanzamiento
tuvo éxito.

**El registro de cambios cubre un intervalo calculado, no todo.** Para cada producto, los
lanzamientos estables en `(running, newest]`, agrupados por versión, del más nuevo al más antiguo, ordenados por
versión en lugar de por tiempo de publicación para que una corrección retroportada (backport) publicada más tarde no aparezca
por encima de un lanzamiento más nuevo. Se excluyen los lanzamientos previos (prereleases). Cuando la versión en ejecución no es
comparable, no se reclama ningún intervalo y el lanzamiento más nuevo se muestra solo.

**Los metadatos versionados se almacenan; las notas no.** `release_index` y
`release_check_state` (migración 024) contienen etiquetas, nombres, fechas, indicadores de lanzamiento previo y
el resultado de la comprobación, de modo que "¿hay una versión más nueva?" sobrevive a un reinicio y funciona sin conexión.
El cuerpo de un lanzamiento se mantiene solo en la memoria del proceso y nunca se escribe en la base de datos que
contiene el registro de auditoría (audit trail). La consecuencia es visible en lugar de estar oculta: la página informa
si contiene notas y renderiza una entrada con su versión, fecha y enlace de origen cuando
no las tiene, en lugar de un registro de cambios vacío que se leería como "nada ha cambiado".

**El validador de una solicitud condicional solo es de confianza junto con su cuerpo.** Un `304` se responde
frente a una representación que el proceso todavía debe retener, por lo que las ETag almacenadas se descartarán al
iniciar y la primera comprobación después de un reinicio será incondicional. Los validadores también se envían únicamente
cuando la instantánea en caché proviene de una sola página: el validador de la página uno no dice nada
sobre la página dos, y tratarlo como una respuesta de instantánea completa dejaría las páginas
más antiguas sin verificar mientras el código asumía que están al día. Se utilizan solicitudes condicionales porque
pueden evitar transferir un cuerpo que el proceso ya posee; si GitHub además las excluye
de la contabilización del límite de tasa no es algo en lo que este proyecto confíe, y el presupuesto del operador
se trata como gastado de cualquier manera.

**Una instantánea se publica en una sola transacción.** El índice de lanzamiento y los metadatos de comprobación exitosa
son un único hecho: "esto es lo que decía el canal de noticias, y aquí es cuándo y cómo se leyó", y confirmarlos
por separado dejaba una ventana donde podían diferir: un fallo o apagado entre las escrituras
presentaría las versiones de este canal de noticias con la procedencia de la fuente anterior. Las notas y los validadores
se instalan en memoria solo después de que esa transacción se confirma (commits), por lo que la copia en memoria nunca puede describir
un índice que la base de datos no tiene. Un fallo revierte ambos, lo que una prueba induce mediante un
activador (trigger) de base de datos para que la reversión sea observable.

**El registro que guarda un resultado tiene su propio plazo límite (deadline), creado después de la lectura.**
Un presupuesto que abarcaba la lectura del canal de noticias medía lo incorrecto: el tiempo de espera (timeout) de la propia lectura es más largo, por lo que una
recuperación legítimamente lenta caducaba el contexto destinado a persistir su resultado y dejaba el
indicador `running` activado, justo el fallo que el contexto desacoplado existe para evitar. Desacoplar un contexto y
acotarlo son requisitos separados, y el límite pertenece a la fase que protege.

**Una comprobación está sujeta a un umbral mínimo (floor), y los fallos nunca sobrescriben la respuesta.**
`CheckFloor` (quince minutos) es el intervalo más corto entre dos lecturas reales del canal de noticias.
Abrir la página y el botón manual siguen comprobando en cada uso, pero dentro del umbral mínimo la
respuesta proviene del índice almacenado y la respuesta lo indica (`served_from_cache`), por lo que el
botón nunca afirma haber realizado una comprobación que no ejecutó. Un análisis periódico (sweep) se ejecuta cada seis horas y está exento
porque está muy fuera de cualquier umbral (`OMCPA_UPDATE_CHECK_ENABLED=false` detiene el
análisis periódico únicamente). Una comprobación fallida deja intactos el índice almacenado y la marca de tiempo del último éxito,
registrando el motivo y la hora del intento, de modo que la página informa la respuesta anterior y el porqué
falló el nuevo intento. El umbral se mide desde el último intento en lugar del último
éxito, por lo que un canal de noticias roto no se reintenta en cada visualización de página. Cada producto se comprueba e
informa de forma independiente. El validador de una solicitud condicional solo es de confianza mientras el proceso
todavía retenga el cuerpo que describe, por lo que las ETag almacenadas se borran al iniciar.

**El renderizado no ejecuta contenido remoto.** Los cuerpos de los lanzamientos se renderizan a través de
`react-markdown` sin `rehype-raw`, por lo que el HTML en el cuerpo de un lanzamiento nunca se ejecuta;
las imágenes se renderizan como enlaces en lugar de cargarse, por lo que abrir la página no realiza ninguna solicitud
a un host de terceros; los enlaces externos se abren en una pestaña nueva con `noopener noreferrer`.

**La fuente es un identificador de repositorio, nunca una URL.** El host es
`api.github.com` como una constante de tiempo de compilación; solo `owner/name` es configurable
(`OMCPA_OMC_REPO`, `OMCPA_CPA_REPO`) y se valida por su formato antes de su uso. El
proceso sigue `HTTP_PROXY`/`HTTPS_PROXY`, coincidiendo con la sincronización de precios, ya que ambas son
lecturas de un endpoint público fijo.

**La demostración responde a partir de un archivo fixture y no realiza ninguna solicitud saliente.** La
demostración compila el servicio de producción solo con su fuente de canal de noticias intercambiada, por lo que la página
demuestra la comparación real y el registro combinado real, y sus rutas de lanzamiento son
rechazadas por la tabla de directivas de demostración (`internal/api/demo_policy.go`).

## Consecuencias

- La consola ahora puede estar equivocada de una manera visible en la que antes no podía estarlo: puede decir "No
  puedo determinar si estás actualizado". Esa es la compensación intencionada; el comportamiento
- anterior afirmaba la vigencia sin ninguna evidencia.
- Un reinicio cuesta una solicitud incondicional por producto, porque los validadores se
- descartan junto con los cuerpos que describían.
- Sesenta solicitudes sin autenticar por hora y dirección es el límite real. Una comprobación cuesta una
  solicitud por producto y una segunda solo cuando la primera página de un canal está llena, y el umbral mínimo limita
  con qué frecuencia puede suceder eso: como mucho un puñado de comprobaciones por hora, por lo que el presupuesto se comparte con
  lo que sea que el operador ejecute en lugar de ser consumido por las visitas a las páginas. Si aun así se alcanza,
  la página mantiene el índice anterior, indica la hora de restablecimiento y no presenta silenciosamente datos
  obsoletos como actuales.
- El propio registro de cambios de la consola permanece vacío hasta que el proyecto publique lanzamientos. La
  página indica esto en lugar de ocultar la tarjeta, y no se añadió automatización de lanzamientos.
- Las notas no están disponibles después de un reinicio hasta la siguiente comprobación exitosa. Almacenarlas
  se consideró y se rechazó: introduciría texto de terceros, arbitrariamente grande y no confiable,
  en la base de datos que contiene el registro de auditoría, para una página cuya otra mitad funciona
  sin él.

## Alternativas consideradas

- **Almacenar notas en SQLite.** Rechazado por el motivo anterior; la división ahora es visible en
  la interfaz de usuario, lo que hace que la opción más simple sea defendible.
- **Limitar (throttle) la comprobación manual.** Rechazado al principio por la elección explícita del operador de una
  comprobación sin limitar con la consecuencia de cuota indicada. Esa elección fue luego revertida por
  medición en lugar de por argumento: el presupuesto horario de sesenta solicitudes se agotó en
  la práctica, debido a cargas de página de hasta dos solicitudes por producto, y la consola informó el
  límite agotado en lugar de una versión. El umbral mínimo que lo reemplazó mantiene honesto el
  comportamiento visible en lugar de ocultar el cambio; una llamada dentro del umbral sigue respondiendo, e
  informa que la respuesta provino del almacén.
- **Descartar cuerpos y volver a obtenerlos por lanzamiento.** Rechazado tras comprobar la API: la
  respuesta de la lista ya incluye los cuerpos, por lo que descartarlos cuesta solicitudes adicionales en
  lugar de menos.
- **Leer solo `/latest-version` de CPA y omitir GitHub para el gateway.** Rechazado
  porque ese endpoint informa de un número de versión y ningún registro de cambios, que es toda la
  característica.
