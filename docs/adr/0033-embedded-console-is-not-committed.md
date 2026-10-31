# ADR 0033: La consola embebida no se versiona; un binario sin compilar actúa como marcador de posición

- Estado: Aceptado
- Fecha: 2026-09-28

## Contexto

`internal/web` embebe `internal/web/dist`, el cual es poblado por `pnpm build`. `go:embed`
de Go rechaza un directorio sin ningún archivo que se pueda embeber, y las pruebas de Go
solicitan la página de entrada de la consola, por lo que un clon (*checkout*) que no hubiera
compilado el frontend necesitaba algo en ese directorio. El repositorio versionaba el propio
`internal/web/dist/index.html` de la compilación para ese propósito e ignoraba el resto de `dist/`.

Ese archivo es el resultado de una compilación. Sus etiquetas de script y precarga contienen
hashes de contenido, y el hash de la entrada cambia siempre que cualquier módulo al que hace
referencia cambie, incluidas las páginas de carga diferida (*lazy pages*). La CI compila
la consola y luego exige un árbol de trabajo limpio (*clean worktree*), por lo que casi
cada solicitud de extracción (*pull request*) del frontend tenía que ejecutar `pnpm build`
y versionar el archivo regenerado, y dos ramas que lo hacían entraban en conflicto en él.
Además, la copia versionada nunca fue una página funcional: sus recursos están ignorados,
por lo que un binario compilado a partir de un clon limpio servía un documento cuyos scripts
daban un error 404.

## Decisión

- **Nada de lo que escribe la compilación se versiona.** `internal/web/dist/` se rastrea
  únicamente a través de `.gitkeep`, e `internal/web/embed.go` lo embebe como `all:dist` para
  que ese archivo satisfaga a `go:embed`. `scripts/sync-web-dist.mjs` nunca lo elimina.
- **Un binario sin compilar sirve un marcador de posición (*placeholder*).** `web.IndexHTML`
  devuelve el `index.html` de la compilación, o `internal/web/placeholder.html` cuando
  no existe ninguno. El marcador de posición es un documento HTML real con un `<head>`
  y el espacio reservado para la configuración en tiempo de ejecución, por lo que la
  inyección del servidor y las pruebas de Go se comportan igual con o senza una compilación,
  y le indica al operador que debe ejecutar `pnpm build`.

## Consecuencias

- Un cambio en el frontend ya no modifica ningún archivo generado versionado, y las
  comprobaciones de árbol de trabajo limpio de la CI siguen protegiendo los archivos que
  todavía se generan y versionan (el conjunto de datos de demostración, por ejemplo).
- Las pruebas de Go ejecutan el marcador de posición en el trabajo estático y la página de
  entrada real después de una compilación. Deben seguir asegurando únicamente aquello que
  ambos satisfacen.
- `scripts/build-demo.mjs` detecta una compilación faltante a través del documento de
  entrada en lugar del directorio, el cual ahora existe en cada clon (*checkout*).
