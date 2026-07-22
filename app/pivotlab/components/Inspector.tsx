import type { NumberDisplay } from '../math/rational';
import type { Algorithm, PivotSelection, Tableau } from '../model/tableau';
import { maximumEligibleColumn, minimumEligibleRow, ratioAt } from '../model/tableau';
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
  showPivotHints: boolean;
  onFinishPhaseOne: () => void;
}

export function PivotInspector({
  tableau,
  algorithm,
  display,
  selection,
  showPivotHints,
  onFinishPhaseOne,
}: PivotInspectorProps) {
  const rowIndex = selection ? tableau.rows.findIndex((row) => row.id === selection.rowId) : -1;
  const columnIndex = selection ? tableau.variables.findIndex((variable) => variable.id === selection.variableId) : -1;
  const row = rowIndex >= 0 ? tableau.rows[rowIndex] : null;
  const variable = columnIndex >= 0 ? tableau.variables[columnIndex] : null;
  const value = row && columnIndex >= 0 ? row.values[columnIndex] : null;
  const ratio = row && variable ? ratioAt(tableau, rowIndex, columnIndex, algorithm) : null;
  const rhs = row ? row.values[tableau.variables.length] : null;
  const objectiveCoefficient = columnIndex >= 0 ? tableau.objective[columnIndex] : null;
  const leaving = row ? tableau.variables.find((candidate) => candidate.id === row.basisId) : null;
  const recommendedRow = columnIndex >= 0 ? minimumEligibleRow(tableau, columnIndex) : null;
  const recommendedColumn = rowIndex >= 0 ? maximumEligibleColumn(tableau, rowIndex) : null;
  const primalEligible = Boolean(value?.isPositive() && ratio && !ratio.isNegative());
  const dualEligible = Boolean(rhs?.isNegative() && value?.isNegative() && objectiveCoefficient && !objectiveCoefficient.isNegative());
  const isRecommended = showPivotHints && (
    algorithm === 'primal'
      ? primalEligible && recommendedRow === rowIndex
      : dualEligible && recommendedColumn === columnIndex
  );

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
          <PivotHoverIcon />
          <h3>Hover to inspect</h3>
          <p>Move over a nonzero entry to inspect its ratio, then click the cell to pivot immediately.</p>
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
              {isRecommended && <span className="status-badge green"><CheckIcon /> {algorithm === 'primal' ? 'minimum' : 'maximum'}</span>}
            </div>
            <div className="ratio-equation">
              <span className="ratio-fraction">
                <span>{algorithm === 'primal' ? 'RHS' : <>c<sub>{columnIndex + 1}</sub></>}</span>
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
            {showPivotHints && algorithm === 'primal' && !primalEligible && (
              <p className="ratio-warning">This entry is not eligible for the usual nonnegative primal ratio test.</p>
            )}
            {showPivotHints && algorithm === 'dual' && !dualEligible && (
              <p className="ratio-warning">The dual ratio test requires a negative RHS and row entry with a nonnegative objective coefficient.</p>
            )}
          </section>

          <p className="operation-note">Clicking this cell divides its row by <span>{value.toFraction()}</span>, then removes the pivot-column multiples from every other row and the objective row.</p>
        </>
      )}

      <div className="quiet-note algorithm-note"><InfoIcon /><span>{algorithm === 'primal'
        ? <>In primal mode, the inspector shows RHS / a<sub>i,j</sub> down an entering column to compare leaving rows.</>
        : <>In dual mode, the inspector shows c<sub>j</sub> / a<sub>i,j</sub> across a chosen leaving row to compare entering columns. The row operation itself is unchanged.</>}</span></div>
    </aside>
  );
}

function PivotHoverIcon() {
  return (
    <svg className="pivot-hover-icon" viewBox="0 0 180 142" role="img" aria-label="Pointer hovering over the value 5 in a small tableau">
      <defs>
        <radialGradient id="pivot-cell-field" cx="50%" cy="50%" r="72%">
          <stop offset="0" stopColor="var(--pivot-icon-field)" stopOpacity=".98" />
          <stop offset=".72" stopColor="var(--pivot-icon-field-edge)" stopOpacity=".62" />
          <stop offset="1" stopColor="var(--pivot-icon-field-edge)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pivot-orange-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#f2a23e" stopOpacity=".58" />
          <stop offset=".45" stopColor="#f5b45d" stopOpacity=".34" />
          <stop offset="1" stopColor="#f7c982" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pivot-line-horizontal" gradientUnits="userSpaceOnUse" x1="17" x2="163">
          <stop offset="0" stopColor="var(--pivot-icon-line)" stopOpacity="0" />
          <stop offset=".18" stopColor="var(--pivot-icon-line)" stopOpacity=".82" />
          <stop offset=".82" stopColor="var(--pivot-icon-line)" stopOpacity=".82" />
          <stop offset="1" stopColor="var(--pivot-icon-line)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pivot-line-vertical" gradientUnits="userSpaceOnUse" x1="90" y1="10" x2="90" y2="132">
          <stop offset="0" stopColor="var(--pivot-icon-line)" stopOpacity="0" />
          <stop offset=".18" stopColor="var(--pivot-icon-line)" stopOpacity=".82" />
          <stop offset=".82" stopColor="var(--pivot-icon-line)" stopOpacity=".82" />
          <stop offset="1" stopColor="var(--pivot-icon-line)" stopOpacity="0" />
        </linearGradient>
        <filter id="pivot-pointer-shadow" x="-30%" y="-30%" width="180%" height="180%">
          <feDropShadow dx="1" dy="2" stdDeviation="1.4" floodColor="#1a2420" floodOpacity=".28" />
        </filter>
      </defs>
      <rect x="16" y="11" width="148" height="120" rx="28" fill="url(#pivot-cell-field)" />
      <ellipse cx="126" cy="101" rx="43" ry="39" fill="url(#pivot-orange-glow)" />
      <line x1="17" y1="71" x2="163" y2="71" stroke="url(#pivot-line-horizontal)" strokeWidth="1.5" />
      <line x1="90" y1="10" x2="90" y2="132" stroke="url(#pivot-line-vertical)" strokeWidth="1.5" />
      <g fill="var(--pivot-icon-ink)" fontFamily="Segoe UI, Arial, sans-serif" fontSize="22" fontWeight="650" textAnchor="middle" dominantBaseline="middle">
        <text x="53" y="43">2</text>
        <text x="127" y="43">−1</text>
        <text x="53" y="99">3</text>
        <text x="127" y="99">5</text>
      </g>
      <path d="M140 110v16l3.6-3.8 3.7 7.6 3.3-1.6-3.7-7.5h5.5Z" fill="var(--pivot-icon-pointer-fill)" stroke="var(--pivot-icon-pointer-stroke)" strokeWidth="1.15" strokeLinejoin="round" filter="url(#pivot-pointer-shadow)" />
    </svg>
  );
}
