#!/usr/bin/env node
/**
 * End-to-end QA for ROSA THE DOLPHIN.
 *
 * Plays the whole vertical slice in a real Chromium with keyboard input:
 * menu → intro → swimming/inertia → sonar → notes → 7 fragments → puzzles
 * (including a deliberate wrong answer) → current → leap above the waves →
 * finale → "¡GRACIAS, ROSA THE DOLPHIN!" → ending → restart. Also checks
 * save/continue and collects console errors.
 *
 * Travel between areas uses the debug `teleport` hook (enabled with ?debug) to
 * keep the run short; every pickup, puzzle and trigger uses the real game logic.
 *
 * Usage: npm run dev (in another terminal), then
 *   npm run qa                          # WebGL (default)
 *   QA_RENDERER=canvas npm run qa       # faster on machines without a GPU (colours/tints are not representative)
 *   QA_URL=http://localhost:5173 CHROME_PATH=/path/to/chrome npm run qa
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL = process.env.QA_URL ?? 'http://localhost:5173';
const RENDERER = process.env.QA_RENDERER ?? 'webgl';
const OUT = new globalThis.URL('../qa-output/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const candidates = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({
  executablePath,
  channel: executablePath ? undefined : 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

const results = [];
let shot = 0;
const sleep = (ms) => page.waitForTimeout(ms);
const state = () => page.evaluate(() => window.__ROSA__?.state?.() ?? null);
const activeScenes = () => page.evaluate(() => window.__ROSA__.game.scene.getScenes(true).map((s) => s.scene.key));
const snap = async (name) => page.screenshot({ path: `${OUT}${String(++shot).padStart(2, '0')}-${name}.png` });
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ' — ' + detail : ''}`);
}
async function waitFor(pred, timeout = 30000, every = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await state();
    if (s && pred(s)) return s;
    await sleep(every);
  }
  return null;
}
async function press(key, hold = 90) {
  await page.keyboard.down(key);
  await sleep(hold);
  await page.keyboard.up(key);
}
async function teleport(x, y) {
  await page.evaluate(([a, b]) => window.__ROSA__.teleport(a, b), [x, y]);
  await sleep(250);
}
/** Advance any open dialogue (and wait out gratitude overlays) until the game is free again. */
async function settle(timeout = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await state();
    if (!s) return;
    if (s.dialogue) await press('e');
    else if (!s.busy) {
      await sleep(400);
      const s2 = await state();
      if (s2 && !s2.dialogue && !s2.busy) return;
    }
    await sleep(350);
  }
}
async function playMelody(digits) {
  for (const d of digits) {
    await press(d, 80);
    await sleep(380);
  }
}

