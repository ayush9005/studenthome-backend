// Fix for older NeDB compatibility with newer Node versions
const util = require('util');
if (!util.isDate) {
    util.isDate = (obj) => Object.prototype.toString.call(obj) === '[object Date]';
}

const express = require('express');
const cors = require('cors');
const Datastore = require('nedb');

const app = express();
// CHANGED: Set default to 10000 which Render prefers natively
const PORT = process.env.PORT || 10000; 

// =========================================================================
// MIDDLEWARE CONFIGURATION
// =========================================================================
// CHANGED: Explicitly configure CORS to trust your GitHub Pages frontend
app.use(cors({
    origin: 'https://ayush9005.github.io',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json()); // Parses incoming JSON text payloads safely

// 1. IN-MEMORY DATA STORES (Safe from OS file lock problems)
const db = new Datastore();          // Datastore for PG properties
const authDb = new Datastore();      // Dedicated Datastore for Registered Users

// Default Root Route (Added so you don't see "Cannot GET /" if you visit the link directly)
app.get('/', (req, res) => {
    res.send('StudentHome Backend Server is running successfully!');
});

// =========================================================================
// AUTHENTICATION ENDPOINTS (REGISTER, LOGIN, & USER RETRIEVAL)
// =========================================================================

// POST Route: Handle User Registration safely checking for duplicates
app.post('/api/auth/register', (req, res) => {
    console.log("=== REGISTRATION ATTEMPT RECEIVED ===");
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
        return res.status(400).json({ error: "Missing required registration parameters." });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if the user already exists in the datastore
    authDb.findOne({ email: cleanEmail }, (err, existingUser) => {
        if (err) return res.status(500).json({ error: "Server authentication check failed." });
        
        if (existingUser) {
            return res.status(400).json({ error: "Email already registered. Simply login!" });
        }

        const newUser = {
            fullName: fullName.trim(),
            email: cleanEmail,
            password: password // In production, hash this using bcrypt!
        };

        authDb.insert(newUser, (err, savedUser) => {
            if (err) return res.status(500).json({ error: "Failed to write user to system memory." });
            
            console.log("✓ New user registered safely:", savedUser.email);
            return res.status(201).json({
                message: "Registration successful!",
                user: { fullName: savedUser.fullName, email: savedUser.email }
            });
        });
    });
});

// POST Route: Verify credentials and log user inside session state
app.post('/api/auth/login', (req, res) => {
    console.log("=== LOGIN ATTEMPT RECEIVED ===");
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required fields." });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Look up the corresponding dataset target
    authDb.findOne({ email: cleanEmail }, (err, user) => {
        if (err) return res.status(500).json({ error: "Server authentication search failed." });
        
        // Check if user exists and password explicitly matches the plaintext entry string
        if (!user || user.password !== password) {
            return res.status(400).json({ error: "Invalid email address or password configuration." });
        }

        console.log("✓ User successfully logged in:", user.email);
        return res.status(200).json({
            message: "Login successful!",
            user: { fullName: user.fullName, email: user.email }
        });
    });
});

// GET Route: Pulls all registered student user profiles instantly for admin oversight
app.get('/api/auth/users', (req, res) => {
    console.log("=== FETCHING ALL REGISTERED USERS ===");
    authDb.find({}, (err, users) => {
        if (err) {
            return res.status(500).json({ error: "Failed to retrieve user registry dataset." });
        }
        
        // Map data to omit passwords from showing up over the wire for essential security
        const safeUsersList = users.map(user => ({
            id: user._id,
            fullName: user.fullName,
            email: user.email
        }));
        
        return res.status(200).json(safeUsersList);
    });
});


// =========================================================================
// PROPERTY LISTING ENDPOINTS
// =========================================================================

// GET Route: Pulls listings instantly
app.get('/api/properties', (req, res) => {
    db.find({}, (err, docs) => {
        if (err) return res.status(500).json({ error: "Failed to retrieve entries." });
        res.status(200).json(docs);
    });
});

// POST Route: Features explicit console tracking and safe fallbacks
app.post('/api/properties', (req, res) => {
    console.log("=== THUNDER CLIENT REQUEST DETECTED ===");
    console.log("Raw Request Body Received:", req.body);

    // Safeguard fields completely so NeDB never receives 'undefined'
    const nameData = req.body && req.body.name ? req.body.name : "Fallback Property Name";
    const locationData = req.body && req.body.location ? req.body.location : "Fallback Campus, DU";
    const priceData = req.body && req.body.price ? Number(req.body.price) : 9999;
    const ratingData = req.body && req.body.rating ? Number(req.body.rating) : 4.0;

    const newProperty = {
        name: nameData,
        location: locationData,
        price: priceData,
        rating: ratingData,
        image: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600"
    };

    console.log("Object prepared for insertion:", newProperty);

    db.insert(newProperty, (err, savedDoc) => {
        if (err) {
            console.error("!!! DATABASE INSERTION ERROR !!!:", err);
            return res.status(500).json({ error: "Database rejected the document insert.", details: err.message });
        }
        console.log("✓ Record successfully written to memory:", savedDoc);
        return res.status(201).json(savedDoc);
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`StudentHome backend running on port ${PORT}`);
});