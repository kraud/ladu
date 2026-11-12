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

const mockModule = (relativePath, replacement) => {
    // Resolve relative to the test file that calls us, like jest.mock did.
    const callerDir = path.dirname(module.parent.filename);
    const id = Module._resolveFilename(relativePath, {
        id: module.parent.filename,
        filename: module.parent.filename,
        paths: Module._nodeModulePaths(callerDir),
    }, false, relativePath.startsWith('.') ? { paths: [callerDir] } : undefined);
    require.cache[id] = { id, filename: id, loaded: true, exports: replacement, children: [], paths: [] };
    return replacement;
};

module.exports = { mockModule };
