// backend/src/helpers/send-otp-email.ts
import nodemailer from "nodemailer";
import type { ApiResponseType } from "./../types/api-response.type.ts";

export const sendOtpEmail = async (
    fullName: string,
    email: string,
    otp: string
): Promise<ApiResponseType> => {
    if (process.env.NODE_ENV === "test") {
        return {
            success: true,
            message: "Skipped sending email during test environment.",
        };
    }

    const html = `
    <!DOCTYPE html>
    <html lang="en" dir="ltr">
      <head>
        <meta charset="UTF-8" />
        <title>Sign-in Code</title>
        <style>
          body {
            font-family: 'Roboto', Verdana, sans-serif;
            line-height: 1.6;
            color: #111928;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          h2 {
            color: #1A56DB;
          }
          .otp {
            font-size: 32px;
            letter-spacing: 8px;
            font-weight: bold;
            color: #1A56DB;
            background: #EBF5FF;
            padding: 12px 24px;
            border-radius: 8px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Hello, ${fullName}</h2>
          <p>Use this code to sign in to your Bike Buddy account:</p>
          <p class="otp">${otp}</p>
          <p>The code expires in 10 minutes. If you did not request it, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
  `;

    if (!email) {
        return { success: false, message: "Missing email address" };
    }

    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: `"Bike Buddy" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: "Bike Buddy | Your Sign-in Code",
            html,
        });

        return {
            success: true,
            message: "OTP email sent successfully.",
        };
    } catch (error) {
        console.log("Error sending OTP email: ", error);

        return {
            success: false,
            message: "Failed to send OTP email.",
        };
    }
};
