// generate-token.js
// Run with: node generate-token.js
require('dotenv').config({ path: __dirname + '\\.env' });
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const token = jwt.sign(
  { sub: 'admin', userId: 'admin', role: 'admin' },
  secret,
  { expiresIn: '24h' }
);

console.log('\nYour JWT token:\n');
console.log(token);
console.log('\nCopy this token to the dashboard login page or use in curl with:');
console.log('Authorization: Bearer ' + token + '\n');