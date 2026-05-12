# Security Check Skill - Execution Instructions

You are executing the `/security-check` skill for the Nutrir SaaS project.

## Your Task

Perform a comprehensive security audit of the Node.js/React/Express project and display detailed findings with actionable remediation steps.

## How to Execute

Run the detailed audit script to analyze the codebase:

```bash
node .claude/skills/security-check/scripts/audit-detailed.js
```

This script will:
1. Scan for credential leaks and secrets in code
2. Check for dangerous functions (eval, innerHTML, dangerouslySetInnerHTML)
3. Verify authentication middleware and password hashing
4. Audit Firestore security rules and CSRF protection
5. Run npm audit for dependency vulnerabilities
6. Check for security headers (CORS, CSP, X-Frame-Options, etc.)
7. Return a score from 0-100 with category breakdown
8. List top issues sorted by severity with fixes

## Output Format

The script outputs a formatted security report with:
- **Score**: 0-100 with grade (A-F)
- **Category Breakdown**: Points earned per security category (SECRETS, INPUTS, AUTH, DEPS, HEADERS)
- **Detailed Findings**: Each issue with severity level, points lost, and recommended fixes
- **Top Issues**: List of critical/high/medium issues sorted by priority
- **Recommendations**: Overall assessment and next steps

## Scoring

Each category is scored:
- **SECRETS** (20 pts): Credential leaks, exposed secrets, API keys
- **INPUTS** (25 pts): Input validation, dangerous functions (eval, innerHTML)
- **AUTH** (25 pts): Authentication middleware, password hashing, Firebase rules, CSRF
- **DEPS** (15 pts): Dependency vulnerabilities from npm audit
- **HEADERS** (15 pts): Security headers (CORS, CSP, X-Frame-Options, HSTS)

**Grades:**
- 90-100: A ✅ Excellent
- 80-89: B ✅ Good
- 70-79: C ⚠️ Fair
- 60-69: D ⚠️ Poor
- 0-59: F 🚨 Critical

## What to Do With Results

After displaying the audit report:
1. Highlight the **top 3 critical/high issues**
2. For each issue, explain **why it matters** from a security perspective
3. Provide **specific steps** to fix (file paths, code examples if needed)
4. Suggest **next steps** (urgent fixes, medium-term improvements)
5. Encourage re-running the skill after making fixes to track progress
