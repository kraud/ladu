const errorHandler = (err, req, res, next) => {
    // Handlers set a 4xx via res.status() before throwing; anything else is an
    // unanticipated 500. Never leak err.stack to the client — only a stable
    // message shape is returned.
    const statusCode = res.statusCode >= 400 ? res.statusCode : 500;

    res.status(statusCode);
    res.json({ message: err.message });
}

module.exports = {
    errorHandler,
}