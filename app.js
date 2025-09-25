require("dotenv").config()
const express = require("express")
const session = require("express-session")
const { PrismaSessionStore } = require("@quixo3/prisma-session-store")
const passport = require("passport")
const prisma = require("./prisma/prisma")
const path = require("node:path")

const configurePassport = require("./config/passport")

const app = express()

const userRouter = require("./routes/userRouter")
const contentRouter = require("./routes/contentRouter")
const apiRouter = require("./routes/apiRouter")

app.use(express.static("public"))

app.use(
    session({
        cookie: {
            maxAge: 730 * 24 * 60 * 60 * 1000 // ms
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

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

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