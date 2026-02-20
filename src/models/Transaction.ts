import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './User';

export interface TransactionAttributes {
    id?: string;
    userId: string;
    amount: number;
    type: 'CREDIT' | 'DEBIT';
    description: string;
    rideId?: string | null;
}

export class Transaction extends Model<TransactionAttributes> implements TransactionAttributes {
    public id!: string;
    public userId!: string;
    public amount!: number;
    public type!: 'CREDIT' | 'DEBIT';
    public description!: string;
    public rideId!: string | null;
}

Transaction.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        amount: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        type: {
            type: DataTypes.ENUM('CREDIT', 'DEBIT'),
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        rideId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'transactions',
    }
);

User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
