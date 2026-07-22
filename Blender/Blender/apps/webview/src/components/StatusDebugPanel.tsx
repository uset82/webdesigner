type StatusDebugPanelProps = {
  events: string[];
};

export function StatusDebugPanel({ events }: StatusDebugPanelProps) {
  return (
    <section className="status-debug-panel" aria-label="Debug status">
      <span className="section-label">Events</span>
      <ol>{events.length === 0 ? <li>webview:ready</li> : events.map((event) => <li key={event}>{event}</li>)}</ol>
    </section>
  );
}
