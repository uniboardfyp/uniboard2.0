const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const router = express.Router();
const pool = require('../../connection');
const moment = require('moment');
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
      res.redirect('./dashboard');
    }
  }
  getResult(username, password);
});

//logout will remove cookie
router.get('/logout', (req, res) => {
  console.log('Faculty Logout Route!!!');
  res.clearCookie('facultyToken');
  res.redirect('./login');
  // console.log(jwtPrivateKey);
  // res.render('home', { title: 'Home Page' });
});
router.get('/dashboard', mustBeLoggedIn, (req, res) => {
  console.log('faculty Dashboard Route!!!');
  res.render('facultyDashboard', {
    page_name: 'dashboard',
    firstname: globalFirstname,
    lastname: globalLastname,
  });
});

router.get('/attendance', mustBeLoggedIn, (req, res) => {
  console.log('faculty attendance Route!!!');
  async function getInProgSections() {
    let inProgSec;
    const q_getInProgSec = `SELECT section_details.*, semester_details.*, courses.course_title FROM section_details LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id LEFT JOIN courses ON section_details.course_code = courses.course_code WHERE section_details.faculty_id = ? AND semester_details.status = 'In Progress'`;

    let [inProgSecData] = await pool.query(q_getInProgSec, [globalFacultyID]);

    // if (inProgSecData.length) {
    //   inProgSec = inProgSecData.map((x) => {
    //     return x.section_code;
    //   });
    // }
    // console.log(inProgSec);
    res.render('facultyAttendance', {
      page_name: 'attendance',
      firstname: globalFirstname,
      lastname: globalLastname,
      inProgSecData,
    });
  }
  getInProgSections();
});

