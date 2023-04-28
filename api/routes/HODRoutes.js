const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const router = express.Router();
const pool = require('../../connection');

router.get('/login', (req, res) => {
  console.log('HOD Login Route!!!');
  res.render('HODLogin', { title: 'HOD Log in' });
});

//Will check username and password and will login the user will store HOD details in cookie and will redirect to dashboard
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  async function getResult(username, password) {
    const [result] = await pool.query(
      `SELECT * FROM faculty_accounts WHERE username = ? AND BINARY password = ? LIMIT 1`,
      [username, password]
    );
    if (Object.keys(result).length === 0) {
      // console.log(username, password);
      res.render('HODLogin', {
        title: 'HOD Log in',
        error: 'Incorrect Username or Password',
      });
    } else {
      // console.log(result);
      // console.log('I still worked');
      const [HODDetails] = await pool.query(
        `SELECT * FROM faculty_details WHERE faculty_username = ?  LIMIT 1`,
        [username]
      );
      const [result2] = await pool.query(
        `SELECT * FROM departments WHERE department_HOD = ?  LIMIT 1`,
        [HODDetails[0].faculty_id]
      );
      if (Object.keys(result2).length === 0) {
        // console.log(username, password);
        res.render('HODLogin', {
          title: 'HOD Log in',
          error: 'Incorrect Username or Password',
        });
      } else {
        res.cookie(
          'HODToken',
          jwt.sign(
            {
              firstname: HODDetails[0].faculty_firstname,
              lastname: HODDetails[0].faculty_lastname,
              faculty_id: HODDetails[0].faculty_id,
              type: HODDetails[0].faculty_type,
              department_id: HODDetails[0].department_id,
            },
            jwtPrivateKey
          ),
          { httpOnly: true }
        );
        res.redirect('./dashboard');
      }
    }
  }
  getResult(username, password);
});
// CREATE ACCOUNT
// READ ACCOUNT
// UPDATE ACCOUNT
// DELETE ACCOUNT

//will load dashboard
router.get('/dashboard', mustBeLoggedIn, (req, res) => {
  console.log('HOD Dashboard Route!!!');
  res.render('HodDashboard', {
    page_name: 'dashboard',
    title: 'HOD Dashboard',
    firstname: globalFirstname,
    lastname: globalLastname,
  });
});

router.get('/offeredcourses', mustBeLoggedIn, (req, res) => {
  console.log('HOD Offered Courses Route');
  async function getAvailableCourses() {
    const [AllOfferedCourses] = await pool.query(
      `SELECT section_details.*, courses.department_id, courses.course_code, courses.course_title, courses.course_credithours, time_slots.*,
      faculty_details.faculty_id,faculty_details.faculty_firstname,faculty_details.faculty_lastname
FROM section_details 
	LEFT JOIN courses ON section_details.course_code = courses.course_code 
  	LEFT JOIN faculty_details ON section_details.faculty_id = faculty_details.faculty_id
	LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id
    LEFT JOIN semester_details on section_details.semester_id = semester_details.semester_id
WHERE courses.department_id = ? and semester_details.status='Active'`,
      [globalDepartmentID]
    );
    res.render('HodViewcourses', {
      page_name: 'offeredcourses',
      firstname: globalFirstname,
      lastname: globalLastname,
      AllOfferedCourses,
    });
  }
  getAvailableCourses();
});

router.get('/inprogresscourses', mustBeLoggedIn, (req, res) => {
  console.log('HOD In Progress Courses Route');
  async function getAvailableCourses() {
    const [AllOfferedCourses] = await pool.query(
      `SELECT section_details.*, courses.department_id, courses.course_code, courses.course_title, courses.course_credithours, time_slots.*,
      faculty_details.faculty_id,faculty_details.faculty_firstname,faculty_details.faculty_lastname
FROM section_details 
	LEFT JOIN courses ON section_details.course_code = courses.course_code 
  	LEFT JOIN faculty_details ON section_details.faculty_id = faculty_details.faculty_id
	LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id
    LEFT JOIN semester_details on section_details.semester_id = semester_details.semester_id
WHERE courses.department_id = ? and semester_details.status='In Progress'`,
      [globalDepartmentID]
    );
    res.render('HodViewcourses', {
      page_name: 'inprogresscourses',
      firstname: globalFirstname,
      lastname: globalLastname,
      AllOfferedCourses,
    });
  }
  getAvailableCourses();
});

