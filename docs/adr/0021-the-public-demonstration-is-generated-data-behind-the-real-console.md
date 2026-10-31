# ADR 0021: La demostración pública son datos generados detrás de la consola real

- Estado: Aceptado
- Fecha: 2026-09-22
- Reemplaza: el aspecto de alojamiento y ejecución de [ADR 0016](0016-the-demo-is-the-real-console-behind-a-total-route-refusal.md)

## Contexto

El ADR 0016 determinó que la demostración pública sería el binario ordinario con su pasarela
reemplazada por un *fixture* en el mismo proceso, y que su límite sería una clasificación
total de rutas. Rechazó una interfaz simulada (*mocked frontend*), un adaptador en la capa
de manejadores (*handlers*) y un proceso de *fixture* separado, bajo el argumento de que
cada uno permitiría que la demostración divergiera de la consola que ejecutan los operadores.

Ese diseño asumía un host capaz de ejecutar el binario. El host al que se desplegó —un
contenedor en una plataforma cuyo nivel Hobby limita un repositorio a 50 imágenes y no
proporciona recolección propia— alcanzó ese límite, y cada despliegue posterior compilaba
durante tres minutos para luego fallar en su último paso:

```
denied: repository has reached the maximum allowed number of images
```

El límite no es un error (*bug*) que deba sortearse. Es una propiedad de la plataforma, y
ninguna configuración de compilación lo soluciona: las imágenes se acumularon porque cada
despliegue empuja una y nada la recicla. La demostración había superado el alojamiento
que su diseño asumía.

Había que decidir dos cosas: si pagar por un alojamiento que ejecute un contenedor, o si la
demostración necesitaba un contenedor en absoluto.

## Decisión

### 1. La demostración sirve la consola real a partir de datos generados

La consola es el mismo paquete que el binario de Go embebe. Su API es atendida por un
Cloudflare Worker a partir de un conjunto de datos generado a partir de los manejadores
reales de Go, mediante las mismas proyecciones DTO que produce una instalación autoalojada.
Nada en la interfaz de usuario cambia.

El conjunto de datos es producido por `internal/api/demo_export_test.go`, el cual inicia el
manejador real sobre un repositorio con datos iniciales (*seeded*) y el *fixture* de la
demostración, procesa cada lectura que hace la consola y escribe lo que se devuelve. No está
escrito a mano ni es una grabación tomada desde un navegador: generarlo a través de los
manejadores es lo que mantiene cada respuesta con la estructura que el producto emite en
realidad.

### 2. La cobertura es una barrera de control (*gate*), no una instrucción

Un conjunto de datos que describe la API no se puede mantener actualizado por pura
intención, porque el fallo es invisible: la página se renderiza mostrando lo que la API
dijo el mes pasado. `scripts/check-demo.ts` falla cuando una ruta de la consola no tiene
lecturas declaradas, cuando una lectura no tiene una respuesta capturada, cuando un archivo
del cual se deriva el conjunto de datos ha cambiado, o cuando el conjunto de datos contiene
un valor que no debe ser público.

### 3. El historial capturado se rebasea al servirse

La consola solicita una ventana por su nombre: `preset=24h`. Una captura congelada describe
una ventana que terminó cuando se generó, por lo que el gráfico más nuevo se vería plano
durante un día. Cada respuesta se desplaza hacia el reloj del visor mediante un único
delta, lo que mantiene los límites de una ventana, sus cubos (*buckets*) y las filas en su
interior describiendo un solo intervalo.

### 4. El modo de demostración de Go se mantiene

`internal/demo`, `internal/api/demo_policy.go` y el propio modo de demostración del binario
permanecen. Son lo que genera el conjunto de datos, son la forma en que se prueban las rutas
autoalojadas sin pasarela, y son el oráculo contra el que se compara la barrera de control
de desviaciones (*drift gate*). Solo cambió el alojamiento público.

## Lo que esto cuesta

**La demostración ya no es una ejecución del producto.** Esta es la pérdida que el ADR 0016
fue escrito para evitar, y es real: un visitante ve la consola, no el servidor. No se
ejecuta ninguna base de datos, no se aplica ninguna migración, no se inicia ninguna
tubería de captura (*pipeline*), y los paneles de versión y lanzamiento muestran contenido
generado en lugar de una observación real del servicio en ejecución. La demostración
muestra el aspecto de la consola; no demuestra el comportamiento del producto.

