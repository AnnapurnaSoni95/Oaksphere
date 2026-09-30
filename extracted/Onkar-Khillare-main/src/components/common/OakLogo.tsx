import React from 'react';

interface OakLogoProps {
  variant?: 'horizontal' | 'full' | 'emblem';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTagline?: boolean;
}

export const OakEmblem: React.FC<{ className?: string; size?: number | string }> = ({
  className = 'w-8 h-8',
}) => {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <g transform="translate(0, -10)">
        {/* Top Network Globe Grid */}
        <path
          d="M 120 145 C 135 85, 265 85, 280 145"
          fill="none"
          stroke="#0B2240"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M 150 115 C 180 75, 220 75, 250 115"
          fill="none"
          stroke="#0B2240"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M 190 78 C 220 90, 255 120, 275 160"
          fill="none"
          stroke="#F26522"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M 235 82 C 265 110, 290 140, 305 175"
          fill="none"
          stroke="#F26522"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Network Nodes */}
        <circle cx="150" cy="115" r="5" fill="#0B2240" />
        <circle cx="190" cy="78" r="6" fill="#0B2240" />
        <circle cx="235" cy="82" r="5.5" fill="#0B2240" />
        <circle cx="250" cy="74" r="6.5" fill="#F26522" />
        <circle cx="280" cy="120" r="5.5" fill="#F26522" />
        <circle cx="300" cy="155" r="5" fill="#F26522" />

        {/* Outer Left Crescent & Navy Person */}
        <path
          d="M 200 68 C 110 75, 75 165, 80 235 C 85 295, 140 350, 200 365 C 160 335, 125 285, 125 220 C 125 170, 160 120, 200 68 Z"
          fill="#0B2240"
        />
        <circle cx="132" cy="190" r="14.5" fill="#0B2240" />
        <path
          d="M 130 206 C 120 235, 130 270, 155 290 C 145 265, 140 235, 145 210 Z"
          fill="#0B2240"
        />

        {/* Outer Right Crescent & Orange Person */}
        <path
          d="M 200 68 C 290 75, 325 165, 320 235 C 315 295, 260 350, 200 365 C 240 335, 275 285, 275 220 C 275 170, 240 120, 200 68 Z"
          fill="#F26522"
        />
        <circle cx="268" cy="190" r="14.5" fill="#F26522" />
        <path
          d="M 270 206 C 280 235, 270 270, 245 290 C 255 265, 260 235, 255 210 Z"
          fill="#F26522"
        />

        {/* Central Oak Leaf */}
        <g transform="translate(200, 220)">
          <path
            d="M 0 -85 
               C 8 -82, 16 -70, 15 -58 
               C 28 -62, 38 -50, 36 -38 
               C 28 -32, 24 -30, 26 -20
               C 42 -22, 50 -10, 48 5
               C 35 15, 28 15, 26 28
               C 38 28, 44 42, 38 55
               C 25 65, 15 65, 8 80
               C 2 95, 0 110, 0 120
               C 0 110, -2 95, -8 80
               C -15 65, -25 65, -38 55
               C -44 42, -38 28, -26 28
               C -28 15, -35 15, -48 5
               C -50 -10, -42 -22, -26 -20
               C -24 -30, -28 -32, -36 -38
               C -38 -50, -28 -62, -15 -58
               C -16 -70, -8 -82, 0 -85 Z"
            fill="#0B2240"
          />

          {/* Stem & Veins */}
          <line x1="0" y1="115" x2="0" y2="-72" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 0 52 Q 15 42, 28 40" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M 0 52 Q -15 42, -28 40" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M 0 20 Q 20 8, 36 2" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M 0 20 Q -20 8, -36 2" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M 0 -12 Q 18 -22, 34 -25" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M 0 -12 Q -18 -22, -34 -25" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M 0 -42 Q 15 -50, 24 -56" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M 0 -42 Q -15 -50, -24 -56" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
};

export const OakLogo: React.FC<OakLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showTagline = true,
}) => {
  if (variant === 'emblem') {
    const emblemSizes = {
      sm: 'w-6 h-6',
      md: 'w-8 h-8',
      lg: 'w-12 h-12',
      xl: 'w-20 h-20',
    };
    return <OakEmblem className={`${emblemSizes[size]} ${className}`} />;
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {/* Large Emblem */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 mb-3">
          <OakEmblem className="w-full h-full drop-shadow-sm" />
        </div>

        {/* Brand Text */}
        <div className="leading-none">
          <span className="text-2xl sm:text-3xl font-black text-[#0B2240] tracking-tight">OAK</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-[#F26522] tracking-tight">Sphere</span>
        </div>

        {/* Divider with CONNECT */}
        <div className="w-full max-w-[240px] flex items-center justify-center gap-2 my-1.5">
          <div className="h-[1.5px] bg-[#0B2240] flex-1" />
          <span className="text-[11px] sm:text-xs font-extrabold text-[#0B2240] tracking-[0.3em] uppercase pl-1">
            CONNECT
          </span>
          <div className="h-[1.5px] bg-[#0B2240] flex-1" />
        </div>

        {/* Tagline */}
        {showTagline && (
          <div className="text-[9px] sm:text-[10px] font-bold tracking-[0.14em] uppercase text-slate-500 mt-0.5">
            <span className="text-[#0B2240]">CONNECTING </span>
            <span className="text-[#0284C7]">TALENT. </span>
            <span className="text-[#0B2240]">BUILDING </span>
            <span className="text-[#F26522]">FUTURES.</span>
          </div>
        )}
      </div>
    );
  }

  // variant === 'horizontal' (for Navbar, Topbar, Sidebar)
  const sizes = {
    sm: { emblem: 'w-7 h-7', title: 'text-sm', connect: 'text-[9px]', badge: 'text-[9px]' },
    md: { emblem: 'w-9 h-9', title: 'text-base', connect: 'text-[10px]', badge: 'text-[10px]' },
    lg: { emblem: 'w-11 h-11', title: 'text-lg', connect: 'text-xs', badge: 'text-xs' },
    xl: { emblem: 'w-14 h-14', title: 'text-xl', connect: 'text-xs', badge: 'text-sm' },
  };

  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <OakEmblem className={`${s.emblem} drop-shadow-2xs`} />
      <div className="leading-tight">
        <div className="flex items-baseline">
          <span className={`font-black text-[#0B2240] tracking-tight ${s.title}`}>OAK</span>
          <span className={`font-extrabold text-[#F26522] tracking-tight ${s.title}`}>Sphere</span>
          <span className="text-slate-300 mx-1.5 font-light">|</span>
          <span className={`font-extrabold text-[#0B2240] tracking-[0.18em] uppercase ${s.connect}`}>
            CONNECT
          </span>
        </div>
        {showTagline && (
          <div className="hidden xl:block text-[8.5px] font-bold tracking-[0.12em] uppercase text-slate-400 mt-0.5">
            <span className="text-[#0B2240]">Connecting Talent. </span>
            <span className="text-[#F26522]">Building Futures.</span>
          </div>
        )}
      </div>
    </div>
  );
};
