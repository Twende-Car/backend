import { Request, Response } from 'express';
import { Ride } from '../models/Ride';
import { RideOffer } from '../models/RideOffer';
import { User } from '../models/User';
import { VehicleType } from '../models/VehicleType';
import { Op } from 'sequelize';

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

/** Client: get REQUESTED ride with pending offers (for history / restore after error) */
export const getActiveRequest = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const ride = await Ride.findOne({
            where: { passengerId: userId, status: 'REQUESTED' },
            include: [{ model: VehicleType, as: 'vehicleType', attributes: ['id', 'name', 'pricePerKm'] }]
        });
        if (!ride) return res.json(null);
        const offers = await RideOffer.findAll({
            where: { rideId: ride.id, status: 'PENDING' },
            include: [{ model: User, as: 'driver', attributes: ['id', 'name', 'vehicleModel', 'vehicleBrand', 'vehicleColor', 'vehiclePlate', 'vehiclePhotos'] }]
        });
        const offersWithDriver = offers.map(o => {
            const offer = o.toJSON();
            const driver = (offer as any).driver;
            return { offer: { id: offer.id, price: offer.price, rideId: offer.rideId }, driver: driver ? { name: driver.name, vehicleModel: [driver.vehicleBrand, driver.vehicleModel].filter(Boolean).join(' '), vehicleColor: driver.vehicleColor, vehiclePlate: driver.vehiclePlate, vehiclePhoto: driver.vehiclePhotos?.[0], rating: 4.5 } : null };
        });
        res.json({ ride, offers: offersWithDriver });
    } catch (error) {
        console.error('Error fetching active request:', error);
        res.status(500).json({ message: 'Error fetching active request' });
    }
};

/** Client: get current ride (REQUESTED with offers, or ACCEPTED/IN_PROGRESS with driver) for state restore */
export const getCurrentRide = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const ride = await Ride.findOne({
            where: { passengerId: userId, status: { [Op.in]: ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'] } },
            include: [{ model: VehicleType, as: 'vehicleType', attributes: ['id', 'name', 'pricePerKm'] }],
            order: [['createdAt', 'DESC']]
        });
        if (!ride) return res.json(null);
        const rideJson = ride.toJSON() as any;
        if (ride.status === 'REQUESTED') {
            const offers = await RideOffer.findAll({
                where: { rideId: ride.id, status: 'PENDING' },
                include: [{ model: User, as: 'driver', attributes: ['id', 'name', 'vehicleModel', 'vehicleBrand', 'vehicleColor', 'vehiclePlate', 'vehiclePhotos'] }]
            });
            const offersWithDriver = offers.map(o => {
                const offer = o.toJSON();
                const driver = (offer as any).driver;
                return { offer: { id: offer.id, price: offer.price, rideId: offer.rideId }, driver: driver ? { name: driver.name, vehicleModel: [driver.vehicleBrand, driver.vehicleModel].filter(Boolean).join(' '), vehicleColor: driver.vehicleColor, vehiclePlate: driver.vehiclePlate, vehiclePhoto: driver.vehiclePhotos?.[0], rating: 4.5 } : null };
            });
            return res.json({ ride: rideJson, offers: offersWithDriver });
        }
        const driver = ride.driverId ? await User.findByPk(ride.driverId, { attributes: ['id', 'name', 'phoneNumber', 'vehicleBrand', 'vehicleModel', 'vehiclePlate', 'vehicleColor', 'vehiclePhotos'] }) : null;
        res.json({ ride: rideJson, driver: driver ? { id: driver.id, name: driver.name, phoneNumber: driver.phoneNumber, vehicleBrand: driver.vehicleBrand, vehicleModel: driver.vehicleModel, vehiclePlate: driver.vehiclePlate, vehicleColor: driver.vehicleColor, vehiclePhoto: (driver as any).vehiclePhotos?.[0] } : null });
    } catch (error) {
        console.error('Error fetching current ride:', error);
        res.status(500).json({ message: 'Error fetching current ride' });
    }
};

/** Client: accept an offer by ID (REST fallback when socket was disconnected) */
export const acceptOfferByApi = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const offerId = req.params.offerId as string;
        const offer = await RideOffer.findByPk(offerId);
        if (!offer) return res.status(404).json({ message: 'Offre introuvable' });
        const ride = await Ride.findByPk(offer.rideId);
        if (!ride || ride.passengerId !== userId) return res.status(403).json({ message: 'Accès refusé' });
        if (ride.status !== 'REQUESTED') return res.status(400).json({ message: 'Cette course n\'est plus disponible' });

        offer.status = 'ACCEPTED';
        await offer.save();
        const driver = await User.findByPk(offer.driverId);
        ride.driverId = offer.driverId;
        ride.fare = offer.price;
        ride.status = 'ACCEPTED';
        if (driver) {
            ride.vehicleModel = driver.vehicleModel;
            ride.vehicleColor = driver.vehicleColor;
            ride.vehicleRegistration = driver.vehiclePlate;
        }
        await ride.save();

        await RideOffer.update({ status: 'REJECTED' }, { where: { rideId: ride.id, id: { [Op.ne]: offer.id } } });

        const io = (req as any).app.get('io');
        if (io && driver?.socketId) io.to(driver.socketId).emit('offerAccepted', { ride });
        if (io) io.to('drivers').emit('rideNoLongerAvailable', { rideId: ride.id });

        const driverPayload = driver ? {
            id: driver.id,
            name: driver.name,
            phoneNumber: driver.phoneNumber,
            vehicleBrand: driver.vehicleBrand,
            vehicleModel: driver.vehicleModel,
            vehiclePlate: driver.vehiclePlate,
            vehicleColor: driver.vehicleColor,
            vehiclePhoto: (driver as any).vehiclePhotos?.[0] || null
        } : null;
        res.json({ ride, driver: driverPayload });
    } catch (error) {
        console.error('Error accepting offer:', error);
        res.status(500).json({ message: 'Error accepting offer' });
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
            },
            include: [
                { model: User, as: 'passenger', attributes: ['id', 'name', 'phoneNumber'] }
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
            return ride.distanceToPickup! <= 50;
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
