const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Fences, FencesRules } = require('../fences-engine.js');
const precomputed = require('../precomputed.js');

const runtimeFiles = ['index.html', 'styles.css', 'fences-engine.js', 'precomputed.js', 'app.js'];
const html = readFileSync('index.html', 'utf8');
const styles = readFileSync('styles.css', 'utf8');
const app = readFileSync('app.js', 'utf8');
const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

assert.match(html, /href="styles\.css"/);
assert.match(html, /src="fences-engine\.js"/);
assert.match(html, /src="app\.js"/);
assert.match(html, /src="precomputed\.js"/);
assert.ok(html.indexOf('fences-engine.js') < html.indexOf('app.js'));
assert.ok(html.indexOf('precomputed.js') < html.indexOf('app.js'), 'precomputed data must load before the app');
assert.match(html, /id="testBtn"/);
assert.match(html, /id="cluesOnlyBtn"/);
assert.ok(runtimeFiles.every(file => workflow.includes(file)), 'deploy workflow must copy every runtime file');

assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.hit:hover/);
assert.match(app, /DEGREE_HELPER_DELAY_MS = 400/);
new Function(app);

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

console.log('Static assets, scripts, deploy workflow, solver, precomputed boards, and Play rules passed.');
