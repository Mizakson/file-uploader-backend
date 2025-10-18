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

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        storage: {
            from: jest.fn(() => ({
                createSignedUrl: mockCreateSignedUrl,
            })),
        },
    })),
}))


const mockJwtSign = jest.fn()
jest.mock('jsonwebtoken', () => ({
    sign: mockJwtSign,
}))
const mockBcryptCompare = jest.fn()
jest.mock('bcryptjs', () => ({
    compare: mockBcryptCompare,
}))

const indexController = require('../controllers/indexController')
const prisma = require('../prisma/prisma')

describe('indexController (JWT refactor)', () => {
    let mockResponse
    let mockRequest
    const mockNext = jest.fn()

    const MOCK_USER = { id: 'test-user-id', name: 'testuser' }

    beforeEach(() => {
        mockResponse = {
            status: jest.fn(() => mockResponse),
            send: jest.fn(),
            json: jest.fn(),
            setHeader: mockSetHeader,
            locals: {
                currentUser: MOCK_USER
            }
        }

        mockRequest = {
            user: MOCK_USER,
            params: {},
            body: {
                username: 'testuser',
                password: 'password123'
            }
        }
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('postLogin', () => {
        test('should return 401 for invalid username', async () => {
            prisma.user.findUnique.mockResolvedValue(null)

            await indexController.postLogin(mockRequest, mockResponse, mockNext)

            expect(mockResponse.status).toHaveBeenCalledWith(401)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: "Invalid credentials." })
            expect(mockBcryptCompare).not.toHaveBeenCalled()
            expect(mockJwtSign).not.toHaveBeenCalled()
        })

        test('should return 401 for incorrect password', async () => {
            const mockDbUser = { id: 'user-id', name: 'testuser', password: 'hashedpassword' }
            prisma.user.findUnique.mockResolvedValue(mockDbUser)
            mockBcryptCompare.mockResolvedValue(false) // mismatch

            await indexController.postLogin(mockRequest, mockResponse, mockNext)

            expect(mockBcryptCompare).toHaveBeenCalledWith('password123', 'hashedpassword')
            expect(mockResponse.status).toHaveBeenCalledWith(401)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: "Invalid credentials." })
            expect(mockJwtSign).not.toHaveBeenCalled()
        })

        test('should return 200 with JWT token and user data on successful login', async () => {
            const mockDbUser = { id: 'user-id-1', name: 'testuser', password: 'hashedpassword' }
            const MOCK_TOKEN = 'mock.jwt.token'
            prisma.user.findUnique.mockResolvedValue(mockDbUser)
            mockBcryptCompare.mockResolvedValue(true) // match
            mockJwtSign.mockReturnValue(MOCK_TOKEN)

            await indexController.postLogin(mockRequest, mockResponse, mockNext)

            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { name: 'testuser' } })

            // token
            expect(mockJwtSign).toHaveBeenCalledWith(
                { id: 'user-id-1', name: 'testuser' },
                expect.any(String), // SECRET_KEY
                { expiresIn: '1d' }
            )

            // response
            expect(mockResponse.status).toHaveBeenCalledWith(200)
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: "Login successful",
                token: "Bearer " + MOCK_TOKEN,
                user: { id: 'user-id-1', username: 'testuser' }
            })
        })

        test('should call next with an error if an exception occurs', async () => {
            const mockError = new Error('Database error during login')
            prisma.user.findUnique.mockRejectedValue(mockError)

            await indexController.postLogin(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
        })
    })

    describe('getIndex (Protected Route)', () => {

        test('should send 200 status with user data if authenticated (via req.user)', async () => {
            const mockFolders = [{ id: 'folder1', name: 'Folder 1' }]
            prisma.user.findUnique.mockResolvedValue({ folders: mockFolders })

            await indexController.getIndex(mockRequest, mockResponse, mockNext)

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: MOCK_USER.id },
                include: {
                    folders: {
                        orderBy: { id: 'asc' }
                    }
                },
            })
            expect(mockResponse.status).toHaveBeenCalledWith(200)
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'User data retrieved successfully',
                user: MOCK_USER,
                folders: mockFolders,
            })
        })

        test('should call next with an error if prisma fails', async () => {
            const mockError = new Error('Database connection failed')
            prisma.user.findUnique.mockRejectedValue(mockError)

            await indexController.getIndex(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
        })

        test('should send 404 status if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null)

            await indexController.getIndex(mockRequest, mockResponse, mockNext)

            await indexController.getIndex(mockRequest, mockResponse, mockNext)

            expect(mockResponse.status).toHaveBeenCalledWith(404)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'User not found.' })

        })
    })


    describe('getSignUp', () => {
        test('should send 200 status', () => {
            indexController.getSignUp(mockRequest, mockResponse)
            expect(mockResponse.status).toHaveBeenCalledWith(200)
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: "Ready for sign-up",
            })
        })
    })

    describe('getLogin', () => {
        test('should send 200 status', () => {
            indexController.getLogin(mockRequest, mockResponse)
            expect(mockResponse.status).toHaveBeenCalledWith(200)
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: "Ready for login.",
            })
        })
    })

    describe('getLogout (Simple Client Instruction)', () => {
        test('should send a 200 status with client instruction', () => {
            indexController.getLogout(mockRequest, mockResponse, mockNext)
            expect(mockResponse.status).toHaveBeenCalledWith(200)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Logged out successfully (Please delete token client-side)' })
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
                where: { id: 'folder-123', userId: 'test-user-id' },
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
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Folder not found or access denied.' })
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
            const mockFile = { name: 'test.pdf', folderId: 'folder-abc' }
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
                where: { id: 'file-456', folder: { userId: 'test-user-id' } },
                select: { name: true, folderId: true, },
            })

            expect(mockCreateSignedUrl).toHaveBeenCalledWith('test.pdf', 3600)
            expect(fetch).toHaveBeenCalledWith(mockSignedUrl)
            expect(mockSetHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="test.pdf"')
            expect(require('stream').Readable.fromWeb).toHaveBeenCalledWith(mockWebReadableStream)
            expect(mockPipe).toHaveBeenCalledWith(mockResponse)
        })

        test('should send 404 status if the file is not found in the database', async () => {
            mockRequest.params.fileId = 'non-existent-file'
            prisma.file.findUnique.mockResolvedValue(null)

            await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

            expect(prisma.file.findUnique).toHaveBeenCalled()
            expect(mockResponse.status).toHaveBeenCalledWith(404)
            expect(mockResponse.json).toHaveBeenCalledWith({ message: "File not found or access denied." })
        })

        test('should send 500 status if an error occurs while generating the signed URL', async () => {
            mockRequest.params.fileId = 'file-456'
            const mockFile = { name: 'test.pdf', folderId: 'folder-abc' }

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
            const mockFile = { name: 'test.pdf', folderId: 'folder-abc' }
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
            const mockFile = { name: 'test.pdf', folderId: 'folder-abc' }
            const mockError = new Error('Unexpected database error')

            prisma.file.findUnique.mockResolvedValue(mockFile)
            mockCreateSignedUrl.mockRejectedValue(mockError)

            await indexController.getDownloadFile(mockRequest, mockResponse, mockNext)

            expect(mockNext).toHaveBeenCalledWith(mockError)
            expect(mockResponse.json).not.toHaveBeenCalled()
        })
    })
})