try {
  // ---------------------------------------------------------------- menu
  await page.goto(`${URL}/?debug${RENDERER === 'canvas' ? '&canvas' : ''}`);
  await page.waitForFunction(() => window.__ROSA__?.game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await page.evaluate(() => localStorage.clear());
  await sleep(5000);
  await snap('menu');
  check('Menu loads', (await activeScenes()).includes('MenuScene'));

  // JUGAR → intro → level
  await press('Enter');
  await page.waitForFunction(() => window.__ROSA__.game.scene.isActive('IntroScene'), null, { timeout: 30000 });
  await sleep(3500);
  await snap('intro');
  check('JUGAR opens the intro', true);
  await press('Space');
  await page.waitForFunction(() => window.__ROSA__.game.scene.isActive('GameScene') && window.__ROSA__.state, null, { timeout: 60000 });
  const s0 = await waitFor((s) => s.dialogue, 30000);
  check('Lumi starts the intro dialogue', !!s0);
  await sleep(1500);
  await snap('intro-dialogue');
  await settle();
  let s = await state();
  check('Objective: find the fragments', /fragmentos/.test(s.objective), s.objective);
  check('Web Audio is running (procedural soundtrack)', s.audio === 'running', s.audio);

  // ---------------------------------------------------------------- swimming
  const x0 = s.rosa.x;
  await page.keyboard.down('d');
  await sleep(2200);
  const moving = await state();
  await page.keyboard.up('d');
  await sleep(120);
  const glide = await state();
  check('Rosa swims (D moves her right)', moving.rosa.x - x0 > 60, `dx=${moving.rosa.x - x0}`);
  check('Inertia: still gliding after releasing the key', Math.abs(glide.rosa.vx) > 30, `vx=${glide.rosa.vx}`);
  await sleep(2500);
  const stopped = await state();
  check('Water drag slows her down', Math.abs(stopped.rosa.vx) < Math.abs(glide.rosa.vx), `vx ${glide.rosa.vx} → ${stopped.rosa.vx}`);
  await page.keyboard.down('w');
  await sleep(500);
  await press('Space');
  await sleep(300);
  await page.keyboard.up('w');
  await snap('swim-boost');

  // ---------------------------------------------------------------- notes & first fragments
  await teleport(980, 1010);
  s = await waitFor((st) => st.notes.includes('DO'), 8000);
  check('Note DO collected', !!s);
  await press('1');
  await sleep(600);
  await snap('play-note');
  await teleport(1560, 1180);
  s = await waitFor((st) => st.fragments.includes('f-claro'), 8000);
  check('Fragment 1 (exploration) collected', !!s);
  await teleport(1820, 1500);
  check('Note RE collected', !!(await waitFor((st) => st.notes.includes('RE'), 8000)));

  // hidden note needs the sonar
  await teleport(640, 2440);
  await sleep(1500);
  s = await state();
  check('Hidden note MI is not collectable before the sonar', !s.notes.includes('MI'));
  await teleport(640, 2330);
  await press('q');
  await sleep(1500);
  await snap('sonar');
  await teleport(640, 2440);
  check('Sonar reveals hidden note MI', !!(await waitFor((st) => st.notes.includes('MI'), 10000)));

  // hidden fragment under the ramp
  await teleport(1290, 2470);
  await sleep(1200);
  check('Hidden fragment not collectable before sonar', !(await state()).fragments.includes('f-rampa'));
  await press('q');
  await sleep(2500);
  await teleport(1290, 2590);
  check('Fragment 2 (hidden, sonar) collected', !!(await waitFor((st) => st.fragments.includes('f-rampa'), 10000)));

  // the giant clam opens with the sonar
  await teleport(2550, 2520);
  await sleep(400);
  await press('q');
  check('Sonar wakes the giant clam', !!(await waitFor((st) => st.clamOpen, 10000)));
  await sleep(3500);
  await snap('clam-open');
  await settle();
  await teleport(2550, 2690);
  check('Fragment 3 (clam) collected', !!(await waitFor((st) => st.fragments.includes('f-almeja'), 10000)));
  check('Clam thanks Rosa (gratitude +1)', (await state()).gratitude >= 1);

  await teleport(2880, 1060);
  check('Note FA collected', !!(await waitFor((st) => st.notes.includes('FA'), 8000)));

  // ---------------------------------------------------------------- save / continue
  await sleep(500);
  const before = await state();
  await page.reload();
  await page.waitForFunction(() => window.__ROSA__?.game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await sleep(2500);
  await press('ArrowDown');
  await sleep(300);
  await press('Enter');
  await page.waitForFunction(() => window.__ROSA__.game.scene.isActive('GameScene') && window.__ROSA__.state, null, { timeout: 60000 });
  await sleep(3000);
  s = await state();
  check('CONTINUAR restores progress from localStorage', s.fragments.length === before.fragments.length && s.notes.length === before.notes.length, `fragments ${s.fragments.length}, notes ${s.notes.length}`);
  await settle();

  // ---------------------------------------------------------------- Bruno & Doña Marea
  await teleport(3950, 2350);
  await waitFor((st) => st.prompt === 'marea', 8000);
  await press('e');
  await sleep(800);
  await settle();
  await teleport(1720, 360);
  s = await waitFor((st) => st.prompt === 'bruno', 8000);
  check('Bruno can be found near the surface', !!s);
  await press('e');
  await sleep(800);
  await settle();
  check('Bruno follows Rosa', (await state()).bruno.mode === 'follow');
  // guide him home in short hops so he can keep up
  const path = [[2200, 700], [2700, 1200], [3200, 1700], [3700, 2200], [4250, 2440]];
  for (const [px, py] of path) {
    await teleport(px, py);
    await waitFor((st) => Math.hypot(st.bruno.x - px, st.bruno.y - py) < 320 || st.missions.includes('bruno'), 25000);
  }
  s = await waitFor((st) => st.dialogue || st.missions.includes('bruno'), 20000);
  await sleep(1500);
  await snap('turtles');
  await settle(60000);
  s = await waitFor((st) => st.missions.includes('bruno'), 20000);
  check('Doña Marea thanks Rosa for bringing Bruno', !!s);
  await settle();
  await sleep(2000);
  await teleport(4050, 2380);
  check('Fragment 4 (creature) collected', !!(await waitFor((st) => st.fragments.includes('f-marea'), 10000)));

  // ---------------------------------------------------------------- remaining notes
  await teleport(4720, 2380);
  check('Note SOL collected', !!(await waitFor((st) => st.notes.includes('SOL'), 8000)));
  await teleport(4360, 380);
  check('Note LA collected', !!(await waitFor((st) => st.notes.includes('LA'), 8000)));
  await teleport(4990, 1520);
  await press('q');
  await sleep(1800);
  await teleport(4990, 1640);
  check('Hidden note SI collected after sonar', !!(await waitFor((st) => st.notes.includes('SI'), 10000)));

  // ---------------------------------------------------------------- puzzle 1: coral gate
  await teleport(5160, 2420);
  await page.keyboard.down('d');
  await sleep(2500);
  await page.keyboard.up('d');
  s = await state();
  check('The coral gate blocks the grotto before the puzzle', s.rosa.x < 5300, `x=${s.rosa.x}`);
  await teleport(5050, 2600);
  await waitFor((st) => st.prompt === 'conch', 8000);
  await press('e');
  s = await waitFor((st) => st.puzzle === 'gate' && !st.puzzleBusy, 20000);
  check('Coral gate puzzle plays its melody', !!s);
  await snap('puzzle-gate');
  await playMelody(['1']); // wrong on purpose (melody starts with SOL)
  await sleep(800);
  s = await state();
  check('Wrong note: no penalty, puzzle stays open', s.puzzle === 'gate' && !s.gateOpen);
  await playMelody(['5', '3', '1', '2']); // SOL MI DO RE
  s = await waitFor((st) => st.gateOpen, 45000);
  check('Correct melody opens the coral gate', !!s);
  await sleep(2500);
  await snap('gate-open');
  await settle();
  check('Clownfish family thanks Rosa', (await state()).missions.includes('gate'));
  await teleport(5160, 2420);
  await page.keyboard.down('d');
  s = await waitFor((st) => st.fragments.includes('f-gruta') || st.rosa.x > 5600, 30000);
  await page.keyboard.up('d');
  check('Rosa can now swim into the grotto', !!s, `x=${(await state()).rosa.x}`);
  await teleport(5900, 2480);
  check('Fragment 5 (puzzle) collected', !!(await waitFor((st) => st.fragments.includes('f-gruta'), 10000)));

  // ---------------------------------------------------------------- puzzle 2: tide organ & current
  await teleport(6025, 1250);
  await sleep(2500);
  s = await state();
  check('The downward current keeps Rosa out of the tower', s.rosa.y > 640, `y=${s.rosa.y}`);
  await teleport(5560, 1110);
  await waitFor((st) => st.prompt === 'organ', 8000);
  await press('e');
  s = await waitFor((st) => st.puzzle === 'organ' && !st.puzzleBusy, 20000);
  check('Tide organ puzzle plays its melody', !!s);
  await playMelody(['3', '5', '6', '7']); // MI SOL LA SI
  s = await waitFor((st) => st.currentUp, 45000);
  check('Correct melody reverses the current', !!s);
  await sleep(2500);
  await snap('current-up');
  await settle();
  check('Jellyfish thank Rosa', (await state()).missions.includes('organ'));
  await teleport(6025, 1250);
  s = await waitFor((st) => st.fragments.includes('f-torre'), 40000);
  check('Current lifts Rosa to fragment 6', !!s);

  // ---------------------------------------------------------------- leap above the waves
  let leapOk = null;
  let airborneSeen = false;
  for (let attempt = 0; attempt < 4 && !leapOk; attempt++) {
    await teleport(3700, 420);
    await page.keyboard.down('Shift');
    await page.keyboard.down('w');
    for (let i = 0; i < 40; i++) {
      const st = await state();
      if (st.rosa.y < 170) break;
      await sleep(120);
    }
    await press('Space', 60);
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) {
      const st = await state();
      if (st.rosa.airborne) airborneSeen = true;
      if (st.fragments.includes('f-ola')) { leapOk = st; break; }
      if (airborneSeen && !st.rosa.airborne && st.rosa.y > 120) break;
      await sleep(80);
    }
    await page.keyboard.up('w');
    await page.keyboard.up('Shift');
  }
  check('Rosa breaches the surface (airborne)', airborneSeen);
  check('Fragment 7 (leap above the waves) collected', !!leapOk);

  // ---------------------------------------------------------------- finale
  s = await waitFor((st) => st.statueAwake, 15000);
  check('All 7 fragments awaken the statue', !!s && s.fragments.length === 7, `fragments=${s?.fragments.length}`);
  await settle();
  check('Objective: return to the centre', /Regresa/.test((await state()).objective));
  await teleport(3200, 2240);
  await waitFor((st) => st.prompt === 'statue', 8000);
  await press('e');
  await sleep(600);
  for (let i = 0; i < 20; i++) {
    const st = await state();
    if (st.puzzle === 'final') break;
    if (st.dialogue) await press('e');
    await sleep(400);
  }
  s = await waitFor((st) => st.puzzle === 'final' && !st.puzzleBusy, 40000);
  check('Final melody puzzle starts at the statue', !!s);
  await snap('final-puzzle');
  await playMelody(['5', '6', '5', '3', '4', '2', '1']); // SOL LA SOL MI FA RE DO
  s = await waitFor((st) => st.finaleDone, 15000);
  check('Final melody accepted', !!s);
  await sleep(9000);
  await snap('finale-rotonda');
  await sleep(7000);
  await snap('finale-world');
  s = await waitFor((st) => st.missions.includes('rotonda'), 120000, 400);
  check('¡GRACIAS, ROSA THE DOLPHIN! is shown', !!s);
  await sleep(2500);
  await snap('gracias-rosa');
  // let the moment play, then close dialogues until the ending screen
  const tEnd = Date.now();
  while (Date.now() - tEnd < 150000) {
    const scenes = await activeScenes();
    if (scenes.includes('EndingScene')) break;
    const st = await state();
    if (st?.dialogue) await press('e');
    await sleep(700);
  }
  check('Ending screen reached', (await activeScenes()).includes('EndingScene'));
  await page.waitForFunction(() => window.__ROSA__.game.scene.getScene('EndingScene').ready === true, null, { timeout: 180000 });
  await snap('ending');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rosa-the-dolphin/save/v1') ?? '{}'));
  check('Completion saved', saved.completed === true);

  // ---------------------------------------------------------------- restart
  await page.waitForFunction(() => window.__ROSA__.game.scene.getScene('EndingScene').ready === true, null, { timeout: 180000 });
  await press('Enter');
  await page.waitForFunction(() => window.__ROSA__.game.scene.isActive('IntroScene'), null, { timeout: 90000 });
  check('VOLVER A JUGAR restarts the adventure', true);
  await press('Space');
  await page.waitForFunction(() => window.__ROSA__.game.scene.isActive('GameScene'), null, { timeout: 60000 });
  await sleep(3000);
  s = await state();
  check('Restart begins with a clean slate', s && s.fragments.length === 0 && s.notes.length === 0);
} catch (err) {
  check('QA run finished without exceptions', false, String(err?.stack ?? err));
  await snap('failure').catch(() => {});
}

check('No console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
writeFileSync(`${OUT}report.json`, JSON.stringify({ results, consoleErrors }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in qa-output/`);
await browser.close();
process.exit(failed.length ? 1 : 0);
