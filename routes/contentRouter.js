const { Router } = require("express")
const contentRouter = Router()

const contentController = require('../controllers/contentController')
const passport = require("passport")

contentRouter.post("/folder/:folderId/upload-file", passport.authenticate('jwt', { session: false }), contentController.uploadMiddleware, contentController.uploadFile)
contentRouter.post("/add-folder", passport.authenticate('jwt', { session: false }), contentController.addFolder)
contentRouter.get("/:folderId/edit-folder", passport.authenticate('jwt', { session: false }), contentController.getEditFolder)
contentRouter.post("/:folderId/edit-folder", passport.authenticate('jwt', { session: false }), contentController.postEditFolder)
contentRouter.post("/:folderId/delete-folder", passport.authenticate('jwt', { session: false }), contentController.deleteFolder)
contentRouter.get("/folder/:folderId/files", passport.authenticate('jwt', { session: false }), contentController.getFiles)
contentRouter.get("/files/:fileId", passport.authenticate('jwt', { session: false }), contentController.getFileDetails)
contentRouter.post("/files/:folderId/:fileId/delete-file", passport.authenticate('jwt', { session: false }), contentController.deleteFile)
contentRouter.get("/files/:folderId/:fileId/signed-url", passport.authenticate('jwt', { session: false }), contentController.getSignedFileUrl)

module.exports = contentRouter