# ADR 0016: La demo pública es el binario ordinario con su pasarela reemplazada, y su límite es una clasificación de rutas

- Estado: Aceptado; reemplazado en parte por el [ADR 0021](0021-the-public-demonstration-is-generated-data-behind-the-real-console.md)
- Fecha: 2026-09-20

> **Lo que sigue vigente.** El modo demo descrito aquí está activo: `internal/demo` y la
> clasificación de rutas son lo que genera el conjunto de datos de la demostración pública, y
> son la forma en que se prueban las rutas autoalojadas sin una pasarela.
>
> **Lo que cambió.** El alojamiento público y el modelo de ejecución. El ADR 0021 movió la
> demostración a un Cloudflare Worker que sirve datos generados, por lo que la página pública
> ya no ejecuta este binario ni simula escrituras de visitantes. La decisión anterior
> permanece sin cambios en cuanto a la descripción del componente; `docs/ops/cloudflare-demo.md` es la
> guía operativa actual.

## Contexto

Oh My CPA necesita una demostración que pueda enlazarse desde el README: accesible para
cualquiera, que muestre la consola real en lugar de capturas de pantalla, que no requiera ninguna clave de
gestión de CPA, ninguna clave de proveedor ni ninguna credencial OAuth, y que se despliegue por sí misma desde
`master`. La presión que esto genera apunta hacia un segundo artefacto - un frontend simulado,
una rama de demo, un servicio de fixtures separado -, y el costo de eso es una consola que
se desvía de la que ejecutan los operadores, en silencio, hasta que alguien lo nota.

Hubo que tomar tres decisiones.

**De dónde provienen los datos de la pasarela.** La consola lee CPA a través de
`internal/cpa/management` en unos veinte manejadores (handlers), cada uno con su propia lista blanca de DTOs.
Opciones: un adaptador que implemente una interfaz de cliente de gestión; un servicio HTTP
de fixtures como un segundo proceso; o un servicio HTTP de fixtures dentro del mismo proceso.

**Cómo se cierra la superficie peligrosa.** La consola tiene rutas que inician un inicio de
sesión real, mueven material de credenciales, ejecutan complementos (plugins), escriben la configuración de la pasarela,
gastan una cuota y devuelven registros (logs) sin procesar de solicitudes y errores. Opciones: ocultar los
controles; rechazar en cada manejador; o rechazar en la tabla de rutas.

**Cómo entra cualquiera.** Opciones: una contraseña de demo publicada; una sesión generada para
quien abra la página; o ninguna sesión en absoluto en la API.

## Decisión

### 1. El modo demo es una configuración del proceso ordinario

`OMCPA_DEMO_MODE=true` es leído por `internal/config`, está desactivado por defecto, y cambia
solo lo estrictamente necesario: el directorio de datos, el nombre de archivo de la base de datos, la clave maestra cuando
no se proporciona ninguna, la ruta base por defecto, la dirección de escucha cuando la plataforma
anuncia una, y el origen público. `internal/app` inicia el fixture y apunta
la configuración existente hacia él. No se compila nada por fuera, y ninguna página, manejador o DTO tiene una variante de demo.

### 2. La pasarela se reemplaza en el socket, no en la interfaz

`internal/demo` sirve la API de gestión de CPA en `127.0.0.1` y la aplicación apunta
hacia ella a través de la ruta de configuración ordinaria, de modo que cada lectura existente - la
proyección de credenciales, las listas de proveedores, el documento de configuración, el catálogo de modelos,
las listas de complementos, la cola de registros - se ejecuta sin modificaciones.

El costo es un salto HTTP dentro del mismo proceso y un fixture que debe responder a los endpoints que
la consola realmente lee. La alternativa fue rechazada porque la interfaz abarca
unos cuarenta métodos: un adaptador habría tenido que reproducir cada forma de respuesta a partir
de estructuras de Go, y el punto de unión tendría que haberse enhebrado a través de cada manejador que construye
un cliente, que es donde una rama de demo comenzaría a filtrarse en el producto.

El fixture nunca marca la URL que se le entrega. Resuelve el endpoint del
proveedor solicitado contra su propio catálogo y rechaza cualquier otra cosa, de modo que "la demostración
no realiza ninguna solicitud saliente" es una propiedad del código. No publica ninguna URL de
logotipo de complemento, y el inyector de logotipos de complementos no está instalado en el modo demo, por la misma razón.
El bucle de sincronización de precios y la canalización de captura no se inician, porque ambos
alcanzarían el exterior del proceso.

### 3. El límite es una clasificación total de rutas, y se rechaza cualquier ruta no clasificada

