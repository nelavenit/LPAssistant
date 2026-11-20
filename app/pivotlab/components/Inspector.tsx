import { useLanguage } from '../app/languageContext';
import type { ReactNode } from 'react';
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
  onCanonicalize: () => void;
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
  onCanonicalize,
  onOpenPhaseOne,
  onFinishPhaseOne,
  addConstraintShortcut,
  addVariableShortcut,
}: EditInspectorProps) {
  const { t } = useLanguage();
  const basicCount = tableau.rows.filter((row) => row.basisId).length;
  const artificialCount = tableau.variables.filter((variable) => variable.kind === 'artificial').length;
  return (
    <aside className="inspector-card" id="tableau-setup">
      <div className="inspector-heading">
        <h2>{t('Tableau setup')}</h2>
        <p>{t('Enter integers, decimals, or fractions directly in the grid.')}</p>
      </div>

      <div className="dimension-summary">
        <div><strong>{tableau.rows.length}</strong><span>{t('constraints')}</span></div>
        <div><strong>{tableau.variables.length}</strong><span>{t('variables')}</span></div>
        <div><strong>{basicCount}/{tableau.rows.length}</strong><span>{t('basis rows')}</span></div>
      </div>

      <div className="button-stack">
        <button className="secondary-button" type="button" onClick={onAddConstraint}><PlusIcon /> {t('Add constraint')} <kbd>{addConstraintShortcut}</kbd></button>
        <button className="secondary-button" type="button" onClick={onAddVariable}><PlusIcon /> {t('Add variable')} <kbd>{addVariableShortcut}</kbd></button>
        <button className="secondary-button" type="button" onClick={onDetectBasis}><SparkIcon /> {t('Detect identity basis')}</button>
        <button className="secondary-button" type="button" onClick={onCanonicalize}>{t('Canonicalize objective')}</button>
      </div>

      <section className="inspector-section phase-card">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">{t('Artificial variables')}</span>
            <h3>{t(tableau.phase === 'phase1' ? 'Phase I active' : 'Find a starting BFS')}</h3>
          </div>
          {tableau.phase === 'phase1' && <span className="status-badge amber">{t('Artificial: {count}', { count: artificialCount })}</span>}
        </div>
        {tableau.phase === 'phase1' ? (
          <>
            <p>{t('Pivot until −w = 0. Remove artificial variables from the basis when possible.')}</p>
            <button className="primary-button" type="button" onClick={onFinishPhaseOne}><CheckIcon /> {t('Finish Phase I')}</button>
          </>
        ) : (
          <>
            <p>{t('Select the rows that need artificial basic variables; Simplex Assistant will construct the canonical −w row.')}</p>
            <button className="primary-button" type="button" onClick={onOpenPhaseOne}><SparkIcon /> {t('Set up Phase I')}</button>
          </>
        )}
      </section>

      <div className="quiet-note"><InfoIcon /><span>{t('For minimization, enter the objective as −f + cᵀx = b₀. In canonical form its value is −b₀.')}</span></div>
    </aside>
  );
}

interface PivotInspectorProps {
  tableau: Tableau;
  algorithm: Algorithm;
  display: NumberDisplay;
  selection: PivotSelection | null;
  showPivotHints: boolean;
  result: ReactNode;
  onFinishPhaseOne: () => void;
}

