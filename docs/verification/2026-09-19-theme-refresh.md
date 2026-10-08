# Hotelist-inspired EzMerch theme
User approved entire-site scope and light default with dark toggle.
Reference inspected in Chrome: JetBrains Mono, dark #0e0e0e background,
#f2f2f2 text, coral action buttons, dense rounded surfaces.

Implemented JetBrains Mono through next/font, semantic light/dark CSS tokens,
root next-themes provider (light default, persisted choice), accessible fixed
toggle, coral homepage accents, and image-led product cards with wrapped titles.
Existing store banner/header customization is preserved. Product images are not recolored.
The original self-referential --font-sans token was corrected.

Verified local homepage/storefront light/dark, saved choice across navigation,
and mobile sign-in at 390x844 in both themes. Viewport reset afterward.
TypeScript passes. New theme component lint passes; existing raw-image warnings remain.
Authenticated dashboard flows were not exercised; they inherit the shared root theme.
Production build and alias verification recorded in deployment logs.
Release: ezmerch-139d0mudo-9i9e.vercel.app.
