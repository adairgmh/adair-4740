import test from 'node:test';
import assert from 'node:assert/strict';
import { simulatedRaces, snails, summarizeRaces } from '../src/data/races.ts';

test('la jornada tiene seis caracoles y seis carreras con participantes válidos', () => {
  const ids = new Set<string>(snails.map((snail) => snail.id));
  assert.equal(snails.length, 6);
  assert.equal(ids.size, 6);
  assert.equal(simulatedRaces.length, 6);
  assert.equal(new Set(simulatedRaces.map((race) => race.id)).size, 6);
  for (const race of simulatedRaces) {
    assert.ok(ids.has(race.winnerId));
    assert.ok(ids.has(race.selectedSnailId));
  }
});

test('las gráficas cuadran con los resultados de las seis carreras', () => {
  const summary = summarizeRaces(simulatedRaces);
  assert.equal(summary.won, 4);
  assert.equal(summary.lost, 2);
  assert.equal(summary.won + summary.lost, summary.total);
  assert.equal(summary.victories.reduce((total, snail) => total + snail.wins, 0), 6);
  assert.equal(summary.victories.find((snail) => snail.id === 'rayo')?.wins, 2);
  assert.equal(summary.victories.find((snail) => snail.id === 'nube')?.wins, 0);
});

test('recalcula el resumen cuando cambian ganadores y selecciones', () => {
  const summary = summarizeRaces([
    { id: 1, winnerId: 'nube', selectedSnailId: 'nube' },
    { id: 2, winnerId: 'nube', selectedSnailId: 'rayo' },
  ]);
  assert.equal(summary.won, 1);
  assert.equal(summary.lost, 1);
  assert.equal(summary.winPercentage, 50);
  assert.equal(summary.victories.find((snail) => snail.id === 'nube')?.wins, 2);
});

test('sin carreras mantiene los seis caracoles a cero y evita dividir entre cero', () => {
  const summary = summarizeRaces([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.won, 0);
  assert.equal(summary.lost, 0);
  assert.equal(summary.winPercentage, 0);
  assert.equal(summary.victories.length, 6);
  assert.ok(summary.victories.every((snail) => snail.wins === 0));
});
