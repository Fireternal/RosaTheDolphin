#!/usr/bin/env node
/**
 * End-to-end QA for Melodía II — La Tenerife LanD Party.
 *
 * Menu → level select → intro → every activity (jargon choices, Kevin's rhythm
 * match, hidden fragment, cosplay pieces + contest, K-Pop dance, TLP Innova talk,
 * the router "fix" and the city blackout) → closing melody on the main stage →
 * ending. Travel uses the debug teleport; everything else is the real game logic.
 *
 * Usage: npm run dev, then  QA_URL=http://localhost:5173 npm run qa:tlp
 *        (QA_RENDERER=canvas is faster on machines without a GPU)
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL = process.env.QA_URL ?? 'http://localhost:5173';
const RENDERER = process.env.QA_RENDERER ?? 'webgl';
const OUT = new globalThis.URL('../qa-output/tlp/', import.meta.url).pathname;
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
    if (s && s.level === 'tlp' && pred(s)) return s;
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
/**
 * Plays through dialogue, choices (picks `choice`) and the rhythm game until the game is free.
 * `onChoice` / `onRhythm` let a test take a screenshot the first time one shows up.
 */
async function settle(timeout = 90000, opts = {}) {
  const t0 = Date.now();
  let sawChoice = false;
  let sawRhythm = false;
  while (Date.now() - t0 < timeout) {
    const s = await state();
    if (!s) return;
    if (s.rhythm) {
      if (!sawRhythm) { sawRhythm = true; await sleep(2500); await opts.onRhythm?.(); }
      await press(['1', '2', '3'][Math.floor(Math.random() * 3)], 40);
      await sleep(80);
      continue;
    }
    if (s.choice) {
      if (!sawChoice) { sawChoice = true; await sleep(600); await opts.onChoice?.(); }
      await press(String(opts.choice ?? 1));
    } else if (s.dialogue) await press('e');
    else if (!s.busy && !s.puzzle) {
      await sleep(400);
      const s2 = await state();
      if (s2 && !s2.dialogue && !s2.busy && !s2.rhythm) return;
    }
    await sleep(350);
  }
}
async function openPuzzle(id, timeout = 90000) {
  await press('e');
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const st = await state();
    if (st.puzzle === id && !st.puzzleBusy) return st;
    if (st.dialogue) await press('e');
    await sleep(400);
  }
  return null;
}
async function playMelody(digits) {
  for (const d of digits) {
    await press(d, 80);
    await sleep(380);
  }
}
/** Waits for a condition, reading any dialogue that shows up meanwhile. */
async function untilTalking(pred, timeout = 150000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const st = await state();
    if (st && st.level === 'tlp' && pred(st)) return st;
    if (st?.dialogue) await press('e');
    await sleep(500);
  }
  return null;
}
async function collect(id, x, y, timeout = 20000) {
  await teleport(x, y);
  return !!(await waitFor((s) => s.fragments.includes(id), timeout));
}

