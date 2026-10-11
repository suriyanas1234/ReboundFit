# ReboundFit 🏋️‍♂️📈
> **Streamlined Personal Fitness & Dynamic TDEE Tracking for Lean Bulking & Body Recomposition**

ReboundFit is an offline-first Progressive Web Application (PWA) built with **Next.js (App Router)**, **Tailwind CSS**, and **Dexie.js (IndexedDB)**. It is tailored for lifters who want zero-friction tracking, smoothed weight trends, progressive overload logging, and standardized physique comparisons.

---

## ⚡ Key Features

- **Smart Scale Smoothing:** 7-day Exponential Moving Average (EMA, $\alpha = 0.20$) eliminates daily water weight and sodium panic spikes while classifying your rate of gain into the **Sweet Spot** (+0.25 to +0.50 lbs/week).
- **MacroFactor-Style Dynamic TDEE:** Calculates actual weekly expenditure from energy balance ($\Delta \text{Stored Energy} = \text{Energy In} - \text{TDEE}$) with exponential dampening ($\beta = 0.35$) and safety clamps.
- **Zero-Friction Nutrition Engine:** 3-second quick calorie + protein dial, bulking staples quick-picker, and 1-tap repetitive meal templates.
- **Progressive Overload Logger:** Displays previous session numbers directly inline next to each set (`Prev: 185 lbs × 8`), with an automatic rest timer (audio chime + haptics) and PR celebration alerts.
- **Standardized Photo Vault:** Semi-transparent ghost silhouette overlay (HTML5 camera feed with adjustable opacity) and side-by-side split comparison slider (Baseline vs Progress).
- **Local-First & PWA Native:** Instant sub-100ms writes to IndexedDB with optimistic UI; installable directly onto iPhone Home Screen without Safari URL bars (`display: standalone`).

---

## 🚀 Quick Start

### 1. Install & Run Locally
```bash
# Clone the repository
git clone https://github.com/your-username/ReboundFit.git
cd ReboundFit

# Install dependencies
npm install

# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on your browser.

---

### 2. Deploy to Vercel (1-Click Deployment)
1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Deploy! Next.js App Router and PWA manifests configure automatically out of the box.

---

### 3. Install as an iPhone PWA
1. Open your deployed Vercel URL in **Safari on iOS**.
2. Tap the **Share** button (box with an arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. Launch ReboundFit from your Home Screen — it will run full-screen without Safari browser chrome!

---

### 4. Supabase Database Setup (Optional Cloud Sync)
The production PostgreSQL database schema is located at:
[`supabase/schema.sql`](file:///C:/Users/Suriya/Downloads/ReboundFit/supabase/schema.sql)

To apply:
1. Open your project on [Supabase.com](https://supabase.com).
2. Go to the **SQL Editor**.
3. Paste the contents of `supabase/schema.sql` and run.
4. All tables, Row Level Security (RLS) policies, indexes, and seed exercises will be configured instantly.
