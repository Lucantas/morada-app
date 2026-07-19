import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FEATURE_PATTERNS = [
  /^apps\/web\/src\/features\/[^/]+\//,
  /^apps\/api\/src\/(?!shared\/|platform\/|test-support\/)[^/]+\//,
];
const INFRA_API_TOP_LEVEL = /^apps\/api\/src\/[^/]+\.ts$/;
const WEB_NON_FEATURE = /^apps\/web\/src\/(app|shared|test)\//;

export function isFeaturePath(path) {
  if (INFRA_API_TOP_LEVEL.test(path)) return false;
  if (WEB_NON_FEATURE.test(path)) return false;
  return FEATURE_PATTERNS.some((re) => re.test(path));
}

function readSpecTrailer(message) {
  const match = message.match(/^Spec:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

export function evaluateSpecTrailer({ touchedPaths, message, specExists }) {
  const featureFiles = touchedPaths.filter(isFeaturePath);
  if (featureFiles.length === 0) return { ok: true, reason: 'no feature paths touched' };

  const trailer = readSpecTrailer(message);
  if (!trailer) {
    return {
      ok: false,
      reason:
        `Commit touches feature paths:\n  ${featureFiles.join('\n  ')}\n` +
        `Add a trailer: "Spec: docs/superpowers/specs/<file>.md" or "Spec: none — <reason>".`,
    };
  }
  const none = trailer.match(/^none\s*[—-]\s*(.+)$/i);
  if (none) {
    return none[1].trim().length > 0
      ? { ok: true, reason: 'escape hatch with reason' }
      : { ok: false, reason: 'Spec: none requires a reason ("none — <reason>").' };
  }
  if (!specExists(trailer)) {
    return { ok: false, reason: `Spec file not found: ${trailer}` };
  }
  return { ok: true, reason: 'valid spec path' };
}

export function evaluateRange(commits, specExists) {
  for (const commit of commits) {
    const result = evaluateSpecTrailer({
      touchedPaths: commit.touchedPaths,
      message: commit.message,
      specExists,
    });
    if (!result.ok) {
      const label = commit.sha ? commit.sha.slice(0, 7) : (commit.message.split('\n')[0] ?? '');
      return { ok: false, reason: `Commit ${label} failed:\n${result.reason}` };
    }
  }
  return { ok: true, reason: 'every commit in range is ok' };
}

function gitTouchedPathsForMessageMode() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function gitCommitsForRange(range) {
  const shas = execFileSync('git', ['rev-list', range], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  return shas.map((sha) => {
    const message = execFileSync('git', ['log', '-1', '--format=%B', sha], { encoding: 'utf8' });
    const touchedPaths = execFileSync(
      'git',
      ['diff-tree', '--no-commit-id', '--name-only', '-r', sha],
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);
    return { sha, message, touchedPaths };
  });
}

function readMessageFile(path) {
  return readFileSync(path, 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  const specExists = (p) => existsSync(p);
  let result;
  if (mode === '--commit-msg') {
    const message = readMessageFile(process.argv[3]);
    const touchedPaths = gitTouchedPathsForMessageMode();
    result = evaluateSpecTrailer({ touchedPaths, message, specExists });
  } else if (mode === '--range') {
    const range = process.argv[3];
    const commits = gitCommitsForRange(range);
    result = evaluateRange(commits, specExists);
  } else {
    console.error('usage: check-spec-trailer.mjs --commit-msg <file> | --range <range>');
    process.exit(2);
  }
  if (!result.ok) {
    console.error(`\n[spec-gate] ${result.reason}\n`);
    process.exit(1);
  }
}
