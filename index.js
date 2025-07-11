const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');

// ===================================================================
//  بخش کلیدهای شخصی (API Keys) - این بخش را باید در Railway پر کنید
// ===================================================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // کلید ChatGPT
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY; // کلید DeepSeek
// ===================================================================

// --- راه‌اندازی سرویس‌ها ---
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ChatGPT (OpenAI)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// متغیری برای ذخیره وضعیت کاربران
const userState = {};

console.log('ربات "All AI" با موفقیت روشن شد...');

// تعریف کیبورد اصلی
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '💬 چت با Gemini' }],
            [{ text: '💬 چت با ChatGPT' }],
            [{ text: '💬 چت با DeepSeek' }],
        ],
        resize_keyboard: true,
    },
};

// --- مدیریت دستورات و پیام‌ها ---

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `سلام رییس 👋\n\nبه ربات "All AI" خوش آمدید. لطفاً هوش مصنوعی مورد نظر خود را برای شروع گفتگو انتخاب کنید.`;
    bot.sendMessage(chatId, welcomeMessage, mainKeyboard);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // بررسی اینکه آیا کاربر یک AI جدید انتخاب کرده است
    let newMode = null;
    if (text === '💬 چت با Gemini') newMode = 'GEMINI';
    if (text === '💬 چت با ChatGPT') newMode = 'CHAT_GPT';
    if (text === '💬 چت با DeepSeek') newMode = 'DEEPSEEK';
    
    if (newMode) {
        userState[chatId] = { mode: newMode };
        bot.sendMessage(chatId, `شما حالت مکالمه با ${newMode} را انتخاب کردید. حالا می‌توانید سوال خود را بپرسید.\n(برای تغییر AI، از دکمه‌های پایین استفاده کنید)`);
        return; // منتظر پیام بعدی کاربر می‌مانیم
    }

    // اگر کاربر در حالت مکالمه با یک AI باشد
    if (userState[chatId] && userState[chatId].mode) {
        const mode = userState[chatId].mode;
        let responseText = '';

        try {
            bot.sendChatAction(chatId, 'typing'); // نمایش حالت "در حال نوشتن..."
            
            if (mode === 'GEMINI') {
                const result = await geminiModel.generateContent(text);
                responseText = (await result.response).text();
            } else if (mode === 'CHAT_GPT') {
                const completion = await openai.chat.completions.create({
                    messages: [{ role: 'user', content: text }],
                    model: 'gpt-3.5-turbo',
                });
                responseText = completion.choices[0].message.content;
            } else if (mode === 'DEEPSEEK') {
                 const response = await axios.post(
                    'https://api.deepseek.com/chat/completions',
                    {
                        model: 'deepseek-chat',
                        messages: [{ role: 'user', content: text }],
                    },
                    { headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` } }
                );
                responseText = response.data.choices[0].message.content;
            }
            
            bot.sendMessage(chatId, responseText);

        } catch (error) {
            console.error(`Error with ${mode}:`, error.response ? error.response.data : error.message);
            bot.sendMessage(chatId, `متاسفانه در ارتباط با ${mode} مشکلی پیش آمد. لطفاً دوباره تلاش کنید.`);
        }
    } else {
        // اگر کاربر هنوز AI را انتخاب نکرده باشد
        bot.sendMessage(chatId, 'لطفاً ابتدا یکی از مدل‌های هوش مصنوعی را از منوی پایین انتخاب کنید.', mainKeyboard);
    }
});
