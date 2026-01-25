import { Router } from 'express';
import { getHistory, estimateFare } from '../controllers/RideController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/history', authMiddleware, getHistory);
router.post('/estimate', authMiddleware, estimateFare);

export default router;
