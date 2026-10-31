# ADR 0001: Backend en Go con React embebido y SQLite

- Estado: Aceptado
- Fecha: 2026-02-20

## Contexto

Oh My CPA es una capa de gestión e identidad autohospedada para CLIProxyAPI. Requiere una API HTTP de ejecución prolongada, integración con la API de gestión de CPA, un recolector de uso RESP, sincronización de metadatos y una interfaz de usuario web que funcione en una subruta configurable como `/omc`. El despliegue previsto es una única pila de Docker Compose junto a CPA, con una huella operativa reducida y un directorio de datos persistentes simple.

## Decisión

Utilizar un monolito modular con:

- Go para el backend y los trabajadores en segundo plano.
- React con TypeScript, Vite y Ant Design para el frontend.
- La compilación de React embebida en el binario de Go mediante `go:embed`.
- SQLite en modo WAL para el primer modelo de despliegue, con una sola réplica de Oh My CPA.
- La API de gestión de CPA a través de HTTP y un pequeño cliente RESP personalizado para la recolección de uso.
- Conexiones directas de servicio a servicio con CPA dentro de la red de Compose; el proxy inverso público gestiona únicamente el tráfico del navegador.

El backend posee el contrato de la ruta base en tiempo de ejecución. La ruta por defecto de la UI es `/omc`, la API es `/omc/api/v1` y los archivos multimedia son `/omc/media`. El proxy conserva el prefijo.

## Consecuencias

### Positivas

- Un solo binario y un solo contenedor son fáciles de distribuir.
- Las compilaciones sin CGO pueden apuntar a arquitecturas comunes al usar `modernc.org/sqlite`.
- El modelo de concurrencia de Go se adapta bien a recolectores de larga duración y al apagado ordenado (graceful shutdown).
- SQLite mantiene la instalación autohospedada simple y fácil de respaldar.
- TypeScript mantiene un modelado seguro para la capa de identidad de recursos y los formularios de Ant Design.

### Compensaciones (Trade-offs)

- SQLite es un punto de partida de escritor único y réplica única; el escalado horizontal requerirá en el futuro un diseño con PostgreSQL y concesiones (leases).
- La ingesta de uso debe utilizar bandejas de entrada duraderas (inboxes), idempotencia e indicadores de completitud, ya que la semántica de cola/PubSub de CPA no es un registro de entrega única (exactly-once).
- Los recursos del frontend deben compilarse antes del binario de Go y copiarse en el directorio de embebido (`embed`).
- El proxy inverso público y la aplicación deben acordar la preservación del prefijo; eliminar `/omc` rompe el enrutamiento y las devoluciones de llamada (callbacks).

## Alternativas consideradas

- **Backend en Node.js**: viable, pero menos alineado con CPA/Usage Keeper y menos conveniente para un único binario compacto.
- **Andamio completo (scaffold) de Ant Design Pro**: rechazado para el envoltorio inicial del producto; se utiliza Ant Design y ProComponents seleccionados sin permitir que un diseño de administración genérico defina la experiencia orientada a recursos.
- **PostgreSQL desde el primer día**: pospuesto porque el objetivo inicial es un despliegue autohospedado personal o para equipos pequeños, donde un archivo SQLite duradero constituye una instalación sustancialmente más simple.
- **Un cliente Redis genérico para CPA RESP**: rechazado porque CPA expone únicamente un subconjunto mínimo de RESP y los clientes genéricos pueden enviar comandos de negociación no compatibles.
