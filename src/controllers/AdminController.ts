import { Request, Response } from 'express';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { VehicleType } from '../models/VehicleType';
import { sequelize } from '../config/database';

export const getStats = async (req: Request, res: Response) => {
    try {
        const totalUsers = await User.count();
        const totalClients = await User.count({ where: { role: 'client' } });
        const totalDrivers = await User.count({ where: { role: 'driver' } });

        const totalRides = await Ride.count();
        const completedRides = await Ride.count({ where: { status: 'COMPLETED' } });

        const totalEarnings = await Ride.sum('fare', { where: { status: 'COMPLETED' } });

        res.json({
            users: {
                total: totalUsers,
                clients: totalClients,
                drivers: totalDrivers
            },
            rides: {
                total: totalRides,
                completed: completedRides
            },
            earnings: totalEarnings || 0
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

export const getUsers = async (req: Request, res: Response) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'name', 'email', 'role', 'phoneNumber', 'isOnline', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

export const getAllRides = async (req: Request, res: Response) => {
    try {
        const rides = await Ride.findAll({
            include: [
                { model: User, as: 'passenger', attributes: ['name'] },
                { model: User, as: 'driver', attributes: ['name'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(rides);
    } catch (error) {
        console.error('Error fetching all rides:', error);
        res.status(500).json({ message: 'Error fetching rides' });
    }
};

export const createVehicleType = async (req: Request, res: Response) => {
    try {
        const { name, pricePerKm, description } = req.body;
        const vehicleType = await VehicleType.create({ name, pricePerKm, description });
        res.status(201).json(vehicleType);
    } catch (error) {
        console.error('Error creating vehicle type:', error);
        res.status(500).json({ message: 'Error creating vehicle type' });
    }
};

export const getVehicleTypes = async (req: Request, res: Response) => {
    try {
        const vehicleTypes = await VehicleType.findAll({ order: [['name', 'ASC']] });
        res.json(vehicleTypes);
    } catch (error) {
        console.error('Error fetching vehicle types:', error);
        res.status(500).json({ message: 'Error fetching vehicle types' });
    }
};

export const updateVehicleType = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, pricePerKm, description } = req.body;
        const vehicleType = await VehicleType.findByPk(id);
        if (!vehicleType) {
            return res.status(404).json({ message: 'Vehicle type not found' });
        }
        await vehicleType.update({ name, pricePerKm, description });
        res.json(vehicleType);
    } catch (error) {
        console.error('Error updating vehicle type:', error);
        res.status(500).json({ message: 'Error updating vehicle type' });
    }
};

export const deleteVehicleType = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const vehicleType = await VehicleType.findByPk(id);
        if (!vehicleType) {
            return res.status(404).json({ message: 'Vehicle type not found' });
        }
        await vehicleType.destroy();
        res.json({ message: 'Vehicle type deleted' });
    } catch (error) {
        console.error('Error deleting vehicle type:', error);
        res.status(500).json({ message: 'Error deleting vehicle type' });
    }
};
