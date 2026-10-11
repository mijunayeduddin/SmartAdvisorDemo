import type { Course } from './types';

/** Prerequisites the student has not completed yet (direct prerequisites). */
export function missingPrerequisites(course: Course, completed: string[]): string[] {
  const done = new Set(completed);
  return course.prerequisites.filter((p) => !done.has(p));
}

/** Courses not yet completed whose prerequisites are all done. */
export function nextEligible(courses: Course[], completed: string[]): Course[] {
  const done = new Set(completed);
  return courses.filter((c) => !done.has(c.code) && missingPrerequisites(c, completed).length === 0);
}

/** How many courses (directly or indirectly) are unlocked by this one. Used for "critical path" ordering. */
export function dependentsCount(code: string, courses: Course[]): number {
  const children = new Map<string, string[]>();
  for (const c of courses) for (const p of c.prerequisites) children.set(p, [...(children.get(p) ?? []), c.code]);
  const seen = new Set<string>();
  const walk = (k: string) => {
    for (const next of children.get(k) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        walk(next);
      }
    }
  };
  walk(code);
  return seen.size;
}

/** Cycle detection (DFS). A valid curriculum must return false. */
export function hasCycle(courses: Course[]): boolean {
  const byCode = new Map(courses.map((c) => [c.code, c]));
  const state = new Map<string, 1 | 2>(); // 1 = visiting, 2 = done
  const visit = (code: string): boolean => {
    if (state.get(code) === 2) return false;
    if (state.get(code) === 1) return true;
    state.set(code, 1);
    for (const p of byCode.get(code)?.prerequisites ?? []) if (visit(p)) return true;
    state.set(code, 2);
    return false;
  };
  return courses.some((c) => visit(c.code));
}
