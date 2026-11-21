import { AppError } from '../app/i18n';
import {
  analyzeTableau,
  assertTableauShape,
  finishPhaseOne,
  phaseOneSuggestedRows,
  pivotTableau,
  primalEligibleRatios,
  type HistoryEntry,
  type Tableau,
  type TableauAnalysis,
} from './tableau';

type AutoSolveState = 'needsPhaseOne' | 'needsCanonicalObjective' | 'invalidPhaseOne' | 'ready' | 'complete';

export function autoSolveState(tableau: Tableau, analysis = analyzeTableau(tableau)): AutoSolveState {
  if (tableau.phase === 'phase1') {
    if (analysis === 'phaseOneInfeasible') return 'complete';
    return analysis === 'phaseOneRunning' || analysis === 'phaseOneFeasible' ? 'ready' : 'invalidPhaseOne';
  }
  if (tableau.variables.some((variable) => variable.kind === 'artificial') || phaseOneSuggestedRows(tableau).length > 0) {
    return 'needsPhaseOne';
  }
  if (analysis === 'noncanonical') return 'needsCanonicalObjective';
  return isTerminal(analysis) ? 'complete' : 'ready';
}

function isTerminal(analysis: TableauAnalysis): boolean {
  return analysis === 'optimal' || analysis === 'unbounded' || analysis === 'phaseOneInfeasible';
}

function chooseLeavingRow(tableau: Tableau, entering: number): number | null {
  const ratios = primalEligibleRatios(tableau, entering);
  const columns = new Map(tableau.variables.map((variable, index) => [variable.id, index]));
  const basisOrder = tableau.rows.map((row) => columns.get(row.basisId!)!);
  let leaving: number | null = null;
  ratios.forEach((ratio, index) => {
    if (!ratio) return;
    const comparison = leaving === null ? -1 : ratio.compare(ratios[leaving]!);
    // Bland's rule breaks ratio ties by the column of the basic variable.
    if (comparison < 0 || (comparison === 0 && basisOrder[index] < basisOrder[leaving!])) {
      leaving = index;
    }
  });
  return leaving;
}

export function* autoSolveTableau(initial: Tableau, initialIndex: number): Generator<Omit<HistoryEntry, 'id'>> {
  assertTableauShape(initial);
  const state = autoSolveState(initial);
  if (state !== 'ready' && state !== 'complete') {
    throw new AppError('Auto-solve needs a canonical tableau with nonnegative free terms.');
  }

  let tableau = initial;
  let step = initialIndex;
  while (true) {
    const analysis = analyzeTableau(tableau);
    if (isTerminal(analysis)) return;

    let entering: number;
    let leaving: number | null;
    if (analysis === 'phaseOneFeasible') {
      const artificialIds = new Set(tableau.variables.filter((variable) => variable.kind === 'artificial').map((variable) => variable.id));
      const row = tableau.rows.findIndex((candidate) => candidate.basisId && artificialIds.has(candidate.basisId)
        && tableau.variables.some((variable, column) => variable.kind !== 'artificial' && !candidate.values[column].isZero()));
      if (row < 0) {
        tableau = finishPhaseOne(tableau);
        step += 1;
        yield { tableau, label: 'Original objective restored' };
        continue;
      }
      leaving = row;
      entering = tableau.variables.findIndex((variable, column) => variable.kind !== 'artificial' && !tableau.rows[row].values[column].isZero());
      if (!tableau.rows[row].values.at(-1)!.isZero()) throw new AppError('The Phase I objective is inconsistent. Check the Phase I setup.');
    } else {
      // The first improving column in variable order is Bland's entering variable.
      entering = tableau.variables.findIndex((_, column) => tableau.objective[column].isNegative());
      leaving = entering < 0 ? null : chooseLeavingRow(tableau, entering);
      if (leaving === null) throw new AppError('The Phase I objective is inconsistent. Check the Phase I setup.');
    }

    const result = pivotTableau(tableau, leaving, entering);
    tableau = result.tableau;
    step += 1;
    yield { tableau, label: `Pivot ${step}: ${result.record.enteringName} enters`, pivot: result.record };
  }
}
