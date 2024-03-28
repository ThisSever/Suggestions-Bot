const { SlashCommandBuilder, ButtonBuilder, EmbedBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChatInputCommandInteraction } = require('discord.js');
const EditSuggestion = require('../class/editSuggestion');
const VoteSuggestion = require('../class/voteSuggestion');

async function addButtonCallback(client, interaction) {
    const modal = new ModalBuilder()
        .setCustomId('createSuggestion')
        .setTitle('Создание опроса');
    const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Заголовок опроса')
        .setMaxLength(128)
        .setPlaceholder('Пример: Буду ли я в команде Gerstlix?')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);
    const row = new ActionRowBuilder().addComponents(titleInput);
    modal.addComponents(row);
    await interaction.showModal(modal);
}

async function sendSelectSuggestionCallback(client, interaction) {
    const [usersSuggestions] = await client.mysql.query(
        `SELECT id, title FROM suggestions WHERE owner = "${interaction.user.id}" AND ended = 0`,
    );
    if (usersSuggestions.length === 0) {
        return interaction.reply({ content: 'У вас отсутствуют активные опросы', ephemeral: true });
    }
    const select = new StringSelectMenuBuilder()
        .setCustomId(interaction.component.customId + 'Select')
        .setPlaceholder('Опрос')
        .setMinValues(1)
        .setMaxValues(1);
    for (const suggestion of usersSuggestions) {
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(suggestion.title)
                .setValue(`${suggestion.id}`),
        );
    }
    const row = new ActionRowBuilder().addComponents(select);
    await interaction.message.edit({ components: [row] });
    await interaction.reply({ content: 'Выберите интересующий Вас опрос', ephemeral: true });
}

async function editButtonSelectCallback(client, interaction) {
    const [suggestion] = await client.mysql.query(
        `SELECT title, endTime, endVotes, answersList, type FROM suggestions WHERE id = ${interaction.values[0]}`,
    );
    const answersIds = suggestion[0].answersList.split(',').map(Number);
    const answers = {};
    for (const answerId of answersIds) {
        const [answerInfo] = await client.mysql.query(
            `SELECT text FROM answers WHERE id = ${answerId}`,
        );
        answers[answerInfo[0].text] = { id: answerId };
    }
    const suggestionClass = new EditSuggestion(
        suggestion[0].title, false,
        suggestion[0].type, answers,
        suggestion[0].endTime, suggestion[0].endVotes, interaction.values[0],
    );
    client.editSuggestion.set(interaction.message.id, suggestionClass);
    await suggestionClass.showInfo(client, interaction);
}

async function deleteButtonSelectCallback(client, interaction) {
    const [suggestion] = await client.mysql.query(
        `SELECT answersList FROM suggestions WHERE id = ${interaction.values[0]} AND ended = 0`,
    );
    await client.mysql.query(
        `DELETE FROM suggestions WHERE id = ${interaction.values[0]}`,
    );
    await command.execute(client, interaction);
    await interaction.reply({ content: 'Опрос удален!', ephemeral: true });
    const answersIds = suggestion[0].answersList.split(',').map(Number);
    for (const answerId of answersIds) {
        await client.mysql.query(
            `DELETE FROM answers WHERE id = ${answerId}`,
        );
    }
}

async function createSuggestionCallback(client, interaction) {
    const newSuggestion = new EditSuggestion(interaction.fields.getTextInputValue('title'), true);
    client.editSuggestion.set(interaction.message.id, newSuggestion);
    await newSuggestion.showInfo(client, interaction);
}

async function chooseSuggestionCallback(client, interaction) {
    const select = new StringSelectMenuBuilder()
        .setCustomId('VSchooseSuggestion')
        .setPlaceholder('Опрос')
        .setMinValues(1)
        .setMaxValues(1);
    const selectOptions = await VoteSuggestion.buildSelectOptions(client, interaction, 0);
    select.addOptions(selectOptions);
    const row = new ActionRowBuilder().addComponents(select);
    await interaction.message.edit({ components: [row] });
    await interaction.reply({ content: 'Выберите интересующий Вас опрос', ephemeral: true });
}

const command = {
    data: new SlashCommandBuilder()
        .setName('опросы')
        .setDescription('Открыть меню опросов'),
    async execute(client, interaction) {
        if (interaction instanceof ChatInputCommandInteraction) await interaction.deferReply();
        const [allSuggestionesCount] = await client.mysql.query(
            'SELECT COUNT(*) AS count FROM suggestions',
        );
        const [activeSuggestionesCount] = await client.mysql.query(
            'SELECT COUNT(*) AS count FROM suggestions WHERE ended = 0',
        );
        let embedDescription = 'Вы попали в меню опросов. ' +
            'Здесь Вы можете получить нужную Вам информацию об опросах, ' +
            'добавить, изменить или удалить свой опрос. Так же не ' +
            'забывайте участвовать в чужих опросах.\n';
        const [lastSuggestion] = await client.mysql.query(
            'SELECT title FROM suggestions WHERE id = (SELECT MAX(id) FROM suggestions)',
        );
        if (lastSuggestion.length !== 0) {
            embedDescription += `**Последний созданный опрос**:\n- ${lastSuggestion[0].title}`;
        }
        const embed = new EmbedBuilder()
            .setTitle('Меню опросов')
            .setDescription(embedDescription)
            .setColor(8847452)
            .addFields(
                { name: 'Всего созданных опросов', value: `${allSuggestionesCount[0].count} опросов`, inline: true },
                { name: 'Активных опросов', value: `${activeSuggestionesCount[0].count} опросов`, inline: true },
            );
        const addButton = new ButtonBuilder()
            .setCustomId('addButton')
            .setLabel('Добавить опрос')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕');
        const editButton = new ButtonBuilder()
            .setCustomId('editButton')
            .setLabel('Изменить опрос')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄');
        const deleteButton = new ButtonBuilder()
            .setCustomId('deleteButton')
            .setLabel('Удалить опрос')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('➖');
        const firstRow = new ActionRowBuilder().addComponents(addButton, editButton, deleteButton);
        const chooseSuggestion = new ButtonBuilder()
            .setCustomId('chooseSuggestion')
            .setLabel('Выбрать активный опрос')
            .setStyle(ButtonStyle.Secondary);
        const secondRow = new ActionRowBuilder().addComponents(chooseSuggestion);
        if (interaction instanceof ChatInputCommandInteraction) {
            await interaction.followUp({ embeds: [embed], components: [firstRow, secondRow] });
        } else {
            await interaction.message.edit({ embeds: [embed], components: [firstRow, secondRow] });
        }
    },
    buttons: {
        addButton: addButtonCallback,
        editButton: sendSelectSuggestionCallback,
        deleteButton: sendSelectSuggestionCallback,
        chooseSuggestion: chooseSuggestionCallback,
    },
    modals: {
        createSuggestion: createSuggestionCallback,
    },
    selects: {
        editButtonSelect: editButtonSelectCallback,
        deleteButtonSelect: deleteButtonSelectCallback,
    },
};

module.exports = command;