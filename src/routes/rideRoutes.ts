import { Router } from 'express';
import { getHistory, estimateFare, getRideDetails, getAvailableRides } from '../controllers/RideController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/history', authMiddleware, getHistory);
router.post('/estimate', authMiddleware, estimateFare);
router.get('/available-rides', authMiddleware, getAvailableRides);
router.get('/:id', authMiddleware, getRideDetails);

export default router;
