const fs = require('fs');
const path = require('path');

function getAllFiles(directory) {
    const result = [];
    for (const file of fs.readdirSync(directory, { withFileTypes: true })) {
        if (file.isFile()) {
            result.push(path.join(directory, file.name));
        }
    }
    return result;
}

module.exports = getAllFiles;