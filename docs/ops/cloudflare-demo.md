# La demostración pública (Cloudflare Workers)

La demostración al inicio del README es la consola ordinaria servida como recursos
estáticos, cuya API es respondida por un Worker a partir de un conjunto de datos generado
desde los controladores reales de Go. No es un segundo frontend: el paquete es el que
el binario de Go incrusta, y lo único que difiere es el origen de sus respuestas.

Existe para mostrar la consola. No ejecuta el producto — no hay pasarela, no hay base
de datos, no hay canal de captura ni autenticación detrás — y
[ADR 0021](../adr/0021-the-public-demonstration-is-generated-data-behind-the-real-console.md)
registra por qué se adoptó esa decisión y qué implica.

## Qué está desplegado

| Pieza | Dónde | Qué es |
| --- | --- | --- |
| Consola | Cloudflare Static Assets, desde `tmp/cloudflare-demo/assets` | La SPA compilada, con la configuración de tiempo de ejecución de la demostración inyectada y sus URLs de recursos relativas a la raíz |
| API | `deploy/cloudflare/worker.mjs` | Lee el conjunto de datos, reubica sus marcas temporales y responde; rechaza todo lo que saldría de la demostración |
| Datos | `deploy/cloudflare/data/responses.json` | Respuestas capturadas generadas a partir de los controladores reales |
| Enrutamiento | `deploy/cloudflare/routes.mjs` | Qué solicitud es respondida por cuál respuesta capturada |
| Tiempo | `deploy/cloudflare/time.mjs` | Traslada el historial capturado al reloj del espectador |
| Tráfico en vivo | `deploy/cloudflare/liveRouting.mjs` | Tráfico simulado de pasarela que responde a la lectura de enrutamiento en vivo y alimenta el stream de uso en vivo |
| Filtros | `deploy/cloudflare/filters.mjs` | Aplica reglas de categoría, resultado, búsqueda y plegado de la pista de auditoría, y la posición `after` del registro de servicio a la única página capturada, permitiendo que esos filtros funcionen en la demo |

Las solicitudes a un recurso estático nunca invocan al Worker; las solicitudes bajo `/api` siempre lo hacen.
`wrangler.jsonc` configura ambos, y `run_worker_first` nombra `/api` explícitamente en lugar
de depender de un patrón que pudiera coincidir también con una ruta de la consola.

## El conjunto de datos es generado, nunca escrito a mano

```bash
pnpm demo:generate          # regenerar y revisar el diff
pnpm demo:generate --check  # falla cuando la copia comprometida está desactualizada
pnpm check:demo             # cobertura, frescura y privacidad
```

`internal/api/demo_export_test.go` inicia el controlador real sobre un repositorio poblado con datos de prueba
y el fixture de la demo, ejecuta cada lectura que la consola realiza y escribe lo que se devuelve. El
valor de generar en lugar de escribir a mano es que cada respuesta pasa por la misma proyección
de DTO que produce una instalación autoalojada, evitando que la demostración muestre una estructura
que el producto nunca emite. La respuesta de Model Square captura IDs anunciados por CPA, procedencia de enrutamiento segura y
hechos de referencia de models.dev empaquetados. Su ruta de Worker mapea a la entrada generada
`model-square` del dataset; `scripts/demo-inputs.mjs` incluye la instantánea de metadatos para que las actualizaciones invaliden
la captura. Los enlaces externos de consulta de modelos son navegación explícita, no reenvío del Worker.
La sesión del Agente capturada es el mismo DTO de la consola:
excluye historial privado del modelo, llamadas en cola del modelo y resultados sin procesar de consultas a bases de datos.

La exportación es reproducible: dos ejecuciones sobre código sin cambios son idénticas byte a byte, en cualquier
máquina y en cualquier momento. Eso es lo que hace que `--check` sea significativo: los siguientes
invariantes deben cumplirse estrictamente y no de forma aproximada.

- **La ventana es cerrada, sobre un instante fijo en el pasado.** Un `preset` se resuelve contra
  el reloj de pared, por lo que dos exportaciones con un minuto de diferencia no coincidirían; y el servidor limita un
  final solicitado al reloj, por lo que un instante en el futuro tampoco sería fijo.
- **Solo se desplazan los instantes que el controlador estampa al responder.** El historial inicial
  está anclado en la referencia y ya es determinista. Una versión anterior desplazaba
  todo según un delta dependiente de la ejecución, lo que hacía que dos exportaciones de historial idéntico difirieran
  por exactamente un minuto.
