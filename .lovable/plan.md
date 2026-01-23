
# Bursary-KE Platform Implementation Plan

## Overview
Building a comprehensive bursary application platform for Kenyan students with a Kenyan/African school theme. The platform will feature a public-facing application portal, application tracking system, and admin dashboards with privacy-focused design.

---

## Phase 1: Theme & Design System Setup

### Custom Color Palette
Update the Tailwind configuration and CSS variables to incorporate Kenyan flag colors:
- **Kenya Green**: #006600 (primary actions, success states)
- **Kenya Red**: #D21034 (accents, highlights)
- **Kenya Black**: #000000 (text, headers)
- **Kenya White**: #FFFFFF (backgrounds, cards)

### Typography & Visual Elements
- Add Inter or Poppins font for modern, readable text
- Configure soft shadows and rounded corners (0.75rem radius)
- Create gradient overlays using Kenya colors
- Add custom animations for smooth transitions

---

## Phase 2: Component Architecture

### Reusable Components to Create

```text
src/components/
+-- layout/
|   +-- Header.tsx           (Logo, navigation, mobile menu)
|   +-- Footer.tsx           (Contact info, social links, legal)
+-- home/
|   +-- HeroSection.tsx      (Full-width hero with overlay)
|   +-- StatCard.tsx         (Dashboard stat cards)
|   +-- ReviewCarousel.tsx   (Beneficiary testimonials)
|   +-- TrackingSection.tsx  (Application tracker input)
|   +-- FAQSection.tsx       (Accordion-based FAQ)
+-- application/
|   +-- ApplicationStepper.tsx    (Multi-step progress indicator)
|   +-- ParentGuardianForm.tsx    (Step 1: Parent info)
|   +-- StudentInfoForm.tsx       (Step 2: Student details)
|   +-- PovertyQuestionnaire.tsx  (Step 3: Interactive assessment)
|   +-- ReviewSubmit.tsx          (Step 4: Summary & submit)
|   +-- SuccessModal.tsx          (Tracking number display)
+-- tracking/
|   +-- TrackingInput.tsx    (Tracking number validator)
|   +-- ProgressStages.tsx   (Visual progress timeline)
+-- admin/
|   +-- SummaryCard.tsx      (Aggregated stat cards)
|   +-- DistributionChart.tsx (Pie/bar charts)
```

---

## Phase 3: Page Structure

### Pages to Create

| Page | Route | Description |
|------|-------|-------------|
| Homepage | `/` | Hero, stats, reviews, tracking, FAQ |
| Apply (Secondary) | `/apply/secondary` | Multi-step form for secondary students |
| Apply (University) | `/apply/university` | Multi-step form for university students |
| Track Application | `/track` | Dedicated tracking page |
| FAQ | `/faq` | Full FAQ page |
| Admin Dashboard | `/admin` | Summary-only analytics (no PII) |

---

## Phase 4: Homepage Implementation

### Header Component
- Bursary-KE logo with Kenya colors
- Navigation: Home, Apply, Track, FAQ
- Mobile hamburger menu with smooth slide animation

### Hero Section
- Full-width background with African students imagery
- Dark gradient overlay for text readability
- Tagline: "Empowering Kenyan Students Through Transparent Bursaries"
- CTA buttons: "Apply Now" and "Track Application"

### Statistics Dashboard
Three visually distinct cards showing:
1. **Total Distributed**: KES 25,000,000+ (animated counter)
2. **Total Beneficiaries**: 5,000+ students
3. **Success Rate**: 95% satisfaction

### Reviews Carousel
- Horizontal scrollable carousel using Embla Carousel
- Anonymized testimonials (e.g., "M***a K. - Kiambu County")
- Auto-play with manual navigation dots

### Application Tracking Widget
- Input field with validation (format: BKE-XXXXXX)
- "Track" button with loading state
- Inline results showing current stage

### FAQ Accordion
- 6-8 common questions
- Smooth expand/collapse animations
- Kenya-themed styling

### Footer
- Contact information
- Privacy policy link
- Social media icons

---

## Phase 5: Multi-Step Application Form

### Step 1: Parent/Guardian Information
- **National ID Field**: 8-digit validation, auto-masks display
- **Phone Number**: +254 format, encryption notice shown
- **Email**: Optional with consent checkbox
- Visual indicator: "Your data is encrypted and protected"

### Step 2: Student Information

**For Secondary Students:**
- NEMIS ID input (validation pattern)
- Auto-display masked name (e.g., "John D***")
- Class/Form dropdown (Form 1-4)
- School name with searchable dropdown

**For University/College Students:**
- Student ID input
- Institution dropdown (searchable, 100+ options)
- Course/Program field
- Year of study

### Step 3: Poverty Assessment Questionnaire
Interactive questions with sliders and multiple-choice:
1. Household income bracket (slider)
2. Number of dependents
3. Type of housing
4. Access to utilities
5. Parental employment status
6. Other children in school

