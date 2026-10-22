const { query } = require('../db/pool');
const { getCache, setCache } = require('../cache/redisClient');
const { getProgramConfig } = require('../config/programs');

const CURRICULUM_CACHE_TTL = 600; // 10 minutes

const CSE_GROUP_ORDER = [
  'General Education',
  'Math & Science',
  'Engineering Foundation',
  'CSE Core',
  'CSE Electives',
];

const BBA_GROUP_ORDER = [
  'General Education',
  'School Core',
  'BBA Core',
  'Major Core',
  'Major Elective',
  'Internship',
];

const MIC_GROUP_ORDER = [
  'General Education',
  'School Core',
  'Major Core',
  'Major Elective',
];

/**
 * Returns available curriculum programs and course counts.
 * [{ id: "CSE", courses: 88, requiredCredits: 138, catalogCredits: 238 }, { id: "BBA", courses: 124, requiredCredits: 130, catalogCredits: 361 }]
 */
async function getPrograms() {
  const result = await query(`
    SELECT program AS id, COUNT(*)::int AS courses, COALESCE(SUM(credits), 0)::float AS catalog_credits
    FROM curriculum_courses
    GROUP BY program
    ORDER BY CASE WHEN program = 'CSE' THEN 1 ELSE 2 END, program
  `);
  return result.rows.map((row) => {
    const config = getProgramConfig(row.id);
    return {
      id: row.id,
      courses: row.courses,
      requiredCredits: config.requiredCredits,
      catalogCredits: Math.round(row.catalog_credits * 10) / 10,
    };
  });
}

/**
 * Loads all curriculum courses with their prerequisite groups, majors, and section stats for a program.
 * Cached in Redis for 10 minutes.
 */
