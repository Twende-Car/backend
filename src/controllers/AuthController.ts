import { Request, Response } from 'express';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role, phoneNumber, vehicleInfo } = req.body;

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const userPayload: any = {
            name,
            email,
            password,
            role,
            phoneNumber,
        };

        if (role === 'driver') {
            userPayload.vehicleInfo = vehicleInfo || null;
            userPayload.idCardNumber = vehicleInfo?.idCardNumber || null;
            userPayload.address = vehicleInfo?.address || null;
            userPayload.driverPhoto = vehicleInfo?.driverPhoto || null;
            userPayload.idCardPhoto = vehicleInfo?.idCardPhoto || null;
            userPayload.vehiclePhotos = vehicleInfo?.vehiclePhotos || null;
            userPayload.vehicleBrand = vehicleInfo?.vehicleBrand || null;
            userPayload.vehicleModel = vehicleInfo?.vehicleModel || null;
            userPayload.vehiclePlate = vehicleInfo?.vehiclePlate || null;
            userPayload.vehicleColor = vehicleInfo?.vehicleColor || null;
            userPayload.vehicleTypeId = vehicleInfo?.vehicleTypeId || null;
            userPayload.isApproved = false; // Drivers need approval
        } else {
            userPayload.isApproved = true; // Clients are approved by default
        }

        const newUser = await User.create(userPayload);

        res.status(201).json({ message: 'User created successfully', user: { id: newUser.id, email: newUser.email, role: newUser.role } });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Error registering user', error });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { phoneNumber, password } = req.body;

        const user = await User.findOne({ where: { phoneNumber } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.validatePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.role === 'driver' && !user.isApproved) {
            return res.status(403).json({ message: 'Your account is pending approval.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '1h' }
        );
        const refreshToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role, type: 'refresh' },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            refreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phoneNumber,
                vehiclePhoto: user.vehiclePhotos ? user.vehiclePhotos[0] : null
            }
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Error logging in', error });
    }
};

export const refreshToken = async (req: Request, res: Response) => {
    try {
        const { refreshToken: refreshTokenBody } = req.body;
        if (!refreshTokenBody) {
            return res.status(401).json({ message: 'Refresh token required' });
        }

        const decoded = jwt.verify(
            refreshTokenBody,
            process.env.JWT_SECRET || 'secret_key'
        ) as { id: string; email: string; role: string; type?: string };

        if (decoded.type !== 'refresh') {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        const user = await User.findByPk(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.role === 'driver' && !user.isApproved) {
            return res.status(403).json({ message: 'Your account is pending approval.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '1h' }
        );
        const newRefreshToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role, type: 'refresh' },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            refreshToken: newRefreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phoneNumber,
                vehiclePhoto: user.vehiclePhotos ? user.vehiclePhotos[0] : null
            }
        });
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
            return res.status(403).json({ message: 'Invalid or expired refresh token' });
        }
        console.error('Error refreshing token:', error);
        res.status(500).json({ message: 'Error refreshing token' });
    }
};
