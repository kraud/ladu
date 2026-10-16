/**
 * First-login onboarding routes (.context/plans/onboarding.md, Slice 3d; D18, D21, D25).
 * Only an account with `onboarding_status = 'pending'` may use them; demo accounts never.
 */

const asyncHandler = require('express-async-handler');
const { validateChoice, validateCreate, checkCount }: typeof import('../services/onboarding') = require('../services/onboarding');
const onboardingService: typeof import('../services/onboardingService') = require('../services/onboardingService');
const { assertNotDemo }: typeof import('../lib/demo') = require('../lib/demo');

const badRequest = (res: any, failure: { code: string; message: string }) =>
    res.status(400).json({ message: failure.message, code: failure.code });

const notPending = (res: any) =>
    res.status(409).json({ message: 'Onboarding is not open for this account', code: 'onboarding_not_pending' });

const accountOf = (user: any): import('../services/onboardingService').OnboardingAccount => ({
    id: user.id,
    languages: user.languages ?? [],
    nativeLanguage: user.nativeLanguage ?? null,
    uiLanguage: user.uiLanguage ?? null,
});

/** Demo accounts: 403 (throws). Not pending: 409. True when the request may go on. */
const mayOnboard = (req: any, res: any): boolean => {
    assertNotDemo(req.user, res);
    if (req.user.onboardingStatus !== 'pending') {
        notPending(res);
        return false;
    }
    return true;
};

// @desc    How many words the pool can deliver for these levels and topics (the slider maximum)
// @route   POST /api/onboarding/capacity
// @access  Private
const getCapacity = asyncHandler(async (req: any, res: any) => {
    if (!mayOnboard(req, res)) return;
    const account = accountOf(req.user);
    const parsed = validateChoice(req.body, account);
    if (!parsed.ok) return badRequest(res, parsed);
    res.status(200).json({ capacity: onboardingService.capacityFor(account, parsed.value) });
});

// @desc    Create the onboarding's words and tags, and close the onboarding
// @route   POST /api/onboarding
// @access  Private
const createOnboarding = asyncHandler(async (req: any, res: any) => {
    if (!mayOnboard(req, res)) return;
    const account = accountOf(req.user);
    const parsed = validateCreate(req.body, account);
    if (!parsed.ok) return badRequest(res, parsed);
    const fits = checkCount(parsed.value.count, onboardingService.capacityFor(account, parsed.value));
    if (!fits.ok) return badRequest(res, fits);

    const result = await onboardingService.createOnboarding(account, parsed.value);
    if (!result.ok) return notPending(res);
    res.status(201).json({ words: result.words, tags: result.tags });
});

// @desc    Close the onboarding without creating anything (the account starts empty, D6)
// @route   POST /api/onboarding/skip
// @access  Private
const skipOnboarding = asyncHandler(async (req: any, res: any) => {
    if (!mayOnboard(req, res)) return;
    if (!(await onboardingService.skipOnboarding(req.user.id))) return notPending(res);
    res.status(200).json({ onboardingStatus: 'skipped' });
});

module.exports = { getCapacity, createOnboarding, skipOnboarding };
