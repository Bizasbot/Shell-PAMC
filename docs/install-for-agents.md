# Instalar Shell-PAMC (para un agente de programación)

Este manual de procedimientos es para un agente de programación que instala Shell-PAMC en la máquina de un usuario. Shell-PAMC
es una consola web para CLIProxyAPI (CPA). Requiere **CPA v8.0.0 o posterior** y la clave de
administración de CPA en texto plano, que también es la contraseña de inicio de sesión de Shell-PAMC. La imagen de Docker es
`ghcr.io/bizasbot/shell-pamc:latest` (amd64 y arm64). Los archivos de versión nativos cubren Darwin,
Windows, Linux y FreeBSD en amd64/arm64; una instalación normal no compila nada.

El trabajo consiste en: ver qué hay ya, elegir un camino, instalar y verificar.

## Reglas

1. **Mantén los secretos fuera de la conversación.** No imprimas archivos `.env`, claves de
   administración, la clave maestra ni la salida de `docker compose config`. Cuando se necesite la clave de
   administración existente, escribe un marcador en el archivo `.env` y pide al usuario
   que lo complete.
2. **No cambies el CPA existente.** Ni actualización, ni edición de configuración, ni reinicio, ni
   detener otro panel o rastreador, salvo que el usuario acepte ese cambio concreto.
3. **Nunca reemplaces un `SHELLPAMC_MASTER_KEY` existente.** Si ya existe un directorio de datos de Shell-PAMC,
   reutiliza su clave. Si la clave se ha perdido, detente e indícalo.
4. **Pregunta antes de** usar `sudo`, instalar Docker o una cadena de herramientas, abrir un puerto más allá de
   `127.0.0.1`, dar el socket de Docker a un contenedor, o enviar una solicitud a un modelo que
   tenga coste.

## 1. Mirar primero

```bash
docker version --format '{{.Server.Version}}'; docker compose version
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Networks}}'
ss -ltn 2>/dev/null | grep -E ':(8080|8317)\b'
curl -fsS --max-time 3 http://127.0.0.1:8317/healthz
```

Averigua:

- ¿Está CPA en ejecución? ¿Como contenedor (¿en qué red?), como proceso del host (¿escuchando en
  `127.0.0.1` o en todas las interfaces?), o en otra máquina?
- ¿Ya está instalado Shell-PAMC? Entonces es una actualización (paso 5), no una instalación.
- ¿Hay algo más que recopile el uso de CPA, como las estadísticas de otro panel o un
  exportador? CPA entrega cada registro de uso a un solo lector, así que esto decide el paso 3.
- ¿Qué sistema operativo y arquitectura de CPU ejecutarán Shell-PAMC, y la versión ofrece un archivo nativo que coincida?
- ¿Están libres los puertos 8080 y 8317?

Pregunta al usuario solo por lo que no se pueda averiguar.

## 2. Elegir un camino

| Situación | Camino |
| --- | --- |
| No hay CPA | **A**: instalar CPA y Shell-PAMC juntos |
| CPA se ejecuta desde un archivo Compose que el usuario puede editar | **B1**: añadir un servicio de Shell-PAMC a ese archivo |
| CPA en Docker sin tal archivo, en otra máquina, o en el host escuchando en todas las interfaces | **B2**: añadir Shell-PAMC desde su propio archivo Compose |
| Un recurso nativo publicado coincide con el sistema operativo y la arquitectura detectados, y o bien CPA escucha solo en `127.0.0.1` en el host o Docker no está disponible | **C**: instalar el ejecutable nativo correspondiente en el host |
| El usuario pide explícitamente el código fuente, o ningún recurso nativo publicado coincide con el sistema operativo y la arquitectura detectados | **D**: compilar desde el código fuente |
| Shell-PAMC ya está instalado | Paso 5 |

Antes de empezar, indica al usuario qué camino se eligió y qué va a crear.

## 3. Instalar

Los caminos A y B2 usan los archivos Compose que publica cada versión. Son los equivalentes
reforzados de los archivos mínimos de `docs/install.md` (sistema de archivos raíz de solo lectura,
capacidades eliminadas, cada ajuste en `deploy/.env`).

Todos los caminos con contenedores de abajo incluyen un servicio `shell-pamc-updater`. Permite al usuario
actualizar Shell-PAMC y CPA desde la consola, y monta el socket de Docker, lo que equivale a
controlar Docker en el host. Indícalo antes de iniciarlo (regla 4). Si el usuario lo rechaza,
elimina el bloque del servicio `shell-pamc-updater` del archivo Compose antes de ejecutar
`docker compose up`; nada más depende de él.

### A. CPA y Shell-PAMC juntos

Usa un directorio nuevo. Si algún archivo de destino ya existe, detente y pregunta.

