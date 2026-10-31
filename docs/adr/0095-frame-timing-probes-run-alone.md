# ADR 0095: Las sondas de temporización de fotogramas se ejecutan en solitario

- Estado: Aceptado; la propiedad de la ejecución se actualizó para Playwright Test el 2026-10-20
- Fecha: 2026-10-12
- Modifica: La programación de dos workers del ADR 0091, para escenarios que afirman el movimiento fotograma a fotograma.

## Contexto

El ADR 0091 ejecuta dos contextos de escenarios a la vez dentro de cada lote de sondas y registra el coste: los escenarios individuales tardan más. La mayoría de los escenarios esperan a que se cumplan condiciones, por lo que una página más lenta solo hace que esperen más tiempo. Dos no lo hacen: `scroll-smoothing` toma muestras de la lista de solicitudes una vez por fotograma de animación y falla cuando una rueda que gira la deja detenida en tres o más fotogramas mostrados, y `request-list-touch` toca una lista desplazada mediante un flick y requiere que esté deslizándose por inercia en ese momento. Los defectos contra los que protegen son una interrupción en cada muesca (alrededor de doce fotogramas en un giro de seis muescas) y una lista que nunca se desliza por inercia. Un contexto hermano que se renderiza en el mismo ejecutor de CPU pierde algunos fotogramas que el producto no pierde, y la solicitud de extracción se ejecuta en ejecutores alojados y falló localmente exactamente en estas comprobaciones mientras todos los escenarios basados en condiciones que estaban al lado pasaban. Un reintento o un umbral más laxo también admitirían parte del defecto que cada comprobación existe para detectar.

## Decisión

1. Un escenario que afirma el movimiento fotograma a fotograma se marca como `shouldRunAlone` en
   `scripts/acceptance/scenarios.mjs`, con su razón junto a la marca. Hoy en día esos son
   `scroll-smoothing` y `request-list-touch`.
2. `scripts/testing/probes.ts` ejecuta los escenarios compartidos con el recuento de workers de Playwright Test configurado primero, y luego invoca los escenarios marcados con un solo worker. Un fallo en la parte compartida aún ejecuta la parte exclusiva, y se conserva cada veredicto.
3. Los umbrales de fotogramas, los presupuestos por escenario y la pertenencia a los shards permanecen protegidos; el ejecutor nativo posee los plazos y los informes.
   Marcar un escenario no es una forma de hacer que uno inestable pase: es para un escenario cuya afirmación trata sobre fotogramas, indicando la razón a nivel de fotograma.

## Consecuencias

- Un lote que contiene un escenario marcado toma el tiempo en serie de ese escenario además de la parte
  compartida, alrededor de un minuto en el shard que contiene a ambos.
- `--workers 1` y `verify:full:serial` se comportan como antes; la marca no cambia nada cuando
  solo hay un worker.
