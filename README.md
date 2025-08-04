# 🏸 Badminton Court Manager

A React TypeScript application that helps organize badminton players into court assignments using image-based player list extraction.

## Features

- **📸 Image Upload & OCR**: Take a picture of a player list and automatically extract names using Tesseract.js
- **✍️ Manual Player Entry**: Add players manually - one at a time or multiple at once
- **👥 Player Management**: Toggle player presence, remove players
- **🎲 Random Team Generation**: Automatically create "fair" team assignments
- **🏆 Smart Court Assignment**: 
  - Doubles (4 players) preferred
  - Singles (2 players) for odd numbers
  - Automatic bench assignment for extra players
- **📱 Responsive Design**: Works on desktop and mobile devices

## How It Works

1. **Add Players**: 
   - **From Image**: Take a photo or upload an image of your player list for automatic OCR extraction
   - **Manual Entry**: Add players one by one or paste multiple names (comma or line separated)
2. **Manage Players**: Check/uncheck players who are present, remove players as needed
3. **Set Courts**: Configure the number of available courts
4. **Generate Assignments**: Click to randomly assign players to courts

### Usage Tips

#### Image Upload
- Take clear photos with good lighting
- Ensure names are clearly visible and separated (one per line works best)
- Supported formats: PNG, JPG, JPEG, WebP
- The OCR will attempt to filter out non-name text automatically

#### Manual Entry
- **Single Player**: Use the text input to add one player at a time
- **Multiple Players**: Use the textarea to add many players at once
    - Separate names with commas: `John Doe, Jane Smith, Mike Johnson`
    - Or use new lines (one name per line)
    - Mix and match: paste a list from anywhere!

#### Player Management
- Uncheck players who aren't present today
- Remove players using the ✕ button
- Players can be added from either image OCR or manual entry (or both!)

#### Court Generation
- Set the number of available courts
- Click "Generate Random Assignments" to create new team combinations
- Click "Generate New Assignments" to shuffle players again

### 🧮 Algorithm Rules & Fairness

The court-assignment engine aims to give everyone a fun, varied and fair session.  It does this by turning each candidate set of courts into a *cost* and repeatedly searching for the lowest-cost layout.  The cost function is made up of the rules below – lower cost means “more desirable”.

1. **Bench rotation fairness** – players with fewer previous bench stints are prioritised for court time.
2. **Minimise repeated team-mates** – two players who have already been on the same side several times incur a penalty when teamed up again.
3. **Minimise repeated opponents** – the same logic applies to players facing each other across the net.
4. **Result balancing**  
   • The more *wins* a player already has, the less desirable it is to partner them with another high-win player.  
   • Likewise, the more *losses* a player has, the less desirable it is to partner them with another high-loss player.  
   • After teams are formed the engine penalises a court where one team has a much higher total number of wins (or losses) than the other – discouraging “winners vs. losers” mismatches.
5. **No 3-player courts** – a court will always host either 2 (singles) or 4 (doubles) players.
6. **Best team split** – for every group of 4 players the engine evaluates all three possible 2-player combinations and keeps the one with the lowest cost.

These rules are layered on top of the basic constraints:

* **Doubles preferred** – courts of 4 players are created whenever possible.
* **Singles fallback** – courts of 2 players are allowed when numbers are odd.
* **Bench** – any surplus players are rotated to the bench.

Because the optimiser is stochastic there is always an element of randomness, but over time the history-based penalties push the system towards an even distribution of partners, opponents **and** results.

## Get Started

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run unit tests