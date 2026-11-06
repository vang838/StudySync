export type PasswordRule = {
  label: string;
  valid: boolean;
};

export function getPasswordRules(password: string): PasswordRule[] {
  return [
    {label: "At least 8 characters", valid: password.length >= 8},
    {label: "At least one uppercase letter", valid: /[A-Z]/.test(password)},
    {label: "At least one special character", valid: /[^A-Za-z0-9]/.test(password)},
  ];
}

export function isStrongPassword(password: string): boolean {
  return getPasswordRules(password).every((rule) => rule.valid);
}
