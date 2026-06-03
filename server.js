import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const app = express();
const upload = multer({ dest: uploadsDir });

app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));

// Analysis endpoint — receives image, sends to AI
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    const imagePath = req.file.path;
    const imageBuffer = readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';

    const analysis = await analyzeLeafWithAI(base64, mimeType);
    
    res.json({ 
      success: true, 
      analysis,
      id: uuidv4()
    });
  } catch (err) {
    console.error('Analysis error:', err);
    res.json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// AI analysis — uses the available vision model via HTTP
async function analyzeLeafWithAI(base64Image, mimeType) {
  // Try Claude/OpenAI-compatible API if ANTHROPIC_API_KEY or OPENAI_API_KEY is set
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  const prompt = `You are an expert PhD-level viticulture agronomist. Analyze this grape (vine) leaf photo and provide a professional diagnosis and care recommendation.

RESPOND IN UKRAINIAN language. Structure your response exactly as follows:

## Діагноз
[Identify the condition — disease name (both Ukrainian and Latin), pest, nutrient deficiency, or "Здоровий листок"]

## Симптоми
[Describe visible symptoms in detail from the leaf]

## Ступінь ураження
[Легкий / Середній / Важкий]

## Рекомендації по догляду
[Step-by-step care plan: treatment, prevention, schedule, products if applicable]

## Прогноз
[What to expect if treated vs untreated]`;

  if (anthropicKey) {
    return await callClaude(base64Image, mimeType, prompt, anthropicKey);
  } else if (openaiKey) {
    return await callOpenAI(base64Image, mimeType, prompt, openaiKey);
  } else {
    // Fallback: simulate analysis for MVP demo
    return `## Діагноз
*Аналіз надіслано. Для повноцінної AI-діагностики потрібен API-ключ (ANTHROPIC_API_KEY або OPENAI_API_KEY).*

## Що далі
Отримайте API-ключ Claude (anthropic.com) або GPT-4o (platform.openai.com) та встановіть змінну середовища. Після цього застосунок почне давати реальні професійні діагнози.

Наразі ваш листок закешовано — я покажу демо-режим:
- 🍇 Виявлено: можливі ознаки мілдью (Plasmopara viticola) — жовті маслянисті плями на верхній стороні листка
- ⚠️ Ступінь: легкий
- 💊 Рекомендація: обприскування бордоською рідиною 1%, видалення уражених листків`;
  }
}

async function callClaude(base64, mimeType, prompt, apiKey) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }
        ]
      }]
    })
  });
  const data = await resp.json();
  return data.content?.[0]?.text || JSON.stringify(data);
}

async function callOpenAI(base64, mimeType, prompt, apiKey) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
        ]
      }]
    })
  });
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || JSON.stringify(data);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍇 Grape Scanner running on http://0.0.0.0:${PORT}`);
});