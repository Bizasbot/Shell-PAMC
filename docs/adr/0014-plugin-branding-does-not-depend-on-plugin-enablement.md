# ADR 0014: La identidad visual ("branding") de un plugin no depende de su estado de habilitación

- Estado: Aceptado
- Fecha: 2026-09-19

## Contexto

La decisión 1 del ADR 0013 nombró al plugin como la autoridad sobre la marca de su proveedor, y luego añadió una cláusula
propia: *"Solo contribuye un plugin que esté efectivamente habilitado"*. La premisa detrás de esa cláusula era que
un plugin deshabilitado no puede contener credenciales, por lo que su logotipo solo decoraría un nombre que el operador
no puede usar.

La premisa es incorrecta, y el cambio fusionado lo demostró. Deshabilitar un plugin en CPA altera
`plugins.configs.<pluginID>.enabled`; no elimina los archivos de autenticación que ese plugin registró. Esas
credenciales siguen apareciendo en las interfaces de gestión de OAuth, cuotas y registros de solicitudes (request-record), donde se
solicita la marca por clave de proveedor. El conjunto de IDs de proveedor del propio dashboard (`pluginOAuthIds` en
`web/src/components/dashboard/DashboardProviders.tsx`) tampoco filtraba por habilitación, por lo que el proveedor de un plugin deshabilitado
se listaba junto a uno cuya marca se resolvía, mostrando un marcador de posición (placeholder) donde debería estar el logotipo propio del plugin.
Ese es el defecto que el ADR 0013 existe para eliminar, reintroducido por una cláusula en su interior.

Una revisión de código del cambio fusionado lo señaló (`web/src/types/pluginOAuthProviders.ts`), y se
verificó contra el código en lugar de aceptarlo por la palabra del revisor: el filtro es la única condición en
esa ruta, y nada más en la consola excluye a un plugin deshabilitado de esas interfaces.

## Decisión

**El diseño de marca (branding) es una propiedad de la identidad del proveedor, no del estado actual del interruptor del plugin.**
`pluginOAuthProviderLogos` aporta el logotipo publicado para cada plugin que registre un proveedor
OAuth, esté o no habilitado dicho plugin, y la marca se resuelve por clave de proveedor donde sea que el
proveedor aparezca, incluyendo en las filas que pertenecen a credenciales y a registros de solicitudes, generadas
mientras el plugin estaba habilitado.

La exclusión de un plugin deshabilitado se mantiene donde residen las **acciones** del plugin, que es el
generador de tarjetas de la página de inicio de sesión de OAuth, y permanece sin cambios allí: un plugin deshabilitado no ofrece inicio de sesión.

Esto reemplaza la cláusula *"Solo contribuye un plugin que esté efectivamente habilitado"* de la decisión 1 del ADR 0013.
La decisión 1 del ADR 0013 se mantiene en todo lo demás, al igual que sus decisiones 2 a 4: el proceso sigue obteniendo e incrustando
el logotipo, una URL declarada por el plugin sigue estando sujeta a la política de destino más estricta, y la
lista de plugins sigue proyectándose en el DTO de la propia consola.

## Consecuencias

- Una credencial perteneciente al proveedor de un plugin deshabilitado, y una solicitud histórica respondida por este, muestran
  la marca propia de ese plugin en lugar de un marcador de posición. Ese es el objetivo: la marca identifica al proveedor
  detrás de la fila, y no deja de ser cierta cuando se apaga el plugin.
- El logotipo se resuelve para un plugin que el operador ha apagado, por lo que el despliegue puede obtener recursos gráficos
  para un plugin que no está usando. La obtención ya ocurría para cada plugin instalado antes de esta
  decisión —recorre la lista de plugins, la cual no es filtrada por la habilitación—, por lo que el cambio radica en lo que
  la consola *dibuja*, no en lo que el proceso consulta.
- Un operador que desgrana o deshabilitar un plugin para apartarlo sigue viendo su marca en las filas históricas.
  Ocultar esas filas es una cuestión diferente, y responderla con una regla de diseño de marca habría sido la herramienta incorrecta.
- `scripts/test-provider-icons.ts` valida ambas direcciones: un plugin deshabilitado a través de su propio interruptor o
  a través del global sigue nombrando a su proveedor, mientras que un plugin que no declara ni `supports_oauth`
  ni `oauth_provider` no aporta nada.

## Alternativas consideradas

**Mantener el filtro y aceptar un marcador de posición en las filas cuyo plugin esté deshabilitado.** Rechazado: es el
defecto reportado en sí mismo, y hace que la consola no coincida con su propio dashboard, el cual lista dicho
proveedor de cualquier manera.

**Eliminar las credenciales y registros de un plugin deshabilitado de todas las interfaces.** Rechazado: esos son
hechos históricos, no configuración; el registro de una solicitud que ocurrió no deja de haber ocurrido porque un
plugin haya sido apagado posteriormente. Cambiar qué historial se muestra es una decisión separada de qué marca lleva una fila.

**Filtrar por `registered` en lugar de `enabled`.** Rechazado: `registered` informa si la biblioteca dinámica se
cargó en este proceso, lo cual es una declaración sobre el tiempo de ejecución del plugin, no sobre si su proveedor
tiene credenciales o historial. Produciría la misma discrepancia con las interfaces que los listan.

**Tratar la habilitación como una intención del operador que también debería ocultar la marca.** Rechazado: el operador
desactiva un plugin para dejar de *usarlo*. La marca en una credencial o en una solicitud pasada no es una
invitación a usar nada, y eliminarla le cuesta al operador la capacidad de saber a qué cuenta pertenece una fila.
