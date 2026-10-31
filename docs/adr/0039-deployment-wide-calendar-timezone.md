# ADR 0039: Zona horaria de calendario a nivel de despliegue

- Estado: Aceptado
- Fecha: 2026-09-29
- Reemplaza a: La fuente de zona horaria controlada por el navegador en la ADR 0005; sus límites de calendario exactos y decisiones sobre la cuadrícula del DOM permanecen sin cambios.

## Contexto

Las marcas de tiempo locales del navegador, los días del mapa de calor (heatmap) proporcionados por el navegador y las marcas de tiempo de los registros del servidor podían describir calendarios diferentes para un mismo despliegue. Los operadores necesitan una zona horaria compartida mientras preservan la identidad de las solicitudes históricas y la interpretabilidad de la evidencia de los sistemas *upstream*.

## Decisión

Persistir una zona horaria IANA opcional en las preferencias de OMC. Su valor predeterminado es la zona horaria del despliegue, incluyendo `TZ` para los contenedores. Aplicarla a la presentación de marcas de tiempo en la consola, la agrupación por días naturales, la interpretación de los selectores y las marcas de tiempo de los registros del servicio OMC. Enviar la zona resuelta a las APIs de calendario; las solicitudes de API sin una zona explícita utilizarán la misma configuración del lado del servidor. Integrar datos IANA para la carga sin conexión de zonas con nombre.

Mantener sin cambios las marcas de tiempo tipo epoch almacenadas, las duraciones, las ventanas deslizantes y los instantes de protocolo. Preservar los registros (*logs*) de *upstream* sin procesar; interpretar las marcas de tiempo sin desfase (*offset*) de los registros de CPA utilizando la zona horaria compartida del despliegue. La pila de Compose completa proporcionada pasa el mismo `TZ` a ambos productos. Los niveles de precios conservan su contrato de hora del día definido explícitamente en UTC: una preferencia de presentación no debe alterar silenciosamente la facturación de las solicitudes.

## Consecuencias

Diferentes navegadores ven el mismo calendario. El horario de verano (DST) y los desfasajes fraccionarios requieren una conversión específica para cada instante, no un único desfase fijo. Las confirmaciones (*commits*) de preferencias exitosas publican una ubicación atómica para los gestores de registros en ejecución sin mutar el estado de tiempo global del proceso. Los despliegues nativos deben tener una zona horaria local identificable; los operadores de contenedores deben configurar un `TZ` IANA. Los componentes y capacidades de la interfaz de usuario comparten una única preferencia validada en lugar de adquirir valores predeterminados de zona horaria independientes.
