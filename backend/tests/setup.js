// Polyfill SlowBuffer for Node.js 24+ compatibility
const buffer = require('buffer');
if (!buffer.SlowBuffer) {
    buffer.SlowBuffer = buffer.Buffer;
}

const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';

global.signin = (id) => {
    const userId = id.toString();
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};
