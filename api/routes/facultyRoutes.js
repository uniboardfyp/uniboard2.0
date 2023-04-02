const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const router = express.Router();
const pool = require('../../connection');

//Route will load the login page
router.get('/login', (req, res) => {
  console.log('Faculty Login Route!!!');
  res.render('facultyLogin', { title: 'Faculty Log in' });
});

//Will check username and password and will login the user will store faculty details in cookie and will redirect to dashboard
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  async function getResult(username, password) {
    const [result] = await pool.query(
      `SELECT * FROM faculty_accounts WHERE username = ? AND BINARY password = ? LIMIT 1`,
      [username, password]
    );
    if (Object.keys(result).length === 0) {
      // console.log(username, password);
      res.render('FacultyLogin', {
        title: 'Faculty Log in',
        error: 'Incorrect Username or Password',
      });
    } else {
      // console.log(result);
      // console.log('I still worked');
      const [facultyDetails] = await pool.query(
        `SELECT * FROM faculty_details WHERE faculty_username = ?  LIMIT 1`,
        [username]
      );
      res.cookie(
        'facultyToken',
        jwt.sign(
          {
            firstname: facultyDetails[0].faculty_firstname,
            lastname: facultyDetails[0].faculty_lastname,
            faculty_id: facultyDetails[0].faculty_id,
            type: facultyDetails[0].faculty_type,
            department_id: facultyDetails[0].department_id,
          },
          jwtPrivateKey
        ),
        { httpOnly: true }
      );
      res.redirect('./facultydashboard');
    }
  }
  getResult(username, password);
});

//will load dashboard
router.get('/facultydashboard', mustBeLoggedIn, (req, res) => {
  console.log('Faculty Dashboard Route!!!');
  res.render('facultydashboard', {
    title: 'Faculty Dashboard',
    firstname: globalFirstname,
    lastname: globalLastname,
  });
});
//logout will remove cookie
router.get('/logout', (req, res) => {
  console.log('Faculty Logout Route!!!');
  res.clearCookie('facultyToken');
  res.redirect('./login');
  // console.log(jwtPrivateKey);
  // res.render('home', { title: 'Home Page' });
});

// will show all the courses that the faculty is offering and will render facultycourseplan
router.get('/courseplan', mustBeLoggedIn, (req, res) => {
  console.log('Faculty Course Plan');
  async function getCoursePlan() {
    const [coursePlan] = await pool.query(
      `SELECT courses_offered.*, faculty_details.faculty_id, courses.course_title, courses.course_credithours, time_slots.*
      FROM courses_offered 
          LEFT JOIN faculty_details ON courses_offered.faculty_id = faculty_details.faculty_id 
          LEFT JOIN courses ON courses_offered.course_code = courses.course_code 
          LEFT JOIN time_slots ON courses_offered.slot_id = time_slots.slot_id
      WHERE faculty_details.faculty_id = ?;`,
      [globalFacultyID]
    );

    res.render('facultycourseplan', {
      page_name: 'Course Catalog',
      title: 'Faculty Portal',

      firstname: globalFirstname,
      lastname: globalLastname,
      coursePlan,
    });
  }
  getCoursePlan();
});

//will show all the courses offered that are from same department and render facultyavailablecourse
router.get('/availablecourses', mustBeLoggedIn, (req, res) => {
  console.log('Faculty Available Courses');

  async function getAvailableCourses() {
    const [availableCourses] = await pool.query(
      `SELECT courses_offered.*, courses.department_id, courses.course_code, courses.course_title, courses.course_credithours, time_slots.*
FROM courses_offered 
	LEFT JOIN courses ON courses_offered.course_code = courses.course_code 
	LEFT JOIN time_slots ON courses_offered.slot_id = time_slots.slot_id
WHERE courses.department_id = ? AND courses_offered.faculty_id IS NULL`,
      [globalDepartmentID]
    );
    res.render('facultyavailablecourses', {
      page_name: 'Course Catalog',
      title: 'Faculty Portal',
      firstname: globalFirstname,
      lastname: globalLastname,
      availableCourses,
    });
  }
  getAvailableCourses();
});

