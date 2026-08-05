// Loaded via `tsx --import` before any test file, and therefore before
// src/config runs dotenv. dotenv never overwrites an already-set variable, so
// these values win over whatever a developer happens to have in .env.
//
// Without this, switching .env to PAYMENT_MODE=sandbox for a device demo would
// fail the demo-confirmation tests: the suite must describe its own world.
const testDefaults: Record<string, string> = {
  NODE_ENV: "test",
  PAYMENT_MODE: "demo",
  PAYMENT_PUBLIC_BASE_URL: "https://demo.example",
  PAYMENT_WEBSITE_URL: "https://demo.example",
  PAYMENT_ALLOW_LOCAL_CALLBACK: "false",
  KHALTI_SANDBOX_SECRET_KEY: "test-khalti-secret",
  ESEWA_SANDBOX_SECRET_KEY: "test-esewa-secret",
  PAYMENT_CHECKOUT_SIGNING_SECRET: "test-checkout-signing-secret-0123456789",
};

for (const [key, value] of Object.entries(testDefaults)) {
  process.env[key] = value;
}
