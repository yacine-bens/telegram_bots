// Main modules
require('dotenv').config();
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
const { response } = require('express');
// Additional modules
// ...

router.use(bodyParser.json());

// Set appropriate Token
const TOKEN = process.env.TOKEN_WEATHER;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;

// Weather API key
const { WEATHER_API_KEY } = process.env;

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
        if (messageText === '/start') response_message = 'Please enter your city.';
        else response_message = 'Please enter a valid bot command.';
    }
    else {
        let city = messageText.replace(/[^a-zA-Z0-9 ]/g, '');
        // Send please wait message
        await pleaseWait(TELEGRAM_API, chatId);
        let weatherData = await getWeather(city);
        if (!Object.keys(weatherData).length) response_message = `No location found for :\n"${messageText}"`;
        else response_message = formatMessage(weatherData);
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

async function pleaseWait(api, chat_id) {
    await axios.post(`${api}/sendMessage`, {
        chat_id: chat_id,
        text: 'Please wait...'
    })
}

function isBotCommand(msg) {
    if (msg.text.startsWith('/') && msg.entities) {
        for (let entity of msg.entities) {
            if (entity.type === "bot_command") return true;
        }
    }
    return false;
}

async function getWeather(city) {
    let res = await axios.get(`https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${city}&aqi=no`)
        .catch(error => { console.log(error.message) });
    if (res && res.data) {
        return {
            name: res.data.location.name,
            region: res.data.location.region,
            country: res.data.location.country,
            temp_c: res.data.current.temp_c,
            condition: res.data.current.condition.text,
            wind_kph: res.data.current.wind_kph,
            precip_mm: res.data.current.precip_mm,
            humidity: res.data.current.humidity
        }
    }
    return {};
}

function formatMessage(data) {
    let result = `${data.name}  ,  ${data.region}  ,  ${data.country}\n${data.temp_c} C  ,  ${data.condition}\n${data.wind_kph} Km/h  ,  ${data.precip_mm} mm  ,  ${data.humidity} humidity`;
    return result;
}

module.exports = router;