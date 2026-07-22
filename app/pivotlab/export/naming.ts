export interface ExportNameOptions {
  completeSolution: boolean;
  includeResult: boolean;
}

export function safeFileName(value: string): string {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'tableau';
}

export function exportFileStem(title: string, options: ExportNameOptions): string {
  // Spell out both independent export choices so files remain identifiable
  // after they have left the application and are viewed side by side.
  const scope = options.completeSolution ? 'solution' : 'initial';
  const result = options.includeResult ? 'with-result' : 'without-result';
  return `${safeFileName(title)}-${scope}-${result}`;
}
