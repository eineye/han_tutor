// Simple JSON-file database for the prototype.
// Swap for a real DB (PostgreSQL/Firestore/SQLite) when moving to production —
// all access goes through the helpers below, so only this file needs to change.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { seedUnits, seedLessons } from './seed/curriculum.js';
import { seedVideos } from './seed/videos.js';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = () => ({
  settings: {
    classCodes: ['DEMO'],
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
  units: [],
  lessons: [],
  videos: [],
  students: [],
  sessions: [],
  progress: [], // {studentId, lessonId, sections:{}, quizBest, updatedAt}
  quizResults: [], // {id, studentId, lessonId|videoId, score, total, at}
  pronunciation: [], // {id, studentId, lessonId, target, heard, score, source, at}
  chatLogs: [], // {id, studentId, scenario, messages:[], updatedAt}
  evaluations: [], // {id, studentId, category, score, comment, at}
  assignments: [], // {id, studentId, lessonId|videoId, title, due, note, done, at}
});

let db;
let writeTimer = null;

export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = { ...EMPTY(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } else {
    db = EMPTY();
    db.units = structuredClone(seedUnits);
    db.lessons = structuredClone(seedLessons);
    db.videos = structuredClone(seedVideos);
    flush();
  }
  return db;
}

export function flush() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function save() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, 200);
}

export function get() {
  return db;
}

export const id = (prefix = '') => prefix + crypto.randomBytes(6).toString('hex');
export const now = () => new Date().toISOString();

export function hashPin(pin, salt = crypto.randomBytes(8).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPin(pin, stored) {
  const [salt, hash] = String(stored).split(':');
  const test = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

/** Reset content (units/lessons/videos) back to the bundled seed. Student data is kept. */
export function resetContent() {
  db.units = structuredClone(seedUnits);
  db.lessons = structuredClone(seedLessons);
  db.videos = structuredClone(seedVideos);
  save();
}
