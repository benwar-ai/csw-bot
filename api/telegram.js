// API/Telegram Bot für Firmeninterne Fragen
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// HIER KOMMEN DEINE EIGENEN FRAGEN UND ANTWORTEN HIN!
const companyKnowledge = {
  "urlaubsantrag": "📅 Das Urlaubsformular findest du hier: https://intranet.deine-firma.com/urlaub. Denke daran, es mindestens 2 Wochen im Voraus einzureichen.",
  "gehalt": "💶 Die Gehaltsabrechnung wird immer am 25. des Monats versendet. Bei Unstimmigkeiten wende dich bitte an hr@deine-firma.com.",
  "it problem": "🖥️ Bitte erstelle ein Ticket im Helpdesk-System: https://helpdesk.deine-firma.com. Unser IT-Support wird sich innerhalb von 24 Stunden bei dir melden.",
  "büro schlüssel": "🔑 Schlüssel können während der Bürozeiten (Mo-Fr, 8-16 Uhr) bei der Rezeption abgeholt werden.",
  "krankenstand": "🤒 Melde dich bitte am ersten Tag deiner Krankmeldung per Telefon bei deinem Vorgesetzten und fülle anschließend das Formular im Intranet aus."
  // FÜGE HIER WEITERE FRAGEN UND ANTWORTEN EIN!
  // "stichwort": "Deine Antwort hier",
};

// Fragt die Deepseek KI
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

// Hauptfunktion, die alle Anfragen bearbeitet
module.exports = async function handler(request, response) {
  if (request.method === 'POST') {
    try {
      const { message } = request.body;

      if (!message || !message.text) {
        return response.status(400).json({ error: 'Ungültige Anfrage' });
      }

      const chatId = message.chat.id;
      const userText = message.text.toLowerCase();

      // 1. Prüfe zuerst die firmeninternen Daten
      let botAnswer = "❌ Entschuldigung, ich habe keine Information dazu. Bitte wende dich an deinen Vorgesetzten oder das Intranet.";

      for (const [keyword, answer] of Object.entries(companyKnowledge)) {
        if (userText.includes(keyword)) {
          botAnswer = answer;
          break;
        }
      }

      // 2. Wenn keine passende Antwort gefunden wurde, frage die KI
      if (botAnswer.includes("keine Information")) {
        botAnswer = await askDeepSeek(userText);
      }

      // 3. Sende die Antwort zurück an Telegram
      await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: botAnswer
        }),
      });

      return response.status(200).json({ ok: true });

    } catch (error) {
      console.error('Allgemeiner Fehler:', error);
      return response.status(500).json({ error: 'Ein internes Problem ist aufgetreten.' });
    }
  } else {
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ error: 'Nur POST-Anfragen sind erlaubt' });
  }
};
