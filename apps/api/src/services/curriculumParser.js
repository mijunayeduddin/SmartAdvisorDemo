const fs = require('fs');

const GEN_ED_DEPTS = new Set(['ENG', 'PHI', 'LBA', 'POL', 'ECO', 'SOC', 'ENV', 'ANT', 'BIO']);
const MATH_SCI_DEPTS = new Set(['MAT', 'PHY', 'CHE']);
const ENG_FOUND_DEPTS = new Set(['EEE', 'CEE', 'ETE']);

/**
 * Derives course curriculum group based on course code, raw type string, and program.
 * Rules for CSE:
 * - CSE Electives: Type contains "Elective", plus CSE419 and CSE440
 * - General Education: department in ENG, PHI, LBA, POL, ECO, SOC, ENV, ANT, BIO
 * - Math & Science: MAT, PHY, CHE
 * - Engineering Foundation: EEE, CEE, ETE
 * - CSE Core: everything else
 * Rules for BBA:
 * - General Education: GED, GED Foundation (Waivable), GED electives
 * - School Core: School Core
 * - BBA Core: BBA Core
 * - Internship: Internship
 * - Major Core: Major Core (...)
 * - Major Elective: Major Elective (...)
 */
function deriveGroup(code, type, program = 'CSE') {
  const normProg = (program || 'CSE').toUpperCase();
  const rawType = (type || '').trim();

  if (normProg === 'BBA' || normProg === 'MIC') {
    if (/^GED/i.test(rawType)) {
      return 'General Education';
    }
    if (/^School Core/i.test(rawType)) {
      return 'School Core';
    }
    if (/^BBA Core/i.test(rawType)) {
      return 'BBA Core';
    }
    if (/^Internship/i.test(rawType)) {
      return 'Internship';
    }
    if (/^Major Core/i.test(rawType)) {
      return 'Major Core';
    }
    if (/^Major Elective/i.test(rawType) || /^Elective/i.test(rawType)) {
      return 'Major Elective';
    }
    return 'General Education';
  }

  const normalizedCode = (code || '').replace(/\s+/g, '').toUpperCase();

  if (
    /Elective/i.test(rawType) ||
    normalizedCode === 'CSE419' ||
    normalizedCode === 'CSE440'
  ) {
    return 'CSE Electives';
  }

  const deptMatch = normalizedCode.match(/^([A-Z]{3})/);
  const dept = deptMatch ? deptMatch[1] : '';

  if (GEN_ED_DEPTS.has(dept)) {
    return 'General Education';
  }
  if (MATH_SCI_DEPTS.has(dept)) {
    return 'Math & Science';
  }
  if (ENG_FOUND_DEPTS.has(dept)) {
    return 'Engineering Foundation';
  }

  return 'CSE Core';
}

/**
 * Parses Type column into waivable, elective_pool, note, and majors.
 */
function parseTypeDetails(rawType, program = 'CSE') {
  const normProg = (program || 'CSE').toUpperCase();
  const type = (rawType || '').trim();

  if (normProg !== 'BBA' && normProg !== 'MIC') {
    return {
      waivable: false,
      elective_pool: null,
      note: null,
      majors: [],
    };
  }

  let waivable = false;
  if (/Foundation\s*\(Waivable\)/i.test(type)) {
    waivable = true;
  }

  let elective_pool = null;
  if (/History Elective/i.test(type)) {
    elective_pool = 'History';
  } else if (/Political Science Elective/i.test(type)) {
    elective_pool = 'Political Science';
  } else if (/Social Science Elective/i.test(type)) {
    elective_pool = 'Social Science';
  } else if (/Science Elective/i.test(type)) {
    elective_pool = 'Science';
  }

  let note = null;
  const noteMatch = type.match(/\((For\s+[^)]+)\)/i);
  if (noteMatch) {
    note = noteMatch[1].trim(); // e.g. "For 143-162"
  } else if (/For\s+143-162/i.test(type)) {
    note = 'For 143-162';
  }

  const majors = [];
  const majorMatch = type.match(/Major\s+(Core|Elective)\s*\(([A-Z]{3})\)/i);
  if (majorMatch) {
    const kind = majorMatch[1].toLowerCase(); // 'core' or 'elective'
    const major = majorMatch[2].toUpperCase();
    majors.push({ major, kind });
  }

  return {
    waivable,
    elective_pool,
    note,
    majors,
  };
}

