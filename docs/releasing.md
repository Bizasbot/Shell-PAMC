# Publicación de versiones

La distribución estable es **`ghcr.io/bizasbot/shell-pamc`** en GitHub Container Registry, para
`linux/amd64` y `linux/arm64`. Los GitHub Releases en `Bizasbot/Shell-PAMC` son la
fuente de versión/actualización de la consola y contienen ejecutables nativos y recursos de instalación. Un tag de Git
por sí solo no es una versión publicada y no es descubierto por las verificaciones de actualización.

## Recursos nativos

Cada versión publica ocho ejecutables que coinciden con la cobertura de SO/arquitectura de CPA:

| SO | Arquitecturas Go | Archivo |
| --- | --- | --- |
| Darwin (macOS) | amd64, arm64 | tar.gz |
| Windows | amd64, arm64 | zip |
| Linux | amd64, arm64 | tar.gz |
| FreeBSD | amd64, arm64 | tar.gz |

Los nombres siguen el formato `shell-pamc_VERSION_SO_ARCH.tar.gz` (Windows usa `.zip`), con la
versión numérica sin la `v`. Cada archivo contiene el ejecutable (`shell-pamc.exe`
en Windows), la licencia MIT, ambos READMEs, guías de instalación/operaciones/SQLite y `.env.example` desde
`deploy/native.env.example`. No se incluyen secretos ni datos de tiempo de ejecución. `checksums.txt`
contiene los hashes SHA-256 de los ocho archivos y los tres adjuntos de instalación de Compose/CPA; no se aplica hash a sí mismo.

La matriz está fijada en `scripts/native-release.mjs`, no se descarga durante las compilaciones.
Fue verificada el 6 de octubre de 2026 contra el flujo de trabajo de versión oficial de CPA en el commit
`a2976eb8a303f11b4ea5177bce9f9ff752634dfc` y los recursos v8.0.16. El código fuente actual de CPA
utiliza su flujo de trabajo de publicación en lugar de GoReleaser. Su etiqueta de recurso `aarch64`
significa `arm64` de Go; sus variantes adicionales de plugins de Linux no son objetivos de Shell-PAMC. Todas las compilaciones
de Shell-PAMC usan `CGO_ENABLED=0` con modernc SQLite e incrustan la base de datos de zonas horarias IANA
mediante `-tags timetzdata`. Los certificados raíz del SO siguen siendo necesarios para HTTPS.
Los ejecutables de Darwin y Windows no están firmados ni notarizados.

Los compiladores de paquetes nativos no restauran cachés compartidos de Actions para el almacén de pnpm o módulos/salidas de compilación de Go. Las dependencias se instalan desde el archivo de bloqueo congelado y los binarios se compilan en el trabajo de versión limpio, por lo que las salidas en caché de otro flujo de trabajo no pueden convertirse en entradas de publicación.

La canalización de versiones existente sigue siendo la autoridad de publicación (ADR 0066). Para compilar
e inspeccionar los mismos recursos localmente en Linux, instale las cadenas de herramientas fijadas de Node,
pnpm y Go del repositorio, además de GNU tar, zip y unzip, y luego ejecute:

```bash
pnpm install --frozen-lockfile
RELEASE_TAG=v$(node -p 'require("./package.json").version') node scripts/native-release.mjs
RELEASE_TAG=v$(node -p 'require("./package.json").version') node scripts/native-release-smoke.mjs
```

El compilador valida ambas versiones de paquetes, compila/sincroniza la SPA una vez antes de
los objetivos de Go, verifica los metadatos reales de compilación de Go, empaqueta todos los objetivos en
`tmp/native-release` y valida el manifiesto completo de sumas de comprobación. Las marcas de tiempo de los
miembros del archivo usan la fecha del commit de origen; los propietarios de tar se normalizan y zip elimina
metadatos adicionales. La creación de GNU tar usa `--force-local`, por lo que las rutas de archivo con letra
de unidad se tratan como archivos locales en lugar de hosts remotos. Un directorio de salida limpio
evita que recursos obsoletos entren en un reintento.
La comprobación de humo extrae el archivo de Linux de la arquitectura host en un nuevo directorio
y verifica SQLite, inicio de sesión, `/shell-pamc`, rutas base raíz y anidadas, JavaScript incrustado y
la etiqueta en ejecución. Los objetivos externos se compilan de forma cruzada, no se ejecutan en Linux.

