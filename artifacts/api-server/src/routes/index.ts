import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sportsRouter from "./sports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sportsRouter);

export default router;
