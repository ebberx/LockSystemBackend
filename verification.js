const { exec } = require("child_process");

const scriptsPath = "python3 ~/FaceVerificationFaceNet/ProjectScripts/";
const getEncodingScript = "GetEncodingFromImage.py";
const getSimilarityScript = "GetSimilarityScoreFromEncodings.py";

module.exports = {
    GenerateEncoding: async function(imageFilePath, encodingFilePath) {
        try {
            const command = scriptsPath + getEncodingScript + " " + imageFilePath + " " + encodingFilePath;
            await exec(command, (err, stdout, stderr) => {
                if(err !== null) {
                    console.log("Error: " + err)        
                }
                // Debug
                console.log("Generated encoding with command: ");
                console.log("\"" + command + "\"")
                return true;
            });
        }
        catch (err) {
            console.log("Error: " + err)
            return false;
        }
    },
    CompareEncodings: async function(baseEncoding, subjectEncoding) {
        try {
            const command = scriptsPath + getSimilarityScript + " " + baseEncoding + " " + subjectEncoding;
            await exec(command, (err, stdout, stderr) => {
                if(err !== null) {
                    console.log("Error: " + err)        
                }
                // Debug
                console.log("Compared encodings with command: ");
                console.log("\"" + command + "\"")
                console.log("Output:\n" + stdout)

                // Make sure the output is a number
                if(!Number.isNaN(Number(stdout))) {
                    return output;    
                }
                return false;
            });    
        }
        catch (err) {
            console.log("Error: " + err)
            return false;
        }
    },

}