**Se duplica el cálculo de lecturas.** El Worker responde a las ventanas, agrupaciones y
filtros que los manejadores de Go calculan desde SQLite. Los cuerpos de respuesta generados
no pueden evitar que esa lógica se desvíe; solo la barrera de control de cobertura, la
exportación diferencial y la comprobación del navegador pueden hacerlo, y reducen el riesgo
en lugar de eliminarlo. Esta es la alternativa que el ADR 0016 rechazó, y que ahora se
acepta a sabiendas.

**La demostración es de solo lectura.** El ADR 0016 permitía que las escrituras de un
visita aterrizaran en el estado en memoria del *fixture*, por lo que un control que no
pudiera funcionar aún parecía hacerlo. El Worker no tiene dónde colocar una escritura, por
lo que las rechaza, y la consola muestra su aviso de rechazo existente. La alternativa
—simular escrituras en un aislamiento (*isolate*) de Worker— sería un estado mutable
compartido cuyo efecto ningún visitante podría ver, lo cual es peor que un rechazo honesto.

**El conjunto de datos es público.** Es descargable por cualquiera que abra la
demostración, por lo que no debe contener nada que un operador no publicaría. Esto se hace
cumplir mediante la barrera de control en lugar de mediante revisión, y es la razón por la
que los alias de las claves de los llamadores (*caller-key*) nombran roles en lugar de una
persona.

**La plataforma de alojamiento inyecta un script de terceros en la página.** Cloudflare
añade su baliza de Medición de Usuarios Reales (*Real User Measurement*) al HTML en este
plan, desde `static.cloudflareinsights.com`, y no aparece en ningún repositorio, ningún
resultado de compilación ni ninguna revisión de código. Se midió en la página desplegada
en lugar de inferirse: el origen devuelve HTML sin ella, y el navegador la solicita de
toda forma.

Vale la pena registrar esto porque cambia lo que puede significar "la demostración no
contacta con nadie". La afirmación que este proyecto realmente necesita, y que aún
mantiene, es sobre su propio código: el *fixture* resuelve un extremo (*endpoint*) de
proveedor contra su propio catálogo y rechaza el resto, y el Worker responde desde el
conjunto de datos y no reenvía nada, por lo que nunca se contacta a ningún proveedor en
ninguno de los dos despliegues. La baliza es una solicitud que el navegador de un visitante
hace al propio extremo de análisis del host, sin llevar credenciales ni datos de
solicitud. Se aceptó conscientemente en lugar de pasarse por alto: es posible suprimirla,
y se intentó; `Cache-Control: no-transform` en los documentos sí detiene la inyección, y
se eliminó una vez que se juzgó que la baliza era aceptable, porque mantener una
supresión que el proyecto no desea equivaldría a sostener una afirmación que el repositorio
no pretende hacer.

## Alternativas rechazadas

**Pagar por un alojamiento que ejecute el contenedor.** Preservaría la propiedad que el
ADR 0016 deseaba, a costa de una suscripción para una página cuyo propósito es mostrar una
consola. El propietario eligió el propósito de la demostración por encima de su modelo de
ejecución.

**Integrar la interfaz con *fixtures* estáticos dentro del paquete.** Eliminaría el Worker
por completo y, con él, la capacidad de responder a una ventana que el visitante elija; el
selector de intervalos de la consola tendría que desaparecer o convertirse en una mentira.

**Reducir la demostración a una página de presentación (*landing page*).** Eliminaría el
riesgo de divergencia por completo al eliminar aquello que vale la pena demostrar.

## Consecuencias

- La demostración se despliega desde `master` a través de la integración de Git de
  Cloudflare, la cual gestiona su propio token de compilación, por lo que no se requiere
  ningún secreto en el repositorio, eliminando una de las molestias que hacían poco
  atractiva la plataforma anterior.
- Cada cambio en los datos de una página de la consola conlleva ahora una obligación:
  regenerar el conjunto de datos, leer las diferencias (*diff*), y hacer commit. La
  barrera de control falla hasta que eso sucede, lo cual es el objetivo.
- `pnpm verify:demo` procesa cada ruta en un navegador real contra una demostración en
  ejecución. Detectó tres defectos que las pruebas unitarias no encontraron, incluido un
  catálogo de modelos reescrito a fechas por un analizador de fechas permisivo.
- Los paneles de versión y lanzamiento en la demostración pública son contenido de muestra
  y están etiquetados como tales. La página autoalojada sigue observando versiones reales,
  porque `internal/release` y sus pruebas no han sido tocadas.
