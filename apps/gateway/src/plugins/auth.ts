// apps/gateway/src/plugins/auth.ts
// JWT authentication middleware for protected routes

const fp = require("fastify-plugin");
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";

const PROTECTED_PREFIXES = ["/v1/chat/completions", "/v1/audit"];

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Register a hook that runs on every request
  fastify.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const url = request.url;

      // Only enforce auth on protected routes
      const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        url.startsWith(prefix)
      );

      if (!isProtected) {
        return; // Skip auth for /health and any other open routes
      }

      // Check for Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        reply.status(401).send({
          error: "Unauthorized",
          message: "Missing or malformed Authorization header. Expected: Bearer <token>",
        });
        return;
      }

      const token = authHeader.slice(7); // Remove "Bearer "

      try {
        // @ts-ignore
        const decoded = fastify.jwt.verify(token);
        // Attach the decoded payload to the request for use in route handlers
        (request as any).user = decoded;
      } catch (err: any) {
        reply.status(401).send({
          error: "Unauthorized",
          message: `Invalid or expired token: ${err.message}`,
        });
      }
    }
  );
};

export default fp(authPlugin, { name: "auth" });