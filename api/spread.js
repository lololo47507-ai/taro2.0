const { Redis } = require('@upstash/redis');

// Инициализация клиента Redis
const redis = Redis.fromEnv();

exports.handler = async (event) => {
    const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };

    try {
        const { initData, title, cards, text, share } = JSON.parse(event.body || '{}');
        if (!initData || !title || !cards || !text) {
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'missing_fields' }) };
        }

        const user = new URLSearchParams(initData).get('user');
        const userId = JSON.parse(decodeURIComponent(user)).id;
        const userKey = `user:${userId}`;

        let data = await redis.get(userKey) || { balance: 20, history: [] };

        const newHistoryEntry = { ts: Date.now(), type: 'spread', title, cards, text };
        data.history.unshift(newHistoryEntry);
        data.history = data.history.slice(0, 50); // Ограничиваем историю

        await redis.set(userKey, JSON.stringify(data));

        // Отправка в чат, если share=true
        if (share && process.env.TELEGRAM_BOT_TOKEN) {
            // Формируем красивый список карт
            const cardList = cards.map(c => `- ${c.name}${c.rev ? ' (перевёрнутая)' : ''}`).join('\n');
            
            // Очищаем текст от Markdown, чтобы избежать конфликтов с HTML-разметкой Telegram
            const cleanInterpretation = text
                .replace(/\*\*/g, '') // убираем жирный markdown
                .replace(/###|##|#/g, ''); // убираем заголовки

            // Собираем полное сообщение
            const message = `<b>🔮 ${title} 🔮</b>\n\n<b>Ваши карты:</b>\n${cardList}\n\n<b>Интерпретация:</b>\n${cleanInterpretation}`;

            // Ограничиваем длину сообщения, чтобы избежать ошибок Telegram API
            const MAX_LENGTH = 4096;
            const truncatedMessage = message.length > MAX_LENGTH ? message.substring(0, MAX_LENGTH - 10) + '...' : message;

            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: userId, text: truncatedMessage, parse_mode: 'HTML' })
            });
        }

        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };

    } catch (e) {
        console.error('Spread function error:', e);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: e.message }) };
    }
};
