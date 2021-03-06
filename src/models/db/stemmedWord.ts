import { BelongsToMany, Column, DataType, Model, Table } from "sequelize-typescript";
import Video from "./video";
import VideoStemmedWord from "./videoStemmedWord";

@Table({
    tableName: "stemmed_words",
    charset: "utf8mb4",
    collate: "utf8mb4_unicode_ci",
    timestamps: false,
    indexes: [
        { unique: false, fields: ["title"] },
    ],
})
export default class StemmedWord extends Model<StemmedWord> {

    @Column({ primaryKey: true, autoIncrement: true })
    public id: number;

    @Column
    public title: string;

    @BelongsToMany(() => Video, () => VideoStemmedWord, "stemmedWordId")
    public video: Video[];
}
