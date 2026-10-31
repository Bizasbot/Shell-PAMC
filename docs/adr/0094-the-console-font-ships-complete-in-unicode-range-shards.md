# ADR 0094: La fuente de la consola se distribuye completa en fragmentos unicode-range

- Estado: Aceptado
- Supersedido en parte: la página Playground, sus rutas y los ADRs 0022-0024 fueron eliminados; las menciones al Playground a continuación son históricas. El Agent se mantiene (lista de modelos `GET /agent/models`, ejecuciones `/agent/runs/...`).
- Fecha: 2026-10-12
- Modifica: El límite máximo de anomalía de distribución del ADR 0053.

## Contexto

La consola dibuja todo utilizando Sarasa Mono SC, incrustada para que el binario funcione sin conexión. Se distribuía como un subconjunto por peso, recortado a partir de los caracteres presentes en `web/src` y almacenado en el repositorio. El texto añadido después del recorte faltaba, al igual que cualquier texto que solo llega en tiempo de ejecución: respuestas del Agent y del Playground, nombres de modelos, etiquetas escritas por los usuarios. El navegador dibujaba cada carácter faltante utilizando una fuente del sistema, por lo que una sola etiqueta podía mezclar dos tipos de letra. Una verificación de cobertura puede mantener un subconjunto sincronizado con el texto estático, pero ningún subconjunto puede prever lo que escribe un modelo.

La fuente completa pesa alrededor de 5 MiB de woff2 por peso. Declarada como un único archivo, cada primera visita tendría que esperar por ambos pesos, y una conversación exportada, que incrusta su fuente como datos, cargaría con unos 13.5 MiB de ella.

## Decisión

1. Distribuir la fuente completa, dividida en fragmentos (*shards*) declarados mediante `unicode-range`, para que el navegador descargue únicamente los fragmentos cuyos caracteres dibuja la página. La fuente proviene de una versión fijada de npm, `@fontpkg/sarasa-mono-sc@0.36.0`, verificada contra su hash de integridad; sus glifos y métricas tipográficas coinciden con el subconjunto al que reemplaza con una precisión de hasta 2/1000 em.
2. El fragmento 000 de cada peso es el núcleo (*core*): ASCII, Latín-1, puntuación común y cada carácter presente en el código fuente de la consola. Solo este se declara en el CSS que bloquea el renderizado (`web/src/assets/fonts/sarasa/core.css`), por lo que el primer fotograma espera un solo archivo por peso.
3. Los demás fragmentos se registran a través de la API `FontFace`, a partir de `web/src/assets/fonts/sarasa/manifest.json`, mediante un proceso asíncrono iniciado al arrancar. Están ordenados según la frecuencia de uso de sus caracteres (GB2312 nivel 1, Big5 nivel 1, GB2312 nivel 2, Big5 nivel 2, y el resto por punto de código), por lo que un texto en chino corriente solo utiliza un puñado de fragmentos.
4. Una conversación exportada incrusta únicamente los fragmentos que su propio texto dibuja.
5. `pnpm subset-font` regenera los fragmentos, el manifiesto, la hoja de estilos del núcleo y un módulo de importaciones estáticas `?url` para las URLs de los fragmentos; una autoprueba valida la coherencia entre ellos y con el texto fuente.
6. Elevar el límite máximo de anomalía de distribución de 20 MiB a 32 MiB en bruto. Los demás límites del ADR 0053 no se modifican; los fragmentos del núcleo mantienen el CSS de inicio dentro de su propio límite.

## Consecuencias

- El binario, la imagen y la demostración aumentan en unos 12.5 MiB (242 archivos), la gran mayoría de los cuales el navegador nunca llega a descargar.
- Un carácter fuera del núcleo se dibuja con una fuente de respaldo hasta que llega su fragmento, momento en el cual se reemplaza. Un núcleo desactualizado solo provoca ese intercambio, nunca un glifo incorrecto, por lo que añadir texto ya no requiere regenerar la fuente.
- La regeneración requiere `pyftsubset` (fontTools), al igual que el subconjunto anterior.
