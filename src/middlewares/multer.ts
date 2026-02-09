import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { AuthRequest } from './auth.middleware';

// Ensure upload directory exists
const uploadDir = 'uploads/resume';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req: AuthRequest, file: any, cb: any) => {
        cb(null, uploadDir);
    },
    filename: (req: AuthRequest, file: any, cb: any) => {
        // Use userId for filename
        const userId = req.user?.id;
        if (!userId) {
            return cb(new Error('User not authenticated'));
        }
        cb(null, userId + path.extname(file.originalname));
    },
});

const fileFilter = (req: any, file: any, cb: FileFilterCallback) => {
    const allowedExtensions = /pdf|doc|docx/;
    const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.includes(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Only pdf, doc, and docx files are allowed!'));
    }
};

export const uploadRecursive = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter,
});
