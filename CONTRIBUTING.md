# Contributing

Thank you for helping. Bug reports, ideas and pull requests are all welcome.
Bug reports and ideas go in the
[issues](https://github.com/johnmorrisdotca/meigen-sports/issues).

## The rules

- **No runtime dependencies.** The package is a few modules of plain TypeScript plus reviewed static JSON; a dependency is not
  added for convenience.
- **The core is pure.** Every function returns new values and never changes what it was given. Dates and context are explicit
  arguments. Selectors do not read the clock, use randomness, mutate input records or perform I/O.
- **Anything from outside is made safe.** A shard URL is a public HTTPS (or loopback) base plus a versioned path; a malformed
  row is rejected. A new option that reaches a loader has a test with a hostile value.
- **Test what you change.** Tests sit in `test/`. A rule you change has a test that would have caught it.
- **Preserve provenance and rights.** Every exported row needs source evidence, stable identity where applicable, exact date
  support and its original rights. The MIT code licence does not relicense data. Keep full source notices in `LICENSES/` and
  source-specific terms in `NOTICE.md`. Quotes ship only with verified redistribution rights.
- **Do not invent facts.** Names are not identity keys. Unknown dates stay unknown; a season aggregate does not prove the
  exact game or scorer.
- **Docs pages are single-language.** Every page of the README and of `docs/` is in one language: one page per language, made from one source where that is practical, a Japanese one named `<name>.ja.md`, and the two linked at the top with a line such as `日本語 · English`. No page mixes English and Japanese in a table or in its prose, and a demo switches language with a control. Proper nouns and code identifiers (an id or a constant) stay as they are on both pages, and a Japanese term that is itself the subject (the package's own name) may appear once on an English page as a quoted name. The exception is a page about the translations themselves (`docs/translations.md`), which may show both languages side by side. A test, `docs-language.test`, holds the docs to this and lists each exception with its reason.
- **A README table, example or count that a test holds to the code** changes together with the code: `pnpm test:readme` runs
  every example of the README and of `docs/`, and checks that the README names every export.
- **Art and data are shipped only when their licence lets them be**, with the notice kept in `NOTICE.md`. No GPL or LGPL code.
  No SPX, SPXN or SPXIS mark belongs in this MIT package.
- **Static readers only.** Public consumers use versioned static JSON. Do not add per-reader database calls, Supabase writes or credentials to package code.
- **Needs Node 22 or later** to use the package, and **22.18 or later** to work on it: the tests, the scripts (`scripts/*.ts`) and the demo's server run TypeScript directly with Node's own type stripping, with no `tsx` and no build step. So the TypeScript in `scripts/`, `test/`, `e2e/` and `demo/` uses only syntax that can be erased: no `enum`, no `namespace`, no constructor parameter properties (`erasableSyntaxOnly` rejects them), `import type` for types, and a `.ts` extension on every relative import. `pnpm typecheck` checks all of it. The demo's scripts (`demo/*.ts`) run in a browser, so `scripts/page.ts` builds them with esbuild into `.js`.
- **Ports.** This package owns local ports 7400 to 7499 and nothing outside them. The demo's server is on 7400 (`scripts/dev.ts`),
  the tests' on 7401 (`playwright.config.ts`; `TEST_PORT` names another, so that two worktrees do not meet), and any other server or worktree takes 7402 and up.
  Check with `lsof -iTCP:<port> -sTCP:LISTEN` first, and stop a server by its process id, never by name.

## Pull requests

One change per pull request. Say what changed and how you checked it, and add a line to `CHANGELOG.md` under **Unreleased**:
for a change a user would notice, and for one to the repository alone.

## Commands

```sh
pnpm check          # lint, types, tests, the build and the packed package
pnpm test:package   # pack it as npm does, install it in an empty project, import every entry
pnpm test:demo      # build the demo and play it in a real browser at a phone's width and a desk's
pnpm test:readme    # run the examples of the README and of docs/ against the built package
pnpm data:report    # show generated seed counts and date coverage
pnpm data:check     # verify generated data matches its reviewed sources
pnpm screenshots    # the README's pictures, into docs/images
pnpm dev            # the demo on http://127.0.0.1:7400/
```

## Releasing

Maintainers bump the version in `package.json` and in `src/version.ts`, move *Unreleased* to the new version in
`CHANGELOG.md`, dated, push, wait for CI and tag `vX.Y.Z`, the same as `package.json`'s version. The Release workflow
(`.github/workflows/release.yml`) checks and builds the package, attaches the tarball to a GitHub release and publishes it to
npm by trusted publishing, with provenance and no token. A version already on npm is not published again.
