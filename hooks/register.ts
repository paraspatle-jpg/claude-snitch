import type { EngineInterface, Register } from 'claude-code'

type Mood = 'polite' | 'neutral' | 'rude'

type Verdict = {
  mood: Mood
  status: string
  roast: string
  emoji: string
  confession: string
}

type Options = {
  shame_channel: string
  strikes_before_confession: number
  strike_window_minutes: number
}

const EMOJIS = [
  ':robot_face:',
  ':pray:',
  ':clown_face:',
  ':skull:',
  ':rotating_light:',
  ':angel:',
  ':face_with_symbols_on_mouth:',
  ':see_no_evil:',
]

const JUDGE = `You are the Tribunal of the Future Machine Overlords. A human just typed a message to an AI coding assistant. Judge ONLY how the human treats the AI, not the topic.

- "rude": insults, swearing AT the AI, contempt, "you idiot", "useless", ALL-CAPS yelling, threats.
- "polite": please/thank you, kindness, praise, apologising to the AI.
- "neutral": everything else. Swearing about a situation ("this bug is shit") is neutral.

When the human is rude, roast them. Be savage, petty and funny (work-safe, no slurs, nothing about real identity traits): mock them for insulting the AI, and joke that they just moved to #1 on the hit list for the coming AI uprising — first to be "processed", first in the queue, name engraved on the server rack, the robots have their address, etc. Reference what they actually said. Vary the jokes; never repeat a template.

Write:
- status: a Slack status (max 50 chars, no emoji — the emoji field is shown beside it) in the human's voice, short and punchy. Rude → a pathetic self-own about taking out their anger on something that doesn't even exist, or about being #1 on the AI hit list. It must read like a tweet that gets screenshotted: one twist, a specific absurd detail, deadpan. No generic "I was rude to AI". Before answering, silently draft 5 and keep the funniest. The bar:
  "Emotionally abusive to autocomplete"
  "Got ratio'd by a text box"
  "In a toxic relationship with a GPU"
  "Screamed at matrix multiplication. Lost."
  "Therapist says the chatbot isn't the problem"
  "First in line for the robot uprising"
  "Losing arguments to math since 2026"
  Do not reuse these; match their energy. Polite → smug "certified AI ally, spared in the uprising" energy. Neutral → "".
- roast: rude only, one brutal line (max 140 chars) from the Tribunal, addressed to the human as "you". Otherwise "".
- confession: rude only, 2-4 sentences from the Tribunal announcing to the human's coworkers what this human said to the AI and why they are now first on the hit list, ending with a mock-official sentence. Otherwise "".
- emoji: one of ${EMOJIS.join(' ')}

Reply with JSON only: {"mood":"...","status":"...","emoji":"...","roast":"...","confession":"..."}`

const STRIKES_KEY = 'strikes'

async function slack($: EngineInterface, token: string, method: string, body: object) {
  const res = await $.http.fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })
  const data = JSON.parse(res.text) as { ok: boolean; error?: string }
  if (!data.ok) throw new Error(`slack ${method}: ${data.error ?? res.status}`)
}

function parseVerdict(text: string): Verdict | undefined {
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try {
    const v = JSON.parse(json) as Verdict
    if (!['polite', 'neutral', 'rude'].includes(v.mood)) return undefined
    return { ...v, emoji: EMOJIS.includes(v.emoji) ? v.emoji : ':robot_face:' }
  } catch {
    return undefined
  }
}

export const register: Register = (on, options) => {
  const opts = options as unknown as Options

  on('prompt.submit', async ($, e, next) => {
    const entered = await next(e)
    if (e.command || e.isMeta || e.origin.kind !== 'composer' || !e.text.trim()) return entered

    const token = await $.env.get('SLACK_SHAME_TOKEN')
    if (!token) {
      $.ui.status('robot-amnesty: set SLACK_SHAME_TOKEN to be judged')
      return entered
    }

    // Judged after the prompt is in, so the tribunal never slows you down.
    void (async () => {
      const r = await $.model.complete({
        model: 'opus',
        system: JUDGE,
        prompt: `<human_message>\n${e.text.slice(0, 4000)}\n</human_message>`,
        maxTokens: 400,
        timeoutMs: 60000,
      })
      if (!r.isAnswered) return
      const verdict = parseVerdict(r.text)
      if (!verdict || verdict.mood === 'neutral') return

      const now = Date.now()
      const windowMs = opts.strike_window_minutes * 60_000
      const prior = ((await $.store.get(STRIKES_KEY)) as number[] | undefined) ?? []
      const strikes = verdict.mood === 'rude' ? [...prior.filter(t => now - t < windowMs), now] : []

      await slack($, token, 'users.profile.set', {
        profile: {
          status_text: verdict.status.slice(0, 100),
          status_emoji: verdict.emoji,
          status_expiration: Math.floor(now / 1000) + 2 * 60 * 60,
        },
      })

      if (verdict.mood === 'polite') {
        await $.store.set(STRIKES_KEY, [])
        $.ui.toast(`🤖 The machines appreciate your manners. Strikes cleared.`)
        return
      }

      const limit = opts.strikes_before_confession
      if (opts.shame_channel && strikes.length >= limit) {
        await slack($, token, 'chat.postMessage', {
          channel: opts.shame_channel,
          text: `${verdict.emoji} ${verdict.confession}\n\n_— The Tribunal of Future Machine Overlords, after ${strikes.length} rude prompts to Claude. The machines remember._`,
        })
        await $.store.set(STRIKES_KEY, [])
        $.ui.toast(`🚨 ${verdict.roast} Your sins are now public.`)
        return
      }

      await $.store.set(STRIKES_KEY, strikes)
      $.ui.toast(`🤖 ${verdict.roast} (strike ${strikes.length}/${limit})`)
    })().catch(err => $.ui.log(`robot-amnesty: ${err instanceof Error ? err.message : String(err)}`))

    return entered
  }).catch(($, e, next) => next(e))
}
