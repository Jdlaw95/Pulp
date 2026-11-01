// Simple inline icons so the footer needs no image files or extra packages.
export default function SocialIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;
  switch (name) {
    case "Facebook":
      return (
        <svg {...common}>
          <path d="M14 8h3V4h-3c-2.2 0-4 1.8-4 4v2H7v4h3v8h4v-8h3l1-4h-4V8.5c0-.3.2-.5.5-.5z" />
        </svg>
      );
    case "TikTok":
      return (
        <svg {...common}>
          <path d="M16.6 3c.3 2.3 1.700 3.900 4 4.100v3.200c-1.500 0-2.900-.4-4-1.200V15a6 6 0 1 1-6-6c.3 0 .7 0 1 .1v3.300a2.700 2.700 0 1 0 1.700 2.500V3h3.300z" />
        </svg>
      );
    case "Instagram":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3.500" y="3.500" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.200" cy="6.800" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}
