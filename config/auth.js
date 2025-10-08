const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || "loremipsum"
const prisma = require('../prisma/prisma')

const isAuth = async (req, res, next) => {
    let token

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." })
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