async function getCurriculum(program = 'CSE') {
  const normProg = (program || 'CSE').trim().toUpperCase();
  const cacheKey = `curriculum:v2:${normProg}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  // 1. Fetch courses
  const coursesResult = await query(
    `
    SELECT 
      program,
      code,
      aliases,
      name,
      credits::float AS credits,
      grp,
      min_credits,
      has_alternative,
      has_waiver_option,
      waivable,
      elective_pool,
      note,
      special,
      coreq_codes,
      raw_prereq,
      unknown_prereqs
    FROM curriculum_courses
    WHERE program = $1
    ORDER BY grp, code
  `,
    [normProg]
  );

  // 2. Fetch prerequisites
  const prereqsResult = await query(
    `
    SELECT 
      course_code,
      group_no,
      alt_code
    FROM curriculum_prereqs
    WHERE program = $1
    ORDER BY course_code, group_no, alt_code
  `,
    [normProg]
  );

  const prereqMap = new Map();
  for (const row of prereqsResult.rows) {
    if (!prereqMap.has(row.course_code)) {
      prereqMap.set(row.course_code, new Map());
    }
    const courseGroups = prereqMap.get(row.course_code);
    if (!courseGroups.has(row.group_no)) {
      courseGroups.set(row.group_no, []);
    }
    courseGroups.get(row.group_no).push(row.alt_code);
  }

  // 3. Fetch course majors
  const majorsResult = await query(
    `
    SELECT 
      code,
      major,
      kind
    FROM curriculum_course_majors
    WHERE program = $1
    ORDER BY code, major, kind
  `,
    [normProg]
  );

  const majorsMap = new Map();
  for (const row of majorsResult.rows) {
    if (!majorsMap.has(row.code)) {
      majorsMap.set(row.code, []);
    }
    majorsMap.get(row.code).push({ major: row.major, kind: row.kind });
  }

  // 4. Fetch section stats from sections table
  const sectionStatsResult = await query(`
    SELECT 
      course,
      COUNT(*)::int AS section_count,
      COALESCE(SUM(CASE WHEN seats > 0 THEN 1 ELSE 0 END), 0)::int AS open_section_count
    FROM sections
    GROUP BY course
  `);

  const sectionStatsMap = new Map();
  for (const row of sectionStatsResult.rows) {
    const cleanCourse = (row.course || '').replace(/\s+/g, '').toUpperCase();
    const existing = sectionStatsMap.get(cleanCourse) || { sectionCount: 0, openSectionCount: 0 };
    sectionStatsMap.set(cleanCourse, {
      sectionCount: existing.sectionCount + row.section_count,
      openSectionCount: existing.openSectionCount + row.open_section_count,
    });
  }

  // 5. Assemble courses
  const groupOrder = normProg === 'BBA' ? BBA_GROUP_ORDER : (normProg === 'MIC' ? MIC_GROUP_ORDER : CSE_GROUP_ORDER);
  const allCourses = [];
  const grouped = {};
  for (const g of groupOrder) {
    grouped[g] = [];
  }

  let totalCredits = 0;

  for (const row of coursesResult.rows) {
    const courseCode = row.code;
    const aliases = row.aliases || [];
    const credits = parseFloat(row.credits) || 0;
    totalCredits += credits;

    // Build prereqGroups
    const courseGroups = prereqMap.get(courseCode);
    let prereqGroups = [];
    if (courseGroups) {
      const sortedGroupNos = Array.from(courseGroups.keys()).sort((a, b) => a - b);
      prereqGroups = sortedGroupNos.map((no) => courseGroups.get(no));
    }

    // Majors
    const courseMajors = majorsMap.get(courseCode) || [];

    // Section stats matching code OR any alias
    const allMatchingCodes = [courseCode, ...aliases];
    let sectionCount = 0;
    let openSectionCount = 0;
    let searchCode = courseCode;
    let maxSections = -1;

    for (const code of allMatchingCodes) {
      const clean = code.replace(/\s+/g, '').toUpperCase();
      const stats = sectionStatsMap.get(clean);
      if (stats) {
        sectionCount += stats.sectionCount;
        openSectionCount += stats.openSectionCount;
        if (stats.sectionCount > maxSections) {
          maxSections = stats.sectionCount;
          searchCode = code;
        }
      }
    }

    const courseObj = {
      program: normProg,
      code: courseCode,
      aliases,
      name: row.name,
      credits,
      grp: row.grp,
      prereqGroups,
      prereqs: prereqGroups,
      coreq_codes: row.coreq_codes || [],
      coreqCodes: row.coreq_codes || [],
      min_credits: row.min_credits,
      minCredits: row.min_credits,
      has_alternative: row.has_alternative || false,
      hasAlternative: row.has_alternative || false,
      has_waiver_option: row.has_waiver_option || false,
      hasWaiverOption: row.has_waiver_option || false,
      waivable: row.waivable || false,
      elective_pool: row.elective_pool || null,
      electivePool: row.elective_pool || null,
      note: row.note || null,
      special: row.special || null,
      majors: courseMajors,
      raw_prereq: row.raw_prereq,
      rawPrereq: row.raw_prereq,
      unknown_prereqs: row.unknown_prereqs || [],
      unknownPrereqs: row.unknown_prereqs || [],
      sectionCount,
      openSectionCount,
      searchCode,
    };

    allCourses.push(courseObj);
    if (!grouped[row.grp]) {
      grouped[row.grp] = [];
    }
    grouped[row.grp].push(courseObj);
  }

  const programConfig = getProgramConfig(normProg);
  const catalogCredits = Math.round(totalCredits * 10) / 10;

  const payload = {
    program: normProg,
    groups: grouped,
    ...grouped,
    totalCourses: allCourses.length,
    totalCredits: catalogCredits,
    catalogCredits,
    requiredCredits: programConfig.requiredCredits,
    courses: allCourses,
  };

  // Cache in Redis for 10 minutes
  await setCache(cacheKey, payload, CURRICULUM_CACHE_TTL);

  return { ...payload, fromCache: false };
}

/**
 * Validates completed and waived course lists for a program.
 */
async function validateCompletedAndWaivedList(completed = [], waived = [], program = 'CSE') {
  const normProg = (program || 'CSE').trim().toUpperCase();

  if (!Array.isArray(completed)) {
    return { valid: false, error: 'The completed field must be an array of course codes.' };
  }
  if (!Array.isArray(waived)) {
    return { valid: false, error: 'The waived field must be an array of course codes.' };
  }

  if (completed.length > 200) {
    return { valid: false, error: 'The completed courses array cannot exceed 200 items.' };
  }
  if (waived.length > 200) {
    return { valid: false, error: 'The waived courses array cannot exceed 200 items.' };
  }

  // Get known courses for program
  const { courses } = await getCurriculum(normProg);
  const knownMap = new Map();
  const waivableSet = new Set();

  for (const c of courses) {
    knownMap.set(c.code.toUpperCase(), c);
    for (const a of c.aliases || []) {
      knownMap.set(a.toUpperCase(), c);
    }
    // Check if course is waivable or referenced with /Waiver
    if (c.waivable) {
      waivableSet.add(c.code.toUpperCase());
      for (const a of c.aliases || []) {
        waivableSet.add(a.toUpperCase());
      }
    }
  }

  // Courses listed with /Waiver in other courses can also be waived
  for (const c of courses) {
    if (c.raw_prereq && /\/waiver/i.test(c.raw_prereq)) {
      const match = c.raw_prereq.match(/([A-Z]{3})\s*(\d{3}[A-Z]?)\s*\/waiver/i);
      if (match) {
        const waiverCode = (match[1] + match[2]).toUpperCase();
        waivableSet.add(waiverCode);
        const resolved = knownMap.get(waiverCode);
        if (resolved) {
          waivableSet.add(resolved.code.toUpperCase());
          for (const a of resolved.aliases || []) {
            waivableSet.add(a.toUpperCase());
          }
        }
      }
    }
  }

  const normalizedCompleted = [];
  for (const item of completed) {
    if (typeof item !== 'string') {
      return { valid: false, error: `Invalid course code: ${item}` };
    }
    const clean = item.replace(/\s+/g, '').toUpperCase();
    if (!clean) continue;
    if (!knownMap.has(clean)) {
      return { valid: false, error: `Unknown course code: "${item}". Must be a valid ${normProg} curriculum course or alias.` };
    }
    normalizedCompleted.push(clean);
  }

  const normalizedWaived = [];
  for (const item of waived) {
    if (typeof item !== 'string') {
      return { valid: false, error: `Invalid waived course code: ${item}` };
    }
    const clean = item.replace(/\s+/g, '').toUpperCase();
    if (!clean) continue;
    if (!knownMap.has(clean)) {
      return { valid: false, error: `Unknown waived course code: "${item}". Must be a valid ${normProg} curriculum course or alias.` };
    }
    if (!waivableSet.has(clean)) {
      return { valid: false, error: `Course "${item}" cannot be waived. Only courses with waivable option can be waived.` };
    }
    normalizedWaived.push(clean);
  }

  return {
    valid: true,
    normalized: normalizedCompleted,
    normalizedCompleted,
    normalizedWaived,
  };
}

/**
 * Calculates eligibility and completion status for every curriculum course in a program.
 * Supports both signatures:
 * - calculateStatus({ program, completed, waived, major })
 * - calculateStatus(completedList, waivedList, program, major)
 */
async function calculateStatus(arg1 = [], arg2 = [], arg3 = 'CSE', arg4 = null) {
  let normProg = 'CSE';
  let completedList = [];
  let waivedList = [];
  let major = null;

  if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
    normProg = (arg1.program || 'CSE').trim().toUpperCase();
    completedList = Array.isArray(arg1.completed) ? arg1.completed : [];
    waivedList = Array.isArray(arg1.waived) ? arg1.waived : [];
    major = arg1.major || null;
  } else {
    completedList = Array.isArray(arg1) ? arg1 : [];
    waivedList = Array.isArray(arg2) ? arg2 : [];
    if (typeof arg3 === 'string') normProg = arg3.trim().toUpperCase();
    if (typeof arg4 === 'string') major = arg4.trim().toUpperCase();
  }

  const { courses, totalCredits: fullTotalCredits } = await getCurriculum(normProg);

  const completedSet = new Set();
  for (const item of completedList) {
    if (typeof item === 'string') {
      completedSet.add(item.replace(/\s+/g, '').toUpperCase());
    }
  }

  const waivedSet = new Set();
  for (const item of waivedList) {
    if (typeof item === 'string') {
      waivedSet.add(item.replace(/\s+/g, '').toUpperCase());
    }
  }

  // 1. Identify completed and waived courses and sum completedCredits
  const doneCourseCodes = new Set();
  const waivedCourseCodes = new Set();
  let completedCredits = 0;

  for (const c of courses) {
    const isPrimaryDone = completedSet.has(c.code.toUpperCase());
    const isAliasDone = (c.aliases || []).some((a) => completedSet.has(a.toUpperCase()));

    if (isPrimaryDone || isAliasDone) {
      doneCourseCodes.add(c.code);
      completedCredits += c.credits;
    } else {
      const isPrimaryWaived = waivedSet.has(c.code.toUpperCase());
      const isAliasWaived = (c.aliases || []).some((a) => waivedSet.has(a.toUpperCase()));
      if (isPrimaryWaived || isAliasWaived) {
        waivedCourseCodes.add(c.code);
      }
    }
  }

  completedCredits = Math.round(completedCredits * 10) / 10;

  const formatCode = (code) => code.replace(/([A-Z]{3})(\d+.*)/, '$1 $2');

  // 2. Evaluate status for every course
  const courseStatusMap = {};
  const courseStatusList = [];

  for (const c of courses) {
    const isDone = doneCourseCodes.has(c.code);
    const isWaived = waivedCourseCodes.has(c.code);

    if (isDone) {
      const item = {
        code: c.code,
        status: 'done',
        missing: null,
        creditsNeeded: 0,
        creditsCompleted: completedCredits,
      };
      courseStatusMap[c.code] = item;
      courseStatusList.push(item);
      continue;
    }

    if (isWaived) {
      const item = {
        code: c.code,
        status: 'waived',
        missing: null,
        creditsNeeded: 0,
        creditsCompleted: completedCredits,
      };
      courseStatusMap[c.code] = item;
      courseStatusList.push(item);
      continue;
    }

    // Check special "ALL_COURSEWORK" (BUS498)
    if (c.special === 'ALL_COURSEWORK') {
      const item = {
        code: c.code,
        status: 'maybe',
        missing: 'Requires completion of all coursework. Confirm with your advisor.',
        creditsNeeded: 0,
        creditsCompleted: completedCredits,
      };
      courseStatusMap[c.code] = item;
      courseStatusList.push(item);
      continue;
    }

    // Check prerequisite groups
    const unsatisfiedGroups = [];
    const prereqGroups = c.prereqGroups || [];

    for (const group of prereqGroups) {
      // Group is satisfied if ANY altCode is in done or waived
      const groupSatisfied = group.some((altCode) => {
        const cleanAlt = altCode.replace(/\s+/g, '').toUpperCase();
        return (
          doneCourseCodes.has(cleanAlt) ||
          completedSet.has(cleanAlt) ||
          waivedCourseCodes.has(cleanAlt) ||
          waivedSet.has(cleanAlt)
        );
      });

      if (!groupSatisfied) {
        unsatisfiedGroups.push(group);
      }
    }

    const prereqsSatisfied = unsatisfiedGroups.length === 0;
    const creditsNeeded = Math.max(0, (c.min_credits || 0) - completedCredits);
    const creditsSatisfied = creditsNeeded === 0;

    let status = 'locked';
    if (prereqsSatisfied && creditsSatisfied) {
      status = 'available';
    } else if (c.has_waiver_option || c.has_alternative) {
      status = 'maybe';
    } else {
      status = 'locked';
    }

    let missing = null;
    if (status !== 'available' && status !== 'done' && status !== 'waived') {
      const missingParts = [];

      for (const group of unsatisfiedGroups) {
        const formattedAlts = group.map(formatCode).join(' or ');
        missingParts.push(formattedAlts);
      }

      if (creditsNeeded > 0) {
        if (missingParts.length > 0) {
          missingParts.push(`need ${creditsNeeded} more credit${creditsNeeded === 1 ? '' : 's'}`);
        } else {
          missingParts.push(`Need ${creditsNeeded} more credit${creditsNeeded === 1 ? '' : 's'} (${c.min_credits} credits required)`);
        }
      }

      missing = missingParts.join(', ');
    }

    const item = {
      code: c.code,
      status,
      missing,
      creditsNeeded,
      creditsCompleted: completedCredits,
    };
    courseStatusMap[c.code] = item;
    courseStatusList.push(item);
  }

  const completedCourses = doneCourseCodes.size;
  const waivedCourses = waivedCourseCodes.size;
  const totalCourses = courses.length;

  const programConfig = getProgramConfig(normProg);
  const requiredCredits = programConfig.requiredCredits;
  const catalogCredits = fullTotalCredits;
  const remainingCredits = Math.max(0, Math.round((requiredCredits - completedCredits) * 10) / 10);

  const result = {
    program: normProg,
    courses: courseStatusList,
    courseMap: courseStatusMap,
    completedCredits,
    totalCredits: fullTotalCredits,
    catalogCredits,
    requiredCredits,
    remainingCredits,
    completedCourses,
    waivedCourses,
    totalCourses,
    summary: {
      completedCredits,
      totalCredits: fullTotalCredits,
      catalogCredits,
      requiredCredits,
      remainingCredits,
      completedCourses,
      waivedCourses,
      totalCourses,
    },
  };

  // 3. Compute major progress if major is specified
  if (major && typeof major === 'string' && major.trim()) {
    const normMajor = major.trim().toUpperCase();
    const majorsQueryResult = await query(
      `SELECT code, major, kind FROM curriculum_course_majors WHERE program = $1 AND major = $2`,
      [normProg, normMajor]
    );

    let coreDone = 0;
    let coreTotal = 0;
    let electiveDone = 0;
    let electiveTotal = 0;

    for (const row of majorsQueryResult.rows) {
      const isDoneOrWaived = doneCourseCodes.has(row.code) || waivedCourseCodes.has(row.code);
      if (row.kind === 'core') {
        coreTotal++;
        if (isDoneOrWaived) coreDone++;
      } else if (row.kind === 'elective') {
        electiveTotal++;
        if (isDoneOrWaived) electiveDone++;
      }
    }

    result.major = normMajor;
    result.majorProgress = {
      core: { done: coreDone, total: coreTotal },
      elective: { done: electiveDone, total: electiveTotal },
    };
  }

  return result;
}

/**
 * Returns a Set of eligible course codes whose status is 'available' for a given completed and waived list.
 */
async function getEligibleCourseCodes(completedList = [], waivedList = [], program = 'CSE') {
  const normProg = (program || 'CSE').trim().toUpperCase();
  const { courseMap } = await calculateStatus({
    program: normProg,
    completed: completedList,
    waived: waivedList,
  });
  const { courses } = await getCurriculum(normProg);

  const eligibleCodes = new Set();
  for (const c of courses) {
    const courseStatus = courseMap[c.code];
    if (courseStatus && courseStatus.status === 'available') {
      eligibleCodes.add(c.code.toUpperCase());
      for (const a of c.aliases || []) {
        eligibleCodes.add(a.toUpperCase());
      }
    }
  }

  return eligibleCodes;
}

// Backward compatibility helper
async function validateCompletedList(completed, program = 'CSE') {
  return await validateCompletedAndWaivedList(completed, [], program);
}

module.exports = {
  getPrograms,
  getCurriculum,
  calculateStatus,
  validateCompletedAndWaivedList,
  validateCompletedList,
  getEligibleCourseCodes,
  CURRICULUM_CACHE_TTL,
};
