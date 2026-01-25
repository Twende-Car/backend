import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { sequelize } from './config/database';
import { createServer } from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/authRoutes';
import rideRoutes from './routes/rideRoutes';
import adminRoutes from './routes/adminRoutes';
import { User } from './models/User';
import { initializeSockets } from './sockets/rideSocket';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*', // Allow all origins for dev
        methods: ['GET', 'POST']
    }
});

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/auth', authRoutes);
app.use('/rides', rideRoutes);
app.use('/admin', adminRoutes);

initializeSockets(io);

app.get('/', (req, res) => {
    res.send('Divocabb Backend is running');
});

const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');
        await sequelize.sync({ force: false }); // Sync models to database
        console.log('Database synced.');
        httpServer.listen(port, host, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

startServer();
