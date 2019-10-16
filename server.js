const express = require('express')
const https = require('https');
const fs = require('fs');                           // used for dealing with file systems
const logger = require('morgan');
const security = require('./service/securityService')

const DataService = require('./service/dataService');

const login = require('./routes/login');
const users = require('./routes/users');
const repo = require('./routes/repository');

// Load configuration
global.appConfig = JSON.parse(fs.readFileSync("./config/config.json"));

// Create global data service
global.appDS = new DataService(global.appConfig.database)

// Clean up code if the server terminate gracefully
// Set up exit handler to cleanup
process.on('exit', () => cleanupAndExit());
process.on('SIGINT', () => cleanupAndExit());

// kill pid - nodemon restart
process.on('SIGUSR1', () => cleanupAndExit());
process.on('SIGUSR2', () => cleanupAndExit());

// configure express
const app = express()

// Log level
app.use(logger(global.appConfig.logLevel));

// JSON and URL Encode middleware
app.use(express.urlencoded({ extended: true }));

// Add routes
app.use('/', login);
app.use('/users', express.json(), users);
app.use('/repo', repo);

// Ping service for health check
app.get('/ping', (req, res) => {
    res.send('OK');
});

/// Uncaught exception handling
app.use((err, req, res, next) => {
    console.error(err);
    console.log('This is the invalid field ->', err.field)
    if (!res.headersSent) {
        if (err.message && err.message.startsWith("ConcurrentUpdateError")) {
            res.status(409).json({error: "The data has been modified!"});
            next(err);
        }
        else if (err.message && err.message.startsWith('Unauthorized')) {
            res.status(401).json({error: "You are not authorized to perform the action!"});
            next(err);
        }
        else if (err.message && err.message.startsWith('LoginFailed')) {
            res.status(401).json({error: "Login failed!"});
            next(err);
        }
        else {
            res.status(500).send(err.message);
        }
    }
});

// Create HTTPs server with TLS certificate and key
https.createServer({
        key:  fs.readFileSync(global.appConfig.tlsCertKey),
        cert: fs.readFileSync(global.appConfig.tlsCert)
    }, app)
    .listen(global.appConfig.port, () => { console.log("HTTP Web Service Started on port " + global.appConfig.port) });

/**
 * CLeanup and exit the service
 */ 
function cleanupAndExit() {
    console.log("Exist Image Repo Service.");
    if (global.appDS) {
        global.appDS.end();
        delete global.appDS;
    }

    process.exit();
}
