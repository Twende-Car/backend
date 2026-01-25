import { Request, Response } from 'express';
import { User } from '../models/User';

export const registerDriver = async (req: Request, res: Response) => {
    try {
        const {
            name,
            email,
            password,
            phoneNumber,
            idCardNumber,
            address,
            vehicleBrand,
            vehicleModel,
            vehiclePlate,
            vehicleColor,
            vehicleTypeId,
        } = req.body;

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const driverPhoto = files['driverPhoto']?.[0]?.path;
        const idCardPhoto = files['idCardPhoto']?.[0]?.path;
        const vehiclePhotos = files['vehiclePhotos']?.map((file) => file.path) || [];

        const newUser = await User.create({
            name,
            email,
            password,
            phoneNumber,
            role: 'driver',
            idCardNumber,
            address,
            driverPhoto,
            idCardPhoto,
            vehiclePhotos,
            vehicleBrand,
            vehicleModel,
            vehiclePlate,
            vehicleColor,
            vehicleTypeId,
            isApproved: false,
        });

        res.status(201).json({
            message: 'Registration submitted. Waiting for approval.',
            user: { id: newUser.id, email: newUser.email },
        });
    } catch (error) {
        console.error('Error registering driver:', error);
        res.status(500).json({ message: 'Error registering driver', error });
    }
};

export const getPendingDrivers = async (req: Request, res: Response) => {
    try {
        const pendingDrivers = await User.findAll({
            where: { role: 'driver', isApproved: false },
        });
        res.json(pendingDrivers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pending drivers', error });
    }
};

export const approveDriver = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const driver = await User.findByPk(id);

        if (!driver || driver.role !== 'driver') {
            return res.status(404).json({ message: 'Driver not found' });
        }

        driver.isApproved = true;
        await driver.save();

        res.json({ message: 'Driver approved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error approving driver', error });
    }
};
