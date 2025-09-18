// api/telegram.js
const fs = require('fs').promises;
const fetch = require('node-fetch');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const AUTHORIZED_USERS = (process.env.AUTHORIZED_USERS || '').split(',').map(u => u.trim());

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

// Logging unbekannter Fragen
async function logUnknownQuestion(question) {
  try {
    const file = './unknown_questions.json';
    let existing = [];
    try {
      const content = await fs.readFile(file, 'utf8');
      existing = JSON.parse(content);
    } catch (_) {
      existing = [];
    }
    existing.push({ question, timestamp: new Date().toISOString() });
    await fs.writeFile(file, JSON.stringify(existing, null, 2));
  } catch (err) {
    console.error('Logging failed:', err);
  }
}

module.exports = async function handler(request, response) {
  if (request.method === 'POST') {
    try {
      const { message, callback_query } = request.body;

      // 1. Feedback-Antworten verarbeiten
      if (callback_query) {
        const chatId = callback_query.message.chat.id;
        const feedback = callback_query.data;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: feedback === 'yes'
              ? '✅ Danke für dein Feedback!'
              : '❌ Danke für dein Feedback, wir werden die Antwort verbessern.'
          }),
        });
        return response.status(200).json({ ok: true });
      }

      const chatId = message.chat.id;
      const userId = message.from.id.toString();
      const userText = message.text.toLowerCase();

      // 2. Authentifizierung prüfen
      if (!AUTHORIZED_USERS.includes(userId)) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: '❌ Unbefugter Zugriff.' }),
        });
        return response.status(200).json({ ok: true });
      }

      // 3. KI-gestützte Themenerkennung
      let botAnswer = "❌ Entschuldigung, ich habe keine Information dazu...";
      const detectedTheme = await detectTheme(userText);

      if (companyKnowledge[detectedTheme]) {
        botAnswer = companyKnowledge[detectedTheme];
      } else if (detectedTheme === 'unbekannt') {
        await logUnknownQuestion(userText);
        botAnswer = await askDeepSeek(userText);
      } else {
        // Falls KI ein falsches Wort liefert, trotzdem Fallback
        botAnswer = await askDeepSeek(userText);
      }

      // 4. Antwort mit Feedback-Buttons senden
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: botAnswer,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '👍 Ja', callback_data: 'yes' },
                { text: '👎 Nein', callback_data: 'no' }
              ]
            ]
          }
        }),
      });

      return response.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error in handler:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }
};