try {
  // ---------------------------------------------------------------- menu → level 2
  await page.goto(`${URL}/?debug${RENDERER === 'canvas' ? '&canvas' : ''}`);
  await page.waitForFunction(() => window.__ROSA__?.game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await page.evaluate(() => localStorage.clear());
  await sleep(5000);
  await press('Enter');
  await sleep(1500);
  await snap('level-select');
  check('JUGAR shows the level select', await page.evaluate(() => window.__ROSA__.game.scene.getScene('MenuScene').levels.visible));
  await press('ArrowDown');
  await sleep(300);
  await press('Enter');
  await page.waitForFunction(() => window.__ROSA__.game.scene.isActive('IntroScene'), null, { timeout: 30000 });
  await sleep(3500);
  await snap('intro');
  await press('Space');
  await page.waitForFunction(() => window.__ROSA__.game.scene.isActive('TLPScene'), null, { timeout: 90000 });
  check('Melodía II starts the Tenerife LanD Party', true);
  let s = await waitFor((st) => st.dialogue, 60000);
  check('The organiser greets Rosa', !!s);
  await sleep(1500);
  await snap('intro-dialogue');
  await settle();
  s = await state();
  check('Rosa says "LanD" and gets corrected', s.counters.corrections >= 1, `corrections=${s.counters.corrections}`);
  check('Welcome thank-you', s.missions.includes('welcome') && s.gratitude >= 1);
  check('Objective: activities and fragments', /fragmentos/.test(s.objective), s.objective);
  check('Web Audio running', s.audio === 'running', s.audio);

  // ---------------------------------------------------------------- swim + explore
  const x0 = s.rosa.x;
  await page.keyboard.down('d');
  await sleep(2000);
  await page.keyboard.up('d');
  s = await state();
  check('Rosa swims in the flooded hall', s.rosa.x - x0 > 60, `dx=${s.rosa.x - x0}`);
  check('Fragment 1 (above the entrance banner)', await collect('t-entrada', 1250, 520));
  await teleport(1250, 700);
  await sleep(1200);
  await snap('windows-city');

  // ---------------------------------------------------------------- jargon (choices)
  await teleport(1250, 1810);
  await press('e');
  s = await waitFor((st) => st.choice, 20000);
  check('Telepera asks "PC o consola" (multiple choice)', !!s);
  await snap('choice');
  await settle(60000, { choice: 3 });
  s = await state();
  check('Answering raises the Postureo', s.counters.postureo >= 25, `postureo=${s.counters.postureo}`);
  check('…and she gets corrected again', s.counters.corrections >= 2, `corrections=${s.counters.corrections}`);
  await teleport(1255, 1150);
  await press('e');
  await settle(60000, { choice: 1 });
  check('Telepero: "una ranked"', !!(await state()).flags.jargonB);

  // ---------------------------------------------------------------- Kevin: rhythm game → "GG"
  await teleport(2420, 1180);
  await press('e');
  await settle(180000, { onRhythm: () => snap('rhythm') });
  s = await state();
  check('Kevin\'s match ends with "GG" (thank-you)', s.missions.includes('gg'), `missions=${s.missions}`);
  check('Fragment 3 (from Kevin)', await collect('t-gg', 2420, 1060, 30000));

  // hidden fragment under the desks
  await teleport(2130, 1780);
  await sleep(800);
  check('Hidden fragment not collectable before the sonar', !(await state()).fragments.includes('t-cable'));
  await press('q');
  await sleep(2500);
  check('Fragment 2 (under the desks, sonar)', await collect('t-cable', 2130, 1900));

  // ---------------------------------------------------------------- cosplay
  await teleport(3200, 1740);
  await press('e');
  await settle();
  check('The jury asks for a full costume first', !(await state()).missions.includes('cosplay'));
  for (const [id, x, y] of [['crown', 1850, 760], ['cape', 3420, 880], ['trident', 4720, 1860]]) {
    await teleport(x, y - 220);
    await sleep(500);
    // the sonar may still be cooling down: ping until the piece shows up
    for (let k = 0; k < 12 && !(await state()).revealedCostumes.includes(id); k++) {
      await press('q');
      await sleep(1500);
    }
    await teleport(x, y);
    s = await waitFor((st) => st.costumes.includes(id), 10000);
    const dbg = s ? '' : JSON.stringify(await page.evaluate(() => {
      const sc = window.__ROSA__.scene;
      const st = window.__ROSA__.state();
      return {
        rosa: st.rosa, busy: st.busy, dialogue: st.dialogue, rev: st.revealedCostumes, puzzle: st.puzzle, rhythm: st.rhythm, choice: st.choice,
        paused: sc.ui.paused, ready: sc.ready, cd: sc.sonar.cooldown, pulses: sc.sonar.pulses.length, targets: sc.sonar.targets.size,
        cin: sc.cinematic, items: sc.costumes.map((c) => [c.id, Math.round(c.item.x), Math.round(c.item.y)]),
      };
    }));
    check(`Costume piece: ${id}`, !!s, dbg);
  }
  await sleep(800);
  await snap('costume-worn');
  await teleport(3200, 1740);
  await press('e');
  let cosShot = false;
  const tc = Date.now();
  while (Date.now() - tc < 150000) {
    const st = await state();
    if (st.missions.includes('cosplay') && !st.busy) break;
    if (!cosShot && st.dialogue && st.gratitude >= 3) { cosShot = true; await snap('cosplay'); }
    if (st.dialogue) await press('e');
    await sleep(500);
  }
  await settle();
  s = await state();
  check('Cosplay: "¡Gracias por participar!"', s.missions.includes('cosplay'));
  check('Fragment 4 (cosplay)', await collect('t-cosplay', 3700, 1480, 30000));

  // ---------------------------------------------------------------- K-Pop dance puzzle
  await teleport(4150, 1830);
  s = await openPuzzle('kpop');
  check('K-Pop Random Play Dance opens', !!s);
  await playMelody(['5', '1']);
  await sleep(1500);
  check('Wrong step does not complete', (await state()).puzzle === 'kpop');
  await press('e');
  await waitFor((st) => st.puzzleBusy, 15000);
  await waitFor((st) => !st.puzzleBusy, 60000);
  await playMelody(['5', '5', '6', '5', '3', '2']);
  s = await untilTalking((st) => st.missions.includes('kpop'));
  await snap('kpop');
  check('K-Pop: thanks (and a meme)', !!s);
  await settle();
  check('Fragment 5 (K-Pop)', await collect('t-kpop', 4420, 1480, 30000));

  // ---------------------------------------------------------------- TLP Innova
  await teleport(4940, 1800);
  await press('e');
  await settle(150000, { choice: 2, onChoice: () => snap('innova') });
  s = await state();
  check('TLP Innova talk (three buzzword answers)', s.missions.includes('innova'));
  check('Postureo keeps climbing', s.counters.postureo >= 80, `postureo=${s.counters.postureo}`);
  check('Fragment 6 (Innova)', await collect('t-innova', 5080, 1480, 30000));

  // ---------------------------------------------------------------- the router → blackout
  await teleport(2900, 1660);
  s = await openPuzzle('router');
  check('Router puzzle opens ("NO TOCAR")', !!s);
  await playMelody(['7', '6', '5', '4', '3', '2', '1']);
  s = await waitFor((st) => st.dark >= 1, 60000);
  check('The "fix" knocks out the network: blackout', !!s);
  await sleep(3500);
  await snap('blackout');
  s = await untilTalking((st) => st.missions.includes('router'));
  await settle();
  check('Teleperos: "¿Gracias… supongo?"', !!s);
  check('Blackout is saved', !!(await state()).flags.blackout);
  check('Fragment 7 (the blackout)', await collect('t-apagon', 2900, 1220, 30000));
  await sleep(3500);
  await settle();
  s = await state();
  check('All seven fragments', s.fragments.length === 7, `${s.fragments.length}`);
  check('Objective: main stage', /escenario/.test(s.objective), s.objective);

  // ---------------------------------------------------------------- save / continue
  await page.reload();
  await page.waitForFunction(() => window.__ROSA__?.game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await sleep(4000);
  await press('ArrowDown');
  await sleep(300);
  await press('Enter');
  await page.waitForFunction(() => window.__ROSA__.game.scene.isActive('TLPScene'), null, { timeout: 90000 });
  s = await waitFor((st) => st.objective, 60000);
  check('CONTINUAR resumes level 2 (fragments, blackout)', s && s.fragments.length === 7 && s.dark === 1, s ? `${s.fragments.length}, dark=${s.dark}` : 'no state');

  // ---------------------------------------------------------------- finale
  await teleport(6030, 1450);
  s = await openPuzzle('final', 150000);
  check('Main stage: generator on, closing melody ready', !!s && s.flags.generator);
  await snap('stage-logo');
  await playMelody(['3', '5', '6', '5', '3', '2', '1']);
  const tEnd = Date.now();
  let grandShot = false;
  while (Date.now() - tEnd < 240000) {
    if ((await activeScenes()).includes('EndingScene')) break;
    const st = await state();
    if (!grandShot && st?.missions.includes('tlp')) { grandShot = true; await sleep(2500); await snap('gracias'); }
    if (st?.dialogue) await press('e');
    await sleep(700);
  }
  check('Grand "¡GRACIAS, ROSA THE DOLPHIN!"', grandShot);
  check('Ending screen reached', (await activeScenes()).includes('EndingScene'));
  await page.waitForFunction(() => window.__ROSA__.game.scene.getScene('EndingScene').ready === true, null, { timeout: 180000 });
  await snap('ending');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rosa-the-dolphin/save/tlp/v1') ?? '{}'));
  check('Level 2 completion saved', saved.completed === true);
  check('Corrections counted', (saved.counters?.corrections ?? 0) >= 3, `${saved.counters?.corrections}`);
} catch (err) {
  check('QA run finished without exceptions', false, String(err?.stack ?? err));
  await snap('failure').catch(() => {});
}

check('No console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
writeFileSync(`${OUT}report.json`, JSON.stringify({ results, consoleErrors }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in qa-output/tlp/`);
await browser.close();
process.exit(failed.length ? 1 : 0);
