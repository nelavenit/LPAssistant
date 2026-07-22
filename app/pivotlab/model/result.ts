import type { NumberDisplay } from '../math/rational';
import { formatRational, Rational } from '../math/rational';
import { isDecisionVariableKind, type Tableau, type TableauVariable } from './tableau';

export interface SolutionResultValue {
  variable: TableauVariable;
  value: Rational;
}

export interface SolutionResult {
  objectiveName: string;
  objectiveValue: Rational;
  values: SolutionResultValue[];
}

export function getSolutionResult(tableau: Tableau): SolutionResult {
  const rhsIndex = tableau.variables.length;
  const values = tableau.variables
    .filter((variable) => isDecisionVariableKind(variable.kind))
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

export function formatSolutionResult(tableau: Tableau, display: NumberDisplay): string {
  const result = getSolutionResult(tableau);
  const point = result.values.map(({ value }) => formatRational(value, display)).join(', ');
  return `${result.objectiveName}ₘᵢₙ = ${formatRational(result.objectiveValue, display)} at (${point})`;
}
