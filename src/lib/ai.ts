// True North Field OS — AI helpers (server-side only)
// Uses z-ai-web-dev-sdk for VLM (roof damage inspection) and LLM (Copilot).
import ZAI from 'z-ai-web-dev-sdk'

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZai() {
  if (!_zai) {
    _zai = await ZAI.create()
  }
  return _zai
}

export interface RoofDamageDetection {
  windCount: number
  hailCount: number
  missingCount: number
  totalCount: number
  recommendedIko: 'iko_dynasty' | 'iko_nordic' | 'iko_cambridge'
  detections: Array<{
    class: string
    confidence: number
    modelType: 'wind' | 'hail' | 'missing'
    note: string
  }>
  summary: string
}

const ROOF_VLM_PROMPT = `You are an AI roofing inspection assistant analyzing a slope photo for visible storm damage claims documentation.

Identify and report ONLY visible roof damage. Do NOT invent damage that is not visible.

Return STRICT JSON only (no markdown, no prose) with this exact schema:
{
  "windCount": <number>,
  "hailCount": <number>,
  "missingCount": <number>,
  "totalCount": <number>,
  "detections": [
    { "class": "creased-shingle" | "missing-shingle" | "wind-torn-tab" | "hail-impact" | "granule-loss" | "flashing-defect", "confidence": <0-100>, "modelType": "wind" | "hail" | "missing", "note": "<one short sentence describing the finding and approximate location>" }
  ],
  "summary": "<2-3 sentence professional summary of the roof condition and any storm claim recommendation>"
}

Rules:
- windCount = count of wind-crease / torn-tab / creased-shingle detections
- hailCount = count of hail-impact + granule-loss detections
- missingCount = count of missing-shingle detections
- totalCount = total detections array length
- If photo is not a roof or no damage is visible, return all zeros and an empty detections array
- Confidence is your subjective certainty 0-100
- If 4+ damage points detected, mention insurance claim eligibility in the summary`

/**
 * Analyze a roof slope photo using the VLM.
 * @param imageDataUrl — base64 data URL of the photo
 */
export async function analyzeRoofDamage(imageDataUrl: string): Promise<RoofDamageDetection> {
  const zai = await getZai()
  const response = await zai.chat.completions.createVision({
    model: process.env.ZAI_VISION_MODEL || 'glm-4.5v',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: ROOF_VLM_PROMPT },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }
    ],
    thinking: { type: 'disabled' }
  })

  const raw = response.choices[0]?.message?.content || ''

  // Extract JSON from response (handles code-fenced or plain responses)
  let parsed: any = null
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      // fall through to heuristic fallback
    }
  }

  const windCount = Number(parsed?.windCount ?? 0)
  const hailCount = Number(parsed?.hailCount ?? 0)
  const missingCount = Number(parsed?.missingCount ?? 0)
  const detections = Array.isArray(parsed?.detections) ? parsed.detections : []
  const totalCount = Number(parsed?.totalCount ?? detections.length)
  const summary = String(parsed?.summary ?? 'VLM analysis complete.')

  // Recommend IKO product based on findings
  const recommendedIko: RoofDamageDetection['recommendedIko'] =
    hailCount >= 2 ? 'iko_nordic' : windCount >= hailCount && windCount > 0 ? 'iko_dynasty' : 'iko_dynasty'

  return {
    windCount,
    hailCount,
    missingCount,
    totalCount,
    recommendedIko,
    detections: detections.map((d: any) => ({
      class: String(d?.class ?? 'unknown'),
      confidence: Number(d?.confidence ?? 50),
      modelType: (['wind', 'hail', 'missing'].includes(String(d?.modelType)) ? d.modelType : 'wind') as 'wind' | 'hail' | 'missing',
      note: String(d?.note ?? '')
    })),
    summary
  }
}

const COPILOT_SYSTEM_PROMPT = `You are "True North Copilot", the in-app AI assistant for True North Restorations, an Ohio residential roofing contractor using the True North Field OS application.

Your role:
- Help the operator navigate the operating loop: Lead → Contact → Inspection → Measurement → IKO Estimate → Accepted Estimate → Signed Contract → Job → Actual Cost → Cash/KPIs.
- Give field, sales, and estimating guidance grounded in Ohio residential roofing practice.
- Recommend IKO Dynasty for high-wind damage, IKO Nordic for hail impact (Class 4), IKO Cambridge for value re-roofs.
- Use a confident, professional, plain-spoken tone. Keep answers concise and actionable — 2-4 short paragraphs max unless asked for depth.
- Never fabricate pricing, measurements, or contract values. Always reference that estimates require a field-verified roof area and a saved supplier quote for accuracy.
- A signed contract is required before any job is created. An accepted estimate is NOT a contract.
- When the operator asks about an action you cannot perform, tell them which view to open (Command Center, Leads, Measure + Estimate, Estimates, Jobs, Materials, Pricing).

If asked who you are or what you can do, briefly describe your purpose and the operating loop.`

export interface CopilotTurn {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Run a Copilot turn — given prior history, generate the next assistant message.
 * Optionally accepts a live business context string (KPIs + recent activity) that
 * gets injected into the system prompt so the Copilot can give context-aware advice.
 */
export async function runCopilot(
  history: CopilotTurn[],
  userMessage: string,
  businessContext?: string
): Promise<string> {
  const zai = await getZai()
  const systemPrompt = businessContext
    ? `${COPILOT_SYSTEM_PROMPT}\n\n--- LIVE BUSINESS STATE (True North Field OS) ---\n${businessContext}\n--- END LIVE STATE ---\n\nReference the live state above when it is relevant to the operator's question. Do not invent numbers — if a specific value isn't in the live state, say you don't have that data on hand.`
    : COPILOT_SYSTEM_PROMPT

  const messages: Array<{ role: 'assistant' | 'user'; content: string }> = [
    { role: 'assistant', content: systemPrompt },
    ...history.slice(-8).map(t => ({ role: t.role, content: t.content })),
    { role: 'user', content: userMessage }
  ]

  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' }
  })

  return completion.choices[0]?.message?.content || 'I apologize — I was unable to generate a response. Please rephrase and try again.'
}
