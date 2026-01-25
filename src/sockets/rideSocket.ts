import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { RideOffer } from '../models/RideOffer';
import { Op } from 'sequelize';

interface AuthSocket extends Socket {
    user?: any;
}

export const initializeSockets = (io: Server) => {
    io.use((socket: AuthSocket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication error'));

        jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err: any, decoded: any) => {
            if (err) return next(new Error('Authentication error'));
            socket.user = decoded;
            next();
        });
    });

    io.on('connection', async (socket: AuthSocket) => {
        console.log(`User connected: ${socket.user.id}`);

        // Update User Socket ID and Status
        await User.update(
            { socketId: socket.id, isOnline: true },
            { where: { id: socket.user.id } }
        );

        socket.on('updateLocation', async (data: { lat: number; lng: number }) => {
            await User.update(
                { latitude: data.lat, longitude: data.lng },
                { where: { id: socket.user.id } }
            );
        });

        socket.on('requestRide', async (data: {
            pickupLat: number;
            pickupLng: number;
            dropoffLat: number;
            dropoffLng: number;
            pickupAddress?: string;
            dropoffAddress?: string;
            distance?: number;
            vehicleTypeId: string;
        }) => {
            try {
                // Create Ride without fare (will be decided via bidding)
                const ride = await Ride.create({
                    passengerId: socket.user.id,
                    pickupLat: data.pickupLat,
                    pickupLng: data.pickupLng,
                    dropoffLat: data.dropoffLat,
                    dropoffLng: data.dropoffLng,
                    pickupAddress: data.pickupAddress || null,
                    dropoffAddress: data.dropoffAddress || null,
                    distance: data.distance || null,
                    vehicleTypeId: data.vehicleTypeId,
                    status: 'REQUESTED',
                });

                // Broadcast to drivers with matching vehicle type
                const drivers = await User.findAll({
                    where: {
                        role: 'driver',
                        isOnline: true,
                        vehicleTypeId: data.vehicleTypeId
                    }
                });

                drivers.forEach(driver => {
                    if (driver.socketId) {
                        io.to(driver.socketId).emit('newRideRequest', ride);
                    }
                });

                socket.emit('rideRequested', ride);

            } catch (error) {
                console.error('Ride request error', error);
                socket.emit('error', { message: 'Failed to request ride' });
            }
        });

        socket.on('submitOffer', async (data: { rideId: string, price: number }) => {
            try {
                const offer = await RideOffer.create({
                    rideId: data.rideId,
                    driverId: socket.user.id,
                    price: data.price,
                    status: 'PENDING'
                });

                const ride = await Ride.findByPk(data.rideId);
                if (ride) {
                    const passenger = await User.findByPk(ride.passengerId);
                    if (passenger && passenger.socketId) {
                        const driver = await User.findByPk(socket.user.id);
                        io.to(passenger.socketId).emit('newOffer', {
                            offer,
                            driver: {
                                name: driver?.name,
                                rating: 4.5, // Mock rating
                                vehicleModel: driver?.vehicleBrand + ' ' + driver?.vehicleModel,
                                vehicleColor: driver?.vehicleColor
                            }
                        });
                    }
                }
                socket.emit('offerSubmitted', offer);
            } catch (error) {
                console.error('Submit offer error:', error);
                socket.emit('error', { message: 'Failed to submit offer' });
            }
        });

        socket.on('acceptOffer', async (data: { offerId: string }) => {
            try {
                const offer = await RideOffer.findByPk(data.offerId);
                if (!offer) return socket.emit('error', { message: 'Offer not found' });

                const ride = await Ride.findByPk(offer.rideId);
                if (!ride || ride.status !== 'REQUESTED') return socket.emit('error', { message: 'Ride not available' });

                // Update offer and ride
                offer.status = 'ACCEPTED';
                await offer.save();

                ride.driverId = offer.driverId;
                ride.fare = offer.price;
                ride.status = 'ACCEPTED';

                const driver = await User.findByPk(offer.driverId);
                if (driver) {
                    ride.vehicleModel = driver.vehicleModel;
                    ride.vehicleColor = driver.vehicleColor;
                    ride.vehicleRegistration = driver.vehiclePlate;
                }
                await ride.save();

                // Reject other offers
                await RideOffer.update(
                    { status: 'REJECTED' },
                    { where: { rideId: ride.id, id: { [Op.ne]: offer.id } } }
                );

                // Notify driver
                if (driver && driver.socketId) {
                    io.to(driver.socketId).emit('offerAccepted', { ride });
                }

                // Notify passenger
                socket.emit('rideAcceptedSuccess', { ride, driver });

            } catch (error) {
                console.error('Accept offer error:', error);
                socket.emit('error', { message: 'Failed to accept offer' });
            }
        });

        socket.on('confirmStart', async (data: { rideId: string }) => {
            try {
                const ride = await Ride.findByPk(data.rideId);
                if (!ride) return socket.emit('error', { message: 'Ride not found' });

                if (socket.user.id === ride.passengerId) {
                    ride.passengerConfirmedStart = true;
                } else if (socket.user.id === ride.driverId) {
                    ride.driverConfirmedStart = true;
                }

                await ride.save();

                // Notify both
                const passenger = await User.findByPk(ride.passengerId);
                const driver = await User.findByPk(ride.driverId!);

                if (passenger?.socketId) io.to(passenger.socketId).emit('startConfirmed', { by: socket.user.role, ride });
                if (driver?.socketId) io.to(driver.socketId).emit('startConfirmed', { by: socket.user.role, ride });

                // If both confirmed, start the ride
                if (ride.passengerConfirmedStart && ride.driverConfirmedStart) {
                    ride.status = 'IN_PROGRESS';
                    ride.startTime = new Date();
                    await ride.save();

                    if (passenger?.socketId) io.to(passenger.socketId).emit('rideStarted', ride);
                    if (driver?.socketId) io.to(driver.socketId).emit('rideStarted', ride);
                }
            } catch (error) {
                socket.emit('error', { message: 'Failed to confirm start' });
            }
        });

        socket.on('cancelRide', async (data: { rideId: string }) => {
            const ride = await Ride.findByPk(data.rideId);
            if (ride) {
                ride.status = 'CANCELLED';
                await ride.save();

                // Inform driver if assigned
                if (ride.driverId) {
                    const driver = await User.findByPk(ride.driverId);
                    if (driver && driver.socketId) {
                        io.to(driver.socketId).emit('rideCancelled', { rideId: ride.id });
                    }
                }
                socket.emit('rideCancelledSuccess', { rideId: ride.id });
            }
        });

        socket.on('completeRide', async (data: { rideId: string }) => {
            const ride = await Ride.findByPk(data.rideId);
            if (ride && ride.driverId === socket.user.id) {
                ride.status = 'COMPLETED';
                ride.endTime = new Date();
                await ride.save();

                const passenger = await User.findByPk(ride.passengerId);
                if (passenger && passenger.socketId) {
                    io.to(passenger.socketId).emit('rideCompleted', ride);
                }
            }
        });

        socket.on('disconnect', async () => {
            await User.update(
                { isOnline: false },
                { where: { id: socket.user.id } }
            );
            console.log(`User disconnected: ${socket.user.id}`);
        });
    });
};

// Helper for distance calculation
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
