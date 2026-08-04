// Demonstration data for Bike Buddy: run with `npm run seed`.
//
// The seed is deliberately scoped. It never clears a collection globally:
// only the canonical demo accounts, bikes carrying DEMO_TAG_PREFIX, and
// records linked to those accounts/bikes are recreated. That makes it safe to
// re-run before every video take without destroying unrelated data.
import mongoose from "mongoose";
import connectDB from "../config/db.ts";
import UserModel from "../models/user.model.ts";
import AdminModel from "../models/admin.model.ts";
import OwnerModel from "../models/owner.model.ts";
import RenterModel from "../models/renter.model.ts";
import BikeModel from "../models/bike.model.ts";
import BookingModel from "../models/booking.model.ts";
import PaymentModel from "../models/payment.model.ts";
import ReviewModel from "../models/review.model.ts";
import SupportTicketModel from "../models/support-ticket.model.ts";
import DamageReportModel from "../models/damage-report.model.ts";
import SosAlertModel from "../models/sos-alert.model.ts";
import authService from "../services/auth.service.ts";
import { hashPassword } from "../utils/password.ts";

const DEMO_PASSWORD = "Password@123";
const DEMO_TAG_PREFIX = "bike-buddy-demo:";

type DemoAccount = {
  key: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  bio: string;
};

// The first eight renters are the personas used throughout the report and the
// sprint backlog. The last four exist so the administrator directory, review
// lists and support queue look like a working platform during the demo.
const renterAccounts: DemoAccount[] = [
  {
    key: "aashish",
    fullName: "Aashish Thapa",
    email: "aashish@student.com",
    phoneNumber: "9800000004",
    bio: "Budget-conscious student who uses Bike Buddy for classes and errands.",
  },
  {
    key: "maya",
    fullName: "Maya Shrestha",
    email: "maya@student.com",
    phoneNumber: "9800000005",
    bio: "First-time renter who values clear safety guidance and trusted owners.",
  },
  {
    key: "saroj",
    fullName: "Saroj Karki",
    email: "saroj@student.com",
    phoneNumber: "9800000006",
    bio: "Careful rider who checks condition evidence, reviews, and service history.",
  },
  {
    key: "nishant",
    fullName: "Nishant Rai",
    email: "nishant@student.com",
    phoneNumber: "9800000007",
    bio: "Busy student who needs quick reservations and reliable pickup directions.",
  },
  {
    key: "binita",
    fullName: "Binita Gurung",
    email: "binita@student.com",
    phoneNumber: "9800000008",
    bio: "Accessibility-focused renter who prefers simple navigation and cash options.",
  },
  {
    key: "krish",
    fullName: "Krish Maharjan",
    email: "krish@student.com",
    phoneNumber: "9800000009",
    bio: "Enthusiast who compares specifications, rates, and verified ride reviews.",
  },
  {
    key: "mohammad",
    fullName: "Mohammad Ali",
    email: "mohammad@student.com",
    phoneNumber: "9800000010",
    bio: "Price-conscious renter who expects transparent totals and clear receipts.",
  },
  {
    key: "dipesh",
    fullName: "Dipesh Tamang",
    email: "dipesh@student.com",
    phoneNumber: "9800000011",
    bio: "Frequent renter who needs extensions, support tracking, and damage reporting.",
  },
  {
    key: "pratima",
    fullName: "Pratima Bhandari",
    email: "pratima@student.com",
    phoneNumber: "9800000012",
    bio: "Weekend rider who books touring bikes for trips outside the valley.",
  },
  {
    key: "sujan",
    fullName: "Sujan Lama",
    email: "sujan@student.com",
    phoneNumber: "9800000013",
    bio: "Delivery rider who needs low-cost commuters for long working days.",
  },
  {
    key: "anita",
    fullName: "Anita Rajbhandari",
    email: "anita@student.com",
    phoneNumber: "9800000014",
    bio: "Office worker who prefers quiet electric scooters for short city trips.",
  },
  {
    key: "roshan",
    fullName: "Roshan Basnet",
    email: "roshan@student.com",
    phoneNumber: "9800000015",
    bio: "Returning renter who rebooks the same bike and leaves detailed reviews.",
  },
];

type OwnerVerificationState = "verified" | "pending" | "rejected";

const ownerAccounts: (DemoAccount & { state: OwnerVerificationState })[] = [
  {
    key: "ramesh",
    fullName: "Ramesh Shrestha",
    email: "ramesh.owner@bikebuddy.com",
    phoneNumber: "9800000002",
    bio: "Verified owner renting well-serviced bikes around Kathmandu since 2019.",
    state: "verified",
  },
  {
    key: "sita",
    fullName: "Sita Maharjan",
    email: "sita.owner@bikebuddy.com",
    phoneNumber: "9800000003",
    bio: "New owner preparing scooters and electric bikes for renters around Patan.",
    state: "pending",
  },
  {
    key: "bimal",
    fullName: "Bimal Prajapati",
    email: "bimal.owner@bikebuddy.com",
    phoneNumber: "9800000016",
    bio: "Verified Bhaktapur owner offering touring and commuter bikes to visitors.",
    state: "verified",
  },
  {
    key: "anjali",
    fullName: "Anjali Karki",
    email: "anjali.owner@bikebuddy.com",
    phoneNumber: "9800000017",
    bio: "Owner whose submitted documents did not match the registered bike papers.",
    state: "rejected",
  },
];

const adminAccount = {
  fullName: "Bike Buddy Admin",
  email: "admin@bikebuddy.com",
  phoneNumber: "9800000001",
};

const requireRole = (
  user: {
    email: string;
    role: string;
    isDemoAccount?: boolean | undefined;
  },
  expectedRole: "renter" | "owner" | "admin",
) => {
  if (user.role !== expectedRole) {
    throw new Error(
      `${user.email} already exists with role "${user.role}", expected "${expectedRole}". ` +
      "The seed stopped instead of overwriting a possibly real account.",
    );
  }
  if (!user.isDemoAccount) {
    throw new Error(
      `${user.email} already exists but is not marked as a Bike Buddy demo account. ` +
        "The seed stopped without changing its credentials or profile.",
    );
  }
};

const ensureRenterAccount = async (account: DemoAccount) => {
  let baseUser = await UserModel.findOne({ email: account.email });

  if (!baseUser) {
    await authService.registerRenter({
      fullName: account.fullName,
      email: account.email,
      phoneNumber: account.phoneNumber,
      bio: account.bio,
      password: DEMO_PASSWORD,
      terms: true,
    });
    baseUser = await UserModel.findOne({ email: account.email });
    if (baseUser) {
      await UserModel.updateOne(
        { _id: baseUser._id },
        { $set: { isDemoAccount: true } },
      );
      baseUser.isDemoAccount = true;
    }
  }

  if (!baseUser) {
    throw new Error(`Could not provision renter ${account.email}`);
  }
  requireRole(baseUser, "renter");

  const password = await hashPassword(DEMO_PASSWORD);
  await UserModel.updateOne(
    { _id: baseUser._id },
    {
      $set: {
        isVerified: true,
        verifyCode: null,
        verifyCodeExpiryDate: null,
        verifyEmailResetPassword: null,
        verifyEmailResetPasswordExpiryDate: null,
      },
    },
  );
  const existingProfile = await RenterModel.findOne({
    baseUserId: baseUser._id.toString(),
  } as never);
  const profileValues = {
    fullName: account.fullName,
    phoneNumber: account.phoneNumber,
    password,
    bio: account.bio,
    terms: true,
    kycStatus: "approved" as const,
    kycSubmittedAt: new Date("2026-01-10T06:00:00.000Z"),
    idDocumentUrl: `https://demo.bikebuddy.local/kyc/${account.email.split("@")[0]}.jpg`,
  };
  if (existingProfile) {
    await RenterModel.updateOne(
      { _id: existingProfile._id },
      {
        $set: profileValues,
        $unset: { googleId: 1 },
      } as never,
      { runValidators: true },
    );
  } else {
    await RenterModel.create({
      baseUserId: baseUser._id.toString(),
      profilePictureUrl: null,
      ...profileValues,
    });
  }
  const profile = await RenterModel.findOne({
    baseUserId: baseUser._id.toString(),
  } as never);
  if (!profile) {
    throw new Error(`Could not provision renter profile ${account.email}`);
  }

  return { baseUser, profile };
};

const ensureOwnerAccount = async (
  account: DemoAccount,
  state: OwnerVerificationState,
) => {
  let baseUser = await UserModel.findOne({ email: account.email });

  if (!baseUser) {
    await authService.registerOwner({
      fullName: account.fullName,
      email: account.email,
      phoneNumber: account.phoneNumber,
      bio: account.bio,
      password: DEMO_PASSWORD,
    });
    baseUser = await UserModel.findOne({ email: account.email });
    if (baseUser) {
      await UserModel.updateOne(
        { _id: baseUser._id },
        { $set: { isDemoAccount: true } },
      );
      baseUser.isDemoAccount = true;
    }
  }

  if (!baseUser) {
    throw new Error(`Could not provision owner ${account.email}`);
  }
  requireRole(baseUser, "owner");

  const ownerNotesByState: Record<OwnerVerificationState, string> = {
    verified: "Demo account: identity and ownership documents checked.",
    pending:
      "Demo account: verification documents awaiting administrator review.",
    rejected:
      "Demo account: submitted documents did not match the registered bike papers.",
  };

  const password = await hashPassword(DEMO_PASSWORD);
  await UserModel.updateOne(
    { _id: baseUser._id },
    { $set: { isVerified: true } },
  );
  const profileValues = {
    fullName: account.fullName,
    phoneNumber: account.phoneNumber,
    password,
    bio: account.bio,
    ownerNotes: ownerNotesByState[state],
    ownerStatus: state,
    ownerVerificationDate:
      state === "verified" ? new Date("2026-01-12T06:00:00.000Z") : null,
  };
  const existingProfile = await OwnerModel.findOne({
    baseUserId: baseUser._id.toString(),
  } as never);
  if (existingProfile) {
    await OwnerModel.updateOne(
      { _id: existingProfile._id },
      { $set: profileValues } as never,
      { runValidators: true },
    );
  } else {
    await OwnerModel.create({
      baseUserId: baseUser._id.toString(),
      profilePictureUrl: null,
      ...profileValues,
    });
  }
  const profile = await OwnerModel.findOne({
    baseUserId: baseUser._id.toString(),
  } as never);
  if (!profile) {
    throw new Error(`Could not provision owner profile ${account.email}`);
  }

  return { baseUser, profile };
};

