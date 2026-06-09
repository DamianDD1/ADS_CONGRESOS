// Fondo de marca para eventos (estilo IBTM Americas).
// Textura sutil: silueta de pirámide maya, retícula de puntos y resplandor.
// Pensado para superponerse sobre el degradado púrpura→carmesí del héroe/auth.
export default function RivieraScene() {
  return (
    <svg className="riviera-scene" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ev-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <pattern id="ev-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="#ffffff" opacity="0.12" />
        </pattern>
        <linearGradient id="ev-pyr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#160a1c" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {/* Resplandor superior */}
      <rect width="400" height="340" fill="url(#ev-glow)" />

      {/* Retícula de puntos */}
      <rect x="232" y="30" width="168" height="200" fill="url(#ev-dots)" />
      <rect x="0" y="380" width="150" height="220" fill="url(#ev-dots)" opacity="0.7" />

      {/* Líneas diagonales decorativas */}
      <g stroke="#ffffff" strokeWidth="1.4" opacity="0.32">
        <line className="diag" x1="-10" y1="150" x2="90" y2="50" />
        <line className="diag" x1="-10" y1="185" x2="125" y2="50" style={{ animationDelay: '.25s' }} />
        <line className="diag" x1="-10" y1="220" x2="160" y2="50" style={{ animationDelay: '.5s' }} />
      </g>

      {/* Silueta de pirámide maya (Chichén Itzá), anclada abajo */}
      <g opacity="0.92">
        <path d="M70 600 L150 320 L250 320 L330 600 Z" fill="url(#ev-pyr)" />
        {/* Escalinata central */}
        <path d="M188 600 L188 360 L212 360 L212 600 Z" fill="#160a1c" opacity="0.30" />
        {/* Templo superior */}
        <rect x="172" y="300" width="56" height="26" rx="2" fill="#160a1c" opacity="0.34" />
        {/* Niveles escalonados (líneas) */}
        <g stroke="#ffffff" strokeWidth="1.2" opacity="0.18">
          <line x1="120" y1="430" x2="280" y2="430" />
          <line x1="135" y1="375" x2="265" y2="375" />
          <line x1="150" y1="320" x2="250" y2="320" />
        </g>
      </g>

      {/* Acentos brillantes (ventanas/luces) */}
      <g fill="#ff9bb6" opacity="0.7">
        <rect x="188" y="306" width="6" height="10" className="win" />
        <rect x="206" y="306" width="6" height="10" className="win" style={{ animationDelay: '1.1s' }} />
      </g>

      <style>{`
        .win { animation: flick 4s ease-in-out infinite; }
        @keyframes flick { 0%,100%{opacity:.35} 50%{opacity:.9} }
        .diag { animation: slide 6s ease-in-out infinite alternate; }
        @keyframes slide { from{opacity:.18} to{opacity:.4} }
      `}</style>
    </svg>
  )
}

// Orbe / listón espiral azul-carmesí (motivo central del héroe IBTM).
export function HeroOrb({ size = 380 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" fill="none" className="hero-orb" aria-hidden="true">
      <defs>
        <radialGradient id="orb-core" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#3a1140" />
          <stop offset="70%" stopColor="#1c0a26" />
          <stop offset="100%" stopColor="#0e0514" />
        </radialGradient>
        <linearGradient id="orb-red" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff3b6e" />
          <stop offset="100%" stopColor="#c4123e" />
        </linearGradient>
        <linearGradient id="orb-blue" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#0e8bd1" />
          <stop offset="100%" stopColor="#1763c0" />
        </linearGradient>
        <clipPath id="orb-clip"><circle cx="200" cy="200" r="165" /></clipPath>
      </defs>

      <circle cx="200" cy="200" r="165" fill="url(#orb-core)" />
      <g clipPath="url(#orb-clip)" className="orb-spin">
        {/* Listones espirales */}
        <path d="M200 35 C90 60 40 170 70 270 C95 350 200 372 200 372"
          stroke="url(#orb-red)" strokeWidth="26" fill="none" strokeLinecap="round" opacity="0.95" />
        <path d="M200 372 C320 350 372 240 338 140 C312 62 200 35 200 35"
          stroke="url(#orb-blue)" strokeWidth="26" fill="none" strokeLinecap="round" opacity="0.95" />
        <path d="M150 70 C70 120 60 240 130 320"
          stroke="url(#orb-red)" strokeWidth="12" fill="none" strokeLinecap="round" opacity="0.6" />
        <path d="M270 330 C345 280 350 160 280 80"
          stroke="url(#orb-blue)" strokeWidth="12" fill="none" strokeLinecap="round" opacity="0.6" />
      </g>
      <circle cx="200" cy="200" r="165" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1.5" />
      <style>{`
        .orb-spin { transform-origin:200px 200px; animation:orbspin 26s linear infinite; }
        @keyframes orbspin { to { transform:rotate(360deg); } }
      `}</style>
    </svg>
  )
}
