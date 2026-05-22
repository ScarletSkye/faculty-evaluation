const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize SQLite database
const db = new sqlite3.Database('evaluation.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the SQLite database.');
});

// ==========================================
// 1. DATABASE SETUP & SEED DATA
// ==========================================
db.serialize(() => {
    // Drop existing tables to refresh structure cleanly
    db.run(`DROP TABLE IF EXISTS evaluation_tracker`);
    db.run(`DROP TABLE IF EXISTS evaluation_answers`);
    db.run(`DROP TABLE IF EXISTS evaluation_questions`);
    db.run(`DROP TABLE IF EXISTS class_assignments`);
    db.run(`DROP TABLE IF EXISTS courses`);
    db.run(`DROP TABLE IF EXISTS users`);

    // Create Tables with explicit primary keys (user_id, course_id, etc.)
    db.run(`CREATE TABLE users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_id TEXT UNIQUE, 
        first_name TEXT,
        last_name TEXT,
        password_hash TEXT,
        role TEXT CHECK(role IN ('student', 'faculty', 'admin'))
    )`);

    db.run(`CREATE TABLE courses (
        course_id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_code TEXT UNIQUE,
        course_title TEXT
    )`);

    db.run(`CREATE TABLE class_assignments (
        assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        faculty_id INTEGER,
        course_id INTEGER,
        FOREIGN KEY(faculty_id) REFERENCES users(user_id),
        FOREIGN KEY(course_id) REFERENCES courses(course_id)
    )`);

    db.run(`CREATE TABLE evaluation_questions (
        question_id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_text TEXT,
        category TEXT
    )`);

    db.run(`CREATE TABLE evaluation_answers (
        answer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER,
        question_id INTEGER,
        rating INTEGER,
        comment TEXT,
        FOREIGN KEY(assignment_id) REFERENCES class_assignments(assignment_id),
        FOREIGN KEY(question_id) REFERENCES evaluation_questions(question_id)
    )`);

    db.run(`CREATE TABLE evaluation_tracker (
        tracker_id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        assignment_id INTEGER,
        is_completed INTEGER DEFAULT 0,
        UNIQUE(student_id, assignment_id),
        FOREIGN KEY(student_id) REFERENCES users(user_id),
        FOREIGN KEY(assignment_id) REFERENCES class_assignments(assignment_id)
    )`);

    // Default password 'password123' hashed securely
    const salt = bcrypt.genSaltSync(10);
    const defaultHash = bcrypt.hashSync('password123', salt);

    // Insert your actual OLOPSC professors and one test student account
    db.run(`INSERT INTO users (school_id, first_name, last_name, password_hash, role) VALUES 
        ('ADMIN-01', 'Alice', 'Administrator', ?, 'admin'),          
        ('PROF-01', 'Mary Rose', 'Arroyo', ?, 'faculty'),           
        ('PROF-02', 'Rammne', 'Tiongson', ?, 'faculty'),            
        ('PROF-03', 'Ruby', 'Cruz', ?, 'faculty'),                  
        ('PROF-04', 'Caroline', 'Abelo', ?, 'faculty'),             
        ('PROF-05', 'Fleur', 'Rivera', ?, 'faculty'),               
        ('PROF-06', 'Maryenn', 'Pajo', ?, 'faculty'),               
        ('PROF-07', 'Polo', 'Gascon', ?, 'faculty'),                
        ('STUD-2026', 'Mark', 'Santos', ?, 'student')`, 
        [defaultHash, defaultHash, defaultHash, defaultHash, defaultHash, defaultHash, defaultHash, defaultHash, defaultHash],
        function(err) {
            if (err) return console.error("User Seed Error:", err.message);
            seedRemainingData();
        }
    );

    function seedRemainingData() {
        // Insert subjects (Using text hyphen representations instead of slash operators to keep SQL safe)
        db.run(`INSERT INTO courses (course_code, course_title) VALUES 
            ('SAD101', 'System Analysis and Design'),
            ('ALGO101', 'Algorithms and Complexity'),
            ('PROG101', 'Programming Language'),
            ('INFOM101', 'Information Management'),
            ('RIZAL101', 'Life and Works of Rizal'),
            ('CALC102', 'Analysis - Integral Calculus'),
            ('ETHICS101', 'Ethics'),
            ('PATHFIT4', 'PathFit 4')`, function(err) {
                if (err) return console.error("Course Seed Error:", err.message);

                // Map your professors to their courses using the exact user_id and course_id keys
                db.run(`
                    INSERT INTO class_assignments (faculty_id, course_id) VALUES 
                    ((SELECT user_id FROM users WHERE last_name='Arroyo'), (SELECT course_id FROM courses WHERE course_code='SAD101')),
                    ((SELECT user_id FROM users WHERE last_name='Tiongson' LIMIT 1), (SELECT course_id FROM courses WHERE course_code='ALGO101')),
                    ((SELECT user_id FROM users WHERE last_name='Tiongson' LIMIT 1), (SELECT course_id FROM courses WHERE course_code='PROG101')),
                    ((SELECT user_id FROM users WHERE last_name='Cruz'), (SELECT course_id FROM courses WHERE course_code='INFOM101')),
                    ((SELECT user_id FROM users WHERE last_name='Abelo'), (SELECT course_id FROM courses WHERE course_code='RIZAL101')),
                    ((SELECT user_id FROM users WHERE last_name='Rivera'), (SELECT course_id FROM courses WHERE course_code='CALC102')),
                    ((SELECT user_id FROM users WHERE last_name='Pajo'), (SELECT course_id FROM courses WHERE course_code='ETHICS101')),
                    ((SELECT user_id FROM users WHERE last_name='Gascon'), (SELECT course_id FROM courses WHERE course_code='PATHFIT4'))
                `, function(err) {
                    if (err) return console.error("Assignment Seed Error:", err.message);

                    // Fetch the generated assignment IDs and tie them to our student (Mark Santos)
                    db.get(`SELECT user_id FROM users WHERE school_id = 'STUD-2026'`, [], (err, studentRow) => {
                        if (studentRow) {
                            const studentId = studentRow.user_id;
                            db.all(`SELECT assignment_id FROM class_assignments`, [], (err, assignmentRows) => {
                                if (assignmentRows) {
                                    assignmentRows.forEach(assign => {
                                        db.run(`INSERT OR REPLACE INTO evaluation_tracker (student_id, assignment_id, is_completed) VALUES (?, ?, 0)`, [studentId, assign.assignment_id]);
                                    });
                                    console.log("🚀 System successfully loaded with your actual block schedule!");
                                }
                            });
                        }
                    });
                });
            });
    }

    // Seeding questionnaire items (Part I and Part II)
    const questions = [
        ["Issuance and proper discussion of the course syllabus during the first week of the semester", "Part I: Non-Instructional Component"],
        ["Discussion of fair and consistent classroom rules and procedures during the first week of the semester.", "Part I: Non-Instructional Component"],
        ["Thorough explanation of contents/topics of the courseware", "Part I: Non-Instructional Component"],
        ["Explanation of the grading system during the first week of classes", "Part I: Non-Instructional Component"],
        ["Properly administered periodic examinations with guidance and care for the students", "Part I: Non-Instructional Component"],
        ["Reporting to class regularly", "Part I: Non-Instructional Component"],
        ["Regular checking of attendance", "Part I: Non-Instructional Component"],
        ["Propriety and professional decorum (in speech and action)", "Part I: Non-Instructional Component"],
        ["Personal grooming (neatness and composure)", "Part I: Non-Instructional Component"],
        ["Starting and finishing the class on time", "Part I: Non-Instructional Component"],
        ["Demonstration of fairness, impartiality, and confidentiality in dealing with students", "Part I: Non-Instructional Component"],
        ["1a. Clarity of explanation and details as written in the course syllabus", "Part II: Instructional Component"],
        ["1b. Provision of examples and real-life situations for better understanding", "Part II: Instructional Component"],
        ["1c. Inclusion of trends and updates in relation to current events, developments, and emerging societal issues", "Part II: Instructional Component"],
        ["1d. Relevance of content and topics to actual and real-life situations", "Part II: Instructional Component"],
        ["2a. Presentation of the lesson in an interesting and organized manner", "Part II: Instructional Component"],
        ["2b. Use of teaching or visual aids and materials whenever applicable and needed", "Part II: Instructional Component"],
        ["2c. Enthusiasm of the instructor/professor in carrying on a lively and engaging discussion", "Part II: Instructional Component"],
        ["3. Productivity of time spent in class", "Part II: Instructional Component"],
        ["4. Motivation that drives me to participate in class discussion or interaction", "Part II: Instructional Component"],
        ["5. The challenge I experience to think, analyze, and be creative in class", "Part II: Instructional Component"],
        ["6a. Results of minor and major tests administered by my instructor/professor", "Part II: Instructional Component"],
        ["6b. Justifiable grades for written outputs, projects, and recitations", "Part II: Instructional Component"],
        ["6c. Issuance of periodic grades during grade consultations", "Part II: Instructional Component"],
        ["6d. Verification of grades (when necessary) through the grading sheet", "Part II: Instructional Component"],
        ["6e. Timely return of outputs (quizzes, seatworks, task sheets, and other requirements)", "Part II: Instructional Component"],
        ["7. My performance as reflected on the grades I earned", "Part II: Instructional Component"],
        ["8. Appropriateness and reasonability of course requirements", "Part II: Instructional Component"],
        ["9. Usefulness and importance of the things I learn in class", "Part II: Instructional Component"],
        ["10. Concern of my instructor/professor for my welfare", "Part II: Instructional Component"],
        ["11. Understanding of the lesson objectives based on how clearly the instructor/professor states the goals or intended learning outcomes at the beginning of the lesson", "Part II: Instructional Component"],
        ["12. Feeling of inclusion in class based on the instructor/professor’s consideration of different learning abilities, styles, and backgrounds", "Part II: Instructional Component"],
        ["13. Opportunity to ask questions or seek help based on the instructor/professor’s openness to questions and availability for academic consultation when needed", "Part II: Instructional Component"],
        ["14. Comfort and focus in class based on how the instructor/professor maintains classroom order, addresses misbehavior fairly, and creates a respectful learning environment", "Part II: Instructional Component"],
        ["15. Development as a future professional based on how the instructor/professor connects lessons to my future field of work or real-life practice", "Part II: Instructional Component"],
        ["16a. Encouraging student-led topic discussions or presentations", "Part II: Instructional Component"],
        ["16b. Allowing students to develop their own strategies in presenting lessons", "Part II: Instructional Component"],
        ["16c. Building students' self-confidence and articulation skills", "Part II: Instructional Component"],
        ["16d. Promoting creativity, critical thinking, and resourcefulness", "Part II: Instructional Component"],
        ["17. Use of technology to adapt instructional activities to my needs", "Part II: Instructional Component"],
        ["18. Use of online tools, software, or references when the instructor/professor creates and administers tests and assessments", "Part II: Instructional Component"],
        ["19. Use of technological representations (e.g., multimedia, visual demonstrations, video clips, etc.) to demonstrate specific content in the content area", "Part II: Instructional Component"],
        ["20. Use of varied technologies in facilitating diverse teaching and learning activities", "Part II: Instructional Component"],
        ["21. Use of technology to facilitate cooperative learning experiences", "Part II: Instructional Component"]
    ];

    const questionStmt = db.prepare(`INSERT INTO evaluation_questions (question_text, category) VALUES (?, ?)`);
    questions.forEach(q => questionStmt.run(q[0], q[1]));
    questionStmt.finalize();
});

