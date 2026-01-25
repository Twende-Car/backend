import { Request, Response } from 'express';
import { Ride } from '../models/Ride';
import { User } from '../models/User';
import { VehicleType } from '../models/VehicleType';

export const estimateFare = async (req: Request, res: Response) => {
    try {
        const { distance, vehicleTypeId } = req.body;
        const vehicleType = await VehicleType.findByPk(vehicleTypeId);

        if (!vehicleType) {
            return res.status(404).json({ message: 'Vehicle type not found' });
        }

        const fare = distance * vehicleType.pricePerKm;
        res.json({ fare, distance, vehicleType: vehicleType.name });
    } catch (error) {
        console.error('Error estimating fare:', error);
        res.status(500).json({ message: 'Error calculating estimation' });
    }
};

export const getHistory = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const userRole = (req as any).user.role;

        const whereClause = userRole === 'driver'
            ? { driverId: userId }
            : { passengerId: userId };

        const rides = await Ride.findAll({
            where: whereClause,
            include: [
                { model: User, as: 'passenger', attributes: ['id', 'name', 'email', 'phoneNumber'] },
                { model: User, as: 'driver', attributes: ['id', 'name', 'email', 'phoneNumber', 'vehicleInfo'] },
                { model: VehicleType, as: 'vehicleType' }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(rides);
    } catch (error) {
        console.error('Error fetching ride history:', error);
        res.status(500).json({ message: 'Error fetching ride history' });
    }
};
