// Responsive design utilities and breakpoints

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// Static responsive values that don't depend on window
export const getStaticResponsiveValue = <T>(values: {
  default: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}, width: number = 768): T => {
  if (width >= BREAKPOINTS['2xl'] && values['2xl'] !== undefined) return values['2xl'];
  if (width >= BREAKPOINTS.xl && values.xl !== undefined) return values.xl;
  if (width >= BREAKPOINTS.lg && values.lg !== undefined) return values.lg;
  if (width >= BREAKPOINTS.md && values.md !== undefined) return values.md;
  if (width >= BREAKPOINTS.sm && values.sm !== undefined) return values.sm;
  
  return values.default;
};

// Static responsive font sizes (SSR-safe)
export const getStaticResponsiveFontSize = (baseSize: number, width: number = 768): string => {
  const multiplier = getStaticResponsiveValue({
    default: 0.875, // Mobile: smaller
    sm: 0.9,
    md: 1, // Tablet: base
    lg: 1.1, // Desktop: larger
    xl: 1.2,
  }, width);
  
  return `${baseSize * multiplier}rem`;
};

// Static responsive spacing (SSR-safe)
export const getStaticResponsiveSpacing = (baseSpacing: number, width: number = 768): string => {
  const multiplier = getStaticResponsiveValue({
    default: 0.75, // Mobile: tighter
    sm: 0.875,
    md: 1, // Tablet: base
    lg: 1.25, // Desktop: more spacious
    xl: 1.5,
  }, width);
  
  return `${baseSpacing * multiplier}rem`;
};

// CSS classes for responsive design (use these instead of JS checks)
export const RESPONSIVE_CLASSES = {
  mobile: 'block md:hidden',
  tablet: 'hidden md:block lg:hidden',
  desktop: 'hidden lg:block',
  mobileTablet: 'block lg:hidden',
  tabletDesktop: 'hidden md:block',
} as const;