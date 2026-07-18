import { useState } from 'react';
import type { NumberDisplay } from '../math/rational';
import type { Algorithm, AppMode, PivotRecord, PivotSelection, Tableau, VariableKind } from '../model/tableau';
import { cloneTableau, minimumEligibleRow, ratioAt } from '../model/tableau';
import { CellInput } from './CellInput';
import { TrashIcon } from './Icons';
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
  onPivot?: (selection: PivotSelection) => void;
  onHoverPivot?: (selection: PivotSelection | null) => void;
  onChange?: (tableau: Tableau) => void;
  onRemoveVariable?: (variableId: string) => void;
  onRemoveConstraint?: (rowId: string) => void;
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
  onPivot,
  onHoverPivot,
  onChange,
  onRemoveVariable,
  onRemoveConstraint,
}: TableauGridProps) {
  const [hovered, setHovered] = useState<{ row: number; column: number } | null>(null);
  const selectedColumn = selection
    ? tableau.variables.findIndex((variable) => variable.id === selection.variableId)
    : -1;
  const minimumRow = selectedColumn >= 0 && algorithm === 'primal'
    ? minimumEligibleRow(tableau, selectedColumn)
    : null;
  const editable = mode === 'edit' && Boolean(onChange) && !compact;
  const tableMinimumWidth = 104 + tableau.variables.length * 132 + 104 + (editable ? 48 : 0);

  const update = (mutator: (next: Tableau) => void) => {
    if (!onChange) return;
    const next = cloneTableau(tableau);
    mutator(next);
    onChange(next);
  };

  return (
    <div
      className={`tableau-scroll${compact ? ' compact-tableau' : ''}`}
      style={{ '--table-min-width': `${tableMinimumWidth}px` } as React.CSSProperties}
      onMouseLeave={() => {
        setHovered(null);
        onHoverPivot?.(null);
      }}
    >
      <table
        className="tableau-grid"
        style={{ '--variable-count': tableau.variables.length } as React.CSSProperties}
      >
        <colgroup>
          <col className="basis-col" />
          {tableau.variables.map((variable) => <col key={variable.id} className="variable-col" />)}
          <col className="rhs-col" />
          {editable && <col className="row-actions-col" />}
        </colgroup>
        {showHeader && (
          <thead>
            <tr>
              <th className="basis-column sticky-left">Basis</th>
              {tableau.variables.map((variable, columnIndex) => (
                <th
                  key={variable.id}
                  className={`${hovered?.column === columnIndex ? 'column-hover' : ''} variable-header variable-${variable.kind}`}
                >
                  {editable ? (
                    <div className="header-editor">
                      <input
                        aria-label={`Variable ${columnIndex + 1} name`}
                        value={variable.name}
                        spellCheck={false}
                        onChange={(event) => update((next) => { next.variables[columnIndex].name = event.target.value; })}
                      />
                      <div className="header-meta">
                        <select
                          value={variable.kind}
                          aria-label={`${variable.name} type`}
                          title="Variable type"
                          onChange={(event) => update((next) => {
                            next.variables[columnIndex].kind = event.target.value as VariableKind;
                          })}
                        >
                          <option value="regular">Regular</option>
                          <option value="slack">Slack</option>
                          <option value="artificial">Artificial</option>
                        </select>
                        <button
                          className="icon-button tiny danger-quiet"
                          type="button"
                          title={`Remove ${variable.name}`}
                          aria-label={`Remove ${variable.name}`}
                          onClick={() => onRemoveVariable?.(variable.id)}
                        ><TrashIcon /></button>
                      </div>
                    </div>
                  ) : (
                    <VariableName name={variable.name} />
                  )}
                </th>
              ))}
              <th className="rhs-column sticky-right">RHS</th>
              {editable && <th className="row-actions-column" aria-label="Row actions" />}
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
                    <select
                      value={row.basisId ?? ''}
                      aria-label={`Basic variable in row ${rowIndex + 1}`}
                      onChange={(event) => update((next) => {
                        next.rows[rowIndex].basisId = event.target.value || null;
                      })}
                    >
                      <option value="">—</option>
                      {tableau.variables.map((variable) => (
                        <option key={variable.id} value={variable.id}>{variable.name}</option>
                      ))}
                    </select>
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
                  const classes = [
                    selected ? 'selected-pivot' : '',
                    marked ? 'historic-pivot' : '',
                    hovered?.column === columnIndex ? 'column-hover' : '',
                    selectedColumn === columnIndex ? 'selected-column' : '',
                    minimumRow === rowIndex && selectedColumn === columnIndex ? 'minimum-ratio' : '',
                    isHoveredCell ? 'hovered-pivot-cell' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <td key={variable.id} className={classes}>
                      {editable ? (
                        <CellInput
                          value={value}
                          display={display}
                          ariaLabel={`Coefficient of ${variable.name} in row ${rowIndex + 1}`}
                          onCommit={(number) => update((next) => { next.rows[rowIndex].values[columnIndex] = number; })}
                        />
                      ) : compact ? (
                        <NumberValue value={value} display={display} />
                      ) : (
                        <button
                          type="button"
                          className="pivot-cell-button"
                          disabled={value.isZero()}
                          aria-label={`${value.toFraction()} at row ${rowIndex + 1}, column ${variable.name}`}
                          title={value.isZero() ? 'Zero cannot be used as a pivot' : 'Click to pivot immediately'}
                          onClick={() => onPivot?.({ rowId: row.id, variableId: variable.id })}
                          onMouseEnter={() => {
                            setHovered({ row: rowIndex, column: columnIndex });
                            onHoverPivot?.({ rowId: row.id, variableId: variable.id });
                          }}
                          onMouseLeave={() => {
                            setHovered(null);
                          }}
                        >
                          <NumberValue value={value} display={display} />
                          {ratio && (
                            <span className="pivot-ratio-tooltip" role="tooltip">
                              <span className="pivot-ratio-name">{algorithm === 'primal' ? 'RHS' : <>c<sub>{columnIndex + 1}</sub></>} / a<sub>{rowIndex + 1},{columnIndex + 1}</sub></span>
                              <span className="pivot-ratio-calculation">
                                <NumberValue value={numerator} display={display} />
                                <span>÷</span>
                                <NumberValue value={value} display={display} />
                                <span>=</span>
                                <strong><NumberValue value={ratio} display={display} /></strong>
                              </span>
                              <small>Click to pivot</small>
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
                      ariaLabel={`RHS in row ${rowIndex + 1}`}
                      onCommit={(number) => update((next) => { next.rows[rowIndex].values[tableau.variables.length] = number; })}
                    />
                  ) : (
                    <NumberValue value={row.values[tableau.variables.length]} display={display} />
                  )}
                </td>
                {editable && (
                  <td className="row-actions-cell">
                    <button
                      className="icon-button danger-quiet"
                      type="button"
                      title={`Remove constraint ${rowIndex + 1}`}
                      aria-label={`Remove constraint ${rowIndex + 1}`}
                      onClick={() => onRemoveConstraint?.(row.id)}
                    ><TrashIcon /></button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="objective-row">
            <th className="objective-name sticky-left">
              {editable ? (
                <input
                  aria-label="Objective row name"
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
                    ariaLabel={`Objective coefficient of ${tableau.variables[columnIndex].name}`}
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
                  ariaLabel="Objective RHS"
                  onCommit={(number) => update((next) => { next.objective[next.variables.length] = number; })}
                />
              ) : <NumberValue value={tableau.objective[tableau.variables.length]} display={display} />}
            </td>
            {editable && <td className="row-actions-cell" />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
