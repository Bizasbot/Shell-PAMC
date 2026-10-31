# ADR 0004: Adoptar @ant-design/charts para el panel de control y visualización de datos

- Estado: Aceptado
- Fecha: 2026-09-14

## Contexto

Anteriormente, Oh My CPA renderizaba los gráficos de líneas (sparklines) de los KPI del panel de control utilizando rutas SVG hechas a mano (`web/src/charts/chartTheme.ts`), lo que reflejaba una limitación de diseño inicial documentada en `docs/design.md` §6 para evitar incluir cualquier motor de gráficos en tiempo de ejecución. Aunque esto mantuvo el peso inicial del paquete al mínimo para tendencias simples, la hoja de ruta del producto requiere visualizaciones de datos más ricas (incluyendo gráficos de cascada de solicitudes de tipo gantt, mapas de calor de densidad de tokens y telemetría de uso estructurada).

Continuar creando rutas SVG personalizadas y renderizado en canvas genera costos de mantenimiento acumulativos, errores geométricos específicos y una ergonomía de interacción inconsistente en visualizaciones complejas.

## Decisión

Adoptar `@ant-design/charts` (versión 2, impulsado por `@antv/g2`) como la librería de gráficos estándar para Oh My CPA:

1. Reemplazar los mini-gráficos (sparklines) de las tarjetas KPI del panel de control hechos a mano con marcas de área de `@ant-design/charts` (`web/src/charts/DashboardTrendChart.tsx`). La marca es de tipo área debido a que el backend rellena con ceros una cuadrícula de intervalos fija: una marca de barra renderiza cada intervalo vacío como un espacio invisible que se interpreta como datos faltantes, mientras que un área extiende la serie hasta su línea base. Véase `docs/design.md` §6 para ver el razonamiento completo.
2. Reemplazar la restricción anterior en `docs/design.md` §6 que prohibía los motores de gráficos en tiempo de ejecución.
3. Aplicar tres mitigaciones obligatorias para evitar que las regresiones en el peso del paquete afecten al shell de la aplicación:
   - **Fragmento manual dedicado**: Enrutar todos los módulos de `node_modules/@antv/`, `node_modules/@ant-design/charts` y `node_modules/@ant-design/plots` hacia un fragmento aislado llamado `vendor-charts` en `web/vite.config.ts`.
   - **Carga diferida (Lazy loading)**: Cargar el motor de gráficos de forma dinámica (`React.lazy(() => import(...))`) de modo que solo las rutas que renderizan gráficos (como `/dashboard`) soliciten el fragmento; el shell de la aplicación y la puerta de autenticación (`/login`) nunca incluyen `vendor-charts` en su grafo.
   - **Presupuesto de paquete aplicado**: Añadir un presupuesto explícito para el fragmento `vendor charts` (límite de 1600 kB frente a los ~1435 kB medidos y minificados) y actualizar los presupuestos agregados de JavaScript y de distribución en `scripts/check-bundle-budget.mjs`.
4. Aplicar invariantes visuales estrictas:
   - Deshabilitar explícitamente las animaciones de la librería de gráficos (`animate: false`) según la regla 5 de `docs/design.md` §7.
   - Vincular los tokens de la paleta directamente (`sparkColor(mode, tone)`) en lugar de codificar los colores estáticamente.
   - Mantener superposiciones de HTML ligeras controladas por la aplicación (`.chart-tooltip`) y estilizadas mediante variables CSS personalizadas.

## Consecuencias

### Positivas

- Proporciona un motor de visualización robusto y declarativo capaz de escalar ante futuros requisitos (cascadas tipo gantt, series multieje) sin acumular código matemático y de renderizado personalizado. (El mapa de calor de tokens del panel de control es una cuadrícula DOM en lugar de una marca del motor de gráficos; véase el ADR 0005.)
- Opera completamente sin conexión (*offline*) y sin dependencias de CDN, integrándose limpiamente en el binario único de la aplicación Go.
- Límite arquitectónico limpio: `vendor-charts` está aislado y se carga únicamente bajo demanda.

### Compensaciones

- Aumento sustancial en el tamaño del paquete: la incorporación de `@ant-design/charts` añade ~1435 kB minificados (+434 kB gzip) a `vendor-charts`.
- Requiere elevar los presupuestos agregados del paquete:
  - `total JavaScript`: 6075.41 kB -> 7510.13 kB (presupuesto elevado de 6300 kB a 7800 kB).
  - `total web/dist`: 7544.73 kB -> 8979.53 kB (presupuesto elevado de 7800 kB a 9300 kB).

## Alternativas consideradas

- **Continuar creando marcas SVG a mano**: Mantiene el paquete más pequeño en ~1.4 MB, pero falla a largo plazo al implementar gráficos complejos (gantt, mapas de calor) donde el renderizado manual se vuelve frágil, costoso y propenso a errores.
- **ECharts (`echarts-for-react`)**: Potente, pero conlleva un peso de paquete comparable sin integrarse de forma natural con los tokens de diseño y los patrones de diseño de Ant Design.
