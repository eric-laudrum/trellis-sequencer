const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // Look for token in the headers
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status.json({ error: 'Authorization Failed. No token provided.' });
    }

    // Extract token
    const token = authHeader.split('Bearer ')[1];

    try{
        // Verify token & attach user ID to request
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch(e){
        res.status(400).json({ error: 'Unable to verify token' });
    }
};

module.exports = verifyToken;