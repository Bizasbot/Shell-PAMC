# Instalación

Shell-PAMC se ejecuta junto a CLIProxyAPI
(CPA) **v8.0.0 o posterior**. La contraseña de inicio de sesión de la consola es la clave de administración de CPA. La
imagen es **`ghcr.io/bizasbot/shell-pamc`** en GitHub Container Registry, para `linux/amd64` y `linux/arm64`.

| Escenario | Método |
| --- | --- |
| Ejecutar sin Docker en macOS, Windows, Linux o FreeBSD sobre amd64/arm64, con un recurso de versión que coincida | [Ejecutable nativo](#ejecutable-nativo) |
| CPA todavía no está desplegado | [Instalación nueva](#instalación-nueva) |
| CPA está desplegado con Docker Compose | [Añadir al archivo Compose existente](#añadir-al-archivo-compose-existente) |
| CPA está desplegado de otra forma | [Independiente](#independiente) |
| Compilación explícita desde el código fuente, o ningún recurso nativo publicado coincide con el sistema operativo o la arquitectura del equipo | [Compilar desde el código fuente](#desde-el-código-fuente) |

Un agente de programación puede ejecutar los mismos pasos desde
[`docs/install-for-agents.md`](install-for-agents.md).

Los métodos con Docker requieren Docker Engine con el complemento Compose. Los comandos suponen una
shell de Linux o macOS con `curl` y `openssl`. Los archivos Compose de los tres métodos
son el mínimo que funciona; los [archivos Compose de las versiones](#archivos-compose-de-las-versiones) describen
los archivos reforzados que publica cada versión.

## Instalación nueva

Despliega CPA y Shell-PAMC juntos.

1. Crea un directorio y guarda lo siguiente como `compose.yml`:

   ```yaml
   services:
     cli-proxy-api:
       image: eceasy/cli-proxy-api:latest
       restart: unless-stopped
       ports:
         - "127.0.0.1:8317:8317"
       environment:
         MANAGEMENT_PASSWORD: ${CPA_MANAGEMENT_KEY:?}
       volumes:
         - ./config.yaml:/CLIProxyAPI/config.yaml
         - ./auths:/root/.cli-proxy-api
         - ./logs:/CLIProxyAPI/logs
         - ./plugins:/CLIProxyAPI/plugins

     shell-pamc:
       image: ghcr.io/bizasbot/shell-pamc:latest
       restart: unless-stopped
       depends_on:
         - cli-proxy-api
       ports:
         - "127.0.0.1:8080:8080"
       environment:
         SHELLPAMC_CPA_BASE_URL: http://cli-proxy-api:8317
         SHELLPAMC_CPA_MANAGEMENT_KEY: ${CPA_MANAGEMENT_KEY:?}
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

2. En el mismo directorio, descarga la configuración inicial de CPA:

   ```bash
   curl -fsSL https://github.com/Bizasbot/Shell-PAMC/releases/latest/download/cpa.config.example.yaml -o config.yaml
   ```

   El archivo debe existir antes del primer inicio: Docker crea un directorio en lugar de un
   archivo montado que falta. Activa la administración remota y las estadísticas de uso, que
   Shell-PAMC necesita, y no contiene claves de cliente.

3. Genera las dos claves. `CPA_MANAGEMENT_KEY` es la clave de administración de CPA y la
   contraseña de inicio de sesión de la consola; `SHELLPAMC_MASTER_KEY` cifra la base de datos de Shell-PAMC.

   ```bash
   cat > .env <<EOF
   CPA_MANAGEMENT_KEY=$(openssl rand -hex 24)
   SHELLPAMC_MASTER_KEY=$(openssl rand -hex 32)
   EOF
   chmod 600 .env
   ```

4. Inicia ambos servicios:

   ```bash
   docker compose up -d
   ```

5. Abre **`http://127.0.0.1:8080/shell-pamc/`** e inicia sesión con el valor de `CPA_MANAGEMENT_KEY`
   de `.env`.

El CPA nuevo no tiene proveedores ni claves de cliente; añade ambos en la consola antes de enviar
solicitudes. Los clientes envían las solicitudes a CPA en `http://127.0.0.1:8317`.

Lo que contiene el directorio después:

- `config.yaml`, `auths/`, `logs/` y `plugins/` pertenecen a CPA. Docker crea los
  tres directorios en el primer inicio.
- La base de datos de Shell-PAMC vive en el volumen de Docker `shell-pamc-data`, que la imagen ya
  asigna al usuario `10001`.
- `.env` contiene ambas claves.
- `shell-pamc-updater` aplica las actualizaciones que ofrece la consola; consulta
  [Actualización](#actualización). Monta el socket de Docker. Omite el servicio para actualizar
  manualmente; en un despliegue que ya está en ejecución, elimina además su contenedor con
  `docker rm -f shell-pamc-updater`, porque Compose lo deja en ejecución.

## Añadir al archivo Compose existente

Ejecuta Shell-PAMC como un servicio más en el archivo Compose que ya ejecuta CPA.

1. Añade los servicios bajo `services:`. Si el archivo ya tiene una clave `volumes:`
   de nivel superior, añade `shell-pamc-data:` debajo de ella en lugar de repetir la clave.

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

   `cli-proxy-api` es el nombre del servicio en el propio archivo Compose de CPA. Si el servicio tiene
   otro nombre, úsalo en `SHELLPAMC_CPA_BASE_URL`. Dos servicios en un mismo archivo comparten una
   red, así que el nombre es todo lo que Shell-PAMC necesita.

2. En el directorio que contiene el archivo Compose, genera la clave maestra. `>>` añade
   al final de `.env` y lo crea si no existe, de modo que las líneas existentes se conservan.

   ```bash
   echo "SHELLPAMC_MASTER_KEY=$(openssl rand -hex 32)" >> .env
   chmod 600 .env
   ```

3. Añade la clave de administración de CPA a `.env`. Es la clave en texto plano que se escribe para iniciar sesión, no el
   hash bcrypt que CPA guarda en `config.yaml`.

   ```dotenv
   SHELLPAMC_CPA_MANAGEMENT_KEY=<management key>
   ```

4. Inicia Shell-PAMC y su actualizador:

   ```bash
   docker compose up -d shell-pamc shell-pamc-updater
   ```

5. Abre **`http://127.0.0.1:8080/shell-pamc/`** e inicia sesión con la clave de administración.

Efecto sobre el despliegue existente:

- `docker compose up -d shell-pamc shell-pamc-updater` crea únicamente esos dos contenedores.
  El contenedor de CPA sigue en ejecución; no se recrea ni se reinicia, y su configuración, claves y
  volúmenes no cambian.
- La base de datos de Shell-PAMC vive en el volumen de Docker `shell-pamc-data`.
- Los demás ajustes van en el bloque `environment:` con los nombres que figuran en
  `docs/operations.md`, por ejemplo `TZ` para coincidir con la zona horaria de CPA.

CPA ve a Shell-PAMC como un cliente remoto. Si la consola informa de que no puede conectarse, consulta la
nota sobre `management.allow-remote` en [acceso a CPA](#acceso-a-cpa); es el único
caso en que la configuración de CPA tiene que cambiar.

## Independiente

Ejecuta Shell-PAMC desde su propio archivo Compose junto a un CPA que se ejecuta en el host, en otro
proyecto de Docker o en otra máquina. CPA, su configuración y sus claves no
cambian.

1. Crea un directorio y guarda lo siguiente como `compose.yml`:

   ```yaml
   services:
     shell-pamc:
       image: ghcr.io/bizasbot/shell-pamc:latest
       restart: unless-stopped
       ports:
         - "127.0.0.1:8080:8080"
       extra_hosts:
         - host.docker.internal:host-gateway
       environment:
         SHELLPAMC_CPA_BASE_URL: http://host.docker.internal:8317
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

   Define `SHELLPAMC_CPA_BASE_URL` según [acceso a CPA](#acceso-a-cpa). Si el reloj de CPA
   no está en UTC, añade `TZ: <CPA's time zone>` en `environment:` para que ambos coincidan en dónde
   empieza un día.

2. Genera la clave maestra:

   ```bash
   echo "SHELLPAMC_MASTER_KEY=$(openssl rand -hex 32)" >> .env
   chmod 600 .env
   ```

3. Añade la clave de administración de CPA a `.env`. Es la clave en texto plano que se escribe para iniciar sesión, no el
   hash bcrypt que CPA guarda en `config.yaml`.

   ```dotenv
   SHELLPAMC_CPA_MANAGEMENT_KEY=<management key>
   ```

4. Inicia Shell-PAMC:

   ```bash
   docker compose up -d
   ```

5. Abre **`http://127.0.0.1:8080/shell-pamc/`** e inicia sesión con la clave de administración.

### Acceso a CPA

Shell-PAMC se ejecuta en un contenedor, por lo que `SHELLPAMC_CPA_BASE_URL` tiene que funcionar desde dentro de ese contenedor.

| CPA | Ajuste |
| --- | --- |
| Se ejecuta en la misma máquina, escuchando en todas las interfaces | `http://host.docker.internal:8317` (el valor anterior) |
| Se ejecuta en otro proyecto de Docker | `http://<CPA's container name>:8317`, con Shell-PAMC unido a la red de CPA (véase abajo) |
| Se ejecuta en otra máquina | Su dirección privada o HTTPS |
| Escucha solo en `127.0.0.1` | Un contenedor no puede alcanzarlo. Instala el [ejecutable nativo](#ejecutable-nativo) en el host cuando un recurso de versión coincida con su sistema operativo y arquitectura; de lo contrario, [compila desde el código fuente](#desde-el-código-fuente) |

Para unirte a la red de Docker de CPA, añade esto al `compose.yml` independiente:

```yaml
networks:
  default:
    name: <CPA's network>
    external: true
```

CPA ve el contenedor de Shell-PAMC como un cliente remoto. Si Shell-PAMC arranca pero informa de que no puede
conectarse, CPA está rechazando la administración remota: define `management.allow-remote: true` en el
`config.yaml` de CPA (`remote-management.allow-remote` en disposiciones antiguas). Ese ajuste
permite que cualquier host que alcance el puerto pruebe la clave de administración, así que mantén el puerto fuera de
Internet público.

## Otros paneles y rastreadores de uso

**Otro panel de administración** puede seguir funcionando. Ese panel y Shell-PAMC editan el mismo CPA, de modo que
un cambio hecho en uno aparece en el otro. Shell-PAMC no importa el historial ni los ajustes
del otro panel.

**Otro rastreador de uso** entra en conflicto. CPA entrega cada registro de uso a un solo lector y luego
lo elimina, de modo que dos rastreadores recibirían cada uno parte del tráfico. Las opciones:

- Detén el otro rastreador. Shell-PAMC registra todas las solicitudes a partir de ese momento.
- Conserva el otro rastreador y establece `SHELLPAMC_USAGE_INGEST_MODE` en `off`: como
  `SHELLPAMC_USAGE_INGEST_MODE: "off"` en `environment:` en los archivos Compose anteriores, o
  como `SHELLPAMC_USAGE_INGEST_MODE=off` en `deploy/.env` con los archivos Compose de las versiones. Shell-PAMC
  sigue administrando CPA, pero su panel y sus registros de solicitudes quedan vacíos.

## Archivos Compose de las versiones

Cada versión publica dos archivos Compose, guardados en `deploy/`. En comparación con los archivos
anteriores, ejecutan la consola con un sistema de archivos raíz de solo lectura, sin capacidades añadidas y
sin escalada de privilegios, inician Shell-PAMC solo después de que CPA esté en buen estado, guardan los datos de Shell-PAMC en un
directorio del host y leen cada ajuste desde `.env`.

| Archivo | Método equivalente |
| --- | --- |
| `compose.full.yml` | [Instalación nueva](#instalación-nueva) |
| `compose.omc.yml` | [Independiente](#independiente) |

CPA y Shell-PAMC juntos:

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

Shell-PAMC junto a un CPA existente:

```bash
mkdir -p shell-pamc/{deploy,shell-pamc-data} && cd shell-pamc
curl -fsSL https://github.com/Bizasbot/Shell-PAMC/releases/latest/download/compose.omc.yml -o deploy/compose.omc.yml
sudo chown 10001:10001 shell-pamc-data

cat > deploy/.env <<EOF
SHELLPAMC_CPA_BASE_URL=http://host.docker.internal:8317
SHELLPAMC_MASTER_KEY=$(openssl rand -hex 32)
EOF
chmod 600 deploy/.env
```

Añade `SHELLPAMC_CPA_MANAGEMENT_KEY=<management key>` a `deploy/.env`, en texto plano, y
cambia la URL donde [acceso a CPA](#acceso-a-cpa) lo indique. Para unirte a la red de Docker
de CPA, define `SHELLPAMC_NETWORK_NAME=<CPA's network>` y `SHELLPAMC_NETWORK_EXTERNAL=true`
en lugar de editar el archivo. Después:

```bash
docker compose -f deploy/compose.omc.yml up -d
```

El `chown` es necesario porque el contenedor de Shell-PAMC se ejecuta como el usuario `10001` y escribe su
base de datos en el directorio `shell-pamc-data`.

### Ajustes

Estas son las variables que aceptan los dos archivos Compose de las versiones. Compose lee
`deploy/.env`, que está junto al archivo Compose. Las rutas relativas se resuelven desde el
directorio `deploy`.

| Variable | Valor predeterminado | Propósito |
| --- | --- | --- |
| `SHELLPAMC_MASTER_KEY` | obligatoria | Cifra la base de datos. Haz una copia de seguridad; no la cambies nunca una vez que existan datos |
| `CPA_MANAGEMENT_KEY` | obligatoria, pila completa | La clave de administración del CPA nuevo y la contraseña de inicio de sesión de Shell-PAMC |
| `SHELLPAMC_CPA_BASE_URL` | obligatoria, solo Shell-PAMC | La dirección del CPA existente |
| `SHELLPAMC_CPA_MANAGEMENT_KEY` | obligatoria, solo Shell-PAMC | La clave de administración en texto plano del CPA existente |
| `SHELLPAMC_IMAGE` | `ghcr.io/bizasbot/shell-pamc:latest` | Define una etiqueta de versión o un digest para fijar una versión |
| `CPA_IMAGE` | `eceasy/cli-proxy-api:latest` | Solo pila completa |
| `SHELLPAMC_BIND` | `127.0.0.1:8080` | Dirección del host de la consola; cámbiala si el puerto está ocupado |
| `CPA_BIND` | `127.0.0.1:8317` | Dirección del host de CPA, solo pila completa |
| `SHELLPAMC_PUBLIC_URL` | `http://127.0.0.1:8080` | La dirección que usan los navegadores. `https://` solo cuando realmente usan TLS |
| `SHELLPAMC_BASE_PATH` | `/shell-pamc` | Prefijo de URL; `/` sirve la consola en la raíz |
| `TZ` | `UTC` | Calendario de los totales diarios; que coincida con el de CPA |
| `SHELLPAMC_USAGE_INGEST_MODE` | `auto` | `off` cuando otra herramienta recopila el uso de este CPA |
| `SHELLPAMC_CPA_USAGE_ADDR` | derivada de la URL de CPA | Sustituye la dirección de la cola de uso de CPA, solo Shell-PAMC |
| `SHELLPAMC_TRUSTED_PROXY_CIDRS` | vacía | Direcciones del proxy inverso |
| `SHELLPAMC_DATA_PATH` | `../shell-pamc-data` | Directorio de datos de Shell-PAMC |
| `CPA_CONFIG_PATH`, `CPA_AUTH_PATH`, `CPA_LOG_PATH`, `CPA_PLUGIN_PATH` | bajo `../cpa/` | Archivos de CPA, solo pila completa |
| `SHELLPAMC_NETWORK_NAME` | `shell-pamc` / `shell-pamc-standalone` | Nombre de la red de Docker (pila completa / solo Shell-PAMC) |
| `SHELLPAMC_NETWORK_EXTERNAL` | `false` | Solo Shell-PAMC: `true` une a una red que ya existe |
| `SHELLPAMC_UPDATE_CHECK_ENABLED`, `SHELLPAMC_UPDATE_CHECK_ON_PAGE_LOAD` | `true` | Define ambas en `false` en una máquina sin Internet |
| `SHELLPAMC_UPDATER_CONTAINER_NAME` | `shell-pamc-updater` | Nombre del contenedor del actualizador |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` | El socket de Docker que monta el actualizador; difiere con Docker sin privilegios de root |

Todo lo demás que lee Shell-PAMC está en `docs/operations.md`.

## Acceso a la consola desde otro lugar

Todos los archivos Compose de aquí publican solo en `127.0.0.1`. Desde otra máquina, crea un túnel por
SSH y abre `http://127.0.0.1:18080/shell-pamc/`:

```bash
ssh -L 18080:127.0.0.1:8080 user@server
```

Para servir Shell-PAMC por HTTPS, apunta el proxy inverso existente a `127.0.0.1:8080`, conserva el
prefijo `/shell-pamc` y define `SHELLPAMC_PUBLIC_URL` con la dirección que usan los navegadores. Define
`SHELLPAMC_TRUSTED_PROXY_CIDRS` con la dirección del proxy para que Shell-PAMC lea la IP del cliente que este
reenvía. No publiques el puerto 8080 en una interfaz pública sin TLS: la contraseña de
inicio de sesión es la clave de administrador de CPA.

### `/shell-pamc` y `/shell-pamc/`

La consola vive en `/shell-pamc/`. Shell-PAMC responde a `/shell-pamc` sin barra final con una redirección permanente
(308) a `/shell-pamc/`, de modo que cualquiera de las dos direcciones la abre cuando los navegadores llegan directamente a Shell-PAMC.

Detrás de un proxy inverso, la ruta sin barra final solo funciona si el proxy la gestiona. Una regla que
coincide solo con `/shell-pamc/` nunca pasa `/shell-pamc` a Shell-PAMC, y el visitante recibe lo que el
proxy sirve para las rutas sin coincidencia en lugar de la consola. Cubre ambas: redirige la ruta
sin barra final en el proxy, o reenvíala y deja que Shell-PAMC redirija.

nginx (`deploy/nginx.conf` es un ejemplo completo que también enruta el resto del host
a CPA):

```nginx
location = /shell-pamc {
    return 308 /shell-pamc/;
}

# Sin barra final en proxy_pass: el prefijo /shell-pamc debe llegar a Shell-PAMC sin cambios.
location ^~ /shell-pamc/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Caddy:

```caddyfile
@omc path /shell-pamc /shell-pamc/*
reverse_proxy @omc 127.0.0.1:8080
```

Comprueba ambas direcciones a través del proxy:

```bash
curl -sI https://example.com/shell-pamc | head -n 1                           # 308
curl -fsS https://example.com/shell-pamc/api/healthz
```

Con un `SHELLPAMC_BASE_PATH` distinto, lo mismo vale para ese prefijo. Con `/` no hay
ninguna ruta sin barra final que gestionar.

## Instalar como aplicación

La consola es una aplicación web instalable: Chrome y Edge en el escritorio y Chrome en Android
la instalan desde la página servida, Samsung Internet hace lo mismo en dispositivos Samsung, e
iOS e iPadOS la añaden a la pantalla de inicio. Después se abre en su propia ventana con la marca
como icono, en lugar de en una pestaña del navegador.

La instalación es una función del navegador, no un ajuste de la consola, así que no hay ningún botón de instalación
que buscar en una página:

| Dónde | Cómo |
| --- | --- |
| Chrome o Edge en un ordenador | El icono de instalación en la barra de direcciones, o el menú del navegador → **Install page as app** / **Apps → Install this site as an app** |
| Chrome en Android con Google Mobile Services | Menú → **Install app** (o **Add to Home screen**) |
| Samsung Internet en un dispositivo Samsung | **Add to Home screen** |
| Safari en iOS o iPadOS | Compartir → **Add to Home Screen**. No hay un aviso de instalación dentro de la página, y la consola no puede abrir por ti la hoja Compartir. En iOS e iPadOS 16.4 o posterior, el menú Compartir de Chrome, Edge, Firefox y Orion también la instala |
| Safari en macOS | **File → Add to Dock** (Safari 17 en macOS 14 o posterior) |

Dos condiciones provienen del navegador y no de Shell-PAMC:

- **Los criterios de instalación de Chromium exigen un contexto seguro.** Chrome y Edge consideran la
  consola instalable solo cuando se sirve por `https://` a través de tu proxy
  inverso, o por `http://localhost` / `http://127.0.0.1` durante el desarrollo local. Un
  despliegue con HTTP simple al que se accede por una IP de la red local o un nombre de host no cumple ese criterio,
  aunque la consola en sí funcione allí. No expongas la consola por HTTP simple
  en una interfaz de red: la contraseña de inicio de sesión es la clave de administrador de CPA.
- **El despliegue sigue siendo accesible.** La PWA no añade ningún service worker ni caché
  sin conexión de respuestas de la API o de contenido de usuario, por lo que la aplicación instalada no puede cargar sin
  conexión. Las reglas existentes de sesión y caché no cambian: la cookie de sesión de inicio de sesión
  y los recursos estáticos con hash conservan el comportamiento que ya tenían. No es necesario reinstalar
  para recibir una actualización; cada inicio carga el paquete actual desde el
  despliegue.

El punto de montaje forma parte de la identidad instalada. `/`, `/shell-pamc` y un
`SHELLPAMC_BASE_PATH` anidado son tres aplicaciones distintas para el navegador, por lo que instalar una no
reemplaza a otra, y una aplicación instalada en una ruta que después cambia tiene que instalarse
de nuevo. Las URL del manifiesto son relativas y se resuelven respecto a la propia dirección del manifiesto,
lo que mantiene esto funcionando detrás de un proxy que conserva el prefijo.

## Ejecutable nativo

[GitHub Releases](https://github.com/Bizasbot/Shell-PAMC/releases) publica Shell-PAMC para
Darwin (macOS), Windows, Linux y FreeBSD, cada uno en **amd64** y **arm64**. `x86_64`
es amd64; `aarch64` y Apple Silicon son arm64. Los archivos de Unix son `.tar.gz`; los de Windows
son `.zip`. CPA ya debe estar instalado por separado (v8.0.0 o posterior).
La consola y la base de datos de zonas horarias IANA están integradas, por lo que no hacen falta ni Node, ni Go ni Docker.
HTTPS usa las raíces de certificados del sistema operativo. Los binarios de Darwin/Windows
no están firmados; inspecciona la versión y verifica su suma de comprobación antes de atender
cualquier aviso de confianza del sistema operativo.

Elige una versión publicada y su recurso que coincida con el sistema operativo y la arquitectura. En Unix, define
estos valores con esa versión y ese host; el ejemplo usa Linux amd64:

```bash
VERSION=MAJOR.MINOR.PATCH
OS=linux
ARCH=amd64
ASSET="shell-pamc_${VERSION}_${OS}_${ARCH}.tar.gz"
mkdir -p shell-pamc && cd shell-pamc
curl -fLO "https://github.com/Bizasbot/Shell-PAMC/releases/download/v${VERSION}/${ASSET}"
curl -fLO "https://github.com/Bizasbot/Shell-PAMC/releases/download/v${VERSION}/checksums.txt"
```

Verifica **solo la entrada del archivo descargado** (el manifiesto también enumera las demás
plataformas y los adjuntos de instalación). En Linux usa `sha256sum -c`, en macOS
`shasum -a 256 -c`, o en FreeBSD compara `sha256 -q "$ASSET"` con su entrada:

```bash
grep -F "  $ASSET" checksums.txt | sha256sum -c -
tar -xzf "$ASSET"
cp -n .env.example .env
chmod 600 .env
```

En Windows, descarga el ZIP correspondiente y `checksums.txt` de la misma versión,
usa `Get-FileHash -Algorithm SHA256` de PowerShell y compara con la entrada del manifiesto
de ese ZIP; después usa `Expand-Archive` en un directorio nuevo y copia `.env.example` a `.env`.
Restringe el acceso a `.env` y al directorio de datos a la cuenta de servicio con las ACL de archivos
de Windows. No sobrescribas una configuración ni un directorio de datos existentes.

Define `SHELLPAMC_MASTER_KEY` una sola vez con una cadena hexadecimal aleatoria de 64 caracteres (`openssl rand -hex 32`
en Unix; usa un generador aleatorio criptográfico en Windows), define la clave de administración
en texto plano de CPA y su URL accesible, y haz coincidir el `TZ` de CPA. Deja `SHELLPAMC_VERSION`
sin definir para que la compilación etiquetada informe su versión integrada. La plantilla incluida se enlaza a
`127.0.0.1:8080`, sirve `/shell-pamc` y escribe SQLite en `./data` bajo el directorio de trabajo.
Cuando CPA está en el mismo host, su URL de loopback funciona sin cambiar la política de administración
remota de CPA. Revisa la [titularidad del lector de uso](#otros-paneles-y-rastreadores-de-uso)
antes de conservar `SHELLPAMC_USAGE_INGEST_MODE=auto`; usa `off` si otro lector continúa.

Ejecuta `./shell-pamc` en Unix o `.\shell-pamc.exe` en Windows desde ese directorio. Verifica
la [salud y la conectividad](#verificar-la-instalación) y después abre `http://127.0.0.1:8080/shell-pamc/`
e inicia sesión con la clave de administración de CPA. Para un gestor de servicios propio del operador, conserva el
mismo directorio de trabajo, archivo de entorno, cuenta de servicio y ruta de datos. No abras
el listener a la red sin configurar el acceso remoto y HTTPS.

Para actualizar una instalación nativa, detén solo Shell-PAMC, haz una copia de seguridad de `.env` y de su directorio de datos,
verifica y extrae el archivo nuevo por separado, y después reemplaza solo el ejecutable e inícialo
desde el directorio de trabajo original. Conserva la clave maestra y el estado. Verifica
la salud y la versión nueva en ejecución. Las migraciones solo avanzan; volver a un
ejecutable anterior requiere restaurar la copia de seguridad de datos correspondiente.

## Desde el código fuente

Requiere Go 1.26+, Node.js 22+, pnpm 11+ y un CPA en ejecución.

```bash
git clone https://github.com/Bizasbot/Shell-PAMC.git
cd shell-pamc
pnpm install --frozen-lockfile
cp .env.example .env
```

En `.env`, define `SHELLPAMC_MASTER_KEY` (`openssl rand -hex 32`), `SHELLPAMC_CPA_MANAGEMENT_KEY`
y `SHELLPAMC_CPA_BASE_URL`. Después:

```bash
pnpm build
go build -trimpath -o bin/shell-pamc ./cmd/shell-pamc
./bin/shell-pamc
```

Abre `http://127.0.0.1:8080/shell-pamc/`. El proceso se ejecuta en primer plano; un gestor de servicios
como systemd lo mantiene en ejecución. Las variables del entorno tienen prioridad sobre `.env`, y
`SHELLPAMC_ENV_FILE` apunta a otro archivo. Una compilación de un checkout sin etiqueta se informa
como `v0.1.0-dev`. Para la recarga en caliente durante el desarrollo, consulta
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Verificar la instalación

```bash
curl -fsS http://127.0.0.1:8080/shell-pamc/api/healthz
```

Una instalación que funciona devuelve `"status":"ok"` y `"cpa_connected":true`. No basta con que un contenedor
sea informado como saludable por Docker: Shell-PAMC sigue activo, con `"status":"degraded"`, cuando
no puede alcanzar CPA.

| Síntoma | Causa |
| --- | --- |
| `permission denied`, o la base de datos no se abre | Con los archivos Compose de las versiones: `shell-pamc-data` no pertenece a `10001:10001`, o está en un sistema de archivos de red |
| CPA no arranca y `config.yaml` es un directorio | `config.yaml` no existía en el primer inicio. Elimina el directorio, descarga el archivo e inicia de nuevo |
| `status` es `degraded` | URL o clave de administración de CPA incorrectas, o CPA rechaza la administración remota. Consulta [acceso a CPA](#acceso-a-cpa) |
| El inicio de sesión funciona y luego vuelve a pedirse | `SHELLPAMC_PUBLIC_URL` indica `https://` pero el navegador usa HTTP simple |
| La consola pide actualizar CPA | CPA es anterior a v8.0.0 |
| Los registros de solicitudes siguen vacíos | Otra herramienta está recopilando el uso, `SHELLPAMC_USAGE_INGEST_MODE=off` está definido, o las estadísticas de uso están desactivadas en CPA |
| El puerto ya está en uso | Cambia el lado del host de la entrada `ports:`, o define `SHELLPAMC_BIND` / `CPA_BIND` con los archivos Compose de las versiones |

## Actualización

Las actualizaciones migran la base de datos y no hay vuelta atrás: el camino de regreso a una versión
anterior es restaurar una copia de seguridad. Shell-PAMC hace por sí mismo una copia de seguridad cifrada antes de
aplicar una migración; `docs/ops/sqlite-operations.md` es el manual de procedimientos para las copias de seguridad hechas
manualmente y para restaurarlas. Haz una copia de seguridad de `.env` por separado.

> **Cambio incompatible: se renombraron los nombres de contenedor, servicio, red y datos.** Los
> valores predeterminados `oh-my-cpa`, `oh-my-cpa-updater` y `oh-my-cpa-data` ahora son `shell-pamc`,
> `shell-pamc-updater` y `shell-pamc-data`, y la consola se sirve bajo
> `/shell-pamc` en lugar de `/omc` (define `SHELLPAMC_BASE_PATH=/omc` para conservar la ruta antigua).
> El actualizador encuentra los contenedores por nombre, por lo que una instalación actualizada in situ tiene que
> recrearlos: detén y elimina los contenedores antiguos, renombra los servicios en el archivo
> Compose y mueve los datos (el contenido de `docker volume` o el directorio `oh-my-cpa-data`)
> al nombre nuevo antes de `docker compose up -d`. El archivo de base de datos interno lo renombra
> Shell-PAMC por sí mismo en el primer inicio. Haz una copia de seguridad antes.

### Desde la consola

Cuando existe una versión más reciente, **Información del sistema** muestra **Actualizar ahora** junto a Oh My
CPA o CLIProxyAPI. Al confirmarlo, el contenedor `shell-pamc-updater`:

1. descarga la imagen nueva. Para Shell-PAMC es la imagen exacta indicada por el manifiesto
   firmado de la versión; para CLIProxyAPI es la etiqueta que el contenedor ya usa;
2. detiene el contenedor en ejecución e inicia uno de reemplazo con el mismo entorno,
   volúmenes, puertos, redes y etiquetas de Compose;
3. espera a que el reemplazo informe de que está saludable y después elimina el contenedor antiguo. Un
   reemplazo que termina o sigue sin estar saludable se elimina y el contenedor antiguo se inicia
   de nuevo con su propio nombre.

Actualizar Shell-PAMC desconecta la consola unos segundos y la página se recarga con
la versión nueva. Actualizar CLIProxyAPI reinicia la pasarela, lo que interrumpe las solicitudes en
curso. Cada actualización y su resultado se escriben en el registro de auditoría.

La acción no se ofrece en tres casos, y la página indica cuál:

| Caso | Qué hacer |
| --- | --- |
| La imagen está fijada a una etiqueta de versión o a un digest, por ejemplo `SHELLPAMC_IMAGE=ghcr.io/bizasbot/shell-pamc:vX.Y.Z` | Cambia la versión fijada y vuelve a desplegar. La consola no toca una imagen fijada, porque el siguiente `docker compose up` volvería a poner la versión fijada sobre una base de datos que ya se migró |
| CPA no se ejecuta como contenedor en el mismo host de Docker | Actualiza CPA donde se ejecuta |
| La compilación no incluye clave de firma de versiones, como ocurre con una compilación desde el código fuente | Actualiza manualmente, como se indica abajo |

### Activar las actualizaciones desde la consola en un despliegue existente

Un despliegue cuyo archivo Compose no tiene el servicio `shell-pamc-updater` lo obtiene con un
solo comando en el host de Docker. El archivo Compose no se edita:

```bash
docker run --rm --pull always -u 0 -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/bizasbot/shell-pamc:latest updater install
```

El comando:

- encuentra el contenedor de Shell-PAMC en ejecución, sea cual sea el archivo Compose de esta guía
  que lo inició. Cuando hay más de uno en ejecución, añade `--container <name>`; cuando CPA se ejecuta como
  un contenedor que el actualizador no puede identificar, añade `--cpa-container <name>`;
- crea un contenedor llamado `shell-pamc-updater` a partir de la misma imagen, en una red del
  mismo nombre, y conecta la consola a esa red. La consola encuentra el actualizador por
  ese nombre; no se añade ningún ajuste a ninguno de los contenedores y CPA no se toca;
- reemplaza la consola por la versión actual cuando es más antigua, con la reversión
  descrita arriba. Una consola fijada se deja como está.

`--pull always` obtiene la imagen actual: el host ya tiene una
`ghcr.io/bizasbot/shell-pamc:latest` más antigua, que no incluye actualizador. `-u 0` es necesario porque el socket de
Docker pertenece a root. Ejecutar el comando de nuevo
repara o renueva la instalación. `docker rm -f shell-pamc-updater` la elimina, y
la consola vuelve entonces a mostrar el comando en lugar de la acción de actualización.

El contenedor del actualizador tiene el socket de Docker, lo que equivale a controlar Docker en
ese host. Se ejecuta con un sistema de archivos de solo lectura y sin capacidades, no publica ningún puerto
y solo acepta dos solicitudes de la consola: informar del estado, y actualizar Shell-PAMC o
CLIProxyAPI. `docs/operations.md` describe el límite.

Un archivo Compose que más tarde declare por sí mismo el servicio `shell-pamc-updater` entra en conflicto con
el nombre del contenedor instalado: elimina primero el instalado con
`docker rm -f shell-pamc-updater`.

### Manualmente

En el directorio que contiene el archivo Compose:

```bash
docker compose pull shell-pamc shell-pamc-updater
docker compose up -d --no-deps shell-pamc shell-pamc-updater
```

Omite `shell-pamc-updater` en ambos comandos cuando el archivo no lo declara. Con un
archivo Compose de versión, añade `-f deploy/compose.full.yml` o `-f deploy/compose.omc.yml` a
ambos comandos.

Esto actualiza Shell-PAMC y deja CPA como está. Para pasar a una versión concreta, cambia la
etiqueta de `image:` a `ghcr.io/bizasbot/shell-pamc:vX.Y.Z`, o define `SHELLPAMC_IMAGE` en `deploy/.env` con
un archivo Compose de versión. Con los archivos de esta guía, los datos están en el volumen de Docker
`<project>_shell-pamc-data`, y `docker volume inspect` muestra su ruta. Cómo se publican las versiones
está en `docs/releasing.md`.

## Restricciones

- Mantén `SHELLPAMC_MASTER_KEY` a salvo y sin cambios. Sin ella, los datos almacenados no se pueden leer.
- Un solo Shell-PAMC por directorio de datos, en un disco local.
- Un solo recopilador de uso por CPA.
