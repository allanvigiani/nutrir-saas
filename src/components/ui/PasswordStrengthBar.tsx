import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getPasswordStrength } from '@/lib/passwordStrength';

interface PasswordStrengthBarProps {
  password: string;
}

export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  if (!password) return null;

  const { checks } = getPasswordStrength(password);

  const items = [
    { key: 'minLength', label: '8 ou mais caracteres', ok: checks.minLength },
    { key: 'hasLetter', label: 'Pelo menos uma letra', ok: checks.hasLetter },
    { key: 'hasNumber', label: 'Pelo menos um número', ok: checks.hasNumber },
    { key: 'hasSymbol', label: 'Pelo menos um símbolo (!@#$...)', ok: checks.hasSymbol },
  ];

  return (
    <div className="mt-2 space-y-1.5">
      {items.map(({ key, label, ok }) => (
        <div key={key} className="flex items-center gap-2">
          {ok ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 transition-colors duration-200" />
          ) : (
            <XCircle className="w-4 h-4 text-muted-foreground shrink-0 transition-colors duration-200" />
          )}
          <span className={`text-xs transition-colors duration-200 ${ok ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
