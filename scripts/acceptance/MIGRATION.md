# Registro de migración de aceptación del navegador

Cada aserción en la suite de aceptación del navegador está clasificada una vez, y cada
aserción que abandona el navegador nombra la prueba que la reemplazó. El propósito de
este registro es que ninguna afirmación se descarte sin un reemplazo: una aserción puede
trasladarse, pero no puede desaparecer.

## Archivos de sondeo que fueron eliminados

Más allá de la suite de aceptación, se eliminaron seis puntos de entrada de sondeo independientes:
`browser-usage-events.mjs`, `browser-refresh-sync.mjs`, `browser-icon-picker.mjs`,
`browser-dashboard-charts.mjs`, `browser-column-alignment.mjs` y
`browser-performance.mjs`. Cada comprobación digna de conservarse reside ahora en
el catálogo de sondeos (`scripts/acceptance/scenarios.mjs`). Playwright Test ejecuta
`scripts/acceptance/tests/catalog.spec.ts` contra un servidor dev propio de la invocación
y navegadores propiedad del worker:

| Archivo anterior | Dónde residen sus aserciones ahora |
| --- | --- |
| `browser-column-alignment.mjs` | el escenario `column alignment`, sin cambios en rigor |
| `browser-icon-picker.mjs` | el escenario `icon picker stacking`, sin cambios en rigor |
| `browser-dashboard-charts.mjs` | el escenario `dashboard chart marks`, sin cambios en rigor |
| `browser-refresh-sync.mjs` | el escenario `refresh sequencing`, incluida la prueba de ordenamiento con respuestas retenidas |
| `browser-usage-events.mjs` | el escenario `request list interactions` para el límite de virtualización, el redimensionamiento de columnas y su persistencia, acceso por teclado al panel de detalles y la barrera de descarga de registros de solicitud |
| `browser-performance.mjs` | nada — ver abajo |

Aserciones que deliberadamente no se restauraron, enumeradas para que la baja sea una decisión explícita
y no un descuido:

- **La coreografía de gestos de colapso** (`first wheel down collapses the header`,
  `row 1 remains visible after entering full-screen mode`, el rebote al girar la rueda hacia arriba y
  el recorrido de desplazamiento hasta el último registro) de `browser-usage-events.mjs`. El sondeo conserva
  la aserción de ventana acotada, que es la parte que hace utilizable una lista larga. El *cronograma* de desplazamiento
  está probado por unidad en `scripts/test-scroll-intent.ts`; lo que ninguna prueba detecta ahora es que el encabezado no se colapse ante un gesto de rueda.
- **La medición de ancho mínimo forzado de tokens** (`token column reached its 130px minimum`,
  `token cell holds the largest real numbers at its minimum width`). `column alignment` cubre la geometría de pistas, truncamiento y anulación responsiva; esta era una segunda medición del mismo diseño en un ancho específico.
- **El barrido interactivo de 320px.** Redundante con las comprobaciones de desbordamiento y paneles en 390px y 768px de la suite de aceptación. 320px sigue siendo un ancho admitido — el selector de ajustes y la comprobación de viewport de archivos de autenticación lo verifican —, por lo que se descartó el barrido, no el soporte de viewport.
- **`browser-performance.mjs` en su totalidad.** Verificaba tiempos de carga de página contra un servidor dev, lo cual mide la simulación y la máquina en lugar del producto. No formaba parte de ninguna barrera y sus cifras nunca fueron un presupuesto contractual. La única aserción de tiempos que constituye un presupuesto real — que la página de precios abra en menos de 3s — reside en la suite de aceptación.

## Aserciones de páginas de demostración en Go

`scripts/demo-smoke.mjs` comprueba que Model Square renderice las entradas de modelos conectados. URLs heredadas de credenciales, OAuth y cuotas siguen probándose:
deben alcanzar el espacio de trabajo unificado de OAuth y renderizar registros de credenciales, opciones de conexión y registros de cuota coincidentes respectivamente. Lecturas directas de espacio de trabajo, directorio de agentes y entradas de auditoría también están cubiertas. Las aserciones de rechazo en servidor, claves enmascaradas y escrituras no duraderas se mantienen sin cambios.

## Verificación de carga y tamaño en producción

