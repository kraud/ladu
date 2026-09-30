/**
 * Practice Session Controller — thin HTTP layer for saved practice sessions.
 *
 * Validation and the summary are pure (services/exercises/validateSession.ts); the
 * database work, the limit and the expiry are in services/practiceSessionService.ts.
 * Spec: .context/plans/phase-5-5-saved-practice.md §5.
 *
 * Route usage is declared in ../routes/practiceRoutes.js (still CJS).
 */

const asyncHandler = require('express-async-handler');
const { validateSessionRequest, isUuid }: typeof import('../services/exercises') = require('../services/exercises');
const practiceSessionService: typeof import('../services/practiceSessionService') = require('../services/practiceSessionService');

const badRequest = (res: any, failure: { code: string; message: string }) =>
    res.status(400).json({ message: failure.message, code: failure.code });

const notFound = (res: any) => res.status(404).json({ message: 'Not found', code: 'not_found' });

// @desc    List the user's saved sessions (summaries only, newest first, expired ones hidden)
// @route   GET /api/practice/sessions
// @access  Private
const listSessions = asyncHandler(async (req: any, res: any) => {
    res.status(200).json(await practiceSessionService.listSessions(req.user.id));
});

// @desc    One saved session with its full snapshot
// @route   GET /api/practice/sessions/:id
// @access  Private
const getSession = asyncHandler(async (req: any, res: any) => {
    if (!isUuid(req.params.id)) return notFound(res);
    const session = await practiceSessionService.getSession(req.user.id, req.params.id);
    if (!session) return notFound(res);
    res.status(200).json(session);
});

// @desc    Save a session (the oldest one is deleted when the limit is reached)
// @route   POST /api/practice/sessions
// @access  Private
const createSession = asyncHandler(async (req: any, res: any) => {
    const parsed = validateSessionRequest(req.body);
    if (!parsed.ok) return badRequest(res, parsed);
    res.status(201).json(await practiceSessionService.createSession(req.user.id, parsed.value));
});

// @desc    Replace a saved session and start a new expiry period
// @route   PUT /api/practice/sessions/:id
// @access  Private
const updateSession = asyncHandler(async (req: any, res: any) => {
    if (!isUuid(req.params.id)) return notFound(res);
    const parsed = validateSessionRequest(req.body);
    if (!parsed.ok) return badRequest(res, parsed);
    const session = await practiceSessionService.updateSession(req.user.id, req.params.id, parsed.value);
    if (!session) return notFound(res);
    res.status(200).json(session);
});

// @desc    Delete a saved session
// @route   DELETE /api/practice/sessions/:id
// @access  Private
const deleteSession = asyncHandler(async (req: any, res: any) => {
    if (!isUuid(req.params.id)) return notFound(res);
    const deleted = await practiceSessionService.deleteSession(req.user.id, req.params.id);
    if (!deleted) return notFound(res);
    res.status(204).send();
});

module.exports = {
    listSessions,
    getSession,
    createSession,
    updateSession,
    deleteSession,
};
