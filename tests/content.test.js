// create mocks first, then import controller
const mockSupabaseUpload = jest.fn()
const mockSupabaseGetPublicUrl = jest.fn()
const mockPrismaUserUpdate = jest.fn()
const mockPrismaFolderUpdate = jest.fn()
const mockPrismaFolderFindFirst = jest.fn()
const mockPrismaFolderDelete = jest.fn()
const mockPrismaFileFindFirst = jest.fn()
const mockPrismaFileDelete = jest.fn()
const mockFsUnlink = jest.fn((path, cb) => cb(null))
const mockFsReadFileSync = jest.fn()

jest.mock('../prisma/prisma', () => ({
    user: {
        update: mockPrismaUserUpdate,
    },
    folder: {
        update: mockPrismaFolderUpdate,
        findFirst: mockPrismaFolderFindFirst,
        delete: mockPrismaFolderDelete,
    },
    file: {
        findFirst: mockPrismaFileFindFirst,
        delete: mockPrismaFileDelete,
    },
}))

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        storage: {
            from: jest.fn(() => ({
                upload: mockSupabaseUpload,
                getPublicUrl: mockSupabaseGetPublicUrl,
            })),
        },
    })),
}))

jest.mock('multer', () => {
    const multer = () => ({
        single: () => (req, res, next) => {
            req.file = {
                fieldname: 'newFile',
                originalname: 'test.txt',
                encoding: '7bit',
                mimetype: 'text/plain',
                buffer: Buffer.from('test content'),
                size: 12
            }
            next()
        }
    })
    multer.memoryStorage = () => ({})
    return multer
})

jest.mock('node:fs', () => ({
    ...jest.requireActual('node:fs'),
    readFileSync: mockFsReadFileSync,
    unlink: mockFsUnlink,
}))


const contentController = require('../controllers/contentController')

