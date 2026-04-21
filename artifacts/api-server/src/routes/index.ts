import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sportsRouter from "./sports";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sportsRouter);
router.use(notificationsRouter);

export default router;
