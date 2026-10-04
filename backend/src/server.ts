import app from './app.js';

const port = 3000;

app.listen(port, '127.0.0.1', (error) => {
  if (error) {
    console.error('No se pudo iniciar SnailPay:', error.message);
    process.exitCode = 1;
    return;
  }

  console.log(`SnailPay disponible en http://127.0.0.1:${port}`);
});
