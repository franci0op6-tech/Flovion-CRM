export async function sendTelegramNotification(message: string, chatId: string) {
  const token = "8703823121:AAHnZc5o7avHKYKcoAlo9l16AAb4F3yiphg";
  
  // Misura di sicurezza: se l'utente non ha impostato Telegram, fermati
  if (!chatId) {
    console.log("Nessun Telegram Chat ID collegato a questo utente.");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  console.log(`--- TENTATIVO INVIO TELEGRAM A ${chatId} ---`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
    
    const data = await res.json();
    console.log("RISPOSTA TELEGRAM:", data);
  } catch (error) {
    console.error("Errore di Rete:", error);
  }
}