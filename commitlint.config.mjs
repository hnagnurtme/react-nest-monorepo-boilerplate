/**
 * Enforces docs/rules/09-git-va-ci.md section B.
 * Runs in the `commit-msg` git hook and is re-checked in CI.
 */
// Squash-merge titles that landed on develop before commit linting covered them. History cannot
// be rewritten, and they sit in every develop -> main range, so match them exactly.
const LEGACY_TITLES = [
  'merge: sync main into develop (#12)',
  'Perf/frontend base (#14)',
  'build/azure deploy (#15)',
];

export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => LEGACY_TITLES.includes(message.split('\n')[0].trim())],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'refactor', 'docs', 'test', 'perf', 'build', 'ci', 'revert'],
    ],
    // B2: imperative mood, no capitalisation, no trailing period
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    'subject-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
  },
};
