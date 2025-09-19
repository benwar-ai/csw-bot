const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Firmeninterne Wissensdatenbank
const companyKnowledge = {
  "urlaubsantrag": "📅 Das Urlaubsformular findest du hier: https://intranet.deine-firma.com/urlaub. Denke daran, es mindestens 2 Wochen im Voraus einzureichen.",
  "gehalt": "💶 Die Gehaltsabrechnung wird immer am 25. des Monats versendet. Bei Unstimmigkeiten wende dich bitte an hr@deine-firma.com.",
  "it problem": "🖥️ Bitte erstelle ein Ticket im Helpdesk-System: https://helpdesk.deine-firma.com. Unser IT-Support wird sich innerhalb von 24 Stunden bei dir melden.",
  "büro schlüssel": "🔑 Schlüssel können während der Bürozeiten (Mo-Fr, 8-16 Uhr) bei der Rezeption abgeholt werden.",
  "krankenstand": "🤒 Melde dich bitte am ersten Tag deiner Krankmeldung per Telefon bei deinem Vorgesetzten und fülle anschließend das Formular im Intranet aus.",
  "persönliche dokumente": "📄 Du kannst persönliche Unterlagen (Gehaltsabrechnung, Arbeitsvertrag, Zertifikate, Führungszeugnis) hier anfordern: https://forms.office.com/e/LMhj6ekeqE. Nach Abschluss erhältst du die Dokumente automatisch per E-Mail.",
  "allgemeine dokumente": "📑 Allgemeine Unterlagen wie Newsletter, Sicherheitsunterweisungen oder Personalfragebogen kannst du hier anfordern: https://forms.office.com/e/qmAd9qH5uc. Die Dokumente werden automatisch per E-Mail versendet.",
  "mitarbeitergespräch": "🗓️ Termine für Mitarbeitergespräche kannst du hier anfragen: https://forms.office.com/e/7jhGkZrg4w. Die zuständige Person wird die Terminvereinbarung zeitnah bearbeiten.",
  "neue arbeitszeit": "⏰ Änderungswünsche zur Arbeitszeit kannst du hier einreichen: https://forms.office.com/e/7jhGkZrg4w. Die zuständige Person prüft und beantwortet deine Anfrage.",
  "verbesserungsvorschläge": "💡 Verbesserungsvorschläge oder Fehler im Arbeitsalltag kannst du hier melden: https://forms.office.com/e/W4F7YyYKgA. Die zuständige Person wird informiert.",
  "personaldaten aktualisieren": "🏠 Änderungen deiner persönlichen Daten (z. B. Bankverbindung, Anschrift) kannst du hier mitteilen: https://forms.office.com/e/DpJtsR6NBu. Die Änderung wird bestätigt.",
  "unterlagen hochladen": "📤 Eigene Dokumente kannst du hier in die CSW-Ablage hochladen: https://cswneuwied-my.sharepoint.com/:f:/g/personal/benjamin_warkentin_csw-neuwied_de/Ev97VxpvqwdJn2QRv92JhrMBjE7atudGF209EeIswWOKBQ?e=Lb53cU. Nach dem Upload erhältst du eine Bestätigungs-E-Mail."
};

// DeepSeek KI-Funktion (robust)
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

    if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content || 'Entschuldigung, ich konnte keine Antwort generieren.';
    } else {
      console.warn('DeepSeek hat kein gültiges Ergebnis geliefert:', data);
      return 'Entschuldigung, ich konnte keine Antwort generieren.';
    }

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

    const message = update.message || update.edited_message || update.channel_post;
    if (!message || !message.text) {
      console.log("Kein Text im Update, Ignorieren.");
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.toLowerCase().trim();

    let botAnswer = null;

    // 1. companyKnowledge zuerst prüfen
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


