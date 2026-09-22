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
        }

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
