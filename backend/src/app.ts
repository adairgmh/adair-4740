import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { setTimeout as delay } from 'node:timers/promises';
import { paymentFailure, processPayment } from './services/snailpay.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SnailPay',
  });
});

app.post('/api/payments', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!req.is('application/json')) {
    const result = paymentFailure(undefined, 415, 'json_required', 'Envía los datos como application/json.');
    res.status(result.httpStatus).json(result.body);
    return;
  }
  const result = processPayment(req.body);
  if (result.delayMs > 0) {
    const controller = new AbortController();
    const cancelDelay = () => controller.abort();
    res.once('close', cancelDelay);
    try {
      await delay(result.delayMs, undefined, { signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) return;
      throw error;
    } finally {
      res.off('close', cancelDelay);
    }
  }
  if (!res.destroyed) res.status(result.httpStatus).json(result.body);
});

const handleError: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const type: unknown = error?.type;
  const result = type === 'entity.parse.failed'
    ? paymentFailure(undefined, 400, 'invalid_json', 'El cuerpo de la solicitud no contiene JSON válido.')
    : type === 'entity.too.large'
      ? paymentFailure(undefined, 413, 'request_too_large', 'La solicitud supera el tamaño permitido.')
      : paymentFailure(req.body, 500, 'internal_error', 'No se pudo procesar la recarga. Inténtalo de nuevo.');
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.httpStatus).json(result.body);
};

app.use(handleError);

export default app;
