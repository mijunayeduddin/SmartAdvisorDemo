const path = require('path');
const {
  deriveGroup,
  parseCodeAndName,
  parsePrerequisites,
  parseCurriculumCsv,
} = require('../services/curriculumParser');

describe('Curriculum Parser Unit Tests', () => {
  describe('deriveGroup', () => {
    test('CSE Electives derived from Elective in type or specific codes CSE419, CSE440', () => {
      expect(deriveGroup('CSE417', 'Elective')).toBe('CSE Electives');
      expect(deriveGroup('CSE433', 'Major Elective')).toBe('CSE Electives');
      expect(deriveGroup('CSE419', '')).toBe('CSE Electives');
      expect(deriveGroup('CSE440', '')).toBe('CSE Electives');
    });

    test('General Education derived from ENG, PHI, LBA, POL, ECO, SOC, ENV, ANT, BIO', () => {
      expect(deriveGroup('ENG102', '')).toBe('General Education');
      expect(deriveGroup('PHI101', '')).toBe('General Education');
      expect(deriveGroup('LBA101', '')).toBe('General Education');
      expect(deriveGroup('POL101', '')).toBe('General Education');
      expect(deriveGroup('ECO101', '')).toBe('General Education');
      expect(deriveGroup('SOC101', '')).toBe('General Education');
      expect(deriveGroup('ENV203', '')).toBe('General Education');
      expect(deriveGroup('ANT101', '')).toBe('General Education');
      expect(deriveGroup('BIO103', '')).toBe('General Education');
    });

    test('Math & Science derived from MAT, PHY, CHE', () => {
      expect(deriveGroup('MAT116', '')).toBe('Math & Science');
      expect(deriveGroup('PHY107', '')).toBe('Math & Science');
      expect(deriveGroup('CHE101', '')).toBe('Math & Science');
    });

    test('Engineering Foundation derived from EEE, CEE, ETE', () => {
      expect(deriveGroup('EEE141', '')).toBe('Engineering Foundation');
      expect(deriveGroup('CEE110', '')).toBe('Engineering Foundation');
      expect(deriveGroup('EEE452', 'Required, Lecture')).toBe('Engineering Foundation');
    });

    test('CSE Core is default for core engineering CSE courses', () => {
      expect(deriveGroup('CSE115', 'Core, Engineering, Lecture')).toBe('CSE Core');
      expect(deriveGroup('CSE173', 'Core')).toBe('CSE Core');
      expect(deriveGroup('CSE225', 'Mandatory')).toBe('CSE Core');
      expect(deriveGroup('CSE498', 'Required')).toBe('CSE Core');
      expect(deriveGroup('CSE499A', 'Required, Engineering, Lab')).toBe('CSE Core');
    });
  });

  describe('parseCodeAndName', () => {
    test('parses simple course code and name, normalizes code by removing spaces', () => {
      const res = parseCodeAndName('ENG 102 Introduction to Composition');
      expect(res.primaryCode).toBe('ENG102');
      expect(res.aliases).toEqual([]);
      expect(res.name).toBe('Introduction to Composition');
    });

    test('handles lab suffixes and codes without space', () => {
      const labRes = parseCodeAndName('CSE 115L Programming language I Lab');
      expect(labRes.primaryCode).toBe('CSE115L');
      expect(labRes.name).toBe('Programming language I Lab');

      const noSpaceRes = parseCodeAndName('CSE499A Senior Design I');
      expect(noSpaceRes.primaryCode).toBe('CSE499A');
      expect(noSpaceRes.name).toBe('Senior Design I');
    });

    test('handles multiple alternate codes joined by slash and spaces', () => {
      const res1 = parseCodeAndName('EEE 111/ ETE 111 Analog Electronics-I');
      expect(res1.primaryCode).toBe('EEE111');
      expect(res1.aliases).toEqual(['ETE111']);
      expect(res1.name).toBe('Analog Electronics-I');

      const res2 = parseCodeAndName('CSE 325/CSE 425 Concepts of Programming Language');
      expect(res2.primaryCode).toBe('CSE325');
      expect(res2.aliases).toEqual(['CSE425']);
      expect(res2.name).toBe('Concepts of Programming Language');

      const res3 = parseCodeAndName('CSE 498/EEE 498/ETE 498 Internship/Co-op/Directed Research');
      expect(res3.primaryCode).toBe('CSE498');
      expect(res3.aliases).toEqual(['EEE498', 'ETE498']);
      expect(res3.name).toBe('Internship/Co-op/Directed Research');
    });

    test('strips duplicate codes from course names', () => {
      const res1 = parseCodeAndName('CSE 424 CSE 424 Object-Oriented Software Developments');
      expect(res1.primaryCode).toBe('CSE424');
      expect(res1.name).toBe('Object-Oriented Software Developments');

      const res2 = parseCodeAndName('CSE 422 CSE 422 Modelling and Simulation');
      expect(res2.primaryCode).toBe('CSE422');
      expect(res2.name).toBe('Modelling and Simulation');

      const res3 = parseCodeAndName('CSE 438 CSE 438 Data Communication & Network');
      expect(res3.primaryCode).toBe('CSE438');
      expect(res3.name).toBe('Data Communication & Network');
    });

    test('removes (EEE 154) from CEE 110 name', () => {
      const res = parseCodeAndName('CEE 110 Engineering Drawing (EEE 154)');
      expect(res.primaryCode).toBe('CEE110');
      expect(res.name).toBe('Engineering Drawing');
    });
  });

  describe('parsePrerequisites', () => {
    const aliasMap = new Map([
      ['ETE111', 'EEE111'],
      ['CSE425', 'CSE325'],
      ['EEE498', 'CSE498'],
      ['ETE498', 'CSE498'],
      ['EEE499A', 'CSE499A'],
      ['ETE499A', 'CSE499A'],
    ]);

    const knownCodes = new Set([
      'ENG102', 'ENG103', 'MAT116', 'MAT120', 'MAT125', 'MAT130', 'MAT250', 'MAT361',
      'PHY107', 'PHY108', 'EEE141', 'EEE111', 'CSE115', 'CSE115L', 'CSE173', 'CSE215',
      'CSE215L', 'CSE225', 'CSE231', 'CSE311', 'CSE327', 'CSE332', 'CSE373', 'CSE413',
      'CSE440', 'CSE499A', 'CSE499B',
    ]);

    test('handles "None" as no prerequisites', () => {
      const res = parsePrerequisites('None', aliasMap, knownCodes);
      expect(res.min_credits).toBe(0);
      expect(res.has_alternative).toBe(false);
      expect(res.prereqGroups).toEqual([]);
      expect(res.unknown_prereqs).toEqual([]);
    });

    test('extracts min_credits requirements (60, 80, 100 credits)', () => {
      const r60 = parsePrerequisites('Completion of 60 credits', aliasMap, knownCodes);
      expect(r60.min_credits).toBe(60);
      expect(r60.prereqGroups).toEqual([]);

      const r80 = parsePrerequisites('Completion of 80 credits', aliasMap, knownCodes);
      expect(r80.min_credits).toBe(80);
      expect(r80.prereqGroups).toEqual([]);

      const r100 = parsePrerequisites(
        'Completion of at least 100 credit hours including all the major core courses, math and science courses, Ethics, Language and Communication related courses.',
        aliasMap,
        knownCodes
      );
      expect(r100.min_credits).toBe(100);
      expect(r100.prereqGroups).toEqual([]);
    });

    test('handles alternative phrases: /Waiver, or consent of instructor, or an adequate test score', () => {
      const rWaiver = parsePrerequisites('ENG 102/Waiver', aliasMap, knownCodes);
      expect(rWaiver.has_alternative).toBe(true);
      expect(rWaiver.prereqGroups).toEqual([['ENG102']]);

      const rScore = parsePrerequisites('MAT 116 or an adequate test score', aliasMap, knownCodes);
      expect(rScore.has_alternative).toBe(true);
      expect(rScore.prereqGroups).toEqual([['MAT116']]);

      const rConsent = parsePrerequisites('CSE 225 and MAT 361; or consent of instructor.', aliasMap, knownCodes);
      expect(rConsent.has_alternative).toBe(true);
      expect(rConsent.prereqGroups).toEqual([['CSE225'], ['MAT361']]);
    });

    test('strips "and consent of the instructor" and "and Physics in HSC/A Level"', () => {
      const rPhys = parsePrerequisites('MAT 120 and Physics in HSC/A Level.', aliasMap, knownCodes);
      expect(rPhys.prereqGroups).toEqual([['MAT120']]);
      expect(rPhys.raw_prereq).toBe('MAT 120 and Physics in HSC/A Level.');

      const rConsent = parsePrerequisites('CSE 225 and consent of the instructor.', aliasMap, knownCodes);
      expect(rConsent.prereqGroups).toEqual([['CSE225']]);
    });

    test('handles AND groups and OR alternatives', () => {
      // AND groups: commas, semicolons, "and"
      const rAnd = parsePrerequisites('CSE 225, MAT 361', aliasMap, knownCodes);
      expect(rAnd.prereqGroups).toEqual([['CSE225'], ['MAT361']]);

      // OR alternatives: / or "or"
      const rOr = parsePrerequisites('EEE111, CSE 231/EEE211', aliasMap, knownCodes);
      expect(rOr.prereqGroups).toEqual([['EEE111'], ['CSE231']]);
      expect(rOr.unknown_prereqs).toContain('EEE211');
    });

    test('collects unknown course codes that are not in the curriculum file without blocking', () => {
      const rUnknown = parsePrerequisites('MAT 240, PHY 107', aliasMap, knownCodes);
      expect(rUnknown.prereqGroups).toEqual([['PHY107']]);
      expect(rUnknown.unknown_prereqs).toEqual(['MAT240']);
    });
  });

  describe('parseCurriculumCsv from file', () => {
    test('parses data/CSE_nsu_courses.csv into exactly 88 courses across 5 groups', () => {
      const csvPath = path.resolve(__dirname, '../../../../data/CSE_nsu_courses.csv');
      const courses = parseCurriculumCsv(csvPath);

      expect(courses.length).toBe(88);

      const groups = new Set(courses.map((c) => c.grp));
      expect(groups.size).toBe(5);
      expect(groups).toContain('General Education');
      expect(groups).toContain('Math & Science');
      expect(groups).toContain('Engineering Foundation');
      expect(groups).toContain('CSE Core');
      expect(groups).toContain('CSE Electives');

      // Verify no empty code
      for (const c of courses) {
        expect(c.code).toBeTruthy();
        expect(typeof c.credits).toBe('number');
        expect(c.grp).toBeTruthy();
      }
    });
  });
});
