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

async function calculateScore(fullPath: string): Promise<Report | null> {
  const textContent = await (await promises.readFile(fullPath)).toString('utf8');
  const report = JSON.parse(textContent);
  if (report.categories) {
    const scores = Object.values(report.categories).map((category: any) => ({
      name: category.title,
      score: Math.round(category.score * 100)
    }));
    return {
      url: report.finalUrl,
      scores
    };
  } else {
    return null;
  }
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

  const scores = await Promise.all(paths.map(async (reportPath) => calculateScore(reportPath)));

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