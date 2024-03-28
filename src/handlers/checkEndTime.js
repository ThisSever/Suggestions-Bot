const VoteSuggestion = require('../class/voteSuggestion');

function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function checkEndTime(client) {
    while (true) {
        const timestamp = Math.floor(new Date().getTime() / 1000);
        const [suggestions] = await client.mysql.query(
            `SELECT * FROM suggestions WHERE endTime <= ${timestamp} AND ended = 0`,
        );
        for (const suggestion of suggestions) VoteSuggestion.voteEnd(client, suggestion);
        await sleep(60);
    }
}

module.exports = checkEndTime;