// Dev-mode OTP delivery: logs to console instead of sending real SMS/email.
// Swap sendOTP's body for a real provider (Twilio, MSG91, nodemailer, etc.) in production.

export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function otpExpiryDate(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function sendOTP(destination, otp) {
  console.log(`[OTP] Sending ${otp} to ${destination}`);
}
