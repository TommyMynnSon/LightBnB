const properties = require('./json/properties.json');
const users = require('./json/users.json');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'tommyson',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {
  const queryString = `
  SELECT *
  FROM users
  WHERE LOWER(users.email) = LOWER($1);
  `;

  const values = [email];

  return pool
    .query(queryString, values)
    .then(res => {
      if (res.rows.length != 0) {
        return res.rows[0];
      }

      return null;
    })
    .catch(err => console.log(err.message));
}
exports.getUserWithEmail = getUserWithEmail;

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  const queryString = `
  SELECT *
  FROM users
  WHERE users.id = $1;
  `;

  const values = [id];

  return pool
    .query(queryString, values)
    .then(res => {
      if (res.rows.length != 0) {
        return res.rows[0];
      }

      return null;
    })
    .catch(err => console.log(err.message));
}
exports.getUserWithId = getUserWithId;


/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function(user) {
  const queryString = `
  INSERT INTO users (name, email, password)
  VALUES ($1, $2, $3)
  RETURNING *;
  `;

  const values = [user.name, user.email, user.password];

  return pool
    .query(queryString, values)
    .then(res => res.rows[0])
    .catch(err => console.log(err.message));
}
exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guest_id, limit = 10) {
  const queryString = `
  SELECT reservations.*, properties.*, AVG(property_reviews.rating) AS average_rating
  FROM reservations
  JOIN properties ON reservations.property_id = properties.id
  JOIN property_reviews ON properties.id = property_reviews.property_id
  WHERE reservations.guest_id = $1 AND reservations.start_date != now()::date
  GROUP BY properties.id, reservations.id
  ORDER BY reservations.start_date
  LIMIT $2;
  `;

  const values = [guest_id, limit];

  return pool
    .query(queryString, values)
    .then(res => res.rows)
    .catch(err => console.log(err.message));
}
exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function(options, limit = 10) {
  const queryParams = [];

  let queryString = `
  SELECT properties.*, AVG(property_reviews.rating) as average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_reviews.property_id

  `;

  // 1. Construct query depending on owner_id and city.
  if (options.owner_id && options.city) {
    // owner_id, city passed in
    queryParams.push(options.owner_id);
    queryString += `WHERE properties.owner_id = $${queryParams.length} `;

    queryParams.push(`%${options.city}%`);
    queryString += `AND properties.city LIKE $${queryParams.length} `;
  } else if (options.owner_id && !options.city) {
    // owner_id passed in
    queryParams.push(options.owner_id);
    queryString += `WHERE properties.owner_id = $${queryParams.length} `;
  } else if (!options.owner_id && options.city) {
    // city passed in
    queryParams.push(`%${options.city}%`);
    queryString += `WHERE properties.city LIKE $${queryParams.length} `;
  }

  // 2. Construct query depending on minimum_price_per_night and maximum_price_per_night

  // 2.a) Query accounts for owner_id or city
  if (options.owner_id || options.city) {
    if (options.minimum_price_per_night && options.maximum_price_per_night) {
      // minimum_price_per_night, maximum_price_per_night passed in
      queryParams.push(Number(options.minimum_price_per_night) * 100);
      queryString += `AND properties.cost_per_night BETWEEN $${queryParams.length} `;

      queryParams.push(Number(options.maximum_price_per_night) * 100);
      queryString += `AND $${queryParams.length} `;
    } else if (options.minimum_price_per_night && !options.maximum_price_per_night) {
      // minimum_price_per_night passed in
      queryParams.push(Number(options.minimum_price_per_night) * 100);
      queryString += `AND properties.cost_per_night >= $${queryParams.length} `;
    } else if (!options.minimum_price_per_night && options.maximum_price_per_night) {
      // maximum_price_per_night passed in
      queryParams.push(Number(options.maximum_price_per_night) * 100);
      queryString += `AND properties.cost_per_night <= $${queryParams.length} `;
    }
  }

  // 2.b) Query does not account for owner_id and city
  if (!options.owner_id && !options.city) {
    if (options.minimum_price_per_night && options.maximum_price_per_night) {
      // minimum_price_per_night, maximum_price_per_night passed in
      queryParams.push(Number(options.minimum_price_per_night) * 100);
      queryString += `WHERE properties.cost_per_night BETWEEN $${queryParams.length} `;

      queryParams.push(Number(options.maximum_price_per_night) * 100);
      queryString += `AND $${queryParams.length} `;
    } else if (options.minimum_price_per_night && !options.maximum_price_per_night) {
      // minimum_price_per_night passed in
      queryParams.push(Number(options.minimum_price_per_night) * 100);
      queryString += `WHERE properties.cost_per_night >= $${queryParams.length} `;
    } else if (!options.minimum_price_per_night && options.maximum_price_per_night) {
      // maximum_price_per_night passed in
      queryParams.push(Number(options.maximum_price_per_night) * 100);
      queryString += `WHERE properties.cost_per_night <= $${queryParams.length} `;
    }
  }

  // 3. Add GROUP BY to query
  queryString += `
  GROUP BY properties.id
  `;

  // 4. Construct query depending on minimum_rating
  if (options.minimum_rating) {
    // minimum_rating passed in
    queryParams.push(options.minimum_rating);
    queryString += `HAVING AVG(property_reviews.rating) >= $${queryParams.length} `;
  }

  // 5. Conclude construction of query
  queryParams.push(limit);
  queryString += `
  ORDER BY properties.cost_per_night
  LIMIT $${queryParams.length};
  `;

  return pool
    .query(queryString, queryParams)
    .then(res => res.rows)
    .catch(err => console.log(err.message));
};
exports.getAllProperties = getAllProperties;

/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  const queryString = `
  INSERT INTO properties (
    owner_id,
    title,
    description,
    thumbnail_photo_url,
    cover_photo_url,
    cost_per_night,
    street,
    city,
    province,
    post_code,
    country,
    parking_spaces,
    number_of_bathrooms,
    number_of_bedrooms)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  RETURNING *;
  `;

  const values = [
    property.owner_id,
    property.title,
    property.description,
    property.thumbnail_photo_url,
    property.cover_photo_url,
    Number(property.cost_per_night) * 100,
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms
  ];

  return pool
    .query(queryString, values)
    .then(res => res.rows[0])
    .catch(err => console.log(err.message));
}
exports.addProperty = addProperty;
