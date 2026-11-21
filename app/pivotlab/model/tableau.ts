import { Rational } from '../math/rational';
import { AppError, type Translate } from '../app/i18n';

export type VariableKind = 'regular' | 'slack' | 'artificial';
export type Algorithm = 'primal' | 'dual';
export type AppMode = 'edit' | 'pivot' | 'auto';

export interface TableauVariable {
  id: string;
  name: string;
  kind: VariableKind;
}

export interface TableauRow {
  id: string;
  basisId: string | null;
  values: Rational[];
}

export interface StoredObjective {
  name: string;
  variableIds: string[];
  values: Rational[];
}

export interface Tableau {
  id: string;
  title: string;
  variables: TableauVariable[];
  rows: TableauRow[];
  objectiveName: string;
  objective: Rational[];
  phase: 'original' | 'phase1';
  storedObjective?: StoredObjective;
}

export interface PivotSelection {
  rowId: string;
  variableId: string;
}

export interface PivotRecord extends PivotSelection {
  enteringName: string;
  leavingName: string;
  pivotValue: string;
}

export interface HistoryEntry {
  id: string;
  label: string;
  tableau: Tableau;
  pivot?: PivotRecord;
}

export function describeHistoryEntry(t: Translate, entry: HistoryEntry, index: number): string {
  if (entry.pivot && entry.label === `Pivot ${index}: ${entry.pivot.enteringName} enters`) {
    return t('Pivot {step}: {variable} enters', { step: index, variable: entry.pivot.enteringName });
  }
  if (entry.label === `Step ${index}`) return t('Step {number}', { number: index });
  return ['Initial tableau', 'Phase I setup', 'Original objective restored'].includes(entry.label) ? t(entry.label) : entry.label;
}

