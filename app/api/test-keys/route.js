export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v2 as cloudinary } from 'cloudinary';
import getDb from "@/app/db";

export async function GET(req) {
    const results = {
        gemini: { status: "pending" },
        fakeyou: { status: "pending" },
        cloudinary: { status: "pending" },
        database: { status: "pending" }
    };

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent("Test connection");
        const text = result.response.text();
        results.gemini = { status: "success", message: "Connected", responseStart: text.substring(0, 10) };
    } catch (e) {
        console.error(e);
        results.gemini = { status: "error", message: e.message };
    }

    try {
        if (!process.env.FAKEYOU_EMAIL || !process.env.FAKEYOU_PASSWORD) {
            throw new Error("Missing EMAIL or PASSWORD env vars");
        }

        const loginRes = await fetch('https://api.fakeyou.com/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username_or_email: process.env.FAKEYOU_EMAIL,
                password: process.env.FAKEYOU_PASSWORD
            })
        });

        const data = await loginRes.json();

        if (data.success) {
            results.fakeyou = { status: "success", message: "Login Successful" };
        } else {
            results.fakeyou = { status: "error", message: "Login Failed", details: data };
        }

    } catch (e) {
        console.error(e);
        results.fakeyou = { status: "error", message: e.message };
    }

    try {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_NAME,
            api_key: process.env.CLOUDINARY_KEY,
            api_secret: process.env.CLOUDINARY_SECRET
        });
        const usage = await cloudinary.api.usage();
        results.cloudinary = { status: "success", message: "Connected", plan: usage.plan };
    } catch (e) {
        console.error(e);
        results.cloudinary = { status: "error", message: e.message };
    }

    try {
        const db = await getDb();
        if (!db) throw new Error("MONGODB_URI not configured");
        const collection = db.collection('pokedex');
        const count = await collection.countDocuments({});
        results.database = { status: "success", message: "Connected (MongoDB)", documentCount: count };
    } catch (e) {
        console.error(e);
        results.database = { status: "error", message: e.message };
    }

    return NextResponse.json(results, { status: 200 });
}
