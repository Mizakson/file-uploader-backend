const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || "loremipsum"
const prisma = require('../prisma/prisma')

const isAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else {
        return res.status(401).json({ message: "Unauthorized: Token missing or malformed." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = user;
        next();
    } catch (err) {
        console.error('JWT Verification Error:', err.message);
        return res.status(401).json({ message: "Unauthorized: Invalid or expired token." });
    }
};

module.exports = isAuth