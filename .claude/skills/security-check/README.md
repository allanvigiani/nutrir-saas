# Security Check Skill

Automated security audit skill for the Nutrir SaaS project with real-time scanning and scoring.

## 🎯 Overview

This skill performs a comprehensive security audit and returns a score from 0-100 points with detailed breakdowns across 5 categories:

- **SECRETS** (20 pts) - Credential leaks and exposed secrets
- **INPUTS** (25 pts) - Input validation and dangerous functions
- **AUTH** (25 pts) - Authentication and authorization
- **DEPS** (15 pts) - Dependency vulnerabilities
- **HEADERS** (15 pts) - Security headers

## 📋 Installation

The skill is already installed in `.claude/skills/security-check/`. No additional setup required.

## 🚀 Usage

### Run full security audit with details

```bash
/security-check
```

This will:
1. Execute real security checks across the codebase
2. Identify vulnerabilities and misconfigurations
3. Return a detailed report with findings grouped by severity
4. Suggest remediation steps

### Run verbose mode

```bash
/security-check --verbose
```

Provides additional implementation details and code examples.

## 📊 Scoring Breakdown

### SECRETS (20 pts)
- ✓ .env in .gitignore (5 pts)
- ✓ No hardcoded API keys (5 pts)
- ✓ .env.example exists (5 pts)
- ✓ No Firebase/Gemini tokens exposed (5 pts)

### INPUTS (25 pts)
- ✓ No eval() or innerHTML misuse (10 pts)
- ✓ API routes validate inputs (8 pts)
- ✓ No SQL injection vulnerabilities (7 pts)

### AUTH (25 pts)
- ✓ Critical routes protected (8 pts)
- ✓ Passwords properly hashed (6 pts)
- ✓ Firebase rules properly restricted (6 pts)
- ✓ CSRF protection implemented (5 pts)

### DEPS (15 pts)
- ✓ npm audit shows no critical vulnerabilities (10 pts)
  - Critical: -5 pts each
  - High: -3 pts each
  - Medium: -1 pt each
- ✓ Major dependencies up-to-date (5 pts)

### HEADERS (15 pts)
- ✓ CORS properly configured (4 pts)
- ✓ CSP header set (3 pts)
- ✓ X-Frame-Options set (3 pts)
- ✓ X-Content-Type-Options set (3 pts)
- ✓ HSTS and XSS protection (2 pts)

## 📈 Score Grades

- **90-100: A** ✅ Excellent - Production ready
- **80-89: B** ✅ Good - Minor issues
- **70-79: C** ⚠️ Fair - Should address medium issues
- **60-69: D** ⚠️ Poor - Address high priority issues
- **0-59: F** 🚨 Critical - Fix immediately before deployment

## 🔍 Verify Command

The skill also provides a verify command that outputs only the numeric score:

```bash
node .claude/skills/security-check/scripts/check.js
```

Returns: `58` (example score)

This is useful for automated checks and CI/CD integration.

## 📁 File Structure

```
.claude/skills/security-check/
├── skill.yaml          # Skill configuration
├── prompt.md           # Detailed instructions
├── index.md            # Execution guide
├── README.md           # This file
└── scripts/
    └── check.js        # Verify script (returns numeric score)
```

## 🛠️ Implementation

The skill uses real verification methods:

- **Bash** for grep/find operations and npm audit
- **Regex patterns** for secret and vulnerability detection
- **File reading** for configuration and rules checking
- **Process execution** for npm audit analysis

## 📝 Example Output

```
╔════════════════════════════════════════╗
║      SECURITY AUDIT REPORT            ║
║      Score: 58/100 (F - Critical)     ║
╚════════════════════════════════════════╝

📊 BREAKDOWN BY CATEGORY:

🔐 SECRETS: 10/20
  ✗ Found 3 hardcoded API keys
  ✗ .env not in .gitignore
  ✓ .env.example exists

🔍 INPUTS: 20/25
  ✓ No eval() usage
  ⚠ 2 routes without validation
  
📝 AUTH: 15/25
  ✓ Auth middleware present
  ✗ No bcrypt detected
  
📦 DEPS: 12/15
  ⚠ 2 high vulnerabilities

🔒 HEADERS: 1/15
  ✗ Missing CSP header
  ✗ Missing X-Frame-Options

═══════════════════════════════════════════

TOP ISSUES (by priority):

1. [CRITICAL] .env file not in .gitignore
   → Secrets may be exposed in git history
   
2. [CRITICAL] Hardcoded API keys
   → Move to .env variables immediately
   
3. [HIGH] Missing input validation
   → Add Zod schemas to API routes
```

## 🔐 Security Notes

- The skill scans production code but respects privacy (skips node_modules, .git, etc.)
- Results are local only - no data is sent anywhere
- Reports identify issues with file:line references for easy navigation
- Always review findings and fix issues before deployment

## 🤝 Integration

Can be integrated into:
- Pre-commit hooks
- CI/CD pipelines
- Regular security audits
- Onboarding checklists

## 📞 Support

If the skill needs updates or has false positives:
1. Check `check.js` for pattern matching logic
2. Adjust patterns in the specific check functions
3. Run `node .claude/skills/security-check/scripts/check.js` to test changes
