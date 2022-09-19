// Main modules
require('dotenv').config();
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
// Additional modules
const { MongoClient, ServerApiVersion } = require('mongodb');

router.use(bodyParser.json());

// Telegram Bot (Set appropriate Token)
const TOKEN = process.env.TOKEN_WORDS;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;

// MongoDB
const DB_URI = "mongodb+srv://vercel-admin-user:dKkJWnHudcEg8Q5c@cluster0.teexhmd.mongodb.net/test";
const client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// Set Webhook
router.get('/setWebhook', async (req, res) => {
    // req.baseUrl : route endpoint
    const SERVER_URL = req.protocol + '://' + req.get('host') + req.baseUrl;
    const WEBHOOK_URL = SERVER_URL + URI;
    const response = await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
    return res.send(response.data);
})

// Receive messages
router.post(URI, async (req, res) => {
    console.log(req.body);

    let db = await client.connect();
    let collection = db.db('test').collection('chats');


    // Update is not a message
    if (!req.body.message || !req.body.message.text) return res.send();

    const chatId = req.body.message.chat.id;
    const text = req.body.message.text;

    let currentMode;

    // findOne return an object if query matches, and NULL (or Undefined) if not
    let result = await collection.findOne({ chat_id: chatId }, { projection: { _id: 0 } });
    if (!result) {
        await collection.insertOne({ chat_id: chatId, mode: "/chars" });
        currentMode = "/chars";
    }
    else {
        currentMode = result.mode;
    }

    let response_message = "";

    // Check for bot commands
    if (isBotCommand(req.body.message)) {
        if (text === '/start') return res.send();
        if (text === '/mode') {
            let mode = (currentMode === "/chars") ? "characters count" : "words count";
            response_message = `Current mode is ${mode}`;
        }
        else {
            if (currentMode != text) {
                await collection.updateOne({ chat_id: chatId }, { $set: { mode: text } });
            }
            response_message = "Please send some text."
        }
    }
    else {
        let count = currentMode === "/chars" ? `${charCount(text)} characters.` : `${wordCount(text)} words.`;
        response_message = `Your message contains ${count}`;
    }


    // Respond to user
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: response_message
    })

    // Respond to Telegram server
    return res.send();
})


function wordCount(str) {
    return str.split(' ').filter(l => l != '').length;
}

function charCount(str) {
    return str.replaceAll(' ', '').length;
}

function isBotCommand(msg) {
    if (msg.text.startsWith('/') && msg.entities) {
        for (let entity of msg.entities) {
            return entity.type === "bot_command";
        }
    }
}

module.exports = router;