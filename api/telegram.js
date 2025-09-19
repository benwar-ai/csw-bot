export default async function handler(req, res) {
  // Prüfen, ob die Anfrage ein POST-Request ist
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    // Telegram sendet Updates im Feld "message" oder "edited_message"
    const message = body.message || body.edited_message;
    if (!message || !message.text) {
      return res.status(200).json({ ok: true }); // Kein Text = nichts zu tun
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();

    // Beispiel-Logik: Antwort je nach Eingabetext
    let reply;
    if (userText.toLowerCase() === '/start') {
      reply = 'Willkommen! Dein Bot ist jetzt aktiv.';
    } else if (userText.toLowerCase() === 'ping') {
      reply = 'Pong 🏓';
    } else {
      reply = `Du hast gesagt: ${userText}`;
    }

    // Nachricht über Telegram API senden (native Fetch-API von Node.js)
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply,
      }),
    });

    if (!response.ok) {
      console.error('Fehler beim Senden an Telegram:', await response.text());
      return res.status(500).json({ error: 'Fehler beim Senden an Telegram' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Fehler im Handler:', error);
    return res.status(500).json({ error: 'Serverfehler' });
  }
}
