// netlify/functions/groq-proxy.js
//
// Proxy sederhana ke Groq API (OpenAI-compatible chat completions).
// API key DISIMPAN di Environment Variable Netlify (GROQ_API_KEY), jadi
// gak pernah kelihatan di browser/client-side.
//
// Cara pakai dari frontend (report-agent.html):
//   fetch("/.netlify/functions/groq-proxy", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ system: "...", messages: [...], max_tokens: 1000 })
//   })
//
// Setup di Netlify:
// 1. Generate API key gratis di https://console.groq.com/keys
// 2. Buka dashboard Netlify > Site configuration > Environment variables
// 3. Tambah variable: GROQ_API_KEY = gsk_... (API key dari langkah 1)
// 4. Deploy ulang site (env var baru butuh deploy baru biar ke-pickup)
//
// CATATAN MODEL: "mixtral-8x7b-32768" sudah lama di-deprecate total oleh
// Groq dan tidak bisa dipanggil lagi. Model default di bawah ini
// (openai/gpt-oss-120b) adalah pengganti yang direkomendasikan Groq sendiri
// untuk beban kerja chat umum. Cek https://console.groq.com/docs/models
// kalau sewaktu-waktu model ini juga di-deprecate.

const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "GROQ_API_KEY belum di-set di Environment Variables Netlify"
      })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Body request bukan JSON valid" })
    };
  }

  const { system, messages, max_tokens, model } = payload;

  if (!messages || !Array.isArray(messages)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Field 'messages' wajib ada dan berupa array" })
    };
  }

  // Groq/OpenAI format: system prompt jadi message pertama dengan role "system"
  const groqMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  const groqBody = {
    model: model || GROQ_MODEL,
    messages: groqMessages,
    max_tokens: max_tokens || 1000
  };

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify(groqBody)
    });

    const data = await groqRes.json();

    return {
      statusCode: groqRes.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Gagal menghubungi Groq API: " + e.message })
    };
  }
};
