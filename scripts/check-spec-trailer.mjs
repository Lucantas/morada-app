import { existsSync } from 'node:fs';
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
  const none = trailer.match(/^none\s*[—-]\s*(.+)$/);
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

function gitTouchedPathsForMessageMode() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function gitTouchedPathsForRange(range) {
  const out = execFileSync('git', ['diff', '--name-only', range], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function readMessageFile(path) {
  return execFileSync('cat', [path], { encoding: 'utf8' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  let touchedPaths;
  let message;
  if (mode === '--commit-msg') {
    message = readMessageFile(process.argv[3]);
    touchedPaths = gitTouchedPathsForMessageMode();
  } else if (mode === '--range') {
    const range = process.argv[3];
    touchedPaths = gitTouchedPathsForRange(range);
    message = execFileSync('git', ['log', '--format=%B', range], { encoding: 'utf8' });
  } else {
    console.error('usage: check-spec-trailer.mjs --commit-msg <file> | --range <range>');
    process.exit(2);
  }
  const result = evaluateSpecTrailer({
    touchedPaths,
    message,
    specExists: (p) => existsSync(p),
  });
  if (!result.ok) {
    console.error(`\n[spec-gate] ${result.reason}\n`);
    process.exit(1);
  }
}
