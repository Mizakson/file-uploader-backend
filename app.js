require("dotenv").config()
const express = require("express")
const session = require("express-session")
const { PrismaSessionStore } = require("@quixo3/prisma-session-store")
const passport = require("passport")
const prisma = require("./prisma/prisma")
const path = require("node:path")
const cors = require("cors")

const { rateLimit } = require("express-rate-limit")

const configurePassport = require("./config/passport")

const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"]
const isProduction = process.env.NODE_ENV === 'production'

const app = express()
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true)

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true)
        } else {
            callback(new Error(`Not allowed by CORS: ${origin}`))
        }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}))

// app.use(function (req, res, next) {
//     res.header("Access-Control-Allow-Origin", "*")
//     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
//     next()
// })

// rate limiter fix
app.set('trust proxy', 1)

const userRouter = require("./routes/userRouter")
const contentRouter = require("./routes/contentRouter")
const apiRouter = require("./routes/apiRouter")

app.use(express.static("public"))

app.use(
    session({
        cookie: {
            maxAge: 730 * 24 * 60 * 60 * 1000, // ms
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
        },
        secret: "lorem ipsum",
        resave: true,
        saveUninitialized: false,
        store: new PrismaSessionStore(
            prisma,
            {
                checkPeriod: 2 * 60 * 1000, // ms
                dbRecordIdIsSessionId: true,
                dbRecordIdFunction: undefined,
            }
        )
    })
)

app.use(passport.initialize())
app.use(passport.session())

configurePassport()

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 min
    limit: 100, // 100 requests per min 
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: "request limit reached",
})

app.use(limiter)
app.use((req, res, next) => {
    res.locals.currentUser = req.user
    next()
})

app.use("/api/user", userRouter)
app.use("/api/content", contentRouter)
app.use("/api", apiRouter)

app.use((err, req, res, next) => {
    console.error(err.stack)
    const statusCode = err.status || 500
    const message = err.message || 'An unexpected error occurred.'

    res.status(statusCode).json({
        message: message,
    })
})

module.exports = app