const crypto = require('crypto');
const Pool = require('pg').Pool;
const sharp = require('sharp');
const assert = require('assert');

const User = require('../model/user');
const Image = require('../model/image');

module.exports = class DataService {
    pool = null;

    /*
     * Constructor
     * @param arg can be an instance of node-postgres this.pool, or a configuration object for creating a new this.pool
     */
    constructor(arg) {
        if (arg instanceof Pool) {
            console.log("Creating DataService from this.pool ...");
            this.pool = arg;
        } else {
            console.log("Creating DataService with pool - Database host: " + arg.host + ", user: " +
                        arg.user + ", database: " + arg.database);
            this.pool = new Pool(arg);
            this.pool.on('error', (err, client) => {
                console.error('Unexpected error on postgrep this.pool', err)
            });
        }
    }

    /* 
     * Validate password
     * @param email: email
     * @param password: password
     * @return user ID if the email and password are correct
     */
    async validatePassword(email, password) {
        assert(typeof email == 'string', "Invalid parameter!");
        assert(typeof password == 'string', "Invalid parameter!");
        try {
            const query = "SELECT id FROM users WHERE email=$1 AND passwd=$2";
            const result = await this.pool.query(query, [email, password]);
            if (result.rowCount > 0) {
                return result.rows[0].id;
            }
            else {
                return null;
            }
        }
        catch (e) {
            throw e;
        }
    }

    /* 
     * Save login data
     * @param token: login token
     * @param validity: validity
     * @return: user's login token
     */
    async createLogin(token, validity, userId) {
        try {
            const insert = 'INSERT INTO logins(token,validity,user_id) VALUES($1, $2, $3)';
            await this.pool.query(insert, [token, validity, userId]);
            return token;
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Returns user id, given that its valid
     * @param user: user to persist into the database
     */
    async getLoginUserId(token) {
        assert(typeof token == 'string', "Invalid parameter!");
        try {
            const query = 'SELECT user_id from logins WHERE token=$1 AND validity > clock_timestamp()';
            const result = await this.pool.query(query, [token]);
            if (result.rowCount > 0) {
                return result.rows[0].user_id;
            }
            else {
                return null;
            }
        }
        catch (e) {
            throw e;
        }
    }

    /* 
     * Delete login
     * @param token the login token
     */
    async deleteLogin(token) {
        assert(typeof token == 'string', "Invalid parameter!");
        try {
            const del = 'DELETE FROM logins WHERE token = $1';
            const result = await this.pool.query(del,[token]);
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Persist the new user into the database
     * @param user the user to persist into the database
     */
    async createUser(user) {
        assert(user instanceof User, "Invalid parameter, not a user!");
        try {
            const insert = 'INSERT INTO users(created_on,email,displayName,firstname,lastname,gender,passwd,dob) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';
            const result = await this.pool.query(insert,
                [new Date(), user.email, user.displayName, user.firstName, user.lastName, user.gender, user.password, user.dob]);
            user.id = result.rows[0].id;
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Update the given user in the database
     * @param user the user to update
     */
    async updateUser(user) {
        assert(user instanceof User, "Invalid parameter, not a user!");
        assert(user.id != null, "Invalid parameter, not a persistent data!");
        try {
            // We will perform the following operation in a transaction: 
            //     1. get the revision number for optimistic concurrency control
            //     2. update the record
            await this.pool.query('BEGIN'); // start transaction
            const queryVersion = 'SELECT revision FROM users WHERE id=$1 AND revision=$2 FOR UPDATE';
            const ver = await this.pool.query(queryVersion, [user.id, user.revision]);
            if (ver.rowCount > 0 && ver.rows[0].revision == user.revision) {
                user.revision += 1;
                const update = 'UPDATE users SET revision=$1,email=$2,displayName=$3,firstname=$4,lastname=$5,gender=$6,' +
                                'passwd=$7,dob=$8,modified_on=$9 WHERE id=$10';
                const result = await this.pool.query(update,
                                                [user.revision, user.email, user.displayName, user.firstName, user.lastName,
                                                 user.gender, user.password, user.dob, new Date(), user.id]);
                await this.pool.query('COMMIT'); // commit transaction
                return user;
            }
            else {
                throw new Error("ConcurrentUpdateError!")
            }
        }
        catch (e) {
            await this.pool.query('ROLLBACK'); // rollback transaction
            throw e;
        }
    }
    
    /*
     * Delete the given user from the database
     * @param id the id of user to delete
     */
    async deleteUser(id) {
        id = this.checkInteger(id);
        try {
            // Perform the following operation in a transaction: 
            //     1. delete images owned by the user
            //     2. delete logins of the user
            //     3. delete the user
            await this.pool.query('BEGIN')
            const result1 = await this.pool.query('DELETE FROM images WHERE owner_id=$1',[id]);
            const result2 = await this.pool.query('DELETE from logins WHERE user_id=$1',[id]);
            const result3 = await this.pool.query('DELETE FROM users WHERE id=$1',[id]);
            await this.pool.query('COMMIT');
        }
        catch (e) {
            await this.pool.query('ROLLBACK');
            throw e;
        }
    }

    /*
     * Retrieve the given user from the database
     * @param id the id of the user
     */
    async getUser(id) {
        id = this.checkInteger(id);
        try {
            const query = 'SELECT id,revision,email,displayname,firstname,lastname,passwd,gender,dob from users where id=$1';
            const result = await this.pool.query(query, [id]);
            if (result.rowCount > 0) {
                return this.userFromResult(result.rows[0]);
            }
            return null;
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Search user of the given email in the database
     * @param email the user's email
     */
    async searchUserByEmail(email) {
        assert.equal(typeof email, 'string', "Invalid parameter!");
        try {
            const query = 'SELECT id,revision,email,displayname,firstname,lastname,passwd,gender,dob from users where email=$1';
            const result = await this.pool.query(query, [email]);
            if (result.rowCount > 0) {
                return result.rows.map(value=>this.userFromResult(value));
            }
            else {
                return null;
            }
        }
        catch (e) {
            throw e;
        }
    }
    
    /*
     * Search all user og the given name in the database
     * @param name the name to search
     */
    async searchUserByName(name) {
        assert.equal(typeof name, 'string', "Invalid parameter!");
        try {
            const query = 'SELECT id,revision,email,displayname,firstname,lastname,passwd,gender,dob from users where firstname=$1 OR lastname=$1';
            const result = await this.pool.query(query, [name]);
            if (result.rowCount > 0) {
                return result.rows.map(value=>this.userFromResult(value));
            }
            else {
                return null;
            }
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Search all user og the given name in the database
     * @param firstName the first name to search
     * @param lastName the last name to search
     */
    async searchUserByNames(firstName, lastName) {
        if (firstName == null) {
            return await this.searchUserByName(lastName);
        }
        else if (lastName == null) {
            return await this.searchUserByName(firstName);
        }
        assert.equal(typeof firstName, 'string', "Invalid parameter!");
        assert.equal(typeof lastName, 'string', "Invalid parameter!");
        try {
            const query = 'SELECT id,revision,email,displayname,firstname,lastname,passwd,gender,dob from users where firstname=$1 AND lastname=$2';
            const result = await this.pool.query(query, [firstName, lastName]);
            if (result.rowCount > 0) {
                return result.rows.map(value=>this.userFromResult(value));
            }
            else {
                return null;
            }
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Persist the new image into the database
     * @param image the image to persist into the database
     */
    async createImage(image) {
        assert(image instanceof Image, "Invalid parameter, not an image!");
        try {
            image.rawId = crypto.createHash('sha256').update(image.image).digest('hex');
            image.thumbnail = await this.resizeImage(image.image, 64);
            if (Array.isArray(image.tags)) { // remove duplicated tags
                image.tags = image.tags.filter((x, pos) => image.tags.indexOf(x) == pos);
                image.tags = image.tags.map(x => x.toLowerCase());
            }
            else {
                image.tags = image.tags.toLowerCase();
            } 

            // Perform the following operation in a transaction: 
            //     1. persist the raw image
            //     2. persist the image
            await this.pool.query('BEGIN')
            const raw = await this.pool.query("SELECT id FROM raw_images WHERE id=$1 FOR UPDATE", [image.rawId]);
            if (raw.rowCount == 0) {
                image.revision = 0;
                const insertRaw = 'INSERT INTO raw_images(id, imgtype, rawdata, thumbnail, created_on) VALUES($1, $2, $3, $4, $5)';
                const raw = await this.pool.query(insertRaw,
                                             [image.rawId, image.imageType, image.image, image.thumbnail, new Date()]);
            }

            const insert = 'INSERT INTO images(name, owner_id, raw_id, tags, time_taken, loc, info, created_on) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';
            const result = await this.pool.query(insert,
                                            [image.name, image.ownerId, image.rawId, image.tags, image.time, image.location, image.info, new Date()]);           
            await this.pool.query('COMMIT');
            image.id = result.rows[0].id;
            return image;
        }
        catch (e) {
            await this.pool.query('ROLLBACK');
            throw e;
        }
    }

    /*
     * Update the given image in the database
     * @param image the image to update
     */
    async updateImageInfo(image) {
        assert(image instanceof Image, "Invalid parameter, not an image!");
        assert(image.id != null, "Invalid parameter, not a persistent data!");
        try {
            if (Array.isArray(image.tags)) { // remove duplicated tags
                image.tags = image.tags.filter((x, pos)=>image.tags.indexOf(x) == pos);
                image.tags = image.tags.map(x=>x.toLowerCase());
            }
            else {
                image.tags = image.tags.toLowerCase();
            } 
            
            // We will perform the following operation in a transaction: 
            //     1. get the revision number for optimistic concurrency control
            //     2. update the record
            await this.pool.query('BEGIN')
            const queryVersion = 'SELECT revision FROM images WHERE id=$1 AND revision=$2 FOR UPDATE';
            const ver = await this.pool.query(queryVersion, [image.id, image.revision]);
            if (ver.rowCount > 0 && ver.rows[0].revision == image.revision) {
                image.revision += 1;
                const update = 'UPDATE images SET revision=$1,name=$2,tags=$3,time_taken=$4,loc=$5,info=$6,modified_on=$7 WHERE id=$8';
                const result = await this.pool.query(update,
                                                [image.revision, image.name, image.tags, image.time, image.location, image.info, new Date(), image.id]);
                await this.pool.query('COMMIT');
                return image;
            }
            else {
                throw new Error("ConcurrentUpdateError!")
            }
        }
        catch (e) {
            await this.pool.query('ROLLBACK');
            throw e;
        }
    }

    /*
     * Delete the given image from the database
     * @param id the id of the image
     */
    async deleteImage(id) {
        id = this.checkInteger(id);
        try {
            await this.pool.query('DELETE FROM images WHERE id=$1',[id]);
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Retrieve the given image from the database
     * @param id the id of the image
     * @param userId the current user ID
     * @param full true to include the full image, false to include only the thumbnail
     */
    async getImage(id, userId, full=false) {
        console.log("id : " + id + ", uid: " + userId);
        id = this.checkInteger(id);
        userId = this.checkInteger(userId);
        try {
            let query;
            if (full) {
                query = 'SELECT img.id,img.revision,img.name,img.tags,img.time_taken,img.loc,img.info, ' +
                           'img.owner_id, img.raw_id, raw.imgtype, raw.rawdata, usr.displayName ' +
                           'from images img inner join raw_images raw on img.raw_id=raw.id ' +
                           'inner join users usr on usr.id = img.owner_id ' +
                           'where img.id=$1 AND (img.owner_id=$2 OR img.id in (SELECT image_id FROM image_share WHERE user_id=$2))'
             }
             else {
                 query = 'SELECT img.id,img.revision,img.name,img.tags,img.time_taken,img.loc,img.info, ' +
                            'img.owner_id, img.raw_id, raw.imgtype, raw.thumbnail, usr.displayName ' +
                            'from images img inner join raw_images raw on img.raw_id=raw.id ' +
                            'inner join users usr on usr.id = img.owner_id ' +
                            'where img.id=$1 AND (img.owner_id=$2 OR img.id in (SELECT image_id FROM image_share WHERE user_id=$2))'
             }
            const result = await this.pool.query(query, [id, userId]);
            if (result.rowCount > 0) {
                return this.imageFromResult(result.rows[0]);
            }
            return null;
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Retrieve the owner ID of given image from the database
     * @param id the id of the image
     */
    async getImageOwner(id) {
        console.log("Retrieve Image owner");
        id = this.checkInteger(id);
        try {
            const query = 'SELECT owner_id from images where id=$1'
            const result = await this.pool.query(query, [id]);
            if (result.rowCount > 0) {
                return result.rows[0].owner_id;
            }
            return null;
        }
        catch (e) {
            throw e;
        }
    }

    /* 
     * Share the given image with the given user
     * @param imageId the id of the image
     * @param userId the user ID to share
     */
    async shareImage(imageId, userId) {
        userId = this.checkInteger(userId);
        try {
            const create = 'INSERT INTO image_share(image_id, user_id) VALUES($1,$2)'
            await this.pool.query(create, [imageId, userId]);
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Remove image share with the given user
     * @param imageId the id of the image
     * @param userId the user ID to remove
     */
    async unshareImage(imageId, userId) {
        imageId = this.checkInteger(imageId);
        userId = this.checkInteger(userId);
        try {
            const create = 'DELETE FROM image_share WHERE image_id=$1 AND user_id=$2'
            await this.pool.query(create, [imageId, userId]);
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Search all images matching the given tags
     * @param tags the tags to search
     * @param userId the current user ID
     */ 
    async searchImageByTag(tags, userId) {
        try {
            let params;
            let cond;
            if (Array.isArray(tags)) {
                tags = tags.filter((x, pos) => tags.indexOf(x) == pos);
                tags = tags.map(x => x.toLowerCase());

                cond = " (";
                for (let i = 0; i < tags.length; i++) {
                    if (i > 0) {
                        cond += " OR";
                    }
                    cond += " $" + (2+i) + " = ANY (img.tags)";
                }
                cond += ")";
                params = [userId].concat(tags);
            }
            else {
                tags = tags.toLowerCase()
                params = [userId, tags];
                cond = "($2 = ANY (img.tags))"
            }
            
            let query = 'SELECT img.id,img.revision,img.name,img.tags,img.time_taken,img.loc,img.info, ' +
                            'img.owner_id, img.raw_id, raw.imgtype, raw.thumbnail, usr.email, usr.displayName ' +
                            'from images img inner join raw_images raw on img.raw_id=raw.id ' +
                            'inner join users usr on usr.id = img.owner_id ' +
                            'where ' + cond +
                            ' AND (img.owner_id=$1 OR img.id in (SELECT image_id FROM image_share WHERE user_id=$1))';

            const result = await this.pool.query(query, params);
            if (result.rowCount > 0) {
                return result.rows.map(value => this.imageFromResult(value));
            }
            else {
                return null;
            }
        }
        catch (e) {
            throw e;
        }
    }

    /*
     * Resize the given image
     * @param data the raw image data
     * @param size the size of the image to resize to. If both the width and height is smaller than size,
     * the original image is returned. Otherwise, the image is resized proportionally such that the max(width, height) = size
    */
    async resizeImage(data, size) {
        let image = await sharp(data);
        let meta = await image.metadata();
        if (Math.max(meta.width, meta.height) > size) {
            let resize
            if (meta.width >= meta.height) {
                resize = { 'width': size };
            }
            else {
                resize = { 'height': size };
            }
            return await image.resize(size).toBuffer();
        }
        else {
            return data;
        }
    }

    /*
     * Check if the parameter is an integer, throw an assertion error if it is not
     * @param v the parameter
     */
    checkInteger(v) {
        if (v = parseInt(v)) {
            return v;
        }
        assert.fail('Invalid parameter, not an integer');
    }

    /*
     * Create a User instance from the value returned from a search/get user queries
     * @param value the value
     */
    userFromResult(value) {
        let user = new User();
        user.id = value.id;
        user.revision = value.revision;
        user.email = value.email;
        user.displayName = value.displayname;
        user.firstName = value.firstname;
        user.lastName = value.lastname;
        user.gender = value.gender;
        user.dob = value.dob;
        return user;
    }

    /*
     * Create a image instance from the value returned from a search/get image queries
     * @param value the value
     */
    imageFromResult(value) {
        let image = new Image();
        image.id = value.id;
        image.revision = value.revision;
        image.name = value.name;
        image.tags = value.tags;
        image.time = value.time_taken;
        image.location = value.loc;
        image.info = value.info;
        image.ownerId = value.owner_id;
        image.rawId = value.raw_id;
        image.imageType = value.imgtype;
        image.ownerName = value.displayname;
        if (value.hasOwnProperty('thumbnail')) {
            image.thumbnail = value.thumbnail;
        }

        if (value.hasOwnProperty('rawdata')) {
            image.image = value.rawdata;
        }
        return image;
    }

    /**
     * End the service, and close the connection pool
     */ 
    end() {
        if (this.pool) {
            this.pool.end();
            this.pool = null;
        }
    }
}
