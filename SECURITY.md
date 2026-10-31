# Política de seguridad

Shell-PAMC toma muy en serio la seguridad de las credenciales, las configuraciones del proxy y el acceso administrativo.

## Versiones compatibles

Solo el commit más reciente en la rama `master` y el tag de release más reciente reciben parches de seguridad.

| Versión / Rama | Compatible |
| --- | --- |
| `master` | Sí |
| Versiones anteriores | No (por favor actualice a la más reciente) |

## Informar sobre una vulnerabilidad

**Por favor, no informe vulnerabilidades de seguridad a través de issues, discusiones o pull requests públicos en GitHub.**

Si descubre una vulnerabilidad potencial en Shell-PAMC, infórmela a través de **GitHub Private Vulnerability Reporting**:

1. Navegue a la [pestaña Security](https://github.com/Bizasbot/Shell-PAMC/security) del repositorio.
2. Haga clic en **Report a vulnerability** bajo "Advisories".
3. Proporcione un informe detallado que incluya:
   - Tipo de problema (por ejemplo, SSRF, bypass de autenticación, divulgación de secretos, inyección SQL).
   - Instrucciones claras paso a paso o prueba de concepto (PoC) para reproducirlo.
   - Componentes, endpoints o versiones afectadas.
   - Impacto potencial de la explotación.

Si GitHub Private Vulnerability Reporting no está disponible, puede comunicarse directamente con los mantenedores por correo electrónico a `nversionesmybrd@gmail.com` con `[SECURITY]` en la línea de asunto.

## Proceso de respuesta

- **Confirmación**: Nos esforzamos por confirmar la recepción de su informe en un plazo de 48 horas.
- **Triaje y evaluación**: Verificaremos el problema y determinaremos su gravedad e impacto.
- **Corrección y parche**: Se desarrollará, revisará y probará una solución en una rama privada o borrador de aviso de seguridad.
- **Divulgación pública**: Una vez parcheado, se publicará una versión pública junto con notas de la versión del aviso de seguridad dando crédito al investigador (a menos que se solicite anonimato).

## Modelo de seguridad e invariantes de diseño

Al evaluar posibles vulnerabilidades, tenga en cuenta los siguientes límites de seguridad:

- **Credencial de sistema única**: La única credencial de inicio de sesión de administrador es la Clave de Administración de CPA (`SHELLPAMC_CPA_MANAGEMENT_KEY`). Ingresar la clave en el login deriva una cookie de sesión `HttpOnly` firmada por HMAC (`SameSite=Strict`).
- **Los agentes externos poseen la misma credencial**: La clave de administración también se acepta como token portador (bearer), únicamente en los endpoints de capacidades (`/api/v1/capabilities`) y el endpoint de MCP (`/api/mcp`), aplicando la limitación de tasa de inicio de sesión. Ese invocador puede leer y preparar operaciones pero nunca aprobar una, enviar un secreto o completar OAuth: la aprobación requiere una sesión de navegador y rechaza solicitudes que porten el encabezado `Authorization`.
- **Separación de secretos**: La clave de cifrado de almacenamiento (`SHELLPAMC_MASTER_KEY`) cifra credenciales y cargas útiles de uso sin procesar en reposo mediante AES-GCM. Perderla impide permanentemente el descifrado.
- **Proyecciones sanitizadas**: Las respuestas ordinarias de la API utilizan listas estrictas de permitidos de DTO y redactan secretos (mostrando solo huellas digitales o máscaras).
- **Superficies administrativas auditadas**: Las operaciones que acceden o modifican secretos intencionalmente (como ver el código fuente YAML sin procesar o revelar claves API de cliente) requieren sesiones de administración activas, validación de CSRF / mismo origen y se registran en el log de adición exclusiva `audit_events`.
- **El actualizador tiene el socket de Docker, la consola no**: Las actualizaciones de la consola (ADR 0099) son aplicadas por un contenedor independiente `shell-pamc-updater` que monta el socket de Docker y por lo tanto equivale al control de Docker en su host. No publica ningún puerto, autentica la consola con un HMAC de `SHELLPAMC_MASTER_KEY`, solo acepta un nombre de producto (`omc` o `cpa`), reemplaza Shell-PAMC únicamente con la imagen nombrada en un manifiesto de versión firmado por Ed25519 y rechaza imágenes fijadas. Informes que logren que descargue o ejecute una imagen elegida por el invocador, o que lo alcancen sin el token, están dentro del alcance; que un administrador del host pueda eliminarlo o suplantarlo no lo está.
- **Sin proxy arbitrario a upstream**: El reenvío general de `/api-call` está desactivado para el tráfico del navegador a fin de evitar SSRF.

## Anulaciones de seguridad de dependencias

Las anulaciones en todo el espacio de trabajo en `pnpm-workspace.yaml` mantienen las dependencias transitivas en
versiones parcheadas incluso cuando sus paquetes primarios todavía solicitan versiones vulnerables.
`pnpm-lock.yaml` registra el gráfico de dependencias resuelto; regenérelo con
`pnpm install` cada vez que cambie una anulación.

| Dependencia | Versión parcheada | Aviso | Ruta de dependencia |
| --- | --- | --- | --- |
| KaTeX | 0.18.2 | GHSA-238p-pmpm-9mq7 | Renderizado de Markdown y Mermaid mediante Ant Design X |
| sharp | 0.35.5 | GHSA-wq5f-xc86-pv6w | Herramientas de demostración de Wrangler / Miniflare |
| source-map-js | 1.2.2 | GHSA-68fv-2mgg-jv7q | Procesamiento de mapas de origen de Vite / PostCSS |

Estas anulaciones se aplican a cada consumidor en el espacio de trabajo. Elimine una solo después
de que todos los paquetes primarios resuelvan a una versión parcheada sin ella. Use
`pnpm why <paquete> --recursive` para inspeccionar consumidores y `pnpm audit` para inspeccionar
el gráfico resuelto. La anulación de KaTeX cruza la versión menor solicitada por sus
paquetes principales, por lo que verifique su renderizado matemático al modificarla.

## Páginas de plugins confiables

Instalar un plugin autoriza a su página del mismo origen a actuar como el operador con sesión iniciada.
El Plugin Host autenticado expone intencionalmente respuestas nativas de administración v0/v8,
incluyendo secretos de proveedor y cliente, pero nunca inyecta la clave de administración almacenada en
recursos de página o almacenamiento del navegador. Una credencial de administración explícita de la página se compara con la clave almacenada dentro de Shell-PAMC y
nunca se reenvía, por lo que una incorrecta no puede agotar la prohibición de intentos fallidos de CPA (ADR 0069);
las solicitudes al directorio de modelos reciben únicamente la autorización de cliente de la página. Todas las lecturas y
escrituras de la API son auditadas sin cargas útiles de solicitud, sufijos de ruta ni consultas, y no se almacenan en caché.
Las escrituras de configuración nativa comparten serialización y respaldos cifrados previos a la escritura. Ambos puentes
`api-call` salientes están denegados. Esta excepción no altera las proyecciones ordinarias de DTO,
las capacidades de Agente/MCP ni las restricciones de demo (ADR 0067).
