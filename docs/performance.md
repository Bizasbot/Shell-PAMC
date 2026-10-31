# Auditoría de capacidad de respuesta de la consola

> **Estado: registro histórico de mediciones.** Medido sobre el commit base indicado abajo;
> las cifras describen esa revisión en esa máquina, no una garantía vigente.

## Alcance y método

Esta auditoría se midió el 1 de octubre de 2026, a partir del commit `6b2d7e1` en
`perf/responsive-console`. Cubre la consola embebida, su entrega HTTP y la ruta de
lectura de uso. Las mediciones usan el fixture de demostración de Go, no credenciales
de producción ni un despliegue externo de CPA.

El navegador es Chromium a 1440 × 900, con limitación de CPU de 4× y un enlace remoto
simulado: 60 ms de latencia, 20 Mbps de bajada y 5 Mbps de subida. Las mediciones de
primera carga usan un contexto de navegador nuevo. Dos pasadas de navegación por el menú
distinguen el código/los datos de ruta en frío de las visitas en caché. La observación de
navegación termina cuando un elemento representativo de la página es visible; las tareas
largas se observan durante el intervalo posterior de montaje de gráficos.
Son tiempos de diagnóstico sintéticos, no garantías de latencia en producción.

Los binarios de medición usan directorios de datos desechables, escuchas en loopback y
`isolatedAppEnvironment` de `scripts/acceptance/environment.mjs`, con el modo demo activado.
`scripts/demo-smoke.mjs` documenta la preparación del fixture correspondiente. Use
`Network.emulateNetworkConditions`, `Emulation.setCPUThrottlingRate` y `Profiler` del
Chrome DevTools Protocol para reproducir la limitación y la atribución de CPU. Un
`PerformanceObserver` de `longtask` distingue el retraso de transferencia del bloqueo del
hilo principal. Las muestras del perfil identifican puntos críticos; no son tiempo
transcurrido adicional que deba sumarse a los tiempos de navegación.

## Hallazgos

### El renderizado dominaba la navegación en caché

La revisita base al Dashboard tardó cerca de tres segundos a pesar del código y los datos
en caché. Su tarea ininterrumpida más larga del hilo principal superó los dos segundos. El
mapa de calor convertía repetidamente los mismos instantes de primer almacenamiento/as-of
a fechas de calendario con zona horaria para cada celda, y construía un formateador de
fechas Intl para el nombre accesible de cada celda. El tiempo propio de CPU incluyó cerca
de 521 ms en la conversión de zona horaria de dayjs y 268 ms en el formateo de fechas del
mapa de calor.

La primera ronda de implementación resuelve los dos días de observación una vez por
revisión y usa una caché acotada de formateadores Intl que distingue configuración regional
y opciones. La zona horaria del despliegue y la interpretación del horario de verano por
instante siguen proviniendo de los helpers de tiempo compartidos. Las fechas civiles se
formatean mediante un portador UTC, incluidas las fechas que no existieron en el calendario
local del navegador. Las etiquetas de reloj de los agentes reutilizan la misma caché de
formateadores con una zona explícita.

### HTTP entregaba el texto sin comprimir

El binario enviaba antes JS/CSS/SVG embebidos y el JSON de la API como representaciones
identity. Los ejemplos de proxy inverso suministrados tampoco añadían compresión. La
negociación gzip implementada en el servidor funciona con la configuración de proxy y el
subpath existentes. Los recursos de texto inmutables reutilizan representaciones comprimidas
acotadas; el JSON ordinario usa codificadores agrupados en pool de máxima velocidad. Los
eventos en streaming y las descargas conservan su comportamiento de entrega.
`docs/architecture.md` registra la elegibilidad, los límites de caché y los contratos de
cabeceras.

### El código de ruta en frío comenzaba en la navegación

Las páginas son diferidas (lazy), y una navegación en frío espera el módulo de su página
antes de montarla. Ahora el menú precarga el módulo de destino al pasar el cursor, al
enfocar con el teclado o al iniciar un toque, compartiendo esa importación con la
navegación. No inicia las consultas de la página ni sus efectos de montaje. El inicio de
sesión y el editor YAML bajo demanda de la página de configuración conservan su límite de
carga.

La precarga adelanta la entrega del código respecto del clic cuando hay un margen previo
de intención; no abarata el cómputo de la página. La navegación por clic inmediato mostró
resultados variables, por lo que no se le atribuye una aceleración general de la navegación
en caché.

