const path = require('path');
const winston = require('winston');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });


const getFormattedDate = () => {
    const date = new Date();
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return dd + mm + yyyy;
};

const dateSuffix = getFormattedDate();
const logPath = path.resolve(__dirname, `../logs/logs${dateSuffix}.txt`)

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(
            ({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`
        )
    ),
    transports: [
        new winston.transports.File({ filename: logPath })
    ]
});


module.exports = {
    logger,
    getFormattedDate
}
