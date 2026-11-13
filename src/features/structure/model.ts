import type { Domain, Lesson, Track } from '@/lib/types';
import { slugify } from '@/lib/slug';

export type LessonCount = { total: number; published: number };

export type ModuleNode = { track: Track; count: LessonCount };
export type DomainNode = { domain: Domain; modules: ModuleNode[]; count: LessonCount };

export type StructureTree = {
  domains: DomainNode[];
  /** Modules with no domain, or whose domain no longer exists. */
  looseModules: ModuleNode[];
  /** Lessons with no module, or whose module no longer exists. */
  looseLessons: number;
  totals: { domains: number; modules: number; lessons: number; published: number };
};

const byOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

/** Group the flat corpus into Domain → Module, with lesson counts. */
export function buildTree(domains: Domain[], tracks: Track[], lessons: Lesson[]): StructureTree {
  const counts = new Map<string, LessonCount>();
  const trackIds = new Set(tracks.map((t) => t.id));
  let looseLessons = 0;
  let published = 0;
  for (const l of lessons) {
    if (l.status === 'published') published++;
    if (!l.trackId || !trackIds.has(l.trackId)) {
      looseLessons++;
      continue;
    }
    const c = counts.get(l.trackId) ?? { total: 0, published: 0 };
    c.total++;
    if (l.status === 'published') c.published++;
    counts.set(l.trackId, c);
  }

  const node = (t: Track): ModuleNode => ({
    track: t,
    count: counts.get(t.id) ?? { total: 0, published: 0 },
  });
  const domainIds = new Set(domains.map((d) => d.id));
  const sortedTracks = [...tracks].sort(byOrder);

  const domainNodes = [...domains].sort(byOrder).map((d) => {
    const modules = sortedTracks.filter((t) => t.domainId === d.id).map(node);
    return {
      domain: d,
      modules,
      count: modules.reduce(
        (acc, m) => ({
          total: acc.total + m.count.total,
          published: acc.published + m.count.published,
        }),
        { total: 0, published: 0 }
      ),
    };
  });

  return {
    domains: domainNodes,
    looseModules: sortedTracks.filter((t) => !t.domainId || !domainIds.has(t.domainId)).map(node),
    looseLessons,
    totals: { domains: domains.length, modules: tracks.length, lessons: lessons.length, published },
  };
}

/**
 * New sort orders after moving item `index` one step up (-1) or down (+1)
 * inside an ordered group. Returns only the items whose order changes.
 * Equal or unordered values (old imports) are renumbered first.
 */
export function reorder<T extends { id: string; sortOrder: number }>(
  group: T[],
  index: number,
  dir: -1 | 1
): { id: string; sortOrder: number }[] {
  const target = index + dir;
  if (index < 0 || index >= group.length || target < 0 || target >= group.length) return [];
  const values = group.map((g) => g.sortOrder);
  const increasing = values.every((v, i) => i === 0 || v > values[i - 1]);
  const slots = increasing ? values : values.map((_, i) => (values[0] ?? 0) + i);
  const order = group.map((g) => g.id);
  [order[index], order[target]] = [order[target], order[index]];
  const current = new Map(group.map((g) => [g.id, g.sortOrder]));
  return order
    .map((id, i) => ({ id, sortOrder: slots[i] }))
    .filter((x) => current.get(x.id) !== x.sortOrder);
}

/** Sort order that puts a new item at the end of a group. */
export function nextOrder(group: { sortOrder: number }[]): number {
  return group.length ? Math.max(...group.map((g) => g.sortOrder)) + 1 : 0;
}

/** Stable, url-safe id for a new domain or module, never colliding. */
export function newId(name: string, taken: Set<string>, prefix = ''): string {
  const base = `${prefix}${slugify(name) || 'item'}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Short, sober marker for a domain (its syllabus letter: A, B, C…).
 * Falls back to "Domain X - …" names from the import, then to the initial.
 */
export function domainMark(d: Pick<Domain, 'code' | 'name'>): string {
  if (d.code?.trim()) return d.code.trim().slice(0, 3).toUpperCase();
  const m = d.name.match(/^(?:domain|domaine)\s+([a-z0-9]{1,3})\b/i);
  if (m) return m[1].toUpperCase();
  const first = d.name
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[a-z0-9]/i);
  return first ? first[0].toUpperCase() : '?';
}

/** Case- and accent-insensitive match for the module filter. */
export function matches(q: string, ...fields: (string | undefined | null)[]): boolean {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const needle = norm(q.trim());
  if (!needle) return true;
  return fields.some((f) => f && norm(f).includes(needle));
}