// ==========================================
// 2. ENDPOINTS & PORTAL ROUTER LOGIC
// ==========================================

// Login processing endpoint
app.post('/api/login', (req, res) => {
    const { school_id, password } = req.body;
    db.get(`SELECT * FROM users WHERE school_id = ?`, [school_id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ message: "Invalid ID or Password." });
        if (!bcrypt.compareSync(password, user.password_hash)) return res.status(400).json({ message: "Invalid ID or Password." });
        
        delete user.password_hash;
        res.json({ message: "Login successful", user });
    });
});

// Get questionnaire list endpoint
app.get('/api/questions', (req, res) => {
    db.all(`SELECT * FROM evaluation_questions`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Dynamic endpoint using :studentId passed from front-end login session
app.get('/api/student/:studentId/evaluations', (req, res) => {
    db.all(`SELECT et.assignment_id, et.is_completed, u.first_name || ' ' || u.last_name AS professor_name, c.course_code, c.course_title
        FROM evaluation_tracker et 
        JOIN class_assignments ca ON et.assignment_id = ca.assignment_id
        JOIN users u ON ca.faculty_id = u.user_id 
        JOIN courses c ON ca.course_id = c.course_id 
        WHERE et.student_id = ?`, [req.params.studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Submit evaluation endpoint (FIXED: Supports Re-evaluation overwrites & eliminates duplicate suggestions)
app.post('/api/student/submit-evaluation', (req, res) => {
    const { student_id, assignment_id, ratings, comments } = req.body;
    
    // Clear old answer rows for this assignment to allow flawless Re-evaluation updates
    db.run(`DELETE FROM evaluation_answers WHERE assignment_id = ?`, [assignment_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        const stmt = db.prepare(`INSERT INTO evaluation_answers (assignment_id, question_id, rating, comment) VALUES (?, ?, ?, ?)`);
        
        ratings.forEach((item, index) => {
            // FIXED: Only store the text comment string inside the very first entry row to prevent comment duplication metrics
            const textComment = (index === 0) ? (comments || "") : "";
            stmt.run(assignment_id, item.question_id, item.rating, textComment);
        });
        stmt.finalize();

        db.run(`INSERT INTO evaluation_tracker (student_id, assignment_id, is_completed) 
                VALUES (?, ?, 1) 
                ON CONFLICT(student_id, assignment_id) DO UPDATE SET is_completed = 1`, 
        [student_id, assignment_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Evaluation submitted securely!" });
        });
    });
});

// Faculty dashboard endpoints
app.get('/api/faculty/:facultyId/performance', (req, res) => {
    db.all(`SELECT c.course_code, c.course_title, AVG(ea.rating) AS average_score, COUNT(ea.answer_id) as total_ratings_received
        FROM class_assignments ca 
        JOIN courses c ON ca.course_id = c.course_id 
        LEFT JOIN evaluation_answers ea ON ca.assignment_id = ea.assignment_id
        WHERE ca.faculty_id = ? GROUP BY ca.assignment_id`, [req.params.facultyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/faculty/:facultyId/comments', (req, res) => {
    db.all(`SELECT ea.comment, c.course_code 
        FROM evaluation_answers ea 
        JOIN class_assignments ca ON ea.assignment_id = ca.assignment_id 
        JOIN courses c ON ca.course_id = c.course_id
        WHERE ca.faculty_id = ? AND ea.comment IS NOT NULL AND ea.comment != ''`, [req.params.facultyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin dashboard endpoint
app.get('/api/admin/overall-stats', (req, res) => {
    db.get(`SELECT COUNT(*) as total, SUM(case when is_completed = 1 then 1 else 0 end) as completed FROM evaluation_tracker`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const rate = row.total > 0 ? (row.completed / row.total) * 100 : 0;
        res.json({ total_assigned: row.total, total_completed: row.completed, completion_rate: rate.toFixed(2) + "%" });
    });
});

const PORT = 3000;
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const db = new sqlite3.Database('evaluation.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the SQLite database.');
});

// ==========================================
// 1. DATABASE SETUP & SEED DATA
// ==========================================
db.serialize(() => {
    // Drop existing tables to refresh structure cleanly
    db.run(`DROP TABLE IF EXISTS evaluation_tracker`);
    db.run(`DROP TABLE IF EXISTS evaluation_answers`);
    db.run(`DROP TABLE IF EXISTS evaluation_questions`);
    db.run(`DROP TABLE IF EXISTS class_assignments`);
    db.run(`DROP TABLE IF EXISTS courses`);
    db.run(`DROP TABLE IF EXISTS users`);

    // Create Tables with explicit primary keys (user_id, course_id, etc.)
    db.run(`CREATE TABLE users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_id TEXT UNIQUE, 
        first_name TEXT,
        last_name TEXT,
        password_hash TEXT,
        role TEXT CHECK(role IN ('student', 'faculty', 'admin'))
    )`);

    db.run(`CREATE TABLE courses (
        course_id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_code TEXT UNIQUE,
        course_title TEXT
    )`);

    db.run(`CREATE TABLE class_assignments (
        assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        faculty_id INTEGER,
        course_id INTEGER,
        FOREIGN KEY(faculty_id) REFERENCES users(user_id),
        FOREIGN KEY(course_id) REFERENCES courses(course_id)
    )`);

    db.run(`CREATE TABLE evaluation_questions (
        question_id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_text TEXT,
        category TEXT
    )`);

    db.run(`CREATE TABLE evaluation_answers (
        answer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER,
        question_id INTEGER,
        rating INTEGER,
        comment TEXT,
        FOREIGN KEY(assignment_id) REFERENCES class_assignments(assignment_id),
        FOREIGN KEY(question_id) REFERENCES evaluation_questions(question_id)
    )`);

    db.run(`CREATE TABLE evaluation_tracker (
        tracker_id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        assignment_id INTEGER,
        is_completed INTEGER DEFAULT 0,
        UNIQUE(student_id, assignment_id),
        FOREIGN KEY(student_id) REFERENCES users(user_id),
        FOREIGN KEY(assignment_id) REFERENCES class_assignments(assignment_id)
    )`);

    // Default password 'password123' hashed securely
    const salt = bcrypt.genSaltSync(10);
    const defaultHash = bcrypt.hashSync('password123', salt);

    // Insert your actual OLOPSC professors and one test student account
    db.run(`INSERT INTO users (school_id, first_name, last_name, password_hash, role) VALUES 
        ('ADMIN-01', 'Alice', 'Administrator', ?, 'admin'),          
        ('PROF-01', 'Mary Rose', 'Arroyo', ?, 'faculty'),           
        ('PROF-02', 'Rammne', 'Tiongson', ?, 'faculty'),            
        ('PROF-03', 'Ruby', 'Cruz', ?, 'faculty'),                  
        ('PROF-04', 'Caroline', 'Abelo', ?, 'faculty'),             
        ('PROF-05', 'Fleur', 'Rivera', ?, 'faculty'),               
        ('PROF-06', 'Maryenn', 'Pajo', ?, 'faculty'),               
        ('PROF-07', 'Polo', 'Gascon', ?, 'faculty'),                
        ('STUD-2026', 'Mark', 'Santos', ?, 'student')`, 
        [defaultHash, defaultHash, defaultHash, defaultHash, defaultHash, defaultHash, defaultHash, defaultHash, defaultHash],
        function(err) {
            if (err) return console.error("User Seed Error:", err.message);
            seedRemainingData();
        }
    );

    function seedRemainingData() {
        // Insert subjects (Using text hyphen representations instead of slash operators to keep SQL safe)
        db.run(`INSERT INTO courses (course_code, course_title) VALUES 
            ('SAD101', 'System Analysis and Design'),
            ('ALGO101', 'Algorithms and Complexity'),
            ('PROG101', 'Programming Language'),
            ('INFOM101', 'Information Management'),
            ('RIZAL101', 'Life and Works of Rizal'),
            ('CALC102', 'Analysis - Integral Calculus'),
            ('ETHICS101', 'Ethics'),
            ('PATHFIT4', 'PathFit 4')`, function(err) {
                if (err) return console.error("Course Seed Error:", err.message);

                // Map your professors to their courses using the exact user_id and course_id keys
                db.run(`
                    INSERT INTO class_assignments (faculty_id, course_id) VALUES 
                    ((SELECT user_id FROM users WHERE last_name='Arroyo'), (SELECT course_id FROM courses WHERE course_code='SAD101')),
                    ((SELECT user_id FROM users WHERE last_name='Tiongson' LIMIT 1), (SELECT course_id FROM courses WHERE course_code='ALGO101')),
                    ((SELECT user_id FROM users WHERE last_name='Tiongson' LIMIT 1), (SELECT course_id FROM courses WHERE course_code='PROG101')),
                    ((SELECT user_id FROM users WHERE last_name='Cruz'), (SELECT course_id FROM courses WHERE course_code='INFOM101')),
                    ((SELECT user_id FROM users WHERE last_name='Abelo'), (SELECT course_id FROM courses WHERE course_code='RIZAL101')),
                    ((SELECT user_id FROM users WHERE last_name='Rivera'), (SELECT course_id FROM courses WHERE course_code='CALC102')),
                    ((SELECT user_id FROM users WHERE last_name='Pajo'), (SELECT course_id FROM courses WHERE course_code='ETHICS101')),
                    ((SELECT user_id FROM users WHERE last_name='Gascon'), (SELECT course_id FROM courses WHERE course_code='PATHFIT4'))
                `, function(err) {
                    if (err) return console.error("Assignment Seed Error:", err.message);

                    // Fetch the generated assignment IDs and tie them to our student (Mark Santos)
                    db.get(`SELECT user_id FROM users WHERE school_id = 'STUD-2026'`, [], (err, studentRow) => {
                        if (studentRow) {
                            const studentId = studentRow.user_id;
                            db.all(`SELECT assignment_id FROM class_assignments`, [], (err, assignmentRows) => {
                                if (assignmentRows) {
                                    assignmentRows.forEach(assign => {
                                        db.run(`INSERT OR REPLACE INTO evaluation_tracker (student_id, assignment_id, is_completed) VALUES (?, ?, 0)`, [studentId, assign.assignment_id]);
                                    });
                                    console.log("🚀 System successfully loaded with your actual block schedule!");
                                }
                            });
                        }
                    });
                });
            });
    }

    // Seeding questionnaire items (Part I and Part II)
    const questions = [
        ["Issuance and proper discussion of the course syllabus during the first week of the semester", "Part I: Non-Instructional Component"],
        ["Discussion of fair and consistent classroom rules and procedures during the first week of the semester.", "Part I: Non-Instructional Component"],
        ["Thorough explanation of contents/topics of the courseware", "Part I: Non-Instructional Component"],
        ["Explanation of the grading system during the first week of classes", "Part I: Non-Instructional Component"],
        ["Properly administered periodic examinations with guidance and care for the students", "Part I: Non-Instructional Component"],
        ["Reporting to class regularly", "Part I: Non-Instructional Component"],
        ["Regular checking of attendance", "Part I: Non-Instructional Component"],
        ["Propriety and professional decorum (in speech and action)", "Part I: Non-Instructional Component"],
        ["Personal grooming (neatness and composure)", "Part I: Non-Instructional Component"],
        ["Starting and finishing the class on time", "Part I: Non-Instructional Component"],
        ["Demonstration of fairness, impartiality, and confidentiality in dealing with students", "Part I: Non-Instructional Component"],
        ["1a. Clarity of explanation and details as written in the course syllabus", "Part II: Instructional Component"],
        ["1b. Provision of examples and real-life situations for better understanding", "Part II: Instructional Component"],
        ["1c. Inclusion of trends and updates in relation to current events, developments, and emerging societal issues", "Part II: Instructional Component"],
        ["1d. Relevance of content and topics to actual and real-life situations", "Part II: Instructional Component"],
        ["2a. Presentation of the lesson in an interesting and organized manner", "Part II: Instructional Component"],
        ["2b. Use of teaching or visual aids and materials whenever applicable and needed", "Part II: Instructional Component"],
        ["2c. Enthusiasm of the instructor/professor in carrying on a lively and engaging discussion", "Part II: Instructional Component"],
        ["3. Productivity of time spent in class", "Part II: Instructional Component"],
        ["4. Motivation that drives me to participate in class discussion or interaction", "Part II: Instructional Component"],
        ["5. The challenge I experience to think, analyze, and be creative in class", "Part II: Instructional Component"],
        ["6a. Results of minor and major tests administered by my instructor/professor", "Part II: Instructional Component"],
        ["6b. Justifiable grades for written outputs, projects, and recitations", "Part II: Instructional Component"],
        ["6c. Issuance of periodic grades during grade consultations", "Part II: Instructional Component"],
        ["6d. Verification of grades (when necessary) through the grading sheet", "Part II: Instructional Component"],
        ["6e. Timely return of outputs (quizzes, seatworks, task sheets, and other requirements)", "Part II: Instructional Component"],
        ["7. My performance as reflected on the grades I earned", "Part II: Instructional Component"],
        ["8. Appropriateness and reasonability of course requirements", "Part II: Instructional Component"],
        ["9. Usefulness and importance of the things I learn in class", "Part II: Instructional Component"],
        ["10. Concern of my instructor/professor for my welfare", "Part II: Instructional Component"],
        ["11. Understanding of the lesson objectives based on how clearly the instructor/professor states the goals or intended learning outcomes at the beginning of the lesson", "Part II: Instructional Component"],
        ["12. Feeling of inclusion in class based on the instructor/professor’s consideration of different learning abilities, styles, and backgrounds", "Part II: Instructional Component"],
        ["13. Opportunity to ask questions or seek help based on the instructor/professor’s openness to questions and availability for academic consultation when needed", "Part II: Instructional Component"],
        ["14. Comfort and focus in class based on how the instructor/professor maintains classroom order, addresses misbehavior fairly, and creates a respectful learning environment", "Part II: Instructional Component"],
        ["15. Development as a future professional based on how the instructor/professor connects lessons to my future field of work or real-life practice", "Part II: Instructional Component"],
        ["16a. Encouraging student-led topic discussions or presentations", "Part II: Instructional Component"],
        ["16b. Allowing students to develop their own strategies in presenting lessons", "Part II: Instructional Component"],
        ["16c. Building students' self-confidence and articulation skills", "Part II: Instructional Component"],
        ["16d. Promoting creativity, critical thinking, and resourcefulness", "Part II: Instructional Component"],
        ["17. Use of technology to adapt instructional activities to my needs", "Part II: Instructional Component"],
        ["18. Use of online tools, software, or references when the instructor/professor creates and administers tests and assessments", "Part II: Instructional Component"],
        ["19. Use of technological representations (e.g., multimedia, visual demonstrations, video clips, etc.) to demonstrate specific content in the content area", "Part II: Instructional Component"],
        ["20. Use of varied technologies in facilitating diverse teaching and learning activities", "Part II: Instructional Component"],
        ["21. Use of technology to facilitate cooperative learning experiences", "Part II: Instructional Component"]
    ];

    const questionStmt = db.prepare(`INSERT INTO evaluation_questions (question_text, category) VALUES (?, ?)`);
    questions.forEach(q => questionStmt.run(q[0], q[1]));
    questionStmt.finalize();
});

// ==========================================
// 2. ENDPOINTS & PORTAL ROUTER LOGIC
// ==========================================

// Login processing endpoint
app.post('/api/login', (req, res) => {
    const { school_id, password } = req.body;
    db.get(`SELECT * FROM users WHERE school_id = ?`, [school_id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ message: "Invalid ID or Password." });
        if (!bcrypt.compareSync(password, user.password_hash)) return res.status(400).json({ message: "Invalid ID or Password." });
        
        delete user.password_hash;
        res.json({ message: "Login successful", user });
    });
});

// Get questionnaire list endpoint
app.get('/api/questions', (req, res) => {
    db.all(`SELECT * FROM evaluation_questions`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Dynamic endpoint using :studentId passed from front-end login session
app.get('/api/student/:studentId/evaluations', (req, res) => {
    db.all(`SELECT et.assignment_id, et.is_completed, u.first_name || ' ' || u.last_name AS professor_name, c.course_code, c.course_title
        FROM evaluation_tracker et 
        JOIN class_assignments ca ON et.assignment_id = ca.assignment_id
        JOIN users u ON ca.faculty_id = u.user_id 
        JOIN courses c ON ca.course_id = c.course_id 
        WHERE et.student_id = ?`, [req.params.studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Submit evaluation endpoint (FIXED: Supports Re-evaluation overwrites & eliminates duplicate suggestions)
app.post('/api/student/submit-evaluation', (req, res) => {
    const { student_id, assignment_id, ratings, comments } = req.body;
    
    // Clear old answer rows for this assignment to allow flawless Re-evaluation updates
    db.run(`DELETE FROM evaluation_answers WHERE assignment_id = ?`, [assignment_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        const stmt = db.prepare(`INSERT INTO evaluation_answers (assignment_id, question_id, rating, comment) VALUES (?, ?, ?, ?)`);
        
        ratings.forEach((item, index) => {
            // FIXED: Only store the text comment string inside the very first entry row to prevent comment duplication metrics
            const textComment = (index === 0) ? (comments || "") : "";
            stmt.run(assignment_id, item.question_id, item.rating, textComment);
        });
        stmt.finalize();

        db.run(`INSERT INTO evaluation_tracker (student_id, assignment_id, is_completed) 
                VALUES (?, ?, 1) 
                ON CONFLICT(student_id, assignment_id) DO UPDATE SET is_completed = 1`, 
        [student_id, assignment_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Evaluation submitted securely!" });
        });
    });
});

// Faculty dashboard endpoints
app.get('/api/faculty/:facultyId/performance', (req, res) => {
    db.all(`SELECT c.course_code, c.course_title, AVG(ea.rating) AS average_score, COUNT(ea.answer_id) as total_ratings_received
        FROM class_assignments ca 
        JOIN courses c ON ca.course_id = c.course_id 
        LEFT JOIN evaluation_answers ea ON ca.assignment_id = ea.assignment_id
        WHERE ca.faculty_id = ? GROUP BY ca.assignment_id`, [req.params.facultyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/faculty/:facultyId/comments', (req, res) => {
    db.all(`SELECT ea.comment, c.course_code 
        FROM evaluation_answers ea 
        JOIN class_assignments ca ON ea.assignment_id = ca.assignment_id 
        JOIN courses c ON ca.course_id = c.course_id
        WHERE ca.faculty_id = ? AND ea.comment IS NOT NULL AND ea.comment != ''`, [req.params.facultyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin dashboard endpoint
app.get('/api/admin/overall-stats', (req, res) => {
    db.get(`SELECT COUNT(*) as total, SUM(case when is_completed = 1 then 1 else 0 end) as completed FROM evaluation_tracker`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const rate = row.total > 0 ? (row.completed / row.total) * 100 : 0;
        res.json({ total_assigned: row.total, total_completed: row.completed, completion_rate: rate.toFixed(2) + "%" });
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Faculty Evaluation System running on http://localhost:${PORT}`));