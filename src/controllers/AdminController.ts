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
        const searchedRole = req.query.role;
        let users = []
        const paramterRole = `${searchedRole}`
        if (paramterRole !== 'undefined') {
            users = await User.findAll({
                where: { role: paramterRole },
                attributes: ['id', 'name', 'email', 'role', 'phoneNumber', 'isOnline', 'walletBalance', 'isActive', 'createdAt'],
                order: [['createdAt', 'DESC']]
            });
            return res.json(users);
        }
        users = await User.findAll({
            attributes: ['id', 'name', 'email', 'role', 'phoneNumber', 'isOnline', 'walletBalance', 'isActive', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ message: `Error fetching users : ${error?.message}` });
    }
};

export const getUserById = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const user = await User.findByPk(id, {
            attributes: { exclude: ['password'] }
        });
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: 'Error fetching user details' });
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

export const getRideById = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const ride = await Ride.findByPk(id, {
            include: [
                { model: User, as: 'passenger', attributes: ['id', 'name', 'email', 'phoneNumber'] },
                { model: User, as: 'driver', attributes: ['id', 'name', 'email', 'phoneNumber', 'vehicleModel', 'vehicleColor', 'vehiclePlate'] },
                { model: VehicleType, as: 'vehicleType', attributes: ['id', 'name', 'pricePerKm'] }
            ]
        });
        if (!ride) {
            return res.status(404).json({ message: 'Course non trouvée' });
        }
        res.json(ride);
    } catch (error) {
        console.error('Error fetching ride details:', error);
        res.status(500).json({ message: 'Error fetching ride details' });
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
        const id = req.params.id as string;
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
        const id = req.params.id as string;
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

export const resetUserPassword = async (req: Request, res: Response) => {
    try {
        const userId = req.params.id as string;
        const { newPassword } = req.body;
        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
        }
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        await user.update({ password: newPassword });
        res.json({ message: 'Mot de passe réinitialisé avec succès' });
    } catch (error) {
        console.error('Error resetting user password:', error);
        res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        let myId: any = id;
        const { name, email, phoneNumber } = req.body;

        const user = await User.findByPk(myId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        await user.update({ name, email, phoneNumber });
        res.json({ message: 'Utilisateur mis à jour avec succès', user });
    } catch (error: any) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: `Erreur lors de la mise à jour : ${error?.message}` });
    }
};

export const toggleUserStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        let myId: any = id
        const user = await User.findByPk(myId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        const newStatus = !user.isActive;
        await user.update({ isActive: newStatus });

        res.json({
            message: `Utilisateur ${newStatus ? 'activé' : 'désactivé'} avec succès`,
            isActive: newStatus
        });
    } catch (error: any) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ message: `Erreur lors du changement de statut : ${error?.message}` });
    }
};
