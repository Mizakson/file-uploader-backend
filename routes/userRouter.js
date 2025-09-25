const { Router } = require("express")

const userController = require("../controllers/userController")
const userRouter = Router()

userRouter.post("/sign-up", userController.validateUser, userController.createNewUser)

module.exports = userRouter