import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("0.7.1 zoom, scrolling, guidance, basis, and Phase I fixes are wired", async () => {
  const [app, inspector, modal, grid, model, css, readme, pkg, lock, installer, validator] = await Promise.all([
    source("../app/pivotlab/App.tsx"),
    source("../app/pivotlab/components/Inspector.tsx"),
    source("../app/pivotlab/components/Modals.tsx"),
    source("../app/pivotlab/components/TableauGrid.tsx"),
    source("../app/pivotlab/model/tableau.ts"),
    source("../app/globals.css"),
    source("../README.md"),
    source("../package.json"),
    source("../package-lock.json"),
    source("../scripts/install-ci.sh"),
    source("../scripts/validate-artifact.sh"),
  ]);

  assert.match(app, /className="display-fraction-slash"/);
  assert.match(css, /\.display-fraction-slash \{[^}]*height: 1\.18em;[^}]*transform: rotate\(24deg\);/s);
  assert.doesNotMatch(css, /display-fraction-sample[^\n]+baseline|display-fraction-sample[^\n]+translateY/);
  assert.match(app, /className=\{`decimal-places-slot/);
  assert.match(css, /\.decimal-places-slot \{[^}]*width: 142px;[^}]*visibility: hidden;/s);
  assert.match(css, /\.disabled-edit-tip \{[^}]*cursor: default;/s);
  assert.doesNotMatch(css, /\.disabled-edit-tip \{[^}]*cursor: (?:help|not-allowed);/s);
  assert.match(app, /workspace-open/);
  assert.match(css, /\.app-shell\.workspace-open \{[^}]*height: var\(--ui-viewport-height\);[^}]*overflow: hidden;/s);
  assert.match(css, /@media \(max-width: 900px\) and \(pointer: coarse\)/);
  assert.match(css, /\.history-card \.compact-tableau \.tableau-grid th/);
  assert.doesNotMatch(css, /^\.compact-tableau \.tableau-grid th/m);
  assert.match(inspector, /In primal mode, the inspector shows/);
  assert.match(inspector, /In dual mode, the inspector shows/);
  assert.doesNotMatch(inspector, /showPivotHints && <div className="quiet-note algorithm-note"/);
  assert.match(modal, /Primal and dual mode explanations always remain visible/);
  assert.match(inspector, /strokeWidth="1\.35"/);
  assert.match(grid, /className="basis-select-display"/);
  assert.match(css, /\.basis-select-display \{[^}]*justify-content: center;/s);
  assert.match(model, /kind === 'artificial' \? 'u'/);
  assert.match(model, /name: `[uz]\$\{artificialCounter\}`/);
  assert.match(modal, /artificial variable/);
  assert.doesNotMatch(modal, /\+ a\{index \+ 1\}/);
  assert.match(readme, /Simplex Assistant 0\.7\.1/);
  assert.match(pkg, /"version": "0\.7\.1"/);
  assert.match(lock, /"version": "0\.7\.1"/);
  assert.match(installer, /exec bash "\$\{script_dir\}\/sites-env\.sh" -- bash "\$0"/);
  assert.match(validator, /exec bash "\$\{script_dir\}\/sites-env\.sh" -- bash "\$0"/);
});
