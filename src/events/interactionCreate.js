const { EmbedBuilder } = require('discord.js');
const EditSuggestion = require('../class/editSuggestion');
const VoteSuggestion = require('../class/voteSuggestion');

function parseSuggestion(embed) {
    const isNew = embed.title === 'Создание нового опроса';
    if (!isNew) return false;
    const values = embed.description.match(/\*\*Заголовок\*\*: (.*?)\n\*\*Тип\*\*: (.*?) \| (\d+) .+\n\*\*Варианты ответа\*\*:\n([\s\S]*?)\n\*\*Используйте кнопки для редактирования опроса\*\*/);
    const answers = {};
    if (values[4]) {
        const answersText = values[4].trim().split('\n')
            .map((answer) => answer.replace('- ', '').trim());
        for (const answerText of answersText) {
            answers[answerText] = { id: -1 };
        }
    }
    const type = values[2] === 'по голосам';
    let endTime;
    let endVotes;
    type ? endVotes = parseInt(values[3]) : endTime = parseInt(values[3]);
    return new EditSuggestion(values[1], isNew, type, answers, endTime, endVotes);
}

async function ifESInteraction(client, interaction) {
    if (!interaction.customId.includes('ES')) return false;
    let editSuggestionClass = client.editSuggestion.get(interaction.message.id);
    if (!editSuggestionClass) {
        editSuggestionClass = parseSuggestion(interaction.message.embeds[0]);
        if (!editSuggestionClass) {
            const embed = new EmbedBuilder()
                .setTitle('Редактирование опроса')
                .setDescription('**Произошла ошибка, попробуйте снова**')
                .setColor(8847452);
            await interaction.message.edit({ embeds: [embed], components: [] });
            return true;
        }
        client.editSuggestion.set(interaction.message.id, editSuggestionClass);
    }
    if (interaction.isButton()) await editSuggestionClass.buttons[interaction.customId](client, interaction);
    else if (interaction.isModalSubmit()) await editSuggestionClass.modals[interaction.customId](client, interaction);
    else if (interaction.isStringSelectMenu()) await editSuggestionClass.selects[interaction.customId](client, interaction);
    return true;
}

async function ifVSInteraction(client, interaction) {
    if (!interaction.customId.includes('VS')) return false;
    if (interaction.isButton()) {
        const idMatch = interaction.customId.match(/VS_(\d+)/);
        if (idMatch) await VoteSuggestion.saveVote(client, interaction, parseInt(idMatch[1]));
        else await VoteSuggestion.buttons[interaction.customId](client, interaction);
    } else if (interaction.isStringSelectMenu()) await VoteSuggestion.selects[interaction.customId](client, interaction);
    return true;
}

async function interactionCreate(client, interaction) {
    const payload = { content: 'Произошла ошибка во время выполнения!', ephemeral: true };
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            return console.log(`Команда "${interaction.commandName} не имеет callback!`);
        }
        try {
            return await command.execute(client, interaction);
        } catch (error) {
            console.log(error);
            if (interaction.replied || interaction.deferred) {
                return await interaction.followUp(payload);
            } else {
                return await interaction.reply(payload);
            }
        }
    } else if (interaction.isModalSubmit()) {
        try {
            if (await ifESInteraction(client, interaction)) return;
            const modal = client.modals.get(interaction.customId);
            if (!modal) {
                return console.log(`Вызываемое окно "${interaction.customId}" не имеет callback!`);
            }
            return await modal(client, interaction);
        } catch (error) {
            console.log(error);
            return await interaction.reply(payload);
        }
    }
    if (interaction.user.id !== interaction.message.interaction.user.id) {
        return await interaction.reply({ content: 'Использовать может только первоначальный отправитель!', ephemeral: true });
    }
    if (interaction.isButton()) {
        try {
            if (await ifESInteraction(client, interaction)) return;
            if (await ifVSInteraction(client, interaction)) return;
            const button = client.buttons.get(interaction.customId);
            if (!button) {
                await interaction.reply(payload);
                return console.log(`Кнопка ${interaction.customId} не имеет callback!`);
            }
            return await button(client, interaction);
        } catch (error) {
            console.log(error);
            return await interaction.reply(payload);
        }
    } else if (interaction.isStringSelectMenu()) {
        try {
            if (await ifESInteraction(client, interaction)) return;
            if (await ifVSInteraction(client, interaction)) return;
            const select = client.selects.get(interaction.customId);
            if (!select) {
                return console.log(`Выпадающее меню "${interaction.customId}" не имеет callback!`);
            }
            return await select(client, interaction);
        } catch (error) {
            console.log(error);
            return await interaction.reply(payload);
        }
    }
}

module.exports = interactionCreate;