router.get('/departmentcourses', mustBeLoggedIn, (req, res) => {
  console.log('HOD Department Courses Route');
  async function getAvailableCourses() {
    const [AllDepartmentCourses] = await pool.query(
      `SELECT *
FROM courses 
WHERE courses.department_id = ?`,
      [globalDepartmentID]
    );
    console.log(AllDepartmentCourses);
    res.render('HodDepartmentCourses', {
      page_name: 'departmentcourses',
      firstname: globalFirstname,
      lastname: globalLastname,
      AllDepartmentCourses,
    });
  }
  getAvailableCourses();
});

router.get('/offernewcourse', mustBeLoggedIn, (req, res) => {
  console.log('Req Query', req.query);
  const { courseCode, timeSlot, facultyID, mes } = req.query;

  console.log('HOD Offer Course Route');
  async function getAvailableCourses() {
    const q_getBookedFaculty = ` SELECT section_details.*, semester_details.status
    FROM section_details 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
    WHERE semester_details.status = 'Active' and slot_id = ? and faculty_id IS NOT NULL;`;
    let bookedFaculty = [];
    if (timeSlot) {
      [bookedFaculty] = await pool.query(q_getBookedFaculty, [timeSlot]);
    }
    if (bookedFaculty.length) {
      bookedFaculty = bookedFaculty.map((x) => {
        return x.faculty_id;
      });
    } else {
      bookedFaculty[0] = 'x142';
    }
    console.log(bookedFaculty);
    let [courseCodes] = await pool.query(
      `SELECT courses.course_code
       FROM courses
	     WHERE courses.department_id = ?;`,
      [globalDepartmentID]
    );
    courseCodes = courseCodes.map((x) => {
      return x.course_code;
    });

    let [timeSlots] = await pool.query(
      `SELECT *
      FROM time_slots
      `
    );
    // timeSlots = timeSlots.map((x) => {
    //   return x.course_code;
    // });
    let [facultyDetails] = await pool.query(
      `SELECT faculty_id,faculty_firstname,faculty_lastname
      FROM faculty_details
      WHERE department_id = ? AND faculty_id NOT IN (?)
      ORDER BY faculty_id;`,
      [globalDepartmentID, bookedFaculty]
    );

    let arrayFacultySlots = [];
    facultyDetails = await Promise.all(
      facultyDetails.map(async (x) => {
        let [facultySlots] = await pool.query(
          `SELECT section_details.slot_id
        FROM section_details
        WHERE faculty_id = ?
        `,
          [x.faculty_id]
        );
        facultySlots.forEach((element) => {
          arrayFacultySlots.push(element.slot_id);
        });
        x.booked = arrayFacultySlots;
        arrayFacultySlots = [];
        return x;
      })
    );

    let [selectedSlot] = await pool.query(
      `SELECT *
      FROM time_slots
      WHERE slot_id = ?
      `,
      [timeSlot]
    );
    let [selectedFaculty] = await pool.query(
      `SELECT *
      FROM faculty_details
      WHERE faculty_id = ?
      `,
      [facultyID]
    );
    selectedSlot = selectedSlot[0];
    selectedFaculty = selectedFaculty[0];
    res.render('HodOfferCourse', {
      page_name: 'offernewcourse',
      firstname: globalFirstname,
      lastname: globalLastname,
      courseCodes,
      timeSlots,
      facultyDetails,

      selectedCourse: courseCode,
      selectedSlot,
      selectedFaculty,
      mes,
    });
  }
  getAvailableCourses();
});

