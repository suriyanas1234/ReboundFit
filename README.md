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

### 4. Supabase Database Setup (Cloud Sync)
The production PostgreSQL database schemas and migrations are located in:
- Core Schema: [`supabase/schema.sql`](supabase/schema.sql)
- Health Metrics Migration: [`supabase/migrations/20261012_health_metrics.sql`](supabase/migrations/20261012_health_metrics.sql)

To apply:
1. Open your project dashboard on [Supabase.com](https://supabase.com).
2. Navigate to the **SQL Editor**.
3. Run the contents of `supabase/schema.sql` followed by `supabase/migrations/20261012_health_metrics.sql`.
4. All tables, Row Level Security (RLS) policies, indexes, and exercise library items will be provisioned.

---

## 🍏 Apple Health Setup Guide

Because web applications (PWAs) running in iOS Safari cannot access Apple's private HealthKit database directly via client-side JavaScript, ReboundFit includes a dedicated, secure background webhook ingestion endpoint:
```
POST /api/integrations/apple-health
```

### 1. Retrieve Your Ingestion Credentials
1. Open ReboundFit on your iPhone or browser.
2. Tap your **Profile Avatar** in the top navigation bar to open **Settings**.
3. Scroll to the **Apple Health Integration** card:
   - **Webhook Endpoint URL**: Tap **Copy** (e.g., `https://your-domain.vercel.app/api/integrations/apple-health`).
   - **Personal Sync Token**: Tap **Copy** (e.g., `rf_ah_xxxxxxxxxxxxxxxx`).
4. *(Optional)* Tap **"Send Test Sync"** to verify that sample health metrics populate on your **Summary** tab immediately.

---

### 2. Connection Methods

#### Option A: Native iOS Shortcuts App (Recommended, Automated & Free)
Use Apple's built-in **Shortcuts** app on your iPhone to automatically send your steps, sleep, and heart rate every morning.

1. Open the **Shortcuts** app on your iPhone and tap **`+`** (top right) to create a new shortcut named **"Sync to ReboundFit"**.
2. Add the following HealthKit actions:
   - **"Find Health Samples"**:
     - Type: `Steps` | Start Date: *Start of Today* $\rightarrow$ Add action **"Calculate Statistics"** (Sum).
   - **"Find Health Samples"**:
     - Type: `Active Energy` | Start Date: *Start of Today* $\rightarrow$ Add action **"Calculate Statistics"** (Sum).
   - **"Find Health Samples"**:
     - Type: `Resting Heart Rate` | Sort by: *Date (Latest)* | Limit: *1*.
   - **"Find Health Samples"**:
     - Type: `Sleep Analysis` | Start Date: *Between yesterday 6:00 PM and today 12:00 PM* $\rightarrow$ Sum hours.
3. Add a **"Dictionary"** action with the collected values:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `step_count` | Steps Sum | Daily step count |
   | `active_energy_burned_kcal` | Active Energy Sum | Active calories burned (kcal) |
   | `resting_heart_rate_bpm` | Heart Rate Sample | Latest resting heart rate (BPM) |
   | `sleep_hours` | Sleep Hours Sum | Total hours asleep |
4. Add the **"Get Contents of URL"** action:
   - **URL:** Paste your Webhook URL (`https://your-domain.vercel.app/api/integrations/apple-health`)
   - **Method:** `POST`
   - **Headers:**
     - Key: `Content-Type` $\rightarrow$ Value: `application/json`
     - Key: `Authorization` $\rightarrow$ Value: `Bearer <Your_Sync_Token>`
   - **Request Body:** Choose `JSON` and select your Dictionary from step 3.
5. **Automate It:**
   - Tap the **Automation** tab in Shortcuts $\rightarrow$ tap **`+`**.
   - Select **Time of Day** (e.g., 8:00 AM or "When Waking Up").
   - Set to **Run Immediately** (runs quietly in the background without prompting).
   - Select your **"Sync to ReboundFit"** shortcut.

---

#### Option B: "Health Auto Export" App (Plug & Play, 30 Seconds)
If you prefer not building an iOS shortcut:
1. Download **[Health Auto Export](https://apps.apple.com/app/health-auto-export-csv-gpx/id1115569102)** from the iOS App Store.
2. In the app, go to **Automations** $\rightarrow$ **REST API Sync**.
3. Fill in the fields:
   - **Endpoint URL:** Paste your ReboundFit Webhook URL.
   - **Headers:** Add header `Authorization` with value `Bearer <Your_Sync_Token>`.
   - **Data to Export:** Enable *Step Count*, *Active Energy*, *Basal Energy*, *Resting Heart Rate*, and *Sleep Analysis*.
   - **Cadence:** Set to Background Sync (Hourly or Daily).
4. Tap **Test / Export Now**. ReboundFit's backend automatically normalizes the Health Auto Export payload format.

---

### Synced Metrics in the Summary Tab
- 🏃 **Daily Steps & Distance**: Progress ring toward your 10,000-step daily goal.
- 🔥 **Total Caloric Burn**: Active burn + basal energy (feeds directly into dynamic TDEE calculations).
- 😴 **Sleep Analysis**: Total sleep hours and deep sleep breakdown.
- ❤️ **Resting Heart Rate**: Latest BPM vitals benchmark.

---

## 💾 Data Storage & Hybrid Architecture

ReboundFit operates on a **Local-First, Cloud-Synced Hybrid Architecture**:

```mermaid
flowchart TD
    subgraph Client["Your Device (iPhone / PWA / Browser)"]
        UI["ReboundFit UI"]
        Dexie["IndexedDB (Dexie.js)\n'ReboundFitLocalDB'"]
    end

    subgraph Cloud["Cloud Backend (Supabase)"]
        PG["PostgreSQL Database\nRow-Level Security (auth.uid = user_id)"]
    end

    subgraph Integrations["Connected Services"]
        GCal["Google Calendar REST API\n(Your Primary Calendar)"]
        AppleH["Apple Health / HealthKit\n(Webhook Ingestion)"]
    end

    UI -->|Instant Read/Write (0ms)| Dexie
    Dexie <-->|Two-Way Sync (useCloudSync)| PG
    UI -->|Sync Week / Clear Cal| GCal
    AppleH -->|Automated POST Webhook| PG
```

### 1. Local Device Storage: IndexedDB (`ReboundFitLocalDB`)
- **Engine:** Dexie.js (`src/lib/db.ts`)
- **Purpose:** 100% offline functionality, optimistic instant updates, and zero UI latency in the gym.
- **Local Tables:**
  - `profiles`: User measurements, unit preference (`lbs`/`kg`), targets, Apple Health token, Google Calendar sync settings.
  - `weighIns`: Daily scale weight, 7-day EMA trend weight, weekly rate of gain.
  - `mealLogs`: Caloric intake and macronutrient breakdown (protein, carbs, fats).
  - `workouts` & `workoutSets`: Routines, exercises, sets, weights, reps, warmup tags, and PR records.
  - `scheduledWorkouts`: 7-day routine schedule, time blocks, and Google Calendar event IDs.
  - `healthMetrics`: Cached Apple Health steps, distance, active/basal burn, sleep, and resting heart rate.
  - `photos`: Progress photos and poses.
  - `syncQueue`: Offline-to-cloud change queue.

### 2. Remote Cloud Storage: Supabase PostgreSQL
- **Security:** Strict PostgreSQL **Row-Level Security (RLS)** linked to your authenticated Google user (`auth.uid() = user_id`). No other user can access your data.
- **Tables:**
  - `public.profiles`: Master athlete profile and `apple_health_sync_token`.
  - `public.weigh_ins`: Master weigh-in records with unique date constraints.
  - `public.meal_logs`: Nutrition entries and macro history.
  - `public.workouts` & `public.workout_sets`: Weight room logbook and progressive overload history.
  - `public.health_metrics`: Webhook-ingested Apple Health vitals with unique `(user_id, date)` constraint.
  - `public.progress_photos`: Photo records and Supabase Storage bucket assets.

### 3. External Services
- **Google Calendar:** Synced workout schedule blocks created via Google Calendar REST API v3 using your Google OAuth provider token.
- **Apple Health:** Ingested via `/api/integrations/apple-health` and written simultaneously to Supabase and your local device.

### 4. Background Sync Engine (`useCloudSync.tsx`)
- **Writes:** Saves to local IndexedDB instantly, then pushes mutations to Supabase in the background.
- **Reads:** Fetches updates on app launch and seamlessly merges them into local storage without full-page reloads.
- **Offline Resilience:** If offline, actions queue locally and automatically synchronize when a connection is restored.
