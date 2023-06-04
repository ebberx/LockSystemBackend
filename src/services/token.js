const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
dotenv.config({'path': 'config/settings.env'});

module.exports = {
    // Map that holds key: [Token] and value: [User._id]
    tokenUserMap: new Map(),

    // Verifies Tokens, returns decoded token on success or undefined on failure
    VerifyToken: function (req, res) {
        const token = req.headers.token;
        console.log(token);

        if (!token) {
            console.log("No token provided.");
            res.status(403).send("User does not have access.");
            return undefined;
        }

        try {
            const decoded = jwt.verify(token, process.env.TOKEN_KEY);
            return decoded;
        } catch (err) {
            console.log("Invalid token used.");
            res.status(401).json("Invalid token.");
            return undefined;
        }
    },

    /*  Generates a token for access. */
    GenerateAccessToken: function (userID, email, is_admin) { 
        const token = jwt.sign(
            {
                _id: userID,
                email,
                is_admin,
            },
            process.env.TOKEN_KEY,
            { 
                expiresIn: "2h",
            }
        );
        return token;
        // const token = Buffer.from(email + password).toString('base64')
        // 
        // // Check if it exits already to avoid making duplicates.
        // if(this.CheckTokenExists(token))
        //     return token;
        // 
        // 
        // // Add the new token if it does exist.
        // this.tokenUserMap.set(token, userID);
        // console.log("Generated token: \n" + token)
        // return token;
    },

    /*  Deletes a token so it cannot be used for access. 
        Returns true if a token was revoked, false otherwise. */
    RevokeAccessToken: function (token) {
        if(this.tokenUserMap.delete(token)) {
            console.log("Revoked access for token: \n" + token)
            return true
        }
        console.log("Tried to revoke access for token, but failed: \n" + token)
        return false
    },

    /*  Returns true if the token has access, false if not */
    CheckTokenExists: function (token) {
        if(this.tokenUserMap.has(token)) {
            console.log("Token already exists: \n" + token)
            return true
        }
        console.log("Token does not exist: \n" + token)
        return false
    },

    /* Returns the UserID for a given token */
    GetUserID: function (token) {
        return this.tokenUserMap.get(token)
    },

    // Returns token on sucess, undefined on failure
    FromHeader: function (res, req) {
        const token = req.headers.token;
        if (token == null) {
            console.log("No token supplied.");
            res.status(400).json("No token supplied.");
            return undefined;
        } 
        return token;
    }
}
