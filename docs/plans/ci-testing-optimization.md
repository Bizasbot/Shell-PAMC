# Revisión de optimización de CI, pruebas y lanzamientos

> **Estado: registro histórico de auditoría.** Las decisiones producidas por esta revisión residen en
> ADR 0032, ADR 0066 y ADR 0068, `docs/testing.md` y `AGENTS.md`; las secciones a continuación
> preservan las mediciones y la evidencia de entrega subyacentes. No es un manual de reglas permanente.

- Fecha de revisión: 7 de octubre de 2026.
- Línea base de código: `dc2002c0bec2968a99c0361526734fd0742d09df` (`master`, versión 0.1.3).
- Estado: implementación adoptada y verificación local completa finalizadas. Las secciones 1–3 y 7 registran la auditoría de la línea base; la sección 9 registra evidencia de entrega, hallazgos informativos restantes y mediciones del despliegue alojado.
- Objetivo: mejorar la latencia de retroalimentación, detección de fallos, diagnosticabilidad y mantenibilidad sin reducir la cobertura requerida existente ni debilitar la integridad de publicación.

## 1. Evidencia y límites

La revisión inspeccionó los flujos de trabajo actuales, comandos de paquetes, planificadores de comprobaciones afectadas y de UI, orquestación de verificación, entornos y escenarios de navegador, fixtures, empaquetado nativo y pruebas de políticas de lanzamiento. La línea base arquitectónica es `CONTEXT.md`, `docs/architecture.md`, `docs/design.md`, `docs/testing.md`, ADR 0032 y ADR 0066. Esta es una revisión de sistema/entorno, no una afirmación de haber auditado manualmente cada aserción de negocio del backend. El inventario contiene 170 archivos de prueba de Go, 65 archivos de suites de lógica en TS más una en JS, 34 archivos de autopruebas de repositorio/Worker y 54 escenarios registrados de navegador en 27 módulos de sondeo. El conteo de archivos no representa porcentajes de cobertura.

