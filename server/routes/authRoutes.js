// auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');

// -- Register route  --
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered.' });
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create and save the new user
        const newUser = new User({
            email,
            password: hashedPassword,
            // tier & uploadLimit default to free with 10 uploads
        });

        const savedUser = await newUser.save();

        res.status(201).json({ message: 'User registration successful' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// -- Login --
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find the user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        // Check the password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        // Generate the JWT Token

        const token = jwt.sign(
            { _id: user._id, tier: user.tier },
            process.env.JWT_SECRET,
            { expiresIn: '24h' } // Token expires in 1 day
        );

        // Send token and user data to the frontend
        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                tier: user.tier,
                uploadLimit: user.uploadLimit,
                uploadedSounds: user.uploadedSounds
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

module.exports = router;