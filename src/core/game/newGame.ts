// Implements SPEC §8.9, §9, §11.3 New Game state creation
import { GameState, ClubId } from '../types';
import { SAVE_VERSION } from '@/config/constants';
import worldSnapshot from '../world/world.snapshot.json';
import { WorldSnapshot } from '../world/generateWorld';
import { migrateTactics } from './migrations';

export interface NewGameOptions {
  seed: number;
  userClubId: ClubId;
  managerName?: string;
  tutorialEnabled?: boolean;
}

export function createNewGame(options: NewGameOptions): GameState {
  const { seed, userClubId, managerName = 'The Gaffer', tutorialEnabled = true } = options;

  // Deep clone snapshot so mutations in gameplay do not touch snapshot
  const snapshot = JSON.parse(JSON.stringify(worldSnapshot)) as WorldSnapshot;

  // Ensure all clubs have tactical depth migrated
  for (const club of Object.values(snapshot.clubs)) {
    if (club.tactics) {
      club.tactics = migrateTactics(club.tactics);
    }
    if (club.style) {
      club.style = {
        ...club.style,
        onLoss: club.style.onLoss ?? 'Mixed',
        onWin: club.style.onWin ?? 'Mixed',
        distribution: club.style.distribution ?? 'Mixed',
        cornersFor: club.style.cornersFor ?? 'Mixed',
        cornersAgainst: club.style.cornersAgainst ?? 'Mixed',
      };
    }
  }

  if (!snapshot.clubs[userClubId]) {
    throw new Error(`Invalid club ID: ${userClubId}`);
  }

  const userClub = snapshot.clubs[userClubId];

  // Welcome inbox item
  const initialInbox = [
    {
      id: 'm0001',
      matchday: 0,
      kind: 'Board' as const,
      title: `Welcome to ${userClub.name}`,
      body: `The board of ${userClub.name} welcomes you as our new manager. Our target this season is to ${userClub.expectation.label.toLowerCase()}. We back your vision and expect disciplined, focused football.`,
      read: false,
      requiresAction: false,
    },
    {
      id: 'm0002',
      matchday: 0,
      kind: 'Assistant' as const,
      title: 'Squad & Preseason Briefing',
      body: `Welcome, boss. I have prepared your initial squad overview and training schedule. Feel free to review our best XI in Tactics and explore potential signings before matchday 1.`,
      read: false,
      requiresAction: false,
    },
  ];

  // Appointment news item
  const initialNews = [
    {
      id: 'n0001',
      matchday: 0,
      headline: `${userClub.name} Appoint ${managerName}`,
      body: `${userClub.city} — ${userClub.name} have confirmed the appointment of ${managerName} as their new first-team manager. Supporters at ${userClub.stadium.name} will be hoping for a competitive campaign.`,
      clubIds: [userClubId],
      playerIds: [],
    },
  ];

  return {
    version: SAVE_VERSION,
    seed,
    createdAt: new Date().toISOString(),
    managerName,
    userClubId,
    matchday: 0,
    phase: 'BoardMeeting',
    clubs: snapshot.clubs,
    players: snapshot.players,
    freeAgents: snapshot.freeAgents,
    fixtures: snapshot.fixtures,
    table: snapshot.table,
    window: null,
    inbox: initialInbox,
    news: initialNews,
    pressHistory: [],
    conversationsHistory: [],
    tutorial: { step: 1, done: !tutorialEnabled },
    pendingMatch: null,
    awards: null,
    score: 0,
    counters: { news: 1, inbox: 2, offer: 0 },
  };
}
