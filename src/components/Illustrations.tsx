import type { FoodCategory } from '../lib/types';

/** Hero illustration: an Indian thali seen from above. Pure SVG, no external images. */
export function ThaliIllustration({ className }: { className?: string }) {
  const katoris: { cx: number; cy: number; fill: string; dots?: string; label: string }[] = [
    { cx: 196, cy: 150, fill: '#E9B23F', dots: '#C98A1D', label: 'dal' },
    { cx: 318, cy: 132, fill: '#4F7A3A', dots: '#3B5F2B', label: 'saag' },
    { cx: 404, cy: 218, fill: '#C25A28', dots: '#9C4420', label: 'curry' },
    { cx: 150, cy: 262, fill: '#F6F1E4', dots: '#7BA05B', label: 'raita' },
  ];
  return (
    <svg viewBox="0 0 560 520" className={className} role="img" aria-label="Illustration of an Indian thali: small bowls of dal, greens, curry and raita around rice and flatbreads">
      <defs>
        <radialGradient id="plate" cx="45%" cy="40%" r="65%">
          <stop offset="0" stopColor="#F4DFA6" />
          <stop offset=".7" stopColor="#D9B465" />
          <stop offset="1" stopColor="#B78E3E" />
        </radialGradient>
        <radialGradient id="bowl" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#F1D48D" />
          <stop offset="1" stopColor="#B88D3C" />
        </radialGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#183C36" floodOpacity=".22" />
        </filter>
        <filter id="softS" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#5B3E10" floodOpacity=".3" />
        </filter>
      </defs>
      <circle cx="290" cy="262" r="250" fill="#E7EEE8" />
      <g filter="url(#soft)">
        <circle cx="290" cy="262" r="218" fill="url(#plate)" />
        <circle cx="290" cy="262" r="196" fill="none" stroke="#FFF3CF" strokeOpacity=".55" strokeWidth="3" />
      </g>
      {/* rice */}
      <g>
        <ellipse cx="300" cy="318" rx="86" ry="62" fill="#FFFDF6" />
        {Array.from({ length: 46 }).map((_, i) => {
          const a = i * 2.39;
          const r = 10 + (i % 9) * 8;
          return <ellipse key={i} cx={300 + Math.cos(a) * r} cy={318 + Math.sin(a) * r * 0.66} rx="5" ry="2" fill="#EDE6D3" transform={`rotate(${(i * 37) % 180} ${300 + Math.cos(a) * r} ${318 + Math.sin(a) * r * 0.66})`} />;
        })}
        <path d="M262 300c10-8 20-8 28 0" stroke="#4F7A3A" strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>
      {/* rotis */}
      <g filter="url(#softS)">
        <circle cx="420" cy="350" r="62" fill="#E2B777" />
        <circle cx="395" cy="372" r="62" fill="#EBC58B" />
        {[[380, 352], [410, 386], [372, 394], [420, 360], [395, 405]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4 + (i % 3) * 2} fill="#A86B2C" opacity=".55" />
        ))}
      </g>
      {/* katoris */}
      {katoris.map((k) => (
        <g key={k.label} filter="url(#softS)">
          <circle cx={k.cx} cy={k.cy} r="54" fill="url(#bowl)" />
          <circle cx={k.cx} cy={k.cy} r="44" fill={k.fill} />
          <ellipse cx={k.cx - 12} cy={k.cy - 14} rx="16" ry="8" fill="#fff" opacity=".22" />
          {k.dots &&
            [0, 1, 2, 3, 4].map((i) => (
              <circle key={i} cx={k.cx + Math.cos(i * 1.3) * 22} cy={k.cy + Math.sin(i * 1.3) * 18} r="3.2" fill={k.dots} opacity=".8" />
            ))}
        </g>
      ))}
      {/* chilli + lime */}
      <path d="M214 380c22 26 58 30 80 18" stroke="#2F7D32" strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M290 396l14-8" stroke="#3E5B1F" strokeWidth="5" strokeLinecap="round" />
      <path d="M150 352a28 28 0 0 1 40 30Z" fill="#C7D94A" />
      <path d="M154 356a22 22 0 0 1 31 23" stroke="#F3F7C8" strokeWidth="3" fill="none" />
      <circle cx="486" cy="120" r="9" fill="#F28C45" />
      <circle cx="82" cy="170" r="6" fill="#F28C45" opacity=".7" />
    </svg>
  );
}

/** Small category illustration used on the dish detail view when no photo exists. */
export function FoodIllustration({ category, className }: { category: FoodCategory; className?: string }) {
  const common = { className, viewBox: '0 0 120 120', role: 'img' as const, 'aria-label': `Illustration for ${category.toLowerCase()}` };
  const plate = <circle cx="60" cy="64" r="44" fill="#fff" stroke="#E4DED2" strokeWidth="2" />;
  switch (category) {
    case 'Breakfast':
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="58" fill="#E7EEE8" />
          {plate}
          <path d="M24 70 L92 46 L98 60 L30 84Z" fill="#E3A548" />
          <path d="M28 76 L94 52" stroke="#C4812B" strokeWidth="2" />
          <circle cx="40" cy="92" r="9" fill="#F6F1E4" stroke="#E4DED2" />
          <circle cx="62" cy="96" r="9" fill="#D6762E" />
        </svg>
      );
    case 'Desserts':
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="58" fill="#E7EEE8" />
          <path d="M22 60h76a38 30 0 0 1-76 0Z" fill="#fff" stroke="#E4DED2" strokeWidth="2" />
          <circle cx="46" cy="58" r="14" fill="#8C3F1C" />
          <circle cx="72" cy="58" r="14" fill="#9E4A22" />
          <circle cx="59" cy="48" r="13" fill="#7A3416" />
          <circle cx="54" cy="44" r="3" fill="#fff" opacity=".35" />
        </svg>
      );
    case 'Beverages':
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="58" fill="#E7EEE8" />
          <path d="M38 46h40l-5 48H43Z" fill="#fff" stroke="#E4DED2" strokeWidth="2" />
          <path d="M41 58h34l-3 34H44Z" fill="#C98A4B" />
          <path d="M50 38c0-6 6-6 6-12M64 38c0-6 6-6 6-12" stroke="#F28C45" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'Snacks':
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="58" fill="#E7EEE8" />
          {plate}
          <path d="M34 80 L54 40 L74 80Z" fill="#D9A04E" stroke="#B57A2C" strokeWidth="2" strokeLinejoin="round" />
          <path d="M58 84 L76 50 L94 84Z" fill="#E3B062" stroke="#B57A2C" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="34" cy="96" r="7" fill="#4F7A3A" />
        </svg>
      );
    case 'Main Course':
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="58" fill="#E7EEE8" />
          {plate}
          <circle cx="60" cy="64" r="30" fill="#C25A28" />
          <circle cx="50" cy="58" r="6" fill="#F6F1E4" />
          <circle cx="66" cy="70" r="6" fill="#F6F1E4" />
          <circle cx="70" cy="54" r="5" fill="#F6F1E4" />
          <path d="M44 74c6 4 12 4 18 0" stroke="#F6F1E4" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="58" fill="#E7EEE8" />
          {plate}
          <path d="M44 60h32M44 70h22" stroke="#176B5B" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
  }
}
