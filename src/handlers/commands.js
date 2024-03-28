const path = require('path');
const { Collection, REST, Routes } = require('discord.js');
const getAllFiles = require('../utils/getAllFiles');

async function commandsHandler(client, token, clientId) {
    client.commands = new Collection();
    client.buttons = new Collection();
    client.modals = new Collection();
    client.selects = new Collection();
    const commands = [];
    const commandsFiles = getAllFiles(path.join(__dirname, '..', 'commands'));
    for (const file of commandsFiles) {
        const command = require(file);
        if (command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
        for (const buttonId in command.buttons) {
            client.buttons.set(buttonId, command.buttons[buttonId]);
        }
        for (const modalId in command.modals) {
            client.modals.set(modalId, command.modals[modalId]);
        }
        for (const selectId in command.selects) {
            client.selects.set(selectId, command.selects[selectId]);
        }
    }
    const rest = new REST().setToken(token);
    (async () => {
        try {
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );
        } catch (error) {
            console.log(error);
        }
    })();
}

module.exports = commandsHandler;