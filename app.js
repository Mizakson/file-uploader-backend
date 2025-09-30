require("dotenv").config()
const express = require("express")
const passport = require("passport")
const path = require("node:path")
const cors = require("cors")

const { rateLimit } = require("express-rate-limit")

const configurePassport = require("./config/passport")

const app = express()

const allowedOrigin = "https://localhost:5173"

app.use(cors({
    origin: allowedOrigin,
    credentials: true,
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

app.use(passport.initialize())

configurePassport()

app.use(express.urlencoded({ extended: false }))
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