const ensureAdminAccount = async () => {
  let baseUser = await UserModel.findOne({ email: adminAccount.email });
  if (!baseUser) {
    baseUser = await UserModel.create({
      email: adminAccount.email,
      role: "admin",
      isVerified: true,
      isDemoAccount: true,
    });
  }
  requireRole(baseUser, "admin");

  const password = await hashPassword(DEMO_PASSWORD);
  await UserModel.updateOne(
    { _id: baseUser._id },
    { $set: { isVerified: true } },
  );
  const profileValues = {
    fullName: adminAccount.fullName,
    phoneNumber: adminAccount.phoneNumber,
    password,
  };
  const existingProfile = await AdminModel.findOne({
    baseUserId: baseUser._id.toString(),
  } as never);
  if (existingProfile) {
    await AdminModel.updateOne(
      { _id: existingProfile._id },
      { $set: profileValues } as never,
      { runValidators: true },
    );
  } else {
    await AdminModel.create({
      baseUserId: baseUser._id.toString(),
      profilePictureUrl: null,
      ...profileValues,
    });
  }
  const profile = await AdminModel.findOne({
    baseUserId: baseUser._id.toString(),
  } as never);
  if (!profile) {
    throw new Error(`Could not provision admin profile ${adminAccount.email}`);
  }

  return { baseUser, profile };
};

