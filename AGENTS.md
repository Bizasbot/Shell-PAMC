# AGENTS.md — Contrato para agentes en Shell-PAMC

> Los agentes de programación cargan este archivo al inicio de una sesión (un archivo local `AGENTS.override.md` lo reemplaza). El archivo raíz `CLAUDE.md` es un enlace simbólico a este archivo, de modo que cada agente lee un único contrato; edite `AGENTS.md`, nunca el enlace.
>
> **Primer principio: proteja los invariantes, no las implementaciones.** Las reglas a continuación definen lo que debe mantenerse verdadero — límites de seguridad, integridad de datos, contratos externos, comportamiento visible para el usuario. Cómo el código lo logra queda a su criterio técnico. Actúe como un ingeniero senior con criterio técnico independiente, no como un mero custodio de elecciones históricas.

---

## 1. El proyecto

CLIProxyAPI (CPA) gestiona la adaptación de protocolos, la ejecución de credenciales y el proxy de solicitudes; Shell-PAMC proporciona **identidad propia del usuario, nomenclatura, organización, una fachada de administración y observabilidad de uso** por encima de él. Ambos se despliegan conjuntamente en la misma pila. Shell-PAMC es un monolito modular en Go de réplica única + SPA React incrustada + SQLite WAL, que funciona completamente sin conexión y sin dependencias de CDN.

Lea la documentación cuando una tarea lo requiera, no por adelantado. Puntos de partida útiles: `CONTEXT.md` (vocabulario y reglas del dominio), `docs/architecture.md` (mapa de módulos, flujos de datos, invariantes), `docs/design.md` (sistema visual), `docs/testing.md` (ubicación de pruebas y detalle de verificación). Lea o busque mediante grep la parte que necesita en lugar de cargar documentos completos.

---

## 2. Niveles de reglas

No todas las reglas tienen el mismo peso. Sepa en qué nivel está trabajando.

### Nivel 1 — invariantes. Nunca los viole; si una tarea parece requerirlo, deténgase y comuníquelo.

- **Secretos.** Nunca escriba la clave de administración de CPA, claves API de upstream, tokens de OAuth o claves privadas TLS en respuestas ordinarias, registros, preferencias, almacenamiento del frontend o documentación. Las claves de los invocadores aparecen solo como máscaras de visualización más huellas digitales calculadas con HMAC. Una operación sensible cuyo registro de auditoría no pueda escribirse no debe continuar.
- **Listas de permitidos de DTO.** Las respuestas ordinarias de la fachada contienen únicamente listas de permitidos escritas a mano desde `internal/api/` — nunca cargas útiles sin procesar de CPA, campos no listados, URLs de destino arbitrarias o proxies de `api-call` hacia el exterior. El Plugin Host confiable y autenticado es la única excepción acotada de respuesta nativa (ADR 0067): árboles de administración fijos de CPA v0/v8 y el directorio de modelos únicamente, con separación de credenciales, lecturas y escrituras auditadas y barreras de respaldo de configuración.
- **Integridad de datos.** Las migraciones son solo hacia adelante: nunca edite una migración aplicada ni `schema_migrations`; una corrección es una nueva migración. Las versiones de precios y los eventos de auditoría son de solo adición (append-only). Una sola réplica por directorio de datos — el acceso a SQLite está serializado, no se reintenta.
- **Adopción de CPA sin destrucción.** Nunca borre, sobrescriba ni modifique configuraciones preexistentes de CPA que Shell-PAMC no posea. Las escrituras de configuración ordinarias están protegidas por revisión, nombran solo las rutas modificadas por el operador y conservan un respaldo restaurable; rechace la escritura cuando no se pueda crear el respaldo. Leer la cola de uso de CPA es destructivo: la disponibilidad se comprueba con AUTH, nunca extrayendo elementos de la cola.
- **Límite de actualización.** Solo el contenedor sidecar de actualización posee el socket de Docker; la consola permanece de solo lectura, sin privilegios y sin acceso al socket. Una actualización nombra un producto, nunca una imagen. Las versiones de la consola se verifican contra la clave pública compilada y se descargan por resumen (digest), sin respaldo no verificado; la imagen de la pasarela, que este proyecto no puede firmar, descarga el tag que su contenedor ya utiliza. Una imagen fijada nunca se actualiza, y un reemplazo que falla su comprobación de salud restaura el contenedor anterior y su tag de imagen.
- **Incrustación sin conexión.** Sin CDN ni recursos alojados externamente; la SPA se incrusta en el binario único de Go y sigue funcionando bajo la subruta `/shell-pamc`.
- **Higiene del repositorio.** Ningún secreto, clave, token o archivo de autenticación en el diff, el historial, el texto del PR ni en capturas de pantalla.

