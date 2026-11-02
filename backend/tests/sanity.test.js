const request = require('./request');
const app = require('../app');
const db = require('./db');

beforeAll(() => db.connectDB());
afterAll(() => db.closeDB());

// Two routes that other things rely on: the e2e boot check waits for `GET /`, and the Docker
// HEALTHCHECK, `deploy.sh` and `deployed-smoke.spec.ts` call `GET /api/health`.
describe('Sanity Check', () => {
    it('GET / responds with 200 and hello message', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('message', 'Hello world!');
    });

    it('GET /api/health responds with 200, status ok and a sha', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ status: 'ok', sha: expect.any(String) });
    });
});
