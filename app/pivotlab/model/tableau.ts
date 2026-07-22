import { Rational } from '../math/rational';

export type VariableKind = 'regular' | 'slack' | 'artificial' | 'split-positive' | 'split-negative';
export type Algorithm = 'primal' | 'dual';
export type AppMode = 'edit' | 'pivot';

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

export function isVariableKind(value: unknown): value is VariableKind {
  return value === 'regular'
    || value === 'slack'
    || value === 'artificial'
    || value === 'split-positive'
    || value === 'split-negative';
}

export function isDecisionVariableKind(kind: VariableKind): boolean {
  // Split columns remain decision-variable coordinates even though recovering
  // the unsplit value requires the user-defined positive/negative pairing.
  return kind === 'regular' || kind === 'split-positive' || kind === 'split-negative';
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

export function dualEligibleRatios(tableau: Tableau, rowIndex: number): Array<Rational | null> {
  const row = tableau.rows[rowIndex];
  if (!row) return Array.from({ length: tableau.variables.length }, () => null);
  const rhs = row.values[tableau.variables.length];
  // With the displayed c_j / a_i,j convention, a dual-simplex candidate has
  // negative RHS, negative row coefficient, and nonnegative reduced cost.
  // Its ratio is therefore nonpositive, and the largest ratio is the usual
  // minimum c_j / (-a_i,j) written without hiding the sign of a_i,j.
  if (!rhs.isNegative()) return Array.from({ length: tableau.variables.length }, () => null);
  return tableau.variables.map((_, columnIndex) => {
    const coefficient = row.values[columnIndex];
    const objectiveCoefficient = tableau.objective[columnIndex];
    if (!coefficient.isNegative() || objectiveCoefficient.isNegative()) return null;
    return objectiveCoefficient.div(coefficient);
  });
}

export function maximumEligibleColumn(tableau: Tableau, rowIndex: number): number | null {
  const ratios = dualEligibleRatios(tableau, rowIndex);
  let maximumIndex: number | null = null;
  ratios.forEach((ratio, index) => {
    if (!ratio) return;
    if (maximumIndex === null || ratio.compare(ratios[maximumIndex]!) > 0) maximumIndex = index;
  });
  return maximumIndex;
}

export function detectBasis(tableau: Tableau): Tableau {
  const next = cloneTableau(tableau);
  const claimed = new Set<string>();
  next.rows.forEach((row, rowIndex) => {
    const existing = next.variables.find((variable) => variable.id === row.basisId);
    if (existing && !claimed.has(existing.id)) {
      claimed.add(existing.id);
      return;
    }
    const basisVariable = next.variables.find((variable, columnIndex) => {
      if (claimed.has(variable.id)) return false;
      return next.rows.every((candidateRow, candidateIndex) => {
        const expected = candidateIndex === rowIndex ? Rational.ONE : Rational.ZERO;
        return candidateRow.values[columnIndex].equals(expected);
      });
    });
    row.basisId = basisVariable?.id ?? null;
    if (basisVariable) claimed.add(basisVariable.id);
  });
  return next;
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
  if (tableau.phase === 'phase1') throw new Error('Phase I is already active.');
  if (selectedRowIds.length === 0) throw new Error('Select at least one row that needs an artificial variable.');
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
    while (names.has(`z${artificialCounter}`)) artificialCounter += 1;
    const variable: TableauVariable = {
      id: makeId('art'),
      name: `z${artificialCounter}`,
      kind: 'artificial',
    };
    names.add(variable.name);
    artificialCounter += 1;
    const insertionIndex = next.variables.length;
    next.variables.push(variable);
    next.rows.forEach((candidate) => {
      candidate.values.splice(candidate.values.length - 1, 0, candidate.id === row.id ? Rational.ONE : Rational.ZERO);
    });
    row.basisId = variable.id;
    if (insertionIndex !== next.variables.length - 1) throw new Error('Internal Phase I column error.');
  }

  next.objectiveName = '−w';
  next.objective = Array.from({ length: next.variables.length + 1 }, () => Rational.ZERO);
  next.variables.forEach((variable, index) => {
    if (variable.kind === 'artificial') next.objective[index] = Rational.ONE;
  });
  next.rows.forEach((row) => {
    const basis = next.variables.find((variable) => variable.id === row.basisId);
    if (basis?.kind !== 'artificial') return;
    const coefficient = next.objective[next.variables.findIndex((variable) => variable.id === basis.id)];
    next.objective = next.objective.map((value, index) => value.sub(coefficient.mul(row.values[index])));
  });
  next.phase = 'phase1';
  return next;
}

export function finishPhaseOne(tableau: Tableau): Tableau {
  if (tableau.phase !== 'phase1' || !tableau.storedObjective) {
    throw new Error('Phase I is not active.');
  }
  const rhs = tableau.objective[tableau.variables.length];
  if (!rhs.isZero()) {
    throw new Error(`Phase I can finish only when −w = 0; currently −w = ${rhs.toFraction()}.`);
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

  next.rows.forEach((row) => {
    const basicColumn = next.variables.findIndex((variable) => variable.id === row.basisId);
    if (basicColumn < 0) return;
    const coefficient = next.objective[basicColumn];
    if (coefficient.isZero()) return;
    next.objective = next.objective.map((value, index) => value.sub(coefficient.mul(row.values[index])));
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
