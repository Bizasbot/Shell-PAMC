# Contribuir a Shell-PAMC

¡Gracias por tu interés en contribuir a Shell-PAMC! Aceptamos reportes de errores, sugerencias de funciones, mejoras de documentación y contribuciones de código.

Los reportes de errores y las solicitudes de funciones se gestionan a través de los formularios en [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/); las vulnerabilidades de seguridad se informan de forma privada como se describe en [`SECURITY.md`](SECURITY.md).

---

## Código de conducta y reglas básicas

- **Cero exposición de secretos**: Nunca envíes claves API reales, tokens, archivos de autenticación ni datos de producción sensibles en pull requests, issues o en el historial de commits.
- **Explica el porqué, no el qué**: Los comentarios de código deben centrarse en la justificación del diseño, restricciones no obvias y casos límite.
- **Mantén la documentación precisa**: Si tu cambio altera un endpoint, configuración, token de interfaz o límite arquitectónico, actualiza los documentos afectados en el mismo pull request (consulta [`AGENTS.md`](AGENTS.md) §7).

---

## Primeros pasos

### Requisitos previos

- **Go**: 1.26+ (fijado a `1.27.3` en CI)
- **Node.js**: 22+ (fijado a `22.23.4`)
- **pnpm**: 11+ (fijado a `11.19.0`)
- **Air**: (opcional, para recarga en caliente de Go): `go install github.com/air-verse/air@latest`

### Configuración del entorno de desarrollo local

1. **Haz un fork y clona el repositorio**:
   ```bash
   git clone https://github.com/<tu-usuario>/Shell-PAMC.git
   cd Shell-PAMC
   pnpm install --frozen-lockfile
   ```

2. **Configura el entorno local**:
   ```bash
   cp .env.example .env
   ```
   Proporciona una cadena hexadecimal de 32 bytes para `SHELLPAMC_MASTER_KEY` (`openssl rand -hex 32`) y tu clave de administración local de CLIProxyAPI para `SHELLPAMC_CPA_MANAGEMENT_KEY`.

3. **Inicia los servidores de desarrollo**:
   ```bash
   pnpm dev
   ```
   Esto inicia Air (monitoreando el backend de Go en `:8080`) y Vite (servidor de desarrollo del frontend en `:5173`) de forma concurrente. Accede a la consola en **`http://127.0.0.1:5173/shell-pamc/`** (`/shell-pamc` redirige allí).

---

## Barreras de verificación

La verificación se estructura en torno a tres momentos: mientras editas, cuando una función está
completa y en el pull request. [`AGENTS.md`](AGENTS.md) §5 contiene la tabla de momentos y
las reglas para mantener las barreras rigurosas; [`docs/testing.md`](docs/testing.md) indica a qué
capa pertenece cada aserción y cómo se registra una nueva prueba. En resumen:

```bash
pnpm test:fast    # mientras editas: solo las comprobaciones que los archivos modificados necesitan
pnpm verify       # función completa y antes de hacer push
pnpm check:ui     # los escenarios de navegador que el cambio puede alcanzar
```

No vuelvas a ejecutar una barrera completa tras cada edición. Cuando falle una comprobación, vuelve a ejecutar esa comprobación primero. Ambos
comandos de sondeo de interfaz utilizan el servidor de desarrollo; la cobertura de artefactos de producción proviene de la aceptación
del navegador y de la demo. La lista completa de comandos está en [`AGENTS.md`](AGENTS.md) §8 y
[`package.json`](package.json).

---

## Pautas de desarrollo

### 1. Localización
Las cadenas visibles para el usuario nunca deben estar escritas directamente en las respuestas del backend ni en componentes de React. Añade todas las cadenas nuevas como pares `[zh, en]` en `web/src/i18n/index.tsx`, añade las entradas correspondientes a `web/src/i18n/locales/zh-Hant.ts` y `web/src/i18n/locales/ms.ts`, y verifica con `pnpm check-i18n`.

### 2. Estilos y tokens de tema
- Nunca uses valores hexadecimales de color fijos en los componentes. Lee la paleta resuelta desde `web/src/theme/palette.ts` o usa las variables CSS de `docs/design.md`; los dieciocho tokens derivados se calculan, así que recurre a la relación en lugar de volver a derivarla.
- Shell-PAMC utiliza un lenguaje de diseño **terminal-flat**: cero sombras de caja (`box-shadow: none`), radios de borde de 4px y bordes finos de 1px. Los colores de estado (verde, ámbar, rojo) están reservados estrictamente para la salud semántica del sistema.

### 3. Listas permitidas de API y DTO
- El backend aplica listas estrictas de permitidos para DTOs en `internal/api/`. Las respuestas ordinarias no deben transmitir cargas útiles sin procesar ni sanitizar de CPA. El Plugin Host confiable es la excepción acotada de respuesta nativa en ADR 0067, con separación de credenciales, auditoría, serialización y respaldos. Las URLs de destino arbitrarias siguen estando prohibidas.

---

## Enviar un Pull Request

1. Crea una rama descriptiva a partir de `master`:
   ```bash
   git checkout -b feat/nombre-de-tu-caracteristica
   ```
2. Realiza tus commits con mensajes convencionales y concisos (`feat: ...`, `fix: ...`, `docs: ...`, `test: ...`).
3. Ejecuta las barreras de finalización de funciones antes de hacer push (CI ejecuta el catálogo completo de navegadores):
   ```bash
   pnpm verify
   pnpm check:ui
   ```
4. Haz push de tu rama a tu fork y abre un Pull Request contra `master`.
5. Los pull requests se revisan contra [`.coderabbit.yaml`](.coderabbit.yaml), que orienta al revisor sobre los invariantes en [`AGENTS.md`](AGENTS.md). Un pull request que no sea borrador se revisa una vez, al abrirse; comenta `@coderabbitai review` para solicitar una revisión posterior. Un pull request de preparación de release, titulado `chore(release): prepare vX.Y.Z`, está exento: los cambios que describe ya fueron revisados al fusionarse.
6. Completa la plantilla de pull request ([`.github/pull_request_template.md`](.github/pull_request_template.md)): el problema y la solución, los documentos de contexto actualizados y las barreras ejecutadas. Titula el pull request `type(scope): asunto en minusculas`.
7. Cuando tu Pull Request se fusione mediante squash, GitHub añadirá automáticamente `(#<NUMERO_PR>)` al título del commit (por ejemplo, `feat: add client key alias (#12)`), manteniendo un historial lineal y auditable que cumple el estándar del proyecto.
