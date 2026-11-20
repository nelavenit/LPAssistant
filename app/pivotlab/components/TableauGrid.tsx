import { useLanguage } from '../app/languageContext';
import { useRef, useState } from 'react';
import type { NumberDisplay } from '../math/rational';
import type { Algorithm, AppMode, PivotRecord, PivotSelection, Tableau, VariableKind } from '../model/tableau';
import { cloneTableau, minimumEligibleRow, ratioAt } from '../model/tableau';
import { CellInput } from './CellInput';
import { ChevronIcon, TrashIcon } from './Icons';
import { NumberValue } from './NumberValue';
import { VariableName } from './VariableName';

interface TableauGridProps {
  tableau: Tableau;
  mode?: AppMode;
  algorithm?: Algorithm;
  display: NumberDisplay;
  selection?: PivotSelection | null;
  pivotMark?: PivotRecord;
  compact?: boolean;
  showHeader?: boolean;
  repeatHeader?: boolean;
  showPivotHints?: boolean;
  tableFontSize?: number;
  onPivot?: (selection: PivotSelection) => void;
  onSelectPivot?: (selection: PivotSelection) => void;
  onHoverPivot?: (selection: PivotSelection | null) => void;
  onChange?: (tableau: Tableau) => void;
  onRemoveVariable?: (variableId: string) => void;
  onRemoveConstraint?: (rowId: string) => void;
  onInvalid?: (message: string) => void;
}

