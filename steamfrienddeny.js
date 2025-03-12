const { username, password } = require('./config');

console.log(username, password); // Test to see if it's working


const SteamUser = require('steam-user');
const SteamCommunity = require('steam-community');

const client = new SteamUser();
const community = new SteamCommunity();

const username = "your_steam_username";
const password = "your_steam_password";

client.logOn({
    accountName: username,
    password: password
});

client.on('loggedOn', () => {
    console.log(`Logged in as ${client.steamID.getSteam3RenderedID()}`);
});

client.on('friendRelationship', async (steamID, relationship) => {
    if (relationship === SteamUser.EFriendRelationship.RequestRecipient) {
        console.log(`Received friend request from ${steamID.getSteamID64()}`);
        
        checkCommentsDisabled(steamID.getSteamID64()).then((isDisabled) => {
            if (isDisabled) {
                console.log(`Declining request from ${steamID.getSteamID64()} (comments disabled)`);
                client.removeFriend(steamID);
            } else {
                console.log(`Friend request from ${steamID.getSteamID64()} is allowed (comments enabled)`);
            }
        }).catch((err) => {
            console.log(`Error checking profile ${steamID.getSteamID64()}: ${err}`);
        });
    }
});

function checkCommentsDisabled(steamID64) {
    return new Promise((resolve, reject) => {
        community.getSteamUser(steamID64, (err, user) => {
            if (err) {
                reject(err);
            } else {
                const commentsDisabled = user.comments === null; // `null` means comments are disabled
                resolve(commentsDisabled);
            }
        });
    });
}
