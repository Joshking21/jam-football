// Implements SPEC §11.10 Transfers & Scouting screen
// Design reference: docs/design/scouting/ (scouting.png & index.html)
import React, { useState, useMemo } from 'react';
import { useStore } from '../../state/store';
import { Player, Club, PlayerId, AttributeKey, SquadRole, TransferOffer } from '../../core/types';
import { formatMoney, clamp } from '../../core/math';
import { valueOf, wageFor } from '../../core/player/value';
import { getPrimaryOvr } from '../../core/player/ratings';
import {
  isPlayerScouted,
  getScoutedAttribute,
  getScoutedOvr,
  getPotentialStars,
  getPlayerKnowledge,
  canScoutPlayer,
} from '../../core/transfers/scouting';
import { calculateAskingPrice } from '../../core/transfers/transfers';
import { BALANCE } from '../../config/balance';
import { composeScoutNote } from './scoutNote';
import {
  Search,
  Check,
  X,
  AlertCircle,
  Binoculars,
  ChevronRight,
  TrendingUp,
  FileText,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';

// --- Halftone SVG Portrait ---
const HalftonePortrait: React.FC<{
  seed?: number;
  width?: number;
  height?: number;
  ink?: string;
}> = ({ seed = 1, width = 140, height = 160, ink = '#141414' }) => {
  const circles = useMemo(() => {
    const Wp = 140;
    const Hp = 160;
    const st = 3.2;
    const sm = (e0: number, e1: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
      Math.hypot((x - cx) / rx, (y - cy) / ry);

    function lum(x: number, y: number) {
      const cx = 70;
      const bg = 0.95 - 0.1 * (y / Hp) - 0.08 * sm(0, 140, x);
      const sw = 28 + Math.max(0, y - 120) * 1.35;
      const inSh = y > 120 && Math.abs(x - cx) < sw;
      const head = ell(x, y, cx, 68, 26, 34);
      const neck = Math.abs(x - cx) < 13 && y > 92 && y < 128;
      let l = bg;
      if (inSh) {
        l = 0.26 - 0.14 * sm(cx - sw, cx + sw, x) + 0.06 * sm(120, 160, y);
      }
      if (neck) l = 0.66 - 0.34 * sm(cx - 13, cx + 13, x);
      if (head < 1) {
        l = 0.88 - 0.5 * sm(cx - 26, cx + 26, x) - 0.06 * sm(50, 100, y);
        l -= 0.18 * sm(0.3, 1, ell(x, y, cx + 13, 76, 18, 22) < 1 ? 0.6 : 0);
        l -= 0.25 * sm(0.82, 1, head);
      }
      const hair = ell(x, y, cx, 62, 28, 35) < 1 && y < 52 + Math.abs(x - cx) * 0.55;
      if (hair) l = 0.1 + 0.12 * sm(cx - 26, cx + 18, x);
      return Math.max(0.03, Math.min(0.97, l));
    }

    const res: { x: string; y: string; r: string }[] = [];
    for (let y = st / 2, row = 0; y < Hp; y += st, row++) {
      for (let x = st / 2 + (row % 2 ? st / 2 : 0); x < Wp; x += st) {
        const r = (1 - lum(x, y)) * st * 0.6;
        if (r > 0.3) {
          res.push({ x: x.toFixed(1), y: y.toFixed(1), r: r.toFixed(2) });
        }
      }
    }
    return res;
  }, [seed]);

  return (
    <svg width={width} height={height} viewBox="0 0 140 160" style={{ display: 'block' }}>
      {circles.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={ink} />
      ))}
    </svg>
  );
};

// Assistant manager Theo Vance contextual advice
function getTheoTransferQuote(player: Player, userClub: Club, askingPrice: number): string {
  const userBudget = userClub.transferBudget;
  const primPos = player.positions[0]?.pos ?? 'CM';
  if (askingPrice > userBudget) {
    return `"He's got real quality, boss, but they'll ask for more than we have in the kitty. Unless we balance the books with a sale first, we'll hit a wall."`;
  }
  if (player.personality === 'Ambitious' && player.clubId) {
    return `"Top player with ambition. He'll want assurances about playing time and our league trajectory before he puts pen to paper."`;
  }
  if (player.personality === 'Loyal' && player.clubId) {
    return `"He's deeply settled where he is. We'll need a serious pitch and competitive terms to turn his head away from his current club."`;
  }
  if (!player.clubId) {
    return `"Available on a free. Low risk on the fee side, so it comes down to whether his wage demands fit our structure."`;
  }
  return `"Good fit for what we need at ${primPos}. If we put a fair bid on the table early, we could get him through the door without a bidding war."`;
}

