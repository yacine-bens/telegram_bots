// Main modules
require('dotenv').config();
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
// Additional modules
// ...

router.use(bodyParser.json());

// Set appropriate Token
const TOKEN = process.env.TOKEN_SPOILER;
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

    // To be sent to the user
    let response_message = '';

    // Check if message is a bot command
    if (isBotCommand(req.body.message)) {
        if (messageText === '/start') response_message = 'Please send your message.'
    }
    else {
        response_message = `Your message is :\n<tg-spoiler>${messageText}</tg-spoiler>`;
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
            if (entity.type === "bot_command") return true;
        }
    }
    return false;
}

module.exports = router;