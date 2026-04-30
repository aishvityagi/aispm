"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function authRoutes(fastify) {
    // ── Register ────────────────────────────────────────────────────────────
    fastify.post('/v1/auth/register', async (request, reply) => {
        const { username, email, password } = request.body;
        if (!username || !email || !password) {
            return reply.code(400).send({
                error: 'validation_error',
                message: 'username, email and password are required',
            });
        }
        if (password.length < 8) {
            return reply.code(400).send({
                error: 'validation_error',
                message: 'Password must be at least 8 characters',
            });
        }
        if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
            return reply.code(400).send({
                error: 'validation_error',
                message: 'Username must be 3-50 characters, letters/numbers/underscore only',
            });
        }
        try {
            const existing = await fastify.db.query(`SELECT id FROM users WHERE username = $1 OR email = $2`, [username, email]);
            if (existing.rows.length > 0) {
                return reply.code(409).send({
                    error: 'conflict',
                    message: 'Username or email already exists',
                });
            }
            const passwordHash = await bcryptjs_1.default.hash(password, 12);
            const result = await fastify.db.query(`INSERT INTO users (username, email, password_hash, role)
           VALUES ($1, $2, $3, 'user')
           RETURNING id, username, email, role, created_at`, [username, email, passwordHash]);
            const user = result.rows[0];
            const token = fastify.jwt.sign({
                sub: user.id,
                userId: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            }, { expiresIn: '24h' });
            return reply.code(201).send({
                message: 'User created successfully',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    created_at: user.created_at,
                },
            });
        }
        catch (err) {
            fastify.log.error(err);
            return reply.code(500).send({
                error: 'server_error',
                message: 'Failed to create user',
            });
        }
    });
    // ── Login ────────────────────────────────────────────────────────────────
    fastify.post('/v1/auth/login', async (request, reply) => {
        const { username, password } = request.body;
        if (!username || !password) {
            return reply.code(400).send({
                error: 'validation_error',
                message: 'username and password are required',
            });
        }
        try {
            const result = await fastify.db.query(`SELECT id, username, email, password_hash, role FROM users WHERE username = $1`, [username]);
            if (result.rows.length === 0) {
                return reply.code(401).send({
                    error: 'invalid_credentials',
                    message: 'Invalid username or password',
                });
            }
            const user = result.rows[0];
            const valid = await bcryptjs_1.default.compare(password, user.password_hash);
            if (!valid) {
                return reply.code(401).send({
                    error: 'invalid_credentials',
                    message: 'Invalid username or password',
                });
            }
            await fastify.db.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);
            const token = fastify.jwt.sign({
                sub: user.id,
                userId: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            }, { expiresIn: '24h' });
            return reply.send({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                },
            });
        }
        catch (err) {
            fastify.log.error(err);
            return reply.code(500).send({
                error: 'server_error',
                message: 'Login failed',
            });
        }
    });
    // ── Me ───────────────────────────────────────────────────────────────────
    fastify.get('/v1/auth/me', async (request, reply) => {
        const user = request.user;
        if (!user) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        try {
            const result = await fastify.db.query(`SELECT id, username, email, role, created_at, last_login
           FROM users WHERE id = $1`, [user.sub || user.userId]);
            if (result.rows.length === 0) {
                return reply.code(404).send({ error: 'User not found' });
            }
            return reply.send({ user: result.rows[0] });
        }
        catch (err) {
            fastify.log.error(err);
            return reply.code(500).send({ error: 'Failed to fetch user' });
        }
    });
}
//# sourceMappingURL=auth.js.map