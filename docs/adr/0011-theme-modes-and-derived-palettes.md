# ADR 0011: Un modo de tema elige una paleta, y cada paleta se deriva de nueve tokens creados

- Estado: Aceptado
- Fecha: 2026-09-18
- Enmendado por: ADR 0103, que añade `canvas` como el decimoctavo token derivado.

## Contexto

La consola venía con seis paletas sintonizadas a mano —OMC Dark, OMC Light, Midnight, Porcelain, Forest y
Sandstone— y el control de tema de la cabecera era un menú que enumeraba las seis. Una paleta constaba de treinta valores
hexadecimales, y la sección §5 de `docs/design.md` argumentaba explícitamente que el control *tenía* que ser un menú: "un conmutador
solo responde a 'el otro', lo cual dejó de ser la respuesta completa una vez que la consola incluyó seis temas registrados".

Dos requerimientos llegaron juntos y ninguno de ellos puede satisfacerse en ese modelo:

1. **Claro y oscuro, con una paleta detrás de cada uno.** El control debe responder a la pregunta que un operador
   hace repetidamente —claro u oscuro— mientras que la paleta que usa cada uno de esos modos es una elección meditada,
   hecha una sola vez.
2. **Paletas creadas por el operador.** Esto es lo que rompe el diseño. Un formulario con treinta entradas de color
   no es un formulario; nadie crea una escala de texto, un paso de información sobre herramientas (tooltip) y una pista de gráfico a mano, y una
   paleta parcialmente creada es una consola ilegible que ningún código puede detectar, porque los tokens son
   literales.

Las paletas existentes no se pudieron reutilizar como una derivación, y esto se midió en lugar de asumirse.
Ajustar las seis a una familia de reglas falla en nueve de trece reglas:

| Relación afirmada | Resultado medido |
| --- | --- |
| `hover` = `borderSoft` | se cumple en 1 de 6 (el modo oscuro los tiene a un paso de distancia; todas las demás paletas difieren) |
| `hoverInset` = `bg` | se cumple en 3 de 6: las tres paletas oscuras, ninguna de las claras |
| `heatmapQuiet` = `borderSoft` | falla en OMC Light (`#ececf0` vs `#ededf2`) |
| `heatmapZeroRecorded` = `seriesTrack` | falla en OMC Light y Midnight |
| `seriesTrack` = `border` | falla en OMC Dark y Midnight, las cuales tienen ambos invertidos |
| `cacheRateGreen` = `success` | falla en OMC Light (`#047857` vs `#059669`) |
| `accentHover` = un paso de luminosidad fijo | ningún paso constante encaja: los pasos observados van de −0.065 a −0.147 |
| `selected` = una mezcla hacia el acento | ninguna fracción consistente: los pesos resueltos van de −0.26 a +0.24 |

Las seis son una *familia*, no una fórmula: se eligieron a ojo, y OMC Light y Midnight rompen cada una
las convenciones del modo oscuro en varios lugares. Por lo tanto, una derivación para paletas creadas por operadores no es algo que
se pueda extraer de las paletas existentes. Es algo que hay que diseñar, calibrar y establecer.

## Decisión

**Un tema es un modo, cada modo contiene una paleta, y cada paleta consta de nueve tokens creados con
diecisiete derivados.**

1. **El modo y la paleta son configuraciones separadas.** `ThemePreference.mode` es `light`, `dark` o
   `system`; `palettes[mode]` nombra la paleta que utiliza ese modo. Elegir una paleta para el modo que no está
   en vigor la *registra* y no mueve la consola; un clic cambia una configuración.

2. **Una paleta consta de nueve tokens creados, diecisiete derivados de estos y cuatro constantes de modo.** El conjunto creado es `bg`, `surface`,
   `elevated`, `fg`, `fg2`, `muted`, `meta`, `border`, `accent`. Todo lo demás —los rellenos de hover y
   selected, el paso de border-soft, la escala de acentos, el relleno de los tooltips, las paradas del mapa de calor, las paradas de la tasa de caché y la pista del gráfico— es derivado por `derivePalette` en `web/src/theme/palette.ts`.
   Los cuatro restantes son `success`, `warn`, `danger` y la serie de seis ranuras `series`, que provienen de
   `MODE_SEMANTICS[mode]`: son semánticas en lugar de paleta, por lo que una paleta hereda el conjunto de su modo
   en lugar de derivar uno (véase la alternativa rechazada a continuación). Esos son la totalidad de los treinta tokens de una paleta.
   Las seis paletas registradas también se crean a partir de nueve tokens y se derivan mediante la misma función: no
   quedan valores sintonizados a mano en ninguna parte, lo que hace que una paleta personalizada sea *el mismo tipo de
   elemento* que una integrada en lugar de una segunda ruta más débil.