### Las lecturas del backend solían ser pequeñas frente al trabajo del navegador

La auditoría de demostración encontró que los endpoints ordinarios estaban mayormente en el
rango de 1–30 ms. Una lectura de facetas de uso de 90 días tardó aproximadamente 120–130 ms
y el mapa de calor anual de tokens cerca de 47–49 ms. Gzip reduce su tamaño de transferencia
pero no su trabajo de base de datos. `GetUsageFacets` realizaba diez escaneos agrupados en la
primera ronda; `BenchmarkUsageFacets` sigue siendo la forma independiente de evaluar un
futuro cambio de consulta. La conexión única de SQLite y la política WAL se mantienen como
se documenta en `docs/ops/sqlite-operations.md`.

La latencia de CPA de la página System es una duración de lectura de gestión, no el RTT de
red. `healthDTO` mide `Client.Health`, que lee y decodifica la lista completa de
credenciales. Una compuerta v8 en frío o expirada puede añadir su sondeo; `API_SUPPORT_TTL`
es de cinco minutos. Por lo tanto, la co-ubicación por sí sola no implica que esta lectura
deba acercarse a cero. Ni la medición de salud ni la forma de su respuesta cambiaron en
esta ronda.

## Mediciones

Muestras representativas de navegación del mismo arnés:

| Métrica | Base | Mapa de calor/formateadores | Más precarga por intención | Más gzip |
| --- | ---: | ---: | ---: | ---: |
| Primera carga: DOMContentLoaded | 1,195 ms | 1,161 ms | 1,176 ms | 689 ms |
| Cambio al Dashboard en caché | 2,988 ms | 2,153 ms | 1,907 ms | 2,033 ms |
| Tarea más larga del Dashboard en caché | 2,275 ms | 1,428 ms | 1,440 ms | 1,500 ms |

La muestra final redujo el tiempo de cambio al Dashboard en caché cerca de un 32% y su
tarea más larga cerca de un 34%. Los puntos críticos de CPU del mapa de calor y las fechas
dejaron de estar entre las funciones principales. El paso aislado del mapa de calor
establece la principal mejora de CPU; las diferencias de unos cientos de milisegundos entre
ejecuciones posteriores no deben atribuirse a la precarga ni a gzip en una página en caché.
La inicialización de G2 y el layout/paint nativo siguen dominando el trabajo residual.

Con 300 ms de margen previo al pasar el cursor, tres muestras independientes de ruta en
frío produjeron estas medianas de tiempo de clic a página: Config 531 → 505 ms y Logs
618 → 569 ms. Cada muestra optimizada solicitó su módulo antes del clic; ninguna de las
muestras base lo hizo. Estas mejoras modestas son distintas del resultado del Dashboard
ya calentado descrito arriba.

Las solicitudes directas identity/gzip contra el mismo binario con datos de ejemplo, tras
establecer su sesión, midieron bytes del cuerpo de la respuesta (no la sobrecarga de
cabeceras HTTP):

| Respuesta | Identity | Gzip | Reducción |
| --- | ---: | ---: | ---: |
| Cinco archivos JS eager enlazados por el documento de entrada | 1,773,291 B | 678,089 B | 62% |
| Registros de solicitudes, límite 200 | 159,596 B | 19,852 B | 88% |
| Mapa de calor anual de tokens | 73,577 B | 17,035 B | 77% |
| Facetas de uso, preset de 90 días | 2,642 B | 1,010 B | 62% |

La compresión inicial del archivo JS eager más grande añadió cerca de 8 ms en una solicitud
loopback; su representación se cachea después. Las muestras JSON siguieron dominadas por el
trabajo del handler y de la consulta. Los tamaños de respuesta pueden variar con el instante
de observación del fixture, y la paridad de las representaciones comprimidas se verifica
por separado en pruebas de Go.

## Segunda ronda: ritmo de los gráficos y lecturas de facetas

La línea base de comparación es el binario verificado de la primera ronda. Se conservaron
el mismo viewport, enlace y limitación de CPU. Tres contextos nuevos calentaron Dashboard y
System, y luego se hizo clic en Dashboard desde System. Un callback de frame programado por
ese clic registra la primera oportunidad de pintar/responder; la condición de finalización
exige además, por separado, que los ocho canvas contengan tinta, no solo un marcador de
posición del gráfico. Tiempos medianos:

