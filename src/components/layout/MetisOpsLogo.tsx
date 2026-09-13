export function MetisOpsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="currentColor" strokeWidth="7" strokeLinecap="round">
        <line x1="20" y1="20" x2="35" y2="35" />
        <circle cx="20" cy="20" r="3.5" fill="currentColor" />
        <line x1="80" y1="20" x2="65" y2="35" />
        <circle cx="80" cy="20" r="3.5" fill="currentColor" />
        <line x1="20" y1="80" x2="35" y2="65" />
        <circle cx="20" cy="80" r="3.5" fill="currentColor" />
        <line x1="80" y1="80" x2="65" y2="65" />
        <circle cx="80" cy="80" r="3.5" fill="currentColor" />
      </g>
      <path
        d="M50 24 L55 38 L45 38 Z M50 76 L55 62 L45 62 Z M24 50 L38 55 L38 45 Z M76 50 L62 55 L62 45 Z"
        className="fill-brand-gold"
      />
      <circle cx="50" cy="50" r="18" fill="none" className="stroke-brand-gold" strokeWidth="7" />
      <circle cx="50" cy="50" r="4.5" fill="currentColor" />
    </svg>
  );
}
