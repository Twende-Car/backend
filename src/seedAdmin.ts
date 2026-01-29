import { User } from './models/User';
import { sequelize } from './config/database';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@divocab.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const adminName = 'Administrator';

        const existingAdmin = await User.findOne({ where: { email: adminEmail } });

        if (existingAdmin) {
            console.log(`Admin user with email ${adminEmail} already exists.`);
            process.exit(0);
        }

        await User.create({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            role: 'admin',
            phoneNumber: '0000000000',
            isApproved: true
        });

        console.log(`Admin user created successfully!`);
        console.log(`Email: ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
};

createAdmin();
