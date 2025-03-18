const SteamUser = require('steam-user');
const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline');
const { username, password } = require('./config');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const client = new SteamUser();
let isRunning = true;

// Function to prompt for Steam Guard code
function promptSteamGuard(callback) {
  rl.question('Steam Guard App Code: ', (code) => {
    callback(code);
  });
}

// Handle login with error handling
function login() {
  console.log('Attempting to log in to Steam...');
  client.logOn({ accountName: username, password: password });
}

// Initial login
login();
client.on('loggedOn', () => {
    console.log(`Logged in as ${client.steamID.getSteam3RenderedID()}`);
    console.log('Monitoring friend requests. Press Ctrl+C to exit.');
    client.setPersona(SteamUser.EPersonaState.Online);
});

// Handle Steam Guard requests
client.on('steamGuard', (domain, callback) => {
    if (domain) {
        console.log(`Steam Guard code needed for email domain ${domain}`);
    } else {
        console.log('Steam Guard mobile authenticator code needed');
    }
    promptSteamGuard(callback);
});

// Handle login errors
client.on('error', (err) => {
    console.error('Steam client error:', err.message);
    
    if (err.eresult === SteamUser.EResult.AccountLoginDeniedThrottle) {
        console.error('Error: Too many login failures in a short time. Please wait before trying again.');
    } else if (err.eresult === SteamUser.EResult.InvalidPassword) {
        console.error('Error: Invalid password. Please check your credentials in the config file.');
    } else if (err.eresult === SteamUser.EResult.NoConnection) {
        console.error('Error: Cannot connect to Steam. Check your internet connection.');
        console.log('Retrying in 60 seconds...');
        setTimeout(() => {
            if (isRunning) login();
        }, 60000);
    }
});

// Handle disconnections
client.on('disconnected', (eresult, msg) => {
    console.log(`Disconnected from Steam: ${msg || eresult}`);
    if (isRunning) {
        console.log('Attempting to reconnect in 30 seconds...');
        setTimeout(() => {
            if (isRunning) login();
        }, 30000);
    }
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
        const response = await axios.get(url, {
            timeout: 10000, // 10 second timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);

        // Check if the comment section is missing
        const commentSection = $('#commentthread_Profile_RecentComments');
        return commentSection.length === 0; // If the section is missing, comments are private
    } catch (error) {
        console.error(`Error checking profile ${steamID64}:`);
        if (error.response) {
            console.error(`  Status: ${error.response.status}`);
            console.error(`  Status Text: ${error.response.statusText}`);
        } else if (error.request) {
            console.error('  No response received from server');
        } else {
            console.error(`  Error message: ${error.message}`);
        }
        
        // If there's a network error, we might want to retry
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.log(`  Retrying ${steamID64} in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return checkCommentsDisabled(steamID64);
        }
        
        return false; // Default to false if there's an error
    }
}

// Clean shutdown handler
function shutdown() {
    console.log('Shutting down...');
    isRunning = false;
    
    client.logOff();
    client.once('disconnected', () => {
        console.log('Logged off from Steam');
        rl.close();
        process.exit(0);
    });
    
    // Force exit after 5 seconds if normal disconnect doesn't work
    setTimeout(() => {
        console.log('Forced shutdown after timeout');
        process.exit(1);
    }, 5000);
}

// Handle Ctrl+C and other termination signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});
