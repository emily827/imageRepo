module.exports = class User {
    id = 0;
    revision = 0;
    email = null;
    displayName = null;
    firstName = null;
    lastName = null;
    gender = null;
    password = null;
    dob = null;

    static fromJson(json) {
        let user = new User();
        for (var prop in json) {
            if (user.hasOwnProperty(prop)) {
                user[prop] = json[prop];
            }
        }
        return user;
    }

    toJson() {
        return JSON.stringify(this);
    }
}