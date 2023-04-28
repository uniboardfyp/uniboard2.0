const express = require('express');
var bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const app = express();
var cron = require('node-cron');
const pool = require('./connection');
const adminRoutes = require('./api/routes/adminRoutes');

const studentRoutes = require('./api/routes/studentRoutes');

const facultyRoutes = require('./api/routes/facultyRoutes');

const HODRoutes = require('./api/routes/HODRoutes');
// const studentRoutes = require('./routes/studentportal/studentRoutes');
// const facultyRoutes = require('./routes/facultyportal/facultyRoutes');
app.use(express.static(__dirname + '/public'));
//app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', [
  __dirname + '/views',
  __dirname + '/views/Faculty',
  __dirname + '/views/Student',
  __dirname + '/views/Admin',
  __dirname + '/views/HOD',
]);
//app.set('views', path.join(__dirname, '/views'));

// for parsing application/json
app.use(bodyParser.json());

// for parsing application/xwww-
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());

// const con = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: '',
//   database: 'uniboard',
// });
jwtPrivateKey = 'This is a JWT Private key for Univerment Management System';
// con.connect((err) => {
//   if (err) {
//     console.log('Error Connecting to Database', err);
//   } else {
//     console.log('Database Connected!');
//   }
// });
app.get('/', (req, res) => {
  console.log('Home Page');
  res.render('home.ejs', { title: 'Home Page' });
});
app.use('/admin', adminRoutes);
app.use('/studentportal', studentRoutes);

app.use('/facultyportal', facultyRoutes);
app.use('/HODportal', HODRoutes);

// app.use('/studentportal', studentRoutes);
// app.use('/facultyportal', facultyRoutes);

