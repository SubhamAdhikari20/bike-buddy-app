import { isIP } from "node:net";
import { networkInterfaces } from "node:os";

type NetworkAddress = {
  address: string;
  family: string | number;
  internal: boolean;
};

type NetworkInterfaceMap = Record<
  string,
  readonly NetworkAddress[] | undefined
>;

const hostnamePattern =
  /^(?=.{1,253}$)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i;

export const parseListenHost = (value: string | undefined): string => {
  const host = value?.trim() || "0.0.0.0";
  if (isIP(host) !== 0 || hostnamePattern.test(host)) return host;

  throw new Error(
    "HOST must be a hostname or IP address without a protocol, port or path",
  );
};

const isLanIpv4 = (address: string): boolean => {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  const [first = -1, second = -1] = octets;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

const lanAddresses = (interfaces: NetworkInterfaceMap): string[] => {
  const addresses = new Set<string>();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (
        !entry.internal &&
        (entry.family === "IPv4" || entry.family === 4) &&
        isLanIpv4(entry.address)
      ) {
        addresses.add(entry.address);
      }
    }
  }
  return [...addresses].sort();
};

const isWildcardHost = (host: string): boolean =>
  host === "0.0.0.0" || host === "::";

const isLoopbackHost = (host: string): boolean =>
  host === "localhost" || host === "127.0.0.1" || host === "::1";

const urlHost = (host: string): string =>
  isIP(host) === 6 ? `[${host}]` : host;

/** Builds copy-ready, credential-free URLs for mobile development. */
export const createServerAccessGuidance = (
  host: string,
  port: number,
  interfaces?: NetworkInterfaceMap,
): string[] => {
  const messages = [`Bike Buddy backend listening on ${urlHost(host)}:${port}`];
  const wildcard = isWildcardHost(host);

  if (wildcard || isLoopbackHost(host)) {
    messages.push(`Local: http://localhost:${port}`);
    messages.push(
      `Android emulator: --dart-define=API_BASE_URL=http://10.0.2.2:${port}`,
    );
  } else {
    messages.push(`Configured host: http://${urlHost(host)}:${port}`);
  }

  if (wildcard) {
    let availableInterfaces = interfaces;
    if (!availableInterfaces) {
      try {
        availableInterfaces = networkInterfaces();
      } catch {
        // Diagnostics must never stop an otherwise healthy API process.
        availableInterfaces = {};
      }
    }
    const detectedAddresses = lanAddresses(availableInterfaces);
    if (detectedAddresses.length === 0) {
      messages.push(
        "Physical device: no private LAN address detected; connect this computer to Wi-Fi or use adb reverse.",
      );
    } else {
      for (const address of detectedAddresses) {
        messages.push(
          `Physical device: --dart-define=API_BASE_URL=http://${address}:${port}`,
        );
      }
    }
  } else if (isLoopbackHost(host)) {
    messages.push(
      "Physical device: this HOST is loopback-only; set HOST=0.0.0.0 or use adb reverse.",
    );
  }

  const healthHost = wildcard ? "localhost" : urlHost(host);
  messages.push(`Health check: http://${healthHost}:${port}/health`);
  return messages;
};
