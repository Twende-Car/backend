import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './User';
import { Ride } from './Ride';

export interface RideOfferAttributes {
    id?: string;
    rideId: string;
    driverId: string;
    price: number;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export class RideOffer extends Model<RideOfferAttributes> implements RideOfferAttributes {
    public id!: string;
    public rideId!: string;
    public driverId!: string;
    public price!: number;
    public status!: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

RideOffer.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        rideId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        driverId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        price: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED'),
            defaultValue: 'PENDING',
        },
    },
    {
        sequelize,
        tableName: 'ride_offers',
    }
);

// Associations
Ride.hasMany(RideOffer, { foreignKey: 'rideId', as: 'offers' });
RideOffer.belongsTo(Ride, { foreignKey: 'rideId', as: 'ride' });
User.hasMany(RideOffer, { foreignKey: 'driverId', as: 'offers' });
RideOffer.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });
