import { pgTable, serial, integer, timestamp, doublePrecision, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";

export const sensorReadingsTable = pgTable("sensor_readings", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  temperature: doublePrecision("temperature").notNull(),
  humidity: doublePrecision("humidity").notNull(),
  pressure: doublePrecision("pressure").notNull(),
  heatIndex: doublePrecision("heat_index"),
  windSpeed: doublePrecision("wind_speed"),
  windDirection: doublePrecision("wind_direction"),
  uvIndex: doublePrecision("uv_index"),
  weatherCondition: text("weather_condition"),
  gasValue: integer("gas_value"),
  flameValue: integer("flame_value"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReadingSchema = createInsertSchema(sensorReadingsTable).omit({ id: true, recordedAt: true });
export type InsertReading = z.infer<typeof insertReadingSchema>;
export type SensorReading = typeof sensorReadingsTable.$inferSelect;