export function makeId(prefix = 'id'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createBlankTableau(rowCount = 3, variableCount = 5, title = 'Untitled tableau'): Tableau {
  const variables = Array.from({ length: variableCount }, (_, index): TableauVariable => ({
    id: makeId('var'),
    name: `x${index + 1}`,
    kind: 'regular',
  }));
  const rows = Array.from({ length: rowCount }, (): TableauRow => ({
    id: makeId('row'),
    basisId: null,
    values: Array.from({ length: variableCount + 1 }, () => Rational.ZERO),
  }));
  return {
    id: makeId('tableau'),
    title,
    variables,
    rows,
    objectiveName: 'f',
    objective: Array.from({ length: variableCount + 1 }, () => Rational.ZERO),
    phase: 'original',
  };
}

export function createTextbookExample(): Tableau {
  const tableau = createBlankTableau(3, 7, 'Example 7.4.1');
  tableau.variables[4].kind = 'slack';
  tableau.variables[5].kind = 'slack';
  tableau.variables[6].kind = 'slack';
  tableau.rows[0].values = rationals(['2', '0', '-1', '3', '1', '0', '0', '20']);
  tableau.rows[1].values = rationals(['0', '1', '-2', '-1', '0', '1', '0', '30']);
  tableau.rows[2].values = rationals(['-3', '6', '3', '4', '0', '0', '1', '24']);
  tableau.rows[0].basisId = tableau.variables[4].id;
  tableau.rows[1].basisId = tableau.variables[5].id;
  tableau.rows[2].basisId = tableau.variables[6].id;
  tableau.objectiveName = 'f';
  tableau.objective = rationals(['5', '-18', '-6', '1', '0', '0', '0', '0']);
  return tableau;
}

function rationals(values: string[]): Rational[] {
  return values.map((value) => Rational.parse(value));
}

export function cloneTableau(tableau: Tableau): Tableau {
  return {
    ...tableau,
    variables: tableau.variables.map((variable) => ({ ...variable })),
    rows: tableau.rows.map((row) => ({ ...row, values: [...row.values] })),
    objective: [...tableau.objective],
    storedObjective: tableau.storedObjective
      ? {
          ...tableau.storedObjective,
          variableIds: [...tableau.storedObjective.variableIds],
          values: [...tableau.storedObjective.values],
        }
      : undefined,
  };
}

export function pivotTableau(
  tableau: Tableau,
  rowIndex: number,
  columnIndex: number,
): { tableau: Tableau; record: PivotRecord } {
  assertTableauShape(tableau);
  const sourceRow = tableau.rows[rowIndex];
  const entering = tableau.variables[columnIndex];
  if (!sourceRow || !entering) throw new RangeError('The pivot location is outside the tableau.');
  const pivotValue = sourceRow.values[columnIndex];
  if (pivotValue.isZero()) throw new RangeError('A pivot element must be nonzero.');

  const next = cloneTableau(tableau);
  const leaving = next.variables.find((variable) => variable.id === sourceRow.basisId)?.name ?? '—';
  const normalizedPivotRow = sourceRow.values.map((value) => value.div(pivotValue));

  next.rows = tableau.rows.map((row, index) => {
    if (index === rowIndex) {
      return { ...next.rows[index], basisId: entering.id, values: normalizedPivotRow };
    }
    const multiple = row.values[columnIndex];
    return {
      ...next.rows[index],
      basisId: row.basisId === entering.id ? null : row.basisId,
      values: row.values.map((value, valueIndex) =>
        value.sub(multiple.mul(normalizedPivotRow[valueIndex])),
      ),
    };
  });

  const objectiveMultiple = tableau.objective[columnIndex];
  next.objective = tableau.objective.map((value, valueIndex) =>
    value.sub(objectiveMultiple.mul(normalizedPivotRow[valueIndex])),
  );

  return {
    tableau: next,
    record: {
      rowId: sourceRow.id,
      variableId: entering.id,
      enteringName: entering.name,
      leavingName: leaving,
      pivotValue: pivotValue.toFraction(),
    },
  };
}

export function ratioAt(
  tableau: Tableau,
  rowIndex: number,
  columnIndex: number,
  algorithm: Algorithm,
): Rational | null {
  const coefficient = tableau.rows[rowIndex]?.values[columnIndex];
  if (!coefficient || coefficient.isZero()) return null;
  const numerator = algorithm === 'primal'
    ? tableau.rows[rowIndex].values[tableau.variables.length]
    : tableau.objective[columnIndex];
  return numerator.div(coefficient);
}

export function primalEligibleRatios(tableau: Tableau, columnIndex: number): Array<Rational | null> {
  const rhsIndex = tableau.variables.length;
  return tableau.rows.map((row) => {
    const coefficient = row.values[columnIndex];
    return coefficient.isPositive() ? row.values[rhsIndex].div(coefficient) : null;
  });
}

export function minimumEligibleRow(tableau: Tableau, columnIndex: number): number | null {
  const ratios = primalEligibleRatios(tableau, columnIndex);
  let minimumIndex: number | null = null;
  ratios.forEach((ratio, index) => {
    if (!ratio || ratio.isNegative()) return;
    if (minimumIndex === null || ratio.compare(ratios[minimumIndex]!) < 0) minimumIndex = index;
  });
  return minimumIndex;
}

export function detectBasis(tableau: Tableau): Tableau {
  const next = cloneTableau(tableau);
  const claimed = new Set<string>();
  next.rows.forEach((row, rowIndex) => {
    const existingColumn = next.variables.findIndex((variable) => variable.id === row.basisId);
    const existing = next.variables[existingColumn];
    if (existing && !claimed.has(existing.id) && isUnitColumn(next, rowIndex, existingColumn)) {
      claimed.add(existing.id);
      return;
    }
    const basisVariable = next.variables.find((variable, columnIndex) => {
      if (claimed.has(variable.id)) return false;
      return isUnitColumn(next, rowIndex, columnIndex);
    });
    row.basisId = basisVariable?.id ?? null;
    if (basisVariable) claimed.add(basisVariable.id);
  });
  return next;
}

function isUnitColumn(tableau: Tableau, rowIndex: number, columnIndex: number): boolean {
  return tableau.rows.every((row, index) => row.values[columnIndex].equals(index === rowIndex ? Rational.ONE : Rational.ZERO));
}

function basisColumns(tableau: Tableau): number[] | null {
  const columns = tableau.rows.map((row) => tableau.variables.findIndex((variable) => variable.id === row.basisId));
  return columns.every((column, row) => column >= 0 && isUnitColumn(tableau, row, column)) ? columns : null;
}

export type TableauAnalysis = 'noncanonical' | 'infeasibleBasis' | 'feasible' | 'optimal' | 'unbounded'
  | 'phaseOneRunning' | 'phaseOneFeasible' | 'phaseOneInfeasible';

export function analyzeTableau(tableau: Tableau): TableauAnalysis {
  const columns = basisColumns(tableau);
  if (!columns || columns.some((column) => !tableau.objective[column].isZero())) return 'noncanonical';
  const rhsIndex = tableau.variables.length;
  if (tableau.rows.some((row) => row.values[rhsIndex].isNegative())) return 'infeasibleBasis';
  const improving = tableau.objective.slice(0, rhsIndex).flatMap((value, index) => value.isNegative() ? [index] : []);
  if (tableau.phase === 'phase1') {
    const objective = tableau.objective[rhsIndex].neg();
    // An arbitrary manual pivot or a malformed imported tableau can violate w ≥ 0.
    if (objective.isNegative()) return 'noncanonical';
    if (objective.isZero()) return 'phaseOneFeasible';
    return improving.length === 0 ? 'phaseOneInfeasible' : 'phaseOneRunning';
  }
  if (improving.length === 0) return 'optimal';
  return improving.some((column) => tableau.rows.every((row) => !row.values[column].isPositive())) ? 'unbounded' : 'feasible';
}

export function canonicalizeObjective(tableau: Tableau): Tableau {
  const columns = basisColumns(tableau);
  if (!columns) throw new AppError('Assign a distinct unit column to each basis row first.');
  const next = cloneTableau(tableau);
  columns.forEach((column, row) => eliminateObjectiveCoefficient(next, row, column));
  return next;
}

function eliminateObjectiveCoefficient(tableau: Tableau, row: number, column: number) {
  const coefficient = tableau.objective[column];
  if (coefficient.isZero()) return;
  tableau.objective = tableau.objective.map((value, index) => value.sub(coefficient.mul(tableau.rows[row].values[index])));
}

export function addVariable(tableau: Tableau, kind: VariableKind = 'regular'): Tableau {
  const next = cloneTableau(tableau);
  const prefix = kind === 'artificial' ? 'z' : kind === 'slack' ? 's' : 'x';
  const usedNames = new Set(next.variables.map((variable) => variable.name));
  let counter = 1;
  while (usedNames.has(`${prefix}${counter}`)) counter += 1;
  next.variables.push({ id: makeId('var'), name: `${prefix}${counter}`, kind });
  next.rows.forEach((row) => row.values.splice(row.values.length - 1, 0, Rational.ZERO));
  next.objective.splice(next.objective.length - 1, 0, Rational.ZERO);
  return next;
}

export function removeVariable(tableau: Tableau, variableId: string): Tableau {
  if (tableau.phase === 'phase1') throw new Error('Finish or undo Phase I before removing variables.');
  const columnIndex = tableau.variables.findIndex((variable) => variable.id === variableId);
  if (columnIndex < 0) return tableau;
  if (tableau.variables.length <= 1) throw new Error('A tableau must contain at least one variable.');
  const next = cloneTableau(tableau);
  next.variables.splice(columnIndex, 1);
  next.rows.forEach((row) => {
    row.values.splice(columnIndex, 1);
    if (row.basisId === variableId) row.basisId = null;
  });
  next.objective.splice(columnIndex, 1);
  return next;
}

export function addConstraint(tableau: Tableau): Tableau {
  const next = cloneTableau(tableau);
  next.rows.push({
    id: makeId('row'),
    basisId: null,
    values: Array.from({ length: next.variables.length + 1 }, () => Rational.ZERO),
  });
  return next;
}

export function removeConstraint(tableau: Tableau, rowId: string): Tableau {
  if (tableau.phase === 'phase1') throw new Error('Finish or undo Phase I before removing constraints.');
  if (tableau.rows.length <= 1) throw new Error('A tableau must contain at least one constraint.');
  const next = cloneTableau(tableau);
  next.rows = next.rows.filter((row) => row.id !== rowId);
  return next;
}

export function startPhaseOne(tableau: Tableau, selectedRowIds: string[]): Tableau {
  assertTableauShape(tableau);
  if (tableau.phase === 'phase1') throw new Error('Phase I is already active.');
  if (selectedRowIds.length === 0 && !tableau.variables.some((variable) => variable.kind === 'artificial')) {
    throw new Error('Select at least one row that needs an artificial variable.');
  }
  const selected = new Set(selectedRowIds);
  const missing = selectedRowIds.filter((id) => !tableau.rows.some((row) => row.id === id));
  if (missing.length > 0) throw new Error('A selected constraint no longer exists.');

  const next = cloneTableau(tableau);
  next.storedObjective = {
    name: tableau.objectiveName,
    variableIds: tableau.variables.map((variable) => variable.id),
    values: [...tableau.objective],
  };

  let artificialCounter = 1;
  const names = new Set(next.variables.map((variable) => variable.name));
  for (const row of next.rows) {
    if (!selected.has(row.id)) continue;
    if (row.values.at(-1)!.isNegative()) row.values = row.values.map((value) => value.neg());
    while (names.has(`z${artificialCounter}`)) artificialCounter += 1;
    const variable: TableauVariable = {
      id: makeId('art'),
      name: `z${artificialCounter}`,
      kind: 'artificial',
    };
    names.add(variable.name);
    artificialCounter += 1;
    next.variables.push(variable);
    next.rows.forEach((candidate) => {
      candidate.values.splice(candidate.values.length - 1, 0, candidate.id === row.id ? Rational.ONE : Rational.ZERO);
    });
    row.basisId = variable.id;
  }

  next.objectiveName = '−w';
  next.objective = Array.from({ length: next.variables.length + 1 }, () => Rational.ZERO);
  next.variables.forEach((variable, index) => {
    if (variable.kind === 'artificial') next.objective[index] = Rational.ONE;
  });
  next.rows.forEach((row, rowIndex) => {
    const column = next.variables.findIndex((variable) => variable.id === row.basisId);
    if (column >= 0 && isUnitColumn(next, rowIndex, column)) eliminateObjectiveCoefficient(next, rowIndex, column);
  });
  next.phase = 'phase1';
  return next;
}

export function phaseOneSuggestedRows(tableau: Tableau): string[] {
  return tableau.rows.flatMap((row, rowIndex) => {
    const column = tableau.variables.findIndex((variable) => variable.id === row.basisId);
    return column < 0 || !isUnitColumn(tableau, rowIndex, column) || row.values.at(-1)!.isNegative() ? [row.id] : [];
  });
}

export function finishPhaseOne(tableau: Tableau): Tableau {
  if (tableau.phase !== 'phase1' || !tableau.storedObjective) {
    throw new Error('Phase I is not active.');
  }
  const rhs = tableau.objective[tableau.variables.length];
  if (!rhs.isZero()) {
    throw new AppError('Phase I can finish only when −w = 0; currently −w = {value}.', { value: rhs.toFraction() });
  }
  if (analyzeTableau(tableau) !== 'phaseOneFeasible') {
    throw new AppError('Complete the canonical basis and make all free terms nonnegative before finishing Phase I.');
  }
  const next = cloneTableau(tableau);
  const artificialBasisRows = next.rows.filter((row) =>
    next.variables.find((variable) => variable.id === row.basisId)?.kind === 'artificial',
  );
  const redundantRowIds = new Set<string>();
  artificialBasisRows.forEach((row) => {
    const rhsValue = row.values[next.variables.length];
    const hasNonArtificialCoefficient = next.variables.some((variable, index) =>
      variable.kind !== 'artificial' && !row.values[index].isZero(),
    );
    if (rhsValue.isZero() && !hasNonArtificialCoefficient) redundantRowIds.add(row.id);
  });
  const pivotableArtificialRow = artificialBasisRows.find((row) => !redundantRowIds.has(row.id));
  if (pivotableArtificialRow) {
    throw new Error('An artificial variable is still basic. Pivot it out before finishing Phase I.');
  }
  next.rows = next.rows.filter((row) => !redundantRowIds.has(row.id));

  const keptVariables = next.variables.filter((variable) => variable.kind !== 'artificial');
  if (keptVariables.length === 0) throw new AppError('The tableau must contain a variable from the original problem.');
  const keptIndices = keptVariables.map((variable) => next.variables.findIndex((candidate) => candidate.id === variable.id));
  const oldRhsIndex = next.variables.length;
  next.rows.forEach((row) => {
    row.values = [...keptIndices.map((index) => row.values[index]), row.values[oldRhsIndex]];
  });
  next.variables = keptVariables;

  const stored = next.storedObjective;
  if (!stored) throw new Error('The original objective row is missing.');
  const storedRhs = stored.values[stored.variableIds.length];
  next.objective = [
    ...keptVariables.map((variable) => {
      const index = stored.variableIds.indexOf(variable.id);
      return index >= 0 ? stored.values[index] : Rational.ZERO;
    }),
    storedRhs,
  ];
  next.objectiveName = stored.name;

  next.rows.forEach((row, rowIndex) => {
    const basicColumn = next.variables.findIndex((variable) => variable.id === row.basisId);
    eliminateObjectiveCoefficient(next, rowIndex, basicColumn);
  });
  next.phase = 'original';
  next.storedObjective = undefined;
  return next;
}

export function assertTableauShape(tableau: Tableau): void {
  const expected = tableau.variables.length + 1;
  if (tableau.objective.length !== expected || tableau.rows.some((row) => row.values.length !== expected)) {
    throw new Error('The tableau has inconsistent row lengths.');
  }
}
