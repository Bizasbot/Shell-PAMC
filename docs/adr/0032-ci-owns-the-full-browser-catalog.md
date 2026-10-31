# ADR 0032: CI posee el catálogo completo de navegadores; la verificación local se limita al cambio

- Estado: Aceptado
- Fecha: 2026-09-28

## Contexto

Antes de un *push*, cada cambio tenía que pasar `pnpm verify:full` localmente: una compilación de producción,
toda la ejecución de aceptación *cross-stack*, todo el catálogo de sondeos del servidor de desarrollo (unos cinco
minutos, ejecutados en serie) y la aceptación de la demo. Eso tomaba de seis a siete minutos en una
máquina de 4 CPUs y se repetía después de cada corrección. Mientras tanto, la CI de las *pull requests* ejecutaba solo
los subconjuntos de aceptación de *smoke* y P0, y ningún sondeo, por lo que el catálogo completo se aplicaba
únicamente mediante la disciplina local y por la CI de *master* después de la fusión.

El carril rápido de la UI no alivió esto. Su planificador seleccionaba cada escenario para cualquier
cambio en el catálogo de traducción compartido, y se requiere que las nuevas copias vayan allí, por lo que en una
repetición de 410 confirmaciones recientes, el 88% de las que afectaban a la UI seleccionaban todo el catálogo.

## Decisión

- **La CI es la autoridad para el catálogo completo de navegadores.** Cada *pull request* y cada
  *push* a *master* ejecuta todo el catálogo de sondeos como tres fragmentos (*shards*) disjuntos y equilibrados en peso en
  ejecutores separados (`scripts/acceptance/probe-shards.mjs`). Una comprobación agregada,
  `probes`, pasa únicamente cuando todos los fragmentos pasan y es el nombre que la protección de ramas
  requiere. Las *pull requests* también ejecutan la aceptación *cross-stack* P0, que ahora también valida las
  comprobaciones de la ruta de *smoke*, por lo que el paso separado de *smoke* desaparece. *Master* ejecuta toda la
  aceptación *cross-stack*.
- **La verificación local antes de un *push* es `pnpm verify` más `pnpm check:ui`.** Las
  puertas estáticas y el análisis de secretos en el *worktree* se siguen ejecutando por completo; el navegador ejecuta únicamente
  los escenarios a los que el cambio puede afectar. `pnpm verify:full` sigue estando disponible y
  sin cambios para modificaciones en la compilación, el *harness* o el flujo de trabajo, y para reproducir
  la CI.
- **El planificador de la UI acota por evidencia, no por suposición.** Sigue el gráfico de
  importación en tiempo de ejecución a partir de la salida de transpilación de TypeScript, trata una edición del catálogo que solo
  añade entradas como si no seleccionara nada, y atribuye los cambios en el código de sondeo a los escenarios que los
  utilizan. Cada regla que acota tiene una prueba propia con un caso en el que no debe hacerlo, y el
  planificador se amplía a todo el catálogo siempre que no pueda ubicar un cambio.

## Consecuencias

- No se eliminó ninguna puerta. El catálogo de sondeos ahora se ejecuta antes de la fusión en lugar de después,
- lo cual es más sólido que antes; la ejecución local es más acotada pero va seguida de la ejecución completa
- en la CI antes de que cualquier cosa se fusione.
- La CI utiliza más minutos de ejecutor: tres fragmentos de sondeo por evento. El tiempo real (*wall clock*)
  de la *pull request* se mantiene prácticamente sin cambios, ya que los fragmentos se ejecutan junto al trabajo del navegador.
- La protección de ramas en `master` requiere el agregado `probes` junto con `static` y `browser`. Sin ese requisito, los fragmentos se ejecutarían pero no bloquearían una fusión; la decisión de este ADR depende de ello, por lo que forma parte del cambio en lugar de ser un seguimiento posterior.
- Un error en el planificador podría subseleccionar localmente. El catálogo completo de la CI lo detecta antes de la fusión,
  y las pruebas de casos negativos del planificador son las que evitan que eso ocurra con frecuencia.
- Añadir una página de consola requiere una regla de planificación (aplicada por
  `scripts/ui-impact.test.mjs`); añadir un sondeo requiere únicamente su entrada en el registro.
