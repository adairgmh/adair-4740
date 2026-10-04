# SnailPay: API de recargas simuladas

Servicio local sin conexión a bancos, sin cobros reales y sin base de datos.
El registro y la sesión son una simulación del navegador. La API valida el formato
de `payer_id` y `payer_email`, pero no autentica al usuario ni administra su saldo.

## Ejecutar

Desde `backend`: `npm install`, seguido de `npm run dev`.
La API escucha en `http://127.0.0.1:3000`. Para compilar: `npm run build`.
Para ejecutar el resultado compilado: `npm start`. Pruebas: `npm test`.

## Solicitud

`POST /api/payments`, con cabecera `Content-Type: application/json`.

```json
{
  "card_number": "1234123412341234",
  "expiration_date": "12/26",
  "cvv": "543",
  "cardholder_name": "Adair Ejemplo",
  "transaction_amount": 100,
  "payer_id": "usuario-demo",
  "payer_email": "adair@example.com",
  "simulation": "normal"
}
```

`simulation` es opcional y vale `normal` si se omite. El monto es un número en MXN,
mayor que cero, con hasta dos decimales y representable como entero seguro de
centavos en JavaScript. Nombre del titular: cualquier cadena no vacía después de
quitar espacios exteriores, sin un límite de longitud propio del campo.
Identificador: de 1 a 100 caracteres. Correo: hasta 254.
Tarjeta, fecha y CVV son cadenas. El cuerpo JSON admite hasta 16 KB.

## Escenarios reproducibles

Ejecutar los comandos en otra terminal, desde `backend`, con el servidor encendido.
Todos usan el mismo titular, monto y pagador del ejemplo anterior.

| Comando | Cambio en la solicitud | HTTP | status | status_detail |
| --- | --- | --- | --- | --- |
| `npm run demo -- approved` | Ninguno | 201 | approved | accredited |
| `npm run demo -- declined` | Tarjeta `1111222233334444` | 422 | rejected | card_declined |
| `npm run demo -- system_error` | `simulation: "system_error"` | 503 | error | service_unavailable |
| `npm run demo -- timeout` | `simulation: "timeout"` | 504 tras 8 segundos | error | simulated_timeout |

La simulación de error interno o demora se evalúa después de validar los campos
y antes de la decisión de aprobación/rechazo. Nunca genera una aprobación.
Para probar un timeout del cliente, usar un límite inferior a 8 segundos. El script
demo espera hasta 12 segundos para poder mostrar la respuesta 504 completa.

Otros errores HTTP 400: `invalid_payer`, `invalid_amount`, `invalid_cardholder`,
`test_card_required`, `invalid_card_data`, `invalid_simulation` e `invalid_json`.
Un tipo de contenido incorrecto devuelve 415 (`json_required`); un cuerpo demasiado
grande devuelve 413 (`request_too_large`). Errores inesperados devuelven 500
(`internal_error`) sin exponer detalles internos.

## Formato de respuesta

Todas las respuestas de pago incluyen:

| Campo | Formato |
| --- | --- |
| id | UUID único de la operación |
| status | approved, rejected o error |
| status_detail | Código estable del resultado |
| message | Explicación en español |
| transaction_amount | Monto solicitado; null si está ausente o no es un número finito |
| date_created | Fecha y hora ISO 8601 en UTC |
| authorization_code | SIM- seguido de UUID al aprobar; null en errores |
| reference | SNAIL- seguido del identificador de operación |
| payer_id | Identificador recibido o null si no tiene formato válido |
| payer_email | Correo recibido, o null si no es una cadena no vacía de hasta 254 caracteres |
| card_number | Tarjeta ficticia recibida; null para números no admitidos |
| cvv | CVV de tres dígitos recibido junto a una tarjeta ficticia; null en otro caso |

Solo se admiten los dos números ficticios documentados. No usar datos financieros
reales. La fecha `12/26` es una clave fija de prueba; su validez no depende del día
en que se ejecute la aplicación. No se aplica Luhn porque la tarjeta de aprobación
es un dato ficticio definido para esta simulación.

Los ejemplos de terminal no modifican LocalStorage. La integración del frontend
debe guardar la respuesta con sus datos ficticios y aplicar el monto una sola vez,
únicamente cuando `status` sea `approved` y la respuesta sea válida. Ante rechazo,
error o timeout, debe conservar el saldo. La API no conserva operaciones entre
solicitudes y no implementa idempotencia de cobros reales.
