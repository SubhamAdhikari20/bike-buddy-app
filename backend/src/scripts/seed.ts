// backend/src/scripts/seed.ts
// Development seed data: run with `npm run seed`.
// Creates an admin, two owners (one verified), two renters and a set of
// bikes around Kathmandu so the app has realistic content to test with.
import mongoose from "mongoose";
import connectDB from "../config/db.ts";
import UserModel from "../models/user.model.ts";
import AdminModel from "../models/admin.model.ts";
import OwnerModel from "../models/owner.model.ts";
import RenterModel from "../models/renter.model.ts";
import BikeModel from "../models/bike.model.ts";
import { hashPassword } from "../utils/password.ts";

const seed = async () => {
    await connectDB();

    await Promise.all([
        UserModel.deleteMany({}),
        AdminModel.deleteMany({}),
        OwnerModel.deleteMany({}),
        RenterModel.deleteMany({}),
        BikeModel.deleteMany({}),
    ]);

    const password = await hashPassword("Password@123");

    const adminUser = await UserModel.create({ email: "admin@bikebuddy.com", role: "admin", isVerified: true });
    await AdminModel.create({
        baseUserId: adminUser._id.toString(),
        fullName: "Bike Buddy Admin",
        phoneNumber: "9800000001",
        password,
    });

    const ownerUser1 = await UserModel.create({ email: "ramesh.owner@bikebuddy.com", role: "owner", isVerified: true });
    const owner1 = await OwnerModel.create({
        baseUserId: ownerUser1._id.toString(),
        fullName: "Ramesh Shrestha",
        phoneNumber: "9800000002",
        password,
        ownerStatus: "verified",
        ownerVerificationDate: new Date(),
        bio: "Renting well-serviced bikes in Thamel since 2019.",
    });

    const ownerUser2 = await UserModel.create({ email: "sita.owner@bikebuddy.com", role: "owner", isVerified: true });
    const owner2 = await OwnerModel.create({
        baseUserId: ownerUser2._id.toString(),
        fullName: "Sita Maharjan",
        phoneNumber: "9800000003",
        password,
        ownerStatus: "pending",
        bio: "Scooters and e-bikes around Patan.",
    });

    const renterUser1 = await UserModel.create({ email: "aashish@student.com", role: "renter", isVerified: true });
    await RenterModel.create({
        baseUserId: renterUser1._id.toString(),
        fullName: "Aashish Thapa",
        phoneNumber: "9800000004",
        password,
        terms: true,
        kycStatus: "approved",
    });

    const renterUser2 = await UserModel.create({ email: "maya@student.com", role: "renter", isVerified: true });
    await RenterModel.create({
        baseUserId: renterUser2._id.toString(),
        fullName: "Maya Shrestha",
        phoneNumber: "9800000005",
        password,
        terms: true,
        kycStatus: "unverified",
    });

    const img = (id: string) => ({ url: `https://images.unsplash.com/${id}?w=800&q=80`, alt: "bike photo" });

    await BikeModel.create([
        {
            ownerId: owner1._id.toString(),
            title: "Pulsar 220F",
            brand: "Bajaj",
            model: "Pulsar 220F",
            year: 2022,
            engineCc: 220,
            fuelType: "petrol",
            transmission: "manual",
            condition: "excellent",
            category: "sports",
            description: "Well maintained Pulsar, serviced monthly. Two helmets included.",
            pricePerDay: 1500,
            pricePerHour: 200,
            securityDeposit: 2000,
            location: { label: "Thamel Hub", address: "Thamel Marg", city: "Kathmandu", area: "Thamel", landmark: "Near Kathmandu Guest House", latitude: 27.7154, longitude: 85.3123 },
            images: [img("photo-1558981403-c5f9899a28bc"), img("photo-1568772585407-9361f9bf3a87")],
            status: "available",
            verifiedBike: true,
        },
        {
            ownerId: owner1._id.toString(),
            title: "Royal Enfield Classic 350",
            brand: "Royal Enfield",
            model: "Classic 350",
            year: 2021,
            engineCc: 350,
            fuelType: "petrol",
            transmission: "manual",
            condition: "good",
            category: "cruiser",
            description: "Classic cruiser, great for long rides to Nagarkot.",
            pricePerDay: 2500,
            pricePerHour: 350,
            securityDeposit: 5000,
            location: { label: "Thamel Hub", address: "Chhetrapati Chowk", city: "Kathmandu", area: "Thamel", landmark: "Opposite Chhetrapati Sabha Griha", latitude: 27.7119, longitude: 85.3077 },
            images: [img("photo-1609630875171-b1321377ee65")],
            status: "available",
            verifiedBike: true,
        },
        {
            ownerId: owner1._id.toString(),
            title: "Honda Shine 125",
            brand: "Honda",
            model: "Shine 125",
            year: 2023,
            engineCc: 125,
            fuelType: "petrol",
            transmission: "manual",
            condition: "excellent",
            category: "commuter",
            description: "Light and easy commuter, perfect for city errands.",
            pricePerDay: 800,
            pricePerHour: 120,
            securityDeposit: 1000,
            location: { label: "New Road Point", address: "New Road Gate", city: "Kathmandu", area: "New Road", landmark: "Near Bhugol Park", latitude: 27.7043, longitude: 85.3119 },
            images: [img("photo-1449426468159-d96dbf08f19f")],
            status: "available",
            verifiedBike: true,
        },
        {
            ownerId: owner2._id.toString(),
            title: "Niu NQi Sport",
            brand: "Niu",
            model: "NQi Sport",
            year: 2023,
            engineCc: 60,
            fuelType: "electric",
            transmission: "automatic",
            condition: "excellent",
            category: "electric",
            description: "Silent electric scooter, 70 km range per charge.",
            pricePerDay: 900,
            pricePerHour: 150,
            securityDeposit: 1500,
            location: { label: "Patan Point", address: "Pulchowk Road", city: "Lalitpur", area: "Pulchowk", landmark: "Near Pulchowk Campus Gate", latitude: 27.6789, longitude: 85.3161 },
            images: [img("photo-1571068316344-75bc76f77890")],
            status: "available",
            verifiedBike: false,
        },
        {
            ownerId: owner2._id.toString(),
            title: "Vespa SXL 150",
            brand: "Vespa",
            model: "SXL 150",
            year: 2022,
            engineCc: 150,
            fuelType: "petrol",
            transmission: "automatic",
            condition: "good",
            category: "scooter",
            description: "Stylish scooter, smooth in traffic, one helmet included.",
            pricePerDay: 1200,
            pricePerHour: 180,
            securityDeposit: 2000,
            location: { label: "Patan Point", address: "Mangal Bazaar", city: "Lalitpur", area: "Patan", landmark: "Near Patan Durbar Square", latitude: 27.6727, longitude: 85.3255 },
            images: [img("photo-1494976388531-d1058494cdd8")],
            status: "unavailable",
            verifiedBike: false,
        },
        {
            ownerId: owner1._id.toString(),
            title: "Crossfire Trail XT250",
            brand: "Crossfire",
            model: "Trail XT250",
            year: 2021,
            engineCc: 250,
            fuelType: "petrol",
            transmission: "manual",
            condition: "good",
            category: "mountain",
            description: "Off-road ready, knobby tires, great for Shivapuri trails.",
            pricePerDay: 2200,
            pricePerHour: 300,
            securityDeposit: 4000,
            location: { label: "Budhanilkantha Stop", address: "Budhanilkantha Road", city: "Kathmandu", area: "Budhanilkantha", landmark: "Near Shivapuri Gate", latitude: 27.7654, longitude: 85.3620 },
            images: [img("photo-1558980664-10e7170b5df9")],
            status: "available",
            verifiedBike: true,
        },
    ]);

    console.log("Seed complete: 1 admin, 2 owners, 2 renters, 6 bikes");
    await mongoose.disconnect();
};

seed().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
});
