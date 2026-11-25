// SPEC §11.25.1 Rooms layout, coordinate geometry and room definitions
import * as THREE from 'three';
import type { RoomId, RoomDefinition, Point3D } from './types';

export const ROOM_DEFINITIONS: Record<RoomId, RoomDefinition> = {
  exterior: {
    id: 'exterior',
    name: 'Exterior',
    bounds: {
      min: [-45, 0, -15],
      max: [-20, 20, 15],
    },
    doorPosition: [-20, 1.1, 0],
    cameraRail: {
      position: [-35, 3.5, 8.0],
      target: [-22, 4.5, 0],
      fov: 55,
    },
    hotspots: [
      {
        id: 'front_doors',
        name: 'Main Entrance',
        position: [-20.5, 1.1, 0],
        radius: 1.5,
        room: 'exterior',
        opens: { screen: 'hub' },
        touch: {
          hand: 'auto',
          point: [-20.2, 1.1, 0],
          normal: [-1, 0, 0],
          kind: 'handle',
        },
      },
    ],
  },

  corridor: {
    id: 'corridor',
    name: 'Corridor',
    bounds: {
      min: [-20, 0, -1.5],
      max: [40, 3.2, 1.5],
    },
    doorPosition: [0, 1.1, 0],
    cameraRail: {
      position: [-8, 1.6, 0],
      target: [-3, 1.5, 0],
      fov: 52,
    },
    hotspots: [
      {
        id: 'door_office',
        name: 'Manager Office',
        position: [-12, 1.1, 1.45],
        radius: 1.0,
        room: 'corridor',
        opens: { screen: 'hub' },
        touch: {
          hand: 'R',
          point: [-12.3, 1.05, 1.45],
          normal: [0, 0, -1],
          kind: 'handle',
        },
      },
      {
        id: 'door_boardroom',
        name: 'Boardroom',
        position: [0, 1.1, 1.45],
        radius: 1.0,
        room: 'corridor',
        opens: { screen: 'boardMeeting' },
        touch: {
          hand: 'R',
          point: [-0.3, 1.05, 1.45],
          normal: [0, 0, -1],
          kind: 'handle',
        },
      },
      {
        id: 'door_press',
        name: 'Press Room',
        position: [15, 1.1, 1.45],
        radius: 1.0,
        room: 'corridor',
        opens: { scene: 'press_conference' },
        touch: {
          hand: 'R',
          point: [14.7, 1.05, 1.45],
          normal: [0, 0, -1],
          kind: 'handle',
        },
      },
      {
        id: 'door_dressing',
        name: 'Dressing Room',
        position: [-5, 1.1, -1.45],
        radius: 1.0,
        room: 'corridor',
        opens: { screen: 'squad' },
        touch: {
          hand: 'L',
          point: [-4.7, 1.05, -1.45],
          normal: [0, 0, 1],
          kind: 'handle',
        },
      },
      {
        id: 'door_training',
        name: 'Training Ground Exit',
        position: [39.5, 1.1, 0],
        radius: 1.2,
        room: 'corridor',
        opens: { screen: 'training' },
        touch: {
          hand: 'R',
          point: [39.5, 1.05, 0.4],
          normal: [-1, 0, 0],
          kind: 'handle',
        },
      },
    ],
  },

  office: {
    id: 'office',
    name: 'Manager Office',
    bounds: {
      min: [-17, 0, 1.5],
      max: [-7, 3.2, 9.5],
    },
    doorPosition: [-12, 1.1, 1.5],
    cameraRail: {
      position: [-12, 1.6, 3.6],
      target: [-12, 1.15, 7.4],
      fov: 48,
    },
    hotspots: [
      {
        id: 'desk_hub',
        name: 'Manager Desk',
        position: [-12, 0.75, 7.3],
        radius: 1.3,
        room: 'office',
        opens: { screen: 'hub' },
        touch: {
          hand: 'auto',
          point: [-12, 0.76, 6.7],
          normal: [0, 1, 0],
          kind: 'rest',
        },
      },
      {
        id: 'whiteboard_tactics',
        name: 'Tactics Board',
        position: [-7.2, 1.5, 5.5],
        radius: 1.1,
        room: 'office',
        opens: { screen: 'tactics' },
        touch: {
          hand: 'R',
          point: [-7.25, 1.5, 5.5],
          normal: [-1, 0, 0],
          kind: 'brush',
        },
      },
      {
        id: 'wall_tv',
        name: 'Wall Broadcast TV',
        position: [-16.8, 1.7, 5.5],
        radius: 1.3,
        room: 'office',
        opens: { screen: 'league' },
      },
      {
        id: 'office_door',
        name: 'Corridor Door',
        position: [-12, 1.1, 1.55],
        radius: 0.9,
        room: 'office',
        opens: { screen: 'hub' },
        touch: {
          hand: 'L',
          point: [-11.7, 1.05, 1.55],
          normal: [0, 0, 1],
          kind: 'handle',
        },
      },
    ],
  },

  boardroom: {
    id: 'boardroom',
    name: 'Boardroom',
    bounds: {
      min: [-5, 0, 1.5],
      max: [5, 3.2, 11.5],
    },
    doorPosition: [0, 1.1, 1.5],
    cameraRail: {
      position: [0, 1.55, 3.2],
      target: [0, 1.25, 8.2],
      fov: 45,
    },
    hotspots: [
      {
        id: 'board_table',
        name: 'Board Table',
        position: [0, 0.75, 7.5],
        radius: 1.8,
        room: 'boardroom',
        opens: { screen: 'boardMeeting' },
        touch: {
          hand: 'auto',
          point: [0, 0.76, 5.5],
          normal: [0, 1, 0],
          kind: 'rest',
        },
      },
      {
        id: 'board_door',
        name: 'Corridor Door',
        position: [0, 1.1, 1.55],
        radius: 0.9,
        room: 'boardroom',
        touch: {
          hand: 'L',
          point: [0.3, 1.05, 1.55],
          normal: [0, 0, 1],
          kind: 'handle',
        },
      },
    ],
  },

  dressing: {
    id: 'dressing',
    name: 'Dressing Room',
    bounds: {
      min: [-15, 0, -12.5],
      max: [5, 3.5, -1.5],
    },
    doorPosition: [-5, 1.1, -1.5],
    cameraRail: {
      position: [-5, 1.7, -3.2],
      target: [-5, 1.15, -8.2],
      fov: 54,
    },
    hotspots: [
      {
        id: 'dressing_board',
        name: 'Briefing Tactics Stand',
        position: [-2.0, 1.4, -6.0],
        radius: 1.1,
        room: 'dressing',
        opens: { screen: 'preMatch' },
        touch: {
          hand: 'R',
          point: [-2.0, 1.4, -5.8],
          normal: [0, 0, 1],
          kind: 'brush',
        },
      },
      {
        id: 'tunnel_exit',
        name: 'Tunnel to Pitch',
        position: [-5, 1.1, -12.3],
        radius: 1.2,
        room: 'dressing',
        opens: { screen: 'match' },
      },
      {
        id: 'dressing_door',
        name: 'Corridor Door',
        position: [-5, 1.1, -1.55],
        radius: 0.9,
        room: 'dressing',
        touch: {
          hand: 'R',
          point: [-5.3, 1.05, -1.55],
          normal: [0, 0, -1],
          kind: 'handle',
        },
      },
    ],
  },

  tunnel: {
    id: 'tunnel',
    name: 'Tunnel',
    bounds: {
      min: [-7, 0, -24.5],
      max: [-3, 3.0, -12.5],
    },
    doorPosition: [-5, 1.1, -12.5],
    cameraRail: {
      position: [-5, 1.5, -14.0],
      target: [-5, 1.2, -24.0],
      fov: 50,
    },
    hotspots: [
      {
        id: 'tunnel_pitch_light',
        name: 'Pitch Light Entrance',
        position: [-5, 1.1, -24.2],
        radius: 1.5,
        room: 'tunnel',
        opens: { screen: 'match' },
      },
    ],
  },

  training: {
    id: 'training',
    name: 'Training Ground',
    bounds: {
      min: [40, 0, -20],
      max: [100, 12, 40],
    },
    doorPosition: [40, 1.1, 0],
    cameraRail: {
      position: [52, 2.0, 10.0],
      target: [68, 1.1, 10.0],
      fov: 52,
    },
    hotspots: [
      {
        id: 'training_clipboard',
        name: 'Training Clipboard',
        position: [50.5, 1.0, 8.5],
        radius: 0.9,
        room: 'training',
        opens: { screen: 'training' },
        touch: {
          hand: 'auto',
          point: [50.5, 1.0, 8.5],
          normal: [0, 1, 0],
          kind: 'rest',
        },
      },
      {
        id: 'training_drills',
        name: 'Drill Pitch Area',
        position: [68, 0.5, 10],
        radius: 6.0,
        room: 'training',
        opens: { screen: 'training' },
      },
    ],
  },

  press: {
    id: 'press',
    name: 'Press Room',
    bounds: {
      min: [10, 0, 1.5],
      max: [20, 3.2, 9.5],
    },
    doorPosition: [15, 1.1, 1.5],
    cameraRail: {
      position: [15, 1.45, 3.5],
      target: [15, 1.2, 7.8],
      fov: 50,
    },
    hotspots: [
      {
        id: 'press_table',
        name: 'Press Table & Microphones',
        position: [15, 0.75, 7.5],
        radius: 1.4,
        room: 'press',
        opens: { scene: 'press_conference' },
        touch: {
          hand: 'auto',
          point: [15, 0.76, 6.9],
          normal: [0, 1, 0],
          kind: 'rest',
        },
      },
      {
        id: 'press_door',
        name: 'Corridor Door',
        position: [15, 1.1, 1.55],
        radius: 0.9,
        room: 'press',
        touch: {
          hand: 'L',
          point: [15.3, 1.05, 1.55],
          normal: [0, 0, 1],
          kind: 'handle',
        },
      },
    ],
  },
};

