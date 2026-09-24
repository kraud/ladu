const nodemailer = require("nodemailer")
const resetPassword = require("./resources/resetPassword")
const verifyEmail = require("./resources/verifyEmail");
const { stringsFor } = require("./resources/emailStrings");

// `emailData.type` selects both the template and its localized subject
// (previously a hardcoded English literal at each controller call site).
// `emailData.language` is one of the SUPPORTED_LANGUAGES labels
// (userController.ts) or undefined/unrecognized — stringsFor() falls back to
// English in either case, so a send never fails over a bad language value.
function getEmailContent(emailData) {
    const s = stringsFor(emailData.language);
    switch (emailData.type){
        case "resetPassword":
            return {
                subject: s.subjectReset,
                html: resetPassword.getHtmlComponent(emailData),
                text: resetPassword.getTextComponent(emailData),
                attachments: resetPassword.getAttachments()
            }
        case "verifyEmail":
            return {
                subject: s.subjectVerify,
                html: verifyEmail.getHtmlComponent(emailData),
                text: verifyEmail.getTextComponent(emailData),
                attachments: verifyEmail.getAttachments()
            }
    }
}

module.exports = async(emailData) => {
    const transporter =  nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        // Nodemailer's defaults (2 min connect, 30s greeting, 10 min socket)
        // are sized for a real mail provider having a bad day, not for a
        // send that's already fire-and-forget from the caller's point of
        // view (userController.ts). The caps bound how long a hung attempt
        // keeps its socket and timers alive.
        //
        // Trade-off: a provider slower than 5s in any one phase makes the
        // send fail, and the failure is only logged below — not retried.
        // Resend is normally far under that.
        //
        // This was once thought to fix a CI e2e flake (an unreachable
        // EMAIL_HOST stalling the process). It did not: that flake was CI
        // missing GOOGLE_CLIENT_ID/SECRET (see e2e/playwright.config.ts). The
        // refusals in CI are instant, so the caps are not needed for it.
        connectionTimeout: 5_000,
        greetingTimeout: 5_000,
        socketTimeout: 5_000,
    })
    const mailData = {
        // EMAIL_USER is the SMTP auth username ("resend" for Resend's SMTP
        // relay, not an email address) — the From header needs a real
        // address on the verified sending domain instead.
        from: process.env.EMAIL_FROM,
        to: emailData.email,
        ...getEmailContent(emailData),
    }

    async function generateHtmlAndSend(emailData) {
        await transporter.sendMail(mailData)
            .then(info => {
                // console.log("info", info)
            })
            .catch(err => {
                console.log("error", err)
            })
    }
    await generateHtmlAndSend(emailData);
}
