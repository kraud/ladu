/**
 * Exercise Controller — thin HTTP layer for practice.
 *
 * Validation is pure (services/exercises/validate.ts), the database work is in
 * services/exerciseService.ts, and the knowledge math is in services/exercises.
 * Spec: .context/plans/phase-5-practice.md §B.3.
 *
 * Route usage is declared in ../routes/exerciseRoutes.js (still CJS).
 */

const asyncHandler = require('express-async-handler');
const {
    validateAnswerRequest,
    validateGenerateRequest,
    validateModifierRequest,
    isUuid,
}: typeof import('../services/exercises') = require('../services/exercises');
const exerciseService: typeof import('../services/exerciseService') = require('../services/exerciseService');

const badRequest = (res: any, failure: { code: string; message: string }) =>
    res.status(400).json({ message: failure.message, code: failure.code });

const notFound = (res: any) => res.status(404).json({ message: 'Not found', code: 'not_found' });

// @desc    Create the exercises of one practice session
// @route   POST /api/exercises/generate
// @access  Private
// POST, not GET: the result is random, so the call is not idempotent.
const generate = asyncHandler(async (req: any, res: any) => {
    const parsed = validateGenerateRequest(req.body);
    if (!parsed.ok) return badRequest(res, parsed);

    const exercises = await exerciseService.generateExercises(req.user, parsed.value);
    res.status(200).json({ exercises });
});

// @desc    Save one answer (creates or updates the user's performance)
// @route   POST /api/exercises/answers
// @access  Private
const saveAnswer = asyncHandler(async (req: any, res: any) => {
    const parsed = validateAnswerRequest(req.body);
    if (!parsed.ok) return badRequest(res, parsed);

    const summary = await exerciseService.saveAnswer(req.user.id, parsed.value);
    if (!summary) return notFound(res);
    res.status(200).json(summary);
});

// @desc    Set or clear the Mastered / Revise modifier of a translation
// @route   PUT /api/exercises/performances/:translationId/modifier
// @access  Private
const setModifier = asyncHandler(async (req: any, res: any) => {
    if (!isUuid(req.params.translationId)) {
        return badRequest(res, { code: 'invalid_translation_id', message: 'translationId must be a valid id.' });
    }
    const parsed = validateModifierRequest(req.body);
    if (!parsed.ok) return badRequest(res, parsed);

    const summary = await exerciseService.setModifier(req.user.id, req.params.translationId, parsed.value.modifier);
    if (!summary) return notFound(res);
    res.status(200).json(summary);
});

module.exports = {
    generate,
    saveAnswer,
    setModifier,
};
