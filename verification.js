const { execSync } = require("child_process");

const scriptsPath = "../../FaceVerificationFaceNet/ProjectScripts/";
const getEncodingScript = "GetEncodingFromImage.py";
const getSimilarityScript = "GetSimilarityScoreFromEncodings.py";

module.exports = {
    GenerateEncoding: function(imageFilePath, encodingFilePath) {
        try {
            const command = scriptsPath + getEncodingScript + " " + imageFilePath + " " + encodingFilePath;
            execSync(command);
    
            // Debug
            console.log("Generated encoding with command: ");
            console.log("\"" + command + "\"")
            return true;
        }
        catch (err) {
            console.log("Error: " + err)
            return false;
        }   
    }
}