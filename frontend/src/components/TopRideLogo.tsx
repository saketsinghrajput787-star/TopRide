import React from 'react';

interface TopRideLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
  className?: string;
  variant?: 'compass' | 'badge' | 'stacked';
}

/**
 * Signature Figma Orange Compass Icon
 * Recreated with exact 8-point geometric star and circular ring (#F05A28)
 */
export const TopCompassIcon: React.FC<{ size?: number; className?: string }> = ({ size = 36, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 44 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    {/* Outer circle ring */}
    <circle cx="22" cy="22" r="19.5" stroke="#F05A28" strokeWidth="2.5" />
    
    {/* Cardinal Points (North, South, East, West) */}
    {/* North */}
    <polygon points="22,5 24.5,22 22,22 19.5,22" fill="#F05A28" />
    {/* South */}
    <polygon points="22,39 24.5,22 22,22 19.5,22" fill="#F05A28" opacity="0.9" />
    {/* East */}
    <polygon points="39,22 22,24.5 22,22 22,19.5" fill="#F05A28" />
    {/* West */}
    <polygon points="5,22 22,24.5 22,22 22,19.5" fill="#F05A28" opacity="0.9" />
    
    {/* Diagonal facets (NE, SE, SW, NW) */}
    <polygon points="33,11 23,21 21,23" fill="#F05A28" opacity="0.65" />
    <polygon points="33,33 23,23 21,21" fill="#F05A28" opacity="0.65" />
    <polygon points="11,33 21,23 23,21" fill="#F05A28" opacity="0.65" />
    <polygon points="11,11 21,21 23,23" fill="#F05A28" opacity="0.65" />
    
    {/* Center hub */}
    <circle cx="22" cy="22" r="2.5" fill="#FFFFFF" />
    <circle cx="22" cy="22" r="1.5" fill="#F05A28" />
  </svg>
);

/**
 * Figma Signature Stacked Compass + "TOP" Wordmark
 * Used in Welcome screen, Chat header, and Brand badges
 */
export const TopCompassStackedLogo: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const iconSize = size === 'sm' ? 32 : size === 'lg' ? 46 : 38;
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <TopCompassIcon size={iconSize} />
      <span className={`font-black tracking-widest text-[#F05A28] ${textSize} mt-1 uppercase`}>
        TOP
      </span>
    </div>
  );
};

export const TopRideLogo: React.FC<TopRideLogoProps> = ({
  size = 'md',
  showText = true,
  textColor = 'text-slate-950',
  className = '',
  variant = 'compass',
}) => {
  if (variant === 'stacked') {
    return <TopCompassStackedLogo size={size === 'xl' ? 'lg' : size === 'sm' ? 'sm' : 'md'} className={className} />;
  }

  const iconSizes = {
    sm: 26,
    md: 32,
    lg: 40,
    xl: 50,
  }[size];

  const textSizes = {
    sm: 'text-base font-black',
    md: 'text-xl font-black',
    lg: 'text-2xl font-black',
    xl: 'text-3xl font-black',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <TopCompassIcon size={iconSizes} />
      {showText && (
        <span className={`${textSizes} ${textColor} tracking-tight select-none`}>
          TopRide
        </span>
      )}
    </div>
  );
};
