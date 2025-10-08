const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || "loremipsum"
const prisma = require('../prisma/prisma')

const isAuth = async (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else {
            token = authHeader;
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Unauthorized: Token missing." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET)

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, name: true }
        })

        if (!user) {
            return res.status(401).json({ message: "Invalid token payload: User not found." })
        }

        req.user = user
        next()

    } catch (err) {
        console.error('JWT Auth Error:', err.message)
        return res.status(401).json({ message: "Invalid or expired token." })
    }
}

module.exports = isAuth