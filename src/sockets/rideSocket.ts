import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { RideOffer } from '../models/RideOffer';
import { VehicleType } from '../models/VehicleType';
import { SystemSetting } from '../models/SystemSetting';
import { Transaction } from '../models/Transaction';
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

        // Drivers join a room so we can broadcast "ride no longer available"
        if (socket.user.role === 'driver') {
            socket.join('drivers');
        }

        socket.on('updateLocation', async (data: { lat: number; lng: number }) => {
            const user = await User.findByPk(socket.user.id);
            if (user?.role === 'driver' && (user.walletBalance || 0) < 0) {
                await User.update(
                    { isOnline: false },
                    { where: { id: socket.user.id } }
                );
                socket.emit('error', { message: 'Insufficient funds. Please top up your wallet to go online.' });
                return;
            }

            await User.update(
                { latitude: data.lat, longitude: data.lng, isOnline: true },
                { where: { id: socket.user.id } }
            );

            // If user is a driver and has an active ride (ACCEPTED or IN_PROGRESS), notify the passenger
            if (socket.user.role === 'driver') {
                const activeRide = await Ride.findOne({
                    where: {
                        driverId: socket.user.id,
                        status: { [Op.in]: ['ACCEPTED', 'IN_PROGRESS'] }
                    }
                });

                if (activeRide) {
                    const passenger = await User.findByPk(activeRide.passengerId);
                    if (passenger && passenger.socketId) {
                        io.to(passenger.socketId).emit('driverLocationUpdate', {
                            lat: data.lat,
                            lng: data.lng,
                            rideId: activeRide.id
                        });
                    }
                }
            }
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
            passengerName: string;
            passengerPhone: string;
            estimatedFare?: number;
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

                // Broadcast to drivers with matching vehicle type and proximity
                const drivers = await User.findAll({
                    where: {
                        role: 'driver',
                        isOnline: true,
                        vehicleTypeId: data.vehicleTypeId
                    }
                });

                const passenger = await User.findByPk(socket.user.id);

                drivers.forEach(driver => {
                    if (driver.socketId && driver.latitude && driver.longitude) {
                        const dist = getDistanceFromLatLonInKm(data.pickupLat, data.pickupLng, driver.latitude, driver.longitude);
                        if (dist <= 10) { // Only notify drivers within 10km
                            io.to(driver.socketId).emit('newRideRequest', {
                                ...ride.toJSON(),
                                passengerName: passenger?.name || 'Passager',
                                passengerPhone: passenger?.phoneNumber || null,
                                passenger: passenger ? { name: passenger.name, phoneNumber: passenger.phoneNumber } : null,
                                distanceToPickup: dist
                            });
                        }
                    }
                });

                socket.emit('rideRequested', { ride, estimatedFare: data.estimatedFare });

            } catch (error: any) {
                socket.emit('errorRideRequest', { message: 'Failed to request ride: ' + error.message });
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
                                vehicleColor: driver?.vehicleColor,
                                vehiclePlate: driver?.vehiclePlate,
                                vehiclePhoto: driver?.vehiclePhotos?.[0] || null
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

                // Notify other drivers that this ride is no longer available
                if (driver?.socketId) {
                    socket.to('drivers').emit('rideNoLongerAvailable', { rideId: ride.id });
                }

                // Notify passenger
                if (driver) {
                    socket.emit('rideAcceptedSuccess', {
                        ride,
                        driver: {
                            id: driver.id,
                            name: driver.name,
                            phoneNumber: driver.phoneNumber,
                            vehicleBrand: driver.vehicleBrand,
                            vehicleModel: driver.vehicleModel,
                            vehiclePlate: driver.vehiclePlate,
                            vehicleColor: driver.vehicleColor,
                            vehiclePhoto: driver.vehiclePhotos?.[0] || null
                        }
                    });
                } else {
                    socket.emit('rideAcceptedSuccess', { ride, driver: null });
                }

            } catch (error) {
                console.error('Accept offer error:', error);
                socket.emit('error', { message: 'Failed to accept offer' });
            }
        });

        socket.on('driverAcceptRide', async (data: { rideId: string }) => {
            try {
                const ride = await Ride.findByPk(data.rideId);
                if (!ride) return socket.emit('error', { message: 'Course introuvable' });
                if (ride.status !== 'REQUESTED') return socket.emit('error', { message: 'Cette course a déjà été acceptée par un autre chauffeur' });

                const driver = await User.findByPk(socket.user.id);
                if (!driver || driver.role !== 'driver') return socket.emit('error', { message: 'Accès refusé' });

                let distanceKm = ride.distance;
                if (distanceKm == null || distanceKm <= 0) {
                    distanceKm = getDistanceFromLatLonInKm(ride.pickupLat, ride.pickupLng, ride.dropoffLat, ride.dropoffLng);
                }
                const vehicleType = ride.vehicleTypeId ? await VehicleType.findByPk(ride.vehicleTypeId) : null;
                const pricePerKm = vehicleType?.pricePerKm ?? 500;
                const fare = Math.round(distanceKm * pricePerKm);

                ride.driverId = socket.user.id;
                ride.fare = fare;
                ride.status = 'ACCEPTED';
                ride.vehicleModel = driver.vehicleModel || null;
                ride.vehicleColor = driver.vehicleColor || null;
                ride.vehicleRegistration = driver.vehiclePlate || null;
                if (ride.distance == null) ride.distance = distanceKm;
                await ride.save();

                const passenger = await User.findByPk(ride.passengerId, { attributes: ['id', 'name', 'phoneNumber'] });

                // Notify this driver (with passenger so details modal can show contact)
                io.to(socket.id).emit('offerAccepted', {
                    ride,
                    passenger: passenger ? { name: passenger.name, phoneNumber: passenger.phoneNumber } : null
                });

                // Notify other drivers that this ride is no longer available
                socket.to('drivers').emit('rideNoLongerAvailable', { rideId: ride.id });

                // Notify passenger
                if (passenger?.socketId) {
                    io.to(passenger.socketId).emit('rideAcceptedByDriver', {
                        ride,
                        driver: {
                            id: driver.id,
                            name: driver.name,
                            phoneNumber: driver.phoneNumber,
                            vehicleBrand: driver.vehicleBrand,
                            vehicleModel: driver.vehicleModel,
                            vehiclePlate: driver.vehiclePlate,
                            vehicleColor: driver.vehicleColor,
                            vehiclePhoto: driver.vehiclePhotos?.[0] || null
                        }
                    });
                }
            } catch (error) {
                console.error('driverAcceptRide error:', error);
                socket.emit('error', { message: 'Impossible d\'accepter la course' });
            }
        });

        socket.on('confirmStart', async (data: { rideId: string }) => {
            console.log("confirmStart")
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
                const passenger = await User.findByPk(ride.passengerId, { attributes: ['id', 'name', 'phoneNumber', 'socketId'] });
                const driver = await User.findByPk(ride.driverId!, { attributes: ['id', 'name', 'phoneNumber', 'socketId', 'vehiclePhotos'] });


                if (passenger?.socketId) {
                    io.to(passenger.socketId).emit('startConfirmed', { by: socket.user.role, ride, driver, passenger });
                }

                if (driver?.socketId) {
                    io.to(driver.socketId).emit('startConfirmed', { by: socket.user.role, ride, driver, passenger });
                }


                // If both confirmed, start the ride
                if (ride.passengerConfirmedStart && ride.driverConfirmedStart) {
                    console.log("confirmStart - BOTH CONFIRMED")
                    ride.status = 'IN_PROGRESS';
                    ride.startTime = new Date();
                    await ride.save();

                    if (passenger?.socketId) io.to(passenger.socketId).emit('rideStarted', ride);
                    if (driver?.socketId) io.to(driver.socketId).emit('rideStarted', ride);
                }
            } catch (error) {
                console.error('Confirm start error:', error);
                socket.emit('error', { message: 'Failed to confirm start', error: error });
            }
        });

        socket.on('cancelRide', async (data: { rideId: string }) => {
            try {
                const ride = await Ride.findByPk(data.rideId);
                if (ride) {
                    const oldStatus = ride.status;
                    ride.status = 'CANCELLED';
                    await ride.save();

                    if (oldStatus === 'REQUESTED') {
                        // Notify all drivers to remove it from their available list
                        socket.broadcast.emit('rideCancelled', { rideId: ride.id });
                    } else if (ride.driverId) {
                        // Inform only assigned driver
                        const driver = await User.findByPk(ride.driverId);
                        if (driver && driver.socketId) {
                            io.to(driver.socketId).emit('rideCancelled', { rideId: ride.id });
                        }
                    }
                    socket.emit('rideCancelledSuccess', { rideId: ride.id });
                }
            } catch (error) {
                console.error('Cancel ride error:', error);
                socket.emit('error', { message: 'Failed to cancel ride' });
            }
        });

        socket.on('completeRide', async (data: { rideId: string }) => {
            const ride = await Ride.findByPk(data.rideId);
            if (ride && ride.driverId === socket.user.id) {
                ride.status = 'COMPLETED';
                ride.endTime = new Date();
                await ride.save();

                // Calculate Commission
                const commissionSetting = await SystemSetting.findByPk('commissionPercentage');
                const commissionPercentage = commissionSetting ? parseFloat(commissionSetting.value) : 10;

                if (ride.fare && ride.driverId) {
                    const commissionAmount = (ride.fare * commissionPercentage) / 100;
                    const driver = await User.findByPk(ride.driverId);

                    if (driver) {
                        driver.walletBalance = (driver.walletBalance || 0) - commissionAmount;
                        await driver.save();

                        await Transaction.create({
                            userId: driver.id,
                            amount: commissionAmount,
                            type: 'DEBIT',
                            description: `Commission for ride ${ride.id} (${commissionPercentage}%)`,
                            rideId: ride.id
                        });

                        if (driver.socketId) {
                            io.to(driver.socketId).emit('walletUpdated', {
                                balance: driver.walletBalance,
                                message: `Commission of ${commissionAmount} debited.`
                            });
                        }
                    }
                }

                const passenger = await User.findByPk(ride.passengerId);
                if (passenger && passenger.socketId) {
                    io.to(passenger.socketId).emit('rideCompleted', ride);
                }

                if (ride.driverId) {
                    const driver = await User.findByPk(ride.driverId);
                    if (driver && driver.socketId) {
                        io.to(driver.socketId).emit('rideCompleted', ride);
                    }
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
