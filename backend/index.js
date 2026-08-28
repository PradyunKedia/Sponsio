const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store for players and profiles
// Maps address -> { address, description, username }
const playerData = {}; 

// Mock AI Username Generator
const generateUsername = (description) => {
    const keywords = ['Hacker', 'Ninja', 'Guru', 'Wizard', 'Maverick', 'Nomad', 'Phantom', 'Titan'];
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
    const randomNum = Math.floor(Math.random() * 9999);
    return `${randomKeyword}_${randomNum}`;
};

// Endpoint to register a player's text and generate a username
app.post('/register', (req, res) => {
    const { address, description } = req.body;
    
    if (!address || !description) {
        return res.status(400).json({ error: "Address and description are required." });
    }
    
    // Simulate AI delay
    setTimeout(() => {
        const username = generateUsername(description);
        
        playerData[address.toLowerCase()] = {
            address: address.toLowerCase(),
            description,
            username
        };
        
        res.json({ success: true, username, description });
    }, 500); // 500ms delay to simulate API call
});

// Endpoint to get all registered players (used for the leaderboard)
app.get('/players', (req, res) => {
    res.json(playerData);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