`scripts/check-bundle-budget.mjs` gobierna la política de artefactos de producción mediante
`pnpm check:bundle` (ADR 0053). Valida la propiedad de Rollup y bordes estáticos/dinámicos contra hashes de fragmentos, exigiendo módulos diferidos de página/shell/gráficos/Markdown y el límite del editor bajo demanda. Se reportan métricas sin procesar/gzip y crecimiento exacto respecto a la base; el crecimiento ordinario es informativo y topes amplios de anomalías permanecen bloqueantes.
Esto reemplaza las cuotas de entrada única y fragmentos con nombre, con autopruebas de gráfico/techo que preservan su intención de detección de regresiones.

CI, `verify:build`, `verify:e2e`, `verify:full` y su variante serial utilizan el mismo verificador tras compilar. La verificación local en CI/completa preserva su veredicto de fallo mientras sigue recopilando evidencia de navegador/demo de producción; comandos de navegador independientes prueban comportamiento y no una política de tamaño duplicada.

## Ruta de humo (Smoke) dentro de P0

Las dos comprobaciones de ruta de humo en `scripts/acceptance/usage-events/requestList.mjs` (sin errores de consola ni errores de página al final de la ruta de humo) se ejecutan en todos los modos en lugar de solo bajo `--smoke`. P0 y la ejecución completa contienen por tanto cada aserción de humo en el mismo punto, mientras que CI ejecuta la suite completa de aceptación en cada evento (ADR 0068).

## Clases

| Clase | Significado |
| --- | --- |
| `PURE` | Una decisión sobre la entrada propia del operador. Demostrable invocando el módulo que llama la página. |
| `COMPONENT` | Requiere un árbol React renderizado, pero no un motor de navegador real. |
| `BROWSER` | Requiere Chromium real: geometría, apilamiento, pruebas de impacto (hit-testing), pintura, virtualización, foco, ciclo de vida. |
| `CROSS-STACK` | Requiere la pila completa: SPA + binario Go + fixture SQLite + CPA simulado. |

## Migrado fuera del navegador

La lógica de políticas granular y permutaciones de estado a continuación tuvieron su verificación principal y exhaustiva migrada desde pasos de navegador sensibles a tiempos hacia pruebas deterministas de lógica en Node (como `scripts/test-usage-events-view-policy.ts`). Los flujos de trabajo de usuario integrados de alto nivel de extremo a extremo continúan probándose mediante `scripts/browser-acceptance.mjs` y sus módulos de dominio bajo `scripts/acceptance/`.

