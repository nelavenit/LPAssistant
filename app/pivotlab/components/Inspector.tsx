import type { NumberDisplay } from '../math/rational';
import type { Algorithm, PivotSelection, Tableau } from '../model/tableau';
import { minimumEligibleRow, ratioAt } from '../model/tableau';
import { CheckIcon, InfoIcon, PlusIcon, SparkIcon } from './Icons';
import { NumberValue } from './NumberValue';
import { VariableName } from './VariableName';

interface EditInspectorProps {
  tableau: Tableau;
  onAddConstraint: () => void;
  onAddVariable: () => void;
  onDetectBasis: () => void;
  onOpenPhaseOne: () => void;
  onFinishPhaseOne: () => void;
  addConstraintShortcut: string;
  addVariableShortcut: string;
}

export function EditInspector({
  tableau,
  onAddConstraint,
  onAddVariable,
  onDetectBasis,
  onOpenPhaseOne,
  onFinishPhaseOne,
  addConstraintShortcut,
  addVariableShortcut,
}: EditInspectorProps) {
  const basicCount = tableau.rows.filter((row) => row.basisId).length;
  const artificialCount = tableau.variables.filter((variable) => variable.kind === 'artificial').length;
  return (
    <aside className="inspector-card">
      <div className="inspector-heading">
        <h2>Tableau setup</h2>
        <p>Enter integers, decimals, or fractions directly in the grid.</p>
      </div>

      <div className="dimension-summary">
        <div><strong>{tableau.rows.length}</strong><span>constraints</span></div>
        <div><strong>{tableau.variables.length}</strong><span>variables</span></div>
        <div><strong>{basicCount}/{tableau.rows.length}</strong><span>basis rows</span></div>
      </div>

      <div className="button-stack">
        <button className="secondary-button" type="button" onClick={onAddConstraint}><PlusIcon /> Add constraint <kbd>{addConstraintShortcut}</kbd></button>
        <button className="secondary-button" type="button" onClick={onAddVariable}><PlusIcon /> Add variable <kbd>{addVariableShortcut}</kbd></button>
        <button className="secondary-button" type="button" onClick={onDetectBasis}><SparkIcon /> Detect identity basis</button>
      </div>

      <section className="inspector-section phase-card">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">Artificial variables</span>
            <h3>{tableau.phase === 'phase1' ? 'Phase I active' : 'Find a starting BFS'}</h3>
          </div>
          {tableau.phase === 'phase1' && <span className="status-badge amber">{artificialCount} artificial</span>}
        </div>
        {tableau.phase === 'phase1' ? (
          <>
            <p>Pivot until <strong>−w = 0</strong> and no artificial variable remains basic.</p>
            <button className="primary-button" type="button" onClick={onFinishPhaseOne}><CheckIcon /> Finish Phase I</button>
          </>
        ) : (
          <>
            <p>Select the rows that need artificial basic variables; Simplex Assistant will construct the canonical −w row.</p>
            <button className="primary-button" type="button" onClick={onOpenPhaseOne}><SparkIcon /> Set up Phase I</button>
          </>
        )}
      </section>

      <div className="quiet-note"><InfoIcon /><span>Changing entries updates the initial tableau. Switch to Pivot mode to lock it.</span></div>
    </aside>
  );
}

interface PivotInspectorProps {
  tableau: Tableau;
  algorithm: Algorithm;
  display: NumberDisplay;
  selection: PivotSelection | null;
  onFinishPhaseOne: () => void;
}

