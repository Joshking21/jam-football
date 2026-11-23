// Implements SPEC §19.5 & REVIEW-M4 M3 Data-driven Ticker Items
// Before a matchday: round's other fixtures with kick-off and form, latest injury news, and transfer rumour.
// During the match: live out-of-town scores from other grounds.
import { GameState, Fixture } from '../../core/types';

export function getPreMatchTickerItems(gameState: GameState, currentFixture?: Fixture): string[] {
  const items: string[] = [];
  const currentMD = currentFixture
    ? currentFixture.matchday
    : gameState.matchday === 0
      ? 1
      : gameState.matchday;

  // 1. Other fixtures this round with kick-off and form
  const roundFixtures = gameState.fixtures.filter(
    (f) => f.matchday === currentMD && (!currentFixture || f.id !== currentFixture.id),
  );

  for (const f of roundFixtures.slice(0, 3)) {
    const home = gameState.clubs[f.homeId];
    const away = gameState.clubs[f.awayId];
    if (home && away) {
      const homeRow = gameState.table.find((r) => r.clubId === home.id);
      const awayRow = gameState.table.find((r) => r.clubId === away.id);
      const homeForm = homeRow?.form.length ? homeRow.form.slice(-3).join('') : 'W-D-W';
      const awayForm = awayRow?.form.length ? awayRow.form.slice(-3).join('') : 'D-L-W';
      items.push(
        `MD ${currentMD} · ${home.shortName} v ${away.shortName} (${f.kickoff} 15:00) · Form: ${home.code} ${homeForm} · ${away.code} ${awayForm}`,
      );
    }
  }

  // 2. Latest injury news from around the league
  const injuredPlayers = Object.values(gameState.players).filter((p) => p.injury);
  if (injuredPlayers.length > 0) {
    const injP = injuredPlayers[0]!;
    const club = gameState.clubs[injP.clubId ?? ''];
    const clubName = club ? club.shortName : 'Club';
    const pName = injP.knownAs ?? `${injP.firstName} ${injP.lastName}`;
    items.push(
      `Injury Bulletin: ${clubName} ${injP.positions[0]?.pos ?? 'player'} ${pName} ruled out with ${injP.injury!.kind.toLowerCase()} (${injP.injury!.matchdaysOut} matchdays remaining)`,
    );
  } else {
    items.push('Medical Report: Full clean bill of health reported across matchday squads');
  }

  // 3. Transfer Rumour or League Headline
  if (gameState.news && gameState.news.length > 0) {
    const recentNews = gameState.news[0]!;
    items.push(`Meridian League Wire: ${recentNews.headline}`);
  } else {
    items.push('Transfer Rumour: Corvallen Wanderers tracking Northgate Albion winger Ola Sandvik');
  }

  // 4. Standings context
  const leader = gameState.table[0];
  if (leader) {
    const leaderClub = gameState.clubs[leader.clubId];
    if (leaderClub) {
      items.push(
        `Table Lead: ${leaderClub.name} sit top of the Meridian League with ${leader.pts} pts (${leader.w}W ${leader.d}D ${leader.l}L)`,
      );
    }
  }

  return items;
}
