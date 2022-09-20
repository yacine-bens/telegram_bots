// Main modules
require('dotenv').config();
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
// Additional modules
const jsdom = require('jsdom');
const { response } = require('express');
const { JSDOM } = jsdom;

router.use(bodyParser.json());

// Set appropriate Token
const TOKEN = process.env.TOKEN_GAMEPASS;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;

// Set webhook
router.get('/setWebhook', async (req, res) => {
    // req.baseUrl : route endpoint
    const SERVER_URL = 'https://' + req.get('host') + req.baseUrl;
    const WEBHOOK_URL = SERVER_URL + URI;
    const response = await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`)
    return res.send(response.data);
})

// Receive messages
router.post(URI, async (req, res) => {
    console.log(req.body);

    // Check if update is a message
    if (!req.body.message || !req.body.message.text) return res.send();

    const chatId = req.body.message.chat.id;
    const messageText = req.body.message.text;

    let response_message = '';

    if (isBotCommand(req.body.message)) {
        if (messageText === '/start') response_message = 'Please enter a game name.';
        else response_message = 'Please enter a valid bot command!';
    }
    else{
        let gamesList = await getGames();
        if(Object.keys(gamesList).length){
            let result = searchGame(messageText, gamesList);
            response_message = formatMessage(result);
            if(response_message.length > 8000) response_message = 'Found too many games, please be more specific!';
        }
        else response_message = `No games found for:\n${messageText}`;
    }
    
    //Respond to user
    if (response_message != '') {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: response_message,
            parse_mode: 'html',
            disable_web_page_preview: true
        })
    }

    // Respond to Telegram server
    return res.send();
})

function isBotCommand(msg) {
    if (msg.text.startsWith('/') && msg.entities) {
        for (let entity of msg.entities) {
            return entity.type === "bot_command";
        }
    }
    return false;
}

async function getGames(){
    let res = await axios.get('https://gamepasscounter.com');
    const { document } = (new JSDOM(res.data)).window;
    
    let cards = document.querySelectorAll('.et_pb_row[id] > div');
    
    const categories = [
        "RECENTLY ADDED",
        "COMING SOON",
        "LEAVING SOON",
        "CONSOLE GAMES",
        "PC GAMES"
    ]
    
    let games = [...cards].reduce((acc, cur) => {
        // Category Title
        var categoryTitle = cur.querySelectorAll('.et_pb_text_inner')[1].textContent;
        if (categories.includes(categoryTitle.toUpperCase())) {
            var gamesList = [];
            cur.querySelectorAll('.et_pb_toggle_content li a').forEach(link => {
                let date = link.parentElement.querySelector('b');
                gamesList.push({ title: link.innerText, url: link.href, date: date ? date.innerText : null })
            });
            return { ...acc, [categoryTitle]: gamesList };
        }
        return acc;
    }, {});
    return games;
}

function searchGame(gameToBeFound, gamesList) {
    var results = {};
    Object.keys(gamesList).forEach(category => {
        gamesList[category].forEach(game => {
            let gameTitle = game['title'].trim().toUpperCase().replace(' ', ' ');
            if (gameTitle.indexOf(gameToBeFound.toUpperCase()) != -1) {
                if (!results[gameTitle]) results[gameTitle] = {};
                if (!results[gameTitle]['categories']) results[gameTitle]['categories'] = [];
                results[gameTitle]['categories'] = [...results[gameTitle]['categories'], category];
                results[gameTitle]['url'] = game['url'];
                if(game['date']) results[gameTitle]['date'] = game['date'].replace(/([^\s\w])/g, '');
            }
        })
    })
    return results;
}

function formatMessage(games){
    let result = '';
    for(let game of Object.keys(games)){
        result += `<a href="${games[game].url}">${game}</a>\n`;
        games[game].categories.forEach(cat => {
            if(cat.includes('SOON')) result += `- ${cat} : ${games[game]['date']}\n`;
            else result += `- ${cat}\n`;
        });
        result += '\n';
    }
    result += `Found ${Object.keys(games).length} games.`
    return result;
}

module.exports = router;