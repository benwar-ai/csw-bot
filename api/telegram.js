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

// ... (der Rest des Codes bleibt gleich) ...

// 1. Prüfe, ob die Frage auf ein bekanntes Thema abzielt (KI-gestützt)
let botAnswer = "❌ Entschuldigung, ich habe keine Information dazu. Bitte wende dich an deinen Vorgesetzten.";

// Erstelle einen Prompt für die KI, der die bekannten Themen beschreibt
const themeCheckPrompt = `
Der Nutzer hat eine Frage gestellt. Ich habe eine Wissensdatenbank mit diesen Themen:
THEMENLISTE:
- Urlaubsantrag: Beantragung von Urlaub, Formulare, Verfahren
- Gehaltsabrechnung: Lohn, Gehalt, Abrechnung, Payslip
- IT-Problem: Computer, Software, Login, Technik, Helpdesk
- Büroschlüssel: Schlüssel, Zugang, Büro, Raum
- Krankenstand: Krankmeldung, Krank, Fehlzeit

ANALYSIERE die folgende Frage. Antworte NUR mit dem genauen Thema aus der THEMENLISTE (z.B. "Urlaubsantrag"), das am besten passt. Wenn KEINES passt, antworte "NEIN".

FRAGE: ${userText}

ANTWORT:
`;

// Frage die KI, welches Thema gemeint ist
const detectedTheme = await askDeepSeek(themeCheckPrompt);

// Wenn ein Thema erkannt wurde, gib die passende Antwort aus companyKnowledge
if (detectedTheme !== "NEIN" && companyKnowledge[detectedTheme]) {
  botAnswer = companyKnowledge[detectedTheme];
} else {
  // 2. Wenn keine passende Antwort gefunden wurde, frage die KI generell
  botAnswer = await askDeepSeek(userText);
}

// ... (der Rest des Codes bleibt gleich) ...

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

