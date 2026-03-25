# HKRA Branding Guide

This document outlines the branding colors and styles used in the HKRA Vendor Portal, based on the official HKRA website (https://hkra.org.hk).

## Color Palette

### Primary Colors
- **Primary Blue**: `rgb(30, 75, 117)` / `#1E4B75`
  - Used for: Primary buttons, links, focus rings, brand elements
  - OKLCH: `oklch(0.35 0.08 250)`

### Neutral Colors
- **Background**: White `rgb(255, 255, 255)`
- **Text**: Dark Gray `rgb(104, 104, 104)`
- **Borders**: Light Gray `oklch(0.90 0.01 0)`
- **Muted Text**: Medium Gray `oklch(0.50 0.01 0)`

### Accent Colors
- **Destructive Actions**: Red `oklch(0.55 0.22 25)`
- **Secondary Elements**: Light Gray `oklch(0.95 0.01 0)`

## Typography

### Font Family
- **Primary**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
- **Serif**: `'Georgia', 'Times New Roman', serif` (for special cases)
- **Monospace**: `'JetBrains Mono', 'Courier New', monospace` (for code)

### Font Sizes
- Standard sizes following Tailwind CSS defaults
- Body text: 16px (1rem)
- Headings: Scale from 1.5rem to 3rem

## Logo

### Current Implementation
The header currently uses a placeholder logo with "HKRA" text in a blue square.

### To Add Actual Logo
1. Place the HKRA logo file in `public/` directory (e.g., `public/hkra-logo.png` or `public/hkra-logo.svg`)
2. Update `src/components/vendor/HKRAHeader.tsx`:
   ```tsx
   <img
     src="/hkra-logo.png"
     alt="The Hong Kong Radiographers' Association"
     className="h-10 w-auto"
   />
   ```

### Logo Specifications
- Recommended format: SVG (scalable) or PNG (high resolution)
- Recommended height: 40px (matches header height)
- Maintain aspect ratio
- Should work on both light and dark backgrounds

## Brand Name

**Full Name**: "The Hong Kong Radiographers' Association"
**Short Name**: "HKRA"
**Portal Name**: "HKRA Vendor Portal"

## Design Principles

1. **Professional & Clean**: Clean white backgrounds with subtle shadows
2. **Accessible**: High contrast ratios for text readability
3. **Consistent**: Blue primary color used consistently throughout
4. **Modern**: Uses modern CSS features (OKLCH color space) for better color accuracy

## Implementation Notes

- Colors are defined in `src/index.css` using CSS custom properties
- Primary color is used for all interactive elements (buttons, links, focus states)
- Dark mode support is included with adjusted blue tones
- All colors use OKLCH color space for better perceptual uniformity

## References

- Official HKRA Website: https://hkra.org.hk
- Color analysis performed: November 2025
- Primary color extracted from website navigation links









