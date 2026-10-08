import  fs  from 'fs';
import { createTransport, Transporter } from "nodemailer";
import path from "path";
import Handlebars from "handlebars";

let transport: Transporter | undefined;

const getTransport = (): Transporter => {
  if (transport) return transport;

  const user = process.env.EMAIL_USER?.trim();
  const password = process.env.EMAIL_PASSWORD?.replace(/\s+/g, "");
  if (!user || !password) {
    throw new Error("Email transport is not configured: set EMAIL_USER and EMAIL_PASSWORD.");
  }

  const legacyHost = process.env.EMAIL_HOST?.trim();
  const host = process.env.SMTP_HOST?.trim() ||
    (legacyHost?.includes(".") ? legacyHost : "smtp.gmail.com");
  const port = Number(process.env.SMTP_PORT || 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Email transport is not configured: SMTP_PORT must be a valid port.");
  }

  transport = createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user, pass: password },
  });
  return transport;
};

const emailSender=  async (object: any)=>{
    try {
        await getTransport().sendMail(object)
    } catch (error) {
        throw error
    }
}

const sendEmail = async(data: any, to: string,subject:string)=>{
    const htmlTemplate = fs.readFileSync(
      path.join(__dirname, "..", "..", "public", "template", "email.html"),
      "utf8",
    );
    const template = Handlebars.compile(htmlTemplate);
    const htmlContent = template(data);
    
      const mailOption = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        html: htmlContent,
        attachments: [
          {
            filename: "background.png",
            path: path.join(
              __dirname,
              "..",
              "..",
              "public",
              "mail",
              "background.png",
            ),
            cid: "background",
          },
          {
            filename: "animated_header.gif",
            path: path.join(
              __dirname,
              "..",
              "..",
              "public",
              "mail",
              "animated_header.gif",
            ),
            cid: "animated",
          },
          {
            filename: "logo.png",
            path: path.join(__dirname, "..", "..", "public", "mail", "logo.png"),
            cid: "logo",
          },
          {
            filename: "Beefree-logo.png",
            path: path.join(
              __dirname,
              "..",
              "..",
              "public",
              "mail",
              "Beefree-logo.png",
            ),
            cid: "Beefree",
          },
        ],
      };
  
      await emailSender(mailOption);
  }

export const sendContactEmail = async (
  name: string,
  email: string,
  subject: string,
  message: string,
) => {
  const recipient = process.env.CONTACT_EMAIL?.trim() || process.env.EMAIL_USER?.trim();
  if (!recipient) throw new Error("Contact email recipient is not configured.");

  const escapedName = Handlebars.escapeExpression(name);
  const escapedEmail = Handlebars.escapeExpression(email);
  const escapedSubject = Handlebars.escapeExpression(subject);
  const escapedMessage = Handlebars.escapeExpression(message).replace(/\r?\n/g, "<br>");
  await emailSender({
    from: process.env.EMAIL_USER,
    to: recipient,
    replyTo: email,
    subject: `ShopInMada · ${subject}`,
    text: `De: ${name} <${email}>\nSujet: ${subject}\n\n${message}`,
    html: `<h2>${escapedSubject}</h2><p><strong>De :</strong> ${escapedName} &lt;${escapedEmail}&gt;</p><p>${escapedMessage}</p>`,
  });
};

export const sendSupportReply = async (name: string, email: string, subject: string, message: string) => {
  const escapedName = Handlebars.escapeExpression(name);
  const escapedMessage = Handlebars.escapeExpression(message).replace(/\r?\n/g, "<br>");
  await emailSender({
    from: process.env.EMAIL_USER,
    to: email,
    replyTo: process.env.CONTACT_EMAIL?.trim() || process.env.EMAIL_USER?.trim(),
    subject: `Re: ${subject.slice(0, 160)}`,
    text: `Bonjour ${name},\n\n${message}\n\n— Support ShopInMada`,
    html: `<p>Bonjour ${escapedName},</p><p>${escapedMessage}</p><p>— Support ShopInMada</p>`,
  });
};

export default sendEmail;
