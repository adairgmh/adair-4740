import { simulatedRaces, summarizeRaces } from '../data/races';

const summary = summarizeRaces(simulatedRaces);
const barMaximum = Math.max(1, ...summary.victories.map((snail) => snail.wins));

export default function RaceCharts() {
  return (
    <section className="race-section" aria-labelledby="race-section-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">UNA JORNADA EN LA PISTA</p>
          <h2 id="race-section-title">El día en números</h2>
        </div>
        <span className="demo-badge">Datos simulados</span>
      </div>
      <p className="chart-description">6 caracoles · 6 carreras · Una apuesta de ejemplo por carrera.</p>

      <div className="charts-grid">
        <figure className="chart-card">
          <figcaption>
            <h3>Apuestas ganadas y perdidas</h3>
            <p className="chart-description">Resultados de las {summary.total} apuestas de ejemplo.</p>
          </figcaption>
          <svg className="donut-chart" viewBox="0 0 220 220" role="img"
            aria-label={`${summary.won} apuestas ganadas y ${summary.lost} perdidas, de ${summary.total} apuestas.`}>
            <circle cx="110" cy="110" r="82" fill="none" stroke={summary.total ? '#ad5132' : '#dce2d6'} strokeWidth="26" />
            <circle cx="110" cy="110" r="82" fill="none" stroke="#365b3a" strokeWidth="26"
              pathLength="100" strokeDasharray={`${summary.winPercentage} ${100 - summary.winPercentage}`}
              transform="rotate(-90 110 110)" />
            <text x="110" y="107" textAnchor="middle" className="donut-value">{summary.total}</text>
            <text x="110" y="133" textAnchor="middle" className="donut-label">apuestas</text>
          </svg>
          <ul className="chart-legend">
            <li><span className="legend-dot won-dot" aria-hidden="true" />Ganadas <strong>{summary.won}</strong></li>
            <li><span className="legend-dot lost-dot" aria-hidden="true" />Perdidas <strong>{summary.lost}</strong></li>
          </ul>
        </figure>

        <figure className="chart-card">
          <figcaption>
            <h3>Victorias por caracol</h3>
            <p className="chart-description">Un ganador por carrera; {summary.total} victorias en total.</p>
          </figcaption>
          <ul className="bar-chart" aria-label="Número de victorias de cada caracol">
            {summary.victories.map((snail) => (
              <li key={snail.id} className="bar-row">
                <span className="bar-name">{snail.name}</span>
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-fill" style={{ width: `${(snail.wins / barMaximum) * 100}%` }} />
                </span>
                <span className="bar-value">{snail.wins}<span className="sr-only"> victorias</span></span>
              </li>
            ))}
          </ul>
          <p className="bar-scale">Escala: 0 a {barMaximum} victorias</p>
        </figure>
      </div>

      <details className="race-details">
        <summary>Ver resultados de las seis carreras</summary>
        <div className="table-scroll" role="region" aria-label="Resultados por carrera" tabIndex={0}>
          <table>
            <caption>Jornada simulada: detalle de cada apuesta</caption>
            <thead><tr><th scope="col">Carrera</th><th scope="col">Ganador</th><th scope="col">Selección de ejemplo</th><th scope="col">Resultado</th></tr></thead>
            <tbody>
              {simulatedRaces.map((race) => (
                <tr key={race.id}>
                  <th scope="row">{race.id}</th>
                  <td>{summary.victories.find((snail) => snail.id === race.winnerId)?.name}</td>
                  <td>{summary.victories.find((snail) => snail.id === race.selectedSnailId)?.name}</td>
                  <td>{race.winnerId === race.selectedSnailId ? 'Ganada' : 'Perdida'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="simulation-note">Estos resultados son de ejemplo y no modifican tu saldo.</p>
    </section>
  );
}