## Configuración única

El flujo de trabajo inicia sesión en `ghcr.io` con el `GITHUB_TOKEN` con alcance del repositorio; solo los
trabajos `publish` y `promote` tienen `packages: write`, y solo el trabajo `release` tiene
`contents: write`. No se requiere ningún secreto de registro ni token personal. Después de la primera
publicación, configure la visibilidad del paquete `shell-pamc` como pública en los ajustes de paquetes de GitHub
y vincúlelo al repositorio, de modo que una instalación pueda descargarlo sin iniciar sesión.
Habilite Actions en el repositorio. Restrinja la creación/movimiento de tags de versión a mantenedores
de confianza con reglas de repositorio; un tag de versión es una autoridad de publicación.

Las actualizaciones de la consola verifican cada versión contra una firma (ADR 0099). Genere el par
de claves una vez, en una máquina de confianza:

```bash
node scripts/sign-release-manifest.mjs --generate-key release-signing-key.txt
gh secret set RELEASE_SIGNING_KEY --repo Bizasbot/Shell-PAMC < release-signing-key.txt
```

El comando escribe la clave privada en el archivo indicado y la clave pública en
`internal/updater/release_public_key.txt`. Realice commit del archivo de clave pública, almacene el archivo
de clave privada fuera de línea y elimínelo del directorio de trabajo; es la única copia
además del secreto de Actions, que no se puede volver a leer. El trabajo de versión falla en su
paso de firma cuando falta el secreto o no coincide con la clave pública confirmada, por lo que
nunca se puede publicar una versión sin firmar. Reemplazar el par de claves significa que las instalaciones
que ejecutan una versión compilada con la clave pública antigua rechazarán manifiestos más nuevos y deberán
actualizarse a mano una vez.

## Contrato de versiones

- Los tags estables son **`vMAJOR.MINOR.PATCH`**, sin ceros iniciales ni sufijos. El tag
  debe coincidir con las versiones de `package.json` raíz y `web/package.json`.
- `scripts/release-plan.mjs` valida la identidad antes de compilar. Se rechazan los tags
  de pre-lanzamiento, desarrollo o malformados; el servicio de actualización intencionalmente no
  afirma vigencia estable para esas versiones (ADR 0019).
- Una versión incrusta su tag exacto en `internal/config.BuildVersion` con el enlazador de Go.
  La configuración, el endpoint de salud, la configuración de tiempo de ejecución de la SPA,
  Información del Sistema y el User-Agent predeterminado saliente utilizan ese valor. `SHELLPAMC_VERSION`
  sigue siendo una anulación del operador; los archivos Compose no anulan la versión incrustada.
- Los alias de versión de Docker son `v0.3.9` y `0.3.9`; `latest` avanza solo para la
  versión estable numéricamente más reciente. Un backport nunca mueve hacia atrás ni `latest`
  de Docker ni el puntero latest de GitHub. Compose usa por defecto `latest` para Shell-PAMC y CPA.
  Los operadores pueden anular `SHELLPAMC_IMAGE` y `CPA_IMAGE` con una versión o resumen probado para actualizaciones controladas.
- Publique una nueva versión ante cambios en el contenido de la aplicación. No mueva un tag publicado
  ni reconstruya intencionalmente su identidad con código fuente diferente.

## Preparar y publicar

Los cambios específicos de cada versión y las notas de actualización se mantienen bajo `docs/releases/`; consulte
las [notas de la versión v0.3.9](releases/v0.3.9.md).

1. Modifique ambas versiones de paquetes juntas y documente los cambios visibles para el usuario. Las
   guías de instalación descargan desde `releases/latest/download/` y Compose usa por defecto la
   imagen `latest`, por lo que ninguno necesita incremento de versión. Mantenga consistentes los metadatos
   del archivo de bloqueo si una actualización de paquete lo requiere.
2. Ejecute `pnpm test:fast`, `pnpm verify` y `pnpm check:ui`; ejecute `pnpm verify:full`
   para cambios de compilación/flujo de trabajo. Revise secretos y cambios, luego fusione a través de
   las verificaciones normales de pull-request protegidas. Titule el pull request
   `chore(release): prepare vX.Y.Z`: `.coderabbit.yaml` omite la revisión automatizada
   para ese prefijo, porque los cambios descritos por la versión ya fueron revisados al fusionarse.
