import { deserializeProject, serializeProject } from './project';
import type { HistoryEntry } from './tableau';
import { makeId } from './tableau';

export const PROBLEM_HISTORY_KEY = 'simplex-assistant-problem-history';
export const MAX_SAVED_PROBLEMS = 40;

export interface ProblemHistoryRecord {
  id: string;
  title: string;
  savedAt: string;
  stepCount: number;
  constraintCount: number;
  variableCount: number;
  project: string;
}

interface HistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createProblemHistoryRecord(
  history: HistoryEntry[],
  currentIndex: number,
  savedAt = new Date(),
): ProblemHistoryRecord {
  const current = history[Math.max(0, Math.min(currentIndex, history.length - 1))]?.tableau;
  if (!current || !history[0]) throw new Error('The current problem cannot be archived.');
  return {
    id: makeId('problem'),
    title: current.title.trim() || 'Untitled tableau',
    savedAt: savedAt.toISOString(),
    stepCount: currentIndex + 1,
    constraintCount: history[0].tableau.rows.length,
    variableCount: history[0].tableau.variables.length,
    project: serializeProject(history, currentIndex),
  };
}

export function loadProblemHistory(storage: Pick<HistoryStorage, 'getItem'> = localStorage): ProblemHistoryRecord[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(PROBLEM_HISTORY_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(isProblemHistoryRecord).slice(0, MAX_SAVED_PROBLEMS);
  } catch {
    return [];
  }
}

export function saveProblemHistory(
  records: ProblemHistoryRecord[],
  storage: Pick<HistoryStorage, 'setItem'> = localStorage,
): void {
  storage.setItem(PROBLEM_HISTORY_KEY, JSON.stringify(records.slice(0, MAX_SAVED_PROBLEMS)));
}

export function openProblemHistoryRecord(record: ProblemHistoryRecord) {
  return deserializeProject(record.project);
}

function isProblemHistoryRecord(value: unknown): value is ProblemHistoryRecord {
  if (!isObject(value)
    || typeof value.id !== 'string'
    || typeof value.title !== 'string'
    || typeof value.savedAt !== 'string'
    || typeof value.stepCount !== 'number'
    || typeof value.constraintCount !== 'number'
    || typeof value.variableCount !== 'number'
    || typeof value.project !== 'string') return false;
  try {
    deserializeProject(value.project);
    return !Number.isNaN(Date.parse(value.savedAt));
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
