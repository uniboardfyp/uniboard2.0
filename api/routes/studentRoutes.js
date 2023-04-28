const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../../connection');
const Cryptr = require('cryptr');
const cryptr = new Cryptr('myTotallySecretKey');

router.get('/login', (req, res) => {
  console.log('Student Login Route!!!');
  res.render('studentLogin', { title: 'Student Log in' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  async function getResult(username, password) {
    const [result] = await pool.query(
      `SELECT * FROM student_accounts WHERE username = ? AND BINARY password = ? LIMIT 1`,
      [username, password]
    );
    if (Object.keys(result).length === 0) {
      // console.log(username, password);
      res.render('studentLogin', {
        title: 'Student Log in',
        error: 'Incorrect Username or Password',
      });
    } else {
      // console.log(result);
      // console.log('I still worked');
      const [studentDetails] = await pool.query(
        `SELECT * FROM student_details WHERE student_id = ?  LIMIT 1`,
        [username]
      );
      console.log(studentDetails);
      res.cookie(
        'studentToken',
        jwt.sign(
          {
            firstname: studentDetails[0].student_firstname,
            lastname: studentDetails[0].student_lastname,
            program_id: studentDetails[0].program_id,
            student_id: studentDetails[0].student_id,
          },
          jwtPrivateKey
        ),
        { httpOnly: true }
      );
      res.redirect('./dashboard');
    }
  }
  getResult(username, password);
});

router.get('/logout', (req, res) => {
  console.log('Student Logout Route!!!');
  res.clearCookie('studentToken');
  res.redirect('./login');
  // console.log(jwtPrivateKey);
  // res.render('home', { title: 'Home Page' });
});

router.get('/dashboard', mustBeLoggedIn, (req, res) => {
  console.log('Student Dashboard Route!!!');
  let totalActiveCourses, totalCompletedCourses;
  async function getActiveCourses() {
    const q_getActiveCourses = `SELECT student_section_details.*, section_details.*, semester_details.status
    FROM student_section_details 
      LEFT JOIN section_details ON student_section_details.section_code = section_details.section_code 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
      WHERE student_id = ? AND semester_details.status = 'In Progress';`;
    let [activeCourses] = await pool.query(q_getActiveCourses, [
      globalStudentId,
    ]);
    // console.log(activeCourses);
    totalActiveCourses = activeCourses.length;
    console.log(totalActiveCourses);
    const q_getCompletedCourses = `SELECT student_section_details.*, section_details.*, semester_details.status
    FROM student_section_details 
      LEFT JOIN section_details ON student_section_details.section_code = section_details.section_code 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
      WHERE student_id = ? AND semester_details.status = 'Completed';`;
    let [completedCourses] = await pool.query(q_getCompletedCourses, [
      globalStudentId,
    ]);
    // console.log(completedCourses);
    totalCompletedCourses = completedCourses.length;
    res.render('studentdashboard', {
      page_name: 'dashboard',
      firstname: globalFirstname,
      lastname: globalLastname,
      totalActiveCourses,
      totalCompletedCourses,
    });
  }
  getActiveCourses();
  async function coursesCompleted() {}
  async function attendance() {}
});

router.get('/attendance', mustBeLoggedIn, (req, res) => {
  console.log('Student attendance Route!!!');
  const { sectionCode, courseTitle } = req.query;
  async function viewAttendance() {
    const q_getcourses = `SELECT student_section_details.*, section_details.*, courses.course_title, semester_details.status
    FROM student_section_details 
      LEFT JOIN section_details ON student_section_details.section_code = section_details.section_code 
      LEFT JOIN courses ON section_details.course_code = courses.course_code 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
      WHERE student_id = ? AND semester_details.status = 'In Progress';`;
    let [courses] = await pool.query(q_getcourses, [globalStudentId]);
    console.log(courses);
    let studentAttendance, totalAbsents, totalPresents, totalClasses;
    if (sectionCode) {
      const q_getAttendance = `SELECT * FROM attendance WHERE student_id = ? AND section_code = ?`;
      [studentAttendance] = await pool.query(q_getAttendance, [
        globalStudentId,
        sectionCode,
      ]);
      [totalAbsents] = await pool.query(
        `SELECT * FROM attendance WHERE student_id = ? AND status = 'Absent' AND section_code = ?`,
        [globalStudentId, sectionCode]
      );
      totalClasses = studentAttendance.length;
      totalAbsents = totalAbsents.length;
      totalPresents = totalClasses - totalAbsents;
    }
    res.render('studentAttendance', {
      page_name: 'attendance',
      firstname: globalFirstname,
      lastname: globalLastname,
      courses,
      selectedSection: sectionCode,
      courseTitle,
      studentAttendance,
      totalClasses,
      totalAbsents,
      totalPresents,
    });
  }
  viewAttendance();
});

router.get('/timetable', mustBeLoggedIn, (req, res) => {
  console.log('Student TimeTable Route!!!');

  async function timeTable() {
    const q_getSlotDays = `SELECT DISTINCT slot_day
    FROM time_slots;`;
    const q_getSlotTime = `SELECT DISTINCT slot_time
    FROM time_slots;`;

    let [slotDays] = await pool.query(q_getSlotDays);
    let [slotTime] = await pool.query(q_getSlotTime);

    const q_getInProgSections = `SELECT student_section_details.*, student_section_details.student_id, section_details.*, courses.course_title, time_slots.*, semester_details.status
    FROM student_section_details
      LEFT JOIN section_details ON student_section_details.section_code = section_details.section_code
      LEFT JOIN courses ON section_details.course_code = courses.course_code
      LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
    WHERE student_section_details.student_id = ? AND semester_details.status = 'In Progress';`;

    let [inProgSections] = await pool.query(q_getInProgSections, [
      globalStudentId,
    ]);
    if (inProgSections.length) {
      inProgSections = inProgSections.map((x) => {
        return {
          course_code: x.course_code,
          course_title: x.course_title,
          slot_day: x.slot_day,
          slot_time: x.slot_time,
        };
      });
    }

    res.render('studentTimeTable', {
      page_name: 'timetable',
      firstname: globalFirstname,
      lastname: globalLastname,
      slotDays,
      slotTime,
      inProgSections,
    });
  }
  timeTable();
});

router.get('/addcourse', mustBeLoggedIn, (req, res) => {
  console.log('Student AddCourse Route!!!');

  const mes = req.query.e;
  async function registerCourse() {
    const q_getActiveCourses = `SELECT section_details.*, semester_details.status, courses.*, course_catalog.*,faculty_details.faculty_firstname,faculty_details.faculty_lastname,time_slots.*
    FROM section_details 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id 
      LEFT JOIN courses ON section_details.course_code = courses.course_code 
      LEFT JOIN course_catalog ON course_catalog.course_code = courses.course_code
      LEFT JOIN faculty_details ON faculty_details.faculty_id = section_details.faculty_id
      LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id
    WHERE semester_details.status = 'Active' AND course_catalog.program_id = ?;`;

    let [activeCourses] = await pool.query(q_getActiveCourses, [
      globalProgramID,
    ]);

    const q_getCoursesCompleted = `SELECT student_course_details.*
    FROM student_course_details
    WHERE student_course_details.student_id = ? AND grade != 'F';`;
    let [coursesCompleted] = await pool.query(q_getCoursesCompleted, [
      globalStudentId,
    ]);
    coursesCompleted = coursesCompleted.map((x) => {
      return x.course_code;
    });

    activeCourses = activeCourses.filter((x) => {
      if (!coursesCompleted.includes(x.course_code)) {
        return x;
      }
    });
    let sectionCodes = activeCourses.map((x) => {
      return x.section_code;
    });
    let alreadyRegisteredCourses;
    if (sectionCodes.length) {
      [alreadyRegisteredCourses] = await pool.query(
        `SELECT section_code FROM student_section_details
         WHERE student_id = ? AND section_code IN (?)`,
        [globalStudentId, sectionCodes]
      );
      alreadyRegisteredCourses = alreadyRegisteredCourses.map((x) => {
        return x.section_code;
      });
    }
    let bookedSeats = [];

    for (let index = 0; index < activeCourses.length; index++) {
      [bookedSeats] = await pool.query(
        `SELECT COUNT(*) AS seat FROM student_section_details WHERE section_code= ? `,
        [activeCourses[index].section_code]
      );

      activeCourses[index].seats =
        activeCourses[index].seats - bookedSeats[0].seat;
    }

    activeCourses.map((x) => {
      if (alreadyRegisteredCourses.includes(x.section_code)) {
        x.registered = true;
      } else {
        x.registered = false;
      }
      x.encryptedValue = cryptr.encrypt(x.section_code);
    });

    res.render('studentAddCourse', {
      page_name: 'addcourse',
      firstname: globalFirstname,
      lastname: globalLastname,
      activeCourses,
      mes,
    });
  }

  registerCourse();
});

router.post('/registercourse', mustBeLoggedIn, (req, res) => {
  console.log('Student Register Course POST Route!!!');
  let { sectionCode } = req.body;

  async function checkCourseRegister() {
    try {
      sectionCode = cryptr.decrypt(sectionCode);
    } catch (e) {
      res.send('ERROR');
      return 0;
    }
    const [sectionData] = await pool.query(
      `SELECT slot_id,course_code FROM section_details WHERE section_code = ?`,
      [sectionCode]
    );

    const courseCode = sectionData[0].course_code;
    const timeSlot = sectionData[0].slot_id;
    console.log(
      'SECTION CODE COURSE CODE TIME SLOT',
      sectionCode,
      courseCode,
      timeSlot
    );
    //CHECKING COURSES CREDIT HOURS
    const q_getActiveCourses = `SELECT student_section_details.*, section_details.*, semester_details.status
    FROM student_section_details 
      LEFT JOIN section_details ON student_section_details.section_code = section_details.section_code 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
    WHERE semester_details.status = 'Active' AND student_section_details.student_id = ? ;`;
    const [totalCoursesREG] = await pool.query(q_getActiveCourses, [
      globalStudentId,
    ]);
    console.log(totalCoursesREG.length);
    if (totalCoursesREG.length > 2) {
      console.log('MAX COURSE LIMIT');
      res.redirect('./addcourse?e=1');
      return;
    }
    //CHECKING IF SEATS ARE AVAILABLE
    let [totalSeats] = await pool.query(
      `SELECT seats FROM section_details WHERE section_code = ? LIMIT 1`,
      [sectionCode]
    );
    totalSeats = totalSeats[0].seats;
    console.log('Total Seats are : ', totalSeats);

    let [bookedSeats] = await pool.query(
      `SELECT COUNT(*) AS seat FROM student_section_details WHERE section_code= ? `,
      [sectionCode]
    );
    bookedSeats = bookedSeats[0].seat;
    console.log(bookedSeats);
    if (bookedSeats >= totalSeats) {
      console.log('NO MORE SEATS');
      res.redirect('./addcourse?e=2');
      return;
    }
    //CHECKING IF COURSE IS ALREADY REGISTERED
    const [result] = await pool.query(
      `SELECT student_section_details.*, section_details.*, semester_details.status
      FROM student_section_details 
        LEFT JOIN section_details ON student_section_details.section_code = section_details.section_code 
        LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
      WHERE semester_details.status = 'Active' AND student_section_details.student_id = ? AND section_details.course_code = ? LIMIT 1 `,
      [globalStudentId, courseCode]
    );
    if (result.length > 0) {
      console.log('Length: ', result.length);
      console.log(result);
      console.log('COURSE ALREADY EXIST');
      res.redirect('./addcourse?e=3');
      return;
    }

    const [result2] = await pool.query(
      `SELECT student_section_details.*, section_details.*, semester_details.status
      FROM student_section_details 
        LEFT JOIN section_details ON student_section_details.section_code = section_details.section_code 
        LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
      WHERE semester_details.status = 'Active' AND student_section_details.student_id = ? AND slot_id = ?;`,
      [globalStudentId, timeSlot]
    );
    if (result2.length > 0) {
      console.log('TIME CLASh');
      res.redirect('./addcourse?e=4');
      return;
    }
    // console.log('Time slots are', timeSlots);
    //CHECKING TIME SLOT
    // const [result2] = await pool.query(
    //   `SELECT student_registered_courses.section_code, section_details.slot_id, student_details.student_id
    //   FROM student_registered_courses
    //     LEFT JOIN section_details ON student_registered_courses.section_code = section_details.section_code
    //     LEFT JOIN student_details ON student_registered_courses.student_id = student_details.student_id
    //   WHERE section_details.slot_id  IN ? AND student_details.student_id = ? LIMIT 1 `,
    //   [courseCode, globalStudentId]
    // );
    else {
      registerCourse(sectionCode);
    }
  }

  //REGISTER COURSE
  try {
    checkCourseRegister();
  } catch (e) {
    console.log('ERROR');
  }
  async function registerCourse() {
    await pool.query(
      `INSERT INTO student_section_details (student_id, section_code, grade) VALUES (?, ?, NULL);`,
      [globalStudentId, sectionCode]
    );

    res.redirect('./addcourse');
  }
});

router.post('/unregistercourse', mustBeLoggedIn, (req, res) => {
  console.log('Student UnRegister Course POST Route!!!');
  async function registerCourse() {
    let { sectionCode } = req.body;
    sectionCode = cryptr.decrypt(sectionCode);
    await pool.query(
      `DELETE FROM student_section_details WHERE student_section_details.student_id = ? AND student_section_details.section_code = ?`,
      [globalStudentId, sectionCode]
    );
    res.redirect('./addcourse');
  }
  registerCourse();
});
router.get('/dropcourse', mustBeLoggedIn, (req, res) => {
  console.log('Student DropCourse Route!!!');

  async function DropCourse() {
    const q_getCourses = `SELECT student_section_details.*, section_details.*, semester_details.status, courses.course_title
    FROM student_section_details 
      LEFT JOIN section_details ON student_section_details.section_code = section_details.section_code 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
      LEFT JOIN courses ON courses.course_code = section_details.course_code
    WHERE student_id = ? AND  semester_details.status = 'In Progress'  
      ;`;

    let [courses] = await pool.query(q_getCourses, [globalStudentId]);
    courses.map((x) => {
      x.encryptedValue = cryptr.encrypt(x.section_code);
    });
    res.render('studentDropCourse', {
      page_name: 'dropcourse',
      firstname: globalFirstname,
      lastname: globalLastname,
      courses,
    });
  }
  DropCourse();
});

router.post('/dropcourse', mustBeLoggedIn, (req, res) => {
  console.log('Student Drop Course POST Route!!!');
  async function dropCourse() {
    let { sectionCode } = req.body;
    try {
      sectionCode = cryptr.decrypt(sectionCode);
    } catch (e) {
      res.send('ERROR');
      return 0;
    }
    await pool.query(
      `DELETE FROM student_section_details WHERE student_section_details.student_id = ? AND student_section_details.section_code = ?`,
      [globalStudentId, sectionCode]
    );
    res.redirect('./dropcourse');
  }
  dropCourse();
});

router.get('/viewmarks', mustBeLoggedIn, (req, res) => {
  console.log('Student ViewMarks Route!!!');
  const {
    selectedSemester,
    selectedCourseCode,
    selectedCourseTitle,
    selectedSectionCode,
  } = req.query;

  async function getDetails() {
    let courses, marks;
    const q_getsemesters = `SELECT student_section_details.*, section_details.*, courses.course_title, semester_details.*
    FROM student_section_details 
      LEFT JOIN section_details ON student_section_details.section_code = section_details.section_code 
      LEFT JOIN courses ON section_details.course_code = courses.course_code 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
      WHERE student_id = ? AND status != 'Active';`;

    let [semesters] = await pool.query(q_getsemesters, [globalStudentId]);
    if (semesters.length) {
      semesters = semesters.map((x) => {
        return x.semester_name;
      });
    }
    semesters = [...new Set(semesters)];
    console.log(semesters);

    if (selectedSemester !== undefined) {
      console.log(selectedSemester);
      const q_getcourses = `SELECT student_section_details.*, section_details.*, courses.course_title, semester_details.*
      FROM student_section_details 
        LEFT JOIN section_details ON student_section_details.section_code = section_details.section_code 
        LEFT JOIN courses ON section_details.course_code = courses.course_code 
        LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
        WHERE student_id = ? AND semester_name = ?;`;

      [courses] = await pool.query(q_getcourses, [
        globalStudentId,
        selectedSemester,
      ]);
      console.log(courses);
      if (courses.length) {
        courses = courses.map((x) => {
          return {
            course_title: x.course_title,
            course_code: x.course_code,
            section_code: x.section_code,
          };
        });
      }
      console.log(courses);
    }

    if (selectedSectionCode !== undefined) {
      const q_getMarks =
        'SELECT * FROM student_section_details WHERE student_id = ? AND section_code = ?';
      [marks] = await pool.query(q_getMarks, [
        globalStudentId,
        selectedSectionCode,
      ]);
      if (marks.length) {
        delete marks[0].student_id;
        delete marks[0].section_code;
        delete marks[0].Final;
      }
      console.log('Marks after', marks);
      // console.log(Object.keys(marks[0])[0]);
      console.log('This is selected Course', selectedSectionCode);
    }
    res.render('studentViewMarks', {
      page_name: 'viewmarks',
      firstname: globalFirstname,
      lastname: globalLastname,
      semesters,
      selectedSemester,
      selectedSectionCode,
      selectedCourseCode,
      selectedCourseTitle,
      courses,
      marks,
    });
  }
  getDetails();
});

router.get('/courseplan', mustBeLoggedIn, (req, res) => {
  console.log('Student CoursePlan Route!!!');
  res.render('studentCoursePlan', {
    page_name: 'courseplan',
    firstname: globalFirstname,
    lastname: globalLastname,
  });
});

router.get('/coursecatalog', mustBeLoggedIn, (req, res) => {
  console.log('Student CourseCatalog Route!!!');
  async function viewCatalog() {
    const q_getCatalog = `SELECT course_catalog.*, course_catalog.program_id, courses.*
    FROM course_catalog 
      LEFT JOIN courses ON course_catalog.course_code = courses.course_code
    WHERE course_catalog.program_id = ?
    ORDER BY course_catalog.semester;`;

    const [courseCatalog] = await pool.query(q_getCatalog, [globalProgramID]);
    console.log(courseCatalog);
    res.render('studentCourseCatalog', {
      page_name: 'coursecatalog',
      firstname: globalFirstname,
      lastname: globalLastname,
      courseCatalog,
    });
  }
  viewCatalog();
});

router.get('/roadmap', mustBeLoggedIn, (req, res) => {
  console.log('Student RoadMap Route!!!');
  async function roadMap() {
    res.render('studentRoadMap', {
      page_name: 'roadmap',
      firstname: globalFirstname,
      lastname: globalLastname,
    });
  }
  roadMap();
});
router.get('/fees', mustBeLoggedIn, (req, res) => {
  console.log('Student fees Route!!!');
  res.render('studentFees', {
    page_name: 'fees',
    firstname: globalFirstname,
    lastname: globalLastname,
  });
});

router.get('/studentprofile', mustBeLoggedIn, (req, res) => {
  console.log('Student Profile Route!!!');
  res.render('studentProfile', {
    page_name: 'Profile',
    username: globalStudentId,
    firstname: globalFirstname,
    lastname: globalLastname,
  });
});

function mustBeLoggedIn(req, res, next) {
  jwt.verify(req.cookies.studentToken, jwtPrivateKey, function (err, decoded) {
    if (err) {
      res.redirect('./login');
    } else {
      globalProgramID = decoded.program_id;
      globalFirstname = decoded.firstname;
      globalLastname = decoded.lastname;
      globalStudentId = decoded.student_id;
      next();
    }
  });
}

module.exports = router;
