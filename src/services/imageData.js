const { execSync } = require('child_process');
const Verify = require('../services/verification');
const fs = require('fs');
const fsp = fs.promises;

function getData(res, imageData) {
    var data = (imageData + "").includes('data:image') ? imageData : null;
    if (data === null) {
        console.log("Failed to validate image data.");
        res.status(400).json("Failed to validate image data.");
        return undefined;
    }
    return data;
}

function getFileExtension(res, data) {
    var fileType = data.includes("image/png") ? ".png" : data.includes("image/jpeg") ? ".jpeg" : null;
    if (fileType === null) {
        console.log("Failed to get image file type.");
        res.status(400).json("Failed to get image file type.");
        return undefined;
    }
    return fileType;
}

module.exports = {
    // Returns path object if successful
    // Returns undefined if failure
    // id is used for image name, for verification later
    Update: async function(req, res, id) {
        var output = {};

        // Check if data has header
        var data = getData(res, req.body.image_data);
        if (data === undefined) return;

        // Get the file extension
        var fileType = getFileExtension(res, data);
        if (fileType === undefined) return;

        // Remove header from data
        data = data.replace(/^data:image\/\w+;base64,/, "");

        // photo_path = Were the image shoud be saved
        var photo_path = "images/" + id + fileType;

        // Write file
        var buf = Buffer.from(data, 'base64');
        await fsp.writeFile(photo_path, buf).then(() => {
            console.log(photo_path + " saved to file!");
            output.photo_path = photo_path;

            // encoding_path: Where the python script should save the encoding
            var encoding_path = "encodings/" + id + ".enc";

            const success = Verify.GenerateEncoding(photo_path, encoding_path);
            if (success === false) {
                res.status(400).json("Error generating encoding for supplied image.");
                return undefined;
            }
            output.encoding_path = encoding_path;
        })

        return output;
    },

    // Returns similarity score, undefined if failure
    Verify: async function(req, res, user) {
        // Check if data has header
        var data = getData(res, req.body.image_data);
        if (data === undefined) return;

        // Get the file extension
        var fileType = getFileExtension(res, data);
        if (fileType === undefined) return;

        // Remove header from data
        data = data.replace(/^data:image\/\w+;base64,/, "");

        // Make temp directory for image and encoding
        if (fs.existsSync(user._id.toString()) === false) {
            execSync("mkdir " + user._id);
            console.log("Created directory: \"" + user._id + "\"");
        } else {
            console.log("Directory: \"" + user._id + "\" already exists.");
        }

        var buf = Buffer.from(data, 'base64');

        // Image file path: where the image should be saved
        var imageFilePath = user._id + "/image" + fileType;
        var similarity;
        await fsp.writeFile(imageFilePath, buf).then(() => {
            console.log(imageFilePath + " saved to file!");

            // Encoding file path: Where the python script should save the encoding
            const tempEncodingPath = user._id + "/encoding" + ".enc";

            // Generate encodings and compare
            Verify.GenerateEncoding(imageFilePath, tempEncodingPath);
            const output = Verify.CompareEncodings(user.encoding_path, tempEncodingPath);

            if (output !== false) {
                // Delete temp folder after operation
                execSync("rm -rf " + user._id);
                similarity = Number(output.toString());
            }
        });

        if (fs.existsSync(user._id.toString()) === true) {
            console.log("Cleaning up temp folder: " + user._id);
            execSync("rm -rf " + user._id);
        }

        if (!similarity) {
            res.status(400).json("Failed to get similarity score.");
            return;
        }

        return similarity;
    }
}
