const scenario = process.argv[2] ?? 'approved';
const scenarios = ['approved', 'declined', 'system_error', 'timeout'];

if (!scenarios.includes(scenario)) {
  console.error(`Escenarios disponibles: ${scenarios.join(', ')}`);
  process.exitCode = 1;
} else {
  const body = {
    card_number: scenario === 'declined' ? '1111222233334444' : '1234123412341234',
    expiration_date: '12/26',
    cvv: '543',
    cardholder_name: 'Adair Ejemplo',
    transaction_amount: 100,
    payer_id: 'usuario-demo',
    payer_email: 'adair@example.com',
    simulation: ['system_error', 'timeout'].includes(scenario) ? scenario : 'normal',
  };

  console.log(`Escenario: ${scenario}. Solicitud de prueba por $100; no modifica el saldo del navegador.`);
  if (scenario === 'timeout') console.log('La respuesta tardará aproximadamente 8 segundos.');
  try {
    const response = await fetch('http://127.0.0.1:3000/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    console.log(`HTTP ${response.status}`);
    console.log(JSON.stringify(await response.json(), null, 2));
  } catch (error) {
    console.error('No se obtuvo respuesta. Comprueba que el backend esté ejecutándose con npm run dev.');
    console.error(error.message);
    process.exitCode = 1;
  }
}
