// SPEC §11.25.1 Rooms layout, coordinate geometry and room definitions
import * as THREE from 'three';
import { OfficeModel } from './officeModel';
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
        opens: { room: 'office', screen: 'hub' },
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
        opens: { room: 'boardroom', screen: 'boardMeeting' },
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
        opens: { room: 'press', scene: 'press_conference' },
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
        opens: { room: 'dressing', screen: 'squad' },
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
        opens: { room: 'training', screen: 'training' },
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
    // office.glb (docs/design/office): 6.5 m x 8 m, door on the corridor side (z 1.5). Seated at the desk the coach
    // faces the TV (-x); the window (+z) is on his left, the door (-z) on his right. Coordinates from
    // officeToWorld() in officeModel.ts.
    bounds: {
      min: [-15.25, 0, 1.5],
      max: [-8.75, 3.0, 9.5],
    },
    doorPosition: [-12, 1.1, 1.5],
    cameraRail: {
      position: [-14.85, 2.15, 2.0],
      target: [-11.0, 0.9, 6.4],
      fov: 58,
    },
    hotspots: [
      {
        id: 'desk_hub',
        name: 'Manager Desk',
        position: [-10.7, 0.78, 5.5],
        radius: 1.3,
        room: 'office',
        opens: { screen: 'hub' },
        touch: {
          hand: 'auto',
          point: [-10.25, 0.78, 5.5],
          normal: [0, 1, 0],
          kind: 'rest',
        },
        surfaceId: 'desk_surface',
        focusView: {
          position: [-15.0, 2.3, 5.5],
          target: [-10.3, 0.9, 5.5],
          fov: 52,
        },
      },
      {
        id: 'whiteboard_tactics',
        name: 'Tactics Table',
        position: [-13.3, 0.86, 5.5],
        radius: 1.5,
        room: 'office',
        opens: { screen: 'tactics' },
        touch: {
          hand: 'R',
          point: [-12.6, 0.86, 5.5],
          normal: [0, 1, 0],
          kind: 'brush', // the hand follows the magnet across the table screen
        },
        surfaceId: 'screen_table',
        focusView: {
          position: [-12.2, 3.0, 5.5],
          target: [-13.3, 0.85, 5.5],
          fov: 50,
        },
      },
      {
        id: 'wall_tv',
        name: 'Wall Broadcast TV',
        position: [-15.15, 1.75, 5.5],
        radius: 1.3,
        room: 'office',
        opens: { screen: 'league' },
        surfaceId: 'screen_tv',
        focusView: {
          position: [-13.2, 1.75, 5.5],
          target: [-15.2, 1.75, 5.5],
          fov: 40,
        },
      },
      {
        id: 'office_door',
        name: 'Corridor Door',
        position: [-12, 1.1, 1.55],
        radius: 1.2,
        room: 'office',
        opens: { room: 'corridor' },
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
        surfaceId: 'flipchart_surface',
        focusView: {
          position: [-2.0, 1.4, -4.5],
          target: [-2.0, 1.4, -6.0],
          fov: 40,
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

  // Ceiling lights for indoor rooms
  if (roomId !== 'exterior' && roomId !== 'training') {
    const lightColor =
      roomId === 'office' ? 0xffe8cc : roomId === 'boardroom' ? 0xffecd0 : 0xdde6f0;
    const lightIntensity = roomId === 'corridor' ? 1.5 : 2.5;
    const lightCount = roomId === 'corridor' ? 4 : 2;
    const lightY = b.max[1] - 0.15;

    for (let i = 0; i < lightCount; i++) {
      const t = (i + 0.5) / lightCount;
      const lx = b.min[0] + t * w;
      const lz = (b.min[2] + b.max[2]) / 2;
      const light = new THREE.PointLight(lightColor, lightIntensity, w * 1.5);
      light.position.set(lx, lightY, lz);
      group.add(light);

      // Visible fixture
      const fixtureGeo = new THREE.BoxGeometry(0.6, 0.04, 0.3);
      const fixtureMat = new THREE.MeshBasicMaterial({ color: lightColor });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(lx, lightY - 0.02, lz);
      group.add(fixture);
    }
  }

  // Room-specific props
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2719, roughness: 0.4 });
  const woodMahog = new THREE.MeshStandardMaterial({ color: 0x2b1a11, roughness: 0.3 });
  const metalGrey = new THREE.MeshStandardMaterial({
    color: 0x5a5e64,
    roughness: 0.5,
    metalness: 0.3,
  });
  const leather = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.8 });

  if (roomId === 'office') {
    // The real office (office.glb) replaces everything below once it loads; this box room is the fallback.
    group.userData.office = new OfficeModel(group);
    // Desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.74, 1.2), woodDark);
    desk.position.set(-12, 0.37, 7.3);
    desk.castShadow = true;
    desk.receiveShadow = true;
    group.add(desk);

    // Desk chair
    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), leather);
    chairSeat.position.set(-12, 0.48, 6.0);
    group.add(chairSeat);
    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.06), leather);
    chairBack.position.set(-12, 0.78, 5.75);
    group.add(chairBack);

    // Guest chairs (2)
    for (const zOff of [-0.5, 0.5]) {
      const gc = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), fabric);
      gc.position.set(-12 + zOff * 2.0, 0.42, 8.5);
      group.add(gc);
      const gb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.06), fabric);
      gb.position.set(-12 + zOff * 2.0, 0.67, 8.72);
      group.add(gb);
    }

    // Whiteboard on right wall
    const wbFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 2.1), metalGrey);
    wbFrame.position.set(-7.2, 1.5, 5.5);
    group.add(wbFrame);
    const wbSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xededed, roughness: 0.2 }),
    );
    wbSurface.rotation.y = -Math.PI / 2;
    wbSurface.position.set(-7.24, 1.5, 5.5); // camera side of the frame (frame spans x -7.23..-7.17)
    wbSurface.name = 'whiteboard_surface';
    group.add(wbSurface);

    // Wall TV on left wall
    const tvFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.05, 1.65),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 }),
    );
    tvFrame.position.set(-16.92, 1.7, 5.5);
    group.add(tvFrame);
    const tvScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.9),
      new THREE.MeshBasicMaterial({ color: 0x0a1428 }),
    );
    tvScreen.rotation.y = Math.PI / 2;
    tvScreen.position.set(-16.88, 1.7, 5.5); // just in front of the frame face at -16.89
    tvScreen.name = 'tv_surface';
    group.add(tvScreen);

    // Bookshelf on back wall
    const shelfMat = woodDark;
    for (let si = 0; si < 3; si++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.3), shelfMat);
      shelf.position.set(-9.5, 0.6 + si * 0.6, 9.3);
      group.add(shelf);
    }
    // Shelf sides
    for (const sx of [-0.8, 0.8]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.8, 0.3), shelfMat);
      side.position.set(-9.5 + sx, 0.9, 9.3);
      group.add(side);
    }

    // Filing cabinet
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.6), metalGrey);
    cabinet.position.set(-15.5, 0.55, 8.8);
    cabinet.castShadow = true;
    group.add(cabinet);

    // Coat hooks on wall near door
    const hookRail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.06), woodDark);
    hookRail.position.set(-13.5, 1.8, 1.65);
    group.add(hookRail);
  } else if (roomId === 'dressing') {
    // Crest on floor
    const crestGeo = new THREE.CircleGeometry(1.6, 24);
    crestGeo.rotateX(-Math.PI / 2);
    const crest = new THREE.Mesh(crestGeo, new THREE.MeshBasicMaterial({ color: 0xf2b705 }));
    crest.position.set(-5, 0.01, -7.0);
    group.add(crest);

    // Benches along walls (L-shaped)
    const benchMat = woodDark;
    for (const bx of [-13, -8, -3, 2]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.42, 0.5), benchMat);
      bench.position.set(bx, 0.21, -11.5);
      group.add(bench);
    }
    for (const bx of [-13, -8, -3, 2]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.42, 0.5), benchMat);
      bench.position.set(bx, 0.21, -2.5);
      group.add(bench);
    }

    // Lockers along back wall
    const lockerMat = metalGrey;
    for (let li = 0; li < 16; li++) {
      const locker = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.0, 0.4), lockerMat);
      locker.position.set(-14.0 + li * 1.15, 1.0, -12.1);
      group.add(locker);
    }

    // Tactical flipchart stand
    const standBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 1.3),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3 }),
    );
    standBoard.position.set(-2.0, 1.3, -5.97);
    standBoard.name = 'flipchart_surface';
    group.add(standBoard);
    const standLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6), metalGrey);
    standLeg.position.set(-2.0, 0.9, -6.1);
    group.add(standLeg);
  } else if (roomId === 'boardroom') {
    // Long table
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.74, 5.0), woodMahog);
    table.position.set(0, 0.37, 7.5);
    table.castShadow = true;
    table.receiveShadow = true;
    group.add(table);

    // Chairs around table (8 total)
    for (let ci = 0; ci < 4; ci++) {
      const cz = 5.5 + ci * 1.2;
      for (const side of [-1, 1]) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), leather);
        seat.position.set(side * 1.5, 0.42, cz);
        group.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.06), leather);
        back.position.set(side * 1.5, 0.67, cz + side * -0.22);
        group.add(back);
      }
    }

    // Framed photos on back wall
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.5 });
    for (let fi = 0; fi < 3; fi++) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.04), frameMat);
      frame.position.set(-2.0 + fi * 2.0, 2.0, 11.4);
      group.add(frame);
      const photo = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.45, 0.01),
        new THREE.MeshBasicMaterial({ color: 0x1a1510 }),
      );
      photo.position.set(-2.0 + fi * 2.0, 2.0, 11.37);
      group.add(photo);
    }
  } else if (roomId === 'press') {
    // Press table
    const pTable = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.74, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x1b2d4f, roughness: 0.5 }),
    );
    pTable.position.set(15, 0.37, 7.5);
    pTable.castShadow = true;
    group.add(pTable);

    // Microphones on table
    for (const mx of [-0.6, 0, 0.6]) {
      const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), metalGrey);
      mic.position.set(15 + mx, 0.92, 7.5);
      group.add(mic);
      const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), metalGrey);
      micHead.position.set(15 + mx, 1.1, 7.5);
      group.add(micHead);
    }

    // Backdrop panel
    const backdrop = new THREE.Mesh(
      new THREE.BoxGeometry(4.0, 2.4, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.9 }),
    );
    backdrop.position.set(15, 1.6, 9.3);
    group.add(backdrop);

    // Journalist chairs (3 rows)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        const jc = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), fabric);
        jc.position.set(13 + col * 1.0, 0.42 + row * 0.15, 4.5 - row * 1.2);
        group.add(jc);
      }
    }
  } else if (roomId === 'corridor') {
    // Doors along walls (visual indicators)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 0.5 });
    const doorPositions = [
      { x: -12, z: 1.42, label: 'MANAGER' },
      { x: 0, z: 1.42, label: 'BOARDROOM' },
      { x: 15, z: 1.42, label: 'PRESS' },
      { x: -5, z: -1.42, label: 'DRESSING' },
    ];
    for (const dp of doorPositions) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.1), doorMat);
      door.position.set(dp.x, 1.05, dp.z);
      group.add(door);
      // Door frame
      const frameMat2 = new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 0.6 });
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.14), frameMat2);
      frameTop.position.set(dp.x, 2.14, dp.z);
      group.add(frameTop);
    }

    // Skirting board along walls
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.7 });
    const skirtFront = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.03), skirtMat);
    skirtFront.position.set(cx, 0.06, b.max[2] - 0.08);
    group.add(skirtFront);
    const skirtBack = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.03), skirtMat);
    skirtBack.position.set(cx, 0.06, b.min[2] + 0.08);
    group.add(skirtBack);
  } else if (roomId === 'tunnel') {
    // Tunnel walls narrowing toward pitch
    const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.9 });
    // Pitch light at the end (emissive glow)
    const pitchGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 3),
      new THREE.MeshBasicMaterial({ color: 0x3a5a2e }),
    );
    pitchGlow.position.set(-5, 1.5, -24.3);
    group.add(pitchGlow);

    const pitchLight = new THREE.PointLight(0x88bb66, 3, 15);
    pitchLight.position.set(-5, 2.0, -24);
    group.add(pitchLight);
  }

  return group;
}