//will render request courses and will show the courses that the faculty can offer
router.get('/requestcourses', mustBeLoggedIn, (req, res) => {
  console.log('Faculty Request Courses');
  async function getFacultyCourses() {
    const [result] = await pool.query(
      `SELECT courses_offered.*, faculty_details.faculty_id, courses.course_title, courses.course_credithours, time_slots.*
      FROM courses_offered 
          LEFT JOIN faculty_details ON courses_offered.faculty_id = faculty_details.faculty_id 
          LEFT JOIN courses ON courses_offered.course_code = courses.course_code 
          LEFT JOIN time_slots ON courses_offered.slot_id = time_slots.slot_id
      WHERE faculty_details.faculty_id = ?;`,
      [globalFacultyID]
    );
    const bookedTimeSlots = result.map((x) => {
      return x.slot_id;
    });
    const [result2] = await pool.query(
      `SELECT section_code FROM faculty_offered_courses WHERE faculty_id=?;`,
      [globalFacultyID]
    );

    const requestedCourses = result2.map((x) => {
      return x.section_code;
    });

    if (requestedCourses.length === 0) {
      requestedCourses[0] = 'x142';
    }
    if (bookedTimeSlots.length === 0) {
      bookedTimeSlots[0] = 'x142';
    }

    const [availableCourses] = await pool.query(
      `SELECT courses_offered.*, courses.department_id, courses.course_code, courses.course_title, courses.course_credithours, time_slots.*
FROM courses_offered 
	LEFT JOIN courses ON courses_offered.course_code = courses.course_code 
	LEFT JOIN time_slots ON courses_offered.slot_id = time_slots.slot_id
WHERE courses.department_id = ? AND courses_offered.faculty_id IS NULL AND courses_offered.slot_id NOT IN (?) AND courses_offered.section_code NOT IN (?)`,
      [globalDepartmentID, bookedTimeSlots, requestedCourses]
    );

    const [alreadyRequestedCourses] = await pool.query(
      `SELECT courses_offered.*, courses.department_id, courses.course_code, courses.course_title, courses.course_credithours, time_slots.*
FROM courses_offered 
	LEFT JOIN courses ON courses_offered.course_code = courses.course_code 
	LEFT JOIN time_slots ON courses_offered.slot_id = time_slots.slot_id
WHERE courses.department_id = ? AND courses_offered.faculty_id IS NULL AND courses_offered.slot_id NOT IN (?) AND courses_offered.section_code IN (?)`,
      [globalDepartmentID, bookedTimeSlots, requestedCourses]
    );
    res.render('facultyrequestcourses', {
      page_name: 'Course Catalog',
      title: 'Faculty Portal',
      firstname: globalFirstname,
      lastname: globalLastname,
      availableCourses,
      alreadyRequestedCourses,
    });
  }
  getFacultyCourses();
});

//will request for a new course
router.get('/requestnewcourse', mustBeLoggedIn, (req, res) => {
  const sectionCode = req.query.sectioncode;
  console.log('Request new course for : ', sectionCode);
  async function requestNewCourse() {
    try {
      await pool.query(
        `INSERT INTO faculty_offered_courses (section_code, faculty_id) VALUES (?, ?);`,
        [sectionCode, globalFacultyID]
      );
    } catch (error) {
      console.log('Error in Request New Course Route');
    }
    res.redirect('./requestcourses');
  }
  requestNewCourse();
});

//deleting the request for new course
router.get('/cancelrequestnewcourse', mustBeLoggedIn, (req, res) => {
  const sectionCode = req.query.sectioncode;
  console.log(sectionCode);
  async function requestNewCourse() {
    await pool.query(
      `DELETE FROM faculty_offered_courses WHERE faculty_offered_courses.section_code = ? AND faculty_offered_courses.faculty_id = ?`,
      [sectionCode, globalFacultyID]
    );
    res.redirect('./requestcourses');
  }
  requestNewCourse();
});
//gets all rooms and their data
router.get('/availablerooms', mustBeLoggedIn, (req, res) => {
  console.log('Show Available Rooms Route');
  async function showAllSlots() {
    try {
      const [allSlots] = await pool.query(`SELECT * FROM time_slots`);
      const [allRooms] = await pool.query(
        `SELECT * FROM rooms WHERE room_building `
      );
      //Getting all room ID
      const allRoomID = allRooms.map((x) => {
        return x.room_id;
      });
      //Getting rooms that have been alloted with atleast one class

      if (allRoomID.length === 0) {
        allRoomID[0] = 'x142';
      }

      const [result] = await pool.query(
        ` SELECT courses_offered.slot_id, rooms.room_id
    FROM courses_offered 
      LEFT JOIN rooms ON courses_offered.room_id = rooms.room_id
    WHERE rooms.room_id IN (?) ORDER BY rooms.room_id,courses_offered.slot_id `,
        [allRoomID]
      );
      //getting id of rooms that have atleast one class booked
      const bookedRoomArray = result.map((x) => {
        return x.room_id;
      });
      const bookedRoomID = [...new Set(bookedRoomArray)];
      if (bookedRoomID.length === 0) {
        bookedRoomID[0] = 'x142';
      }
      const [bookedRoomsData] = await pool.query(
        ` SELECT * FROM rooms
    WHERE rooms.room_id IN (?) ORDER BY rooms.room_id `,
        [bookedRoomID]
      );

      let temparray = [];
      bookedRoomsData.map((x) => {
        temparray = [];
        // x.room_id
        result.map((y) => {
          if (x.room_id === y.room_id) {
            temparray.push(y.slot_id);
          }
        });
        x.slot_id = temparray;
      });
      //getting data of rooms with no class booked
      const [freeRoomsData] = await pool.query(
        ` SELECT *
    FROM rooms
    WHERE rooms.room_id NOT IN (?) ORDER BY rooms.room_id`,
        [bookedRoomID]
      );

      res.render('showavailablerooms', {
        page_name: 'Course Catalog',
        title: 'Faculty Portal',
        firstname: globalFirstname,
        lastname: globalLastname,
        allSlots,
        bookedRoomsData,
        freeRoomsData,
      });
    } catch (error) {
      console.log('Error in show all rooms');
      res.render('403');
    }
  }
  showAllSlots();
});

