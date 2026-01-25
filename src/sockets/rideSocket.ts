import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
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
            driverId?: string;
            pickupLat: number;
            pickupLng: number;
            dropoffLat: number;
            dropoffLng: number;
            pickupAddress?: string;
            dropoffAddress?: string;
            distance?: number;
            vehicleTypeId: string;
            fare: number
        }) => {
            try {
                // Create Ride
                const ride = await Ride.create({
                    passengerId: socket.user.id,
                    driverId: data.driverId || null,
                    pickupLat: data.pickupLat,
                    pickupLng: data.pickupLng,
                    dropoffLat: data.dropoffLat,
                    dropoffLng: data.dropoffLng,
                    pickupAddress: data.pickupAddress || null,
                    dropoffAddress: data.dropoffAddress || null,
                    distance: data.distance || null,
                    vehicleTypeId: data.vehicleTypeId,
                    status: 'REQUESTED',
                    fare: data.fare
                });

                if (data.driverId) {
                    // Targeted request
                    const driver = await User.findByPk(data.driverId);
                    if (driver && driver.socketId && driver.isOnline) {
                        io.to(driver.socketId).emit('newRideRequest', {
                            ...ride.toJSON(),
                            passengerName: socket.user.name || 'Passenger'
                        });
                    }
                } else {
                    // Broadcast to nearby drivers
                    const drivers = await User.findAll({ where: { role: 'driver', isOnline: true } });
                    const driversNearby = drivers.filter(driver => {
                        if (!driver.latitude || !driver.longitude) return false;
                        const dist = getDistanceFromLatLonInKm(data.pickupLat, data.pickupLng, driver.latitude, driver.longitude);
                        return dist <= 10;
                    });

                    driversNearby.forEach(driver => {
                        if (driver.socketId) {
                            io.to(driver.socketId).emit('newRideRequest', ride);
                        }
                    });
                }

                socket.emit('rideRequested', ride);

            } catch (error) {
                console.error('Ride request error', error);
                socket.emit('error', { message: 'Failed to request ride' });
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

        socket.on('acceptRide', async (data: { rideId: string }) => {
            try {
                const ride = await Ride.findByPk(data.rideId);
                if (!ride || ride.status !== 'REQUESTED') {
                    return socket.emit('error', { message: 'Ride not available' });
                }

                const driver = await User.findByPk(socket.user.id);
                if (!driver) {
                    return socket.emit('error', { message: 'Driver not found' });
                }

                ride.driverId = driver.id;
                ride.status = 'ACCEPTED';

                // Copy vehicle info to ride record if available
                if (driver.vehicleInfo) {
                    const vInfo = driver.vehicleInfo as any;
                    ride.vehicleModel = vInfo.model || null;
                    ride.vehicleColor = vInfo.color || null;
                    ride.vehicleRegistration = vInfo.registration || null;
                }

                await ride.save();

                const passenger = await User.findByPk(ride.passengerId);
                if (passenger && passenger.socketId) {
                    // Send notification with driver and vehicle details
                    io.to(passenger.socketId).emit('rideAccepted', {
                        ride: ride,
                        driver: {
                            name: driver.name,
                            phoneNumber: driver.phoneNumber,
                            vehicleModel: ride.vehicleModel,
                            vehicleColor: ride.vehicleColor,
                            vehicleRegistration: ride.vehicleRegistration
                        }
                    });
                }
                socket.emit('rideAcceptedSuccess', ride);
            } catch (error) {
                console.error('Accept ride error:', error);
                socket.emit('error', { message: 'Failed to accept ride' });
            }
        });

        // Start Ride
        socket.on('startRide', async (data: { rideId: string }) => {
            const ride = await Ride.findByPk(data.rideId);
            if (ride && ride.driverId === socket.user.id) {
                ride.status = 'IN_PROGRESS';
                ride.startTime = new Date();
                await ride.save();

                const passenger = await User.findByPk(ride.passengerId);
                if (passenger && passenger.socketId) {
                    io.to(passenger.socketId).emit('rideStarted', ride);
                }
            }
        });

        // Complete Ride
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
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
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
