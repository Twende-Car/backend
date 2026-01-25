import { Router } from 'express';
import { register, login } from '../controllers/AuthController';
import { registerDriver } from '../controllers/DriverController';
import { upload } from '../middleware/multer';

const router = Router();

router.post('/register', register);
router.post('/register-driver', upload.fields([
    { name: 'driverPhoto', maxCount: 1 },
    { name: 'idCardPhoto', maxCount: 1 },
    { name: 'vehiclePhotos', maxCount: 2 }
]), registerDriver);
router.post('/login', login);

export default router;
