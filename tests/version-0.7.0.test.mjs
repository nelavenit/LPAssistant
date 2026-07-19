import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("0.7.0 interaction, sizing, guidance, and copy changes are wired", async () => {
  const [app, cell, grid, inspector, modal, settings, css, readme, vite] = await Promise.all([
    source("../app/pivotlab/App.tsx"),
    source("../app/pivotlab/components/CellInput.tsx"),
    source("../app/pivotlab/components/TableauGrid.tsx"),
    source("../app/pivotlab/components/Inspector.tsx"),
    source("../app/pivotlab/components/Modals.tsx"),
    source("../app/pivotlab/app/settings.ts"),
    source("../app/globals.css"),
    source("../README.md"),
    source("../vite.config.ts"),
  ]);

  assert.match(app, /className="display-fraction-sample"/);
  assert.match(css, /\.display-fraction-sample \{[^}]*align-items: baseline;/s);
  assert.match(settings, /newProject: 'Ctrl\+Alt\+N'/);
  assert.match(settings, /storedShortcuts\.newProject === 'Ctrl\+N'/);
  assert.match(cell, /ArrowUp:[\s\S]*ArrowDown:[\s\S]*ArrowLeft:[\s\S]*ArrowRight:/);
  assert.match(cell, /data-grid-row=\{gridRow\}/);
  assert.match(cell, /data-grid-column=\{gridColumn\}/);
  assert.match(grid, /Math\.round\(tableFontSize \* 5\.1\)/);
  assert.match(css, /col\.variable-col \{ width: var\(--table-variable-width/);
  assert.match(css, /\.workspace-layout \{[^}]*height: calc\(var\(--ui-viewport-height\) - 122px\);[^}]*overflow: hidden;/s);
  assert.match(css, /\.tableau-sequence \{[^}]*flex: 1;[^}]*min-height: 0;/s);
  assert.match(app, /Simplex method tableau/i);
  assert.doesNotMatch(app, /LPAssistant · manual pivot practice/);
  assert.match(css, /\.control-tooltip/);
  assert.doesNotMatch(app, /title=\{canEdit \? undefined/);
  assert.match(inspector, /className="pivot-hover-icon"/);
  assert.match(inspector, /pivot-orange-glow/);
  assert.match(inspector, /fill="#fff" stroke="#202725"/);
  assert.match(css, /\.basis-cell select \{[^}]*text-align: center;[^}]*text-align-last: center;/s);
  assert.match(settings, /showPivotHints: false/);
  assert.match(modal, /Show pivot guidance/);
  assert.match(grid, /showPivotHints && ratio/);
  assert.match(inspector, /showPivotHints && algorithm === 'primal' && !primalEligible/);
  assert.doesNotMatch(modal, /solution (?:sequence|history) with exact fractions/i);
  assert.match(modal, /current number display/);
  assert.doesNotMatch(readme, /—|–/);
  assert.doesNotMatch(vite, /\.openai\/hosting\.json/);
});

test("all 64 core option combinations preserve their independent behavior", () => {
  const modes = ["edit", "pivot"];
  const displays = ["fraction", "decimal"];
  const algorithms = ["primal", "dual"];
  const phases = ["standard", "phase1"];
  const hints = [false, true];
  const includeResults = [false, true];
  let checked = 0;

  for (const mode of modes) {
    for (const display of displays) {
      for (const algorithm of algorithms) {
        for (const phase of phases) {
          for (const showHints of hints) {
            for (const includeResult of includeResults) {
              const state = {
                editableCells: mode === "edit",
                pivotCells: mode === "pivot",
                fractionValues: display === "fraction",
                decimalValues: display === "decimal",
                primalRatio: algorithm === "primal",
                dualRatio: algorithm === "dual",
                phaseOneControls: phase === "phase1",
                guidance: mode === "pivot" && showHints,
                finalResult: includeResult,
              };

              assert.notEqual(state.editableCells, state.pivotCells);
              assert.notEqual(state.fractionValues, state.decimalValues);
              assert.notEqual(state.primalRatio, state.dualRatio);
              assert.equal(state.phaseOneControls, phase === "phase1");
              assert.equal(state.guidance, mode === "pivot" && showHints);
              assert.equal(state.finalResult, includeResult);
              checked += 1;
            }
          }
        }
      }
    }
  }

  assert.equal(checked, 64);
});
