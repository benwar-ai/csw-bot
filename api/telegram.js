// api/telegram.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const update = req.body;

    // Fange Updates ohne Nachricht oder Text ab
    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      console.log('Kein Text im Update, Ignorieren:', update);
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim().toLowerCase();

    const companyKnowledge = {
      urlaubsantrag: '📅 Urlaubsformular: https://intranet.deine-firma.com/urlaub',
      gehalt: '💶 Gehaltsabrechnung immer am 25.',
      'it problem': '🖥️ Ticket im Helpdesk-System erstellen.',
      'büro schlüssel': '🔑 Schlüssel während Bürozeiten an der Rezeption.',
      krankenstand: '🤒 Am ersten Tag telefonisch krankmelden.',
    };

    let botAnswer = '❌ Entschuldigung, ich habe keine Information dazu.';
    for (const [keyword, answer] of Object.entries(companyKnowledge)) {
      if (userText.includes(keyword)) {
        botAnswer = answer;
        break;
      }
    }

    if (botAnswer.includes('keine Information')) {
      botAnswer = `Du hast gesagt: "${message.text}".`;
    }

    const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_TOKEN) {
      console.error('Fehlender TELEGRAM_BOT_TOKEN!');
      return res.status(500).json({ error: 'Fehlender Bot-Token' });
    }


console.log("Sende an Telegram:", {
  chatId,
  botAnswer,
  url: `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`
});
    
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const tgResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: botAnswer }),
    });

    if (!tgResponse.ok) {
      const errorText = await tgResponse.text();
      console.error('Fehler beim Senden an Telegram:', errorText);
      return res.status(500).json({ error: 'Telegram-Fehler', details: errorText });
    }

    console.log('Antwort erfolgreich gesendet.');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Unerwarteter Fehler:', err);
    return res.status(500).json({ error: 'Interner Serverfehler', details: err.message });
  }
}

