import  fs  from 'fs';
import { createTransport } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import path from "path";
import Handlebars from "handlebars";

const transport = createTransport({
    service: process.env.EMAIL_HOST as string,
    auth:{
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }

} as SMTPTransport.Options)

const emailSender=  async (object: any)=>{
    try {
        await transport.sendMail(object)
    } catch (error) {
        throw error
    }
}

const sendEmail = async(data: any, to: string)=>{
    const htmlTemplate = fs.readFileSync(
      path.join(__dirname, "..", "..", "public", "template", "email.html"),
      "utf8",
    );
    const template = Handlebars.compile(htmlTemplate);
    const htmlContent = template(data);
    
      const mailOption = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: "Verification email",
        html: htmlContent,
        attachements: [
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

export default sendEmail;
