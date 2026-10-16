/**
 * Shared-server wrapper for supertest.
 *
 * Use it exactly like supertest:  const request = require('./request');
 *                                 await request(app).get('/api/...');
 *
 * Why: plain `request(app)` starts a NEW server on a random port for EACH
 * request and closes it after. A full run makes enough requests to cycle
 * through all of macOS's ~16,000 temporary ports, and sometimes gets a port
 * pair that the OS is still closing from an earlier request. The OS resets
 * the connection and the test fails with "socket hang up" — in a random suite,
 * never when the suite runs alone. A minimal repro (no DB) gave 4–6 failures
 * per 20,000 requests with a server per request, and 0 in 60,000 with one
 * shared server.
 *
 * So this helper starts ONE server per app (per test file — Jest gives each
 * file its own module registry) on first use, sends every request to it, and
 * closes it in afterAll.
 */

const supertest = require('supertest');

const servers = new Map();

const request = (app) => {
    let server = servers.get(app);
    if (!server) {
        server = app.listen(0);
        servers.set(app, server);
    }
    return supertest(server);
};

afterAll(async () => {
    await Promise.all(
        [...servers.values()].map(
            (server) =>
                new Promise((resolve) => {
                    // Drop idle keep-alive sockets so close() does not wait.
                    server.closeAllConnections();
                    server.close(() => resolve());
                })
        )
    );
    servers.clear();
});

module.exports = request;
