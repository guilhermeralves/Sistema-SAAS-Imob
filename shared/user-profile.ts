export const USER_PROFILE_MARITAL_STATUSES = [
  "solteiro",
  "casado",
  "uniao_estavel",
  "divorciado",
  "viuvo",
] as const;

export type UserProfileMaritalStatus =
  (typeof USER_PROFILE_MARITAL_STATUSES)[number];

export const CONTRACT_REQUIRED_USER_FIELDS = [
  "cpf",
  "phone",
  "birthDate",
  "profession",
  "grossMonthlyIncome",
  "maritalStatus",
  "householdIncome",
] as const;

export type ContractRequiredUserField =
  (typeof CONTRACT_REQUIRED_USER_FIELDS)[number];
