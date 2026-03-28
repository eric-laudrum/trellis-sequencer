# Trellis Sequencer

This project uses NPM Workspaces and Concurrently to run the front and backend simultaneously

## Tech Stack

### Core Logic & UI
- React
- Tone.js

### Synchronization
- Socket.io
- Yjs

### Infrastructure
- Server-side logic:
  - Node.js & Express
- Database / storage
  - MongoDB / PostgresSQL


- Concurrently
- CORS
- 

## Run the application
- Navigate to the root directory
  bash
  npm run dev

### ngrok
bash
npm install -g ngrok

npm run server
ngrok http 4000

### multer
bash
npm install multer --workspace=server


  
## Checklist
### Sequencer
[X] 16 Pad grid
[X] Click to make pad active
[X] Active pad highlighted

### Controls
[X] Play
[X] Stop / Restart 
[X] Pause (keep position)

### Settings
[X] BPM
[X] Number of bars
[] Volume

### Features
[] Undo sample start time edit
[] Zoom on sample with +/- buttons instead of mouse drag
[] Chat section
[] Username selection
[] Profile picture
[] Identify user pad (unique colour)
  [] Default colours
  [] User selected colour




