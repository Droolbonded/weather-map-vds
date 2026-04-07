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
  StartFireParams,
  StopFireParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateNormalReading(deviceId: number) {
  const conditions = ["Sunny", "Cloudy", "Partly Cloudy", "Rainy", "Thunderstorm", "Foggy", "Clear", "Windy"];
  const temperature = parseFloat((Math.random() * 40 - 5).toFixed(1));
  const humidity = parseFloat((Math.random() * 70 + 25).toFixed(1));
  const pressure = parseFloat((980 + Math.random() * 40).toFixed(1));
  const heatIndex = parseFloat((temperature + (humidity / 100) * 5).toFixed(1));
  const windSpeed = parseFloat((Math.random() * 60).toFixed(1));
  const windDirection = parseFloat((Math.random() * 360).toFixed(1));
  const uvIndex = parseFloat((Math.random() * 10).toFixed(1));
  const weatherCondition = conditions[Math.floor(Math.random() * conditions.length)];
  return { deviceId, temperature, humidity, pressure, heatIndex, windSpeed, windDirection, uvIndex, weatherCondition };
}

function generateFireReading(deviceId: number, secondsSinceStart: number) {
  // Temperature escalates rapidly: starts at 60, caps at 1200
  const baseTemp = 60 + (secondsSinceStart / 10) * 15;
  const temperature = parseFloat(Math.min(1200, baseTemp + Math.random() * 20).toFixed(1));
  // Humidity drops as fire intensifies
  const humidity = parseFloat(Math.max(2, 50 - (secondsSinceStart / 10) * 5 + Math.random() * 5).toFixed(1));
  const pressure = parseFloat((950 + Math.random() * 20).toFixed(1));
  const heatIndex = parseFloat((temperature * 1.1).toFixed(1));
  // Wind speed increases due to updraft
  const windSpeed = parseFloat((20 + Math.random() * 60).toFixed(1));
  const windDirection = parseFloat((Math.random() * 360).toFixed(1));
  // UV is extreme due to fire light
  const uvIndex = parseFloat((10 + Math.random() * 1).toFixed(1));
  const weatherCondition = secondsSinceStart > 60 ? "Extreme Fire" : "Fire";
  return { deviceId, temperature, humidity, pressure, heatIndex, windSpeed, windDirection, uvIndex, weatherCondition };
}

// Background fire simulation - generates readings every 8 seconds for all fire-mode devices
setInterval(async () => {
  try {
    const fireDevices = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.fireMode, true));

    for (const device of fireDevices) {
      const secondsSinceStart = device.fireModeStartedAt
        ? Math.floor((Date.now() - new Date(device.fireModeStartedAt).getTime()) / 1000)
        : 0;
      const fireData = generateFireReading(device.id, secondsSinceStart);
      await db.insert(sensorReadingsTable).values(fireData);
    }
  } catch {
    // silently ignore background errors
  }
}, 8000);

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
    fireMode: false,
  }).returning();
  res.status(201).json(device);
});

router.get("/devices/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDeviceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "invalid_id", message: "Invalid device ID" }); return; }
  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id));
  if (!device) { res.status(404).json({ error: "not_found", message: "Device not found" }); return; }
  res.json(device);
});

router.put("/devices/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDeviceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "invalid_id", message: "Invalid device ID" }); return; }
  const parsed = UpdateDeviceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "validation_error", message: parsed.error.message }); return; }

  const updateData: Partial<typeof devicesTable.$inferSelect> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description ?? null;
  if (parsed.data.latitude !== undefined) updateData.latitude = parsed.data.latitude;
  if (parsed.data.longitude !== undefined) updateData.longitude = parsed.data.longitude;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const [device] = await db.update(devicesTable).set(updateData).where(eq(devicesTable.id, params.data.id)).returning();
  if (!device) { res.status(404).json({ error: "not_found", message: "Device not found" }); return; }
  res.json(device);
});

router.delete("/devices/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDeviceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "invalid_id", message: "Invalid device ID" }); return; }
  const [device] = await db.delete(devicesTable).where(eq(devicesTable.id, params.data.id)).returning();
  if (!device) { res.status(404).json({ error: "not_found", message: "Device not found" }); return; }
  res.sendStatus(204);
});

router.get("/devices/:id/readings", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDeviceReadingsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "invalid_id", message: "Invalid device ID" }); return; }
  const query = GetDeviceReadingsQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 20) : 20;
  const readings = await db.select().from(sensorReadingsTable)
    .where(eq(sensorReadingsTable.deviceId, params.data.id))
    .orderBy(desc(sensorReadingsTable.recordedAt)).limit(limit);
  res.json(readings);
});

router.post("/devices/:id/readings", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateReadingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "invalid_id", message: "Invalid device ID" }); return; }
  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id));
  if (!device) { res.status(404).json({ error: "not_found", message: "Device not found" }); return; }
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
  if (!params.success) { res.status(400).json({ error: "invalid_id", message: "Invalid device ID" }); return; }
  const [reading] = await db.select().from(sensorReadingsTable)
    .where(eq(sensorReadingsTable.deviceId, params.data.id))
    .orderBy(desc(sensorReadingsTable.recordedAt)).limit(1);
  if (!reading) { res.status(404).json({ error: "not_found", message: "No readings found" }); return; }
  res.json(reading);
});