- **Los valores medidos desde el proceso se declaran como constantes.** Latencia, memoria de montón (heap),
  goroutines, el puerto efímero del fixture y el nombre de un archivo de registro de errores estampado al
  solicitar el listado describen la máquina, no la demostración. Una página pública no debe
  presentarlos como si describieran el servicio que el visitante está observando.
- **Los datos del host están fijados, y un instante no establecido permanece sin establecer.** La versión de Go y la
  plataforma del entorno de ejecución describen la máquina en la que se ejecutó la exportación, por lo que el conjunto de datos declara en su lugar
  la cadena de herramientas fijada en `scripts/tools-versions.json` y la plataforma de la imagen de versión.
  Un instante cero significa "nunca" y no se desplaza, ni por la exportación ni por el Worker.
  `TestDemoExportRebaseIsIndependentOfTheExportClock` exporta el mismo cuerpo en dos
  momentos de reloj diferentes y exige una salida idéntica.
- **Los inicios de procesos comparten una antigüedad sintética fija.** Lecturas `started_at_ms` no nulas en
  el tiempo de ejecución del sistema y registros de servicio utilizan el instante dos horas anterior a la referencia.
  El Worker preserva esa antigüedad al reubicar en el tiempo, de modo que ambas páginas coinciden y nunca muestran un
  inicio futuro. Tareas de mantenimiento no iniciadas conservan cero. `TestDemoExportStartTimesUseReferenceClock`
  cubre diferentes relojes de exportación, ambos modos de decodificación numérica de JSON y propiedades de esquema.

## Por qué no se desactualiza

La consola solicita una ventana por su nombre — `preset=24h` — y la respuesta capturada describe
una ventana que terminó cuando se generó el conjunto de datos. Servida sin cambios, el gráfico más reciente
quedaría plano en un día. Cada respuesta se reubica temporalmente sobre el reloj del espectador
al ser servida, mediante un único delta por respuesta, de modo que los límites de una ventana, sus cubos, el
`as_of_ms` de su cola y las filas de eventos dentro de ella sigan describiendo un período coherente.

Los instantes se reconocen por su nombre de campo — `*_at_ms`, la convención que este repositorio ya
utiliza — y los instantes de texto solo cuando la cadena completa es un instante RFC 3339. Esa segunda
regla no es un capricho: `Date.parse` interpreta `claude-haiku-4-5` como el 4 de mayo y `gpt-5`
como una fecha en 2001, por lo que un analizador permisivo reescribía el catálogo de modelos asignando nombres de fechas.

Los dos desplazamientos se componen, por lo que la exportación debe dejar el conjunto de datos en **un solo** marco temporal primero:
el del origen de datos. Por lo tanto, solo mueve los instantes que fueron estampados desde el reloj de pared mientras
respondía, y deja intactos los que ya están anclados — límites de ventana, marcas de tiempo de cubos,
la cuadrícula de días del mapa de calor. Un campo cuyo nombre por sí solo no pueda decidirlo
requiere que la exportación analice la estructura de la respuesta: el `live.as_of_ms` de la cola del
tablero es el propio fin de la ventana y no una estampa de tiempo, por lo que se escribe desde
`window.to` tras el desplazamiento. Desplazarlo como una estampa de tiempo lo alejaría un delta completo
de reloj de la ventana a la que pertenece, y dado que la consola trata una marca anterior a su
ventana como una respuesta desactualizada (`applyTail`), cada cola en la demostración servida era
descartada. `internal/api/demo_export_test.go` asegura ese par en el conjunto de datos exportado,
evitando fallos silenciosos.

## El panel de enrutamiento en vivo opera con tráfico simulado

El rebasado temporal mantiene un informe al día, pero el panel de enrutamiento en vivo del tablero no es un informe:
reproduce una solicitud cuando una lectura devuelve un registro más nuevo que el último que contiene, y una
captura rebasada temporalmente en cada lectura nunca tiene uno. Por lo tanto, `GET /usage/routing` y
`GET /usage/live` son las dos lecturas que el Worker compone en lugar de servir desde el conjunto de datos.

`liveRouting.mjs` es una pequeña pasarela siempre ocupada. Su tráfico es una función pura
del reloj de pared — la solicitud de cada intervalo de 500 ms proviene de un generador inicializado con el
número del intervalo — de modo que cada lectura de un instante coincide, y el cursor `after` de la consola y su
minuto móvil funcionan contra él igual que contra CPA. Invoca `claude-opus-5.5`,
`gpt-6-astra` y `deepseek-v4.1-flash` mediante cinco credenciales que el resto del conjunto de datos
ya lista (`auth-claude-01`, `auth-codex-01`/`02`, `auth-ds-01`/`02`), a aproximadamente una
solicitud por segundo con varias en vuelo. Ocasionalmente, un error de upstream traslada una solicitud
a la credencial hermana, y cada dos minutos y medio una credencial alcanza un límite de tasa
y reposa durante 28 segundos mientras su hermana asume el tráfico. Los IDs de registro comienzan con
el instante en que finalizó un intento, que es el orden en que CPA los almacena; las identidades de claves
de los invocadores se toman de la lectura de enrutamiento capturada para que coincidan con la tabla de claves.