| Aserción original | Clase | Reemplazo |
| --- | --- | --- |
| Una edición de filtro confirma la dimensión nombrada en la URL | `PURE` | `scripts/test-usage-events-view-policy.ts` — *una edición de filtro reemplaza la dimensión nombrada y mantiene la ventana* |
| Eliminar una etiqueta limpia el filtro de la URL | `PURE` | *una edición de filtro puede eliminar una dimensión, lo cual una combinación no podía expresar*; *establecer, ampliar y limpiar una dimensión…* |
| Limpiar todo elimina cada filtro pero conserva la ventana y el tamaño de página | `PURE` | *limpiar todo elimina cada filtro y el veredicto pero conserva ventana y tamaño de página* |
| Limpiar todo conserva una ventana elegida explícitamente | `PURE` | *limpiar todo deja una ventana absoluta elegida explícitamente en el lugar* |
| Un filtro limpio permanece limpio tras recargar | `PURE` | *la vista guardada se deriva de la URL navegada, no se combina de la consulta previa* — la derivación que esto reemplazó era el defecto que lo resucitaba |
| La vista guardada restaura ventana y tamaño de página en la ruta base | `PURE` | *una ventana absoluta se guarda como límites…*; *la vista guardada porta las opciones de diseño suministradas* |
| Un filtro de costo viaja como exactamente un parámetro | `PURE` | *el costo se almacena una vez, como campo propio, y nunca dentro del mapa de filtros*; recorridos de `filterParamsToUrl` fijados en `test-usage-event-view.ts` |
| El menú de tiempo establece una ventana explícita | `PURE` | *un ajuste preestablecido reemplaza un rango absoluto en lugar de apilarse a su lado*; *un rango absoluto reemplaza un preestablecido…* |
| Un filtro y una ventana coexisten en la URL | `PURE` | *una edición de filtro reemplaza la dimensión nombrada y mantiene la ventana* |
| Un rango invertido se explica en línea y bloquea Aplicar | `PURE` | *un rango invertido o igual es rechazado*; *el resultado de validación mapea a la clave del mensaje* |
| Un rango posterior al momento actual se rechaza | `PURE` | *un rango que sobrepase el momento actual se rechaza* |
| Cada ajuste preestablecido aparece exactamente una vez | `PURE` | *cada ajuste preestablecido configurado aparece exactamente una vez, cualquiera sea el seleccionado*; *el grupo rápido y el resto particionan los preestablecidos* |
| Un alias escrito marca el borrador como modificado | `PURE` | `isDraftDirty` en `test-usage-event-view.ts` |
| Un retardo de búsqueda en cola no revive un filtro limpio | `PURE` | *una invalidación a través del controlador suprime una confirmación en cola*; *una invalidación suprime un callback ya disparado pero no ejecutado* |
| La navegación de historial descarta pulsaciones de teclas pendientes | `PURE` | *adoptar un valor confirmado externo cancela la pulsación en cola* |
| El cuadro de búsqueda sigue el término navegado entre dos vistas guardadas | `PURE` | *una pulsación tras una navegación externa confirma contra la nueva vista* |
| Un parámetro que no se puede aplicar se informa, no se descarta | `PURE` | `rejectedEventParams` — fijado en `test-usage-event-view.ts` |
| Un valor de filtro excesivamente largo o inválido se rechaza | `PURE` | `readEventQuery` / `parseUsageRangeBound` en `test-usage-event-view.ts` |
| Un sondeo no vuelve a leer las facetas | `PURE` | *cada motivo para omitir un ciclo se respeta* + política `staleTime` en `staleTime`/`pollingPolicy` |
| La actualización automática inicia apagada y no indica cadencia | `PURE` | *la cadencia no es una ocurrencia tardía de ida y vuelta*. El estado renderizado del interruptor sigue siendo aserción de navegador. |
| El veredicto de resultado es un filtro sin parámetro de URL propio | `PURE` | *se confirma un veredicto de resultado, y "todos" lo quita en vez de almacenarlo* |
| Un cambio de filtro descarta el cursor de paginación | `PURE` | *una edición de filtro nunca toca el cursor de paginación que está a punto de invalidar* |
| Una actualización que no pudo drenar CPA se informa como incompleta | `PURE` | *una extracción que no pudo drenar CPA se informa como incompleta en lugar de exitosa* |
| Un recolector deshabilitado es información, no un error | `PURE` | *un recolector deshabilitado es información, no un fallo* |
| La actualización vuelve a leer lista, facetas y estado de canalización | `PURE` | *una actualización completada vuelve a leer cada superficie que la extracción pudo modificar* |
| Una etiqueta de invocador muestra el alias en vez de la huella | `PURE` | *una etiqueta de invocador prefiere el alias, luego la máscara, luego la huella sin procesar* |
| Una etiqueta de credencial muestra el nombre del archivo | `PURE` | *una etiqueta de credencial muestra el nombre del archivo en vez de la huella almacenada* |
| El orden de filas es por hora de solicitud, más reciente primero | — | Regresión en Go: `TestListUsageEventsOrdersByRequestTime` en `internal/repository`. |

## Retenido en el navegador

| Aserción | Clase | Por qué debe permanecer |
| --- | --- | --- |
| `/shell-pamc` redirige, el inicio de sesión rechaza claves incorrectas, una clave válida crea sesión | `CROSS-STACK` | Límite de autenticación. Atributos de cookie, estado de redirección y derivación `Secure` son hechos de navegador/HTTP. |
| Cada ruta se renderiza sin desbordamiento de documento | `BROWSER` | Diseño visual, no solo presencia. |
| Densidad general de gestión de OAuth, integridad de 6 ventanas en Cuota, no inicio en Conectar y reflujo en 320/375px | `BROWSER` | Densidad y geometría se miden a partir de filas renderizadas. |
| La barra de marca sigue el tema de la consola con tinta renderizada | `BROWSER` | Píxeles y tema de la consola en lugar del esquema del SO. |
| La barra colapsada centra su marca | `BROWSER` | Geometría tras animación de ancho. |
| El tema persiste tras recargar y se aplica durante la hidratación | `BROWSER` | `localStorage` más ciclo de vida del navegador. |
| Material secreto nunca llega al DOM, almacenamiento o cuerpo de respuesta | `CROSS-STACK` | Predicado de seguridad sobre la pila real. |
| La sesión expira cuando se borra la cookie | `BROWSER` | Ciclo de vida de cookies. |
