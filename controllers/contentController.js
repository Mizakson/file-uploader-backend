const path = require("path")
const fs = require("node:fs")
const multer = require('multer')
const prisma = require("../prisma/prisma")
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.PROJECT_URL
const supabaseKey = process.env.SUPABASE_API_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const upload = multer({ storage: multer.memoryStorage() })

exports.uploadMiddleware = upload.single("newFile")

exports.uploadFile = async function (req, res, next) {
    const fileInfo = req.file
    const folderId = req.params.folderId
    const userId = req.user.id

    if (!fileInfo) {
        console.error('No file received from Multer.')
        return res.status(400).json({ message: "No file data received." });
    }

    const folder = await prisma.folder.findFirst({
        where: {
            id: folderId,
            userId: userId
        }
    })

    if (!folder) return res.status(403).json({ message: "Access denied. Folder not found or does not belong to user." })

    let fileBuffer
    if (fileInfo.buffer) {
        fileBuffer = fileInfo.buffer
    } else if (fileInfo.path) {
        try {
            fileBuffer = fs.readFileSync(fileInfo.path)
        } catch (readError) {
            console.error('Error reading file from temporary path (disk storage):', readError)
            return res.status(500).json({ message: "Failed to read the uploaded file from disk." });
        }
    } else {
        console.error('Multer did not provide a file buffer or path.')
        return res.status(500).json({ message: "Internal server error: File data not accessible." });
    }

    try {
        const { data: supabaseData, error: supabaseUploadError } = await supabase.storage
            .from('files')
            .upload(fileInfo.originalname, fileBuffer, {
                contentType: fileInfo.mimetype,
                upsert: false,
                duplex: 'half'
            })

        if (supabaseUploadError) {
            console.error('Supabase upload error details:', supabaseUploadError)
            return res.status(500).json({ message: "File upload to Supabase failed." });
        }

        let filePublicUrl = null
        if (supabaseData && supabaseData.path) {
            const { data: publicUrlData } = supabase.storage.from('files').getPublicUrl(supabaseData.path)
            if (publicUrlData && publicUrlData.publicUrl) {
                filePublicUrl = publicUrlData.publicUrl
                console.log('Supabase public URL:', filePublicUrl)
            } else {
                console.warn('Could not retrieve public URL data from Supabase.')
            }
        } else {
            console.warn('Supabase data or path not available after upload.')
        }

        await prisma.folder.update({
            where: {
                id: folderId
            },
            data: {
                files: {
                    create: {
                        name: fileInfo.originalname,
                        updloadedAt: new Date(),
                        size: Number(fileInfo.size),
                        publicUrl: filePublicUrl
                    }
                }
            }
        });
        console.log('File info and public URL added to database for folder:', folderId)

        return res.status(201).json({
            message: 'File uploaded successfully',
            file: {
                name: fileInfo.originalname,
                publicUrl: filePublicUrl
            }
        })

    } catch (error) {
        console.error('An unexpected error occurred during file upload:', error);
        next(error);
    } finally {
        if (fileInfo.path) {
            fs.unlink(fileInfo.path, (err) => {
                if (err) console.error('Error deleting temporary file:', err)
                else console.log('Temporary file deleted:', fileInfo.path)
            });
        }
    }
}

exports.addFolder = async function (req, res, next) {
    try {
        const { newFolder } = req.body
        const { id } = req.user

        const addFolder = await prisma.user.update({
            where: {
                id: id
            },
            data: {
                folders: {
                    create: {
                        name: newFolder,
                    }
                }
            }
        })

        return res.status(201).json({
            message: 'Folder created successfully',
            folder: newFolder
        })

    } catch (error) {
        console.error("Error in addFolder:", error)
        next(error)
    }
}

exports.getEditFolder = async (req, res, next) => {
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
            return res.status(404).json({ message: "Folder not found or access denied." });
        }

        res.status(200).json({
            message: 'Folder retrieved successfully',
            folder: folder
        })
    } catch (error) {
        console.error("Error in getEditFolder:", error)
        next(error)
    }
}

exports.postEditFolder = async (req, res, next) => {
    const folderId = req.params.folderId
    const newName = req.body.editFolder
    const userId = req.user.id

    try {
        const updateName = await prisma.folder.update({
            where: {
                id: folderId,
                userId: userId
            },
            data: {
                name: newName
            }
        })
        res.status(200).json({
            message: 'Folder updated successfully',
            data: newName
        })
    } catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ message: "Folder not found or access denied." })
        }

        console.error("Error in postEditFolder:", error)
        next(error)
    }
}

exports.deleteFolder = async (req, res, next) => {
    const folderId = req.params.folderId
    const userId = req.user.id

    try {
        const deleteFolder = await prisma.folder.delete({
            where: {
                id: folderId,
                userId: userId
            }
        })
        res.status(200).json({ message: 'Folder deleted successfully' })
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Folder not found or access denied." });
        }

        console.error("Error in deleteFolder:", error)
        next(error)
    }
}

exports.getFiles = async (req, res, next) => {
    const folderId = req.params.folderId
    const userId = req.user.id

    try {
        const folder = await prisma.folder.findFirst({
            where: {
                id: folderId,
                userId: userId
            },
            include: {
                files: true
            }
        })

        if (!folder) {
            return res.status(404).json({ message: "Folder not found." });
        }

        res.status(200).json({
            folder: folder,
            files: folder.files
        })
    } catch (error) {
        console.error("Error in getFiles:", error)
        next(error)
    }
}

exports.getFileDetails = async (req, res, next) => {
    const fileId = req.params.fileId
    const userId = req.user.id

    try {
        const file = await prisma.file.findFirst({
            where: {
                id: fileId,
                folder: {
                    userId: userId
                }
            }, include: {
                folder: {
                    select: {
                        userId: true
                    }
                }
            }
        })

        if (!file) {
            return res.status(404).json({ message: "File not found or access denied." });
        }

        delete file.folder

        res.status(200).json({
            file: file,
            date: file.updloadedAt
        })
    } catch (error) {
        console.error("Error in getFileDetails:", error)
        next(error)
    }
}

exports.deleteFile = async (req, res, next) => {
    const fileId = req.params.fileId
    const userId = req.user.id

    try {
        const fileToDelete = await prisma.file.findFirst({
            where: {
                id: fileId,
                folder: {
                    userId: userId
                }
            }, select: {
                id: true,
                name: true
            }
        })

        if (!fileToDelete) {
            return res.status(404).json({ message: "File not found or access denied." })
        }

        const deleteFile = await prisma.file.delete({
            where: {
                id: fileId
            }
        })

        const { error: deleteError } = await supabase.storage
            .from('files')
            .remove([fileToDelete.name])

        if (deleteError) { console.error("Supabase deletion error: ", deleteError) }

        res.status(200).json({ message: 'File deleted successfully' })
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "File not found in database." })
        }
        console.error("Error in deleteFile:", error)
        next(error)
    }
}
