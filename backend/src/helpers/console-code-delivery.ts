// backend/src/helpers/console-code-delivery.ts
//
// Local demonstration fallback for one-time codes.
//
// Bike Buddy sends OTP and password-reset codes by email. A local marking or
// demonstration machine usually has no Gmail app password, which would leave
// the OTP and password-recovery journeys impossible to show. When SMTP is not
// configured and the server is not running in production, the code is written
// to the backend console instead, and the caller is told which channel was
// used so the interface can stay honest about it.
import { IS_PRODUCTION } from "../config/index.ts";
import type { ApiResponseType } from "../types/api-response.type.ts";

export const isEmailDeliveryConfigured = (): boolean =>
  Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

// Console delivery is only ever allowed outside production. In production a
// missing SMTP configuration stays a hard failure.
export const canUseConsoleDelivery = (): boolean =>
  !IS_PRODUCTION && !isEmailDeliveryConfigured();

export const deliverCodeToConsole = (
  purpose: string,
  fullName: string,
  email: string,
  code: string,
  expiresInMinutes: number,
): ApiResponseType => {
  console.log(
    [
      "",
      "──────────────────────────────────────────────────────────────",
      ` BIKE BUDDY ${purpose.toUpperCase()} (local demo delivery)`,
      "──────────────────────────────────────────────────────────────",
      ` Name    : ${fullName}`,
      ` Email   : ${email}`,
      ` Code    : ${code}`,
      ` Expires : ${expiresInMinutes} minutes`,
      "",
      " Email is not configured, so the code is shown here instead.",
      " Set GMAIL_USER and GMAIL_APP_PASSWORD to send real emails.",
      "──────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );

  return {
    success: true,
    message: `${purpose} code written to the server console because email delivery is not configured.`,
  };
};
