<script lang="ts">
  import raw from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import { auditReports } from '#lib/kb/audit';
  import { causeOf, type Report, type Tenant } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  const tenants = Object.values(import.meta.glob<Tenant>('/src/lib/data/tenants/*.json', { eager: true, import: 'default' }));
  let { section }: { section: 'counts' | 'timeline' | 'exceptions' } = $props();
  const result = auditReports(raw as Report[], tenants, notes.oneDayMove);
</script>

{#if section === 'counts'}
  <p><strong>{result.rawRows}</strong> exported rows contain <strong>{result.duplicateRows}</strong> repeated rows.
    After deduplication by report ID and filtering to <code>mergedInto === 4471</code>,
    <strong>{result.reports.length}</strong> reports remain in <strong>{result.groups.length}</strong> groups.</p>
  <p><strong>{result.intakeDisagreements}</strong> intake tags disagree with the tenant-based classification.
    Intake tags and the reporter's browser locale are not the grouping rule.</p>
  <p>Conflicting repeated IDs: <strong>{result.conflictingDuplicateIds.length}</strong>.</p>
{:else if section === 'timeline'}
  <table>
    <caption>Receipt time and merge time answer different questions</caption>
    <thead><tr><th>month</th><th>received</th><th>merged into #4471</th></tr></thead>
    <tbody>{#each result.months as row (row.month)}<tr><td>{row.month}</td><td>{row.received}</td><td>{row.merged}</td></tr>{/each}</tbody>
  </table>
{:else}
  <p><strong>{result.annotated.length}</strong> reports are listed in <code>desk-notes.json</code> as <code>oneDayMove</code>.
    They stay in their tenant-based group and are not counted again as a confirmed third cause.</p>
  {#each result.annotated as r (r.id)}
    <article>
      <h3>{r.id} · {r.tenant} · {r.channel}</h3>
      <p>Received {r.receivedAt.slice(0, 10)}; classified as <code>{causeOf(r, tenantOf(r))}</code>.</p>
      <blockquote>{r.body}</blockquote>
    </article>
  {/each}
{/if}

<style>
  caption { text-align: left; font-weight: 600; }
  blockquote { margin: .5rem 0; padding-left: 1rem; border-left: 3px solid var(--line); }
  article { border-bottom: 1px solid var(--line); padding: .5rem 0; }
  h3 { font-size: 1rem; }
</style>
