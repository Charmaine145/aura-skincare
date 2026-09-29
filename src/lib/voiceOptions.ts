export const voiceOptions = [
  { id: "Aoede", label: "Aria · friendly & bright" },
  { id: "Sulafat", label: "Aria · warm & reassuring" },
  { id: "Leda", label: "Aria · light & cheerful" },
] as const;
export type AriaVoice = typeof voiceOptions[number]["id"];
export const voicePreviewText = "Hi, I'm Aria. Lovely to meet you! I'm here to help with your Aura order, or any questions you have. Take your time, I'm listening.";