| Métrica | Base de la ronda uno | Ritmo de gráficos y referencias estables | Cambio |
| --- | ---: | ---: | ---: |
| Primer callback de animation-frame tras el clic | 1,682 ms | 1,198 ms | −29% |
| Tiles del Dashboard observados | 2,328 ms | 1,998 ms | −14% |
| Los ocho canvas de gráficos contienen tinta | 2,407 ms | 2,794 ms | +16% |
| Tarea más larga hasta la llegada de los gráficos | 1,662 ms | 1,181 ms | −29% |

La tabla usa el binario final compilado. El paso anterior, solo de gráficos, midió 1,171 ms
hasta el primer frame y 2,473 ms hasta los ocho canvas. La llegada final de los gráficos
varió de 2,451 a 2,879 ms: la cola cambia creación simultánea por capacidad de respuesta, y
la finalización de todos los gráficos debe medirse en lugar de suponerse sin cambios. Esto
es disponibilidad más temprana del hilo principal, no una afirmación de que todos los
gráficos terminen más rápido.
El callback de frame es una oportunidad de pintado, no una medición del despacho de eventos
de entrada.
El arnés original de navegación/perfil también se ejecutó tras estabilizar los callbacks y
tras añadir la cola. Los callbacks estables por sí solos no mejoraron de forma material la
navegación en caché (2,171 → 2,141 ms, tarea más larga 1,426 → 1,424 ms); en cambio,
eliminan trabajo redundante de configuración/geometría durante refrescos sin cambios, lo
cual verifica la sonda del navegador. El ritmo de los gráficos redujo la tarea más larga del
arnés a 1,123 ms; la nueva ejecución final con el binario compilado midió 2,027 ms de
navegación en caché y una tarea más larga de 1,077 ms.
La atribución de CPU del bundle de gráficos bajó de cerca de 1,273 a 792 ms en el perfil
muestreado de navegación; el layout nativo siguió siendo considerable.

`ChartMount` confirma una sola creación de G2 en cada tarea posterior a un frame. Su ranura
conserva sus dimensiones, los trabajos en cola se cancelan al desmontar y el navegador
pausa la cola en una pestaña oculta. Las instancias existentes se actualizan de inmediato,
con los mismos contratos de movimiento, hover, tooltip exacto y movimiento reducido. Los
límites de los gráficos de modelos también están memoizados.

### Facetas: un solo recorrido de la tabla de detalle, agrupación a cargo de SQL

La consulta adoptada materializa una sola vez únicamente las once columnas de facetas/máscara
de la instancia y la ventana de tiempo seleccionadas. Diez lecturas agrupadas con límite
escanean luego esta relación temporal estrecha dentro de la misma sentencia. Conserva los
límites inclusivos, los empates de valor binarios, el orden por conteo, los arreglos vacíos
y la máscara máxima no vacía de claves de llamador normalizadas. El número de conexiones de
SQLite, los índices, los DTO y la cadencia de consultas no cambian.

Tres muestras de benchmark por estrategia con 100,000 eventos produjeron estas medianas:

| Ventana / cardinalidad de dimensiones pobladas | Diez consultas independientes | Ventana materializada | Cambio |
| --- | ---: | ---: | ---: |
| Ventana completa, 20 valores en dimensiones variables | 1,586 ms | 1,107 ms | −30% |
| Ventana completa, 10,000 valores en dimensiones variables | 1,573 ms | 1,096 ms | −30% |
| Ventana estrecha de 1,000 filas, alta cardinalidad | 17.5 ms | 15.2 ms | −13% |

El benchmark existente disperso de 100k filas mejoró de unos 930 a 460–540 ms.
Los fixtures poblados son la evidencia más representativa; un resultado solo con datos
dispersos exageraría el beneficio. Los benchmarks de estrategia comparten un repositorio con
datos de ejemplo y excluyen del tiempo la creación del fixture. Son costos sintéticos
locales, no SLA del servicio.

Nueve lecturas autenticadas por loopback contra cada binario demo midieron una duración HTTP
mediana de `/usage/facets?preset=90d` de 134.9 → 95.4 ms (−29%). Los valores de las facetas
fueron idénticos; los instantes resueltos de la ventana deslizante en la respuesta difirieron
naturalmente entre ejecuciones. La regeneración del conjunto de datos no produjo diferencias
semánticas ni en archivos confirmados.

