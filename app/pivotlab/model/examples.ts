import { Rational } from '../math/rational';
import { assertTableauShape, createBlankTableau, type Tableau, type VariableKind } from './tableau';

export interface ExampleProblem {
  id: string;
  title: string;
  description: string;
  create: () => Tableau;
}

interface ExampleTableauSpec {
  title: string;
  rows: string[][];
  objective: string[];
  kinds: VariableKind[];
  basis: Array<number | null>;
  names?: string[];
}

function createExampleTableau(spec: ExampleTableauSpec): Tableau {
  const tableau = createBlankTableau(spec.rows.length, spec.kinds.length, spec.title);
  const nameCounters = { original: 0, slack: 0, artificial: 0 };
  tableau.variables.forEach((variable, index) => {
    variable.kind = spec.kinds[index];
    // Example notation follows semantic families, not physical column numbers:
    // x1, x2, ... and s1, s2, ... are independent sequences.
    variable.name = spec.names?.[index] ?? nextExampleVariableName(variable.kind, nameCounters);
  });
  tableau.rows.forEach((row, index) => {
    row.values = spec.rows[index].map(Rational.parse);
    const basisIndex = spec.basis[index];
    row.basisId = basisIndex === null ? null : tableau.variables[basisIndex].id;
  });
  tableau.objective = spec.objective.map(Rational.parse);
  assertTableauShape(tableau);
  return tableau;
}

function nextExampleVariableName(
  kind: VariableKind,
  counters: { original: number; slack: number; artificial: number },
): string {
  if (kind === 'slack') return `s${++counters.slack}`;
  if (kind === 'artificial') return `z${++counters.artificial}`;
  return `x${++counters.original}`;
}

const regular = (count: number): VariableKind[] => Array.from({ length: count }, () => 'regular');
const slack = (count: number): VariableKind[] => Array.from({ length: count }, () => 'slack');

