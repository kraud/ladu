// See jest.config.js's own comment on the `resolver` option for why this
// exists: Jest's resolver can't follow @sentry/server-utils's package.json
// "exports" map for several subpaths @sentry/node's tracing integrations
// require internally, even though Node's own require.resolve handles the
// exact same subpaths correctly.
module.exports = (request, options) => {
    if (request === '@sentry/server-utils' || request.startsWith('@sentry/server-utils/')) {
        return require.resolve(request, { paths: [options.basedir] });
    }
    return options.defaultResolver(request, options);
};
