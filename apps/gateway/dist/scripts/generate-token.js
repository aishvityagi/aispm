"use strict";
require("dotenv").config();
const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "change-this-to-a-long-random-string-in-production";
const payload = {
    sub: "test-user-001",
    name: "Test User",
    role: "developer",
    iat: Math.floor(Date.now() / 1000),
};
const token = jwt.sign(payload, secret, { expiresIn: "24h" });
console.log("\n=== Test JWT Token (valid 24h) ===");
console.log(token);
console.log("\nUse this header in your requests:");
console.log(`Authorization: Bearer ${token}`);
console.log("\nDecoded payload:");
console.log(JSON.stringify(payload, null, 2));
//# sourceMappingURL=generate-token.js.map