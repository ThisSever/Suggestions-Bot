function welcomeText(client) {
    console.log(`${client.user.username} | ID: ${client.user.id}`);
}

module.exports = welcomeText;