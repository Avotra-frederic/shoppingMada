import crypto from "crypto"
const toBinary =(text: string) : string=>{
    return text.split("").map((char)=>char.charCodeAt(0).toString(2).padStart(8,"0")).join("");
}

const getPIPosition = (length: number) : string => {
    const PI = Math.PI.toString().replace(".","");
    return PI.slice(0,length);
}

const findBinaryInPI = (emailBinary: string): number => {
    const piDecimals = getPIPosition(100000);
    return piDecimals.indexOf(emailBinary);
}

const generateOTP = (position:number, timestamp: number): string=>{
    const input = position.toString() + timestamp.toString()
    const hash = crypto.createHash("sha256").update(input).digest("hex");
    const otp = parseInt(hash.slice(0,6), 16) % 1000000;
    return otp.toString().padStart(6,"0");
}

const getOTP =(email: string): string=>{
    const emailBinary = toBinary(email);
    const position = findBinaryInPI(emailBinary);
    const timestamp = Math.floor(Date.now() / 60000);
    return generateOTP(position,timestamp);
}

export {getOTP};
