// "Someone asked for access" — sent to the Ladu team (ACCESS_REQUEST_EMAIL) when a visitor
// uses the /request page (.context/plans/access-requests.md). Staff mail: English only,
// plain layout, no logo. The email comes from a visitor, so it is always escaped.
"use strict";

const { escapeHtml } = require("./escapeHtml");

const KIND_TEXT = {
  registration: { wants: "wants to register", tab: "Registration", list: "invite list" },
  login: { wants: "wants to sign in (has an account)", tab: "Login", list: "allowed accounts" },
};

const textFor = (kind) => KIND_TEXT[kind] || KIND_TEXT.registration;

const subjectFor = (kind) => `Access request: ${textFor(kind).wants.replace(" (has an account)", "")}`;

/** `email` here is the address of the person who asked, not the address that gets this mail. */
function getHtmlComponent({ requestEmail, kind }) {
  const t = textFor(kind);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Access request — Ladu</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #1a1c20;">
  <p><b>${escapeHtml(requestEmail)}</b> ${t.wants}.</p>
  <p>To answer: open the admin panel, go to Access, then the ${t.tab} tab. The request is in the requests table, under the ${t.list}.</p>
  <p style="font-size: 13px; color: #666b73;">Sent by Ladu. Replies to this address are not monitored.</p>
</body>
</html>
`;
}

function getTextComponent({ requestEmail, kind }) {
  const t = textFor(kind);
  return [
    `${requestEmail} ${t.wants}.`,
    "",
    `To answer: open the admin panel, go to Access, then the ${t.tab} tab. The request is in the requests table, under the ${t.list}.`,
  ].join("\n");
}

module.exports = { getHtmlComponent, getTextComponent, subjectFor };