`internal/api/demo_policy.go` contiene una tabla de `método + patrón de ruta chi +
veredicto`, la primera coincidencia gana, ordenada de lo específico a lo general. La suite
de pruebas recorre el enrutador que el servidor realmente sirve y falla si alguna ruta registrada no tiene
veredicto, por lo que agregar un endpoint obliga a tomar una decisión en lugar de heredar una. En tiempo de
ejecución, una ruta no clasificada es rechazada.

Los rechazos responden con un `403`, una cabecera (header) de marcador y un mensaje que nombra el motivo. Las lecturas se
marcan como pertenecientes a una demo, y una escritura lleva una cabecera que indica que su resultado no es
duradero.

Dos consecuencias son deliberadas:

- **El orden de la tabla es crucial.** El comodín final (wildcard) que sirve la SPA está
  al final. Mientras estuvo al principio, clasificaba cada `GET` de la aplicación como público,
  y tanto la descarga de credenciales como el registro de solicitudes estaban permitidos. La prueba que
  ejerce los rechazos sobre HTTP lo descubrió.
- **Ocultar un control nunca es el límite.** La consola aún deshabilita los botones,
  porque un control que no puede funcionar no debe ofrecer hacerlo, pero cada una de esas
  rutas es rechazada por el servidor, que es lo que la suite valida.

### 4. Se emite una sesión a cualquiera que lo solicite, incluso en una lectura ordinaria de la API

La demostración no tiene ningún secreto que proteger, por lo que la sesión no es un límite de credenciales
(la clasificación de rutas lo es). Existe para que la navegación ordinaria de la consola
funcione.

Se emite en cualquier solicitud no autenticada en lugar de solo en el endpoint de
inicio de sesión porque la plataforma ejecuta varias instancias de contenedores detrás de una dirección, cada una con
su propia clave de fixture: una cookie acuñada por una instancia no es válida en la siguiente, y la
consola emite sus primeras consultas en paralelo con la verificación de sesión. Rechazar esas
lecturas producía el fallo observado: una página funcional que recurría a una tarjeta de inicio de
sesión aproximadamente un segundo después de renderizarse. Emitir la sesión en su lugar hace que cada solicitud
tenga éxito y cada instancia sea autosuficiente.

## Consecuencias

**Aceptadas:**

- Los datos de la demo son fabricados y se advierte de ello en la documentación. No es una afirmación sobre el tráfico
  de ningún despliegue en particular.
- La demo informa sobre un estado de captura saludable que no tiene, porque el panel que
  lo lee es la propia cabecera de la lista de solicitudes; los números al lado se leen de la
  base de datos. Esta es una decisión de presentación, y se registra aquí en lugar de dejar
  que se descubra por cuenta propia.
- El almacenamiento de datos inicial (seeding) escribe unas catorce mil solicitudes y toma unos cuatro segundos en un
  arranque en frío. La base de datos se borra y se reconstruye en cada inicio, porque de lo contrario
  una plataforma que escala a cero regresaría con un historial que termina hace horas
  y ventanas cortas vacías.
- El fixture duplica las URL de cuotas de proveedores en lugar de importar
  las constantes de `internal/quota`, por lo que un cambio allí no puede alterar silenciosamente lo que
  la demo responde. Una prueba vincula ambas listas entre sí.

**Rechazadas:**

- **Un frontend simulado o una rama de demo.** Se desviaría de la consola que
  ejecutan los operadores, y la desviación sería invisible hasta que importara.
- **Una contraseña de demo publicada.** La contraseña sería pública de todos modos, y
  sugeriría que la credencial protege algo.
- **Rechazar en cada manejador.** Unos veinte manejadores llevarían cada uno una rama de demo,
  y un nuevo manejador no heredaría ninguna de ellas, lo opuesto a una clasificación
  total.
- **Interceptar la demo en el límite de la red** (una regla de cortafuegos, un proxy que
  rechaza el tráfico saliente). Haría que la propiedad fuera ambiental, por lo que podría ser falsa en
  un despliegue que olvidó la regla aunque pareciera idéntico en el repositorio.

**Costo para la ruta autoalojada:** ninguno más allá del conmutador de configuración. El modo demo no está configurado, el fixture nunca se inicia, el middleware de políticas no está instalado y
el nombre de archivo de la base de datos es el de siempre. La suite de pruebas de `internal/api`
afirma que un enrutador autoalojado responde a una ruta no clasificada con la API ordinaria en
lugar de un rechazo de demo.

## Referencias

- `docs/architecture.md` §12 — la forma de la demo, el seeding y la adaptación a la plataforma
- `docs/ops/vercel-demo.md` — la guía operativa de despliegue y los pasos de la consola
- `internal/api/demo_policy.go`, `internal/demo/` — la implementación
- ADR 0001 — la forma del proceso que la demo reutiliza en lugar de reemplazar
- ADR 0015 — la regla de credenciales que los rechazos de la demo extienden a un despliegue público
