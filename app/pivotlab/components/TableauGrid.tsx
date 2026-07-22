import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NumberDisplay } from '../math/rational';
import type { Algorithm, AppMode, PivotRecord, PivotSelection, Tableau, VariableKind } from '../model/tableau';
import { cloneTableau, maximumEligibleColumn, minimumEligibleRow } from '../model/tableau';
import { CellInput } from './CellInput';
import { ChevronIcon, TrashIcon } from './Icons';
import { NumberValue } from './NumberValue';
import { VariableName } from './VariableName';

const variableKindHints: Record<VariableKind, string> = {
  regular: 'Original variable',
  slack: 'Slack variable',
  artificial: 'Artificial variable',
  'split-positive': 'Positive part of unrestricted variable',
  'split-negative': 'Negative part of unrestricted variable',
};

interface TableauGridProps {
  tableau: Tableau;
  mode?: AppMode;
  algorithm?: Algorithm;
  display: NumberDisplay;
  selection?: PivotSelection | null;
  pivotMark?: PivotRecord;
  compact?: boolean;
  showHeader?: boolean;
  showPivotHints?: boolean;
  tableFontSize?: number;
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
  showPivotHints = false,
  tableFontSize = 18,
  onPivot,
  onHoverPivot,
  onChange,
  onRemoveVariable,
  onRemoveConstraint,
}: TableauGridProps) {
  const [hovered, setHovered] = useState<{ row: number; column: number } | null>(null);
  const [variableTip, setVariableTip] = useState<{ id: string; text: string; left: number; top: number } | null>(null);
  const variableTipTimer = useRef<number | null>(null);
  const selectedColumn = selection
    ? tableau.variables.findIndex((variable) => variable.id === selection.variableId)
    : -1;
  const selectedRow = selection
    ? tableau.rows.findIndex((row) => row.id === selection.rowId)
    : -1;
  const minimumRow = showPivotHints && selectedColumn >= 0 && algorithm === 'primal'
    ? minimumEligibleRow(tableau, selectedColumn)
    : null;
  const maximumColumn = showPivotHints && selectedRow >= 0 && algorithm === 'dual'
    ? maximumEligibleColumn(tableau, selectedRow)
    : null;
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

  const closeVariableTip = () => {
    if (variableTipTimer.current !== null) window.clearTimeout(variableTipTimer.current);
    variableTipTimer.current = null;
    setVariableTip(null);
  };

  const openVariableTip = (header: HTMLElement, variableId: string, text: string, delayed: boolean) => {
    if (variableTipTimer.current !== null) window.clearTimeout(variableTipTimer.current);
    const reveal = () => {
      const marker = header.querySelector<HTMLElement>('.variable-kind-marker');
      if (!marker) return;
      const bounds = marker.getBoundingClientRect();
      setVariableTip({
        id: variableId,
        text,
        left: bounds.left + bounds.width / 2,
        // Keeping the portal below every marker prevents the split + sign from
        // touching the pointer while preserving one tooltip level for all kinds.
        top: bounds.bottom + 10,
      });
      variableTipTimer.current = null;
    };
    if (delayed) variableTipTimer.current = window.setTimeout(reveal, 350);
    else reveal();
  };

  useEffect(() => {
    if (!variableTip) return undefined;
    // A fixed portal cannot follow a scrolling tableau without remeasurement;
    // dismissing it is less surprising than leaving it detached from its mark.
    const dismiss = () => closeVariableTip();
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [variableTip]);

  return (
    <div
      className={`tableau-scroll${compact ? ' compact-tableau' : ''}`}
      style={{
        '--table-min-width': `${tableMinimumWidth}px`,
        '--table-variable-width': `${variableWidth}px`,
        '--table-side-width': `${sideWidth}px`,
      } as React.CSSProperties}
      onMouseLeave={() => {
        setHovered(null);
        onHoverPivot?.(null);
        closeVariableTip();
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
        </colgroup>
        {showHeader && (
          <thead>
            <tr>
              <th className="basis-column sticky-left">Basis</th>
              {tableau.variables.map((variable, columnIndex) => (
                <th
                  key={variable.id}
                  className={`${hovered?.column === columnIndex ? 'column-hover' : ''} variable-header variable-${variable.kind}`}
                  tabIndex={editable ? undefined : 0}
                  aria-describedby={editable ? undefined : `variable-kind-tip-${variable.id}`}
                  onMouseEnter={(event) => {
                    if (!editable) openVariableTip(event.currentTarget, variable.id, variableKindHints[variable.kind], true);
                  }}
                  onMouseLeave={closeVariableTip}
                  onFocus={(event) => {
                    if (!editable) openVariableTip(event.currentTarget, variable.id, variableKindHints[variable.kind], false);
                  }}
                  onPointerUp={(event) => {
                    if (event.pointerType !== 'touch') return;
                    if (variableTip?.id === variable.id) closeVariableTip();
                    else openVariableTip(event.currentTarget, variable.id, variableKindHints[variable.kind], false);
                  }}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeVariableTip();
                  }}
                >
                  <span className="variable-kind-marker" aria-hidden="true">
                    {variable.kind === 'split-positive' ? '+' : variable.kind === 'split-negative' ? '−' : ''}
                  </span>
                  {/* The edit-mode selector already states the type; a second
                      hint there is redundant and can be clipped by the editor. */}
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
                          <option value="regular">Original</option>
                          <option value="slack">Slack</option>
                          <option value="artificial">Artificial</option>
                          <option value="split-positive">Split (+)</option>
                          <option value="split-negative">Split (−)</option>
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
                        <span className="basis-select-display" aria-hidden="true">{basisName
                          ? <VariableName name={basisName} />
                          : <span className="empty-basis">—</span>}</span>
                        <ChevronIcon />
                      </span>
                      <button
                        className="icon-button tiny danger-quiet basis-row-remove"
                        type="button"
                        title={`Remove constraint ${rowIndex + 1}`}
                        aria-label={`Remove constraint ${rowIndex + 1}`}
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
                  const classes = [
                    selected ? 'selected-pivot' : '',
                    marked ? 'historic-pivot' : '',
                    hovered?.column === columnIndex ? 'column-hover' : '',
                    selectedColumn === columnIndex ? 'selected-column' : '',
                    minimumRow === rowIndex && selectedColumn === columnIndex ? 'minimum-ratio' : '',
                    maximumColumn === columnIndex && selectedRow === rowIndex ? 'maximum-ratio' : '',
                    isHoveredCell ? 'hovered-pivot-cell' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <td key={variable.id} className={classes}>
                      {editable ? (
                        <CellInput
                          value={value}
                          display={display}
                          ariaLabel={`Coefficient of ${variable.name} in row ${rowIndex + 1}`}
                          gridRow={rowIndex}
                          gridColumn={columnIndex}
                          onCommit={(number) => update((next) => { next.rows[rowIndex].values[columnIndex] = number; })}
                        />
                      ) : compact ? (
                        <span className="tableau-number-slot"><NumberValue value={value} display={display} alignMagnitude /></span>
                      ) : (
                        <button
                          type="button"
                          className="pivot-cell-button"
                          disabled={value.isZero()}
                          aria-label={`${value.toFraction()} at row ${rowIndex + 1}, column ${variable.name}`}
                          title={value.isZero() ? 'Zero cannot be used as a pivot' : 'Click to pivot immediately'}
                          onClick={() => onPivot?.({ rowId: row.id, variableId: variable.id })}
                          onMouseEnter={() => {
                            // Hover feeds the persistent inspector only. Ratio
                            // popovers duplicate it and obscure nearby cells.
                            setHovered({ row: rowIndex, column: columnIndex });
                            onHoverPivot?.({ rowId: row.id, variableId: variable.id });
                          }}
                          onMouseLeave={() => {
                            setHovered(null);
                          }}
                        >
                          <NumberValue value={value} display={display} alignMagnitude />
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
                      gridRow={rowIndex}
                      gridColumn={tableau.variables.length}
                      onCommit={(number) => update((next) => { next.rows[rowIndex].values[tableau.variables.length] = number; })}
                    />
                  ) : (
                    <span className="tableau-number-slot"><NumberValue value={row.values[tableau.variables.length]} display={display} alignMagnitude /></span>
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
                    gridRow={tableau.rows.length}
                    gridColumn={columnIndex}
                    onCommit={(number) => update((next) => { next.objective[columnIndex] = number; })}
                  />
                ) : <span className="tableau-number-slot"><NumberValue value={value} display={display} alignMagnitude /></span>}
              </td>
            ))}
            <td className="objective-rhs sticky-right">
              {editable ? (
                <CellInput
                  value={tableau.objective[tableau.variables.length]}
                  display={display}
                  ariaLabel="Objective RHS"
                  gridRow={tableau.rows.length}
                  gridColumn={tableau.variables.length}
                  onCommit={(number) => update((next) => { next.objective[next.variables.length] = number; })}
                />
              ) : <span className="tableau-number-slot"><NumberValue value={tableau.objective[tableau.variables.length]} display={display} alignMagnitude /></span>}
            </td>
          </tr>
        </tfoot>
      </table>
      {variableTip && createPortal(
        <span
          id={`variable-kind-tip-${variableTip.id}`}
          className="control-tooltip variable-kind-tooltip variable-kind-tooltip-portal"
          role="tooltip"
          style={{ left: variableTip.left, top: variableTip.top }}
        >{variableTip.text}</span>,
        document.body,
      )}
    </div>
  );
}
