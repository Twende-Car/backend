import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './User';

export interface RideAttributes {
    id?: string;
    passengerId: string;
    driverId?: string | null;
    status: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    pickupAddress?: string | null;
    dropoffAddress?: string | null;
    distance?: number | null; // in km
    vehicleTypeId?: string | null;
    vehicleModel?: string | null;
    vehicleColor?: string | null;
    vehicleRegistration?: string | null;
    startTime?: Date | null;
    endTime?: Date | null;
    fare?: number | null;
}

export class Ride extends Model<RideAttributes> implements RideAttributes {
    public id!: string;
    public passengerId!: string;
    public driverId!: string | null;
    public status!: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    public pickupLat!: number;
    public pickupLng!: number;
    public dropoffLat!: number;
    public dropoffLng!: number;
    public pickupAddress!: string | null;
    public dropoffAddress!: string | null;
    public distance!: number | null;
    public vehicleTypeId!: string | null;
    public vehicleModel!: string | null;
    public vehicleColor!: string | null;
    public vehicleRegistration!: string | null;
    public startTime!: Date | null;
    public endTime!: Date | null;
    public fare!: number | null;
}

Ride.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        passengerId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        driverId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
            defaultValue: 'REQUESTED',
        },
        pickupLat: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        pickupLng: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        dropoffLat: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        dropoffLng: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        pickupAddress: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        dropoffAddress: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        distance: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        vehicleTypeId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        vehicleModel: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        vehicleColor: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        vehicleRegistration: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        startTime: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        endTime: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        fare: {
            type: DataTypes.FLOAT,
            allowNull: true,
        }
    },
    {
        sequelize,
        tableName: 'rides',
    }
);

import { VehicleType } from './VehicleType';

// Associations
User.hasMany(Ride, { foreignKey: 'passengerId', as: 'ridesAsPassenger' });
User.hasMany(Ride, { foreignKey: 'driverId', as: 'ridesAsDriver' });
Ride.belongsTo(User, { foreignKey: 'passengerId', as: 'passenger' });
Ride.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });
Ride.belongsTo(VehicleType, { foreignKey: 'vehicleTypeId', as: 'vehicleType' });
VehicleType.hasMany(Ride, { foreignKey: 'vehicleTypeId' });
