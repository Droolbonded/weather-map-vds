import { Router, type IRouter } from "express";
import healthRouter from "./health";
import devicesRouter from "./devices";

const router: IRouter = Router();

router.use(healthRouter);
router.use(devicesRouter);

export default router;
