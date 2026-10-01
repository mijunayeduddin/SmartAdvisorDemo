-- =============================================================================
-- SmartAdvisor Database Seed Script (BSCSE Curriculum - 130 Credit Hours)
-- Mirror location: backend/db/seed.sql
-- =============================================================================

BEGIN;

-- 1. Insert Courses Catalog (37 Vertices in the Curriculum DAG)
INSERT INTO courses (code, title, credits, department, description, is_milestone)
VALUES
  ('ENG102', 'Introduction to Composition', 3.0, 'CSE', 'Basic English composition and academic writing', FALSE),
  ('MAT116', 'Pre-calculus', 0.0, 'CSE', 'Foundation algebra and trigonometry (non-credit requirement)', FALSE),
  ('CEE110', 'Basic Environmental Studies', 1.0, 'CSE', 'Introduction to environmental systems and sustainability', FALSE),
  ('CSE115', 'Programming Language I', 4.0, 'CSE', 'Structured programming concepts in C/C++', TRUE),
  ('ENG103', 'Intermediate Composition', 3.0, 'CSE', 'Intermediate critical reading and argumentation', FALSE),
  ('MAT120', 'Calculus and Analytical Geometry I', 3.0, 'CSE', 'Differential and integral calculus fundamentals', TRUE),
  ('MAT125', 'Introduction to Linear Algebra', 3.0, 'CSE', 'Matrices, vector spaces, and linear transformations', FALSE),
  ('CSE173', 'Discrete Mathematics', 3.0, 'CSE', 'Sets, logic, combinatorics, relations, and graph theory', TRUE),
  ('ENG111', 'Public Speaking', 3.0, 'CSE', 'Oral communication and presentation techniques', FALSE),
  ('MAT130', 'Calculus and Analytical Geometry II', 3.0, 'CSE', 'Advanced integration techniques and multivariate series', TRUE),
  ('PHY107', 'General Physics I', 4.0, 'CSE', 'Mechanics, waves, and thermodynamics with laboratory', FALSE),
  ('CSE215', 'Programming Language II', 4.0, 'CSE', 'Object-oriented programming concepts using Java', TRUE),
  ('PHI104', 'Introduction to Philosophy', 3.0, 'CSE', 'Ethics, epistemology, and critical thinking', FALSE),
  ('MAT250', 'Calculus and Analytical Geometry III', 3.0, 'CSE', 'Multivariable calculus, partial derivatives, multiple integrals', TRUE),
  ('PHY108', 'General Physics II', 4.0, 'CSE', 'Electricity, magnetism, and optics with laboratory', FALSE),
  ('CSE225', 'Data Structures and Algorithms', 3.0, 'CSE', 'Lists, stacks, queues, trees, sorting, and algorithmic complexity', TRUE),
  ('ENG115', 'Advanced English Composition', 3.0, 'CSE', 'Technical and professional research writing', FALSE),
  ('MAT350', 'Engineering Mathematics', 3.0, 'CSE', 'Differential equations and transform methods', FALSE),
  ('EEE141', 'Electric Circuits', 4.0, 'CSE', 'DC/AC circuit analysis and electronic components with laboratory', FALSE),
  ('CSE231', 'Digital Logic Design', 3.0, 'CSE', 'Boolean algebra, combinational and sequential circuit design', FALSE),
  ('HIS101', 'Bangladesh History and Culture', 3.0, 'CSE', 'Heritage, liberation war, and socio-political history of Bangladesh', FALSE),
  ('MAT361', 'Probability and Statistics', 3.0, 'CSE', 'Probability distributions, hypothesis testing, and regression', FALSE),
  ('CSE299', 'Junior Design Project', 1.0, 'CSE', 'Collaborative engineering design project (note: requires 60 credits completed)', FALSE),
  ('HIS102', 'Introduction to World Civilizations', 3.0, 'CSE', 'Historical developments of global civilizations', FALSE),
  ('CHE101', 'General Chemistry', 4.0, 'CSE', 'Chemical bonding, stoichiometry, and thermochemistry with laboratory', FALSE),
  ('EEE111', 'Analog Electronics', 4.0, 'CSE', 'Diodes, transistors, amplifiers, and frequency response with laboratory', FALSE),
  ('CSE332', 'Computer Organization and Architecture', 3.0, 'CSE', 'CPU architecture, instruction sets, pipelining, and memory hierarchy', FALSE),
  ('CSE311', 'Database Management Systems', 3.0, 'CSE', 'Relational data model, SQL, normalization, transactions, and indexing', TRUE),
  ('CSE323', 'Operating Systems Concepts', 3.0, 'CSE', 'Process management, synchronization, memory virtualization, file systems', FALSE),
  ('CSE373', 'Design and Analysis of Algorithms', 3.0, 'CSE', 'Divide-and-conquer, greedy, dynamic programming, NP-completeness', FALSE),
  ('BIO103', 'Biology I', 4.0, 'CSE', 'Cellular biology, genetics, and biotechnology with laboratory', FALSE),
  ('CSE327', 'Software Engineering', 3.0, 'CSE', 'Software lifecycle, design patterns, testing, and agile methodologies', TRUE),
  ('CSE331', 'Microprocessor Interfacing and Embedded Systems', 3.0, 'CSE', 'Microcontrollers, assembly language, interrupt handlers, I/O interfacing', FALSE),
  ('CSE425', 'Concepts of Programming Languages', 3.0, 'CSE', 'Language paradigms, syntax, type systems, functional and logic programming', TRUE),
  ('EEE452', 'Engineering Economics', 3.0, 'CSE', 'Cost analysis, project evaluation, time value of money, decision making', FALSE),
  ('CSE499A', 'Senior Design Project I', 1.5, 'CSE', 'Capstone research and engineering project phase I (note: requires 100 credits completed)', TRUE),
  ('CSE499B', 'Senior Design Project II', 1.5, 'CSE', 'Capstone final implementation, defense, and report', TRUE)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  credits = EXCLUDED.credits,
  department = EXCLUDED.department,
  description = EXCLUDED.description,
  is_milestone = EXCLUDED.is_milestone;

