 // کتابخانه‌های مورد نیاز
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // برای فراخوانی APIها
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ===================================================================
// بخش کلیدهای شخصی (API Keys) - این بخش را باید پر کنید
// ===================================================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7302532280:AAEeTwIjfRuaHYn_O3pIqLSO3utJ4chQlFQ';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'https://one-api.ir/weather/?token={token}&action=current&city={city}';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCaJayTLH8_kng-liJXfWGy7hSjjGIBiXY';
// ===================================================================

// راه‌اندازی ربات
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// راه‌اندازی هوش مصنوعی جمینی
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// متغیری برای ذخیره وضعیت کاربران
const userState = {};

console.log('ربات جامع جارویس با موفقیت روشن شد...');

// تعریف کیبورد اصلی
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '📝 برنامه ریزی' }, { text: '🌦️ آب و هوا' }],
            [{ text: '📰 اخبار' }, { text: '💬 چت با هوش مصنوعی' }],
            [{ text: '💰 قیمت ارز دیجیتال' }]
        ],
        resize_keyboard: true,
    },
};

// --- مدیریت دستورات اصلی ---

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'رییس';
    const welcomeMessage = `سلام رییس ${firstName} 👋\n\nمن در خدمتم. چه کاری براتون انجام بدم؟`;
    bot.sendMessage(chatId, welcomeMessage, mainKeyboard);
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // اگر کاربر در حال انجام یک فرآیند خاص (مثل ثبت برنامه) نباشد
    if (!userState[chatId]) {
        switch (text) {
            case '📝 برنامه ریزی':
                handleScheduling(chatId);
                break;
            case '🌦️ آب و هوا':
                handleWeather(chatId);
                break;
            case '📰 اخبار':
                handleNews(chatId);
                break;
            case '💬 چت با هوش مصنوعی':
                handleAIChat(chatId);
                break;
            case '💰 قیمت ارز دیجیتال':
                handleCrypto(chatId);
                break;
        }
    }

    // مدیریت فرآیندهای چندمرحله‌ای
    if (userState[chatId]) {
        const state = userState[chatId].step;
        // این بخش‌ها توسط توابع مربوطه مدیریت می‌شوند
        if (state.startsWith('SCHEDULE_')) {
            processScheduling(chatId, text);
        } else if (state.startsWith('WEATHER_')) {
            processWeather(chatId, text);
        } else if (state.startsWith('NEWS_')) {
            processNews(chatId, text);
        } else if (state.startsWith('AI_CHAT_')) {
            processAIChat(chatId, text);
        } else if (state.startsWith('CRYPTO_')) {
            processCrypto(chatId, text);
        }
    }
});


// --- توابع مدیریت هر بخش ---

// 1. برنامه ریزی
function handleScheduling(chatId) {
    bot.sendMessage(chatId, 'بسیار خب. لطفاً عنوان برنامه‌ات رو بنویس.');
    userState[chatId] = { step: 'SCHEDULE_AWAITING_TITLE' };
}

function processScheduling(chatId, text) {
    const state = userState[chatId];
    if (state.step === 'SCHEDULE_AWAITING_TITLE') {
        state.title = text;
        bot.sendMessage(chatId, `خب رییس. برای چه ساعتی تنظیمش کنم؟ (فرمت ۲۴ ساعته مثل 14:30)`);
        state.step = 'SCHEDULE_AWAITING_TIME';
    } else if (state.step === 'SCHEDULE_AWAITING_TIME') {
        if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(text)) {
            const [hour, minute] = text.split(':');
            cron.schedule(`${minute} ${hour} * * *`, () => {
                bot.sendMessage(chatId, `🔔 رییس! وقت انجام کار «${state.title}» فرا رسیده.`);
            }, { scheduled: true, timezone: "Asia/Tehran" });
            bot.sendMessage(chatId, `✅ عالیه! برنامه «${state.title}» برای ساعت ${text} ثبت شد.`);
            delete userState[chatId];
        } else {
            bot.sendMessage(chatId, '❌ فرمت ساعت اشتباهه. لطفاً به این شکل بفرست: HH:MM');
        }
    }
}

// 2. آب و هوا
function handleWeather(chatId) {
    bot.sendMessage(chatId, 'شهر مورد نظرت رو به انگلیسی بنویس (مثال: Tehran)');
    userState[chatId] = { step: 'WEATHER_AWAITING_CITY' };
}