router.post('/offernewcourse', mustBeLoggedIn, (req, res) => {
  const { courseCode, timeSlot, facultyID } = req.body;
  async function addNewCourse() {
    let [activeSem] =
      await pool.query(`SELECT semester_id FROM semester_details WHERE status = 'Active';
    `);
    if (activeSem.length) {
      activeSem = activeSem.map((x) => {
        return x.semester_id;
      });
    }
    let [sectionCode] = await pool.query(
      `SELECT * FROM section_details ORDER BY section_details.section_code DESC LIMIT 1`
    );
    if (sectionCode.length) {
      sectionCode = sectionCode.map((x) => {
        return x.section_code;
      });
    }
    let secTag = sectionCode[0].slice(0, 2);
    sectionCode = sectionCode[0].slice(2);
    sectionCode = parseInt(sectionCode);
    sectionCode++;
    sectionCode = sectionCode.toString();
    sectionCode = secTag + sectionCode;
    console.log(sectionCode);
    if (!facultyID) {
      await pool.query(
        `INSERT INTO section_details (section_code, semester_id, course_code, faculty_id, slot_id, room_id, seats) VALUES (?, ?, ?,NULL,?,NULL, '40');`,
        [sectionCode, activeSem, courseCode, timeSlot]
      );
    } else {
      await pool.query(
        `INSERT INTO section_details (section_code, semester_id, course_code, faculty_id, slot_id, room_id, seats) VALUES (?, ?, ?, ?,?, NULL, '40');`,
        [sectionCode, activeSem, courseCode, facultyID, timeSlot]
      );
    }

    res.redirect(`./offernewcourse?mes=${sectionCode}`);
  }

  addNewCourse();
});

router.get('/facultycoursereq', mustBeLoggedIn, (req, res) => {
  console.log('HOD Faculty Course Requests Route');
  const { sectionCode, facultyID } = req.query;
  async function getAvailableCourses() {
    const [facultyRequests] = await pool.query(
      `SELECT faculty_course_request.*, faculty_details.faculty_firstname, faculty_details.faculty_lastname, courses.* FROM faculty_course_request LEFT JOIN faculty_details ON faculty_course_request.faculty_id = faculty_details.faculty_id LEFT JOIN section_details ON faculty_course_request.section_code = section_details.section_code LEFT JOIN courses ON section_details.course_code = courses.course_code WHERE courses.department_id = ?;`,
      [globalDepartmentID]
    );
    console.log(facultyRequests);
    res.render('HodViewFacultyRequest', {
      page_name: 'facultycoursereq',
      firstname: globalFirstname,
      lastname: globalLastname,
      facultyRequests,
      sectionCode,
      facultyID,
    });
  }
  getAvailableCourses();
});

router.post('/acceptfacultyreq', mustBeLoggedIn, (req, res) => {
  console.log('HOD Accept Faculty Course Requests Route');
  console.log(req.body);
  const { sectionCode, facultyID } = req.body;
  async function getAvailableCourses() {
    await pool.query(
      `UPDATE section_details SET faculty_id = ? WHERE section_details.section_code = ?;`,
      [facultyID, sectionCode]
    );
    await pool.query(
      `
    DELETE FROM faculty_course_request WHERE faculty_course_request.section_code = ? AND faculty_course_request.faculty_id = ?`,
      [sectionCode, facultyID]
    );
    res.redirect(
      `./facultycoursereq?sectionCode=${sectionCode}&facultyID=${facultyID}`
    );
  }
  getAvailableCourses();
});

router.post('/rejectfacultyreq', mustBeLoggedIn, (req, res) => {
  console.log('HOD Reject Faculty Course Requests Route');

  const { sectionCode, facultyID } = req.body;
  async function getAvailableCourses() {
    await pool.query(
      `
    DELETE FROM faculty_course_request WHERE faculty_course_request.section_code = ? AND faculty_course_request.faculty_id = ?`,
      [sectionCode, facultyID]
    );
    res.redirect(`./facultycoursereq`);
  }
  getAvailableCourses();
});

