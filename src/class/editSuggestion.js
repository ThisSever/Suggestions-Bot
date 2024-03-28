const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

const endType = {
    TIME: 0,
    VOTES: 1,
};

class EditSuggestion {
    constructor(
        title = 'Безымянный опрос', isNew = false,
        type = endType.TIME, answers = {},
        endTime = 60, endVotes = 10, id = -1,
    ) {
        this.id = id;
        this.title = title;
        this.type = type;
        this.answers = answers;
        this.isNew = isNew;
        this.endTime = endTime;
        this.endVotes = endVotes;
        this.toDelete = [];
    }

    showInfo = async (client, interaction) => {
        let textAnswers = '';
        for (const answer in this.answers) textAnswers += `- ${answer}\n`;
        const embedDescription = `**Заголовок**: ${this.title}\n` +
            `**Тип**: ${this.type ? 'по голосам' : 'по времени'} | ${this.type ? this.endVotes + ' голосов' : this.isNew ? this.endTime + ' минут' : `<t:${this.endTime}:f>`}\n` +
            `**Варианты ответа**:\n${textAnswers}` +
            '\n**Используйте кнопки для редактирования опроса**';
        const embed = new EmbedBuilder()
            .setTitle(this.isNew ? 'Создание нового опроса' : 'Редактирование опроса')
            .setDescription(embedDescription)
            .setColor(8847452);
        const firstRow = new ActionRowBuilder();
        firstRow.addComponents(
            new ButtonBuilder()
                .setCustomId('ESaddAnswer')
                .setLabel('Ответ')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('➕'),
        );
        firstRow.addComponents(
            new ButtonBuilder()
                .setCustomId('ESdeleteAnswer')
                .setLabel('Ответ')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('➖'),
        );
        if (this.isNew) {
            firstRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('ESchangeType')
                    .setLabel('Изменить тип')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
            );
            firstRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('ESchangeTypeValue')
                    .setLabel('Изменить условие')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
            );
        }
        const secondRow = new ActionRowBuilder();
        secondRow.addComponents(
            new ButtonBuilder()
                .setCustomId('ESsaveSuggestion')
                .setLabel('Сохранить')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
        );
        secondRow.addComponents(
            new ButtonBuilder()
                .setCustomId('EScancelSuggestion')
                .setLabel('Отменить изменения')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌'),
        );
        await interaction.message.edit({ embeds: [embed], components: [firstRow, secondRow] });
        await interaction.reply({ content: 'Готово!', ephemeral: true });
    };

    addAnswerButton = async (client, interaction) => {
        if (Object.keys(this.answers).length === 5) {
            return await interaction.reply(
                { content: 'В опросе может быть максимум 5 ответов', ephemeral: true },
            );
        }
        const modal = new ModalBuilder()
            .setCustomId('ESaddAnswer')
            .setTitle('Добавление ответа в опрос');
        const row = new ActionRowBuilder()
            .addComponents(
                new TextInputBuilder()
                    .setCustomId('answer')
                    .setLabel('Текст ответа')
                    .setMaxLength(64)
                    .setPlaceholder('Пример: Да, буду')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short),
            );
        modal.addComponents(row);
        await interaction.showModal(modal);
    };

    addAnswerModal = async (client, interaction) => {
        this.answers[interaction.fields.getTextInputValue('answer')] = { id: -1 };
        // this.answers.push(interaction.fields.getTextInputValue('answer'));
        await this.showInfo(client, interaction);
    };

    deleteAnswer = async (client, interaction) => {
        if (Object.keys(this.answers).length === 0) {
            return await interaction.reply({ content: 'В опросе отсутствуют ответы!', ephemeral: true });
        }
        const select = new StringSelectMenuBuilder()
            .setCustomId('ESdeleteAnswer')
            .setPlaceholder('Ответ')
            .setMinValues(1);
        for (const answer in this.answers) {
            select.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(answer)
                    .setValue(answer),
            );
        }
        const row = new ActionRowBuilder().addComponents(select);
        await interaction.message.edit({ embeds: interaction.message.embeds, components: [row] });
        await interaction.reply({ content: 'Выберите ответ для удаления', ephemeral: true });
    };

    deleteAnswerSelect = async (client, interaction) => {
        for (const value of interaction.values) {
            if (!this.isNew) this.toDelete.push(this.answers[value].id);
            delete this.answers[value];
        }
        await this.showInfo(client, interaction);
    };

    changeType = async (client, interaction) => {
        this.type = !this.type;
        await this.showInfo(client, interaction);
    };

    changeTypeValue = async (client, interaction) => {
        const modal = new ModalBuilder()
            .setCustomId('ESchangeTypeValue')
            .setTitle('Изменение условия');
        const valueInput = new TextInputBuilder()
            .setCustomId('value')
            .setLabel('Введите значение (цифрой)')
            .setPlaceholder('Пример: 3600')
            .setRequired(true)
            .setStyle(TextInputStyle.Short);
        const row = new ActionRowBuilder().addComponents(valueInput);
        modal.addComponents(row);
        await interaction.showModal(modal);
    };

    changeTypeValueModal = async (client, interaction) => {
        const newValue = parseInt(interaction.fields.getTextInputValue('value'));
        if (!newValue) {
            return await interaction.reply({ content: 'Указано неверное значение!', ephemeral: true });
        }
        this.type ? this.endVotes = newValue : this.endTime = newValue;
        await this.showInfo(client, interaction);
    };

    saveSuggestion = async (client, interaction) => {
        if (Object.keys(this.answers).length <= 1) {
            return await interaction.reply({ content: 'В опросе должно находиться минимум 2 ответа', ephemeral: true });
        }
        const answersIds = [];
        for (const answer in this.answers) {
            if (this.answers[answer].id === -1) {
                const [pushAnswer] = await client.mysql.query(
                    `INSERT INTO answers (text) VALUES ("${answer}")`,
                );
                answersIds.push(pushAnswer.insertId);
            } else answersIds.push(this.answers[answer].id);
        }
        if (this.isNew) {
            this.endTime = Math.floor(new Date().getTime() / 1000 + this.endTime * 60);
            await client.mysql.query(
                `INSERT INTO suggestions (title, owner, endTime, endVotes, answersList, type) VALUES ("${this.title}", "${interaction.user.id}", ${this.endTime}, ${this.endVotes}, "${answersIds.toString()}", ${this.type})`,
            );
        } else {
            await client.mysql.query(
                `UPDATE suggestions SET answersList = "${answersIds.toString()}" WHERE id = ${this.id}`,
            );
        }
        const embed = new EmbedBuilder()
            .setTitle('Сохранение опроса')
            .setDescription('**Опрос успешно сохранен**')
            .setColor(8847452);
        await interaction.message.edit({ embeds: [embed], components: [] });
        client.editSuggestion.delete(interaction.message.id);
        for (const answerId of this.toDelete) {
            await client.mysql.query(
                `DELETE FROM answers WHERE id = ${answerId}`,
            );
        }
    };

    cancelSuggestion = async (client, interaction) => {
        client.editSuggestion.delete(interaction.message.id);
        await interaction.message.delete();
    };

    buttons = {
        ESaddAnswer: this.addAnswerButton,
        ESdeleteAnswer: this.deleteAnswer,
        ESchangeType: this.changeType,
        ESchangeTypeValue: this.changeTypeValue,
        ESsaveSuggestion: this.saveSuggestion,
        EScancelSuggestion: this.cancelSuggestion,
    };
    modals = {
        ESaddAnswer: this.addAnswerModal,
        ESchangeTypeValue: this.changeTypeValueModal,
    };
    selects = {
        ESdeleteAnswer: this.deleteAnswerSelect,
    };
}

module.exports = EditSuggestion;