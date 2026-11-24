// Implements SPEC §11.6 Squad and §11.7 Player Profile matching docs/design/squad/
import React, { useState, useMemo } from 'react';
import { useStore } from '../../state/store';
import { Player, Position, AttributeKey } from '../../core/types';
import { formatMoney } from '../../core/math';
import { Portrait } from '../components/Portrait';
import { RadarChart } from '../components/RadarChart';
import { getClubLeaders, getInjuryRisk } from '../../core/club/clubDepth';
import { isGoalkeeper } from '../../core/player/roleShapes';

type SquadFilter = 'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD' | 'INJURED' | 'UNHAPPY' | 'CONTRACTS';

export const SquadScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const setScreen = useStore((state) => state.setScreen);
  const showToast = useStore((state) => state.showToast);
  const setGameState = useStore((state) => state.setGameState);
  const openPlayerProfile = useStore((state) => state.openPlayerProfile);
  const openConversationModal = useStore((state) => state.openConversationModal);

  const [activeFilter, setActiveFilter] = useState<SquadFilter>('ALL');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string>('pos');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const leaders = getClubLeaders(userClub, gameState.players);
  const leaderIds = useMemo(() => new Set(leaders.map((l) => l.id)), [leaders]);

  const squadPlayers: Player[] = userClub.squad
    .map((id) => gameState.players[id])
    .filter((p): p is Player => p != null);

  // Default selection: Captain or first star player
  const captainId = userClub.tactics.captain;
  const currentSelectedId =
    selectedPlayerId ??
    squadPlayers.find((p) => p.id === captainId)?.id ??
    squadPlayers[0]?.id ??
    null;
  const selectedPlayer = squadPlayers.find((p) => p.id === currentSelectedId) ?? squadPlayers[0];

  // Counts for tabs
  const injuredCount = squadPlayers.filter((p) => p.injury !== null).length;
  const unhappyCount = squadPlayers.filter((p) => p.morale < 45).length;
  const expiringContractsCount = squadPlayers.filter(
    (p) => (p.contract?.yearsLeft ?? 2) <= 1,
  ).length;

  // Average age & total wages
  const totalWage = squadPlayers.reduce((s, p) => s + (p.contract?.wagePerWeek ?? 0), 0);
  const avgAge =
    squadPlayers.length > 0
      ? squadPlayers.reduce((s, p) => s + p.age, 0) / squadPlayers.length
      : 25.5;

  // Filter players
  const filteredPlayers = useMemo(() => {
    return squadPlayers.filter((p) => {
      const primaryPos = p.positions[0]?.pos ?? '';
      switch (activeFilter) {
        case 'GK':
          return primaryPos === 'GK';
        case 'DEF':
          return ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(primaryPos);
        case 'MID':
          return ['DM', 'CM', 'AM', 'LM', 'RM'].includes(primaryPos);
        case 'FWD':
          return ['LW', 'RW', 'ST'].includes(primaryPos);
        case 'INJURED':
          return p.injury !== null;
        case 'UNHAPPY':
          return p.morale < 45;
        case 'CONTRACTS':
          return (p.contract?.yearsLeft ?? 2) <= 1;
        case 'ALL':
        default:
          return true;
      }
    });
  }, [squadPlayers, activeFilter]);

  // Group into GK / DEF / MID / FWD
  const groups = useMemo(() => {
    const gk: Player[] = [];
    const def: Player[] = [];
    const mid: Player[] = [];
    const fwd: Player[] = [];

    const posOrder: Record<string, number> = {
      GK: 0,
      RB: 1,
      RWB: 2,
      CB: 3,
      LB: 4,
      LWB: 5,
      DM: 6,
      CM: 7,
      RM: 8,
      LM: 9,
      AM: 10,
      RW: 11,
      LW: 12,
      ST: 13,
    };

    filteredPlayers.forEach((p) => {
      const pos = p.positions[0]?.pos ?? 'CM';
      if (pos === 'GK') gk.push(p);
      else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) def.push(p);
      else if (['DM', 'CM', 'AM', 'LM', 'RM'].includes(pos)) mid.push(p);
      else fwd.push(p);
    });

    const sortFn = (a: Player, b: Player) => {
      if (sortCol === 'number') {
        const diff = (a.squadNumber ?? 99) - (b.squadNumber ?? 99);
        return sortAsc ? diff : -diff;
      }
      if (sortCol === 'name') {
        const diff = a.lastName.localeCompare(b.lastName);
        return sortAsc ? diff : -diff;
      }
      if (sortCol === 'age') {
        const diff = a.age - b.age;
        return sortAsc ? diff : -diff;
      }
      if (sortCol === 'ovr') {
        const diff = (b.bestOvr ?? b.ovr) - (a.bestOvr ?? a.ovr);
        return sortAsc ? -diff : diff;
      }
      if (sortCol === 'cond') {
        const diff = b.condition - a.condition;
        return sortAsc ? -diff : diff;
      }
      if (sortCol === 'morale') {
        const diff = b.morale - a.morale;
        return sortAsc ? -diff : diff;
      }
      if (sortCol === 'val') {
        const diff = b.marketValue - a.marketValue;
        return sortAsc ? -diff : diff;
      }
      // default: pos order
      const pA = posOrder[a.positions[0]?.pos ?? 'CM'] ?? 99;
      const pB = posOrder[b.positions[0]?.pos ?? 'CM'] ?? 99;
      return pA - pB;
    };

    return [
      { name: 'GOALKEEPERS', players: gk.sort(sortFn) },
      { name: 'DEFENDERS', players: def.sort(sortFn) },
      { name: 'MIDFIELDERS', players: mid.sort(sortFn) },
      { name: 'FORWARDS', players: fwd.sort(sortFn) },
    ].filter((g) => g.players.length > 0);
  }, [filteredPlayers, sortCol, sortAsc]);

  const handleHeaderSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  // Helper colors
  const getOvrColor = (o: number) => {
    if (o >= 78) return '#1E7B3C';
    if (o >= 73) return '#2f6f9a';
    if (o >= 68) return '#C98A12';
    return '#7a7062';
  };

  const getMoraleLabel = (m: number) => {
    if (m >= 80) return { label: 'Superb', color: '#1E7B3C' };
    if (m >= 60) return { label: 'Good', color: '#1E7B3C' };
    if (m >= 45) return { label: 'Okay', color: '#5E574E' };
    return { label: 'Unhappy', color: '#C42B2B' };
  };

  // Selected player attributes breakdown
  const isGk = selectedPlayer ? isGoalkeeper(selectedPlayer) : false;
  const bestPos = selectedPlayer?.positions[0]?.pos ?? 'CM';
  const bestOvr = selectedPlayer?.bestOvr ?? selectedPlayer?.ovr ?? 70;
  const potStars = selectedPlayer
    ? selectedPlayer.potential >= 85
      ? 5
      : selectedPlayer.potential >= 78
        ? 4
        : selectedPlayer.potential >= 71
          ? 3
          : 2
    : 3;

  const trainingRating = selectedPlayer?.trainingHistory?.slice(-1)[0]?.rating ?? 7.2;
  const injuryRisk = selectedPlayer ? getInjuryRisk(selectedPlayer) : { level: 'Low' };

  // Attribute tables
  const technicalAttrs: [string, number, number, boolean][] = selectedPlayer
    ? isGk
      ? [
          ['Reflexes', selectedPlayer.attributes.reflexes, 1, true],
          ['Handling', selectedPlayer.attributes.handling, 0, true],
          ['One-on-ones', selectedPlayer.attributes.oneOnOnes, 1, true],
          ['Aerial command', selectedPlayer.attributes.aerialCommand, 0, false],
          ['Passing', selectedPlayer.attributes.passing, 0, false],
          ['First touch', selectedPlayer.attributes.firstTouch, 0, false],
        ]
      : [
          ['Passing', selectedPlayer.attributes.passing, 1, ['CM', 'AM', 'DM'].includes(bestPos)],
          ['First touch', selectedPlayer.attributes.firstTouch, 0, false],
          [
            'Dribbling',
            selectedPlayer.attributes.dribbling,
            0,
            ['LW', 'RW', 'AM'].includes(bestPos),
          ],
          [
            'Crossing',
            selectedPlayer.attributes.crossing,
            0,
            ['LW', 'RW', 'LB', 'RB'].includes(bestPos),
          ],
          [
            'Finishing',
            selectedPlayer.attributes.finishing,
            1,
            ['ST', 'LW', 'RW'].includes(bestPos),
          ],
          ['Long shots', selectedPlayer.attributes.longShots, 0, false],
          ['Set pieces', selectedPlayer.attributes.setPieces, 0, false],
        ]
    : [];

  const mentalAttrs: [string, number, number, boolean][] = selectedPlayer
    ? [
        ['Decisions', selectedPlayer.attributes.decisions, 1, true],
        [
          'Vision',
          selectedPlayer.attributes.passing > 70
            ? Math.min(99, selectedPlayer.attributes.passing - 2)
            : 65,
          0,
          true,
        ],
        ['Composure', selectedPlayer.attributes.composure, 0, false],
        [
          'Off the ball',
          selectedPlayer.attributes.offTheBall,
          0,
          ['ST', 'LW', 'RW', 'AM'].includes(bestPos),
        ],
        [
          'Positioning',
          selectedPlayer.attributes.positioning,
          -1,
          ['CB', 'DM', 'GK'].includes(bestPos),
        ],
        ['Work rate', selectedPlayer.attributes.workRate, 0, true],
        ['Leadership', selectedPlayer.personality === 'Leader' ? 82 : 68, 0, false],
      ]
    : [];

  const physicalAttrs: [string, number, number, boolean][] = selectedPlayer
    ? [
        ['Stamina', selectedPlayer.attributes.stamina, 0, true],
        ['Pace', selectedPlayer.attributes.pace, 0, false],
        ['Strength', selectedPlayer.attributes.strength, 0, false],
        [
          'Tackling',
          selectedPlayer.attributes.tackling,
          1,
          ['CB', 'DM', 'LB', 'RB'].includes(bestPos),
        ],
        ['Heading', selectedPlayer.attributes.heading, 0, ['CB', 'ST'].includes(bestPos)],
        [
          'Balance',
          Math.round((selectedPlayer.attributes.pace + selectedPlayer.attributes.dribbling) / 2),
          0,
          false,
        ],
        [
          'Agility',
          Math.round((selectedPlayer.attributes.pace + selectedPlayer.attributes.firstTouch) / 2),
          0,
          false,
        ],
      ]
    : [];

  // Actions
  const handleMakeCaptain = () => {
    if (!selectedPlayer) return;
    const next = JSON.parse(JSON.stringify(gameState));
    next.clubs[next.userClubId].tactics.captain = selectedPlayer.id;
    setGameState(next);
    showToast(
      `${selectedPlayer.knownAs ?? selectedPlayer.lastName} appointed Club Captain!`,
      'success',
    );
  };

  const handleTransferList = () => {
    if (!selectedPlayer) return;
    const next = JSON.parse(JSON.stringify(gameState));
    const p = next.players[selectedPlayer.id];
    if (p) {
      p.transferListed = !p.transferListed;
      setGameState(next);
      showToast(
        p.transferListed
          ? `${p.lastName} added to transfer list.`
          : `${p.lastName} removed from transfer list.`,
        'info',
      );
    }
  };

  const handleContractOffer = () => {
    if (!selectedPlayer) return;
    const next = JSON.parse(JSON.stringify(gameState));
    const p = next.players[selectedPlayer.id];
    if (p && p.contract) {
      p.contract.yearsLeft = (p.contract.yearsLeft ?? 1) + 2;
      setGameState(next);
      showToast(`Offered 2-year contract extension to ${p.lastName}. Deal agreed!`, 'success');
    }
  };

  const handleTalkToPlayer = () => {
    if (!selectedPlayer) return;
    openConversationModal();
  };

  const handleTrainingFocus = () => {
    setScreen('training');
  };

  return (
    <div
      style={{
        padding: '22px 24px',
        color: '#1B1A17',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      <style>{`
        .squad-layout {
          display: grid;
          grid-template-columns: 1fr 720px;
          gap: 28px;
          max-width: 1720px;
          margin: 0 auto;
        }
        @media (max-width: 1440px) {
          .squad-layout {
            grid-template-columns: 1fr 620px;
            gap: 20px;
          }
        }
        @media (max-width: 1240px) {
          .squad-layout {
            grid-template-columns: 1fr;
          }
        }
        .sheetwrap {
          position: relative;
          min-height: 980px;
        }
        .sheetwrap .back {
          position: absolute;
          inset: 20px 6px 0 12px;
          background: #EAE3D2;
          transform: rotate(0.8deg);
          box-shadow: 0 14px 30px rgba(0,0,0,0.5);
          border-radius: 4px;
        }
        .sheetwrap .clipper {
          position: absolute;
          top: 6px;
          left: 50%;
          margin-left: -75px;
          width: 150px;
          height: 24px;
          background: #2a313d;
          border-radius: 4px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.4);
          z-index: 10;
        }
        .sheet {
          position: relative;
          margin: 30px 16px 8px 0;
          padding: 30px 26px 18px;
          background: #FBF8F1;
          box-shadow: 0 10px 24px rgba(0,0,0,0.3);
          border: 1px solid #D6CEC0;
        }
        .hdr {
          display: flex;
          align-items: flex-end;
          gap: 18px;
          border-bottom: 3px solid #1B1A17;
          padding-bottom: 10px;
          flex-wrap: wrap;
        }
        .hdr .h2 {
          font: 800 32px/1 'Barlow Condensed', sans-serif;
          text-transform: uppercase;
        }
        .hdr small {
          font: 600 13px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #5E574E;
        }
        .ftabs {
          margin-left: auto;
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .ftabs span {
          font: 700 12.5px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 7px 10px;
          background: #ddd6c8;
          color: #5E574E;
          cursor: pointer;
          user-select: none;
        }
        .ftabs span.on {
          background: #1B1A17;
          color: #FBF8F1;
        }
        table.squad-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        table.squad-table th {
          font: 600 10.5px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #5E574E;
          text-align: left;
          padding: 7px 5px;
          border-bottom: 2px solid #1B1A17;
          cursor: pointer;
        }
        table.squad-table td {
          padding: 5px 5px;
          border-bottom: 1px solid #ddd5c6;
          font-size: 13px;
          vertical-align: middle;
          height: 33px;
        }
        tr.grp td {
          height: 26px;
          border-bottom: 1.5px solid #1B1A17;
          font: 700 12px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.18em;
          color: #5E574E;
          padding-top: 12px;
          background: transparent;
        }
        tr.squad-row {
          cursor: pointer;
        }
        tr.squad-row:hover td {
          background: rgba(31,79,191,0.04);
        }
        tr.squad-row.sel td {
          background: rgba(31,79,191,0.08);
        }
        tr.squad-row.sel td:first-child {
          box-shadow: inset 4px 0 0 #1F4FBF;
        }
        .s-no {
          font: 800 16px/1 'Barlow Condensed', sans-serif;
          color: #5E574E;
          width: 26px;
        }
        .s-nm {
          font-weight: 600;
          white-space: nowrap;
        }
        .s-nm small {
          font: 600 10.5px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.1em;
          color: #5E574E;
          margin-left: 6px;
        }
        .s-pos span {
          font: 700 11px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.08em;
          padding: 3px 5px 2px;
          background: #1B1A17;
          color: #FBF8F1;
          margin-right: 3px;
        }
        .s-pos span.alt {
          background: transparent;
          color: #1B1A17;
          border: 1px solid #1B1A17;
        }
        .s-ovr {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 23px;
          font: 800 15px/1 'Barlow Condensed', sans-serif;
          color: #ffffff;
        }
        .s-cond {
          width: 65px;
        }
        .s-cond i {
          display: block;
          height: 6px;
          background: #d6cfc1;
          position: relative;
        }
        .s-cond i u {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
        }
        .s-mor {
          font: 600 12px/1 Inter, sans-serif;
        }
        .s-form {
          display: flex;
          gap: 3px;
        }
        .s-form b {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .s-st {
          display: flex;
          gap: 3px;
          align-items: center;
        }
        .s-ic {
          font: 800 10.5px/1 'Barlow Condensed', sans-serif;
          width: 17px;
          height: 17px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid currentColor;
        }
        .s-ic.cap {
          background: #F2B705;
          color: #1B1A17;
          border-color: #1B1A17;
        }

        /* Right Dossier File */
        .file-wrap {
          position: relative;
          min-height: 980px;
        }
        .file-tab {
          position: absolute;
          top: 0;
          left: 30px;
          background: #d8b878;
          color: #3b2d10;
          font: 700 16px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 9px 18px 7px;
          border-radius: 5px 5px 0 0;
          z-index: 5;
        }
        .file-pg {
          position: relative;
          margin-top: 31px;
          padding: 26px 28px;
          background: #FBF8F1;
          border: 1px solid #D6CEC0;
          box-shadow: 0 10px 24px rgba(0,0,0,0.3);
        }
        .file-hd {
          display: grid;
          grid-template-columns: 140px 1fr auto;
          gap: 18px;
          padding-bottom: 16px;
          border-bottom: 2px solid #1B1A17;
        }
        .file-hd .photo-box {
          height: 165px;
          background: #efe3bd;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .file-hd h2 {
          font: 800 42px/0.9 'Barlow Condensed', sans-serif;
          text-transform: uppercase;
          margin: 0;
        }
        .file-meta {
          font: 500 12.5px/1.5 Inter, sans-serif;
          color: #5E574E;
          margin-top: 6px;
        }
        .file-meta b {
          color: #1B1A17;
          font-weight: 600;
        }
        .file-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .file-chips span {
          font: 700 11.5px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.06em;
          padding: 4px 6px 3px;
          border: 1.5px solid #1B1A17;
        }
        .file-chips span.filled {
          background: #1B1A17;
          color: #FBF8F1;
        }
        .file-chips span.trait {
          border-color: #1F4FBF;
          color: #1F4FBF;
        }
        .file-big-ovr {
          text-align: right;
        }
        .file-big-ovr b {
          display: block;
          font: 800 66px/0.85 'Barlow Condensed', sans-serif;
          color: #1E7B3C;
        }
        .file-big-ovr span {
          font: 700 11px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.12em;
          color: #5E574E;
        }
        .file-big-ovr .pot-stars {
          color: #C98A12;
          font-size: 16px;
          letter-spacing: 2px;
          margin-top: 6px;
          display: block;
        }
        .file-row3 {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 20px;
          margin-top: 16px;
        }
        .facts-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 8px;
        }
        .facts-grid div {
          font: 800 23px/1 'Barlow Condensed', sans-serif;
        }
        .facts-grid div span {
          display: block;
          font: 600 10.5px/1.2 Inter, sans-serif;
          color: #5E574E;
          margin-top: 3px;
        }
        .attrs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0 16px;
          margin-top: 14px;
        }
        .attrs-grid h5 {
          font: 700 11.5px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.16em;
          color: #5E574E;
          text-transform: uppercase;
          margin: 6px 0 6px;
        }
        .attr-row {
          display: grid;
          grid-template-columns: 1fr 65px 22px 10px;
          align-items: center;
          gap: 6px;
          height: 21px;
          font-size: 12px;
        }
        .attr-row i {
          display: block;
          height: 5px;
          background: #ddd6c8;
          position: relative;
        }
        .attr-row i u {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          background: #1B1A17;
        }
        .attr-row b {
          font: 700 14px/1 'Barlow Condensed', sans-serif;
          text-align: right;
        }
        .attr-row em {
          font-style: normal;
          font-size: 9px;
        }
        .attr-row.key {
          font-weight: 600;
        }
        .attr-row.key i u {
          background: #1F4FBF;
        }
        .coach-note {
          margin-top: 14px;
          background: #fff8d8;
          border-left: 4px solid #C98A12;
          padding: 10px 12px;
          font: italic 400 13.5px/1.4 'Source Serif 4', serif;
        }
        .coach-note b {
          font: 700 11px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.14em;
          font-style: normal;
          display: block;
          color: #5E574E;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .file-acts {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        .btn-act {
          font: 700 12.5px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 8px 12px;
          border-radius: 3px;
          cursor: pointer;
        }
        .btn-act.primary {
          background: #1B1A17;
          color: #FBF8F1;
          border: none;
        }
        .btn-act.ghost {
          background: transparent;
          color: #1B1A17;
          border: 1.5px solid #1B1A17;
        }
      `}</style>

      <div className="squad-layout">
        {/* Left Side: Clipboard Team Sheet */}
        <div className="sheetwrap">
          <div className="back" />
          <div className="clipper" />
          <div className="sheet">
            <div className="hdr">
              <div>
                <div className="h2">The squad</div>
                <small>
                  {squadPlayers.length} players · wage bill {formatMoney(totalWage)}/week · average
                  age {avgAge.toFixed(1)}
                </small>
              </div>

              <div className="ftabs">
                <span
                  className={activeFilter === 'ALL' ? 'on' : ''}
                  onClick={() => setActiveFilter('ALL')}
                >
                  All
                </span>
                <span
                  className={activeFilter === 'GK' ? 'on' : ''}
                  onClick={() => setActiveFilter('GK')}
                >
                  GK
                </span>
                <span
                  className={activeFilter === 'DEF' ? 'on' : ''}
                  onClick={() => setActiveFilter('DEF')}
                >
                  DEF
                </span>
                <span
                  className={activeFilter === 'MID' ? 'on' : ''}
                  onClick={() => setActiveFilter('MID')}
                >
                  MID
                </span>
                <span
                  className={activeFilter === 'FWD' ? 'on' : ''}
                  onClick={() => setActiveFilter('FWD')}
                >
                  FWD
                </span>
                {injuredCount > 0 && (
                  <span
                    className={activeFilter === 'INJURED' ? 'on' : ''}
                    onClick={() => setActiveFilter('INJURED')}
                  >
                    Injured {injuredCount}
                  </span>
                )}
                {unhappyCount > 0 && (
                  <span
                    className={activeFilter === 'UNHAPPY' ? 'on' : ''}
                    onClick={() => setActiveFilter('UNHAPPY')}
                  >
                    Unhappy {unhappyCount}
                  </span>
                )}
                {expiringContractsCount > 0 && (
                  <span
                    className={activeFilter === 'CONTRACTS' ? 'on' : ''}
                    onClick={() => setActiveFilter('CONTRACTS')}
                  >
                    Contracts {expiringContractsCount}
                  </span>
                )}
              </div>
            </div>

            <table className="squad-table">
              <thead>
                <tr>
                  <th onClick={() => handleHeaderSort('number')}>#</th>
                  <th onClick={() => handleHeaderSort('name')}>Player</th>
                  <th onClick={() => handleHeaderSort('pos')}>Pos</th>
                  <th onClick={() => handleHeaderSort('age')}>Age</th>
                  <th onClick={() => handleHeaderSort('ovr')}>OVR</th>
                  <th onClick={() => handleHeaderSort('cond')}>Cond</th>
                  <th onClick={() => handleHeaderSort('morale')}>Morale</th>
                  <th>Form</th>
                  <th>Trn</th>
                  <th>Contract</th>
                  <th onClick={() => handleHeaderSort('val')}>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((grp) => (
                  <React.Fragment key={grp.name}>
                    <tr className="grp">
                      <td colSpan={12}>{grp.name}</td>
                    </tr>
                    {grp.players.map((p, pIdx) => {
                      const isSel = p.id === selectedPlayer?.id;
                      const pNum = p.squadNumber ?? pIdx + 1;
                      const primaryPos = p.positions[0]?.pos ?? 'CM';
                      const altPos = p.positions[1]?.pos;
                      const ovrVal = p.bestOvr ?? p.ovr;
                      const mor = getMoraleLabel(p.morale);
                      const trnRating = p.trainingHistory?.slice(-1)[0]?.rating ?? 7.0;
                      const contractYears = `${p.contract?.yearsLeft ?? 2}y`;
                      const is1y = (p.contract?.yearsLeft ?? 2) <= 1;

                      // Icons
                      const isCap = p.id === userClub.tactics.captain;
                      const isLdr = leaderIds.has(p.id);
                      const isInj = p.injury !== null;
                      const isUnhappy = p.morale < 45;
                      const isOverloaded = (p.fatigue ?? 0) >= 65;

                      return (
                        <tr
                          key={p.id}
                          className={`squad-row ${isSel ? 'sel' : ''}`}
                          onClick={() => setSelectedPlayerId(p.id)}
                        >
                          <td className="s-no">{pNum}</td>
                          <td className="s-nm">
                            {p.knownAs ?? p.lastName}
                            <small>{p.nationality}</small>
                          </td>
                          <td className="s-pos">
                            <span>{primaryPos}</span>
                            {altPos && <span className="alt">{altPos}</span>}
                          </td>
                          <td>{p.age}</td>
                          <td>
                            <span className="s-ovr" style={{ background: getOvrColor(ovrVal) }}>
                              {ovrVal}
                            </span>
                          </td>
                          <td className="s-cond">
                            <i>
                              <u
                                style={{
                                  width: `${p.condition}%`,
                                  background:
                                    p.condition < 70
                                      ? '#C42B2B'
                                      : p.condition < 85
                                        ? '#C98A12'
                                        : '#1E7B3C',
                                }}
                              />
                            </i>
                            {Boolean((p.rushedBack?.matchesLeft ?? 0) > 0) && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: '#C42B2B',
                                  fontWeight: 700,
                                  display: 'block',
                                  lineHeight: 1,
                                  marginTop: '2px',
                                }}
                              >
                                Not fit
                              </span>
                            )}
                          </td>
                          <td className="s-mor" style={{ color: mor.color }}>
                            {mor.label}
                          </td>
                          <td>
                            <span className="s-form">
                              {p.form && p.form.length > 0 ? (
                                p.form.slice(-5).map((fVal, fI) => {
                                  const col =
                                    fVal >= 7.2 ? '#1E7B3C' : fVal >= 6.3 ? '#a39b8c' : '#C42B2B';
                                  return (
                                    <b
                                      key={fI}
                                      style={{ background: col }}
                                      title={`Rating: ${fVal.toFixed(1)}`}
                                    />
                                  );
                                })
                              ) : (
                                <span style={{ color: '#a39b8c', fontSize: '11px' }}>no games</span>
                              )}
                            </span>
                          </td>
                          <td
                            style={{
                              font: "700 14px 'Barlow Condensed', sans-serif",
                              color:
                                trnRating >= 7.5
                                  ? '#1E7B3C'
                                  : trnRating <= 5.5
                                    ? '#C42B2B'
                                    : '#1B1A17',
                            }}
                          >
                            {trnRating.toFixed(1)}
                          </td>
                          <td
                            style={{
                              color: is1y ? '#C42B2B' : '#1B1A17',
                              fontWeight: is1y ? 700 : 500,
                            }}
                          >
                            {contractYears}
                          </td>
                          <td>{formatMoney(p.marketValue)}</td>
                          <td>
                            <span className="s-st">
                              {isInj && (
                                <span className="s-ic" style={{ color: '#C42B2B' }}>
                                  +
                                </span>
                              )}
                              {isCap && <span className="s-ic cap">C</span>}
                              {!isCap && isLdr && <span className="s-ic">L</span>}
                              {isOverloaded && (
                                <span className="s-ic" style={{ color: '#C98A12' }}>
                                  !
                                </span>
                              )}
                              {isUnhappy && (
                                <span className="s-ic" style={{ color: '#C42B2B' }}>
                                  ☹
                                </span>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Player Dossier Manila File */}
        {selectedPlayer && (
          <div className="file-wrap">
            <div className="file-tab">
              {selectedPlayer.lastName} · No. {selectedPlayer.squadNumber ?? 8}
            </div>

            <div className="file-pg">
              {/* Header */}
              <div className="file-hd">
                <div className="photo-box">
                  <Portrait
                    playerId={selectedPlayer.id}
                    initials={`${selectedPlayer.firstName[0] ?? ''}${selectedPlayer.lastName[0] ?? ''}`}
                    primaryColor={userClub.colors.primary}
                    secondaryColor={userClub.colors.secondary}
                    size={110}
                  />
                </div>

                <div>
                  <h2>
                    {selectedPlayer.firstName} {selectedPlayer.lastName}
                  </h2>
                  <div className="file-meta">
                    <b>{selectedPlayer.age}</b> · {selectedPlayer.nationality} ·{' '}
                    <b>{selectedPlayer.preferredFoot} foot</b> · {selectedPlayer.height} m ·{' '}
                    {selectedPlayer.personality ?? 'Professional'} ·{' '}
                    {leaderIds.has(selectedPlayer.id) ? 'Leader' : 'First-team'}
                  </div>

                  <div className="file-chips">
                    {selectedPlayer.positions.map((posInfo, idx) => (
                      <span key={posInfo.pos} className={idx === 0 ? 'filled' : ''}>
                        {posInfo.pos} {posInfo.familiarity ?? 100}
                      </span>
                    ))}
                    {(selectedPlayer.traits ?? []).map((t) => (
                      <span key={t} className="trait">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="file-meta" style={{ marginTop: '8px' }}>
                    Value <b>{formatMoney(selectedPlayer.marketValue)}</b> · Wage{' '}
                    <b>{formatMoney(selectedPlayer.contract?.wagePerWeek ?? 15000)}/wk</b> ·
                    Contract{' '}
                    <b>
                      {selectedPlayer.contract?.yearsLeft ?? 2} year
                      {(selectedPlayer.contract?.yearsLeft ?? 2) === 1 ? '' : 's'}
                    </b>{' '}
                    · Role <b>{selectedPlayer.squadRole ?? 'Regular'}</b>
                  </div>
                </div>

                <div className="file-big-ovr">
                  <b>{bestOvr}</b>
                  <span>OVR AT {bestPos}</span>
                  <span className="pot-stars">
                    {'★'.repeat(potStars)}
                    <span style={{ color: '#cfc6b6' }}>{'★'.repeat(5 - potStars)}</span>
                  </span>
                </div>
              </div>

              {/* Middle row: Radar Chart + Season Facts */}
              <div className="file-row3">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RadarChart player={selectedPlayer} size={190} />
                </div>

                <div>
                  <div
                    style={{
                      font: "700 11px/1 'Barlow Condensed', sans-serif",
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#5E574E',
                    }}
                  >
                    This season
                  </div>
                  <div className="facts-grid">
                    <div>
                      {selectedPlayer.stats.apps}
                      <span>apps</span>
                    </div>
                    <div>
                      {selectedPlayer.stats.goals}
                      <span>goals</span>
                    </div>
                    <div>
                      {selectedPlayer.stats.assists}
                      <span>assists</span>
                    </div>
                    <div>
                      {selectedPlayer.stats.avgRating > 0
                        ? selectedPlayer.stats.avgRating.toFixed(2)
                        : '—'}
                      <span>avg rating</span>
                    </div>
                  </div>

                  <div
                    style={{
                      font: "700 11px/1 'Barlow Condensed', sans-serif",
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#5E574E',
                      marginTop: '14px',
                    }}
                  >
                    Condition · Morale · Training
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      marginTop: '8px',
                      font: '600 13px/1 Inter, sans-serif',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      {selectedPlayer.condition}%{' '}
                      <span style={{ color: '#1E7B3C' }}>
                        {selectedPlayer.condition >= 85 ? 'fit' : 'recovering'}
                      </span>
                      {Boolean((selectedPlayer.rushedBack?.matchesLeft ?? 0) > 0) && (
                        <span
                          style={{
                            marginLeft: '6px',
                            backgroundColor: '#FEE2E2',
                            color: '#991B1B',
                            border: '1px solid #F87171',
                            borderRadius: '3px',
                            padding: '1px 6px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          Not fully fit
                        </span>
                      )}
                    </span>
                    <span style={{ color: getMoraleLabel(selectedPlayer.morale).color }}>
                      {getMoraleLabel(selectedPlayer.morale).label}
                    </span>
                    <span>
                      {trainingRating.toFixed(1)} <span style={{ color: '#1E7B3C' }}>▲</span>
                    </span>
                    <span
                      style={{
                        color:
                          injuryRisk.level === 'High'
                            ? '#C42B2B'
                            : injuryRisk.level === 'Medium'
                              ? '#C98A12'
                              : '#1E7B3C',
                      }}
                    >
                      Injury risk: {injuryRisk.level.toLowerCase()} · fatigue{' '}
                      {selectedPlayer.fatigue ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attributes: Technical, Mental, Physical */}
              <div className="attrs-grid">
                <div>
                  <h5>{isGk ? 'Goalkeeping' : 'Technical'}</h5>
                  {technicalAttrs.map(([n, v, d, key]) => (
                    <div key={n} className={`attr-row ${key ? 'key' : ''}`}>
                      <span>{n}</span>
                      <i>
                        <u style={{ width: `${v}%` }} />
                      </i>
                      <b>{v}</b>
                      <em style={{ color: d > 0 ? '#1E7B3C' : d < 0 ? '#C42B2B' : 'transparent' }}>
                        {d > 0 ? '▲' : d < 0 ? '▼' : ''}
                      </em>
                    </div>
                  ))}
                </div>

                <div>
                  <h5>Mental</h5>
                  {mentalAttrs.map(([n, v, d, key]) => (
                    <div key={n} className={`attr-row ${key ? 'key' : ''}`}>
                      <span>{n}</span>
                      <i>
                        <u style={{ width: `${v}%` }} />
                      </i>
                      <b>{v}</b>
                      <em style={{ color: d > 0 ? '#1E7B3C' : d < 0 ? '#C42B2B' : 'transparent' }}>
                        {d > 0 ? '▲' : d < 0 ? '▼' : ''}
                      </em>
                    </div>
                  ))}
                </div>

                <div>
                  <h5>Physical</h5>
                  {physicalAttrs.map(([n, v, d, key]) => (
                    <div key={n} className={`attr-row ${key ? 'key' : ''}`}>
                      <span>{n}</span>
                      <i>
                        <u style={{ width: `${v}%` }} />
                      </i>
                      <b>{v}</b>
                      <em style={{ color: d > 0 ? '#1E7B3C' : d < 0 ? '#C42B2B' : 'transparent' }}>
                        {d > 0 ? '▲' : d < 0 ? '▼' : ''}
                      </em>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coach's Note */}
              <div className="coach-note">
                <b>Coach's note</b>
                {trainingRating >= 7.5
                  ? 'Sharper on the ball this month. Ready to be the one who decides big games.'
                  : trainingRating >= 6.5
                    ? 'Consistent work in training sessions. Maintaining steady physical output.'
                    : 'Looking slightly off the pace in tactical drills. Needs extra focus.'}
              </div>

              {/* Injury & Discipline Record (§12.19 & §12.20) */}
              <div
                style={{
                  marginTop: '12px',
                  borderTop: '1px solid #E5DFD3',
                  paddingTop: '8px',
                }}
              >
                <div
                  style={{
                    font: "700 11px/1 'Barlow Condensed', sans-serif",
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                    marginBottom: '4px',
                  }}
                >
                  Disciplinary & Injury Record
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#1B1A17',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div>
                    <b>Discipline:</b> {selectedPlayer.disciplineRecord?.yellows ?? 0} yellow ·{' '}
                    {selectedPlayer.disciplineRecord?.reds ?? 0} red ·{' '}
                    {selectedPlayer.disciplineRecord?.finesCount ?? 0} fine
                    {(selectedPlayer.disciplineRecord?.finesCount ?? 0) === 1 ? '' : 's'}
                  </div>
                  {selectedPlayer.injuryLog && selectedPlayer.injuryLog.length > 0 ? (
                    <div>
                      <b>Injuries:</b>{' '}
                      {selectedPlayer.injuryLog.slice(-3).map((inj, i) => (
                        <span key={i} style={{ marginRight: '8px' }}>
                          MD{inj.matchday}: {inj.type.replace(/_/g, ' ')} ({inj.weeksOut}w
                          {inj.wasRushed ? ', rushed back' : ''})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#7E7567' }}>No significant injury absences recorded.</div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="file-acts">
                <button className="btn-act primary" onClick={handleTalkToPlayer}>
                  Talk to him
                </button>
                <button className="btn-act ghost" onClick={handleTrainingFocus}>
                  Training focus
                </button>
                <button className="btn-act ghost" onClick={handleContractOffer}>
                  Offer new contract
                </button>
                <button className="btn-act ghost" onClick={handleMakeCaptain}>
                  Make captain
                </button>
                <button className="btn-act ghost" onClick={handleTransferList}>
                  {selectedPlayer.transferListed ? 'Remove from list' : 'Transfer list'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
