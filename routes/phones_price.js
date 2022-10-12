// Main modules
require('dotenv').config();
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
// Additional modules
const url = require('url');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { MongoClient, ServerApiVersion } = require('mongodb');

router.use(bodyParser.json());

// Telegram Bot (Set appropriate Token)
const TOKEN = process.env.TOKEN_PHONES;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;

// Set webhook
router.get(`/setWebhook`, async (req, res) => {
    // req.baseUrl : endpoint
    const SERVER_URL = 'https://' + req.get('host') + req.baseUrl;
    const WEBHOOK_URL = SERVER_URL + URI;
    const response = await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
    return res.send(response.data);
})

// MongoDB
const { DB_URI } = process.env;
const client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const settings = {
    menu: {
        values: {},
        keyboard: {
            text: 'Settings',
            inlineKeyboard: [
                [{ text: 'Change Vendor', callback_data: 'vendor' }],
                [{ text: 'Exit', callback_data: 'exit' }]
            ]
        }
    },
    vendor: {
        values: {
            'ace': {
                name: 'ACE',
                code: '56305',
            },
            'apple': {
                name: 'Apple',
                code: '5741',
            },
            'condor': {
                name: 'Condor',
                code: '12540',
            },
            'google': {
                name: 'Google',
                code: '37065',
            },
            'huawei': {
                name: 'Huawei',
                code: '11712',
            },
            'iku': {
                name: 'iKU',
                code: '9829005',
            },
            'infinix': {
                name: 'INFINIX',
                code: '66537',
            },
            'iris': {
                name: 'IRIS',
                code: '14770',
            },
            'nokia': {
                name: 'Nokia',
                code: '5918',
            },
            'nubia': {
                name: 'Nubia Red Magic',
                code: '5430356',
            },
            'oneplus': {
                name: 'OnePlus',
                code: '43420',
            },
            'oppo': {
                name: 'Oppo',
                code: '14281',
            },
            'realme': {
                name: 'Realme',
                code: '109180',
            },
            'samsung': {
                name: 'Samsung',
                code: '3674',
            },
            'starlight': {
                name: 'Starlight',
                code: '3838',
            },
            'wiko': {
                name: 'Wiko',
                code: '13197',
            },
            'xiaomi': {
                name: 'Xiaomi',
                code: '41820',
            },
            'all': {
                name: 'All',
                code: '-1',
            }
        },
        keyboard: {
            text: 'Select Vendor',
            inlineKeyboard: [
                [{ text: 'ACE', callback_data: 'vendor_ace' }, { text: 'Apple', callback_data: 'vendor_apple' }],
                [{ text: 'Condor', callback_data: 'vendor_condor' }, { text: 'Google', callback_data: 'vendor_google' }],
                [{ text: 'Huawei', callback_data: 'vendor_huawei' }, { text: 'iKU', callback_data: 'vendor_iku' }],
                [{ text: 'INFINIX', callback_data: 'vendor_infinix' }, { text: 'IRIS', callback_data: 'vendor_iris' }],
                [{ text: 'Nokia', callback_data: 'vendor_nokia' }, { text: 'Nubia', callback_data: 'vendor_nubia' }],
                [{ text: 'OnePlus', callback_data: 'vendor_oneplus' }, { text: 'Oppo', callback_data: 'vendor_oppo' }],
                [{ text: 'Realme', callback_data: 'vendor_realme' }, { text: 'Samsung', callback_data: 'vendor_samsung' }],
                [{ text: 'Starlight', callback_data: 'vendor_starlight' }, { text: 'Wiko', callback_data: 'vendor_wiko' }],
                [{ text: 'Xiaomi', callback_data: 'vendor_xiaomi' }, { text: 'ZTE', callback_data: 'vendor_zte' }],
                [{ text: 'All', callback_data: 'vendor_all' }],
                [{ text: 'Back to menu', callback_data: 'menu' }]
            ]
        }
    }
}

const defaultSettings = {
    vendor: settings.vendor.values['all']
}