export const exampleProblems: ExampleProblem[] = [
  {
    id: 'small-no-phase-one',
    title: 'Small · No artificial variables',
    description: '2 constraints · 2 original variables · immediate slack basis',
    create: () => createExampleTableau({
      title: 'Small · No artificial variables',
      kinds: [...regular(2), ...slack(2)],
      basis: [2, 3],
      rows: [
        ['2', '1', '1', '0', '8'],
        ['1', '3', '0', '1', '9'],
      ],
      objective: ['-3', '-2', '0', '0', '0'],
    }),
  },
  {
    id: 'small-phase-one',
    title: 'Small · Phase I required',
    description: '2 constraints · one row has no basic identity column',
    create: () => createExampleTableau({
      title: 'Small · Phase I required',
      kinds: [...regular(2), ...slack(1)],
      basis: [null, 2],
      rows: [
        ['1', '1', '0', '4'],
        ['2', '1', '1', '6'],
      ],
      objective: ['-3', '-2', '0', '0'],
    }),
  },
  {
    id: 'large-no-phase-one',
    title: 'Larger · No artificial variables',
    description: '5 constraints · 4 original variables · immediate slack basis',
    create: () => createExampleTableau({
      title: 'Larger · No artificial variables',
      kinds: [...regular(4), ...slack(5)],
      basis: [4, 5, 6, 7, 8],
      rows: [
        ['1', '2', '0', '1', '1', '0', '0', '0', '0', '16'],
        ['2', '1', '1', '0', '0', '1', '0', '0', '0', '18'],
        ['0', '1', '2', '1', '0', '0', '1', '0', '0', '14'],
        ['1', '0', '1', '2', '0', '0', '0', '1', '0', '15'],
        ['3', '1', '0', '1', '0', '0', '0', '0', '1', '24'],
      ],
      objective: ['-5', '-4', '-3', '-2', '0', '0', '0', '0', '0', '0'],
    }),
  },
  {
    id: 'large-phase-one',
    title: 'Larger · Phase I required',
    description: '4 constraints · equality and surplus rows need artificial variables',
    create: () => createExampleTableau({
      title: 'Larger · Phase I required',
      kinds: [...regular(3), ...slack(3)],
      basis: [null, null, 4, 5],
      rows: [
        ['1', '2', '1', '0', '0', '0', '10'],
        ['2', '1', '0', '-1', '0', '0', '8'],
        ['1', '0', '2', '0', '1', '0', '12'],
        ['0', '3', '1', '0', '0', '1', '15'],
      ],
      objective: ['-4', '-3', '-2', '0', '0', '0', '0'],
    }),
  },
  {
    id: 'dantzig-cycling',
    title: 'Dantzig rule cycling',
    description: 'Beale’s six-pivot cycle · Bland’s rule prevents repetition',
    create: () => createExampleTableau({
      title: 'Dantzig rule cycling',
      kinds: [...regular(4), ...slack(3)],
      basis: [4, 5, 6],
      rows: [
        ['1/2', '-11/2', '-5/2', '9', '1', '0', '0', '0'],
        ['1/2', '-3/2', '-1/2', '1', '0', '1', '0', '0'],
        ['1', '0', '0', '0', '0', '0', '1', '1'],
      ],
      objective: ['-10', '57', '9', '24', '0', '0', '0', '0'],
    }),
  },
  {
    id: 'bland-longer',
    title: 'Bland’s rule has more pivots than Dantzig',
    description: 'Bland takes x₁ first and needs two pivots; Dantzig needs one',
    create: () => createExampleTableau({
      title: 'Bland’s rule has more pivots than Dantzig',
      kinds: [...regular(2), ...slack(1)],
      basis: [2],
      rows: [['1', '1', '1', '1']],
      objective: ['-1', '-2', '0', '0'],
    }),
  },
  {
    id: 'dual-easier',
    title: 'Dual is easier · 5 constraints, 2 originals',
    description: 'The dual has only 2 constraints instead of the primal’s 5',
    create: () => createExampleTableau({
      title: 'Dual is easier · 5 constraints, 2 originals',
      kinds: [...regular(2), ...slack(5)],
      basis: [2, 3, 4, 5, 6],
      rows: [
        ['1', '1', '1', '0', '0', '0', '0', '6'],
        ['2', '1', '0', '1', '0', '0', '0', '10'],
        ['1', '3', '0', '0', '1', '0', '0', '12'],
        ['3', '2', '0', '0', '0', '1', '0', '18'],
        ['1', '0', '0', '0', '0', '0', '1', '4'],
      ],
      objective: ['-4', '-3', '0', '0', '0', '0', '0', '0'],
    }),
  },
  {
    id: 'dual-harder',
    title: 'Dual is harder · 2 constraints, 5 originals',
    description: 'The primal has only 2 constraints; its dual would have 5',
    create: () => createExampleTableau({
      title: 'Dual is harder · 2 constraints, 5 originals',
      kinds: [...regular(5), ...slack(2)],
      basis: [5, 6],
      rows: [
        ['1', '2', '0', '1', '3', '1', '0', '20'],
        ['2', '0', '1', '3', '1', '0', '1', '18'],
      ],
      objective: ['-5', '-4', '-3', '-2', '-1', '0', '0', '0'],
    }),
  },
  {
    id: 'degenerate-tie',
    title: 'Degeneracy · Tied minimum ratio',
    description: 'A tied leaving-variable choice creates a zero basic variable',
    create: () => createExampleTableau({
      title: 'Degeneracy · Tied minimum ratio',
      kinds: [...regular(2), ...slack(2)],
      basis: [2, 3],
      rows: [
        ['1', '1', '1', '0', '2'],
        ['2', '2', '0', '1', '4'],
      ],
      objective: ['-3', '-2', '0', '0', '0'],
    }),
  },
  {
    id: 'alternate-optima',
    title: 'Alternate optimal solutions',
    description: 'A nonbasic variable has zero reduced cost at an optimum',
    create: () => createExampleTableau({
      title: 'Alternate optimal solutions',
      kinds: [...regular(2), ...slack(1)],
      basis: [2],
      rows: [['1', '1', '1', '4']],
      objective: ['-1', '-1', '0', '0'],
    }),
  },
  {
    id: 'unbounded-small',
    title: 'Unbounded feasible region · Small',
    description: '1 constraint · the improving x₁ column has no eligible leaving row',
    create: () => createExampleTableau({
      title: 'Unbounded feasible region · Small',
      kinds: [...regular(2), ...slack(1)],
      basis: [2],
      rows: [['-1', '1', '1', '1']],
      objective: ['-1', '0', '0', '0'],
    }),
  },
  {
    id: 'unbounded-larger',
    title: 'Unbounded feasible region · Larger',
    description: '3 constraints · 4 original variables · no leaving row for x₁',
    create: () => createExampleTableau({
      title: 'Unbounded feasible region · Larger',
      kinds: [...regular(4), ...slack(3)],
      basis: [4, 5, 6],
      rows: [
        ['-1', '1', '0', '0', '1', '0', '0', '2'],
        ['-2', '0', '1', '1', '0', '1', '0', '6'],
        ['0', '1', '1', '1', '0', '0', '1', '9'],
      ],
      objective: ['-3', '-1', '-2', '0', '0', '0', '0', '0'],
    }),
  },
  {
    id: 'unfeasible-small',
    title: 'Unfeasible · Small',
    description: '2 constraints · x₁ ≤ 1 and x₁ ≥ 3 contradict each other',
    create: () => createExampleTableau({
      title: 'Unfeasible · Small',
      kinds: [...regular(1), ...slack(2)],
      basis: [1, null],
      rows: [
        ['1', '1', '0', '1'],
        ['1', '0', '-1', '3'],
      ],
      objective: ['1', '0', '0', '0'],
    }),
  },
  {
    id: 'unfeasible-larger',
    title: 'Unfeasible · Larger',
    description: '4 constraints · the first two require x₁ + x₂ ≤ 4 and ≥ 7',
    create: () => createExampleTableau({
      title: 'Unfeasible · Larger',
      kinds: [...regular(3), ...slack(4)],
      basis: [3, null, 5, 6],
      rows: [
        ['1', '1', '0', '1', '0', '0', '0', '4'],
        ['1', '1', '0', '0', '-1', '0', '0', '7'],
        ['0', '1', '1', '0', '0', '1', '0', '8'],
        ['1', '0', '2', '0', '0', '0', '1', '10'],
      ],
      objective: ['-3', '-2', '-1', '0', '0', '0', '0', '0'],
    }),
  },
  {
    id: 'unrestricted-split',
    title: 'Unrestricted variable · Split pair',
    description: 'y = y⁺ − y⁻ is shown with positive and negative split markers',
    create: () => createExampleTableau({
      title: 'Unrestricted variable · Split pair',
      kinds: ['split-positive', 'split-negative', 'regular', ...slack(2)],
      names: ['y+', 'y−', 'x1', 's1', 's2'],
      basis: [3, 4],
      rows: [
        ['1', '-1', '1', '1', '0', '5'],
        ['-1', '1', '2', '0', '1', '6'],
      ],
      objective: ['-2', '2', '-1', '0', '0', '0'],
    }),
  },
];

export function createExampleProblem(id: string): Tableau {
  const example = exampleProblems.find((candidate) => candidate.id === id);
  if (!example) throw new Error('The selected example is unavailable.');
  return example.create();
}
