---
name: Jacob Lin
description: A dark personal website for research, writing, and conversation.
colors:
    background: '#010204'
    text-primary: 'rgb(246 249 255 / 96%)'
    reading-text: '#d4d4d8'
    reading-heading: '#f4f4f5'
    reading-muted: '#a1a1aa'
    reading-link: '#a7f3d0'
    reading-link-hover: '#d1fae5'
    border-subtle: 'rgb(255 255 255 / 10%)'
    focus-ring: 'rgb(125 236 255 / 92%)'
typography:
    display:
        {
            fontFamily: 'Space Grotesk, SF Pro Display, Segoe UI, -apple-system, sans-serif',
            fontSize: 'clamp(2.75rem, 6vw, 4.5rem)',
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.035em'
        }
    article-title:
        {
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.035em'
        }
    article-body: { fontSize: '1.0625rem', lineHeight: 1.9 }
    navigation: { fontSize: '0.8125rem' }
rounded:
    image: '0.5rem'
    code-block: '0.75rem'
    composer: '1.7rem'
spacing:
    article-block: '1.5rem'
    reading-header: 'clamp(2.5rem, 6vw, 4rem)'
---

# Design System: Jacob Lin

## Overview

The existing identity uses a near-black canvas, geometric typography, subdued borders, and restrained colored links. Reading pages present text in open rows; the home conversation uses translucent rounded surfaces over an animated background.

## Colors

Pale emerald identifies reading links, active navigation, publication years, and venues. Zinc tones separate headings, body copy, and metadata. The home composer retains its pale sky-blue send control. Selection uses the reading-link background with dark green text.

## Typography

Space Grotesk is the shared display and body family. Index headings use the display role; article titles use the smaller responsive article-title role. List titles are medium weight, 1.25rem, increasing to 1.5rem for blog rows at 640px. Article section headings use weight 600 and line-height 1.35; h2 is 1.65rem and h3 is 1.3rem. Metadata is 0.875rem. Code uses SFMono-Regular, Consolas, monospace at 0.85em.

## Layout

The centered content shell is at most 61.25rem wide, with 1rem horizontal padding increasing to 2rem at 1024px. Reading indexes are at most 54rem; articles are at most 46rem. Reading-page vertical padding scales from 1rem to 3rem. Reading pages use normal document scrolling; home retains a viewport-height conversation layout and internal scrolling.

At 640px, publication years move into a 6rem left column with a 2rem gap, and blog dates move into a 10rem left column with a 1.5rem gap. Below that breakpoint, dates and years stack above their text. Article tables and code scroll horizontally when needed; images fit their container.

## Elevation & Depth

Reading pages are flat, separated by thin white borders at 12% opacity. Home uses translucent zinc surfaces, blur, and soft shadows; the composer shadow is 0 14px 32px rgb(0 0 0 / 28%). The sticky top bar uses a black background at 65% opacity and a subtle bottom border.

## Shapes

Reading lists are open, border-separated rows. Rounded shapes serve controls and contained content: pill-shaped chat actions, the composer radius, gently rounded article images, and bordered code blocks.

## Components

- Navigation: a 3.5rem sticky header holds the logo/name and persistent Publications/Blog links. Link targets are at least 44px tall; active links use emerald plus an underline. Blog remains active on article pages. The account menu appears on home, as a desktop popover or mobile bottom sheet.
- Reading links: underlined emerald text becomes lighter on hover. Blog rows are full-row links with a trailing arrow; publications provide title links and an explicit Read paper action.
- Articles: generous paragraph spacing, indented lists, emerald quote borders, subdued metadata, and an optional bordered table of contents. Section anchors clear the header with a 5rem scroll margin.
- Chat: translucent rounded composer, multiline input, pill-shaped send action, compact prompt chips, and rounded context-status cards.
- Interaction: keyboard focus uses a 2px cyan outline with 2px offset, with the brand link's own visible ring. Shared transitions use 160ms for controls and 220ms for layout, with cubic-bezier(0.16, 1, 0.3, 1); reduced-motion settings suppress animation.

## Do's and Don'ts

- Do preserve the shared typography, restrained palette, responsive reading widths, and visible keyboard focus.
- Do keep article prose, code, tables, and long titles readable on narrow screens.
- Don't apply the home's viewport-constrained chat scrolling to reading pages.
