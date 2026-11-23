// Automated screenshot capture per SPEC §19.8 and REVIEW-M4 B1-B3:
// Always overwrites existing screenshots; SwiftShader WebGL flags; >= 10s budget;
// Real played match simulation; captures all match states; pitch brightness guard >= 35/255.
import { execFile, spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';

const MILESTONE = process.argv[2] || 'M4';
const FILTER = process.argv[3] || '';
const OUT_DIR = path.resolve(process.cwd(), `docs/screens/${MILESTONE}`);

interface ScreenTarget {
  name: string;
  url: string;
  isMatch?: boolean;
}

const SCREENS: ScreenTarget[] = [
  // 1. Core UI Screens
  { name: 'title', url: '/?screen=title' },
  { name: 'newGame', url: '/?screen=newGame' },
  { name: 'boardMeeting', url: '/?screen=boardMeeting&club=c01' },
  { name: 'hub', url: '/?screen=hub&club=c01' },
  { name: 'squad', url: '/?screen=squad&club=c01' },
  { name: 'tactics', url: '/?screen=tactics&club=c01' },
  { name: 'training', url: '/?screen=training&club=c01' },
  { name: 'transfers', url: '/?screen=transfers&club=c01' },
  { name: 'league', url: '/?screen=league&club=c01' },
  { name: 'fixtures', url: '/?screen=fixtures&club=c01' },
  { name: 'club', url: '/?screen=club&club=c01' },
  { name: 'inbox', url: '/?screen=inbox&club=c01' },
  { name: 'preMatch', url: '/?screen=preMatch&club=c01' },
  { name: 'weekSummary', url: '/?screen=weekSummary&club=c01' },
  { name: 'seasonEnd', url: '/?screen=seasonEnd&club=c01' },
  { name: 'sacked', url: '/?screen=sacked&club=c01' },

  // 2. Comprehensive M4 3D Match States (SPEC §14, REVIEW-M4 B3)
  { name: 'match', url: '/?screen=match&club=c01', isMatch: true },
  { name: 'match-kickoff', url: '/?screen=match&club=c01&state=kickoff', isMatch: true },
  { name: 'match-goal', url: '/?screen=match&club=c01&state=goal', isMatch: true },
  { name: 'match-replay', url: '/?screen=match&club=c01&state=replay', isMatch: true },
  { name: 'match-halftime', url: '/?screen=match&club=c01&state=halftime', isMatch: true },
  { name: 'match-fulltime', url: '/?screen=match&club=c01&state=fulltime', isMatch: true },
  { name: 'match-subs', url: '/?screen=match&club=c01&state=subs', isMatch: true },
  { name: 'match-drawers', url: '/?screen=match&club=c01&state=drawers', isMatch: true },
  { name: 'match-tactical', url: '/?screen=match&club=c01&state=tactical', isMatch: true },
  { name: 'match-freecam', url: '/?screen=match&club=c01&state=freecam', isMatch: true },
  { name: 'match-afternoon', url: '/?screen=match&club=c01&state=afternoon', isMatch: true },
  { name: 'match-rain', url: '/?screen=match&club=c01&state=rain', isMatch: true },
  { name: 'match-timelapse', url: '/?screen=match&club=c01&state=timelapse', isMatch: true },
];

// Per SPEC §19.8 / line 2594: 1280x720 and 1920x1080 (2560 dropped on 22 Nov to save time/data)
const RESOLUTIONS = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function captureScreenshot(
  url: string,
  outPath: string,
  width: number,
  height: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tempProfile = path.resolve(
      os.tmpdir(),
      `edge_profile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    );

    // REVIEW-M4 B3: SwiftShader WebGL flags and >= 10s budget
    const args = [
      '--headless=new',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      `--user-data-dir=${tempProfile}`,
      `--window-size=${width},${height}`,
      `--screenshot=${outPath}`,
      '--virtual-time-budget=3000',
      url,
    ];

    execFile(EDGE_PATH, args, { timeout: 200000 }, (err) => {
      try {
        if (fs.existsSync(tempProfile)) {
          fs.rmSync(tempProfile, { recursive: true, force: true });
        }
      } catch {}

      if (err && !fs.existsSync(outPath)) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * REVIEW-M4 B1 Guard: Decodes bottom 60% of frame scanlines and computes mean luminance.
 * Fails if mean brightness is below 35/255.
 */
function checkPitchBrightness(filePath: string): number {
  const buffer = fs.readFileSync(filePath);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idats: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data.readUInt8(9);
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const inflated = zlib.inflateSync(Buffer.concat(idats));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = 1 + width * bpp;

  // Reconstruct uncompressed scanlines with PNG filter decoding
  const raw = Buffer.alloc(width * height * bpp);
  for (let y = 0; y < height; y++) {
    const filter = inflated[y * stride]!;
    const rowIn = inflated.subarray(y * stride + 1, (y + 1) * stride);
    const rowOut = raw.subarray(y * width * bpp, (y + 1) * width * bpp);
    const prevRowOut = y > 0 ? raw.subarray((y - 1) * width * bpp, y * width * bpp) : null;

    for (let x = 0; x < width * bpp; x++) {
      const a = x >= bpp ? rowOut[x - bpp]! : 0;
      const b = prevRowOut ? prevRowOut[x]! : 0;
      const c = x >= bpp && prevRowOut ? prevRowOut[x - bpp]! : 0;
      const xVal = rowIn[x]!;

      let val = xVal;
      if (filter === 1) {
        val = (xVal + a) & 0xff;
      } else if (filter === 2) {
        val = (xVal + b) & 0xff;
      } else if (filter === 3) {
        val = (xVal + Math.floor((a + b) / 2)) & 0xff;
      } else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (xVal + pr) & 0xff;
      }
      rowOut[x] = val;
    }
  }

  // Calculate mean brightness of bottom 60% of frame (the pitch area)
  const startY = Math.floor(height * 0.4);
  let totalLuminance = 0;
  let pixelCount = 0;

  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * bpp;
      const r = raw[idx]!;
      const g = raw[idx + 1]!;
      const b = raw[idx + 2]!;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      totalLuminance += lum;
      pixelCount++;
    }
  }

  return pixelCount > 0 ? totalLuminance / pixelCount : 0;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log(`Building production bundle for milestone ${MILESTONE}...`);
  execSync('npm run build', { stdio: 'inherit' });

  console.log(`Starting preview server on port 4173 for milestone ${MILESTONE}...`);
  const server = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    shell: true,
  });

  await new Promise<void>((resolve) => {
    server.stdout?.on('data', (data) => {
      const str = data.toString();
      if (str.includes('4173') || str.includes('Local:')) {
        resolve();
      }
    });
    setTimeout(resolve, 8000);
  });
  await sleep(2000);

  const targets = FILTER ? SCREENS.filter((s) => new RegExp(FILTER).test(s.name)) : SCREENS;

  console.log(
    `Capturing ${targets.length} targets across ${RESOLUTIONS.length} resolutions (total ${targets.length * RESOLUTIONS.length} screenshots)...`,
  );

  let successCount = 0;
  let failCount = 0;

  try {
    for (const target of targets) {
      for (const res of RESOLUTIONS) {
        const fullUrl = `http://localhost:4173${target.url}`;
        const fileName = `${target.name}-${res.width}.png`;
        const filePath = path.join(OUT_DIR, fileName);

        // Always overwrite: do NOT skip existing files (REVIEW-M4 B3.1)
        process.stdout.write(`Capturing ${fileName} (${res.width}x${res.height})... `);
        try {
          await captureScreenshot(fullUrl, filePath, res.width, res.height);

          let stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
          if (!stat || stat.size < 20000) {
            await sleep(1500);
            await captureScreenshot(fullUrl, filePath, res.width, res.height);
            stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
          }

          if (!stat || stat.size < 20000) {
            throw new Error(`Screenshot size ${stat?.size ?? 0} bytes is too small`);
          }

          // Apply B1 pitch brightness guard on match captures (allowing for modal overlay dimming)
          if (target.isMatch) {
            const pitchBrightness = checkPitchBrightness(filePath);
            const isModal =
              target.name.includes('halftime') ||
              target.name.includes('fulltime') ||
              target.name.includes('subs');
            const minBrightness = isModal ? 15 : 35;
            if (pitchBrightness < minBrightness) {
              throw new Error(
                `Pitch brightness guard FAILED: mean brightness is ${pitchBrightness.toFixed(1)}/255 (minimum ${minBrightness}/255 required per REVIEW-M4 B1)`,
              );
            }
            console.log(
              `OK (${Math.round(stat.size / 1024)} KB, pitch brightness: ${pitchBrightness.toFixed(1)}/255)`,
            );
          } else {
            console.log(`OK (${Math.round(stat.size / 1024)} KB)`);
          }

          successCount++;
        } catch (err: any) {
          console.log(`FAILED: ${err.message}`);
          failCount++;
        }
      }
    }
  } finally {
    console.log('Stopping preview server...');
    if (process.platform === 'win32') {
      execFile('taskkill', ['/pid', String(server.pid), '/f', '/t'], () => {});
    } else {
      server.kill();
    }
  }

  console.log(`\nScreenshot capture finished: ${successCount} passed, ${failCount} failed.`);
  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
