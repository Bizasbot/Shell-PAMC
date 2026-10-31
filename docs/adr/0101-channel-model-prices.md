# ADR 0101: Los precios de modelos personalizados tienen un ámbito limitado al canal registrado

- Estado: Propuesto
- Fecha: 2026-10-16
- Modifica: La suposición de precio exclusivo global del ADR 0031

## Contexto

Model Square anuncia nombres de llamadas de clientes, incluidos prefijos de proveedores y alias.
El catálogo de precios y el bloqueo del costo de las solicitudes utilizan modelos upstream. Reenviar un nombre de llamada
con prefijo al editor de precios falla en la validación del catálogo. Mapear cada edición al
modelo compartido también impediría que dos canales cobren tarifas diferentes de entrada, salida,
caché y hora del día para ese mismo modelo. Un multiplicador a nivel de canal no puede
expresar tarifas o programaciones independientes por modelo.

## Decisión

Mantener el libro de precios compartido y agregar sobrescrituras personalizadas de `(canal, modelo upstream)`.
Canal significa la etiqueta de proveedor exacta registrada en los eventos de uso, coincidiendo con
el contrato existente de multiplicador de canal. No es un ID de fila de configuración ni un
prefijo de enrutamiento; las filas de configuración que comparten esa etiqueta comparten un ámbito de precios.

La migración 043 agrega la tabla de sobrescrituras actual y un discriminador de canal al
historial de precios existente de solo adición (append-only). Las filas históricas toman por defecto el ámbito compartido.
La ingesta selecciona la sobrescritura de canal efectiva en el momento de la solicitud, recurriendo
al ámbito compartido cuando no hay ninguna disponible. Una eliminación registra una lápida (tombstone) de canal.
El multiplicador de canal existente se aplica después de cualquiera de los precios, y las solicitudes registradas
continúan haciendo referencia a sus versiones originales e inmutables de precio y multiplicador.

Los endpoints existentes del editor de modelos aceptan un parámetro de consulta opcional de canal.
Las escrituras de canales requieren la pertenencia a un proveedor persistido y el modo personalizado. Los precios
automáticos compartidos, los enlaces de operadores y los precios personalizados continúan funcionando sin cambios.
Model Square resuelve rutas explícitas y ofrece cada objetivo distinto de canal/modelo.
El libro de precios muestra un precio efectivo por cada membresía de proveedor/modelo,
etiqueta las sobrescrituras de canal y los precios compartidos heredados, y mantiene la edición para ambos
ámbitos accesible desde esa fila.

## Consecuencias

- Los operadores pueden establecer tarifas independientes, precios de caché, contextos largos y niveles horarios
  sin introducir identidades de modelos sintéticas ni cambiar la configuración de CPA.
- La sincronización automática cambia las tarifas compartidas sin sobrescribir las sobrescrituras.
- Restaurar el precio compartido afecta a las solicitudes futuras; los eventos tardíos aún resuelven
  los precios en sus marcas de tiempo originales, y no se recalculan retroactivamente los costos registrados.
- Las sobrescrituras de canales son tarifas personalizadas; los enlaces automáticos independientes por canal
  y una identidad más precisa que la etiqueta de proveedor registrada de CPA quedan fuera de este cambio.
- Las capacidades existentes de precios de agentes continúan operando sobre los precios compartidos.
- Las sobrescrituras de canales se gestionan a través de la consola y la API REST autenticada.
