const uuidv4 = require('uuid/v4');

module.exports = class AuthenticationService {
	/*
     * Authenticate the login email with the given password
     * @param {DataService} ds the data service to use
	 * @param {string} email the email
	 * @param {string} password the password
	*/
	static async login(ds, email, password) {
		let userId = await ds.validatePassword(email, password);
		if (userId) {
			let token = uuidv4();
			await ds.createLogin(
						token,
						new Date(new Date().getTime() + global.appConfig.authTokenValidity * 60 * 1000),
						userId);
			return token;
		}
		else {
			throw new Error("LoginFailed");
		}
	}

	/*
	 * Log the token out
     * @param {DataService} ds the data service to use
	 * @param token, token the token
	 */ 
	static async logout(ds, token) {
		await ds.deleteLogin(token);
    }
    
    /*
     * Get the ID of the user associated with the token if the token is still valid
     * @param {DataService} ds the data service to use
     * @param {string} token the token
    */ 
    static async checkAuthentication(ds, req) {
        let authToken = req.params.authToken || req.body.authToken

        if (authToken) {
            let user = await ds.getLoginUserId(authToken);
            if (user) {
                req.body.loginUserId = user;
                return user;
            }
            else {
                throw new Error('Unauthorized')
            }
        }
        else {
            throw new Error('Unauthorized')
        }
    }
}