Each answer contributes to internal scoring (Low/Medium/High priority).

### Step 4: Review & Submit
- Summary card with all masked information
- Checkbox: "I confirm this information is accurate"
- Submit button with loading state
- Success modal with tracking number (BKE-XXXXXX)

---

## Phase 6: Application Tracking System

### Tracking Page Features
- Large input field for tracking number
- Validation: BKE-XXXXXX format
- Error states for invalid/not-found numbers

### Progress Timeline Visual
Stages displayed as connected nodes:
1. Application Received (green checkmark when complete)
2. Under Review
3. Verification
4. Approved/Rejected
5. Funds Disbursed

Each stage shows date and brief status message.

---

## Phase 7: Admin Dashboard (Summary Only)

### Dashboard Cards
- Total Applications: Count with trend indicator
- Approved Applications: Count and percentage
- Total Budget Disbursed: KES formatted
- Pending Reviews: Count

### Visualization Charts (using Recharts)
- **Pie Chart**: Poverty tier distribution
- **Bar Chart**: Applications by county
- **Line Chart**: Monthly application trends

### Privacy Compliance
- No individual records visible
- Only aggregated statistics
- Role-based access preparation

---

## Phase 8: Security & Privacy Implementation

### Data Masking Utilities
```text
maskName("John Kamau")     -> "John K***"
maskId("12345678")         -> "*****678"
maskPhone("+254712345678") -> "+254***678"
```

### Form Security
- Client-side validation with Zod schemas
- Input sanitization for all fields
- Rate limiting preparation
- CSRF protection ready

### Consent Management
- Clear opt-in checkboxes
- Privacy policy modal
- Data usage explanation

---

## Phase 9: State Management & Data Flow

### React State Approach
- Form state: React Hook Form with Zod validation
- Application state: React Context for multi-step form
- UI state: Local component state

### Mock Data Layer
Create mock data utilities for demonstration:
- Sample statistics
- Sample tracking responses
- Sample testimonials
- Institution lists

---

## Phase 10: Responsive Design

### Mobile-First Approach
- Collapsible navigation
- Stacked form layouts
- Touch-friendly sliders
- Swipeable carousel

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

---

## Technical Implementation Details

### Files to Create

**Theme & Configuration:**
- Update `src/index.css` with Kenya theme colors
- Update `tailwind.config.ts` with custom colors

**Layout Components:**
- `src/components/layout/Header.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/layout/MobileNav.tsx`

**Homepage Components:**
- `src/components/home/HeroSection.tsx`
- `src/components/home/StatCard.tsx`
- `src/components/home/StatsSection.tsx`
- `src/components/home/ReviewCarousel.tsx`
- `src/components/home/TrackingWidget.tsx`
- `src/components/home/FAQSection.tsx`

**Application Components:**
- `src/components/application/ApplicationStepper.tsx`
- `src/components/application/ParentGuardianForm.tsx`
- `src/components/application/SecondaryStudentForm.tsx`
- `src/components/application/UniversityStudentForm.tsx`
- `src/components/application/PovertyQuestionnaire.tsx`
- `src/components/application/ReviewSubmit.tsx`
- `src/components/application/SuccessModal.tsx`
- `src/components/application/ConsentModal.tsx`

**Tracking Components:**
- `src/components/tracking/TrackingInput.tsx`
- `src/components/tracking/ProgressTimeline.tsx`
- `src/components/tracking/TrackingResult.tsx`

**Admin Components:**
- `src/components/admin/SummaryCard.tsx`
- `src/components/admin/PovertyDistributionChart.tsx`
- `src/components/admin/ApplicationsChart.tsx`

**Pages:**
- `src/pages/Index.tsx` (Homepage - update existing)
- `src/pages/ApplySecondary.tsx`
- `src/pages/ApplyUniversity.tsx`
- `src/pages/Track.tsx`
- `src/pages/FAQ.tsx`
- `src/pages/AdminDashboard.tsx`

**Utilities:**
- `src/lib/maskData.ts` (data masking functions)
- `src/lib/validationSchemas.ts` (Zod schemas)
- `src/lib/mockData.ts` (sample data)
- `src/lib/formatters.ts` (currency, date formatting)

**Context:**
- `src/context/ApplicationContext.tsx` (multi-step form state)

### Routes Configuration
Update `src/App.tsx` to include all new routes with proper navigation structure.

---

## Dependencies
All required packages are already installed:
- React Hook Form + Zod (form handling)
- Embla Carousel (testimonials)
- Recharts (admin charts)
- Radix UI components (accordion, dialog, progress, etc.)
- Lucide React (icons)

---

## Estimated Delivery
This implementation creates a fully functional frontend prototype. The platform will be ready for backend integration when Supabase/Lovable Cloud is connected for:
- User authentication
- Application data storage
- Tracking number generation
- Admin role management
