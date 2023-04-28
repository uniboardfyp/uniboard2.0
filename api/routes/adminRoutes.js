const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const router = express.Router();
const pool = require('../../connection');

router.get('/login', (req, res) => {
  console.log('Admin Login Route!!!');
  res.render('adminLogin', { title: 'Admin Log in' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  async function getResult(username, password) {
    const [adminDetails] = await pool.query(
      `SELECT * FROM admin_accounts WHERE admin_id = ? AND BINARY password = ? LIMIT 1`,
      [username, password]
    );
    if (Object.keys(adminDetails).length === 0) {
      // console.log(username, password);
      res.render('adminLogin', {
        title: 'Admin Log in',
        error: 'Incorrect Username or Password',
      });
    } else {
      // console.log(result);
      // console.log('I still worked');

      res.cookie(
        'adminToken',
        jwt.sign(
          {
            type: adminDetails[0].type,
            firstname: adminDetails[0].firstname,
            lastname: adminDetails[0].lastname,
          },
          jwtPrivateKey
        ),
        { httpOnly: true }
      );
      res.redirect('./admindashboard');
    }
  }
  getResult(username, password);
});

router.get('/admindashboard', mustBeLoggedIn, (req, res) => {
  console.log('Admin Dashboard Route!!!');
  res.render('admindashboard', {
    title: 'Admin Dashboard',
    firstname: globalFirstname,
    lastname: globalLastname,
  });
});
// CREATE ACCOUNT
// READ ACCOUNT
// UPDATE ACCOUNT
// DELETE ACCOUNT

router.get('/allocaterooms', mustBeLoggedIn, (req, res) => {
  let facultyScores = [];
  console.log('Allocate Room Route!!!');
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

  async function allotRoom(facultyID) {
    let [requests] = await pool.query(
      `   SELECT faculty_room_request.*, courses_offered.faculty_id
    FROM faculty_room_request 
      LEFT JOIN courses_offered ON faculty_room_request.section_code = courses_offered.section_code
    WHERE courses_offered.faculty_id = ?
    GROUP BY faculty_room_request.section_code;`,
      [facultyID]
    );

    console.log('Requests  :: ', requests);
    let slotID, secToDelete;
    for (let req of requests) {
      await pool.query(
        `   UPDATE courses_offered SET room_id = ? WHERE courses_offered.section_code = ?;`,
        [req.room_id, req.section_code]
      );
      console.log('1');
      await pool.query(
        `DELETE FROM faculty_room_preference WHERE faculty_room_preference.section_code = ?`,
        [req.section_code]
      );

      console.log('2');
      [slotID] = await pool.query(
        `SELECT slot_id FROM courses_offered WHERE section_code = ?`,
        [req.section_code]
      );
      slotID = slotID[0].slot_id;
      console.log('3', slotID);
      [secToDelete] = await pool.query(
        `SELECT faculty_room_preference.section_code
        FROM faculty_room_preference
          LEFT JOIN courses_offered ON faculty_room_preference.section_code = courses_offered.section_code
        WHERE courses_offered.slot_id = ?;`,
        [slotID]
      );
      console.log('4', secToDelete);
      secToDelete = secToDelete.map((x) => {
        return x.section_code;
      });
      if (secToDelete.length) {
        try {
          await pool.query(
            `DELETE FROM faculty_room_preference WHERE faculty_room_preference.section_code IN (?) AND room_id = ?`,
            [secToDelete, req.room_id]
          );
          console.log('5', secToDelete);
        } catch (e) {
          console.log(e);
        }
      }
    }
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
    console.log(facultyScores);
    for (let faculty of facultyScores) {
      console.log(faculty.id);
      // await allotRoom(faculty.id);
    }

    res.render('admindashboard', {
      title: 'Admin Dashboard',
      firstname: globalFirstname,
      lastname: globalLastname,
    });
  }

  allocateRooms();
});
router.get('/logout', (req, res) => {
  console.log('Admin Logout Route!!!');
  res.clearCookie('adminToken');
  res.redirect('./login');
  // console.log(jwtPrivateKey);
  // res.render('home', { title: 'Home Page' });
});

function mustBeLoggedIn(req, res, next) {
  jwt.verify(req.cookies.adminToken, jwtPrivateKey, function (err, decoded) {
    if (err) {
      res.redirect('./login');
    } else {
      globalAdminType = decoded.type;
      globalFirstname = decoded.firstname;
      globalLastname = decoded.lastname;

      next();
    }
  });
}

module.exports = router;
