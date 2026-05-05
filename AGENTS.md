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

- **Pre-commit**: runs `tslint` and `prettier --check` on staged `*.{js,ts}` files via nano-staged.
- **Pre-push**: runs `npm run typecheck && npm test -- --no-coverage`.

Fix lint issues before committing: `npm run lint:fix`. To temporarily bypass hooks (rare; do not abuse): `SKIP_SIMPLE_GIT_HOOKS=1 git commit ...`.

Claude Code hooks (configured in `.claude/settings.json`, team-wide):

- **PreToolUse** on `Edit|Write`: blocks edits to any `*.env*` path (likely contains secrets).
- **PostToolUse** on `Edit|Write`: auto-formats edited `.ts` / `.tsx` files via `npx prettier --write`.

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