La contrapartida es un almacenamiento temporal de SQLite proporcional a las filas
seleccionadas y al ancho de los campos, en lugar de un mapa de Go sin límite proporcional a
los valores distintos. Las asignaciones de Go devueltas quedan ligadas a un máximo de 2,000
valores de facetas. El benchmark de alta cardinalidad informó aproximadamente 276 → 293 KiB
de asignaciones de Go por operación; esto no mide la huella total de almacenamiento temporal
de SQLite. Las ventanas de producción más grandes aún requieren medición; esta consulta no
tiene memoria ni tiempo constantes.

## Tercera ronda de implementación

### Propiedad del popup del mapa de calor y programación del layout

La cuadrícula anual ahora monta celdas simples memoizadas en lugar de un Tooltip de antd
residente para cada día. Al hacer clic se crea un único tooltip con un ancla invisible y
estacionaria que se inserta mediante portal en la celda activa; los clics posteriores
cambian o alternan esa única instancia. Antd conserva la colocación, el ajuste al viewport,
el seguimiento del scroll, las flechas y el movimiento. La descripción ARIA y el anillo de
apertura de la celda siguen a ese popup. Un puntero externo y Escape lo cierran; Escape desde
el enlace de detalle devuelve el foco a la celda. Los refrescos ordinarios de datos conservan
las celdas activas válidas, mientras que la navegación y los cambios de calendario eliminan
la instancia.

El posicionamiento inicial del mapa de calor usa la primera entrega no nula de
ResizeObserver y luego fija el contenedor en el extremo limitado por el navegador una vez
por montaje. Ya no lee las extensiones de scroll en el efecto de montaje. Este paso por sí
solo no mejoró de forma material la navegación: el siguiente vaciado síncrono de layout
aparecía en el `scrollTo` incondicional del shell. Ahora el shell registra su estado de
scroll a partir de los eventos de scroll de la raíz y se reinicia solo tras desplazarse, sin
leer la geometría de la página recién montada. Un campo de escritorio ajustado permanece en
cero, y un teléfono abre en hoy conservando la semana elegida entre refrescos.

La misma medición de tres contextos calentados Dashboard → System → Dashboard produjo estas
medianas. No se ejecutaron suites de verificación durante la repetición final de la medición.

| Métrica | Base de la ronda dos | Tooltip bajo demanda | Tras la programación del layout del mapa de calor | Final, con reinicio condicional del shell |
| --- | ---: | ---: | ---: | ---: |
| Primer callback de animation-frame tras el clic | 1,210 ms | 597 ms | 603 ms | 616 ms |
| Tiles del Dashboard observados | 1,866 ms | 1,250 ms | 1,263 ms | 1,247 ms |
| Los ocho canvas de gráficos contienen tinta | 2,513 ms | 1,875 ms | 1,896 ms | 1,864 ms |
| Tarea más larga hasta la llegada de los gráficos | 1,192 ms | 579 ms | 585 ms | 338 ms |

La ronda final reduce estas medidas aproximadamente un 49%, 33%, 26% y 72%,
respectivamente. El arnés de navegación independiente midió 1,864 → 1,436 ms para su
revisita al Dashboard en caché; su tarea más larga midió 1,043 → 624 ms. Estos intervalos de
observación difieren, por lo que sus máximos de tarea no deben sustituirse entre sí.
Una ejecución anterior con el código final midió 625 ms hasta el primer frame, 1,272 ms hasta
los tiles, 1,898 ms hasta todos los canvas y una tarea más larga de 339 ms. El callback de
frame sigue siendo solo una oportunidad de pintado, no una medición directa del despacho de
entrada ni de la disponibilidad.

En la muestra del perfil de CPU, la autoatribución de antd cayó de 488 a 172 ms y la de React
de 389 a 159 ms. La autoatribución de los gráficos se mantuvo aproximadamente igual
(754 → 775 ms). El perfil final ya no atribuye cerca de 273 ms de layout forzado a un getter
de extensión del mapa de calor ni al reinicio de scroll del shell; el layout/paint nativo
sigue existiendo y la consola no está libre de bloqueos. Evitar vaciados síncronos
redundantes no equivale a afirmar que todo el trabajo de layout desapareció.

