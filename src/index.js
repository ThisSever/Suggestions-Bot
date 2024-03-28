require('dotenv').config();
const { Client, Collection, IntentsBitField } = require('discord.js');
const eventsHandler = require('./handlers/events');
const commandsHandler = require('./handlers/commands');
const databaseHandler = require('./handlers/database');
const checkEndTime = require('./handlers/checkEndTime');

const requiredEnvs = [
    'TOKEN', 'clientId', 'mainChannel',
    'dbAddress', 'dbPort', 'dbUser',
    'dbPassword', 'dbName',
];
for (const envName of requiredEnvs) {
    if (!process.env[envName]) {
        console.log(`Отсутствует переменная "${envName}" в файле ".env"!`);
        process.exit(1);
    }
}

const client = new Client({
    intents: [IntentsBitField.Flags.Guilds],
});

(async () => {
    eventsHandler(client);
    commandsHandler(client, process.env.TOKEN, process.env.clientId);
    client.editSuggestion = new Collection();
    client.mysql = await databaseHandler();
    await client.login(process.env.TOKEN);
    checkEndTime(client);
})();