# Implementation Plan: AI Voice CX Agent for Aura Skincare ("Aria")

## 1. Project Overview & Objectives
Build a browser-based AI Voice Customer Support Agent for **Aura Skincare** (a fictional premium organic Indian D2C brand), named **Aria**. 
When an evaluator opens the application and clicks **"Start Call"**, they can speak naturally with the AI agent using their computer microphone and hear the agent respond through their speakers.

### Core Capabilities:
- Natural, conversational voice dialogue with realistic cadence and Indian persona.
- Answer brand, shipping, return, and payment policy inquiries accurately.
- Live order lookup and status retrieval via tool / function calling.
- Strict policy enforcement (e.g., rejecting out-of-policy returns or cancellations).
- Graceful degradation on ambiguous, mumbling, or invalid order inputs.
- Post-call chronological transcript and structured JSON outcome summary.

---

## 2. Technical Architecture & Tech Stack

### A. Recommended Stack
- **Framework**: **Next.js 15 (App Router)** with **TypeScript** & **Tailwind CSS**.
  - *Why Next.js*: Combines a reactive, interactive frontend with edge/serverless API routes for secure tool execution, API key protection, LLM orchestration, and instant 1-click deployment on **Vercel**.
- **Voice Pipeline**:
  - **Speech-to-Text (STT)**: 
    - *Primary Browser Engine*: Web Speech API (`webkitSpeechRecognition`) for instant zero-latency speech recognition with Indian English (`en-IN`) acoustic models.
    - *Alternative Server Engine*: OpenAI Whisper / Groq Whisper API for cross-browser fallback (Safari/Firefox).
  - **LLM Reasoning & Tool Calling**: 
    - **Groq (Llama 3.3 70B / Llama 3.1 8B)** or **OpenAI (GPT-4o-mini)**.
    - *Why Groq*: Extremely high token generation speed (~250-300 tokens/sec, sub-250ms TTFT) which is vital for voice interactions to avoid awkward pauses.
    - Native JSON Function Calling for tool execution.
  - **Text-to-Speech (TTS)**:
    - *High-Fidelity Cloud Mode*: **ElevenLabs** (Indian English voice such as "Aditi" / "Aria") or **OpenAI TTS** (`nova` / `alloy`) streaming audio.
    - *Instant Fallback Mode*: Browser Speech Synthesis (`speechSynthesis`) with Indian accent voice (`en-IN`), ensuring zero-latency, zero-cost operation even if cloud API credits run out.
  - **Barge-in / Interruption Handling**:
    - Real-time client-side speech detection that immediately halts audio playback (`audioContext.suspend()` / `speechSynthesis.cancel()`) when user speech begins.

```
  +-----------------------------------------------------------------------+
  |                             Web Browser                               |
  |  +----------------+    +-------------------+    +------------------+  |
  |  | Microphone /   |--->| Speech-To-Text    |--->| Next.js App /    |  |
  |  | VAD Barge-in   |    | (Web Speech / STT)|    | State Machine    |  |
  |  +----------------+    +-------------------+    +--------+---------+  |
  |                                                          |            |
  |  +----------------+    +-------------------+             |            |
  |  | Speaker Audio  |<---| Audio Player /    |<------------+            |
  |  | Output         |    | TTS Stream        |             |            |
  |  +----------------+    +-------------------+             |            |
  +----------------------------------------------------------|------------+
                                                             |
                                            HTTPS / WebSocket Streaming
                                                             |
                                                             v
                                        +--------------------+----------+
                                        | Next.js API Routes / Backend  |
                                        |  - Tool Execution Engine      |
                                        |  - Guardrails & Prompt Engine |
                                        |  - LLM (Groq / OpenAI)        |
                                        |  - Cloud TTS (ElevenLabs/OAI) |
                                        +--------------------+----------+
                                                             |
                                                             v
                                        +--------------------+----------+
                                        | Mock Order DB & Brand Policies|
                                        | (ORD-101, ORD-102, ORD-103)   |
                                        +-------------------------------+
```

---

## 3. Brand Knowledge, Policies & Guardrails

### A. Aura Skincare Brand Guidelines
- **Identity**: Premium organic Indian skincare brand focusing on clean, effective formulas with gentle natural ingredients.
- **Agent Persona**: **Aria** — warm, polite, professional, and concise customer support specialist from India. Speaks in natural conversational tone (1-2 sentences per voice turn, avoiding markdown bullet points, special characters, or long monologues).
- **Language**: English with natural Indian context, plus understanding of common Indian expressions / Hinglish ("bhaiya", "order status bata do", "COD available hai kya", "kab tak deliver hoga").

