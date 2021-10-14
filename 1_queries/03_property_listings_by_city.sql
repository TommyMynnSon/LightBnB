SELECT properties.*,
  AVG(property_reviews.rating) AS average_rating
FROM properties
  JOIN property_reviews ON properties.id = property_reviews.property_id
WHERE properties.city LIKE '%ancouv%'
GROUP BY properties.id
HAVING AVG(property_reviews.rating) >= 4
ORDER BY properties.cost_per_night
LIMIT 10;