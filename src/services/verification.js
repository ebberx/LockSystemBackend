const { execSync } = require("child_process");

const scriptsPath = "python3 ~/FaceVerificationFaceNet/ProjectScripts/";
const getEncodingScript = "GetEncodingFromImage.py";
const getSimilarityScript = "GetSimilarityScoreFromEncodings.py";

module.exports = {
    GenerateEncoding: function(imageFilePath, encodingFilePath) {
        try {
            const command = scriptsPath + getEncodingScript + " " + imageFilePath + " " + encodingFilePath;
            const output = execSync(command);
    
            // Debug
            console.log("Generated encoding with command: ");
            console.log("\"" + command + "\"")
            console.log("Output:\n" + output)
            return true;
        }
        catch (err) {
            console.log("Error: " + err)
            return false;
        }
    },
    CompareEncodings: function(baseEncoding, subjectEncoding) {
        try {
            const command = scriptsPath + getSimilarityScript + " " + baseEncoding + " " + subjectEncoding;
            const output = execSync(command);
    
            // Debug
            console.log("Compared encodings with command: ");
            console.log("\"" + command + "\"")
            console.log("Output:\n" + output)

            // Make sure the output is a number
            if(!Number.isNaN(Number(output))) {
                return output;    
            }
            return false;
        }
        catch (err) {
            console.log("Error: " + err)
            return false;
        }
    },

}
