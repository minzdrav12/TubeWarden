import { Column, DataType, Model, Table } from "sequelize-typescript";

@Table({
    tableName: "statistics",
    charset: "utf8mb4",
    collate: "utf8mb4_unicode_ci",
    timestamps: true,
})
export default class Statistics extends Model<Statistics> {

    @Column
    public  viewCount: number;

    @Column({allowNull: true})
    public likeCount: number;

    @Column({allowNull: true})
    public dislikeCount: number;

    @Column({allowNull: true})
    public commentCount: number;

    @Column({ primaryKey: true })
    public videoId: string;

    @Column({ primaryKey: true })
    public createdAt: Date;

}
