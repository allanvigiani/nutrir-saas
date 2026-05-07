---
name: security-check
description: Comprehensive security audit of the Nutrir SaaS project with scoring (0-100) across 5 categories - SECRETS, INPUTS, AUTH, DEPS, and HEADERS. Use this whenever you need to perform a security audit, check for vulnerabilities, assess security posture, or validate that the codebase meets security standards before deployment. Provides detailed findings, severity levels, and remediation steps.
compatibility:
  tools:
    - Bash
---

# Security Check Skill

Perform a comprehensive security audit of the Nutrir SaaS project and return a detailed security score (0-100) with breakdown by category and actionable remediation steps.

## What This Skill Does

Analyzes your codebase across 5 security dimensions:

- **SECRETS (20 pts)** — Credential leaks, exposed secrets, API keys
- **INPUTS (25 pts)** — Input validation, dangerous functions
- **AUTH (25 pts)** — Authentication, authorization, CSRF protection  
- **DEPS (15 pts)** — Dependency vulnerabilities
- **HEADERS (15 pts)** — Security headers (CORS, CSP, X-Frame-Options, etc.)

Returns a single numeric score (0-100) plus detailed findings grouped by severity.

## When to Use

Use this skill whenever you need to:
- Perform a security audit before deployment
- Check for vulnerabilities in the codebase
- Validate security posture against best practices
- Identify credential leaks or misconfigurations
- Assess dependency security
- Review security headers configuration

## How It Works

The skill:
1. Executes the verification script to scan the codebase
2. Analyzes patterns for common vulnerabilities
3. Checks configuration files and middleware
4. Runs `npm audit` for dependency vulnerabilities
5. Returns a score with category breakdown
6. Lists top issues by severity with remediation steps

## Expected Output

```
SECURITY AUDIT REPORT
Score: XX/100 (Grade: A-F)

📊 BREAKDOWN BY CATEGORY:

🔐 SECRETS: XX/20
  [findings with severity]

🔍 INPUTS: XX/25
  [findings with severity]

📝 AUTH: XX/25
  [findings with severity]

📦 DEPS: XX/15
  [findings with severity]

🔒 HEADERS: XX/15
  [findings with severity]

═══════════════════════════════════════════

TOP ISSUES (by priority):
1. [CRITICAL/HIGH/MEDIUM] Issue description
   → Remediation step
```

## Scoring Grades

- **90-100: A** ✅ Excellent - Production ready
- **80-89: B** ✅ Good - Minor issues  
- **70-79: C** ⚠️ Fair - Address medium issues
- **60-69: D** ⚠️ Poor - Address high priority issues
- **0-59: F** 🚨 Critical - Fix immediately before deployment

## Files Analyzed

- `.gitignore` — Secrets exclusion
- `.env.example` — Environment documentation
- `server.ts` — Server configuration, headers, middleware
- `src/server/` — API routes, authentication logic
- `src/pages/` — Frontend components (XSS risks)
- `firestore.rules` — Firestore security rules
- `package.json` & dependencies — Vulnerability scanning

## Limitations

- Excludes: `node_modules/`, `dist/`, `build/`, `.git/`, `.claude/`
- Pattern-based detection (may have false positives/negatives)
- Local analysis only (no data sent externally)
- Requires `npm audit` to be functional for dependency checks

## Next Steps After Running

1. Review findings by severity (CRITICAL → HIGH → MEDIUM)
2. Address top issues before deploying to production
3. For each finding, apply the suggested remediation
4. Re-run the skill to verify improvements
5. Document any intentional exceptions in code comments
