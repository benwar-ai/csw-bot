// API/Telegram Bot für Firmeninterne Fragen
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// HIER KOMMEN DEINE EIGENEN FRAGEN UND ANTWORTEN HIN!
const companyKnowledge = {
  "urlaubsantrag": "📅 Das Urlaubsformular findest du hier: https://intranet.deine-firma.com/urlaub. Denke daran, es mindestens 2 Wochen im Voraus einzureichen.",
  "gehaltsabrechnung": "💶 Die Gehaltsabrechnung wird immer am 25. des Monats versendet. Bei Unstimmigkeiten wende dich bitte an hr@deine-firma.com.",
  "it problem": "🖥️ Bitte erstelle ein Ticket im Helpdesk-System: https://helpdesk.deine-firma.com. Unser IT-Support wird sich innerhalb von 24 Stunden bei dir melden.",
  "büro schlüssel": "🔑 Schlüssel können während der Bürozeiten (Mo-Fr, 8-16 Uhr) bei der Rezeption abgeholt werden.",
  "krankenstand": "🤒 Melde dich bitte am ersten Tag deiner Krankmeldung per Telefon bei deinem Vorgesetzten und fülle anschließend das Formular im Intranet aus."
  // FÜGE HIER WEITERE FRAGEN UND ANTWORTEN EIN!
  // "stichwort": "Deine Antwort hier",
};

// Fragt die Deepseek KI (stabilere Version)
async function askDeepSeek(userQuestion) {
  try {
    console.log("Frage an Deepseek:", userQuestion);
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: userQuestion }],
        max_tokens: 100,
        temperature: 0.1 // Weniger kreativ, mehr faktenbasiert
      })
    });

    // Prüfe erst, ob die Antwort okay ist
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepseek API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Deepseek Antwort:", JSON.stringify(data));

    // EXTRA SICHERE ABFRAGE der Antwort
    if (data && data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      // Bereinige die Antwort: Entferne Zeilenumbrüche und extrahiere nur das Thema
      let cleanAnswer = data.choices[0].message.content.trim();
      // Entferne Anführungszeichen und alles nach dem ersten Zeilenumbruch
      cleanAnswer = cleanAnswer.replace(/["']/g, '').split('\n')[0].split('.')[0].trim();
      return cleanAnswer;
    } else {
      console.error('Unerwartete API-Antwort-Struktur:', JSON.stringify(data));
      return "NEIN";
    }

  } catch (error) {
    console.error('Fehler bei Deepseek:', error.message);
    return "NEIN"; // Wichtig: Im Fehlerfall "NEIN" zurückgeben
  }
}

// Hauptfunktion, die alle Anfragen bearbeitet
module.exports = async function handler(request, response) {
  // Sofort Antwort an Telegram senden, damit kein Timeout entsteht
  response.status(200).json({ ok: true });
  
  if (request.method === 'POST') {
    try {
      const { message } = request.body;

      if (!message || !message.text) {
        console.error('Keine Nachricht oder Text erhalten');
        return;
      }

      const chatId = message.chat.id;
      const userText = message.text.toLowerCase();
      console.log("Empfangene Nachricht:", userText);

      let botAnswer = "❌ Entschuldigung, ich habe keine Information dazu. Bitte wende dich an deinen Vorgesetzten oder das Intranet.";

      // 1. Prüfe zuerst die firmeninternen Daten mit einfachen Stichwörtern
      let foundMatch = false;
      for (const [keyword, answer] of Object.entries(companyKnowledge)) {
        if (userText.includes(keyword)) {
          botAnswer = answer;
          foundMatch = true;
          break;
        }
      }

      // 2. Wenn keine einfache Übereinstimmung, frage die KI nach dem Thema
      if (!foundMatch) {
        const themeCheckPrompt = `
ANWEISUNG: Du bist ein Klassifizierer. Du darfst NUR mit einem der folgenden Themen antworten. Jede andere Antwort ist verboten.

THEMEN zur AUSWAHL:
- urlaubsantrag
- gehaltsabrechnung
- it problem
- büro schlüssel
- krankenstand
- NEIN

Analyse der Frage: "${userText}"

Frage: Welches einzelne Thema aus der Liste passt am besten? Wenn KEIN Thema passt, antworte "NEIN".

Antwort (NUR das Thema oder "NEIN"):
`;

        const detectedTheme = await askDeepSeek(themeCheckPrompt);
        console.log("Erkanntes Thema:", detectedTheme);

        // Wenn ein Thema erkannt wurde, gib die passende Antwort aus companyKnowledge
        if (detectedTheme !== "NEIN" && companyKnowledge[detectedTheme]) {
          botAnswer = companyKnowledge[detectedTheme];
        } else {
          // 3. Wenn keine passende Antwort gefunden wurde, frage die KI generell
          botAnswer = await askDeepSeek(userText);
        }
      }

      // 4. Sende die Antwort zurück an Telegram
      console.log("Sende Antwort an Telegram:", botAnswer);
      await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: botAnswer
        }),
      });

    } catch (error) {
      console.error('Allgemeiner Fehler im Handler:', error);
      // Versuche zumindest eine Fehlermeldung an Telegram zu senden
      try {
        await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: "⚠️ Es ist ein technischer Fehler aufgetreten. Bitte versuche es später noch einmal."
          }),
        });
      } catch (telegramError) {
        console.error('Konnte nicht einmal Fehler an Telegram senden:', telegramError);
      }
    }
  } else {
    console.error('Nicht-POST-Anfrage erhalten');
  }
};
