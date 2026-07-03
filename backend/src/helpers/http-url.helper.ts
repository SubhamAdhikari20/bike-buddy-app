// backend/src/helpers/http-url.helper.ts


export const normalizeRemoveHttpUrl = (url?: string | null) => {
    if (!url) {
        return null;
    }

    const input = url.trim();

    if (!(/^https?:\/\//i.test(input))) {
        return input;
    }

    // Parse absolute URLs and always keep only path/query/hash,
    // so device-specific hosts do not affect file deletion paths.
    try {
        const parsed = new URL(input);
        let cleanUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`;

        if (!cleanUrl.startsWith("/")) {
            cleanUrl = `/${cleanUrl}`;
        }

        cleanUrl = cleanUrl.replace(/\/{2,}/g, "/");
        return cleanUrl.replace(/\/$/, "");
    }
    catch {
        // Fallback for malformed absolute URLs.
        let cleanUrl = input.replace(/^https?:\/\/[^/]+/i, "");

        if (!cleanUrl.startsWith("/")) {
            cleanUrl = `/${cleanUrl}`;
        }

        cleanUrl = cleanUrl.replace(/\/{2,}/g, "/");
        return cleanUrl.replace(/\/$/, "");
    }
};