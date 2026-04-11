import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './auth.middleware.js';

export const optionalAuthenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.cookies.accessToken || req.cookies.adminAccessToken || req.headers.authorization?.split(' ')[1];
    const token = authHeader;

    if (!token) {
        return next();
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('JWT_SECRET is not defined');
        return next();
    }

    jwt.verify(token, secret, (err: any, user: any) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
};
