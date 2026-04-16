import { Router, Request, Response, NextFunction } from 'express';
import { getStats, getUsers, getUserById, getAllRides, getRideById, createVehicleType, getVehicleTypes, updateVehicleType, deleteVehicleType, resetUserPassword } from '../controllers/AdminController';
import { adminLogin } from '../controllers/AuthController';
import { getPendingDrivers, approveDriver } from '../controllers/DriverController';
import { getCommissionPercentage, updateCommissionPercentage } from '../controllers/SettingsController';
import { creditDriverWallet } from '../controllers/WalletController';
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
router.post('/auth/login', adminLogin);

//pending driver for all connected users
router.get('/pending-drivers', authMiddleware, getPendingDrivers);
router.get('/rides', authMiddleware, getAllRides);
router.get('/rides/:id', authMiddleware, getRideById);


// Apply security to all routes
router.use(authMiddleware as any);
router.use(isAdmin as any);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.post('/users/:id/reset-password', resetUserPassword);


// Driver Management
router.put('/approve-driver/:id', approveDriver);

// Vehicle Type Pricing Management
router.post('/vehicle-types', createVehicleType);
router.put('/vehicle-types/:id', updateVehicleType);
router.put('/vehicle-types/:id', updateVehicleType);
router.delete('/vehicle-types/:id', deleteVehicleType);

// Commission Management
router.get('/commission', getCommissionPercentage);
router.post('/commission', updateCommissionPercentage);

// Wallet Management
router.post('/credit-driver', creditDriverWallet);

export default router;
