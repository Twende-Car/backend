import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize(
    process.env.DB_NAME || 'divocab_db',
    process.env.DB_USER || 'divouser',
    process.env.DB_PASS || 'password',
    {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5433', 10),
        dialect: 'postgres',
        logging: false,
    }
);