describe('contentController', () => {
    let mockRequest
    let mockResponse
    const mockNext = jest.fn()

    beforeEach(() => {
        mockRequest = {
            params: {},
            body: {},
            user: { id: 'test-user-id' },
            file: {
                originalname: 'test.txt',
                mimetype: 'text/plain',
                buffer: Buffer.from('test content'),
                size: 12,
                publicUrl: 'http://test-url.com/test.txt'
            },
        }
        mockResponse = {
            status: jest.fn(() => mockResponse),
            send: jest.fn(),
            json: jest.fn(),
        }

        jest.clearAllMocks()
    })

    describe('uploadFile', () => {
        test('should upload a file and redirect on success', async () => {
            mockRequest.params.folderId = 'folder-123'
            mockSupabaseUpload.mockResolvedValue({
                data: { path: 'test.txt' },
                error: null
            })
            mockSupabaseGetPublicUrl.mockReturnValue({ data: { publicUrl: 'http://test-url.com/test.txt' } })
            mockPrismaFolderUpdate.mockResolvedValue({})

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockResponse.status).toHaveBeenCalledWith(201)
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'File uploaded successfully',
                file: expect.objectContaining({
                    name: 'test.txt',
                    publicUrl: 'http://test-url.com/test.txt'
                })
            }))
            expect(mockPrismaFolderUpdate).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'folder-123' },
                data: {
                    files: {
                        create: expect.objectContaining({
                            name: 'test.txt',
                            publicUrl: 'http://test-url.com/test.txt',
                            size: 12
                        })
                    }
                }
            }))
        })

        test('should send 400 status if no file is received', async () => {
            mockRequest.file = undefined

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockResponse.status).toHaveBeenCalledWith(400)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'No file data received.' })
        })

        test('should send with 500 status if Supabase upload fails', async () => {
            mockRequest.params.folderId = 'folder-123'
            mockSupabaseUpload.mockResolvedValue({ data: null, error: { message: 'Supabase error' } })

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockResponse.status).toHaveBeenCalledWith(500)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'File upload to Supabase failed.' })
        })

        test('should call next with an error if Prisma update fails after successful upload', async () => {
            mockRequest.params.folderId = 'folder-123'
            mockSupabaseUpload.mockResolvedValue({ data: { path: 'test.txt' }, error: null })
            mockSupabaseGetPublicUrl.mockReturnValue({ data: { publicUrl: 'http://test-url.com/test.txt' } })
            mockPrismaFolderUpdate.mockRejectedValue(new Error('Prisma error'))

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
            expect(mockResponse.json).not.toHaveBeenCalled()
        })

        test('should send 500 status if file data is not accessible', async () => {
            mockRequest.file = {
                originalname: 'test.txt',
                mimetype: 'text/plain',
                size: 12
            }

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockResponse.status).toHaveBeenCalledWith(500)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: "Internal server error: File data not accessible." })
        })

        test('should call next with an error if an unexpected error occurs during upload', async () => {
            mockRequest.params.folderId = 'folder-123'
            const mockError = new Error('Unexpected upload error');
            mockSupabaseUpload.mockRejectedValue(mockError);

            await contentController.uploadFile(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
        })
    })

    describe('addFolder', () => {
        test('should add a new folder and redirect on success', async () => {
            mockRequest.body.newFolder = 'New Test Folder'
            mockPrismaUserUpdate.mockResolvedValue({})

            await contentController.addFolder(mockRequest, mockResponse, mockNext)

            expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
                where: { id: 'test-user-id' },
                data: {
                    folders: {
                        create: { name: 'New Test Folder' }
                    }
                }
            })
            expect(mockResponse.status).toHaveBeenCalledWith(201)
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Folder created successfully',
                folder: 'New Test Folder'
            })
        })

        test('should call next with an error if prisma fails', async () => {
            mockRequest.body.newFolder = 'New Test Folder'
            const mockError = new Error('Prisma update failed')
            mockPrismaUserUpdate.mockRejectedValue(mockError)

            await contentController.addFolder(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
            expect(mockResponse.json).not.toHaveBeenCalled()
        })
    })

    describe('getEditFolder', () => {
        test('should send 200 status with folder data', async () => {
            mockRequest.params.folderId = 'folder-456'
            const mockFolder = { id: 'folder-456', name: 'Folder to Edit' }
            mockPrismaFolderFindFirst.mockResolvedValue(mockFolder)

            await contentController.getEditFolder(mockRequest, mockResponse, mockNext)

            expect(mockPrismaFolderFindFirst).toHaveBeenCalledWith({
                where: { id: 'folder-456' }
            })
            expect(mockResponse.status).toHaveBeenCalledWith(200)
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Folder retrieved successfully',
                folder: mockFolder
            })
        })

        test('should send 404 status if folder is not found', async () => {
            mockRequest.params.folderId = 'non-existent-folder'
            mockPrismaFolderFindFirst.mockResolvedValue(null)

            await contentController.getEditFolder(mockRequest, mockResponse, mockNext)

            expect(mockPrismaFolderFindFirst).toHaveBeenCalled()
            expect(mockResponse.status).toHaveBeenCalledWith(404)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Folder not found.' })
        })

        test('should call next with an error if prisma fails', async () => {
            mockRequest.params.folderId = 'folder-456'
            const mockError = new Error('Prisma find failed')
            mockPrismaFolderFindFirst.mockRejectedValue(mockError)

            await contentController.getEditFolder(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
            expect(mockResponse.json).not.toHaveBeenCalled()
        })
    })

    describe('postEditFolder', () => {
        test('should update folder name and send 302 status on success', async () => {
            mockRequest.params.folderId = 'folder-456'
            mockRequest.body.editFolder = 'Updated Folder Name'
            mockPrismaFolderUpdate.mockResolvedValue({})

            await contentController.postEditFolder(mockRequest, mockResponse, mockNext)

            expect(mockPrismaFolderUpdate).toHaveBeenCalledWith({
                where: { id: 'folder-456' },
                data: { name: 'Updated Folder Name' }
            })
            expect(mockResponse.status).toHaveBeenCalledWith(302)
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Folder updated successfully',
                data: 'Updated Folder Name'
            })
        })

        test('should call next with an error if prisma fails', async () => {
            mockRequest.params.folderId = 'folder-456'
            const mockError = new Error('Prisma update failed')
            mockPrismaFolderUpdate.mockRejectedValue(mockError)

            await contentController.postEditFolder(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
            expect(mockResponse.json).not.toHaveBeenCalled()
        })
    })

    describe('deleteFolder', () => {
        test('should delete a folder and send 204 status on success', async () => {
            mockRequest.params.folderId = 'folder-456'
            mockPrismaFolderDelete.mockResolvedValue({})

            await contentController.deleteFolder(mockRequest, mockResponse, mockNext)

            expect(mockPrismaFolderDelete).toHaveBeenCalledWith({
                where: { id: 'folder-456' }
            })
            expect(mockResponse.status).toHaveBeenCalledWith(204)
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Folder deleted successfully'
            })
        })

        test('should call next with an error if prisma fails', async () => {
            mockRequest.params.folderId = 'folder-456'
            const mockError = new Error('Prisma delete failed')
            mockPrismaFolderDelete.mockRejectedValue(mockError)

            await contentController.deleteFolder(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
            expect(mockResponse.json).not.toHaveBeenCalled()
        })
    })

    describe('getFiles', () => {
        test('should send 200 status with folder and file data', async () => {
            mockRequest.params.folderId = 'folder-456'
            const mockFolder = {
                id: 'folder-456',
                name: 'Files Folder',
                files: [{ id: 'file-1', name: 'file.pdf' }]
            }
            mockPrismaFolderFindFirst.mockResolvedValue(mockFolder)

            await contentController.getFiles(mockRequest, mockResponse, mockNext)

            expect(mockPrismaFolderFindFirst).toHaveBeenCalledWith({
                where: { id: 'folder-456' },
                include: { files: true }
            })

            expect(mockResponse.status).toHaveBeenCalledWith(200)
            expect(mockResponse.json).toHaveBeenCalledWith({
                folder: mockFolder,
                files: mockFolder.files
            })
        })

        test('should render error-page with 404 status if folder is not found', async () => {
            mockRequest.params.folderId = 'non-existent-folder'
            mockPrismaFolderFindFirst.mockResolvedValue(null)

            await contentController.getFiles(mockRequest, mockResponse, mockNext)

            expect(mockPrismaFolderFindFirst).toHaveBeenCalled()
            expect(mockResponse.status).toHaveBeenCalledWith(404)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Folder not found.' })
        })

        test('should call next with an error if prisma fails', async () => {
            mockRequest.params.folderId = 'folder-456'
            const mockError = new Error('Prisma find failed')
            mockPrismaFolderFindFirst.mockRejectedValue(mockError)

            await contentController.getFiles(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
            expect(mockResponse.json).not.toHaveBeenCalled()
        })
    })

    describe('getFileDetails', () => {
        test('should render file-details with file data', async () => {
            mockRequest.params.fileId = 'file-789'
            const mockFile = { id: 'file-789', name: 'details.txt', updloadedAt: new Date() }
            mockPrismaFileFindFirst.mockResolvedValue(mockFile)

            await contentController.getFileDetails(mockRequest, mockResponse, mockNext)

            expect(mockPrismaFileFindFirst).toHaveBeenCalledWith({
                where: { id: 'file-789' }
            })

            expect(mockResponse.status).toHaveBeenCalledWith(200)
            expect(mockResponse.json).toHaveBeenCalledWith({
                file: mockFile,
                date: JSON.stringify(mockFile.updloadedAt)
            })
        })

        test('should render error-page with 404 status if file is not found', async () => {
            mockRequest.params.fileId = 'non-existent-file'
            mockPrismaFileFindFirst.mockResolvedValue(null)

            await contentController.getFileDetails(mockRequest, mockResponse, mockNext)

            expect(mockPrismaFileFindFirst).toHaveBeenCalled()
            expect(mockResponse.status).toHaveBeenCalledWith(404)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'File not found.' })
        })

        test('should call next with an error if prisma fails', async () => {
            mockRequest.params.fileId = 'file-789'
            const mockError = new Error('Prisma find failed')
            mockPrismaFileFindFirst.mockRejectedValue(mockError)

            await contentController.getFileDetails(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
            expect(mockResponse.json).not.toHaveBeenCalled()
        })
    })

    describe('deleteFile', () => {
        test('should delete a file and send 304 status on success', async () => {
            mockRequest.params.fileId = 'file-789'
            mockPrismaFileDelete.mockResolvedValue({})

            await contentController.deleteFile(mockRequest, mockResponse, mockNext)

            expect(mockPrismaFileDelete).toHaveBeenCalledWith({
                where: { id: 'file-789' }
            })
            expect(mockResponse.status).toHaveBeenCalledWith(304)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'File deleted successfully' })
        })

        test('should call next with an error if prisma fails', async () => {
            mockRequest.params.fileId = 'file-789'
            const mockError = new Error('Prisma delete failed')
            mockPrismaFileDelete.mockRejectedValue(mockError)

            await contentController.deleteFile(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
            expect(mockResponse.json).not.toHaveBeenCalled()
        })
    })
})