router.get('/uploadattendance', mustBeLoggedIn, (req, res) => {
  console.log('faculty Upload Attendance Route!!!');
  const { sectionCode, selectedDate } = req.query;
  async function uploadAttendance() {
    const q_getSemesterID = `SELECT semester_id,slot_id FROM section_details WHERE  section_code = ?`;
    const q_getSlotDetails = `SELECT * from time_slots WHERE slot_id = ?`;
    let [semesterID] = await pool.query(q_getSemesterID, [sectionCode]);
    let slotID = semesterID[0].slot_id;
    let [slotDetails] = await pool.query(q_getSlotDetails, [slotID]);

    let slotDay = slotDetails[0].slot_day;

    slotDay = moment().day(slotDay).format('d');
    semesterID = semesterID[0].semester_id;

    const q_getSemesterStartDate = `SELECT start_date,end_date FROM semester_details WHERE semester_id = ?`;
    let [semesterStartDate] = await pool.query(q_getSemesterStartDate, [
      semesterID,
    ]);
    let semesterEndDate;
    semesterEndDate = semesterStartDate[0].end_date;

    semesterStartDate = semesterStartDate[0].start_date;

    let start = moment(semesterStartDate),
      end = moment(semesterEndDate),
      datesArray = [];

    // Get "next" monday
    let tmp = start.clone().day(parseInt(slotDay));
    if (tmp.isSameOrAfter(start, 'd')) {
      datesArray.push(tmp.format('YYYY-MM-DD'));
    }
    while (tmp.isBefore(end)) {
      tmp.add(7, 'days');
      datesArray.push(tmp.format('YYYY-MM-DD'));
    }
    // res.render('facultyAttendance', {
    //   page_name: 'attendance',
    //   firstname: globalFirstname,
    //   lastname: globalLastname,
    //   inProgSecData,
    // });

    let attendanceDetails;
    if (selectedDate) {
      const q_checkAttendanceExsists = `SELECT *,student_details.student_firstname,student_details.student_lastname FROM attendance 
      LEFT JOIN student_details ON attendance.student_id = student_details.student_id
      WHERE section_code = ? AND date = ?`;
      let [attendanceExsists] = await pool.query(q_checkAttendanceExsists, [
        sectionCode,
        selectedDate,
      ]);
      //data exsists for that date
      if (attendanceExsists.length) {
        attendanceDetails = attendanceExsists;
      }
      //new attendance
      else {
        const q_newAttendanceData = `SELECT * FROM student_section_details 
        LEFT JOIN student_details ON student_section_details .student_id = student_details.student_id
        WHERE section_code = ? `;
        let [newAttendanceData] = await pool.query(q_newAttendanceData, [
          sectionCode,
        ]);
        attendanceDetails = newAttendanceData;
      }

      const q_getAbsents = `SELECT COUNT(*) as absents FROM attendance WHERE student_id = ? AND status = 'Absent' AND section_code = ?`;
      let totalAbsents;
      // await attendanceDetails.forEach(async (x) => {
      //   [totalAbsents] = await pool.query(q_getAbsents, [
      //     x.student_id,
      //     sectionCode,
      //   ]);
      //   x.totalAbsents = totalAbsents[0].abc;
      //   console.log('W');
      // });
      for (let x of attendanceDetails) {
        [totalAbsents] = await pool.query(q_getAbsents, [
          x.student_id,
          sectionCode,
        ]);
        x.totalAbsents = totalAbsents[0].absents;
      }

      console.log(attendanceDetails);
    }

    res.render('facultyUploadAttendance', {
      page_name: 'attendance',
      firstname: globalFirstname,
      lastname: globalLastname,
      datesArray,
      slotDay: slotDetails[0].slot_day,
      slotTime: slotDetails[0].slot_time,
      sectionCode,
      selectedDate,
      attendanceDetails,
    });
  }
  uploadAttendance();
});
router.post('/uploadattendance', mustBeLoggedIn, (req, res) => {
  console.log('faculty POST Upload Attendance Route!!!');
  const { attendanceStatus, selectedDate, sectionCode } = req.body;
  async function uploadAttendance() {
    let studentsInSection;
    const q_sectionData = `SELECT student_section_details.student_id,student_section_details.section_code, student_details.*
    FROM student_section_details 
      LEFT JOIN student_details ON student_section_details.student_id = student_details.student_id
      WHERE section_code = ?;`;
    [studentsInSection] = await pool.query(q_sectionData, [sectionCode]);
    const q_checkAttendExsist = `SELECT * FROM attendance WHERE section_code = ? AND date = ?`;
    let [attendExsist] = await pool.query(q_checkAttendExsist, [
      sectionCode,
      selectedDate,
    ]);
    if (!attendExsist.length) {
      for (let x of studentsInSection) {
        await pool.query(
          `INSERT INTO attendance (student_id, section_code, status, date) VALUES (?, ?, 'Absent', ?);`,
          [x.student_id, sectionCode, selectedDate]
        );
      }
    } else {
      await pool.query(
        `UPDATE attendance SET status = 'Absent' WHERE section_code = ? AND date = ?;`,
        [sectionCode, selectedDate]
      );
    }
    if (attendanceStatus) {
      for (let x of attendanceStatus) {
        await pool.query(
          `UPDATE attendance SET status = 'Present' WHERE student_id = ? AND section_code = ? AND date = ?;`,
          [x, sectionCode, selectedDate]
        );
      }
    }

    // if (inProgSecData.length) {
    //   inProgSec = inProgSecData.map((x) => {
    //     return x.section_code;
    //   });
    // }
    // console.log(inProgSec);
    res.redirect(
      `./uploadattendance?sectionCode=${sectionCode}&selectedDate=${selectedDate}`
    );
  }
  uploadAttendance();
});

