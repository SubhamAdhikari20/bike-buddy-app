// Atlas-safe demonstration data: run with `npm run seed`.
//
// The seed is deliberately scoped. It never clears a collection globally:
// only the canonical demo accounts, bikes carrying DEMO_TAG_PREFIX, and
// records linked to those accounts/bikes are recreated.
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
  fullName: string;
  email: string;
  phoneNumber: string;
  bio: string;
};

const renterAccounts: DemoAccount[] = [
  {
    fullName: "Aashish Thapa",
    email: "aashish@student.com",
    phoneNumber: "9800000004",
    bio: "Budget-conscious student who uses Bike Buddy for classes and errands.",
  },
  {
    fullName: "Maya Shrestha",
    email: "maya@student.com",
    phoneNumber: "9800000005",
    bio: "First-time renter who values clear safety guidance and trusted owners.",
  },
  {
    fullName: "Saroj Karki",
    email: "saroj@student.com",
    phoneNumber: "9800000006",
    bio: "Careful rider who checks condition evidence, reviews, and service history.",
  },
  {
    fullName: "Nishant Rai",
    email: "nishant@student.com",
    phoneNumber: "9800000007",
    bio: "Busy student who needs quick reservations and reliable pickup directions.",
  },
  {
    fullName: "Binita Gurung",
    email: "binita@student.com",
    phoneNumber: "9800000008",
    bio: "Accessibility-focused renter who prefers simple navigation and cash options.",
  },
  {
    fullName: "Krish Maharjan",
    email: "krish@student.com",
    phoneNumber: "9800000009",
    bio: "Enthusiast who compares specifications, rates, and verified ride reviews.",
  },
  {
    fullName: "Mohammad Ali",
    email: "mohammad@student.com",
    phoneNumber: "9800000010",
    bio: "Price-conscious renter who expects transparent totals and clear receipts.",
  },
  {
    fullName: "Dipesh Tamang",
    email: "dipesh@student.com",
    phoneNumber: "9800000011",
    bio: "Frequent renter who needs extensions, support tracking, and damage reporting.",
  },
];