app.listen('3000', () => {
  console.log('Server Started on Port 3000');
});
//error handling
// app.use((req, res, next) => {
//   var error = new Error('Page not found');
//   error.status = 404;
//   next(error);
// });
// app.use((error, req, res, next) => {
//   res.status(error.status || 500);
//   console.log('Error 404');
//   res.render('404.ejs', { title: '404' });
// });
// cron.schedule('1,2,4,5 * * * *', () => {
//   console.log('running every minute 1, 2, 4 and 5');
// });
// cron.schedule(
//   '0 10 22 17 4 *',
//   () => {
//     console.log('Ran on 0 10 22 17 4');
//   },
//   {
//     scheduled: true,
//     timezone: 'Asia/Karachi',
//   }
// );
app.get('/allotroom', (req, res) => {
  console.log('Room Allocation');
  let facultyScores = [];
  async function scoreFaculty(facultyID) {
    let score = 0;
    let [facultyDetails] = await pool.query(
      `SELECT * FROM faculty_details WHERE faculty_id = ? ORDER BY faculty_id`,
      facultyID
    );
    const {
      faculty_disability,
      faculty_qualification,
      faculty_dob,
      date_of_join,
    } = facultyDetails[0];
    if (faculty_disability !== null) {
      score += 100;
    }
    let year_of_join = date_of_join.slice(0, 4);
    score += (2023 - year_of_join) * 10;
    let year_of_birth = faculty_dob.slice(0, 4);
    score += (2023 - year_of_birth) * 2;
    if (faculty_qualification === 'PHD') {
      score += 70;
    } else if (faculty_qualification === 'MS') {
      score += 40;
    } else if (faculty_qualification === 'BS') {
      score += 20;
    }
    facultyScores.push({ id: facultyID, score: score });
  }
  async function allocateRooms() {
    let [allFacultyIDs] = await pool.query(
      `SELECT * FROM faculty_details ORDER BY faculty_id`
    );

    await Promise.all(
      allFacultyIDs.map(async (fid, x) => {
        await scoreFaculty(fid.faculty_id);
      })
    );

    facultyScores = facultyScores.sort((a, b) => {
      return b.score - a.score;
    });

    for (let faculty of facultyScores) {
      // console.log('These are fac id', faculty.id);
      await allotRoom(faculty.id);
    }
    console.log('ALL FACULTY REQUESTS DONE');
    const q_getSectionsRemaining = `SELECT section_details.*, semester_details.status, courses.lab_required, time_slots.*
    FROM section_details 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id 
      LEFT JOIN courses ON section_details.course_code = courses.course_code 
      LEFT JOIN time_slots ON section_details.slot_id = time_slots.slot_id
       LEFT JOIN faculty_room_request ON section_details.section_code = faculty_room_request.section_code
    WHERE  semester_details.status = 'Active' AND section_details.room_id IS NULL;`;
    let [sectionsRoomNull] = await pool.query(q_getSectionsRemaining);
    console.log(sectionsRoomNull);
    let slotID, selectedRoom;
    const q_getBookedRooms = `  SELECT section_details.*, semester_details.status
    FROM section_details 
      LEFT JOIN semester_details ON section_details.semester_id = semester_details.semester_id
    WHERE section_details.room_id IS NOT NULL AND section_details.slot_id = ? AND semester_details.status = 'Active';`;
    let bookedRooms;
    for (let i = 0; i < sectionsRoomNull.length; i++) {
      slotID = sectionsRoomNull[i].slot_id;
      console.log(slotID);
      [bookedRooms] = await pool.query(q_getBookedRooms, [slotID]);
      console.log(bookedRooms);
      bookedRooms = bookedRooms.map((x) => {
        return x.room_id;
      });
      if (!bookedRooms.length) {
        bookedRooms[0] = 'x142';
      }
      console.log('BOOKED ROOM', i, bookedRooms);
      if (sectionsRoomNull[i].lab_required) {
        [selectedRoom] = await pool.query(
          `select * from rooms WHERE room_id NOT IN (?) AND building_name = 'CCSIS' ORDER BY room_floor LIMIT 1`,
          [bookedRooms]
        );
        selectedRoom = selectedRoom[0].room_id;
        await pool.query(
          ` UPDATE section_details SET room_id = ? WHERE section_details.section_code = ?;`,
          [selectedRoom, sectionsRoomNull[i].section_code]
        );
      } else {
        [selectedRoom] = await pool.query(
          `select * from rooms WHERE room_id NOT IN (?) AND building_name != 'CCSIS' ORDER BY room_floor LIMIT 1`,
          [bookedRooms]
        );
        selectedRoom = selectedRoom[0].room_id;
        await pool.query(
          ` UPDATE section_details SET room_id = ? WHERE section_details.section_code = ?;`,
          [selectedRoom, sectionsRoomNull[i].section_code]
        );
      }
    }
    res.render('home.ejs', { title: 'Home Page' });
  }
  async function allotRoom(facultyID) {
    let timeSlot, sectionsTimeClash;
    let [requests] = await pool.query(
      ` SELECT faculty_room_request.*, section_details.faculty_id FROM faculty_room_request LEFT JOIN section_details ON faculty_room_request.section_code = section_details.section_code WHERE section_details.faculty_id = ? GROUP BY faculty_room_request.section_code;`,
      [facultyID]
    );
    // let requestedRoom = requests[0].room_id;
    // console.log(requestedRoom);
    console.log('Requests  :: ', requests);
    for (let i = 0; i < requests.length; i++) {
      //Allocating Room
      await pool.query(
        ` UPDATE section_details SET room_id = ? WHERE section_details.section_code = ?;`,
        [requests[i].room_id, requests[i].section_code]
      );
      //Removing All The Other Request for the Section
      await pool.query(
        'DELETE from faculty_room_request WHERE section_code = ?',
        [requests[i].section_code]
      );
      //Getting Time Slot
      [timeSlot] = await pool.query(
        `SELECT slot_id FROM section_details WHERE section_code = ?`,
        [requests[i].section_code]
      );
      timeSlot = timeSlot[0].slot_id;
      [sectionsTimeClash] = await pool.query(
        `SELECT section_code FROM section_details WHERE slot_id = ? `,
        [timeSlot]
      );
      //Deleting All Other Sections
      if (sectionsTimeClash.length) {
        for (let index = 0; index < sectionsTimeClash.length; index++) {
          await pool.query(
            'DELETE from faculty_room_request WHERE section_code = ?',
            [sectionsTimeClash[index].section_code]
          );
        }
      }
    }
    let slotID, secToDelete;
    // for (let req of requests) {
    //   await pool.query(
    //     `   UPDATE courses_offered SET room_id = ? WHERE courses_offered.section_code = ?;`,
    //     [req.room_id, req.section_code]
    //   );
    //   console.log('1');
    //   await pool.query(
    //     `DELETE FROM faculty_room_preference WHERE faculty_room_preference.section_code = ?`,
    //     [req.section_code]
    //   );

    //   console.log('2');
    //   [slotID] = await pool.query(
    //     `SELECT slot_id FROM courses_offered WHERE section_code = ?`,
    //     [req.section_code]
    //   );
    //   slotID = slotID[0].slot_id;
    //   console.log('3', slotID);
    //   [secToDelete] = await pool.query(
    //     `SELECT faculty_room_preference.section_code
    //     FROM faculty_room_preference
    //       LEFT JOIN courses_offered ON faculty_room_preference.section_code = courses_offered.section_code
    //     WHERE courses_offered.slot_id = ?;`,
    //     [slotID]
    //   );
    //   console.log('4', secToDelete);
    //   secToDelete = secToDelete.map((x) => {
    //     return x.section_code;
    //   });
    //   if (secToDelete.length) {
    //     try {
    //       await pool.query(
    //         `DELETE FROM faculty_room_preference WHERE faculty_room_preference.section_code IN (?) AND room_id = ?`,
    //         [secToDelete, req.room_id]
    //       );
    //       console.log('5', secToDelete);
    //     } catch (e) {
    //       console.log(e);
    //     }
    //   }
    // }
  }
  allocateRooms();
});
