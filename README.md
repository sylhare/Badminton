# 🏸 Badminton Court Manager

A React TypeScript application that helps organize badminton players into court assignments using manual or image-based player list extraction.

## Features

- **📸 Image Upload & OCR**: Take a picture of a player list and automatically extract names using Tesseract.js
- **✍️ Manual Player Entry**: Add players manually - one at a time or multiple at once
- **👥 Player Management**: Toggle player presence, remove players
- **🏆 Optimised Court Assignment**: Automatically assigns players to courts using a cost-based engine that maximises fairness over time
  - Doubles (4 players) preferred
  - Singles (2 players) for odd numbers
  - Automatic bench assignment for extra players
- **🔄 Team Rotation**: Rotate team compositions on a court without reshuffling everyone
- **📱 Responsive Design**: Works on desktop and mobile devices

## How It Works

### Get started

1. **Add Players**: 
   - **From Image**: Take a photo or upload an image of your player list for automatic OCR extraction
   - **Manual Entry**: Add players one by one or paste multiple names (comma or line separated)
2. **Manage Players**: Check/uncheck players who are present, remove players as needed
3. **Set Courts**: Configure the number of available courts
4. **Generate Assignments**: Click to assign players to courts

### 🧮 Algorithm Rules & Fairness

The court-assignment engine aims to give everyone a fun, varied and fair session.  It does this by turning each candidate set of courts into a *cost* and repeatedly searching for the lowest-cost layout.  The cost function is made up of the rules below – lower cost means "more desirable".

1. **Bench rotation fairness** – players who have sat out more often get priority to play next, ensuring everyone gets equal court time.
2. **Singles match rotation fairness** – when player numbers are odd and singles matches are needed, players who have played fewer singles matches get priority, ensuring no one plays singles twice before everyone has played singles once.
3. **Partner variety** – players who have already been teammates many times are less likely to be paired again, so everyone plays with different partners.
4. **Opponent variety** – players who have faced each other frequently are less likely to be opponents again, giving variety in who you play against.
5. **Balanced matches**  
   • Players with many wins avoid being paired together (preventing "super teams").  
   • Players with many losses avoid being paired together (preventing weak teams).  
   • When two teams face each other, their skill levels are matched so games stay competitive (avoiding mismatches like strong winners vs. weak losers).
6. **Proper game formats** – courts always have either singles (2 players) or doubles (4 players), never 3 players.
7. **Optimal team pairings** – for each doubles match, the system tries all possible team combinations and picks the fairest pairing.

These rules are layered on top of the basic constraints:

* **Doubles preferred** – courts of 4 players are created whenever possible.
* **Singles fallback** – courts of 2 players are allowed when numbers are odd.
* **Bench** – any surplus players are rotated to the bench.

Over time, the history-based penalties push the system towards an even distribution of partners, opponents, singles matches, and results.

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
- Click "Generate Assignments" to assign players to courts
- Click "Generate New Assignments" to reassign with updated history

## Algorithm Analysis

The `analysis/` folder contains simulation scripts and notebooks that benchmark the court assignment algorithms against each other. See [`analysis/README.md`](analysis/README.md) for setup and usage.

## Contributing

See [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) for development setup and available scripts.

## License

[AGPL-3.0](LICENSE) © sylhare