Las sondas existentes del mapa de calor y de navegación fijan la geometría y propiedad del
popup, ARIA, el cierre, el foco de teclado, el cambio rápido, la limpieza de rutas, las
lecturas síncronas de extensión, el posicionamiento en teléfono y la conservación tras
refrescos, y el comportamiento del reinicio del shell. Usan estados observables en lugar de
esperas añadidas. Consulte `docs/testing.md` para saber a quién corresponden estas
afirmaciones del navegador y las pruebas anteriores de lógica y servidor.

## Ronda cuatro: trabajo de montaje de filas de solicitudes

Los siguientes perfiles de CPU cubrieron System → Requests, System → Pricing y System → OAuth
con el mismo binario de producción, conjunto de datos y limitación de CPU de 4×. En la
muestra de solicitudes, antd representó 435 ms de trabajo autoatribuido y React 191 ms; la
conversión de zona horaria de dayjs representó 29 ms. La lectura síncrona del ancho de un
input select representó 129 ms. Pricing atribuyó 170 ms a la medición de la barra de
desplazamiento, mientras que OAuth atribuyó 370 ms a antd y 233 ms a React. Estas muestras
identifican prioridades, no porciones exclusivas de tiempo real ni prueba de que un solo
formateador explique el bloqueo de toda una página.

Las filas de solicitudes ahora resuelven su marca de tiempo una sola vez para la etiqueta
corta y para el tooltip completo con precisión de milisegundos. El par se memoiza por marca
de tiempo y zona horaria de visualización; los cambios de selección y de visualización de
tokens lo reutilizan. Un benchmark de Node alternado de cinco muestras con 1,000 instantes
nuevos de Nueva York midió una mediana de 278 → 144 ms (cerca de un 48% menos), con
etiquetas idénticas. Es un benchmark del formateador a velocidad nativa, no una afirmación
sobre navegación en el navegador ni sobre disponibilidad de la entrada.

El renderizador de solicitudes ofrece una fila personalizada más alta que la estimación
predeterminada de Listy. Su proyección de tokens de componente ahora inicia el virtualizador
en el mínimo existente de 68 px por fila, mientras que el CSS de la fila sigue siendo
dueño del relleno visible y la biblioteca mide las alturas reales de los elementos y de los
encabezados de grupo. Tres contextos de navegador independientes, alternando base y
optimizado, midieron cambios System → Requests ya calentados en el mismo enlace de 60 ms:

| Métrica | Base de la ronda tres | Cambios de solicitudes de la ronda cuatro |
| --- | ---: | ---: |
| Máximo de filas de solicitudes montadas durante la navegación | 11 | 9 |
| Primer callback de animation-frame tras el clic | 555 ms | 523 ms |
| Primera fila de solicitudes observada | 763 ms | 730 ms |
| Tarea más larga hasta la llegada de filas y el intervalo de observación siguiente | 540 ms | 512 ms |
| Duración total de tareas largas en ese intervalo | 633 ms | 578 ms |

Cada muestra montó dos filas menos (18% menos trabajo inicial de filas). Las diferencias de
tiempo son modestas: el control de Pricing, sin cambios, midió 669 → 640 ms hasta su primera
fila, por lo que la pequeña diferencia de tiempo transcurrido por sí sola no es evidencia
concluyente de una mejora en toda la ruta. El arnés de navegación amplio midió de forma
similar Requests en 983 → 988 ms. Las mejoras conservadas tienen reducciones deterministas
de conversión y de trabajo de montaje; no establecen que la página de solicitudes ya esté
libre de bloqueos ni que toda navegación sea más rápida.

La muestra de CPU de seguimiento de solicitudes atribuyó 18 ms a la conversión de zona
horaria, mientras que la lectura del ancho del select aún representaba 142 ms. Los commits de
páginas de Pricing y credenciales, los componentes de interacción residentes y el layout
síncrono siguen siendo trabajo de seguimiento de mayor prioridad que más cambios en el
formato de fechas. Las nuevas pruebas de lógica fijan la semántica exacta de la marca de
tiempo, una sola conversión y la estimación de fila; las sondas de solicitudes existentes
cubren cambios de zona horaria en el DOM montado, montajes máximos, scroll, geometría,
redimensionado, acciones de detalle y toque.

## Ronda cinco: un solo tooltip de solicitudes bajo demanda