La evidencia de GitHub incluye los 15 PRs listados más recientes (#135 al #150, con espacios), 53 ejecuciones de CI en el listado de 60 ejecuciones y cinco ejecuciones de lanzamiento. Se obtuvieron registros detallados para 28 ejecuciones seleccionadas de CI, incluyendo 24 exitosas, y las cinco releases. Las estadísticas a continuación utilizan 45 ejecuciones exitosas de CI: 24 de PR y 21 de push a master. Excluyen ejecuciones fallidas y canceladas.

Las duraciones utilizan marcas de tiempo de Actions: el tiempo de pared del flujo de trabajo es `updatedAt - createdAt`, y la duración del trabajo/paso es `completed_at - started_at`.

### Línea base observada

| Medición | CI en PR | CI en Master |
| --- | ---: | ---: |
| Tamaño de muestra exitosa | 24 | 21 |
| p50 del flujo de trabajo | 234 s | 243 s |
| p95 del flujo de trabajo | 252 s | 263 s |
| p50 del trabajo estático | 108.5 s | 111 s |
| p50 del trabajo de navegador compilado | 195.5 s | 229 s |
| p50 de trabajos de sondeo, fragmentos 1 / 2 / 3 | 171.5 / 218 / 218 s | 169 / 213 / 216 s |
| Suma de duraciones de trabajos p50 | 896.5 s | 927 s |

La preparación de compilación en PR tiene una mediana de 78 s; la ejecución de navegador P0 es de 53.5 s; la ejecución de demo es de 11 s. Las barreras estáticas en sí toman 51 s, dedicándose el resto del trabajo estático a configuración, escaneos y pos-acciones. Las comprobaciones requeridas son `static`, `browser` y el agregado `probes`.

La ejecución de release 37559724448, versión 0.1.3, tomó 960 s:

| Trabajo/paso de release | Duración observada |
| --- | ---: |
| trabajo verify | 596 s |
| paso de verificación completa | 533 s |
| proceso de sondeo dentro de verificación | 456.52 s |
| proceso de navegador de producción completo | 120.90 s |
| trabajo native, tras verify | 304 s |
| paso de compilación/empaquetado nativo | 264 s |
| trabajo publish, junto a native pero tras verify | 238 s |
| compilación de imagen de aceptación / smoke / push multiplataforma | 150 / 17 / 40 s |
| trabajos release / promote | 19 / 28 s |

### Evidencia de fallos

- PR #146 ejecuciones 37488130095 y 37490258518 fallaron en diferentes aserciones de sondeo: desplazamiento de popup nativo reabierto y medición de cabecera en límite móvil. El PR final describe observar el cierre de popup/opciones/diseño y la transición responsiva antes de medir. No cuente estas aserciones históricas como defectos de producto no resueltos.
- La ejecución 37340902046 falló un localizador de panel de modelo en tablero con un timeout de 30 s. Esto establece un modo de fallo, no la presencia actual de esa regresión.
- La ejecución inicial de release 37206359027 falló porque Chromium no se había aprovisionado. La verificación actual de release instala y prueba Chromium primero, fijando las autopruebas de política de release ese orden.

## 2. Qué debe preservarse

1. **La barrera de verificación de releases**: Ningún artefacto público (imágenes de contenedor, binarios nativos, GitHub Releases) se publica sin una verificación completa exitosa sobre la revisión de commit exacta.
2. **Aislamiento de caché en empaquetado nativo**: El trabajo nativo compila sin restaurar cachés compartidos de Actions para dependencias o binarios (ADR 0066).
3. **Firmas y manifiestos**: Todo release de Shell-PAMC requiere su manifiesto firmado con Ed25519 verificado por suma de comprobación.

## 3. Hallazgos y plan de optimización

### F1 — Alto: verificación y publicación en releases pueden discrepar de tag/commit
**Plan:** utilizar el SHA de commit verificado para cada extracción descendente de código fuente y verificar que el tag siga resolviendo a ese commit antes de cualquier publicación visible externamente.

### F2 — Alto: un sondeo puede aceptar silenciosamente un contrato de API no declarado
**Plan:** registrar y fallar ante pares método/ruta no esperados por defecto; declarar lecturas opcionales y respuestas de fallo intencionales explícitamente.

### F3 — Alto: errores de tiempo de ejecución en sondeos se recopilan pero no siempre se aplican
**Plan:** convertir excepciones inexplicadas de página, errores de consola y fallos relevantes de solicitudes en un veredicto a nivel de entorno de pruebas.

### F4 — Medio: configuración aislada de aplicación no equivale a aislamiento de red
**Plan:** permitir únicamente los orígenes exactos del fixture más los esquemas locales de recursos explícitamente requeridos en suites deterministas. Bloquear y reportar intentos de solicitudes externas.

### F5 — Medio: tiempos límite y comportamiento de desmontaje desiguales
**Plan:** introducir propiedad de recursos probada e idempotente con manejo de señales, terminación acotada y escalamiento, lecturas de inicio cancelables y preparación de servidores controlada.

### F6 — Medio, mayor impacto en velocidad: verificación de release es una ruta crítica serial de sondeos
**Plan:** conservar la verificación completa por tag, pero otorgar a las comprobaciones estáticas de release, navegador compilado/demo completo y los tres fragmentos de sondeos trabajos de solo lectura separados con un veredicto de verificación agregado único.

### F7 — Medio: ponderación de fragmentos desactualizada respecto a costos reales
**Plan:** emitir tiempos por escenario legibles por máquina con revisión, evento, arquitectura de ejecutor y contexto de configuración frío/caliente. Actualizar una instantánea de pesos revisada a partir de una ventana acotada de ejecuciones exitosas compatibles.

### F8 — Medio: escenarios largos combinan aserciones distintas y esperas en tiempo real
**Plan:** instrumentar pasos antes de dividir. Separar casos independientes de autorización/política/importación/geometría de OAuth y casos independientes de release/mantenimiento/estado del sistema en escenarios coherentes, sin duplicar configuración ni aserciones.

### F9 — Medio: algunas aserciones de compilación cross-stack se verifican solo tras fusionar
**Plan:** mantener P0 obligatorio y añadir módulos de dominio compilados existentes relevantes a los PRs mediante reglas de impacto conservadoras.

### F10 — Medio: duplicación de políticas de verificación y excesiva dependencia sintáctica
**Plan:** extraer validadores semánticos pequeños para veredictos requeridos, prerrequisitos, cobertura, permisos, inmutabilidad y procedencia de artefactos.

### F11 — Medio: verificación rápida demasiado amplia y diagnósticos en búfer
**Plan:** informar inmediatamente cada comprobación completada, retener un veredicto combinado final y enviar la salida detallada a artefactos de la misma ejecución.

### F12 — Medio: riesgos de concurrencia y dependencias sin línea automatizada dedicada
**Plan:** introducir ejecuciones acotadas con detector de carreras (race detector) para paquetes backend concurrentes. Ejecutar auditorías de avisos de dependencias en una línea de mantenimiento explícita con responsable, justificación y expiración.

## 4. Secuencia de entrega y criterios de aceptación

Cada etapa constituye un PR separable y revisable:
- Etapa A: Coincidencia exacta de SHA de release y tag; diagnósticos en fallos de verificación de release (F1, parte de F5).
- Etapa B: Contratos estrictos de simulaciones, veredicto global de errores, límite de red y propiedad de recursos (F2–F5).
- Etapa C: Tiempos estructurados, veredictos inmediatos de comprobaciones y pesos revisados (F7, parte de F11).
- Etapa D: Verificación de tag fragmentada y validación semántica de flujos de trabajo (F6, parte de F10).
- Etapa E: Descomposición de escenarios lentos y decisión de cobertura de PR compilado (F8, F9).
- Etapa F: Experimento de optimización de compilación nativa/Docker.
- Etapa G: Selección de lógica local, líneas de carreras/avisos y pruebas de humo en tiempo de ejecución nativo (F10–F12).

## 5. Objetivos y reglas de decisión

- Conservar primero todas las aserciones requeridas y la identidad exacta de publicación. Una salida verde más rápida no es un éxito si un fallo deliberado puede pasar desapercibido.
- Revertir una optimización cuando pierda capacidad de detección de mutaciones, filtre estado de fixtures, amplíe la confianza de artefactos inesperadamente o aumente los costos de p95/ejecutores más allá del límite aceptado.

## 6. Obligaciones de verificación y documentación

Durante la implementación utilice `pnpm test:fast` y los comandos pertinentes de `pnpm check:ui`; al completar lógicamente ejecute `pnpm verify` y `pnpm check:ui`. Cambios en compilación, entorno y flujos de trabajo requieren adicionalmente `pnpm verify:full`.

## 7. Registro de ejecución de auditoría de línea base

- Árbol de trabajo inicial: limpio.
- `pnpm verify` baseline local: aprobado en 50.97 s.
- Reproducción de fixture de API desconocida: HTTP 200 y objeto vacío, confirmando F2 sin alterar pruebas del repositorio.
- Auditoría de dependencias: código de salida 1 con tres avisos divulgados.
- Reproducción de fallo de error en tiempo de ejecución: una excepción inyectada en página fue capturada pero el entorno reportó un escenario aprobado sin comprobaciones fallidas, confirmando F3.
- Reproducción de mutación de política de releases: alterar referencias descendentes de checkout fue aceptado por el validador anterior, confirmando la brecha de control F1.

## 8. Índice de evidencia reproducible

Consulte ejecuciones indexadas con `gh run view RUN_ID --log` o sus metadatos de tareas con `gh api repos/Bizasbot/Shell-PAMC/actions/runs/RUN_ID/jobs`. Utilice los IDs exactos registrados.

## 9. Implementación adoptada y validación

La implementación adoptada preserva las comprobaciones requeridas `static`, `browser` y el agregado `probes`, el catálogo completo y los ocho objetivos nativos de release. ADR 0068 registra la propiedad de la verificación y el DAG de releases; ADR 0066 continúa rigiendo el aislamiento de caché en publicación nativa.

- Resolución exacta de identidad de releases sin almacenamiento en caché en el bootstrap inicial.
- Métodos/rutas no declaradas en la API devuelven 501 y fallan el veredicto en sondeos de navegador.
- DAG de release con fragmentación de sondeos en paralelo antes del empaquetado nativo y la publicación en Docker.
- Catálogo de sondeos balanceado y descompuesto en 65 escenarios.
- Acciones de CI y release inmutables con persistencia de credenciales de checkout desactivada.
