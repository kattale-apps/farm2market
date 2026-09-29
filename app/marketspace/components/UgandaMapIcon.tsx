/** A simple outline of Uganda with Lake Victoria and a dot for Kampala. */
export function UgandaMapIcon({ size = 40, color = "#2e7d32" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 104 110" aria-hidden="true" focusable="false">
      <path
        d="M26.1 16.4 L37.8 13.0 L50.4 14.4 L63.0 10.8 L73.8 11.7 L82.8 3.2 L90.0 12.6 L93.6 21.6 L99.9 34.2 L97.2 45.0 L91.8 59.4 L84.6 68.4 L81.0 77.4 L81.0 97.2 L41.4 97.2 L25.2 97.2 L18.0 99.0 L3.6 104.4 L3.6 90.0 L7.2 77.4 L9.9 69.3 L14.4 63.0 L21.6 55.8 L28.8 49.5 L34.2 40.5 L27.9 36.0 L24.3 35.1 L27.0 25.2 Z"
        fill={color}
        fillOpacity={0.14}
        stroke={color}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M57.6 74.7 L68.4 73.8 L81.0 77.4 L81.0 97.2 L43.2 97.2 L45.0 86.4 L52.2 77.4 Z" fill="#64b5f6" fillOpacity={0.55} />
      <circle cx={57.2} cy={66} r={6} fill="#f6bf26" stroke={color} strokeWidth={2.5} />
    </svg>
  );
}
