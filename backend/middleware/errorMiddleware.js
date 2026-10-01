const errorHandler = (err, req, res, next) => {
    // Handlers set a 4xx via res.status() before throwing; anything else is an
    // unanticipated 500. Never leak err.stack to the client — only a stable
    // message shape is returned.
    const statusCode = res.statusCode >= 400 ? res.statusCode : 500;

    res.status(statusCode);
    // `apiCode` is set on purpose by code that wants the client to react to a
    // specific case (for example a forced password change). It is not `err.code`,
    // which Node uses for system errors (ECONNRESET...) and must not be exposed.
    const body = { message: err.message };
    if (typeof err.apiCode === 'string') body.code = err.apiCode;
    res.json(body);
}

module.exports = {
    errorHandler,
}