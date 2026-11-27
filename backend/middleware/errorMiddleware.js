// What a client reads when nobody set a status, and so the real message is
// unknown territory (a failed query, a bug). Never the real message: a
// Drizzle/Postgres error message carries the SQL text and its parameters,
// which can include a password hash.
const UNEXPECTED_ERROR_MESSAGE = 'Internal server error';

const INVALID_BODY_MESSAGE = 'Invalid request body';

const errorHandler = (err, req, res, next) => {
    // Handlers set a 4xx (or, rarely, a 5xx such as 503) via res.status() before
    // throwing, with a message written for the client. Anything else is an
    // unanticipated error. Never leak err.stack to the client.
    const deliberate = res.statusCode >= 400;
    // The body parsers refuse a request before any handler runs: the status is on
    // the error, and `expose` marks it as the client's fault. Their messages can
    // quote the body, so the client gets a fixed one.
    const badBody = !deliberate && err.expose === true && err.status >= 400 && err.status < 500;
    const statusCode = deliberate ? res.statusCode : badBody ? err.status : 500;

    res.status(statusCode);

    let message = badBody ? INVALID_BODY_MESSAGE : err.message;
    if (!deliberate && !badBody) {
        message = UNEXPECTED_ERROR_MESSAGE;
        // The real error stays on the server. Sentry reports it (see app.js);
        // the log line covers setups without a DSN. Silent in tests, where
        // forced errors are common.
        if (process.env.NODE_ENV !== 'test') console.error(err);
    }

    // `apiCode` is set on purpose by code that wants the client to react to a
    // specific case (for example a forced password change). It is not `err.code`,
    // which Node uses for system errors (ECONNRESET...) and must not be exposed.
    const body = { message };
    if (typeof err.apiCode === 'string') body.code = err.apiCode;
    res.json(body);
}

module.exports = {
    errorHandler,
    UNEXPECTED_ERROR_MESSAGE,
}
