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
    idCardNumber?: string | null;
    address?: string | null;
    driverPhoto?: string | null;
    idCardPhoto?: string | null;
    vehiclePhotos?: string[] | null;
    vehicleBrand?: string | null;
    vehicleModel?: string | null;
    vehiclePlate?: string | null;
    vehicleColor?: string | null;
    vehicleTypeId?: string | null;
    isApproved?: boolean | null;
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
    public idCardNumber!: string | null;
    public address!: string | null;
    public driverPhoto!: string | null;
    public idCardPhoto!: string | null;
    public vehiclePhotos!: string[] | null;
    public vehicleBrand!: string | null;
    public vehicleModel!: string | null;
    public vehiclePlate!: string | null;
    public vehicleColor!: string | null;
    public vehicleTypeId!: string | null;
    public isApproved!: boolean | null;

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
