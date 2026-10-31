# ADR 0069: Las credenciales de gestión de la página de complementos se verifican antes de CPA

- Estado: Aceptado
- Fecha: 2026-10-07
- Reemplaza: La decisión de la ADR 0067 de reenviar explícitamente Authorization y X-Management-Key
  a CPA para su validación, y su autenticación de escrituras nativas frente a la versión leída fija.
  Todo lo demás en la ADR 0067 sigue vigente.

## Contexto

La ADR 0067 reenviaba la credencial de gestión explícita de una página alojada para que CPA, no el
host, decidiera si era válida. CPA cuenta las autenticaciones de gestión fallidas por
dirección de cliente y bloquea la dirección durante 30 minutos tras cinco fallos; el bloqueo se
comprueba antes de la clave, por lo que a una dirección bloqueada se le deniega el acceso incluso con la clave correcta.
Los clientes loopback se cuentan y se bloquean como cualquier otro (CPA v8.0.17,
`AuthenticateManagementKey`).

Cada página alojada llega a CPA desde el proceso de Oh My CPA. Por lo tanto, una página de complementos que solicita
una clave de gestión al operador gastaba el propio presupuesto de bloqueos de la consola con cada clave mal escrita.
Unos pocos intentos erróneos dejaban inaccesible cualquier función de la consola respaldada por CPA
(configuración, proveedores, credenciales, complementos y recopilación de uso) hasta que el
bloqueo expiraba o CPA se reiniciaba. El recolector ya trata ese presupuesto como un recurso escaso
(`AuthCooldown` en `internal/usage/ingest/runner.go`).

## Decisión

No se envía ninguna credencial proporcionada por una página a la API de gestión de CPA.

`PluginRoute` lee la credencial de una página respetando la precedencia de CPA: un valor Bearer Authorization,
en su defecto el valor raw de Authorization, o de lo contrario X-Management-Key. Cuando cualquiera de las cabeceras está
presente, incluso si está vacía, la credencial se compara en tiempo constante con la clave de gestión
almacenada de la instancia. Una discrepancia se responde con un `401` con el formato de red de CPA
(`invalid management key`, o `missing management key` para una credencial vacía) sin
petición ascendente (*upstream*), copia de seguridad de configuración ni escritura. Si hay coincidencia, o si la página no envía
ninguna de las dos cabeceras, la petición continúa utilizando la clave almacenada como única credencial en la solicitud ascendente.

Las escrituras nativas ya no se autentican frente a la versión leída primero: la
credencial de la página ya está validada antes de realizar la copia de seguridad previa a la escritura.

La llamada sigue registrándose en la auditoría como `plugin.route_call`, y el rechazo se registra como un resultado fallido
con estado 401. Las reglas de credenciales de recursos y del directorio de modelos no cambian.

## Consecuencias y contrapartidas

Una clave incorrecta introducida en una página de complementos sigue fallando de forma visible, que fue la razón por la que
la ADR 0067 dejó de reemplazar las credenciales de las páginas, y ahora ya no puede bloquear el acceso de la consola a CPA.

El host acepta únicamente la clave almacenada para la instancia. CPA no tiene una lista de claves de
gestión, pero puede admitir hasta tres secretos a la vez: el configurado
`remote-management.secret-key`, la variable de entorno `MANAGEMENT_PASSWORD` y, solo para
clientes loopback, la contraseña local `--password`. Cuando estos difieren, se rechaza en esta superficie un secreto
distinto al almacenado, a pesar de que CPA lo aceptaría. Esto se asume como aceptable: la clave
almacenada es de la que depende cualquier otra característica de la consola, la página ya posee la autoridad de
sesión del operador y el rechazo no tiene coste en CPA. Probar una credencial desconocida frente a CPA en su lugar
gastaríai el mismo presupuesto que esta decisión protege.

Los rechazos locales no están limitados por tasa (*rate limited*). Requieren una sesión de consola autenticada,
cuyo inicio de sesión ya está limitado por sí mismo, y una sesión ya puede actuar a través del host con
la clave almacenada sin necesidad de presentar una.

El texto del rechazo imita al de CPA pero se genera aquí; un cambio en la redacción de CPA no
se propaga automáticamente. Se espera que las páginas actúen en función del código de estado.
