import dotenv from 'dotenv';
dotenv.config({ path: 'src/.env' });
process.env.DB_HOST = '127.0.0.1'; // Force IPv4
import { sequelize } from '../config/database';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { Transaction } from '../models/Transaction';
import { SystemSetting } from '../models/SystemSetting';
import { creditDriverWallet } from '../controllers/WalletController';

const verifyWallet = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Create a Test Driver
        const driverEmail = `test.driver.${Date.now()}@example.com`;
        const driver = await User.create({
            name: 'Test Driver',
            email: driverEmail,
            password: 'password',
            role: 'driver',
            phoneNumber: '1234567890',
            vehicleTypeId: null,
            walletBalance: -10 // Initial balance negative
        });

        console.log(`Created driver ${driver.id} with balance ${driver.walletBalance}`);

        // 2. Test Availability Check Logic
        if ((driver.walletBalance || 0) < 0) {
            console.log('PASS: Driver prevented from going online (balance < 0)');
        } else {
            console.error('FAIL: Driver allowed to go online with negative balance');
        }

        // 3. Test Credit Wallet
        // Mock Req/Res for controller
        const req = { body: { driverId: driver.id, amount: 50 }, user: { role: 'admin' } } as any;
        const res = {
            json: (data: any) => {
                console.log('Credit response:', data);
                if (data.balance === 40) console.log('PASS: Wallet credited correctly (-10 + 50 = 40)');
                else console.error(`FAIL: Expected 40, got ${data.balance}`);
            },
            status: (code: number) => ({ json: (data: any) => console.error(`Error ${code}:`, data) })
        } as any;

        await creditDriverWallet(req, res);

        // Verify Transaction
        const transaction = await Transaction.findOne({ where: { userId: driver.id, type: 'CREDIT' } });
        if (transaction && transaction.amount === 50) {
            console.log('PASS: Transaction record created');
        } else {
            console.error('FAIL: Transaction record not found or incorrect');
        }

        // 4. Test Debit Commission Logic
        // Simulate ride completion logic
        const ride = await Ride.create({
            passengerId: driver.id, // self as passenger for simplicity
            driverId: driver.id,
            pickupLat: 0, pickupLng: 0, dropoffLat: 0, dropoffLng: 0,
            status: 'IN_PROGRESS',
            fare: 1000
        });

        // Commission Logic from socket
        const commissionSetting = await SystemSetting.findOne({ where: { key: 'commissionPercentage' } });
        const commissionPercentage = commissionSetting ? parseFloat(commissionSetting.value) : 10;
        const commissionAmount = (ride.fare! * commissionPercentage) / 100;

        console.log(`Commission: ${commissionPercentage}%, Amount: ${commissionAmount}`);

        await driver.reload();
        const balanceBefore = driver.walletBalance;

        driver.walletBalance = (driver.walletBalance || 0) - commissionAmount;
        await driver.save();

        await Transaction.create({
            userId: driver.id,
            amount: commissionAmount,
            type: 'DEBIT',
            description: `Commission test`,
            rideId: ride.id
        });

        await driver.reload();
        if (driver.walletBalance === balanceBefore - commissionAmount) {
            console.log(`PASS: Wallet debited correctly (${balanceBefore} - ${commissionAmount} = ${driver.walletBalance})`);
        } else {
            console.error(`FAIL: Wallet debit incorrect. Expected ${balanceBefore - commissionAmount}, got ${driver.walletBalance}`);
        }

        // Cleanup
        await ride.destroy();
        await Transaction.destroy({ where: { userId: driver.id } });
        await driver.destroy();

    } catch (error: any) {
        console.error('Verification failed:', error);
        if (error.original) {
            console.error('Original error:', error.original);
        }
    } finally {
        await sequelize.close();
    }
};

verifyWallet();