El stream en vivo estructura sus señales como lo hace la pasarela — `ready`, luego `usage` cuando se
registra un intento, como máximo uno cada 250 ms — y finaliza tras dos minutos, cuando el navegador
se reconecta. La entrada `usage-live` capturada permanece como la respuesta propia en modo demostración
de la pasarela (204); el Worker no la sirve.

## Mantenerlo actualizado es una barrera, no un hábito

El conjunto de datos describe la API, por lo que una estructura de respuesta modificada deja desfasada la copia servida
sin que nadie lo note: la página se renderiza mostrando lo que la API devolvía el mes anterior.

`pnpm check:demo` falla si ocurre cualquiera de las siguientes situaciones (y `pnpm test:self` lo ejecuta):

- una ruta de consola no tiene lecturas declaradas, evitando que se añada una página nueva sin una entrada en el dataset;
- una lectura declarada no tiene respuesta capturada;
- un archivo del que se deriva el conjunto de datos ha cambiado desde que se generó;
- el conjunto de datos contiene un identificador de operador, un formato de credencial o un nombre de host de despliegue.
  El conjunto de datos es descargable públicamente, por lo que esto constituiría una filtración y no un defecto menor.

`scripts/check-demo.test.ts` cubre la barrera misma, asegurando su capacidad de fallo ante discrepancias.

**Al modificar una página de la consola o la estructura de su API:** regenere con
`pnpm demo:generate`, revise el diff — es donde se aprecian los cambios estructurales — y confirme
los datos con el cambio. `pnpm verify:demo` luego ejecuta cada ruta en un navegador real.

## Verificación

```bash
pnpm test:demo              # enrutamiento, rebasado temporal y privacidad del Worker, en Node
pnpm check:demo             # el conjunto de datos está actualizado y completo
pnpm verify:demo            # cada ruta de la consola se renderiza sin errores de API ni de consola
SHELLPAMC_DEMO_URL=https://<host> pnpm verify:demo   # lo mismo contra un despliegue real
pnpm verify:demo:go         # el modo de demostración propio del binario Go, aún admitido
```

`verify:demo` es deliberadamente una comprobación de navegador en lugar de una serie de pruebas unitarias. Tres
defectos en este Worker eran invisibles a pruebas unitarias y evidentes en una ejecución de navegador: el
endpoint de sesión ubicado fuera de `/api/v1`, que enviaba cada página a la tarjeta de login; la
corrupción de nombres de modelos explicada anteriormente; y una lista de eventos capturada sin ventana, que se renderizaba
como "sin registros de solicitudes". Sin una URL remota, la comprobación monta la compilación de producción existente y sirve el
controlador real del Worker en el proceso. Cada navegación registra sus lecturas iniciales requeridas
antes de cargar, espera la finalización exitosa del cuerpo de respuesta y comprueba el encabezado real
de la página y el contenido visible (incluido el directorio de capacidades del agente).
Estados de carga visibles, lecturas faltantes, fallos de API/transporte y errores de consola fallan la ejecución.
No hay esperas fijas por página ni espera global de red inactiva; sondeos continuos no
bloquean la finalización. Se imprimen los tiempos por ruta y la limpieza de navegador/servidor se ejecuta tanto
en caso de fallo como de éxito.

## Despliegue

Shell-PAMC no tiene una demostración pública activa todavía. `wrangler.jsonc` no declara rutas, por lo que un despliegue no publica nada en ningún dominio hasta que el operador agregue un dominio personalizado bajo `routes`.
La ruta `workers.dev` está desactivada en `wrangler.jsonc` a propósito: ese subdominio es
a nivel de cuenta y se deriva de la identidad de la cuenta, por lo que dejarlo activo publicaría la
demostración en una dirección que contiene información personal. Ambos ajustes se declaran en la
configuración en lugar de configurarse manualmente en la consola, lo que garantiza que un despliegue desde una copia limpia
reproduzca el estado previsto sin reactivar silenciosamente la dirección deshabilitada.

