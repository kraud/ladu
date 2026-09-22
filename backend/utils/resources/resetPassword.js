// Password-reset email — table-based HTML ported from
// `MOCKUPS/emails/password-reset.html`. Localized via `emailStrings` (the
// account's stored `uiLanguage`). Reset links really do expire 30 minutes
// after issue and are single-use (`userController.ts`), so the expiry
// sentence here is accurate.
"use strict";

const path = require("path");
const { stringsFor } = require("./emailStrings");
const { escapeHtml } = require("./escapeHtml");

function getHtmlComponent({ name, url, email, language }) {
  const s = stringsFor(language);
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeUrl = escapeHtml(url);

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${s.titleReset} — Ladu</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f8fa; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">

  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${s.preheaderReset}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f8fa" style="background-color: #f7f8fa;">
    <tr>
      <td align="center" style="padding: 40px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 100%; background-color: #ffffff; border: 1px solid #e3e5ea; border-radius: 12px;">
          <tr>
            <td style="padding: 36px 40px 0 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 6px;">
                    <img src="cid:logo" alt="Ladu" width="60" height="56" style="display: block; width: 60px; height: 56px; border: 0;" />
                  </td>
                </tr>
                <tr>
                  <td style="font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #666b73; padding-bottom: 24px;">
                    ${s.eyebrowReset}
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0 0 14px 0; font-family: 'Iowan Old Style', Charter, Georgia, 'Times New Roman', serif; font-size: 27px; line-height: 1.25; font-weight: 600; color: #1a1c20;">
                ${s.titleReset}
              </h1>
              <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 1.6; color: #1a1c20;">
                ${s.greeting(safeName)}
              </p>
              <p style="margin: 0 0 28px 0; font-size: 16px; line-height: 1.6; color: #1a1c20;">
                ${s.bodyReset(`<span style="white-space: nowrap; font-weight: 600;">${safeEmail}</span>`)}
              </p>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding: 0 40px 28px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#007AFF" style="background-color: #007AFF; border-radius: 12px; mso-padding-alt: 14px 28px;">
                    <a href="${safeUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 20px; color: #ffffff; text-decoration: none; border-radius: 12px;">
                      ${s.ctaReset}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 12px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
              <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.55; color: #666b73;">
                ${s.fallbackLead}
              </p>
              <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.6; word-break: break-all;">
                <a href="${safeUrl}" style="font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; color: #0062cc; text-decoration: underline;">${safeUrl}</a>
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 1.55; color: #a35a0a;">
                ${s.expiryReset}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f7fa" style="background-color: #f4f7fa; border-radius: 8px;">
                <tr>
                  <td style="padding: 12px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.55; color: #1a1c20;">
                    ${s.ignoreReset}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 40px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #e3e5ea;">
                <tr>
                  <td style="padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #666b73;">
                    <span style="font-family: 'Iowan Old Style', Charter, Georgia, 'Times New Roman', serif; font-size: 13px; font-weight: 600; color: #1a1c20;">Ladu</span>
                    &nbsp;&middot;&nbsp;${s.footerTagline}<br />
                    ${s.footerNote}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function getTextComponent({ name, url, email, language }) {
  const s = stringsFor(language);
  return [
    s.titleReset,
    "",
    s.greeting(name),
    "",
    s.bodyReset(email),
    "",
    `${s.ctaReset}: ${url}`,
    "",
    s.expiryReset,
    "",
    s.ignoreReset,
  ].join("\n");
}

function getAttachments() {
  return [
    {
      filename: "ladu-mark.png",
      path: path.join(__dirname, "images", "ladu-mark.png"),
      cid: "logo",
    },
  ];
}

module.exports = { getHtmlComponent, getTextComponent, getAttachments };
