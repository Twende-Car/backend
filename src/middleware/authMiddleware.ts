import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
    user?: any;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
            if (err) {
                return res.status(403).json({ message: 'Invalid Token' });
            }

            req.user = user;
            next();
        });
    } else {
        res.status(401).json({ message: 'Authentication token required' });
    }
};
