import { createTransport } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

const transport = createTransport({
    host: process.env.EMAIL_HOST as string,
    port: parseInt(process.env.EMAIL_PORT as string, 10),
    secure: false,
    auth:{
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD
    }

} as SMTPTransport.Options)

const emailSender=  async (object: any)=>{
    try {
        await transport.sendMail(object)
    } catch (error) {
        throw error
    }
}

export default emailSender;