3. **La derivación utiliza OKLCH, con cuatro constantes calibradas por modo.** Los neutros son mezclas perceptuales
   (`hover = mix(bg → fg, 0.116 dark / 0.045 light)`, `borderSoft = mix(bg → border, 0.583 / 0.541)`,
   `hoverInset = bg in dark, mix(bg → fg, 0.05) in light`, `selected = mix(hover → accent, 0.075 /
   0.038)`); la escala de acentos es un paso de luminosidad proporcional (`0.831 / 0.855` para hover,
   `0.699 / 0.737` para activo) seguido de una resolución. Dos convenciones sobrevivieron al ajuste exactamente y se
   mantienen: `tooltipBg = light ? fg : surface`, y `heatmapBusy = heatmapTipLink = accent`.

4. **La escala de acentos resuelve sus rellenos en conjunto en lugar de uno por uno.** Un paso fijo puede situar un relleno en la zona muerta donde
   ni el blanco ni el casi negro alcanzan una relación de contraste de 4.5:1 como etiqueta —medido, un paso de −0.075 sitúa la etiqueta de OMC Dark
   en 3.73:1 y la de Midnight en 3.38:1— y ninguna elección de etiqueta rescata a ese par. Por lo tanto, el paso es el
   punto de partida y ambos rellenos siguen moviéndose hasta que *una* tinta supera el objetivo (4.6:1, dejando margen para que
   el redondeo hexadecimal cumpla con el mínimo exigido de 4.5:1) en *ambos*. Se lee una única etiqueta en los tres
   estados, y resolver el relleno de hover por sí solo dejó la etiqueta casi negra de Midnight en 3.14:1 en el momento
   en que se presionó su botón; siete de los dieciocho acentos creados se rompieron de la misma manera. La dirección se elige una vez por paleta y
   se utiliza para los tres estados, y cambia a *aclarar* cuando el acento es demasiado oscuro para oscurecerse; de lo contrario, un
   acento de `#000000` resuelve tanto su estado de hover como el presionado al mismo negro, lo que resulta en un
   control relleno sin retroalimentación visual al pasar el cursor.

5. **El contraste se informa por rol y nunca bloquea.** `fg`, `fg2` y `accent` responden a 4.5:1;
   `muted` a 3:1; `meta` a 2:1; los pasos de surface y border son capas sin un mínimo de texto. Los tres
   mínimos son los pasos que las seis paletas utilizan realmente (`muted` mide 3.87-4.93:1, `meta` 2.28-2.87:1),
   por lo que una paleta correcta no muestra ninguna advertencia; un único umbral de 4.5:1 dejaría a cada una de las seis
   señaladas permanentemente, y un indicador que siempre está encendido es uno que nadie lee. `accentOn` se calcula
   siempre y nunca es editable. Un color elegido por el operador no se rechaza: el editor muestra la relación
   y la consola renderiza lo que se solicitó.

6. **Una paleta personalizada no tiene nombre.** Se etiqueta como `omc.palette_custom` —「自定义」/「Custom」/「自訂」/
   「Tersuai」— como cualquier otro control. La muestra de color junto a la etiqueta indica su apariencia, y un nombre
   sería una segunda etiqueta para una sola cosa y la única cadena en la consola que no se podría traducir.

7. **La paleta se almacena dos veces, y la copia del navegador gana en caso de conflicto.** `omc-theme` almacena todo el
   documento en `localStorage` para el primer fotograma y para la pantalla de inicio de sesión, donde no hay ninguna sesión
   de la cual leer una preferencia; el apartado `ui_preferences` del despliegue almacena el mismo documento bajo `omc_theme`
   para que la elección perdure más allá de una sesión de navegador. Cualquier cambio local establece un indicador `dirty` (`modificado`); al cargar,
   un navegador con cambios pendientes los envía y uno limpio los adopta.

8. **El control de la cabecera es un botón de tres estados y solo indica su propio estado.** Recorre claro → oscuro →
   seguir al sistema, con un icono por estado. El argumento de "menús sobre conmutadores" de la sección §5 de `docs/design.md` se
   invierte específicamente para este control, porque las paletas se trasladaron a la página de configuración y la
   pregunta restante de la cabecera tiene tres estados y una consecuencia. La información sobre herramientas (tooltip) es el nombre propio del control;
   deliberadamente no describe el siguiente estado. Lo que comunica los tres estados es el icono y
   la propia fila de la página de configuración, que nombra los tres en palabras.

## Desviaciones nombradas respecto a los valores sintonizados a mano

Aplicar la derivación a las seis paletas registradas modifica **59 de los 102** tokens derivados (17 por
paleta: OMC Dark 10, OMC Light 11, Midnight 8, Porcelain 8, Forest 11, Sandstone 11; contados frente al archivo
`themeConfig.ts` del commit anterior en lugar de recordados). La mayoría son imperceptibles (ΔL ≤ 0.03); estos
son los que un lector notaría, y se aceptan en lugar de corregirlos, porque corregirlos
reintroduciría valores creados a mano en un conjunto derivado.

