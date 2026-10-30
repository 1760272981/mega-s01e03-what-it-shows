import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { auditReports } from '../src/lib/kb/audit.ts';
import { causeOf, sameCause } from '../src/lib/kb/causes.ts';
import { deskRef } from '../src/lib/kb/desk-ref.ts';
import { DEDUPE_CASES } from '../src/lib/kb/dedupe-cases.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const json = name => JSON.parse(read(name));
const tenantFiles = fs.readdirSync(path.join(root, 'src/lib/data/tenants')).filter(f => f.endsWith('.json')).sort();
const tenants = tenantFiles.map(f => json(`src/lib/data/tenants/${f}`));
const byTenant = new Map(tenants.map(t => [t.handle, t]));
const raw = json('src/lib/data/reports-4471.json');
const notes = json('src/lib/data/desk-notes.json');
const audit = auditReports(raw, tenants, notes.oneDayMove);
assert.equal(audit.conflictingDuplicateIds.length, 0, 'Conflicting duplicate IDs require review before publishing');
assert.equal(audit.groups.reduce((n, g) => n + g.reports.length, 0), audit.reports.length);
assert.equal(new Set(audit.groups.flatMap(g => g.reports.map(r => r.id))).size, audit.reports.length);
assert(!audit.groups.some(g => g.cause === 'unplaced'), 'Unclassified reports require review');
assert(notes.oneDayMove.every(id => audit.reports.some(r => r.id === id)), 'Desk notes must refer to retained reports');

// Independent reconciliation against the export's stated date-order and form rules.
for (const r of audit.reports) {
  const t = byTenant.get(r.tenant);
  assert(t, `Missing tenant: ${r.tenant}`);
  const renderedDate = new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date('2026-04-07T12:00:00Z'));
  assert(renderedDate.startsWith('7'), `Review date-order assumption for ${t.locale}`);
  const expected = r.channel === 'form' && t.form === 'booking-v3' ? 'hint' : 'parser';
  assert.equal(causeOf(r, t), expected, `Classification disagreement for ${r.id}`);
}
const dedupeCases = DEDUPE_CASES.map(c => ({
  description: c.why,
  sameSubject: c.a.subject === c.b.subject,
  sameCause: sameCause(c.a, byTenant.get(c.a.tenant), c.b, byTenant.get(c.b.tenant))
}));
assert.deepEqual(dedupeCases.map(c => c.sameCause), [true, false, false, true, false]);

const sourcePath = 'src/routes/kb/incidents/4471-review/+page.svx';
const page = read(sourcePath);
const signature = page.match(/^signature: '([^']+)'$/m)?.[1];
assert(signature, 'The page must be signed');
assert(page.trimEnd().endsWith('<RenderStamp {signature} />'));
const sourceFiles = ['src/lib/data/reports-4471.json', 'src/lib/data/desk-notes.json',
  ...tenantFiles.map(f => `src/lib/data/tenants/${f}`), 'src/lib/kb/causes.ts', 'src/lib/kb/desk-ref.ts'];
const evidence = {
  generatedAt: new Date().toISOString(),
  inputHashes: Object.fromEntries(sourceFiles.map(f => [f, createHash('sha256').update(read(f)).digest('hex')])),
  rawRows: audit.rawRows,
  duplicateRows: audit.duplicateRows,
  uniqueReportsIn4471: audit.reports.length,
  conflictingDuplicateIds: audit.conflictingDuplicateIds,
  intakeDisagreements: audit.intakeDisagreements,
  groups: audit.groups.map(({ reports, ...g }) => ({ ...g, count: reports.length, ids: reports.map(r => r.id) })),
  annotatedReports: audit.annotated,
  months: audit.months,
  dedupeCases,
  signature,
  deskRef: deskRef(signature),
  pageSource: sourcePath,
  renderedPage: 'rendered/kb/incidents/4471-review/index.html'
};
fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
fs.mkdirSync(path.join(root, 'issue-drafts'), { recursive: true });
fs.writeFileSync(path.join(root, 'evidence/audit.json'), JSON.stringify(evidence, null, 2) + '\n');

