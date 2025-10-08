const { Router } = require("express")
const contentRouter = Router()

const contentController = require('../controllers/contentController')
const isAuth = require("../config/auth")

contentRouter.post("/folder/:folderId/upload-file", isAuth, contentController.uploadMiddleware, contentController.uploadFile)
contentRouter.post("/add-folder", isAuth, contentController.addFolder)
contentRouter.get("/:folderId/edit-folder", isAuth, contentController.getEditFolder)
contentRouter.post("/:folderId/edit-folder", isAuth, contentController.postEditFolder)
contentRouter.post("/:folderId/delete-folder", isAuth, contentController.deleteFolder)
contentRouter.get("/folder/:folderId/files", isAuth, contentController.getFiles)
contentRouter.get("/files/:fileId", isAuth, contentController.getFileDetails)
contentRouter.post("/files/:fileId/delete-file", isAuth, contentController.deleteFile)

module.exports = contentRouter