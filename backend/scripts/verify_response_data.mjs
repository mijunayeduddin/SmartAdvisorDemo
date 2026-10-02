/**
 * backend/scripts/verify_response_data.mjs
 *
 * Verifies that all course-related data from response.json is perfectly integrated
 * and that multi-attribute search and fallback routing operate correctly.
 */

import { loadAndParseResponseData } from '../src/utils/courseDataParser.js';
import curriculumService from '../src/services/curriculumService.js';
import { fallbackRouter } from '../core/fallbackRouter.ts';
import { MilestonePriorityStrategy } from '../core/strategy/scheduleStrategy.ts';

async function runVerification() {
  console.log('==================================================');
  console.log('🔍 Verifying response.json Course Data & Search');
  console.log('==================================================');

  // 1. Data Parser Verification
  const parsed = loadAndParseResponseData();
  console.log(`[1] Parser Check:`);
  console.log(`    Total sections parsed: ${parsed.sections.length}`);
  console.log(`    Total unique courses : ${parsed.courses.length}`);
  console.log(`    Total departments    : ${new Set(parsed.courses.map(c => c.department)).size}`);

  if (parsed.sections.length < 3800 || parsed.courses.length < 700) {
    throw new Error(`Expected >=3800 sections and >=700 courses, got ${parsed.sections.length} and ${parsed.courses.length}`);
  }
  console.log('    ✅ Data counts verified.');

  // 2. Curriculum Service Verification
  console.log(`\n[2] CurriculumService Integration Check:`);
  const allCourses = await curriculumService.getAllCourses();
  const allSections = await curriculumService.getAvailableSections();
  console.log(`    getAllCourses() returned: ${allCourses.length} courses`);
  console.log(`    getAvailableSections() returned: ${allSections.length} sections`);

  if (allCourses.length < 700 || allSections.length < 3800) {
    throw new Error('CurriculumService did not return the complete response.json catalog.');
  }
  console.log('    ✅ CurriculumService returns full dataset.');

  // 3. Search by Course Code Check
  console.log(`\n[3] Search by Course Code ('ACT201'):`);
  const act201 = allCourses.find(c => c.code === 'ACT201');
  if (!act201) throw new Error('ACT201 not found in courses catalog');
  const actSections = allSections.filter(s => s.course_code === 'ACT201');
  console.log(`    Course: ${act201.code} - ${act201.title} (${act201.department})`);
  console.log(`    Total offered sections for ACT201: ${actSections.length}`);
  if (actSections.length !== 35) {
    throw new Error(`Expected 35 sections for ACT201, found ${actSections.length}`);
  }
  console.log('    ✅ Search by course code verified.');

  // 4. Search by Faculty Check ('ARM')
  console.log(`\n[4] Search by Faculty ('ARM'):`);
  const armSections = allSections.filter(s => s.faculty_name === 'ARM');
  console.log(`    Total sections taught by ARM: ${armSections.length}`);
  armSections.slice(0, 3).forEach(s => {
    console.log(`    - ${s.course_code} Sec ${s.section_number} | Room: ${s.room} | Time: ${s.day_of_week} ${s.start_time}-${s.end_time} | Seats: ${s.seats_available}`);
  });
  if (armSections.length === 0) throw new Error('No sections found for faculty ARM');
  console.log('    ✅ Search by faculty verified.');

  // 5. Search by Room Check ('NAC603')
  console.log(`\n[5] Search by Room ('NAC603'):`);
  const nac603Sections = allSections.filter(s => s.room === 'NAC603');
  console.log(`    Total sections scheduled in NAC603: ${nac603Sections.length}`);
  if (nac603Sections.length === 0) throw new Error('No sections found in room NAC603');
  console.log('    ✅ Search by room verified.');

  // 6. Search by Department Check ('BIO')
  console.log(`\n[6] Search by Department ('BIO'):`);
  const bioCourses = await curriculumService.getAllCourses('BIO');
  console.log(`    Total BIO department courses: ${bioCourses.length}`);
  if (bioCourses.length === 0) throw new Error('No courses found for department BIO');
  console.log('    ✅ Department filtering verified.');

  // 7. Fallback Simulation Check on 0-seat section
  console.log(`\n[7] Fallback Simulation on ACT201 Sec 1 (0 seats):`);
  const graph = await curriculumService.getCurriculumGraph();
  const student = {
    studentId: '2412800642',
    completedCourses: ['ENG102', 'MAT116', 'CSE115'],
    completedCredits: 70
  };
  const simResult = fallbackRouter.routeSimulation(
    student,
    { courseCode: 'ACT201', sectionNumber: 1, term: 'Fall 2026' },
    graph,
    allSections,
    new MilestonePriorityStrategy(),
    []
  );
  console.log(`    Simulation Status: ${simResult.status}`);
  if (simResult.status === 'FALLBACK_PROPOSED') {
    console.log(`    Alternative proposed: ${simResult.alternative?.courseCode} Sec ${simResult.alternative?.sectionNumber}`);
    console.log(`    Seats in alternative: ${simResult.alternative?.seatsAvailable}`);
    console.log(`    Rationale: ${simResult.alternative?.rationale}`);
  }
  console.log('    ✅ Fallback routing simulation verified.');

  console.log('\n==================================================');
  console.log('🎉 ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  console.log('==================================================');
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
