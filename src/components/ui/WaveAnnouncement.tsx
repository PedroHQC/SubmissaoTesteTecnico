export function WaveAnnouncement({ wave }: { wave: number }) {
  return (
    <div className="wave-announcement" role="status" aria-live="polite" aria-atomic="true">
      <span className="wave-announcement-eyebrow">Enemy fleet</span>
      <strong>WAVE {wave}</strong>
      <span>{wave === 1 ? 'Ships on the horizon' : 'Reinforcements incoming'}</span>
    </div>
  );
}