/**
 * Parses mixed Code and Name column into primary code, aliases, and clean name.
 * Handles:
 * - Lab suffix (e.g. CSE 115L, BIO 103L)
 * - No space (e.g. CSE499A)
 * - Alternates joined by / (e.g. EEE 111/ ETE 111, CSE 325/CSE 425, ENV 203/GEO 205)
 * - Dual code each with own name: "PHI 401 Business Ethics / PHI 104 Introduction to Ethics"
 * - Duplicate codes at start of name (e.g. CSE 424 CSE 424 Object-Oriented...)
 * - Removes "(EEE 154)" from CEE 110 name
 */
function parseCodeAndName(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Invalid code and name string');
  }

  const trimmed = raw.trim();

  // Dual code and dual name pattern: e.g. "PHI 401 Business Ethics / PHI 104 Introduction to Ethics"
  const dualCodeNameMatch = trimmed.match(/^([A-Z]{3}\s*\d{3}[A-Z]?)\s+([^/]+?)\s*\/\s*([A-Z]{3}\s*\d{3}[A-Z]?)\s+(.+)$/);
  if (dualCodeNameMatch) {
    const code1 = dualCodeNameMatch[1].replace(/\s+/g, '').toUpperCase();
    const name1 = dualCodeNameMatch[2].trim();
    const code2 = dualCodeNameMatch[3].replace(/\s+/g, '').toUpperCase();
    const name2 = dualCodeNameMatch[4].trim();
    return {
      primaryCode: code1,
      aliases: [code2],
      name: `${name1} / ${name2}`,
    };
  }

  // Extract initial course code sequence: [A-Z]{3}\s*\d{3}[A-Z]? joined by /
  const prefixMatch = trimmed.match(/^([A-Z]{3}\s*\d{3}[A-Z]?(?:\s*\/\s*[A-Z]{3}\s*\d{3}[A-Z]?)*\b)(.*)$/s);
  if (!prefixMatch) {
    throw new Error(`Could not parse code and name from: "${raw}"`);
  }

  const prefix = prefixMatch[1];
  let name = prefixMatch[2].trim();

  const codeRegex = /([A-Z]{3})\s*(\d{3}[A-Z]?)/g;
  const codes = [];
  let m;
  while ((m = codeRegex.exec(prefix)) !== null) {
    codes.push((m[1] + m[2]).toUpperCase());
  }

  if (codes.length === 0) {
    throw new Error(`No valid course code found in: "${raw}"`);
  }

  const primaryCode = codes[0];
  const aliases = codes.slice(1);

  // Strip duplicate code if name repeats it (e.g. "CSE 424 CSE 424 Object-Oriented...")
  const allCodes = [primaryCode, ...aliases];
  for (const c of allCodes) {
    const dept = c.slice(0, 3);
    const num = c.slice(3);
    const codePat = new RegExp('^' + dept + '\\s*' + num + '\\b', 'i');
    while (codePat.test(name)) {
      name = name.replace(codePat, '').trim();
    }
  }

  // Remove "(EEE 154)" from CEE 110 name
  name = name.replace(/\(EEE\s*154\)/i, '').trim();

  // Strip leading punctuation/dashes
  name = name.replace(/^[-–—:\s]+/, '').trim();

  return { primaryCode, aliases, name };
}

/**
 * Parses free text prerequisites into structured data.
 */