```bash
mkdir -p shell-pamc/{deploy,shell-pamc-data,cpa/auths,cpa/logs,cpa/plugins} && cd shell-pamc
curl -fsSL https://github.com/Bizasbot/Shell-PAMC/releases/latest/download/compose.full.yml -o deploy/compose.full.yml
curl -fsSL https://github.com/Bizasbot/Shell-PAMC/releases/latest/download/cpa.config.example.yaml -o cpa/config.yaml
sudo chown 10001:10001 shell-pamc-data

cat > deploy/.env <<EOF
CPA_MANAGEMENT_KEY=$(openssl rand -hex 24)
SHELLPAMC_MASTER_KEY=$(openssl rand -hex 32)
EOF
chmod 600 deploy/.env

docker compose -f deploy/compose.full.yml up -d
```

Si el puerto 8080 o 8317 está ocupado, añade `SHELLPAMC_BIND=127.0.0.1:<port>` o
`CPA_BIND=127.0.0.1:<port>` a `deploy/.env`. No detengas lo que ocupa el puerto.

### B1. Shell-PAMC en el archivo Compose de CPA

Busca el archivo Compose de CPA (`docker inspect <cpa container>` lo muestra en la etiqueta
`com.docker.compose.project.config_files`). Muestra el cambio al usuario, después añade
esto bajo `services:` y deja cada línea existente como está:

```yaml
  shell-pamc:
    image: ghcr.io/bizasbot/shell-pamc:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      SHELLPAMC_CPA_BASE_URL: http://cli-proxy-api:8317
      SHELLPAMC_CPA_MANAGEMENT_KEY: ${SHELLPAMC_CPA_MANAGEMENT_KEY:?}
      SHELLPAMC_MASTER_KEY: ${SHELLPAMC_MASTER_KEY:?}
      SHELLPAMC_DATA_DIR: /data
    volumes:
      - shell-pamc-data:/data

  shell-pamc-updater:
    image: ghcr.io/bizasbot/shell-pamc:latest
    restart: unless-stopped
    command: ["updater", "serve"]
    user: "0:0"
    read_only: true
    cap_drop: [ALL]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

volumes:
  shell-pamc-data:
```

Define el host de `SHELLPAMC_CPA_BASE_URL` con el nombre del servicio de CPA en ese archivo. Si existe una
clave `volumes:` de nivel superior, añade `shell-pamc-data:` debajo de ella. Después, en el directorio
del archivo Compose:

```bash
cat >> .env <<EOF
SHELLPAMC_CPA_MANAGEMENT_KEY=replace-me
SHELLPAMC_MASTER_KEY=$(openssl rand -hex 32)
EOF
chmod 600 .env
```

Pide al usuario que complete la clave de administración, aplica los puntos de zona horaria y recopilación de uso
de B2 (aquí como entradas de `environment:`), e inicia solo los servicios nuevos:

```bash
docker compose up -d shell-pamc shell-pamc-updater
```

Nombra los servicios. Un `docker compose up -d` sin nombres también recrearía CPA si su
definición o su imagen hubieran cambiado. Comprueba después que el ID del contenedor de CPA y su hora de
inicio no han cambiado. Los datos viven en un volumen de Docker, así que no hace falta `chown`.

### B2. Shell-PAMC junto a un CPA existente

```bash
mkdir -p shell-pamc/{deploy,shell-pamc-data} && cd shell-pamc
curl -fsSL https://github.com/Bizasbot/Shell-PAMC/releases/latest/download/compose.omc.yml -o deploy/compose.omc.yml
sudo chown 10001:10001 shell-pamc-data

cat > deploy/.env <<EOF
SHELLPAMC_CPA_BASE_URL=http://host.docker.internal:8317
SHELLPAMC_CPA_MANAGEMENT_KEY=replace-me
SHELLPAMC_MASTER_KEY=$(openssl rand -hex 32)
EOF
chmod 600 deploy/.env
```

Después ajusta `deploy/.env`:

- **URL de CPA.** Debe ser accesible desde dentro del contenedor de Shell-PAMC.
  - CPA en Docker: añade `SHELLPAMC_NETWORK_NAME=<CPA's network>` y
    `SHELLPAMC_NETWORK_EXTERNAL=true`, y usa `http://<CPA container name>:8317`.
  - CPA en este host, todas las interfaces: conserva `http://host.docker.internal:8317`.
  - CPA en otro lugar: su dirección privada o HTTPS. Deja activada la verificación de TLS.
- **Clave de administración.** Pide al usuario que sustituya `replace-me` por la clave en texto plano.
  El hash bcrypt en el `config.yaml` de CPA no funcionará.
