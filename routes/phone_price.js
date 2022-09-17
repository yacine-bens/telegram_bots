require('dotenv').config();
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
const url = require('url');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

router.use(bodyParser.json());

// Telegram bot
const { TOKEN_PHONES, VERCEL_URL } = process.env;
const SERVER_URL = `https://${VERCEL_URL}/phones`;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN_PHONES}`;
const URI = `/webhook/${TOKEN_PHONES}`;
const WEBHOOK_URL = SERVER_URL + URI;


// Set webhook
router.get(`/setWebhook`, async (req, res) => {
    const response = await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
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
        if (messageText === '/start') response_message = 'Please enter phone model.'
    }
    else {
        // Send please wait message
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: 'Please wait...'
        })

        let phones = await getPhones(messageText);
        // Found results
        if (phones.length) {
            for (let i = 0; i < phones.length; i++) {
                response_message += `<a href="${phones[i]['link']}">${phones[i]['title']}</a>\n${phones[i]['details']}\n--------------------------\nPrix :  ${phones[i]['price']}\n\n`;
                // Split large message
                if (response_message.length > 8000) {
                    await axios.post(`${TELEGRAM_API}/sendMessage`, {
                        chat_id: chatId,
                        text: response_message,
                        parse_mode: 'html',
                        disable_web_page_preview: true
                    })
                    // Clear message
                    response_message = '';
                }
            }
            response_message += `\nResults found : ${phones.length}`;
        }
        else {
            response_message = `No results found for :\n"${messageText}"`;
        }
    }

    console.log(response_message.length);

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


async function getPhones(search) {
    const data = {
        "filtre_value_dep_441": "-1",
        "filtre_value_schema_630": search,
        "Envoyer": "Go",
        "filtre_value_schema_633": "-1",
        "filtre_value_schema_6330": "-1",
        "filtre_value_dep_695": "-1",
        "filtre_value_dep_6950": "-1",
        "filtre_value_dep_1094": "-1",
        "filtre_value_dep_10940": "-1",
        "filtre_value_dep_520": "-1",
        "filtre_value_dep_5200": "-1",
        "filtre_value_dep_1091": "-1",
        "filtre_value_dep_10910": "-1",
        "filtre_value_dep_648": "-1",
        "filtre_value_dep_6480": "-1",
        "filtre_value_dep_659": "-1",
        "filtre_value_dep_6590": "-1",
        "filtre_value_dep_693": "-1",
        "filtre_value_dep_6930": "-1",
        "filtre_value_dep_69300": "-1",
        "filtre_value_dep_693000": "-1",
        "action_recherche": "0"
    }

    const params = new url.URLSearchParams(data);

    let res = await axios.post('http://webstar-electro.com/telephones-mobiles/0/prix-telephones-portables-algerie.htm', params.toString());
    const { document } = (new JSDOM(res.data)).window;

    let phones = [];
    let phones_block = document.querySelectorAll('.structure_content_elts')[0].querySelectorAll('.item_okaz_block');
    console.log('found: ' + phones_block.length);
    // Check for results
    if (phones_block.length) {
        phones_block.forEach(phone => {
            let title = phone.querySelector('ul li.produit_titre h3.item1').textContent;
            let link = 'http://webstar-electro.com' + phone.querySelector('ul li.produit_titre a').href;
            let price = phone.querySelector('ul li.produit_valeur h4.prix').textContent.replace('Prix', '').trim();
            let detailsElement = phone.querySelectorAll('ul li.produit_valeur h4.libelle-properties');
            let details = '';
            if(detailsElement[0] && detailsElement[1]){
                details = detailsElement[0].textContent.trim() + '\n- ' + detailsElement[1].textContent.trim();
                // remove extra whitespaces
                details = details.replaceAll(/[^\S\r\n]+/g, ' ').trim();
    
                details = '- ' + details.replace('Pouces ', 'Pouces\n- ').replace('Go ', 'Go\n- ');
            }

            let phoneObj = {
                title: title,
                link: link,
                price: price,
                details: details
            };
            phones.push(phoneObj)
        })
    }

    return phones;
}


module.exports = router;