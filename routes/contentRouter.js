const { Router } = require("express")
const contentRouter = Router()

const contentController = require('../controllers/contentController')
const isAuth = require("../config/auth")

contentRouter.post("/folder/:folderId/upload-file", contentController.uploadMiddleware, contentController.uploadFile)
contentRouter.post("/add-folder", isAuth, contentController.addFolder)
contentRouter.get("/:folderId/edit-folder", contentController.getEditFolder)
contentRouter.post("/:folderId/edit-folder", contentController.postEditFolder)
contentRouter.post("/:folderId/delete-folder", contentController.deleteFolder)
contentRouter.get("/folder/:folderId/files", contentController.getFiles)
contentRouter.get("/files/:fileId", contentController.getFileDetails)
contentRouter.post("/files/:fileId/delete-file", contentController.deleteFile)

module.exports = contentRouter