// Implements SPEC §9 and §23 M1.3 World Snapshot Generator
import fs from 'node:fs';
import path from 'node:path';
import { generateWorld } from '../src/core/world/generateWorld';
import { WORLD_SEED } from '../src/config/constants';

console.log(`Generating Meridian League world snapshot with WORLD_SEED = ${WORLD_SEED}...`);

const snapshot = generateWorld(WORLD_SEED);

const totalClubs = Object.keys(snapshot.clubs).length;
const totalPlayers = Object.keys(snapshot.players).length;
const totalFreeAgents = snapshot.freeAgents.length;
const totalFixtures = snapshot.fixtures.length;

console.log(`Generated:
- Clubs: ${totalClubs}
- Total Players: ${totalPlayers} (Club players: ${totalPlayers - totalFreeAgents}, Free agents: ${totalFreeAgents})
- Fixtures: ${totalFixtures}
`);

const outPath = path.resolve(process.cwd(), 'src/core/world/world.snapshot.json');
fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');

console.log(`Successfully written snapshot to ${outPath}`);