router.get('/deleteofferedcourse', mustBeLoggedIn, (req, res) => {
  console.log('HOD Delete Offered Course Route');
  const { mes } = req.query;

  //UPDATE section_details SET faculty_id = '1000' WHERE section_details.section_code = 'M-1000';

  async function getAvailableSections() {
    let [courses] = await pool.query(
      `SELECT section_details.section_code, courses.* FROM section_details LEFT JOIN courses ON section_details.course_code = courses.course_code LEFT JOIN semester_details ON semester_details.semester_id = section_details.semester_id WHERE courses.department_id = ? AND semester_details.status = 'Active' ORDER BY section_code;`,
      [globalDepartmentID]
    );

    // sectionCodes = sectionCodes.map((x) => {
    //   return x.section_code;
    // });

    // timeSlots = timeSlots.map((x) => {
    //   return x.course_code;
    // });

    res.render('HodDeleteCourse', {
      page_name: 'deleteofferedcourse',
      firstname: globalFirstname,
      lastname: globalLastname,
      courses,
      mes,
    });
  }

  getAvailableSections();
});

router.post('/deleteofferedcourse', mustBeLoggedIn, (req, res) => {
  const { sectionCode } = req.body;
  console.log('HOD Delete Offered Course Route Section: ', sectionCode);

  //UPDATE section_details SET faculty_id = '1000' WHERE section_details.section_code = 'M-1000';

  async function deleteSection() {
    await pool.query(
      `DELETE FROM section_details WHERE section_details.section_code = ?;`,
      [sectionCode]
    );

    res.redirect(`./deleteofferedcourse?mes=${sectionCode}`);
  }

  deleteSection();
});

