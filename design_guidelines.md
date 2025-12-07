# Design Guidelines - Sistema de Gestão de Assinaturas

## Design Approach

**Reference-Based**: Drawing inspiration from modern SaaS leaders (Linear, Stripe, Notion) to create a professional, clean interface that balances visual appeal with functional clarity.

**Core Principle**: Clarity and efficiency for admin tools; engagement and trust-building for public-facing pages.

---

## Typography System

**Font Stack**: 
- Primary: Inter (Google Fonts) - body text, UI elements
- Display: Plus Jakarta Sans (Google Fonts) - headings, hero text

**Hierarchy**:
- Hero Headlines: text-5xl md:text-7xl font-bold tracking-tight
- Section Headings: text-3xl md:text-4xl font-semibold
- Subsections: text-xl md:text-2xl font-medium
- Body Large: text-lg leading-relaxed
- Body Standard: text-base leading-relaxed
- UI Labels: text-sm font-medium
- Captions: text-xs text-muted

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 8, 12, 16, 20, 24 exclusively for consistency.

**Grid Structure**:
- Landing pages: max-w-7xl mx-auto px-4 md:px-8
- Admin panels: max-w-screen-2xl mx-auto px-4
- Forms/Content: max-w-4xl mx-auto
- Reading content: max-w-prose

**Section Padding**: 
- Mobile: py-12 to py-16
- Desktop: py-20 to py-32

---

## Landing Pages Structure

### Home Page (7 sections)

1. **Hero Section** (80vh, centered)
   - Large hero image (modern office/tech workspace, professional team collaborating)
   - Overlay with gradient for text readability
   - Headline + subheadline + 2 CTAs (primary "Começar Grátis", secondary "Ver Demo")
   - Trust indicator below CTAs: "Mais de 1.000 empresas confiam em nós"

2. **Features Grid** (3 columns on desktop, stack mobile)
   - Icon + Title + Description for each feature
   - Icons: Heroicons (outline style)
   - Features: Gestão de Usuários, Controle de Assinaturas, Geração de Artefatos IA

3. **Artefatos Tool Preview** (2-column: left image/mockup, right explanation)
   - Screenshot/mockup of the tool interface
   - Feature breakdown with checkmarks
   - "Ver Ferramenta" CTA

4. **Pricing Section** (3-column comparison table)
   - Cards for Free, Plus, Premium side-by-side
   - Highlighted "Most Popular" badge on Plus
   - Feature lists with check/x icons
   - CTAs at bottom of each card

5. **Social Proof** (3-column testimonial grid)
   - User avatar + name + company + quote
   - Rating stars
   - Company logos below

6. **About Preview** (asymmetric 40/60 split)
   - Left: Team image or company values graphic
   - Right: Mission statement, stats (3 key metrics in grid)

7. **Final CTA Section** (centered, generous padding)
   - Bold headline "Pronto para começar?"
   - Subtitle + primary CTA
   - No-credit-card-required badge

### Pricing Page
- Expanded comparison table with all features listed
- FAQ accordion below pricing
- Feature tooltips for clarity

### About Page
- Team section with photos in masonry grid
- Company timeline/milestones
- Values cards (2x2 grid)

### Tools Page
- Tool cards showcasing Artefatos and future tools
- Each card: Icon, name, description, "Disponível em [plan]" badge
- Filter/tabs by subscription level

---

## Admin Dashboard Layout

**Sidebar Navigation** (fixed, 240px width)
- Logo at top
- Navigation items with icons (Heroicons)
- User profile at bottom
- Sections: Dashboard, Usuários, Perfis, Planos, Ferramentas

**Main Content Area**
- Top bar: Breadcrumbs + user menu
- Page header: Title + actions (buttons right-aligned)
- Content cards with subtle borders, rounded-lg, p-8

**Data Tables**:
- Sticky header row
- Zebra striping (subtle)
- Row actions on hover
- Pagination at bottom
- Search + filters in toolbar above table

**Forms** (max-w-2xl):
- Generous field spacing (space-y-8)
- Label above input
- Helper text below
- Inline validation messages
- Actions at bottom-right (Cancel, Save)

---

## Artefatos Tool Interface

**Layout**: Single-page workflow (max-w-4xl centered)

1. **Checkbox Group** (2-column grid on desktop)
   - Large, clear checkboxes with icons
   - Each option: Icon + Label + brief description
   - Options: Regras de Negócio, Pontos de Ação, Encaminhamentos, Pontos Críticos

2. **Transcription Input** (full-width)
   - Large textarea (min-h-64)
   - Character counter
   - Placeholder text with example

3. **Action Area**
   - Processing indicator when generating
   - Generate button (prominent, disabled until criteria met)
   - Generated PDFs appear as download cards below

---

## Component Library

**Buttons**:
- Primary: rounded-lg px-8 py-4 font-semibold text-base
- Secondary: outlined variant
- Ghost: text-only with hover background
- Icon buttons: square, p-2

**Cards**:
- Standard: rounded-xl border p-8 shadow-sm
- Hover states: subtle lift (shadow-lg)
- Feature cards: icon at top, centered text

**Forms**:
- Input fields: rounded-lg border p-4 text-base
- Focus: border highlight + subtle shadow
- Error states: red border + error message below

**Navigation**:
- Horizontal (landing): sticky top-0, transparent until scroll
- Desktop: full menu visible
- Mobile: hamburger menu (slide-out drawer)

**Modals**: Centered, max-w-2xl, backdrop blur, rounded-2xl

**Icons**: Heroicons (outline for navigation, solid for emphasis)

---

## Responsive Behavior

**Breakpoints**:
- Mobile: < 768px (single column, stacked)
- Tablet: 768px - 1024px (2 columns)
- Desktop: > 1024px (full layout)

**Admin Sidebar**: Collapses to icon-only on tablet, hidden drawer on mobile

**Tables**: Horizontal scroll on mobile with sticky first column

---

## Images

**Hero Image**: Full-width background image of modern, diverse team collaborating in bright office space with laptops. Professional, aspirational tone. Position: center/cover.

**Features Section**: Abstract tech/data visualization graphics or UI mockups

**Tool Preview**: Screenshot of Artefatos interface showing checkboxes and text area

**About Page**: Team photos (authentic, candid), office environment

**Testimonials**: Customer headshots (circular crop)

All images should convey professionalism, diversity, and modern technology.

---

## Animation Guidelines

**Use Sparingly**:
- Page transitions: subtle fade-in
- Card hover: gentle scale (1.02) + shadow increase
- Button interactions: inherit default states
- Loading states: subtle pulse or spinner

**Avoid**: Scroll-triggered animations, parallax effects, excessive movement

---

## Accessibility

- Minimum touch target: 44x44px
- Form labels always visible
- Error messages associated with fields
- Keyboard navigation throughout
- Focus indicators on all interactive elements
- ARIA labels on icon-only buttons