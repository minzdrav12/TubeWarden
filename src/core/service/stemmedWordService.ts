import * as snowballStemmer from "snowball-stemmer.jsx/dest/russian-stemmer.common.js";

import { GoogleChannelInfo } from "../../models/google/itemInfo";

import StemmedWord from "../../models/db/stemmedWord";
import Tag from "../../models/db/tag";
import Video from "../../models/db/video";

const stemmer = new snowballStemmer.RussianStemmer();

export default class StemmedWordService {

    public async updateVideo(videoId: string) {
        const video = await Video.findById(videoId, {include: [Tag]});
        await this.setVideoStemmedWordList(video);
        await video.save();
    }

    public async setVideoStemmedWordList(video: Video) {

        const titleList = [video.title];
        for (const tag of video.tags) {
            titleList.push(tag.title);
        }

        const stemmedWordList = await this.getOrCreateStemmedWordList(titleList);
        await video.$set("stemmedWords", stemmedWordList);
    }

    public async getOrCreateStemmedWordList(titleList: string[]): Promise<StemmedWord[]> {
        if (!titleList || titleList.length === 0) {
            return [];
        }

        const stemmedWordTitleSet = new Set<string>();

        for (const title of titleList) {
            if (title) {

                const wordList = this.getWordList(title);
                const swList = stemmer.stemWords(wordList);

                for (const sw of swList) {
                    if (sw && sw.length > 2) {
                        const w = sw.toLowerCase();
                        if (!stemmedWordTitleSet.has(w)) {
                            stemmedWordTitleSet.add(w);
                        }
                    }
                }
            }

        }

        if (stemmedWordTitleSet.size > 0) {
            return await this.getOrCreateStemmedWordListByStemmedWords(Array.from(stemmedWordTitleSet));
        }

        return [];
    }

    protected getWordList(title: string) {
        const wordList = title.split(/[“”—\@\/\*\]\[\{\}\)\(\?\!\#\:'" ,«»\.\|-]+/);
        return  wordList.map((w) => this.getWord(w));
    }

    protected getWord(word: string) {
        if (word.length > 4) {
            if (word.endsWith("а") || word.endsWith("у")) {
                return word.substr(0, word.length - 1);
            }
        }

        if (word.length > 5) {
            if (word.endsWith("ым") || word.endsWith("ый")) {
                return word.substr(0, word.length - 2);
            }
        }

        if (word.length > 6) {
            if (word.endsWith("ого")) {
                return word.substr(0, word.length - 2);
            }
        }

        return word;
    }

    protected async getOrCreateStemmedWordListByStemmedWords(titleList: string[]): Promise<StemmedWord[]> {
        if (!titleList || titleList.length === 0) {
            return [];
        }

        const stemmedWordList = await StemmedWord.findAll({where: {title: titleList}});
        const stemmedWordHash = this.createStemmedWordTitleHash(stemmedWordList);
        for (const title of titleList.filter((t) => !stemmedWordHash.has(t))) {
            stemmedWordList.push(await this.createStemmedWord(title));
        }

        return stemmedWordList;
    }

    protected async createStemmedWord(title: string): Promise<StemmedWord> {
        const stemmedWord = new StemmedWord({ title });
        return stemmedWord.save();
    }

    protected createStemmedWordTitleHash(infoList: StemmedWord[]): Map<string, StemmedWord> {
        return infoList.reduce((map, obj) => {
            return map.set(obj.title, obj);
        }, new Map<string, StemmedWord>());
    }

}