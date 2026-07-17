import type { NumberDisplay } from '../math/rational';
import { formatRational, Rational } from '../math/rational';
import type { HistoryEntry, PivotRecord, StoredObjective, Tableau, TableauRow, TableauVariable } from './tableau';
import { assertTableauShape, makeId } from './tableau';

export interface PivotLabProject {
  format: 'pivotlab-project';
  version: 1;
  currentIndex: number;
  history: HistoryEntryDto[];
}

interface HistoryEntryDto {
  id: string;
  label: string;
  tableau: TableauDto;
  pivot?: PivotRecord;
}

interface TableauDto {
  id: string;
  title: string;
  variables: TableauVariable[];
  rows: Array<Omit<TableauRow, 'values'> & { values: string[] }>;
  objectiveName: string;
  objective: string[];
  phase: Tableau['phase'];
  storedObjective?: Omit<StoredObjective, 'values'> & { values: string[] };
}

export function serializeProject(history: HistoryEntry[], currentIndex: number): string {
  const project: PivotLabProject = {
    format: 'pivotlab-project',
    version: 1,
    currentIndex,
    history: history.map((entry) => ({
      ...entry,
      tableau: tableauToDto(entry.tableau),
    })),
  };
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(source: string): { history: HistoryEntry[]; currentIndex: number } {
  const value: unknown = JSON.parse(source);
  if (!isObject(value) || value.format !== 'pivotlab-project' || value.version !== 1 || !Array.isArray(value.history)) {
    throw new Error('This is not a supported Simplex Assistant project file.');
  }
  if (value.history.length === 0) throw new Error('The project contains no tableaux.');
  const history = value.history.map((entry, index) => historyEntryFromUnknown(entry, index));
  const rawIndex = typeof value.currentIndex === 'number' ? value.currentIndex : history.length - 1;
  const currentIndex = Math.max(0, Math.min(history.length - 1, Math.trunc(rawIndex)));
  return { history, currentIndex };
}

function tableauToDto(tableau: Tableau): TableauDto {
  return {
    ...tableau,
    variables: tableau.variables.map((variable) => ({ ...variable })),
    rows: tableau.rows.map((row) => ({ ...row, values: row.values.map(String) })),
    objective: tableau.objective.map(String),
    storedObjective: tableau.storedObjective
      ? { ...tableau.storedObjective, values: tableau.storedObjective.values.map(String) }
      : undefined,
  };
}

function historyEntryFromUnknown(value: unknown, index: number): HistoryEntry {
  if (!isObject(value) || !isObject(value.tableau)) throw new Error(`History step ${index + 1} is malformed.`);
  const tableau = tableauFromUnknown(value.tableau);
  return {
    id: typeof value.id === 'string' ? value.id : makeId('history'),
    label: typeof value.label === 'string' ? value.label : `Step ${index}`,
    tableau,
    pivot: isPivotRecord(value.pivot) ? value.pivot : undefined,
  };
}

function tableauFromUnknown(value: Record<string, unknown>): Tableau {
  if (!Array.isArray(value.variables) || !Array.isArray(value.rows) || !Array.isArray(value.objective)) {
    throw new Error('The tableau data is incomplete.');
  }
  const variables = value.variables.map((candidate, index): TableauVariable => {
    if (!isObject(candidate) || typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
      throw new Error(`Variable ${index + 1} is malformed.`);
    }
    const kind = candidate.kind;
    if (kind !== 'regular' && kind !== 'slack' && kind !== 'artificial') {
      throw new Error(`Variable ${index + 1} has an unknown kind.`);
    }
    return { id: candidate.id, name: candidate.name, kind };
  });
  const rows = value.rows.map((candidate, index): TableauRow => {
    if (!isObject(candidate) || !Array.isArray(candidate.values)) throw new Error(`Row ${index + 1} is malformed.`);
    return {
      id: typeof candidate.id === 'string' ? candidate.id : makeId('row'),
      basisId: typeof candidate.basisId === 'string' ? candidate.basisId : null,
      values: candidate.values.map(parseStoredNumber),
    };
  });
  const phase = value.phase === 'phase1' ? 'phase1' : 'original';
  const storedObjective = isObject(value.storedObjective) && Array.isArray(value.storedObjective.values)
    && Array.isArray(value.storedObjective.variableIds)
    ? {
        name: typeof value.storedObjective.name === 'string' ? value.storedObjective.name : 'f',
        variableIds: value.storedObjective.variableIds.map(String),
        values: value.storedObjective.values.map(parseStoredNumber),
      }
    : undefined;
  const tableau: Tableau = {
    id: typeof value.id === 'string' ? value.id : makeId('tableau'),
    title: typeof value.title === 'string' ? value.title : 'Imported tableau',
    variables,
    rows,
    objectiveName: typeof value.objectiveName === 'string' ? value.objectiveName : 'f',
    objective: value.objective.map(parseStoredNumber),
    phase,
    storedObjective,
  };
  assertTableauShape(tableau);
  return tableau;
}

function parseStoredNumber(value: unknown): Rational {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('A tableau entry is not numeric.');
  return Rational.parse(String(value));
}

function isPivotRecord(value: unknown): value is PivotRecord {
  return isObject(value)
    && typeof value.rowId === 'string'
    && typeof value.variableId === 'string'
    && typeof value.enteringName === 'string'
    && typeof value.leavingName === 'string'
    && typeof value.pivotValue === 'string';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function exportMarkdown(tableau: Tableau, display: NumberDisplay): string {
  const headers = ['Basis', ...tableau.variables.map((variable) => variable.name), 'RHS'];
  const separator = headers.map(() => '---');
  const rows = tableau.rows.map((row) => [
    tableau.variables.find((variable) => variable.id === row.basisId)?.name ?? '—',
    ...row.values.map((value) => formatRational(value, display)),
  ]);
  rows.push([tableau.objectiveName, ...tableau.objective.map((value) => formatRational(value, display))]);
  return [
    `### ${tableau.title}`,
    '',
    `| ${headers.map(escapeMarkdown).join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeMarkdown).join(' | ')} |`),
  ].join('\n');
}

export function exportCsv(tableau: Tableau, display: NumberDisplay): string {
  const rows: string[][] = [
    ['Basis', ...tableau.variables.map((variable) => variable.name), 'RHS'],
    ...tableau.rows.map((row) => [
      tableau.variables.find((variable) => variable.id === row.basisId)?.name ?? '',
      ...row.values.map((value) => formatRational(value, display)),
    ]),
    [tableau.objectiveName, ...tableau.objective.map((value) => formatRational(value, display))],
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function exportLatex(tableau: Tableau): string {
  const columns = `c|${'c'.repeat(tableau.variables.length)}|c`;
  const header = ['\\text{Basis}', ...tableau.variables.map((variable) => latexText(variable.name)), '\\text{RHS}'];
  const rows = tableau.rows.map((row) => [
    latexText(tableau.variables.find((variable) => variable.id === row.basisId)?.name ?? '—'),
    ...row.values.map(latexRational),
  ]);
  rows.push([latexText(tableau.objectiveName), ...tableau.objective.map(latexRational)]);
  return [
    `\\begin{array}{${columns}}`,
    `  ${header.join(' & ')} \\\\`,
    '  \\hline',
    ...rows.map((row, index) => `  ${row.join(' & ')} \\\\${index === rows.length - 2 ? ' \\hline' : ''}`),
    '\\end{array}',
  ].join('\n');
}

function latexRational(value: Rational): string {
  if (value.denominator === 1n) return value.numerator.toString();
  const sign = value.numerator < 0n ? '-' : '';
  const numerator = value.numerator < 0n ? -value.numerator : value.numerator;
  return `${sign}\\frac{${numerator}}{${value.denominator}}`;
}

function latexText(value: string): string {
  const escaped = value
    .replaceAll('\\', '\\backslash ')
    .replaceAll('&', '\\&')
    .replaceAll('%', '\\%')
    .replaceAll('$', '\\$')
    .replaceAll('#', '\\#')
    .replaceAll('_', '\\_')
    .replaceAll('{', '\\{')
    .replaceAll('}', '\\}');
  return `\\text{${escaped}}`;
}

function escapeMarkdown(value: string): string {
  return value.replaceAll('|', '\\|');
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
