import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('only committed pivots can mark visible tableaux and headers restart at stage boundaries', async () => {
  const [app, stages] = await Promise.all([
    source('../app/pivotlab/App.tsx'),
    source('../app/pivotlab/model/stages.ts'),
  ]);
  assert.match(app, /pivotMark=\{index < currentIndex \? history\[index \+ 1\]\?\.pivot : undefined\}/);
  assert.match(app, /showHeader=\{stageIndex === 0\}/);
  assert.match(app, /groupTableauStages\(history, currentIndex\)/);
  assert.match(stages, /label: 'Phase I'/);
  assert.match(stages, /label: 'Phase II'/);
});

test('print pivot rings, stage frames, and compact dimensions are explicit', async () => {
  const css = await source('../app/globals.css');
  const printCss = css.slice(css.indexOf('@media print'));
  assert.match(printCss, /\.tableau-grid \.selected-pivot, \.tableau-grid \.historic-pivot \{ position: relative !important;/);
  assert.match(printCss, /\.solution-stage-tableaux \{ display: block; border: 1px solid #777;/);
  assert.match(printCss, /\.solution-stage-tableaux \.history-card \+ \.history-card \.tableau-scroll \{ border-top: 1px solid #777;/);
  assert.match(printCss, /height: 7\.5mm; padding: 1\.2mm;/);
  assert.match(printCss, /\.history-card, \.history-card\.current \{ box-shadow: none; border: 0;/);
});

test('all graphic exports share stage, transparency, and optional-result infrastructure', async () => {
  const [modal, graphic] = await Promise.all([
    source('../app/pivotlab/components/Modals.tsx'),
    source('../app/pivotlab/export/tableauGraphic.ts'),
  ]);
  assert.match(modal, /PNG · no background/);
  assert.match(modal, /exportImage\('svg'\)/);
  assert.match(modal, /completeSolution: includeSolution/);
  assert.match(graphic, /groupTableauStages/);
  assert.match(graphic, /const STAGE_GAP = 22/);
  assert.match(graphic, /options\.resultTableau/);
  assert.match(graphic, /canvas\.toBlob/);
});
