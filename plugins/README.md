# Registro de plugins de Shell-PAMC

Este directorio publica el registro de plugins propio de Shell-PAMC, que la consola mantiene
configurado como origen de la tienda de plugins. CPA lo consulta mediante HTTPS desde la rama
`master`:

```
https://raw.githubusercontent.com/Bizasbot/Shell-PAMC/main/plugins/registry.json
```

La dirección está compilada dentro del binario (`internal/pluginregistry`), no configurada
en `config.yaml`; la consola la añade a `plugins.store-sources` y la restaura si
se elimina allí. El origen se puede desactivar en **Ajustes → Tienda de plugins**,
lo que vuelve a quitar la dirección.

## Formato

El archivo es el documento de registro de plugins de CPA. `schema_version` es `1` o `2`; la versión
2 permite adicionalmente `install.type: direct` con artefactos por versión. Cada entrada
declara los campos validados por CPA:

| Campo | Obligatorio | Notas |
| --- | --- | --- |
| `id` | sí | `[A-Za-z0-9][A-Za-z0-9._-]{0,127}`, único en el archivo |
| `name` | sí | Mostrado en la tarjeta de la tienda |
| `description` | sí | Una sola oración es suficiente |
| `author` | sí | |
| `repository` | sí para `github-release` | `https://github.com/{owner}/{repo}` exactamente: la tienda construye las URLs de releases a partir de él y rechaza la abreviatura `owner/repo`, el sufijo `.git` o cualquier otro host |
| `version` | opcional | Valor de visualización de respaldo; la release más reciente es autoritativa. Sin `v` inicial (pertenece al tag) |
| `homepage`, `license`, `tags`, `logo` | opcional | `logo` es una URL que la consola incrusta |

Una lista `plugins` vacía es válida: el registro se publica antes de que exista el primer plugin,
de modo que la tienda tenga un origen funcional en lugar de uno con fallos. Una sola entrada
malformada no lo es: CPA rechaza el documento completo, haciendo que cada instalación muestre un
registro de Shell-PAMC vacío y únicamente la línea de error de la pasarela. Las pruebas en Go en
`internal/pluginregistry` validan el archivo publicado (`pnpm test:fast` las ejecuta cuando el registro cambia) por esa razón.

Las entradas se seleccionan manualmente aquí, no se descubren automáticamente. Un plugin instalado desde este registro
sigue requiriendo que se escriba su ID en el diálogo de instalación: la confirmación trata sobre ejecutar
código dentro de la pasarela, no sobre qué registro lo suministró.
