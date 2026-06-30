# Contributing to ƿen

Thanks for your interest in ƿen! It's a small, deliberately dependency-light
project, and we'd like to keep it that way. A little structure up front keeps it
a joy to maintain.

## Architecture first

Before changing anything, please read **[`LLM_CONTRIBUTING.md`](./LLM_CONTRIBUTING.md)**.
Despite the name, it's the canonical architecture guide for *all* contributors
(human or AI). It covers the non-negotiables:

- the **zero-build, ESM-from-CDN** philosophy (no Node/Webpack/npm for consumers),
- the **"Dumb Router"** pattern for adding block types,
- the **view-class contract** every block must implement,
- the **safe-by-default security** model and the `unsafe` opt-out,
- and the **`.wen-` CSS namespacing** rule.

Changes that fight these patterns are unlikely to be merged — but proposals to
*evolve* them are very welcome; open an issue to discuss.

## Local development

No `npm install` is required to run the editor. Just open a demo in a browser:

- `index.html` — the minimal sandbox (loads modules straight from `src/`)
- `ide.html` — the full split-screen Monaco + ƿen IDE (also runs from `src/`)

Because everything is ESM loaded over HTTP, serve the folder rather than opening
via `file://`:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/index.html
```

## Building the bundle

The distributable bundle (`dist/`) is only needed for publishing; consumers load
it from the CDN. To produce it locally:

```bash
npm run build   # runs build.sh: stitches + minifies CSS/JS via npx
```

`dist/` is git-ignored and rebuilt automatically on `npm publish`.

## Submitting changes

1. Open an issue describing the change (especially for new block types or any
   change touching the security model).
2. Keep PRs focused and small; match the existing style.
3. If you add a module, follow the workflow in `LLM_CONTRIBUTING.md` §7
   (wire it into `build.sh` and the `blockViews` config).
4. Never weaken the safe-by-default rendering contract without it being behind
   the `unsafe` flag.

## Releases

Releases are automated via OIDC Trusted Publishing — no npm token required. To cut a
release, bump the version and push the tag:

```bash
npm version patch && git push --tags   # use minor / major as appropriate
```

`npm version` bumps `package.json` and creates a matching `v*` git tag; pushing the tag
triggers `.github/workflows/publish.yml`, which builds and publishes `@cubud/wen` to npm
with provenance.

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](./LICENSE).
