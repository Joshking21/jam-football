// Recaptures Tactics screen screenshots for v5 layout into docs/screens/M3/
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const RESOLUTIONS = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = path.resolve(process.cwd(), 'docs/screens/M3');

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
      '--virtual-time-budget=2000',
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
    stdio: 'ignore',
  });

  await sleep(3000);

  try {
    for (const res of RESOLUTIONS) {
      const url = `http://localhost:4173/?screen=tactics&club=c01`;
      const fileName = `tactics-${res.width}.png`;
      const filePath = path.join(OUT_DIR, fileName);

      process.stdout.write(`Capturing ${fileName}... `);
      await captureScreenshot(url, filePath, res.width, res.height);
      const stat = fs.statSync(filePath);
      console.log(`OK (${(stat.size / 1024).toFixed(1)} KB)`);
    }
    console.log('Tactics v5 screenshots successfully captured.');
  } finally {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', server.pid?.toString() ?? '', '/f', '/t'], { stdio: 'ignore' });
    } else {
      server.kill();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