//shows section id and asks to proceed with preferences
router.get('/requestpreferredroom', mustBeLoggedIn, (req, res) => {
  console.log('Request Preferred Room');

  async function getSlotsForPreference() {
    //SECTION WHERE ROOM IS NOT ALLOTED
    const [sectionCode] = await pool.query(
      `SELECT courses_offered.section_code
    FROM courses_offered 
      LEFT JOIN faculty_details ON courses_offered.faculty_id = faculty_details.faculty_id
      LEFT JOIN faculty_room_preference ON courses_offered.section_code = faculty_room_preference.section_code
    WHERE courses_offered.faculty_id = ? AND faculty_room_preference.section_code IS NULL`,
      [globalFacultyID]
    );

    res.render('facultyreqpreferredroom', {
      page_name: 'Course Catalog',
      title: 'Faculty Portal',
      firstname: globalFirstname,
      lastname: globalLastname,
      sectionCode,
    });
  }
  getSlotsForPreference();
});

//only to show buildings and floor
router.get('/requestroom', mustBeLoggedIn, (req, res) => {
  console.log('Request Room for ', req.query.sectionCode);
  const { sectionCode } = req.query;
  async function getSlotsForPreference() {
    //SECTION WHERE ROOM IS NOT ALLOTED
    //ALL ROOMS

    let [labReq] = await pool.query(
      ` SELECT courses_offered.section_code, courses.lab_required
    FROM courses_offered 
      LEFT JOIN courses ON courses_offered.course_code = courses.course_code
      WHERE courses_offered.section_code = ?;`,
      [sectionCode]
    );

    labReq = labReq[0].lab_required;

    let allRooms;
    if (labReq) {
      [allRooms] = await pool.query(
        `SELECT * from rooms WHERE room_building = 'CCSIS'`
      );
    } else {
      [allRooms] = await pool.query(
        `SELECT * from rooms WHERE room_building != 'CCSIS'`
      );
    }
    // console.log(allRooms);
    const tempAllBuildings = allRooms.map((x) => {
      return x.room_building;
    });
    const allBuildings = [...new Set(tempAllBuildings)];
    const allFloors = [1, 2, 3, 4];

    res.render('selectpreferredroom', {
      page_name: 'Course Catalog',
      title: 'Faculty Portal',
      firstname: globalFirstname,
      lastname: globalLastname,
      sectionCode,
      allBuildings,
      allFloors,
    });
  }
  getSlotsForPreference();
});

