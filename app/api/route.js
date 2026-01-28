import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
import db from '@/app/db'

export async function POST(req) {
	let { capture } = await req.json();
	try {
		const collection = db.collection('pokedex');
		console.log(`00 body-request`, capture)

		if (!capture.description) {
			console.log(`0. No description on capture:`, capture)
			return NextResponse.json({
				success: true,
				capture,
			}, {
				status: 200
			});
		}

		if (!capture.inference_job_token) {
			console.log(`1. No inference_job_token capture:`, capture)
			capture.inference_job_token = await generateVoice(capture.description)
			await collection.updateOne(
				{ _id: capture._id },
				{
					$set: {
						inference_job_token: capture.inference_job_token
					}
				}
			);
		}
		if (!capture.voiceUrl) {
			console.log(`2. No voiceUrl capture:`, capture)
			let voice = await fetchVoice(capture.inference_job_token)
			capture.voiceStatus = voice.status
			console.log(`2.2 Voice Status:`, voice.status)
			console.log(`2.3 Voice Wave Path:`, voice.maybe_public_bucket_wav_audio_path)
			if (voice.maybe_public_bucket_wav_audio_path) {
				capture.voiceUrl = `https://storage.googleapis.com/vocodes-public${voice.maybe_public_bucket_wav_audio_path}`
				await collection.updateOne(
					{ _id: capture._id },
					{
						$set: {
							voiceUrl: capture.voiceUrl,
							voiceStatus: capture.voiceStatus,
						}
					}
				);
			} else {
				await collection.updateOne(
					{ _id: capture._id },
					{
						$set: {
							voiceStatus: capture.voiceStatus,
						}
					}
				);
			}
		}

		return NextResponse.json({
			success: true,
			capture,
		}, {
			status: 200
		});

	} catch (err) {
		return NextResponse.json({
			success: true,
			capture,
		}, {
			status: 200
		});
	}

};

const generateVoice = async (description) => {
	console.log("--- voice/route.js: generateVoice START (Manual Native Fetch) ---");

	try {
		// 1. Login to get Session Cookie
		console.log("1. Logging in...");
		const loginResp = await fetch('https://api.fakeyou.com/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username_or_email: process.env.FAKEYOU_EMAIL,
				password: process.env.FAKEYOU_PASSWORD
			})
		});

		if (!loginResp.ok) {
			throw new Error(`Login failed with status: ${loginResp.status}`);
		}

		// Extract the 'set-cookie' header. 
		const cookieString = loginResp.headers.get('set-cookie');
		console.log("Login Success. Cookie obtained.");

		if (!cookieString) {
			console.warn("Warning: No set-cookie header found. Trying to proceed without it (might fail).");
		}

		// 2. Generate Voice (Inference)
		console.log("2. Requesting TTS...");
		const modelToken = 'weight_dh8zry5bgkfm0z6nv3anqa9y5';

		const inferenceResp = await fetch('https://api.fakeyou.com/tts/inference', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': cookieString || ''
			},
			body: JSON.stringify({
				tts_model_token: modelToken,
				uuid_idempotency_token: uuidv4(),
				inference_text: description
			})
		});

		const inferenceData = await inferenceResp.json();

		if (!inferenceData.success) {
			console.error("Inference API reported failure:", inferenceData);
			return null;
		}

		console.log("--- generateVoice: SUCCESS ---", inferenceData.inference_job_token);
		return inferenceData.inference_job_token;

	} catch (err) {
		console.error("--- generateVoice: FAILED ---", err.message);
		return null; // Return null so the app proceeds without voice
	}
}

const fetchVoice = async (inference_job_token) => {
	// Manual Fetch to check status
	try {
		const voice = await fetch(`https://api.fakeyou.com/tts/job/${inference_job_token}`)
			.then(res => res.json());
		return voice.state;
	} catch (e) {
		console.log("Error fetching voice status:", e);
		return { status: "failed" };
	}
}



// let entry = {
// 	object: "Wood Mouse",
// 	species: "Rodent",
// 	weight: "20-50 grams",
// 	height: "8-10 cm",
// 	hp: 30,
// 	attack: 25,
// 	defense: 15,
// 	speed: 30,
// 	type: "normal",
// 	description: "Wood Mouse. It is a species of rodent. It is adaptable to a range of habitats but commonly found in forests and grasslands. It primarily feeds on seeds, nuts, and small invertebrates. It is known for its ability to climb and its quick movements. The Wood Mouse is often active at night and is widespread across Europe and Asia. It typically measures around 8 to 10 cm in body length with a similar length tail and weighs about 20 to 50 grams.",
// 	voiceJobToken: "jinf_9es1a71wpnjya9q53j87z38r7z1",
// 	voicePath: "/media/z/x/w/0/p/zxw0p4tqpq9ywmcfpg32wpnx9g52f2bs/fakeyou_zxw0p4tqpq9ywmcfpg32wpnx9g52f2bs.wav",
// 	voiceStatus: "complete_success",
// 	voiceUrl: "https://storage.googleapis.com/vocodes-public/media/z/x/w/0/p/zxw0p4tqpq9ywmcfpg32wpnx9g52f2bs/fakeyou_zxw0p4tqpq9ywmcfpg32wpnx9g52f2bs.wav",
// }

// return NextResponse.json({
// 	success: true,
// 	entry
// }, {
// 	status: 200
// });
