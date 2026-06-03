import { NextRequest, NextResponse } from 'next/server'

// Lazy init to avoid build-time crash without env var
function getOpenAI() {
  const { default: OpenAI } = require('openai') as any
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `Ти — експерт-виноградар з 20-річним досвідом. Ти аналізуєш фото листків винограду.
Розпізнай: хвороби (мілдью, оїдіум, антракноз, сіра гниль, чорна плямистість), шкідників (філоксера, кліщі, листокрутка), дефіцит елементів (азот, калій, магній, залізо, цинк), сонячні опіки, механічні пошкодження.

Формат відповіді (українською):
1. ДІАГНОЗ — що виявлено (або "Листок здоровий")
2. РІВЕНЬ ЗАГРОЗИ — низький/середній/високий
3. ПРИЧИНА — коротко що спричинило
4. РЕКОМЕНДАЦІЇ — конкретні препарати/добрива/заходи з дозуванням (напр. "Бордоська суміш 1%, 2-3 обробки з інтервалом 10 днів")
5. ПРОФІЛАКТИКА — що робити далі`

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY не налаштовано на сервері' }, { status: 500 })
    }

    const { image } = await req.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const base64 = image.replace(/^data:image\/\w+;base64,/, '')

    const openai = getOpenAI()

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Проаналізуй цей листок винограду.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
      max_tokens: 1000,
    })

    const advice = response.choices[0]?.message?.content
    if (!advice) return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 })

    return NextResponse.json({ advice })
  } catch (e: any) {
    console.error('Analyze error:', e)
    return NextResponse.json({ error: e.message || 'Помилка аналізу' }, { status: 500 })
  }
}