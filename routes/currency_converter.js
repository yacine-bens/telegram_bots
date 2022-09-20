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
const TOKEN = process.env.TOKEN_CURRENCY;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;

// XE credentials
const { XE_ID, XE_KEY } = process.env;

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
    const usage_message = 'Usage: \n- Single : 100 USD = EUR\n- Multiple : 50 EUR = DZD, USD, GBP';
    const error_message = 'Please try again.\n\n' + usage_message;

    if (isBotCommand(req.body.message)) {
        if (messageText === '/start') response_message = usage_message;
    }
    else {
        if (!messageText.includes('=')) response_message = error_message;
        else {
            // Extract details
            let amount = messageText.split('=')[0].match(/\w+/g)[0];
            amount = parseFloat(amount);
            let from = messageText.split('=')[0].match(/\w+/g)[1];
            // to : array (could be single/multiple currencies)
            let to = messageText.split('=')[1].match(/\w+/g);
            to = to.join(',');

            if (!from.length || isNaN(amount) || !to.length) response_message = error_message;
            else {
                // Send please wait message
                await axios.post(`${TELEGRAM_API}/sendMessage`, {
                    chat_id: chatId,
                    text: 'Please wait...'
                })

                let results = await convertCurrency(from, to, amount);
                if (!results.length) response_message = error_message;
                else {
                    response_message = `${amount} ${from.toUpperCase()} :`;
                    results.forEach(currency => {
                        response_message += `\n• ${currency['quotecurrency']} : ${currency['mid']}`;
                    })
                }
            }

        }
    }

    //Respond to user
    if (response_message != '') {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: response_message
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

async function convertCurrency(from, to, amount) {
    try {
        // Allowed crypto: ADA, BCH, DOGE, DOT, ETH, LINK, LTC, LUNA, UNI, XLM and XRP
        let res = await axios.get(`https://xecdapi.xe.com/v1/convert_from.json/?from=${from}&to=${to}&amount=${amount}&crypto=true`, {
            auth: {
                username: XE_ID,
                password: XE_KEY
            }
        });

        if (res.data.to) return res.data.to;
    }
    catch (e) {
        console.log(e);
    }
    return [];
}

module.exports = router;