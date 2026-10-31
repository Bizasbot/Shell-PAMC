# Installation

Shell-PAMC runs beside [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)
(CPA) **v8.0.0 or later**. The console's sign-in password is CPA's management key. The
image is **`ghcr.io/bizasbot/shell-pamc`** on GitHub Container Registry, for `linux/amd64` and `linux/arm64`.

| Scenario | Method |
| --- | --- |
| Run without Docker on macOS, Windows, Linux or FreeBSD on amd64/arm64, with a matching release asset | [Native executable](#native-executable) |
| CPA is not deployed yet | [New install](#new-install) |
| CPA is deployed with Docker Compose | [Add to the existing Compose file](#add-to-the-existing-compose-file) |
| CPA is deployed another way | [Standalone](#standalone) |
| Explicit source build, or no published native asset matches the host OS/architecture | [Build from source](#from-source) |

A coding agent can run the same steps from
[`docs/install-for-agents.md`](install-for-agents.md).

The Docker methods need Docker Engine with the Compose plugin. The commands assume a
Linux or macOS shell with `curl` and `openssl`. The Compose files in the three methods
are the minimum that runs; [release Compose files](#release-compose-files) describes
the hardened files each release publishes.

## New install

Deploys CPA and Shell-PAMC together.

1. Create a directory and save the following as `compose.yml`:

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

2. In the same directory, download the starter configuration for CPA:

   ```bash
   curl -fsSL https://github.com/Bizasbot/Shell-PAMC/releases/latest/download/cpa.config.example.yaml -o config.yaml
   ```

   The file must exist before the first start: Docker creates a directory in place of a
   missing bind-mounted file. It enables remote management and usage statistics, which
   Shell-PAMC needs, and holds no client keys.

3. Generate the two keys. `CPA_MANAGEMENT_KEY` is CPA's management key and the console's
   sign-in password; `SHELLPAMC_MASTER_KEY` encrypts Shell-PAMC's database.

   ```bash
   cat > .env <<EOF
   CPA_MANAGEMENT_KEY=$(openssl rand -hex 24)
   SHELLPAMC_MASTER_KEY=$(openssl rand -hex 32)
   EOF
   chmod 600 .env
   ```

4. Start both services:

   ```bash
   docker compose up -d
   ```

5. Open **`http://127.0.0.1:8080/shell-pamc/`** and sign in with the `CPA_MANAGEMENT_KEY` value
   from `.env`.

The new CPA has no providers and no client keys; add both in the console before sending
requests. Clients send requests to CPA at `http://127.0.0.1:8317`.

What the directory holds afterwards:

- `config.yaml`, `auths/`, `logs/` and `plugins/` belong to CPA. Docker creates the
  three directories on first start.
- Shell-PAMC's database lives in the `shell-pamc-data` Docker volume, which the image already
  owns as user `10001`.
- `.env` holds both keys.
- `shell-pamc-updater` applies the updates the console offers; see
  [Upgrading](#upgrading). It mounts the Docker socket. Leave the service out to update
  by hand instead; on a deployment already running, also remove its container with
  `docker rm -f shell-pamc-updater`, since Compose leaves it running.

## Add to the existing Compose file

Runs Shell-PAMC as one more service in the Compose file that already runs CPA.

1. Add the services under `services:`. If the file already has a top-level `volumes:`
   key, add `shell-pamc-data:` under it instead of repeating the key.

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

   `cli-proxy-api` is the service name in CPA's own Compose file. If the service has
   another name, use it in `SHELLPAMC_CPA_BASE_URL`. Two services in one file share a
   network, so the name is all Shell-PAMC needs.

2. In the directory that holds the Compose file, generate the master key. `>>` appends
   to `.env` and creates it if it is missing, so existing lines stay.

   ```bash
   echo "SHELLPAMC_MASTER_KEY=$(openssl rand -hex 32)" >> .env
   chmod 600 .env
   ```

3. Add CPA's management key to `.env`. It is the plaintext key typed to sign in, not the
   bcrypt hash CPA stores in `config.yaml`.

   ```dotenv
   SHELLPAMC_CPA_MANAGEMENT_KEY=<management key>
   ```

4. Start Shell-PAMC and its updater:

   ```bash
   docker compose up -d shell-pamc shell-pamc-updater
   ```

5. Open **`http://127.0.0.1:8080/shell-pamc/`** and sign in with the management key.

Effect on the existing deployment:

- `docker compose up -d shell-pamc shell-pamc-updater` creates those two containers only.
  The CPA container keeps running; it is not recreated or restarted, and its configuration, keys and
  volumes are unchanged.
- Shell-PAMC's database lives in the `shell-pamc-data` Docker volume.
- Other settings go in the `environment:` block under the names in
  `docs/operations.md`, for example `TZ` to match CPA's time zone.

CPA sees Shell-PAMC as a remote client. If the console reports that it cannot connect, see the
note on `management.allow-remote` under [reaching CPA](#reaching-cpa); that is the one
case where CPA's configuration has to change.

## Standalone

Runs Shell-PAMC from its own Compose file next to a CPA that runs on the host, in another
Docker project or on another machine. CPA, its configuration and its keys are not
changed.

1. Create a directory and save the following as `compose.yml`:

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

   Set `SHELLPAMC_CPA_BASE_URL` according to [reaching CPA](#reaching-cpa). If CPA's clock is
   not UTC, add `TZ: <CPA's time zone>` under `environment:` so both agree on where a
   day starts.

2. Generate the master key:

   ```bash
   echo "SHELLPAMC_MASTER_KEY=$(openssl rand -hex 32)" >> .env
   chmod 600 .env
   ```

3. Add CPA's management key to `.env`. It is the plaintext key typed to sign in, not the
   bcrypt hash CPA stores in `config.yaml`.

   ```dotenv
   SHELLPAMC_CPA_MANAGEMENT_KEY=<management key>
   ```

4. Start Shell-PAMC:

   ```bash
   docker compose up -d
   ```

5. Open **`http://127.0.0.1:8080/shell-pamc/`** and sign in with the management key.

### Reaching CPA

Shell-PAMC runs in a container, so `SHELLPAMC_CPA_BASE_URL` has to work from inside that container.

| CPA | Setting |
| --- | --- |
| Runs on the same machine, listening on all interfaces | `http://host.docker.internal:8317` (the value above) |
| Runs in another Docker project | `http://<CPA's container name>:8317`, with Shell-PAMC joined to CPA's network (below) |
| Runs on another machine | Its private or HTTPS address |
| Listens on `127.0.0.1` only | A container cannot reach it. Install the [native executable](#native-executable) on the host when a release asset matches its OS/architecture; otherwise [build from source](#from-source) |

To join CPA's Docker network, add this to the standalone `compose.yml`:

```yaml
networks:
  default:
    name: <CPA's network>
    external: true
```

CPA sees Shell-PAMC's container as a remote client. If Shell-PAMC starts but reports that it cannot
connect, CPA is refusing remote management: set `management.allow-remote: true` in
CPA's `config.yaml` (`remote-management.allow-remote` in older layouts). That setting
lets any host that can reach the port try the management key, so keep the port off the
public internet.

## Other panels and usage trackers

**Another management panel** can keep running. It and Shell-PAMC both edit the same CPA, so
a change made in one shows up in the other. Shell-PAMC does not import the other panel's
history or settings.

**Another usage tracker** conflicts. CPA hands each usage record to one reader and then
deletes it, so two trackers would each get part of the traffic. The options:

- Stop the other tracker. Shell-PAMC records every request from then on.
- Keep the other tracker and set `SHELLPAMC_USAGE_INGEST_MODE` to `off`: as
  `SHELLPAMC_USAGE_INGEST_MODE: "off"` under `environment:` in the Compose files above, or
  as `SHELLPAMC_USAGE_INGEST_MODE=off` in `deploy/.env` with the release Compose files. Shell-PAMC
  still manages CPA, but its dashboard and request records stay empty.

## Release Compose files

Each release publishes two Compose files, kept in `deploy/`. Compared with the files
above they run the console with a read-only root filesystem, no added capabilities and
no privilege escalation, start Shell-PAMC only after CPA is healthy, keep Shell-PAMC's data in a host
directory, and read every setting from `.env`.

| File | Equivalent method |
| --- | --- |
| `compose.full.yml` | [New install](#new-install) |
| `compose.omc.yml` | [Standalone](#standalone) |

CPA and Shell-PAMC together:

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

Shell-PAMC beside an existing CPA:

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

Add `SHELLPAMC_CPA_MANAGEMENT_KEY=<management key>` to `deploy/.env`, in plaintext, and
change the URL where [reaching CPA](#reaching-cpa) says so. To join CPA's Docker
network, set `SHELLPAMC_NETWORK_NAME=<CPA's network>` and `SHELLPAMC_NETWORK_EXTERNAL=true`
instead of editing the file. Then:

```bash
docker compose -f deploy/compose.omc.yml up -d
```

The `chown` is there because the Shell-PAMC container runs as user `10001` and writes its
database to the `shell-pamc-data` directory.

### Settings

These are the variables the two release Compose files accept. Compose reads
`deploy/.env`, which sits next to the Compose file. Relative paths are resolved from the
`deploy` directory.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SHELLPAMC_MASTER_KEY` | required | Encrypts the database. Back it up; never change it once data exists |
| `CPA_MANAGEMENT_KEY` | required, full stack | The new CPA's management key and Shell-PAMC's sign-in password |
| `SHELLPAMC_CPA_BASE_URL` | required, Shell-PAMC only | The existing CPA's address |
| `SHELLPAMC_CPA_MANAGEMENT_KEY` | required, Shell-PAMC only | The existing CPA's plaintext management key |
| `SHELLPAMC_IMAGE` | `ghcr.io/bizasbot/shell-pamc:latest` | Set a release tag or digest to pin a version |
| `CPA_IMAGE` | `eceasy/cli-proxy-api:latest` | Full stack only |
| `SHELLPAMC_BIND` | `127.0.0.1:8080` | Host address of the console; change it if the port is taken |
| `CPA_BIND` | `127.0.0.1:8317` | Host address of CPA, full stack only |
| `SHELLPAMC_PUBLIC_URL` | `http://127.0.0.1:8080` | The address browsers use. `https://` only when they really use TLS |
| `SHELLPAMC_BASE_PATH` | `/shell-pamc` | URL prefix; `/` serves the console at the root |
| `TZ` | `UTC` | Calendar for daily totals; match CPA's |
| `SHELLPAMC_USAGE_INGEST_MODE` | `auto` | `off` when another tool collects this CPA's usage |
| `SHELLPAMC_CPA_USAGE_ADDR` | derived from the CPA URL | Override for CPA's usage queue address, Shell-PAMC only |
| `SHELLPAMC_TRUSTED_PROXY_CIDRS` | empty | Addresses of the reverse proxy |
| `SHELLPAMC_DATA_PATH` | `../shell-pamc-data` | Shell-PAMC's data directory |
| `CPA_CONFIG_PATH`, `CPA_AUTH_PATH`, `CPA_LOG_PATH`, `CPA_PLUGIN_PATH` | under `../cpa/` | CPA's files, full stack only |
| `SHELLPAMC_NETWORK_NAME` | `shell-pamc` / `shell-pamc-standalone` | Docker network name (full stack / Shell-PAMC only) |
| `SHELLPAMC_NETWORK_EXTERNAL` | `false` | Shell-PAMC only: `true` joins a network that already exists |
| `SHELLPAMC_UPDATE_CHECK_ENABLED`, `SHELLPAMC_UPDATE_CHECK_ON_PAGE_LOAD` | `true` | Set both to `false` on a machine with no internet |
| `SHELLPAMC_UPDATER_CONTAINER_NAME` | `shell-pamc-updater` | Container name of the updater |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` | The Docker socket the updater mounts; differs with rootless Docker |

Everything else Shell-PAMC reads is in `docs/operations.md`.

## Reaching the console from elsewhere

Every Compose file here publishes on `127.0.0.1` only. From another machine, tunnel over
SSH and open `http://127.0.0.1:18080/shell-pamc/`:

```bash
ssh -L 18080:127.0.0.1:8080 user@server
```

To serve Shell-PAMC over HTTPS, point the existing reverse proxy at `127.0.0.1:8080`, keep the
`/shell-pamc` prefix, and set `SHELLPAMC_PUBLIC_URL` to the address browsers use. Set
`SHELLPAMC_TRUSTED_PROXY_CIDRS` to the proxy's address so Shell-PAMC reads the client IP it
forwards. Do not publish port 8080 on a public interface without TLS: the sign-in
password is CPA's administrator key.

### `/shell-pamc` and `/shell-pamc/`

The console lives at `/shell-pamc/`. Shell-PAMC answers the bare `/shell-pamc` with a permanent redirect
(308) to `/shell-pamc/`, so either address opens it when browsers reach Shell-PAMC directly.

Behind a reverse proxy the bare path only works if the proxy handles it. A rule that
matches `/shell-pamc/` alone never passes `/shell-pamc` to Shell-PAMC, and the visitor gets whatever the
proxy serves for unmatched paths instead of the console. Cover both: redirect the bare
path at the proxy, or forward it and let Shell-PAMC redirect.

nginx (`deploy/nginx.conf` is a complete example that also routes the rest of the host
to CPA):

```nginx
location = /shell-pamc {
    return 308 /shell-pamc/;
}

# No trailing slash on proxy_pass: the /shell-pamc prefix must reach Shell-PAMC unchanged.
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

Check both addresses through the proxy:

```bash
curl -sI https://example.com/shell-pamc | head -n 1                           # 308
curl -fsS https://example.com/shell-pamc/api/healthz
```

With a different `SHELLPAMC_BASE_PATH`, the same holds for that prefix. With `/` there is
no bare path to handle.

## Install as an app

The console is an installable web app: Chrome and Edge on desktop and Chrome on Android
install it from the served page, Samsung Internet does the same on Samsung devices, and
iOS and iPadOS add it to the Home Screen. It then opens in its own window with the brand
mark as its icon, instead of in a browser tab.

Installation is a browser feature, not a console setting, so there is no install button
to look for on a page:

| Where | How |
| --- | --- |
| Chrome or Edge on a computer | The install icon in the address bar, or the browser menu → **Install page as app** / **Apps → Install this site as an app** |
| Chrome on Android with Google Mobile Services | Menu → **Install app** (or **Add to Home screen**) |
| Samsung Internet on a Samsung device | **Add to Home screen** |
| Safari on iOS or iPadOS | Share → **Add to Home Screen**. There is no in-page install prompt, and the console cannot open the Share sheet for you. On iOS and iPadOS 16.4 or later, the Share menu of Chrome, Edge, Firefox and Orion installs it too |
| Safari on macOS | **File → Add to Dock** (Safari 17 on macOS 14 or later) |

Two conditions come from the browser rather than from Shell-PAMC:

- **Chromium's install criteria require a secure context.** Chrome and Edge treat the
  console as installable only when it is served over `https://` through your reverse
  proxy, or over `http://localhost` / `http://127.0.0.1` during local development. A
  plain-HTTP deployment reached by a LAN IP or hostname does not meet that criterion,
  even though the console itself works there. Do not expose the console over plain HTTP
  on a network interface: the sign-in password is CPA's administrator key.
- **The deployment stays reachable.** The PWA adds no service worker and no offline
  cache of API responses or user content, so the installed app cannot load without a
  connection. Existing session and caching rules are unchanged: the sign-in session
  cookie and the hashed static assets keep the behavior they already have. Reinstalling
  is not needed to pick up an update; every launch loads the current bundle from the
  deployment.

The mount point is part of the installed identity. `/`, `/shell-pamc` and a nested
`SHELLPAMC_BASE_PATH` are three different apps to the browser, so installing one does not
replace another, and an app installed at a path that later changes has to be installed
again. The manifest's URLs are relative and resolve against the manifest's own address,
which is what keeps this working behind a proxy that preserves the prefix.

## Native executable

[GitHub Releases](https://github.com/Bizasbot/Shell-PAMC/releases) publish Shell-PAMC for
Darwin (macOS), Windows, Linux and FreeBSD, each on **amd64** and **arm64**. `x86_64`
is amd64; `aarch64` and Apple Silicon are arm64. Unix archives are `.tar.gz`; Windows
archives are `.zip`. CPA must already be installed separately (v8.0.0 or later).
The console and IANA time-zone database are embedded, so neither Node, Go nor Docker
is needed. HTTPS uses the operating system's certificate roots. Darwin/Windows
binaries are unsigned; inspect the release and verify its checksum before handling
any operating-system trust prompt.

Choose one published version and its matching OS/architecture asset. On Unix, set
these values to that release and host; the example uses Linux amd64:

```bash
VERSION=MAJOR.MINOR.PATCH
OS=linux
ARCH=amd64
ASSET="shell-pamc_${VERSION}_${OS}_${ARCH}.tar.gz"
mkdir -p shell-pamc && cd shell-pamc
curl -fLO "https://github.com/Bizasbot/Shell-PAMC/releases/download/v${VERSION}/${ASSET}"
curl -fLO "https://github.com/Bizasbot/Shell-PAMC/releases/download/v${VERSION}/checksums.txt"
```

Verify **only the downloaded archive's entry** (the manifest also lists the other
platforms and installation attachments). On Linux use `sha256sum -c`, on macOS
`shasum -a 256 -c`, or on FreeBSD compare `sha256 -q "$ASSET"` with its entry:

```bash
grep -F "  $ASSET" checksums.txt | sha256sum -c -
tar -xzf "$ASSET"
cp -n .env.example .env
chmod 600 .env
```

On Windows, download the matching ZIP and `checksums.txt` from the same release,
use PowerShell `Get-FileHash -Algorithm SHA256` and compare with that ZIP's manifest
entry, then `Expand-Archive` into a new directory and copy `.env.example` to `.env`.
Restrict access to `.env` and the data directory to the service account with Windows
file ACLs. Do not overwrite an existing configuration or data directory.

Set `SHELLPAMC_MASTER_KEY` once to a random 64-character hex string (`openssl rand -hex 32`
on Unix; use a cryptographic random generator on Windows), set CPA's plaintext
management key and its reachable URL, and match CPA's `TZ`. Keep `SHELLPAMC_VERSION`
unset so the tagged build reports its embedded version. The included template binds
`127.0.0.1:8080`, serves `/shell-pamc` and writes SQLite to `./data` under the working directory.
When CPA is on the same host, its loopback URL works without changing CPA's remote
management policy. Review [usage-reader ownership](#other-panels-and-usage-trackers)
before keeping `SHELLPAMC_USAGE_INGEST_MODE=auto`; use `off` if another reader continues.

Run `./shell-pamc` on Unix or `.\shell-pamc.exe` on Windows from that directory. Verify
[health and connectivity](#verifying-the-install), then open `http://127.0.0.1:8080/shell-pamc/`
and sign in with CPA's management key. For an operator-owned service manager, keep the
same working directory, environment file, service account and data path. Do not open
the listener to the network without configuring remote access and HTTPS.

To upgrade a native install, stop Shell-PAMC alone, back up `.env` and its data directory,
verify/extract the new archive separately, then replace only the executable and start
it from the original working directory. Preserve the master key and state. Verify
health and the new running version. Migrations are forward-only; returning to an
older executable requires restoring the corresponding data backup.

## From source

Needs Go 1.26+, Node.js 22+, pnpm 11+ and a running CPA.

```bash
git clone https://github.com/Bizasbot/Shell-PAMC.git
cd shell-pamc
pnpm install --frozen-lockfile
cp .env.example .env
```

In `.env`, set `SHELLPAMC_MASTER_KEY` (`openssl rand -hex 32`), `SHELLPAMC_CPA_MANAGEMENT_KEY`
and `SHELLPAMC_CPA_BASE_URL`. Then:

```bash
pnpm build
go build -trimpath -o bin/shell-pamc ./cmd/shell-pamc
./bin/shell-pamc
```

Open `http://127.0.0.1:8080/shell-pamc/`. The process runs in the foreground; a service manager
such as systemd keeps it running. Variables in the environment win over `.env`, and
`SHELLPAMC_ENV_FILE` points at a different file. A build from an untagged checkout reports
itself as `v0.1.0-dev`. For hot reload while developing, see
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Verifying the install

```bash
curl -fsS http://127.0.0.1:8080/shell-pamc/api/healthz
```

A working install returns `"status":"ok"` and `"cpa_connected":true`. A container that
Docker reports as healthy is not enough: Shell-PAMC stays up, with `"status":"degraded"`, when
it cannot reach CPA.

| Symptom | Cause |
| --- | --- |
| `permission denied`, or the database will not open | With the release Compose files: `shell-pamc-data` is not owned by `10001:10001`, or is on a network filesystem |
| CPA fails to start and `config.yaml` is a directory | `config.yaml` did not exist at first start. Remove the directory, download the file and start again |
| `status` is `degraded` | Wrong CPA URL or management key, or CPA refuses remote management. See [reaching CPA](#reaching-cpa) |
| Sign-in succeeds, then asks again | `SHELLPAMC_PUBLIC_URL` says `https://` but the browser uses plain HTTP |
| The console asks for a CPA upgrade | CPA is older than v8.0.0 |
| Request records stay empty | Another tool is collecting usage, `SHELLPAMC_USAGE_INGEST_MODE=off` is set, or usage statistics are disabled in CPA |
| Port already in use | Change the host side of the `ports:` entry, or set `SHELLPAMC_BIND` / `CPA_BIND` with the release Compose files |

## Upgrading

Upgrades migrate the database and there is no downgrade: the way back to an older
version is to restore a backup. Shell-PAMC takes an encrypted backup by itself before it
applies a migration; `docs/ops/sqlite-operations.md` is the runbook for backups taken by
hand, and for restoring one. Back up `.env` separately.

> **Breaking change: container, service, network and data names were renamed.** The
> defaults `oh-my-cpa`, `oh-my-cpa-updater` and `oh-my-cpa-data` are now `shell-pamc`,
> `shell-pamc-updater` and `shell-pamc-data`, and the console is served under
> `/shell-pamc` instead of `/omc` (set `SHELLPAMC_BASE_PATH=/omc` to keep the old path).
> The updater finds containers by name, so an installation upgraded in place has to
> recreate them: stop and remove the old containers, rename the services in the Compose
> file, and move the data (`docker volume` contents or the `oh-my-cpa-data` directory)
> to the new name before `docker compose up -d`. The database file inside is renamed
> by Shell-PAMC itself on first start. Back up first.

### From the console

When a newer release exists, **System Information** shows **Update now** beside Oh My
CPA or CLIProxyAPI. Confirming it makes the `shell-pamc-updater` container:

1. pull the new image. For Shell-PAMC this is the exact image named by the release's
   signed manifest; for CLIProxyAPI it is the tag the container already uses;
2. stop the running container and start a replacement with the same environment,
   volumes, ports, networks and Compose labels;
3. wait for the replacement to report healthy, then remove the old container. A
   replacement that exits or stays unhealthy is removed and the old container is started
   again under its own name.

Updating Shell-PAMC disconnects the console for a few seconds and the page reloads on
the new version. Updating CLIProxyAPI restarts the gateway, which interrupts requests in
flight. Each update and its outcome are written to the audit log.

The action is not offered in three cases, and the page says which:

| Case | What to do |
| --- | --- |
| The image is pinned to a version tag or digest, for example `SHELLPAMC_IMAGE=ghcr.io/bizasbot/shell-pamc:vX.Y.Z` | Change the pin and redeploy. The console leaves a pinned image alone, because the next `docker compose up` would put the pinned version back over a database that has already been migrated |
| CPA does not run as a container on the same Docker host | Update CPA where it runs |
| The build carries no release signing key, as a build from source does | Update by hand, below |

### Enabling console updates on an existing deployment

A deployment whose Compose file has no `shell-pamc-updater` service gains one with a
single command on the Docker host. The Compose file is not edited:

```bash
docker run --rm --pull always -u 0 -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/bizasbot/shell-pamc:latest updater install
```

The command:

- finds the running Shell-PAMC container, whichever of the Compose files in this guide
  started it. When more than one is running, add `--container <name>`; when CPA runs as
  a container the updater cannot identify, add `--cpa-container <name>`;
- creates a container named `shell-pamc-updater` from the same image, on a network of the
  same name, and attaches the console to that network. The console finds the updater by
  that name; no setting is added to either container, and CPA is not touched;
- replaces the console with the current release when it is older, with the rollback
  described above. A pinned console is left as it is.

`--pull always` fetches the current image: the host already holds an older
`ghcr.io/bizasbot/shell-pamc:latest`, which has no updater. `-u 0` is needed because the Docker
socket belongs to root. Running the command again
repairs or refreshes the installation. `docker rm -f shell-pamc-updater` removes it, and
the console then shows the command again in place of the update action.

The updater container holds the Docker socket, which amounts to control of Docker on
that host. It runs with a read-only filesystem and no capabilities, publishes no port,
and accepts only two requests from the console: report status, and update Shell-PAMC or
CLIProxyAPI. `docs/operations.md` describes the boundary.

A Compose file that later declares the `shell-pamc-updater` service itself conflicts with
the installed container's name: remove the installed one first with
`docker rm -f shell-pamc-updater`.

### By hand

In the directory that holds the Compose file:

```bash
docker compose pull shell-pamc shell-pamc-updater
docker compose up -d --no-deps shell-pamc shell-pamc-updater
```

Leave `shell-pamc-updater` out of both commands when the file does not declare it. With a
release Compose file, add `-f deploy/compose.full.yml` or `-f deploy/compose.omc.yml` to
both commands.

This upgrades Shell-PAMC and leaves CPA as it is. To move to a specific version, change the
`image:` tag to `ghcr.io/bizasbot/shell-pamc:vX.Y.Z`, or set `SHELLPAMC_IMAGE` in `deploy/.env` with
a release Compose file. With the files in this guide the data is in the Docker volume
`<project>_shell-pamc-data`, and `docker volume inspect` prints its path. How releases
are published is in `docs/releasing.md`.

## Constraints

- Keep `SHELLPAMC_MASTER_KEY` safe and unchanged. Without it the stored data is unreadable.
- One Shell-PAMC per data directory, on a local disk.
- One usage collector per CPA.
