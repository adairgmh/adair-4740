# A paso de caracol

Aplicación de demostración con registro e inicio de sesión local, estadísticas de
carreras de caracoles y recargas ficticias mediante una API llamada SnailPay.
No realiza apuestas ni cobros reales.

## Tecnologías

- Frontend: React, TypeScript y Vite.
- Backend: Express y TypeScript, con tsx durante el desarrollo.
- Persistencia: LocalStorage del navegador.
- Gráficas: SVG, HTML y CSS propios, sin librería adicional.
- Pruebas: ejecutor integrado de Node.js; ESLint para revisar el frontend.

Entorno utilizado: Node.js 22.14.0 y npm 11.2.0, con Chrome en macOS.
Las versiones exactas de las dependencias están registradas en los dos
`package-lock.json`. Usar Node.js 22.14.0 o una versión posterior compatible de la
misma rama 22. No se necesita base de datos, API key ni archivo `.env`.

## Instalar y ejecutar

Desde la raíz del repositorio, instalar las dependencias:

```bash
npm --prefix backend ci
npm --prefix frontend ci
```

En una terminal, iniciar el backend:

```bash
npm --prefix backend run dev
```

En otra terminal, iniciar el frontend:

```bash
npm --prefix frontend run dev
```

Abrir **http://localhost:5173** en Chrome. La API escucha en
**http://127.0.0.1:3000** y su comprobación de estado es `GET /api/health`.
Mantener ambas terminales abiertas. Para detener un proceso: `Control + C`.

El frontend usa un proxy de Vite para reenviar `/api` al backend. Si el puerto 5173
está ocupado, Vite se detiene para evitar cambiar de origen y aparentar la pérdida
de la cuenta. Revisar si ya existe otra terminal ejecutando el frontend.

## Uso

1. Registrar nombre, correo, contraseña de 12 a 128 caracteres y confirmación.
2. Entrar al dashboard con saldo inicial de $0. Las cuentas nuevas entran al registrarse.
3. Consultar las gráficas: 4 apuestas ganadas, 2 perdidas y 6 victorias entre 6 caracoles.
4. Desplegar la tabla para revisar los resultados de la jornada simulada.
5. Abrir el modal **Cargar saldo con SnailPay**, indicar titular y monto y seleccionar un escenario.
6. Recargar la página para comprobar la persistencia; cerrar sesión y volver a entrar.

Las estadísticas son ejemplos fijos, no operaciones del usuario, y no modifican el
saldo. Una recarga aprobada sí incrementa el saldo local por el monto solicitado.

## Escenarios de SnailPay

El formulario rellena exclusivamente datos ficticios. Fecha: `12/26`. CVV: `543`.
La fecha es una clave fija de simulación; no depende del calendario actual.

| Escenario | Datos que lo provocan | Resultado |
| --- | --- | --- |
| Aprobación | Tarjeta `1234123412341234`, titular no vacío y monto válido mayor que cero | HTTP 201, `approved`; aumenta el saldo |
| Rechazo | Tarjeta `1111222233334444`, resto de campos válidos | HTTP 422, `rejected`; conserva el saldo |
| Error del sistema | `simulation: "system_error"`, resto de campos válidos | HTTP 503, `error`; conserva el saldo |
| Demora | `simulation: "timeout"`, resto de campos válidos | El cliente cancela a los 5 segundos; conserva el saldo |

Para reproducirlos desde la raíz en una tercera terminal, con el backend encendido:

```bash
npm --prefix backend run demo -- approved
npm --prefix backend run demo -- declined
npm --prefix backend run demo -- system_error
npm --prefix backend run demo -- timeout
```

El script de consola usa un pagador ficticio y no modifica el saldo de Chrome. En el
último escenario espera 8 segundos para mostrar el HTTP 504 del servidor; el frontend
cancela antes, a los 5 segundos. La demora nunca termina en una aprobación.

Contrato completo, campos y errores: [backend/SNAILPAY.md](backend/SNAILPAY.md).
Guardado y comportamiento del cliente: [frontend/RECARGAS.md](frontend/RECARGAS.md).

## Pruebas y comprobaciones

Desde la raíz:

```bash
npm --prefix frontend test
npm --prefix backend test
npm --prefix frontend run test:integration
npm --prefix frontend run lint
npm --prefix frontend run build
```

- Frontend: 32 pruebas sobre registro, sesión, estadísticas y recargas.
- Backend: 13 pruebas sobre validaciones, contrato de respuestas y rutas HTTP.
- Integración: 1 prueba con el cliente de recargas y un servidor Express temporal.
- Compilación: verifica los tipos y genera los archivos del frontend. Las pruebas
  del backend y de integración también compilan el backend.

Las pruebas usan almacenamiento aislado y no cambian los datos guardados en Chrome.
Las pruebas HTTP necesitan permiso para abrir un puerto local temporal, que cierran
al terminar. Node.js 22.14 puede mostrar una advertencia sobre la ejecución experimental
de TypeScript; esa advertencia no significa que las pruebas hayan fallado.

## Estructura

```text
frontend/
  src/components/    Formularios, dashboard y gráficas
  src/services/      Registro, autenticación y recargas
  src/data/          Jornada simulada y cálculo de estadísticas
  src/types/         Tipos del contrato de pagos
  tests/            Pruebas de lógica del frontend
  integration/      Prueba con Express real y almacenamiento aislado
backend/
  src/app.ts        Rutas y manejo de errores
  src/server.ts     Inicio del servidor
  src/services/     Lógica del mock SnailPay
  scripts/          Ejemplos ejecutables de solicitudes
  tests/            Pruebas de servicio y HTTP
```

## Alcance y limitaciones

Se implementaron registro, entrada y salida de sesión, recuperación de sesión al
recargar, pantalla privada, gráficas, recargas simuladas y persistencia local.

La autenticación y el saldo son simulaciones: quien controla el navegador puede
modificar LocalStorage. Se admite una sola cuenta por origen del navegador. No hay
recuperación de contraseña ni sincronización entre dispositivos. Cambiar de dominio,
puerto, perfil de navegador o borrar sus datos cambia el almacenamiento disponible.

Las contraseñas se derivan con PBKDF2-SHA-256, salt aleatorio y 600 000 iteraciones.
Tarjeta y CVV se guardan solo como datos ficticios dentro del historial local de
operaciones. Este esquema no debe utilizarse para datos financieros reales.

No se implementaron base de datos, pagos reales, ejecución de carreras ni una sección
para realizar apuestas. La aplicación todavía no está desplegada. El proxy descrito
es de desarrollo; publicar requiere configurar el servicio de API y el frontend.

## Diseño y asistencia

Se usó la plantilla oficial `react-ts` de create-vite 6.5.0 como estructura inicial.
El diseño de la aplicación se construyó con CSS propio.
