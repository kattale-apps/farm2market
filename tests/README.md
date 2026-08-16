# Unit Test Setup

This project uses Node's built-in test runner through `tsx` for TypeScript unit tests.

## Commands

- `npm test` runs all unit tests in `tests/**/*.test.ts`
- `npm run test:unit` is the explicit unit-test command
- `npm run test:watch` runs the suite in watch mode

## Notes

- Playwright E2E specs are separate and remain under the `tests/` folder.
- Unit-test files should end in `.test.ts` and use `node:test` + `node:assert/strict`.