-- 2. Insert Prerequisites (DAG Directed Edges: course_id REQUIRES prereq_course_id)
WITH edge_definitions(course_code, prereq_code) AS (
  VALUES
    ('ENG103', 'ENG102'),
    ('MAT120', 'MAT116'),
    ('MAT125', 'MAT116'),
    ('CSE173', 'CSE115'),
    ('MAT130', 'MAT120'),
    ('PHY107', 'MAT120'),
    ('CSE215', 'CSE173'),
    ('MAT250', 'MAT130'),
    ('PHY108', 'MAT130'),
    ('PHY108', 'PHY107'),
    ('CSE225', 'CSE215'),
    ('ENG115', 'ENG103'),
    ('MAT350', 'MAT250'),
    ('EEE141', 'PHY107'),
    ('EEE141', 'MAT120'),
    ('CSE231', 'CSE173'),
    ('MAT361', 'MAT250'),
    ('CHE101', 'MAT350'),
    ('EEE111', 'EEE141'),
    ('CSE332', 'CSE231'),
    ('CSE311', 'CSE225'),
    ('CSE323', 'CSE332'),
    ('CSE373', 'CSE225'),
    ('CSE373', 'MAT361'),
    ('CSE327', 'CSE311'),
    ('CSE331', 'CSE323'),
    ('CSE425', 'CSE327'),
    ('CSE499B', 'CSE499A')
)
INSERT INTO prerequisites (course_id, prereq_course_id, grade_requirement)
SELECT
  c.id AS course_id,
  p.id AS prereq_course_id,
  'C' AS grade_requirement
FROM edge_definitions e
JOIN courses c ON c.code = e.course_code
JOIN courses p ON p.code = e.prereq_code
ON CONFLICT (course_id, prereq_course_id) DO NOTHING;

-- 3. Insert Demo Student (ID: 2412800642)
INSERT INTO students (student_id, name, email, department, completed_credits)
VALUES (
  '2412800642',
  'Tariqul Islam',
  'tariqul.islam@northsouth.edu',
  'CSE',
  70.00
)
ON CONFLICT (student_id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  completed_credits = EXCLUDED.completed_credits;

-- 4. Insert Historical Sections for Year 1 & Year 2 Completed Courses
WITH completed_course_codes(code) AS (
  VALUES
    ('ENG102'), ('MAT116'), ('CEE110'), ('CSE115'),
    ('ENG103'), ('MAT120'), ('MAT125'), ('CSE173'),
    ('ENG111'), ('MAT130'), ('PHY107'), ('CSE215'),
    ('PHI104'), ('MAT250'), ('PHY108'), ('CSE225'),
    ('ENG115'), ('MAT350'), ('EEE141'), ('CSE231'),
    ('HIS101'), ('MAT361'), ('CSE299'), ('HIS102')
)
INSERT INTO sections (course_id, section_number, capacity, enrolled_count, room, day_of_week, start_time, end_time, faculty_name, term)
SELECT
  c.id,
  1 AS section_number,
  35 AS capacity,
  35 AS enrolled_count,
  'HIST-01' AS room,
  'ST' AS day_of_week,
  '08:30:00'::TIME AS start_time,
  '10:00:00'::TIME AS end_time,
  'Department Faculty' AS faculty_name,
  'Completed' AS term
FROM completed_course_codes comp
JOIN courses c ON c.code = comp.code
ON CONFLICT (course_id, term, section_number) DO NOTHING;

-- 5. Insert Completed Course Enrollments for Demo Student (2412800642)
WITH student_record AS (
  SELECT id AS student_id FROM students WHERE student_id = '2412800642'
),
completed_course_grades(code, grade) AS (
  VALUES
    ('ENG102', 'A'),
    ('MAT116', 'A'),
    ('CEE110', 'A-'),
    ('CSE115', 'A'),
    ('ENG103', 'A'),
    ('MAT120', 'A-'),
    ('MAT125', 'B+'),
    ('CSE173', 'A'),
    ('ENG111', 'A'),
    ('MAT130', 'A'),
    ('PHY107', 'B+'),
    ('CSE215', 'A'),
    ('PHI104', 'A-'),
    ('MAT250', 'A'),
    ('PHY108', 'B+'),
    ('CSE225', 'A'),
    ('ENG115', 'A-'),
    ('MAT350', 'B+'),
    ('EEE141', 'B+'),
    ('CSE231', 'A'),
    ('HIS101', 'A'),
    ('MAT361', 'A-'),
    ('CSE299', 'A'),
    ('HIS102', 'A')
)
INSERT INTO enrollments (student_id, section_id, status, grade)
SELECT
  sr.student_id,
  s.id AS section_id,
  'completed' AS status,
  cg.grade
FROM completed_course_grades cg
CROSS JOIN student_record sr
JOIN courses c ON c.code = cg.code
JOIN sections s ON s.course_id = c.id AND s.term = 'Completed' AND s.section_number = 1
ON CONFLICT (student_id, section_id) DO UPDATE SET
  status = EXCLUDED.status,
  grade = EXCLUDED.grade;

COMMIT;
