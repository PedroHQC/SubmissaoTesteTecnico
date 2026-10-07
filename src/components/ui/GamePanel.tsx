import type { ReactNode } from 'react';

/** Fixed frame margins surround a separately scrollable content area. */
export function GamePanel({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`game-panel ${className}`}>
      <div className="panel-interior">{children}</div>
    </section>
  );
}
