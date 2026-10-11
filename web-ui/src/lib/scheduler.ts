import type { Course, Section } from './types';
import { dependentsCount } from './dag';

export type StrategyName = 'MilestoneFirst' | 'MinimizeGaps';

export interface ScheduleResult {
  picks: Section[];
  dropped: { code: string; reason: string }[];
  credits: number;
  gapMinutes: number;
}

const overlap = (a: Section['slots'][number], b: Section['slots'][number]) =>
  a.day === b.day && a.start < b.end && b.start < a.end;

export const clashes = (a: Section, b: Section) => a.slots.some((x) => b.slots.some((y) => overlap(x, y)));

/** Total idle minutes between classes, summed across days. */
export function gapMinutes(picks: Section[]): number {
  const byDay = new Map<string, { start: number; end: number }[]>();
  for (const s of picks) for (const sl of s.slots) byDay.set(sl.day, [...(byDay.get(sl.day) ?? []), sl]);
  let gap = 0;
  byDay.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) gap += Math.max(0, sorted[i].start - sorted[i - 1].end);
  });
  return gap;
}

/**
 * Strategy pattern (deck slide 15): swappable at runtime.
 * Lower score = better. This is a frontend stand-in for the backend constraint solver.
 */
const strategies: Record<StrategyName, (picks: Section[], weights: number[]) => number> = {
  // Best (earliest) slots go to the courses that unlock the most others.
  MilestoneFirst: (picks, weights) =>
    picks.reduce((sum, s, i) => sum + weights[i] * s.slots[0].start, 0) + gapMinutes(picks) / 100,
  // Compact day: fewest idle minutes, earlier start as a tie-breaker.
  MinimizeGaps: (picks) => gapMinutes(picks) * 1000 + picks.reduce((sum, s) => sum + s.slots[0].start, 0),
};

export function generateSchedule(
  codes: string[],
  courses: Course[],
  sections: Section[],
  strategy: StrategyName,
  creditLimit: number,
): ScheduleResult {
  const byCode = new Map(courses.map((c) => [c.code, c]));
  const wanted = codes.map((c) => byCode.get(c)).filter((c): c is Course => Boolean(c));
  const ordered =
    strategy === 'MilestoneFirst'
      ? [...wanted].sort((a, b) => dependentsCount(b.code, courses) - dependentsCount(a.code, courses))
      : wanted;

  const dropped: ScheduleResult['dropped'] = [];
  let kept: Course[] = [];
  let credits = 0;
  for (const c of ordered) {
    const open = sections.filter((s) => s.courseCode === c.code && s.seats > 0);
    if (open.length === 0) dropped.push({ code: c.code, reason: 'No open sections' });
    else if (credits + c.credits > creditLimit) dropped.push({ code: c.code, reason: `Over the ${creditLimit}-credit limit` });
    else {
      kept.push(c);
      credits += c.credits;
    }
  }

  const solve = (list: Course[]): Section[] | null => {
    const weights = list.map((_, i) => list.length - i);
    let best: Section[] | null = null;
    let bestScore = Infinity;
    const dfs = (i: number, chosen: Section[]) => {
      if (i === list.length) {
        const score = strategies[strategy](chosen, weights);
        if (score < bestScore) {
          bestScore = score;
          best = [...chosen];
        }
        return;
      }
      for (const s of sections.filter((x) => x.courseCode === list[i].code && x.seats > 0)) {
        if (chosen.every((c) => !clashes(c, s))) dfs(i + 1, [...chosen, s]);
      }
    };
    dfs(0, []);
    return best;
  };

  let picks = solve(kept);
  while (!picks && kept.length > 0) {
    const removed = kept[kept.length - 1];
    kept = kept.slice(0, -1);
    credits -= removed.credits;
    dropped.push({ code: removed.code, reason: 'Clashes with higher-priority courses' });
    picks = solve(kept);
  }
  const final = picks ?? [];
  return { picks: final, dropped, credits, gapMinutes: gapMinutes(final) };
}
