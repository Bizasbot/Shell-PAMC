# ADR 0002: Estrategia de Enlace con CPA y Jerarquía de Identidad de Recursos

- **Estado**: Aceptado
- **Fecha**: 2026-09-04
- **Alcance**: Modelo de Descubrimiento, Entidades de Dominio, Atribución de Uso, Migraciones de Base de Datos

---

## 1. Contexto y Problema

Oh My CPA está construido sobre CLIProxyAPI (CPA) como la capa de gestión de usuarios y de identidad de negocio:
- CPA maneja la rotación subyacente de credenciales, el proxy saliente y la traducción de protocolos en el plano de ejecución;
- Oh My CPA descubre los recursos en tiempo de ejecución de CPA, asigna semánticas de negocio (Origen, Conexión, nombre, icono, categoría de uso) y agrega estadísticas de uso.

En las implementaciones heredadas, existían varios problemas críticos:
1. **Fragilidad de identidad y dependencia de índices de matriz**: Para las entradas de configuración que carecían de un `auth_index` estable (como ciertas claves de API de Codex o proveedores compatibles con OpenAI), el código anterior utilizaba índices de matriz, lo que provocaba que los nombres personalizados y las configuraciones se desplazaran cuando se reordenaban las configuraciones ascendentes.
2. **Los secretos de credenciales nunca deben servir como identificadores en texto plano**: Las claves de API en texto plano, los tokens OAuth o las URL de proxy con credenciales nunca deben ingresar a claves primarias, claves foráneas de bases de datos, registros regulares o respuestas estándar del navegador.
3. **Ambigüedad de los índices en tiempo de ejecución de CPA**: El mismo `auth_index` puede repetirse en diferentes Familias de Recursos (Resource Families); la coincidencia directa entre familias conduce directamente a la dispersión (*fan-out*) y a eventos duplicados.
4. **Continuidad histórica de la atribución de uso**: Cuando las credenciales ascendentes rotan o las entradas se eliminan temporalmente (quedando como `Missing`), los eventos de uso histórico deben conservar permanentemente su semántica de atribución en lugar de corromperse o eliminarse en cascada.

---

## 2. Decisión

### 2.1 Límites del Modelo de Entidades

Basándose en `CONTEXT.md`, se establecen las relaciones en capas de las entidades de dominio:

```text
Source (business provider origin, e.g. DeepSeek, OpenAI, Command Code GOAT)
  └─ Connection (user-callable usable line, holding name, icon, color, status, and notes)
       ├─ Credential Metadata (credential descriptors, no plaintext secrets)
       ├─ Endpoint (network target URL, stripped of userinfo)
       └─ CPA Binding (physical binding mapping to a concrete CPA instance)
            ├─ Instance ID (owning CPA instance)
            ├─ Resource Family / Type (e.g. codex-api-key, auth-file, openai-compatibility)
            ├─ Auth Index (CPA runtime stable credential index, if any)
            └─ Binding Fingerprint (irreversible secure fingerprint)
```

### 2.2 Jerarquía de Identidad de Descubrimiento

Cuando el motor de descubrimiento escanea una instancia de CPA, resuelve las Claves de Recursos únicas y las Huellas Digitales de Enlace (*Binding Fingerprints*) estrictamente a través de una cadena de prioridad de cinco niveles, prohibiendo el uso de posiciones físicas en matrices:

1. **Nivel 1: ID ascendente inmutable verificado (Immutable Upstream ID)**:
   - Se prioriza cuando un proveedor ascendente proporciona un identificador único globalmente estable.
2. **Nivel 2: Índice de autenticación estable con ámbito de familia (Family-Scoped Auth Index)**:
   - Formato: `auth-index:<family>:<auth_index>`;
   - Aisla índices con nombres idénticos entre diferentes Familias de Recursos.
3. **Nivel 3: HMAC con clave salada de material de credencial normalizado (Versioned Keyed HMAC)**:
   - Se utiliza cuando falta el `auth_index` pero se dispone de una clave de API de cliente no vacía;
   - Calculado mediante la clave maestra del servidor `OMCPA_MASTER_KEY` como `hmac:v1:<family>:<sha256-hmac>`;
   - Nunca almacena texto plano, loことが evita ataques de tablas arcoíris (*rainbow-table*) offline.
4. **Nivel 4: Huella digital de metadatos no sensibles únicos (Non-Sensitive Metadata Fingerprint)**:
   - Derivado de `(family, base_url, prefix, provider_name)` normalizados;
   - Las URL se depuran de detalles de autenticación de `userinfo`, parámetros de consulta y fragmentos.
5. **Nivel 5: Reporte explícito de colisión de identidad (Explicit Identity Collision)**:
   - Si dos entradas en el mismo ciclo de escaneo tienen metadatos no sensibles y credenciales idénticas, el sistema marca `identity_collision=true`;
   - Bloquea sobrescrituras automáticas no confiables y alerta al operador para que intervenga.

### 2.3 Estrategia de Rotación de Claves y Re-enlace

- El HMAC con clave es un identificador pseudoanónimo. Cuando una clave física rota, su HMAC cambia;
- El sistema acepta que la rotación de claves altera el HMAC, confiando en un `auth_index` estable o en la Conexión de negocio asociada para mantener la identidad a nivel de usuario. Para los recursos que dependen únicamente del HMAC con clave, se admite el re-enlace explícito en lugar de forzar heurísticas frágiles.

### 2.4 Uso Histórico y Continuidad del Ciclo de Vida

- La ingesta vincula los eventos de uso al registro único actual de `cpa_bindings`;
- Si la eliminación de una configuración ascendente hace que un recurso pase a estar `missing`, `cpa_bindings` registra `missing_at_ms` y las claves foráneas utilizan `ON DELETE SET NULL`;
- Los eventos de uso histórico preservan sus instantáneas en el punto en el tiempo; modificar, deshabilitar o eliminar un recurso actual nunca altera los hechos históricos de las solicitudes.

---

## 3. Consecuencias

- **Positivas**:
  - Reordenar o anteponer configuraciones ascendentes ya no desalinea los nombres personalizados o los iconos de Oh My CPA;
  - Los secretos en texto plano se mantienen completamente fuera de los índices, claves primarias y relaciones;
  - Los valores duplicados de `auth_index` en diferentes familias ya no causan colisiones de eventos ni confusión en la paginación;
  - Los límites de las entidades están definidos limpiamente, alineándose con la arquitectura de monolito modular.
- **Compromisos (*Trade-offs*)**:
  - Las entradas no identificadas que carecen de un `auth_index` y una clave de API requieren la intervención del operador;
  - Introduce `cpa_bindings` para sincronizar las proyecciones del estado de descubrimiento con el almacenamiento persistente.
