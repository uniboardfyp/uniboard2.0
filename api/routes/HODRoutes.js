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
        res.redirect('./HODdashboard');
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
router.get('/HODdashboard', mustBeLoggedIn, (req, res) => {
  console.log('HOD Dashboard Route!!!');
  res.render('HODdashboard', {
    title: 'HOD Dashboard',
    firstname: globalFirstname,
    lastname: globalLastname,
  });
});

router.get('/allofferedcourses', mustBeLoggedIn, (req, res) => {
  console.log('HOD All Offered Courses Route');
  async function getAvailableCourses() {
    const [AllOfferedCourses] = await pool.query(
      `SELECT courses_offered.*, courses.department_id, courses.course_code, courses.course_title, courses.course_credithours, time_slots.*,
      faculty_details.*
FROM courses_offered 
	LEFT JOIN courses ON courses_offered.course_code = courses.course_code 
  LEFT JOIN faculty_details ON courses_offered.faculty_id = faculty_details.faculty_id
	LEFT JOIN time_slots ON courses_offered.slot_id = time_slots.slot_id
WHERE courses.department_id = ?`,
      [globalDepartmentID]
    );
    res.render('allofferedcourses', {
      title: 'HOD Dashboard',
      firstname: globalFirstname,
      lastname: globalLastname,
      AllOfferedCourses,
    });
  }
  getAvailableCourses();
});

router.get('/offernewcourse', mustBeLoggedIn, (req, res) => {
  console.log('Req Query', req.query.status);
  const status = req.query.status;
  console.log('HOD Offer Course Route');
  async function getAvailableCourses() {
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
      WHERE department_id = ?
      ORDER BY faculty_id;`,
      [globalDepartmentID]
    );
    let arrayFacultySlots = [];
    facultyDetails = await Promise.all(
      facultyDetails.map(async (x) => {
        let [facultySlots] = await pool.query(
          `SELECT courses_offered.slot_id
        FROM courses_offered
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

    res.render('offernewcourse', {
      title: 'HOD Dashboard',
      firstname: globalFirstname,
      lastname: globalLastname,
      courseCodes,
      timeSlots,
      facultyDetails,
      status,
    });
  }
  getAvailableCourses();
});

router.get('/addnewcourse', mustBeLoggedIn, (req, res) => {
  const { courseCode, timeSlot, faculty } = req.query;

  console.log('Add new course for : ', courseCode);
  async function addNewCourse() {
    let message;
    let [sectionCode] = await pool.query(
      `SELECT section_code FROM courses_offered ORDER BY courses_offered.section_code DESC LIMIT 1`
    );

    try {
      sectionCode = sectionCode[0].section_code;
    } catch {
      sectionCode = 'M-1000';
    }
    sectionCode = sectionCode.slice(2);
    sectionCode = parseInt(sectionCode);
    sectionCode++;
    sectionCode = 'M-' + sectionCode;
    console.log(sectionCode);
    try {
      if (faculty === 'null') {
        await pool.query(
          `INSERT INTO courses_offered (section_code, course_code, faculty_id, slot_id, room_id, seats) VALUES (?, ?, NULL, ?, NULL, '40');`,
          [sectionCode, courseCode, timeSlot]
        );
      } else {
        await pool.query(
          `INSERT INTO courses_offered (section_code, course_code, faculty_id, slot_id, room_id, seats) VALUES (?, ?, ?, ?, NULL, '40');`,
          [sectionCode, courseCode, faculty, timeSlot]
        );
      }
      message = `Course Offered - Section Code :: ${sectionCode}`;
    } catch (error) {
      console.log('Error in add New Course Route', error);
      message = `Error, Can Not Add New Course. Check Faculty Availability`;
    }
    res.redirect(`./offernewcourse?status=${message}`);
  }

  addNewCourse();
});

router.get('/alldepartmentcourses', mustBeLoggedIn, (req, res) => {
  console.log('HOD All Department Courses Route');
  async function getAvailableCourses() {
    const [AllDepartmentCourses] = await pool.query(
      `SELECT *
FROM courses 
WHERE courses.department_id = ?`,
      [globalDepartmentID]
    );
    res.render('alldepartmentcourses', {
      title: 'HOD Dashboard',
      firstname: globalFirstname,
      lastname: globalLastname,
      AllDepartmentCourses,
    });
  }
  getAvailableCourses();
});

router.get('/viewcourserequests', mustBeLoggedIn, (req, res) => {
  console.log('HOD View Faculty Requests Route');
  async function getAvailableCourses() {
    const [facultyRequests] = await pool.query(
      `SELECT faculty_offered_courses.*, faculty_details.faculty_firstname, faculty_details.faculty_lastname, courses_offered.course_code, courses.department_id
FROM faculty_offered_courses 
	LEFT JOIN faculty_details ON faculty_offered_courses.faculty_id = faculty_details.faculty_id 
	LEFT JOIN courses_offered ON faculty_offered_courses.section_code = courses_offered.section_code
	LEFT JOIN courses ON courses_offered.course_code = courses.course_code
WHERE courses.department_id = ?;`,
      [globalDepartmentID]
    );
    console.log(facultyRequests);
    res.render('facultycourserequest', {
      title: 'HOD Dashboard',
      firstname: globalFirstname,
      lastname: globalLastname,
      facultyRequests,
    });
  }
  getAvailableCourses();
});

