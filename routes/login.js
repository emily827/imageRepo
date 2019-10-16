const express = require('express');
const auth = require('../service/securityService');
const router = express.Router();

/* 
* POST: login
*/
router.post('/login', express.json(), (req, res, next) => {
    console.log(req.body);
    auth.login(global.appDS, req.body.email, req.body.password)
        .then(x => {
            res.json('{"authToken":"' + x + '"}');
            next();
        })
        .catch(e => {
            console.error(e.message);
            res.status(500).json({ error: e.message });
            next(e);
        });
});

/* 
* GET: Logout
*/
router.get('/logout', express.json(), (req, res, next) => {
    auth.logout(global.appDS, req.body.token)
        .then(x => {
            res.end();
            next();
        })
        .catch(e => {
            res.status(500).json({ error: e.message });
            next(e);
        });
});

module.exports = router;