### Nivel 2 — contratos. Modifíquelos deliberadamente, verifique antes y después, y explique qué cambió.

- Formatos de transmisión y nombres de campos JSON; esquema de base de datos y semántica almacenada; los contratos de administración de CPA v0/v8; la estructura del conjunto de datos de demostración comprometido; variables de entorno y valores predeterminados; comportamiento visible para el usuario y textos de interfaz (`[zh, en]` en `web/src/i18n/index.tsx` más cada catálogo bajo `web/src/i18n/locales/`).
- Integridad de versiones y publicaciones: identidad de versiones, tags de imagen y alias, barreras de publicación, acciones fijadas de flujos de trabajo.

### Nivel 3 — preferencias de ingeniería. Modifíquelas libremente.

- Organización de módulos y paquetes, abstracciones internas y sus nombres, convenciones de nomenclatura y comentarios (§6), ubicación y organización de pruebas, elección de bibliotecas, estructura de archivos y documentos.
- Estas convenciones existen para mantener la coherencia del código, no para congelarlo. Desvíese cuando tenga una razón justificada y prefiera eliminar una abstracción antes que preservarla innecesariamente. Un principio de diseño que vale la pena mantener: un componente o módulo compartido no debe adquirir dependencias en tiempo de ejecución del estado de una página solo para obtener una utilidad general; coloque la lógica compartida en un módulo hoja.

---

## 3. Su autonomía

Usted está autorizado — y se espera de usted — a:

- refactorizar cuando mejore el código; reemplazar abstracciones obsoletas; eliminar implementaciones redundantes, código muerto y capas de compatibilidad que no sirvan a ningún contrato actual;
- cuestionar decisiones históricas, incluidos los ADRs aceptados (§4);
- mover, reescribir o eliminar pruebas que congelen la implementación en lugar de proteger el comportamiento;
- reorganizar la documentación.

Prefiera hacer que un estado incorrecto sea irrepresentable en lugar de utilizar un control que lo absorba silenciosamente: no añada respaldos alternativos, errores silenciados ni adaptadores de compatibilidad para contratos que no existen.

Dos condiciones: el comportamiento en el Nivel 1 o Nivel 2 se verifica antes y después del cambio. Y la cobertura se traslada en lugar de desaparecer: si elimina una prueba, indique dónde reside ahora su aserción, o por qué la aserción en sí es obsoleta.

---

## 4. ADRs

Un ADR (`docs/adr/`) registra una decisión trascendente y su contexto en un momento dado. Es evidencia histórica, no una regla inmutable.

- Escriba un nuevo ADR solo cuando una decisión sea difícil de revertir, implique compromisos reales y afecte la arquitectura, un contrato externo o un límite de seguridad. Refactorizaciones rutinarias, mejoras visuales, estrategias de prueba, actualizaciones de dependencias y decisiones de nombres no necesitan uno.
- Puede modificar, reemplazar o desaprobar cualquier ADR, incluidos los aceptados. Prefiera editar un ADR cuyos hechos o contexto sean incorrectos en lugar de acumular uno nuevo encima. Cuando revierta una decisión aceptada, anote la reversión en la línea de estado del ADR antiguo y explíquela en el nuevo.
- Lea el corpus para contexto al trabajar en un área que este cubre. Si un ADR entra en conflicto con el mejor criterio técnico actual, proponga el diseño superior: es un registro del razonamiento pasado, no una lista de restricciones.

---

## 5. Verificación

Adapte el esfuerzo de verificación al radio de impacto del cambio:

