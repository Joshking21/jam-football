// Implements SPEC §11.14 Inbox screen (office world)
// Overlapping memo sheets stacked on the desk with slight rotation (REVIEW M4, §19.7)
// Reading pane opens selected memo as a large sheet with official memo header and stamp.
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { Mail, AlertCircle, FileText, CheckCircle2, ChevronRight, Stamp } from 'lucide-react';

export const InboxScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const markInboxRead = useStore((state) => state.markInboxRead);
  const openConversationModal = useStore((state) => state.openConversationModal);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  const inboxItems = gameState.inbox;
  const currentItem =
    inboxItems.find((item) => item.id === selectedItemId) ?? inboxItems[0] ?? null;

  const handleSelect = (id: string) => {
    setSelectedItemId(id);
    markInboxRead(id);
  };

  // Fixed deterministic rotations for memos on the desk
  const ROTATIONS = [-1.4, 1.2, -0.8, 1.5, -1.1, 0.9, -1.6, 1.0];

  return (
    <div className="app-content-area office-surface" style={{ height: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '360px minmax(0, 1fr)',
          gap: '32px',
          alignItems: 'start',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Left Pane: Stacked Overlapping Memo Sheets on the Desk (REVIEW M4) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--desk-border)',
              paddingBottom: '8px',
            }}
          >
            <div
              className="broadcast-label"
              style={{ color: 'var(--text)', fontSize: '13px', letterSpacing: '0.08em' }}
            >
              MEMO IN-TRAY
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--accent-text)',
              }}
            >
              {inboxItems.filter((i) => !i.read).length} UNREAD
            </div>
          </div>

          {/* Overlapping stacked memos container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '8px 12px 24px',
              position: 'relative',
            }}
          >
            {inboxItems.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'var(--paper)',
                  color: 'var(--paper-dim)',
                  padding: '32px 20px',
                  borderRadius: '3px',
                  boxShadow: 'var(--shadow-paper)',
                  textAlign: 'center',
                  fontSize: '14px',
                  border: '1px solid var(--paper-rule)',
                  transform: 'rotate(-1deg)',
                }}
              >
                No dispatches remaining in the desk tray.
              </div>
            ) : (
              inboxItems.map((item, idx) => {
                const isSelected = currentItem?.id === item.id;
                const rot = ROTATIONS[idx % ROTATIONS.length] ?? 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    style={{
                      position: 'relative',
                      marginTop: idx === 0 ? '0' : '-16px',
                      zIndex: isSelected ? 20 : 10 - Math.min(idx, 8),
                      backgroundColor: 'var(--paper)',
                      color: 'var(--paper-ink)',
                      border: '1px solid var(--paper-rule)',
                      borderRadius: '3px',
                      boxShadow: isSelected
                        ? '0 4px 18px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.2)'
                        : 'var(--shadow-paper)',
                      padding: '14px 18px',
                      cursor: 'pointer',
                      transform: isSelected ? `scale(1.02) rotate(${rot}deg)` : `rotate(${rot}deg)`,
                      transition:
                        'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast)',
                      borderLeft: !item.read
                        ? '4px solid var(--marker-red)'
                        : isSelected
                          ? '4px solid var(--marker-blue)'
                          : '1px solid var(--paper-rule)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <span
                        className="broadcast-label"
                        style={{
                          fontSize: '10px',
                          color: 'var(--paper-dim)',
                          letterSpacing: '0.06em',
                        }}
                      >
                        MEMO · MD {item.matchday} · {item.kind.toUpperCase()}
                      </span>
                      {!item.read && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--marker-red)',
                            boxShadow: '0 0 4px rgba(196, 43, 43, 0.5)',
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        fontWeight: item.read ? 600 : 700,
                        fontSize: '15px',
                        fontFamily: 'var(--font-head)',
                        letterSpacing: '0.02em',
                        lineHeight: 1.2,
                        color: 'var(--paper-ink)',
                      }}
                    >
                      {item.title}
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--paper-dim)',
                        marginTop: '4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.body}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Large Open Reading Sheet (REVIEW M4) */}
        <div>
          {currentItem ? (
            <Sheet
              id={`inbox-memo-${currentItem.id}`}
              variant="memo"
              style={{
                minHeight: '440px',
                position: 'relative',
                transform: 'rotate(-0.5deg)',
              }}
            >
              {/* Red Stamp in Corner */}
              <div
                style={{
                  position: 'absolute',
                  top: '22px',
                  right: '26px',
                  border: '2px solid var(--marker-red)',
                  color: 'var(--marker-red)',
                  padding: '4px 10px',
                  transform: 'rotate(-4deg)',
                  fontFamily: 'var(--font-head)',
                  fontWeight: 700,
                  fontSize: '16px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  pointerEvents: 'none',
                }}
              >
                {currentItem.read ? 'ACKNOWLEDGED' : 'ACTION REQUIRED'}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <div
                  style={{
                    borderBottom: '2px solid var(--paper-ink)',
                    paddingBottom: '16px',
                  }}
                >
                  <div
                    className="broadcast-label"
                    style={{
                      color: 'var(--paper-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '11px',
                    }}
                  >
                    <span>
                      {userClub ? userClub.name.toUpperCase() : 'PORT CALLOWAY FC'} · THE OFFICE
                    </span>
                    <span>·</span>
                    <span>MATCHDAY {currentItem.matchday}</span>
                    <span>·</span>
                    <span>DISPATCH REF #{currentItem.id.slice(-6).toUpperCase()}</span>
                  </div>

                  <h1
                    style={{
                      fontSize: '32px',
                      fontFamily: 'var(--font-head)',
                      color: 'var(--paper-ink)',
                      marginTop: '8px',
                      marginBottom: '0',
                      letterSpacing: '0.02em',
                      maxWidth: '80%',
                    }}
                  >
                    {currentItem.title}
                  </h1>
                </div>

                {/* Memo Body text */}
                <div
                  style={{
                    fontSize: '15px',
                    lineHeight: '1.6',
                    color: 'var(--paper-ink)',
                    whiteSpace: 'pre-wrap',
                    maxWidth: '65ch',
                  }}
                >
                  {currentItem.body}
                </div>

                {/* Directive action if available */}
                {currentItem.action && (
                  <div
                    style={{
                      borderTop: '1px solid var(--paper-rule)',
                      paddingTop: '20px',
                      display: 'flex',
                      gap: '12px',
                    }}
                  >
                    <Button
                      variant="primary"
                      size="m"
                      onClick={() => {
                        if (currentItem.action?.type === 'conversation') {
                          openConversationModal();
                        }
                      }}
                    >
                      {currentItem.action?.type === 'conversation'
                        ? 'Speak with Player'
                        : 'Respond'}
                    </Button>
                  </div>
                )}
              </div>
            </Sheet>
          ) : (
            <Sheet id="inbox-empty" variant="memo">
              <div
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: 'var(--paper-dim)',
                }}
              >
                No memo selected.
              </div>
            </Sheet>
          )}
        </div>
      </div>
    </div>
  );
};
