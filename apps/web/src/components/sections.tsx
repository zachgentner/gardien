/**
 * Core feature areas of the app shell — nav metadata only. The render mapping
 * lives in the app shell (App.tsx) and the nav chrome in Sidebar.tsx, so this
 * stays a plain data/icon module (no exported components).
 */
export type ViewId = 'home' | 'garden' | 'planner' | 'directory' | 'journal' | 'settings';

export interface SectionMeta {
  id: ViewId;
  label: string;
  eyebrow: string;
  icon: () => React.ReactNode;
}

export const SECTIONS: SectionMeta[] = [
  { id: 'home', label: 'Home', eyebrow: 'Today at a glance', icon: iconHome },
  { id: 'garden', label: 'Garden Manager', eyebrow: 'Beds & growing spaces', icon: iconBeds },
  { id: 'planner', label: 'Garden Planner', eyebrow: 'Plan the season', icon: iconPlanner },
  { id: 'directory', label: 'Plant Directory', eyebrow: 'Knowledge base', icon: iconLeaf },
  { id: 'journal', label: 'Journal', eyebrow: 'Activity & care log', icon: iconLog },
  { id: 'settings', label: 'Settings', eyebrow: 'Account & location', icon: iconGear },
];

/* --- Line icons (botanical/field-guide weight) ---------------------------- */
function iconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10.5V20h13v-9.5" strokeLinejoin="round" />
      <path d="M10 20v-5h4v5" strokeLinejoin="round" />
    </svg>
  );
}
function iconBeds() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 10h18M3 15h18M9 4v16M15 4v16" strokeWidth="1.2" />
    </svg>
  );
}
function iconPlanner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="16" rx="1.5" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
      <path d="M7.5 13.5l2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function iconLeaf() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 19c0-8 5.5-13 14-13 0 8.5-5 14-14 13Z" strokeLinejoin="round" />
      <path d="M9 15c2-2.5 4.5-4 7.5-5" strokeLinecap="round" />
    </svg>
  );
}
function iconLog() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 3h9l4 4v14H6z" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h6M9 9h2" strokeLinecap="round" />
    </svg>
  );
}
function iconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
