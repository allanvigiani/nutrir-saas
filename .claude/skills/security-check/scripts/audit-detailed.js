#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const SKIP_DIRS = ['node_modules', 'dist', 'build', '.next', 'coverage', '.git', '.claude'];

let totalScore = 100;
const issues = {
  SECRETS: { max: 20, deductions: [], points: 20 },
  INPUTS: { max: 25, deductions: [], points: 25 },
  AUTH: { max: 25, deductions: [], points: 25 },
  DEPS: { max: 15, deductions: [], points: 15 },
  HEADERS: { max: 15, deductions: [], points: 15 }
};

// Helper: grep in files, excluding directories
function grepFiles(pattern, options = {}) {
  const { exclude = SKIP_DIRS } = options;

  try {
    const args = ['-rE', pattern, PROJECT_ROOT];
    exclude.forEach(d => {
      args.push(`--exclude-dir=${d}`);
    });

    const result = execSync(`grep ${args.join(' ')}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.split('\n').filter(l => l);
  } catch {
    return [];
  }
}

// Helper: read file safely
function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(PROJECT_ROOT, filePath), 'utf-8');
  } catch {
    return null;
  }
}

// Helper: check if file exists
function fileExists(filePath) {
  return fs.existsSync(path.join(PROJECT_ROOT, filePath));
}

// ============ SECRETS (20 pts) ============
function checkSecrets() {
  // 5 pts: .env in .gitignore
  const gitignore = readFile('.gitignore');
  if (!gitignore || !gitignore.includes('.env')) {
    issues.SECRETS.deductions.push({ severity: 'CRITICAL', issue: '.env not in .gitignore', points: 5, fix: 'Add ".env" to .gitignore file' });
    issues.SECRETS.points -= 5;
  }

  // 5 pts: Hardcoded secrets
  const secretPatterns = [
    { pattern: 'api[_-]key["\']?\\s*[:=]', name: 'API_KEY' },
    { pattern: 'secret["\']?\\s*[:=]', name: 'SECRET' },
    { pattern: 'password["\']?\\s*[:=]', name: 'PASSWORD' },
    { pattern: 'token["\']?\\s*[:=]', name: 'TOKEN' },
    { pattern: 'firebase.*apiKey', name: 'Firebase API Key' },
    { pattern: 'mongodb://.*@', name: 'MongoDB URI' },
    { pattern: 'postgres://.*@', name: 'PostgreSQL URI' }
  ];

  let secretsFound = [];
  for (const { pattern, name } of secretPatterns) {
    const results = grepFiles(pattern);
    secretsFound.push(...results.filter(r => !r.includes('.env.example')));
  }

  if (secretsFound.length > 0) {
    issues.SECRETS.deductions.push({
      severity: 'CRITICAL',
      issue: `Found ${secretsFound.length} potential hardcoded secrets`,
      points: 5,
      fix: 'Move all secrets to .env file. Use environment variables in code instead.',
      examples: secretsFound.slice(0, 2).map(e => '  ' + e)
    });
    issues.SECRETS.points -= 5;
  }

  // 5 pts: .env.example exists
  if (!fileExists('.env.example')) {
    issues.SECRETS.deductions.push({ severity: 'HIGH', issue: '.env.example not found', points: 5, fix: 'Create .env.example with all required environment variables' });
    issues.SECRETS.points -= 5;
  }

  issues.SECRETS.points = Math.max(0, issues.SECRETS.points);
}

// ============ INPUTS (25 pts) ============
function checkInputs() {
  // 10 pts: Dangerous functions
  const dangerousPatterns = [
    { pattern: 'eval\\(', name: 'eval()' },
    { pattern: 'innerHTML\\s*=', name: 'innerHTML assignment' },
    { pattern: 'dangerouslySetInnerHTML', name: 'dangerouslySetInnerHTML' },
    { pattern: 'exec\\(', name: 'exec()' },
    { pattern: 'execSync\\(', name: 'execSync()' }
  ];

  let dangerousFound = [];
  for (const { pattern, name } of dangerousPatterns) {
    const results = grepFiles(pattern);
    dangerousFound.push(...results.filter(r => !r.includes('node_modules') && !r.includes('test')));
  }

  if (dangerousFound.length > 0) {
    issues.INPUTS.deductions.push({
      severity: 'CRITICAL',
      issue: `Found ${dangerousFound.length} dangerous function uses`,
      points: 10,
      fix: 'Replace dangerous functions with safe alternatives (use textContent instead of innerHTML, avoid eval)',
      examples: dangerousFound.slice(0, 2).map(e => '  ' + e)
    });
    issues.INPUTS.points -= 10;
  }

  // 8 pts: Routes without validation
  const validationKeywords = ['validator', 'zod', 'validate', 'schema', 'body-parser'];
  const hasValidation = validationKeywords.some(kw => grepFiles(kw).length > 0);

  if (!hasValidation) {
    issues.INPUTS.deductions.push({
      severity: 'HIGH',
      issue: 'No input validation middleware detected',
      points: 5,
      fix: 'Add Zod or similar validation to API routes. Validate all user inputs.'
    });
    issues.INPUTS.points -= 5;
  }

  issues.INPUTS.points = Math.max(0, issues.INPUTS.points);
}

// ============ AUTH (25 pts) ============
function checkAuth() {
  // 8 pts: Check for auth middleware
  const authPatterns = ['verifyToken', 'isAuthenticated', 'requireAuth', 'authMiddleware'];
  let hasAuthMiddleware = false;

  for (const pattern of authPatterns) {
    if (grepFiles(pattern).length > 0) {
      hasAuthMiddleware = true;
      break;
    }
  }

  if (!hasAuthMiddleware) {
    issues.AUTH.deductions.push({
      severity: 'CRITICAL',
      issue: 'No auth middleware pattern found',
      points: 8,
      fix: 'Implement authentication middleware to protect API endpoints'
    });
    issues.AUTH.points -= 8;
  }

  // 6 pts: Check for bcrypt
  const bcryptUsage = grepFiles('bcrypt', { exclude: SKIP_DIRS });
  if (bcryptUsage.length === 0) {
    issues.AUTH.deductions.push({
      severity: 'HIGH',
      issue: 'No password hashing library detected',
      points: 6,
      fix: 'Use bcrypt or Argon2 for password hashing. Never store plaintext passwords.'
    });
    issues.AUTH.points -= 6;
  }

  // 6 pts: Check Firestore rules
  if (fileExists('firestore.rules')) {
    const rules = readFile('firestore.rules');
    if (rules && rules.includes('allow read, write: if true')) {
      issues.AUTH.deductions.push({
        severity: 'CRITICAL',
        issue: 'Firestore rules allow unrestricted read/write',
        points: 6,
        fix: 'Restrict Firestore rules to authenticated users. Use role-based access control.'
      });
      issues.AUTH.points -= 6;
    }
  }

  // 5 pts: CSRF protection
  const csrfPatterns = ['csrf', 'csurf', 'double-submit-cookie'];
  let hasCsrf = false;

  for (const pattern of csrfPatterns) {
    if (grepFiles(pattern).length > 0) {
      hasCsrf = true;
      break;
    }
  }

  if (!hasCsrf) {
    issues.AUTH.deductions.push({
      severity: 'MEDIUM',
      issue: 'No CSRF protection middleware detected',
      points: 3,
      fix: 'Add CSRF middleware and tokens to forms. Use SameSite cookies.'
    });
    issues.AUTH.points -= 3;
  }

  issues.AUTH.points = Math.max(0, issues.AUTH.points);
}

// ============ DEPS (15 pts) ============
function checkDeps() {
  try {
    const auditOutput = execSync('npm audit --json 2>/dev/null || echo "{}"', {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT
    });

    const audit = JSON.parse(auditOutput);
    const metadata = audit.metadata || {};
    const vulnerabilities = metadata.vulnerabilities || {};

    let deduction = 0;
    const criticalCount = vulnerabilities.critical || 0;
    const highCount = vulnerabilities.high || 0;
    const mediumCount = vulnerabilities.medium || 0;

    if (criticalCount > 0) {
      deduction += criticalCount * 5;
      issues.DEPS.deductions.push({
        severity: 'CRITICAL',
        issue: `${criticalCount} critical vulnerabilities in dependencies`,
        points: criticalCount * 5,
        fix: 'Run "npm audit fix" or update vulnerable packages immediately'
      });
    }

    if (highCount > 0) {
      deduction += highCount * 3;
      issues.DEPS.deductions.push({
        severity: 'HIGH',
        issue: `${highCount} high vulnerabilities in dependencies`,
        points: highCount * 3,
        fix: 'Update vulnerable dependencies. Review package changelogs for breaking changes.'
      });
    }

    if (mediumCount > 0) {
      deduction += Math.min(mediumCount, 5);
      issues.DEPS.deductions.push({
        severity: 'MEDIUM',
        issue: `${mediumCount} medium vulnerabilities in dependencies`,
        points: Math.min(mediumCount, 5),
        fix: 'Plan updates for medium vulnerabilities in next release cycle'
      });
    }

    issues.DEPS.points -= Math.min(deduction, 10);
  } catch (e) {
    // npm audit might fail
  }

  issues.DEPS.points = Math.max(0, issues.DEPS.points);
}

// ============ HEADERS (15 pts) ============
function checkHeaders() {
  const serverFile = readFile('server.ts') || readFile('src/server.ts') || readFile('src/server/server.ts') || '';

  const headerPatterns = {
    cors: { pattern: 'cors', points: 4, header: 'CORS' },
    csp: { pattern: 'Content-Security-Policy', points: 3, header: 'CSP' },
    xframe: { pattern: 'X-Frame-Options', points: 3, header: 'X-Frame-Options' },
    xContentType: { pattern: 'X-Content-Type-Options', points: 3, header: 'X-Content-Type-Options' },
    hsts: { pattern: 'Strict-Transport-Security', points: 2, header: 'HSTS' }
  };

  for (const [key, { pattern, points, header }] of Object.entries(headerPatterns)) {
    const found = serverFile.includes(pattern) || grepFiles(pattern).length > 0;
    if (!found) {
      issues.HEADERS.deductions.push({
        severity: 'MEDIUM',
        issue: `Missing ${header} header`,
        points,
        fix: `Add "${header}" header to Express middleware in server.ts`
      });
      issues.HEADERS.points -= points;
    }
  }

  issues.HEADERS.points = Math.max(0, issues.HEADERS.points);
}

// ============ MAIN EXECUTION ============
function getGrade(score) {
  if (score >= 90) return 'A ✅ Excellent';
  if (score >= 80) return 'B ✅ Good';
  if (score >= 70) return 'C ⚠️ Fair';
  if (score >= 60) return 'D ⚠️ Poor';
  return 'F 🚨 Critical';
}

function formatIssues(category, categoryIssues) {
  let output = `\n🔐 ${category}: ${categoryIssues.points}/${categoryIssues.max}\n`;

  if (categoryIssues.deductions.length === 0) {
    output += '  ✓ All checks passed\n';
  } else {
    const critical = categoryIssues.deductions.filter(d => d.severity === 'CRITICAL');
    const high = categoryIssues.deductions.filter(d => d.severity === 'HIGH');
    const medium = categoryIssues.deductions.filter(d => d.severity === 'MEDIUM');

    [...critical, ...high, ...medium].forEach((d, i) => {
      const icon = d.severity === 'CRITICAL' ? '✗' : d.severity === 'HIGH' ? '⚠' : '◇';
      output += `  ${icon} [${d.severity}] ${d.issue} (-${d.points})\n`;
      if (d.fix) output += `     → ${d.fix}\n`;
      if (d.examples) {
        output += `     Examples:\n`;
        d.examples.forEach(ex => output += `${ex}\n`);
      }
    });
  }

  return output;
}

function run() {
  checkSecrets();
  checkInputs();
  checkAuth();
  checkDeps();
  checkHeaders();

  // Calculate total score
  let totalScore = 0;
  const allDeductions = [];

  for (const category in issues) {
    totalScore += issues[category].points;
    issues[category].deductions.forEach(d => {
      allDeductions.push({ category, ...d });
    });
  }

  const grade = getGrade(totalScore);

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║      SECURITY AUDIT REPORT            ║');
  console.log(`║      Score: ${totalScore}/100 (${grade.padEnd(26)}║`);
  console.log('╚════════════════════════════════════════╝');

  console.log('\n📊 BREAKDOWN BY CATEGORY:\n');
  console.log(formatIssues('🔐 SECRETS', issues.SECRETS));
  console.log(formatIssues('🔍 INPUTS', issues.INPUTS));
  console.log(formatIssues('📝 AUTH', issues.AUTH));
  console.log(formatIssues('📦 DEPS', issues.DEPS));
  console.log(formatIssues('🔒 HEADERS', issues.HEADERS));

  console.log('\n═══════════════════════════════════════════\n');

  if (allDeductions.length > 0) {
    console.log('TOP ISSUES (by priority):\n');
    allDeductions
      .sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
        return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
      })
      .slice(0, 10)
      .forEach((issue, i) => {
        console.log(`${i + 1}. [${issue.severity}] ${issue.issue}`);
        if (issue.fix) console.log(`   → ${issue.fix}`);
        console.log();
      });
  }

  console.log('═══════════════════════════════════════════\n');

  if (totalScore < 60) {
    console.log('🚨 CRITICAL: Address security issues before deployment!\n');
  } else if (totalScore < 70) {
    console.log('⚠️  HIGH PRIORITY: Fix high-severity issues soon.\n');
  } else if (totalScore < 80) {
    console.log('✓ Address medium-priority issues in next sprint.\n');
  } else {
    console.log('✅ Security posture is good. Continue monitoring.\n');
  }
}

run();