//will show all the available rooms and will render select preffered room
router.get('/showrooms', mustBeLoggedIn, (req, res) => {
  console.log('Show Room Route');
  let { building, floor, sectionCode } = req.query;

  async function getSlotsForPreference() {
    //SECTION WHERE ROOM IS NOT ALLOTED
    //ALL ROOMS
    try {
      const [allRooms] = await pool.query(`SELECT * from rooms`);
      const [slotId] = await pool.query(
        `SELECT courses_offered.slot_id
    FROM courses_offered
    WHERE courses_offered.section_code = ? LIMIT 1;`,
        [sectionCode]
      );
      const tempAllBuildings = allRooms.map((x) => {
        return x.room_building;
      });

      let [bookedRooms] = await pool.query(
        `SELECT courses_offered.room_id
        FROM courses_offered
        WHERE courses_offered.slot_id = ? AND courses_offered.room_id IS NOT NULL`,
        [slotId[0].slot_id]
      );

      bookedRooms = bookedRooms.map((x) => {
        return x.room_id;
      });
      if (!bookedRooms.length) {
        bookedRooms[0] = 'x142';
      }
      const [allAvailableRooms] = await pool.query(
        `SELECT room_id from rooms WHERE 
      rooms.room_id NOT IN (?)
      AND room_building IN (?)
      AND room_floor IN (?)`,
        [bookedRooms, building, floor]
      );
      floor = floor.map(function (str) {
        // using map() to convert array of strings to numbers

        return parseInt(str);
      });
      // console.log('Booked Rooms', bookedRooms);
      // console.log(allAvailableRooms);
      const allBuildings = [...new Set(tempAllBuildings)];
      const allFloors = [1, 2, 3, 4];
      res.render('selectpreferredroom', {
        page_name: 'Course Catalog',
        title: 'Faculty Portal',
        firstname: globalFirstname,
        lastname: globalLastname,
        sectionCode,
        allBuildings,
        allFloors,
        allAvailableRooms,
        building,
        floor,
      });
    } catch (error) {
      console.log('Error in Show Room Route');
      res.render('403');
    }
  }
  getSlotsForPreference();
});

//will store selected room preference, will check facultyID and sectionFacultyID
router.get('/addnewroompreference', mustBeLoggedIn, (req, res) => {
  console.log('Add New Room Preference Route');
  const { sectionCode, rooms } = req.query;

  async function addNewRoomPreference() {
    try {
      const [result] = await pool.query(
        ` SELECT faculty_id FROM courses_offered
         WHERE section_code = ?`,
        [sectionCode]
      );
      if (result[0].faculty_id === globalFacultyID) {
        rooms.forEach((room) => {
          pool.query(
            `INSERT INTO faculty_room_preference (section_code, room_id) VALUES (?, ?)`,
            [sectionCode, room]
          );
        });
        res.redirect('./requestpreferredroom');
      } else {
        console.log('ERROR INVALID FACULTY ID ');
        res.render('403');
      }
    } catch (error) {
      console.log('ERROR ');
      res.render('403');
    }
  }
  addNewRoomPreference();
});

router.get('/showfacultyroomrequests', mustBeLoggedIn, (req, res) => {
  console.log('Show Room Preference Route');
  async function showFacultyRoomRequests() {
    let [sectionCodes] = await pool.query(
      `SELECT DISTINCT faculty_room_preference.section_code
      FROM faculty_room_preference 
        LEFT JOIN courses_offered ON faculty_room_preference.section_code = courses_offered.section_code
        WHERE faculty_id = ?;`,
      [globalFacultyID]
    );

    sectionCodes = sectionCodes.map((sectionCode) => {
      return sectionCode.section_code;
    });
    console.log(sectionCodes);
    let error, roomRequestData;
    if (!sectionCodes.length) {
      error = 'No Record Found!';
    } else {
      [roomRequestData] = await pool.query(
        `SELECT faculty_room_preference.*
    FROM faculty_room_preference
    WHERE faculty_room_preference.section_code IN (?)
    `,
        [sectionCodes]
      );
    }
    console.log(roomRequestData);
    res.render('showpreferredroomrequests', {
      page_name: 'Course Catalog',
      title: 'Faculty Portal',
      firstname: globalFirstname,
      lastname: globalLastname,
      sectionCodes,
      roomRequestData,
      error,
    });
  }
  showFacultyRoomRequests();
});

//deleting the preferred room request
router.get('/deleterequestroom', mustBeLoggedIn, (req, res) => {
  const sectionCode = req.query.sectionCode;
  console.log(sectionCode);
  async function requestNewCourse() {
    const [result] = await pool.query(
      ` SELECT faculty_id FROM courses_offered
       WHERE section_code = ?`,
      [sectionCode]
    );
    if (result[0].faculty_id === globalFacultyID) {
      await pool.query(
        `DELETE FROM faculty_room_preference WHERE section_code = ? `,
        [sectionCode]
      );

      res.redirect('./showfacultyroomrequests');
    }
  }
  requestNewCourse();
});

function mustBeLoggedIn(req, res, next) {
  jwt.verify(req.cookies.facultyToken, jwtPrivateKey, function (err, decoded) {
    if (err) {
      res.redirect('./login');
    } else {
      globaltype = decoded.type;
      globalFirstname = decoded.firstname;
      globalLastname = decoded.lastname;
      globalFacultyID = decoded.faculty_id;
      globalDepartmentID = decoded.department_id;

      next();
    }
  });
}

module.exports = router;
