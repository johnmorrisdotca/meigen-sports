# Contributing

Bug reports, ideas and pull requests are welcome. Please describe the source evidence for a data change and the checks you ran.
Report bugs and ideas in the [issue tracker](https://github.com/johnmorrisdotca/meigen-sports/issues).

## The rules

- **No runtime dependencies.** Keep the published library small and usable offline.
- **The core is pure.** Dates and context are explicit arguments. Selectors do not read the clock, use randomness, mutate input records or perform I/O.
- **Preserve provenance and rights.** Every exported row needs source evidence, stable identity where applicable, exact date support and its original rights. The MIT code licence does not relicense data. Keep full source notices in `LICENSES/` and source-specific terms in `NOTICE.md`.
- **Do not invent facts.** Names are not identity keys. Unknown dates stay unknown; season aggregates do not prove the exact game or scorer. Do not add player milestones or official/world-record claims without appropriate source evidence and scope.
- **Keep source and type selection independent.** A source may be frozen or discontinued while its historical data remains useful. Rights and publication review are separate from source lifecycle.
- **Test what you change.** Tests live in `test/`; README and docs examples are run by `pnpm test:readme` after the build.
- **Keep documentation truthful.** Mark planned schema and workflow separately from current exports. Keep each page in one language; add a Japanese page as `<name>.ja.md` when translating, with links between language versions and an English back-translation for review.
- **Static readers only.** Public consumers use versioned static JSON. Do not add per-reader database calls, Supabase writes or credentials to package code.
- **Manual storage workflow.** Preserve and back up original bytes before curation. Dry-run the DS1/Turso pipeline and require named review decisions before any export. Do not represent local fixture checks as live storage verification.
- **Use Node 22.18 or later and pnpm 10.**
- **Ports.** The demo uses port 7400 by default; the browser tests use 7401. Keep development servers within ports 7400–7499 and check availability first.

## Pull requests

Keep a change focused. Explain the behavior or data changed, cite source evidence where relevant, and say how you checked it. Add a user-visible or repository change under **Unreleased** in `CHANGELOG.md`.

## Commands

```sh
pnpm install
pnpm check          # lint, types, tests, build and packed-package check
pnpm test:package   # install the packed package in a clean project and import its entries
pnpm test:readme    # run README and docs examples against the built package
pnpm test:demo      # build and exercise the demo in a browser
pnpm dev            # build and serve the demo at http://127.0.0.1:7400/
pnpm data:report    # show generated seed counts and date coverage
pnpm data:check     # verify generated data matches its reviewed sources
```

The package is not ready for publication while source archive backup, live curation, public feed setup or release checks remain incomplete. The first npm publication and trusted-publisher setup belong to the maintainer.

## Releasing

The maintainer bumps the package version and `src/version.ts` together, moves the relevant `Unreleased` notes to a dated version, completes the required data archive and review steps, and waits for the release checks before tagging. The first npm publication and trusted publisher configuration are maintainer actions; this repository's current setup is not a completed release workflow.
