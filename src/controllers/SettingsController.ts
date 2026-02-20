import { Request, Response } from 'express';
import { SystemSetting } from '../models/SystemSetting';

export const getCommissionPercentage = async (req: Request, res: Response) => {
    try {
        let setting = await SystemSetting.findByPk('commissionPercentage');
        if (!setting) {
            // Default to 10% if not set
            setting = await SystemSetting.create({ key: 'commissionPercentage', value: '10' });
        }
        res.json({ percentage: parseFloat(setting.value) });
    } catch (error) {
        console.error('Error fetching commission percentage:', error);
        res.status(500).json({ message: 'Error fetching commission percentage' });
    }
};

export const updateCommissionPercentage = async (req: Request, res: Response) => {
    try {
        const { percentage } = req.body;
        if (percentage === undefined || percentage < 0 || percentage > 100) {
            return res.status(400).json({ message: 'Invalid percentage' });
        }

        let setting = await SystemSetting.findByPk('commissionPercentage');
        if (setting) {
            setting.value = percentage.toString();
            await setting.save();
        } else {
            await SystemSetting.create({ key: 'commissionPercentage', value: percentage.toString() });
        }

        res.json({ message: 'Commission percentage updated', percentage });
    } catch (error) {
        console.error('Error updating commission percentage:', error);
        res.status(500).json({ message: 'Error updating commission percentage' });
    }
};
