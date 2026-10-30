# kb — the support knowledge base

**kb** = knowledge base. What the support desk knows about how our products break, written
down where the code can keep it honest.

One desk takes reports for every product we run: `sched-prod` (calendar invites for about
300k people) and the rest. When something
goes wrong, the reports reach the desk first. This kb is how the desk triages them, what each
incident turned out to be, and why we decided what we decided.

## What's here

```
src/routes/kb/      the pages (.svx: Markdown with components)
  triage/           how the desk handles incoming reports
  incidents/        one page per big ticket
  decisions/        numbered decision records
src/lib/kb/         components and the logic they run
src/lib/layouts/    the frame every page shares
src/lib/data/       exports from the ticket system
```

## Conventions

- Words in the page, logic in `src/lib` (imported as `#lib/…`). A number that can be computed belongs in a component.
- Every page starts with frontmatter: `title`, `owner`, `status`, `reviewed`.
- A decision is never edited after it is accepted. A new record replaces it.
- A page you add is signed: its frontmatter carries your `signature` and it ends with `<RenderStamp {signature} />`, so the desk knows who wrote it.

## Owners

Support desk. Decision records: whoever signed them.

---

Exported 2026-10-04 from the `support` repo, `apps/kb/` → `src/`.

## S01E03 reassessment

Start with `src/routes/kb/incidents/4471-review/+page.svx`.
It distinguishes the shared parser from the booking-v3 hint, retains the desk's anomalous
report annotations, and compares received dates with merge dates. Original accepted decision
0001 and the supplied classification logic remain unchanged.

### Reproduce the page and issue counts

Use Node.js 22.17 or newer:

```sh
npm ci
npm run build
npm run preview -- --port 4173
```

Then open `http://127.0.0.1:4173/kb/incidents/4471-review/`.
`rendered/` contains the actual prerendered site, including HTML, styles, and browser code.
It is a snapshot of the included data at build time; it is not a hosted live desk.
Serve the directory as a static site to browse it. Opening HTML directly with a `file:` URL
may prevent asset and navigation loading.

The build runs `scripts/audit.mjs`, which checks ID uniqueness, reconciles classifications,
checks the supplied deduplication examples, and generates:

- `evidence/audit.json`: counts, exact report membership, annotations, input hashes, and the derived desk reference.
- `issue-drafts/parser.md` and `issue-drafts/hint.md`: issue bodies, including snapshot counts and proposed acceptance checks.
- `issue-drafts/manifest.json`: the corresponding issue titles and body-file locations.

Update the report and tenant inputs, then rebuild when the desk supplies new evidence.
Review changes before publishing updated GitHub issue counts. This project does not modify
the desk's original ticket system or claim either production bug has been fixed.

The local build uses [SvelteKit static generation](https://svelte.dev/docs/kit/adapter-static)
and mdsvex to execute the supplied `.svx` pages and Svelte components.
