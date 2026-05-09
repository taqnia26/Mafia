import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import dashboardRouter from "./dashboard";
import gangsRouter from "./gangs";
import weaponsRouter from "./weapons";
import armorRouter from "./armor";
import bodyguardsRouter from "./bodyguards";
import attacksRouter from "./attacks";
import blackmarketRouter from "./blackmarket";
import crimesRouter from "./crimes";
import citiesRouter from "./cities";
import adminRouter from "./admin";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(dashboardRouter);
router.use(gangsRouter);
router.use(weaponsRouter);
router.use(armorRouter);
router.use(bodyguardsRouter);
router.use(attacksRouter);
router.use(blackmarketRouter);
router.use(crimesRouter);
router.use(citiesRouter);
router.use(adminRouter);
router.use(notificationsRouter);

export default router;
