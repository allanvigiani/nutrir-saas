# Security Check Skill - Execution Guide

You are executing the /security-check skill for the Nutrir SaaS project.

## Task
Perform a comprehensive security audit and report findings with a 0-100 score breakdown.

## Steps

1. **Run the verification script** to get the numeric score
   ```bash
   node .claude/skills/security-check/scripts/check.js
   ```
   This outputs only the numeric score.

2. **Perform detailed analysis** using Bash grep/find commands to:
   - Identify secrets and credentials
   - Find dangerous functions
   - Check authentication patterns
   - Verify input validation
   - Scan for vulnerabilities
   - Check security headers

3. **Format results** with:
   - Clear category breakdown
   - Specific file:line references
   - Severity levels (CRITICAL, HIGH, MEDIUM, LOW)
   - Remediation steps
   - Priority ranking

## Key Files to Check
- `src/server.ts` - Main server with middleware/headers
- `src/server/` - API routes and authentication
- `src/pages/` - React components (XSS risks)
- `.env.example` - Environment variable documentation
- `firestore.rules` - Firestore security rules
- `package.json` - Dependencies
- `.gitignore` - Excluded files

## Output Format
Present results in this order:
1. Total score with grade (A-F)
2. Category breakdown (SECRETS, INPUTS, AUTH, DEPS, HEADERS)
3. Detailed findings per category
4. Top 5 issues by priority
5. Remediation recommendations

## Important Notes
- Exclude node_modules, dist, build, .next in searches
- Check both TypeScript and JavaScript files
- Look in .env.example for reference of what should be protected
- Consider the project's architecture: Express backend + React frontend