export function TableauGrid({
  tableau,
  mode = 'pivot',
  algorithm = 'primal',
  display,
  selection = null,
  pivotMark,
  compact = false,
  showHeader = true,
  repeatHeader = false,
  showPivotHints = false,
  tableFontSize = 18,
  onPivot,
  onSelectPivot,
  onHoverPivot,
  onChange,
  onRemoveVariable,
  onRemoveConstraint,
  onInvalid,
}: TableauGridProps) {
  const { t } = useLanguage();
  const pointerType = useRef('');
  const [hovered, setHovered] = useState<{ row: number; column: number } | null>(null);
  const selectedColumn = selection
    ? tableau.variables.findIndex((variable) => variable.id === selection.variableId)
    : -1;
  const minimumRow = showPivotHints && selectedColumn >= 0 && algorithm === 'primal'
    ? minimumEligibleRow(tableau, selectedColumn)
    : null;
  const minimumRatio = minimumRow === null ? null : ratioAt(tableau, minimumRow, selectedColumn, algorithm);
  const editable = mode === 'edit' && Boolean(onChange) && !compact;
  const variableWidth = Math.max(82, Math.min(148, Math.round(tableFontSize * 5.1)));
  const sideWidth = Math.max(editable ? 120 : 88, Math.min(140, Math.round(tableFontSize * 5)));
  const tableMinimumWidth = sideWidth * 2 + tableau.variables.length * variableWidth;

  const update = (mutator: (next: Tableau) => void) => {
    if (!onChange) return;
    const next = cloneTableau(tableau);
    mutator(next);
    onChange(next);
  };

  return (
    <div
      className={`tableau-scroll${compact ? ' compact-tableau' : ''}${editable ? ' editable-tableau' : ''}`}
      style={{
        '--table-min-width': `${tableMinimumWidth}px`,
        '--table-variable-width': `${variableWidth}px`,
        '--table-side-width': `${sideWidth}px`,
      } as React.CSSProperties}
    >
      <table
        className="tableau-grid"
        style={{ '--variable-count': tableau.variables.length } as React.CSSProperties}
      >
        <colgroup>
          <col className="basis-col" />
          {tableau.variables.map((variable) => <col key={variable.id} className="variable-col" />)}
          <col className="rhs-col" />
        </colgroup>
        {(showHeader || repeatHeader) && (
          <thead className={showHeader ? undefined : 'repeat-tableau-header'}>
            <tr>
              <th className="basis-column sticky-left">{t('Basis')}</th>
              {tableau.variables.map((variable, columnIndex) => (
                <th
                  key={variable.id}
                  className={`${hovered?.column === columnIndex ? 'column-hover' : ''} variable-header variable-${variable.kind}`}
                >
                  {editable ? (
                    <div className="header-editor">
                      <input
                        aria-label={t('Variable {column} name', { column: columnIndex + 1 })}
                        value={variable.name}
                        spellCheck={false}
                        onChange={(event) => update((next) => { next.variables[columnIndex].name = event.target.value; })}
                      />
                      <div className="header-meta">
                        <select
                          value={variable.kind}
                          aria-label={t('{variable} type', { variable: variable.name })}
                          title={t('Variable type')}
                          onChange={(event) => update((next) => {
                            next.variables[columnIndex].kind = event.target.value as VariableKind;
                          })}
                        >
                          <option value="regular">{t('Regular')}</option>
                          <option value="slack">{t('Slack')}</option>
                          <option value="artificial">{t('Artificial')}</option>
                        </select>
                        <button
                          className="icon-button tiny danger-quiet"
                          type="button"
                          title={t('Remove {variable}', { variable: variable.name })}
                          aria-label={t('Remove {variable}', { variable: variable.name })}
                          onClick={() => onRemoveVariable?.(variable.id)}
                        ><TrashIcon /></button>
                      </div>
                    </div>
                  ) : (
                    <VariableName name={variable.name} />
                  )}
                </th>
              ))}
              <th className="rhs-column sticky-right">{t('RHS')}</th>
            </tr>
          </thead>
        )}
        <tbody>
          {tableau.rows.map((row, rowIndex) => {
            const isHoveredRow = hovered?.row === rowIndex;
            const basisName = tableau.variables.find((variable) => variable.id === row.basisId)?.name;
            return (
              <tr key={row.id} className={isHoveredRow ? 'row-hover' : ''}>
                <th className="basis-cell sticky-left" scope="row">
                  {editable ? (
                    <span className="basis-edit-controls">
                      <span className="basis-select-wrap">
                        <select
                          className="basis-native-select"
                          value={row.basisId ?? ''}
                          aria-label={t('Basic variable in row {row}', { row: rowIndex + 1 })}
                          onChange={(event) => update((next) => {
                            const id = event.target.value || null;
                            if (id) next.rows.forEach((candidate) => { if (candidate.basisId === id) candidate.basisId = null; });
                            next.rows[rowIndex].basisId = id;
                          })}
                        >
                          <option value="">—</option>
                          {tableau.variables.map((variable) => (
                            <option key={variable.id} value={variable.id}>{variable.name}</option>
                          ))}
                        </select>
                        <span className="basis-select-display" aria-hidden="true">{basisName
                          ? <VariableName name={basisName} />
                          : <span className="empty-basis">—</span>}</span>
                        <ChevronIcon />
                      </span>
                      <button
                        className="icon-button tiny danger-quiet basis-row-remove"
                        type="button"
                        title={t('Remove constraint {row}', { row: rowIndex + 1 })}
                        aria-label={t('Remove constraint {row}', { row: rowIndex + 1 })}
                        onClick={() => onRemoveConstraint?.(row.id)}
                      ><TrashIcon /></button>
                    </span>
                  ) : basisName ? <VariableName name={basisName} /> : <span className="empty-basis">—</span>}
                </th>
                {row.values.slice(0, tableau.variables.length).map((value, columnIndex) => {
                  const variable = tableau.variables[columnIndex];
                  const selected = selection?.rowId === row.id && selection.variableId === variable.id;
                  const marked = pivotMark?.rowId === row.id && pivotMark.variableId === variable.id;
                  const isHoveredCell = hovered?.row === rowIndex && hovered.column === columnIndex;
                  const ratio = isHoveredCell ? ratioAt(tableau, rowIndex, columnIndex, algorithm) : null;
                  const numerator = algorithm === 'primal'
                    ? row.values[tableau.variables.length]
                    : tableau.objective[columnIndex];
                  const isMinimum = minimumRatio && selectedColumn === columnIndex && value.isPositive()
                    && numerator.div(value).equals(minimumRatio);
                  const classes = [
                    selected ? 'selected-pivot' : '',
                    marked ? 'historic-pivot' : '',
                    hovered?.column === columnIndex ? 'column-hover' : '',
                    selectedColumn === columnIndex ? 'selected-column' : '',
                    isMinimum ? 'minimum-ratio' : '',
                    isHoveredCell ? 'hovered-pivot-cell' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <td key={variable.id} className={classes}>
                      {editable ? (
                        <CellInput
                          value={value}
                          display={display}
                          ariaLabel={t('Coefficient of {variable} in row {row}', { variable: variable.name, row: rowIndex + 1 })}
                          onInvalid={onInvalid}
                          gridRow={rowIndex}
                          gridColumn={columnIndex}
                          onCommit={(number) => update((next) => { next.rows[rowIndex].values[columnIndex] = number; })}
                        />
                      ) : !onPivot ? (
                        <NumberValue value={value} display={display} />
                      ) : (
                        <button
                          type="button"
                          className="pivot-cell-button"
                          disabled={value.isZero()}
                          aria-label={t('{value} at row {row}, column {variable}', { value: value.toFraction(), row: rowIndex + 1, variable: variable.name })}
                          aria-pressed={selected && !isHoveredCell}
                          title={t(value.isZero() ? 'Zero cannot be used as a pivot' : 'Click to pivot immediately')}
                          onPointerDown={(event) => { pointerType.current = event.pointerType; }}
                          onClick={(event) => {
                            const pivot = { rowId: row.id, variableId: variable.id };
                            if (event.detail !== 0 && ['touch', 'pen'].includes(pointerType.current) && onSelectPivot) onSelectPivot(pivot);
                            else onPivot(pivot);
                          }}
                          onPointerEnter={(event) => {
                            if (event.pointerType !== 'mouse') return;
                            setHovered({ row: rowIndex, column: columnIndex });
                            onHoverPivot?.({ rowId: row.id, variableId: variable.id });
                          }}
                          onPointerLeave={() => {
                            setHovered(null);
                            onHoverPivot?.(null);
                          }}
                        >
                          <NumberValue value={value} display={display} />
                          {showPivotHints && ratio && (
                            <span className="pivot-ratio-tooltip" role="tooltip">
                              <span className="pivot-ratio-name">{algorithm === 'primal' ? t('RHS') : <>c<sub>{columnIndex + 1}</sub></>} / a<sub>{rowIndex + 1},{columnIndex + 1}</sub></span>
                              <span className="pivot-ratio-calculation">
                                <NumberValue value={numerator} display={display} />
                                <span>÷</span>
                                <NumberValue value={value} display={display} />
                                <span>=</span>
                                <strong><NumberValue value={ratio} display={display} /></strong>
                              </span>
                              <small>{t('Click to pivot immediately')}</small>
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className={`rhs-cell sticky-right${isHoveredRow ? ' row-hover' : ''}`}>
                  {editable ? (
                    <CellInput
                      value={row.values[tableau.variables.length]}
                      display={display}
                      ariaLabel={t('RHS in row {row}', { row: rowIndex + 1 })}
                      onInvalid={onInvalid}
                      gridRow={rowIndex}
                      gridColumn={tableau.variables.length}
                      onCommit={(number) => update((next) => { next.rows[rowIndex].values[tableau.variables.length] = number; })}
                    />
                  ) : (
                    <NumberValue value={row.values[tableau.variables.length]} display={display} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="objective-row">
            <th className="objective-name sticky-left">
              {editable ? (
                <input
                  aria-label={t('Objective row name')}
                  value={tableau.objectiveName}
                  onChange={(event) => update((next) => { next.objectiveName = event.target.value; })}
                />
              ) : <VariableName name={tableau.objectiveName} />}
            </th>
            {tableau.objective.slice(0, tableau.variables.length).map((value, columnIndex) => (
              <td key={tableau.variables[columnIndex].id} className={hovered?.column === columnIndex ? 'column-hover' : ''}>
                {editable ? (
                  <CellInput
                    value={value}
                    display={display}
                    ariaLabel={t('Objective coefficient of {variable}', { variable: tableau.variables[columnIndex].name })}
                    onInvalid={onInvalid}
                    gridRow={tableau.rows.length}
                    gridColumn={columnIndex}
                    onCommit={(number) => update((next) => { next.objective[columnIndex] = number; })}
                  />
                ) : <NumberValue value={value} display={display} />}
              </td>
            ))}
            <td className="objective-rhs sticky-right">
              {editable ? (
                <CellInput
                  value={tableau.objective[tableau.variables.length]}
                  display={display}
                  ariaLabel={t('Objective RHS')}
                  onInvalid={onInvalid}
                  gridRow={tableau.rows.length}
                  gridColumn={tableau.variables.length}
                  onCommit={(number) => update((next) => { next.objective[next.variables.length] = number; })}
                />
              ) : <NumberValue value={tableau.objective[tableau.variables.length]} display={display} />}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
