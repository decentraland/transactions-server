# Testing Standards - Detailed Reference

## Examples

### Correct Structure

```typescript
describe("when the form is submitted", () => {
  let mockSubmit: jest.Mock;

  beforeEach(() => {
    mockSubmit = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("and the input is valid", () => {
    let validInput: any;

    beforeEach(() => {
      validInput = { name: "test", email: "test@test.com" };
    });

    it("should call the onSubmit callback", () => {
      mockSubmit();
      expect(mockSubmit).toHaveBeenCalled();
    });
  });

  describe("and the input is invalid", () => {
    let invalidInput: any;

    beforeEach(() => {
      invalidInput = { name: "", email: "invalid" };
    });

    it("should display a validation error", () => {
      /* ... */
    });
  });
});
```

### Scoped Mocks (Correct vs Incorrect)

```typescript
// BAD - Global mocks used in specific contexts
describe("when testing API endpoints", () => {
  let validAuthChain: AuthChain;
  let invalidAuthChain: AuthChain;

  beforeEach(async () => {
    validAuthChain = createValidAuthChain();
    invalidAuthChain = createInvalidAuthChain();
  });

  describe("and the request is valid", () => {
    it("should respond with 200", () => {
      // Uses validAuthChain - but it was created globally
    });
  });
});

// GOOD - Mocks scoped to specific contexts
describe("when testing API endpoints", () => {
  beforeEach(async () => {
    port = await getPort();
    baseUrl = `http://localhost:${port}`;
  });

  describe("and the request is valid", () => {
    let validAuthChain: AuthChain;

    beforeEach(async () => {
      validAuthChain = createValidAuthChain();
    });

    it("should respond with 200", () => {
      // Uses validAuthChain - created in this context
    });
  });

  describe("and the request is invalid", () => {
    let invalidAuthChain: AuthChain;

    beforeEach(() => {
      invalidAuthChain = createInvalidAuthChain();
    });

    it("should respond with 400", () => {
      // Uses invalidAuthChain - created in this context
    });
  });
});
```

### Mock Component Reuse (Correct vs Incorrect)

```typescript
// BAD - Recreating mock components and system under test in nested describes
describe('when the caller is not an admin', () => {
  beforeEach(() => {
    mockSceneManager = createSceneManagerMockedComponent({
      isSceneOwnerOrAdmin: jest.fn().mockResolvedValue(false)
    })
    // Recreating the entire system under test just to change one mock
    systemUnderTest = createComponent({
      sceneManager: mockSceneManager,
      otherDep: mockOtherDep,
      anotherDep: mockAnotherDep,
    })
  })
})

// GOOD - Override only the specific mock method
describe('when the caller is not an admin', () => {
  beforeEach(() => {
    mockSceneManager.isSceneOwnerOrAdmin.mockResolvedValue(false)
  })
})
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| `it('should fail when email is missing')` | Use `describe('when email is missing')` + `it('should return 400 status')` |
| Variables defined inside `it()` | Move to `beforeEach` in the enclosing `describe` |
| Global mocks for specific contexts | Scope mocks to the `describe` where they're used |
| Flat structure without context | Use nested `describe` blocks with "when"/"and" |
| Generic descriptions like "should work" | Be specific: "should respond with a 500 and the error" |
| Recreating entire mock component to change one method's return value | Override the specific method: `mock.method.mockResolvedValue(newValue)` |
| Recreating the system under test in nested describes | Create it once in top-level beforeEach; it holds references to the mocks |

## AI Validation

When AI creates or updates tests, it MUST:

1. Validate existing tests for compliance with these rules
2. Check mock scoping in all test files
3. Run linter after updates
4. Provide correct vs incorrect examples
5. Test the rules with real test files
