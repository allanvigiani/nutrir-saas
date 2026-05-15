export interface PasswordChecks {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  checks: PasswordChecks;
}

export function getPasswordStrength(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^a-zA-Z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length as 0 | 1 | 2 | 3 | 4;

  return { score, checks };
}

export function isStrongPassword(password: string): boolean {
  return getPasswordStrength(password).score === 4;
}
