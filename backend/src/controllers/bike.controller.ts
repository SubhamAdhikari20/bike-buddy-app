import type { RequestHandler } from "express";
import ApiResponse from "../utils/ApiResponse.ts";
import bikeService from "../services/bike.service.ts";

export const createBike: RequestHandler = async (req, res, next) => {
    try {
        const result = await bikeService.createBike(req.auth!, req.body);
        res.status(201).json(new ApiResponse(201, "Bike created successfully", result));
    } catch (error) {
        next(error);
    }
};

export const updateBike: RequestHandler = async (req, res, next) => {
    try {
        const bikeId = String(req.params.bikeId);
        const result = await bikeService.updateBike(req.auth!, bikeId, req.body);
        res.status(200).json(new ApiResponse(200, "Bike updated successfully", result));
    } catch (error) {
        next(error);
    }
};

export const deleteBike: RequestHandler = async (req, res, next) => {
    try {
        const bikeId = String(req.params.bikeId);
        const result = await bikeService.deleteBike(req.auth!, bikeId);
        res.status(200).json(new ApiResponse(200, "Bike deleted successfully", result));
    } catch (error) {
        next(error);
    }
};

export const getBike: RequestHandler = async (req, res, next) => {
    try {
        const bikeId = String(req.params.bikeId);
        const result = await bikeService.getBike(bikeId);
        res.status(200).json(new ApiResponse(200, "Bike fetched successfully", result));
    } catch (error) {
        next(error);
    }
};

export const compareBikes: RequestHandler = async (req, res, next) => {
    try {
        const ids = String(req.query.ids ?? "").split(",").map((id) => id.trim()).filter(Boolean);
        const result = await bikeService.compareBikes(ids);
        res.status(200).json(new ApiResponse(200, "Bikes compared successfully", result));
    } catch (error) {
        next(error);
    }
};

export const listBikes: RequestHandler = async (req, res, next) => {
    try {
        const result = await bikeService.listBikes(req.query as Record<string, unknown>);
        res.status(200).json(new ApiResponse(200, "Bikes fetched successfully", result.items, result.pagination));
    } catch (error) {
        next(error);
    }
};
