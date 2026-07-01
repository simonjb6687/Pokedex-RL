import { NextResponse } from "next/server";
import getDb from '@/app/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
		let { capture } = await req.json();
		try {
					const db = await getDb();
					const collection = db ? db.collection('pokedex') : null;

			if (!capture.description) {
							return NextResponse.json({ success: true, capture }, { status: 200 });
			}

			if (capture._id && collection) {
							const existing = await collection.findOne({ _id: capture._id });
							if (existing?.voiceUrl?.startsWith('data:audio')) {
												capture.voiceUrl = existing.voiceUrl;
												return NextResponse.json({ success: true, capture }, { status: 200 });
							}
			}

			const cleaned = (capture.description || '')
						.replace(/(\*\*)?Pok[eé]mon:[^\n]*(\*\*)?\s*\n*/i, '')
						.replace(/\*\*/g, '');

			const response = await fetch('https://api.fish.audio/v1/tts', {
							method: 'POST',
							headers: {
												'Authorization': `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
												'Content-Type': 'application/json',
							},
							body: JSON.stringify({
												text: cleaned,
												reference_id: '57a07a0af0954230a44d1db3adc77940',
												format: 'mp3',
													model: 's2.1-pro-free',
							}),
			});

			if (!response.ok) {
							console.error('Fish Audio error:', response.status, await response.text());
							capture.useBrowserVoice = true;
							return NextResponse.json({ success: true, capture }, { status: 200 });
			}

			const audioBuffer = await response.arrayBuffer();
					const base64 = Buffer.from(audioBuffer).toString('base64');
					capture.voiceUrl = `data:audio/mp3;base64,${base64}`;

			if (capture._id && collection) {
							await collection.updateOne(
								{ _id: capture._id },
								{ $set: { voiceUrl: capture.voiceUrl } }
											);
			}

			return NextResponse.json({ success: true, capture }, { status: 200 });
		} catch (err) {
					console.error('Voice API error:', err);
					capture.useBrowserVoice = true;
					return NextResponse.json({ success: true, capture }, { status: 200 });
		}
}
