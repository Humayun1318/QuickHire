import { Schema, model, Types } from 'mongoose';

// GeoJSON Point sub-schema
// MongoDB requires this exact format for 2dsphere spatial indexing
export const geoPointSchema = new Schema(
    {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude] — GeoJSON standard
            required: true,
        },
    },
    { _id: false, versionKey: false }, // no _id needed on sub-documents
);

// Structured address — better than flat fields for geo queries and i18n
export const addressSchema = new Schema(
    {
        city: { type: String, required: [true, 'City is required'], trim: true },
        state: { type: String, trim: true },
        country: { type: String, required: [true, 'Country is required'], trim: true },
        postalCode: { type: String, trim: true },
        // Nested GeoJSON for MongoDB geospatial operations
        location: { type: geoPointSchema, default: undefined },
    },
    { _id: false, versionKey: false },
);