function parsePrerequisites(rawPrereq, aliasMap = new Map(), knownCodes = new Set(), program = 'CSE') {
  const normProg = (program || 'CSE').toUpperCase();
  const text = (rawPrereq || '').trim();
  if (!text || text.toLowerCase() === 'none') {
    return {
      min_credits: 0,
      has_alternative: false,
      has_waiver_option: false,
      special: null,
      coreq_codes: [],
      prereqGroups: [],
      unknown_prereqs: [],
      raw_prereq: text || 'None',
    };
  }

  // 1. Check special "Completion of all coursework" (BUS498)
  if (/completion\s+of\s+all\s+coursework/i.test(text)) {
    return {
      min_credits: 0,
      has_alternative: false,
      has_waiver_option: false,
      special: 'ALL_COURSEWORK',
      coreq_codes: [],
      prereqGroups: [],
      unknown_prereqs: [],
      raw_prereq: text,
    };
  }

  // 2. Check co-requisite (e.g. "BIO 103 (Co-requisite)")
  const coreq_codes = [];
  const coreqMatch = text.match(/([A-Z]{3})\s*(\d{3}[A-Z]?)\s*\(Co-requisite\)/i);
  if (coreqMatch) {
    const rawCoreqCode = (coreqMatch[1] + coreqMatch[2]).toUpperCase();
    const resolvedCoreqCode = aliasMap.get(rawCoreqCode) || rawCoreqCode;
    coreq_codes.push(resolvedCoreqCode);
    return {
      min_credits: 0,
      has_alternative: false,
      has_waiver_option: false,
      special: null,
      coreq_codes,
      prereqGroups: [],
      unknown_prereqs: [],
      raw_prereq: text,
    };
  }

  // 3. Min credits check: e.g. "Completion of 100 credits" or "completion of 60 credits"
  let min_credits = 0;
  const creditsMatch = text.match(/completion\s+of\s+(?:at\s+least\s+)?(\d+)\s+credit/i);
  if (creditsMatch) {
    min_credits = parseInt(creditsMatch[1], 10);
  }

  // 4. has_waiver_option check
  const has_waiver_option = /\/waiver/i.test(text);

  // 5. has_alternative check (for CSE)
  const has_alternative = /(\/waiver|or\s+consent\s+(?:of|from)\s+(?:the\s+)?instructor|or\s+an\s+adequate\s+test\s+score)/i.test(text);

  // 6. Clean text for course code extraction
  let cleanText = text
    .replace(/and\s+consent\s+(?:of|from)\s+(?:the\s+)?instructor/gi, '')
    .replace(/and\s+Physics\s+in\s+HSC\/A\s+Level\.?/gi, '')
    .replace(/\/waiver/gi, '')
    .replace(/or\s+consent\s+(?:of|from)\s+(?:the\s+)?instructor/gi, '')
    .replace(/or\s+an\s+adequate\s+test\s+score/gi, '');

  if (/completion\s+of\s+(?:at\s+least\s+)?\d+\s+credit/i.test(text)) {
    const codeMatch = cleanText.match(/[A-Z]{3}\s*\d{3}[A-Z]?/);
    if (!codeMatch) {
      return {
        min_credits,
        has_alternative,
        has_waiver_option,
        special: null,
        coreq_codes: [],
        prereqGroups: [],
        unknown_prereqs: [],
        raw_prereq: text,
      };
    }
  }

  // 7. Split on commas, semicolons, and "and" for AND-groups
  const andParts = cleanText.split(/[,;]|\band\b/i);
  const prereqGroups = [];
  const unknownPrereqsSet = new Set();

  for (const part of andParts) {
    const orParts = part.split(/[\/]|\bor\b/i);
    const groupAlts = [];

    for (const orPart of orParts) {
      const codeRegex = /([A-Z]{3})\s*(\d{3}[A-Z]?)/g;
      let m;
      while ((m = codeRegex.exec(orPart)) !== null) {
        const rawFoundCode = (m[1] + m[2]).toUpperCase();
        const resolvedCode = aliasMap.get(rawFoundCode) || rawFoundCode;
        if (knownCodes.has(rawFoundCode) || knownCodes.has(resolvedCode)) {
          if (!groupAlts.includes(resolvedCode)) {
            groupAlts.push(resolvedCode);
          }
        } else {
          unknownPrereqsSet.add(rawFoundCode);
        }
      }
    }

    if (groupAlts.length > 0) {
      prereqGroups.push(groupAlts);
    }
  }

  return {
    min_credits,
    has_alternative,
    has_waiver_option,
    special: null,
    coreq_codes,
    prereqGroups,
    unknown_prereqs: Array.from(unknownPrereqsSet),
    raw_prereq: text,
  };
}

/**
 * Standard CSV line parser that respects quoted commas and double quotes.
 */
function parseCsvLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Checks for circular prerequisite dependencies using DFS.
 * Throws an Error with cycle path if a cycle is detected.
 */
function checkPrerequisiteCycles(courses) {
  const adj = new Map();
  for (const c of courses) {
    adj.set(c.code, []);
  }

  for (const c of courses) {
    for (const group of c.prereqGroups || []) {
      for (const reqCode of group) {
        if (adj.has(reqCode)) {
          adj.get(c.code).push(reqCode);
        }
      }
    }
  }

  const visited = new Map(); // 0 = unvisited, 1 = visiting, 2 = visited

  function dfs(u, path) {
    visited.set(u, 1);
    path.push(u);

    for (const v of adj.get(u) || []) {
      if (visited.get(v) === 1) {
        const cycleStartIndex = path.indexOf(v);
        const cyclePath = [...path.slice(cycleStartIndex), v].join(' -> ');
        throw new Error(`Prerequisite cycle detected: ${cyclePath}`);
      }
      if (!visited.has(v) || visited.get(v) === 0) {
        dfs(v, path);
      }
    }

    path.pop();
    visited.set(u, 2);
  }

  for (const c of courses) {
    if (!visited.has(c.code) || visited.get(c.code) === 0) {
      dfs(c.code, []);
    }
  }

  return true;
}

