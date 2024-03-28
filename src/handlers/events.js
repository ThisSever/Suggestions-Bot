const path = require('path');
const getAllFiles = require('../utils/getAllFiles');

function eventsHandler(client) {
    const eventFiles = getAllFiles(path.join(__dirname, '..', 'events'));
    for (const file of eventFiles) {
        const eventFunction = require(file);
        const eventName = path.basename(file, path.extname(file));
        client.on(eventName, async (args) => await eventFunction(client, args));
    }
}

module.exports = eventsHandler;