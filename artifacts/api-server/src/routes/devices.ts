import { Router, type IRouter } from "express";
import { eq, desc, avg, count, sql } from "drizzle-orm";
import { db, devicesTable, sensorReadingsTable } from "@workspace/db";
import {
  CreateDeviceBody,
  UpdateDeviceBody,
  GetDeviceParams,
  UpdateDeviceParams,
  DeleteDeviceParams,
  GetDeviceReadingsParams,
  GetDeviceReadingsQueryParams,
  CreateReadingParams,
  SimulateReadingParams,
  GetDeviceLatestReadingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateRandomReading(deviceId: number) {
  const conditions = ["Sunny", "Cloudy", "Partly Cloudy", "Rainy", "Thunderstorm", "Foggy", "Clear", "Windy"];
  const temperature = parseFloat((Math.random() * 40 - 5).toFixed(1));
  const humidity = parseFloat((Math.random() * 80 + 20).toFixed(1));
  const pressure = parseFloat((980 + Math.random() * 40).toFixed(1));
  const heatIndex = parseFloat((temperature + (humidity / 100) * 5).toFixed(1));
  const windSpeed = parseFloat((Math.random() * 80).toFixed(1));
  const windDirection = parseFloat((Math.random() * 360).toFixed(1));
  const uvIndex = parseFloat((Math.random() * 11).toFixed(1));
  const weatherCondition = conditions[Math.floor(Math.random() * conditions.length)];

  return {
    deviceId,
    temperature,
    humidity,
    pressure,
    heatIndex,
    windSpeed,
    windDirection,
    uvIndex,
    weatherCondition,
  };
}

router.get("/devices", async (_req, res): Promise<void> => {
  const devices = await db.select().from(devicesTable).orderBy(devicesTable.createdAt);
  res.json(devices);
});

router.post("/devices", async (req, res): Promise<void> => {
  const parsed = CreateDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [device] = await db.insert(devicesTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    isVirtual: parsed.data.isVirtual,
    deviceId: parsed.data.deviceId,
    isActive: true,
  }).returning();

  res.status(201).json(device);
});

router.get("/devices/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDeviceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "invalid_id", message: "Invalid device ID" });
    return;
  }

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id));
  if (!device) {
    res.status(404).json({ error: "not_found", message: "Device not found" });
    return;
  }

  res.json(device);
});

router.put("/devices/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDeviceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "invalid_id", message: "Invalid device ID" });
    return;
  }

  const parsed = UpdateDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof devicesTable.$inferSelect> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description ?? null;
  if (parsed.data.latitude !== undefined) updateData.latitude = parsed.data.latitude;
  if (parsed.data.longitude !== undefined) updateData.longitude = parsed.data.longitude;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const [device] = await db.update(devicesTable).set(updateData).where(eq(devicesTable.id, params.data.id)).returning();
  if (!device) {
    res.status(404).json({ error: "not_found", message: "Device not found" });
    return;
  }

  res.json(device);
});

router.delete("/devices/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDeviceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "invalid_id", message: "Invalid device ID" });
    return;
  }

  const [device] = await db.delete(devicesTable).where(eq(devicesTable.id, params.data.id)).returning();
  if (!device) {
    res.status(404).json({ error: "not_found", message: "Device not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/devices/:id/readings", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDeviceReadingsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "invalid_id", message: "Invalid device ID" });
    return;
  }

  const query = GetDeviceReadingsQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 20) : 20;

  const readings = await db
    .select()
    .from(sensorReadingsTable)
    .where(eq(sensorReadingsTable.deviceId, params.data.id))
    .orderBy(desc(sensorReadingsTable.recordedAt))
    .limit(limit);

  res.json(readings);
});

router.post("/devices/:id/readings", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateReadingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "invalid_id", message: "Invalid device ID" });
    return;
  }

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id));
  if (!device) {
    res.status(404).json({ error: "not_found", message: "Device not found" });
    return;
  }

  const body = req.body;
  const [reading] = await db.insert(sensorReadingsTable).values({
    deviceId: params.data.id,
    temperature: body.temperature,
    humidity: body.humidity,
    pressure: body.pressure,
    heatIndex: body.heatIndex ?? null,
    windSpeed: body.windSpeed ?? null,
    windDirection: body.windDirection ?? null,
    uvIndex: body.uvIndex ?? null,
    weatherCondition: body.weatherCondition ?? null,
  }).returning();

  res.status(201).json(reading);
});

router.get("/devices/:id/latest", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDeviceLatestReadingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "invalid_id", message: "Invalid device ID" });
    return;
  }

  const [reading] = await db
    .select()
    .from(sensorReadingsTable)
    .where(eq(sensorReadingsTable.deviceId, params.data.id))
    .orderBy(desc(sensorReadingsTable.recordedAt))
    .limit(1);

  if (!reading) {
    res.status(404).json({ error: "not_found", message: "No readings found for this device" });
    return;
  }

  res.json(reading);
});

router.post("/devices/:id/simulate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SimulateReadingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "invalid_id", message: "Invalid device ID" });
    return;
  }

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id));
  if (!device) {
    res.status(404).json({ error: "not_found", message: "Device not found" });
    return;
  }

  const randomData = generateRandomReading(params.data.id);
  const [reading] = await db.insert(sensorReadingsTable).values(randomData).returning();

  res.status(201).json(reading);
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalDevices: count(),
      activeDevices: sql<number>`count(*) filter (where ${devicesTable.isActive} = true)`,
      virtualDevices: sql<number>`count(*) filter (where ${devicesTable.isVirtual} = true)`,
    })
    .from(devicesTable);

  const subquery = db
    .select({
      deviceId: sensorReadingsTable.deviceId,
      maxTime: sql<Date>`max(${sensorReadingsTable.recordedAt})`.as("max_time"),
    })
    .from(sensorReadingsTable)
    .groupBy(sensorReadingsTable.deviceId)
    .as("latest");

  const avgData = await db
    .select({
      avgTemperature: avg(sensorReadingsTable.temperature),
      avgHumidity: avg(sensorReadingsTable.humidity),
      avgPressure: avg(sensorReadingsTable.pressure),
      lastUpdated: sql<Date>`max(${sensorReadingsTable.recordedAt})`,
    })
    .from(sensorReadingsTable)
    .innerJoin(subquery, eq(sensorReadingsTable.deviceId, subquery.deviceId));

  res.json({
    totalDevices: Number(totals?.totalDevices ?? 0),
    activeDevices: Number(totals?.activeDevices ?? 0),
    virtualDevices: Number(totals?.virtualDevices ?? 0),
    avgTemperature: avgData[0]?.avgTemperature ? parseFloat(String(avgData[0].avgTemperature)) : null,
    avgHumidity: avgData[0]?.avgHumidity ? parseFloat(String(avgData[0].avgHumidity)) : null,
    avgPressure: avgData[0]?.avgPressure ? parseFloat(String(avgData[0].avgPressure)) : null,
    lastUpdated: avgData[0]?.lastUpdated ?? null,
  });
});

router.get("/readings/all", async (_req, res): Promise<void> => {
  const devices = await db.select().from(devicesTable).orderBy(devicesTable.createdAt);

  const result = await Promise.all(
    devices.map(async (device) => {
      const [latestReading] = await db
        .select()
        .from(sensorReadingsTable)
        .where(eq(sensorReadingsTable.deviceId, device.id))
        .orderBy(desc(sensorReadingsTable.recordedAt))
        .limit(1);

      return {
        device,
        latestReading: latestReading ?? null,
      };
    })
  );

  res.json(result);
});

export default router;
