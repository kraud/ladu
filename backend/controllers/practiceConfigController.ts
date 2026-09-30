/**
 * Practice Config Controller — thin HTTP layer for saved practice configurations.
 *
 * Validation is pure (services/exercises/validateConfig.ts); the database work is
 * in services/practiceConfigService.ts.
 * Spec: .context/plans/phase-5-5-saved-practice.md §5.
 *
 * Route usage is declared in ../routes/practiceRoutes.js (still CJS).
 */

const asyncHandler = require('express-async-handler');
const { validateConfigRequest, isUuid }: typeof import('../services/exercises') = require('../services/exercises');
const { simplifyWord } = require('./wordController.ts');
const practiceConfigService: typeof import('../services/practiceConfigService') = require('../services/practiceConfigService');

const badRequest = (res: any, failure: { code: string; message: string }) =>
    res.status(400).json({ message: failure.message, code: failure.code });

const notFound = (res: any) => res.status(404).json({ message: 'Not found', code: 'not_found' });

const nameTaken = (res: any) =>
    res.status(409).json({ message: 'A configuration with this name already exists.', code: 'name_taken' });

// @desc    List the user's saved configurations (newest first)
// @route   GET /api/practice/configs
// @access  Private
const listConfigs = asyncHandler(async (req: any, res: any) => {
    res.status(200).json(await practiceConfigService.listConfigs(req.user.id));
});

// @desc    Save a configuration
// @route   POST /api/practice/configs
// @access  Private
const createConfig = asyncHandler(async (req: any, res: any) => {
    const parsed = validateConfigRequest(req.body);
    if (!parsed.ok) return badRequest(res, parsed);

    const result = await practiceConfigService.createConfig(req.user.id, parsed.value);
    if (!result.ok) return nameTaken(res);
    res.status(201).json(result.config);
});

// @desc    The saved words of a configuration that the user can still see (Review row shape, saved order)
// @route   GET /api/practice/configs/:id/words
// @access  Private
const getConfigWords = asyncHandler(async (req: any, res: any) => {
    if (!isUuid(req.params.id)) return notFound(res);
    const found = await practiceConfigService.getConfigWords(req.user.id, req.params.id);
    if (!found) return notFound(res);
    res.status(200).json(found.map(simplifyWord));
});

// @desc    Replace name, description, settings and words of a configuration
// @route   PUT /api/practice/configs/:id
// @access  Private
const updateConfig = asyncHandler(async (req: any, res: any) => {
    if (!isUuid(req.params.id)) return notFound(res);
    const parsed = validateConfigRequest(req.body);
    if (!parsed.ok) return badRequest(res, parsed);

    const result = await practiceConfigService.updateConfig(req.user.id, req.params.id, parsed.value);
    if (!result.ok) return result.reason === 'name_taken' ? nameTaken(res) : notFound(res);
    res.status(200).json(result.config);
});

// @desc    Delete a configuration
// @route   DELETE /api/practice/configs/:id
// @access  Private
const deleteConfig = asyncHandler(async (req: any, res: any) => {
    if (!isUuid(req.params.id)) return notFound(res);
    const deleted = await practiceConfigService.deleteConfig(req.user.id, req.params.id);
    if (!deleted) return notFound(res);
    res.status(204).send();
});

module.exports = {
    listConfigs,
    createConfig,
    getConfigWords,
    updateConfig,
    deleteConfig,
};
