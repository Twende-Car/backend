import { Request, Response } from 'express';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { sequelize } from '../config/database';

export const creditDriverWallet = async (req: Request, res: Response) => {
    const t = await sequelize.transaction();
    try {
        const { driverId, amount } = req.body;

        if (!driverId || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid driver ID or amount' });
        }

        const driver = await User.findByPk(driverId, { transaction: t });
        if (!driver || driver.role !== 'driver') {
            await t.rollback();
            return res.status(404).json({ message: 'Driver not found' });
        }

        driver.walletBalance = (driver.walletBalance || 0) + parseFloat(amount);
        await driver.save({ transaction: t });

        await Transaction.create({
            userId: driver.id,
            amount: parseFloat(amount),
            type: 'CREDIT',
            description: 'Manual credit from dashboard',
        }, { transaction: t });

        await t.commit();
        res.json({ message: 'Driver wallet credited', balance: driver.walletBalance });
    } catch (error) {
        await t.rollback();
        console.error('Error crediting wallet:', error);
        res.status(500).json({ message: 'Error crediting wallet' });
    }
};

export const getWalletDetails = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const transactions = await Transaction.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        res.json({
            balance: user.walletBalance || 0,
            transactions
        });
    } catch (error) {
        console.error('Error fetching wallet details:', error);
        res.status(500).json({ message: 'Error fetching wallet details' });
    }
};
