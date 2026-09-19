const nodemailer = require("nodemailer")
const resetPassword = require("./resources/resetPassword")
const verifyEmail = require("./resources/verifyEmail");


function getHTMLAndAttachedData(emailData) {
    switch (emailData.type){
        case "resetPassword":
            return {
                html: resetPassword.getHtmlComponent(emailData.name, emailData.url),
                attachments: resetPassword.getAttachments()
            }
        case "verifyEmail":
            return {
                html: verifyEmail.getHtmlComponent(emailData.name, emailData.url, emailData.email),
                attachments: verifyEmail.getAttachments()
            }
    }
}

module.exports = async(emailData) => {
    const transporter =  nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        service: process.env.EMAIL_SERVICE,
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
        subject: emailData.subject,
        ...getHTMLAndAttachedData(emailData),
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