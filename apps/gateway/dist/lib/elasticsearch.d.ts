import { Client } from '@elastic/elasticsearch';
export declare const esClient: Client;
export declare function ensureIndex(): Promise<void>;
export declare function indexAuditEvent(event: Record<string, any>): Promise<void>;
export declare function searchAuditEvents(query: string, limit?: number): Promise<any[]>;
//# sourceMappingURL=elasticsearch.d.ts.map