router.get('/allotfaculty', mustBeLoggedIn, (req, res) => {
  console.log('HOD Allot Faculty Route');
  const { sectionCode, timeSlot, facultyID, secCodePOST, facIDPOST } =
    req.query;

  //UPDATE section_details SET faculty_id = '1000' WHERE section_details.section_code = 'M-1000';
  async function allotFaculty() {
    let bookedFaculty = [],
      facultyDetails = [],
      selectedFaculty;
    const [sections] = await pool.query(
      `SELECT section_details.*     
       FROM section_details 
      LEFT JOIN semester_details on section_details.semester_id = semester_details.semester_id
WHERE semester_details.status='Active' and section_details.faculty_id IS NULL`
    );
    if (sectionCode) {
      const q_getBookedFaculty = ` SELECT section_details.*, semester_details.status
    FROM section_details 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
    WHERE semester_details.status = 'Active' and slot_id = ? and faculty_id IS NOT NULL;`;

      if (timeSlot) {
        [bookedFaculty] = await pool.query(q_getBookedFaculty, [timeSlot]);
      }
      if (bookedFaculty.length) {
        bookedFaculty = bookedFaculty.map((x) => {
          return x.faculty_id;
        });
      } else {
        bookedFaculty[0] = 'x142';
      }
      console.log(bookedFaculty);
      [facultyDetails] = await pool.query(
        `SELECT faculty_id,faculty_firstname,faculty_lastname
        FROM faculty_details
        WHERE department_id = ? AND faculty_id NOT IN (?)
        ORDER BY faculty_id;`,
        [globalDepartmentID, bookedFaculty]
      );
    }
    if (facultyID) {
      [selectedFaculty] = await pool.query(
        `SELECT faculty_id,faculty_firstname,faculty_lastname
        FROM faculty_details
        WHERE faculty_id = ?`,
        [facultyID]
      );
      selectedFaculty = selectedFaculty[0];
    }
    console.log(selectedFaculty);
    res.render('HodAllotFaculty', {
      page_name: 'allotfaculty',
      firstname: globalFirstname,
      lastname: globalLastname,
      sections,
      selectedSection: sectionCode,
      facultyDetails,
      timeSlot,
      selectedFaculty,
      secCodePOST,
      facIDPOST,
    });
  }
  async function getSections() {
    let [sectionDetails] = await pool.query(
      `SELECT section_details.section_code, section_details.slot_id
      FROM section_details
      LEFT JOIN courses ON section_details.course_code = courses.course_code
      WHERE section_details.faculty_id IS NULL AND courses.department_id = ?
      ORDER BY section_code`,
      [globalDepartmentID]
    );
    sectionDetails.forEach((v) => (v.bookedFaculty = []));
    sectionDetails.forEach((v) => (v.facultyDetails = []));
    let slotIDs = sectionDetails.map((x) => {
      return x.slot_id;
    });
    let result,
      i = -1;
    for (const slotID of slotIDs) {
      [result] = await pool.query(
        `SELECT section_details.faculty_id, section_details.slot_id
        FROM section_details
        WHERE faculty_id IS NOT NULL AND section_details.slot_id = '?' ;`,
        [slotID]
      );
      i++;
      if (result.length) {
        for (const facultyID of result) {
          sectionDetails[i].bookedFaculty.push(facultyID.faculty_id);
        }
      }
    }
    // sectionDetails = sectionDetails.map((x) => {
    //   return [x.section_code, x.slot_id];
    // });
    let [facultyDetails] = await pool.query(
      `SELECT faculty_firstname, faculty_lastname, faculty_id 
       FROM faculty_details
       WHERE department_id = '?'
       ORDER BY faculty_id`,
      [globalDepartmentID]
    );

    for (section of sectionDetails) {
      if (!section.bookedFaculty.length) {
        section.facultyDetails = facultyDetails;
      } else {
        for (faculty of facultyDetails) {
          if (!section.bookedFaculty.includes(faculty.faculty_id)) {
            section.facultyDetails.push(faculty);
          }
        }
      }
    }
    res.render('allotfaculty', {
      title: 'HOD Dashboard',
      firstname: globalFirstname,
      lastname: globalLastname,
      sectionDetails,
      status,
    });
    // timeSlots = timeSlots.map((x) => {
    //   return x.course_code;
    // });

    // res.render('deleteofferedcourse', {
    //   title: 'HOD Dashboard',
    //   firstname: globalFirstname,
    //   lastname: globalLastname,
    //   sectionCodes,
    //   status,
    // });
  }
  allotFaculty();
  // getSections();
});

router.post('/allotfaculty', mustBeLoggedIn, (req, res) => {
  const { sectionCode, facultyID } = req.body;
  console.log('HOD Allot Course Section and ID : ', sectionCode, facultyID);

  //UPDATE section_details SET faculty_id = '1000' WHERE section_details.section_code = 'M-1000';

  async function allotFaculty() {
    await pool.query(
      `UPDATE section_details SET faculty_id = ? WHERE section_details.section_code = ?;`,
      [facultyID, sectionCode]
    );

    res.redirect(
      `./allotfaculty?secCodePOST=${sectionCode}&facIDPOST=${facultyID}`
    );
  }

  allotFaculty();
});

router.get('/logout', (req, res) => {
  console.log('HOD Logout Route!!!');
  res.clearCookie('HODToken');
  res.redirect('./login');
  // console.log(jwtPrivateKey);
  // res.render('home', { title: 'Home Page' });
});

function mustBeLoggedIn(req, res, next) {
  jwt.verify(req.cookies.HODToken, jwtPrivateKey, function (err, decoded) {
    if (err) {
      res.redirect('./login');
    } else {
      globalHODType = decoded.type;
      globalFirstname = decoded.firstname;
      globalLastname = decoded.lastname;
      globalFacultyID = decoded.faculty_id;
      globalDepartmentID = decoded.department_id;
      next();
    }
  });
}

module.exports = router;
