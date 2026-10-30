import React from 'react';
import hackerCatImg from '../../assets/brand/hacker-cat.jpg';
import { useTheme } from '../../theme/ThemeContext';

export type BrandShape = 'wordmark' | 'mark';

export interface BrandArtworkProps {
  shape: BrandShape;
  /** Rendered height in pixels; the width follows the artwork's own ratio. */
  height: number;
  className?: string;
  label?: string;
}

export const BrandArtwork: React.FC<BrandArtworkProps> = ({ shape, height, className, label = 'Shell-PAMC' }) => {
  const { theme } = useTheme();
  const colors = theme.palette;

  if (shape === 'mark') {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: height,
          height: height,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 0 10px rgba(236, 72, 153, 0.45)',
          border: '1.5px solid #ec4899',
          background: '#0d1117',
          flexShrink: 0,
        }}
        role={label ? 'img' : 'presentation'}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <img
          src={hackerCatImg}
          alt={label || 'Shell-PAMC Mark'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </span>
    );
  }

  // Wordmark: Pink hacker cat badge + Shell-PAMC bold typography
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.max(8, Math.round(height * 0.35)),
        height: height,
        verticalAlign: 'middle',
        userSelect: 'none',
        flexShrink: 0,
      }}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: height,
          height: height,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 0 10px rgba(236, 72, 153, 0.45)',
          border: '1.5px solid #ec4899',
          background: '#0d1117',
          flexShrink: 0,
        }}
      >
        <img
          src={hackerCatImg}
          alt="Shell-PAMC Mark"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </span>
      <span
        style={{
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontWeight: 800,
          fontSize: Math.round(height * 0.72),
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: colors.fg,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <span>Shell</span>
        <span style={{ color: '#ec4899', margin: '0 1px' }}>-</span>
        <span style={{ color: '#f43f5e' }}>PAMC</span>
      </span>
    </span>
  );
};