router.get('/timetable', mustBeLoggedIn, (req, res) => {
  console.log('Faculty TimeTable Route!!!');

  async function timeTable() {
    const q_getSlotDays = `SELECT DISTINCT slot_day
    FROM time_slots;`;
    const q_getSlotTime = `SELECT DISTINCT slot_time
    FROM time_slots;`;

    let [slotDays] = await pool.query(q_getSlotDays);
    let [slotTime] = await pool.query(q_getSlotTime);

    const q_getInProgSections = `SELECT section_details.*, semester_details.status, courses.course_title, time_slots.*
    FROM section_details 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id 
      LEFT JOIN courses ON section_details.course_code = courses.course_code 
      LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id
    WHERE section_details.faculty_id = ? AND semester_details.status = 'In Progress';`;

    let [inProgSections] = await pool.query(q_getInProgSections, [
      globalFacultyID,
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

    res.render('facultyTimeTable', {
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

router.get('/requestcourse', mustBeLoggedIn, (req, res) => {
  console.log('Faculty RequestCourse Route!!!');
  async function getFacultyCourses() {
    const [result] = await pool.query(
      `SELECT section_details.*, faculty_details.faculty_id, courses.course_title, courses.course_credithours, time_slots.* FROM section_details LEFT JOIN faculty_details ON section_details.faculty_id = faculty_details.faculty_id LEFT JOIN courses ON section_details.course_code = courses.course_code LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id LEFT JOIN semester_details ON semester_details.semester_id = section_details.semester_id WHERE faculty_details.faculty_id = 1000 AND semester_details.status = 'Active';`,
      [globalFacultyID]
    );
    const bookedTimeSlots = result.map((x) => {
      return x.slot_id;
    });
    const [result2] = await pool.query(
      `SELECT section_code FROM faculty_course_request WHERE faculty_id=?;`,
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
      `SELECT section_details.*, courses.department_id, courses.course_code, courses.course_title, courses.course_credithours, time_slots.*
FROM section_details 
	LEFT JOIN courses ON section_details.course_code = courses.course_code 
	LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id
WHERE courses.department_id = ? AND section_details.faculty_id IS NULL AND section_details.slot_id NOT IN (?) AND section_details.section_code NOT IN (?)`,
      [globalDepartmentID, bookedTimeSlots, requestedCourses]
    );

    const [alreadyRequestedCourses] = await pool.query(
      `SELECT section_details.*, courses.department_id, courses.course_code, courses.course_title, courses.course_credithours, time_slots.*
FROM section_details 
	LEFT JOIN courses ON section_details.course_code = courses.course_code 
	LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id
WHERE courses.department_id = ? AND section_details.faculty_id IS NULL AND section_details.slot_id NOT IN (?) AND section_details.section_code IN (?)`,
      [globalDepartmentID, bookedTimeSlots, requestedCourses]
    );
    res.render('facultyRequestCourse', {
      page_name: 'requestcourse',
      title: 'Faculty Portal',
      firstname: globalFirstname,
      lastname: globalLastname,
      availableCourses,
      alreadyRequestedCourses,
    });
  }
  getFacultyCourses();
});

router.get('/requestnewcourse', mustBeLoggedIn, (req, res) => {
  const sectionCode = req.query.sectioncode;
  console.log('Request new course for : ', sectionCode);
  async function requestNewCourse() {
    try {
      await pool.query(
        `INSERT INTO faculty_course_request (section_code, faculty_id) VALUES (?, ?);`,
        [sectionCode, globalFacultyID]
      );
    } catch (error) {
      console.log('Error in Request New Course Route');
    }
    res.redirect('./requestcourse');
  }
  requestNewCourse();
});
router.get('/cancelrequestnewcourse', mustBeLoggedIn, (req, res) => {
  const sectionCode = req.query.sectioncode;
  console.log(sectionCode);
  async function requestNewCourse() {
    await pool.query(
      `DELETE FROM faculty_course_request WHERE faculty_course_request .section_code = ? AND faculty_course_request .faculty_id = ?`,
      [sectionCode, globalFacultyID]
    );
    res.redirect('./requestcourse');
  }
  requestNewCourse();
});

router.get('/offeredcourses', mustBeLoggedIn, (req, res) => {
  console.log('faculty OfferedCourse Route!!!');

  async function offeredCourses() {
    const q_getActiveSections = `SELECT section_details.*, semester_details.status, courses.course_title, time_slots.*
    FROM section_details 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id 
      LEFT JOIN courses ON section_details.course_code = courses.course_code 
      LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id
    WHERE section_details.faculty_id = ? AND semester_details.status = 'Active';`;

    let [ActiveSections] = await pool.query(q_getActiveSections, [
      globalFacultyID,
    ]);
    console.log(ActiveSections);
    // if (ActiveSections.length) {
    //   ActiveSections = ActiveSections.map((x) => {
    //     return {
    //       course_code: x.course_code,
    //       course_title: x.course_title,
    //       slot_day: x.slot_day,
    //       slot_time: x.slot_time,
    //     };
    //   });
    // }

    res.render('facultyOfferedCourses', {
      page_name: 'offeredcourses',
      firstname: globalFirstname,
      lastname: globalLastname,

      courses: ActiveSections,
    });
  }
  offeredCourses();
});
router.get('/availablecourses', mustBeLoggedIn, (req, res) => {
  console.log('faculty AvailableCourses Route!!!');
  res.render('facultyAvailableCourses', { page_name: 'availablecourses' });
});

router.get('/requestroom', mustBeLoggedIn, (req, res) => {
  console.log('faculty requestroom Route!!!');
  let { sectionCode, building, floors, rooms, submitted, mes, sectionCode2 } =
    req.query;
  console.log(req.query);
  async function reqRoom() {
    const q_getActiveSections = `SELECT section_details.*, semester_details.status, courses.course_title, time_slots.*
    FROM section_details 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id 
      LEFT JOIN courses ON section_details.course_code = courses.course_code 
      LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id
       LEFT JOIN faculty_room_request ON section_details.section_code = faculty_room_request.section_code
    WHERE section_details.faculty_id = ? AND semester_details.status = 'Active' AND section_details.room_id IS NULL AND faculty_room_request.section_code IS NULL;`;

    let [activeSections] = await pool.query(q_getActiveSections, [
      globalFacultyID,
    ]);
    //If Clicked on a room
    if (sectionCode) {
      let [labReq] = await pool.query(
        ` SELECT section_details.section_code, courses.lab_required
    FROM section_details 
      LEFT JOIN courses ON section_details.course_code = courses.course_code
      WHERE section_details.section_code = ?;`,
        [sectionCode]
      );

      labReq = labReq[0].lab_required;

      let allRooms;
      if (labReq) {
        [allRooms] = await pool.query(
          `SELECT * from rooms WHERE building_name = 'CCSIS'`
        );
      } else {
        [allRooms] = await pool.query(
          `SELECT * from rooms WHERE building_name != 'CCSIS'`
        );
      }
      //
      const tempAllBuildings = allRooms.map((x) => {
        return x.building_name;
      });
      const allBuildings = [...new Set(tempAllBuildings)];

      //If Building is selected
      if (building) {
        let Allfloors = [];
        const q_getMaxFloor = `select building_floors from building WHERE building_name IN (?)  order by building_floors desc limit 0,1;`;
        let [maxFloor] = await pool.query(q_getMaxFloor, building);
        maxFloor = maxFloor[0].building_floors;

        for (let i = 0; i < maxFloor; i++) {
          Allfloors[i] = i + 1;
        }

        //floor is also selected
        if (floors) {
          const q_getSlotID = `SELECT slot_id FROM section_details WHERE section_code = ?`;
          let [slotId] = await pool.query(q_getSlotID, [sectionCode]);
          slotId = slotId.map((x) => {
            return x.slot_id;
          });
          floors = floors.map(Number);
          const q_getAllRooms = `select * from rooms WHERE room_id NOT IN (?) AND building_name IN (?)  AND room_floor IN (?);`;
          const q_getBookedRooms = `  SELECT section_details.*, semester_details.status
          FROM section_details 
            LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
          WHERE section_details.room_id IS NOT NULL AND section_details.slot_id = ? AND semester_details.status = 'Active';`;

          let [bookedRooms] = await pool.query(q_getBookedRooms, slotId);

          bookedRooms = bookedRooms.map((x) => {
            return x.room_id;
          });
          if (!bookedRooms.length) {
            bookedRooms[0] = 'x142';
          }

          let [Allrooms] = await pool.query(q_getAllRooms, [
            bookedRooms,
            building,
            floors,
          ]);

          //room is also selected
          if (rooms) {
            //submitted
            if (submitted) {
              const [result] = await pool.query(
                ` SELECT faculty_id FROM section_details
                 WHERE section_code = ?`,
                [sectionCode]
              );
              if (result[0].faculty_id === globalFacultyID) {
                rooms.forEach((room) => {
                  pool.query(
                    `INSERT INTO faculty_room_request (section_code, room_id) VALUES (?, ?)`,
                    [sectionCode, room]
                  );
                });
                res.redirect(
                  `./requestroom?mes=success&sectionCode2=${sectionCode}`
                );
              } else {
                console.log('ERROR INVALID FACULTY ID ');
                res.render('403');
              }
            } else {
              res.render('facultyRequestRoom', {
                page_name: 'requestroom',
                firstname: globalFirstname,
                lastname: globalLastname,
                courses: activeSections,
                allBuildings,
                building,
                Allfloors,
                sectionCode,
                floors,
                Allrooms,
                rooms,
              });
            }
          }
          //room is not selected
          else {
            res.render('facultyRequestRoom', {
              page_name: 'requestroom',
              firstname: globalFirstname,
              lastname: globalLastname,
              courses: activeSections,
              allBuildings,
              building,
              Allfloors,
              sectionCode,
              floors,
              Allrooms,
            });
          }
        }
        //floor not selected
        else {
          res.render('facultyRequestRoom', {
            page_name: 'requestroom',
            firstname: globalFirstname,
            lastname: globalLastname,
            courses: activeSections,
            allBuildings,
            building,
            Allfloors,
            sectionCode,
          });
        }
      }
      //building not selected
      else {
        res.render('facultyRequestRoom', {
          page_name: 'requestroom',
          firstname: globalFirstname,
          lastname: globalLastname,
          courses: activeSections,
          allBuildings,
          sectionCode,
        });
      }
    }
    //no section selected
    else {
      res.render('facultyRequestRoom', {
        page_name: 'requestroom',
        firstname: globalFirstname,
        lastname: globalLastname,
        courses: activeSections,
        mes,
        sectionCode2,
      });
    }
  }
  reqRoom();
});

router.get('/viewroomrequests', mustBeLoggedIn, (req, res) => {
  console.log('faculty viewroomrequests Route!!!');
  const secCode = req.query.sectionCode;
  async function showFacultyRoomRequests() {
    let [sectionCodes] = await pool.query(
      `SELECT DISTINCT faculty_room_request.section_code
      FROM faculty_room_request 
        LEFT JOIN section_details ON faculty_room_request.section_code = section_details.section_code
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
        `SELECT faculty_room_request.*
    FROM faculty_room_request
    WHERE faculty_room_request.section_code IN (?)
    `,
        [sectionCodes]
      );
    }
    console.log(roomRequestData);
    res.render('facultyViewRoomRequests', {
      page_name: 'viewroomrequests',
      firstname: globalFirstname,
      lastname: globalLastname,
      sectionCodes,
      roomRequestData,
      secCode,
    });
  }
  showFacultyRoomRequests();
});

router.get('/deleterequestroom', mustBeLoggedIn, (req, res) => {
  const sectionCode = req.query.sectionCode;
  console.log(sectionCode);
  async function requestNewCourse() {
    const [result] = await pool.query(
      ` SELECT faculty_id FROM section_details
       WHERE section_code = ?`,
      [sectionCode]
    );
    if (result[0].faculty_id === globalFacultyID) {
      await pool.query(
        `DELETE FROM faculty_room_request WHERE section_code = ? `,
        [sectionCode]
      );

      res.redirect(`./viewroomrequests?sectionCode=${sectionCode}`);
    }
  }
  requestNewCourse();
});

router.get('/availablerooms', mustBeLoggedIn, (req, res) => {
  console.log('faculty availablerooms Route!!!');
  async function showAllRooms() {
    const [allSlots] = await pool.query(`SELECT * FROM time_slots`);
    const [allRooms] = await pool.query(`SELECT * FROM rooms`);
    //Getting all room ID
    const allRoomID = allRooms.map((x) => {
      return x.room_id;
    });
    //Getting rooms that have been alloted with atleast one class

    if (allRoomID.length === 0) {
      allRoomID[0] = 'x142';
    }

    const [result] = await pool.query(
      ` SELECT section_details.slot_id, rooms.room_id, semester_details.status
    FROM section_details 
      LEFT JOIN rooms ON section_details.room_id = rooms.room_id
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
    WHERE rooms.room_id IN (?) AND status = 'Active' ORDER BY rooms.room_id,section_details.slot_id `,
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

    res.render('facultyAvailableRooms', {
      page_name: 'availablerooms',

      firstname: globalFirstname,
      lastname: globalLastname,
      allSlots,
      bookedRoomsData,
      freeRoomsData,
    });
  }
  showAllRooms();
});

router.get('/uploadmarks', mustBeLoggedIn, (req, res) => {
  console.log('faculty UploadMarks Route!!!');
  async function uploadMarks() {
    let inProgSec;
    const q_getInProgSec = `SELECT section_details.*, semester_details.*, courses.course_title FROM section_details LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id LEFT JOIN courses ON section_details.course_code = courses.course_code WHERE section_details.faculty_id = ? AND semester_details.status = 'In Progress'`;

    let [inProgSecData] = await pool.query(q_getInProgSec, [globalFacultyID]);

    // if (inProgSecData.length) {
    //   inProgSec = inProgSecData.map((x) => {
    //     return x.section_code;
    //   });
    // }
    // console.log(inProgSec);
    res.render('facultyUploadMarks', {
      page_name: 'uploadmarks',
      firstname: globalFirstname,
      lastname: globalLastname,
      inProgSecData,
    });
  }
  uploadMarks();
});
router.get('/viewmarks', mustBeLoggedIn, (req, res) => {
  console.log('faculty ViewMarks Route!!!');
  const { sectionCode } = req.query;
  async function editMarks() {
    const q_getAllStudents = `SELECT student_section_details.*,student_details.student_firstname,student_details.student_lastname FROM student_section_details 
    LEFT JOIN student_details ON student_details.student_id = student_section_details.student_id 
    WHERE student_section_details.section_code = ? `;

    let [allSectionData] = await pool.query(q_getAllStudents, [sectionCode]);

    console.log(allSectionData);
    res.render('facultyViewMarks', {
      page_name: 'Viewmarks',
      firstname: globalFirstname,
      lastname: globalLastname,
      allSectionData,
      sectionCode,
    });
  }
  editMarks();
});

router.get('/editmarks', mustBeLoggedIn, (req, res) => {
  console.log('faculty EditMarks Route!!!');
  const { sectionCode, mes } = req.query;
  async function editMarks() {
    const q_getAllStudents = `SELECT student_section_details.*,student_details.student_firstname,student_details.student_lastname FROM student_section_details 
    LEFT JOIN student_details ON student_details.student_id = student_section_details.student_id 
    WHERE student_section_details.section_code = ? `;

    let [allSectionData] = await pool.query(q_getAllStudents, [sectionCode]);

    console.log(allSectionData);
    res.render('facultyEditMarks', {
      page_name: 'editmarks',
      firstname: globalFirstname,
      lastname: globalLastname,
      allSectionData,
      sectionCode,
      mes,
    });
  }
  editMarks();
});

router.post('/editmarks', mustBeLoggedIn, (req, res) => {
  console.log('Faculty Edited Marks Save Route!');

  const { studentID, Assignment, Quiz, Midterm, Final, sectionCode } = req.body;
  console.log(studentID, Assignment, Quiz, Midterm, Final);

  async function editMarks() {
    const q_setMarks = `UPDATE student_section_details 
    SET Assignment = ?,Quiz = ? ,MidTerm = ? ,Final = ? 
    WHERE student_section_details.student_id = ? AND student_section_details.section_code = ?;`;

    for (let index = 0; index < studentID.length; index++) {
      await pool.query(q_setMarks, [
        Assignment[index],
        Quiz[index],
        Midterm[index],
        Final[index],
        studentID[index],
        sectionCode,
      ]);
    }

    res.redirect(`./editmarks?sectionCode=${sectionCode}&mes=1`);
  }
  editMarks();
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