export function PivotInspector({
  tableau,
  algorithm,
  display,
  selection,
  showPivotHints,
  result,
  onFinishPhaseOne,
}: PivotInspectorProps) {
  const { t } = useLanguage();
  const rowIndex = selection ? tableau.rows.findIndex((row) => row.id === selection.rowId) : -1;
  const columnIndex = selection ? tableau.variables.findIndex((variable) => variable.id === selection.variableId) : -1;
  const row = rowIndex >= 0 ? tableau.rows[rowIndex] : null;
  const variable = columnIndex >= 0 ? tableau.variables[columnIndex] : null;
  const value = row && columnIndex >= 0 ? row.values[columnIndex] : null;
  const ratio = row && variable ? ratioAt(tableau, rowIndex, columnIndex, algorithm) : null;
  const rhs = row ? row.values[tableau.variables.length] : null;
  const leaving = row ? tableau.variables.find((candidate) => candidate.id === row.basisId) : null;
  const recommendedRow = showPivotHints && algorithm === 'primal' && columnIndex >= 0 ? minimumEligibleRow(tableau, columnIndex) : null;
  const primalEligible = Boolean(value?.isPositive() && ratio && !ratio.isNegative());
  const isMinimum = recommendedRow !== null && primalEligible && ratio!.equals(ratioAt(tableau, recommendedRow, columnIndex, algorithm)!);

  return (
    <aside className="inspector-card pivot-inspector">
      <div className="inspector-heading">
        <h2>{t('Pivot inspector')}</h2>
      </div>

      {tableau.phase === 'phase1' && (
        <section className="inspector-section phase-card pivot-phase-card" id="phase-one-controls">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">{t('Artificial variables')}</span>
              <h3>{t('Phase I active')}</h3>
            </div>
            <span className="status-badge amber">−w</span>
          </div>
          <p>{t('When −w = 0, finish Phase I to restore the original objective.')}</p>
          <button className="primary-button" type="button" onClick={onFinishPhaseOne}><CheckIcon /> {t('Finish Phase I')}</button>
        </section>
      )}

      {!row || !variable || !value ? (
        <div className="empty-inspector">
          <PivotHoverIcon />
          <h3>{t('Select a pivot')}</h3>
          <p className="mouse-instruction">{t('Hover over a nonzero coefficient to inspect it, or click to pivot.')}</p>
          <p className="touch-instruction">{t('Tap a nonzero coefficient to inspect it, then choose Apply pivot.')}</p>
        </div>
      ) : (
        <>
          <div className="pivot-summary-grid">
            <div><span>{t('Entering')}</span><strong><VariableName name={variable.name} /></strong></div>
            <div><span>{t('Leaving')}</span><strong>{leaving ? <VariableName name={leaving.name} /> : '—'}</strong></div>
            <div><span>{t('Pivot')}</span><strong><NumberValue value={value} display={display} /></strong></div>
            <div><span>{t('Row')}</span><strong>{rowIndex + 1}</strong></div>
          </div>

          <section className="ratio-formula-card">
            <div className="ratio-label">
              <span>{t(algorithm === 'primal' ? 'Primal ratio' : 'Dual ratio')}</span>
              {isMinimum && <span className="status-badge green"><CheckIcon /> {t('minimum')}</span>}
            </div>
            <div className="ratio-equation">
              <span className="ratio-fraction">
                <span>{t(algorithm === 'primal' ? 'RHS' : 'objective coefficient')}</span>
                <span>a<sub>{rowIndex + 1},{columnIndex + 1}</sub></span>
              </span>
              <span>=</span>
              <span className="ratio-fraction numeric-ratio">
                <span><NumberValue value={algorithm === 'primal' ? rhs! : tableau.objective[columnIndex]} display={display} /></span>
                <span><NumberValue value={value} display={display} /></span>
              </span>
              <span>=</span>
              <span className="ratio-result">{ratio ? <NumberValue value={ratio} display={display} /> : t('undefined')}</span>
            </div>
            {showPivotHints && algorithm === 'primal' && !primalEligible && (
              <p className="ratio-warning">{t('This entry is not eligible for the usual nonnegative primal ratio test.')}</p>
            )}
          </section>

          <p className="operation-note">{t('The pivot divides its row by {value}, then eliminates the pivot column from the other constraint rows and the objective row.', { value: value.toFraction() })}</p>
        </>
      )}

      <div className="quiet-note algorithm-note"><InfoIcon /><span>{t(algorithm === 'primal'
        ? 'In primal mode, compare RHS / aᵢⱼ down the entering column to choose a leaving row.'
        : 'In dual mode, compare cⱼ / aᵢⱼ across the leaving row to choose an entering column.')}</span></div>
      <div id="pivot-result">{result}</div>
    </aside>
  );
}

function PivotHoverIcon() {
  return (
    <svg className="pivot-hover-icon" viewBox="0 0 180 142" aria-hidden="true">
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
