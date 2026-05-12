# AI Agent Instructions

## Project Context

See [docs/ai-agent-context.md](docs/ai-agent-context.md) for service architecture, tech stack, key concepts, and API surface.

For broader Decentraland contributor guidelines, see <https://docs.decentraland.org/llms.txt>

## Skills

This project uses skills from [decentraland/ai-toolkit](https://github.com/decentraland/ai-toolkit). Load the relevant skill **before** making changes:

| Skill | When to load |
|---|---|
| `dcl-testing` | Writing, modifying, or reviewing `*.spec.ts` / `*.test.ts` files |
| `dcl-wkc-components` | Working on files in `src/components.ts`, `src/ports/`, `src/logic/`, `src/controllers/`, `src/types/`, or any file importing from `@well-known-components` |
| `dcl-backend-standards` | Any backend `*.ts` file — type safety, error handling, security, HTTP conventions, logging, env config |

## Hooks

Git hooks are enforced via `simple-git-hooks` + `nano-staged` (configured in `package.json`). New contributors get them auto-installed by the `prepare` script on `npm install`:

- **Pre-commit**: runs `eslint` and `prettier --check` on staged `*.{js,ts}` files via nano-staged.
- **Pre-push**: runs `npm run typecheck && npm test -- --no-coverage`.

Fix lint issues before committing: `npm run lint:fix`. To temporarily bypass hooks (rare; do not abuse): `SKIP_SIMPLE_GIT_HOOKS=1 git commit ...`.

Claude Code hooks (configured in `.claude/settings.json`, team-wide):

- **PreToolUse** on `Edit|Write`: blocks edits to any `*.env*` path (likely contains secrets).
- **PostToolUse** on `Edit|Write`: auto-formats edited `.ts` / `.tsx` files via `npx prettier --write`.

## Linting

- ESLint via [`@dcl/eslint-config`](https://github.com/decentraland/eslint-config) (`core-services.config`), ESLint 9 flat config in `eslint.config.js`. Prettier is wired in through `eslint-plugin-prettier`, so `eslint` is the single source of truth for both rules and formatting.
- **Lint-time tsconfig is `tsconfig.eslint.json`** (extends `tsconfig.json`, widens `include` to cover `src`, `test`, `eslint.config.js`). The DCL preset auto-prefers it over `tsconfig.json`. If you change `include` in `tsconfig.json`, mirror the change in `tsconfig.eslint.json` only if the lint surface needs to follow.
- Project Prettier config pins `trailingComma: 'es5'` in `package.json`. Do not flip this casually — Prettier 3's default is `'all'`, and adopting it would reformat most files. Make it its own PR when desired.
- **`eslint-disable-next-line` requires a justification** in the `-- <reason>` form, e.g.
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ethers Result has no statically known shape`.
  Place the directive directly above the offending **line**, not above the enclosing declaration — multi-line function signatures will otherwise leave the violating line uncovered.

## Dependency bumps

When changing entries under `dependencies` / `devDependencies`:

1. Run `npm install` **once** to absorb the change.
2. Commit the resulting `package-lock.json` alongside the `package.json` change in the same commit.
3. Re-verify with `npm ci` (deterministic, won't mutate the lockfile) before pushing, plus `npm run lint`, `npm run typecheck`, and `npm test -- --no-coverage`.

**Never `rm -rf package-lock.json`** to "fix" resolution issues. If `npm install` fails with `ERESOLVE` during a peer-dep-heavy plugin swap (lint/prettier plugin families are common offenders), run `npm install --legacy-peer-deps` once to let npm re-emit the lockfile, then a second plain `npm install` to reconcile, then `npm ci` to verify. This pattern is expected only for plugin-ecosystem swaps; plain version bumps should not need it.

## Testing

- **Logic tests** (`test/tests/logic/`): unit tests for individual functions and components in isolation.
- **Port tests** (`test/tests/ports/`): integration tests for external service integrations and HTTP endpoints.
- Load the `dcl-testing` skill for full testing standards.

## Development Commands

| Task | Command |
|---|---|
| Install dependencies | `npm install` |
| Type-check only | `npm run typecheck` |
| Build (type-check + emit) | `npm run build` |
| Run dev server (watch) | `npm run start:watch` |
| Run dev server (debug) | `npm run debug` |
| Run all tests | `npm test` |
| Run tests in watch mode | `npm run test:watch` |
| Lint (check) | `npm run lint` |
| Lint (fix) | `npm run lint:fix` |
| Run migrations | `npm run migrate` |

## Workflow

- Default branch: **`master`** (not `main`).
- Branch names: `feat/`, `fix/`, `refactor/`, `chore/`.
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`). **No `Co-Authored-By` line.**
- PRs: target `master`. CI runs via GitHub Actions in `.github/workflows/` (`node`, `docker`, `deploy`, `release`).
