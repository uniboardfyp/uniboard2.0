const express = require('express');
const mysql = require('mysql');
var bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const app = express();
const path = require('path');
const con = require('./connection');
const adminRoutes = require('./api/routes/adminRoutes');

const studentRoutes = require('./api/routes/studentRoutes');

const facultyRoutes = require('./api/routes/facultyRoutes');

const HODRoutes = require('./api/routes/HODRoutes');
// const studentRoutes = require('./routes/studentportal/studentRoutes');
// const facultyRoutes = require('./routes/facultyportal/facultyRoutes');

app.use(express.static('public'));
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
