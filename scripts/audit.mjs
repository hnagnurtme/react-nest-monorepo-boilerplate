import { spawnSync } from 'node:child_process';

const allowedUnfixableAdvisories = new Set([
  '1138808',
  '1138809',
  '1240622',
  '1240624',
  '1240912',
  '1240992',
]);
const audit = spawnSync('pnpm', ['audit', '--json'], { encoding: 'utf8' });

if (audit.error) {
  throw audit.error;
}

const report = JSON.parse(audit.stdout);
const advisories = Object.entries(report.advisories ?? {});
const blockingAdvisories = advisories.filter(([id, advisory]) => {
  const severity = advisory.severity;
  return ['high', 'critical'].includes(severity) && !allowedUnfixableAdvisories.has(id);
});

if (blockingAdvisories.length > 0) {
  process.stderr.write(`${audit.stdout}\n`);
  process.exit(1);
}
