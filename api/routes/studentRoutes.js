const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const router = express.Router();
const pool = require('../../connection');
const Safepay = require('safepay');
const config = {
  environment: 'sandbox',
  sandbox: {
    baseUrl: 'https://sandbox.api.getsafepay.com',
    apiKey: 'sec_0a3e0911-46e6-475f-8a89-0b6fcd98b837',
    apiSecret:
      '4935f4640a77a5dd51ce8795317952e4b36eb2acf4e196255683141743ef0b38',
  },
  production: {
    baseUrl: 'https://api.getsafepay.com',
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET,
  },
};

let sfpy = new Safepay(config);

router.post('/makepayment', (req, res) => {
  let amount = req.body.amount;
  amount = parseInt(amount);
  console.log(amount);
  sfpy.payments
    .create({
      amount: amount,
      currency: 'PKR',
    })
    .then((response) => {
      return response.data;
    })
    .then((data) => {
      return sfpy.checkout.create({
        tracker: data.data.token,
        orderId: '12315',
        source: 'custom',
        cancelUrl: 'https://example.com/payment-cancelled',
        redirectUrl: 'http://localhost:3000/studentportal/studentdashboard',
      });
    })
    .then((url) => {
      console.log(url);
      t_url = url;
      res.redirect(url);
    })

    .catch((error) => {
      console.error(error);
    });
});

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
      res.redirect('./studentdashboard');
    }
  }
  getResult(username, password);
});

router.get('/studentdashboard', mustBeLoggedIn, (req, res) => {
  console.log('Student Dashboard Route!!!');
  res.render('studentdashboard', {
    title: 'Student Dashboard',
    firstname: globalFirstname,
    lastname: globalLastname,
  });
});

router.get('/logout', (req, res) => {
  console.log('Student Logout Route!!!');
  res.clearCookie('studentToken');
  res.redirect('./login');
  // console.log(jwtPrivateKey);
  // res.render('home', { title: 'Home Page' });
});

//Show Coures to Register
router.get('/courseregister', mustBeLoggedIn, (req, res) => {
  async function getCoursesOffered(programid) {
    //Getting All The Courses Offered to the Program
    const [coursesOfferedDetails] = await pool.query(
      `SELECT courses_offered.section_code,courses_offered.room_id, courses_offered.seats, courses.course_code, course_catalog.program_id, courses.course_title, courses.course_credithours, time_slots.slot_day, time_slots.slot_time, faculty_details.faculty_firstname, faculty_details.faculty_lastname, course_catalog.course_type FROM courses_offered LEFT JOIN courses ON courses_offered.course_code = courses.course_code LEFT JOIN course_catalog ON course_catalog.course_code = courses.course_code LEFT JOIN time_slots ON courses_offered.slot_id = time_slots.slot_id LEFT JOIN faculty_details ON courses_offered.faculty_id = faculty_details.faculty_id WHERE courses.course_code = courses_offered.course_code AND course_catalog.program_id = ?`,
      [globalProgramID]
    );

    //Removing Courses That are already Registered or Passed
    let CoursesETR = await Promise.all(
      coursesOfferedDetails.map(async (x) => {
        const status = await checkCourseStatus(x.course_code);
        if (status === 'ETR') {
          x.status = status;
          return x;
        }
      })
    );
    CoursesETR = CoursesETR.filter((x) => {
      return x !== undefined;
    });

    CoursesETR = await Promise.all(
      CoursesETR.map(async (x) => {
        const status = await checkCourseRegister(x.section_code);
        if (status === true) {
          x.registered = true;
          return x;
        } else {
          x.registered = false;
          return x;
        }
      })
    );

    // courseREG = coursesREG.filter((x) => {
    //   return x !== undefined;
    // });
    // const coursesOfferedDetailsETR = [...courseETR];
    // const coursesOfferedDetailsREG = [...courseREG];
    // console.log('This is new Course List : ', coursesETR);
    // console.log(await checkCourseStatus('CSC1115'));

    res.render('registercourse', {
      page_name: 'Register',
      title: 'Student Portal',
      username: globalStudentId,
      firstname: globalFirstname,
      lastname: globalLastname,
      CoursesETR,
      // CoursesREG,
      // coursesOfferedDetailsETR,
      // coursesOfferedDetailsREG,
    });
    // res.send('Check Console');
  }
  async function checkCourseStatus(courseCode) {
    const [result] = await pool.query(
      `SELECT status from student_course_details WHERE student_id = ? AND course_code = ? LIMIT 1`,
      [globalStudentId, courseCode]
    );
    if (result.length > 0) {
    } else {
      result[0] = { status: 'ETR' };
    }
    return result[0].status;
  }
  async function checkCourseRegister(sectionCode) {
    const [result] = await pool.query(
      `SELECT * from student_registered_courses WHERE student_id = ? AND section_code = ? LIMIT 1`,
      [globalStudentId, sectionCode]
    );
    if (result.length > 0) {
      return true;
    }
  }
  getCoursesOffered(1);
});

