const express = require('express');
const multer  = require('multer');
const auth = require('../service/securityService');
const Image = require('../model/image');

const upload = multer({storage: multer.memoryStorage()});

const router = express.Router();

function checkAccessRight(req, res, next) {
    auth.checkAuthentication(global.appDS, req)
        .then(async x => {
            if (req.path.endsWith('/update') || req.path.endsWith('/delete')) {
                let ownerId = await global.appDS.getImageOwner(req.params.id || req.body.id);
                if (x == ownerId) {
                    next();
                } else {
                    res.status(401).json({ error: "Access Denied!" });
                }
            } else {
                next();
            }
        })
        .catch(e => {
            res.status(401).json({ error: e.message });
        });
}

async function addImage(ds, req, res) {
    let image = Image.fromJson(req.body);
    let imageFile = req.files['image'][0];
    console.log("Type: " + imageFile.mimetype + ", size: " + imageFile.size);
    image.imageType = imageFile.mimetype;
    image.image = imageFile.buffer;
    image.ownerId = req.body.loginUserId;
    return await ds.createImage(image);
}

/* 
* POST: add an image
*/
router.post('/add',
    upload.fields([{ name: 'image', maxCount: 1 }, { name: 'name', maxCount: 1 }, 
                   { name: 'location', maxCount: 1 }, { name: 'time', maxCount: 1 },
                   { name: 'info', maxCount: 1 }, { name: 'tags', maxCount: 16 }, 
                   { name: 'authToken', maxCount: 1 }]),
    (req, res, next) => {
        console.log(req.body);
        auth.checkAuthentication(global.appDS, req)
                .then(x => {
                    next();
                })
                .catch(e => {
                    res.status(401).json({error: e.message});
                    next(e);
                });
    },
    (req, res, next) => {
        addImage(global.appDS, req, res)
                .then(x => {
                    x.image = null;
                    res.json(x.toJson());
                    next();
                })
                .catch(e => {
                    res.status(401).json({error: e.message});
                    next(e);
                });
    });

/* 
* POST: update an image
*/
router.post('/update',
    express.json(),
    checkAccessRight,
    (req, res, next) => {
        let image = Image.fromJson(req.body);
        console.log(image);
        global.appDS.updateImageInfo(image)
                .then(x => {
                    res.json(image.toJson());
                    next();
                })
                .catch(e => {
                    res.status(401).json({error: e.message});
                    next(e);
                });
});

/* 
* POST: delete an image
*/
router.post('/delete',
    express.json(),
    checkAccessRight,
    (req, res, next) => {

        global.appDS.deleteImage(req.params.id || req.body.id)
            .then(() => {
                res.end();
                next();
            })
            .catch(e => {
                res.status(500).json({error: e.message});
                next(e);
            });
});

/* 
* POST: get an image
*/
router.post('/image',
    express.json(),
    checkAccessRight,
    (req, res, next) => {
        console.log(req.body);
        global.appDS.getImage((req.params.id || req.body.id), req.body.loginUserId, (req.params.full || req.body.full))
            .then(x => {
                res.json(x);
                next();
            })
            .catch(e => {
                res.status(500).json({error: e.message});
                next(e);
            });
});

/* 
* POST: search images
*/
router.post('/search',
    express.json(),
    checkAccessRight,
    (req, res, next) => {
        global.appDS.searchImageByTag((req.params.tag || req.body.tags), req.body.loginUserId)
            .then(x => {
                res.json(x);
                next();
            })
            .catch(e => {
                res.status(500).json({ error: e.message });
                next(e);
            });
});

module.exports = router;
