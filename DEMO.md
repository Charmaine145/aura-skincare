# Aria demo recording guide (3–5 minutes)

Record the deployed HTTPS app in Chrome or Edge with microphone permission enabled. Use headphones to reduce speaker echo. Keep the live transcript, browser address, and post-call JSON visible in the recording. Sample orders are fictional and reset for each call.

| Time | On screen / say | What the evaluator should see |
| --- | --- | --- |
| 0:00–0:25 | Introduce Aria as Aura Skincare's AI care specialist. Show the voice choices, preview Aoede, and select **Gemini · clearer speech** if browser recognition struggles. | A warm spoken preview and visible conversation controls. |
| 0:25–1:10 | Start a voice call and ask: “Where is my order O R D one zero one?” | ORD-101 is out for delivery via BlueDart, tracking BD-982103, expected by 6 PM. |
| 1:10–1:55 | Ask: “Can I return O R D one zero two?” | A clear refusal because delivery was 14 days ago, beyond the seven-day window. |
| 1:55–2:40 | Ask: “Please cancel O R D one zero three.” Then ask for that order's status. | Cancellation succeeds only for Processing; its status is Cancelled within this call. |
| 2:40–3:05 | Ask: “Can you book me a flight?” | Aria politely guides the conversation back to Aura support. |
| 3:05–3:30 | During a longer answer, speak to interrupt, or use **Interrupt & speak** if speaker echo makes the automatic detector unreliable. | Aria stops and listens; the transcript marks interrupted speech. |
| 3:30–4:15 | End the call. Show and copy the structured JSON, then download the transcript. | Intent, order ID, resolution, chronological turns and verified tool outcomes. |
| 4:15–4:45 | Briefly explain: browser microphone → recognition/Gemini transcription → AI function calls → server policy tools → Gemini speech → verified summary. | State why refusals and cancellations come from server rules, not model wording. |

If microphone access is unavailable on the recording machine, use **Start a text call** and say clearly in the video that this is a text demonstration of the same policy and summary path. Do not claim it demonstrates microphone quality. Before recording the voice version, test the replacement Gemini key and confirm that the footer says **AI conversation · Gemini** and the voice preview is audible.
