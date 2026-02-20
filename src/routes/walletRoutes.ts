import { Router } from 'express';
import { getWalletDetails } from '../controllers/WalletController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware as any);

router.get('/', getWalletDetails);

export default router;
