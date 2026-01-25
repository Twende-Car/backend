import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface VehicleTypeAttributes {
    id?: string;
    name: string;
    pricePerKm: number;
    description?: string | null;
}

export class VehicleType extends Model<VehicleTypeAttributes> implements VehicleTypeAttributes {
    public id!: string;
    public name!: string;
    public pricePerKm!: number;
    public description!: string | null;
}

VehicleType.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        pricePerKm: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'vehicle_types',
    }
);
