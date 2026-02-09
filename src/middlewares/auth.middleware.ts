import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        id: number;
        role: string;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];
    const token = authHeader;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('JWT_SECRET is not defined');
        return res.status(500).json({ error: 'Internal Server Error' });
    }

    jwt.verify(token, secret, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden: Invalid token' });
        }
        // user comes from jwt payload. If we signed with number, it is number.
        // Explicitly casting for TS safety if needed, though runtime it's already number.
        req.user = user;
        next();
    });
};
