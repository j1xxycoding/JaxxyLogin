const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'mysql-jaxxynt.alwaysdata.net',
    user: 'jaxxynt',
    password: 'nikmok13',
    database: 'jaxxynt_wallet',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convert pool to use promises
const promisePool = pool.promise();

module.exports = promisePool;