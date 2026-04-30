import { Pool } from "pg";
import { FastifyPluginAsync } from "fastify";
declare module "fastify" {
    interface FastifyInstance {
        db: Pool;
    }
}
declare const databasePlugin: FastifyPluginAsync;
export { databasePlugin };
//# sourceMappingURL=database.d.ts.map