| Momento | Qué ejecutar |
| --- | --- |
| Mientras edita | `pnpm test:fast` — solo las comprobaciones que los archivos modificados necesitan; añada `pnpm check:ui` cuando el cambio afecte interacciones de UI, diseño o ciclo de vida del navegador |
| Función completa / antes de hacer push | `pnpm verify`; añada `pnpm check:ui` cuando el cambio afecte la UI — las barreras estáticas completas, el escaneo de secretos del árbol de trabajo y los escenarios de navegador afectados |
| Pull request | CI ejecuta el catálogo completo de navegadores, el catálogo completo de sondeos en tres fragmentos y la aceptación de la demo; la protección de ramas requiere sus comprobaciones `static`, `browser` y `probes` |
| Cambios en compilación, distribución embebida, entorno de navegador o flujos de trabajo | `pnpm verify:full` (también para reproducir fallos en CI) |

No ejecute `verify` o `check:ui` tras cada edición de archivo — una función está completa cuando es verificable de forma independiente, no cuando termina una respuesta. No vuelva a ejecutar una barrera que ya pasó en código no modificado; cuando una comprobación falle, vuelva a ejecutar esa comprobación primero. Un cambio que afecte únicamente documentación se verifica con `pnpm test:fast`, que selecciona la comprobación de docs; no necesita escenarios de navegador. `pnpm test:fast --plan` muestra la selección antes de ejecutarla, y `pnpm check:ui` se ejecuta contra el servidor de desarrollo con endpoints simulados, por lo que nunca reemplaza la aceptación de artefactos compilados para resolución de rutas, minificación o límites de fragmentos.

Reglas que mantienen las barreras honestas:

- **Nunca agregue un interruptor de omisión, un reintento o una espera más larga para hacer pasar una ejecución o hacerla más rápida.** Corrija la aserción o agregue una regla de planificación con una autoprueba.
- **Escriba la comprobación que detecta el defecto, no una que afirme la ausencia de problemas.** Una prueba que no pueda fallar contra una implementación rota, o que exista para cubrir al autor en lugar del código, se elimina en vez de conservarse.
- Las nuevas pruebas van en la capa más baja que pueda fallar por la razón correcta; sin esperas fijas; el descubrimiento es automático, así que no añada listas de registro. `docs/testing.md` contiene el mapa de capas y la propiedad actual de aserciones.
- Las barreras de publicación y seguridad — escaneos de secretos, pruebas de imagen, comprobaciones de publicación — nunca son opcionales.

---

## 6. Convenciones

**Los comentarios explican el porqué, no el qué.** El código ya expresa lo que sucede; un comentario aporta intención de diseño, contexto de decisión, compromisos y restricciones no obvias. Elimine comentarios que solo repitan el código y actualice un comentario cuando la lógica debajo de él cambie.

```go
// Auto. La disponibilidad se comprueba con AUTH, nunca extrayendo de la cola: la cola de CPA es
// destructiva, por lo que un sondeo que consumiera un registro lo perdería silenciosamente.
```

| Estilo | Aplica a |
| --- | --- |
| `lowerCamelCase` | Variables locales de Go/TS, funciones y métodos, propiedades, parámetros |
| `UpperCamelCase` | Clases, interfaces, structs, componentes de React, tipos exportados |
| `SCREAMING_SNAKE_CASE` | Constantes a nivel de módulo, configuración estática global de solo lectura |
| `snake_case` | Tablas y columnas de bases de datos, columnas SQL, campos de transmisión JSON |
| `kebab-case` | Rutas de URL, nombres de clases CSS, ramas de Git |

- Los booleanos llevan un prefijo de estado (`isActive`, `hasPermission`, `canEdit`, `shouldRetry`); las funciones son frases de verbo-sustantivo.
- Los nombres de contratos externos conservan su grafía requerida: etiquetas `json:`, campos nativos de CPA, columnas de BD, parámetros de consulta y props de componentes de terceros. Las clases de módulos CSS se leen como `styles['kebab-case']` (`pnpm check-css-modules` lo exige).
- Los textos visibles para el usuario nunca se codifican de forma rígida: añada pares `[zh, en]` en `web/src/i18n/index.tsx` y en cada catálogo bajo `web/src/i18n/locales/` (`pnpm check-i18n` encuentra discrepancias).

