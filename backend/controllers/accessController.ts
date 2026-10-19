const asyncHandler = require("express-async-handler");
const { getAccessSettings }: typeof import("../lib/accessGate") = require("../lib/accessGate");
const { captchaKeys }: typeof import("../lib/captcha") = require("../lib/captcha");

/**
 * `GET /api/access` (public) — feeds the banners in the learner app. Only the mode and
 * the owner's extra line; never a list of invites or allowed accounts. The server
 * enforces the gates itself, so a banner is a courtesy. `demo.enabled` tells the
 * `/demo` page whether to show the start button; the caps stay private. `onboarding.enabled`
 * tells the app whether to open /onboarding for a `pending` account (onboarding.md D26).
 * `captcha` carries the public Turnstile site key, and only while the check is really on: the
 * switch is on AND both keys are set (captcha.md C3, C4). The secret key never leaves the server.
 */
const getAccess = asyncHandler(async (_req: any, res: any) => {
  const settings = await getAccessSettings();
  const keys = captchaKeys();
  // A change must show at once: no browser or proxy caching.
  res.set("Cache-Control", "no-store");
  res.json({
    registration: { mode: settings.registrationMode, note: settings.registrationNote },
    login: { mode: settings.loginMode, note: settings.loginNote },
    demo: { enabled: settings.demo.enabled },
    onboarding: { enabled: settings.onboarding.enabled },
    captcha: settings.captcha.enabled && keys ? { enabled: true, siteKey: keys.siteKey } : { enabled: false },
  });
});

export = { getAccess };
