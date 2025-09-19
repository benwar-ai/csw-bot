const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Firmeninterne Wissensdatenbank
const companyKnowledge = {
  "urlaubsantrag": "📅 Das Urlaubsformular findest du hier: https://intranet.deine-firma.com/urlaub. Denke daran, es mindestens 2 Wochen im Voraus einzureichen.",
  "gehalt": "💶 Die Gehaltsabrechnung wird immer am 25. des Monats versendet. Bei Unstimmigkeiten wende dich bitte an hr@deine-firma.com.",
  "it problem": "🖥️ Bitte erstelle ein Ticket im Helpdesk-System: https://helpdesk.deine-firma.com. Unser IT-Support wird sich innerhalb von 24 Stunden bei dir melden.",
  "büro schlüssel": "🔑 Schlüssel können während der Bürozeiten (Mo-Fr, 8-16 Uhr) bei der Rezeption abgeholt werden.",
  "krankenstand": "🤒 Melde dich bitte am ersten Tag deiner Krankmeldung per Telefon bei deinem Vorgesetzten und fülle anschließend das Formular im Intranet aus."
};

// DeepSeek KI-Funktion
async function askDeepSeek(userQuestion) {
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: userQuestion }],
        max_tokens: 500
      })
    });

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.';
  } catch (error) {
    console.error('Fehler bei Deepseek:', error);
    return 'Es tut mir leid, der KI-Service ist aktuell nicht erreichbar. Bitte versuche es später noch einmal.';
  }
}

// Handler-Funktion
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Nur POST-Anfragen sind erlaubt' });
  }

  try {
    const update = req.body;
    console.log("Update erhalten:", JSON.stringify(update));

    // chat_id aus allen möglichen update-typen extrahieren
    const message = update.message || update.edited_message || update.channel_post;
    if (!message || !message.text) {
      console.log("Kein Text im Update, Ignorieren.");
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.toLowerCase().trim();

    let botAnswer = null;

    // 1. Erst companyKnowledge prüfen (exakte oder teilmatches)
    for (const [keyword, answer] of Object.entries(companyKnowledge)) {
      if (userText.includes(keyword)) {
        botAnswer = answer;
        break;
      }
    }

    // 2. Wenn kein Treffer, KI-Themenzuordnung + fallback
    if (!botAnswer) {
      const themePrompt = `Analysiere die Frage und weise sie einem Thema zu. 
Mögliche Themen: Urlaubsantrag, Gehalt, IT-Problem, Büroschlüssel, Krankenstand.
Gib nur das passende Thema zurück oder 'kein Thema', wenn nichts passt.
Frage: ${userText}`;

      const detectedTheme = await askDeepSeek(themePrompt);

      if (detectedTheme && detectedTheme.toLowerCase() !== 'kein thema' && companyKnowledge[detectedTheme.toLowerCase()]) {
        botAnswer = companyKnowledge[detectedTheme.toLowerCase()];
      } else {
        botAnswer = await askDeepSeek(userText);
      }
    }

    // 3. Antwort an Telegram senden
    console.log("Sende an Telegram:", { chatId, botAnswer });
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const tgResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: botAnswer })
    });

    if (!tgResponse.ok) {
      const errorText = await tgResponse.text();
      console.error("Fehler beim Senden an Telegram:", errorText);
      return res.status(500).json({ error: 'Telegram-Fehler', details: errorText });
    }

    console.log("Antwort erfolgreich gesendet.");
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Unerwarteter Fehler:", err);
    return res.status(500).json({ error: 'Interner Serverfehler', details: err.message });
  }
};