- **Zona horaria.** Añade `TZ=` que coincida con la de CPA si no es UTC.
- **Recopilación de uso.** Si algo más ya recopila el uso de CPA, pregunta al usuario:
  detener esa herramienta para que Shell-PAMC registre las solicitudes, o conservarla y añadir
  `SHELLPAMC_USAGE_INGEST_MODE=off` (Shell-PAMC entonces administrará CPA pero no mostrará ningún uso). Si no
  se puede determinar, usa `off` e indícalo. Otro panel de administración que no recopile
  uso no necesita nada; déjalo en ejecución.

```bash
docker compose -f deploy/compose.omc.yml up -d
```

En los caminos B1 y B2 por igual, CPA trata el contenedor de Shell-PAMC como un cliente remoto. Si la
comprobación de salud informa `cpa_connected: false` con una URL y clave correctas, CPA tiene
`management.allow-remote` desactivado. Activarlo es un cambio en CPA: explícalo y pregunta primero.

### C. Ejecutable nativo

Sigue la sección de ejecutable nativo de `docs/install.md`. Detecta primero el sistema operativo y la
arquitectura de CPU: Darwin, Windows, Linux o FreeBSD con amd64/arm64; `x86_64` se asigna
a amd64 y `aarch64` a arm64. Elige una única versión estable publicada que contenga
ese recurso, descarga su archivo y `checksums.txt` desde la misma etiqueta, y compara
la entrada exacta del manifiesto con un hash SHA-256 calculado localmente antes de extraer.
No intentes verificar entradas no descargadas ni ejecutar un ejecutable que no coincida.

Extrae en un directorio nuevo de propiedad del usuario. Copia el `.env.example` incluido a `.env`
olo si no hay un archivo existente. Genera una clave maestra sin imprimirla y
pide al usuario que complete la clave de administración de CPA en texto plano. La plantilla enlaza al loopback,
usa `/shell-pamc` y escribe en `./data`; conserva esos valores predeterminados salvo que el usuario apruebe un
cambio. Deja `SHELLPAMC_VERSION` sin definir, haz coincidir el `TZ` de CPA y aplica la
decisión del lector de uso de B2. Un CPA en el host que escucha en loopback no necesita editar la
administración remota.
Restringe el entorno y los archivos de datos a la cuenta de servicio (permisos Unix o ACL de Windows).
Usa las raíces de certificados del sistema operativo; el binario ya integra los datos de zona horaria IANA.

Ejecuta `./shell-pamc` o `.\shell-pamc.exe` desde el directorio extraído, después verifica como en el
paso 4. No eludes los controles de confianza de macOS/Windows: los binarios sin firma pueden requerir una
decisión explícita del usuario tras la verificación de la suma de comprobación. Ofrece un gestor de servicios solo si
se solicita, conservando el directorio de trabajo y la ruta de datos.

### D. Desde el código fuente

Requiere Go 1.26+, Node.js 22+ y pnpm 11+.

```bash
git clone https://github.com/Bizasbot/Shell-PAMC.git && cd Shell-PAMC
pnpm install --frozen-lockfile
cp -n .env.example .env
```

En `.env`, define `SHELLPAMC_MASTER_KEY` (`openssl rand -hex 32`), `SHELLPAMC_CPA_BASE_URL` y un
`SHELLPAMC_CPA_MANAGEMENT_KEY` de marcador para que el usuario lo complete. Aplica la zona horaria
y los puntos de recopilación de uso de B2. Después:

```bash
pnpm build
go build -trimpath -o bin/shell-pamc ./cmd/shell-pamc
./bin/shell-pamc
```

Se ejecuta en primer plano. Ofrece una unidad de systemd o similar solo si el usuario lo quiere.

## 4. Verificar

```bash
curl -fsS http://127.0.0.1:8080/shell-pamc/api/healthz
```

La instalación está completa solo cuando la respuesta tiene `"status":"ok"`, `"database_status":"ok"`
y `"cpa_connected":true`. Un contenedor que Docker llama saludable no es una prueba: Shell-PAMC
sigue activo con `"status":"degraded"` cuando no puede alcanzar CPA. Si la comprobación falla, informa
de la causa real. Las más comunes:

| Síntoma | Causa |
| --- | --- |
| La base de datos no se abre | El directorio `shell-pamc-data` no pertenece a `10001:10001` (A y B2) |
| `degraded`, `cpa_connected: false` | URL o clave incorrectas, o CPA rechaza la administración remota |
| `cpa_management_api: unsupported` | CPA es anterior a v8.0.0; el usuario debe actualizarlo |

En un camino de contenedor con el actualizador, comprueba también que está en ejecución y que la consola
no lo ha perdido:

```bash
docker inspect -f '{{.State.Health.Status}}' shell-pamc-updater
```

