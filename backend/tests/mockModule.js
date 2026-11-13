/**
 * Replace a CommonJS module for the current test file.
 *
 * Why this exists: Vitest's vi.mock() only replaces modules loaded with
 * `import`. Our app code loads its modules with `require()`, so vi.mock()
 * silently does nothing there. This helper puts the replacement straight
 * into Node's require cache instead.
 *
 * Call it BEFORE the first require of the app (same place jest.mock sat).
 *
 *   const { mockModule } = require('./mockModule');
 *   const sendEmail = mockModule('../utils/sendEmail', vi.fn().mockResolvedValue());
 */
const Module = require('module');
const path = require('path');

// The file that called mockModule / mockModuleFactory (first stack frame that
// is not this file). module.parent would be wrong: it is only the FIRST file
// that ever required this helper.
const callerFile = () => {
    const lines = new Error().stack.split('\n').slice(1);
    for (const line of lines) {
        const m = line.match(/\(?(?:file:\/\/)?(\/[^():]+?):\d+:\d+\)?\s*$/);
        if (m && m[1] !== __filename) return m[1];
    }
    throw new Error('mockModule: could not find the calling file');
};

const mockModule = (relativePath, replacement) => {
    const callerPath = callerFile();
    const id = Module._resolveFilename(relativePath, {
        id: callerPath,
        filename: callerPath,
        paths: Module._nodeModulePaths(path.dirname(callerPath)),
    });
    require.cache[id] = { id, filename: id, loaded: true, exports: replacement, children: [], paths: [] };
    return replacement;
};

/**
 * Same as mockModule, but takes a factory function (like the second argument
 * of jest.mock). The factory runs once, right away. Inside it you can call
 * require() on the real module to keep part of it:
 *
 *   mockModuleFactory('@sentry/node', () => ({
 *       ...require('@sentry/node'),
 *       captureMessage: vi.fn(),
 *   }));
 */
const mockModuleFactory = (relativePath, factory) => mockModule(relativePath, factory());

module.exports = { mockModule, mockModuleFactory };