---

## 7. Documentación

Actualice los documentos que su cambio desactualice, en el mismo cambio. Ese es todo el requisito: precisión, no burocracia. `pnpm check-docs` verifica la parte mecánica: los documentos mantenidos no deben citar rutas inexistentes no permitidas ni referencias retiradas, los documentos de archivo pueden conservar rutas históricas explícitamente listadas y los documentos no de archivo no llevan números de línea absolutos (cite un archivo o símbolo en su lugar).

Dónde reside cada cosa, cuando necesite consultar o actualizar:

| Documento | Cobertura |
| --- | --- |
| `CONTEXT.md` | Vocabulario y reglas del dominio: ventanas de tiempo, i18n, modelo de autenticación, semántica de precios |
| `docs/architecture.md` | Mapa de módulos, flujos de datos, invariantes, esquema, bucles de fondo |
| `docs/design.md` | Sistema visual y tokens de diseño (fuente de verdad); `DESIGN.md` es su resumen para herramientas de diseño y lo sigue |
| `PRODUCT.md` | Posicionamiento del producto, matriz de capacidades, restricciones |
| `README.md` | Páginas de inicio: cambios en capacidades o instalación que un nuevo usuario debe ver |
| `docs/install.md` / `docs/install-for-agents.md` | Instalación para una persona y los mismos pasos como guía de ejecución para un agente |
| `docs/operations.md` | Referencia de ajustes, restricciones de despliegue, notas operativas |
| `docs/ops/sqlite-operations.md` | Respaldo, restauración, gobierno de clave maestra, barreras de migración |
| `docs/ops/cloudflare-demo.md` | Guía de despliegue para la demostración pública |
| `docs/releasing.md` | Distribución, publicación de tags, identidad de versiones |
| `docs/testing.md` | Ubicación de pruebas, el mapa de capas, propiedad actual de aserciones |
| `docs/agent-capabilities.md` | Contrato de capacidades del agente y puente MCP |
| `docs/cpa-v8-compat.md` / `docs/cpamc-parity.md` | Línea base y reubicación de CPA v8; matriz de paridad con CPAMC |
| `docs/plans/model-prices.md` | Diseño de precios, reglas de emparejamiento, limitaciones conocidas |
| `docs/adr/` | Registros de decisiones (§4) |
| `docs/images/readme/` | Capturas de pantalla de README: regenere con `pnpm build && pnpm readme:screenshots` cuando una página ilustrada cambie su apariencia |
| `deploy/cloudflare/data/` | El conjunto de datos de la demo: regenere con `pnpm demo:generate` y confirme el diff cuando cambie una lectura o respuesta de la consola (`pnpm check:demo` falla de lo contrario) |

Toda la documentación técnica y de contexto está escrita en español; solo las copias localizadas de la UI son excepciones intencionales.

---

## 8. Comandos comunes

La lista completa de scripts está en `package.json`; estos son los que los agentes utilizan con mayor frecuencia.

