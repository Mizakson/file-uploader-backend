const { Router } = require("express")
const apiRouter = Router()

const indexController = require("../controllers/indexController")

apiRouter.get("/current-user", indexController.getIndex)
apiRouter.get("/sign-up", indexController.getSignUp)
apiRouter.get("/login", indexController.getLogin)
apiRouter.post("/login", indexController.postLogin)
apiRouter.post("/logout", indexController.getLogout)
apiRouter.get("/add-folder", indexController.getAddFolder)
apiRouter.get("/content/folder/:folderId/upload-file", indexController.getUploadFile)
apiRouter.get("/download/:fileId", indexController.getDownloadFile)
apiRouter.get("/test", (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ message: "hello from file-uploader-backend api :)" })
})

module.exports = apiRouter