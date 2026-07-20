export type Theme = 'light' | 'dark' | 'system';

export type ShortcutAction =
  | 'toggleMode'
  | 'applyPivot'
  | 'undo'
  | 'redo'
  | 'newProject'
  | 'openProject'
  | 'saveProject'
  | 'addConstraint'
  | 'addVariable'
  | 'increaseFont'
  | 'decreaseFont'
  | 'openSettings'
  | 'toggleExport';

export interface AppSettings {
  theme: Theme;
  tableFontSize: number;
  uiScale: number;
  showPivotHints: boolean;
  shortcuts: Record<ShortcutAction, string>;
}

export const shortcutLabels: Record<ShortcutAction, string> = {
  toggleMode: 'Toggle Edit / Pivot mode',
  applyPivot: 'Apply hovered pivot',
  undo: 'Previous tableau',
  redo: 'Next tableau',
  newProject: 'New tableau',
  openProject: 'Open project',
  saveProject: 'Save project',
  addConstraint: 'Add constraint',
  addVariable: 'Add variable',
  increaseFont: 'Increase table font',
  decreaseFont: 'Decrease table font',
  openSettings: 'Open / close settings',
  toggleExport: 'Open / close export',
};

export const defaultSettings: AppSettings = {
  theme: 'system',
  tableFontSize: 18,
  uiScale: 100,
  showPivotHints: false,
  shortcuts: {
    toggleMode: 'Ctrl+E',
    applyPivot: 'Ctrl+Enter',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    newProject: 'Ctrl+Alt+N',
    openProject: 'Ctrl+O',
    saveProject: 'Ctrl+S',
    addConstraint: 'Ctrl+Alt+C',
    addVariable: 'Ctrl+Alt+V',
    increaseFont: 'Ctrl+=',
    decreaseFont: 'Ctrl+-',
    openSettings: 'Ctrl+,',
    toggleExport: 'Ctrl+Shift+E',
  },
};

export function loadSettings(): AppSettings {
  try {
    const stored = JSON.parse(localStorage.getItem('pivotlab-settings') ?? '{}') as Partial<AppSettings>;
    const storedShortcuts = { ...(stored.shortcuts ?? {}) };
    // Migrate the original Alt-only bindings, which browsers and desktop menus
    // commonly intercept before a web app can act on them.
    if (storedShortcuts.addConstraint === 'Alt+R') storedShortcuts.addConstraint = defaultSettings.shortcuts.addConstraint;
    if (storedShortcuts.newProject === 'Ctrl+N') storedShortcuts.newProject = defaultSettings.shortcuts.newProject;
    if (storedShortcuts.redo === 'Ctrl+Shift+Z') storedShortcuts.redo = defaultSettings.shortcuts.redo;
    if (storedShortcuts.addConstraint === 'Ctrl+Alt+R') storedShortcuts.addConstraint = defaultSettings.shortcuts.addConstraint;
    if (storedShortcuts.addVariable === 'Alt+C' || storedShortcuts.addVariable === 'Ctrl+Alt+B') {
      storedShortcuts.addVariable = defaultSettings.shortcuts.addVariable;
    }
    return {
      ...defaultSettings,
      ...stored,
      tableFontSize: clamp(Number(stored.tableFontSize ?? defaultSettings.tableFontSize), 12, 30),
      uiScale: clamp(Number(stored.uiScale ?? defaultSettings.uiScale), 75, 150),
      showPivotHints: stored.showPivotHints === true,
      shortcuts: { ...defaultSettings.shortcuts, ...storedShortcuts },
    };
  } catch {
    return defaultSettings;
  }
}

export function shortcutFromEvent(event: KeyboardEvent | React.KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  let key = keyFromCode(event.code) ?? event.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1 && /[a-z]/i.test(key)) key = key.toUpperCase();
  parts.push(key);
  return parts.join('+');
}

function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  const keys: Record<string, string> = {
    Space: 'Space',
    Equal: '=',
    Minus: '-',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Backquote: '`',
  };
  return keys[code] ?? null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
