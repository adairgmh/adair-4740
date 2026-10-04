# Integración de recargas

## Ejecutar localmente

1. Desde `backend`, ejecutar `npm run dev`.
2. Desde `frontend`, ejecutar `npm run dev`.
3. Abrir `http://localhost:5173`, registrar una cuenta o iniciar sesión.
4. Pulsar **Cargar saldo con SnailPay** para abrir el formulario en una ventana modal.

Vite reenvía las solicitudes `/api` a `http://127.0.0.1:3000` mediante su proxy.
El puerto 5173 es fijo para conservar el origen de LocalStorage entre ejecuciones.
El proxy solo se aplica al desarrollo; un despliegue necesita servir `/api` desde
el mismo origen o configurar su dirección y permisos de acceso explícitamente.

## Casos manuales

Con saldo inicial de $0 y monto de $100:

| Escenario del formulario | Resultado esperado | Saldo final |
| --- | --- | --- |
| Recarga aprobada | Mensaje de aprobación | $100 |
| Tarjeta rechazada | Mensaje de rechazo | $100 |
| Error del sistema | Mensaje de indisponibilidad | $100 |
| Tiempo de espera agotado | Error tras 5 segundos | $100 |

Recargar la página y cerrar/abrir sesión debe conservar el saldo.
La tarjeta, fecha y CVV se rellenan con los valores ficticios documentados.
El usuario proporciona titular y monto; identificador y correo salen de la sesión.
El modal se cierra con **Cerrar** o con Escape y devuelve el foco al botón que lo abrió.
El contenido del dashboard queda inactivo mientras la ventana está abierta. Durante
una recarga se deshabilitan el envío y el cierre del modal hasta recibir el resultado
o alcanzar el tiempo de espera. El resultado permanece visible para poder revisarlo.

## Guardado

`caracoles.user.v1` conserva cuenta, saldo e historial `payments`. Cada operación
incluye `source` y `response`, incluidos número de tarjeta y CVV ficticios.
Las respuestas recibidas usan `source: "snailpay"`; los fallos locales de conexión,
formato o timeout usan `source: "client"` y no se presentan como respuestas del servidor.

Saldo e historial se guardan juntos en una sola escritura. Solo una respuesta HTTP
201 con estado `approved`, autorización, monto, pagador y datos ficticios coincidentes
puede aumentar el saldo. Los identificadores repetidos no se aplican nuevamente.
Los importes se suman en centavos y se comprueba su rango seguro.

Chrome utiliza Web Locks para coordinar actualizaciones del saldo entre pestañas.
Sin Web Locks, la escritura se realiza de forma síncrona en la pestaña actual;
no se garantiza coordinación entre varias pestañas en esos navegadores.

La espera se cancela a los 5 segundos. El backend simula demoras de 8 segundos y
nunca devuelve una aprobación para ese escenario. Desmontar el formulario o perder
la sesión impide aplicar una respuesta pendiente. Un fallo de LocalStorage no cambia
el saldo ni genera un mensaje de aprobación en la interfaz.

La API es un mock sin cargos reales ni persistencia de operaciones. LocalStorage
puede ser modificado por quien usa el navegador; este esquema es una simulación local
y no constituye autenticación ni contabilidad de producción.

## Pruebas

Desde `frontend`: `npm test`, `npm run lint` y `npm run build`.
Las pruebas usan almacenamiento aislado y respuestas simuladas, sin modificar la cuenta
de Chrome. Desde `backend`: `npm test` comprueba también las rutas HTTP.

Desde `frontend`, `npm run test:integration` compila el backend e inicia un servidor
local temporal para probar los cuatro escenarios usando el cliente real de recargas.
Su almacenamiento también es aislado. El servidor temporal se cierra al terminar.
