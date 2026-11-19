// Implements SPEC §11.14 Inbox screen (office world)
// Two-pane: list (kind icon, title, matchday, unread dot) and reading pane (body, actions).
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { Mail, AlertCircle, FileText, CheckCircle2, ChevronRight } from 'lucide-react';

export const InboxScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const markInboxRead = useStore((state) => state.markInboxRead);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  if (!gameState) return null;

  const inboxItems = gameState.inbox;
  const currentItem =
    inboxItems.find((item) => item.id === selectedItemId) ?? inboxItems[0] ?? null;

  const handleSelect = (id: string) => {
    setSelectedItemId(id);
    markInboxRead(id);
  };

  return (
    <div className="app-content-area office-surface" style={{ height: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '24px',
          height: '100%',
        }}
      >
        {/* Left Pane: Inbox List */}
        <div
          style={{
            backgroundColor: 'var(--paper)',
            border: '1px solid var(--paper-rule)',
            borderRadius: '3px',
            boxShadow: 'var(--shadow-paper)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px',
              borderBottom: '2px solid var(--paper-rule)',
              backgroundColor: 'var(--paper-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              className="broadcast-label"
              style={{ color: 'var(--paper-ink)', fontSize: '14px' }}
            >
              INBOX DISPATCHES
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--paper-dim)',
              }}
            >
              {inboxItems.filter((i) => !i.read).length} UNREAD
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {inboxItems.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--paper-dim)',
                  fontSize: '13px',
                }}
              >
                No communications in the inbox tray.
              </div>
            ) : (
              inboxItems.map((item) => {
                const isSelected = currentItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--paper-rule)',
                      backgroundColor: isSelected
                        ? 'var(--paper-2)'
                        : !item.read
                          ? 'rgba(255, 255, 255, 0.4)'
                          : 'transparent',
                      cursor: 'pointer',
                      borderLeft: !item.read
                        ? '4px solid var(--marker-red)'
                        : isSelected
                          ? '4px solid var(--paper-ink)'
                          : '4px solid transparent',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}
                    >
                      <span
                        className="broadcast-label"
                        style={{
                          fontSize: '10px',
                          color: 'var(--paper-dim)',
                        }}
                      >
                        MD {item.matchday} · {item.kind.toUpperCase()}
                      </span>
                      {!item.read && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--marker-red)',
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        fontWeight: item.read ? 600 : 700,
                        fontSize: '14px',
                        color: 'var(--paper-ink)',
                      }}
                    >
                      {item.title}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Reading Memo Pane */}
        <div>
          {currentItem ? (
            <Sheet
              id={`inbox-memo-${currentItem.id}`}
              variant="memo"
              style={{ minHeight: '400px' }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <div
                  style={{
                    borderBottom: '2px solid var(--paper-rule)',
                    paddingBottom: '16px',
                  }}
                >
                  <div
                    className="broadcast-label"
                    style={{
                      color: 'var(--paper-dim)',
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '6px',
                    }}
                  >
                    <span>MEMO · MATCHDAY {currentItem.matchday}</span>
                    <span>·</span>
                    <span>DISPATCH KIND: {currentItem.kind.toUpperCase()}</span>
                  </div>
                  <h2
                    style={{
                      fontSize: '26px',
                      fontFamily: 'var(--font-head)',
                      color: 'var(--paper-ink)',
                      margin: 0,
                    }}
                  >
                    {currentItem.title}
                  </h2>
                </div>

                <div
                  style={{
                    fontSize: '15px',
                    lineHeight: '1.6',
                    color: 'var(--paper-ink)',
                  }}
                >
                  {currentItem.body}
                </div>
              </div>
            </Sheet>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-dim)',
                fontSize: '14px',
              }}
            >
              Select a dispatch to read.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
