"use node";

import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-password-reset",
  apiKey: process.env.AUTH_RESEND_KEY,

  async generateVerificationToken() {
    // Generate 8-digit OTP
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const num = Array.from(array).reduce((acc, val) => acc * 256 + val, 0);
    return String(num % 100000000).padStart(8, "0");
  },

  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);

    const { error } = await resend.emails.send({
      from: "Rosetta <noreply@rosetta.app>",
      to: [email],
      subject: "Reset your Rosetta password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: 'ABeeZee', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f9f9f9;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 40px 20px;
                background-color: #ffffff;
              }
              .logo {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo h1 {
                color: #007E70;
                font-size: 28px;
                margin: 0;
              }
              h2 {
                color: #333;
                font-size: 24px;
                margin-bottom: 16px;
              }
              p {
                color: #666;
                margin-bottom: 16px;
              }
              .code { 
                font-size: 36px; 
                font-weight: bold; 
                letter-spacing: 6px;
                color: #007E70;
                padding: 24px;
                background: #f5f9f8;
                border-radius: 12px;
                text-align: center;
                margin: 24px 0;
                border: 2px dashed #007E70;
              }
              .warning {
                background: #fff8e6;
                border-left: 4px solid #f0ad4e;
                padding: 12px 16px;
                margin: 20px 0;
                border-radius: 0 8px 8px 0;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #999;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <h1>🌐 Rosetta</h1>
              </div>
              <h2>Reset your password</h2>
              <p>We received a request to reset your password. Enter this code to create a new password:</p>
              <div class="code">${token}</div>
              <p>This code expires in <strong>10 minutes</strong>.</p>
              <div class="warning">
                <strong>Didn't request this?</strong> If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </div>
              <div class="footer">
                <p>Rosetta - Real-time lecture translation for everyone</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send password reset email:", error);
      throw new Error("Could not send password reset email");
    }
  },
});