export function PivotInspector({
  tableau,
  algorithm,
  display,
  selection,
  onFinishPhaseOne,
}: PivotInspectorProps) {
  const rowIndex = selection ? tableau.rows.findIndex((row) => row.id === selection.rowId) : -1;
  const columnIndex = selection ? tableau.variables.findIndex((variable) => variable.id === selection.variableId) : -1;
  const row = rowIndex >= 0 ? tableau.rows[rowIndex] : null;
  const variable = columnIndex >= 0 ? tableau.variables[columnIndex] : null;
  const value = row && columnIndex >= 0 ? row.values[columnIndex] : null;
  const ratio = row && variable ? ratioAt(tableau, rowIndex, columnIndex, algorithm) : null;
  const rhs = row ? row.values[tableau.variables.length] : null;
  const leaving = row ? tableau.variables.find((candidate) => candidate.id === row.basisId) : null;
  const recommendedRow = columnIndex >= 0 ? minimumEligibleRow(tableau, columnIndex) : null;
  const primalEligible = Boolean(value?.isPositive() && ratio && !ratio.isNegative());
  const isMinimum = algorithm === 'primal' && primalEligible && recommendedRow === rowIndex;

  return (
    <aside className="inspector-card pivot-inspector">
      <div className="inspector-heading">
        <h2>Pivot inspector</h2>
      </div>

      {tableau.phase === 'phase1' && (
        <section className="inspector-section phase-card pivot-phase-card">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">Artificial variables</span>
              <h3>Phase I active</h3>
            </div>
            <span className="status-badge amber">−w</span>
          </div>
          <p>When <strong>−w = 0</strong> and no artificial variable remains basic, restore the original objective.</p>
          <button className="primary-button" type="button" onClick={onFinishPhaseOne}><CheckIcon /> Finish Phase I</button>
        </section>
      )}

      {!row || !variable || !value ? (
        <div className="empty-inspector">
          <div className="pivot-glyph" aria-hidden="true"><span /></div>
          <h3>Hover to inspect</h3>
          <p>Move over a nonzero entry to see its exact ratio, then click the cell to pivot immediately.</p>
        </div>
      ) : (
        <>
          <div className="pivot-summary-grid">
            <div><span>Entering</span><strong><VariableName name={variable.name} /></strong></div>
            <div><span>Leaving</span><strong>{leaving ? <VariableName name={leaving.name} /> : '—'}</strong></div>
            <div><span>Pivot</span><strong><NumberValue value={value} display={display} /></strong></div>
            <div><span>Row</span><strong>{rowIndex + 1}</strong></div>
          </div>

          <section className="ratio-formula-card">
            <div className="ratio-label">
              <span>{algorithm === 'primal' ? 'Primal ratio' : 'Dual ratio'}</span>
              {isMinimum && <span className="status-badge green"><CheckIcon /> minimum</span>}
            </div>
            <div className="ratio-equation">
              <span className="ratio-fraction">
                <span>{algorithm === 'primal' ? 'RHS' : 'objective coefficient'}</span>
                <span>a<sub>{rowIndex + 1},{columnIndex + 1}</sub></span>
              </span>
              <span>=</span>
              <span className="ratio-fraction numeric-ratio">
                <span><NumberValue value={algorithm === 'primal' ? rhs! : tableau.objective[columnIndex]} display={display} /></span>
                <span><NumberValue value={value} display={display} /></span>
              </span>
              <span>=</span>
              <span className="ratio-result">{ratio ? <NumberValue value={ratio} display={display} /> : 'undefined'}</span>
            </div>
            {algorithm === 'primal' && !primalEligible && (
              <p className="ratio-warning">This entry is not eligible for the usual nonnegative primal ratio test.</p>
            )}
          </section>

          <p className="operation-note">Clicking this cell divides its row by <span>{value.toFraction()}</span>, then removes the pivot-column multiples from every other row and the objective row.</p>
        </>
      )}

      <div className="quiet-note algorithm-note"><InfoIcon /><span>{algorithm === 'primal'
        ? <>Primal shows RHS / a<sub>i,j</sub> down an entering column to compare leaving rows.</>
        : <>Dual shows c<sub>j</sub> / a<sub>i,j</sub> across a chosen leaving row to compare entering columns. The row operation itself is unchanged.</>}</span></div>
    </aside>
  );
}