//Register Course
router.get('/registernewcourse', mustBeLoggedIn, (req, res) => {
  const sectionCode = req.query.sectioncode;
  const courseCode = req.query.coursecode;

  async function checkCourseRegister(sectionCode, courseCode) {
    //CHECKING COURSES CREDIT HOURS
    const [totalCoursesREG] = await pool.query(
      `SELECT * FROM student_registered_courses WHERE  student_id = ?`,
      [globalStudentId]
    );
    console.log(totalCoursesREG.length);
    if (totalCoursesREG.length > 1) {
      res.redirect(
        './courseregister?e=' + encodeURIComponent('Courses_Limit_Reached')
      );
      res.render('registercourse', {
        page_name: 'Register',
        title: 'Student Portal',
        username: globalStudentId,
        firstname: globalFirstname,
        lastname: globalLastname,
        CoursesETR,
        // CoursesREG,
        // coursesOfferedDetailsETR,
        // coursesOfferedDetailsREG,
      });
      return 0;
    }
    //CHECKING IF SEATS ARE AVAILABLE
    const [availableSeats] = await pool.query(
      `SELECT seats FROM courses_offered WHERE section_code = ? LIMIT 1`,
      [sectionCode]
    );
    if (availableSeats[0].seats <= 0) {
      res.redirect(
        './courseregister?e=' + encodeURIComponent('Course_Seat_Full')
      );
      return 0;
    }
    //CHECKING IF COURSE IS ALREADY REGISTERED
    const [result] = await pool.query(
      `SELECT student_registered_courses.section_code, courses_offered.course_code, student_details.student_id
        FROM student_registered_courses 
          LEFT JOIN courses_offered ON student_registered_courses.section_code = courses_offered.section_code 
          LEFT JOIN student_details ON student_registered_courses.student_id = student_details.student_id
        WHERE courses_offered.course_code  = ? AND student_details.student_id = ? LIMIT 1 `,
      [courseCode, globalStudentId]
    );
    if (result.length > 0) {
      res.redirect(
        './courseregister?e=' + encodeURIComponent('Course_Already_Registered')
      );
      return 0;
    }

    const [timeSlot] = await pool.query(
      `SELECT courses_offered.slot_id FROM courses_offered WHERE courses_offered.section_code = ? LIMIT 1`,
      [sectionCode]
    );
    const [result2] = await pool.query(
      `SELECT  courses_offered.slot_id
        FROM student_registered_courses 
          LEFT JOIN courses_offered ON student_registered_courses.section_code = courses_offered.section_code 
          LEFT JOIN student_details ON student_registered_courses.student_id = student_details.student_id
        WHERE courses_offered.slot_id = ? AND student_details.student_id = ?;`,
      [timeSlot[0].slot_id, globalStudentId]
    );
    if (result2.length > 0) {
      res.redirect('./courseregister?e=' + encodeURIComponent('Time_Clash'));
      return 0;
    }
    // console.log('Time slots are', timeSlots);
    //CHECKING TIME SLOT
    // const [result2] = await pool.query(
    //   `SELECT student_registered_courses.section_code, courses_offered.slot_id, student_details.student_id
    //   FROM student_registered_courses
    //     LEFT JOIN courses_offered ON student_registered_courses.section_code = courses_offered.section_code
    //     LEFT JOIN student_details ON student_registered_courses.student_id = student_details.student_id
    //   WHERE courses_offered.slot_id  IN ? AND student_details.student_id = ? LIMIT 1 `,
    //   [courseCode, globalStudentId]
    // );
    registerCourse(sectionCode);
  }

  //REGISTER COURSE
  checkCourseRegister(sectionCode, courseCode);
  async function registerCourse(sectionCode) {
    await pool.query(
      `INSERT INTO student_registered_courses SET student_id = ?, section_code = ? `,
      [globalStudentId, sectionCode]
    );
    await pool.query(
      `UPDATE courses_offered SET seats = seats - 1 WHERE section_code = ? `,
      [sectionCode]
    );
    console.log('ADDED COURSE');
    res.redirect('./courseregister');
  }
});
router.get('/unregistercourse', mustBeLoggedIn, (req, res) => {
  const sectionCode = req.query.sectioncode;
  const courseCode = req.query.coursecode;
  console.log(sectionCode);
  async function registerCourse(sectionCode, courseCode) {
    await pool.query(
      `DELETE FROM student_registered_courses WHERE student_id = ? AND section_code = ? `,
      [globalStudentId, sectionCode]
    );
    await pool.query(
      `UPDATE courses_offered SET seats = seats + 1 WHERE section_code = ? `,
      [sectionCode]
    );
    console.log('DELETED COURSE');
    res.redirect('./courseregister');
  }
  registerCourse(sectionCode, courseCode);
});

router.get('/payfee', mustBeLoggedIn, (req, res) => {
  console.log('STUDENT PAYMENT CHECKOUT');
  res.render('checkout.ejs', {
    title: 'ABC',
    firstname: globalFirstname,
    lastname: globalLastname,
    std_id: globalStudentId,
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
