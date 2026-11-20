import type { NumberDisplay } from '../math/rational';
import { formatRational, Rational } from '../math/rational';
import { analyzeTableau, type Tableau, type TableauAnalysis, type TableauVariable } from './tableau';
import { translate, type Language } from '../app/i18n';

export interface SolutionResultValue {
  variable: TableauVariable;
  value: Rational;
}

export interface SolutionResult {
  objectiveName: string;
  objectiveValue: Rational;
  values: SolutionResultValue[];
}

export const analysisMessages: Record<TableauAnalysis, string> = {
  noncanonical: 'Assign a distinct unit column to each basis row and make each basic cost zero.',
  infeasibleBasis: 'The current basis is infeasible because at least one free term is negative.',
  feasible: 'The current basis is feasible. A negative reduced cost means this tableau cannot certify optimality.',
  optimal: 'The basis is canonical and feasible. All reduced costs are nonnegative.',
  unbounded: 'The objective is unbounded below. An improving column has no positive pivot coefficient.',
  phaseOneRunning: 'Continue Phase I to drive the sum of artificial variables to zero.',
  phaseOneFeasible: 'Phase I has reached −w = 0. The original constraints admit a feasible point.',
  phaseOneInfeasible: 'Phase I has a positive minimum for w. The original constraints have no feasible point.',
};

export function getSolutionResult(tableau: Tableau): SolutionResult {
  const rhsIndex = tableau.variables.length;
  const values = tableau.variables
    .filter((variable) => variable.kind === 'regular')
    .map((variable): SolutionResultValue => {
      const basicRow = tableau.rows.find((row) => row.basisId === variable.id);
      return {
        variable,
        value: basicRow?.values[rhsIndex] ?? Rational.ZERO,
      };
    });

  return {
    objectiveName: tableau.objectiveName,
    // The tableau stores the constant on the left-hand objective row. In the
    // usual minimization tableau convention used by the app, the displayed
    // objective value is its additive inverse.
    objectiveValue: tableau.objective[rhsIndex].neg(),
    values,
  };
}

export function formatSolutionResult(tableau: Tableau, display: NumberDisplay, language: Language = 'en'): string {
  const analysis = analyzeTableau(tableau);
  if (analysis !== 'optimal' && analysis !== 'feasible') return translate(language, analysisMessages[analysis]);
  const result = getSolutionResult(tableau);
  const point = result.values.map(({ value }) => formatRational(value, display)).join(', ');
  const coordinates = point ? ` ${translate(language, 'at')} (${point})` : '';
  return `${result.objectiveName}${analysis === 'optimal' ? 'ₘᵢₙ' : ''} = ${formatRational(result.objectiveValue, display)}${coordinates}`;
}
