const path = require('path');

const getHtmlComponent = (name, url, email) =>
{
    return `<div>
        <img src="cid:logo" alt="Logo" style="max-width: 180px;"/>
        <h1>Hello ${name}</h1>
        <p>Once you have confirmed that ${email} is your email address, you will be able to use our platform.</p>
        <p>Click on the following link to verify your email: <a href="${url}"> here!</a></p>
        <p>Thank you!</p>
    </div>`;
};

const getAttachments = () => {
    return [
        {
            filename: 'logo.png',
            path: path.join(__dirname) + '/images/logo.png',
            cid: 'logo',
        }
    ]
}

module.exports = {
    getHtmlComponent,
    getAttachments
}

