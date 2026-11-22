// Implements SPEC §12.9, §16.4 Player Conversations Modal
// Atmospheric office encounter: player sits across the manager's desk, speaks his opening,
// manager chooses from 3 reply options, and outcomes (morale, contract extension, promise, transfer list) are resolved.
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Portrait } from '../components/Portrait';
import {
  Check,
  X,
  AlertCircle,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { ConversationResolution } from '../../core/player/conversations';

export interface ConversationModalProps {
  onClose?: () => void;
}

export const ConversationModal: React.FC<ConversationModalProps> = ({ onClose }) => {
  const gameState = useStore((state) => state.gameState);
  const isConversationModalOpen = useStore((state) => state.isConversationModalOpen);
  const closeConversationModal = useStore((state) => state.closeConversationModal);
  const answerConversation = useStore((state) => state.answerConversation);

  const [resolution, setResolution] = useState<ConversationResolution | null>(null);
  const [selectedReplyId, setSelectedReplyId] = useState<string | null>(null);

  if (!isConversationModalOpen || !gameState || !gameState.activeConversation) {
    return null;
  }

  const activeConv = gameState.activeConversation;
  const player = gameState.players[activeConv.playerId];
  const userClub = gameState.clubs[gameState.userClubId];

  if (!player || !userClub) return null;

  const handleSelectReply = (replyId: string) => {
    setSelectedReplyId(replyId);
    const res = answerConversation(replyId);
    if (res) {
      setResolution(res);
    }
  };

  const handleClose = () => {
    setResolution(null);
    setSelectedReplyId(null);
    closeConversationModal();
    if (onClose) onClose();
  };

  const typeTitles: Record<string, string> = {
    playing_time: 'Playing Time Discussion',
    contract: 'Contract Situation',
    unhappy: 'Player Morale & Atmosphere',
    praise: 'Managerial Praise',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(7, 9, 13, 0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="settle-spring"
        style={{
          width: '100%',
          maxWidth: '780px',
          backgroundColor: 'var(--paper, #EFEBE3)',
          color: 'var(--paper-ink, #1B1A17)',
          borderRadius: '4px',
          boxShadow: '0 2px 0 rgba(0,0,0,0.25), 0 16px 36px rgba(0,0,0,0.6)',
          border: '1px solid var(--paper-rule, #CFC6B6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Manila Name Tab at top left */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '20px',
            backgroundColor: 'var(--manila, #D9C9A3)',
            color: 'var(--paper-ink, #1B1A17)',
            padding: '4px 14px',
            borderRadius: '0 0 4px 4px',
            fontFamily: 'var(--font-head)',
            fontWeight: 700,
            fontSize: '12px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          {player.lastName} · {typeTitles[activeConv.type] ?? 'Conversation'}
        </div>

        {/* Close Button */}
        {resolution && (
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--paper-dim, #5E574E)',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Modal Header */}
        <div
          style={{
            padding: '34px 24px 14px',
            borderBottom: '2px solid var(--paper-ink, #1B1A17)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--paper-dim, #5E574E)',
              }}
            >
              The Manager&rsquo;s Office · 1-on-1 Dialogue
            </div>
            <h2
              style={{
                margin: '2px 0 0',
                fontFamily: 'var(--font-head)',
                fontSize: '26px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              {player.firstName} {player.lastName}
            </h2>
          </div>

          {/* Player Quick Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'right', fontSize: '12px' }}>
              <div style={{ fontWeight: 700 }}>
                {player.positions[0]?.pos} · OVR{' '}
                {player.potential ? Math.round(player.potential * 0.9) : 70}
              </div>
              <div style={{ color: 'var(--paper-dim)' }}>
                Morale: {player.morale}% · {player.personality}
              </div>
            </div>
            <Portrait
              playerId={player.id}
              initials={`${player.firstName[0]}${player.lastName[0]}`}
              primaryColor={userClub.colors.primary}
              secondaryColor={userClub.colors.secondary}
              size={48}
            />
          </div>
        </div>

        {/* Dialogue Main Area */}
        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            maxHeight: '68vh',
            overflowY: 'auto',
          }}
        >
          {/* Player Speech Bubble */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            <Portrait
              playerId={player.id}
              initials={`${player.firstName[0]}${player.lastName[0]}`}
              primaryColor={userClub.colors.primary}
              secondaryColor={userClub.colors.secondary}
              size={40}
            />
            <div
              style={{
                flex: 1,
                backgroundColor: 'var(--paper-2, #E4DED2)',
                borderRadius: '0 8px 8px 8px',
                padding: '14px 16px',
                border: '1px solid var(--paper-rule, #CFC6B6)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--paper-dim)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                {player.firstName} {player.lastName}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14.5px',
                  lineHeight: '1.45',
                  color: 'var(--paper-ink, #1B1A17)',
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{activeConv.opening.text}&rdquo;
              </div>
            </div>
          </div>

          {/* If NOT yet answered: Reply Choices */}
          {!resolution ? (
            <div style={{ marginTop: '8px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--paper-dim, #5E574E)',
                  marginBottom: '10px',
                }}
              >
                Your Response (Select one):
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeConv.opening.replies.map((reply) => {
                  const toneColors: Record<string, string> = {
                    promise: '#1F4FBF',
                    tough: '#C42B2B',
                    release: '#C42B2B',
                    renew: '#1E7B3C',
                    delay: '#B7791F',
                    refuse: '#C42B2B',
                    encourage: '#1E7B3C',
                    firm: '#1F4FBF',
                    praise: '#1E7B3C',
                    standards: '#B7791F',
                    challenge: '#1F4FBF',
                  };
                  const badgeColor = toneColors[reply.tone] ?? '#1F4FBF';

                  return (
                    <button
                      key={reply.id}
                      onClick={() => handleSelectReply(reply.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '3px',
                        border: '1px solid var(--paper-rule, #CFC6B6)',
                        backgroundColor: '#FFFFFF',
                        color: 'var(--paper-ink, #1B1A17)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'transform 120ms ease, box-shadow 120ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-head)',
                            fontWeight: 700,
                            fontSize: '11px',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            backgroundColor: 'rgba(0,0,0,0.05)',
                            color: badgeColor,
                            padding: '2px 6px',
                            borderRadius: '2px',
                          }}
                        >
                          {reply.tone}
                        </span>

                        <div
                          style={{ display: 'flex', gap: '6px', fontSize: '11px', fontWeight: 600 }}
                        >
                          {reply.moraleDelta !== 0 && (
                            <span style={{ color: reply.moraleDelta > 0 ? '#1E7B3C' : '#C42B2B' }}>
                              Morale {reply.moraleDelta > 0 ? '+' : ''}
                              {reply.moraleDelta}
                            </span>
                          )}
                          {reply.promise && (
                            <span style={{ color: '#1F4FBF' }}>Promised Starts</span>
                          )}
                          {reply.contractRenewal && (
                            <span style={{ color: '#1E7B3C' }}>Contract +20%</span>
                          )}
                          {reply.transferList && (
                            <span style={{ color: '#C42B2B' }}>Transfer List</span>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.35 }}>
                        &ldquo;{reply.text}&rdquo;
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* If ANSWERED: Show manager line & player reaction */
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}
            >
              {/* Manager Speech */}
              {(() => {
                const chosenReply = activeConv.opening.replies.find(
                  (r) => r.id === selectedReplyId,
                );
                if (!chosenReply) return null;
                return (
                  <div
                    style={{
                      alignSelf: 'flex-end',
                      maxWidth: '85%',
                      backgroundColor: 'var(--paper-ink, #1B1A17)',
                      color: '#FFFFFF',
                      borderRadius: '8px 0 8px 8px',
                      padding: '12px 16px',
                      fontSize: '14px',
                      lineHeight: 1.4,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-head)',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--paper-dim, #5E574E)',
                        marginBottom: '3px',
                        textTransform: 'uppercase',
                      }}
                    >
                      You
                    </div>
                    &ldquo;{chosenReply.text}&rdquo;
                  </div>
                );
              })()}

              {/* Player Follow-up Reaction */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Portrait
                  playerId={player.id}
                  initials={`${player.firstName[0]}${player.lastName[0]}`}
                  primaryColor={userClub.colors.primary}
                  secondaryColor={userClub.colors.secondary}
                  size={40}
                />
                <div
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--paper-2, #E4DED2)',
                    borderRadius: '0 8px 8px 8px',
                    padding: '12px 16px',
                    border: '1px solid var(--paper-rule, #CFC6B6)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--paper-dim)',
                      marginBottom: '3px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {player.lastName}
                  </div>
                  <div style={{ fontSize: '14px', fontStyle: 'italic', lineHeight: 1.4 }}>
                    &ldquo;{resolution.playerReaction}&rdquo;
                  </div>
                </div>
              </div>

              {/* Outcome Badge Banner */}
              <div
                style={{
                  marginTop: '10px',
                  padding: '12px 16px',
                  borderRadius: '3px',
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #1E7B3C',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--paper-ink)',
                }}
              >
                <Check size={18} color="#1E7B3C" strokeWidth={3} />
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontWeight: 700,
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: '#1E7B3C',
                    }}
                  >
                    Outcome Recorded
                  </div>
                  <div>{resolution.feedback}</div>
                </div>
              </div>

              {/* Done Button */}
              <button
                onClick={handleClose}
                style={{
                  alignSelf: 'flex-end',
                  marginTop: '10px',
                  padding: '8px 24px',
                  borderRadius: '3px',
                  backgroundColor: 'var(--paper-ink, #1B1A17)',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-head)',
                  fontWeight: 700,
                  fontSize: '14px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
