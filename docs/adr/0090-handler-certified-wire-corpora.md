# ADR 0090: Korpora de red certificados por el manejador (Handler-certified wire corpora)

- Estado: Aceptado
- Fecha: 2026-10-09

Utilizar un pequeño corpus de red revisado para la paridad crítica de la API, verificado de manera independiente contra manejadores reales de Go/autenticación/SQLite, el cliente frontend tipado real y el despachador predeterminado de Browser Mock. Preferences es el primer piloto: el JSON sin procesar y los enums propiedad del cliente hacen que un esquema generado amplio sea un reemplazo pobre para el comportamiento real de estado, valores nulos, lectura (*readback*), listas blancas (*allowlist*) y metadatos que no estén en UTC. Los ejemplos compartidos reducen el mantenimiento repetido de respuestas esperadas sin tratar una respuesta simulada (*mock*) o generada como el oráculo del servidor.

Mover los conjuntos de pruebas/configuración de integración del frontend a `web/tests`, fuera del grafo de importación de producción pero dentro de la verificación de tipos y el descubrimiento automático. Esto reemplaza únicamente la elección de la ubicación de las pruebas en `web/src` descrita en el ADR 0089: los bordes de fixtures exclusivos para pruebas no deben ampliar silenciosamente el impacto en el producto, y una importación en producción de una prueba sigue sin resolverse y falla de forma estricta (*fail-closed*) en el grafo del producto.

Reutilizar el ejecutor de integración del frontend existente para `*.contract.test.ts` bajo el entorno Node de Vitest; las decisiones puras se quedan en `node:test`, las afirmaciones renderizadas se quedan en `jsdom`, y las afirmaciones de motor/pila cruzada se quedan en Chromium. El fixture es por contexto y está intencionalmente acotado: no es otro repositorio, capa de autorización o validador IANA completo. Los métodos de fixture no soportados siguen siendo fallos del arnés. Las modificaciones al corpus/fixture deben seleccionar a todos los consumidores independientes; la CI completa conserva el descubrimiento completo. Esta decisión no altera ninguna API pública ni el tiempo de ejecución en producción.

La propiedad de los casos, las mutaciones negativas, las mediciones y la cobertura restante se registran en `docs/plans/architecture-governance.md`; los comandos se encuentran en `docs/testing.md`.
