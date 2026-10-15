# Meigen Sports

Open sports quotations and calendar facts, published as static data and a zero-dependency typed library.

- Follow CONTRIBUTING.md and the existing family workflow. Commit as John Morris <john@johnmorris.ca>, no AI attribution, explicit file staging.
- Work in a worktree. Ports 7400–7499 only; check a port before using it.
- Core functions are pure: dates and selection seeds are explicit arguments. No clock, random number, I/O or runtime dependency in core.
- Source data licences are separate from the MIT code licence. Preserve provenance and notices; unknown rights or ambiguous dates stay out of public exports. Never invent quotations or attribution.
- DS1 is the permanent archive; Turso is curation/export; public readers use GitHub static files. No Supabase writes or per-reader database calls. Raw bytes are archived and backed up before loading curated data.
- New code and tools use erasable TypeScript, Node 22.18+, pnpm. Shared template files are copied unchanged; family-list changes require one canonical update and an approved family sweep.
- Required gates: pnpm check, pnpm test:readme, pnpm test:demo. First npm publication and trusted publisher setup are John's.
