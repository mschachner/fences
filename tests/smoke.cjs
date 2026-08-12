const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Fences, FencesRules } = require('../fences-engine.js');
const { FencesGen, easySolves, mediumSolves } = require('../fences-gen.js');
const precomputed = require('../precomputed.js');

const runtimeFiles = ['index.html', 'styles.css', 'fences-engine.js', 'fences-gen.js', 'precomputed.js', 'app.js',
  'favicon.ico', 'favicon.svg', 'apple-touch-icon.png'];
const html = readFileSync('index.html', 'utf8');
const styles = readFileSync('styles.css', 'utf8');
const app = readFileSync('app.js', 'utf8');
const gen = readFileSync('fences-gen.js', 'utf8');
const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

assert.match(html, /href="styles\.css"/);
assert.match(html, /src="fences-engine\.js"/);
assert.match(html, /src="app\.js"/);
assert.match(html, /src="precomputed\.js"/);
assert.match(html, /src="fences-gen\.js"/);
assert.ok(html.indexOf('fences-engine.js') < html.indexOf('app.js'));
assert.ok(html.indexOf('precomputed.js') < html.indexOf('app.js'), 'precomputed data must load before the app');
assert.ok(html.indexOf('fences-engine.js') < html.indexOf('fences-gen.js'), 'the generator needs the engine');
assert.ok(html.indexOf('fences-gen.js') < html.indexOf('app.js'), 'the generator must load before the app');
assert.match(html, /rel="icon" href="favicon\.svg"/);
assert.match(html, /rel="icon" href="favicon\.ico"/);
assert.match(html, /rel="apple-touch-icon"/);
assert.match(html, /id="testBtn"/);
assert.match(html, /id="cluesOnlyBtn"/);
assert.match(html, /id="genBtn"/);
assert.match(html, /id="gDiffSel"/);
assert.match(html, /id="hintBtn"/);
assert.match(html, /id="giveUpBtn"/);
assert.match(html, /id="giveUpDialog"/);
assert.match(html, /id="dotHelperChk"/);
assert.match(html, /id="loopHelperChk"/);
assert.match(html, /class="helpers"/);
assert.ok(runtimeFiles.every(file => workflow.includes(file)), 'deploy workflow must copy every runtime file');
for (const m of html.match(/class="helper-desc">([^<]*)</g).map(s => s.replace(/^[^>]*>|<$/g, '')))
  assert.ok(m.trim().split(/\s+/).length <= 5, `helper description "${m}" must stay within five words`);

assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.hit:hover/);
assert.match(styles, /\.pdot\.in/);
assert.match(styles, /\.confetti/);
assert.match(styles, /\.hintflash/);
assert.match(styles, /\.helper-row input\[type="checkbox"\]/, 'helper toggles get their own styling');
assert.match(app, /DEGREE_HELPER_DELAY_MS = 400/);
assert.match(app, /launchConfetti/);
new Function(app);
new Function(gen);

const engine = new Fences(2, 2, new Set(), { loops: 1, maxSolutions: 2 });
while (!engine.done) engine.run(10);
assert.equal(engine.solutions, 1);
assert.equal(engine.lastSolution.length, 4);

const centerEdges = FencesRules.vertexEdges(3, 3, 4);
assert.deepEqual(centerEdges, [2, 3, 7, 10]);

const blockedMarks = new Int8Array(12);
blockedMarks[2] = blockedMarks[3] = 2;
const blockedResult = FencesRules.applyDegree2(3, 3, new Set(), blockedMarks);
assert.equal(blockedResult.marks[7], 1);
assert.equal(blockedResult.marks[10], 1);
assert.equal(blockedMarks[7], 0, 'degree helper must not mutate its input');

const fenceMarks = new Int8Array(12);
fenceMarks[2] = fenceMarks[3] = 1;
const fenceResult = FencesRules.applyDegree2(3, 3, new Set(), fenceMarks);
assert.equal(fenceResult.marks[7], 2);
assert.equal(fenceResult.marks[10], 2);

