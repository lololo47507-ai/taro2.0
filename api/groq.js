const crypto = require('crypto');
const Groq = require('groq-sdk');
const { Redis } = require('@upstash/redis');

async function validate(initData) {
    // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
    // Если это запрос от нашего "dev-стаба", пропускаем валидацию
    if (initData === 'dev_init_data') return true;

    const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TG_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured!');
    const sp = new URLSearchParams(initData);
    const hash = sp.get('hash');
    sp.delete('hash');
    sp.sort();
    const dataCheckString = Array.from(sp.entries()).map(([key, value]) => `${key}=${value}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(TG_BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    return hmac === hash;
}

export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (request.method === 'OPTIONS') return response.status(204).end();
    if (request.method !== 'POST') return response.status(405).end('Method Not Allowed');

    try {
        if (!process.env.GROQ_API_KEY || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
            throw new Error('Конфигурация сервера неполная.');
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const redis = Redis.fromEnv();
        
        const { initData, system, messages } = request.body;

        if (!initData || !messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error('initData and messages array are required.');
        }

        if (!(await validate(initData))) {
            return response.status(403).json({ ok: false, error: 'Validation failed.' });
        }
        
        // Для dev-режима используем тестовый ID
        const isDev = initData === 'dev_init_data';
        const userId = isDev ? 123456 : JSON.parse(decodeURIComponent(new URLSearchParams(initData).get('user'))).id;
        const userKey = `user:${userId}`;

        let userData = await redis.get(userKey);
        if (isDev && !userData) { // Создаем тестового пользователя, если его нет
            userData = { balance: 999, history: [] }; // Даем много баланса для тестов
            await redis.set(userKey, JSON.stringify(userData));
        }

        const isPaidRequest = messages.some(m => m.role === 'user');
        if (isPaidRequest) {
            if (!userData || userData.balance < 1) {
                return response.status(402).json({ ok: false, error: 'Insufficient balance.' });
            }
            userData.balance -= 1;
            await redis.set(userKey, JSON.stringify(userData));
        }

        const fullMessages = [];
        if (system) {
            fullMessages.push({ role: 'system', content: system });
        }
        fullMessages.push(...messages);

        const chatCompletion = await groq.chat.completions.create({
            messages: fullMessages,
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        });
        
        const aiResponse = chatCompletion.choices[0]?.message?.content || 'Произошла ошибка.';
        
        return response.status(200).json({ 
            text: aiResponse,
            ok: true,
            newBalance: userData ? userData.balance : null
        });

    } catch (e) {
        console.error('--- ФУНКЦИЯ GROQ НЕ ВЫПОЛНЕНА ---', e);
        return response.status(500).json({ ok: false, error: e.message });
    }
}