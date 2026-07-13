// Semgrep fixture tests for qa-testing-rules JS/TS rules.
// Annotated lines must be matched by the named rule.
// Clean alternatives (no annotation) verify the rule doesn't fire on correct code.

/* eslint-disable */

// ── qa-no-jest-retry (WARNING) ────────────────────────────────────────────────

// ruleid: qa-no-jest-retry
jest.retryTimes(3);

// ── qa-playwright-retries-require-flake-governance (INFO) ────────────────────

// ruleid: qa-playwright-retries-require-flake-governance
test.describe.configure({ retries: 2 });

// ── qa-no-sleep-in-tests-js (ERROR) ──────────────────────────────────────────

it('bad: setTimeout promise delay', async () => {
  await startAsync();
  // ruleid: qa-no-sleep-in-tests-js
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(getState()).toBe('ready');
});

it('bad: sleep helper', async () => {
  // ruleid: qa-no-sleep-in-tests-js
  await sleep(200);
});

it('bad: delay helper', async () => {
  // ruleid: qa-no-sleep-in-tests-js
  await delay(100);
});

// Clean alternatives: await the operation directly or use waitFor.
it('ok: waitFor', async () => {
  await startAsync();
  await waitFor(() => expect(getState()).toBe('ready'));
});

// ── qa-no-chdir-in-tests-js (WARNING) ────────────────────────────────────────

it('bad: process.chdir pollutes parallel tests', () => {
  // ruleid: qa-no-chdir-in-tests-js
  process.chdir('/tmp');
});

// Clean alternative: pass path as a parameter.
it('ok: pass path explicitly', () => {
  runWithDir('/tmp', () => doWork());
});

// ── qa-no-focused-tests-js (ERROR) ───────────────────────────────────────────

// ruleid: qa-no-focused-tests-js
test.only('bad: focused test silently skips the rest of the suite', () => {
  expect(1 + 1).toBe(2);
});

// ruleid: qa-no-focused-tests-js
it.only('bad: focused it', () => {});

// ruleid: qa-no-focused-tests-js
describe.only('bad: focused describe', () => {});

// ruleid: qa-no-focused-tests-js
fit('bad: fit alias', () => {});

// ruleid: qa-no-focused-tests-js
fdescribe('bad: fdescribe alias', () => {});

// ── qa-no-skipped-tests-js (INFO) ────────────────────────────────────────────

// ruleid: qa-no-skipped-tests-js
test.skip('bad: indefinitely quarantined test', () => {});

// ruleid: qa-no-skipped-tests-js
it.skip('bad: skipped it', () => {});

// ruleid: qa-no-skipped-tests-js
describe.skip('bad: skipped describe', () => {});

// ruleid: qa-no-skipped-tests-js
xit('bad: xit alias', () => {});

// ruleid: qa-no-skipped-tests-js
xdescribe('bad: xdescribe alias', () => {});

// ── qa-weak-assertion-tobetruthy (INFO) ──────────────────────────────────────

it('bad: weak toBeTruthy assertion', () => {
  const result = getUser();
  // ruleid: qa-weak-assertion-tobetruthy
  expect(result).toBeTruthy();
});

it('bad: weak toBeDefined assertion', () => {
  const value = compute();
  // ruleid: qa-weak-assertion-tobetruthy
  expect(value).toBeDefined();
});

// Clean alternative: assert a concrete value.
it('ok: concrete assertion', () => {
  const result = getUser();
  expect(result).toEqual({ id: 1, name: 'Alice' });
});

// ── qa-bare-tothrow (INFO) ────────────────────────────────────────────────────

it('bad: bare toThrow passes for any error type', () => {
  // ruleid: qa-bare-tothrow
  expect(() => withdraw(-10)).toThrow();
});

it('bad: bare rejects.toThrow passes for any rejection', () => {
  // ruleid: qa-bare-tothrow
  expect(fetchUser('bad-id')).rejects.toThrow();
});

// Clean alternative: assert the concrete error type.
it('ok: concrete error type', () => {
  expect(() => withdraw(-10)).toThrow(NegativeAmountError);
});

// ── stubs so the fixture file is parseable ────────────────────────────────────

declare const sleep: (ms: number) => Promise<void>;
declare const delay: (ms: number) => Promise<void>;
declare const waitFor: (fn: () => void) => Promise<void>;
declare function startAsync(): Promise<void>;
declare function getState(): string;
declare function doWork(): void;
declare function runWithDir(dir: string, fn: () => void): void;
declare function getUser(): { id: number; name: string };
declare function compute(): number;
declare function withdraw(amount: number): void;
declare function fetchUser(id: string): Promise<void>;
declare class NegativeAmountError extends Error {}