| Comando | Propósito |
| --- | --- |
| `pnpm dev` | Punto de entrada de desarrollo Air + Vite (`http://127.0.0.1:5173/shell-pamc/`) |
| `pnpm dev:api` / `pnpm dev:web` | Solo Go/Air, o solo Vite |
| `pnpm cpa:start` | Iniciar CLIProxyAPI local desde `cpa/` |
| `pnpm build` | Compilar el frontend y sincronizarlo en `internal/web/dist` |
| `pnpm test:fast` | Comprobaciones afectadas para el diff del árbol de trabajo (`--base <ref>` incluye cambios confirmados, `--plan` imprime la selección) |
| `pnpm test:logic` / `pnpm test:components` / `pnpm test:self` | Suites de lógica pura / React renderizado y contratos tipados de API / autopruebas de repositorio y Worker Node |
| `pnpm check:ui` | Escenarios de navegador afectados en el servidor dev con API simulada (`--list` / `--plan` inspeccionan sin abrir navegador) |
| `pnpm verify` | Comprobación de herramientas, barreras estáticas completas, escaneo de secretos del árbol de trabajo |
| `pnpm verify:probes` | Catálogo completo de sondeos del servidor dev (`--shard i/n`, `--port PORT`, `--workers 1`) |
| `pnpm verify:browser` | Aceptación del navegador con la SPA compilada contra el CPA simulado (también `:smoke`, `:p0`, `:harness`) |
| `pnpm verify:demo` | Aceptación del navegador para la demostración pública; `SHELLPAMC_DEMO_URL` verifica un despliegue |
| `pnpm verify:full` | Todo lo que ejecuta CI, localmente (`:serial` para hosts con recursos limitados) |
| `pnpm verify:e2e` | Límites de compilación y carga, luego aceptación del navegador y sondeos |
| `pnpm verify:secrets` | Escanear el árbol de trabajo en busca de secretos (`:history` escanea el historial) |
| `pnpm check:bundle` | Límites de carga de producción y topes de anomalías, con informes de tamaño |
| `pnpm demo:generate` | Regenerar el conjunto de datos de demostración a partir de los controladores reales (`--check` falla si está desactualizado) |
| `pnpm check:demo` | Contrato de cobertura, frescura y privacidad de la demostración |
| `pnpm icons:generate` | Regenerar los datos de iconos de Lucide tras modificar el paquete |
| `pnpm check-docs` | Barrera de rutas de documentación, referencias retiradas y números de línea |
| `pnpm check-i18n` | Claves de traducción referenciadas en el código pero ausentes en el diccionario |
| `pnpm check-css-modules` | Referencias a `styles[...]` frente a clases de módulos CSS definidas |
| `pnpm check:motion` / `pnpm check:style-tokens` / `pnpm check:feedback` | Presupuesto de movimiento / escalas de tipografía y radio / barreras de superficie de retroalimentación y primitivas compartidas |
| `pnpm lint:antd` | Reglas de uso y accesibilidad de antd |
| `pnpm readme:screenshots` | Regenerar capturas de pantalla de README desde el modo demo (fuera de toda barrera) |
| `pnpm verify:race` / `pnpm verify:fuzz` / `pnpm verify:advisories` | Líneas de mantenimiento semanal, separadas de las barreras de PR |

---

## 9. Superficies de entrega: entregue el resultado, no la conversación

Escriba para un lector que no estuvo en la sesión. Alternativas descartadas, intentos intermedios y correcciones de redacción son información de control: no deben convertirse en el centro narrativo de un título, nombre de archivo, comentario, texto de UI, mensaje de commit, cuerpo de PR o nota de entrega.

- **Regenere a partir del estado adoptado; no remiende texto descartado.** Si un título, etiqueta o apertura surgió de una opción descartada, escríbalo de nuevo a partir del objetivo positivo. "No mencionar X" no significa escribir "sin X" — elimine el contraste en lugar de dejar una aclaración defensiva.
- **Formule tres preguntas por superficie.** ¿Un lector que no estuvo en esta sesión lo necesita? ¿Omitirlo causaría imprecisión, inseguridad, textos confusos o una brecha de compatibilidad? ¿Es un cambio genuino respecto a la línea base que esta superficie debe explicar? Si ninguna aplica, omítalo — haber aparecido o haber sido rechazado no es razón para conservar algo.
- **Conserve lo que es real**: cambios en la línea base, acciones externas realizadas, APIs públicas eliminadas, migraciones, hechos de seguridad y comparaciones o registros de decisiones solicitados.
- **No mezcle cambios no relacionados en el commit, PR o notas**, y no atribuya ediciones preexistentes del usuario como salida de esta tarea.
- Vuelva a leer la superficie publicada — título, nombre de archivo, metadatos — después de editarla, en lugar de asumir que está limpia.

---

## 10. Cosas que no se deben hacer

- No finja que una función está completa porque un endpoint responda; las páginas en construcción se marcan como maquetas o borradores.
- No haga referencia a archivos eliminados, páginas retiradas, identificadores renombrados o contratos externos en desuso en prosa ni en comentarios.
- No introduzca recursos de frontend que requieran una CDN, y no codifique de forma rígida la ruta raíz.
- No interprete una ejecución exitosa como cobertura asegurada: una aserción puede trasladarse a una capa más económica, pero no debe desaparecer sin un reemplazo que realice la misma comprobación.
