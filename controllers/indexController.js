const path = require("path")
const fs = require("node:fs")
const { Readable } = require('stream')

const passport = require('passport')
const prisma = require('../prisma/prisma')
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.PROJECT_URL
const supabaseKey = process.env.SUPABASE_API_KEY
const supabase = createClient(supabaseUrl, supabaseKey)


exports.getIndex = async (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' })
    }

    try {
        const folders = await prisma.user.findUnique({
            where: {
                id: res.locals.currentUser.id
            },
            include: {
                folders: true,
            }
        })

        if (!folders) {
            return res.status(404).json({ message: "User not found." })
        }

        res.status(200).json({
            message: 'User data retrieved successfully',
            user: res.locals.currentUser,
            folders: folders.folders
        })
    } catch (error) {
        console.error("Error in getIndex:", error)
        next(error)
    }
}

exports.getSignUp = (req, res) => {
    res.status(200).json({
        user: res.locals.currentUser,
    })
}

exports.getLogin = (req, res) => {
    res.status(200).json({
        user: res.locals.currentUser,
    })
}

exports.postLogin = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {

        if (err) {
            console.error("Passport Strategy Error:", err)
            return res.status(500).json({ message: 'An internal server error occurred during authentication.' })
        }

        if (!user) {
            return res.status(401).json({ message: info.message || 'Invalid credentials.' })
        }

        req.logIn(user, (err) => {
            if (err) {
                console.error("Session Login Error:", err)
                return res.status(500).json({ message: 'Failed to establish user session.' })
            }

            return res.status(200).json({
                message: 'Login successful',

                user: {
                    id: user.id,
                    username: user.name,

                },
            })
        })
    })(req, res, next)
}

exports.getLogout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err)
        res.status(200).json({ message: 'Logged out successfully' })
    })
}


exports.getAddFolder = (req, res) => {
    res.status(200).json({ message: "Successfully fetched data for add folder view." })
}

exports.getUploadFile = async (req, res, next) => {
    const folderId = req.params.folderId

    try {
        const folder = await prisma.folder.findFirst({
            where: {
                id: folderId
            }
        })

        if (!folder) {
            return res.status(404).json({ message: "Folder not found." })
        }

        res.status(200).json({
            message: 'Uploaded file retrieved successfully',
            folder: folder
        })
    } catch (error) {
        console.error("Error in getUploadFile:", error)
        next(error)
    }
}

exports.getDownloadFile = async (req, res, next) => {
    const fileId = req.params.fileId
    const bucketName = 'files'

    try {
        const file = await prisma.file.findUnique({
            where: {
                id: fileId
            },
            select: {
                name: true,
                folderId: true
            }
        })

        if (!file) {
            return res.status(404).json({ message: "File not found in our records." })
        }

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(file.name, 3600) // 3600 sec = 1 hr

        if (signedUrlError) {
            console.error('Error generating signed URL:', signedUrlError)
            return res.status(500).json({ message: "Failed to generate download link." })
        }

        if (!signedUrlData || !signedUrlData.signedUrl) {
            console.error('Signed URL data or signedUrl property is missing.')
            return res.status(500).json({ message: "Failed to retrieve signed download link." })
        }

        const response = await fetch(signedUrlData.signedUrl)

        if (!response.ok) {
            console.error('Error fetching file from Supabase:', response.statusText)
            return res.status(500).json({ message: "Failed to fetch file for download." })
        }

        // Content-Disposition header forces the download in the browser.
        res.setHeader('Content-Disposition', `attachment filename="${file.name}"`)

        // convert Web ReadableStream to a Node.js Readable stream.
        const nodeStream = Readable.fromWeb(response.body)

        // pipe the Node.js stream to the response.
        nodeStream.pipe(res)

    } catch (error) {
        console.error("Error in download route:", error)
        next(error)
    }
}