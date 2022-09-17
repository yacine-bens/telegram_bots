require('dotenv').config();
const express = require('express');
const axios = require('axios');

const route_forhire = require('./routes/reddit_forhire');
const route_phones = require('./routes/phone_price');
const route_words = require('./routes/words_count');
const { send } = require('process');

const app = express();

app.use('/forhire', route_forhire);
app.use('/phones', route_phones);
app.use('/words', route_words);

const { VERCEL_URL } = process.env;


app.get('/setWebhooks', (req, res) => {
    let response = setWebhooks();
    return res.send(response.data);
})

app.listen(process.env.PORT || 5000, async () => {
    console.log('App in running on port:', process.env.PORT || 5000);
    setWebhooks();
});


async function setWebhooks() {
    let response = {};

    let res = await axios.get(`https://${VERCEL_URL}/forhire/setWebhook`);
    let data = res.data;
    console.log(data);
    response = { ...response, data };
    
    res = await axios.get(`https://${VERCEL_URL}/phones/setWebhook`);
    data = res.data;
    console.log(data);
    response = { ...response, data };
    
    res = await axios.get(`https://${VERCEL_URL}/words/setWebhook`);
    data = res.data;
    console.log(data);
    response = { ...response, data };

    return response;
}