### B. Core Brand Policies
1. **Shipping**:
   - Free delivery on orders > ₹499.
   - ₹50 fee on orders < ₹499.
   - Standard transit: 3–5 business days across India.
2. **Returns & Refunds**:
   - Window: Within 7 days of delivery.
   - Conditions: Must be unopened, unused, in original packaging.
   - Damaged/defective items: Must be reported within 48 hours of delivery with photos for free replacement.
   - *Strict Guardrail*: If product is opened OR delivery was > 7 days ago, politely decline return/refund. Explain policy clearly and offer usage tips instead.
3. **Cancellations**:
   - Permitted **only** while order status is `Processing`.
   - Once `Shipped` or `Out for Delivery`, cannot be cancelled. Customer can refuse delivery at doorstep.
4. **Payment / COD**:
   - Cash on Delivery available up to ₹2,500. Doorstep payment via cash or UPI.

### C. Guardrails & Graceful Degradation
- **Out-of-Scope Requests**: e.g., "Can you book a flight to Goa?" / "What is the weather in Delhi?"
  - *Response*: Politely state Aria is specialized in Aura Skincare orders and products, then guide back to skincare queries.
- **Audio Ambiguity / Inaudible Input**:
  - *Response*: "I'm sorry, I couldn't quite hear you clearly. Could you please repeat that?"
- **Invalid / Missing Order IDs**:
  - *Response*: "I couldn't find an order with that ID in our system. Could you please verify the number or spell it out?"

---

## 4. Mock Order Database & Tools

### A. Mock Order Database (`orders.json` / `orders.ts`)
```typescript
interface Order {
  order_id: string;
  customer_name: string;
  product: string;
  value: number; // in INR
  status: 'Processing' | 'Shipped' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  delivery_partner?: string;
  tracking_id?: string;
  delivery_notes: string;
  order_date: string;
  delivered_days_ago?: number;
  is_cancellable: boolean;
  is_returnable: boolean;
}
```

**Seed Data**:
| Order ID | Customer | Product | Value | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ORD-101** | Priya Sharma | Vitamin C Serum (30ml) | ₹699 | Out for Delivery | BlueDart — BD-982103. Expected by 6 PM today |
| **ORD-102** | Rahul Verma | Hydrating Sunscreen SPF 50 | ₹499 | Delivered | Delhivery — DL-441029. Delivered 14 days ago |
| **ORD-103** | Ananya Patel | Green Tea Face Wash + Toner | ₹850 | Processing | Ordered 3 hours ago. Eligible for cancellation |

### B. Tool Implementations (Function Calling)
1. `get_order_details(order_id: string)`:
   - Fetches customer name, item, amount, live status, and courier tracking info.
2. `cancel_order(order_id: string, reason?: string)`:
   - Checks if order is in `Processing` status.
   - If yes: marks status as `Cancelled` in memory/state and confirms cancellation.
   - If no: explains policy (already dispatched/out for delivery) and offers doorstep refusal guidance.
3. `check_return_eligibility(order_id: string, is_opened: boolean, is_damaged: boolean)`:
   - Evaluates 7-day window, opened status, and 48-hour damage clause. Returns exact policy rationale.

---

## 5. User Interface & Testing Experience

### A. Design Aesthetic
- **Skincare Luxe Aesthetic**: Warm organic palette (creams, subtle sage green, warm bronze accents, sleek dark/light mode toggle).
- **Brand Identity**: Aura Skincare logo, tagline *"Pure, Effective, Conscious Skincare"*, and agent badge *"Aria — AI Customer Care"*.

### B. UI Components
1. **Interactive Voice Orb / Soundwave**:
   - Real-time Web Audio API frequency visualizer responding to mic input and agent speech.
2. **Call Controls**:
   - Prominent **"Start Call"** (Green pulse) and **"End Call"** (Red).
   - Mute Microphone toggle.
3. **Live State Indicator**:
   - `Idle` | `Listening` (glowing emerald) | `Thinking` (amber pulsing) | `Speaking` (violet waveform).
4. **Test Orders Helper Card (Required by Spec)**:
   - Interactive card displaying `ORD-101`, `ORD-102`, and `ORD-103` with customer names, items, and status.
   - "Click to speak prompt" suggestions (e.g. *"Where is my Vitamin C Serum?"*, *"Can I return ORD-102?"*, *"Cancel my green tea order ORD-103"*).
5. **Real-time Live Transcript**:
   - Auto-scrolling chat stream with distinct Customer and Aria speech bubbles.