// Receive messages
router.post(URI, async (req, res) => {
    console.log(req.body);

    // Get bot name from endpoint
    const botName = req.baseUrl.replace('/', '');

    const database = await client.connect();
    const db = database.db(botName);

    // Update is a callback query
    if (req.body.callback_query) {
        const cbQueryId = req.body.callback_query.id;
        const cbQueryData = req.body.callback_query.data;
        const msgId = req.body.callback_query.message.message_id;
        const chatId = req.body.callback_query.message.chat.id;

        // Menu queries
        if (!cbQueryData.includes('_')) {
            if (cbQueryData === 'exit') {
                await deleteMessage(chatId, msgId);
            }
            else {
                const keyboard = inlineKeyboard(cbQueryData);
                await sendInlineKeyboard(chatId, msgId, cbQueryId, keyboard);
            }
        }
        // Value queries
        else {
            // Set settings
            const settingsName = cbQueryData.split('_')[0];
            const settingsKey = cbQueryData.split('_')[1];
            const settingsValue = settings[settingsName]['values'][settingsKey];

            const newSettings = {
                name: settingsName,
                value: settingsValue
            }

            await setUserSettings(chatId, newSettings, db);

            await answerCallback(cbQueryId, 'Settings successfully changed.', true);

            // Go back to main menu
            const keyboard = inlineKeyboard('menu');
            await sendInlineKeyboard(chatId, msgId, cbQueryId, keyboard);
        }
        return res.send();
    }
    // Update is not a message
    else if (!req.body.message || !req.body.message.text) return res.send();

    const updateId = req.body.update_id;
    const chatId = req.body.message.chat.id;
    const messageText = req.body.message.text;
    const msgId = req.body.message.message_id;

    // Check if update is repeated
    const repeatedUpdate = await isRepeatedUpdate(chatId, updateId, db);
    if(repeatedUpdate) return res.send();

    // To be sent to the user
    let response_message = '';

    // User settings
    const userSettings = await getUserSettings(chatId, db, defaultSettings);

    if (isBotCommand(req.body.message)) {
        if (messageText === '/start') response_message = 'Please enter phone model.'
        else if(messageText === '/settings'){
            await deleteMessage(chatId, msgId);
            await sendSettingsMenu(chatId);
            return res.send();
        }
    }
    else {
        // Send please wait message
        await pleaseWait(TELEGRAM_API, chatId);

        let phones = await getPhones(messageText, userSettings.vendor['code']);
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
            };
            response_message += `\nVendor : ${userSettings.vendor['name']}`;
            response_message += `\n\nResults found : ${phones.length}`;
        }
        else {
            response_message = `No results found for :\n"${messageText}"`;
            response_message += `\n\nVendor : ${userSettings.vendor['name']}`;
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

async function pleaseWait(api, chat_id) {
    axios.post(`${api}/sendMessage`, {
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

async function getPhones(search, vendor) {
    const data = {
        "filtre_value_dep_441": vendor,
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
            if (detailsElement[0] && detailsElement[1]) {
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

async function isRepeatedUpdate(chat_id, update_id, db) {
    const updatesCollection = db.collection('updates');
    const result = await updatesCollection.findOne({ chat_id: chat_id }, { projection: { _id: 0 } });

    // First time
    if (!result) {
        await updatesCollection.insertOne({ chat_id: chat_id, last_update: update_id });
    }
    else {
        if (parseInt(update_id) <= parseInt(result.last_update)) return true;
        await updatesCollection.updateOne({ chat_id: chat_id }, { $set: { last_update: update_id } });
        return false;
    }
}

async function getUserSettings(chat_id, db, default_settings) {
    let userSettings = default_settings;

    const userSettingsCollection = db.collection('user_settings');
    const result = await userSettingsCollection.findOne({ chat_id: chat_id }, { projection: { _id: 0, chat_id: 0 } });

    // First time
    if (result) {
        userSettings = result;
    }
    else {
        await userSettingsCollection.insertOne({ chat_id: chat_id, ...userSettings });
    }

    return userSettings;
}

async function setUserSettings(chat_id, settings, db) {
    const userSettingsCollection = db.collection('user_settings');
    await userSettingsCollection.updateOne({ chat_id: chat_id }, { $set: { [settings.name]: settings.value } });
}

function inlineKeyboard(cb_query_data) {
    let keyboard = {
        text: '',
        inlineKeyboard: []
    }
    keyboard.text = settings[cb_query_data]['keyboard']['text'];
    keyboard.inlineKeyboard = settings[cb_query_data]['keyboard']['inlineKeyboard'];

    return keyboard;
}

async function sendInlineKeyboard(chat_id, msg_id, cb_query_id, keyboard) {
    await axios.post(`${TELEGRAM_API}/editMessageText`, {
        chat_id: chat_id,
        message_id: msg_id,
        text: keyboard.text,
        reply_markup: {
            inline_keyboard: keyboard.inlineKeyboard
        }
    })

    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: cb_query_id
    })
}

async function deleteMessage(chat_id, msg_id) {
    await axios.post(`${TELEGRAM_API}/deleteMessage`, {
        chat_id: chat_id,
        message_id: msg_id
    })
}

async function sendSettingsMenu(chat_id) {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chat_id,
        text: settings['menu']['keyboard']['text'],
        reply_markup: {
            inline_keyboard: settings['menu']['keyboard']['inlineKeyboard']
        }
    })
}

async function answerCallback(cb_query_id, msg, show_alert) {
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: cb_query_id,
        text: msg,
        show_alert: show_alert
    });
}

module.exports = router;