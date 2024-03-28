require('dotenv').config();
const { StringSelectMenuOptionBuilder, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, TextChannel, PermissionFlagsBits } = require('discord.js');

class VoteSuggestion {
    static chooseSuggestionCallback = async (client, interaction) => {
        let firstElement = 0;
        let suggestionId;
        let suggestion;
        if (interaction.values) {
            switch (interaction.values[0]) {
                case 'back':
                    suggestionId = interaction.component.options[1].value;
                    await client.mysql.query('SET @index := 0');
                    [suggestion] = client.mysql.query(`SELECT * FROM (SELECT (@index := @index + 1) AS index, id, title, owner FROM suggestions WHERE ended = 0) WHERE id = ${suggestionId}`);
                    firstElement = Math.floor(suggestion[0].index / 23) * 23;
                    break;
                case 'next':
                    suggestionId = interaction.component.options[1].value;
                    await client.mysql.query('SET @index := 0');
                    [suggestion] = client.mysql.query(`SELECT * FROM (SELECT (@index := @index + 1) AS index, id, title, owner FROM suggestions WHERE ended = 0) WHERE id = ${suggestionId}`);
                    firstElement = Math.ceil(suggestion[0].index / 23) * 23;
                    break;
                default:
                    return await this.showSuggestion(client, interaction, interaction.values[0]);
            }
        }
        const embed = new EmbedBuilder()
            .setTitle('Активные опросы')
            .setDescription('**Выберите интересующий Вас опрос**')
            .setColor(8847452);
        const newSelect = new StringSelectMenuBuilder()
            .setCustomId('VSchooseSuggestion')
            .setPlaceholder('Опрос')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(await this.buildSelectOptions(client, interaction, firstElement));
        const row = new ActionRowBuilder().addComponents(newSelect);
        await interaction.message.edit({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Выберите нужный Вам опрос', ephemeral: true });
    };

    static showSuggestion = async (client, interaction, suggestionId) => {
        const [suggestion] = await client.mysql.query(
            `SELECT * FROM suggestions WHERE id = ${suggestionId}`,
        );
        const answersIds = suggestion[0].answersList.split(',').map(Number);
        const answers = {};
        for (const answerId of answersIds) {
            const [answer] = await client.mysql.query(
                `SELECT text FROM answers WHERE id = ${answerId}`,
            );
            answers[answerId] = answer[0].text;
        }
        let embedDescription = `### ${suggestion[0].title}\n**Варианты ответов**:\n`;
        const answerEmoji = ['5️⃣', '4️⃣', '3️⃣', '2️⃣', '1️⃣'];
        const buttons = [];
        for (const answerId in answers) {
            const emoji = answerEmoji.pop();
            embedDescription += `${emoji} ${answers[answerId]}\n`;
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`VS_${answerId}`)
                    .setEmoji(emoji)
                    .setStyle(ButtonStyle.Primary),
            );
        }
        const embed = new EmbedBuilder()
            .setTitle('Обзор опроса')
            .setDescription(embedDescription)
            .setColor(8847452)
            .setFooter({ text: `Опрос ${suggestionId}` });
        const firstRow = new ActionRowBuilder().addComponents(buttons);
        const backButton = new ButtonBuilder()
            .setCustomId('VSback')
            .setLabel('Вернуться к выбору опроса')
            .setStyle(ButtonStyle.Danger);
        const secondRow = new ActionRowBuilder().addComponents(backButton);
        await interaction.message.edit({ embeds: [embed], components: [firstRow, secondRow] });
        await interaction.reply({ content: 'Используйте кнопки для участия в опросе', ephemeral: true });
    };

