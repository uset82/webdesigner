type AssistantBubbleProps = {
  text: string | null;
};

export function AssistantBubble({ text }: AssistantBubbleProps) {
  if (!text) {
    return null;
  }

  return (
    <section className="assistant-bubble" aria-live="polite">
      {text}
    </section>
  );
}