La demostración se despliega desde `master` mediante la integración Git de Cloudflare (Workers
Builds), que compila y despliega en cada push. **No se requiere ningún secreto en el repositorio**: Cloudflare
genera y gestiona el token de API de la compilación, lo que resultó preferible a un despliegue en
GitHub Actions con credenciales de larga duración.

Configuración inicial única en la consola de Cloudflare:

1. Instale la integración de GitHub de Cloudflare y otorgue acceso exclusivamente a este repositorio.
2. Cree el Worker `shell-pamc-demo`, conéctelo a este repositorio y configure la rama de
   producción en `master`.
3. **Desactive las compilaciones de vista previa (preview builds)**, de modo que un pull request no despliegue nada. Desmarque **Enable
   Preview Builds** en Settings → Build → Branch control.

   El campo **Preview command** es exigido por el formulario incluso con la casilla desmarcada, y
   la documentación aclara que el comando solo se ejecuta cuando la casilla está activa.
   Por lo tanto, el valor queda inerte; utilice un texto descriptivo en lugar del predeterminado:

   ```
   echo "Preview builds are disabled for this Worker; it deploys from master only."
   ```

   Las URLs de vista previa están protegidas adicionalmente por `workers_dev: false`, que las deshabilita por
   defecto. Verificado en el Worker desplegado: una URL de vista previa con el formato
   `<prefijo-version>-shell-pamc-demo.<subdominio-cuenta>.workers.dev` responde 404.
4. Establezca el comando de compilación en `pnpm build && pnpm check:demo && pnpm build:demo`, y el comando de despliegue
   en `pnpm exec wrangler deploy --config deploy/cloudflare/wrangler.jsonc`.

   `pnpm build` es la parte fundamental que no debe omitirse: la consola compilada está
   en el gitignore, por lo que en una copia limpia `internal/web/dist/` contiene únicamente su `.gitkeep`.
   `build:demo` prepara lo que produjo `pnpm build` en lugar de compilarlo, y sin el
   primer comando se detiene indicando "no built console".

   La compilación web define su propia memoria de montón de Node (`--max-old-space-size=4096` en
   `web/package.json`) debido a que Node calcula el valor predeterminado según la memoria de la máquina.
   Fijarlo en el script garantiza límites homogéneos entre Cloudflare, CI y compilaciones locales.

   `pnpm install` no forma parte del comando porque Workers Builds instala dependencias automáticamente,
   utilizando el campo `packageManager` y el `.nvmrc` fijados por el repositorio.

La compilación se ejecuta exclusivamente en Node. El conjunto de datos está confirmado en Git, por lo que Cloudflare nunca necesita Go,
navegadores ni bases de datos; la generación y verificación ocurren en desarrollo y en
las comprobaciones de GitHub.

**Rollback:** Cloudflare conserva versiones anteriores, y revertir restaura el Worker y
sus recursos juntos. El cambio correspondiente debe revertirse también en `master`,
o el siguiente push volverá a desplegarlo. No hay base de datos que revertir.

## Qué rechaza la demostración

Todo lo que saldría de ella: flujos de inicio de sesión, movimiento de credenciales, ejecución de plugins,
escrituras de configuración en la pasarela y consumo de cuotas. `worker.mjs` rechaza directamente cualquier petición
que no sea de lectura bajo `/api`, y las cuatro lecturas sensibles por ruta — descarga de credenciales, registro de
solicitudes y paquete de diagnósticos — antes de consultar el conjunto de datos.

Rutas de API desconocidas responden un 404 estructurado en lugar de un éxito vacío, evitando que una ruta
no contemplada renderice una página mostrando cifras pertenecientes a otra sección.

## La presencia de un script de terceros en la página es esperada

Cloudflare inyecta su baliza de Real User Measurement (`static.cloudflareinsights.com`)
en el HTML de este plan, por lo que un navegador que abre la demostración solicita ese origen.
No reside en este repositorio ni en la salida de compilación — el origen devuelve HTML
sin ella y el borde de red la añade.

Fue aceptado con conocimiento de causa. La garantía requerida concierne al código propio, y
sigue cumpliéndose: el Worker responde desde el conjunto de datos y no reenvía nada, por lo que ningún proveedor es
contactado jamás. Suprimir la baliza es posible mediante encabezados, pero se decidió no hacerlo. ADR 0021 registra la decisión.

## Resolución de problemas

**Una página se renderiza pero su panel aparece vacío.** Su lectura no tiene entrada en el conjunto de datos o la entrada
se capturó sin la ventana solicitada. `pnpm check:demo` indica la ruta; la solución consiste en agregar un caso de exportación en
`internal/api/demo_export_test.go` y regenerar.

