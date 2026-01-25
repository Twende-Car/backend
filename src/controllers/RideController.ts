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
export const getRideDetails = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const ride = await Ride.findByPk(id, {
            include: [
                { model: User, as: 'passenger', attributes: ['id', 'name', 'email', 'phoneNumber'] },
                { model: User, as: 'driver', attributes: ['id', 'name', 'email', 'phoneNumber', 'vehicleInfo'] },
                { model: VehicleType, as: 'vehicleType' }
            ]
        });

        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        res.json(ride);
    } catch (error) {
        console.error('Error fetching ride details:', error);
        res.status(500).json({ message: 'Error fetching ride details' });
    }
};

export const getAvailableRides = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const driver = await User.findByPk(userId);

        if (!driver || driver.role !== 'driver') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { lat, lng } = req.query;
        const driverLat = lat ? parseFloat(lat as string) : driver.latitude;
        const driverLng = lng ? parseFloat(lng as string) : driver.longitude;

        const rides = await Ride.findAll({
            where: {
                status: 'REQUESTED',
                vehicleTypeId: driver.vehicleTypeId
            },
            include: [
                { model: User, as: 'passenger', attributes: ['id', 'name'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Filter by 10km and add distance info
        const nearbyRides = rides.map(ride => {
            let distanceToPickup = null;
            if (driverLat && driverLng) {
                distanceToPickup = getDistanceFromLatLonInKm(driverLat, driverLng, ride.pickupLat, ride.pickupLng);
            }
            return {
                ...ride.toJSON(),
                distanceToPickup
            };
        }).filter(ride => {
            if (!driverLat || !driverLng) return true; // Return all if driver loc unknown
            return ride.distanceToPickup! <= 10;
        });

        res.json(nearbyRides);
    } catch (error) {
        console.error('Error fetching available rides:', error);
        res.status(500).json({ message: 'Error fetching available rides' });
    }
};

// Helper for distance calculation (duplicated here or move to utils)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}
