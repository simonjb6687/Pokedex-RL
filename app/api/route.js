export const maxDuration = 60; // This function can run for a maximum of 5 seconds
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';
import db from '@/app/db'
import { UUID, ObjectId } from '@datastax/astra-db-ts';
import { v2 as cloudinary } from 'cloudinary';
import { getToken } from 'next-auth/jwt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_NAME,
	api_key: process.env.CLOUDINARY_KEY,
	api_secret: process.env.CLOUDINARY_SECRET
});

export async function POST(req) {
	console.time("Total Request Time");

	let { capture } = await req.json();

	// Parallelize initial image tasks (Upload + Analysis) to save ~2-3 seconds
	console.time("Image Upload & Analysis");
	const [image, imageDescription] = await Promise.all([
		cloudinary.uploader.upload(capture.image),
		analysisImage(capture.image)
	]);
	console.timeEnd("Image Upload & Analysis");

	// Relaxed check to allow for debug messages or slight variations
	if (imageDescription.includes("No object identified.")) {
		console.log("No object identified fallback triggered. Description:", imageDescription);
		console.timeEnd("Total Request Time");
		return NextResponse.json({
			success: true,
			entry: {
				object: "Unidentifiable Object",
				species: "Unknown",
				approximateWeight: "Unknown",
				approximateHeight: "Unknown",
				weight: 0,
				height: 0,
				hp: 0,
				attack: 0,
				defense: 0,
				speed: 0,
				type: "Unknown",
				description: `(v2.5-FLASH CHECK) ${imageDescription}`,
				voiceJobToken: "/no-object.wav",
			}
		}, {
			status: 200
		});
	}

	console.log(`Starting Parallel Tasks...`);
	console.time("Parallel Tasks (Voice+Entry+Vector)");
	// Parallelize slow operations to prevent Vercel 10s timeout
	const [voiceResult, entry, vector, no] = await Promise.all([
		generateVoice(imageDescription),
		generateEntry(imageDescription),
		getEmbedding(imageDescription),
		getNoObject()
	]);
	console.timeEnd("Parallel Tasks (Voice+Entry+Vector)");

	entry.$vector = vector;
	if (voiceResult && voiceResult.token) {
		entry.inference_job_token = voiceResult.token;
	}
	if (voiceResult && voiceResult.url) {
		entry.voiceUrl = voiceResult.url;
	}
	entry.image = image.secure_url
	entry.no = no;

	console.time("DB Insert");
	let poke = await addToDatabase(req, entry);
	console.timeEnd("DB Insert");

	console.timeEnd("Total Request Time");
	return NextResponse.json({
		success: true,
		entry,
		// entry: EXAMPLE,
	}, {
		status: 200
	});

};

const generateEntry = async (imageDescription) => {
	const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

	const prompt = `You are a Pokedex designed to output JSON. Given a description of an object, you should output a JSON object with the following fields: object, species, approximateWeight, approximateHeight, weight, height, hp, attack, defense, speed, and type. Humans for example would have base health of 100. Another example, if the object is a Golden Retriever, you should output: {object: 'Golden Retriever', species: 'Dog', approximateWeight: '10-20 kg', approximateHeight: '50-60 cm', weight: 15, height:55, hp: 50, attack: 40, defense: 40, speed: 19, type: 'normal'}. Another example for a  {object: 'Magpie', species: 'Bird', approximateWeight: '130 - 270 g', approximateHeight: '37-43 cm', weight: 0.2, height:40, hp: 25, attack: 20, defense: 10, speed: 32, type: 'Flying'} If you are given an object that is not a living creature, plant or lifeform, such as a coffee cup, output the same fields but with type: 'Inanimate'. If you are given a description of a person or human, output species: 'Human' and name: 'Person' and type: 'Normal'. If you are not sure what the attributes are for things like height or speed, it is okay to guess. Some examples, plants can have the type as Grass, with the species being Plant. Fish would have the type of Water with the species being Fish. Try to keep the types to the options avaiable in pokemon. Description: ${imageDescription}`;

	const result = await model.generateContent(prompt);
	const text = result.response.text();
	// Gemini Pro often wraps JSON in markdown code blocks, strip them:
	const cleanedText = text.replace(/```json|```/g, '').trim();
	let entry = JSON.parse(cleanedText);
	entry.description = imageDescription;
	entry._id = UUID.v4();
	return entry
}

