# HMG Intranet

A highly functional, custom-crafted personal homepage and command dashboard. Tailored for homelab administrators, it aggregates secure container access, real-time localized weather bulletins, upcoming space telemetry tracking, and filtered news intelligence into a unified, dark-themed responsive layout.

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
- **Interactive Multi-Channel Scraper**: Utilizes multi-stage client-side browser CORS proxies to scrape live Atom and RSS feeds from premium platforms like The Guardian, TechCrunch, Sky News, Eurogamer, and Space.com.
- **Robust Built-in Fallbacks**: Features complete offline mock items for each category to ensure a polished visual canvas even during offline or network-congested states.
- **Boxing Category Glove Icon**: Embellished with an intuitive 🥊 branding.

---

## 🛠️ Tech Stack & Architecture

- **Core Framework**: React 18+ with TypeScript typings.
- **Build System**: Vite with dynamic asset compilation.
- **Styling**: Tailwind CSS utility classes using `@import` theme setups.
- **Icon Library**: Custom crisp vector glyphs fully powered by `lucide-react`.

---

## 🔧 Getting Started & Development

To launch the dashboard server environments:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Production Compilation**:
   ```bash
   npm run build
   ```
