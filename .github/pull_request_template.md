<!--
Título: tipo(alcance): asunto en minúsculas — ej. feat(usage): keep dashboard statistics permanently
Omita el número de PR; la fusión por squash lo añade automáticamente.
-->

## Resumen

<!-- El problema y qué hace este cambio al respecto. Describa el estado adoptado, agrupado por comportamiento en lugar de por archivo. Vincule issues con "Closes #123". -->

## Documentación

<!-- Indique los documentos que este cambio desactualizó y que fueron actualizados (AGENTS.md §7), o indique que ninguno lo requirió. -->

## Validación

<!-- Marque lo que se ejecutó y añada el resultado. Elimine las filas que el cambio no puede alcanzar. -->

- [ ] `pnpm verify`
- [ ] `pnpm check:ui`
- [ ] `pnpm verify:full` — cambios en compilación, distribución embebida, entorno de navegador o flujos de trabajo
- [ ] `pnpm demo:generate` — datos de consola, estructura de respuesta de una ruta o lectura de consola modificada, con el diff del dataset confirmado
- [ ] `pnpm readme:screenshots` — una página ilustrada modificó su apariencia

## Lista de verificación

- [ ] Ninguna clave API, token, archivo de autenticación o datos de producción en el diff, la descripción o las capturas de pantalla.
- [ ] Los nuevos textos visibles para el usuario están en `web/src/i18n/index.tsx` y en cada catálogo bajo `web/src/i18n/locales/`.
- [ ] Cambios de esquema llegan como una nueva migración; una decisión trascendente y difícil de revertir llega como un ADR (AGENTS.md §4).
- [ ] Nuevas respuestas de API pasan por las listas de permitidos de DTO de `internal/api`.