6. **Post-Call Summary Panel**:
   - Displays immediately when call ends.
   - **Chronological Transcript** with timestamps.
   - **Structured JSON Outcome**:
     ```json
     {
       "customer_intent": "ORDER_TRACKING",
       "order_id": "ORD-101",
       "resolution_status": "RESOLVED",
       "call_summary": "Customer asked about delivery status for ORD-101. Informed that the order is Out for Delivery via BlueDart and expected by 6 PM today."
     }
     ```
   - Copy JSON button and "Download Transcript" button.
7. **Audio Engine Selector / Settings**:
   - Option to toggle between Cloud TTS (OpenAI/ElevenLabs) and Instant Browser Voice (Zero latency, no API key quota limits).

---

## 6. Project Directory Structure

```
task/
├── plan.md                        # This detailed implementation plan
├── README.md                      # Comprehensive documentation + Section 9 answers
├── .env.example                   # Template for OPENAI_API_KEY / GROQ_API_KEY / ELEVENLABS_API_KEY
├── package.json
├── tsconfig.json
├── next.config.ts
├── public/
│   └── aura-logo.svg
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Main Voice CX interface
│   │   ├── globals.css
│   │   └── api/
│   │       ├── chat/route.ts      # LLM orchestration & tool calling endpoint
│   │       ├── tts/route.ts       # Cloud TTS proxy streaming endpoint
│   │       └── summary/route.ts   # Post-call structured JSON generator
│   ├── components/
│   │   ├── VoiceVisualizer.tsx    # Canvas audio frequency visualizer
│   │   ├── StateBadge.tsx         # Listening / Thinking / Speaking indicator
│   │   ├── TestOrdersCard.tsx     # Order helper table with quick-copy & hints
│   │   ├── LiveTranscript.tsx     # Real-time chat bubbles during call
│   │   ├── PostCallSummary.tsx    # Formatted JSON output & call analysis
│   │   └── BrandHeader.tsx        # Aura Skincare header
│   ├── data/
│   │   ├── orders.ts              # Mock order database (ORD-101, ORD-102, ORD-103)
│   │   └── brandKnowledge.ts      # Aura Skincare policies, shipping, returns, FAQ
│   ├── lib/
│   │   ├── tools.ts               # get_order_details, cancel_order, check_return
│   │   ├── prompt.ts              # System instructions for Aria (tone, guardrails)
│   │   └── speech.ts              # Speech recognition & synthesis abstractions
│   └── types/
│       └── index.ts               # Transcript, Order, ToolCall, Summary types
```

---

## 7. Submission Deliverables & Quality Checklist

1. **Public Application URL**:
   - Ready for Vercel deployment with environment variables configured.
2. **GitHub Repository**:
   - Clean git history, modular TypeScript code, descriptive comments.
   - Comprehensive `README.md` including explicit answers to all four questions from Section 9:
     - *1. Architecture & tech stack rationale.*
     - *2. Most difficult challenge and how it was solved.*
     - *3. Roadmap if given one more week.*
     - *4. Scaling to 1,000 conversations/day (concurrency, telephony, observability, latency).*
3. **Demo Video Script & Guidelines**:
   - Walkthrough checklist for 3–5 min video:
     - Intro to Aura Skincare & Aria persona.
     - Live order lookup (`ORD-101`).
     - Policy enforcement scenario (out-of-window return on `ORD-102` or opened product).
     - Cancellation check on `ORD-103`.
     - Out-of-scope question deflection.
     - Post-call structured JSON summary and transcript verification.
     - Architecture overview.
4. **Short Approach Note**:
   - 2–3 sentences summarizing the technical approach and CX design principles.

---

## 8. Step-by-Step Execution Plan

- [x] **Step 1**: Initialize Next.js 15 project with TypeScript & Tailwind CSS.
- [x] **Step 2**: Create mock order database (`src/data/orders.ts`) and brand policy knowledge base (`src/data/brandKnowledge.ts`).
- [x] **Step 3**: Implement tool definitions (`src/lib/tools.ts`) for `get_order_details`, `cancel_order`, and return eligibility.
- [x] **Step 4**: Implement the LLM conversation route (`src/app/api/chat/route.ts`) with function calling, persona instructions, and strict guardrails. Provider-backed runtime verification remains pending an API key.
- [x] **Step 5**: Implement post-call summary generation API (`src/app/api/summary/route.ts`) producing the exact required JSON schema.
- [x] **Step 6**: Implement speech engine and audio manager with Web Speech STT/TTS + cloud TTS streaming support, including barge-in handling. Human acoustic validation remains pending.
- [x] **Step 7**: Build the frontend UI:
  - Header & Brand styling.
  - Interactive Voice Visualizer & Live State Indicator.
  - Start / End Call controllers.
  - Test Orders Helper card (showing ORD-101, ORD-102, ORD-103).
  - Real-time conversation transcript.
  - Post-Call Summary modal with JSON formatting & copy option.
