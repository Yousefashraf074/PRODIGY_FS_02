const express = require('express');
const { getDB, saveDB } = require('../database');
const authenticate = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function queryAll(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function runSql(sql, params = []) {
  const db = getDB();
  db.run(sql, params);
  saveDB();
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatAttendance(row) {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    checkIn: row.check_in,
    checkOut: row.check_out,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

router.post('/check-in', (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated.' });

    const date = req.body.date ? String(req.body.date) : getTodayDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
    }

    const existing = queryOne('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [userId, date]);
    if (existing && existing.check_in) {
      return res.status(400).json({ error: 'Already checked in for today.' });
    }

    const now = new Date().toISOString();
    if (existing) {
      runSql(
        'UPDATE attendance SET check_in = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?',
        [now, 'Present', existing.id]
      );
    } else {
      runSql(
        'INSERT INTO attendance (user_id, date, check_in, status) VALUES (?, ?, ?, ?)',
        [userId, date, now, 'Present']
      );
    }

    const attendance = queryOne('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [userId, date]);
    res.status(201).json({ message: 'Check-in recorded.', attendance: formatAttendance(attendance) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete check-in.' });
  }
});

router.post('/check-out', (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated.' });

    const date = req.body.date ? String(req.body.date) : getTodayDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
    }

    const existing = queryOne('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [userId, date]);
    if (!existing || !existing.check_in) {
      return res.status(400).json({ error: 'Check-in is required before check-out.' });
    }
    if (existing.check_out) {
      return res.status(400).json({ error: 'Already checked out for today.' });
    }

    const now = new Date().toISOString();
    runSql(
      'UPDATE attendance SET check_out = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [now, existing.id]
    );

    const attendance = queryOne('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [userId, date]);
    res.json({ message: 'Check-out recorded.', attendance: formatAttendance(attendance) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete check-out.' });
  }
});

router.get('/', (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated.' });

    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    const filters = ['user_id = ?'];
    const params = [userId];

    if (startDate) {
      filters.push('date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      filters.push('date <= ?');
      params.push(endDate);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const records = queryAll(
      `SELECT * FROM attendance ${whereClause} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({
      attendance: records.map(formatAttendance),
      meta: {
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance records.' });
  }
});

module.exports = router;
