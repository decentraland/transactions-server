---
name: dcl-testing
description: Decentraland testing standards. ALWAYS follow when writing, modifying, or reviewing files matching *.spec.ts, *.test.ts, *.spec.tsx, *.test.tsx. Enforces Jest + TypeScript patterns including describe/it semantic naming ("when"/"and"/"should"), mock scoping with beforeEach/afterEach, jest.fn(), mockReturnValueOnce, React Testing Library (getByRole, getByLabelText, userEvent), redux-saga-test-plan, supertest, and Cypress E2E. Prevents common mistakes like global mocks, variables inside it(), and flat test structure.
license: MIT
---

# Testing Standards

## Scope

Apply to all test files: `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx`

## Rules

### MUST (required)

- Use Jest and TypeScript for all tests.
- Organize tests with `describe` (context: "when", "and") and `it` (behavior: "should ...").
- Each context variant must have its own describe block with "when" or "and"
- Use "when" for main contexts and "and" for nested contexts
- Do NOT use "when" in it() descriptions - the context is already defined in the describe
- it() descriptions must be specific and descriptive about the expected behavior
- Prefer specific outcomes over generic ones (e.g., "should respond with a 500 and the error" vs "should return 500 status")
- Use `beforeEach` for setup, never mix with `beforeAll`.
- All test variables, input data, and mocks must be declared and assigned in beforeEach
- Do NOT define input variables inside it() blocks
- Each describe context should have its own beforeEach for its specific setup
- Mocks and test data must be scoped to the specific describe context where they are needed
- Do NOT create mocks in global beforeEach that are only used in specific describe contexts
- Each describe context should set up only the test data and mock overrides specific to that context in its own beforeEach
- Create mock components (via factory functions) and the system under test once in the top-level beforeEach. Do NOT recreate them in nested describe blocks.
- When a nested context needs different mock behavior, override the specific method on the existing mock (e.g. `mockComponent.method.mockResolvedValue(newValue)`) instead of recreating the entire mock component.
- Never recreate the system under test in nested describe blocks just to change a mock's return value. For class-based or DI-based code, the instance already holds references to its mocks — overriding the mock method is sufficient. For React components, override mock module/hook return values before rendering.
- When mock factories return `jest.Mocked<T>`, leverage the typing to call `.mockResolvedValue()`, `.mockReturnValue()`, etc. directly on individual methods.
- Use `afterEach` to clean up mocks, test data, and side effects to ensure test isolation.
- Use `let` for mutable, `const` for immutable variables. Type variables explicitly.
- Have one assertion per `it` unless justified for performance or testing multiple aspects of the same behavior.
- Test behavior, not implementation. Focus on what the code does, not how.
- Use `jest.fn()` for mocks, prefer `mockReturnValueOnce`/`mockResolvedValueOnce`, and reset mocks in `afterEach`.
- Keep tests independent and use clear, explicit descriptions.

### SHOULD (recommended)

- Use React Testing Library and accessible queries (`getByRole`, `getByLabelText`, etc.) for React components.
- Test reducers with action creators, selectors as functions, sagas with `redux-saga-test-plan`.
- Use `supertest` for API tests and Cypress for E2E.
- Place test files next to the code they test, named `*.spec.ts(x)` or `*.test.ts(x)`.
- Test accessibility and keyboard navigation.
- Place test utilities in a `__tests__/` directory when needed.

For examples, common mistakes, and AI validation checklist, see [references/REFERENCE.md](references/REFERENCE.md)
