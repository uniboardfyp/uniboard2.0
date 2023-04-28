const mysql = require('mysql2');

const pool = mysql
  .createPool({
    // host: 'bbxpz7le1nvyvyu3wdlo-mysql.services.clever-cloud.com',
    // user: 'uiwb5tcqd2aswcg8',
    // password: 'GAWYnKNfWxtE23ug12Jj',
    // database: 'bbxpz7le1nvyvyu3wdlo',
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'uniboard',
    dateStrings: true,
  })
  .promise();

module.exports = pool;