| Paleta | Token | Era | Ahora | Efecto |
| --- | --- | --- | --- | --- |
| OMC Dark | `selected` | `#242428` | `#2e2e37` | el estado seleccionado tiene un tinte visible del acento en lugar de ser un simple hover, lo cual sigue el patrón de las cuatro paletas más nuevas |
| OMC Dark | `accentHover`, `accentActive` | `#0077b8`, `#005d8f` | `#0579bd`, `#025e94` | ambos pasos del control relleno se desplazan, de modo que una tinta supera el mínimo tanto en reposo como al ser presionados; el blanco mide 4.69:1 y 6.93:1 |
| Midnight | `accentHover`, `accentActive` | `#1f6feb`, `#1158c7` | `#2475ca`, `#0259a7` | ambos rellenos se profundizan para que una tinta supere el mínimo en ambos; la etiqueta se mantiene blanca |
| Midnight | `seriesTrack` | `#21262d` | `#30363d` | el fondo del gráfico es el paso de borde, que Midnight tenía intercambiado |
| Forest | `hover`, `rowHover` | `#213127` | `#232926` | un hover más tenue, porque la constante de la familia sigue al primer plano de la propia paleta |
| OMC Light | `borderSoft`, `hover`, `hoverInset` | `#ededf2`, `#ececf0`, `#ededf2` | `#f1f1f4`, `#f3f3f3`, `#f2f2f2` | los pasos neutros del valor por defecto claro siguen la misma regla que los de cualquier otra paleta |

## Alternativas consideradas

- **Mantener las seis paletas sintonizadas a mano y derivar únicamente para las paletas personalizadas.** El cambio más pequeño, y
  era la recomendación. Rechazado por el operador: deja dos tipos de paleta en el código, por lo que
  "cambiar la regla de hover" significa cambiar una fórmula *y* seis tablas, y la siguiente paleta añadida vuelve a estar
  sintonizada a mano.
- **Exponer los treinta tokens.** Rechazado: hace que el operador sea responsable de relaciones que el código
  puede mantener por él, y es la versión que puede producir una consola ilegible.
- **Exponer únicamente el acento.** Rechazado por ser insuficiente: no puede cambiar las superficies de la propia página ni la
  escala de texto, que es la mayor parte de lo que significa "quiero que esta consola se parezca a la nuestra".
- **Bloquear un guardado cuyo contraste esté por debajo del mínimo.** Rechazado: un operador puede querer legítimamente una
  paleta de bajo contraste, la aplicabilidad del mínimo depende del rol, y una página de configuración que se niega
  a guardar es peor que una que muestra el número.
- **Derivar los tonos de estado y las series categóricas a partir del acento.** Rechazado: haría que el verde
  signifique lo que sea que sea el acento, que es lo único que prohíbe la sección §1 de `docs/design.md`, y rompería
  las familias de series fijas del ADR 0006. Se mantienen como constantes por modo.
- **Almacenar el tema únicamente en `localStorage`.** Rechazado: el endpoint de preferencias existe precisamente para que una
  elección perdure más allá de un navegador, y cualquier otra configuración de la consola ya reside allí.
- **Hacer que la copia del despliegue gane siempre.** Rechazado: la pantalla de inicio de sesión no tiene sesión, por lo que un cambio
  realizado allí se desharía silenciosamente con el primer inicio de sesión; la acción más reciente del operador es la
  que debe prevalecer.

## Consecuencias

- El valor por defecto `:root` de la hoja de estilos es ahora un *espejo* de una derivación en lugar de una tabla independiente,
  y `scripts/test-theme-presets.ts` lo valida token por token, incluidas las dos propiedades personalizadas
  (`--elevated`, `--selected-inset`) que antes solo se establecían en tiempo de ejecución.
- Las secciones `docs/design.md` §2 y `DESIGN.md` muestran valores derivados. Se generan a partir de la misma fórmula y
  están fijados por la misma prueba, por lo que un cambio en las constantes hace que falle la suite en lugar de diferir silenciosamente de la
  documentación.
- **Limitación declarada: dos navegadores que contengan cambios no guardados se deciden por el que realice el envío último.**
  Ni `localStorage` ni `ui_preferences` transportan una versión para comparar, y añadir una implicaría un
  protocolo de resolución de conflictos para una configuración que no tiene datos respaldándola. El indicador `dirty` se borra solo una vez que la
  copia del despliegue coincide con la de este navegador, por lo que una escritura rechazada se reintenta en la siguiente carga en
  lugar de perderse.
- **Limitación declarada: una escritura rechazada deja la consola mostrando la paleta del operador mientras el
  despliegue mantiene la anterior.** Se informa del fallo y el indicador permanece activo, pero ambas partes
  quedan brevemente desincronizadas. Reconciliarlas silenciosamente significaría repintar la consola bajo las
  manos del operador con una paleta que no eligió.
- Una paleta personalizada no se puede compartir, exportar ni importar. Esto es una exclusión explícita en lugar de
  una omisión: una paleta compartida implica un formato de archivo, una versión y un origen, y nada de eso existe
  todavía.
