// api/telegram.js

export default async function handler(req, res) {
  // Nur POST-Anfragen akzeptieren (Telegram Webhook sendet POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body;

    // Telegram schickt Updates in "message" oder "edited_message"
    const message = body.message || body.edited_message;
    if (!message || !message.text) {
      // Keine relevante Nachricht – trotzdem 200 OK zurückgeben
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim().toLowerCase();

    // Einfache vordefinierte Antworten (kannst du später erweitern)
    const companyKnowledge = {
      urlaubsantrag: '📅 Das Urlaubsformular findest du hier: https://intranet.deine-firma.com/urlaub',
      gehalt: '💶 Die Gehaltsabrechnung wird immer am 25. des Monats erstellt.',
      'it problem': '🖥️ Bitte erstelle ein Ticket im Helpdesk-System.',
      'büro schlüssel': '🔑 Schlüssel können während der Bürozeiten an der Rezeption abgeholt werden.',
      krankenstand: '🤒 Melde dich bitte am ersten Tag telefonisch bei deiner Führungskraft.',
    };

    let botAnswer = '❌ Entschuldigung, ich habe keine Information dazu.';

    // Suche nach einem Keyword in der vordefinierten Liste
    for (const [keyword, answer] of Object.entries(companyKnowledge)) {
      if (userText.includes(keyword)) {
        botAnswer = answer;
        break;
      }
    }

    // Fallback-Antwort, wenn kein Keyword gefunden wurde
    if (botAnswer.includes('keine Information')) {
      botAnswer = `Du hast gesagt: "${message.text}". (Hier könntest du später DeepSeek integrieren)`;
    }

    // Telegram API-Aufruf zum Senden der Antwort
    const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // In Vercel unter Environment Variables setzen
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: botAnswer,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fehler beim Senden an Telegram:', errorText);
      return res.status(500).json({ error: 'Fehler beim Senden an Telegram', details: errorText });
    }

    // Erfolgsmeldung an Telegram/Vercel zurückgeben
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Fehler im Handler:', error);
    return res.status(500).json({ error: 'Interner Serverfehler', details: error.message });
  }
}