export const TransfersScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const scoutPlayer = useStore((state) => state.scoutPlayer);
  const toggleShortlist = useStore((state) => state.toggleShortlist);
  const isShortlisted = useStore((state) => state.isShortlisted);
  const submitTransferBid = useStore((state) => state.submitTransferBid);
  const acceptCounterBid = useStore((state) => state.acceptCounterBid);
  const negotiateContract = useStore((state) => state.negotiateContract);
  const respondToIncomingBid = useStore((state) => state.respondToIncomingBid);
  const requestBoardWageIncrease = useStore((state) => state.requestBoardWageIncrease);
  const advanceGame = useStore((state) => state.advanceGame);

  const [activeFilter, setActiveFilter] = useState<
    'shortlist' | 'search' | 'position' | 'free' | 'offers'
  >('shortlist');
  const [posFilter, setPosFilter] = useState<'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(null);

  // Modal dialog states
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerFee, setOfferFee] = useState<number>(0);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
  const [contractWage, setContractWage] = useState<number>(0);
  const [contractYears, setContractYears] = useState<1 | 2 | 3 | 4>(3);
  const [contractRole, setContractRole] = useState<SquadRole>('Starter');
  const [counterFeeInput, setCounterFeeInput] = useState<number>(0);
  const [activeIncomingOfferId, setActiveIncomingOfferId] = useState<string | null>(null);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const isWindowOpen = gameState.phase === 'TransferWindow';
  const isDeadlineDay = gameState.window?.round === 3;
  const currentShortlist = gameState.shortlist ?? [];

  // Calculate current weekly payroll
  let currentPayroll = 0;
  for (const pId of userClub.squad) {
    const p = gameState.players[pId];
    if (p?.contract) currentPayroll += p.contract.wagePerWeek;
  }
  const weeklyWageRoom = Math.max(0, userClub.wageBudget - currentPayroll);

  // Filter pool of players
  const allOtherPlayers = Object.values(gameState.players).filter((p) => p.clubId !== userClub.id);

  const displayedPlayers = useMemo(() => {
    let list: Player[] = [];
    if (activeFilter === 'shortlist') {
      list = allOtherPlayers.filter((p) => currentShortlist.includes(p.id));
      if (list.length === 0) {
        // Fallback if shortlist is empty: show first few players
        list = allOtherPlayers.slice(0, 7);
      }
    } else if (activeFilter === 'free') {
      list = allOtherPlayers.filter((p) => p.clubId === null);
    } else if (activeFilter === 'position') {
      list = allOtherPlayers.filter((p) => {
        if (posFilter === 'ALL') return true;
        const prim = p.positions[0]?.pos;
        if (posFilter === 'GK') return prim === 'GK';
        if (posFilter === 'DEF') return prim && ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(prim);
        if (posFilter === 'MID') return prim && ['DM', 'CM', 'AM', 'LM', 'RM'].includes(prim);
        if (posFilter === 'ATT') return prim && ['CF', 'ST', 'LW', 'RW'].includes(prim);
        return true;
      });
    } else if (activeFilter === 'search') {
      list = allOtherPlayers.filter((p) => {
        if (!searchQuery.trim()) return true;
        const full = `${p.firstName} ${p.lastName}`.toLowerCase();
        return full.includes(searchQuery.toLowerCase());
      });
    } else {
      list = allOtherPlayers;
    }

    return list.sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));
  }, [allOtherPlayers, activeFilter, posFilter, searchQuery, currentShortlist]);

  // Selected player logic
  const selectedPlayer = useMemo(() => {
    if (selectedPlayerId && gameState.players[selectedPlayerId]) {
      return gameState.players[selectedPlayerId]!;
    }
    return displayedPlayers[0] ?? allOtherPlayers[0] ?? null;
  }, [selectedPlayerId, displayedPlayers, allOtherPlayers, gameState.players]);

  if (!selectedPlayer) return null;

  const playerClub = selectedPlayer.clubId ? gameState.clubs[selectedPlayer.clubId] : null;
  const isScouted = isPlayerScouted(selectedPlayer, userClub.id);
  const knowledgePct = getPlayerKnowledge(selectedPlayer, userClub.id);
  const ovrBand = getScoutedOvr(selectedPlayer, userClub.id);
  const potentialStars = getPotentialStars(selectedPlayer, userClub.id);
  const askingPrice = calculateAskingPrice(
    selectedPlayer,
    playerClub ?? null,
    userClub,
    isDeadlineDay,
    gameState.players,
  );
  const isTarget = isShortlisted(selectedPlayer.id);

  // User's starter in that primary position for comparison
  const primPos = selectedPlayer.positions[0]?.pos ?? 'CM';
  const userStarter = useMemo(() => {
    for (const slotId of userClub.tactics.lineup) {
      if (!slotId) continue;
      const p = gameState.players[slotId];
      if (p && p.positions.some((pos) => pos.pos === primPos)) {
        return p;
      }
    }
    // Fallback: first starter
    const firstId = userClub.tactics.lineup.find(Boolean);
    return firstId ? (gameState.players[firstId] ?? null) : null;
  }, [userClub.tactics.lineup, gameState.players, primPos]);

  // Startability verdict
  const starterOvr = userStarter ? getPrimaryOvr(userStarter) : 70;
  const playerOvr = getPrimaryOvr(selectedPlayer);
  let startVerdict = 'Rotational option';
  let startSub = `Similar level to ${userStarter?.lastName ?? 'current starter'} (${starterOvr})`;
  if (playerOvr > starterOvr + 2) {
    startVerdict = `Yes, at ${primPos}`;
    startSub = `Better than ${userStarter?.lastName ?? 'current starter'} now (${starterOvr})`;
  } else if (playerOvr < starterOvr - 2) {
    startVerdict = 'Depth / Backup';
    startSub = `Behind ${userStarter?.lastName ?? 'current starter'} (${starterOvr})`;
  }

  // Willingness verdict
  let willComeVerdict = 'Likely';
  let willComeSub = 'Our division standing matches his ambition';
  if (playerClub) {
    if (userClub.reputation < playerClub.reputation - 1) {
      willComeVerdict = 'Unlikely';
      willComeSub = 'Reluctant to take a step down in club stature';
    } else if (
      selectedPlayer.personality === 'Ambitious' &&
      userClub.reputation < playerClub.reputation
    ) {
      willComeVerdict = 'Difficult';
      willComeSub = 'Ambitious: seeks higher reputation platform';
    } else if (selectedPlayer.personality === 'Loyal') {
      willComeVerdict = 'Torn';
      willComeSub = `Loyal to ${playerClub.name}; will take persuasion`;
    }
  }

  // Scout capacity status
  const scoutCheck = canScoutPlayer(gameState, selectedPlayer.id);
  const isScoutQueued =
    gameState.window?.scoutingQueue?.includes(selectedPlayer.id) ||
    gameState.scoutedThisMatchday?.includes(selectedPlayer.id);

  // Open Offer Dialog
  const handleOpenOffer = () => {
    setOfferFee(valueOf(selectedPlayer));
    setIsOfferModalOpen(true);
  };

  // Submit Bid
  const handleSubmitBid = () => {
    const res = submitTransferBid(selectedPlayer.id, offerFee);
    setIsOfferModalOpen(false);
    if (res.status === 'Accepted') {
      // Find created offer
      const activeOffer = gameState.window?.offers.find(
        (o) => o.playerId === selectedPlayer.id && o.status === 'Accepted',
      );
      if (activeOffer) {
        setActiveOfferId(activeOffer.id);
        setContractWage(wageFor(valueOf(selectedPlayer)));
        setIsContractModalOpen(true);
      }
    }
  };

  // Submit Contract
  const handleSubmitContract = () => {
    if (!activeOfferId) return;
    const res = negotiateContract(activeOfferId, {
      wagePerWeek: contractWage,
      years: contractYears,
      role: contractRole,
    });
    if (res.success) {
      setIsContractModalOpen(false);
      setActiveOfferId(null);
    }
  };

  // Comparison attribute keys
  const compAttrs: { label: string; key: AttributeKey }[] = [
    { label: 'Pace', key: 'pace' },
    { label: 'Dribbling', key: 'dribbling' },
    {
      label: primPos === 'CB' || primPos === 'LB' || primPos === 'RB' ? 'Tackling' : 'Finishing',
      key: primPos === 'CB' || primPos === 'LB' || primPos === 'RB' ? 'tackling' : 'finishing',
    },
    { label: 'Decisions', key: 'decisions' },
    { label: 'Work rate', key: 'workRate' },
    { label: 'Stamina', key: 'stamina' },
  ];

  // Active offers in window
  const windowOffers = gameState.window?.offers ?? [];
  const incomingBids = windowOffers.filter(
    (o) => o.toClubId !== userClub.id && o.fromClubId === userClub.id,
  );
  const outgoingBids = windowOffers.filter((o) => o.toClubId === userClub.id);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0908',
        backgroundImage:
          'radial-gradient(ellipse at 30% 40%, #1d1915 0%, #100E0C 60%, #0a0908 100%)',
        color: '#F2F4F7',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '480px minmax(560px, 1fr) 340px',
          gap: 22,
          padding: '16px 22px',
          height: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* ======================================================== */}
        {/* LEFT COLUMN: Wooden Card Index Drawer */}
        {/* ======================================================== */}
        <div
          style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, color: '#F2F4F7' }}>
            <h1
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 800,
                fontSize: 36,
                lineHeight: 1,
                letterSpacing: '0.005em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Scouting
            </h1>
            <small
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 600,
                fontSize: 13,
                lineHeight: 1,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
              }}
            >
              {activeFilter === 'shortlist'
                ? `Shortlist · ${displayedPlayers.length} players`
                : activeFilter === 'offers'
                  ? `Offers · ${windowOffers.length} deals`
                  : `Target Pool · ${displayedPlayers.length} players`}
            </small>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
            <span
              onClick={() => setActiveFilter('shortlist')}
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '6px 10px',
                cursor: 'pointer',
                background: activeFilter === 'shortlist' ? '#F4F1EA' : 'rgba(255,255,255,0.06)',
                color: activeFilter === 'shortlist' ? '#0a0d12' : '#A3ACBA',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              Shortlist
            </span>
            <span
              onClick={() => setActiveFilter('search')}
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '6px 10px',
                cursor: 'pointer',
                background: activeFilter === 'search' ? '#F4F1EA' : 'rgba(255,255,255,0.06)',
                color: activeFilter === 'search' ? '#0a0d12' : '#A3ACBA',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              Search
            </span>
            <span
              onClick={() => setActiveFilter('position')}
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '6px 10px',
                cursor: 'pointer',
                background: activeFilter === 'position' ? '#F4F1EA' : 'rgba(255,255,255,0.06)',
                color: activeFilter === 'position' ? '#0a0d12' : '#A3ACBA',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              By Position
            </span>
            <span
              onClick={() => setActiveFilter('free')}
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '6px 10px',
                cursor: 'pointer',
                background: activeFilter === 'free' ? '#F4F1EA' : 'rgba(255,255,255,0.06)',
                color: activeFilter === 'free' ? '#0a0d12' : '#A3ACBA',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              Free Agents
            </span>
            {isWindowOpen && (
              <span
                onClick={() => setActiveFilter('offers')}
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  background: activeFilter === 'offers' ? '#F2B705' : 'rgba(242,183,5,0.15)',
                  color: activeFilter === 'offers' ? '#141000' : '#F2B705',
                  border: '1px solid rgba(242,183,5,0.3)',
                }}
              >
                Offers ({windowOffers.length})
              </span>
            )}
          </div>

          {/* Search bar or Position Selector when active */}
          {activeFilter === 'search' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '6px 10px',
                marginTop: 8,
              }}
            >
              <Search size={14} color="#A3ACBA" />
              <input
                type="text"
                placeholder="Type player name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#FFF',
                  fontSize: 13,
                  width: '100%',
                }}
              />
            </div>
          )}

          {activeFilter === 'position' && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {(['ALL', 'GK', 'DEF', 'MID', 'ATT'] as const).map((p) => (
                <span
                  key={p}
                  onClick={() => setPosFilter(p)}
                  style={{
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    background: posFilter === p ? '#F2B705' : 'rgba(255,255,255,0.05)',
                    color: posFilter === p ? '#141000' : '#A3ACBA',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Wooden Card Index Box */}
          <div
            style={{
              position: 'relative',
              marginTop: 12,
              flex: 1,
              background: 'linear-gradient(#3a2a1a, #24180e)',
              borderRadius: 4,
              padding: '18px 14px 10px',
              boxShadow: 'inset 0 8px 18px rgba(0,0,0,0.6), 0 18px 36px rgba(0,0,0,0.5)',
              overflowY: 'auto',
            }}
          >
            {activeFilter === 'offers' ? (
              // Offers Drawer
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {windowOffers.length === 0 ? (
                  <div style={{ color: '#A3ACBA', textAlign: 'center', padding: 30, fontSize: 13 }}>
                    No transfer offers filed in this window.
                  </div>
                ) : (
                  windowOffers.map((o) => {
                    const op = gameState.players[o.playerId];
                    const toC = gameState.clubs[o.toClubId];
                    const fromC = o.fromClubId ? gameState.clubs[o.fromClubId] : null;
                    const isIncoming = o.fromClubId === userClub.id;

                    return (
                      <div
                        key={o.id}
                        style={{
                          background: '#FBF8F1',
                          color: '#1B1A17',
                          padding: '10px 14px',
                          borderRadius: 3,
                          borderLeft: `4px solid ${isIncoming ? '#F2B705' : '#1F4FBF'}`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                          }}
                        >
                          <b
                            style={{
                              fontFamily: 'Barlow Condensed',
                              fontWeight: 700,
                              fontSize: 18,
                            }}
                          >
                            {op?.knownAs ?? `${op?.firstName} ${op?.lastName}`}
                          </b>
                          <span
                            style={{
                              fontFamily: 'Barlow Condensed',
                              fontWeight: 800,
                              fontSize: 16,
                              color:
                                o.status === 'Accepted'
                                  ? '#1E7B3C'
                                  : o.status === 'Countered'
                                    ? '#C98A12'
                                    : '#C42B2B',
                            }}
                          >
                            {o.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#5E574E', marginTop: 2 }}>
                          {isIncoming
                            ? `Bid from ${toC?.name ?? 'Club'} · ${formatMoney(o.fee)}`
                            : `Bid to ${fromC?.name ?? 'Free Agent'} · ${formatMoney(o.fee)}`}
                        </div>
                        {isIncoming && o.status === 'Pending' && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button
                              onClick={() => respondToIncomingBid(o.id, 'Accept')}
                              style={{
                                background: '#1E7B3C',
                                color: '#FFF',
                                border: 'none',
                                padding: '4px 8px',
                                fontFamily: 'Barlow Condensed',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              Accept {formatMoney(o.fee)}
                            </button>
                            <button
                              onClick={() => {
                                const counterVal = Math.round(o.fee * 1.15);
                                respondToIncomingBid(o.id, 'Counter', counterVal);
                              }}
                              style={{
                                background: '#C98A12',
                                color: '#FFF',
                                border: 'none',
                                padding: '4px 8px',
                                fontFamily: 'Barlow Condensed',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              Counter
                            </button>
                            <button
                              onClick={() => respondToIncomingBid(o.id, 'Reject')}
                              style={{
                                background: '#C42B2B',
                                color: '#FFF',
                                border: 'none',
                                padding: '4px 8px',
                                fontFamily: 'Barlow Condensed',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {!isIncoming && o.status === 'Countered' && (
                          <div style={{ marginTop: 8 }}>
                            <button
                              onClick={() => acceptCounterBid(o.id)}
                              style={{
                                background: '#1E7B3C',
                                color: '#FFF',
                                border: 'none',
                                padding: '4px 8px',
                                fontFamily: 'Barlow Condensed',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              Accept Counter ({formatMoney(o.counterFee ?? o.fee)})
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              // Cards Stack
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {displayedPlayers.map((p, idx) => {
                  const pClub = p.clubId ? gameState.clubs[p.clubId] : null;
                  const isSel = p.id === selectedPlayer.id;
                  const pos = p.positions[0]?.pos ?? 'CM';
                  const tabLabel = `${pos} · ${pClub ? pClub.code : 'FREE'}`;
                  const pBand = getScoutedOvr(p, userClub.id);
                  const pKnowledge = getPlayerKnowledge(p, userClub.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlayerId(p.id)}
                      style={{
                        position: 'relative',
                        background: isSel ? '#FFFFFF' : '#FBF8F1',
                        color: '#1B1A17',
                        padding: '10px 14px',
                        borderRadius: '3px 3px 0 0',
                        boxShadow: '0 -1px 0 rgba(0,0,0,0.15), 0 -6px 10px rgba(0,0,0,0.18)',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '2px 10px',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, background 0.15s ease',
                        transform: isSel ? 'translateX(14px)' : 'none',
                        outline: isSel ? '3px solid #1F4FBF' : 'none',
                        zIndex: isSel ? 3 : 1,
                      }}
                    >
                      {/* Top Tab */}
                      <span
                        style={{
                          position: 'absolute',
                          top: -13,
                          left: 14 + (idx % 4) * 58,
                          fontFamily: 'Barlow Condensed, sans-serif',
                          fontWeight: 700,
                          fontSize: 10.5,
                          lineHeight: 1,
                          letterSpacing: '0.12em',
                          padding: '4px 7px 3px',
                          borderRadius: '3px 3px 0 0',
                          background: isSel ? '#FFFFFF' : '#E9DFC6',
                          color: '#5B4A2A',
                          borderTop: isSel ? '2px solid #1F4FBF' : 'none',
                        }}
                      >
                        {tabLabel}
                      </span>

                      <div>
                        <b
                          style={{
                            fontFamily: 'Barlow Condensed, sans-serif',
                            fontWeight: 700,
                            fontSize: 20,
                            lineHeight: 1,
                            textTransform: 'uppercase',
                          }}
                        >
                          {p.knownAs ?? `${p.firstName} ${p.lastName}`}
                        </b>
                        <small
                          style={{
                            display: 'block',
                            fontFamily: 'Barlow Condensed, sans-serif',
                            fontWeight: 600,
                            fontSize: 11,
                            lineHeight: 1,
                            letterSpacing: '0.08em',
                            color: '#5E574E',
                            textTransform: 'uppercase',
                            marginTop: 3,
                          }}
                        >
                          {pClub ? pClub.name : 'Free Agent'} · {p.age}
                        </small>
                      </div>

                      {/* OVR / Band */}
                      <div
                        style={{
                          gridRow: '1 / 3',
                          gridColumn: 2,
                          textAlign: 'right',
                          fontFamily: 'Barlow Condensed, sans-serif',
                          fontWeight: 800,
                          fontSize: 24,
                          lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {pBand.isExact ? pBand.low : `${pBand.low}–${pBand.high}`}
                        <span
                          style={{
                            display: 'block',
                            fontFamily: 'Barlow Condensed',
                            fontWeight: 600,
                            fontSize: 10,
                            letterSpacing: '0.1em',
                            color: '#5E574E',
                          }}
                        >
                          OVR
                        </span>
                      </div>

                      {/* Knowledge Bar */}
                      <div
                        style={{
                          gridColumn: '1 / -1',
                          height: 4,
                          background: '#E6DFD0',
                          marginTop: 4,
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pKnowledge}%`,
                            background: '#1E7B3C',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* MIDDLE COLUMN: Scout's Report Sheet */}
        {/* ======================================================== */}
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <div
            style={{
              position: 'relative',
              height: '100%',
              background: '#EFEBE3',
              color: '#1B1A17',
              padding: '22px 26px',
              boxShadow: '0 1px 0 rgba(0,0,0,0.25), 0 18px 36px rgba(0,0,0,0.5)',
              transform: 'rotate(-0.3deg)',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            {/* Letterhead */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '3px double #1B1A17',
                paddingBottom: 8,
              }}
            >
              <div
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontWeight: 900,
                  fontSize: 26,
                  lineHeight: 1,
                }}
              >
                Scout's report
              </div>
              <div
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 600,
                  fontSize: 11.5,
                  lineHeight: 1.3,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#5E574E',
                  textAlign: 'right',
                }}
              >
                {userClub.name} · Head of Scouting
                <br />
                File No. 0{selectedPlayer.id} · Matchday {gameState.matchday}
              </div>
            </div>

            {/* Player Bio Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr auto',
                gap: 20,
                marginTop: 16,
                paddingBottom: 14,
                borderBottom: '2px solid #1B1A17',
                alignItems: 'start',
              }}
            >
              {/* Halftone Portrait */}
              <div
                style={{
                  width: 140,
                  height: 160,
                  background: '#EFE3BD',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <HalftonePortrait
                  seed={parseInt(selectedPlayer.id.replace(/\D/g, '') || '1', 10)}
                />
              </div>

              {/* Bio Details */}
              <div>
                <h2
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 800,
                    fontSize: 42,
                    lineHeight: 0.9,
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  {selectedPlayer.knownAs ??
                    `${selectedPlayer.firstName} ${selectedPlayer.lastName}`}
                </h2>
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: '#5E574E',
                    marginTop: 6,
                  }}
                >
                  <b>{selectedPlayer.age}</b> · {selectedPlayer.nationality} ·{' '}
                  <b>{selectedPlayer.foot} foot</b> · {(selectedPlayer.heightCm / 100).toFixed(2)}m
                  · {selectedPlayer.personality}
                  <br />
                  {playerClub ? playerClub.name : 'Free Agent'} ·{' '}
                  {selectedPlayer.positions.map((p) => p.pos).join(' / ')} ·{' '}
                  <b>{selectedPlayer.stats.goals} goals</b> ({selectedPlayer.stats.apps} apps) ·
                  contract {selectedPlayer.contract?.yearsLeft ?? 0} years
                </div>

                {/* Chips */}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 700,
                      fontSize: 10.5,
                      letterSpacing: '0.12em',
                      padding: '3px 6px 2px',
                      textTransform: 'uppercase',
                      background: '#1B1A17',
                      color: '#EFEBE3',
                    }}
                  >
                    {primPos} 100
                  </span>
                  {selectedPlayer.positions.slice(1).map((pos) => (
                    <span
                      key={pos.pos}
                      style={{
                        fontFamily: 'Barlow Condensed',
                        fontWeight: 700,
                        fontSize: 10.5,
                        letterSpacing: '0.12em',
                        padding: '3px 6px 2px',
                        textTransform: 'uppercase',
                        border: '1.5px solid #1B1A17',
                      }}
                    >
                      {pos.pos} {pos.familiarity}
                    </span>
                  ))}
                  {knowledgePct >= 50 ? (
                    (selectedPlayer.traits ?? []).map((t: string) => (
                      <span
                        key={t}
                        style={{
                          fontFamily: 'Barlow Condensed',
                          fontWeight: 700,
                          fontSize: 10.5,
                          letterSpacing: '0.12em',
                          padding: '3px 6px 2px',
                          textTransform: 'uppercase',
                          border: '1.5px solid #1F4FBF',
                          color: '#1F4FBF',
                        }}
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span
                      style={{
                        fontFamily: 'Barlow Condensed',
                        fontWeight: 600,
                        fontSize: 10.5,
                        letterSpacing: '0.1em',
                        padding: '3px 6px 2px',
                        textTransform: 'uppercase',
                        border: '1px dashed #5E574E',
                        color: '#5E574E',
                      }}
                    >
                      Traits Unscouted
                    </span>
                  )}
                </div>
              </div>

              {/* OVR & Knowledge */}
              <div style={{ textAlign: 'right' }}>
                <b
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 800,
                    fontSize: 54,
                    lineHeight: 0.85,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {ovrBand.isExact ? ovrBand.low : `${ovrBand.low}–${ovrBand.high}`}
                </b>
                <span
                  style={{
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    color: '#5E574E',
                  }}
                >
                  OVR AT {primPos}
                </span>
                <span
                  style={{
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 13,
                    color: '#C98A12',
                    letterSpacing: '0.06em',
                    display: 'block',
                    marginTop: 4,
                  }}
                >
                  KNOWLEDGE {knowledgePct}%
                </span>
                {potentialStars && (
                  <span style={{ color: '#F2B705', fontSize: 13, display: 'block', marginTop: 2 }}>
                    {'★'.repeat(potentialStars) + '☆'.repeat(5 - potentialStars)}
                  </span>
                )}
              </div>
            </div>

            {/* Attributes Grid */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 14 }}
            >
              {/* Technical */}
              <div>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 11.5,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                    marginBottom: 6,
                  }}
                >
                  Technical
                </div>
                {(
                  [
                    ['Pace', 'pace'],
                    ['Dribbling', 'dribbling'],
                    ['Finishing', 'finishing'],
                    ['Long shots', 'longShots'],
                    ['First touch', 'firstTouch'],
                    ['Crossing', 'crossing'],
                  ] as const
                ).map(([label, key]) => {
                  const band = getScoutedAttribute(
                    selectedPlayer,
                    key as AttributeKey,
                    userClub.id,
                  );
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 1fr 50px',
                        alignItems: 'center',
                        gap: 10,
                        height: 24,
                        fontSize: 12.5,
                      }}
                    >
                      <span>{label}</span>
                      <span
                        style={{
                          position: 'relative',
                          height: 7,
                          background: '#E6DFD0',
                          display: 'block',
                        }}
                      >
                        <u
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: `${band.low}%`,
                            background: '#1E2A38',
                            display: 'block',
                          }}
                        />
                        {!band.isExact && (
                          <i
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: `${band.low}%`,
                              width: `${band.high - band.low}%`,
                              background:
                                'repeating-linear-gradient(90deg, #9aa6b2 0 4px, #b9c3cc 4px 8px)',
                              display: 'block',
                            }}
                          />
                        )}
                      </span>
                      <b
                        style={{
                          fontFamily: 'Barlow Condensed',
                          fontWeight: 700,
                          fontSize: 14,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {band.isExact ? band.low : `${band.low}–${band.high}`}
                      </b>
                    </div>
                  );
                })}
              </div>

              {/* Mental & Physical */}
              <div>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 11.5,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                    marginBottom: 6,
                  }}
                >
                  Mental · Physical
                </div>
                {(
                  [
                    ['Decisions', 'decisions'],
                    ['Off the ball', 'offTheBall'],
                    ['Composure', 'composure'],
                    ['Work rate', 'workRate'],
                    ['Stamina', 'stamina'],
                    ['Strength', 'strength'],
                  ] as const
                ).map(([label, key]) => {
                  const band = getScoutedAttribute(
                    selectedPlayer,
                    key as AttributeKey,
                    userClub.id,
                  );
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 1fr 50px',
                        alignItems: 'center',
                        gap: 10,
                        height: 24,
                        fontSize: 12.5,
                      }}
                    >
                      <span>{label}</span>
                      <span
                        style={{
                          position: 'relative',
                          height: 7,
                          background: '#E6DFD0',
                          display: 'block',
                        }}
                      >
                        <u
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: `${band.low}%`,
                            background: '#1E2A38',
                            display: 'block',
                          }}
                        />
                        {!band.isExact && (
                          <i
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: `${band.low}%`,
                              width: `${band.high - band.low}%`,
                              background:
                                'repeating-linear-gradient(90deg, #9aa6b2 0 4px, #b9c3cc 4px 8px)',
                              display: 'block',
                            }}
                          />
                        )}
                      </span>
                      <b
                        style={{
                          fontFamily: 'Barlow Condensed',
                          fontWeight: 700,
                          fontSize: 14,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {band.isExact ? band.low : `${band.low}–${band.high}`}
                      </b>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Verdict Box */}
            <div
              style={{
                marginTop: 14,
                border: '2px solid #1B1A17',
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 14,
              }}
            >
              <div>
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 10.5,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                  }}
                >
                  Would he start?
                </span>
                <b
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 800,
                    fontSize: 20,
                    lineHeight: 1.05,
                    marginTop: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  {startVerdict}
                </b>
                <small
                  style={{
                    display: 'block',
                    fontFamily: 'Inter',
                    fontWeight: 500,
                    fontSize: 11.5,
                    lineHeight: 1.3,
                    color: '#5E574E',
                    marginTop: 3,
                  }}
                >
                  {startSub}
                </small>
              </div>

              <div>
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 10.5,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                  }}
                >
                  Asking price (estimate)
                </span>
                <b
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 800,
                    fontSize: 20,
                    lineHeight: 1.05,
                    marginTop: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  {playerClub
                    ? isScouted
                      ? formatMoney(askingPrice)
                      : `${formatMoney(Math.round(askingPrice * 0.85))}–${formatMoney(Math.round(askingPrice * 1.15))}`
                    : 'Free Agent'}
                </b>
                <small
                  style={{
                    display: 'block',
                    fontFamily: 'Inter',
                    fontWeight: 500,
                    fontSize: 11.5,
                    lineHeight: 1.3,
                    color: '#5E574E',
                    marginTop: 3,
                  }}
                >
                  {playerClub ? `${playerClub.name} valuation` : 'No transfer fee required'}
                </small>
              </div>

              <div>
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 10.5,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                  }}
                >
                  Would he come?
                </span>
                <b
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 800,
                    fontSize: 20,
                    lineHeight: 1.05,
                    marginTop: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  {willComeVerdict}
                </b>
                <small
                  style={{
                    display: 'block',
                    fontFamily: 'Inter',
                    fontWeight: 500,
                    fontSize: 11.5,
                    lineHeight: 1.3,
                    color: '#5E574E',
                    marginTop: 3,
                  }}
                >
                  {willComeSub}
                </small>
              </div>
            </div>

            {/* Scout's Note */}
            <div
              style={{
                marginTop: 12,
                fontFamily: 'Source Serif 4, Georgia, serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 14,
                lineHeight: 1.45,
                borderLeft: '4px solid #1B1A17',
                padding: '3px 0 3px 12px',
              }}
            >
              <b
                style={{
                  fontStyle: 'normal',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 10.5,
                  letterSpacing: '0.14em',
                  display: 'block',
                  color: '#5E574E',
                  marginBottom: 3,
                  textTransform: 'uppercase',
                }}
              >
                Scout's note
              </b>
              "{composeScoutNote(selectedPlayer, knowledgePct)}"
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 14,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={handleOpenOffer}
                disabled={!isWindowOpen}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isWindowOpen ? '#1B1A17' : '#9E988F',
                  color: '#EFEBE3',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '9px 14px',
                  border: 'none',
                  cursor: isWindowOpen ? 'pointer' : 'not-allowed',
                }}
              >
                Make an offer
              </button>

              <button
                onClick={() => scoutPlayer(selectedPlayer.id)}
                disabled={isScouted || isScoutQueued || !scoutCheck.allowed}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'transparent',
                  color: '#1B1A17',
                  border: '2px solid #1B1A17',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '7px 12px',
                  cursor: isScouted || isScoutQueued ? 'default' : 'pointer',
                  opacity: isScouted || isScoutQueued ? 0.6 : 1,
                }}
              >
                {isScouted
                  ? 'Fully scouted'
                  : isScoutQueued
                    ? 'Scout dispatched'
                    : 'Scout him fully'}
              </button>

              <button
                onClick={() => toggleShortlist(selectedPlayer.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'transparent',
                  color: isTarget ? '#C42B2B' : '#1B1A17',
                  border: `2px solid ${isTarget ? '#C42B2B' : '#1B1A17'}`,
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '7px 12px',
                  cursor: 'pointer',
                }}
              >
                {isTarget ? 'Remove from shortlist' : 'Add to shortlist'}
              </button>

              {!isWindowOpen && (
                <span
                  style={{ fontFamily: 'Inter', fontSize: 12, color: '#5E574E', marginLeft: 4 }}
                >
                  Offers open with the window, after Matchday 9.
                </span>
              )}
            </div>

            {/* Him against your [Position] */}
            <div
              style={{
                marginTop: 16,
                borderTop: '2px solid #1B1A17',
                paddingTop: 10,
                width: '75%',
              }}
            >
              <div
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 11.5,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#5E574E',
                  marginBottom: 6,
                }}
              >
                Him against your {primPos}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 1fr 1fr',
                  gap: 10,
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 11.5,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  margin: '4px 0',
                }}
              >
                <span />
                <span style={{ color: '#1F4FBF' }}>{selectedPlayer.lastName} (target)</span>
                <span style={{ color: '#0B1F3A' }}>
                  {userStarter?.lastName ?? 'Yours'} (starter)
                </span>
              </div>

              {compAttrs.map(({ label, key }) => {
                const pVal = selectedPlayer.attributes[key] ?? 50;
                const sVal = userStarter?.attributes[key] ?? 50;

                return (
                  <div
                    key={key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr 1fr',
                      gap: 10,
                      alignItems: 'center',
                      height: 24,
                      fontSize: 12.5,
                    }}
                  >
                    <span>{label}</span>
                    <div
                      style={{
                        height: 7,
                        background: '#E6DFD0',
                        position: 'relative',
                        marginRight: 30,
                      }}
                    >
                      <i
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          width: `${pVal}%`,
                          background: '#1F4FBF',
                          display: 'block',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          right: -24,
                          top: -4,
                          fontFamily: 'Barlow Condensed',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {pVal}
                      </span>
                    </div>

                    <div
                      style={{
                        height: 7,
                        background: '#E6DFD0',
                        position: 'relative',
                        marginRight: 30,
                      }}
                    >
                      <i
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          width: `${sVal}%`,
                          background: '#0B1F3A',
                          display: 'block',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          right: -24,
                          top: -4,
                          fontFamily: 'Barlow Condensed',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {sVal}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* TARGET Stamp */}
            {isTarget && (
              <div
                style={{
                  position: 'absolute',
                  right: 40,
                  bottom: 30,
                  transform: 'rotate(-10deg)',
                  fontSize: 26,
                  padding: '8px 14px 6px',
                  border: '3.5px solid #C42B2B',
                  color: '#C42B2B',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  pointerEvents: 'none',
                  zIndex: 4,
                }}
              >
                TARGET
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT RAIL: Window status, Budgets, Scouts, Theo */}
        {/* ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          {/* Transfer Window Panel */}
          <div
            style={{
              background: 'rgba(12, 16, 22, 0.86)',
              border: '1px solid #2A313D',
              padding: '14px 16px',
              borderLeft: '4px solid #F2B705',
            }}
          >
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 11.5,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
              }}
            >
              Transfer Window
            </div>
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 800,
                fontSize: 28,
                lineHeight: 1,
                marginTop: 6,
              }}
            >
              {isWindowOpen
                ? isDeadlineDay
                  ? 'Deadline Day'
                  : `Day ${gameState.window?.round} of 3`
                : 'Closed'}{' '}
              <small
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#A3ACBA',
                  letterSpacing: '0.06em',
                  marginLeft: 4,
                }}
              >
                {isWindowOpen ? 'open now' : 'opens after MD9'}
              </small>
            </div>
            <p
              style={{
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: 12.5,
                lineHeight: 1.4,
                color: '#CFD5DE',
                marginTop: 6,
              }}
            >
              {isWindowOpen
                ? 'Three-day registration window. Place transfer bids, agree personal terms, and handle incoming proposals.'
                : 'Three days: Day 1, Day 2, Deadline Day. You can scout targets and plan now, and bid when it opens.'}
            </p>

            {isWindowOpen && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={() => advanceGame()}
                  style={{
                    background: '#F2B705',
                    color: '#141000',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '8px 12px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Advance Window Day
                </button>

                {!gameState.window?.boardWageRequestUsed && (
                  <button
                    onClick={() => requestBoardWageIncrease()}
                    style={{
                      background: 'transparent',
                      color: '#F2B705',
                      border: '1px solid #F2B705',
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 700,
                      fontSize: 12,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '5px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    Request +10% Wage Budget
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Budget Panel */}
          <div
            style={{
              background: 'rgba(12, 16, 22, 0.86)',
              border: '1px solid #2A313D',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 11.5,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
              }}
            >
              Club Budget
            </div>
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 800,
                fontSize: 30,
                lineHeight: 1,
                marginTop: 6,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatMoney(userClub.transferBudget)}{' '}
              <small
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#A3ACBA',
                  letterSpacing: '0.06em',
                }}
              >
                transfer
              </small>
            </div>
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 800,
                fontSize: 22,
                lineHeight: 1,
                marginTop: 6,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatMoney(weeklyWageRoom)}{' '}
              <small
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#A3ACBA',
                  letterSpacing: '0.06em',
                }}
              >
                / week wage room
              </small>
            </div>
            <div style={{ fontSize: 12, color: '#A3ACBA', marginTop: 6 }}>
              Squad Size: <b>{userClub.squad.length}/26</b> players
            </div>
          </div>

          {/* Your Scouts This Round */}
          <div
            style={{
              background: 'rgba(12, 16, 22, 0.86)',
              border: '1px solid #2A313D',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 11.5,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
                marginBottom: 6,
              }}
            >
              Your Scouts This Round
            </div>

            {/* Assignment 1 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12.5,
              }}
            >
              <b
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Fernandez
              </b>
              <span>{isScoutQueued ? 'Dossier compiling' : 'Watching regional division'}</span>
            </div>

            {/* Assignment 2 / Free slot */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12.5,
              }}
            >
              <b
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Free Slot
              </b>
              <span
                onClick={() => {
                  if (!isScouted && !isScoutQueued) scoutPlayer(selectedPlayer.id);
                }}
                style={{
                  color: isScouted || isScoutQueued ? '#A3ACBA' : '#F2B705',
                  cursor: isScouted || isScoutQueued ? 'default' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {isScouted || isScoutQueued ? 'Slot open' : 'Dispatch on target'}
              </span>
            </div>

            <div style={{ marginTop: 8, fontSize: 11.5, color: '#A3ACBA' }}>
              Head of Scouting ★★★: knowledge +15% per evaluation
            </div>
          </div>

          {/* Theo Vance Advice */}
          <div
            style={{
              background: 'rgba(12, 16, 22, 0.86)',
              border: '1px solid #2A313D',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 700,
                fontSize: 11.5,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
              }}
            >
              Theo Vance says
            </div>
            <p
              style={{
                fontFamily: 'Inter',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 12.5,
                lineHeight: 1.45,
                color: '#CFD5DE',
                marginTop: 6,
              }}
            >
              {getTheoTransferQuote(selectedPlayer, userClub, askingPrice)}
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: MAKE AN OFFER */}
      {/* ======================================================== */}
      {isOfferModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: 520,
              background: '#FBF8F1',
              color: '#1B1A17',
              borderRadius: 4,
              boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
              padding: 24,
            }}
          >
            <div style={{ borderBottom: '2px solid #1B1A17', paddingBottom: 10 }}>
              <div
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 800,
                  fontSize: 26,
                  textTransform: 'uppercase',
                }}
              >
                Submit Transfer Bid
              </div>
              <div style={{ fontSize: 13, color: '#5E574E', marginTop: 2 }}>
                {selectedPlayer.firstName} {selectedPlayer.lastName} ·{' '}
                {playerClub ? playerClub.name : 'Free Agent'}
              </div>
            </div>

            <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#5E574E' }}>Estimated Market Value:</span>
                <b>{formatMoney(valueOf(selectedPlayer))}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#5E574E' }}>Available Transfer Budget:</span>
                <b>{formatMoney(userClub.transferBudget)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#5E574E' }}>Asking Price Guide:</span>
                <b style={{ color: isScouted ? '#1E7B3C' : '#C98A12' }}>
                  {isScouted ? formatMoney(askingPrice) : 'Unscouted estimate (moderate)'}
                </b>
              </div>

              {/* Fee Stepper */}
              <div style={{ marginTop: 10 }}>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                    marginBottom: 6,
                  }}
                >
                  Proposed Transfer Fee
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() =>
                      setOfferFee((prev) =>
                        Math.max(
                          0,
                          prev - Math.max(50_000, Math.round(valueOf(selectedPlayer) * 0.05)),
                        ),
                      )
                    }
                    style={{
                      background: '#1B1A17',
                      color: '#FFF',
                      border: 'none',
                      padding: '8px 14px',
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: 'pointer',
                    }}
                  >
                    −5%
                  </button>

                  <div
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 800,
                      fontSize: 28,
                      background: '#FFF',
                      border: '2px solid #1B1A17',
                      padding: '4px 10px',
                    }}
                  >
                    {formatMoney(offerFee)}
                  </div>

                  <button
                    onClick={() =>
                      setOfferFee((prev) =>
                        Math.min(
                          userClub.transferBudget,
                          prev + Math.max(50_000, Math.round(valueOf(selectedPlayer) * 0.05)),
                        ),
                      )
                    }
                    style={{
                      background: '#1B1A17',
                      color: '#FFF',
                      border: 'none',
                      padding: '8px 14px',
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: 'pointer',
                    }}
                  >
                    +5%
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setIsOfferModalOpen(false)}
                style={{
                  background: 'transparent',
                  color: '#1B1A17',
                  border: '2px solid #1B1A17',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.08em',
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitBid}
                style={{
                  background: '#1B1A17',
                  color: '#EFEBE3',
                  border: 'none',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.08em',
                  padding: '8px 18px',
                  cursor: 'pointer',
                }}
              >
                Submit Official Bid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CONTRACT TERMS NEGOTIATION */}
      {/* ======================================================== */}
      {isContractModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: 540,
              background: '#FBF8F1',
              color: '#1B1A17',
              borderRadius: 4,
              boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
              padding: 24,
            }}
          >
            <div style={{ borderBottom: '2px solid #1B1A17', paddingBottom: 10 }}>
              <div
                style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 800,
                  fontSize: 26,
                  textTransform: 'uppercase',
                }}
              >
                Agree Personal Terms
              </div>
              <div style={{ fontSize: 13, color: '#1E7B3C', fontWeight: 600, marginTop: 2 }}>
                ✓ Club fee accepted! Offer contract terms to finalize registration.
              </div>
            </div>

            <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Wage */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                    marginBottom: 4,
                  }}
                >
                  Weekly Wage (Budget Room: {formatMoney(weeklyWageRoom)}/wk)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setContractWage((w) => Math.max(1_000, w - 1_000))}
                    style={{
                      background: '#1B1A17',
                      color: '#FFF',
                      border: 'none',
                      padding: '6px 12px',
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    −€1k
                  </button>
                  <div
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 800,
                      fontSize: 24,
                      background: '#FFF',
                      border: '2px solid #1B1A17',
                      padding: '4px 10px',
                    }}
                  >
                    {formatMoney(contractWage)} / wk
                  </div>
                  <button
                    onClick={() => setContractWage((w) => Math.min(weeklyWageRoom, w + 1_000))}
                    style={{
                      background: '#1B1A17',
                      color: '#FFF',
                      border: 'none',
                      padding: '6px 12px',
                      fontFamily: 'Barlow Condensed',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +€1k
                  </button>
                </div>
              </div>

              {/* Years */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                    marginBottom: 4,
                  }}
                >
                  Contract Length
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {([1, 2, 3, 4] as const).map((y) => (
                    <button
                      key={y}
                      onClick={() => setContractYears(y)}
                      style={{
                        background: contractYears === y ? '#1B1A17' : '#FFF',
                        color: contractYears === y ? '#FFF' : '#1B1A17',
                        border: '2px solid #1B1A17',
                        padding: '6px 0',
                        fontFamily: 'Barlow Condensed',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      {y} {y === 1 ? 'Year' : 'Years'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Squad Role */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                    marginBottom: 4,
                  }}
                >
                  Promised Squad Role
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {(['Star', 'Starter', 'Rotation', 'Backup'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setContractRole(r)}
                      style={{
                        background: contractRole === r ? '#1B1A17' : '#FFF',
                        color: contractRole === r ? '#FFF' : '#1B1A17',
                        border: '2px solid #1B1A17',
                        padding: '6px 0',
                        fontFamily: 'Barlow Condensed',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setIsContractModalOpen(false)}
                style={{
                  background: 'transparent',
                  color: '#1B1A17',
                  border: '2px solid #1B1A17',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.08em',
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                Withdraw
              </button>
              <button
                onClick={handleSubmitContract}
                style={{
                  background: '#1E7B3C',
                  color: '#FFF',
                  border: 'none',
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.08em',
                  padding: '8px 18px',
                  cursor: 'pointer',
                }}
              >
                Sign Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