Medido el 1 de octubre de 2026 (UTC), esta ronda reemplaza los árboles residentes de
disparadores de tooltip en las filas de solicitudes por celdas simples y un único popup
perteneciente a la lista. La ventana virtual existente, las pistas exactas de marca de
tiempo/caché/TPS, la acción de precio, el estilo de antd y el movimiento de salida se
mantienen. La intención del puntero o el foco del teclado crea el popup; abrirlo no
reemplaza la celda ni vuelve a renderizar la página. Un observador solo activo sigue las
revisiones de etiqueta y las filas virtuales eliminadas, mientras que el scroll y el
redimensionado invalidan el ancla de la instantánea. Un portal en el body, estacionario y
transparente al puntero, deja intactos la cuadrícula y el foco de la fila.

Tres comparaciones alternadas de contextos de navegador con el binario de producción usaron
el mismo fixture, viewport de 1440 × 900, limitación de CPU de 4× y enlace simulado que en
las rondas anteriores. La observación es System → Requests ya calentado hasta la llegada de
filas más 600 ms, no el arnés de navegación más amplio ni el alcance de finalización de
gráficos del Dashboard.

| Métrica | Base de la ronda cuatro en esta ejecución | Tooltip de solicitudes compartido |
| --- | ---: | ---: |
| Máximo de filas de solicitudes montadas | 9 | 9 |
| Primer callback de animation-frame tras el clic | 510 ms | 468 ms |
| Primera fila de solicitudes observada | 720 ms | 677 ms |
| Tarea más larga en el intervalo de observación | 498 ms | 457 ms |
| Duración total de tareas largas en ese intervalo | 556 ms | 510 ms |

Cada muestra de solicitudes pareada mejoró los tiempos de primer frame, primera fila y tarea
más larga. Las mejoras medianas son de aproximadamente 8%, 6% y 8%, respectivamente. El
control de Pricing, sin cambios, midió 655 → 682 ms hasta la llegada de la primera fila y
539 → 564 ms en su tarea más larga, por lo que el resultado de solicitudes no se atribuye a
una aceleración universal del arnés. Es una pequeña muestra sintética de tres contextos, no
un percentil de producción ni prueba de que la entrada esté lista ahora en 468 ms: un
callback de RAF no es una medición de latencia de entrada.

Una comprobación de hover independiente, alternada en tres contextos, midió la primera pista
de marca de tiempo en 201 → 201 ms, incluido el retraso de intención existente de 100 ms y
la visibilidad observada por el navegador. Ninguna de las dos versiones produjo una tarea de
≥50 ms hasta la llegada del popup más 300 ms. Esto protege contra trasladar trabajo de
navegación a una primera pista notablemente más lenta; no es una medición de clic a pintado
ni de INP. La repetición más amplia de navegación en dos pasadas midió Requests en caché en
988 → 979 ms y su tarea más larga en 584 → 539 ms. La pequeña diferencia de tiempo
transcurrido en ese alcance distinto no establece una aceleración de toda la ruta; no
mezcle su máximo de tarea con la tabla System → Requests de arriba.

La muestra de CPU de seguimiento de solicitudes atribuyó 427 ms a antd y 182 ms a React,
frente a 470 ms y 203 ms en el perfil de seguimiento de la ronda cuatro. La misma lectura del
ancho del input Select aún representaba 138 ms (antes 142 ms). Eliminar el popup inactivo
reduce el trabajo de componentes pero no elimina este punto crítico de layout síncrono ni la
tarea de ruta de unos 450 ms. El comportamiento del tooltip activo lo fijan las sondas de
interacción y de zona horaria de solicitudes; no cambió ningún endpoint, forma de respuesta
ni política de base de datos.

## Ronda seis: filas de solicitudes durante el scroll

Medido el 7 de octubre de 2026 (UTC) contra el servidor de desarrollo con limitación de CPU
de 4x, desplazando con la rueda una lista de 100 filas de solicitudes de principio a fin
bajo un perfil de CPU y una traza. Sin limitación, el mismo scroll mantiene 60 fotogramas
por segundo sin tareas largas; la ejecución limitada es la que expone el costo por fila.

| Costo | Antes | Después |
| --- | ---: | ---: |
| Tiempo nativo de layout, estilo y pintado (`(program)`) | cerca de 5.1 s | cerca de 3.4 s |
| `formatRequestTimestamp`, inclusivo | 296 ms | 20 ms |
| Observador de react-query por fila (`useQuery` bajo `ProviderBrandIcon`) | 95 ms | 16 ms |