const bodies = {
  parser: {
    title: 'Shared parser reads day-first tenant dates as month-first',
    problem: 'The shared parser reads every date month first. For day-first tenants this swaps the intended month and day. The supplied classification puts app/email reports and booking-v2 form reports in this group; booking-v3 form reports are classified separately as hint.',
    acceptance: ['Use an explicit date-format contract that matches the tenant and input channel.', 'Check an ambiguous day/month example and an unambiguous day greater than 12 through app, email, and booking-v2 form paths.', 'Assert the resulting calendar date, not just a formatted label.', 'Reproduce the annotated anomalous reports separately; do not assert that this fix explains them without evidence.']
  },
  hint: {
    title: 'booking-v3 date hint contradicts day-first tenant interpretation',
    problem: 'For day-first tenants, booking-v3 prints MM/DD/YYYY but reads form input in the tenant\'s day-first order. A person following the displayed instruction can get the wrong calendar date. This is separate from the shared parser bug: app/email reports for those same tenants remain in the parser group.',
    acceptance: ['Make the displayed date format agree with form parsing for each affected tenant.', 'Enter an ambiguous date exactly as the hint instructs and verify that the stored and displayed calendar dates match the intended date.', 'Include day greater than 12 and locale-specific formatting in the checks.', 'Verify the separate app/email parser path; do not treat this hint fix as a fix for that path.']
  }
};
const manifest = [];
for (const g of audit.groups) {
  const b = bodies[g.cause];
  assert(b, `No draft specification for ${g.cause}`);
  const annotated = g.reports.filter(r => notes.oneDayMove.includes(r.id));
  const examples = g.reports.filter(r => !notes.oneDayMove.includes(r.id)).slice(0, 3);
  const title = `${b.title} (${g.reports.length} reports)`;
  const text = `## Problem\n\n${b.problem}\n\n## Scope and counting\n\n**Reports covered: ${g.reports.length}.** These are unique report IDs merged into #4471, not export rows or intake-tag counts.\n\nAffected tenants: ${[...new Set(g.reports.map(r => r.tenant))].sort().join(', ')}.\nReported: ${g.firstSeen} through ${g.lastSeen}.\nIntake tags inside this group: ${Object.entries(g.taggedAs).map(([k,v]) => `${k}: ${v}`).join('; ')}.\n\nThe export has ${audit.rawRows} rows with ${audit.duplicateRows} repeated rows; ${audit.reports.length} distinct reports remain. Deduplicate by ID, filter mergedInto=4471, then classify using tenant locale, form version, and report channel via the supplied causes.ts. Browser locale and intake tags are not the cause rule.\n\n## Evidence examples\n\n${examples.map(r => `- ${r.id} — ${r.tenant}, ${r.channel}: ${r.body}`).join('\n')}\n\n## Evidence limits\n\nThis diagnosis follows the supplied knowledge-base logic and report data. The production application is not included, so these are proposed reproduction and acceptance checks, not a claim of a live reproduction or a shipped fix.\n\n${annotated.length ? `${annotated.length} annotated reports remain in this count: ${annotated.map(r => r.id).join(', ')}. The desk lists them as oneDayMove. Their wording includes one-day shifts, cross-city differences, and delivery ordering; the classifier does not prove those symptoms share the parser root cause. Preserve these IDs, reproduce with original input/stored date/timezone/delivery timestamps, and reassign only when evidence supports another cause. They are not counted a second time.\n` : 'No report in this group is in the desk\'s oneDayMove annotation list.\n'}\n## Proposed acceptance checks\n\n${b.acceptance.map(s => `- [ ] ${s}`).join('\n')}\n\n## Knowledge-base review and reproducibility\n\n- Source: src/routes/kb/incidents/4471-review/+page.svx\n- Rendered page: rendered/kb/incidents/4471-review/index.html\n- Exact report membership and input hashes: evidence/audit.json\n- Recompute: npm ci, then npm run build. Review changed data and counts before updating issues.\n\n## Covered report IDs\n\n${g.reports.map(r => r.id).join(', ')}\n`;
  const file = `issue-drafts/${g.cause}.md`;
  fs.writeFileSync(path.join(root, file), text);
  manifest.push({ cause: g.cause, title, bodyFile: file, count: g.reports.length });
}
fs.writeFileSync(path.join(root, 'issue-drafts/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ rows: audit.rawRows, duplicates: audit.duplicateRows, reports: audit.reports.length,
  groups: evidence.groups.map(g => ({ cause: g.cause, count: g.count })), annotations: audit.annotated.length,
  tagDisagreements: audit.intakeDisagreements, deskRef: evidence.deskRef, checks: 'passed' }, null, 2));