    static saveVote = async (client, interaction, answerId) => {
        const suggestionId = interaction.message.embeds[0].footer.text.match(/Опрос (\d+)/)[1];
        const [user] = await client.mysql.query(
            `SELECT * FROM users WHERE id = "${interaction.user.id}"`,
        );
        if (user.length === 1) {
            const answersVoted = user[0].answersVoted.split(',').map(Number);
            if (answersVoted.includes(parseInt(suggestionId))) {
                const embed = new EmbedBuilder()
                    .setTitle('Обзор опроса')
                    .setDescription('**Вы уже участвовали в этом опросе**')
                    .setColor(8847452);
                return await interaction.message.edit({ embeds: [embed], components: [] });
            }
        }
        await client.mysql.query(
            `UPDATE answers SET votes = votes + 1 WHERE id = ${answerId}`,
        );
        await client.mysql.query(
            `UPDATE suggestions SET totalVotes = totalVotes + 1 WHERE id = ${suggestionId}`,
        );
        if (user.length === 1) {
            await client.mysql.query(
                `UPDATE users SET answersVoted = CONCAT(answersVoted, ",${suggestionId}") WHERE id = "${interaction.user.id}"`,
            );
        } else {
            await client.mysql.query(
                `INSERT INTO users (id, answersVoted) VALUES ("${interaction.user.id}", "${suggestionId}")`,
            );
        }
        const embed = new EmbedBuilder()
            .setTitle('Обзор опроса')
            .setDescription('**Ответ успешно засчитан**')
            .setColor(8847452);
        await interaction.message.edit({ embeds: [embed], components: [] });
        const [suggestion] = await client.mysql.query(
            `SELECT * FROM suggestions WHERE id = ${suggestionId}`,
        );
        if (suggestion[0].type && suggestion[0].totalVotes === suggestion[0].endVotes) {
            await this.voteEnd(client, suggestion[0]);
        }
    };

    static voteEnd = async (client, suggestion) => {
        await client.mysql.query(
            `UPDATE suggestions SET ended = 1 WHERE id = ${suggestion.id}`,
        );
        const channel = client.channels.cache.get(process.env.mainChannel);
        if (channel instanceof TextChannel &&
            channel.permissionsFor(channel.guild.members.me).has(
                [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            )
        ) {
            const embedDescription = `### ${suggestion.title}\n` +
                `**Создатель**: <@${suggestion.owner}>\n` +
                '**Результаты опроса**:\n';
            const embed = new EmbedBuilder()
                .setTitle('Результаты опроса')
                .setDescription(embedDescription)
                .setColor(8847452);
            const answersIds = suggestion.answersList.split(',').map(Number);
            for (const answerId of answersIds) {
                const [answer] = await client.mysql.query(
                    `SELECT text, votes FROM answers WHERE id = ${answerId}`,
                );
                embed.addFields(
                    { name: answer[0].text, value: `${answer[0].votes} голосов`, inline: true },
                );
            }
            await channel.send({ embeds: [embed] });
        } else {
            console.log(`Не удалось отправить сообщение об окончании опроса ${suggestion.id}`);
        }
    };

    static buildSelectOptions = async (client, interaction, firstElement) => {
        const options = [];
        const [suggestionsList] = await client.mysql.query(
            `SELECT id, title, owner FROM suggestions WHERE ended = 0 LIMIT ${firstElement}, 23`,
        );
        if (firstElement > 0) {
            options.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Предыдущая страница')
                    .setDescription('Вернуться на предыдущую страницу списка')
                    .setValue('back'),
            );
        }
        for (const suggestion of suggestionsList) {
            const owner = interaction.guild.members.cache.get(interaction.user.id);
            options.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(suggestion.title)
                    .setDescription(`Создатель: ${owner.user.username}`)
                    .setValue(`${suggestion.id}`),
            );
            if (options.length === 23) {
                options.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Следующая страница')
                        .setDescription('Перейти на следующую страницу списка серверов')
                        .setValue('next'),
                );
                break;
            }
        }
        return options;
    };

    static buttons = {
        VSback: this.chooseSuggestionCallback,
    };
    static selects = {
        VSchooseSuggestion: this.chooseSuggestionCallback,
    };
}

module.exports = VoteSuggestion;