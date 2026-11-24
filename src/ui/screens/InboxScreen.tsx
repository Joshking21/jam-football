// Implements SPEC §11.14 Inbox and §12.11 matching docs/design/inbox/
import React, { useState, useMemo } from 'react';
import { useStore } from '../../state/store';
import { InboxItem } from '../../core/types';

type TrayFilter = 'ALL' | 'ACTION' | 'BOARD' | 'PLAYERS' | 'MEDICAL' | 'SCOUTING' | 'PRESS';

export const InboxScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const markInboxRead = useStore((state) => state.markInboxRead);
  const openConversationModal = useStore((state) => state.openConversationModal);
  const showToast = useStore((state) => state.showToast);

  const [activeTray, setActiveTray] = useState<TrayFilter>('ALL');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  const allMemos = gameState.inbox;

  // Filter memos
  const filteredMemos = useMemo(() => {
    return allMemos.filter((item) => {
      switch (activeTray) {
        case 'ACTION':
          return Boolean(item.action) || !item.read;
        case 'BOARD':
          return item.kind === 'board' || item.id.includes('board');
        case 'PLAYERS':
          return item.kind === 'player' || item.id.includes('player') || item.id.includes('agent');
        case 'MEDICAL':
          return (
            item.kind === 'medical' || item.id.includes('physio') || item.id.includes('injury')
          );
        case 'SCOUTING':
          return item.kind === 'transfer' || item.id.includes('scout');
        case 'PRESS':
          return item.kind === 'press' || item.id.includes('press');
        case 'ALL':
        default:
          return true;
      }
    });
  }, [allMemos, activeTray]);

  const currentItem: InboxItem | null =
    allMemos.find((item) => item.id === selectedItemId) ?? filteredMemos[0] ?? allMemos[0] ?? null;

  const handleSelect = (id: string) => {
    setSelectedItemId(id);
    markInboxRead(id);
  };

  const actionCount = allMemos.filter((i) => Boolean(i.action) || !i.read).length;

  const getSenderColor = (item: InboxItem) => {
    if (item.kind === 'board' || item.id.includes('board')) return '#1F4FBF'; // Board blue
    if (item.id.includes('agent') || item.kind === 'contract') return '#C98A12'; // Agent amber
    if (item.id.includes('discipline') || item.id.includes('warning')) return '#C42B2B'; // Discipline red
    if (item.kind === 'medical' || item.id.includes('physio')) return '#1E7B3C'; // Medical green
    if (item.kind === 'transfer' || item.id.includes('scout')) return '#5E574E'; // Scouting grey
    if (item.id.includes('theo') || item.kind === 'advice') return '#0B1F3A'; // Theo navy
    return '#7A7062'; // Press taupe
  };

  const getSenderLabel = (item: InboxItem) => {
    if (item.kind === 'board' || item.id.includes('board')) return 'Board';
    if (item.id.includes('agent') || item.kind === 'contract') return 'Agent';
    if (item.id.includes('discipline')) return 'Discipline';
    if (item.kind === 'medical' || item.id.includes('physio')) return 'Medical';
    if (item.kind === 'transfer' || item.id.includes('scout')) return 'Scouting';
    if (item.id.includes('theo')) return 'Theo';
    return 'Press';
  };

  const ROTATIONS = [-1, 0.8, -0.5, 1.1, -0.9, 0.6, -1.2, 0.9];

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        overflowY: 'auto',
        background: 'radial-gradient(ellipse at 40% 40%, #2a2118 0%, #16110c 60%, #0c0907 100%)',
        color: '#1B1A17',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
        padding: '24px 32px 40px',
      }}
    >
      <style>{`
        .inbox-desk {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 3px, transparent 3px 140px),
                      radial-gradient(ellipse at 40% 50%, #3a2a1c 0%, #22170f 70%);
          pointer-events: none;
        }
        .inbox-header {
          display: flex;
          align-items: baseline;
          gap: 14px;
          margin-bottom: 14px;
          position: relative;
          z-index: 2;
        }
        .inbox-h2 {
          font: 800 34px/1 'Barlow Condensed', sans-serif;
          color: #F4F1EA;
          text-transform: uppercase;
        }
        .inbox-sub {
          font: 600 13px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #9CA3AF;
        }
        .tray-chips {
          display: flex;
          gap: 6px;
          margin-bottom: 24px;
          position: relative;
          z-index: 2;
          flex-wrap: wrap;
        }
        .tray-chips span {
          font: 700 12.5px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 8px 12px;
          background: rgba(255,255,255,0.06);
          color: #CBD5E1;
          border: 1px solid rgba(255,255,255,0.14);
          cursor: pointer;
          user-select: none;
          transition: all 120ms ease;
        }
        .tray-chips span.on {
          background: #F4F1EA;
          color: #0A0D12;
          border-color: #F4F1EA;
        }
        .inbox-grid {
          display: grid;
          grid-template-columns: minmax(440px, 560px) minmax(540px, 1fr);
          gap: 36px;
          align-items: start;
          max-width: 1680px;
          position: relative;
          z-index: 2;
        }
        @media (max-width: 1240px) {
          .inbox-grid {
            grid-template-columns: 1fr;
          }
        }
        .memo-item {
          position: relative;
          background: #FBF8F1;
          color: #1B1A17;
          padding: 14px 18px 14px 20px;
          margin-top: 6px;
          box-shadow: 0 2px 0 rgba(0,0,0,0.2), 0 10px 20px rgba(0,0,0,0.35);
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 2px 12px;
          cursor: pointer;
          transition: transform 140ms ease, box-shadow 140ms ease;
        }
        .memo-item:hover {
          transform: translateX(6px) rotate(0deg) !important;
        }
        .memo-item.sel {
          transform: translateX(18px) rotate(0deg) !important;
          outline: 3px solid #1F4FBF;
          z-index: 10 !important;
          box-shadow: 0 14px 30px rgba(0,0,0,0.55);
        }
        .memo-ty {
          font: 700 11px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }
        .memo-item b {
          font: 700 18px/1.15 'Barlow Condensed', sans-serif;
          text-transform: uppercase;
          grid-column: 1;
        }
        .memo-item small {
          font: 500 12.5px/1.35 Inter, sans-serif;
          color: #5E574E;
          grid-column: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .memo-when {
          grid-row: 1/3;
          grid-column: 2;
          text-align: right;
          font: 600 11px/1.3 'Barlow Condensed', sans-serif;
          letter-spacing: 0.12em;
          color: #5E574E;
          text-transform: uppercase;
        }
        .memo-dot {
          position: absolute;
          right: 14px;
          bottom: 14px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #C42B2B;
        }
        .memo-act {
          position: absolute;
          right: 36px;
          bottom: 10px;
          font: 800 10.5px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.16em;
          color: #C42B2B;
          border: 1.5px solid #C42B2B;
          padding: 2px 5px 1px;
          transform: rotate(-6deg);
        }
        .letter-wrap {
          position: relative;
          min-height: 640px;
          padding: 38px 46px 36px;
          background: #F6F2E8;
          color: #1B1A17;
          box-shadow: 0 30px 60px rgba(0,0,0,0.6);
          border: 1px solid #D6CEC0;
          transform: rotate(0.4deg);
        }
        .paperclip {
          position: absolute;
          left: 50px;
          top: -16px;
          width: 20px;
          height: 64px;
          border: 3.5px solid #8E96A0;
          border-radius: 10px;
          transform: rotate(8deg);
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .letter-hd {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px double #1B1A17;
          padding-bottom: 12px;
        }
        .letter-hd .top-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .letter-hd .top-left b {
          font: 900 23px/1 'Playfair Display', serif;
        }
        .letter-hd .top-left small {
          display: block;
          font: 600 11px/1.3 'Barlow Condensed', sans-serif;
          letter-spacing: 0.16em;
          color: #5E574E;
          text-transform: uppercase;
        }
        .letter-hd .top-right {
          font: 600 12px/1.4 'Barlow Condensed', sans-serif;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #5E574E;
          text-align: right;
        }
        .letter-title {
          font: 800 42px/0.95 'Barlow Condensed', sans-serif;
          text-transform: uppercase;
          margin: 22px 0 6px;
        }
        .letter-to {
          font: 600 12.5px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.14em;
          color: #5E574E;
          text-transform: uppercase;
        }
        .letter-body {
          font: 400 16px/1.6 'Source Serif 4', serif;
          margin-top: 16px;
          white-space: pre-wrap;
          max-width: 68ch;
        }
        .letter-terms {
          margin-top: 20px;
          border: 2px solid #1B1A17;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        .letter-terms div {
          padding: 10px 12px;
          border-right: 1px solid #D6CEC0;
        }
        .letter-terms div:last-child {
          border-right: 0;
        }
        .letter-terms span {
          display: block;
          font: 700 11px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #5E574E;
        }
        .letter-terms b {
          display: block;
          font: 800 22px/1 'Barlow Condensed', sans-serif;
          margin-top: 4px;
        }
        .letter-terms small {
          display: block;
          font: 500 11px/1.3 Inter, sans-serif;
          color: #5E574E;
          margin-top: 2px;
        }
        .letter-sig {
          margin-top: 24px;
          font: italic 400 26px/1 'Playfair Display', serif;
          color: #2b4fa8;
        }
        .letter-sig small {
          display: block;
          font: 600 11px/1.3 'Barlow Condensed', sans-serif;
          letter-spacing: 0.14em;
          color: #5E574E;
          font-style: normal;
          margin-top: 5px;
          text-transform: uppercase;
        }
        .letter-acts {
          margin-top: 28px;
          display: flex;
          gap: 10px;
          align-items: center;
          border-top: 2px solid #1B1A17;
          padding-top: 16px;
          flex-wrap: wrap;
        }
        .letter-acts .theo-box {
          margin-left: auto;
          font: 500 12.5px/1.35 Inter, sans-serif;
          color: #5E574E;
          max-width: 320px;
        }
        .letter-acts .theo-box b {
          font: 700 11px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.14em;
          color: #1B1A17;
          display: block;
          margin-bottom: 2px;
          text-transform: uppercase;
        }
        .btn-inbox {
          font: 700 13px/1 'Barlow Condensed', sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 8px 14px;
          border-radius: 3px;
          cursor: pointer;
        }
        .btn-inbox.primary {
          background: #1B1A17;
          color: #FBF8F1;
          border: none;
        }
        .btn-inbox.ghost {
          background: transparent;
          color: #1B1A17;
          border: 1.5px solid #1B1A17;
        }
      `}</style>

      <div className="inbox-desk" />

      {/* Header */}
      <div className="inbox-header">
        <div className="inbox-h2">The in-tray</div>
        <small className="inbox-sub">
          {allMemos.length} memo{allMemos.length === 1 ? '' : 's'} ·{' '}
          {actionCount > 0 ? `${actionCount} need your attention` : 'All items up to date'}
        </small>
      </div>

      {/* Filter Trays */}
      <div className="tray-chips">
        <span className={activeTray === 'ALL' ? 'on' : ''} onClick={() => setActiveTray('ALL')}>
          All {allMemos.length}
        </span>
        <span
          className={activeTray === 'ACTION' ? 'on' : ''}
          onClick={() => setActiveTray('ACTION')}
        >
          Needs action {actionCount}
        </span>
        <span className={activeTray === 'BOARD' ? 'on' : ''} onClick={() => setActiveTray('BOARD')}>
          Board
        </span>
        <span
          className={activeTray === 'PLAYERS' ? 'on' : ''}
          onClick={() => setActiveTray('PLAYERS')}
        >
          Players
        </span>
        <span
          className={activeTray === 'MEDICAL' ? 'on' : ''}
          onClick={() => setActiveTray('MEDICAL')}
        >
          Medical
        </span>
        <span
          className={activeTray === 'SCOUTING' ? 'on' : ''}
          onClick={() => setActiveTray('SCOUTING')}
        >
          Scouting
        </span>
        <span className={activeTray === 'PRESS' ? 'on' : ''} onClick={() => setActiveTray('PRESS')}>
          Press
        </span>
      </div>

      <div className="inbox-grid">
        {/* Left Stack of Memos */}
        <div>
          {filteredMemos.length === 0 ? (
            <div
              style={{
                backgroundColor: '#FBF8F1',
                color: '#5E574E',
                padding: '36px 24px',
                textAlign: 'center',
                boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
                border: '1px solid #D6CEC0',
              }}
            >
              No dispatches currently in this tray.
            </div>
          ) : (
            filteredMemos.map((item, idx) => {
              const isSel = currentItem?.id === item.id;
              const rot = ROTATIONS[idx % ROTATIONS.length] ?? 0;
              const col = getSenderColor(item);
              const sender = getSenderLabel(item);
              const hasAction = Boolean(item.action) || !item.read;

              return (
                <div
                  key={item.id}
                  className={`memo-item ${isSel ? 'sel' : ''}`}
                  style={{
                    borderLeft: `6px solid ${col}`,
                    transform: `rotate(${rot}deg)`,
                    zIndex: isSel ? 10 : 8 - Math.min(idx, 6),
                  }}
                  onClick={() => handleSelect(item.id)}
                >
                  <div className="memo-ty" style={{ color: col }}>
                    {sender}
                  </div>
                  <b>{item.title}</b>
                  <small>{item.body}</small>
                  <div className="memo-when">MD {item.matchday}</div>
                  {!item.read && <span className="memo-dot" />}
                  {hasAction && <span className="memo-act">ACTION</span>}
                </div>
              );
            })
          )}
        </div>

        {/* Right Letter Sheet */}
        {currentItem ? (
          <div className="letter-wrap">
            <div className="paperclip" />

            <div className="letter-hd">
              <div className="top-left">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    border: '3px solid #1B1A17',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    font: "900 24px/1 'Playfair Display', serif",
                  }}
                >
                  {currentItem.title[0] ?? 'D'}
                </div>
                <div>
                  <b>{getSenderLabel(currentItem)} Department</b>
                  <small>Official dispatch · Ref #{currentItem.id.slice(-6).toUpperCase()}</small>
                </div>
              </div>
              <div className="top-right">
                Matchday {currentItem.matchday}
                <br />
                Private and confidential
              </div>
            </div>

            <div className="letter-title">{currentItem.title}</div>
            <div className="letter-to">To the manager, {userClub?.name ?? 'Port Calloway FC'}</div>

            <p className="letter-body">{currentItem.body}</p>

            {/* Terms box if offer or contract */}
            {currentItem.kind === 'transferOffer' && (
              <div className="letter-terms">
                <div>
                  <span>Fee</span>
                  <b>€2.5M</b>
                  <small>immediate payment</small>
                </div>
                <div>
                  <span>Add-ons</span>
                  <b>€500K</b>
                  <small>after 20 appearances</small>
                </div>
                <div>
                  <span>Sell-on</span>
                  <b>15%</b>
                  <small>of future profit</small>
                </div>
                <div>
                  <span>Status</span>
                  <b>Awaiting</b>
                  <small>decision required</small>
                </div>
              </div>
            )}

            <div className="letter-sig">
              {getSenderLabel(currentItem) === 'Board'
                ? 'Margaret Holloway'
                : getSenderLabel(currentItem) === 'Agent'
                  ? 'Daniel Okoro'
                  : 'Theo Vance'}
              <small>
                {getSenderLabel(currentItem) === 'Board'
                  ? 'Chairwoman · Board of Directors'
                  : getSenderLabel(currentItem) === 'Agent'
                    ? 'Licensed Representative'
                    : 'Assistant Coach'}
              </small>
            </div>

            <div className="letter-acts">
              {currentItem.action?.type === 'conversation' ? (
                <button className="btn-inbox primary" onClick={() => openConversationModal()}>
                  Open talks
                </button>
              ) : (
                <button
                  className="btn-inbox primary"
                  onClick={() => {
                    markInboxRead(currentItem.id);
                    showToast('Memo acknowledged.', 'info');
                  }}
                >
                  Acknowledge
                </button>
              )}
              <button
                className="btn-inbox ghost"
                onClick={() => {
                  showToast('Memo filed.', 'info');
                }}
              >
                File away
              </button>

              <div className="theo-box">
                <b>Theo</b>
                "Let's stay disciplined. Keeping our focus on Saturday's preparation is priority
                number one."
              </div>
            </div>
          </div>
        ) : (
          <div className="letter-wrap" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px' }}>
              The tray is clear
            </h3>
            <p style={{ color: '#5E574E', marginTop: '10px' }}>
              All correspondence has been processed. New memos will arrive after matchday
              operations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
