type RecordLike = Record<string, unknown> & {
  toObject?: () => Record<string, unknown>;
};

const toPlainObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as RecordLike;
  return record.toObject ? record.toObject() : { ...record };
};

const pick = (
  source: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
};

export const toSafeUser = (value: unknown): Record<string, unknown> => {
  const source = toPlainObject(value);
  return {
    id: String(source._id ?? source.id ?? ""),
    ...pick(source, ["email", "role", "isVerified", "createdAt", "updatedAt"]),
  };
};

export const toSafeProfile = (value: unknown): Record<string, unknown> => {
  const source = toPlainObject(value);
  return {
    id: String(source._id ?? source.id ?? ""),
    ...pick(source, [
      "fullName",
      "phoneNumber",
      "profilePictureUrl",
      "bio",
      "terms",
      "kycStatus",
      "kycSubmittedAt",
      "ownerStatus",
      "ownerVerificationDate",
      "createdAt",
      "updatedAt",
    ]),
  };
};
