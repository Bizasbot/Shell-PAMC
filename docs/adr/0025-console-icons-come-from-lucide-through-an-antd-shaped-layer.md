# ADR 0025: Los iconos de la consola provienen de Lucide a través de una capa con la forma de Ant Design

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto

Todas las interfaces de la consola obtenían sus iconos de `@ant-design/icons`, por lo que dicho paquete era una dependencia directa de `web/`. Dos hechos hicieron que valiera la pena el esfuerzo de reemplazarlo:

- La consola no podía elegir su propio conjunto de iconos; el vocabulario era el que ese paquete ofrecía.
- `.anticon` tiene un rol estructural más allá de ese paquete. Los propios componentes de antd siguen emitiendo la clase, y el CSS de primer nivel sigue seleccionándola (`.req-back-to-top-btn .anticon`, `.request-source-chain > .anticon`), por lo que los nombres de las clases deben sobrevivir sin importar qué renderice los iconos.

El paquete también inyecta su hoja de estilos (el modelo de caja de `.anticon` y `.anticon-spin`) en tiempo de ejecución cuando uno de sus componentes se monta. Por lo tanto, esas declaraciones no eran nuestras, y nuestros iconos dependían de que otra biblioteca montara elementos en la misma página.

## Decisión

`web/src/components/icons/index.tsx` es la capa de iconos de la consola. Envuelve a los componentes de Lucide en reenviadores que conservan los nombres de Ant Design (`<ApiOutlined />`, `<SyncOutlined spin />`) y las clases `anticon`/`anticon-<name>`, de modo que los 52 consumidores importan la capa en lugar de una biblioteca de iconos.

`web/src/index.css` contiene las dos declaraciones de las que depende la consola:

- el modelo de caja base (`display`, `align-items`, `color`, `line-height`, `vertical-align`);
- los fotogramas clave (*keyframes*) de giro (*spin*).

La regla base es un subconjunto de lo que inyectaba el paquete eliminado, idéntico propiedad por propiedad, para que los propios iconos de antd se rendericen sin cambios. La animación de giro es de 900 ms por rotación, coincidiendo con las barras de progreso indeterminadas, y está registrada como una excepción de `duration` en `scripts/check-motion.mjs`: una rotación es un bucle cuyo periodo no es una transición de estado, por lo que la sección §7 la detiene bajo movimiento reducido en lugar de acortarla. Una excepción que deje de coincidir hará que la verificación falle.

`web/package.json` incluye `lucide-react` y ya no incluye `@ant-design/icons`. antd sigue dependiendo de ese paquete internamente; este ADR cubre lo que importa *nuestro* código, y la consola no accede a la copia de antd. `export * from 'lucide-react'` reexporta el conjunto completo para los llamadores que deseen un icono sin envolver, y cuenta con eliminación de código muerto (*tree-shaking*): el paquete compilado contiene los iconos que la capa envuelve y ninguno de los que no.

## Consecuencias

- La consola posee su propio vocabulario de iconos; cambiarlo o ampliarlo requiere editar un solo archivo.
- La alineación y el giro de los iconos ya no dependen de la inyección en tiempo de ejecución de otro paquete.
- `vertical-align: -0.125em` y `line-height: 0` son nuestros para mantenerlos correctos. Sin la regla base, un glifo de Lucide recurriría a `vertical-align: baseline` y al modelo de caja que esperan el CSS de la consola y los componentes de antd; las declaraciones se tomaron de lo que inyectaba el paquete eliminado en lugar de ajustarse visualmente a ojo.
- Un glifo de Lucide y el glifo de Ant Design que reemplaza son similares, no idénticos, por lo que un cambio en el mapeo de la capa aún requiere una revisión visual.
