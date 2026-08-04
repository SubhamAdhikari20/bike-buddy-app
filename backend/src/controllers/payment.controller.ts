import type { RequestHandler } from "express";
import crypto from "node:crypto";
import ApiResponse from "../utils/ApiResponse.ts";
import paymentService from "../services/payment.service.ts";
import AppError from "../errors/AppError.ts";
import {
  renderEsewaCheckoutHtml,
  renderPaymentResultHtml,
  type PaymentResultView,
} from "../utils/payment-checkout.ts";
import { ESEWA_SANDBOX_FORM } from "../services/payment-gateway.service.ts";

const secureHtml = (
  res: Parameters<RequestHandler>[1],
  nonce: string,
  formAction?: string,
) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, noarchive");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      "style-src 'none'",
      `form-action ${formAction ?? "'none'"}`,
      "frame-ancestors 'none'",
      "base-uri 'none'",
    ].join("; "),
  );
  res.type("html");
};

const viewFromStatus = (status: any): PaymentResultView => {
  const titles = {
    succeeded: "Test payment verified",
    pending: "Verification is still pending",
    failed: "Test payment not completed",
    refunded: "Test payment refunded",
  } as const;
  const safeStatus: PaymentResultView["status"] = [
    "succeeded",
    "failed",
    "refunded",
  ].includes(status.status)
    ? (status.status as PaymentResultView["status"])
    : "pending";
  return {
    paymentId: status.paymentId,
    status: safeStatus,
    title: titles[safeStatus],
    message: status.message,
  };
};

const renderCallback = async (
  res: Parameters<RequestHandler>[1],
  callback: () => Promise<unknown>,
) => {
  const nonce = crypto.randomBytes(18).toString("base64url");
  secureHtml(res, nonce);
  try {
    const result = await callback();
    res
      .status(200)
      .send(renderPaymentResultHtml(viewFromStatus(result), nonce));
  } catch (error) {
    const known = error instanceof AppError;
    res.status(200).send(
      renderPaymentResultHtml(
        {
          paymentId: null,
          status: "pending",
          title: "Payment not yet verified",
          message: known
            ? "Bike Buddy could not securely verify this provider return. No service was granted from the redirect."
            : "Payment verification is temporarily unavailable. No service was granted from the redirect.",
        },
        nonce,
      ),
    );
  }
};

export const initiatePayment: RequestHandler = async (req, res, next) => {
  try {
    const result = await paymentService.initiatePayment(req.auth!, req.body);
    res
      .status(201)
      .json(new ApiResponse(201, "Payment session created", result));
  } catch (error) {
    next(error);
  }
};

export const confirmDemoPayment: RequestHandler = async (req, res, next) => {
  try {
    const paymentId = String(req.params.paymentId);
    const result = await paymentService.confirmDemoPayment(
      req.auth!,
      paymentId,
      req.body,
    );
    res.status(200).json(new ApiResponse(200, result.message, result));
  } catch (error) {
    next(error);
  }
};

export const getPayment: RequestHandler = async (req, res, next) => {
  try {
    const paymentId = String(req.params.paymentId);
    const result = await paymentService.getPayment(req.auth!, paymentId);
    res
      .status(200)
      .json(new ApiResponse(200, "Payment fetched successfully", result));
  } catch (error) {
    next(error);
  }
};

export const getPaymentStatus: RequestHandler = async (req, res, next) => {
  try {
    const paymentId = String(req.params.paymentId);
    const result = await paymentService.getPaymentStatus(req.auth!, paymentId);
    res
      .status(200)
      .json(new ApiResponse(200, "Payment status fetched", result));
  } catch (error) {
    next(error);
  }
};

export const openEsewaCheckout: RequestHandler = async (req, res) => {
  const nonce = crypto.randomBytes(18).toString("base64url");
  secureHtml(res, nonce, ESEWA_SANDBOX_FORM);
  try {
    const token =
      typeof req.query.token === "string" ? req.query.token : "";
    const fields = await paymentService.getEsewaCheckout(
      String(req.params.paymentId),
      token,
    );
    res.status(200).send(renderEsewaCheckoutHtml(fields, nonce));
  } catch (error) {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    res.status(statusCode).send(
      renderPaymentResultHtml(
        {
          paymentId: null,
          status: "pending",
          title: "Checkout link unavailable",
          message:
            "This checkout link is invalid, expired, or already used. Return to Bike Buddy and start the test checkout again.",
        },
        nonce,
      ),
    );
  }
};

export const khaltiCallback: RequestHandler = async (req, res) =>
  renderCallback(res, () =>
    paymentService.handleKhaltiCallback(
      req.query as Record<string, unknown>,
    ),
  );

export const esewaCallback: RequestHandler = async (req, res) =>
  renderCallback(res, () =>
    paymentService.handleEsewaCallback({
      ...(req.query as Record<string, unknown>),
      paymentRef: String(req.params.paymentRef),
    }),
  );

export const esewaFailureCallback: RequestHandler = async (req, res) =>
  renderCallback(res, () =>
    paymentService.handleEsewaFailureCallback(
      {
        ...(req.query as Record<string, unknown>),
        paymentRef: String(req.params.paymentRef),
      },
    ),
  );

export const updatePaymentStatus: RequestHandler = async (req, res, next) => {
  try {
    const paymentId = String(req.params.paymentId);
    const result = await paymentService.updatePaymentStatus(
      req.auth!,
      paymentId,
      req.body,
    );
    res.status(200).json(new ApiResponse(200, "Payment state updated", result));
  } catch (error) {
    next(error);
  }
};
