const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Fences, FencesRules } = require('../fences-engine.js');
const { FencesGen, easySolves, mediumSolves } = require('../fences-gen.js');
const precomputed = require('../precomputed.js');

const runtimeFiles = ['index.html', 'styles.css', 'fences-engine.js', 'fences-gen.js', 'precomputed.js', 'app.js'];
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
assert.match(html, /id="testBtn"/);
assert.match(html, /id="cluesOnlyBtn"/);
assert.match(html, /id="genBtn"/);
assert.match(html, /id="gDiffSel"/);
assert.ok(runtimeFiles.every(file => workflow.includes(file)), 'deploy workflow must copy every runtime file');

assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.hit:hover/);
assert.match(app, /DEGREE_HELPER_DELAY_MS = 400/);
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
