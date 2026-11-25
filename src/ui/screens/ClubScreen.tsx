// Implements SPEC §11.13 Club and §12.17 matching docs/design/club/
import React, { useState, useMemo } from 'react';
import { useStore } from '../../state/store';
import { formatMoney } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { StaffRole, StaffMember, ClubId } from '../../core/types';
import {
  getClubLeaders,
  calculateLeaderScore,
  generateStaffCandidates,
} from '../../core/club/clubDepth';
import { sortTable } from '../../core/season/table';
import { Portrait } from '../components/Portrait';
import { X, Star } from 'lucide-react';

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th');
}

export const ClubScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const hireStaffMember = useStore((state) => state.hireStaffMember);
  const requestBoardWageIncrease = useStore((state) => state.requestBoardWageIncrease);
  const showToast = useStore((state) => state.showToast);

  const [replacingRole, setReplacingRole] = useState<StaffRole | null>(null);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  // Compute table standings
  const sortedTable = sortTable(gameState.table, gameState.fixtures, gameState.clubs);
  const userRankIndex = sortedTable.findIndex((r) => r.clubId === gameState.userClubId);
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : 1;
  const userRow = sortedTable[userRankIndex];
  const leaderRow = sortedTable[0];
  const ptsOffTop = leaderRow && userRow ? Math.max(0, leaderRow.pts - userRow.pts) : 0;

  // Squad wages & Staff wages
  const squadPlayers = userClub.squad.map((id) => gameState.players[id]).filter((p) => p != null);
  const currentWeeklyWage = squadPlayers.reduce(
    (sum, p) => sum + (p.contract?.wagePerWeek ?? 0),
    0,
  );
  const staff = userClub.staff;
  const staffWages = staff
    ? staff.assistant.wage + staff.coach.wage + staff.scout.wage + staff.physio.wage
    : 45_000;

  // Operating costs & finances
  const operatingCosts =
    BALANCE.finances.operatingCostPerReputation * userClub.reputation;
  const sponsorWeekly = BALANCE.finances.sponsorIncomeWeekly[userClub.reputation] ?? 700_000;
  const tvWeekly = 600_000;

  // Next fixture / opponent info
  const nextFixture = gameState.fixtures.find(
    (f) =>
      f.matchday === gameState.matchday &&
      (f.homeId === gameState.userClubId || f.awayId === gameState.userClubId),
  );
  const isHome = nextFixture ? nextFixture.homeId === gameState.userClubId : true;
  const opponentId = nextFixture
    ? isHome
      ? nextFixture.awayId
      : nextFixture.homeId
    : null;
  const opponentClub = opponentId ? gameState.clubs[opponentId] : null;

  // Gate receipts
  const avgTicketPrice =
    BALANCE.finances.ticketPriceByReputation[userClub.reputation] ?? 38;
  const estAttendance = isHome
    ? Math.round(userClub.stadium.capacity * (0.68 + (userClub.fanMood / 100) * 0.28))
    : 0;
  const gateReceipts = isHome ? estAttendance * avgTicketPrice : 0;

  const weekIncome = gateReceipts + tvWeekly + sponsorWeekly;
  const weekExpense = currentWeeklyWage + staffWages + operatingCosts;
  const weekNet = weekIncome - weekExpense;
  const wageRoom = userClub.wageBudget - currentWeeklyWage;

  // Projected prize money
  const prizeMoneyTable = [24, 18, 14, 11, 8, 6, 4, 3, 2, 1];
  const projectedPrize = prizeMoneyTable[userRank - 1] ?? 1;

  // Stadium attendance data across home games played
  const homeFixtures = gameState.fixtures.filter(
    (f) => f.homeId === gameState.userClubId && f.result !== null,
  );
  const homeAttendances = homeFixtures.map((f) => f.result?.attendance ?? estAttendance);
  const defaultAttendances = [
    Math.round(userClub.stadium.capacity * 0.72),
    Math.round(userClub.stadium.capacity * 0.76),
    Math.round(userClub.stadium.capacity * 0.81),
    estAttendance || Math.round(userClub.stadium.capacity * 0.79),
  ];
  const attendancesToShow = homeAttendances.length > 0 ? homeAttendances : defaultAttendances;
  const biggestAtt = Math.max(...attendancesToShow);
  const occupancyPct = Math.round((biggestAtt / userClub.stadium.capacity) * 100);

  // Dressing room cohesion & leaders
  const dressingRoomLeaders = getClubLeaders(userClub, gameState.players).slice(0, 3);
  const currentCohesion = userClub.cohesion ?? BALANCE.club.cohesionInitial;
  const cohesionDelta = currentCohesion >= 55 ? 2 : currentCohesion < 45 ? -2 : 0;

  // Fan mood & quotes
  const fanMood = Math.round(userClub.fanMood);
  const fanDelta = fanMood >= 60 ? 3 : fanMood < 45 ? -2 : 1;
  const topScorer =
    squadPlayers.slice().sort((a, b) => b.stats.goals - a.stats.goals)[0] ?? squadPlayers[0];
  const unhappyPlayer = squadPlayers.find((p) => p.morale < 45);

  // Board letter copy
  const ownerName = 'Margaret Holloway';
  const boardConfidence = Math.round(userClub.boardConfidence);
  const confDelta = boardConfidence >= 65 ? 4 : boardConfidence < 40 ? -3 : 1;

  const handleBudgetClick = () => {
    const res = requestBoardWageIncrease();
    showToast(res.message, res.success ? 'success' : 'warning');
  };

  const handleStadiumClick = () => {
    showToast(
      'The board noted your interest in stadium expansion. Sustained top-four finish required.',
      'info',
    );
  };

  const isWindowActive = gameState.window !== null;

  return (
    <div
      style={{
        padding: '24px 26px',
        color: '#1B1A17',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      <style>{`
        .club-grid {
          display: grid;
          grid-template-columns: minmax(680px, 940px) minmax(360px, 1fr);
          gap: 28px;
          max-width: 1720px;
          margin: 0 auto;
        }
        @media (max-width: 1380px) {
          .club-grid {
            grid-template-columns: 1fr;
          }
        }
        .ledger-book {
          position: relative;
          min-height: 610px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #2a1a0e;
          padding: 14px;
          border-radius: 6px;
          box-shadow: 0 24px 50px rgba(0,0,0,0.6);
        }
        .ledger-pg {
          background: #f3eedf;
          color: #1B1A17;
          padding: 24px 26px;
          position: relative;
          background-image: repeating-linear-gradient(0deg, transparent 0 27px, rgba(31,79,191,0.13) 27px 28px);
        }
        .ledger-pg.left {
          box-shadow: inset -18px 0 22px -14px rgba(0,0,0,0.35);
        }
        .ledger-pg.right {
          box-shadow: inset 18px 0 22px -14px rgba(0,0,0,0.35);
        }
        .ledger-h3 {
          font: 900 26px/1 'Playfair Display', serif;
          margin: 0;
          color: #1B1A17;
        }
        .ledger-sub {
          font: 600 12px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #5E574E;
          margin-top: 6px;
        }
        .ledger-bal {
          font: 800 58px/1 'Barlow Condensed', sans-serif;
          margin-top: 18px;
          color: #1B1A17;
        }
        .ledger-bal small {
          font: 600 16px/1 'Barlow Condensed', sans-serif;
          color: #5E574E;
          letter-spacing: 0.08em;
          margin-left: 8px;
        }
        .ledger-li {
          display: grid;
          grid-template-columns: 1fr 120px;
          font: 400 14.5px/27px 'Source Serif 4', serif;
          border-bottom: 0;
        }
        .ledger-li b {
          font: 700 16px/27px 'Barlow Condensed', sans-serif;
          text-align: right;
        }
        .ledger-li.total {
          border-top: 2px solid #1B1A17;
          margin-top: 6px;
          padding-top: 2px;
          font-weight: 600;
        }
        .handwriting {
          font: italic 400 15px/1.4 'Source Serif 4', serif;
          color: #2b4fa8;
          margin-top: 14px;
        }
        .club-right-col {
          display: flex;
          flex-direction: column;
          gap: 22px;
          min-width: 0;
        }
        .letter-paper {
          position: relative;
          padding: 22px 26px;
          background: #FBF8F1;
          border: 1px solid #D6CEC0;
          box-shadow: 0 10px 24px rgba(0,0,0,0.3);
          transform: rotate(0.6deg);
        }
        .letter-hd {
          display: flex;
          justify-content: space-between;
          border-bottom: 3px double #1B1A17;
          padding-bottom: 6px;
        }
        .letter-hd b {
          font: 900 22px/1 'Playfair Display', serif;
        }
        .letter-hd span {
          font: 600 11px/1.3 'Barlow Condensed', sans-serif;
          letter-spacing: 0.14em;
          color: #5E574E;
          text-transform: uppercase;
          text-align: right;
        }
        .meters-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-top: 14px;
        }
        .meter-box span {
          display: block;
          font: 700 11px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.16em;
          color: #5E574E;
          text-transform: uppercase;
        }
        .meter-box b {
          font: 800 32px/1 'Barlow Condensed', sans-serif;
          display: block;
          margin-top: 4px;
        }
        .meter-bar {
          display: block;
          height: 7px;
          background: #ddd6c8;
          margin-top: 6px;
          position: relative;
        }
        .meter-bar u {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          background: #1B1A17;
        }
        .meter-bar em {
          position: absolute;
          top: -4px;
          bottom: -4px;
          width: 2px;
          background: #C42B2B;
        }
        .staff-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        .staff-card {
          position: relative;
          padding: 10px 10px 12px;
          background: #fbf8f1;
          color: #1B1A17;
          box-shadow: 0 10px 20px rgba(0,0,0,0.45);
          cursor: pointer;
          transition: transform 150ms ease;
        }
        .staff-card:hover {
          transform: translateY(-2px);
        }
        .staff-card:before {
          content: "";
          position: absolute;
          top: -8px;
          left: 50%;
          width: 14px;
          height: 14px;
          margin-left: -7px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #e05a4a, #8a1f17);
          box-shadow: 0 2px 3px rgba(0,0,0,0.4);
          z-index: 2;
        }
        .staff-photo {
          height: 110px;
          background: #efe3bd;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .dressing-paper {
          padding: 18px 22px;
          background: #FBF8F1;
          border: 1px solid #D6CEC0;
          box-shadow: 0 10px 24px rgba(0,0,0,0.3);
          transform: rotate(-0.5deg);
        }
        .lead-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 10px;
        }
        .lead-card {
          border: 2px solid #1B1A17;
          padding: 8px 10px;
          background: #FAF6ED;
        }
        .why-list div {
          display: flex;
          justify-content: space-between;
          font: 500 12.5px/1.3 'Inter', sans-serif;
          padding: 4px 0;
          border-bottom: 1px solid #ddd5c6;
        }
        .club-bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
          margin-top: 22px;
        }
        .fans-card {
          padding: 18px 22px;
          background: #EDE8DC;
          color: #141414;
          transform: rotate(0.5deg);
          box-shadow: 0 6px 18px rgba(0,0,0,0.25);
        }
        .stadium-card {
          padding: 18px 22px;
          background: rgba(12, 16, 22, 0.88);
          border: 1px solid #2A313D;
          color: #FFFFFF;
          box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        }
        .attendance-bars {
          display: flex;
          align-items: flex-end;
          gap: 5px;
          height: 65px;
          margin-top: 10px;
        }
        .attendance-bars i {
          flex: 1;
          background: #F2B705;
          border-radius: 1px 1px 0 0;
        }
      `}</style>

      <div className="club-grid">
        {/* Left Column: Ledger + Fans & Stadium */}
        <div>
          <div className="ledger-book">
            {/* Left Page: Balance & Chart */}
            <div className="ledger-pg left">
              <h3 className="ledger-h3">The ledger</h3>
              <div className="ledger-sub">Season 2026/27 · after Matchday {gameState.matchday}</div>
              <div className="ledger-bal">
                {formatMoney(userClub.balance)}
                <small>balance</small>
              </div>

              {/* Weekly in/out bar chart SVG */}
              <div style={{ marginTop: '14px' }}>
                <svg
                  width="100%"
                  height="220"
                  viewBox="0 0 420 220"
                  style={{ overflow: 'visible' }}
                >
                  {/* Gridlines */}
                  {[0, 1, 2, 3].map((v) => {
                    const y = 190 - v * 48;
                    return (
                      <g key={v}>
                        <line
                          x1={34}
                          y1={y}
                          x2={410}
                          y2={y}
                          stroke="#1B1A17"
                          strokeOpacity="0.12"
                        />
                        <text
                          x={28}
                          y={y + 4}
                          textAnchor="end"
                          fontFamily="Barlow Condensed"
                          fontSize="11"
                          fill="#5E574E"
                        >
                          €{v}M
                        </text>
                      </g>
                    );
                  })}

                  {/* Bars for matchdays 1..8 */}
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                    const md = i + 1;
                    const isH = md % 2 === 1; // alternating sample / fixture logic
                    const incVal = isH ? 2.8 + (i % 3) * 0.2 : 1.35;
                    const expVal = 1.05;
                    const x = 38 + i * 46;
                    const hInc = incVal * 48;
                    const hExp = expVal * 48;
                    return (
                      <g key={i}>
                        <rect x={x} y={190 - hInc} width={16} height={hInc} fill="#1E7B3C" />
                        <rect
                          x={x + 18}
                          y={190 - hExp}
                          width={16}
                          height={hExp}
                          fill="#C42B2B"
                          opacity="0.85"
                        />
                        <text
                          x={x + 17}
                          y={208}
                          textAnchor="middle"
                          fontFamily="Barlow Condensed"
                          fontWeight="600"
                          fontSize="11"
                          fill="#5E574E"
                        >
                          {md}
                          {isH ? 'H' : 'A'}
                        </text>
                      </g>
                    );
                  })}

                  <text
                    x={410}
                    y={14}
                    textAnchor="end"
                    fontFamily="Barlow Condensed"
                    fontWeight="700"
                    fontSize="11"
                    fill="#5E574E"
                    letterSpacing="1"
                  >
                    IN <tspan fill="#1E7B3C">■</tspan> OUT <tspan fill="#C42B2B">■</tspan> · HOME
                    GAMES PAY
                  </text>
                </svg>
              </div>

              <div className="handwriting">
                {userRank <= 3
                  ? `Gate up 18% since we went ${getOrdinal(userRank)}. Attendance holds firm. — F.`
                  : `Wages strictly on budget, sound fiscal cushion heading into the window. — F.`}
              </div>
            </div>

            {/* Right Page: This week's breakdown */}
            <div className="ledger-pg right">
              <h3 className="ledger-h3">This week</h3>
              <div className="ledger-sub">
                {isHome ? 'Home' : 'Away'} v {opponentClub?.name ?? 'League Opponent'} · Matchday{' '}
                {gameState.matchday}
              </div>

              <div style={{ marginTop: '16px' }}>
                <div className="ledger-li">
                  <span>
                    Gate receipts{' '}
                    {isHome
                      ? `(${estAttendance.toLocaleString()} at €${avgTicketPrice})`
                      : '(Away match)'}
                  </span>
                  <b style={{ color: isHome ? '#1E7B3C' : '#5E574E' }}>
                    {isHome ? `+${formatMoney(gateReceipts)}` : '€0'}
                  </b>
                </div>
                <div className="ledger-li">
                  <span>Television rights</span>
                  <b style={{ color: '#1E7B3C' }}>+€600K</b>
                </div>
                <div className="ledger-li">
                  <span>Sponsorship</span>
                  <b style={{ color: '#1E7B3C' }}>+{formatMoney(sponsorWeekly)}</b>
                </div>
                <div className="ledger-li">
                  <span>Player wages</span>
                  <b style={{ color: '#C42B2B' }}>−{formatMoney(currentWeeklyWage)}</b>
                </div>
                <div className="ledger-li">
                  <span>Staff wages</span>
                  <b style={{ color: '#C42B2B' }}>−{formatMoney(staffWages)}</b>
                </div>
                <div className="ledger-li">
                  <span>Running the club</span>
                  <b style={{ color: '#C42B2B' }}>−{formatMoney(operatingCosts)}</b>
                </div>
                <div className="ledger-li total">
                  <span>Week total</span>
                  <b style={{ color: weekNet >= 0 ? '#1E7B3C' : '#C42B2B' }}>
                    {weekNet >= 0
                      ? `+${formatMoney(weekNet)}`
                      : `−${formatMoney(Math.abs(weekNet))}`}
                  </b>
                </div>

                <div className="ledger-li" style={{ marginTop: '18px' }}>
                  <span>Transfer budget</span>
                  <b>{formatMoney(userClub.transferBudget)}</b>
                </div>
                <div className="ledger-li">
                  <span>Wage budget</span>
                  <b>{formatMoney(userClub.wageBudget)} / wk</b>
                </div>
                <div className="ledger-li">
                  <span>Wages now</span>
                  <b>{formatMoney(currentWeeklyWage)} / wk</b>
                </div>
                <div className="ledger-li">
                  <span>Wage room</span>
                  <b style={{ color: wageRoom >= 0 ? '#1E7B3C' : '#C42B2B' }}>
                    {formatMoney(wageRoom)} / wk
                  </b>
                </div>
                <div className="ledger-li">
                  <span>Prize money if we finish {getOrdinal(userRank)}</span>
                  <b>€{projectedPrize}M</b>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row: Fans and Stadium */}
          <div className="club-bottom-grid">
            <div className="fans-card">
              <div
                style={{
                  font: "700 11.5px/1 'Barlow Condensed', sans-serif",
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#5E574E',
                }}
              >
                The fans · mood {fanMood}{' '}
                {fanDelta >= 0 ? `▲${fanDelta}` : `▼${Math.abs(fanDelta)}`}
              </div>
              <q
                style={{
                  display: 'block',
                  font: "italic 400 14.5px/1.45 'Source Serif 4', serif",
                  marginTop: '8px',
                }}
              >
                "Best I've seen us play in years. Keep {topScorer?.lastName ?? 'our star'} at all costs."
              </q>
              <small
                style={{
                  display: 'block',
                  font: "600 11px/1 'Barlow Condensed', sans-serif",
                  letterSpacing: '0.12em',
                  color: '#5E574E',
                  marginTop: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Dave, North Stand season ticket since 1991 · Gazette letters
              </small>

              <q
                style={{
                  display: 'block',
                  font: "italic 400 14.5px/1.45 'Source Serif 4', serif",
                  marginTop: '10px',
                }}
              >
                {unhappyPlayer
                  ? `"${unhappyPlayer.lastName} looks frustrated with his minutes lately."`
                  : `"The midfield tempo has been brilliant, real grit off the ball."`}
              </q>
              <small
                style={{
                  display: 'block',
                  font: "600 11px/1 'Barlow Condensed', sans-serif",
                  letterSpacing: '0.12em',
                  color: '#5E574E',
                  marginTop: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Priti, Harbour End
              </small>
            </div>

            <div className="stadium-card">
              <div
                style={{
                  font: "700 12px/1 'Barlow Condensed', sans-serif",
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#9CA3AF',
                }}
              >
                {userClub.stadium.name}
              </div>
              <b
                style={{
                  display: 'block',
                  font: "800 28px/1 'Barlow Condensed', sans-serif",
                  marginTop: '6px',
                  color: '#FFFFFF',
                }}
              >
                {userClub.stadium.capacity.toLocaleString()} · {occupancyPct}% full
              </b>
              <p
                style={{
                  font: '500 13px/1.4 Inter, sans-serif',
                  color: '#CBD5E1',
                  margin: '6px 0 0',
                }}
              >
                Attendance by home game. Biggest: {biggestAtt.toLocaleString()} v{' '}
                {opponentClub?.name ?? 'Corvallen'}.
              </p>
              <div className="attendance-bars">
                {attendancesToShow.map((att, i) => (
                  <i
                    key={i}
                    style={{
                      height: `${Math.round((att / userClub.stadium.capacity) * 100)}%`,
                    }}
                    title={`Matchday attendance: ${att.toLocaleString()}`}
                  />
                ))}
                {Array.from({ length: Math.max(0, 9 - attendancesToShow.length) }).map((_, i) => (
                  <i
                    key={`empty-${i}`}
                    style={{
                      height: '6%',
                      background: '#2A313D',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Boardroom Letter, Staff Photo Cards, Dressing Room */}
        <div className="club-right-col">
          {/* From the Boardroom */}
          <div className="letter-paper">
            <div className="letter-hd">
              <b>From the boardroom</b>
              <span>
                {ownerName} · Owner
                <br />
                Week {gameState.matchday}
              </span>
            </div>
            <p
              style={{
                font: "400 14.5px/1.5 'Source Serif 4', serif",
                marginTop: '12px',
                color: '#1B1A17',
              }}
            >
              "{getOrdinal(userRank)}, and {ptsOffTop} point{ptsOffTop === 1 ? '' : 's'} off the
              summit. The board expected {userClub.expectation.label.toLowerCase()} and we remain on
              track. Keep the wage bill disciplined and we will back you in the window."
            </p>

            <div className="meters-grid">
              <div className="meter-box">
                <span>Board confidence</span>
                <b>
                  {boardConfidence}
                  <small
                    style={{
                      font: "700 14px/1 'Barlow Condensed', sans-serif",
                      marginLeft: '6px',
                      color: confDelta >= 0 ? '#1E7B3C' : '#C42B2B',
                    }}
                  >
                    {confDelta >= 0 ? `▲${confDelta}` : `▼${Math.abs(confDelta)}`}
                  </small>
                </b>
                <i className="meter-bar">
                  <u style={{ width: `${boardConfidence}%` }} />
                  <em style={{ left: '25%' }} title="25% Sack Threshold" />
                </i>
              </div>
              <div className="meter-box">
                <span>Expectation</span>
                <b style={{ fontSize: '24px', lineHeight: 1.2 }}>{userClub.expectation.label}</b>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button
                onClick={handleBudgetClick}
                style={{
                  font: "700 13px/1 'Barlow Condensed', sans-serif",
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '8px 14px',
                  background: '#1B1A17',
                  color: '#FBF8F1',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                Ask for more budget
              </button>
              <button
                onClick={handleStadiumClick}
                style={{
                  font: "700 13px/1 'Barlow Condensed', sans-serif",
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '8px 14px',
                  background: 'transparent',
                  color: '#1B1A17',
                  border: '1.5px solid #1B1A17',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                Talk about the stadium
              </button>
            </div>
          </div>

          {/* The Staff - 4 pinned photo cards */}
          <div>
            <div
              style={{
                font: "700 11px/1 'Barlow Condensed', sans-serif",
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#5E574E',
                marginBottom: '10px',
              }}
            >
              The staff · replace one per window round
            </div>
            <div className="staff-grid">
              {[
                {
                  role: 'assistant' as StaffRole,
                  title: 'Assistant',
                  data: staff?.assistant ?? { name: 'Theo Vance', stars: 3, wage: 12000 },
                  effect: 'Tips and analysis',
                  rot: -1.8,
                },
                {
                  role: 'coach' as StaffRole,
                  title: 'First-team coach',
                  data: staff?.coach ?? { name: 'Ruth Kemble', stars: 4, wage: 16000 },
                  effect: 'Development ×1.09',
                  rot: 1.4,
                },
                {
                  role: 'scout' as StaffRole,
                  title: 'Head of scouting',
                  data: staff?.scout ?? { name: 'Iker Fernandez', stars: 3, wage: 11000 },
                  effect: 'Knowledge +15%/wk',
                  rot: -1.0,
                },
                {
                  role: 'physio' as StaffRole,
                  title: 'Physio',
                  data: staff?.physio ?? { name: 'Sam Oduya', stars: 2, wage: 9000 },
                  effect: 'Injuries ×1.04 longer',
                  rot: 1.8,
                },
              ].map((s) => {
                const starsCount = s.data.stars ?? 3;
                return (
                  <div
                    key={s.role}
                    className="staff-card"
                    style={{ transform: `rotate(${s.rot}deg)` }}
                    onClick={() => setReplacingRole(s.role)}
                    title="Click to view replacement candidates"
                  >
                    <div className="staff-photo">
                      <Portrait
                        initials={s.data.name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)}
                        primaryColor={userClub.colors.primary}
                        secondaryColor={userClub.colors.secondary}
                        size={80}
                      />
                    </div>
                    <b
                      style={{
                        display: 'block',
                        font: "800 17px/1 'Barlow Condensed', sans-serif",
                        textTransform: 'uppercase',
                        marginTop: '8px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.data.name}
                    </b>
                    <small
                      style={{
                        display: 'block',
                        font: "600 11px/1.2 'Barlow Condensed', sans-serif",
                        letterSpacing: '0.1em',
                        color: '#5E574E',
                        textTransform: 'uppercase',
                        marginTop: '3px',
                      }}
                    >
                      {s.title}
                    </small>
                    <div
                      style={{
                        color: '#C98A12',
                        letterSpacing: '2px',
                        marginTop: '4px',
                        fontSize: '13px',
                      }}
                    >
                      {'★'.repeat(starsCount)}
                      <span style={{ color: '#cfc6b6' }}>{'★'.repeat(5 - starsCount)}</span>
                    </div>
                    <div
                      style={{
                        font: '500 11px/1.3 Inter, sans-serif',
                        color: '#3B372F',
                        marginTop: '5px',
                      }}
                    >
                      {s.effect}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* The Dressing Room */}
          <div className="dressing-paper">
            <div
              style={{
                font: "700 11.5px/1 'Barlow Condensed', sans-serif",
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#5E574E',
              }}
            >
              The dressing room
            </div>
            <div className="meters-grid" style={{ gridTemplateColumns: '1fr 1.3fr' }}>
              <div className="meter-box">
                <span>Cohesion</span>
                <b>
                  {currentCohesion}
                  <small
                    style={{
                      font: "700 14px/1 'Barlow Condensed', sans-serif",
                      marginLeft: '6px',
                      color: cohesionDelta >= 0 ? '#1E7B3C' : '#C42B2B',
                    }}
                  >
                    {cohesionDelta >= 0 ? `▲${cohesionDelta}` : `▼${Math.abs(cohesionDelta)}`}
                  </small>
                </b>
                <i className="meter-bar">
                  <u style={{ width: `${currentCohesion}%` }} />
                </i>
              </div>
              <div className="why-list">
                <div>
                  <span>Leaders are happy</span>
                  <b style={{ color: '#1E7B3C', fontFamily: 'Barlow Condensed', fontSize: '13px' }}>
                    +2
                  </b>
                </div>
                <div>
                  <span>Recent match performance</span>
                  <b
                    style={{
                      color: userRank <= 5 ? '#1E7B3C' : '#C42B2B',
                      fontFamily: 'Barlow Condensed',
                      fontSize: '13px',
                    }}
                  >
                    {userRank <= 5 ? '+1' : '−1'}
                  </b>
                </div>
                <div>
                  <span>Squad discipline</span>
                  <b style={{ color: '#1E7B3C', fontFamily: 'Barlow Condensed', fontSize: '13px' }}>
                    +1
                  </b>
                </div>
              </div>
            </div>

            <div className="lead-grid">
              {dressingRoomLeaders.map((ldr) => {
                const isCap = userClub.tactics.captain === ldr.id;
                const roleDesc = isCap ? 'Captain · Leader' : 'Leader · Influential';
                return (
                  <div key={ldr.id} className="lead-card">
                    <b
                      style={{
                        display: 'block',
                        font: "800 16px/1 'Barlow Condensed', sans-serif",
                        textTransform: 'uppercase',
                      }}
                    >
                      {ldr.knownAs ?? ldr.lastName} {isCap ? '©' : ''}
                    </b>
                    <small
                      style={{
                        display: 'block',
                        font: '500 11px/1.3 Inter, sans-serif',
                        color: '#5E574E',
                        marginTop: '3px',
                      }}
                    >
                      {roleDesc} · morale {ldr.morale >= 65 ? 'good' : 'fair'}
                    </small>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Staff Replacement Modal */}
      {replacingRole && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FBF8F1',
              color: '#1B1A17',
              borderRadius: '6px',
              maxWidth: '640px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
              border: '2px solid #D6CEC0',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #D6CEC0',
                paddingBottom: '12px',
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: 'Playfair Display, serif',
                    fontSize: '20px',
                  }}
                >
                  Replace{' '}
                  {replacingRole === 'coach'
                    ? 'First-Team Coach'
                    : replacingRole === 'scout'
                      ? 'Head of Scouting'
                      : replacingRole === 'physio'
                        ? 'Club Physio'
                        : 'Assistant'}
                </h3>
                <div style={{ fontSize: '12px', color: '#5E574E', marginTop: '2px' }}>
                  {isWindowActive
                    ? userClub.staffReplacedThisRound
                      ? 'Staff replacement limit reached for this round (1 per window round).'
                      : 'Transfer window open: select a candidate below to replace.'
                    : 'Replacement available during transfer window rounds.'}
                </div>
              </div>
              <button
                onClick={() => setReplacingRole(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1B1A17',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {generateStaffCandidates(
                replacingRole,
                gameState.matchday * 137 + gameState.seed,
              ).map((cand) => (
                <div
                  key={cand.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    backgroundColor: '#EDE8DC',
                    borderRadius: '4px',
                    border: '1px solid #D6CEC0',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{cand.name}</div>
                    <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={13}
                          fill={s <= cand.stars ? '#C98A12' : 'transparent'}
                          color={s <= cand.stars ? '#C98A12' : '#cfc6b6'}
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: '#5E574E', marginTop: '4px' }}>
                      Wage: {formatMoney(cand.wage)}/week
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!isWindowActive || userClub.staffReplacedThisRound) return;
                      hireStaffMember(cand);
                      setReplacingRole(null);
                      showToast(`Hired ${cand.name} as ${replacingRole}!`, 'success');
                    }}
                    disabled={!isWindowActive || !!userClub.staffReplacedThisRound}
                    style={{
                      padding: '8px 16px',
                      backgroundColor:
                        isWindowActive && !userClub.staffReplacedThisRound ? '#1B1A17' : '#D6CEC0',
                      color:
                        isWindowActive && !userClub.staffReplacedThisRound ? '#FBF8F1' : '#5E574E',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor:
                        isWindowActive && !userClub.staffReplacedThisRound
                          ? 'pointer'
                          : 'not-allowed',
                    }}
                  >
                    Hire
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