const getNoObject = async () => {
	const collection = db.collection('pokedex');
	let poke = await collection.findOne({}, { sort: { no: -1 } });
	return poke.no + 1;
}

const addToDatabase = async (req, entry) => {

	const token = await getToken({ req });
	const users = db.collection('users');

	let user = {}

	console.log(`1. addToDatabase`)

	if (token) {
		user = await users.findOne({
			providerAccountId: token.sub,
		});
	}

	let userObject = user ? {
		user_id: user._id,
		userName: user.name,
		userAvatar: user.avatar,
	} : {};

	console.log(`2. addToDatabase.user`, userObject)

	const collection = db.collection('pokedex');

	const ifAlreadyExists = await collection.findOne({
		object: entry.object,
		user_id: user._id
	});

	if (ifAlreadyExists) {
		console.log(`3. addToDatabase.ifAlreadyExists`, {
			...ifAlreadyExists,
		});
		return ifAlreadyExists
	}

	console.log(`3. addToDatabase.skipped.ifAlreadyExists`, {
		...entry,
		...userObject,
	});

	let poke = await collection.insertOne({
		...entry,
		...userObject,
	});
	// update user, increment how many pokedex entries they have made
	if (user) {
		// user.pokedexEntries is a new entry, if it doesnt exist, create it with the value of 1, if it does exist, increment it by 1
		user.pokedexEntries = user.pokedexEntries ? user.pokedexEntries + 1 : 1;
		await users.updateOne({
			_id: user._id,
		}, {
			$set: {
				pokedexEntries: user.pokedexEntries
			}
		});
	}
	return poke
}

const generateVoice = async (description) => {
	console.log("--- generateVoice: START ---");
	const FakeYou = require('fakeyou.js');
	const fy = new FakeYou.Client({
		usernameOrEmail: process.env.FAKEYOU_EMAIL,
		password: process.env.FAKEYOU_PASSWORD
	});

	const voiceTask = async () => {
		console.log("--- generateVoice: Logging in... ---");
		await fy.start();
		console.log("--- generateVoice: Login Success. Requesting TTS... ---");

		const modelToken = 'weight_dh8zry5bgkfm0z6nv3anqa9y5';
		const result = await fy.makeTTS(modelToken, description);
		return result;
	};

	try {
		// Race the ENTRIE task (Login + TTS) against the timer
		const result = await Promise.race([
			voiceTask(),
			new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4500))
		]);

		console.log("--- generateVoice: SUCCESS ---", JSON.stringify(result));

		let token = result.jobToken || result.inference_job_token || result.inferenceJobToken;
		let url = null;

		if (result && result.audioPath) {
			url = `https://storage.googleapis.com/vocodes-public${result.audioPath}`;
		}

		return { token, url };
	} catch (err) {
		console.error("--- generateVoice: FAILED/TIMED OUT ---", err.message);
		return null; // Return null so the app proceeds without voice
	}
}

const getEmbedding = async (text) => {
	const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
	const result = await model.embedContent(text);
	return result.embedding.values;
}

const analysisImage = async (image) => {
	const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
	// We use 2.5 flash as we saw it was available
	const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

	const prompt = "You are a Pokedex. Identify the primary object, creature, or person in this image. " +
		"If it is a Pokemon, identify it by name. " +
		"If it is an inanimate object, describe it. " +
		"If it is a person, describe them generally (e.g., 'A human male'). " +
		"Provide a brief, encyclopedia-style description (3-4 sentences). " +
		"DO NOT say 'No object identified' unless the image is completely black or purely noise.";

	// Handle image input (expecting base64 data URI)
	let imagePart;
	if (image.startsWith("data:")) {
		const [mimeType, base64Data] = image.split(";base64,");
		imagePart = {
			inlineData: {
				data: base64Data,
				mimeType: mimeType.replace("data:", "")
			}
		};
	} else {
		console.warn("Image format might not be supported directly if not base64:", image.substring(0, 50));
		return "No object identified.";
	}

	try {
		console.log("Analyzing image with Gemini...");
		const result = await model.generateContent([prompt, imagePart]);
		const response = await result.response;
		const text = response.text();