router.get('/acceptcourserequest', mustBeLoggedIn, (req, res) => {
  console.log('HOD Accept Faculty Requests Route');
  const sectionCode = req.query.sectioncode;
  const facultyID = req.query.facultyid;

  //UPDATE courses_offered SET faculty_id = '1000' WHERE courses_offered.section_code = 'M-1000';

  async function getAvailableCourses() {
    await pool.query(
      `UPDATE courses_offered SET faculty_id = ? WHERE courses_offered.section_code = ?;`,
      [facultyID, sectionCode]
    );
    await pool.query(
      `DELETE FROM faculty_offered_courses WHERE faculty_offered_courses.section_code = ?`,
      [sectionCode]
    );
    let [timeSlot] = await pool.query(
      `SELECT courses_offered.slot_id
      FROM courses_offered
      WHERE courses_offered.section_code = ?;`,
      [sectionCode]
    );
    timeSlot = timeSlot[0].slot_id;
    let [result2] = await pool.query(
      `SELECT faculty_offered_courses.section_code, courses_offered.slot_id
          FROM faculty_offered_courses 
          LEFT JOIN courses_offered ON faculty_offered_courses.section_code = courses_offered.section_code
           WHERE faculty_offered_courses.faculty_id = ? AND courses_offered.slot_id = ? ;`,
      [facultyID, timeSlot]
    );
    result2 = result2.map((x) => {
      return x.section_code;
    });
    if (result2.length) {
      try {
        await pool.query(
          `DELETE FROM faculty_offered_courses WHERE faculty_offered_courses.faculty_id = ? AND faculty_offered_courses.section_code IN (?)`,
          [facultyID, result2]
        );
      } catch {}
      console.log(result2);
    }

    res.redirect(`./viewcourserequests`);
  }
  getAvailableCourses();
});
router.get('/rejectcourserequest', mustBeLoggedIn, (req, res) => {
  console.log('HOD Delete Faculty Requests Route');
  const sectionCode = req.query.sectioncode;
  const facultyID = req.query.facultyid;

  //UPDATE courses_offered SET faculty_id = '1000' WHERE courses_offered.section_code = 'M-1000';

  async function getAvailableCourses() {
    await pool.query(
      `DELETE FROM faculty_offered_courses WHERE faculty_offered_courses.section_code = ? AND faculty_offered_courses.faculty_id = ? `,
      [sectionCode, facultyID]
    );
    res.redirect(`./viewcourserequests`);
  }
  getAvailableCourses();
});

router.get('/deleteofferedcourse', mustBeLoggedIn, (req, res) => {
  console.log('HOD Delete Offered Course Route');
  const status = req.query.status;

  //UPDATE courses_offered SET faculty_id = '1000' WHERE courses_offered.section_code = 'M-1000';

  async function getAvailableSections() {
    let [sectionCodes] = await pool.query(
      `SELECT courses_offered.section_code, courses.department_id
         FROM courses_offered
         LEFT JOIN courses ON courses_offered.course_code = courses.course_code
         WHERE courses.department_id = ?
         ORDER BY section_code`,
      [globalDepartmentID]
    );

    sectionCodes = sectionCodes.map((x) => {
      return x.section_code;
    });

    // timeSlots = timeSlots.map((x) => {
    //   return x.course_code;
    // });

    res.render('deleteofferedcourse', {
      title: 'HOD Dashboard',
      firstname: globalFirstname,
      lastname: globalLastname,
      sectionCodes,
      status,
    });
  }

  getAvailableSections();
});

router.post('/deleteofferedcourse', mustBeLoggedIn, (req, res) => {
  const sectionCode = req.body.sectioncode;
  console.log('HOD Delete Offered Course Route Section: ', sectionCode);

  //UPDATE courses_offered SET faculty_id = '1000' WHERE courses_offered.section_code = 'M-1000';

  async function deleteSection() {
    let [sectionCodes] = await pool.query(
      `DELETE FROM courses_offered WHERE courses_offered.section_code = ?;`,
      [sectionCode]
    );
    const message = `Deleted Section : ${sectionCode}`;
    res.redirect(`./deleteofferedcourse?status=${message}`);
  }

  deleteSection();
});

router.get('/allotfaculty', mustBeLoggedIn, (req, res) => {
  console.log('HOD Allot Faculty Route');
  const status = req.query.status;

  //UPDATE courses_offered SET faculty_id = '1000' WHERE courses_offered.section_code = 'M-1000';

  async function getSections() {
    let [sectionDetails] = await pool.query(
      `SELECT courses_offered.section_code, courses_offered.slot_id
      FROM courses_offered
      LEFT JOIN courses ON courses_offered.course_code = courses.course_code
      WHERE courses_offered.faculty_id IS NULL AND courses.department_id = ?
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
        `SELECT courses_offered.faculty_id, courses_offered.slot_id
        FROM courses_offered
        WHERE faculty_id IS NOT NULL AND courses_offered.slot_id = '?' ;`,
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

  getSections();
});

router.post('/allotfaculty', mustBeLoggedIn, (req, res) => {
  const { sectionCode, facultyID } = req.body;
  console.log('HOD Allot Course Section and ID : ', sectionCode, facultyID);

  //UPDATE courses_offered SET faculty_id = '1000' WHERE courses_offered.section_code = 'M-1000';

  async function allotFaculty() {
    let [sectionCodes] = await pool.query(
      `UPDATE courses_offered SET faculty_id = ? WHERE courses_offered.section_code = ?;`,
      [facultyID, sectionCode]
    );
    const message = `Section ${sectionCode} Alloted to Faculty ${facultyID}`;
    res.redirect(`./allotfaculty?status=${message}`);
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
