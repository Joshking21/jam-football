// Automated screenshot capture for M4 per SPEC §19.8:
// Saves screenshots of every screen at 1280x720, 1920x1080, and 2560x1440 into docs/screens/M4/
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const SCREENS = [
  'title',
  'newGame',
  'boardMeeting',
  'hub',
  'squad',
  'tactics',
  'training',
  'transfers',
  'league',
  'fixtures',
  'club',
  'inbox',
  'preMatch',
  'match',
  'weekSummary',
  'seasonEnd',
  'sacked',
];

const RESOLUTIONS = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = path.resolve(process.cwd(), 'docs/screens/M4');

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
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--window-size=${width},${height}`,
      `--screenshot=${outPath}`,
      '--virtual-time-budget=2500',
      url,
    ];

    execFile(EDGE_PATH, args, (err) => {
      if (err && !fs.existsSync(outPath)) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log('Starting preview server on port 4173...');
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

  console.log(
    `Capturing ${SCREENS.length} screens at 3 resolutions (total ${SCREENS.length * RESOLUTIONS.length} screenshots)...`,
  );

  try {
    for (const screen of SCREENS) {
      for (const res of RESOLUTIONS) {
        const url = `http://localhost:4173/?screen=${screen}&club=c01`;
        const fileName = `${screen}-${res.width}.png`;
        const filePath = path.join(OUT_DIR, fileName);

        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          if (stat.size >= 20000) {
            console.log(
              `Skipping ${fileName} (already exists: ${Math.round(stat.size / 1024)} KB)`,
            );
            continue;
          }
        }

        process.stdout.write(`Capturing ${fileName}... `);
        try {
          await captureScreenshot(url, filePath, res.width, res.height);
          let stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
          if (!stat || stat.size < 20000) {
            await sleep(2000);
            await captureScreenshot(url, filePath, res.width, res.height);
            stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
          }
          if (!stat || stat.size < 20000) {
            throw new Error(
              `Screenshot is too small (${stat?.size ?? 0} bytes) - screen appears empty or solid color`,
            );
          }
          console.log(`OK (${Math.round(stat.size / 1024)} KB)`);
        } catch (err: any) {
          console.log(`FAILED: ${err.message}`);
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

  console.log(`\nAll screenshots saved in ${OUT_DIR}`);
}

main().catch(console.error);
