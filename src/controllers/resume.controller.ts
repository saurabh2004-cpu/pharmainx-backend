import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const uploadDir = 'uploads/resume';

export const downloadResume = (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    // Security check: Prevent directory traversal
    // Although standard IDs are safe, this ensures no malicious paths are processed
    if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) {
        return res.status(400).json({ error: 'Invalid User ID' });
    }

    // Extensions to check in order
    const extensions = ['.pdf', '.doc', '.docx'];
    let filePath: string | null = null;

    for (const ext of extensions) {
        // Prevent directory traversal by strictly joining strictly defined paths
        // userId should ideally be validated, but here we just check availability
        const potentialPath = path.join(uploadDir, `${userId}${ext}`);
        if (fs.existsSync(potentialPath)) {
            filePath = potentialPath;
            break;
        }
    }

    if (filePath) {
        // Resolve absolute path for res.download
        const absolutePath = path.resolve(filePath);
        res.download(absolutePath, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error downloading file' });
                }
            }
        });
    } else {
        res.status(404).json({ error: 'Resume not found for this user' });
    }
};
