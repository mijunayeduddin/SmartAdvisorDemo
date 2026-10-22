/**
 * Central Program Degree Requirements Configuration
 * The graduation credit requirement per program:
 * - CSE: 138 credits (confirmed by product owner)
 * - BBA: 130 credits (confirmed by product owner)
 *
 * This is the SINGLE SOURCE OF TRUTH for program graduation requirements.
 * Any new program or credit requirement change only needs an edit here.
 */
const PROGRAMS_CONFIG = {
  CSE: {
    id: 'CSE',
    name: 'Computer Science and Engineering',
    requiredCredits: 138,
  },
  BBA: {
    id: 'BBA',
    name: 'Bachelor of Business Administration',
    requiredCredits: 130,
  },
  MIC: {
    id: 'MIC',
    name: 'Bachelor of Science in Microbiology',
    requiredCredits: 120,
  },
};

function getProgramConfig(program) {
  const norm = (program || 'CSE').trim().toUpperCase();
  return PROGRAMS_CONFIG[norm] || { id: norm, requiredCredits: 138 };
}

module.exports = {
  PROGRAMS_CONFIG,
  getProgramConfig,
};
