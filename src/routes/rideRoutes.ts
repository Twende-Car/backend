import { Router } from 'express';
import { getHistory, estimateFare, getRideDetails, getAvailableRides, getActiveRequest, getCurrentRide, acceptOfferByApi } from '../controllers/RideController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/history', authMiddleware, getHistory);
router.get('/active-request', authMiddleware, getActiveRequest);
router.get('/current', authMiddleware, getCurrentRide);
router.post('/estimate', authMiddleware, estimateFare);
router.post('/offers/:offerId/accept', authMiddleware, acceptOfferByApi);
router.get('/available-rides', authMiddleware, getAvailableRides);
router.get('/:id', authMiddleware, getRideDetails);

export default router;
