import { ChatCompletionRequest } from "@aispm/shared-types";
import { FastifyReply } from "fastify";
export interface GroqStreamResult {
    fullText: string;
    latencyMs: number;
}
export declare function forwardToGroq(request: ChatCompletionRequest, reply: FastifyReply, shouldStream: boolean): Promise<GroqStreamResult>;
//# sourceMappingURL=groqClient.d.ts.map