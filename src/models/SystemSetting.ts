import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface SystemSettingAttributes {
    key: string;
    value: string;
}

export class SystemSetting extends Model<SystemSettingAttributes> implements SystemSettingAttributes {
    public key!: string;
    public value!: string;
}

SystemSetting.init(
    {
        key: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        value: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: 'system_settings',
    }
);
