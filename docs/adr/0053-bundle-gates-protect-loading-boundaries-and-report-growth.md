# ADR 0053: Las puertas de paquetes (_bundle gates_) protegen los límites de carga e informan sobre el crecimiento

- Estado: Aceptado
- Fecha: 2026-10-02

## Contexto

La consola embebida y sin conexión todavía envía recursos a un navegador, por lo que los costos de transferencia en frío, análisis sintáctico (_parse_) y ejecución siguen importando. Sin embargo, los inventarios de rutas perezosas (_lazy_) no son costos de inicio, y un fragmento (_chunk_) con nombre no equivale a su grafo de dependencias transitivas. Las cuotas por fragmento se acercaban repetidamente al crecimiento ordinario de características y textos: después del PR 114, la entrada era de 313.97 KiB frente a 314 KiB. Unos pocas decenas de bytes de margen restante no representaban un límite medido de la experiencia de usuario. Por el contrario, mover código a otro fragmento ansioso (_eager_) podía cumplir con la cuota de entrada sin reducir el trabajo de inicio.

El antiguo paso de preparación en la CI se detenía antes de la aceptación del navegador de producción ante cualquier fallo de presupuesto, perdiendo evidencia de corrección independiente de una compilación por lo demás válida. Los límites deben detectar errores arquitectónicos sin convertirse en un impuesto rutinario por características ni impedir el diagnóstico.

## Decisión

1. Capturar la propiedad de los fragmentos de Rollup y las importaciones estáticas/dinámicas fuera de la distribución servida. Validar los hashes de los fragmentos y las aristas (_edges_) frente a los artefactos de producción. Recorrer el cierre estático de entrada HTML/modulepreload, no las convenciones de nombres de archivos.
2. Rechazar módulos ansiosos de rutas, shell autenticado, gráficos (_charts_), Markdown y Monaco. Hacer cumplir también el límite del editor de YAML bajo demanda en la página de configuración.
3. Informar sobre las estimaciones gzip brutas y de nivel 6 por archivo, JS/CSS de inicio, entrada, JS más grande, JS total, SVG de iconos y dist. Retener la evidencia por archivo/fuente para su atribución.
4. Comparar únicamente con una línea base de revisión exacta, obtenida de un informe de CI de un _push_ exitoso o proporcionada explícitamente. Una única referencia de arranque medida respalda la primera implementación de la política. Se indica la evidencia faltante; nunca se sustituyen revisiones no relacionadas. El crecimiento ordinario es meramente informativo.
5. Mantener techos amplios de anomalías absolutas: JS de inicio 3 MiB en crudo / 1 MiB gzip, CSS de inicio 256 / 96 KiB, JS más grande 4 MiB en crudo, JS total 16 MiB en crudo, dist total 20 MiB en crudo, SVG de Lobe 2 MiB en crudo. Estos permiten un margen material en relación con la línea base medida, no una afirmación sobre la latencia aceptable. Modificarlos deliberadamente con mediciones en lugar de hacerlo como parte de cada característica.
6. Separar el veredicto del paquete de la evidencia válida de compilación del navegador/demostración. La CI y la verificación local completa siguen fallando cuando la puerta del paquete falla, después de recopilar los demás resultados. Los requisitos previos de compilación, secretos y cadena de herramientas se mantienen.

## Consecuencias

Los textos localizados normales y las dependencias locales de página ya no requieren ediciones de cuota. Las aristas de dependencia reales evitan que los fragmentos renombrados o compartidos oculten módulos pesados ansiosos. Las pruebas automatizadas de _scripts_ pueden falsear las decisiones de grafo, línea base y veredicto sin pagar el costo de un navegador por cada caso. La aceptación en producción sigue validando los recursos embebidos, las rutas y el comportamiento; el informe de tamaño no es una prueba comparativa de latencia (_benchmark_) de latencia.

La CI conserva los informes durante 30 días con acceso de solo lectura en Actions. La expiración de artefactos, las ejecuciones base exitosas no disponibles o los fallos de recuperación reducen la cobertura de comparación y son visibles en el informe, pero no pueden deshabilitar las comprobaciones estructurales o absolutas. El recolector añade metadatos temporales de compilación y trabajo de compresión/informes; no añade ninguna dependencia en tiempo de ejecución, extremo de recursos ni metadatos desplegados.
