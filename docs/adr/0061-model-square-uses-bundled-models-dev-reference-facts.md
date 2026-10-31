# ADR 0061: Model Square utiliza hechos de referencia empaquetados de models.dev

- Estado: Aceptado
- Fecha: 2026-10-05
- Relacionado: ADR 0030 (fuente de precios), que permanece sin cambios

## Contexto

Model Square reemplaza el rol de lista de modelos disponibles de la información central de CPAMC.
Los operadores necesitan un directorio simple de nombres invocables y especificaciones útiles al
seleccionar un modelo. CPA es la autoridad de disponibilidad pero no publica una base de datos completa
de especificaciones, licencias o referencias de pesos. Los registros de precios no son adecuados
para estos datos: un destino de enrutamiento exacto puede no tener precio, y el contexto del revendedor o
los costos no deben redefinir las capacidades canónicas del modelo.

La consola debe permanecer autodenominada y utilizable sin conexión. Una petición del navegador a un tercero
introduciría dependencias de disponibilidad, privacidad y seguridad de contenido simplemente
al abrir una página de gestión.

## Decisión

1. El endpoint en vivo `/v1/models` de CPA, autenticado con la primera clave de cliente no vacía configurada
   del lado del servidor, define qué nombres de modelos se listan. La configuración proporciona solo procedencia
   segura para los nombres anunciados. Ningún catálogo de modelos puede expandir este conjunto.
2. `internal/modelcatalog` incrusta una instantánea canónica de models.dev con alias de origen
   exactos y sin ambigüedades. `pnpm models:sync` la actualiza desde URLs fijas de models.dev
   durante el mantenimiento, no en tiempo de ejecución. Se excluyen los costos de los revendedores. El precio continúa
   utilizando su fuente existente de OpenRouter.
3. La evidencia es solo una identidad canónica exacta o un alias declarado por el origen. Un nombre que no tenga
   ninguno se reintenta en un conjunto cerrado de formas que denotan el mismo modelo (sin una
   etiqueta de enrutador, sin un sufijo de variante de solicitud enumerado, sin espacios de nombres de enrutamiento principales),
   cada una de las cuales debe coincidir exactamente, probando primero con el nombre literal. Las coincidencias ambiguas o
   ausentes permanecen como desconocidas; la similitud de versión/familia nunca completa las especificaciones.
   Un punto de llamada compartido puede exponer varios perfiles identificados independientemente.
4. El estado de pesos abiertos, la licencia y los enlaces a los pesos son hechos separados. Un modelo se denomina
   de código abierto solo cuando los pesos publicados conllevan una licencia de código abierto reconocida; un
   indicador de peso abierto o un enlace de descarga por sí solos no establecen dicha condición. Los límites de tokens de referencia
   no garantizan los límites que aplica una conexión en particular.
5. La página predeterminada agrupa los nombres de los modelos de los clientes verticalmente por fabricante y ofrece búsqueda.
   Un panel lateral (Drawer) compatible con la navegación muestra hechos y navegación explícita hacia models.dev, OpenRouter
   y pi.dev. Las referencias externas se abren solo por acción del usuario con protección `opener`/`referrer`;
   todos los recursos gráficos de iconos son locales.

## Consecuencias

Las implementaciones sin conexión reciben detalles útiles de los modelos sin un nuevo servicio, migración de base
de datos o bucle en segundo plano. La actualización de los metadatos sigue la instantánea de la versión y es
visible en la página. Los ID de modelos nuevos o personalizados pueden permanecer sin coincidencia hasta que la fuente
publique una identidad y el mantenimiento actualice la instantánea; los enlaces de búsqueda siguen funcionando.
Se conserva el aviso MIT de la fuente junto con el conjunto de datos incrustado. Los datos de demostración deben
regenerarse cuando dicho conjunto de datos cambie.
