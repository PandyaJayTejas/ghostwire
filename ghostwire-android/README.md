# GhostWire Android — Local Setup Guide

## What's This?
A standalone GhostWire node that runs on your Android device via **Termux**.
It connects to your Windows laptop over WiFi — no internet needed.

## Quick Setup (5 minutes)

### Step 1: Install Termux
Download Termux from **F-Droid** (recommended):
→ https://f-droid.org/packages/com.termux/

Or from the Play Store (may be outdated).

### Step 2: Install Node.js in Termux
Open Termux and run:
```bash
pkg update && pkg upgrade
pkg install nodejs
```

### Step 3: Copy this folder to your Android
Option A — USB cable:
  - Connect phone to PC via USB
  - Copy the entire `ghostwire-android` folder to your phone's storage
  - e.g., to `/storage/emulated/0/ghostwire-android/`

Option B — ADB push:
```bash
adb push ghostwire-android/ /storage/emulated/0/ghostwire-android/
```

### Step 4: Run the server
In Termux:
```bash
cd /storage/emulated/0/ghostwire-android
node server.js
```

You'll see:
```
⚡ GHOSTWIRE ANDROID NODE
📱 Open Chrome → http://localhost:8080
🔗 Desktop IP: Enter in the app
```

### Step 5: Open in Chrome
Open Chrome on your Android device and go to:
```
http://localhost:8080
```

### Step 6: Connect to Desktop
1. On your Windows laptop, run `npm run dev` in the GhostWire project
2. Note the IP address printed in the console (e.g., `192.168.1.5`)
3. In the Android app, enter that IP when prompted
4. You're connected! Start chatting.

### Step 7 (Optional): Install as App
In Chrome, tap the ⋮ menu → "Add to Home Screen" → GhostWire appears as an app.

## Folder Contents
```
ghostwire-android/
├── server.js        ← Tiny HTTP server (run with node)
├── index.html       ← Complete app (HTML + CSS + JS, all inline)
├── icon-192.png     ← App icon
├── manifest.json    ← PWA manifest
├── sw.js            ← Service worker
└── README.md        ← This file
```

## Troubleshooting

**"Cannot connect to desktop"**
- Make sure both devices are on the same WiFi
- Check that port 3848 is not blocked by Windows Firewall
- Try disabling Windows Firewall temporarily to test

**"Termux can't access storage"**
Run in Termux:
```bash
termux-setup-storage
```
Then grant the storage permission.

**"Node.js not found"**
```bash
pkg install nodejs-lts
```
