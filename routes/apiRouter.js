const { Router } = require("express")
const apiRouter = Router()

const indexController = require("../controllers/indexController")
const passport = require("passport")

apiRouter.get("/current-user", passport.authenticate('jwt', { session: false }), indexController.getIndex)
// apiRouter.get("/current-user", (req, res, next) => {
//     passport.authenticate('jwt', { session: false }, (err, user, info) => {
//         if (err) {
//             console.error("Passport Error:", err); // <-- Check this for internal failure
//             return next(err);
//         }
//         if (!user) {
//             console.log("Passport Info:", info); // <-- Check this for failure reason (e.g., 'jwt expired')
//             return res.status(401).json({ message: "User not authenticated." });
//         }
//         req.user = user;
//         next();
//     })(req, res, next);
// })
apiRouter.get("/sign-up", indexController.getSignUp)
apiRouter.get("/login", indexController.getLogin)
apiRouter.post("/login", indexController.postLogin)
apiRouter.post("/logout", passport.authenticate('jwt', { session: false }), indexController.getLogout)

apiRouter.get("/add-folder", passport.authenticate('jwt', { session: false }), indexController.getAddFolder)
apiRouter.get("/content/folder/:folderId/upload-file", passport.authenticate('jwt', { session: false }), indexController.getUploadFile)
apiRouter.get("/download/:fileId", passport.authenticate('jwt', { session: false }), indexController.getDownloadFile)
apiRouter.get("/test", (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ message: "hello from file-uploader-backend api :)" })
})

module.exports = apiRouter