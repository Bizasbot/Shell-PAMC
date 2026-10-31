# ADR 0013: Un plugin es dueño de la marca de su proveedor, y el servidor la incrusta

- Estado: Aceptado; la cláusula *"Solo un plugin efectivamente habilitado contribuye"* de la decisión 1 es
  reemplazada por [ADR 0014](0014-plugin-branding-does-not-depend-on-plugin-enablement.md)
- Fecha: 2026-09-19

## Contexto

Las pestañas de proveedores en **Cuota de OAuth** y **Gestión de OAuth**, las tarjetas de credenciales,
las tarjetas de cuota, los registros de solicitudes, la tabla de proveedores y las filas de proveedores del
panel muestran una marca de la marca (logotipo) del proveedor detrás de una fila. Se informaron dos defectos
en relación con ellas:

1. **Devin, Meta y un proveedor registrado por un plugin (Codebuddy) mostraban un marcador de posición neutral**
   mientras sus gráficos permanecían sin usar en el paquete. Las pestañas resolvían una marca únicamente
   a través de `web/src/components/common/providerMetadata.ts`, y esa tabla no tenía ninguna fila para ellos,
   por lo que la marca era una cadena vacía. `QuotaCard`/`AuthFileCard` se salvaban solo porque además
   consultaban el catálogo incluido.
2. **No se utilizaba un icono proporcionado por un plugin.** Un plugin es la única autoridad sobre cómo se ve
   el proveedor que registra: el catálogo incluido no se puede actualizar instalando un plugin, por lo que
   una marca adivinada a partir de la clave del proveedor puede pertenecer a la marca de otra persona.

El segundo punto tiene una restricción que el primero no tiene. Un plugin publica su logotipo como una URL
absoluta (el plugin de CodeBuddy incluye `https://cdn.jsdelivr.net/…/workbuddy/default.svg`), y esta consola no
puede cargar eso en el navegador:

- AGENTS.md prohíbe un recurso frontend que requiera una CDN, y `README.md` promete que no habrá solicitudes
- a una CDN en tiempo de ejecución; la SPA está incrustada en el binario de Go precisamente para que un
  despliegue no tenga dependencias de archivos estáticos.
- La consola ya se sirve a sí misma bajo `Content-Security-Policy-Report-Only: … img-src 'self' data:
  blob:` — una política que contradice una recuperación del host del plugin desde el navegador, y con la cual
  este ADR alinea la ruta de la imagen en lugar de relajarla.

Por lo tanto, el requisito "usar el propio icono del plugin" y el invariante "el navegador no carga nada desde
fuera del binario" no pueden cumplirse simultáneamente si el navegador es el encargado de realizar la petición.

## Decisión

**1. El logotipo publicado del plugin supera a la marca del catálogo, en todas partes donde se dibuje la marca de un proveedor.**
`web/src/types/pluginOAuthProviders.ts` resuelve la lista de plugins en logotipos basados en la clave del proveedor,
claveada tanto por `oauth_provider` como por el propio id del plugin (un plugin cuyas autenticaciones se escriben
por su id debe resolverse con la misma marca). `ProviderBrandIcon` en `LobeIcon.tsx` es el único componente que
elige entre el logotipo del plugin y la marca del catálogo, por lo que las interfaces no pueden entrar en conflicto
sobre un proveedor. Solo un plugin efectivamente habilitado contribuye. La marca del catálogo sigue siendo la alternativa
(fallback), y un proveedor no coincidente se deja *sin marca* en lugar de resolverse a una marca predeterminada.

**2. El proceso de Go recupera ese logotipo y lo incrusta.** Se llama a `internal/api/management_plugin_logos.go`
desde la lista de plugins: este recupera la URL declarada, requiere un tipo de contenido multimedia (media type)
de imagen a partir de una lista blanca vinculada, limita el cuerpo a 512 KiB e informa una URL `data:` incrustada
tanto en `logo` como en `metadata.logo`. Un logotipo que no se pueda incrustar se reporta como **ausente**, lo que
activa la alternativa del catálogo. El frontend acepta únicamente `data:image/*` incrustado, por lo que una URL que
el navegador no deba cargar no puede llegar de ninguna manera a una etiqueta `img`.

**3. Una URL declarada por un plugin se rige por una política de destino más estricta que una escrita por un operador.**
`internal/api/outbound_fetch.go` comparte la regla de redirección (se rechaza cualquier redirección que cambie
el esquema o el host) entre ambas recuperaciones salientes, pero no la regla de destino:

| Recuperación | Quién eligió la URL | HTTP en texto plano | Comprobación de dirección |
| --- | --- | --- | --- |
| Obtención de lista de modelos | el operador, para un proveedor que ejecuta | permitido para localhost, loopback y literales privados | ninguna más allá del esquema |
| Logotipo de plugin | el manifiesto de un plugin instalado | permitido únicamente para esta máquina | se rechaza la dirección resuelta en el marcador (dialer) a menos que sea un espacio público de Internet: la red del operador, NAT a escala de operador (`100.64.0.0/10`), multidifusión (multicast), no especificado y los bloques IANA reservados son todos rechazados, y la recuperación se conecta directamente para que la comprobación no pueda trasladarse a un proxy |

