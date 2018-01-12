import * as express from "express";
import { NextFunction, Request, Response } from "express";

import * as apicache from "apicache";
import * as bodyParser from "body-parser";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import * as cors from "cors";
import * as logger from "morgan";
import * as path from "path";
import * as favicon from "serve-favicon";

import * as aboutController from "./controllers/about";
import * as allController from "./controllers/all";
import * as apiController from "./controllers/api";
import * as indexController from "./controllers/index";
import * as statisticsController from "./controllers/statistics";

import Config from "../config";

// var opts: any = {};

export const app: express.Application = express();

const cache: any = apicache.middleware;

app.set("port", Config.Server.port);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.locals.googleAnalyticsId = (Config.Google as any).analyticsId;

app.use(logger("common"));
// app.use(bodyParser.json());
//  app.use(bodyParser.urlencoded({ extended: false }));
// app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(favicon(__dirname + "/public/images/favicon.png"));
app.use(compression());
app.use(cache("2 minutes"));

app.get("/", indexController.index);
app.get("/all", allController.getAllVideo);
app.get("/about", aboutController.about);
app.get("/video/:videoId", statisticsController.getVideo);
app.get("/api/trendsVideoList", cors(), apiController.getTrendsVideoList);
app.get("/api/statistics/:videoId", cors(), apiController.getStatisticsByVideo);

// catch 404 and forward to error handler
/*app.use((req: Request, res: Response, next: NextFunction) => {
  var err = new express.Error("Not Found");
  err.status = 404;
  next(err);
});

*/

// error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});