const impossibleMarks = new Int8Array(12);
impossibleMarks[2] = impossibleMarks[3] = impossibleMarks[7] = 1;
assert.equal(FencesRules.vertexDegreeState(3, 3, 4, new Set(), impossibleMarks).invalid, true);

// ---- the dot helper's rules ----
// 3x3 board: edges 0..11, cells 0..3, outer region 4
assert.deepEqual(FencesRules.edgeFaces(3, 3, 0), [4, 0], 'top border edge: outer above, cell 0 below');
assert.deepEqual(FencesRules.edgeFaces(3, 3, 7), [0, 1], 'center vertical edge splits cells 0 and 1');

{ // matching neighbors forbid their shared edge; a known cell against the
  // always-outdoors outer region fences its border
  const E = 12;
  const dotClues = new Set([E + 0, E + 2]); // cells 0 and 1 indoors
  const marks = new Int8Array(E), dots = new Int8Array(4);
  const r = FencesRules.applyDotHelper(3, 3, dotClues, marks, dots);
  assert.equal(r.marks[7], 2, 'two indoor neighbors exclude the edge between them');
  for (const e of [0, 1, 6, 8]) assert.equal(r.marks[e], 1, `border edge ${e} must be fenced`);
  assert.equal(r.changes.length, 5);
  assert.equal(r.dotChanges.length, 0);
  assert.equal(marks[7], 0, 'dot helper must not mutate its input');
}
{ // crossing an × preserves the side, and the new dot keeps propagating
  const E = 12;
  const dotClues = new Set([E + 0]); // cell 0 indoors
  const marks = new Int8Array(E), dots = new Int8Array(4);
  marks[2] = 2; // × between cells 0 and 2
  const r = FencesRules.applyDotHelper(3, 3, dotClues, marks, dots);
  assert.equal(r.dots[2], 1, 'crossing an × stays indoors');
  assert.equal(r.marks[4], 1, 'the deduced cell fences its outer border');
  assert.equal(r.marks[9], 1);
  assert.equal(dots[2], 0, 'dot helper must not mutate its input dots');
}
{ // crossing a fence flips the side, and given dots are never overwritten
  const E = 12;
  const dotClues = new Set([E + 0]); // cell 0 indoors
  const marks = new Int8Array(E), dots = new Int8Array(4);
  marks[3] = 1; // fence between cells 1 and 3
  const r = FencesRules.applyDotHelper(3, 3, dotClues, marks, dots, 0);
  assert.equal(r.marks[0], 0, 'the protected edge stays blank');
  assert.equal(r.marks[6], 1, 'other borders of the indoor cell are fenced');
  assert.equal(r.dots[1], 0, 'no deduction crosses an undecided edge');
  const withDot = new Int8Array(4); withDot[1] = 1; // player: cell 1 indoors
  const r2 = FencesRules.applyDotHelper(3, 3, dotClues, marks, withDot);
  assert.equal(r2.dots[3], 2, 'crossing a fence flips indoors to outdoors');
  assert.equal(r2.marks[5], 2, 'the outdoor cell matches the outer region: no edge');
}