router.post("/devices/:id/simulate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SimulateReadingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "invalid_id", message: "Invalid device ID" }); return; }
  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id));
  if (!device) { res.status(404).json({ error: "not_found", message: "Device not found" }); return; }
  const randomData = generateNormalReading(params.data.id);
  const [reading] = await db.insert(sensorReadingsTable).values(randomData).returning();
  res.status(201).json(reading);
});

// Fire endpoints
router.post("/devices/:id/fire/start", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = StartFireParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "invalid_id", message: "Invalid device ID" }); return; }

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id));
  if (!device) { res.status(404).json({ error: "not_found", message: "Device not found" }); return; }

  // Generate initial fire reading immediately
  const fireData = generateFireReading(params.data.id, 0);
  await db.insert(sensorReadingsTable).values(fireData);

  const [updated] = await db.update(devicesTable)
    .set({ fireMode: true, fireModeStartedAt: new Date() })
    .where(eq(devicesTable.id, params.data.id))
    .returning();
  res.json(updated);
});

router.post("/devices/:id/fire/stop", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = StopFireParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "invalid_id", message: "Invalid device ID" }); return; }

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id));
  if (!device) { res.status(404).json({ error: "not_found", message: "Device not found" }); return; }

  // Generate recovery reading
  const recoveryReading = {
    deviceId: params.data.id,
    temperature: parseFloat((25 + Math.random() * 10).toFixed(1)),
    humidity: parseFloat((50 + Math.random() * 20).toFixed(1)),
    pressure: parseFloat((1000 + Math.random() * 15).toFixed(1)),
    heatIndex: parseFloat((28 + Math.random() * 5).toFixed(1)),
    windSpeed: parseFloat((5 + Math.random() * 15).toFixed(1)),
    windDirection: parseFloat((Math.random() * 360).toFixed(1)),
    uvIndex: parseFloat((Math.random() * 5).toFixed(1)),
    weatherCondition: "Cloudy",
  };
  await db.insert(sensorReadingsTable).values(recoveryReading);

  const [updated] = await db.update(devicesTable)
    .set({ fireMode: false, fireModeStartedAt: null })
    .where(eq(devicesTable.id, params.data.id))
    .returning();
  res.json(updated);
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [totals] = await db.select({
    totalDevices: count(),
    activeDevices: sql<number>`count(*) filter (where ${devicesTable.isActive} = true)`,
    virtualDevices: sql<number>`count(*) filter (where ${devicesTable.isVirtual} = true)`,
    fireDevices: sql<number>`count(*) filter (where ${devicesTable.fireMode} = true)`,
  }).from(devicesTable);

  const avgData = await db.select({
    avgTemperature: avg(sensorReadingsTable.temperature),
    avgHumidity: avg(sensorReadingsTable.humidity),
    avgPressure: avg(sensorReadingsTable.pressure),
    lastUpdated: sql<Date>`max(${sensorReadingsTable.recordedAt})`,
  }).from(sensorReadingsTable);

  res.json({
    totalDevices: Number(totals?.totalDevices ?? 0),
    activeDevices: Number(totals?.activeDevices ?? 0),
    virtualDevices: Number(totals?.virtualDevices ?? 0),
    fireDevices: Number(totals?.fireDevices ?? 0),
    avgTemperature: avgData[0]?.avgTemperature ? parseFloat(String(avgData[0].avgTemperature)) : null,
    avgHumidity: avgData[0]?.avgHumidity ? parseFloat(String(avgData[0].avgHumidity)) : null,
    avgPressure: avgData[0]?.avgPressure ? parseFloat(String(avgData[0].avgPressure)) : null,
    lastUpdated: avgData[0]?.lastUpdated ?? null,
  });
});

router.get("/readings/fire-history", async (_req, res): Promise<void> => {
  // Return last 40 fire readings across all devices (weatherCondition Fire or Extreme Fire)
  const rows = await db
    .select({
      reading: sensorReadingsTable,
      device: devicesTable,
    })
    .from(sensorReadingsTable)
    .innerJoin(devicesTable, eq(sensorReadingsTable.deviceId, devicesTable.id))
    .where(
      sql`${sensorReadingsTable.weatherCondition} IN ('Fire', 'Extreme Fire')`
    )
    .orderBy(desc(sensorReadingsTable.recordedAt))
    .limit(40);

  res.json(rows);
});

router.get("/readings/all", async (_req, res): Promise<void> => {
  // Only return devices that have at least one reading (real devices without data stay hidden)
  const devices = await db.select().from(devicesTable).orderBy(devicesTable.createdAt);

  const result = await Promise.all(
    devices.map(async (device) => {
      const [latestReading] = await db.select().from(sensorReadingsTable)
        .where(eq(sensorReadingsTable.deviceId, device.id))
        .orderBy(desc(sensorReadingsTable.recordedAt)).limit(1);
      return { device, latestReading: latestReading ?? null };
    })
  );

  // Filter: only include devices that have at least one reading
  const withData = result.filter((r) => r.latestReading !== null);
  res.json(withData);
});

export default router;