3. Desde una copia limpia del commit verificado y fusionado, cree y envíe el tag:

   ```bash
   git switch master
   git pull --ff-only
   test -z "$(git status --porcelain)"
   git tag -a v0.3.9 -m "Shell-PAMC v0.3.9"
   git push origin v0.3.9
   ```

4. Siga `.github/workflows/release.yml` en Actions:
   - **identity** valida la identidad del tag/paquete y resuelve el commit exacto de origen.
   - **static**, **browser** y **probes** verifican ese commit en paralelo: barreras estáticas/de secretos
     completas, barreras de SPA/navegador/harness/demo compiladas y el catálogo completo de sondeos
     en tres fragmentos equilibrados. La limpieza del estado generado sigue siendo obligatoria.
   - **verify** es el agregado final y solo acepta el éxito de cada línea;
     el fallo, la cancelación o los prerrequisitos omitidos impiden la publicación.
   - **publish** compila una imagen nativa y ejecuta `scripts/docker-smoke.mjs` para verificar
     el paquete real sin permisos de root y de solo lectura, permisos de SQLite, rutas base canónicas,
     endpoints de salud, inicio de sesión y versión, y que `updater install` cree un actualizador protegido
     al que la consola llegue sin ajustes en ningún lado. Luego compila y envía la imagen amd64/arm64
     con procedencia y SBOM a GitHub Container Registry.
   - **native** se ejecuta tras la verificación, compila los ocho archivos y el manifiesto de sumas de comprobación,
     prueba el paquete extraído de Linux, comprueba el estado generado limpio y transfiere el directorio
     completo de recursos con acciones de subida/descarga fijadas. Extrae la revisión verificada inmutable
     y se ejecuta junto a **publish**, sin permisos de escritura en el repositorio.
   - **release** se ejecuta solo después del empaquetado nativo y un push exitoso de Docker,
     revalida los recursos descargados contra sus sumas de comprobación y matriz esperada, luego
     firma `release-manifest.json` para el resumen enviado (`release-manifest.json.sig`; ninguno de los archivos
     figura en `checksums.txt`, ya que la firma es su verificación) y prepara nuevos GitHub Releases como borradores
     con notas generadas, el resumen multiplataforma y todos los recursos. Solo después de que cada archivo adjunto
     tenga éxito, vuelve a comprobar la política de latest y publica el borrador. Las versiones existentes
     reciben recursos de reemplazo verificados a través de la misma ruta reanudable.
   - **promote** vuelve a comprobar el índice estable publicado y mueve `latest` de Docker al
     resumen inmutable subido solo si no existe una versión estable más reciente.
5. Verifique el manifiesto y los recursos públicos, descargue la imagen en la plataforma deseada
   y compruebe la versión en ejecución de una nueva instalación y la verificación de actualización de Información del Sistema.

El Dockerfile compila Node y Go en la arquitectura nativa del compilador y realiza compilación cruzada
del objetivo de Go. Los archivos de certificados/zonas horarias/cuentas independientes de la arquitectura
se preparan de forma nativa, mientras que la base final de Alpine proporciona utilidades de shell nativas
del objetivo. No se requiere registro de emulador privilegiado. Ambos objetivos deben compilarse;
la prueba de humo de la imagen empaquetada nativa complementa la aceptación del navegador compilado del producto.

## Verificación y recuperación

```bash
gh run list --workflow release.yml --repo Bizasbot/Shell-PAMC
docker buildx imagetools inspect ghcr.io/bizasbot/shell-pamc:v0.3.9
gh release view v0.3.9 --repo Bizasbot/Shell-PAMC
```

