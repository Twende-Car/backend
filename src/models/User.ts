import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import bcrypt from 'bcrypt';

export interface UserAttributes {
    id?: string;
    name: string;
    email: string;
    password?: string;
    role: 'client' | 'driver';
    phoneNumber: string;
    vehicleInfo?: object | null;
    latitude?: number | null;
    longitude?: number | null;
    isOnline?: boolean;
    socketId?: string | null;
    // Driver registration fields
    idCardNumber?: string;
    address?: string;
    driverPhoto?: string;
    idCardPhoto?: string;
    vehiclePhotos?: string[];
    vehicleBrand?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
    vehicleColor?: string;
    vehicleTypeId?: string;
    isApproved?: boolean;
}

export class User extends Model<UserAttributes> implements UserAttributes {
    public id!: string;
    public name!: string;
    public email!: string;
    public password!: string;
    public role!: 'client' | 'driver';
    public phoneNumber!: string;
    public vehicleInfo!: object | null;
    public latitude!: number | null;
    public longitude!: number | null;
    public isOnline!: boolean;
    public socketId!: string | null;
    // Driver registration fields
    public idCardNumber!: string;
    public address!: string;
    public driverPhoto!: string;
    public idCardPhoto!: string;
    public vehiclePhotos!: string[];
    public vehicleBrand!: string;
    public vehicleModel!: string;
    public vehiclePlate!: string;
    public vehicleColor!: string;
    public vehicleTypeId!: string;
    public isApproved!: boolean;

    public async validatePassword(password: string): Promise<boolean> {
        return bcrypt.compare(password, this.password);
    }
}

User.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
            },
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        role: {
            type: DataTypes.ENUM('client', 'driver'),
            allowNull: false,
        },
        phoneNumber: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        vehicleInfo: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        latitude: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        longitude: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        isOnline: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        socketId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        idCardNumber: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        address: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        driverPhoto: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        idCardPhoto: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        vehiclePhotos: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        vehicleBrand: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        vehicleModel: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        vehiclePlate: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        vehicleColor: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        vehicleTypeId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        isApproved: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        sequelize,
        tableName: 'users',
        hooks: {
            beforeCreate: async (user: User) => {
                if (user.password) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            },
            beforeUpdate: async (user: User) => {
                if (user.changed('password') && user.password) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            },
        },
    }
);
