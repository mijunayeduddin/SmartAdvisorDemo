// Jest test suite for Graph Solver
import { buildGraph, topologicalOrder, criticalPath, eligibleCourses, DEFAULT_CREDIT_GATES } from '../core/graphSolver';

describe('Graph Solver Core Functions', () => {
  test('buildGraph throws on cyclic graph', () => {
    const cyclicCourses = [
      { code: 'A', prerequisites: ['B'] },
      { code: 'B', prerequisites: ['C'] },
      { code: 'C', prerequisites: ['A'] }
    ];
    expect(() => buildGraph(cyclicCourses)).toThrow(/cycle/);
  });

  test('topologicalOrder respects prerequisites', () => {
    const courses = [
      { code: 'A' },
      { code: 'B', prerequisites: ['A'] },
      { code: 'C', prerequisites: ['B'] },
      { code: 'D', prerequisites: ['A'] }
    ];
    const graph = buildGraph(courses);
    const order = topologicalOrder(graph);
    // A should appear before B, C, D; B before C
    const idxA = order.indexOf('A');
    const idxB = order.indexOf('B');
    const idxC = order.indexOf('C');
    const idxD = order.indexOf('D');
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxC);
    expect(idxA).toBeLessThan(idxD);
  });

  test('eligibleCourses respects prerequisites and credit gates', () => {
    const courses = [
      { code: 'CSE115' }, // no prereqs
      { code: 'CSE173', prerequisites: ['CSE115'] },
      { code: 'CSE299', prerequisites: [], credits: 1 }, // credit gate 60
      { code: 'CSE499A', prerequisites: [], credits: 1 } // credit gate 100
    ];
    const graph = buildGraph(courses);
    // Fresh student, 0 credits
    const eligibleZero = eligibleCourses(graph, [], 0);
    expect(eligibleZero).toContain('CSE115');
    expect(eligibleZero).not.toContain('CSE173');
    expect(eligibleZero).not.toContain('CSE299');
    expect(eligibleZero).not.toContain('CSE499A');
    // Student completed CSE115, 4 credits
    const eligibleAfter115 = eligibleCourses(graph, ['CSE115'], 4);
    expect(eligibleAfter115).toContain('CSE173');
    expect(eligibleAfter115).not.toContain('CSE299');
    // Student with 65 credits but no prereqs satisfied
    const eligibleCreditGate = eligibleCourses(graph, [], 65);
    expect(eligibleCreditGate).toContain('CSE299');
    expect(eligibleCreditGate).not.toContain('CSE499A');
    // Student with 110 credits
    const eligibleAll = eligibleCourses(graph, [], 110);
    expect(eligibleAll).toContain('CSE299');
    expect(eligibleAll).toContain('CSE499A');
  });

  test('criticalPath returns longest milestone chain', () => {
    const courses = [
      { code: 'MAT116', isMilestone: true },
      { code: 'MAT120', prerequisites: ['MAT116'], isMilestone: true },
      { code: 'CSE173', prerequisites: ['MAT120'], isMilestone: true },
      { code: 'CSE225', prerequisites: ['CSE173'], isMilestone: true },
      { code: 'CSE311', prerequisites: ['CSE225'], isMilestone: true },
      { code: 'CSE327', prerequisites: ['CSE311'], isMilestone: true },
      { code: 'CSE425', prerequisites: ['CSE327'], isMilestone: true },
      { code: 'ELEC101' } // unrelated course
    ];
    const graph = buildGraph(courses);
    const path = criticalPath(graph, []);
    expect(path).toEqual(['MAT116', 'MAT120', 'CSE173', 'CSE225', 'CSE311', 'CSE327', 'CSE425']);
  });
});
