import { BACKEND_URL } from "../config/index.ts";

type Envelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type LoginData = {
  token: string;
  user: { email: string; role: string };
  profile: { id: string; fullName: string };
};

type BikeData = {
  _id: string;
  title: string;
  pricePerDay: number;
  status: string;
};

const apiBase = `${BACKEND_URL.replace(/\/$/, "")}/api/v1`;

const request = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string,
) => {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as
    | Envelope<T>
    | { message?: string; code?: string }
    | null;
  if (!response.ok) {
    const message = body?.message ?? `HTTP ${response.status}`;
    throw new Error(`${message} (${response.status})`);
  }
  return body as Envelope<T>;
};

const verifyDemo = async () => {
  const health = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/health`);
  if (!health.ok) {
    throw new Error(`Backend health check failed (${health.status})`);
  }

  const login = await request<LoginData>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "ramesh.owner@bikebuddy.com",
      password: "Password@123",
    }),
  });
  if (login.data.user.role !== "owner") {
    throw new Error("Demo login did not return the owner role");
  }

  const token = login.data.token;
  let createdId: string | null = null;
  try {
    const created = await request<BikeData>(
      "/bikes",
      {
        method: "POST",
        body: JSON.stringify({
          title: "Automated CRUD Verification Bike",
          brand: "Honda",
          model: "Dio",
          year: new Date().getFullYear(),
          engineCc: 110,
          fuelType: "petrol",
          transmission: "automatic",
          condition: "good",
          category: "scooter",
          description:
            "Temporary listing created by npm run demo:verify and deleted before the check finishes.",
          pricePerDay: 950,
          pricePerHour: 140,
          securityDeposit: 1500,
          location: {
            label: "Baneshwor Demo Point",
            address: "New Baneshwor",
            city: "Kathmandu",
            area: "Baneshwor",
            landmark: "Near Baneshwor Chowk",
          },
          images: [],
          specs: { helmetIncluded: true },
          status: "available",
          tags: ["automated-crud-verification"],
        }),
      },
      token,
    );
    createdId = created.data._id;
    console.log(`CREATE passed: ${created.data.title}`);

    const read = await request<BikeData>(`/bikes/${createdId}`);
    if (read.data.title !== "Automated CRUD Verification Bike") {
      throw new Error("READ returned unexpected bike data");
    }
    console.log(`READ passed: ${read.data._id}`);

    const updated = await request<BikeData>(
      `/bikes/${createdId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: "Automated CRUD Verification Bike - Updated",
          pricePerDay: 1000,
          condition: "excellent",
          status: "maintenance",
        }),
      },
      token,
    );
    if (
      updated.data.pricePerDay !== 1000 ||
      updated.data.status !== "maintenance"
    ) {
      throw new Error("UPDATE did not persist expected values");
    }
    console.log(`UPDATE passed: NPR ${updated.data.pricePerDay}/day`);

    await request<BikeData>(
      `/bikes/${createdId}`,
      { method: "DELETE" },
      token,
    );
    createdId = null;
    console.log("DELETE passed: temporary bike removed");
  } finally {
    if (createdId) {
      await request<BikeData>(
        `/bikes/${createdId}`,
        { method: "DELETE" },
        token,
      ).catch(() => undefined);
    }
  }

  console.log(
    `Demo verification complete for ${login.data.profile.fullName}. The prepared demo fleet was not changed.`,
  );
};

verifyDemo().catch((error: unknown) => {
  console.error(
    "Demo verification failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