`healthy` es la respuesta esperada. Con el actualizador en el propio archivo Compose de CPA (B1) el
contenedor se llama `<project>-shell-pamc-updater-1`; `docker compose ps` lo enumera.

## 5. Actualizar un Shell-PAMC existente

No reinstales. Para una instalación nativa, detén solo Shell-PAMC, haz una copia de seguridad de su `.env` y del
directorio de datos, verifica y extrae el nuevo archivo por separado y reemplaza solo el
ejectable. Conserva la cuenta de servicio, el directorio de trabajo, la ruta de datos y la clave
maestra, reinicia y verifica como en el paso 4. Restaura la copia de seguridad de datos correspondiente para volver
a un ejecutable anterior; las migraciones son solo de avance.

Para una instalación de contenedor, busca el archivo Compose existente, el directorio de datos y
`.env`, y haz una copia de seguridad del directorio de datos y `.env`. Después comprueba si hay actualizador:

```bash
docker ps --filter name=shell-pamc-updater --format '{{.Names}} {{.Status}}'
```

**El actualizador está en ejecución.** El usuario puede actualizar desde la página de Información del sistema
de la consola y no hace falta ejecutar nada. Para actualizarlo ahora por ellos, usa los comandos
de Compose de abajo e incluye `shell-pamc-updater` en ambos.

**Sin actualizador, y la imagen de Shell-PAMC no está fijada a una versión.** Un comando añade el actualizador
y lleva Shell-PAMC a la versión actual, sin editar el archivo Compose. Monta el socket de
Docker en un contenedor, así que explícalo y obtener la conformidad del usuario antes
(regla 4):

```bash
docker run --rm --pull always -u 0 -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/bizasbot/shell-pamc:latest updater install
```

Mantén `--pull always`: sin él Docker ejecutaría la `latest` antigua que ya tiene el host,
que no tiene actualizador. Imprime el contenedor de consola que encontró y lo que hizo. Si informa de más de
un contenedor de Shell-PAMC, vuelve a ejecutarlo con `--container <name>`. No toca CPA (regla 2).
Después, `docker inspect -f '{{.State.Health.Status}}' shell-pamc-updater` debe imprimir
`healthy`. `docker rm -f shell-pamc-updater` lo deshace.

**El usuario lo rechaza, o la imagen está fijada.** Actualiza a través de Compose:

```bash
docker compose -f deploy/compose.omc.yml pull shell-pamc
docker compose -f deploy/compose.omc.yml up -d --no-deps shell-pamc
```

Usa `compose.full.yml` si ese es el archivo en uso. Cuando Shell-PAMC es un servicio en el archivo
Compose de CPA, ejecuta `docker compose pull shell-pamc` y `docker compose up -d shell-pamc`
en ese directorio. Para una imagen fijada, cambia primero la versión fijada a la que se desea; no
la desfijes sin preguntar.

Las migraciones de base de datos solo avanzan, así que el camino de vuelta a una versión anterior es restaurar
la copia de seguridad. Verifica como en el paso 4.

## 6. Informar al usuario

- La dirección de la consola, `http://127.0.0.1:8080/shell-pamc/` salvo que se haya cambiado el puerto. En un
  servidor remoto, indica `ssh -L 18080:127.0.0.1:8080 user@server` y
  `http://127.0.0.1:18080/shell-pamc/`.
- Que la contraseña de inicio de sesión es la clave de administración de CPA, y qué archivo la contiene. No
  la clave en sí.
- Que haga una copia de seguridad del archivo `.env` y de los datos de Shell-PAMC (el directorio o volumen `shell-pamc-data`). Sin `SHELLPAMC_MASTER_KEY` los datos
  no se pueden leer.
- Si Shell-PAMC está recopilando uso y, si no lo está, por qué.
- Si el actualizador está instalado. Si lo está: las versiones posteriores de Shell-PAMC y CPA se pueden
  instalar desde la página Información del sistema de la consola, y el contenedor `shell-pamc-updater`
  tiene el socket de Docker. Si no lo está: el comando que lo añade.
- Cualquier cambio realizado fuera del directorio `shell-pamc` nuevo.

Shell-PAMC redirige `/shell-pamc` sin barra final a `/shell-pamc/`. Si hay un proxy inverso delante,
enruta tanto `/shell-pamc` como `/shell-pamc/` a Shell-PAMC (o redirige `/shell-pamc` a `/shell-pamc/` en el proxy) y
confirma que `curl -sI <public address>/shell-pamc` responde `308`; una regla solo para `/shell-pamc/` deja
la ruta sin barra final inaccesible.

Más detalles, incluyendo HTTPS detrás de un proxy inverso y todos los ajustes, están en
`docs/install.md`.