Los flujos de trabajo usan un grupo de concurrencia serializado `queue: max`: las versiones pendientes
se ponen en cola en lugar de reemplazarse entre sí, y las versiones en ejecución no se cancelan por tags más nuevos.
GitHub limita esta cola a 100 ejecuciones pendientes; más allá de eso, se cancelan las nuevas ejecuciones.
Una verificación fallida no puede hacer push ni empaquetar; un push de imagen o empaquetado nativo fallido no puede
publicar un GitHub Release. Si el paso final de release falla después de la subida de la imagen, reintente
el trabajo fallido, no una versión no relacionada.
Las nuevas versiones permanecen como borradores si falla la subida de un adjunto; las verificaciones de actualización
las ignoran. La promoción de `latest` de Docker sigue a la publicación en GitHub; si falla la promoción,
las descargas versionadas siguen funcionando y solo ese trabajo necesita reintento.
`workflow_dispatch` también acepta un tag verificado existente para recuperación. El trabajo de identidad
resuelve ese tag; los consumidores de verificación y publicación extraen su revisión resuelta,
no la rama de envío. La revisión de la imagen nombra ese commit verificado.
Las decisiones de latest se reevalúan en la publicación/promoción, por lo que reintentar una ejecución antigua
después de una versión más nueva no puede degradar los punteros de latest. Volver a ejecutar el paso de recursos
de release verifica y reemplaza todos los adjuntos nativos y de instalación para el mismo código fuente
sin crear una versión duplicada. No elimine ni vuelva a crear un tag de versión para solucionar una barrera fallida.

## Verificaciones de actualización tras publicar

La consola lee metadatos de versiones estables de `api.github.com`, no de tags del registro.
Ordena numéricamente las versiones comparables, ignora borradores y pre-lanzamientos, distingue
resultados más nuevos/iguales/adelantados/indeterminados y conserva su último índice exitoso ante una
solicitud fallida. Su límite mínimo de 15 minutos entre intentos por producto, barrido de seis horas,
interruptores sin conexión, tiempo de vida de ETag/cuerpo y restricciones de origen no se modifican. Una instalación
puede mostrar resultados en caché hasta que transcurra el tiempo mínimo; no lo omita para hacer que una
comprobación inmediata posterior a la publicación parezca reciente. Consulte `docs/operations.md` y ADR 0019.

Las acciones de release usan revisiones de commit upstream inmutables, y las credenciales de checkout
no persisten. Los comandos de release de GitHub reciben su token con alcance de trabajo explícitamente.

Los ejecutores de verificación de navegador y sondeos instalan y prueban Chromium tras la instalación
del paquete, usando el mismo aprovisionador que CI. Si se necesita una reparación del flujo de trabajo solo
para el ejecutor antes de la publicación, fusione la reparación y envíe desde `master` con el tag original.
Esto cambia la orquestación, no el código fuente de la imagen etiquetada; los cambios en la aplicación
siguen requiriendo una nueva versión.

## Evidencia de verificación e identidad de publicación

Cada checkout descendente utiliza `needs.verify.outputs.revision`, no un segundo checkout de tag.
`scripts/release-identity.mjs` resuelve tags ligeros y anotados y rechaza un checkout o tag que difiera
de ese commit verificado. Estas comprobaciones se ejecutan en los límites de imagen, nativo, visibilidad
de GitHub y promoción de resúmenes. Un movimiento externo final de tag no se puede hacer atómico con la
publicación en GitHub/Docker; restrinja el movimiento de tags a nivel de repositorio y conserve estas comprobaciones fail-closed.

El DAG de verificación de versiones replica CI en lugar de serializar todo el catálogo de sondeos local
dentro de un solo trabajo. La paridad local sigue siendo `pnpm verify:full`. Los tiempos de sondeo y los diagnósticos
de fallos sobreviven a ejecuciones fallidas. `static`, `browser` y `probes` agregados siguen siendo los nombres de verificación
de fusión. Las revisiones de acciones son inmutables, las credenciales de checkout no persisten y la política
de aislamiento de caché nativa no se modifica.

`pnpm verify:workflow` verifica invariantes semánticos de publicación/barreras con autopruebas de mutación negativa.
CI también instala actionlint en la versión fijada en `scripts/lint-workflows.mjs` y ejecuta `pnpm verify:workflow:lint`.
Ese adaptador solo normaliza la extensión `concurrency.queue` de GitHub ya validada para el esquema fijado de actionlint;
la estructura de shell/expresiones todavía se comprueba. La integración de shellcheck se deshabilita explícitamente
en lugar de afirmar cobertura de shellcheck.

La verificación del paquete de versión deja explícitamente vacía la base de comparación exacta hasta
que se resuelva una línea base de versión anterior. Informa el crecimiento como no disponible en lugar
de comparar un candidato consigo mismo; los límites de carga y los topes de anomalías todavía producen veredictos
obligatorios. Una base de comparación local omitida puede usar `origin/master`, pero el candidato en sí
nunca es una línea base de crecimiento válida.
