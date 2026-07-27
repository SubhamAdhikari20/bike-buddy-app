import nodemailer from "nodemailer";
import type { ApiResponseType } from "../types/api-response.type.ts";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );

export const sendResetPasswordVerificationEmail = async (
  fullName: string,
  email: string,
  code: string,
): Promise<ApiResponseType> => {
  if (process.env.NODE_ENV === "test") {
    return {
      success: true,
      message: "Skipped sending email during test environment.",
    };
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return {
      success: false,
      message: "Email delivery is not configured.",
    };
  }

  const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Reset your Bike Buddy password</title>
        </head>
        <body style="font-family:Arial,sans-serif;line-height:1.6;color:#111928">
          <div style="max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#123DB8">Hello, ${escapeHtml(fullName)}</h2>
            <p>Enter this code in Bike Buddy to reset your password:</p>
            <p style="display:inline-block;padding:12px 24px;border-radius:8px;background:#EEF2FF;color:#123DB8;font-size:30px;font-weight:700;letter-spacing:8px">${code}</p>
            <p>The code expires in 15 minutes and can be used only once.</p>
            <p>If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `;

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
      subject: "Bike Buddy | Password reset code",
      html,
    });

    return {
      success: true,
      message: "Password reset email sent successfully.",
    };
  } catch (error) {
    console.error("Password reset email delivery failed", error);
    return {
      success: false,
      message: "Failed to send password reset email.",
    };
  }
};
