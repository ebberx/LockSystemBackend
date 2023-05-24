
module.exports = {
    /* Application variables */
    tokens: [],
    tokenSize: 0,
    
    /*  Generates a token for access. */
    GenerateAccessToken: function (email, password) { 
        const token = Buffer.from(email + password).toString('base64')
        
        // Check if it exits already to avoid making duplicates.
        if(this.CheckTokenExists(token))
            return token;
        
        // Add the new token if it does exist.
        this.tokens[this.tokenSize++] = token;
        return token;
    },

    /*  Deletes a token so it cannot be used for access. 
        Returns true if a token was revoked, false otherwise. */
    RevokeAccessToken: function (token) {
        for (let i = 0; i < this.tokens.length; i++) {
            if(token === this.tokens[i]) {
                // Found token, now delete
                this.tokens[i] = null;

                // Debug
                console.log("revoked access for token: ")
                console.log(token);

                return true
            }
        }
        return false
    },

    /*  Returns true if the token has access, false if not */
    CheckTokenExists: function (token) {
        if(this.tokens == null)
            return false
        for (let i = 0; i < this.tokens.length; i++) {
            if(token === this.tokens[i]) {
                // Debug
                console.log("Token already exists: ")
                console.log(token);

                return true
            }
        }
        return false
    }
}