const ownerAccounts: DemoAccount[] = [
  {
    fullName: "Ramesh Shrestha",
    email: "ramesh.owner@bikebuddy.com",
    phoneNumber: "9800000002",
    bio: "Verified owner renting well-serviced bikes around Kathmandu since 2019.",
  },
  {
    fullName: "Sita Maharjan",
    email: "sita.owner@bikebuddy.com",
    phoneNumber: "9800000003",
    bio: "New owner preparing scooters and electric bikes for renters around Patan.",
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
      ...account,
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

const ensureOwnerAccount = async (account: DemoAccount, verified: boolean) => {
  let baseUser = await UserModel.findOne({ email: account.email });

  if (!baseUser) {
    await authService.registerOwner({
      ...account,
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
    ownerNotes: verified
      ? "Demo account: identity and ownership documents checked."
      : "Demo account: verification documents awaiting administrator review.",
    ownerStatus: verified ? ("verified" as const) : ("pending" as const),
    ownerVerificationDate: verified
      ? new Date("2026-01-12T06:00:00.000Z")
      : null,
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
  const renters = [];
  for (const account of renterAccounts) {
    renters.push(await ensureRenterAccount(account));
  }

  const owners = [];
  for (const [index, account] of ownerAccounts.entries()) {
    owners.push(await ensureOwnerAccount(account, index === 0));
  }
  const admin = await ensureAdminAccount();

  // Replaces legacy optional-field unique indexes with partial unique indexes.
  await RenterModel.syncIndexes();

  const demoUserIds = [
    ...renters.map(({ baseUser }) => baseUser._id.toString()),
    ...owners.map(({ baseUser }) => baseUser._id.toString()),
  ];
  const demoAccountUserIds = [
    ...demoUserIds,
    admin.baseUser._id.toString(),
  ];
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
      bookingId: { $in: oldBookingIds },
    } as never),
    DamageReportModel.deleteMany({
      $or: [
        { bookingId: { $in: oldBookingIds } },
        { bikeId: { $in: oldDemoBikeIds } },
      ],
    } as never),
    SosAlertModel.deleteMany({
      bookingId: { $in: oldBookingIds },
    } as never),
  ]);
  await BookingModel.deleteMany({ _id: { $in: oldBookingIds } } as never);
  await BikeModel.deleteMany({ _id: { $in: oldDemoBikeIds } } as never);

  const verifiedOwner = owners[0]!.profile;
  const pendingOwner = owners[1]!.profile;
  const bikes = await BikeModel.insertMany([
    {
      ownerId: verifiedOwner._id,
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
      specs: {
        weightKg: 160,
        mileageKmPerL: 38,
        helmetIncluded: true,
      },
      conditionInfo: {
        serviceDate: new Date("2026-06-20T06:00:00.000Z"),
        odometerKm: 18420,
        photos: [],
      },
      status: "available",
      verifiedBike: true,
      safetyScore: 94,
      inspectionNotes: "Tyres, brakes, lights, and documents checked.",
      tags: [`${DEMO_TAG_PREFIX}pulsar-220f`, "student-friendly", "helmet"],
    },
    {
      ownerId: verifiedOwner._id,
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
      specs: {
        weightKg: 195,
        mileageKmPerL: 35,
        helmetIncluded: true,
      },
      conditionInfo: {
        serviceDate: new Date("2026-06-08T06:00:00.000Z"),
        odometerKm: 23610,
        photos: [],
      },
      status: "available",
      verifiedBike: true,
      safetyScore: 89,
      inspectionNotes: "Minor cosmetic marks recorded in condition photos.",
      tags: [`${DEMO_TAG_PREFIX}classic-350`, "touring", "helmet"],
    },
    {
      ownerId: verifiedOwner._id,
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
      images: [
        img("photo-1449426468159-d96dbf08f19f", "Honda commuter bike"),
      ],
      specs: {
        weightKg: 114,
        mileageKmPerL: 55,
        helmetIncluded: true,
      },
      conditionInfo: {
        serviceDate: new Date("2026-06-25T06:00:00.000Z"),
        odometerKm: 9780,
        photos: [],
      },
      status: "available",
      verifiedBike: true,
      safetyScore: 97,
      inspectionNotes: "Excellent commuter condition; no recorded faults.",
      tags: [`${DEMO_TAG_PREFIX}shine-125`, "budget", "commuter"],
    },
    {
      ownerId: verifiedOwner._id,
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
      specs: {
        weightKg: 125,
        mileageKmPerL: 30,
        helmetIncluded: true,
      },
      conditionInfo: {
        serviceDate: new Date("2026-06-15T06:00:00.000Z"),
        odometerKm: 14250,
        photos: [],
      },
      status: "maintenance",
      verifiedBike: true,
      safetyScore: 84,
      inspectionNotes: "Scheduled chain and rear brake adjustment.",
      tags: [`${DEMO_TAG_PREFIX}crossfire-xt250`, "trail", "adventure"],
    },
    {
      ownerId: pendingOwner._id,
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
      images: [
        img("photo-1571068316344-75bc76f77890", "NIU electric scooter"),
      ],
      specs: {
        weightKg: 99,
        mileageKmPerL: null,
        helmetIncluded: true,
      },
      conditionInfo: {
        serviceDate: new Date("2026-06-18T06:00:00.000Z"),
        odometerKm: 6240,
        photos: [],
      },
      status: "inactive",
      verifiedBike: false,
      safetyScore: 76,
      inspectionNotes: "Listing remains inactive until owner verification.",
      tags: [`${DEMO_TAG_PREFIX}niu-nqi`, "electric", "automatic"],
    },
    {
      ownerId: pendingOwner._id,
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
      specs: {
        weightKg: 115,
        mileageKmPerL: 42,
        helmetIncluded: true,
      },
      conditionInfo: {
        serviceDate: new Date("2026-06-02T06:00:00.000Z"),
        odometerKm: 11780,
        photos: [],
      },
      status: "inactive",
      verifiedBike: false,
      safetyScore: 74,
      inspectionNotes: "Awaiting owner verification before publication.",
      tags: [`${DEMO_TAG_PREFIX}vespa-sxl`, "scooter", "automatic"],
    },
    {
      ownerId: verifiedOwner._id,
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
      specs: {
        weightKg: 99,
        mileageKmPerL: 50,
        helmetIncluded: true,
      },
      conditionInfo: {
        serviceDate: new Date("2026-06-28T06:00:00.000Z"),
        odometerKm: 4850,
        photos: [],
      },
      status: "available",
      verifiedBike: true,
      safetyScore: 98,
      inspectionNotes: "Recent service and tyre-pressure check completed.",
      tags: [`${DEMO_TAG_PREFIX}rayzr-125`, "scooter", "beginner"],
    },
  ]);

  const breakdowns = [
    priceBreakdown(1500, 1, 150, 2000),
    priceBreakdown(2500, 2, 250, 5000),
    priceBreakdown(800, 1, 100, 1000),
    priceBreakdown(2200, 1, 220, 4000),
    priceBreakdown(1100, 1, 110, 1500),
    priceBreakdown(1500, 2, 150, 2000),
    priceBreakdown(1100, 1, 110, 1500),
    priceBreakdown(1500, 1, 150, 2000),
  ];

  const bookings = await BookingModel.insertMany([
    {
      bikeId: bikes[0]!._id,
      renterId: renters[0]!.profile._id,
      ownerId: verifiedOwner._id,
      startDate: atDayOffset(-18),
      endDate: atDayOffset(-17),
      pickupLocation: "Thamel Hub",
      dropoffLocation: "Thamel Hub",
      notes: "Demo: completed student commute.",
      status: "completed",
      paymentStatus: "paid",
      paymentMode: "demo",
      paymentMethod: "wallet",
      totalAmount: breakdowns[0]!.total,
      currency: "NPR",
      priceBreakdown: breakdowns[0],
      priceLockedAt: atDayOffset(-20),
      returnedAt: atDayOffset(-17, 3),
      preRideChecklist: {
        items: [
          { key: "brakes", ok: true, note: null },
          { key: "lights", ok: true, note: null },
          { key: "tyres", ok: true, note: null },
        ],
        photos: ["https://demo.bikebuddy.local/checklists/pulsar-before.jpg"],
        acknowledged: true,
        completedAt: atDayOffset(-18),
      },
    },
    {
      bikeId: bikes[1]!._id,
      renterId: renters[1]!.profile._id,
      ownerId: verifiedOwner._id,
      startDate: atDayOffset(2),
      endDate: atDayOffset(4),
      pickupLocation: "Chhetrapati Pickup",
      dropoffLocation: "Chhetrapati Pickup",
      notes: "Demo: first-time renter planning a Nagarkot trip.",
      status: "confirmed",
      paymentStatus: "paid",
      paymentMode: "demo",
      paymentMethod: "wallet",
      totalAmount: breakdowns[1]!.total,
      currency: "NPR",
      priceBreakdown: breakdowns[1],
      priceLockedAt: atDayOffset(-1),
    },
    {
      bikeId: bikes[2]!._id,
      renterId: renters[2]!.profile._id,
      ownerId: verifiedOwner._id,
      startDate: atDayOffset(6),
      endDate: atDayOffset(7),
      pickupLocation: "New Road Point",
      dropoffLocation: "New Road Point",
      notes: "Demo: renter requested confirmation of condition evidence.",
      status: "pending",
      paymentStatus: "unpaid",
      totalAmount: breakdowns[2]!.total,
      currency: "NPR",
      priceBreakdown: breakdowns[2],
      priceLockedAt: atDayOffset(0),
    },
    {
      bikeId: bikes[3]!._id,
      renterId: renters[3]!.profile._id,
      ownerId: verifiedOwner._id,
      startDate: atDayOffset(-8),
      endDate: atDayOffset(-7),
      pickupLocation: "Budhanilkantha Stop",
      dropoffLocation: "Budhanilkantha Stop",
      notes: "Demo: cancelled after maintenance notice.",
      status: "cancelled",
      paymentStatus: "refunded",
      paymentMode: "demo",
      paymentMethod: "wallet",
      totalAmount: breakdowns[3]!.total,
      currency: "NPR",
      cancellationReason: "Bike entered scheduled maintenance.",
      priceBreakdown: breakdowns[3],
      priceLockedAt: atDayOffset(-10),
    },
    {
      bikeId: bikes[6]!._id,
      renterId: renters[4]!.profile._id,
      ownerId: verifiedOwner._id,
      startDate: atDayOffset(-12),
      endDate: atDayOffset(-11),
      pickupLocation: "Baneshwor Hub",
      dropoffLocation: "Baneshwor Hub",
      notes: "Demo: completed accessible cash-payment journey.",
      status: "completed",
      paymentStatus: "paid",
      paymentMode: "demo",
      paymentMethod: "cash",
      cashReference: "DEMO-CASH-BINITA-001",
      cashReceivedAt: atDayOffset(-12),
      totalAmount: breakdowns[4]!.total,
      currency: "NPR",
      priceBreakdown: breakdowns[4],
      priceLockedAt: atDayOffset(-14),
      returnedAt: atDayOffset(-11, 3),
    },
    {
      bikeId: bikes[0]!._id,
      renterId: renters[5]!.profile._id,
      ownerId: verifiedOwner._id,
      startDate: atDayOffset(-28),
      endDate: atDayOffset(-26),
      pickupLocation: "Thamel Hub",
      dropoffLocation: "Thamel Hub",
      notes: "Demo: completed specification-comparison journey.",
      status: "completed",
      paymentStatus: "paid",
      paymentMode: "demo",
      paymentMethod: "wallet",
      totalAmount: breakdowns[5]!.total,
      currency: "NPR",
      priceBreakdown: breakdowns[5],
      priceLockedAt: atDayOffset(-30),
      returnedAt: atDayOffset(-26, 3),
    },
    {
      bikeId: bikes[6]!._id,
      renterId: renters[6]!.profile._id,
      ownerId: verifiedOwner._id,
      startDate: atDayOffset(9),
      endDate: atDayOffset(10),
      pickupLocation: "Baneshwor Hub",
      dropoffLocation: "Baneshwor Hub",
      notes: "Demo: checkout retained after a simulated wallet failure.",
      status: "pending",
      paymentStatus: "failed",
      paymentMode: "demo",
      paymentMethod: "wallet",
      totalAmount: breakdowns[6]!.total,
      currency: "NPR",
      priceBreakdown: breakdowns[6],
      priceLockedAt: atDayOffset(0),
    },
    {
      bikeId: bikes[0]!._id,
      renterId: renters[7]!.profile._id,
      ownerId: verifiedOwner._id,
      startDate: atDayOffset(0, 1),
      endDate: atDayOffset(1, 10),
      pickupLocation: "Thamel Hub",
      dropoffLocation: "Thamel Hub",
      notes: "Demo: active ride extended by three hours.",
      status: "confirmed",
      paymentStatus: "paid",
      paymentMode: "demo",
      paymentMethod: "wallet",
      totalAmount: breakdowns[7]!.total + 600,
      currency: "NPR",
      priceBreakdown: breakdowns[7],
      priceLockedAt: atDayOffset(-2),
      extensionHours: 3,
      extensionAmount: 600,
      preRideChecklist: {
        items: [
          { key: "brakes", ok: true, note: null },
          { key: "lights", ok: true, note: null },
          {
            key: "body",
            ok: true,
            note: "Small left-panel scratch photographed.",
          },
        ],
        photos: ["https://demo.bikebuddy.local/checklists/dipesh-before.jpg"],
        acknowledged: true,
        completedAt: atDayOffset(0, 1),
      },
    },
  ]);

  await PaymentModel.insertMany([
    {
      bookingId: bookings[0]!._id,
      payerId: renters[0]!.baseUser._id,
      provider: "esewa",
      mode: "demo",
      amount: bookings[0]!.totalAmount,
      currency: "NPR",
      status: "succeeded",
      transactionRef: "DEMO-PAY-AASHISH-001",
      gatewayMessage: "Simulated eSewa payment succeeded.",
      receiptUrl: "https://demo.bikebuddy.local/receipts/aashish-001",
    },
    {
      bookingId: bookings[1]!._id,
      payerId: renters[1]!.baseUser._id,
      provider: "khalti",
      mode: "demo",
      amount: bookings[1]!.totalAmount,
      currency: "NPR",
      status: "succeeded",
      transactionRef: "DEMO-PAY-MAYA-001",
      gatewayMessage: "Simulated Khalti payment succeeded.",
      receiptUrl: "https://demo.bikebuddy.local/receipts/maya-001",
    },
    {
      bookingId: bookings[3]!._id,
      payerId: renters[3]!.baseUser._id,
      provider: "esewa",
      mode: "demo",
      amount: bookings[3]!.totalAmount,
      currency: "NPR",
      status: "refunded",
      transactionRef: "DEMO-PAY-NISHANT-001",
      gatewayMessage: "Simulated full refund after owner cancellation.",
      receiptUrl: "https://demo.bikebuddy.local/receipts/nishant-001",
    },
    {
      bookingId: bookings[4]!._id,
      payerId: renters[4]!.baseUser._id,
      provider: "manual",
      mode: "demo",
      amount: bookings[4]!.totalAmount,
      currency: "NPR",
      status: "succeeded",
      transactionRef: "DEMO-PAY-BINITA-CASH-001",
      gatewayMessage: "Cash receipt recorded by the owner.",
      receiptUrl: "https://demo.bikebuddy.local/receipts/binita-cash-001",
    },
    {
      bookingId: bookings[5]!._id,
      payerId: renters[5]!.baseUser._id,
      provider: "khalti",
      mode: "demo",
      amount: bookings[5]!.totalAmount,
      currency: "NPR",
      status: "succeeded",
      transactionRef: "DEMO-PAY-KRISH-001",
      gatewayMessage: "Simulated Khalti payment succeeded.",
      receiptUrl: "https://demo.bikebuddy.local/receipts/krish-001",
    },
    {
      bookingId: bookings[6]!._id,
      payerId: renters[6]!.baseUser._id,
      provider: "esewa",
      mode: "demo",
      amount: bookings[6]!.totalAmount,
      currency: "NPR",
      status: "failed",
      transactionRef: "DEMO-PAY-MOHAMMAD-FAIL-001",
      gatewayMessage:
        "Simulated wallet failure; no money was transferred and retry is available.",
    },
    {
      bookingId: bookings[7]!._id,
      payerId: renters[7]!.baseUser._id,
      provider: "khalti",
      mode: "demo",
      amount: bookings[7]!.totalAmount,
      currency: "NPR",
      status: "succeeded",
      transactionRef: "DEMO-PAY-DIPESH-001",
      gatewayMessage: "Simulated payment including extension amount.",
      receiptUrl: "https://demo.bikebuddy.local/receipts/dipesh-001",
    },
  ]);

  await ReviewModel.insertMany([
    {
      bikeId: bikes[0]!._id,
      bookingId: bookings[0]!._id,
      userId: renters[0]!.baseUser._id,
      rating: 5,
      comment:
        "Clear pricing, smooth pickup, and the bike matched its condition photos.",
      isVerifiedRide: true,
      isHidden: false,
    },
    {
      bikeId: bikes[6]!._id,
      bookingId: bookings[4]!._id,
      userId: renters[4]!.baseUser._id,
      rating: 4,
      comment:
        "The cash steps were easy to understand and the scooter was comfortable.",
      isVerifiedRide: true,
      isHidden: false,
    },
    {
      bikeId: bikes[0]!._id,
      bookingId: bookings[5]!._id,
      userId: renters[5]!.baseUser._id,
      rating: 4,
      comment:
        "Useful specifications and fair daily rate; helmet was ready at pickup.",
      isVerifiedRide: true,
      isHidden: false,
    },
  ]);

  await Promise.all([
    BikeModel.updateOne(
      { _id: bikes[0]!._id },
      { $set: { averageRating: 4.5, ratingCount: 2 } },
    ),
    BikeModel.updateOne(
      { _id: bikes[6]!._id },
      { $set: { averageRating: 4, ratingCount: 1 } },
    ),
  ]);

  await SupportTicketModel.insertMany([
    {
      userId: renters[1]!.baseUser._id,
      bookingId: bookings[1]!._id,
      type: "general",
      priority: "normal",
      subject: "Question about evening pickup",
      message:
        "Please confirm where the owner will meet me and which documents I should bring.",
      photos: [],
      status: "in_review",
    },
    {
      userId: renters[6]!.baseUser._id,
      bookingId: bookings[6]!._id,
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
      userId: renters[7]!.baseUser._id,
      bookingId: bookings[7]!._id,
      type: "breakdown",
      priority: "high",
      subject: "Rear tyre pressure warning",
      message:
        "The rear tyre feels low during my active demo ride. I have stopped safely.",
      photos: ["https://demo.bikebuddy.local/support/dipesh-rear-tyre.jpg"],
      status: "open",
    },
  ]);

  await DamageReportModel.create({
    bookingId: bookings[7]!._id,
    bikeId: bikes[0]!._id,
    reportedBy: renters[7]!.baseUser._id,
    photos: ["https://demo.bikebuddy.local/damage/pulsar-left-panel.jpg"],
    description:
      "A small left-panel scratch was noticed during the handover check and photographed before riding.",
    status: "reviewed",
  } as never);

  await SosAlertModel.create({
    userId: renters[7]!.baseUser._id,
    bookingId: bookings[7]!._id,
    latitude: 27.7172,
    longitude: 85.324,
    note: "Demo-only SOS record: rider stopped safely after a tyre warning.",
    status: "closed",
  } as never);

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
      _id: { $in: bookings.map(({ _id }) => _id.toString()) },
    } as never),
    payments: await PaymentModel.countDocuments({
      bookingId: { $in: bookings.map(({ _id }) => _id.toString()) },
    } as never),
    reviews: await ReviewModel.countDocuments({
      bookingId: { $in: bookings.map(({ _id }) => _id.toString()) },
    } as never),
    supportTickets: await SupportTicketModel.countDocuments({
      userId: { $in: demoUserIds },
    } as never),
    damageReports: await DamageReportModel.countDocuments({
      reportedBy: { $in: demoUserIds },
    } as never),
  };

  console.log("\nBike Buddy Atlas demo seed complete.");
  console.table(counts);
  console.log("\nDemo login accounts (shared password: Password@123)");
  console.table([
    { role: "admin", name: adminAccount.fullName, email: adminAccount.email },
    ...ownerAccounts.map(({ fullName, email }, index) => ({
      role: index === 0 ? "owner (verified)" : "owner (pending)",
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
