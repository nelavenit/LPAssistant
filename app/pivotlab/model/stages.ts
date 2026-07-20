import type { HistoryEntry } from './tableau';

export type TableauStageId = 'simplex' | 'initial' | 'phase1' | 'phase2';

export interface TableauStageEntry {
  entry: HistoryEntry;
  index: number;
}

export interface TableauStage {
  id: TableauStageId;
  label: string | null;
  entries: TableauStageEntry[];
}

export function groupTableauStages(history: HistoryEntry[], currentIndex: number): TableauStage[] {
  const entries = history
    .slice(0, Math.max(0, currentIndex) + 1)
    .map((entry, index) => ({ entry, index }));
  if (entries.length === 0) return [];

  const phaseOneStart = entries.findIndex(({ entry }) => entry.tableau.phase === 'phase1');
  if (phaseOneStart < 0) return [{ id: 'simplex', label: null, entries }];

  const phaseTwoOffset = entries
    .slice(phaseOneStart)
    .findIndex(({ entry }) => entry.tableau.phase !== 'phase1');
  const phaseTwoStart = phaseTwoOffset < 0 ? entries.length : phaseOneStart + phaseTwoOffset;

  // Stage boundaries are also layout boundaries: variable counts may change
  // only between these groups, never within a visually continuous tableau.
  return [
    { id: 'initial' as const, label: 'Initial problem', entries: entries.slice(0, phaseOneStart) },
    { id: 'phase1' as const, label: 'Phase I', entries: entries.slice(phaseOneStart, phaseTwoStart) },
    { id: 'phase2' as const, label: 'Phase II', entries: entries.slice(phaseTwoStart) },
  ].filter((stage) => stage.entries.length > 0);
}