// ---- the loop helper's rules ----
// 2x3 board: edges e0:0-1 e1:1-2 e2:3-4 e3:4-5 e4:0-3 e5:1-4 e6:2-5
{ // closing early strands dots -> ×; the final closure is left alone
  const marks = new Int8Array(7);
  marks[4] = marks[2] = 1; // with clue e0: open path 1-0-3-4
  const r = FencesRules.applyLoopHelper(2, 3, 1, new Set([0]), marks);
  assert.deepEqual(r.changes, [[5, 0, 2]], 'e5 would close a 4-dot loop with 2 dots stranded');
  assert.equal(r.marks[5], 2);
  assert.equal(marks[5], 0, 'loop helper must not mutate its input');
  const guarded = FencesRules.applyLoopHelper(2, 3, 1, new Set([0]), marks, 5);
  assert.equal(guarded.changes.length, 0, 'the protected edge stays blank');
  const full = new Int8Array(7);
  full[0] = full[1] = full[6] = full[3] = full[2] = 1; // path over all six dots
  const done = FencesRules.applyLoopHelper(2, 3, 1, new Set(), full);
  assert.equal(done.changes.length, 0, 'the closure that finishes the loop is never ×-ed');
}
// 2x4 board: e0:0-1 e1:1-2 e2:2-3 e3:4-5 e4:5-6 e5:6-7 e6:0-4 e7:1-5 e8:2-6 e9:3-7
{ // a finished loop counts against the target
  const marks = new Int8Array(10);
  marks[0] = marks[6] = marks[3] = marks[7] = 1; // closed loop 0-1-5-4
  marks[2] = marks[9] = marks[5] = 1;            // open path 2-3-7-6
  const two = FencesRules.applyLoopHelper(2, 4, 2, new Set(), marks);
  assert.equal(two.changes.length, 0, 'second loop over the remaining dots is fine');
  const one = FencesRules.applyLoopHelper(2, 4, 1, new Set(), marks);
  assert.deepEqual(one.changes, [[8, 0, 2]], 'a second loop is one too many');
}
{ // not enough dots left for the loops still owed
  const marks = new Int8Array(7);
  marks[0] = marks[4] = marks[2] = 1; // path 1-0-3-4 on the 2x3 board
  const r = FencesRules.applyLoopHelper(2, 3, 2, new Set(), marks);
  assert.deepEqual(r.changes, [[5, 0, 2]], 'closing leaves 2 dots for a whole second loop');
}
// 2x6 board: e0..e4 top, e5..e9 bottom, e10:0-6 .. e15:5-11
{ // every loop takes exactly N/loops dots, so an undersized close is ×-ed
  // even when the dots it strands would still feed the loops owed
  const marks = new Int8Array(16);
  marks[0] = marks[11] = marks[5] = 1; // open path 0-1-7-6
  const r = FencesRules.applyLoopHelper(2, 6, 2, new Set(), marks);
  assert.deepEqual(r.changes, [[10, 0, 2]], 'a 4-dot loop cannot take a 6-dot share');
  marks[1] = marks[12] = marks[6] = 1; // grown to 0-1-2-8-7-6: a full share
  const full = FencesRules.applyLoopHelper(2, 6, 2, new Set(), marks);
  assert.equal(full.changes.length, 0, 'closing an exact share is never ×-ed');
}

// dots must split into equal even shares, one per loop: 64/3 does not
// divide, 36/4 leaves odd 9-dot loops, 64/2 = 32 is fine
assert.equal(new Fences(8, 8, [], { loops: 3 }).impossible, 'split');
assert.equal(new Fences(6, 6, [], { loops: 4 }).impossible, 'split');
assert.equal(new Fences(8, 8, [], { loops: 2 }).impossible, null);
assert.match(app, /impossibleMsg/, 'the app explains rejected loop counts');

// multi-loop tallies must survive the exact-share and cell-quota prunes
// (counts confirmed against the pre-prune engine's full enumeration)
{
  const count = (r, c, l) => { const b = new Fences(r, c, [], { loops: l }); while (!b.done) b.run(200); return b.solutions; };
  assert.equal(count(4, 4, 2), 2);
  assert.equal(count(6, 6, 2), 80);
  assert.equal(count(4, 6, 3), 3);
  assert.equal(count(4, 4, 4), 1);
  assert.equal(count(6, 4, 4), 1, 'four 6-dot loops tile 6x4');
}

