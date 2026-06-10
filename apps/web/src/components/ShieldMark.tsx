/** The Gardien logo: a shield bearing a sprout. Inherits color via currentColor. */
export function ShieldMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 2.4 19.6 5v6c0 4.8-3.3 8.2-7.6 9.6C7.7 19.2 4.4 15.8 4.4 11V5L12 2.4Z"
        fill="currentColor"
        opacity="0.14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 17.4v-4.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 13C11 10.3 8.8 9.1 6.1 9.5c.2 2.8 2.3 4.3 5.9 3.5Z" fill="currentColor" />
      <path
        d="M12.3 13.4c.7-2.2 2.4-3.3 4.9-3-.2 2.5-1.9 3.6-4.9 3Z"
        fill="currentColor"
        opacity="0.72"
      />
    </svg>
  );
}
