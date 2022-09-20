require('dotenv').config();
const express = require('express');
const axios = require('axios');

// Define route for each Bot
const route_forhire = require('./routes/reddit_forhire');
const route_phones = require('./routes/phones_price');
const route_words = require('./routes/words_count');
const route_gamepass = require('./routes/game_pass');
const route_currency = require('./routes/currency_converter');

const routes = {
    '/forhire': route_forhire,
    '/phones': route_phones,
    '/words': route_words,
    '/gamepass': route_gamepass,
    '/currency': route_currency
}

const app = express();

// app.use('/endpoint', route)
for (let route of Object.keys(routes)) {
    app.use(route, routes[route]);
}

// Deploy on Vercel : use Vercel provided URL
const SERVER_URL = validateURL(process.env.VERCEL_URL || process.env.SERVER_URL);

// Set webhooks manually (case of serverless functions, ex: Vercel)
app.get('/setWebhooks', async (req, res) => {
    let response = await setWebhooks(routes);
    return res.send(response);
})

app.listen(process.env.PORT || 5000, async () => {
    console.log('App in running on port:', process.env.PORT || 5000);
    setWebhooks(routes);
});


async function setWebhooks(routes) {
    let response = {};
    // Set webhook url for each bot
    for(let route of Object.keys(routes)){
        let res = await axios.get(SERVER_URL + route + '/setWebhook');
        response[route] = res.data;
        console.log(res.data);
    }
    return response;
}


function validateURL(url) {
    let result = url;
    if(!url.startsWith('https')){
        if(url.startsWith('http')) result = url.replace('http', 'https')
        else result = `https://${url}`;
    }
    // Remove additional slashes
    result = result.replace(/([^:]\/)\/+/g, "$1");
    // Remove trailing slash
    if (result.endsWith('/')) result = result.slice(0, result.length - 1);

    return result;
}