import { Op } from "sequelize";

import { GoogleVideoInfo, GoogleVideoStatistics } from "../../models/google/itemInfo";

import Statistics from "../../models/db/statistics";
import Video from "../../models/db/video";
import VideoViolationDislike from "../../models/db/videoViolationDislike";
import VideoViolationLike from "../../models/db/videoViolationLike";
import IVideoViolation from "../../models/iVideoViolation";

import GoogleVideoService from "../service/googleVideoService";
import SummaryService from "../service/summaryService";
import { SummaryKey } from "../service/summaryService";
import VideoService from "../service/videoService";
import ViolationService from "../service/violationService";

export default class StatisticsGrabber {

    protected googleVideoService: GoogleVideoService;
    protected violationService = new ViolationService();
    protected videoService: VideoService;
    protected summaryService: SummaryService;
    protected auth;
    protected statisticsUpdateCfg;

    constructor(googleVideoService: GoogleVideoService, statisticsUpdateCfg: any) {
        this.statisticsUpdateCfg = statisticsUpdateCfg;
        this.googleVideoService = googleVideoService;
        this.videoService = new VideoService();
        this.summaryService = new SummaryService();
    }

    public async process(maxResults: number): Promise<number> {
        const videoList = await Video.findAll({
            include: [{
                model: VideoViolationLike,
            },
            {
                model: VideoViolationDislike,
            }],
            limit: maxResults,
            where: {
                nextStatisticsUpdateAt: { [Op.lt]: new Date() },
        }});

        if (videoList.length > 0) {
            await this.update(videoList);
        }

        return videoList.length;
    }

    public async update(videoList: Video[]): Promise<any> {
        const videoIdList = videoList.map((v) => v.videoId);
        const statisticsInfoList = await this.googleVideoService.getVideoStatistics(videoIdList);
        const statisticsInfoHash = this.createStatisticsInfoHash(statisticsInfoList);

        for (const video of videoList) {
            if (statisticsInfoHash.has(video.videoId)) {
                await this.saveStatistics(video, statisticsInfoHash.get(video.videoId));
            }
        }

        if (videoIdList.length !== statisticsInfoHash.size) {
            const deletedVideoIdList = videoIdList.filter((videoId) => !statisticsInfoHash.has(videoId));
            await this.videoService.setDeletedVideoList(deletedVideoIdList);
        }
    }

    protected async saveStatistics(video: Video, statisticsInfo: GoogleVideoStatistics): Promise<any>  {
        const statistics = this.createStatistics(video.videoId, statisticsInfo);
        const reqiredItemCnt = this.violationService.getRequredItemCnt();
        const statisticsList = await this.getLastStatistics(video.videoId, reqiredItemCnt);

        if (this.violationService.isStatisticsAtLine(statistics, statisticsList)) {
            const lastStatistics = statisticsList[statisticsList.length - 1];
            this.initStatistics(lastStatistics, statisticsInfo);
            await lastStatistics.save();
        } else {
            await statistics.save();
            statisticsList.push(statistics);
        }
        this.updateVideo(video, statisticsList);

        return video;
    }

    protected async updateVideo(video: Video, statisticsList: Statistics[]): Promise<Video> {
        if (statisticsList && statisticsList.length > 0) {
            video.statisticsUpdatedAt = new Date();

            let videoViolationLike = video.violationLike;
            if (videoViolationLike == null) {
                videoViolationLike = await VideoViolationLike.create({ videoId: video.videoId });
            }
            const oldLikeViolationIndex = videoViolationLike.violationIndex;

            let videoViolationDislike = video.violationDislike;
            if (videoViolationDislike == null) {
                videoViolationDislike = await VideoViolationDislike.create({ videoId: video.videoId });
            }

            const oldDisikeViolationIndex = videoViolationDislike.violationIndex;

            const lastSt: Statistics = statisticsList[statisticsList.length - 1];

            this.violationService.updateViolation(statisticsList, "likeCount", videoViolationLike);
            this.violationService.updateViolation(statisticsList, "dislikeCount", videoViolationDislike);

            video.nextStatisticsUpdateAt = this.getNextUpdateTime(video, videoViolationLike, videoViolationDislike);
            video.likeCount = lastSt.likeCount;
            video.dislikeCount = lastSt.dislikeCount;
            video.viewCount = lastSt.viewCount;
            video.violationIndexLike = videoViolationLike.violationIndex;
            video.violationIndexDislike = videoViolationDislike.violationIndex;
            await videoViolationLike.save();
            await videoViolationDislike.save();
            await video.save();
            await this.summaryService.updateViolation(
                oldLikeViolationIndex,
                oldDisikeViolationIndex,
                videoViolationLike.violationIndex,
                videoViolationDislike.violationIndex);
            return video;
        }
    }

