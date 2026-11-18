// Calibration rules (SPEC section 5, "QC pipeline", step 3), as plain functions so they're unit-tested.
// An open-text exercise passes calibration when each anchor is scored RUNS times and:
//   * every criterion matches the anchor's expected score in at least MIN_MATCHES of the runs;
//   * the strong anchor passes every run, and the weak anchor fails every run.
// An unscored run never counts as a match, a pass or a fail.

export const RUNS = 5;
export const MIN_MATCHES = 4;

export interface AnchorSpec {
  label: string;
  expected_scores: Record<string, number>;
  expected_pass: boolean;
}

export type RunResult =
  | { result: 'pass' | 'fail'; criteria_scores: Record<string, number> }
  | { result: 'unscored' };

export interface AnchorReport {
  label: string;
  /** For each criterion id: how many runs matched the expected score. */
  matches: Record<string, number>;
  passes: number;
  fails: number;
  unscored: number;
}

export interface ExerciseVerdict {
  passed: boolean;
  anchors: AnchorReport[];
  /** Plain-English reasons it didn't pass. Empty when it passed. */
  problems: string[];
}

export function judgeExercise(anchors: readonly AnchorSpec[], runsByAnchor: readonly RunResult[][]): ExerciseVerdict {
  const problems: string[] = [];
  const reports = anchors.map((anchor, i) => {
    const runs = runsByAnchor[i] ?? [];
    const matches: Record<string, number> = {};
    for (const id of Object.keys(anchor.expected_scores).sort()) {
      matches[id] = runs.filter((r) => r.result !== 'unscored' && r.criteria_scores[id] === anchor.expected_scores[id]).length;
    }
    const report: AnchorReport = {
      label: anchor.label,
      matches,
      passes: runs.filter((r) => r.result === 'pass').length,
      fails: runs.filter((r) => r.result === 'fail').length,
      unscored: runs.filter((r) => r.result === 'unscored').length,
    };

    if (runs.length < RUNS) problems.push(`${anchor.label}: only ${runs.length} of ${RUNS} runs finished`);
    for (const [id, n] of Object.entries(matches)) {
      if (n < MIN_MATCHES) {
        const got = runs.map((r) => (r.result === 'unscored' ? '–' : String(r.criteria_scores[id]))).join(',');
        problems.push(
          `${anchor.label} ${id} (expected ${anchor.expected_scores[id]}): matched in ${n} of ${runs.length} runs ` +
            `(needs ${MIN_MATCHES}); got ${got}`,
        );
      }
    }
    if (anchor.label === 'strong' && report.passes < runs.length) {
      problems.push(`strong: passed ${report.passes} of ${runs.length} runs (must always pass)`);
    }
    if (anchor.label === 'weak' && report.fails < runs.length) {
      problems.push(`weak: failed ${report.fails} of ${runs.length} runs (must always fail)`);
    }
    return report;
  });
  return { passed: problems.length === 0, anchors: reports, problems };
}

export interface ModelPrice {
  model: string;
  input_usd_per_million: number;
  output_usd_per_million: number;
}

export function callCost(price: ModelPrice, inputTokens: number, outputTokens: number): number {
  return (inputTokens * price.input_usd_per_million + outputTokens * price.output_usd_per_million) / 1_000_000;
}

/** Rough token count for planning: about 4 characters per token, rounded up. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** The first sentence of a feedback text. */
export function firstSentence(feedback: string): string {
  const match = feedback.trim().match(/^.*?[.!?]["'”’)\]]*(?=\s|$)/s);
  return (match ? match[0] : feedback).trim();
}

/** True if the feedback opens with generic praise (the rule from prompt version 3 onward). */
export function opensWithGenericPraise(feedback: string): boolean {
  const first = firstSentence(feedback);
  return (
    /^(you did\b|great\b|nice\b|good\b|well done\b|awesome\b)/i.test(first) ||
    /\b(great job|nice job|good job|nice work|well done)\b/i.test(first)
  );
}

/** True if the feedback asks exactly one question, as its last sentence (the rule from prompt version 5 onward). */
export function asksOneQuestion(feedback: string): boolean {
  return (feedback.match(/\?/g) ?? []).length === 1 && /\?["'”’)\]]*$/.test(feedback.trim());
}