La asimetría es el objetivo: un *relay* autohospedado en la LAN del operador es un destino normal de obtención de
modelos, mientras que el manifiesto de un plugin es una entrada de terceros y no debe convertirse en una forma de
llegar a la red del operador o a `169.254.169.254`. Comprobar la dirección **resuelta** en el momento de la llamada
es lo que convierte esto en un límite en lugar de una comprobación de nombres; también cierra la reanudación de DNS
(DNS rebinding).

**4. La lista de plugins se proyecta en el propio DTO de la consola.** `PluginItemDTO` declara explícitamente
los campos de respuesta, como cualquier otra superficie de gestión, por lo que un campo añadido al modelo de fachada
para su decodificación no puede ampliar esta API sin una decisión previa, y el texto del manifiesto está acotado
en la salida.

## Consecuencias

- **Se dibuja la propia marca del plugin y el navegador sigue cargando únicamente recursos gráficos incrustados o del mismo origen.**
  Verificado en vivo: el logotipo de jsdelivr del plugin CodeBuddy llega como `data:image/svg+xml;base64,…`
  (5 670 bytes) con cero URLs de CDN en la respuesta.
- **El despliegue ahora se comunica con el host del plugin** (como máximo una vez por hora, por URL). Un despliegue
  aislado (air-gapped) no puede hacerlo y recurre a la marca incluida en el paquete, tal como se indica en `README.md`.
- **La anulación de icono almacenada por un operador ya no se aplica a un proveedor propiedad de un plugin.** Ese es
  el costo aceptado de que el plugin sea propietario de la identidad de su proveedor, y está registrado en la regla
  de nomenclatura de `CONTEXT.md`, que por lo demás establece que los iconos pertenecen a Oh My CPA.
- **Un logotipo alojado en la propia LAN del operador no se cargará**, por diseño (véase la tabla anterior); la alternativa
  es la marca del catálogo.
- **Un manifiesto aún puede apuntar la recuperación a un servicio en esta máquina**, y eso se permite a propósito:
  el bucle invertido (*loopback*) es la propia máquina, que una tienda de plugins autohospedada o desarrollada localmente
  utiliza legítimamente, y la solicitud no transporta credenciales, debe responder con un tipo de imagen de la lista blanca,
  y está limitada y en caché. Rechazarlo cambiaría ese caso por muy poco beneficio: el plugin ya se ejecuta dentro del
  proceso en CPA, por lo que puede acceder a los servicios locales directamente si lo desea.
- **Los fallos se almacenan en caché durante una hora, pero una recuperación que agotó su presupuesto no.** La consola
  consulta la lista de plugins, por lo que un host inaccesible no debe volverse a consultar en cada sondeo (poll),
  y agotar el tiempo no constituye una respuesta sobre el logotipo, por lo que un sondeo lento no puede costarle
  a un plugin su marca durante todo un TTL.
- **Un único plazo temporal (deadline) cubre toda la lista de plugins**, porque lo que debe mantenerse acotado es
  la respuesta sondeada, no cada solicitud individual.
- Manteniendo la coherencia: `scripts/test-provider-icons.ts` afirma que cada proveedor OAuth integrado alcanza
  una marca cuyos gráficos realmente se incluyen en el paquete —el invariante que el error reportado violaba—,
  y el conjunto de pruebas del navegador afirma una marca de catálogo, un logotipo publicado por un plugin y una fila de solicitud.

## Alternativas consideradas

**Seguir cargando el logotipo del plugin en el navegador** (el comportamiento anterior a este cambio). Satisface el
requisito de "usar el propio icono del plugin" en una sola línea, y fue rechazado porque hace que el renderizado de la
consola dependa de un host de terceros: la marca desaparece silenciosamente cuando ese host no está accesible, y tanto
el contrato fuera de línea declarado del despliegue como su propia CSP establecen que el navegador no carga nada desde fuera del binario.

**Rechazar los logotipos remotos y conservar únicamente la marca del catálogo** (el cambio correcto más pequeño, y lo que
una revisión de código de este trabajo sugirió inicialmente). Rechazado porque descarta silenciosamente la marca declarada
del plugin —el operador ve una marca que el plugin no eligió, sin ninguna señal de que el plugin haya publicado una— y deja
sin cumplir el requisito del informe.

**Pedir a los plugins que publiquen gráficos `data:` incrustados en su lugar.** La consola ya los acepta y eliminaría
la recuperación por completo. No puede ser una decisión aquí: rompería todos los plugins que ya declaran una URL, y el
propio campo de la API de plugins está documentado como una referencia a un recurso de visualización.

**Recuperar el logotipo en tiempo de compilación e incluirlo en el paquete.** Imposible en principio: los plugins se
instalan en tiempo de ejecución, después de que se compila el binario; la lista de plugins es exactamente aquello que
cambia sin necesidad de una nueva compilación.

**Utilizar la misma política de destino que para la obtención de modelos** (permitir texto plano en LAN). Rechazado:
permitiría que un plugin instalado apuntara este proceso a cualquier dirección dentro de la red del operador y obtuviera
la respuesta devuelta a la consola, lo cual es una capacidad que el operador nunca otorgó.