    protected async getLastStatistics(videoId: string, itemCount: number): Promise<Statistics[]> {
        const statisticsList = await Statistics.findAll({
            where: { videoId },
            order: [
                ["createdAt", "DESC"],
            ],
            limit: itemCount,
        });

        statisticsList.reverse();
        return statisticsList;
    }

    protected createStatisticsInfoHash(infoList: GoogleVideoInfo[]): Map<string, GoogleVideoStatistics> {
        return infoList.reduce((map, obj) => {
            return map.set(obj.id, obj.statistics);
        }, new Map<string, GoogleVideoStatistics>());
    }

    protected createStatistics(videoId: string, statisticsInfo: GoogleVideoStatistics): Statistics {
        const date = new Date();
        const statistics = new Statistics();
        statistics.videoId = videoId;
        statistics.createdAt = date;
        statistics.updatedAt = date;
        this.initStatistics(statistics, statisticsInfo);
        return statistics;
    }

    protected initStatistics(statistics: Statistics, statisticsInfo: GoogleVideoStatistics): void {
        statistics.viewCount = statisticsInfo.viewCount;
        statistics.likeCount = statisticsInfo.likeCount;
        statistics.dislikeCount = statisticsInfo.dislikeCount;
        statistics.commentCount = statisticsInfo.commentCount;
    }

    protected getDateDiffMinutes(dateStart: Date, dateEnd: Date): number {
        return (dateEnd.getTime() - dateStart.getTime()) / (1000 * 60);
    }

    protected getDateAddMinutes(date: Date, min: number): Date {
        return new Date(date.getTime() + min * 60 * 1000);
    }

    protected getNextUpdateTime(video: Video, videoViolationLike: IVideoViolation, videoViolationDisike: IVideoViolation): Date {
        let lastViolationAt = video.createdAt;
        if (videoViolationLike.lastViolationAt && videoViolationLike.lastViolationAt > lastViolationAt) {
            lastViolationAt = videoViolationLike.lastViolationAt;
        }

        if (videoViolationDisike.lastViolationAt && videoViolationDisike.lastViolationAt > lastViolationAt) {
            lastViolationAt = videoViolationDisike.lastViolationAt;
        }

        const diff = this.getDateDiffMinutes(lastViolationAt, video.statisticsUpdatedAt);

        if (diff <= this.statisticsUpdateCfg.lowDealyAt) {
            return this.getDateAddMinutes(video.statisticsUpdatedAt, this.statisticsUpdateCfg.delayMin);
        }

        if (diff > this.statisticsUpdateCfg.lowDealyAt && diff <= this.statisticsUpdateCfg.endAt) {
            const c = ((diff - this.statisticsUpdateCfg.lowDealyAt) /
                (this.statisticsUpdateCfg.endAt - this.statisticsUpdateCfg.lowDealyAt));
            const delay =  (1 - c) * this.statisticsUpdateCfg.delayMin + c * this.statisticsUpdateCfg.delayMax;
            return this.getDateAddMinutes(video.statisticsUpdatedAt, delay);
        }

        const diffTrends = this.getDateDiffMinutes(video.trendsAt, video.statisticsUpdatedAt);
        if (diffTrends <= this.statisticsUpdateCfg.lowDealyAt) {
            return this.getDateAddMinutes(video.statisticsUpdatedAt, this.statisticsUpdateCfg.delayMax);
        }

        return null;
    }
}
