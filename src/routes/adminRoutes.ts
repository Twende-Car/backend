import { Router } from 'express';
import { getStats, getUsers, getAllRides, createVehicleType, getVehicleTypes, updateVehicleType, deleteVehicleType } from '../controllers/AdminController';
import { getPendingDrivers, approveDriver } from '../controllers/DriverController';

const router = Router();

// In a real app, we would add an isAdmin middleware here
router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/rides', getAllRides);

// Driver Management
router.get('/pending-drivers', getPendingDrivers);
router.put('/approve-driver/:id', approveDriver);

// Vehicle Type Pricing Management
router.post('/vehicle-types', createVehicleType);
router.get('/vehicle-types', getVehicleTypes);
router.put('/vehicle-types/:id', updateVehicleType);
router.delete('/vehicle-types/:id', deleteVehicleType);

export default router;
