import type { Service } from '@/lib/types';

/** Groups services by category for <optgroup> rendering — "Uncategorized" (if any) sorts last. */
export function groupServicesByCategory(services: Service[]): { categoryName: string; services: Service[] }[] {
  const grouped = new Map<string, Service[]>();
  for (const s of services) {
    const key = s.category_name || 'Other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  const names = [...grouped.keys()].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));
  return names.map((categoryName) => ({ categoryName, services: grouped.get(categoryName)! }));
}
