import React from 'react';

interface TopRideLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
  className?: string;
}

export const TopRideLogo: React.FC<TopRideLogoProps> = ({
  size = 'md',
  showText = true,
  textColor = 'text-slate-950',
  className = '',
}) => {
  // Dimensions based on size
  const badgeDimensions = {
    sm: 'w-7 h-7 text-[11px] rounded-lg',
    md: 'w-9 h-9 text-xs rounded-xl',
    lg: 'w-12 h-12 text-sm rounded-2xl',
    xl: 'w-16 h-16 text-lg rounded-3xl',
  }[size];

  const textSize = {
    sm: 'text-base font-black',
    md: 'text-xl font-black',
    lg: 'text-2xl font-black',
    xl: 'text-3xl font-black',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Signature Figma TopRide Orange Badge */}
      <div
        className={`${badgeDimensions} bg-[#F05A28] text-white flex items-center justify-center font-black tracking-tight shadow-sm shrink-0 select-none transition-transform`}
        style={{
          boxShadow: '0 2px 8px rgba(240, 90, 40, 0.25)',
        }}
        aria-hidden="true"
      >
        TOP
      </div>

      {/* TopRide Wordmark */}
      {showText && (
        <span className={`${textSize} ${textColor} tracking-tight select-none`}>
          TopRide
        </span>
      )}
    </div>
  );
};