/**
 * Generic Curriculum CSV parser that handles both CSE and BBA programs.
 * Signature supports:
 * - parseCurriculumCsv(contentOrPath, program = 'CSE')
 * - parseCurriculumCsv(program, contentOrPath)
 */
function parseCurriculumCsv(arg1, arg2) {
  let program = 'CSE';
  let contentOrPath;

  if (typeof arg1 === 'string' && (arg1.toUpperCase() === 'CSE' || arg1.toUpperCase() === 'BBA' || arg1.toUpperCase() === 'MIC')) {
    program = arg1.toUpperCase();
    contentOrPath = arg2;
  } else {
    contentOrPath = arg1;
    if (arg2 && typeof arg2 === 'string') {
      program = arg2.toUpperCase();
    }
  }

  let content = contentOrPath;
  if (typeof contentOrPath === 'string' && fs.existsSync(contentOrPath)) {
    content = fs.readFileSync(contentOrPath, 'utf8');
  }

  const lines = (content || '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Pass 1: Parse rows & extract codes, merging duplicate codes (e.g. HRM370, MKT382)
  const rawRows = [];
  const rawRowsByCode = new Map();
  const aliasMap = new Map();
  const knownCodes = new Set();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    // Skip empty row
    if (!cols[0] && !cols[1] && !cols[2] && (!cols[3] || cols[3].toLowerCase() === 'none')) {
      continue;
    }
    if (!cols[0]) continue;

    const rawCodeName = cols[0];
    const rawType = cols[1] || '';
    const credits = parseFloat(cols[2]) || 0;
    const rawPrereq = cols[3] || 'None';

    const { primaryCode, aliases, name } = parseCodeAndName(rawCodeName);
    const grp = deriveGroup(primaryCode, rawType, program);
    const typeDetails = parseTypeDetails(rawType, program);

    aliasMap.set(primaryCode, primaryCode);
    knownCodes.add(primaryCode);
    for (const a of aliases) {
      aliasMap.set(a, primaryCode);
      knownCodes.add(a);
    }

    if (rawRowsByCode.has(primaryCode)) {
      // Duplicate row (e.g. HRM370, MKT382 in BBA)
      const existing = rawRowsByCode.get(primaryCode);
      for (const m of typeDetails.majors) {
        if (!existing.majors.some((em) => em.major === m.major && em.kind === m.kind)) {
          existing.majors.push(m);
        }
      }
      if (typeDetails.waivable) existing.waivable = true;
      if (typeDetails.elective_pool) existing.elective_pool = typeDetails.elective_pool;
      if (typeDetails.note) existing.note = typeDetails.note;
      // If one of the rows was Major Core, prioritize Major Core for default grp
      if (grp === 'Major Core') existing.grp = 'Major Core';
    } else {
      const rowItem = {
        primaryCode,
        aliases,
        name,
        credits,
        grp,
        rawPrereq,
        waivable: typeDetails.waivable,
        elective_pool: typeDetails.elective_pool,
        note: typeDetails.note,
        majors: typeDetails.majors,
      };
      rawRows.push(rowItem);
      rawRowsByCode.set(primaryCode, rowItem);
    }
  }

  // Pass 2: Parse prerequisites
  const courses = rawRows.map((row) => {
    const prereqData = parsePrerequisites(row.rawPrereq, aliasMap, knownCodes, program);
    return {
      program,
      code: row.primaryCode,
      aliases: row.aliases,
      name: row.name,
      credits: row.credits,
      grp: row.grp,
      min_credits: prereqData.min_credits,
      has_alternative: prereqData.has_alternative,
      has_waiver_option: prereqData.has_waiver_option,
      special: prereqData.special,
      coreq_codes: prereqData.coreq_codes,
      raw_prereq: prereqData.raw_prereq,
      unknown_prereqs: prereqData.unknown_prereqs,
      prereqGroups: prereqData.prereqGroups,
      waivable: row.waivable,
      elective_pool: row.elective_pool,
      note: row.note,
      majors: row.majors,
    };
  });

  // Prerequisite cycle check
  checkPrerequisiteCycles(courses);

  return courses;
}

module.exports = {
  deriveGroup,
  parseTypeDetails,
  parseCodeAndName,
  parsePrerequisites,
  parseCsvLine,
  checkPrerequisiteCycles,
  parseCurriculumCsv,
};
