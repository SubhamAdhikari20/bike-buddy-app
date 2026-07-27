type PopulatedReference = {
  _id?: unknown;
  id?: unknown;
  toHexString?: () => string;
};

/**
 * Normalises either a Mongo ObjectId, a string ID, or a populated Mongoose
 * document to the referenced document ID.
 */
export const toDocumentId = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    const reference = value as PopulatedReference;
    const nestedId = reference._id ?? reference.id;
    if (nestedId !== undefined && nestedId !== value) {
      return toDocumentId(nestedId);
    }
    if (typeof reference.toHexString === "function") {
      return reference.toHexString();
    }
  }

  const stringValue = String(value);
  return stringValue === "[object Object]" ? null : stringValue;
};

export const referencesDocument = (
  value: unknown,
  expectedId: string | undefined,
): boolean => Boolean(expectedId && toDocumentId(value) === expectedId);