**Las fechas se ven desactualizadas.** El rebasado temporal no está alcanzando un campo. Añada el nombre a las
reglas de instantes en `time.mjs` respetando la convención `*_at_ms`.

**`pnpm demo:generate --check` falla inmediatamente tras una fusión.** Alguien modificó un archivo
del cual se deriva el dataset. Regenere, revise el diff y confirme los datos con el cambio.

**El servidor local no inicia.** Elimine `deploy/cloudflare/.wrangler` y ejecute `pnpm install` nuevamente.

## Datos y reproducción de capacidades del agente

La ruta `/agent` se distribuye en la demostración como la página real sobre datos generados: el
catálogo de capacidades y la sesión vacía del Agente se exportan desde los controladores reales
(`/api/v1/capabilities`, `/api/v1/agent/session`), permitiendo al visitante ver las capacidades
declaradas, sus permisos y descripciones. El Worker rechaza invocaciones de capacidades, reinicio de sesión,
ejecuciones del Agente, decisiones de operaciones, envío de secretos e inicio de OAuth.
El navegador ofrece un ejemplo grabado curado (ADR 0092), procesado a través de los reductores
de producción sin realizar solicitudes al modelo ni ejecutar capacidades.

## Directorio de modelos del agente

El directorio de modelos del Agente se genera desde el fixture de CPA en loopback a través de la
fachada real de Shell-PAMC. El Worker mapea `/api/v1/agent/models` a la respuesta generada del directorio de modelos.
La ruta de consola `/agent` está incluida tanto en la cobertura de demo como en la aceptación del navegador.

Las inferencias son rechazadas por la política de rutas en Go y la barrera de no-lectura del Worker.
La interfaz ofrece un ejemplo grabado localmente en el navegador en modo demo.

### Fixture de proveedores de precios

La respuesta generada de precios incluye la misma instantánea no confidencial de membresía de proveedores que la aplicación Go: IDs de proveedores de claves API configurados, proveedores OAuth activos agrupados, etiquetas de canales, prioridades y membresías exactas de modelos. `internal/demo/seed.go` la deriva de los catálogos del fixture.

### Metadatos de zona horaria

La respuesta generada de preferencias incluye `time_zone` con los nombres de zona horaria del despliegue, anulación y efectiva. La generación del dataset fija `TZ=UTC` para que los metadatos capturados no dependan de la máquina del desarrollador.

### Ejemplos de capacidad de cuota

El conjunto de datos generado incluye observaciones normalizadas reales para Codex, Claude y un grupo permitido de Antigravity Gemini mediante `internal/demo/quota.go`. Una segunda credencial de Codex cuenta con una lectura baja de 5 horas y una observación del ciclo previo adyacente, permitiendo que los controladores reales muestren una referencia histórica de capacidad.

### Dataset de reglas de modelos OAuth

La tarea Reglas de modelos del espacio de trabajo OAuth lee mapas de alias y exclusiones para todo el proveedor más un catálogo estático de modelos por proveedor. El dataset exporta estos elementos como `auth-files-model-aliases`, `auth-files-excluded-models` y entradas del catálogo de proveedores; las rutas del Worker resuelven solo los catálogos exportados y rechazan escrituras de reglas duraderas.

### Cobertura de proyecciones de administración de CPAMC

Las respuestas generadas incluyen políticas en tiempo de ejecución de proveedores y opciones avanzadas de modelos, la declaración del proveedor de inicio de sesión `kimi-ai`, metadatos de capacidad de renovación de credenciales y muestras de registros de pasarela con métodos y rutas HTTP.

### Fixtures de observación de suscripciones

El fixture en proceso responde a los endpoints fijos de usuario/ajustes, créditos y libro mayor de xAI y Code Assist de Antigravity junto con sus endpoints de uso.

### Rutas nativas del host de plugins

La política de la demo rechaza por completo el host de plugins autenticado, incluyendo lecturas/escrituras de administración nativas v0/v8, HEAD de administración y la lectura fija del directorio de modelos (ADR 0067).

## Conversaciones grabadas de ejemplo y actividad anual

`web/src/demo/agentRecording.json` se distribuye como un recurso del navegador,
no como endpoints de mutación del Worker. La grabación del Agente utiliza marcadores de posición de fechas relativas y
prosa localizada; la reproducción emite tramas AG-UI, razonamiento, recibos de capacidades, argumentos de interfaz transmitidos
y la conversación final. Se acepta únicamente la pregunta de ejemplo provista. No se requiere modelo, petición a CPA ni
credencial de proveedor.