async function processWeather(chatId, city) {
    try {
        const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${city},IR&appid=${WEATHER_API_KEY}&units=metric&lang=fa`);
        const data = response.data;
        const temp = data.main.temp;
        const description = data.weather[0].description;
        const weatherId = data.weather[0].id;

        let suggestion = '';
        if (weatherId < 300) suggestion = '⛈️ هوا طوفانی و بارانی است، حتما چتر و لباس مناسب همراه داشته باشید.';
        else if (weatherId < 600) suggestion = '☔️ هوا بارانی است، چتر را فراموش نکنید.';
        else if (weatherId < 700) suggestion = '❄️ هوا برفی است، لباس گرم و کفش مناسب بپوشید.';
        else if (weatherId === 800) suggestion = '☀️ هوا آفتابی و عالی است، یک روز خوب برای فعالیت در بیرون!';
        else suggestion = '☁️ هوا ابری است. لباس مناسب فصل را بپوشید.';
        
        if (temp > 25) suggestion += '\n🥵 هوا گرم است، لباس‌های خنک و روشن بپوشید و آب زیاد بنوشید.';
        if (temp < 10) suggestion += '\n🥶 هوا سرد است، حتما لباس گرم بپوشید.';

        const message = `وضعیت آب و هوای ${city}:\n\n🌡️ دما: ${temp}° سانتی‌گراد\n📝 وضعیت: ${description}\n\n${suggestion}`;
        bot.sendMessage(chatId, message);

    } catch (error) {
        bot.sendMessage(chatId, 'متاسفانه نتونستم این شهر رو پیدا کنم. لطفاً اسم شهر رو به انگلیسی و صحیح وارد کن.');
    }
    delete userState[chatId];
}

// 3. اخبار
function handleNews(chatId) {
    bot.sendMessage(chatId, 'کدام دسته از اخبار رو می‌خوای؟', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '⚽ ورزشی', callback_data: 'news_sports' }],
                [{ text: '🏛️ سیاسی', callback_data: 'news_politics' }]
            ]
        }
    });
    // نکته: برای اخبار نیاز به API جداگانه است که در این کد به دلیل پیچیدگی حذف شده
    // و یک پیام نمونه ارسال می‌شود.
}

bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;

    if (data.startsWith('news_')) {
        const category = data.split('_')[1];
        bot.sendMessage(msg.chat.id, `در حال حاضر این بخش در دست ساخت است.\nشما دسته "${category}" را انتخاب کردید.`);
        bot.answerCallbackQuery(callbackQuery.id);
        // توضیح: برای پیاده‌سازی کامل این بخش، نیاز به یک API اخبار دارید.
        // فوروارد از کانال‌های دیگر برای ربات‌ها ممکن نیست.
    }
});


// 4. چت با هوش مصنوعی
function handleAIChat(chatId) {
    bot.sendMessage(chatId, 'سلام رییس. من سراپا گوشم. هر سوالی داری بپرس. (برای خروج کلمه "پایان" را بنویس)');
    userState[chatId] = { step: 'AI_CHAT_ACTIVE' };
}

async function processAIChat(chatId, text) {
    if (text.toLowerCase() === 'پایان') {
        bot.sendMessage(chatId, 'مکالمه تمام شد. دوباره در خدمتم.', mainKeyboard);
        delete userState[chatId];
        return;
    }

    try {
        bot.sendChatAction(chatId, 'typing'); // نمایش حالت "در حال نوشتن..."
        const result = await model.generateContent(text);
        const response = await result.response;
        const aiText = response.text();
        bot.sendMessage(chatId, aiText);
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'متاسفانه در ارتباط با هوش مصنوعی مشکلی پیش اومد.');
    }
}

// 5. قیمت ارز دیجیتال
async function handleCrypto(chatId) {
    try {
        bot.sendChatAction(chatId, 'typing');
        // دریافت قیمت‌ها از CoinGecko
        const cryptoResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,solana,dogecoin&vs_currencies=usd');
        const cryptoData = cryptoResponse.data;

        // دریافت قیمت دلار به ریال (از یک منبع عمومی)
        // نکته: این قیمت‌ها تقریبی هستند
        const tomanResponse = await axios.get('https://api.wallex.ir/v1/markets');
        const usdtPrice = tomanResponse.data.result.symbols.USDTTMN.stats.lastPrice;
        const dollarPriceInToman = parseFloat(usdtPrice);

        let message = '📈 آخرین قیمت ارزهای دیجیتال:\n\n';
        const coins = {
            bitcoin: 'بیت‌کوین (BTC)',
            ethereum: 'اتریوم (ETH)',
            tether: 'تتر (USDT)',
            solana: 'سولانا (SOL)',
            dogecoin: 'دوج‌کوین (DOGE)'
        };

        for (const coin in cryptoData) {
            const priceUSD = cryptoData[coin].usd;
            const priceIRR = priceUSD * dollarPriceInToman * 10; // تبدیل تومان به ریال
            message += `🔹 **${coins[coin]}**:\n`;
            message += `   - 💵 دلاری: ${priceUSD.toLocaleString('en-US')} $\n`;
            message += `   - 🇮🇷 ریالی: ${Math.round(priceIRR).toLocaleString('fa-IR')} ریال\n\n`;
        }

        bot.sendMessage(chatId, message);

    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'متاسفانه در دریافت قیمت‌ها مشکلی پیش آمد.');
    }
}