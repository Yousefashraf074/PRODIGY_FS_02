const express = require('express');
const { getDB, saveDB } = require('../database');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All routes require Keycloak authentication
router.use(authenticate);

// sql.js helper: run a query and return array of row objects
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

// Validation helper
function validateEmployee(data, isUpdate = false) {
  const errors = [];
  if (!isUpdate || data.first_name !== undefined) {
    if (!data.first_name || data.first_name.trim().length < 2) errors.push('First name must be at least 2 characters.');
  }
  if (!isUpdate || data.last_name !== undefined) {
    if (!data.last_name || data.last_name.trim().length < 2) errors.push('Last name must be at least 2 characters.');
  }
  if (!isUpdate || data.email !== undefined) {
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Valid email is required.');
  }
  if (!isUpdate || data.department !== undefined) {
    if (!data.department || data.department.trim().length === 0) errors.push('Department is required.');
  }
  if (!isUpdate || data.position !== undefined) {
    if (!data.position || data.position.trim().length === 0) errors.push('Position is required.');
  }
  if (!isUpdate || data.salary !== undefined) {
    if (data.salary === undefined || data.salary === null || isNaN(data.salary) || Number(data.salary) < 0) errors.push('Valid salary is required.');
  }
  if (!isUpdate || data.hire_date !== undefined) {
    if (!data.hire_date) errors.push('Hire date is required.');
  }
  if (data.phone && !/^[\d\s\-\+\(\)]{7,20}$/.test(data.phone)) {
    errors.push('Invalid phone number format.');
  }
  if (data.status && !['Active', 'Inactive', 'On Leave'].includes(data.status)) {
    errors.push('Status must be Active, Inactive, or On Leave.');
  }
  return errors;
}

// GET /api/employees — list all with optional search & pagination
router.get('/', (req, res) => {
  try {
    const { search, department, status, page = 1, limit = 10, sortBy = 'id', order = 'DESC' } = req.query;
    const allowedSort = ['id', 'first_name', 'last_name', 'email', 'department', 'position', 'salary', 'hire_date', 'status'];
    const sortColumn = allowedSort.includes(sortBy) ? sortBy : 'id';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let where = [];
    let params = [];

    if (search) {
      where.push("(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR position LIKE ?)");
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (department) {
      where.push("department = ?");
      params.push(department);
    }
    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const totalRow = queryOne(`SELECT COUNT(*) as count FROM employees ${whereClause}`, params);
    const total = totalRow ? totalRow.count : 0;
    const employees = queryAll(`SELECT * FROM employees ${whereClause} ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`, [...params, Number(limit), offset]);

    res.json({
      employees,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
});

// GET /api/employees/stats — dashboard stats
router.get('/stats', (req, res) => {
  try {
    const total = (queryOne('SELECT COUNT(*) as count FROM employees') || {}).count || 0;
    const active = (queryOne("SELECT COUNT(*) as count FROM employees WHERE status = 'Active'") || {}).count || 0;
    const departments = (queryOne('SELECT COUNT(DISTINCT department) as count FROM employees') || {}).count || 0;
    const avgSalary = (queryOne('SELECT AVG(salary) as avg FROM employees') || {}).avg || 0;
    const byDepartment = queryAll('SELECT department, COUNT(*) as count FROM employees GROUP BY department ORDER BY count DESC');
    const byStatus = queryAll('SELECT status, COUNT(*) as count FROM employees GROUP BY status');

    res.json({ total, active, departments, avgSalary: Math.round(avgSalary * 100) / 100, byDepartment, byStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// GET /api/employees/:id — single employee
router.get('/:id', (req, res) => {
  try {
    const employee = queryOne('SELECT * FROM employees WHERE id = ?', [Number(req.params.id)]);
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });
    res.json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch employee.' });
  }
});

// POST /api/employees — create
router.post('/', (req, res) => {
  try {
    const errors = validateEmployee(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { first_name, last_name, email, phone, department, position, salary, hire_date, status } = req.body;

    // Check duplicate email
    const exists = queryOne('SELECT id FROM employees WHERE email = ?', [email]);
    if (exists) return res.status(409).json({ error: 'Employee with this email already exists.' });

    runSql(
      'INSERT INTO employees (first_name, last_name, email, phone, department, position, salary, hire_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [first_name.trim(), last_name.trim(), email.trim(), phone || null, department.trim(), position.trim(), Number(salary), hire_date, status || 'Active']
    );

    const db = getDB();
    const lastId = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    const employee = queryOne('SELECT * FROM employees WHERE id = ?', [lastId]);
    res.status(201).json({ message: 'Employee created successfully.', employee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create employee.' });
  }
});

// PUT /api/employees/:id — update
router.put('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM employees WHERE id = ?', [Number(req.params.id)]);
    if (!existing) return res.status(404).json({ error: 'Employee not found.' });

    const errors = validateEmployee(req.body, true);
    if (errors.length) return res.status(400).json({ errors });

    const { first_name, last_name, email, phone, department, position, salary, hire_date, status } = req.body;

    // Check duplicate email (exclude current)
    if (email) {
      const dup = queryOne('SELECT id FROM employees WHERE email = ? AND id != ?', [email, Number(req.params.id)]);
      if (dup) return res.status(409).json({ error: 'Another employee with this email already exists.' });
    }

    runSql(`
      UPDATE employees SET
        first_name = ?, last_name = ?, email = ?, phone = ?,
        department = ?, position = ?, salary = ?, hire_date = ?,
        status = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      (first_name || existing.first_name).trim(),
      (last_name || existing.last_name).trim(),
      (email || existing.email).trim(),
      phone !== undefined ? phone : existing.phone,
      (department || existing.department).trim(),
      (position || existing.position).trim(),
      salary !== undefined ? Number(salary) : existing.salary,
      hire_date || existing.hire_date,
      status || existing.status,
      Number(req.params.id)
    ]);

    const employee = queryOne('SELECT * FROM employees WHERE id = ?', [Number(req.params.id)]);
    res.json({ message: 'Employee updated successfully.', employee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update employee.' });
  }
});

// DELETE /api/employees/:id — delete
router.delete('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM employees WHERE id = ?', [Number(req.params.id)]);
    if (!existing) return res.status(404).json({ error: 'Employee not found.' });

    runSql('DELETE FROM employees WHERE id = ?', [Number(req.params.id)]);
    res.json({ message: 'Employee deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete employee.' });
  }
});

module.exports = router;
