import {
  BarChart3,
  Bot,
  FolderTree,
  LayoutDashboard,
  Library,
  Lightbulb,
  Megaphone,
  ArrowDownUp,
  BookOpenText,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { to: string; key: string; icon: LucideIcon };
export type NavGroup = { key: string | null; items: NavItem[] };

/** Sidebar structure. `key` is the i18n key under `nav.` */
export const NAV: NavGroup[] = [
  { key: null, items: [{ to: '/dashboard', key: 'dashboard', icon: LayoutDashboard }] },
  {
    key: 'content',
    items: [
      { to: '/lessons', key: 'lessons', icon: BookOpenText },
      { to: '/structure', key: 'structure', icon: FolderTree },
      { to: '/library', key: 'library', icon: Library },
      { to: '/import-export', key: 'importExport', icon: ArrowDownUp },
    ],
  },
  {
    key: 'ai',
    items: [
      { to: '/ideas', key: 'ideas', icon: Lightbulb },
      { to: '/agents', key: 'agents', icon: Bot },
    ],
  },
  {
    key: 'insights',
    items: [
      { to: '/stats', key: 'stats', icon: BarChart3 },
      { to: '/marketing', key: 'marketing', icon: Megaphone },
    ],
  },
  { key: 'admin', items: [{ to: '/team', key: 'team', icon: Users }] },
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);
