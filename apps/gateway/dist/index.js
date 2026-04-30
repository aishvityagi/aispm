"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const helmet_1 = __importDefault(require("@fastify/helmet"));
const fastify_1 = __importDefault(require("fastify"));
const cors = require("@fastify/cors");
const jwt = require("@fastify/jwt");
const rateLimit = require("@fastify/rate-limit");
const database_1 = require("./plugins/database");
const proxy_1 = require("./routes/proxy");
const redis_1 = __importDefault(require("./plugins/redis"));
const auth_1 = __importDefault(require("./plugins/auth"));
const kafkaPlugin = require("./plugins/kafka");
const { policyEnginePlugin } = require("./plugins/policyEngine");
const policies_1 = require("./routes/policies");
const fastify = (0, fastify_1.default)({
    logger: {
        level: process.env.LOG_LEVEL || "info",
        transport: process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
    },
});
async function start() {
    try {
        await fastify.register(cors, {
            origin: process.env.CORS_ORIGIN || "*",
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        });
        await fastify.register(helmet_1.default, {
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false,
        });
        await fastify.register(rateLimit, {
            max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
            timeWindow: "1 minute",
        });
        await fastify.register(jwt, {
            secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
        });
        // Infrastructure plugins
        await fastify.register(database_1.databasePlugin);
        await fastify.register(redis_1.default);
        await fastify.register(auth_1.default);
        // Phase 4 plugins â€” register AFTER db and redis
        await fastify.register(kafkaPlugin);
        await fastify.register(policyEnginePlugin);
        // Routes
        await fastify.register(proxy_1.proxyRoutes);
        await fastify.register(policies_1.policyRoutes);
        const { searchRoutes } = require('./routes/search');
        await fastify.register(searchRoutes);
        const { healthRoutes } = require('./routes/health');
        await fastify.register(healthRoutes);
        const { authRoutes } = require('./routes/auth');
        await fastify.register(authRoutes);
        fastify.get("/health", async () => ({
            status: "healthy",
            phase: 4,
            timestamp: new Date().toISOString(),
            services: { gateway: "up", database: "up", redis: "up", kafka: "up" },
        }));
        const port = parseInt(process.env.PORT || "3000");
        const host = process.env.HOST || "0.0.0.0";
        await fastify.listen({ port, host });
        fastify.log.info(`Gateway running on http://localhost:${port}`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
start();
//# sourceMappingURL=index.js.map