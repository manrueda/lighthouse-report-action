import * as core from '@actions/core';
import * as github from '@actions/github';
import { promisify } from 'util';
import { join } from 'path';
import { promises } from 'fs';
import _glob from 'glob';
const glob = promisify(_glob);

interface Report {
  url: string;
  scores: Score[]
}

interface Score {
  name: string;
  score: number;
}

function getScoreFromReport(report: any): Score[] {
  // Extract each score from a report into a known format
  return Object.values(report.categories).map((category: any) => ({
    name: category.title,
    score: Math.round(category.score * 100)
  }))
}

async function mergeReports(paths: string[]): Promise<Report[]> {
  // Read all reports from the FS
  const rawReports = await Promise.all(
    paths.map(async p => JSON.parse((await promises.readFile(p)).toString('utf8')))
  )
  const results = new Map<string, Report>();
  for (const rawReport of rawReports) {
    // Ignore reports that does not have categories information
    if (rawReport.categories) {
      if (results.has(rawReport.finalUrl)) {
        // If the same URL was already reported, merge the scores
        const base = results.get(rawReport.finalUrl)!;
        const partials: Score[] = getScoreFromReport(rawReport);

        for (const partial of partials) {
          // Iterate each individual score inside the report and merge the results
          const baseScore = base.scores.find(s => s.name === partial.name);
          if (baseScore) {
            const newScore: Score = {
              name: baseScore.name,
              score: (baseScore.score + partial.score) / 2
            }
            base.scores.splice(base.scores.indexOf(baseScore), 1, newScore);
          } else {
            base.scores.push(partial);
          }
        }
        results.set(rawReport.finalUrl, base);

      } else {
        // Adds the report to the result Map
        results.set(rawReport.finalUrl, {
          url: rawReport.finalUrl,
          scores: getScoreFromReport(rawReport)
        })
      }
    }
  }
  return Array.from(results.values())
}

function composeSummary(first: Report, others: Report[]) {
  return `
${first.scores.map(s => `* ${s.name}: **${s.score}**/100 ${s.score === 100 ? '🎉' : ''}`).join('\n')}

${others.map(r => `
## Lighthouse Scores for [${r.url}](${r.url})
${r.scores.map(s => `* ${s.name}: **${s.score}**/100 ${s.score === 100 ? '🎉' : ''}`).join('\n')}
`).join('\n')}
  `.trim();
}

async function run() {
  const reportsPath = core.getInput('reports');
  const octokit = new github.GitHub(core.getInput('github-token'));

  const paths = await glob(join(reportsPath, '*.json'));

  const scores = await mergeReports(paths);

  const [first, ...others] = scores.filter(s => s !== null) as Report[];

  await (octokit as any).checks.create({
    ...github.context.repo,
    name: `Lighthouse Report`,
    head_sha: github.context.sha,
    status: 'completed',
    conclusion: 'success',
    output: {
      title: `Lighthouse Scores for ${first.url}`,
      name: 'Lighthouse report',
      summary: composeSummary(first, others),
    },
    // annotations: [{
    //   path: report!.url,
    //   start_line: 1,
    //   end_line: 1,
    //   annotation_level: 'notice',
    //   message: report!.scores.map(s => `${s.name}: ${s.score}/100`).join('\n'),
    //   title: `Lighthouse Scores for ${report!.url}`
    // }]
  });
}

run().catch(error => core.setFailed(error.message || error));