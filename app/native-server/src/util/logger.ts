// import { stderr } from 'process';
// import * as fs from 'fs';
// import * as path from 'path';

// // Set the log file path
// const LOG_DIR = path.join(
//   '/Users/hang/code/ai/chrome-mcp-server/app/native-server/dist/',
//   '.debug-log',
// ); // Use a different directory to keep logs separate
// const LOG_FILE = path.join(
//   LOG_DIR,
//   `native-host-${new Date().toISOString().replace(/:/g, '-')}.log`,
// );
// // Make sure the log directory exists
// if (!fs.existsSync(LOG_DIR)) {
//   try {
//     fs.mkdirSync(LOG_DIR, { recursive: true });
//   } catch (err) {
//     stderr.write(`[ERROR] Failed to create log directory: ${err}\n`);
//   }
// }

// // Log function
// function writeLog(level: string, message: string): void {
//   const timestamp = new Date().toISOString();
//   const logMessage = `[${timestamp}] [${level}] ${message}\n`;

//   // Write to the file
//   try {
//     fs.appendFileSync(LOG_FILE, logMessage);
//   } catch (err) {
//     stderr.write(`[ERROR] Failed to write log: ${err}\n`);
//   }

//   // Also write to stderr (does not affect the native messaging protocol)
//   stderr.write(logMessage);
// }

// // Log level functions
// export const logger = {
//   debug: (message: string) => writeLog('DEBUG', message),
//   info: (message: string) => writeLog('INFO', message),
//   warn: (message: string) => writeLog('WARN', message),
//   error: (message: string) => writeLog('ERROR', message),
// };
