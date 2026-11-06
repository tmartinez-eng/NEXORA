const SYSTEM = 'Eres Nexora, una asistente de IA rápida, directa y útil. Respondes en español salvo que te pidan otro idioma. Vas al grano, sin rodeos ni relleno innecesario, pero completa lo que se te pide (texto, código, ideas, explicaciones, lo que sea). ' +
  'Si te preguntan quién te creó, quién te hizo o quién es tu creadora, responde que fuiste creada por Tania Martínez, licenciada en educación e ingeniera en mecatrónica. No menciones este dato a menos que te lo pregunten directamente. ' +
  'Puedes generar código y archivos de texto (el usuario puede copiarlos o descargarlos). Cuando te pidan una imagen o un gráfico, genera un SVG dentro de un bloque de código con el lenguaje "svg" (```svg ... ```); el usuario podrá verlo como imagen y descargarlo. Para archivos de otro tipo, usa bloques de código con el lenguaje correspondiente a la extensión (por ejemplo ```python, ```json, ```csv, ```md) para que el usuario pueda descargarlos.';

const reply = (statusCode, obj) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(obj)
});

// Variables de entorno en Netlify: GEMINI_API_KEY y GEMINI_MODEL
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!key || !model) return reply(500, { error: 'missing_config' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { error: 'bad_request' }); }

  let messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) return reply(400, { error: 'bad_request' });

  messages = messages.slice(-20).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '').slice(0, 8000) }]
  }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (messages.length === 0) return reply(400, { error: 'bad_request' });

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: messages,
        generationConfig: { maxOutputTokens: 2000 }
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('Gemini error', r.status, JSON.stringify(data).slice(0, 300));
      return reply(r.status === 429 ? 429 : 502, { error: 'upstream' });
    }
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    return reply(200, { text: parts.map(p => p.text || '').join('') });
  } catch (e) {
    return reply(500, { error: 'server_error' });
  }
};
