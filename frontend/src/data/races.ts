export const snails = [
  { id: 'rayo', name: 'Rayo' },
  { id: 'turbo', name: 'Turbo' },
  { id: 'luna', name: 'Luna' },
  { id: 'musgo', name: 'Musgo' },
  { id: 'canela', name: 'Canela' },
  { id: 'nube', name: 'Nube' },
] as const;

type SnailId = (typeof snails)[number]['id'];

export interface RaceResult {
  id: number;
  winnerId: SnailId;
  selectedSnailId: SnailId;
}

// Jornada ficticia: una apuesta de ejemplo por carrera, sin movimientos de saldo.
export const simulatedRaces: readonly RaceResult[] = [
  { id: 1, winnerId: 'rayo', selectedSnailId: 'rayo' },
  { id: 2, winnerId: 'turbo', selectedSnailId: 'turbo' },
  { id: 3, winnerId: 'luna', selectedSnailId: 'canela' },
  { id: 4, winnerId: 'rayo', selectedSnailId: 'rayo' },
  { id: 5, winnerId: 'musgo', selectedSnailId: 'musgo' },
  { id: 6, winnerId: 'canela', selectedSnailId: 'nube' },
];

export function summarizeRaces(races: readonly RaceResult[]) {
  const won = races.filter((race) => race.winnerId === race.selectedSnailId).length;
  const victories = snails.map((snail) => ({
    ...snail,
    wins: races.filter((race) => race.winnerId === snail.id).length,
  }));

  return {
    total: races.length,
    won,
    lost: races.length - won,
    winPercentage: races.length === 0 ? 0 : (won / races.length) * 100,
    victories,
  };
}
