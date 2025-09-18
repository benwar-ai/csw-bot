// api/telegram.js
const fetch = require('node-fetch');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const AUTHORIZED_USERS = (process.env.AUTHORIZED_USERS || '')
  .split(',')
  .map(u => u.trim());

// Firmeninterne Wissensdatenbank
const companyKnowledge = {
  "urlaubsantrag": "📅 Das Urlaubsformular findest du hier: https://intranet.deine-firma.com/urlaub",
  "gehalt": "💶 Die Gehaltsabrechnung wird immer am 25. des Monats bereitgestellt.",
  "it problem": "🖥️ Bitte erstelle ein Ticket im Helpdesk-System.",
  "büro schlüssel": "🔑 Schlüssel können während der Bürozeiten bei der Verwaltung abgeholt werden.",
  "krankenstand": "🤒 Melde dich bitte am ersten Krankheitstag telefonisch und reiche die Krankmeldung nach."
};

// Deepseek API-Anfrage
async function askDeepSeek(prompt, temperature = 0.3) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature
    })
  });
  const data = await res.json();
  console.log('Deepseek response:', JSON.stringify(data));
  return data.choices?.[0]?.message?.content || '❌ Entschuldigung, es gab ein Problem mit der KI.';
}

// KI-gestützte Themenerkennung
async function detectTheme(userText) {
  const prompt = `
  Analysiere die folgende Mitarbeiterfrage und antworte NUR mit einem dieser Schlüsselwörter:
  urlaubsantrag, gehalt, it problem, büro schlüssel, krankenstand.
  Wenn du keins zuordnen kannst, antworte mit "unbekannt".
  
  Frage: "${userText}"
  `;
  const theme = await askDeepSeek(prompt, 0.2);
  return theme.toLowerCase().trim();
}

// Sende Nachricht an Telegram
async function sendTelegramMessage(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text };
  if (keyboard) body.reply_markup = keyboard;

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await res.json();
  console.log('Telegram sendMessage response:', JSON.stringify(result));
  return result;
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log('Incoming body:', JSON.stringify(request.body, null, 2));
    const { message, callback_query } = request.body;

    // === Feedback-Buttons (callback_query) ===
    if (callback_query) {
      const chatId = callback_query.message.chat.id;
      const feedback = callback_query.data;
      const feedbackText =
        feedback === 'yes'
          ? '✅ Danke für dein Feedback!'
          : '❌ Danke, wir verbessern die Antwort.';
      await sendTelegramMessage(chatId, feedbackText);
      return response.status(200).json({ ok: true });
    }

    if (!message || !message.chat || !message.from) {
      console.warn('Ungültige Anfrage:', request.body);
      return response.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const userId = message.from.id.toString();
    const userText = (message.text || '').toLowerCase().trim();
    console.log(`Nachricht von User ${userId}:`, userText);

    // === Authentifizierung ===
    if (!AUTHORIZED_USERS.includes(userId)) {
      console.warn(`Nicht autorisierter Zugriff von ${userId}`);
      await sendTelegramMessage(chatId, '❌ Unbefugter Zugriff.');
      return response.status(200).json({ ok: true });
    }

    // === Themenerkennung ===
    let botAnswer = "❌ Entschuldigung, ich habe keine Information dazu...";
    const detectedTheme = await detectTheme(userText);
    console.log('Detected theme:', detectedTheme);

    if (companyKnowledge[detectedTheme]) {
      botAnswer = companyKnowledge[detectedTheme];
    } else if (detectedTheme === 'unbekannt') {
      botAnswer = await askDeepSeek(userText);
    } else {
      botAnswer = await askDeepSeek(userText);
    }

    // === Antwort mit Feedback-Buttons ===
    const keyboard = {
      inline_keyboard: [
        [
          { text: '👍 Ja', callback_data: 'yes' },
          { text: '👎 Nein', callback_data: 'no' }
        ]
      ]
    };

    await sendTelegramMessage(chatId, botAnswer, keyboard);

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Fehler im Handler:', error.stack || error);
    try {
      // Versuche, den Benutzer über den Fehler zu informieren
      const { message, callback_query } = request.body || {};
      const chatId = message?.chat?.id || callback_query?.message?.chat?.id;
      if (chatId) {
        await sendTelegramMessage(chatId, '❌ Interner Fehler – bitte später erneut versuchen.');
      }
    } catch (_) {
      // Falls selbst das fehlschlägt, ignorieren
    }
    return response.status(500).json({ error: 'Internal Server Error' });
  }
};