const img = (id: string, alt: string) => ({
  url: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`,
  alt,
});

const atDayOffset = (offset: number, hour = 4) => {
  const value = new Date();
  value.setUTCHours(hour, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offset);
  return value;
};

const serviced = (isoDate: string) => new Date(`${isoDate}T06:00:00.000Z`);

type BikeSeed = {
  owner: string;
  slug: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  engineCc: number;
  fuelType: "petrol" | "electric";
  transmission: "manual" | "automatic";
  condition: "excellent" | "good" | "fair" | "needs_service";
  category:
    | "commuter"
    | "scooter"
    | "cruiser"
    | "sports"
    | "electric"
    | "mountain";
  description: string;
  pricePerDay: number;
  pricePerHour: number;
  securityDeposit: number;
  serviceFee: number;
  location: {
    label: string;
    address: string;
    city: string;
    area: string;
    landmark: string;
    latitude: number;
    longitude: number;
  };
  images: { url: string; alt: string }[];
  specs: {
    weightKg: number;
    mileageKmPerL: number | null;
    helmetIncluded: boolean;
  };
  serviceDate: string;
  odometerKm: number;
  status: "available" | "unavailable" | "maintenance" | "inactive";
  verifiedBike: boolean;
  safetyScore: number;
  inspectionNotes: string;
  tags: string[];
};

// Twenty-two listings across the three valley cities and all six categories,
// so search, filters, the map view and comparison have real data behind them.
const bikeCatalogue: BikeSeed[] = [
  {
    owner: "ramesh",
    slug: "pulsar-220f",
    title: "Bajaj Pulsar 220F",
    brand: "Bajaj",
    model: "Pulsar 220F",
    year: 2022,
    engineCc: 220,
    fuelType: "petrol",
    transmission: "manual",
    condition: "excellent",
    category: "sports",
    description:
      "Well-maintained city bike with two helmets, phone holder, and recent servicing.",
    pricePerDay: 1500,
    pricePerHour: 200,
    securityDeposit: 2000,
    serviceFee: 150,
    location: {
      label: "Thamel Hub",
      address: "Thamel Marg",
      city: "Kathmandu",
      area: "Thamel",
      landmark: "Near Kathmandu Guest House",
      latitude: 27.7154,
      longitude: 85.3123,
    },
    images: [
      img("photo-1558981403-c5f9899a28bc", "Bajaj Pulsar side view"),
      img("photo-1568772585407-9361f9bf3a87", "Bajaj Pulsar front view"),
    ],
    specs: { weightKg: 160, mileageKmPerL: 38, helmetIncluded: true },
    serviceDate: "2026-06-20",
    odometerKm: 18420,
    status: "available",
    verifiedBike: true,
    safetyScore: 94,
    inspectionNotes: "Tyres, brakes, lights, and documents checked.",
    tags: ["student-friendly", "helmet"],
  },
  {
    owner: "ramesh",
    slug: "classic-350",
    title: "Royal Enfield Classic 350",
    brand: "Royal Enfield",
    model: "Classic 350",
    year: 2021,
    engineCc: 350,
    fuelType: "petrol",
    transmission: "manual",
    condition: "good",
    category: "cruiser",
    description:
      "Comfortable cruiser for day trips to Nagarkot, with luggage straps included.",
    pricePerDay: 2500,
    pricePerHour: 350,
    securityDeposit: 5000,
    serviceFee: 250,
    location: {
      label: "Chhetrapati Pickup",
      address: "Chhetrapati Chowk",
      city: "Kathmandu",
      area: "Thamel",
      landmark: "Opposite Chhetrapati Free Clinic",
      latitude: 27.7119,
      longitude: 85.3077,
    },
    images: [
      img("photo-1609630875171-b1321377ee65", "Royal Enfield Classic 350"),
    ],
    specs: { weightKg: 195, mileageKmPerL: 35, helmetIncluded: true },
    serviceDate: "2026-06-08",
    odometerKm: 23610,
    status: "available",
    verifiedBike: true,
    safetyScore: 89,
    inspectionNotes: "Minor cosmetic marks recorded in condition photos.",
    tags: ["touring", "helmet"],
  },
  {
    owner: "ramesh",
    slug: "shine-125",
    title: "Honda Shine 125",
    brand: "Honda",
    model: "Shine 125",
    year: 2023,
    engineCc: 125,
    fuelType: "petrol",
    transmission: "manual",
    condition: "excellent",
    category: "commuter",
    description:
      "Light, efficient commuter for college, office, and everyday Kathmandu trips.",
    pricePerDay: 800,
    pricePerHour: 120,
    securityDeposit: 1000,
    serviceFee: 100,
    location: {
      label: "New Road Point",
      address: "New Road Gate",
      city: "Kathmandu",
      area: "New Road",
      landmark: "Near Bhugol Park",
      latitude: 27.7043,
      longitude: 85.3119,
    },
    images: [img("photo-1449426468159-d96dbf08f19f", "Honda commuter bike")],
    specs: { weightKg: 114, mileageKmPerL: 55, helmetIncluded: true },
    serviceDate: "2026-06-25",
    odometerKm: 9780,
    status: "available",
    verifiedBike: true,
    safetyScore: 97,
    inspectionNotes: "Excellent commuter condition; no recorded faults.",
    tags: ["budget", "commuter"],
  },
  {
    owner: "ramesh",
    slug: "crossfire-xt250",
    title: "Crossfire Trail XT250",
    brand: "Crossfire",
    model: "Trail XT250",
    year: 2021,
    engineCc: 250,
    fuelType: "petrol",
    transmission: "manual",
    condition: "good",
    category: "mountain",
    description:
      "Trail-ready motorcycle with knobby tyres for Shivapuri and valley outskirts.",
    pricePerDay: 2200,
    pricePerHour: 300,
    securityDeposit: 4000,
    serviceFee: 220,
    location: {
      label: "Budhanilkantha Stop",
      address: "Budhanilkantha Road",
      city: "Kathmandu",
      area: "Budhanilkantha",
      landmark: "Near Shivapuri Gate",
      latitude: 27.7654,
      longitude: 85.362,
    },
    images: [
      img("photo-1558980664-10e7170b5df9", "Crossfire trail motorcycle"),
    ],
    specs: { weightKg: 125, mileageKmPerL: 30, helmetIncluded: true },
    serviceDate: "2026-06-15",
    odometerKm: 14250,
    status: "maintenance",
    verifiedBike: true,
    safetyScore: 84,
    inspectionNotes: "Scheduled chain and rear brake adjustment.",
    tags: ["trail", "adventure"],
  },
  {
    owner: "ramesh",
    slug: "rayzr-125",
    title: "Yamaha RayZR 125",
    brand: "Yamaha",
    model: "RayZR 125",
    year: 2024,
    engineCc: 125,
    fuelType: "petrol",
    transmission: "automatic",
    condition: "excellent",
    category: "scooter",
    description:
      "Easy automatic scooter with under-seat storage for short city journeys.",
    pricePerDay: 1100,
    pricePerHour: 160,
    securityDeposit: 1500,
    serviceFee: 110,
    location: {
      label: "Baneshwor Hub",
      address: "New Baneshwor Road",
      city: "Kathmandu",
      area: "New Baneshwor",
      landmark: "Behind BICC",
      latitude: 27.6889,
      longitude: 85.3358,
    },
    images: [img("photo-1591637333184-19aa84b3e01f", "Yamaha scooter")],
    specs: { weightKg: 99, mileageKmPerL: 50, helmetIncluded: true },
    serviceDate: "2026-06-28",
    odometerKm: 4850,
    status: "available",
    verifiedBike: true,
    safetyScore: 98,
    inspectionNotes: "Recent service and tyre-pressure check completed.",
    tags: ["scooter", "beginner"],
  },
  {
    owner: "ramesh",
    slug: "fz-v3",
    title: "Yamaha FZ-S V3",
    brand: "Yamaha",
    model: "FZ-S V3",
    year: 2023,
    engineCc: 149,
    fuelType: "petrol",
    transmission: "manual",
    condition: "excellent",
    category: "sports",
    description:
      "Balanced street bike with ABS, ideal for confident riders in city traffic.",
    pricePerDay: 1400,
    pricePerHour: 190,
    securityDeposit: 2500,
    serviceFee: 140,
    location: {
      label: "Kalanki Point",
      address: "Ring Road, Kalanki",
      city: "Kathmandu",
      area: "Kalanki",
      landmark: "Near Kalanki Chowk overpass",
      latitude: 27.6934,
      longitude: 85.281,
    },
    images: [img("photo-1615172282427-9a57ef2d142e", "Yamaha FZ street bike")],
    specs: { weightKg: 135, mileageKmPerL: 45, helmetIncluded: true },
    serviceDate: "2026-07-02",
    odometerKm: 12180,
    status: "available",
    verifiedBike: true,
    safetyScore: 95,
    inspectionNotes: "ABS, brake pads and chain tension verified.",
    tags: ["abs", "city"],
  },
  {
    owner: "ramesh",
    slug: "apache-160",
    title: "TVS Apache RTR 160",
    brand: "TVS",
    model: "Apache RTR 160",
    year: 2022,
    engineCc: 159,
    fuelType: "petrol",
    transmission: "manual",
    condition: "good",
    category: "sports",
    description:
      "Responsive commuter-sport bike with good brakes for daily valley riding.",
    pricePerDay: 1300,
    pricePerHour: 180,
    securityDeposit: 2000,
    serviceFee: 130,
    location: {
      label: "Koteshwor Point",
      address: "Arniko Highway, Koteshwor",
      city: "Kathmandu",
      area: "Koteshwor",
      landmark: "Near Koteshwor Chowk",
      latitude: 27.6784,
      longitude: 85.3494,
    },
    images: [img("photo-1568772585407-9361f9bf3a87", "TVS Apache motorcycle")],
    specs: { weightKg: 137, mileageKmPerL: 44, helmetIncluded: true },
    serviceDate: "2026-06-11",
    odometerKm: 21340,
    status: "available",
    verifiedBike: true,
    safetyScore: 88,
    inspectionNotes: "Front brake pads replaced at the last service.",
    tags: ["sport", "daily"],
  },
  {
    owner: "ramesh",
    slug: "activa-6g",
    title: "Honda Activa 6G",
    brand: "Honda",
    model: "Activa 6G",
    year: 2023,
    engineCc: 110,
    fuelType: "petrol",
    transmission: "automatic",
    condition: "excellent",
    category: "scooter",
    description:
      "Very easy automatic scooter, popular with first-time riders and students.",
    pricePerDay: 950,
    pricePerHour: 140,
    securityDeposit: 1500,
    serviceFee: 100,
    location: {
      label: "Chabahil Point",
      address: "Chabahil Chowk",
      city: "Kathmandu",
      area: "Chabahil",
      landmark: "Near Chabahil Ganesh Temple",
      latitude: 27.7172,
      longitude: 85.3466,
    },
    images: [img("photo-1494976388531-d1058494cdd8", "Honda Activa scooter")],
    specs: { weightKg: 106, mileageKmPerL: 52, helmetIncluded: true },
    serviceDate: "2026-07-05",
    odometerKm: 7620,
    status: "available",
    verifiedBike: true,
    safetyScore: 96,
    inspectionNotes: "Full service completed; both helmets sanitised.",
    tags: ["beginner", "budget"],
  },
  {
    owner: "ramesh",
    slug: "hunter-350",
    title: "Royal Enfield Hunter 350",
    brand: "Royal Enfield",
    model: "Hunter 350",
    year: 2024,
    engineCc: 349,
    fuelType: "petrol",
    transmission: "manual",
    condition: "excellent",
    category: "cruiser",
    description:
      "Lighter Royal Enfield that suits city streets as well as weekend rides.",
    pricePerDay: 2300,
    pricePerHour: 320,
    securityDeposit: 4500,
    serviceFee: 230,
    location: {
      label: "Lazimpat Point",
      address: "Lazimpat Road",
      city: "Kathmandu",
      area: "Lazimpat",
      landmark: "Near Hotel Shanker",
      latitude: 27.7247,
      longitude: 85.3202,
    },
    images: [img("photo-1609630875171-b1321377ee65", "Royal Enfield Hunter")],
    specs: { weightKg: 181, mileageKmPerL: 36, helmetIncluded: true },
    serviceDate: "2026-07-08",
    odometerKm: 5230,
    status: "available",
    verifiedBike: true,
    safetyScore: 97,
    inspectionNotes: "New bike; first scheduled service completed.",
    tags: ["cruiser", "weekend"],
  },
  {
    owner: "bimal",
    slug: "himalayan-411",
    title: "Royal Enfield Himalayan 411",
    brand: "Royal Enfield",
    model: "Himalayan 411",
    year: 2022,
    engineCc: 411,
    fuelType: "petrol",
    transmission: "manual",
    condition: "good",
    category: "mountain",
    description:
      "Adventure bike with luggage racks, suited to Bhaktapur and hill routes.",
    pricePerDay: 3200,
    pricePerHour: 420,
    securityDeposit: 6000,
    serviceFee: 320,
    location: {
      label: "Bhaktapur Gate Point",
      address: "Bhaktapur Durbar Square Road",
      city: "Bhaktapur",
      area: "Durbar Square",
      landmark: "Near the main ticket gate",
      latitude: 27.6721,
      longitude: 85.4278,
    },
    images: [img("photo-1558980664-10e7170b5df9", "Royal Enfield Himalayan")],
    specs: { weightKg: 199, mileageKmPerL: 30, helmetIncluded: true },
    serviceDate: "2026-06-30",
    odometerKm: 27890,
    status: "available",
    verifiedBike: true,
    safetyScore: 90,
    inspectionNotes: "Suspension and chain checked before the touring season.",
    tags: ["adventure", "touring"],
  },
  {
    owner: "bimal",
    slug: "splendor-plus",
    title: "Hero Splendor Plus",
    brand: "Hero",
    model: "Splendor Plus",
    year: 2022,
    engineCc: 97,
    fuelType: "petrol",
    transmission: "manual",
    condition: "good",
    category: "commuter",
    description:
      "The cheapest reliable commuter in the fleet, chosen by delivery riders.",
    pricePerDay: 650,
    pricePerHour: 100,
    securityDeposit: 1000,
    serviceFee: 80,
    location: {
      label: "Suryabinayak Point",
      address: "Suryabinayak Road",
      city: "Bhaktapur",
      area: "Suryabinayak",
      landmark: "Near Suryabinayak Temple stop",
      latitude: 27.6567,
      longitude: 85.4275,
    },
    images: [img("photo-1449426468159-d96dbf08f19f", "Hero Splendor commuter")],
    specs: { weightKg: 112, mileageKmPerL: 65, helmetIncluded: true },
    serviceDate: "2026-06-22",
    odometerKm: 34120,
    status: "available",
    verifiedBike: true,
    safetyScore: 86,
    inspectionNotes: "High mileage but fully serviced; documents current.",
    tags: ["cheapest", "delivery"],
  },
  {
    owner: "bimal",
    slug: "ather-450x",
    title: "Ather 450X",
    brand: "Ather",
    model: "450X",
    year: 2024,
    engineCc: 60,
    fuelType: "electric",
    transmission: "automatic",
    condition: "excellent",
    category: "electric",
    description:
      "Fast electric scooter with about 90 km of demonstrated city range.",
    pricePerDay: 1600,
    pricePerHour: 220,
    securityDeposit: 3000,
    serviceFee: 160,
    location: {
      label: "Thimi Point",
      address: "Madhyapur Thimi Road",
      city: "Bhaktapur",
      area: "Thimi",
      landmark: "Near Thimi Bus Park",
      latitude: 27.6819,
      longitude: 85.3846,
    },
    images: [img("photo-1571068316344-75bc76f77890", "Ather electric scooter")],
    specs: { weightKg: 108, mileageKmPerL: null, helmetIncluded: true },
    serviceDate: "2026-07-10",
    odometerKm: 3140,
    status: "available",
    verifiedBike: true,
    safetyScore: 99,
    inspectionNotes: "Battery health and charger cable checked.",
    tags: ["electric", "quiet"],
  },
  {
    owner: "bimal",
    slug: "duke-200",
    title: "KTM Duke 200",
    brand: "KTM",
    model: "Duke 200",
    year: 2023,
    engineCc: 199,
    fuelType: "petrol",
    transmission: "manual",
    condition: "excellent",
    category: "sports",
    description:
      "Sharp handling street bike for experienced riders; helmet and gloves included.",
    pricePerDay: 2000,
    pricePerHour: 280,
    securityDeposit: 4000,
    serviceFee: 200,
    location: {
      label: "Jagati Point",
      address: "Jagati, Bhaktapur",
      city: "Bhaktapur",
      area: "Jagati",
      landmark: "Near Jagati bus stop",
      latitude: 27.6714,
      longitude: 85.4409,
    },
    images: [img("photo-1615172282427-9a57ef2d142e", "KTM Duke street bike")],
    specs: { weightKg: 159, mileageKmPerL: 35, helmetIncluded: true },
    serviceDate: "2026-07-01",
    odometerKm: 9450,
    status: "available",
    verifiedBike: true,
    safetyScore: 93,
    inspectionNotes: "Licence check required at handover for this category.",
    tags: ["experienced-riders", "sport"],
  },
  {
    owner: "bimal",
    slug: "pleasure-plus",
    title: "Hero Pleasure Plus",
    brand: "Hero",
    model: "Pleasure Plus",
    year: 2022,
    engineCc: 110,
    fuelType: "petrol",
    transmission: "automatic",
    condition: "good",
    category: "scooter",
    description:
      "Light scooter with a low seat height, comfortable for shorter riders.",
    pricePerDay: 850,
    pricePerHour: 130,
    securityDeposit: 1200,
    serviceFee: 90,
    location: {
      label: "Lokanthali Point",
      address: "Araniko Highway, Lokanthali",
      city: "Bhaktapur",
      area: "Lokanthali",
      landmark: "Near Lokanthali Chowk",
      latitude: 27.6759,
      longitude: 85.3707,
    },
    images: [img("photo-1494976388531-d1058494cdd8", "Hero Pleasure scooter")],
    specs: { weightKg: 102, mileageKmPerL: 50, helmetIncluded: true },
    serviceDate: "2026-06-14",
    odometerKm: 15720,
    status: "available",
    verifiedBike: true,
    safetyScore: 87,
    inspectionNotes: "Low seat height noted for accessibility filtering.",
    tags: ["low-seat", "accessible"],
  },
  {
    owner: "bimal",
    slug: "gixxer-155",
    title: "Suzuki Gixxer 155",
    brand: "Suzuki",
    model: "Gixxer 155",
    year: 2023,
    engineCc: 155,
    fuelType: "petrol",
    transmission: "manual",
    condition: "excellent",
    category: "sports",
    description:
      "Smooth and economical sport commuter with a comfortable riding position.",
    pricePerDay: 1350,
    pricePerHour: 185,
    securityDeposit: 2500,
    serviceFee: 135,
    location: {
      label: "Gatthaghar Point",
      address: "Gatthaghar, Madhyapur Thimi",
      city: "Bhaktapur",
      area: "Gatthaghar",
      landmark: "Near Gatthaghar Chowk",
      latitude: 27.6784,
      longitude: 85.3752,
    },
    images: [img("photo-1568772585407-9361f9bf3a87", "Suzuki Gixxer")],
    specs: { weightKg: 140, mileageKmPerL: 45, helmetIncluded: true },
    serviceDate: "2026-07-06",
    odometerKm: 8930,
    status: "available",
    verifiedBike: true,
    safetyScore: 94,
    inspectionNotes: "All lights, indicators and mirrors confirmed working.",
    tags: ["economical", "comfortable"],
  },
  {
    owner: "bimal",
    slug: "burgman-125",
    title: "Suzuki Burgman Street 125",
    brand: "Suzuki",
    model: "Burgman Street 125",
    year: 2023,
    engineCc: 124,
    fuelType: "petrol",
    transmission: "automatic",
    condition: "good",
    category: "scooter",
    description:
      "Maxi-style scooter with a flat floor and large storage for daily errands.",
    pricePerDay: 1150,
    pricePerHour: 165,
    securityDeposit: 1800,
    serviceFee: 115,
    location: {
      label: "Balkot Point",
      address: "Balkot Road",
      city: "Bhaktapur",
      area: "Balkot",
      landmark: "Near Balkot Chowk",
      latitude: 27.6633,
      longitude: 85.3789,
    },
    images: [img("photo-1591637333184-19aa84b3e01f", "Suzuki Burgman scooter")],
    specs: { weightKg: 110, mileageKmPerL: 48, helmetIncluded: true },
    serviceDate: "2026-06-18",
    odometerKm: 13480,
    status: "unavailable",
    verifiedBike: true,
    safetyScore: 85,
    inspectionNotes:
      "Temporarily unavailable while the owner is out of the valley.",
    tags: ["storage", "errands"],
  },
  {
    owner: "bimal",
    slug: "xpulse-200",
    title: "Hero XPulse 200",
    brand: "Hero",
    model: "XPulse 200",
    year: 2023,
    engineCc: 199,
    fuelType: "petrol",
    transmission: "manual",
    condition: "good",
    category: "mountain",
    description:
      "Light dual-purpose bike for rough roads towards Nagarkot and Dhulikhel.",
    pricePerDay: 1900,
    pricePerHour: 260,
    securityDeposit: 3500,
    serviceFee: 190,
    location: {
      label: "Nagarkot Road Point",
      address: "Nagarkot Road, Bhaktapur",
      city: "Bhaktapur",
      area: "Nagarkot Road",
      landmark: "Near Kamalbinayak Chowk",
      latitude: 27.6795,
      longitude: 85.4362,
    },
    images: [img("photo-1558980664-10e7170b5df9", "Hero XPulse dual sport")],
    specs: { weightKg: 154, mileageKmPerL: 40, helmetIncluded: true },
    serviceDate: "2026-06-27",
    odometerKm: 16240,
    status: "available",
    verifiedBike: true,
    safetyScore: 91,
    inspectionNotes: "Off-road tyres fitted; rider briefing required.",
    tags: ["dual-sport", "hills"],
  },
  {
    owner: "sita",
    slug: "niu-nqi",
    title: "NIU NQi Sport",
    brand: "NIU",
    model: "NQi Sport",
    year: 2023,
    engineCc: 60,
    fuelType: "electric",
    transmission: "automatic",
    condition: "excellent",
    category: "electric",
    description:
      "Quiet electric scooter with approximately 70 km demonstrated city range.",
    pricePerDay: 900,
    pricePerHour: 150,
    securityDeposit: 1500,
    serviceFee: 100,
    location: {
      label: "Pulchowk Point",
      address: "Pulchowk Road",
      city: "Lalitpur",
      area: "Pulchowk",
      landmark: "Near Pulchowk Campus Gate",
      latitude: 27.6789,
      longitude: 85.3161,
    },
    images: [img("photo-1571068316344-75bc76f77890", "NIU electric scooter")],
    specs: { weightKg: 99, mileageKmPerL: null, helmetIncluded: true },
    serviceDate: "2026-06-18",
    odometerKm: 6240,
    status: "inactive",
    verifiedBike: false,
    safetyScore: 76,
    inspectionNotes: "Listing remains inactive until owner verification.",
    tags: ["electric", "automatic"],
  },
  {
    owner: "sita",
    slug: "vespa-sxl",
    title: "Vespa SXL 150",
    brand: "Vespa",
    model: "SXL 150",
    year: 2022,
    engineCc: 150,
    fuelType: "petrol",
    transmission: "automatic",
    condition: "good",
    category: "scooter",
    description:
      "Comfortable automatic scooter for city traffic, supplied with one helmet.",
    pricePerDay: 1200,
    pricePerHour: 180,
    securityDeposit: 2000,
    serviceFee: 120,
    location: {
      label: "Patan Point",
      address: "Mangal Bazaar",
      city: "Lalitpur",
      area: "Patan",
      landmark: "Near Patan Durbar Square",
      latitude: 27.6727,
      longitude: 85.3255,
    },
    images: [img("photo-1494976388531-d1058494cdd8", "Vespa scooter")],
    specs: { weightKg: 115, mileageKmPerL: 42, helmetIncluded: true },
    serviceDate: "2026-06-02",
    odometerKm: 11780,
    status: "inactive",
    verifiedBike: false,
    safetyScore: 74,
    inspectionNotes: "Awaiting owner verification before publication.",
    tags: ["scooter", "automatic"],
  },
  {
    owner: "sita",
    slug: "jupiter-125",
    title: "TVS Jupiter 125",
    brand: "TVS",
    model: "Jupiter 125",
    year: 2024,
    engineCc: 124,
    fuelType: "petrol",
    transmission: "automatic",
    condition: "excellent",
    category: "scooter",
    description:
      "New scooter prepared for Patan renters; publication waits on verification.",
    pricePerDay: 1050,
    pricePerHour: 155,
    securityDeposit: 1500,
    serviceFee: 105,
    location: {
      label: "Jhamsikhel Point",
      address: "Jhamsikhel Road",
      city: "Lalitpur",
      area: "Jhamsikhel",
      landmark: "Near Jhamsikhel Chowk",
      latitude: 27.6779,
      longitude: 85.3095,
    },
    images: [img("photo-1591637333184-19aa84b3e01f", "TVS Jupiter scooter")],
    specs: { weightKg: 105, mileageKmPerL: 51, helmetIncluded: true },
    serviceDate: "2026-07-12",
    odometerKm: 1180,
    status: "inactive",
    verifiedBike: false,
    safetyScore: 78,
    inspectionNotes: "Cannot be published while the owner account is pending.",
    tags: ["new", "pending-owner"],
  },
  {
    owner: "anjali",
    slug: "unicorn-160",
    title: "Honda Unicorn 160",
    brand: "Honda",
    model: "Unicorn 160",
    year: 2021,
    engineCc: 162,
    fuelType: "petrol",
    transmission: "manual",
    condition: "fair",
    category: "commuter",
    description:
      "Listing blocked: the submitted ownership papers did not match this bike.",
    pricePerDay: 1000,
    pricePerHour: 150,
    securityDeposit: 1500,
    serviceFee: 100,
    location: {
      label: "Sinamangal Point",
      address: "Sinamangal Road",
      city: "Kathmandu",
      area: "Sinamangal",
      landmark: "Near the airport gate",
      latitude: 27.6969,
      longitude: 85.3562,
    },
    images: [img("photo-1449426468159-d96dbf08f19f", "Honda Unicorn commuter")],
    specs: { weightKg: 140, mileageKmPerL: 48, helmetIncluded: false },
    serviceDate: "2026-05-20",
    odometerKm: 41260,
    status: "inactive",
    verifiedBike: false,
    safetyScore: 61,
    inspectionNotes: "Rejected owner: documents did not match the bike papers.",
    tags: ["rejected-owner", "blocked"],
  },
  {
    owner: "anjali",
    slug: "discover-125",
    title: "Bajaj Discover 125",
    brand: "Bajaj",
    model: "Discover 125",
    year: 2019,
    engineCc: 124,
    fuelType: "petrol",
    transmission: "manual",
    condition: "needs_service",
    category: "commuter",
    description:
      "Listing blocked: the bike also needs servicing before it can be offered.",
    pricePerDay: 700,
    pricePerHour: 110,
    securityDeposit: 1000,
    serviceFee: 70,
    location: {
      label: "Gaushala Point",
      address: "Gaushala Chowk",
      city: "Kathmandu",
      area: "Gaushala",
      landmark: "Near Pashupatinath east gate",
      latitude: 27.7076,
      longitude: 85.3477,
    },
    images: [
      img("photo-1449426468159-d96dbf08f19f", "Bajaj Discover commuter"),
    ],
    specs: { weightKg: 123, mileageKmPerL: 55, helmetIncluded: false },
    serviceDate: "2026-03-08",
    odometerKm: 58940,
    status: "inactive",
    verifiedBike: false,
    safetyScore: 52,
    inspectionNotes: "Brake and suspension service overdue; listing blocked.",
    tags: ["rejected-owner", "needs-service"],
  },
];

type BookingSeed = {
  key: string;
  bike: string;
  renter: string;
  startOffset: number;
  endOffset: number;
  startHour?: number;
  endHour?: number;
  rentalDays: number;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "rejected";
  paymentStatus: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: "wallet" | "cash";
  notes: string;
  cancellationReason?: string;
  cashReference?: string;
  cashReceivedOffset?: number;
  returnedOffset?: number;
  lateMinutes?: number;
  lateFeeAmount?: number;
  extensionHours?: number;
  extensionAmount?: number;
  checklist?: { key: string; ok: boolean; note: string | null }[];
  payment?: {
    provider: "khalti" | "esewa" | "manual";
    status: "pending" | "succeeded" | "failed" | "refunded";
    ref: string;
    message: string;
    receipt?: string;
  };
};

// Twenty-eight bookings spanning every status, both payment methods and a
// realistic spread of past, current and future dates.
const bookingCatalogue: BookingSeed[] = [
  {
    key: "aashish-completed",
    bike: "pulsar-220f",
    renter: "aashish",
    startOffset: -18,
    endOffset: -17,
    rentalDays: 1,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: completed student commute.",
    returnedOffset: -17,
    checklist: [
      { key: "brakes", ok: true, note: null },
      { key: "lights", ok: true, note: null },
      { key: "tyres", ok: true, note: null },
    ],
    payment: {
      provider: "esewa",
      status: "succeeded",
      ref: "DEMO-PAY-AASHISH-001",
      message: "Simulated eSewa payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/aashish-001",
    },
  },
  {
    key: "maya-confirmed",
    bike: "classic-350",
    renter: "maya",
    startOffset: 2,
    endOffset: 4,
    rentalDays: 2,
    status: "confirmed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: first-time renter planning a Nagarkot trip.",
    payment: {
      provider: "khalti",
      status: "succeeded",
      ref: "DEMO-PAY-MAYA-001",
      message: "Simulated Khalti payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/maya-001",
    },
  },
  {
    key: "saroj-pending",
    bike: "shine-125",
    renter: "saroj",
    startOffset: 6,
    endOffset: 7,
    rentalDays: 1,
    status: "pending",
    paymentStatus: "unpaid",
    notes: "Demo: renter requested confirmation of condition evidence.",
  },
  {
    key: "nishant-cancelled",
    bike: "crossfire-xt250",
    renter: "nishant",
    startOffset: -8,
    endOffset: -7,
    rentalDays: 1,
    status: "cancelled",
    paymentStatus: "refunded",
    paymentMethod: "wallet",
    notes: "Demo: cancelled after maintenance notice.",
    cancellationReason: "Bike entered scheduled maintenance.",
    payment: {
      provider: "esewa",
      status: "refunded",
      ref: "DEMO-PAY-NISHANT-001",
      message: "Simulated full refund after owner cancellation.",
      receipt: "https://demo.bikebuddy.local/receipts/nishant-001",
    },
  },
  {
    key: "binita-cash-completed",
    bike: "rayzr-125",
    renter: "binita",
    startOffset: -12,
    endOffset: -11,
    rentalDays: 1,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "cash",
    notes: "Demo: completed accessible cash-payment journey.",
    cashReference: "DEMO-CASH-BINITA-001",
    cashReceivedOffset: -12,
    returnedOffset: -11,
    payment: {
      provider: "manual",
      status: "succeeded",
      ref: "DEMO-PAY-BINITA-CASH-001",
      message: "Cash receipt recorded by the owner.",
      receipt: "https://demo.bikebuddy.local/receipts/binita-cash-001",
    },
  },
  {
    key: "krish-completed",
    bike: "pulsar-220f",
    renter: "krish",
    startOffset: -28,
    endOffset: -26,
    rentalDays: 2,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: completed specification-comparison journey.",
    returnedOffset: -26,
    payment: {
      provider: "khalti",
      status: "succeeded",
      ref: "DEMO-PAY-KRISH-001",
      message: "Simulated Khalti payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/krish-001",
    },
  },
  {
    key: "mohammad-failed",
    bike: "rayzr-125",
    renter: "mohammad",
    startOffset: 9,
    endOffset: 10,
    rentalDays: 1,
    status: "pending",
    paymentStatus: "failed",
    paymentMethod: "wallet",
    notes: "Demo: checkout retained after a simulated wallet failure.",
    payment: {
      provider: "esewa",
      status: "failed",
      ref: "DEMO-PAY-MOHAMMAD-FAIL-001",
      message:
        "Simulated wallet failure; no money was transferred and retry is available.",
    },
  },
  {
    key: "dipesh-active",
    bike: "pulsar-220f",
    renter: "dipesh",
    startOffset: 0,
    endOffset: 1,
    startHour: 1,
    endHour: 10,
    rentalDays: 1,
    status: "confirmed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: active ride extended by three hours.",
    extensionHours: 3,
    extensionAmount: 600,
    checklist: [
      { key: "brakes", ok: true, note: null },
      { key: "lights", ok: true, note: null },
      { key: "body", ok: true, note: "Small left-panel scratch photographed." },
    ],
    payment: {
      provider: "khalti",
      status: "succeeded",
      ref: "DEMO-PAY-DIPESH-001",
      message: "Simulated payment including extension amount.",
      receipt: "https://demo.bikebuddy.local/receipts/dipesh-001",
    },
  },
  {
    key: "pratima-touring",
    bike: "himalayan-411",
    renter: "pratima",
    startOffset: 5,
    endOffset: 8,
    rentalDays: 3,
    status: "confirmed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: three-day touring booking towards Dhulikhel.",
    payment: {
      provider: "khalti",
      status: "succeeded",
      ref: "DEMO-PAY-PRATIMA-001",
      message: "Simulated Khalti payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/pratima-001",
    },
  },
  {
    key: "sujan-cash-pending",
    bike: "splendor-plus",
    renter: "sujan",
    startOffset: 1,
    endOffset: 4,
    rentalDays: 3,
    status: "confirmed",
    paymentStatus: "pending",
    paymentMethod: "cash",
    notes:
      "Demo: cash at pickup, still waiting for the owner to record receipt.",
  },
  {
    key: "anita-electric",
    bike: "ather-450x",
    renter: "anita",
    startOffset: -5,
    endOffset: -4,
    rentalDays: 1,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: completed quiet electric commute.",
    returnedOffset: -4,
    payment: {
      provider: "esewa",
      status: "succeeded",
      ref: "DEMO-PAY-ANITA-001",
      message: "Simulated eSewa payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/anita-001",
    },
  },
  {
    key: "roshan-repeat",
    bike: "fz-v3",
    renter: "roshan",
    startOffset: -22,
    endOffset: -20,
    rentalDays: 2,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: repeat renter booking the same bike again.",
    returnedOffset: -20,
    payment: {
      provider: "khalti",
      status: "succeeded",
      ref: "DEMO-PAY-ROSHAN-001",
      message: "Simulated Khalti payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/roshan-001",
    },
  },
  {
    key: "roshan-repeat-2",
    bike: "fz-v3",
    renter: "roshan",
    startOffset: -9,
    endOffset: -8,
    rentalDays: 1,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: second booking of the same bike by the same renter.",
    returnedOffset: -8,
    payment: {
      provider: "khalti",
      status: "succeeded",
      ref: "DEMO-PAY-ROSHAN-002",
      message: "Simulated Khalti payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/roshan-002",
    },
  },
  {
    key: "aashish-late-return",
    bike: "activa-6g",
    renter: "aashish",
    startOffset: -3,
    endOffset: -2,
    rentalDays: 1,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: returned 45 minutes late, late fee applied transparently.",
    returnedOffset: -2,
    lateMinutes: 45,
    lateFeeAmount: 105,
    payment: {
      provider: "esewa",
      status: "succeeded",
      ref: "DEMO-PAY-AASHISH-002",
      message: "Simulated payment including the itemised late fee.",
      receipt: "https://demo.bikebuddy.local/receipts/aashish-002",
    },
  },
  {
    key: "maya-past-completed",
    bike: "activa-6g",
    renter: "maya",
    startOffset: -35,
    endOffset: -34,
    rentalDays: 1,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "cash",
    notes: "Demo: earlier cash rental completed without issues.",
    cashReference: "DEMO-CASH-MAYA-001",
    cashReceivedOffset: -35,
    returnedOffset: -34,
    payment: {
      provider: "manual",
      status: "succeeded",
      ref: "DEMO-PAY-MAYA-CASH-001",
      message: "Cash receipt recorded by the owner.",
      receipt: "https://demo.bikebuddy.local/receipts/maya-cash-001",
    },
  },
  {
    key: "saroj-completed",
    bike: "gixxer-155",
    renter: "saroj",
    startOffset: -15,
    endOffset: -14,
    rentalDays: 1,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: careful rider confirmed condition photos before riding.",
    returnedOffset: -14,
    checklist: [
      { key: "brakes", ok: true, note: null },
      { key: "lights", ok: true, note: null },
      { key: "tyres", ok: true, note: "Pressure checked at the pump." },
    ],
    payment: {
      provider: "esewa",
      status: "succeeded",
      ref: "DEMO-PAY-SAROJ-001",
      message: "Simulated eSewa payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/saroj-001",
    },
  },
  {
    key: "krish-rejected",
    bike: "duke-200",
    renter: "krish",
    startOffset: -6,
    endOffset: -5,
    rentalDays: 1,
    status: "rejected",
    paymentStatus: "unpaid",
    notes: "Demo: owner rejected because the licence category did not match.",
    cancellationReason: "Rider licence category does not cover a 200cc bike.",
  },
  {
    key: "nishant-upcoming",
    bike: "hunter-350",
    renter: "nishant",
    startOffset: 3,
    endOffset: 5,
    rentalDays: 2,
    status: "confirmed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: weekend cruiser booking confirmed in advance.",
    payment: {
      provider: "khalti",
      status: "succeeded",
      ref: "DEMO-PAY-NISHANT-002",
      message: "Simulated Khalti payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/nishant-002",
    },
  },
  {
    key: "binita-pending-request",
    bike: "pleasure-plus",
    renter: "binita",
    startOffset: 8,
    endOffset: 9,
    rentalDays: 1,
    status: "pending",
    paymentStatus: "unpaid",
    notes: "Demo: low-seat scooter requested for accessibility reasons.",
  },
  {
    key: "sujan-completed-1",
    bike: "splendor-plus",
    renter: "sujan",
    startOffset: -25,
    endOffset: -22,
    rentalDays: 3,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "cash",
    notes: "Demo: three-day delivery rental settled in cash.",
    cashReference: "DEMO-CASH-SUJAN-001",
    cashReceivedOffset: -25,
    returnedOffset: -22,
    payment: {
      provider: "manual",
      status: "succeeded",
      ref: "DEMO-PAY-SUJAN-CASH-001",
      message: "Cash receipt recorded by the owner.",
      receipt: "https://demo.bikebuddy.local/receipts/sujan-cash-001",
    },
  },
  {
    key: "pratima-cancelled",
    bike: "xpulse-200",
    renter: "pratima",
    startOffset: -11,
    endOffset: -10,
    rentalDays: 1,
    status: "cancelled",
    paymentStatus: "refunded",
    paymentMethod: "wallet",
    notes: "Demo: renter cancelled inside the free window, full refund shown.",
    cancellationReason: "Renter cancelled more than 24 hours before pickup.",
    payment: {
      provider: "esewa",
      status: "refunded",
      ref: "DEMO-PAY-PRATIMA-002",
      message: "Simulated full refund under the 24-hour cancellation policy.",
      receipt: "https://demo.bikebuddy.local/receipts/pratima-002",
    },
  },
  {
    key: "anita-upcoming",
    bike: "ather-450x",
    renter: "anita",
    startOffset: 11,
    endOffset: 12,
    rentalDays: 1,
    status: "pending",
    paymentStatus: "unpaid",
    notes: "Demo: repeat electric booking waiting for owner approval.",
  },
  {
    key: "mohammad-completed",
    bike: "apache-160",
    renter: "mohammad",
    startOffset: -20,
    endOffset: -19,
    rentalDays: 1,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: transparent total and receipt confirmed after the ride.",
    returnedOffset: -19,
    payment: {
      provider: "esewa",
      status: "succeeded",
      ref: "DEMO-PAY-MOHAMMAD-002",
      message: "Simulated eSewa payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/mohammad-002",
    },
  },
  {
    key: "dipesh-completed",
    bike: "burgman-125",
    renter: "dipesh",
    startOffset: -30,
    endOffset: -29,
    rentalDays: 1,
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: earlier completed rental used for the damage history.",
    returnedOffset: -29,
    payment: {
      provider: "khalti",
      status: "succeeded",
      ref: "DEMO-PAY-DIPESH-002",
      message: "Simulated Khalti payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/dipesh-002",
    },
  },
  {
    key: "roshan-active-today",
    bike: "gixxer-155",
    renter: "roshan",
    startOffset: 0,
    endOffset: 2,
    startHour: 2,
    endHour: 9,
    rentalDays: 2,
    status: "confirmed",
    paymentStatus: "paid",
    paymentMethod: "wallet",
    notes: "Demo: second active ride running today for the live ride screen.",
    checklist: [
      { key: "brakes", ok: true, note: null },
      { key: "lights", ok: true, note: null },
      { key: "mirrors", ok: true, note: null },
      { key: "fuel", ok: true, note: "Tank handed over three-quarters full." },
    ],
    payment: {
      provider: "khalti",
      status: "succeeded",
      ref: "DEMO-PAY-ROSHAN-003",
      message: "Simulated Khalti payment succeeded.",
      receipt: "https://demo.bikebuddy.local/receipts/roshan-003",
    },
  },
  {
    key: "krish-cash-today",
    bike: "hunter-350",
    renter: "krish",
    startOffset: 0,
    endOffset: 1,
    startHour: 3,
    endHour: 8,
    rentalDays: 1,
    status: "confirmed",
    paymentStatus: "pending",
    paymentMethod: "cash",
    notes:
      "Demo: cash booking ready for the owner to record receipt on camera.",
  },
  {
    key: "sujan-pending-today",
    bike: "shine-125",
    renter: "sujan",
    startOffset: 1,
    endOffset: 2,
    rentalDays: 1,
    status: "pending",
    paymentStatus: "unpaid",
    notes: "Demo: pending request ready for the owner to approve on camera.",
  },
  {
    key: "anita-cancelled-late",
    bike: "pleasure-plus",
    renter: "anita",
    startOffset: -2,
    endOffset: -1,
    rentalDays: 1,
    status: "cancelled",
    paymentStatus: "refunded",
    paymentMethod: "wallet",
    notes: "Demo: late cancellation, partial refund under the stated policy.",
    cancellationReason: "Renter cancelled within 24 hours of pickup.",
    payment: {
      provider: "esewa",
      status: "refunded",
      ref: "DEMO-PAY-ANITA-002",
      message:
        "Simulated partial refund: the service fee is retained under the policy.",
      receipt: "https://demo.bikebuddy.local/receipts/anita-002",
    },
  },
];

type ReviewSeed = {
  booking: string;
  rating: number;
  comment: string;
};

const reviewCatalogue: ReviewSeed[] = [
  {
    booking: "aashish-completed",
    rating: 5,
    comment:
      "Clear pricing, smooth pickup, and the bike matched its condition photos.",
  },
  {
    booking: "binita-cash-completed",
    rating: 4,
    comment:
      "The cash steps were easy to understand and the scooter was comfortable.",
  },
  {
    booking: "krish-completed",
    rating: 4,
    comment:
      "Useful specifications and fair daily rate; helmet was ready at pickup.",
  },
  {
    booking: "anita-electric",
    rating: 5,
    comment:
      "Quiet, quick to charge and the range shown in the listing was accurate.",
  },
  {
    booking: "roshan-repeat",
    rating: 5,
    comment:
      "Booked this one before and it was just as clean the second time around.",
  },
  {
    booking: "roshan-repeat-2",
    rating: 4,
    comment:
      "Still a great bike. Pickup point was easy to find using the map link.",
  },
  {
    booking: "aashish-late-return",
    rating: 4,
    comment:
      "I returned late and the extra charge was shown clearly, no surprise fees.",
  },
  {
    booking: "maya-past-completed",
    rating: 5,
    comment:
      "As a first-time renter I found the handover checklist really reassuring.",
  },
  {
    booking: "saroj-completed",
    rating: 5,
    comment:
      "Dated service photos matched the real bike, which is why I chose it.",
  },
  {
    booking: "sujan-completed-1",
    rating: 4,
    comment:
      "Cheapest option for three days of delivery work and it never broke down.",
  },
  {
    booking: "mohammad-completed",
    rating: 4,
    comment: "Total at checkout matched the receipt exactly. That is all I ask.",
  },
  {
    booking: "dipesh-completed",
    rating: 3,
    comment:
      "Good storage but the scooter needed a wash. Owner responded politely.",
  },
];

const priceBreakdown = (
  pricePerDay: number,
  rentalDays: number,
  serviceFee: number,
  securityDeposit: number,
) => {
  const baseAmount = pricePerDay * rentalDays;
  return {
    pricePerDay,
    rentalDays,
    baseAmount,
    serviceFee,
    securityDeposit,
    total: baseAmount + serviceFee + securityDeposit,
  };
};

const seed = async () => {
  await connectDB();

  console.log("Provisioning canonical demo accounts through the auth flow...");
  const renters: Awaited<ReturnType<typeof ensureRenterAccount>>[] = [];
  for (const account of renterAccounts) {
    renters.push(await ensureRenterAccount(account));
  }
  const renterByKey = new Map(
    renterAccounts.map((account, index) => [account.key, renters[index]!]),
  );

  const owners: Awaited<ReturnType<typeof ensureOwnerAccount>>[] = [];
  for (const account of ownerAccounts) {
    owners.push(await ensureOwnerAccount(account, account.state));
  }
  const ownerByKey = new Map(
    ownerAccounts.map((account, index) => [account.key, owners[index]!]),
  );
  const admin = await ensureAdminAccount();

  // Replaces legacy optional-field unique indexes with partial unique indexes.
  await RenterModel.syncIndexes();

  const demoUserIds = [
    ...renters.map(({ baseUser }) => baseUser._id.toString()),
    ...owners.map(({ baseUser }) => baseUser._id.toString()),
  ];
  const demoAccountUserIds = [...demoUserIds, admin.baseUser._id.toString()];
  const demoRenterIds = renters.map(({ profile }) => profile._id.toString());
  const demoOwnerIds = owners.map(({ profile }) => profile._id.toString());
  const oldDemoBikes = await BikeModel.find({
    tags: { $regex: `^${DEMO_TAG_PREFIX}` },
  }).select("_id");
  const oldDemoBikeIds = oldDemoBikes.map(({ _id }) => _id.toString());

  const oldBookings = await BookingModel.find({
    bikeId: { $in: oldDemoBikeIds },
  } as never).select("_id");
  const oldBookingIds = oldBookings.map(({ _id }) => _id.toString());

  // Delete children first so unique booking/transaction references can be
  // recreated. Every predicate is restricted to a demo identity or demo bike.
  await Promise.all([
    PaymentModel.deleteMany({
      bookingId: { $in: oldBookingIds },
    } as never),
    ReviewModel.deleteMany({
      $or: [
        { bookingId: { $in: oldBookingIds } },
        { bikeId: { $in: oldDemoBikeIds } },
      ],
    } as never),
    SupportTicketModel.deleteMany({
      $or: [
        { bookingId: { $in: oldBookingIds } },
        { userId: { $in: demoUserIds } },
      ],
    } as never),
    DamageReportModel.deleteMany({
      $or: [
        { bookingId: { $in: oldBookingIds } },
        { bikeId: { $in: oldDemoBikeIds } },
      ],
    } as never),
    SosAlertModel.deleteMany({
      $or: [
        { bookingId: { $in: oldBookingIds } },
        { userId: { $in: demoUserIds } },
      ],
    } as never),
  ]);
  await BookingModel.deleteMany({ _id: { $in: oldBookingIds } } as never);
  await BikeModel.deleteMany({ _id: { $in: oldDemoBikeIds } } as never);

  const bikeDocs = await BikeModel.insertMany(
    bikeCatalogue.map((bike) => {
      const owner = ownerByKey.get(bike.owner);
      if (!owner) {
        throw new Error(`Unknown owner key "${bike.owner}" for ${bike.slug}`);
      }
      return {
        ownerId: owner.profile._id,
        title: bike.title,
        brand: bike.brand,
        model: bike.model,
        year: bike.year,
        engineCc: bike.engineCc,
        fuelType: bike.fuelType,
        transmission: bike.transmission,
        condition: bike.condition,
        category: bike.category,
        description: bike.description,
        pricePerDay: bike.pricePerDay,
        pricePerHour: bike.pricePerHour,
        securityDeposit: bike.securityDeposit,
        serviceFee: bike.serviceFee,
        location: bike.location,
        images: bike.images,
        specs: bike.specs,
        conditionInfo: {
          serviceDate: serviced(bike.serviceDate),
          odometerKm: bike.odometerKm,
          photos: [],
        },
        status: bike.status,
        verifiedBike: bike.verifiedBike,
        safetyScore: bike.safetyScore,
        inspectionNotes: bike.inspectionNotes,
        tags: [`${DEMO_TAG_PREFIX}${bike.slug}`, ...bike.tags],
      };
    }),
  );
  const bikeBySlug = new Map(
    bikeCatalogue.map((bike, index) => [bike.slug, bikeDocs[index]!]),
  );

  const bookingDocs = await BookingModel.insertMany(
    bookingCatalogue.map((booking) => {
      const bike = bikeCatalogue.find(({ slug }) => slug === booking.bike);
      const bikeDoc = bikeBySlug.get(booking.bike);
      const renter = renterByKey.get(booking.renter);
      if (!bike || !bikeDoc || !renter) {
        throw new Error(`Could not resolve booking ${booking.key}`);
      }
      const owner = ownerByKey.get(bike.owner)!;
      const breakdown = priceBreakdown(
        bike.pricePerDay,
        booking.rentalDays,
        bike.serviceFee,
        bike.securityDeposit,
      );
      return {
        bikeId: bikeDoc._id,
        renterId: renter.profile._id,
        ownerId: owner.profile._id,
        startDate: atDayOffset(booking.startOffset, booking.startHour ?? 4),
        endDate: atDayOffset(booking.endOffset, booking.endHour ?? 4),
        pickupLocation: bike.location.label,
        dropoffLocation: bike.location.label,
        notes: booking.notes,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentMode: booking.paymentMethod ? "demo" : null,
        paymentMethod: booking.paymentMethod ?? null,
        ...(booking.cashReference
          ? { cashReference: booking.cashReference }
          : {}),
        cashReceivedAt:
          booking.cashReceivedOffset === undefined
            ? null
            : atDayOffset(booking.cashReceivedOffset),
        totalAmount:
          breakdown.total +
          (booking.extensionAmount ?? 0) +
          (booking.lateFeeAmount ?? 0),
        currency: "NPR",
        cancellationReason: booking.cancellationReason ?? null,
        priceBreakdown: breakdown,
        priceLockedAt: atDayOffset(booking.startOffset - 2),
        returnedAt:
          booking.returnedOffset === undefined
            ? null
            : atDayOffset(booking.returnedOffset, 3),
        lateMinutes: booking.lateMinutes ?? 0,
        lateFeeAmount: booking.lateFeeAmount ?? 0,
        extensionHours: booking.extensionHours ?? 0,
        extensionAmount: booking.extensionAmount ?? 0,
        preRideChecklist: booking.checklist
          ? {
              items: booking.checklist,
              photos: [
                `https://demo.bikebuddy.local/checklists/${booking.key}.jpg`,
              ],
              acknowledged: true,
              completedAt: atDayOffset(
                booking.startOffset,
                booking.startHour ?? 4,
              ),
            }
          : { items: [], photos: [], acknowledged: false, completedAt: null },
      };
    }),
  );
  const bookingByKey = new Map(
    bookingCatalogue.map((booking, index) => [booking.key, bookingDocs[index]!]),
  );

  await PaymentModel.insertMany(
    bookingCatalogue
      .filter((booking) => booking.payment)
      .map((booking) => {
        const bookingDoc = bookingByKey.get(booking.key)!;
        const renter = renterByKey.get(booking.renter)!;
        const payment = booking.payment!;
        return {
          bookingId: bookingDoc._id,
          payerId: renter.baseUser._id,
          provider: payment.provider,
          mode: "demo",
          amount: bookingDoc.totalAmount,
          currency: "NPR",
          status: payment.status,
          transactionRef: payment.ref,
          gatewayMessage: payment.message,
          ...(payment.receipt ? { receiptUrl: payment.receipt } : {}),
        };
      }),
  );

  await ReviewModel.insertMany(
    reviewCatalogue.map((review) => {
      const booking = bookingCatalogue.find(({ key }) => key === review.booking);
      if (!booking) {
        throw new Error(`Unknown booking "${review.booking}" for a review`);
      }
      const bookingDoc = bookingByKey.get(review.booking)!;
      const renter = renterByKey.get(booking.renter)!;
      return {
        bikeId: bookingDoc.bikeId,
        bookingId: bookingDoc._id,
        userId: renter.baseUser._id,
        rating: review.rating,
        comment: review.comment,
        isVerifiedRide: true,
        isHidden: false,
      };
    }),
  );

  // Recompute each bike's rating summary from the reviews that were just
  // written, so listing cards and detail pages agree with the review list.
  const ratingSummaries = await ReviewModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    averageRating: number;
    ratingCount: number;
  }>([
    { $match: { isHidden: false } },
    {
      $group: {
        _id: "$bikeId",
        averageRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);
  await Promise.all(
    ratingSummaries.map((summary) =>
      BikeModel.updateOne(
        { _id: summary._id },
        {
          $set: {
            averageRating: Math.round(summary.averageRating * 10) / 10,
            ratingCount: summary.ratingCount,
          },
        },
      ),
    ),
  );

  await SupportTicketModel.insertMany([
    {
      userId: renterByKey.get("maya")!.baseUser._id,
      bookingId: bookingByKey.get("maya-confirmed")!._id,
      type: "general",
      priority: "normal",
      subject: "Question about evening pickup",
      message:
        "Please confirm where the owner will meet me and which documents I should bring.",
      photos: [],
      status: "in_review",
    },
    {
      userId: renterByKey.get("mohammad")!.baseUser._id,
      bookingId: bookingByKey.get("mohammad-failed")!._id,
      type: "complaint",
      priority: "normal",
      subject: "Demo wallet payment failed",
      message:
        "The demo payment failed. Please confirm that no charge was made before I retry.",
      photos: [],
      status: "resolved",
      rating: 5,
      ratingComment: "The payment status and retry instructions were clear.",
      resolvedAt: atDayOffset(0),
    },
    {
      userId: renterByKey.get("dipesh")!.baseUser._id,
      bookingId: bookingByKey.get("dipesh-active")!._id,
      type: "breakdown",
      priority: "high",
      subject: "Rear tyre pressure warning",
      message:
        "The rear tyre feels low during my active demo ride. I have stopped safely.",
      photos: ["https://demo.bikebuddy.local/support/dipesh-rear-tyre.jpg"],
      status: "open",
    },
    {
      userId: renterByKey.get("roshan")!.baseUser._id,
      bookingId: bookingByKey.get("roshan-active-today")!._id,
      type: "breakdown",
      priority: "high",
      subject: "Chain noise on an active ride",
      message:
        "There is a loud chain noise. I have pulled over safely near Gatthaghar Chowk.",
      photos: ["https://demo.bikebuddy.local/support/roshan-chain.jpg"],
      status: "in_review",
    },
    {
      userId: renterByKey.get("aashish")!.baseUser._id,
      bookingId: bookingByKey.get("aashish-late-return")!._id,
      type: "complaint",
      priority: "normal",
      subject: "Late fee explanation request",
      message:
        "I was 45 minutes late. Please explain how the late fee amount was calculated.",
      photos: [],
      status: "resolved",
      rating: 4,
      ratingComment:
        "The breakdown was explained clearly and matched my receipt.",
      resolvedAt: atDayOffset(-1),
    },
    {
      userId: renterByKey.get("sujan")!.baseUser._id,
      bookingId: bookingByKey.get("sujan-cash-pending")!._id,
      type: "general",
      priority: "normal",
      subject: "Confirming the cash amount at pickup",
      message:
        "I would like written confirmation of the exact cash amount I should carry.",
      photos: [],
      status: "open",
    },
    {
      userId: renterByKey.get("binita")!.baseUser._id,
      bookingId: bookingByKey.get("binita-pending-request")!._id,
      type: "general",
      priority: "normal",
      subject: "Seat height and accessibility",
      message:
        "Could the owner confirm the seat height before my booking is approved?",
      photos: [],
      status: "in_review",
    },
    {
      userId: renterByKey.get("krish")!.baseUser._id,
      bookingId: bookingByKey.get("krish-rejected")!._id,
      type: "complaint",
      priority: "normal",
      subject: "Why was my booking rejected?",
      message:
        "My booking was rejected. Please explain the licence category requirement.",
      photos: [],
      status: "resolved",
      rating: 4,
      ratingComment:
        "The licence rule was explained and I booked a smaller bike.",
      resolvedAt: atDayOffset(-4),
    },
    {
      userId: renterByKey.get("pratima")!.baseUser._id,
      bookingId: bookingByKey.get("pratima-cancelled")!._id,
      type: "general",
      priority: "normal",
      subject: "Refund timing after cancellation",
      message:
        "I cancelled inside the free window. When will the refund appear on my record?",
      photos: [],
      status: "resolved",
      rating: 5,
      ratingComment: "The refund status updated on the booking straight away.",
      resolvedAt: atDayOffset(-9),
    },
    {
      userId: renterByKey.get("anita")!.baseUser._id,
      bookingId: bookingByKey.get("anita-cancelled-late")!._id,
      type: "complaint",
      priority: "normal",
      subject: "Partial refund after a late cancellation",
      message:
        "Please confirm which part of my payment was retained under the policy.",
      photos: [],
      status: "in_review",
    },
    {
      userId: renterByKey.get("saroj")!.baseUser._id,
      bookingId: bookingByKey.get("saroj-completed")!._id,
      type: "general",
      priority: "normal",
      subject: "Requesting a copy of my receipt",
      message:
        "Could you resend the PDF receipt for my completed booking last week?",
      photos: [],
      status: "resolved",
      rating: 5,
      ratingComment: "Receipt arrived quickly and matched the locked total.",
      resolvedAt: atDayOffset(-13),
    },
    {
      userId: renterByKey.get("nishant")!.baseUser._id,
      bookingId: bookingByKey.get("nishant-cancelled")!._id,
      type: "complaint",
      priority: "high",
      subject: "Booking cancelled by the owner",
      message:
        "My booking was cancelled for maintenance the day before pickup. What are my options?",
      photos: [],
      status: "resolved",
      rating: 3,
      ratingComment: "Refunded quickly but I still had to find another bike.",
      resolvedAt: atDayOffset(-7),
    },
  ]);

  await DamageReportModel.insertMany([
    {
      bookingId: bookingByKey.get("dipesh-active")!._id,
      bikeId: bikeBySlug.get("pulsar-220f")!._id,
      reportedBy: renterByKey.get("dipesh")!.baseUser._id,
      photos: ["https://demo.bikebuddy.local/damage/pulsar-left-panel.jpg"],
      description:
        "A small left-panel scratch was noticed during the handover check and photographed before riding.",
      status: "reviewed",
    },
    {
      bookingId: bookingByKey.get("aashish-late-return")!._id,
      bikeId: bikeBySlug.get("activa-6g")!._id,
      reportedBy: renterByKey.get("aashish")!.baseUser._id,
      photos: ["https://demo.bikebuddy.local/damage/activa-mirror.jpg"],
      description:
        "The left mirror was loose on return. Photographed at the pickup point before leaving.",
      status: "resolved",
      resolvedAt: atDayOffset(-1),
    },
    {
      bookingId: bookingByKey.get("saroj-completed")!._id,
      bikeId: bikeBySlug.get("gixxer-155")!._id,
      reportedBy: renterByKey.get("saroj")!.baseUser._id,
      photos: ["https://demo.bikebuddy.local/damage/gixxer-footpeg.jpg"],
      description:
        "Rear footpeg rubber is torn. It was already like this at pickup and is photographed.",
      status: "open",
    },
    {
      bookingId: bookingByKey.get("sujan-completed-1")!._id,
      bikeId: bikeBySlug.get("splendor-plus")!._id,
      reportedBy: renterByKey.get("sujan")!.baseUser._id,
      photos: ["https://demo.bikebuddy.local/damage/splendor-chain-guard.jpg"],
      description:
        "Chain guard rattles after three days of delivery riding on rough roads.",
      status: "reviewed",
    },
    {
      bookingId: bookingByKey.get("dipesh-completed")!._id,
      bikeId: bikeBySlug.get("burgman-125")!._id,
      reportedBy: renterByKey.get("dipesh")!.baseUser._id,
      photos: ["https://demo.bikebuddy.local/damage/burgman-seat.jpg"],
      description:
        "Small tear on the seat cover noted at return, photographed with the owner present.",
      status: "resolved",
      resolvedAt: atDayOffset(-28),
    },
  ] as never);

  await SosAlertModel.insertMany([
    {
      userId: renterByKey.get("dipesh")!.baseUser._id,
      bookingId: bookingByKey.get("dipesh-active")!._id,
      latitude: 27.7172,
      longitude: 85.324,
      note: "Demo-only SOS record: rider stopped safely after a tyre warning.",
      status: "closed",
    },
    {
      userId: renterByKey.get("roshan")!.baseUser._id,
      bookingId: bookingByKey.get("roshan-active-today")!._id,
      latitude: 27.6784,
      longitude: 85.3752,
      note: "Demo-only SOS record: chain noise, rider pulled over at Gatthaghar.",
      status: "open",
    },
    {
      userId: renterByKey.get("pratima")!.baseUser._id,
      bookingId: bookingByKey.get("pratima-touring")!._id,
      latitude: 27.6721,
      longitude: 85.4278,
      note: "Demo-only SOS record: rider requested directions near Bhaktapur gate.",
      status: "closed",
    },
    {
      userId: renterByKey.get("anita")!.baseUser._id,
      bookingId: bookingByKey.get("anita-electric")!._id,
      latitude: 27.6819,
      longitude: 85.3846,
      note: "Demo-only SOS record: battery low, rider stopped at a safe charging point.",
      status: "closed",
    },
  ] as never);

  const bookingIds = bookingDocs.map(({ _id }) => _id.toString());
  const counts = {
    users: await UserModel.countDocuments({
      _id: { $in: demoAccountUserIds },
    } as never),
    renters: await RenterModel.countDocuments({
      _id: { $in: demoRenterIds },
    } as never),
    owners: await OwnerModel.countDocuments({
      _id: { $in: demoOwnerIds },
    } as never),
    admins: await AdminModel.countDocuments({
      baseUserId: admin.baseUser._id.toString(),
    } as never),
    bikes: await BikeModel.countDocuments({
      tags: { $regex: `^${DEMO_TAG_PREFIX}` },
    }),
    bookings: await BookingModel.countDocuments({
      _id: { $in: bookingIds },
    } as never),
    payments: await PaymentModel.countDocuments({
      bookingId: { $in: bookingIds },
    } as never),
    reviews: await ReviewModel.countDocuments({
      bookingId: { $in: bookingIds },
    } as never),
    supportTickets: await SupportTicketModel.countDocuments({
      userId: { $in: demoUserIds },
    } as never),
    damageReports: await DamageReportModel.countDocuments({
      reportedBy: { $in: demoUserIds },
    } as never),
    sosAlerts: await SosAlertModel.countDocuments({
      userId: { $in: demoUserIds },
    } as never),
  };

  console.log("\nBike Buddy demonstration seed complete.");
  console.table(counts);
  console.log("\nDemo login accounts (shared password: Password@123)");
  console.table([
    { role: "admin", name: adminAccount.fullName, email: adminAccount.email },
    ...ownerAccounts.map(({ fullName, email, state }) => ({
      role: `owner (${state})`,
      name: fullName,
      email,
    })),
    ...renterAccounts.map(({ fullName, email }) => ({
      role: "renter",
      name: fullName,
      email,
    })),
  ]);
  console.log(
    "All payment records are mode=demo. No live payment or emergency dispatch is performed.",
  );
};

seed()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
