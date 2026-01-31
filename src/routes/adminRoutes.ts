import { Router, Request, Response, NextFunction } from 'express';
import { getStats, getUsers, getAllRides, createVehicleType, getVehicleTypes, updateVehicleType, deleteVehicleType } from '../controllers/AdminController';
import { getPendingDrivers, approveDriver } from '../controllers/DriverController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

interface AuthRequest extends Request {
    user?: any;
}

const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
};

//get vehicule type without auth
router.get('/vehicle-types', getVehicleTypes);

//pending driver for all connected users
router.get('/pending-drivers', authMiddleware, getPendingDrivers);


// Apply security to all routes
router.use(authMiddleware as any);
router.use(isAdmin as any);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/rides', getAllRides);

// Driver Management
router.put('/approve-driver/:id', approveDriver);

// Vehicle Type Pricing Management
router.post('/vehicle-types', createVehicleType);
router.put('/vehicle-types/:id', updateVehicleType);
router.delete('/vehicle-types/:id', deleteVehicleType);

export default router;
