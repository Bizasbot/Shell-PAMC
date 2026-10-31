# ADR 0086: Las esquinas de las conversaciones siguen la geometría de la consola

- Estado: Aceptado
- Superado en parte: la página del Playground, sus rutas y los ADRs 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agente se mantiene (lista de modelos `GET /agent/models`, ejecuciones `/agent/runs/...`).
- Fecha: 2026-10-08
- Modifica: Los valores de radio del ADR 0081. Sus reglas de relleno, encuadre, tipografía y movimiento permanecen sin cambios.
- Modificado por: ADR 0103, que traslada la consola a una escala de esquinas de 2 · 6 · 8 · 12 y los radios de las conversaciones con ella.

## Contexto

El Agente y el Playground comparten un espacio de trabajo de conversación, mientras que la consola circundante utiliza controles y tarjetas de 4px. Las esquinas más grandes de la conversación hacen que ambas superficies se perciban como sistemas visuales diferentes. Los objetos de conversación aún necesitan una jerarquía de formas pequeña sin permitir que la geometría supere a su contenido.

## Decisión

1. La salida impresa y los controles presionados utilizan esquinas de 4px, coincidiendo con la consola.
2. Los paneles de campos y las listas flotantes utilizan esquinas de 6px. Los compositores, las burbujas de operador, las tarjetas de aprobación, los paneles de preguntas y las sugerencias utilizan esquinas de 8px.
3. Mantener los nombres de tokens semánticos existentes y los rellenos de agrupación de primer plano. `THREAD_RADII` en `web/src/theme/palette.ts` posee los valores; la proyección del tema y las exportaciones de conversaciones HTML los leen. `web/src/index.css` refleja los valores predeterminados del primer fotograma.
4. Aplicar la escala tanto a los espacios de trabajo de conversación como a las tarjetas de aprobación compartidas. Los demás componentes de la consola conservan su geometría existente.

## Consecuencias

Los controles de conversación y los marcos de documentos se integran con la consola, mientras que los objetos de conversación más grandes conservan una distinción modesta. Los consumidores de CSS existentes no necesitan anulaciones por elemento. Las pruebas de proyección de paleta fijan los valores y sus valores predeterminados anteriores a la hidratación.
