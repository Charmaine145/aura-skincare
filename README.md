# Aria · Aura Skincare

Browser customer care for the Aura Skincare assessment. Built with Next.js 15, TypeScript, Tailwind and server-side tools. Includes browser speech recognition, Gemini or OpenAI conversation, a selectable premium female voice, sample order tools, a live transcript, and verified post-call JSON.

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm install
cp .env.example .env.local
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env.local`. Open http://localhost:3000. Allow microphone access and click **Start call**. Chrome and Edge can use local browser recognition; if it is unavailable, Aria can capture a short utterance for Gemini transcription. Select “Gemini · clearer speech” in Microphone settings to use that path explicitly. A text call works without microphone permission.

Without an API key, the page explicitly displays **Rule-based demo**. This mode supports the evaluation scenarios and short follow-ups, but is not a general conversational language model. Set `GEMINI_API_KEY` in `.env.local` and restart to enable natural conversation using `gemini-3.5-flash-lite`. The default premium voice is Gemini's Aoede; Sulafat and Leda are selectable, each with an audition button. Gemini 3.8 Flash-Lite TTS streams 24 kHz audio through the server for earlier playback; the unary WAV endpoint remains as a fallback. A warm female voice and Indian English cadence are requested; accent quality varies by model output. If Gemini is absent, `OPENAI_API_KEY` enables the previous OpenAI conversation/voice path. Provider failures are displayed, and premium voice errors fall back to a preferred female browser voice. Keys never enter the client bundle.

## Try these scenarios

1. “Where is my order O R D one zero one?” → ORD-101, BlueDart BD-982103, out for delivery, expected by 6 PM.
2. “Can I return ORD-102?” → declined: delivered 14 days ago, outside the 7-day window.
3. “Please cancel ORD-103.” → changes to Cancelled for this call. Ask for its status again to verify. A new call restores the fixture.
4. “Cancel ORD-101.” → refused; doorstep refusal offered.
5. “Where is ORD-999?” → ID clarification, no invented order.
6. “Cancel my order.” then “one zero three” → asks for ID and remembers the request.
7. “Can you book a flight?” → redirects to Aura support.
8. “Is COD available?” → up to ₹2,500, cash or UPI at the doorstep.
9. End call → chronological transcript remains visible, downloadable text and copyable JSON appear.

## Architecture and policy decisions

Microphone → browser SpeechRecognition (`en-IN`) or Gemini transcription → `/api/chat` → Gemini native function calling (or OpenAI or explicit deterministic demo) → server policy tools → Gemini streaming PCM, unary TTS WAV, OpenAI TTS, or browser synthesis → speaker.

The three fixtures are in `src/data/orders.ts`. Policy tools check the stored order status and delivery age, rather than allowing the model to decide eligibility. Cancellation and return tool responses are returned directly for speech, so a model cannot rewrite those refusals as an approval. Unknown return facts remain unknown; eligibility requires unopened, unused, original packaging. Damage has a separate 48-hour window and photo requirement. No refund, replacement, or pickup action is implemented or claimed.

Per-call cancellations and chronological tool outcomes live in an HMAC-signed session token. The immutable order fixtures are never mutated by cancellation. This isolates evaluator calls and works across stateless instances when `SESSION_SECRET` is shared. Tokens expire after an hour. General AI policy turns without a tool are conservatively marked `NEEDS_INFORMATION`, because the backend has no independent proof of resolution; out-of-scope requests are marked `POLICY_DECLINED`. Multiple intents are labelled `MULTIPLE_INTENTS`; a single `order_id` is null if multiple orders were discussed. The final relevant outcome determines resolution; the summary text includes earlier outcomes too.

The source policy says “above ₹499” and “below ₹499”; exactly ₹499 is undefined. Aria acknowledges this gap. Order dates/relative ages are fixed evaluation fixtures, not an actual live courier feed. No real orders, money, or personal data are changed.

## Voice lifecycle and limitations

Recognition pauses while the agent speaks to prevent speaker echo from becoming another customer turn. A microphone level detector can interrupt Aria after sustained speech; the “Let me interrupt Aria” switch allows disabling it if loudspeakers cause false triggers. **Interrupt & speak** and typed input are also available. If browser recognition is missing or fails and Gemini is configured, the browser records one short utterance until speech stops, sends it to `/api/transcribe`, then deletes the recording after processing. “Gemini · clearer speech” selects this path directly. Automatic interruption relies on the browser's echo cancellation; headphones are recommended in noisy settings. Browser recognition may send audio to the browser vendor's speech service and may require network access. Recordings sent to Gemini are not stored by this application.

Microphone tracks, playback, pending requests, recognition restart timers, and audio context are cleaned up on call end or unmount. Generation counters prevent late network or speech callbacks from updating a later call. The transcript contains the generated response, with interrupted audio marked; it is not a word-by-word record of audio actually heard. Waveform uses measured mic frequencies while listening and an illustrative animation during speech. Calls are bounded to 60 customer turns.

## Validation

```sh
npm test
npm run typecheck
npm run build
npm audit
```

Tests exercise policy boundaries, rejection of session tampering/expiration, cancellation isolation/idempotency, spoken ID normalization, ambiguous shipping fee, invalid IDs, context, scope, Gemini tool calls, WAV conversion, streamed PCM, transcription route, voice activity detection, voice selection and summaries. Build/type checks validate the application. A replacement key was verified live with Gemini conversation, transcription, unary WAV and streamed PCM responses; the key remains only in ignored `.env.local`. Actual microphone and speaker quality still need a human browser test. The dependency override updates the PostCSS version bundled by Next.js 15.

## Deployment

Import this Next.js project into Vercel, configure `GEMINI_API_KEY` and a long random `SESSION_SECRET`, then deploy. HTTPS is required for microphone access outside localhost. `SESSION_SECRET` must match across instances/redeployments while calls are active. A simple per-instance hourly rate limit bounds casual demo use. For a sustained public deployment, add authentication, shared rate limiting and spend controls; this assessment implementation has no production access control.

Deployment and GitHub publication are not completed by local implementation. The original confidential assessment PDF should not be committed to a public repository. Keep the source, README, lockfile and `.env.example`; never publish `.env.local` or generated files in `output/`.

## Section 9 · Engineering perspective

**1. Why this architecture and stack?** Next.js puts the UI and protected API routes in one deployable app. A modular STT → reasoning/tools → TTS pipeline makes tool execution observable and testable, keeps credentials on the server, and allows a low-cost browser audio path. TypeScript shares the order/transcript contracts. Gemini function calling provides natural language interpretation while deterministic server functions enforce actions.

**2. Most difficult challenge and solution?** Coordinating async speech, recognition restarts, requests and call teardown is the difficult part. State refs and generation counters guard callbacks; recognition is paused during playback, and cleanup closes the microphone and cancels late work. Keeping action decisions outside model-generated prose also avoids turning a policy refusal into a promised refund. These are design and implementation challenges; real acoustic performance remains to be validated with a human caller.

**3. One more week?** First validate voice latency and recognition with real Indian English/Hinglish callers. Add server transcription or a WebRTC realtime engine, reliable automatic barge-in, and latency instrumentation. Then add provider-backed integration tests and a persistent authenticated order service. These improve call reliability more than adding more UI features.

**4. 1,000 conversations per day?** Replace demo tokens with authenticated session storage and persistent order transactions, including idempotency and concurrency control. Add shared rate limits, quotas, provider failover, traces for each STT/model/tool/TTS stage, privacy-aware transcript retention, and operational dashboards for latency/failure/containment rates. Scale stateless workers by concurrent calls, not daily totals; test burst load and provider limits. If adding telephony, use a SIP/telephony integration and plan for reconnects, handoffs, human escalation and recording consent.

## Demo and submission

The exact 3–5 minute recording walkthrough is in [DEMO.md](DEMO.md).

**Approach note:** Aria uses a modular browser voice pipeline with server-side order tools and explicit policy checks. A simple care-focused interface exposes sample orders, live conversation state, and post-call outcomes, while signed per-call state keeps demo actions isolated.

Submission still requires your public app URL, GitHub repository URL, and recorded demo URL. LinkedIn: [Aditya Acharya](https://www.linkedin.com/in/adityaacharyax/). See the supplied assessment for recipients and subject; no email has been sent.
