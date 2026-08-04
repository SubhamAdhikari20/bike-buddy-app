import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const uploadRoot = path.resolve(process.cwd(), "uploads");

const bikeFiles = [
  "activa-6g-1.jpg",
  "activa-6g-2.jpg",
  "apache-160-1.jpg",
  "burgman-125-1.jpg",
  "classic-350-1.jpg",
  "classic-350-2.jpg",
  "classic-350-3.jpg",
  "crf250l-1.jpg",
  "crf250l-2.jpg",
  "discover-125-1.jpg",
  "duke-200-1.jpg",
  "duke-200-2.jpg",
  "duke-200-3.jpg",
  "fz-v3-1.jpg",
  "gixxer-155-1.jpg",
  "himalayan-411-1.jpg",
  "hunter-350-1.png",
  "jupiter-125-1.jpg",
  "niu-nqi-1.jpg",
  "nmax-155-1.jpg",
  "ola-s1-1.jpg",
  "ola-s1-2.jpg",
  "pleasure-plus-1.jpg",
  "pulsar-220f-1.jpg",
  "pulsar-220f-2.jpg",
  "pulsar-220f-3.jpg",
  "shine-125-1.jpg",
  "splendor-plus-1.jpg",
  "unicorn-160-1.jpg",
  "vespa-lx-1.jpg",
  "xpulse-200-1.jpg",
];

const profileKeys = [
  "admin",
  "ramesh",
  "sita",
  "bimal",
  "anjali",
  "aashish",
  "maya",
  "saroj",
  "nishant",
  "binita",
  "krish",
  "mohammad",
  "dipesh",
  "pratima",
  "sujan",
  "anita",
  "roshan",
];

const renterKeys = profileKeys.slice(5);
const evidenceFiles = [
  "demo-pre-ride-checklist.png",
  "demo-support-flat-tyre.png",
  "demo-support-chain.png",
  "demo-damage-left-panel.png",
  "demo-damage-mirror.png",
  "demo-damage-footpeg.png",
  "demo-damage-chain-guard.png",
  "demo-damage-seat.png",
];

const imageSignatureIsValid = (filename: string, bytes: Buffer) =>
  filename.endsWith(".png")
    ? bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

test("all versioned demo media exists and has a matching image signature", async () => {
  const files = [
    ...bikeFiles.map((name) => path.join(uploadRoot, "bike", "demo", name)),
    ...profileKeys.map((key) =>
      path.join(uploadRoot, "profile", `demo-${key}.png`),
    ),
    ...renterKeys.map((key) =>
      path.join(uploadRoot, "kyc", `demo-${key}-id.png`),
    ),
    ...evidenceFiles.map((name) => path.join(uploadRoot, "evidence", name)),
  ];

  for (const filename of files) {
    const bytes = await fs.readFile(filename);
    assert.ok(bytes.length > 1024, `${filename} is unexpectedly small`);
    assert.equal(
      imageSignatureIsValid(filename, bytes),
      true,
      `${filename} has an unexpected file signature`,
    );
  }
});
