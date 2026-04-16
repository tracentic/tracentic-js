# Contributing

Thanks for your interest in improving the Tracentic JS SDK. This guide covers how to get set up, the conventions we follow, and how to land a change.

## Getting started

Prerequisites:

- Node.js 18 or newer
- npm (ships with Node)
- git

Clone and build:

```bash
git clone https://github.com/tracentic/tracentic-js
cd tracentic-js
npm install
npm run build
npm test
```

## Reporting bugs & requesting features

Open an issue on GitHub. For bugs, include:

- SDK version
- Node.js version and module system (ESM or CommonJS)
- Minimal reproduction
- What you expected vs. what happened

For features, describe the use case first - the shape of the API usually follows from the problem.

## Making a change

1. Fork and create a branch off `main`.
2. Keep the change focused - one logical change per PR.
3. Add or update tests under `test/`. New public behavior needs a test.
4. Run the full test suite: `npm test`.
5. Type-check: `npm run typecheck`.
6. Update `CHANGELOG.md` under `[Unreleased]` if the change is user-visible.
7. Update `README.md` if you add or change a public API surface.
8. Open a PR with a short description of **what** and **why** - the diff shows the how.

## Code style

- Follow existing conventions in the file you're editing.
- TypeScript `strict` mode is on - honor it. No `any` without justification.
- Keep exports minimal: only add to the public surface (`src/index.ts`, `src/middleware/*`) what consumers actually need.
- Don't add comments that restate what the code does. Comments should explain non-obvious **why**.
- Both ESM and CommonJS builds must work. If you add a new entry point, update `exports` in `package.json` and the `tsup` config.

## Public API stability

Until we ship 1.0, minor versions may include breaking changes, but we try to avoid them. If your PR changes a public signature, call it out in the description.

## License & contributor agreement

By submitting a contribution, you agree that it is licensed under the Apache License 2.0 (see [LICENSE](LICENSE)), consistent with section 5 of the license.
