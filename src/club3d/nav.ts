// SPEC §11.25.1 Floor nav graph and pathfinding
import type { RoomId, Point3D } from './types';
import { CLUB3D_CONFIG } from '../config/balance';

export interface NavNode {
  id: string;
  room: RoomId;
  pos: Point3D;
  edges: string[];
}

export const NAV_GRAPH: Record<string, NavNode> = {
  // Exterior
  node_exterior_gate: {
    id: 'node_exterior_gate',
    room: 'exterior',
    pos: [-30, 0, 4],
    edges: ['node_exterior_entrance'],
  },
  node_exterior_entrance: {
    id: 'node_exterior_entrance',
    room: 'exterior',
    pos: [-22, 0, 0],
    edges: ['node_exterior_gate', 'node_corridor_west'],
  },

  // Corridor Spine
  node_corridor_west: {
    id: 'node_corridor_west',
    room: 'corridor',
    pos: [-20, 0, 0],
    edges: ['node_exterior_entrance', 'node_corridor_office'],
  },
  node_corridor_office: {
    id: 'node_corridor_office',
    room: 'corridor',
    pos: [-12, 0, 0],
    edges: ['node_corridor_west', 'node_office_door', 'node_corridor_dressing'],
  },
  node_corridor_dressing: {
    id: 'node_corridor_dressing',
    room: 'corridor',
    pos: [-5, 0, 0],
    edges: ['node_corridor_office', 'node_dressing_door', 'node_corridor_board'],
  },
  node_corridor_board: {
    id: 'node_corridor_board',
    room: 'corridor',
    pos: [0, 0, 0],
    edges: ['node_corridor_dressing', 'node_board_door', 'node_corridor_press'],
  },
  node_corridor_press: {
    id: 'node_corridor_press',
    room: 'corridor',
    pos: [15, 0, 0],
    edges: ['node_corridor_board', 'node_press_door', 'node_corridor_east'],
  },
  node_corridor_east: {
    id: 'node_corridor_east',
    room: 'corridor',
    pos: [35, 0, 0],
    edges: ['node_corridor_press', 'node_training_exit'],
  },

  // Office
  node_office_door: {
    id: 'node_office_door',
    room: 'office',
    pos: [-12, 0, 1.6],
    edges: ['node_corridor_office', 'node_office_desk'],
  },
  node_office_desk: {
    id: 'node_office_desk',
    room: 'office',
    pos: [-12, 0, 5.8],
    edges: ['node_office_door'],
  },

  // Boardroom
  node_board_door: {
    id: 'node_board_door',
    room: 'boardroom',
    pos: [0, 0, 1.6],
    edges: ['node_corridor_board', 'node_board_table'],
  },
  node_board_table: {
    id: 'node_board_table',
    room: 'boardroom',
    pos: [0, 0, 6.0],
    edges: ['node_board_door'],
  },

  // Press Room
  node_press_door: {
    id: 'node_press_door',
    room: 'press',
    pos: [15, 0, 1.6],
    edges: ['node_corridor_press', 'node_press_table'],
  },
  node_press_table: {
    id: 'node_press_table',
    room: 'press',
    pos: [15, 0, 6.2],
    edges: ['node_press_door'],
  },

  // Dressing Room & Tunnel
  node_dressing_door: {
    id: 'node_dressing_door',
    room: 'dressing',
    pos: [-5, 0, -1.6],
    edges: ['node_corridor_dressing', 'node_dressing_center'],
  },
  node_dressing_center: {
    id: 'node_dressing_center',
    room: 'dressing',
    pos: [-5, 0, -6.5],
    edges: ['node_dressing_door', 'node_tunnel_entrance'],
  },
  node_tunnel_entrance: {
    id: 'node_tunnel_entrance',
    room: 'tunnel',
    pos: [-5, 0, -12.5],
    edges: ['node_dressing_center', 'node_tunnel_pitch'],
  },
  node_tunnel_pitch: {
    id: 'node_tunnel_pitch',
    room: 'tunnel',
    pos: [-5, 0, -22.0],
    edges: ['node_tunnel_entrance'],
  },

  // Training Ground
  node_training_exit: {
    id: 'node_training_exit',
    room: 'training',
    pos: [40, 0, 0],
    edges: ['node_corridor_east', 'node_training_pitch'],
  },
  node_training_pitch: {
    id: 'node_training_pitch',
    room: 'training',
    pos: [52, 0, 10],
    edges: ['node_training_exit'],
  },
};

export const ROOM_KEY_NODES: Record<RoomId, string> = {
  exterior: 'node_exterior_entrance',
  corridor: 'node_corridor_office',
  office: 'node_office_desk',
  boardroom: 'node_board_table',
  dressing: 'node_dressing_center',
  tunnel: 'node_tunnel_pitch',
  training: 'node_training_pitch',
  press: 'node_press_table',
};

function distance(a: Point3D, b: Point3D): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Dijkstra / A* pathfinder on NAV_GRAPH */
export function findNavPath(startNodeId: string, endNodeId: string): Point3D[] {
  if (startNodeId === endNodeId) {
    const node = NAV_GRAPH[startNodeId];
    return node ? [node.pos] : [];
  }

  const dists: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set<string>();

  for (const id of Object.keys(NAV_GRAPH)) {
    dists[id] = Infinity;
    prev[id] = null;
    unvisited.add(id);
  }

  dists[startNodeId] = 0;

  while (unvisited.size > 0) {
    let curr: string | null = null;
    let minDist = Infinity;
    for (const node of unvisited) {
      if (dists[node] < minDist) {
        minDist = dists[node];
        curr = node;
      }
    }

    if (!curr || minDist === Infinity) break;
    if (curr === endNodeId) break;

    unvisited.delete(curr);
    const currNode = NAV_GRAPH[curr];
    if (!currNode) continue;

    for (const neighborId of currNode.edges) {
      if (!unvisited.has(neighborId)) continue;
      const neighbor = NAV_GRAPH[neighborId];
      if (!neighbor) continue;
      const d = dists[curr] + distance(currNode.pos, neighbor.pos);
      if (d < dists[neighborId]) {
        dists[neighborId] = d;
        prev[neighborId] = curr;
      }
    }
  }

  // Reconstruct path
  const path: Point3D[] = [];
  let step: string | null = endNodeId;
  while (step) {
    const n = NAV_GRAPH[step];
    if (n) path.unshift(n.pos);
    step = prev[step];
  }

  return path;
}

/** Calculate total path length in meters */
export function getPathLength(points: Point3D[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += distance(points[i], points[i + 1]);
  }
  return len;
}

/**
 * Calculates walk duration clamped strictly to at most 2.5s (§11.25.2).
 * Fast walks scale speed up so any path finishes in <= 2.5s.
 */
export function getWalkDuration(path: Point3D[]): number {
  const len = getPathLength(path);
  if (len <= 0) return 0;
  const nominalDuration = len / CLUB3D_CONFIG.walkSpeed;
  return Math.min(nominalDuration, CLUB3D_CONFIG.walkMaxSeconds);
}
