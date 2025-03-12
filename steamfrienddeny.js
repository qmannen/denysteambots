const SteamUser = require('steam-user');
const axios = require('axios');
const cheerio = require('cheerio');
const { username, password } = require('./config');

const client = new SteamUser();

client.logOn({ accountName: username, password: password });

client.on('loggedOn', () => {
    console.log(`Logged in as ${client.steamID.getSteam3RenderedID()}`);
});

client.on('friendRelationship', async (steamID, relationship) => {
    if (relationship === SteamUser.EFriendRelationship.RequestRecipient) {
        console.log(`Received friend request from ${steamID.getSteamID64()}`);

        const isDisabled = await checkCommentsDisabled(steamID.getSteamID64());
        if (isDisabled) {
            console.log(`Declining request from ${steamID.getSteamID64()} (comments disabled)`);
            client.removeFriend(steamID);
        } else {
            console.log(`Friend request from ${steamID.getSteamID64()} is allowed (comments enabled)`);
        }
    }
});

async function checkCommentsDisabled(steamID64) {
    try {
        const url = `https://steamcommunity.com/profiles/${steamID64}`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Check if the comment section is missing
        const commentSection = $('#commentthread_Profile_RecentComments');
        return commentSection.length === 0; // If the section is missing, comments are private
    } catch (error) {
        console.error(`Error checking profile ${steamID64}:`, error.message);
        return false; // Default to false if there's an error
    }
}