/** Screen to Room Mapping (§11.25.1) */
export function getRoomForScreen(screen: string): RoomId {
  switch (screen) {
    case 'title':
    case 'newGame':
      return 'exterior';
    case 'boardMeeting':
    case 'sacked':
      return 'boardroom';
    case 'squad':
    case 'preMatch':
    case 'fullTime':
      return 'dressing';
    case 'training':
      return 'training';
    case 'press':
      return 'press';
    case 'match':
      return 'tunnel';
    case 'hub':
    case 'inbox':
    case 'club':
    case 'transfers':
    case 'tactics':
    case 'league':
    case 'fixtures':
    case 'weekSummary':
    default:
      return 'office';
  }
}

/** Builds procedural 3D shell for a room */
export function buildRoomMesh(roomId: RoomId): THREE.Group {
  const group = new THREE.Group();
  group.name = `Room_${roomId}`;
  const def = ROOM_DEFINITIONS[roomId];
  const b = def.bounds;
  const w = b.max[0] - b.min[0];
  const h = b.max[1] - b.min[1];
  const d = b.max[2] - b.min[2];
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;

  // Floor material & mesh
  const floorGeo = new THREE.PlaneGeometry(w, d);
  floorGeo.rotateX(-Math.PI / 2);
  const floorColor = roomId === 'training' ? 0x2e5628 : roomId === 'office' ? 0x221c17 : 0x1f232a;
  const floorMat = new THREE.MeshStandardMaterial({
    color: floorColor,
    roughness: roomId === 'training' ? 0.9 : 0.7,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(cx, b.min[1], cz);
  floor.receiveShadow = true;
  group.add(floor);

  // Ceiling for indoor rooms
  if (roomId !== 'exterior' && roomId !== 'training') {
    const ceilGeo = new THREE.PlaneGeometry(w, d);
    ceilGeo.rotateX(Math.PI / 2);
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x181a1e,
      roughness: 0.9,
    });
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.position.set(cx, b.max[1], cz);
    group.add(ceil);
  }

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({
    color: roomId === 'office' ? 0x2a2824 : roomId === 'boardroom' ? 0x281e18 : 0x242830,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Back wall (max Z)
  const backGeo = new THREE.BoxGeometry(w, h, 0.15);
  const backWall = new THREE.Mesh(backGeo, wallMat);
  backWall.position.set(cx, cy, b.max[2]);
  group.add(backWall);

  // Left wall (min X)
  const leftGeo = new THREE.BoxGeometry(0.15, h, d);
  const leftWall = new THREE.Mesh(leftGeo, wallMat);
  leftWall.position.set(b.min[0], cy, cz);
  group.add(leftWall);

  // Right wall (max X)
  const rightGeo = new THREE.BoxGeometry(0.15, h, d);
  const rightWall = new THREE.Mesh(rightGeo, wallMat);
  rightWall.position.set(b.max[0], cy, cz);
  group.add(rightWall);

  // Front wall (min Z, with door gap if corridor/room boundary)
  const frontGeo = new THREE.BoxGeometry(w, h, 0.15);
  const frontWall = new THREE.Mesh(frontGeo, wallMat);
  frontWall.position.set(cx, cy, b.min[2]);
  group.add(frontWall);

  // Room-specific props (procedural fallbacks)
  if (roomId === 'office') {
    // Desk
    const deskGeo = new THREE.BoxGeometry(2.2, 0.74, 1.2);
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x3d2719, roughness: 0.4 });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.set(-12, 0.37, 7.3);
    desk.castShadow = true;
    desk.receiveShadow = true;
    group.add(desk);

    // Whiteboard
    const wbGeo = new THREE.BoxGeometry(0.04, 1.2, 2.0);
    const wbMat = new THREE.MeshStandardMaterial({ color: 0xededed, roughness: 0.2 });
    const wb = new THREE.Mesh(wbGeo, wbMat);
    wb.position.set(-7.22, 1.5, 5.5);
    group.add(wb);

    // Wall TV
    const tvGeo = new THREE.BoxGeometry(0.06, 1.0, 1.6);
    const tvMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.1 });
    const tv = new THREE.Mesh(tvGeo, tvMat);
    tv.position.set(-16.92, 1.7, 5.5);
    group.add(tv);
  } else if (roomId === 'dressing') {
    // Crest on floor
    const crestGeo = new THREE.CircleGeometry(1.6, 24);
    crestGeo.rotateX(-Math.PI / 2);
    const crestMat = new THREE.MeshBasicMaterial({ color: 0xf2b705 });
    const crest = new THREE.Mesh(crestGeo, crestMat);
    crest.position.set(-5, 0.01, -7.0);
    group.add(crest);

    // Tactical flipchart stand
    const standGeo = new THREE.BoxGeometry(0.8, 1.4, 0.05);
    const standMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3 });
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.set(-2.0, 1.2, -6.0);
    stand.rotation.y = -Math.PI / 4;
    group.add(stand);
  } else if (roomId === 'boardroom') {
    // Long table
    const tableGeo = new THREE.BoxGeometry(2.0, 0.74, 5.0);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x2b1a11, roughness: 0.3 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0, 0.37, 7.5);
    table.castShadow = true;
    table.receiveShadow = true;
    group.add(table);
  } else if (roomId === 'press') {
    // Press table with club cloth
    const pTableGeo = new THREE.BoxGeometry(3.6, 0.74, 0.9);
    const pTableMat = new THREE.MeshStandardMaterial({ color: 0x1b2d4f, roughness: 0.5 });
    const pTable = new THREE.Mesh(pTableGeo, pTableMat);
    pTable.position.set(15, 0.37, 7.5);
    pTable.castShadow = true;
    group.add(pTable);
  }

  return group;
}
