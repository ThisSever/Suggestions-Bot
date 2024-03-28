require('dotenv').config();
const mysql = require('mysql2/promise');

async function connectDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.dbAddress,
        port: process.env.dbPort,
        user: process.env.dbUser,
        password: process.env.dbPassword,
        database: process.env.dbName,
    });
    connection.on('connect', () => console.log('Соединение с Базой Данных установлено.'));
    connection.on('end', () => console.log('Разорвано соединение с Базой Данных!'));
    connection.on('error', (error) => console.log(error));
    return connection;
}

module.exports = connectDatabase;