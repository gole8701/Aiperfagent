import { METRICS, formatMetric, type Issue } from '@perfagent/core'

/** "Copy as Markdown": one problem, ready for a ticket or pull request. */
export function issueToMarkdown(issue: Issue): string {
  const where = issue.location
    ? `\`${issue.location.file}:${issue.location.line}\``
    : (issue.route ?? '')
  const lines = [
    `### ${issue.severity === 'critical' ? '[critical]' : issue.severity === 'warning' ? '[warning]' : '[info]'} ${issue.title}`,
    '',
    `${issue.plain}${where ? ` — ${where}` : ''}`,
    '',
    `**Why:** ${issue.why}`,
    '',
    `**Estimated gain:** ${METRICS[issue.gain.metric].short} ${formatMetric(issue.gain.metric, issue.gain.from)} → ~${formatMetric(issue.gain.metric, issue.gain.to)} · score +${issue.gain.scoreDelta}`,
    '',
    '**Fix:**',
    ...issue.fix.steps.map((s, i) => `${i + 1}. ${s}`),
  ]
  const change = issue.fix.changes[0]
  if (change)
    lines.push(
      '',
      '```diff',
      ...change.before.split('\n').map((l) => `- ${l}`),
      ...change.after.split('\n').map((l) => `+ ${l}`),
      '```',
    )
  if (issue.docs.length)
    lines.push('', '**Docs:** ' + issue.docs.map((d) => `[${d.label}](${d.url})`).join(' · '))
  return lines.join('\n')
}
