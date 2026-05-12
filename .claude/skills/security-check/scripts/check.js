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
    issues.SECRETS.deductions.push({ issue: '.env not in .gitignore', points: 5 });
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
      issue: `Found ${secretsFound.length} potential hardcoded secrets`,
      points: 5,
      examples: secretsFound.slice(0, 3)
    });
    issues.SECRETS.points -= 5;
  }

  // 5 pts: .env.example exists
  if (!fileExists('.env.example')) {
    issues.SECRETS.deductions.push({ issue: '.env.example not found', points: 5 });
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
      issue: `Found ${dangerousFound.length} dangerous function uses`,
      points: 10,
      examples: dangerousFound.slice(0, 3)
    });
    issues.INPUTS.points -= 10;
  }

  // 8 pts: Routes without validation
  const routeFiles = grepFiles('app\\.\\(post\\|put\\|delete\\|patch\\)', { extensions: ['.ts', '.js'] });
  const validationKeywords = ['validator', 'zod', 'validate', 'schema', 'body-parser'];

  let routesWithoutValidation = 0;
  if (routeFiles.length > 0) {
    // Check if validation is present in server directory
    const serverFiles = grepFiles('', { extensions: ['.ts'] }).filter(f => f.includes('src/server'));
    const hasValidation = validationKeywords.some(kw =>
      grepFiles(kw).length > 0
    );

    if (!hasValidation) {
      issues.INPUTS.deductions.push({
        issue: 'No input validation middleware detected in API routes',
        points: 5
      });
      issues.INPUTS.points -= 5;
    }
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
      issue: 'No auth middleware pattern found',
      points: 8
    });
    issues.AUTH.points -= 8;
  }

  // 6 pts: Check for bcrypt
  const bcryptUsage = grepFiles('bcrypt', { exclude: SKIP_DIRS });
  if (bcryptUsage.length === 0) {
    issues.AUTH.deductions.push({
      issue: 'No password hashing library detected (bcrypt/argon2)',
      points: 6
    });
    issues.AUTH.points -= 6;
  }

  // 6 pts: Check Firestore rules
  if (fileExists('firestore.rules')) {
    const rules = readFile('firestore.rules');
    if (rules && rules.includes('allow read, write: if true')) {
      issues.AUTH.deductions.push({
        issue: 'Firestore rules allow unrestricted read/write',
        points: 6
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
      issue: 'No CSRF protection middleware detected',
      points: 3
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
        issue: `${criticalCount} critical vulnerabilities`,
        points: criticalCount * 5
      });
    }

    if (highCount > 0) {
      deduction += highCount * 3;
      issues.DEPS.deductions.push({
        issue: `${highCount} high vulnerabilities`,
        points: highCount * 3
      });
    }

    if (mediumCount > 0) {
      deduction += Math.min(mediumCount, 5);
      issues.DEPS.deductions.push({
        issue: `${mediumCount} medium vulnerabilities`,
        points: Math.min(mediumCount, 5)
      });
    }

    issues.DEPS.points -= Math.min(deduction, 10);
  } catch (e) {
    // npm audit might fail, but that's ok
  }

  issues.DEPS.points = Math.max(0, issues.DEPS.points);
}

// ============ HEADERS (15 pts) ============

function checkHeaders() {
  // Check server.ts or main express file for security headers
  const serverFile = readFile('server.ts') || readFile('src/server.ts') || readFile('src/server/server.ts') || '';

  const headerPatterns = {
    cors: { pattern: 'cors', points: 4 },
    csp: { pattern: 'Content-Security-Policy', points: 3 },
    xframe: { pattern: 'X-Frame-Options', points: 3 },
    xContentType: { pattern: 'X-Content-Type-Options', points: 3 },
    hsts: { pattern: 'Strict-Transport-Security', points: 2 }
  };

  for (const [key, { pattern, points }] of Object.entries(headerPatterns)) {
    const found = serverFile.includes(pattern) || grepFiles(pattern).length > 0;
    if (!found) {
      issues.HEADERS.deductions.push({
        issue: `Missing ${pattern} header`,
        points
      });
      issues.HEADERS.points -= points;
    }
  }

  issues.HEADERS.points = Math.max(0, issues.HEADERS.points);
}

// ============ MAIN EXECUTION ============

function run() {
  checkSecrets();
  checkInputs();
  checkAuth();
  checkDeps();
  checkHeaders();

  // Calculate total score
  let totalScore = 0;
  for (const category in issues) {
    totalScore += issues[category].points;
  }

  console.log(totalScore);
}

run();

export { run };
