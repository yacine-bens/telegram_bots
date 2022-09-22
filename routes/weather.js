// Main modules
require('dotenv').config();
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
const { response } = require('express');
// Additional modules
const { MongoClient, ServerApiVersion } = require('mongodb');

router.use(bodyParser.json());

// Set appropriate Token
const TOKEN = process.env.TOKEN_WEATHER;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;

// Weather API key
const { WEATHER_API_KEY } = process.env;

// MongoDB
const DB_URI = "mongodb+srv://vercel-admin-user:dKkJWnHudcEg8Q5c@cluster0.teexhmd.mongodb.net/test";
const client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

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

    let db = await client.connect();
    let collection = db.db('weather').collection('chats');

    // Check if update is a message
    if (!req.body.message || !req.body.message.text) return res.send();

    const chatId = req.body.message.chat.id;
    const messageText = req.body.message.text;

    // To be sent to the user
    let response_message = '';

    let currentMode = '/current';

    let result = await collection.findOne({ chat_id: chatId }, { projection: { _id: 0 } });
    // First time
    if (!result) {
        await collection.insertOne({ chat_id: chatId, mode: '/current' });
    }
    else currentMode = result.mode;

    // Check if message is a bot command
    if (isBotCommand(req.body.message)) {
        if (messageText === '/start') response_message = 'Please enter your city.';
        else if (messageText === '/mode') {
            let mode = (currentMode === '/current') ? 'Current weather' : 'Forecast';
            response_message = `Current mode is "${mode}"`;
        }
        else {
            if (messageText === '/current' || messageText === '/forecast') {
                if (currentMode != messageText) {
                    await collection.updateOne({ chat_id: chatId }, { $set: { mode: messageText } });
                }
                response_message = 'Please enter your city.';
            }
            else response_message = 'Please enter a valid bot command.';
        }
    }
    else {
        const city = messageText.replace(/[^a-zA-Z0-9 ]/g, '');
        // maximum for free account
        const days = 3;

        // Send please wait message
        await pleaseWait(TELEGRAM_API, chatId);

        if (currentMode === '/current') {
            let weatherData = await getCurrentWeather(city);
            if (!Object.keys(weatherData).length) response_message = `No location found for :\n"${messageText}"`;
            else response_message = formatCurrentWeatherMessage(weatherData);
        }
        else {
            let weatherData = await getForecast(city, days);
            if (!Object.keys(weatherData).length) response_message = `No location found for :\n"${messageText}"`;
            else response_message = formatForecastMessage(weatherData);
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

async function getCurrentWeather(city) {
    let res = await axios.get(`https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${city}&aqi=no`)
        .catch(error => { console.log(error.message) });
    if (res && res.data) {
        return {
            name: res.data.location.name,
            region: res.data.location.region,
            country: res.data.location.country,
            tz_id: res.data.location.tz_id.split('/')[1],
            temp_c: res.data.current.temp_c,
            condition: res.data.current.condition.text,
            wind_kph: res.data.current.wind_kph,
            precip_mm: res.data.current.precip_mm,
            humidity: res.data.current.humidity
        }
    }
    return {};
}

async function getForecast(city, days = 1) {
    let res = await axios.get(`https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${city}&days=${days}&aqi=no&alerts=no`)
        .catch(error => { console.log(error.message) });
    if (res && res.data) {
        let data = {
            name: res.data.location.name,
            region: res.data.location.region,
            country: res.data.location.country,
            tz_id: res.data.location.tz_id.split('/')[1],
            days: []
        };

        res.data.forecast.forecastday.forEach(day => {
            data.days.push({
                date: day.date,
                maxtemp_c: day.day.maxtemp_c,
                mintemp_c: day.day.mintemp_c,
                avgtemp_c: day.day.avgtemp_c,
                totalprecip_mm: day.day.totalprecip_mm,
                avghumidity: day.day.avghumidity,
                daily_chance_of_rain: day.day.daily_chance_of_rain,
                condition: day.day.condition.text
            })
        });
        return data;
    }
    return {};
}

function formatCurrentWeatherMessage(data) {
    let result = `${data.name}  ,  ${data.region ? data.region : data.tz_id}  ,  ${data.country}\n${data.temp_c} C  ,  ${data.condition}\n${data.wind_kph} Km/h  ,  ${data.precip_mm} mm  ,  ${data.humidity} humidity`;
    return result;
}

function formatForecastMessage(data) {
    let result = `${data.name}  ,  ${data.region ? data.region : data.tz_id}  ,  ${data.country}\n\n`;
    data.days.forEach(day => {
        result += `${day.date}\n------------------\n• ${day.condition}\n• Max : ${day.maxtemp_c} C  ,  Min : ${day.mintemp_c} C  ,  Avg : ${day.avgtemp_c} C\n• Total precip : ${day.totalprecip_mm} mm\n• Avg humidity : ${day.avghumidity}\n• Chance of rain : ${day.daily_chance_of_rain} %\n\n`;
    })
    return result;
}

module.exports = router;