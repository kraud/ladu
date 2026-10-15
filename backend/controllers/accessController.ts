const asyncHandler = require("express-async-handler");
const { getAccessSettings }: typeof import("../lib/accessGate") = require("../lib/accessGate");

/**
 * `GET /api/access` (public) — feeds the banners in the learner app. Only the mode and
 * the owner's extra line; never a list of invites or allowed accounts. The server
 * enforces the gates itself, so a banner is a courtesy. `demo.enabled` tells the
 * `/demo` page whether to show the start button; the caps stay private.
 */
const getAccess = asyncHandler(async (_req: any, res: any) => {
  const settings = await getAccessSettings();
  // A change must show at once: no browser or proxy caching.
  res.set("Cache-Control", "no-store");
  res.json({
    registration: { mode: settings.registrationMode, note: settings.registrationNote },
    login: { mode: settings.loginMode, note: settings.loginNote },
    demo: { enabled: settings.demo.enabled },
  });
});

export = { getAccess };
