// Adapted from ~/devos (libriopal/libriopal-devos, private repo, same
// author) — apps/devos-server/src/agents/bitoAgent.ts. Stripped of the
// optional WebSocket streaming param (`ws?: WebSocket`) since this repo has
// no devos-style live dashboard to stream chunks to; the spawn+parse core
// logic is otherwise unchanged. Matches this repo's existing CLAUDE.md
// BitoReview convention (`--prompt-only` JSON output).

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

export interface BitoIssue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  file: string;
  line: number;
  title: string;
  description: string;
  suggestion: string;
  codeSnippet?: string;
  suggestedFix?: string;
}

export interface BitoResult {
  summary: string;
  filesChanged: number;
  issues: BitoIssue[];
  positives: { category: string; description: string }[];
  recommendations: string[];
  metrics: { highSeverityCount: number; mediumSeverityCount: number; lowSeverityCount: number };
}

export interface BitoRunOptions {
  focus?: 'security' | 'performance' | 'bugs' | 'best-practices';
  mode?: 'essential';
  base?: string;
  type?: 'working' | 'staged';
  cwd: string;
}

export function runBitoReview(
  opts: BitoRunOptions,
  onChunk: (chunk: string) => void,
): Promise<BitoResult> {
  return new Promise((resolvePromise, reject) => {
    const args = ['review', '--prompt-only'];
    if (opts.focus) args.push('--focus', opts.focus);
    if (opts.mode) args.push('--mode', opts.mode);
    if (opts.base) args.push('--base', opts.base);
    if (opts.type) args.push('--type', opts.type);

    let raw = '';
    const proc = spawn('bitoreview', args, { cwd: opts.cwd, shell: true });

    proc.stdout.on('data', (d: Buffer) => {
      const chunk = d.toString();
      raw += chunk;
      onChunk(chunk);
    });

    proc.on('close', (code) => {
      // bito prefixes [SUCCESS]-style lines before the JSON blob.
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        reject(new Error(`Bito returned no JSON (exit ${code})`));
        return;
      }
      try {
        resolvePromise(JSON.parse(jsonMatch[0]) as BitoResult);
      } catch (e) {
        reject(new Error(`Failed to parse bito JSON: ${e}`));
      }
    });

    proc.on('error', reject);
  });
}

export function saveBitoResult(result: BitoResult, bitoDir: string, branchSlug: string): string {
  mkdirSync(bitoDir, { recursive: true });
  const path = `${bitoDir}/BITO_${branchSlug}_${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(result, null, 2));
  return path;
}
