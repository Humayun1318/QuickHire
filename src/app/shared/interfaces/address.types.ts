// GeoJSON Point — required for MongoDB 2dsphere index
// coordinates: [longitude, latitude] — GeoJSON standard order
export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

// Embedded address object — structured for geo queries and readability
export interface IAddress {
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  // GeoJSON format required by MongoDB's $near and $geoWithin operators
  location?: IGeoPoint;
}