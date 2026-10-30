import { groupByCause, uniqueById, type Report, type Tenant } from './causes.ts';

export function auditReports(raw: Report[], tenants: Tenant[], noteIds: string[], ticket = 4471) {
  const byTenant = new Map(tenants.map(t => [t.handle, t]));
  const unique = uniqueById(raw);
  const reports = unique.filter(r => r.mergedInto === ticket);
  const groups = groupByCause(reports, r => byTenant.get(r.tenant));
  const annotated = reports.filter(r => noteIds.includes(r.id));
  const first = new Map<string, string>();
  const conflicts = new Set<string>();
  for (const r of raw) {
    const body = JSON.stringify(r);
    if (first.has(r.id) && first.get(r.id) !== body) conflicts.add(r.id);
    first.set(r.id, body);
  }
  const receivedMonths: Record<string, number> = {};
  const mergedMonths: Record<string, number> = {};
  for (const r of reports) {
    const received = r.receivedAt.slice(0, 7);
    receivedMonths[received] = (receivedMonths[received] ?? 0) + 1;
    if (r.mergedAt) {
      const merged = r.mergedAt.slice(0, 7);
      mergedMonths[merged] = (mergedMonths[merged] ?? 0) + 1;
    }
  }
  return {
    rawRows: raw.length,
    duplicateRows: raw.length - unique.length,
    conflictingDuplicateIds: [...conflicts],
    reports,
    groups,
    annotated,
    intakeDisagreements: groups.reduce((sum, g) => sum + g.reports.filter(r => r.meta.intakeTag !== g.cause).length, 0),
    months: [...new Set([...Object.keys(receivedMonths), ...Object.keys(mergedMonths)])].sort()
      .map(month => ({ month, received: receivedMonths[month] ?? 0, merged: mergedMonths[month] ?? 0 }))
  };
}
