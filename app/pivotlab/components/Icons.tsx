import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const PlusIcon = (props: IconProps) => <IconBase {...props}><path d="M12 5v14M5 12h14" /></IconBase>;
export const MinusIcon = (props: IconProps) => <IconBase {...props}><path d="M5 12h14" /></IconBase>;
export const UndoIcon = (props: IconProps) => <IconBase {...props}><path d="M9 7 4 12l5 5" /><path d="M4 12h9a7 7 0 0 1 7 7" /></IconBase>;
export const RedoIcon = (props: IconProps) => <IconBase {...props}><path d="m15 7 5 5-5 5" /><path d="M20 12h-9a7 7 0 0 0-7 7" /></IconBase>;
export const SettingsIcon = (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.38.36.72.66 1 .3.28.68.42 1.1.42H21v4h-.09a1.7 1.7 0 0 0-1.51.58Z" /></IconBase>;
export const FolderIcon = (props: IconProps) => <IconBase {...props}><path d="M3 6.5h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></IconBase>;
export const SaveIcon = (props: IconProps) => <IconBase {...props}><path d="M5 3h12l3 3v15H4V4a1 1 0 0 1 1-1Z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></IconBase>;
export const ExportIcon = (props: IconProps) => <IconBase {...props}><path d="M12 3v12m0-12-4 4m4-4 4 4" /><path d="M5 12v8h14v-8" /></IconBase>;
export const CopyIcon = (props: IconProps) => <IconBase {...props}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></IconBase>;
export const TrashIcon = (props: IconProps) => <IconBase {...props}><path d="M4 7h16M9 3h6l1 4H8l1-4Zm-3 4 1 14h10l1-14" /></IconBase>;
export const SparkIcon = (props: IconProps) => <IconBase {...props}><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" /><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" /></IconBase>;
export const HistoryIcon = (props: IconProps) => <IconBase {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></IconBase>;
export const GridIcon = (props: IconProps) => <IconBase {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /><circle cx="15" cy="15" r="2" fill="currentColor" stroke="none" /></IconBase>;
export const ChevronIcon = (props: IconProps) => <IconBase {...props}><path d="m8 10 4 4 4-4" /></IconBase>;
export const CheckIcon = (props: IconProps) => <IconBase {...props}><path d="m5 12 4 4L19 6" /></IconBase>;
export const XIcon = (props: IconProps) => <IconBase {...props}><path d="m6 6 12 12M18 6 6 18" /></IconBase>;
export const InfoIcon = (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></IconBase>;
export const KeyboardIcon = (props: IconProps) => <IconBase {...props}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h4M7 16h10" /></IconBase>;
