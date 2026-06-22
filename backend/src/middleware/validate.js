/**
 * Lightweight input validation helpers.
 * Each validator returns an express middleware function.
 * Pattern: Factory functions that produce request validators.
 */

/**
 * Validates that required fields exist in req.body.
 * @param {...string} fields - Field names that must be present and non-empty.
 */
const requireBody = (...fields) => (req, res, next) => {
  const missing = fields.filter(
    (f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === ''
  );
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }
  next();
};

/**
 * Validates that required query parameters exist.
 * @param {...string} params - Query param names that must be present.
 */
const requireQuery = (...params) => (req, res, next) => {
  const missing = params.filter((p) => !req.query[p]);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required query params: ${missing.join(', ')}` });
  }
  next();
};

module.exports = { requireBody, requireQuery };
