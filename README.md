# HMG Intranet

[![Live Site](https://img.shields.io/badge/Live%20Site-Vercel-black?style=for-the-badge)](https://hmgintranet.vercel.app/)

**Live URL**: [https://hmgintranet.vercel.app/](https://hmgintranet.vercel.app/)

A highly functional, custom-crafted personal homepage and command dashboard. Tailored for homelab administrators, it aggregates secure container access (via Tailscale), real-time localized weather bulletins, upcoming space telemetry tracking, and filtered news intelligence into a unified, dark-themed responsive layout.

---

## 🎨 Design Philosophy & Visual Identity

The interface is built with absolute precision on top of a midnight theme, designed to serve as an un-cluttered commanding terminal or wall-mounted dashboard:

- **Unified Cosmic Theme**: Utilizes soft off-blacks, deep charcoal cards (`#2b2d31`), and muted grays with high-visibility color-coded accents for alerts and warnings.
- **Responsive Dynamic Bento Layout**: Flows seamlessly from custom multi-column grids on wide desktop consoles to beautifully stacked mobile layouts.
- **Interaction Feedback**: Rich micro-interactions are integrated through subtle frame borders and state-aware hover scales to ensure intuitive tactile responsiveness.

---

## 🚀 Core Features & Widgets

### 1. Docker Shortcuts Container Hub
- **Instant Secure Endpoint Utility**: Consolidates custom links to active Unraid and homelab Docker containers configured with secure local Tailscale IP addresses.
- **Categorized Dashboard Hub**: Seamlessly maps services like Plex, Home Assistant, Nextcloud, and other critical infrastructure utilities with their current status.

### 2. Live Localized Weather Widget
- **Redruth & Cornwall Coordinates**: Integrated with a real-time Open-Meteo telemetry uplink targeted at Cornwall coordinates (`50.2333, -5.2333`).
- **Dynamic Weather Warning Index**: Programmatically fires intelligence-driven alerts (Gale Warnings, Torrential Rain Alerts, Snow/Ice bulletins, and Ground Frost notices) based on live real-time metrics.
- **Wind & Astronomy Tracks**: Displays current-hour wind speeds in mph, relative humidity metrics, and local sunrise/sunset timings.

### 3. SpaceX Starship Launch Manifest
- **Live Launch Countdown Clock**: Features a high-precision live-ticking countdown clock pointing to upcoming Starship Flight numbers.
- **SpaceX Telemetry API Integration**: Performs automated requests to SpaceX's official launch databases, seamlessly falling back to high-fidelity offline schedules when APIs are constrained.
- **Mission Specifications Profile**: Displays target dates, detailed mission profiles, and launch facility maps for future test sequences.

### 4. Grounded Multi-Source News Stream
- **Category Filter Rows**: Allows instantaneous in-memory navigation across World, Tech, Gaming, Space, and Boxing.
- **Hybrid Fetching**: Uses Vercel Serverless Functions (`/api/news`) for reliable server-side RSS scraping when available, with graceful fallback to client-side CORS proxies + rich offline mocks.
- **Robust Built-in Fallbacks**: Features complete offline mock items for each category to ensure a polished visual canvas even during offline or network-congested states.
- **Boxing Category Glove Icon**: Embellished with an intuitive 🥊 branding.

---

## 🛠️ Tech Stack & Architecture

- **Core Framework**: React 19 + TypeScript.
- **Build System**: Vite 6 with dynamic asset compilation.
- **Styling**: Tailwind CSS v4 utility classes.
- **Icon Library**: lucide-react.
- **Auth**: Clerk + GitHub OAuth (hard allowlist for personal use).
- **Hosting**: Vercel — static Vite build + Serverless Functions (`/api/news`, `/api/weather`) for reliable data fetching.
- **No long-running server** in production. The old `server.ts` (Express) is kept only for optional local experimentation.

---

## 🔧 Getting Started & Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server** (static + client fallbacks):
   ```bash
   npm run dev
   ```

3. **Full local simulation with serverless functions** (recommended for testing `/api/*`):
   ```bash
   npx vercel dev
   ```

4. **Type check**:
   ```bash
   npm run lint
   ```

5. **Production build**:
   ```bash
   npm run build
   ```

### Environment Variables

- Copy `.env.example` → `.env` for local development.
- The only required variable is `VITE_CLERK_PUBLISHABLE_KEY` (from your Clerk dashboard).
- On Vercel: Project Settings → Environment Variables → add `VITE_CLERK_PUBLISHABLE_KEY` for **Production** and **Preview** scopes.

---

## 🚀 Deployment

This project is deployed on Vercel as a **static site + serverless functions**.

- Every push to `main` deploys to production.
- Every push to any other branch (or PR) automatically creates a preview deployment with a unique URL.
- Serverless functions in `/api` (`news.ts`, `weather.ts`) provide reliable RSS fetching without CORS proxy fragility.
- The old Express `server.ts` is **not used** in the Vercel deployment.

Live: https://hmgintranet.vercel.app/

---

## 📜 License

Personal project — © DJDH98, Redruth, Cornwall, UK.