Tres cambios producen estas cifras. Cada fila declara `contain: layout style`, de modo que
medir una fila ya no recalcula el layout de sus vecinas. La marca de tiempo de la fila se
formatea con un `Intl.DateTimeFormat` por zona horaria de visualización en lugar de una
instancia de dayjs con zona por fila. `ProviderBrandIcon` crea un observador de la lista de
plugins solo para el arte personalizado del despliegue.

Lo que queda es la propia recolección de alturas de la lista virtual: tras cada commit lee
`offsetHeight` y los márgenes calculados de cada fila montada, cerca de 1.3 s de tiempo
propio en la ejecución limitada, y la distribución de fotogramas limitada sigue dependiendo de
ello (aproximadamente el 45% de los fotogramas supera los 33 ms). Es comportamiento de la
biblioteca y se dejó sin tocar. Las cifras son del servidor de desarrollo, que exagera la
participación de React; no se repitieron contra una compilación de producción.

## Trabajo pendiente, en orden de prioridad

1. **Commit y layout de la página Dashboard.** El arnés de capacidad de respuesta de la
   tercera ronda aún observa una tarea de unos 338 ms con CPU a 4×, y el arnés de
   navegación más amplio observa una tarea de 624 ms. Perfile el commit restante de la
   página y el layout/paint nativo antes de cambiar el renderizado o la retroalimentación de
   disponibilidad. Siga juntos el primer frame, la finalización de todos los gráficos y la
   interacción significativa.
2. **Commits de páginas de alta densidad.** La navegación de registros de solicitudes,
   precios y credenciales aún muestra tareas de cientos de milisegundos bajo la misma
   limitación. Perfile su primera interacción significativa y las mediciones identificadas de
   select/barra de desplazamiento antes de seguir cambiando componentes de interacción o la
   virtualización.
3. **Almacenamiento temporal de ventanas grandes.** Compruebe los costos de las facetas y la
   presión sobre el almacenamiento temporal de SQLite frente a la retención y la cardinalidad
   de producción, sin modificar con ligereza la política de conexión única.
4. **Semántica de la lectura de salud.** Un sondeo de gestión autenticado y ligero o un
   etiquetado de latencia más claro facilitaría interpretar la lectura de System. Trátelo
   como un cambio de comportamiento/texto distinto, con sus pruebas de API y localización.

Las seis rondas reducen el trabajo de renderizado y mejoran la capacidad de respuesta y el
costo de transferencia/consulta sin afirmar que eliminen todo bloqueo del hilo principal. El
trabajo de seguimiento debe conservar la misma limitación e informar tanto el contenido
visible por primera vez como la disponibilidad de interacción significativa.

## Política de regresión tras el cambio de progreso de carga

El ADR 0053 reemplaza las cuotas estrechas por chunk con comprobaciones de límites de carga
en producción, reportes raw/gzip y topes amplios de anomalías. La línea base en
`scripts/bundle-reference.json` registra el commit `6e76d9e` con fuentes de runtime sin
cambios, medida con el nuevo recolector de grafo: entrada 313.97 KiB, JS de arranque
1742.63 KiB raw / 563.77 KiB de estimación gzip nivel 6, CSS de arranque 63.30 / 12.26 KiB,
todo el JS 10696.46 KiB y distribución 12423.51 KiB. Es una referencia de tamaño, no otra
auditoría de tiempos del navegador. Los metadatos del grafo y del reporte quedan fuera de dist.

El arranque es el cierre estático de la entrada de módulo del HTML y de los modulepreloads,
no solo el archivo de entrada. Los módulos de página/shell/gráficos/Markdown/editor no
pueden entrar en él; la ruta de configuración conserva además su límite de editor bajo
demanda. El crecimiento ordinario produce evidencia de comparación y advertencias en lugar de
exigir cambios rutinarios de cuota. Los topes absolutos aún detectan una expansión excesiva;
sus valores y la política de artefactos de la base exacta están en `docs/testing.md` y
`scripts/bundle-report.mjs`. Las estimaciones gzip no eliminan los costos de CPU, y estas
comprobaciones no sustituyen los tiempos del navegador ni la metodología de perfilado
descritos arriba.
