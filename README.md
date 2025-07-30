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

### Assignment Logic

- **Doubles (4 players per court)**: Preferred format with 2 teams of 2 players each
- **Singles (2 players per court)**: Used when odd numbers of players
- **Bench**: Extra players are randomly assigned to the bench
- **Waiting**: For 3 players on a court, one waits while two play singles

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