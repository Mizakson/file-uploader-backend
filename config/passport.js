const passport = require("passport")
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const localStrategy = require("passport-local").Strategy
const bcrypt = require("bcryptjs")

module.exports = function configurePassport() {

    passport.use(
        new localStrategy(async (username, password, done) => {
            try {
                const user = await prisma.user.findUnique({
                    where: {
                        name: username
                    }
                })

                if (!user) return done(null, false, { message: "Incorrect username..." })

                const match = await bcrypt.compare(password, user.password)
                if (!match) return done(null, false, { message: "Incorrect password..." })

                return done(null, user)
            } catch (err) {
                return done(err)
            }
        })
    )

    passport.serializeUser((user, done) => {
        done(null, user.id)
    })

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await prisma.user.findUnique({
                where: {
                    id: id
                }
            })
            done(null, user)
        } catch (err) {
            done(err)
        }
    })

}