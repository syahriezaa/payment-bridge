import util from 'node:util';

class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new AssertionError(
          `Expected ${util.inspect(actual)} to be ${util.inspect(expected)}`,
          actual,
          expected
        );
      }
    },
    toEqual(expected) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new AssertionError(
          `Expected deep equal:\nActual: ${actualStr}\nExpected: ${expectedStr}`,
          actual,
          expected
        );
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new AssertionError(`Expected ${util.inspect(actual)} to be truthy`, actual, true);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new AssertionError(`Expected ${util.inspect(actual)} to be falsy`, actual, false);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new AssertionError(`Expected ${util.inspect(actual)} to be null`, actual, null);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new AssertionError(`Expected value to be defined`, actual, 'defined');
      }
    },
    toContain(item) {
      if (typeof actual === 'string') {
        if (!actual.includes(item)) {
          throw new AssertionError(`Expected string ${util.inspect(actual)} to contain ${util.inspect(item)}`, actual, item);
        }
      } else if (Array.isArray(actual)) {
        if (!actual.includes(item)) {
          throw new AssertionError(`Expected array to contain ${util.inspect(item)}`, actual, item);
        }
      } else {
        throw new AssertionError(`Target object is not iterable for toContain`, actual, item);
      }
    },
    toBeGreaterThan(num) {
      if (typeof actual !== 'number' || actual <= num) {
        throw new AssertionError(`Expected ${actual} to be greater than ${num}`, actual, num);
      }
    },
    toBeLessThan(num) {
      if (typeof actual !== 'number' || actual >= num) {
        throw new AssertionError(`Expected ${actual} to be less than ${num}`, actual, num);
      }
    },
    toBeGreaterThanOrEqual(num) {
      if (typeof actual !== 'number' || actual < num) {
        throw new AssertionError(`Expected ${actual} to be >= ${num}`, actual, num);
      }
    },
    toStartWith(prefix) {
      if (typeof actual !== 'string' || !actual.startsWith(prefix)) {
        throw new AssertionError(`Expected ${util.inspect(actual)} to start with ${util.inspect(prefix)}`, actual, prefix);
      }
    },
    toMatch(regex) {
      const reg = typeof regex === 'string' ? new RegExp(regex) : regex;
      if (typeof actual !== 'string' || !reg.test(actual)) {
        throw new AssertionError(`Expected ${util.inspect(actual)} to match regex ${reg}`, actual, regex);
      }
    },
    async toThrow(expectedMsg) {
      let th = false;
      let caughtError = null;
      try {
        if (typeof actual === 'function') {
          await actual();
        }
      } catch (err) {
        th = true;
        caughtError = err;
      }
      if (!th) {
        throw new AssertionError(`Expected function to throw error, but it succeeded`, null, 'Error');
      }
      if (expectedMsg && caughtError) {
        const msg = caughtError.message || String(caughtError);
        if (!msg.includes(expectedMsg)) {
          throw new AssertionError(`Expected error message to contain ${util.inspect(expectedMsg)}, got ${util.inspect(msg)}`, msg, expectedMsg);
        }
      }
    }
  };
}

class TestSuiteRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
  }

  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      beforeAllHooks: [],
      afterAllHooks: [],
      beforeEachHooks: [],
      afterEachHooks: []
    };
    this.suites.push(suite);
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    fn();
    this.currentSuite = prevSuite;
  }

  it(name, fn) {
    if (!this.currentSuite) {
      throw new Error(`'it' must be called inside 'describe' block`);
    }
    this.currentSuite.tests.push({ name, fn });
  }

  beforeAll(fn) {
    if (this.currentSuite) this.currentSuite.beforeAllHooks.push(fn);
  }

  afterAll(fn) {
    if (this.currentSuite) this.currentSuite.afterAllHooks.push(fn);
  }

  beforeEach(fn) {
    if (this.currentSuite) this.currentSuite.beforeEachHooks.push(fn);
  }

  afterEach(fn) {
    if (this.currentSuite) this.currentSuite.afterEachHooks.push(fn);
  }

  async run() {
    let total = 0;
    let passed = 0;
    let failed = 0;
    const failures = [];
    const startTime = Date.now();

    for (const suite of this.suites) {
      console.log(`\n\x1b[36m=== Suite: ${suite.name} ===\x1b[0m`);
      for (const hook of suite.beforeAllHooks) {
        await hook();
      }

      for (const test of suite.tests) {
        total++;
        for (const hook of suite.beforeEachHooks) {
          await hook();
        }

        const tStart = Date.now();
        try {
          await test.fn();
          const duration = Date.now() - tStart;
          passed++;
          console.log(`  \x1b[32m✔\x1b[0m ${test.name} \x1b[90m(${duration}ms)\x1b[0m`);
        } catch (err) {
          const duration = Date.now() - tStart;
          failed++;
          console.log(`  \x1b[31m✖\x1b[0m ${test.name} \x1b[90m(${duration}ms)\x1b[0m`);
          console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
          if (err.stack) {
            const stackLines = err.stack.split('\n').slice(1, 4).join('\n');
            console.log(`    \x1b[90m${stackLines}\x1b[0m`);
          }
          failures.push({ suite: suite.name, test: test.name, error: err });
        }

        for (const hook of suite.afterEachHooks) {
          await hook();
        }
      }

      for (const hook of suite.afterAllHooks) {
        await hook();
      }
    }

    const totalDuration = Date.now() - startTime;
    return { total, passed, failed, failures, duration: totalDuration };
  }
}

export const runner = new TestSuiteRunner();
export const describe = runner.describe.bind(runner);
export const it = runner.it.bind(runner);
export const beforeAll = runner.beforeAll.bind(runner);
export const afterAll = runner.afterAll.bind(runner);
export const beforeEach = runner.beforeEach.bind(runner);
export const afterEach = runner.afterEach.bind(runner);