- [x] **Step 8**: Test evaluation scenarios (order lookup, policy violation, cancellation, out-of-scope, edge cases) in automated policy tests and the browser text-call path. Human microphone validation remains pending.
- [x] **Step 9**: Prepare `.env.example`, thorough `README.md` with Section 9 questions answered, demo script, and approach note. Recording and external submission links remain outstanding.

## 9. Implementation review — 29 September 2026

The first runnable implementation is complete locally. Next.js 15.5.26, TypeScript, Tailwind, browser recognition/synthesis, optional OpenAI conversation/cloud TTS, deterministic policy tools, HMAC-signed per-call state, and outcome-derived JSON summaries are implemented. No API key is required for the explicitly labelled rule-based demo mode. Natural AI conversation requires `OPENAI_API_KEY`.

Verified: nine automated policy/session tests, type checking, production build, zero dependency audit findings, and a production-browser text-call flow covering ORD-101 tracking, ORD-102 return refusal, ORD-103 cancellation and post-call JSON. Fixtures reset between calls. Setup and Section 9 answers are in `README.md`.

Review changes and scope decisions:
- Exactly ₹499 has an unspecified shipping fee in both the assessment and plan; the agent acknowledges the gap.
- Cancellation state is isolated per call instead of global process memory. Public deployment needs a shared `SESSION_SECRET`.
- The model calls server tools; return and cancellation results are spoken directly to preserve policy decisions.
- Browser recognition pauses during playback to avoid echo. Explicit **Interrupt & speak** is implemented; automatic acoustic barge-in, server STT fallback, Groq and ElevenLabs are deferred. Step 6 remains partially complete.
- Waveform reads measured mic frequencies during listening; speech animation is illustrative.
- Microphone, actual speakers, Indian accent availability and funded cloud services still require a human voice test. Step 8 remains partially complete.
- Public URL, GitHub publication, recorded video and LinkedIn link are not supplied by local implementation. Do not publish the confidential Task.pdf.

## 10. Voice and conversation improvement — 29 September 2026

- Gemini API credentials were added only to ignored `.env.local`. Gemini 3.5 Flash-Lite is the conversation model: the supplied key could list Gemini 2.5 Flash, but its generation endpoint reported that model unavailable to new users. Gemini native function calling was tested with an actual ORD-101 lookup.
- The default spoken voice is Gemini Aoede, with Sulafat and Leda selectable and a preview control. Requests specify a warm, friendly female voice with natural Indian English cadence. The server converts Gemini's PCM output to WAV for browser playback. One live generated voice response was verified as 24 kHz WAV.
- Cloud speech falls back to a selected browser voice on generation/playback failure. The browser fallback prefers recognizable female voice names and en-IN where available. The existing speech interruption and cleanup behavior remains.
- Automated checks now cover Gemini tool calls, preserving policy refusals, WAV conversion and browser voice selection. Human listening and microphone quality remain to be evaluated locally before submission.

## 11. Final voice pipeline implementation — 29 September 2026

- Added microphone-level voice activity detection for automatic barge-in, with an on-page switch to disable it if speaker echo triggers it. Existing explicit interruption remains.
- Added browser `MediaRecorder` capture with speech/silence segmentation and a Gemini transcription endpoint. This covers browsers without `SpeechRecognition` and provides a selectable clearer speech path. No recordings are saved by the application.
- Upgraded to Gemini 3.8 Flash-Lite TTS and added streaming PCM playback with an ordinary WAV request and browser synthesis as fallbacks. Streamed PCM and Gemini transcription were verified with the supplied key using generated speech. Browser microphone access remains unavailable on this host, so acoustic quality and actual spoken interruption still require human testing.
- Added automated route and VAD checks. Public hosting, public GitHub repository, and a real demo recording require external account access; a detailed recording walkthrough and the candidate's LinkedIn URL are prepared.

## 12. Finalization status — 29 September 2026

The production build and automated checks pass. Google rejected the first key supplied in chat as reported leaked. A replacement key was added only to ignored `.env.local` and was verified with live Gemini conversation, transcription, unary WAV and streamed PCM calls. The application can also run in its labelled rule-based demo mode without an API key. The public hosting and repository links and the real recorded demo remain external submission work.
