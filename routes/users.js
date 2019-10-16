const express = require('express');
const auth = require('../service/securityService');
const User = require('../model/user');

const router = express.Router();

function checkAccessRight(req, res, next) {
    auth.checkAuthentication(global.appDS, req)
        .then(x => {
            let userId = req.params.id || req.body.id;
            if (x == userId) {
                next();
            }
            else {
                res.status(401).json({error: "Access Denied!"});
                next();
            }
        })
        .catch(e => {
            res.status(401).json({error: e.message});
            next(e);
        });
}

/* 
* POST: register new user
*/
router.post('/register', (req, res) => {
    let user = User.fromJson(req.body);
    global.appDS.createUser(user)
                .then(x => {
                    user.password = null; // clear the password before we send the user data back
                    res.json(user.toJson());
                    next();
                })
                .catch(e => {
                    res.status(401).json({error: e.message});
                    next(e);
                });
});

/* 
* POST: update user
*/
router.post('/update',
    checkAccessRight,
    (req, res, next) => {
        let user = User.fromJson(req.body);
        console.log(user);
        global.appDS.updateUser(user)
                .then(x => {
                    user.password = null; // clear the password before we send the user data back
                    res.json(user.toJson());
                    next();
                })
                .catch(e => {
                    res.status(401).json({error: e.message});
                    next(e);
                });
});

/* 
* POST: unregister user
*/
router.post('/unregister',
    checkAccessRight,
    (req, res, next) => {
        global.appDS.deleteUser(req.params.id||req.body.id)
            .then(() => {
                res.end();
                next();
            })
            .catch(e => {
                res.status(500).json({error: e.message});
                next(e);
            });
});

module.exports = router;
