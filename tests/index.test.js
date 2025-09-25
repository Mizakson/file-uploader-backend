// create mocks first, then import controller
const mockCreateSignedUrl = jest.fn()
const mockPipe = jest.fn()
const mockSetHeader = jest.fn()

jest.mock('stream', () => ({
    Readable: {
        fromWeb: jest.fn(() => ({
            pipe: mockPipe,
        })),
    },
}))

const fetch = jest.fn()
global.fetch = fetch

jest.mock('../prisma/prisma', () => ({
    user: {
        findUnique: jest.fn(),
    },
    folder: {
        findFirst: jest.fn(),
    },
    file: {
        findUnique: jest.fn(),
    },
}))

jest.mock('passport', () => ({
    authenticate: jest.fn(() => (req, res, next) => { }),
}))

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        storage: {
            from: jest.fn(() => ({
                createSignedUrl: mockCreateSignedUrl,
            })),
        },
    })),
}))

const indexController = require('../controllers/indexController')
const prisma = require('../prisma/prisma')
const passport = require('passport')


describe('indexController', () => {
    let mockResponse
    let mockRequest
    const mockNext = jest.fn()

    beforeEach(() => {
        mockResponse = {
            status: jest.fn(() => mockResponse),
            send: jest.fn(),
            json: jest.fn(),
            setHeader: mockSetHeader,
            locals: {
                currentUser: { id: 'test-user-id' }
            }
        }

        mockRequest = {
            isAuthenticated: jest.fn(),
            logout: jest.fn((cb) => cb(null)), // mock logout for its callback
            params: {},
            body: {}
        }
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    // tests for postLogin are (isolated)
    // reason: not altered by beforeEach/afterEach hooks
    describe('postLogin', () => {
        test('should call passport.authenticate with correct options', () => {
            expect(passport.authenticate).toHaveBeenCalledWith('local', {
                successRedirect: '/',
                failureRedirect: '/',
            })
        })
    })

    describe('remaining indexController methods', () => {

        describe('getIndex', () => {
            test('should send 401 status if user is not authenticated', async () => {
                mockRequest.isAuthenticated.mockReturnValue(false)

                await indexController.getIndex(mockRequest, mockResponse)

                expect(mockRequest.isAuthenticated).toHaveBeenCalled()
                expect(mockResponse.status).toHaveBeenCalledWith(401)
                expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' })

                expect(prisma.user.findUnique).not.toHaveBeenCalled()
            })

            test('should send 200 status with user data if authenticated', async () => {
                mockRequest.isAuthenticated.mockReturnValue(true)
                const mockFolders = [{ id: 'folder1', name: 'Folder 1' }]
                prisma.user.findUnique.mockResolvedValue({ folders: mockFolders })

                await indexController.getIndex(mockRequest, mockResponse, mockNext)

                expect(mockRequest.isAuthenticated).toHaveBeenCalled()
                expect(prisma.user.findUnique).toHaveBeenCalledWith({
                    where: { id: 'test-user-id' },
                    include: { folders: true },
                })
                expect(mockResponse.status).toHaveBeenCalledWith(200)
                expect(mockResponse.json).toHaveBeenCalledWith({
                    message: 'User data retrieved successfully',
                    user: mockResponse.locals.currentUser,
                    folders: mockFolders,
                })
            })

            test('should call next with an error if prisma fails', async () => {
                mockRequest.isAuthenticated.mockReturnValue(true)
                const mockError = new Error('Database connection failed')
                prisma.user.findUnique.mockRejectedValue(mockError)

                await indexController.getIndex(mockRequest, mockResponse, mockNext)

                expect(mockNext).toHaveBeenCalledWith(mockError)
            })

            test('should send 404 status if user not found', async () => {
                mockRequest.isAuthenticated.mockReturnValue(true)
                prisma.user.findUnique.mockResolvedValue(null)

                await indexController.getIndex(mockRequest, mockResponse, mockNext)

                expect(mockResponse.status).toHaveBeenCalledWith(404)
                expect(mockResponse.json).toHaveBeenCalledWith({ message: 'User not found.' })

            })
        })

        describe('getSignUp', () => {
            test('should send 200 status with res.locals.currentUser', () => {
                indexController.getSignUp(mockRequest, mockResponse)
                expect(mockResponse.status).toHaveBeenCalledWith(200)
                expect(mockResponse.json).toHaveBeenCalledWith({
                    user: mockResponse.locals.currentUser,
                })
            })
        })

        describe('getLogin', () => {
            test('should send 200 status with res.locals.currentUser ', () => {
                indexController.getLogin(mockRequest, mockResponse)
                expect(mockResponse.status).toHaveBeenCalledWith(200)
                expect(mockResponse.json).toHaveBeenCalledWith({
                    user: mockResponse.locals.currentUser,
                })
            })
        })

        describe('getLogout', () => {
            test('should send a 200 status if user is logged out successfully', () => {
                indexController.getLogout(mockRequest, mockResponse, mockNext)
                expect(mockRequest.logout).toHaveBeenCalled()
                expect(mockResponse.status).toHaveBeenCalledWith(200)
                expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Logged out successfully' })

            })

            test('should call next with an error if logout fails', () => {
                const mockError = new Error('Logout failed')
                mockRequest.logout.mockImplementationOnce((cb) => cb(mockError))

                indexController.getLogout(mockRequest, mockResponse, mockNext)

                expect(mockNext).toHaveBeenCalledWith(mockError)
                expect(mockResponse.json).not.toHaveBeenCalled()
            })
        })

        describe('getAddFolder', () => {
            test('should send 200 status if folder data fetched', () => {
                indexController.getAddFolder(mockRequest, mockResponse)
                expect(mockResponse.status).toHaveBeenCalledWith(200)
                expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Successfully fetched data for add folder view.' })
            })
        })

        describe('getUploadFile', () => {
            test('should send 200 status view with folder data', async () => {
                mockRequest.params.folderId = 'folder-123'
                const mockFolder = { id: 'folder-123', name: 'Test Folder' }
                prisma.folder.findFirst.mockResolvedValue(mockFolder)

                await indexController.getUploadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.folder.findFirst).toHaveBeenCalledWith({
                    where: { id: 'folder-123' },
                })
                expect(mockResponse.status).toHaveBeenCalledWith(200)
                expect(mockResponse.json).toHaveBeenCalledWith({
                    message: 'Uploaded file retrieved successfully',
                    folder: mockFolder,
                })
            })

            test('should send 404 status if folder is not found', async () => {
                mockRequest.params.folderId = 'non-existent-folder'
                prisma.folder.findFirst.mockResolvedValue(null)

                await indexController.getUploadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.folder.findFirst).toHaveBeenCalled()
                expect(mockResponse.status).toHaveBeenCalledWith(404)
                expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Folder not found.' })
            })

            test('should call next with an error if prisma fails', async () => {
                mockRequest.params.folderId = 'folder-123'
                const mockError = new Error('Database error')
                prisma.folder.findFirst.mockRejectedValue(mockError)

                await indexController.getUploadFile(mockRequest, mockResponse, mockNext)

                expect(mockNext).toHaveBeenCalledWith(mockError)
                expect(mockResponse.json).not.toHaveBeenCalled()
            })
        })

        describe('getDownloadFile', () => {
            test('should stream the file and set the correct headers if the file is found', async () => {
                mockRequest.params.fileId = 'file-456'
                const mockFile = { name: 'test.pdf' }
                const mockSignedUrl = 'http://test-url.com/signed'
                const mockWebReadableStream = { body: {} }

                prisma.file.findUnique.mockResolvedValue(mockFile)
                mockCreateSignedUrl.mockResolvedValue({
                    data: { signedUrl: mockSignedUrl },
                    error: null,
                })

                fetch.mockResolvedValue({
                    ok: true,
                    body: mockWebReadableStream,
                })

                await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.file.findUnique).toHaveBeenCalledWith({
                    where: { id: 'file-456' },
                    select: { name: true, folderId: true },
                })
                expect(mockCreateSignedUrl).toHaveBeenCalledWith('test.pdf', 3600)
                expect(fetch).toHaveBeenCalledWith(mockSignedUrl)
                expect(mockSetHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment filename="test.pdf"')
                expect(require('stream').Readable.fromWeb).toHaveBeenCalledWith(mockWebReadableStream)
                expect(mockPipe).toHaveBeenCalledWith(mockResponse)
            })

            test('should send 404 status if the file is not found in the database', async () => {
                mockRequest.params.fileId = 'non-existent-file'
                prisma.file.findUnique.mockResolvedValue(null)

                await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.file.findUnique).toHaveBeenCalled()
                expect(mockResponse.status).toHaveBeenCalledWith(404)
                expect(mockResponse.json).toHaveBeenCalledWith({ message: "File not found in our records." })
            })

            test('should send 500 status if an error occurs while generating the signed URL', async () => {
                mockRequest.params.fileId = 'file-456'
                const mockFile = { name: 'test.pdf' }

                prisma.file.findUnique.mockResolvedValue(mockFile)
                mockCreateSignedUrl.mockResolvedValue({
                    data: null,
                    error: { message: 'Supabase error' },
                })

                await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.file.findUnique).toHaveBeenCalled()
                expect(mockCreateSignedUrl).toHaveBeenCalledWith('test.pdf', 3600)
                expect(mockResponse.status).toHaveBeenCalledWith(500)
                expect(mockResponse.json).toHaveBeenCalledWith({ message: "Failed to generate download link." })
            })

            test('should send 500 status if the fetch call fails', async () => {
                mockRequest.params.fileId = 'file-456'
                const mockFile = { name: 'test.pdf' }
                const mockSignedUrl = 'http://test-url.com/signed'

                prisma.file.findUnique.mockResolvedValue(mockFile)
                mockCreateSignedUrl.mockResolvedValue({
                    data: { signedUrl: mockSignedUrl },
                    error: null,
                })

                fetch.mockResolvedValue({
                    ok: false,
                    statusText: 'Not Found',
                })

                await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

                expect(prisma.file.findUnique).toHaveBeenCalled()
                expect(mockCreateSignedUrl).toHaveBeenCalledWith('test.pdf', 3600)
                expect(fetch).toHaveBeenCalledWith(mockSignedUrl)
                expect(mockResponse.status).toHaveBeenCalledWith(500)
                expect(mockResponse.json).toHaveBeenCalledWith({ message: "Failed to fetch file for download." })
            })

            test('should call next with an error if an unexpected error occurs', async () => {
                mockRequest.params.fileId = 'file-456'
                const mockFile = { name: 'test.pdf' }
                const mockError = new Error('Unexpected database error')

                prisma.file.findUnique.mockResolvedValue(mockFile)
                mockCreateSignedUrl.mockRejectedValue(mockError)

                await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

                expect(mockNext).toHaveBeenCalledWith(mockError)
                expect(mockResponse.json).not.toHaveBeenCalled()
            })
        })
    })
})
