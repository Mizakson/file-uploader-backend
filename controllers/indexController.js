const path = require("path")
const fs = require("node:fs")
const { Readable } = require('stream')

const passport = require('passport')
const prisma = require('../prisma/prisma')
const { createClient } = require('@supabase/supabase-js')
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const JWT_SECRET = process.env.JWT_SECRET

const supabaseUrl = process.env.PROJECT_URL
const supabaseKey = process.env.SUPABASE_API_KEY
const supabase = createClient(supabaseUrl, supabaseKey)


exports.getIndex = async (req, res, next) => {

    const currentUser = req.user

    if (!currentUser || !currentUser.id) {
        return res.status(401).json({ message: "User not authenticated." })
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
            user: { id: currentUser.id, name: currentUser.name },
            folders: folders.folders
        })
    } catch (error) {
        console.error("Error in getIndex:", error)
        next(error)
    }
}

exports.getSignUp = (req, res) => {
    res.status(200).json({
        message: "Ready for sign-up",
    })
}

exports.getLogin = (req, res) => {
    res.status(200).json({
        message: "Ready for login.",
    })
}

exports.postLogin = async (req, res, next) => {
    const { username, password } = req.body

    try {
        const user = await prisma.user.findUnique({
            where: {
                name: username
            }
        })

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials." })
        }

        const match = await bcrypt.compare(password, user.password)

        if (!match) {
            return res.status(401).json({ message: "Invalid credentials." })
        }

        const payload = {
            id: user.id,
            name: user.name,
        }

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' }) // 1 day token expiry

        return res.status(200).json({
            message: "Login successful",
            token: "Bearer " + token,
            user: {
                id: user.id,
                username: user.name
            }
        })

    } catch (err) {
        console.error("Login error: ", err)
        next(err)
    }
}

exports.getLogout = (req, res, next) => {
    res.status(200).json({ message: 'Logged out successfully (Please delete token client-side)' })
}


exports.getAddFolder = (req, res) => {
    res.status(200).json({ message: "Successfully fetched data for add folder view." })
}

exports.getUploadFile = async (req, res, next) => {
    const folderId = req.params.folderId
    const userId = req.user.id

    try {
        const folder = await prisma.folder.findFirst({
            where: {
                id: folderId,
                userId: userId
            }
        })

        if (!folder) {
            return res.status(404).json({ message: "Folder not found or access denied." })
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
    const userId = req.user.id

    try {
        const file = await prisma.file.findUnique({
            where: {
                id: fileId,
                folder: {
                    userId: userId
                }
            },
            select: {
                name: true,
                folderId: true
            }
        })

        if (!file) {
            return res.status(404).json({ message: "File not found or access denied." })
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