// every clueless single-loop board up to 8x8 ships finished, and its tallies
// still have to be what the engine produces today
for (let r = 2; r <= 8; r++)
  for (let c = 2; c <= 8; c++)
    if ((r * c) % 2 === 0) assert.ok(precomputed[`${r}x${c}`], `${r}x${c} must be precomputed`);
assert.equal(precomputed['8x8'][0], 4638576, 'the 8x8 empty board has 4,638,576 single-loop solutions');

for (const key of ['4x4', '4x7', '5x6', '6x6']) {
  const [solutions, , edgeTally, cellTally] = precomputed[key];
  const [r, c] = key.split('x').map(Number);
  const board = new Fences(r, c, new Set(), { loops: 1 });
  while (!board.done) board.run(50);
  const unpack = str => str.split('.').map(s => parseInt(s, 36));
  assert.equal(board.solutions, solutions, `${key} solution count`);
  assert.deepEqual(unpack(edgeTally), Array.from(board.heat), `${key} edge tallies`);
  assert.deepEqual(unpack(cellTally), Array.from(board.cellHeat), `${key} cell tallies`);
}

// ---- random puzzle generation ----
function generate(r, c, opts) {
  const g = new FencesGen(r, c, opts);
  let guard = 0;
  while (g.step(1000)) assert.ok(++guard < 10000, 'generation must terminate');
  assert.ok(g.done);
  assert.equal(g.error, null);
  assert.ok(g.result.length > 0);
  assert.ok(g.result.length <= g.solution.length + (opts.dots ? (r - 1) * (c - 1) : 0));
  return g;
}
function countSolutions(r, c, clues, loops) {
  const eng = new Fences(r, c, clues, { loops, maxSolutions: 2 });
  while (!eng.done) eng.run(50);
  return eng.solutions;
}

// the one-step rules alone finish an empty 2x2 board
assert.ok(easySolves(2, 2, []));

// easy: edge clues only, and the one-step rules must finish the board
let puz = generate(5, 6, { difficulty: 'easy' });
const E56 = 5 * 5 + 4 * 6;
assert.ok(puz.result.every(id => id < E56), 'easy puzzles use edge clues only');
assert.ok(easySolves(5, 6, puz.result), 'easy puzzles fall to the one-step rules');
assert.equal(countSolutions(5, 6, puz.result, 1), 1);
assert.equal(puz.solution.length, 30, 'a single loop through every dot has one edge per dot');

// medium: the depth-1 solver must finish it, dots and extra loops are ignored
puz = generate(5, 6, { difficulty: 'medium', dots: true, loops: 3 });
assert.ok(puz.result.every(id => id < E56), 'medium puzzles use edge clues only');
assert.ok(mediumSolves(5, 6, puz.result), 'medium puzzles fall to the depth-1 solver');
assert.equal(countSolutions(5, 6, puz.result, 1), 1);

// hard with dot clues: unique and locally minimal — dropping any one clue
// breaks uniqueness (deletions only ever shrink the set, so a kept clue's
// deletion keeps failing in every smaller set)
puz = generate(4, 4, { difficulty: 'hard', dots: true });
assert.equal(countSolutions(4, 4, puz.result, 1), 1);
for (const c of puz.result) {
  const rest = puz.result.filter(x => x !== c);
  assert.notEqual(countSolutions(4, 4, rest, 1), 1, 'hard clue sets are locally minimal');
}

// expert with two loops: still unique under the multi-loop rules
puz = generate(4, 4, { difficulty: 'expert', loops: 2, dots: true });
assert.equal(puz.solution.length, 16);
assert.equal(countSolutions(4, 4, puz.result, 2), 1);

// an impossible board (odd dot count) reports instead of spinning
const bad = new FencesGen(3, 3, { difficulty: 'easy' });
while (bad.step(1000)) {}
assert.ok(bad.error, 'odd boards have no puzzle');

console.log('Static assets, scripts, deploy workflow, solver, precomputed boards, Play rules, and generation passed.');
