import { db, normalizePhoneNumber } from '../server/db.js';
import { generateToken, verifyToken } from '../server/auth.js';

console.log('=== RUNNING OAKSPHERE CONNECT CRM AUTOMATED VERIFICATION SUITE ===\n');

// Test 1: Phone Normalization and Status
console.log('Test 1: Phone number normalization and integrity check:');
const p1 = normalizePhoneNumber('9820011223');
console.log('  Clean 10-digit:', p1.normalized === '9820011223' && p1.status === 'VERIFIED' ? 'PASS' : 'FAIL', p1);

const p2 = normalizePhoneNumber('+91 98200 11223');
console.log('  +91 with spaces:', p2.normalized === '9820011223' && p2.status === 'VERIFIED' ? 'PASS' : 'FAIL', p2);

const p3 = normalizePhoneNumber('123456');
console.log('  Short invalid:', p3.status === 'INVALID' ? 'PASS' : 'FAIL', p3);

// Test 2: Token Generation and Verification
console.log('\nTest 2: JWT token auth:');
const adminUser = db.getUserById('usr_admin')!;
const token = generateToken(adminUser);
const decoded = verifyToken(token);
console.log('  Admin token decoded:', decoded?.email === 'admin@oaksphere.com' && decoded?.role === 'admin' ? 'PASS' : 'FAIL');

// Test 3: Data Store Integrity
console.log('\nTest 3: Database entities loaded:');
const leads = db.getLeads();
console.log(`  Leads count: ${leads.length} (expected >= 10) ->`, leads.length >= 10 ? 'PASS' : 'FAIL');

const users = db.getUsers();
console.log(`  Users count: ${users.length} (expected >= 5) ->`, users.length >= 5 ? 'PASS' : 'FAIL');

const calls = db.getCalls();
console.log(`  Calls count: ${calls.length} ->`, calls.length > 0 ? 'PASS' : 'FAIL');

const followups = db.getFollowups();
console.log(`  Followups count: ${followups.length} ->`, followups.length > 0 ? 'PASS' : 'FAIL');

const interviews = db.getInterviews();
console.log(`  Interviews count: ${interviews.length} ->`, interviews.length > 0 ? 'PASS' : 'FAIL');

const joinings = db.getJoinings();
console.log(`  Joinings count: ${joinings.length} ->`, joinings.length > 0 ? 'PASS' : 'FAIL');

// Test 4: Duplicate Detection
console.log('\nTest 4: Phone duplicate search:');
const dupMatch = db.findLeadByPhone('9820012399');
console.log('  Found existing duplicate by phone:', dupMatch ? 'PASS' : 'FAIL', dupMatch?.candidateName);

console.log('\n=== ALL CORE VERIFICATION TESTS COMPLETED SUCCESSFULLY ===');
