"use client";
import { StoreContext, useContext, observer } from '@/app/Mobx'
import { useEffect, useRef, useState } from 'react';

import { Chart as ChartJS,
RadialLinearScale,
PointElement,
LineElement,
Filler,
Tooltip,
Legend, } from "chart.js";

import { Radar } from 'react-chartjs-2';

import Header from '@/app/layout/Header'
import Footer from '@/app/layout/Footer'
import ButtonDelete from "@/app/imgs/button-delete.png"

ChartJS.register(
RadialLinearScale,
PointElement,
LineElement,
Filler,
Tooltip,
Legend
);

const speakText = (text) => {
	if (typeof window === 'undefined' || !window.speechSynthesis) return;
	window.speechSynthesis.cancel();
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.pitch = 0.57;
	utterance.rate = 1.2;
	utterance.volume = 1;
	const voices = window.speechSynthesis.getVoices();
	const preferred = voices.find(v =>
		v.name.includes('Fred') ||
		v.name.includes('Google UK English Male') ||
		v.name.includes('Alex') ||
		v.name.includes('Microsoft David') ||
		v.name.includes('Daniel') );
	if (preferred) utterance.voice = preferred;
	window.speechSynthesis.speak(utterance);
};

const Pokedex = observer(() => {
	const store = useContext(StoreContext)
	const initialized = useRef(false)
	const audioRef = useRef(null)
	const [captured, setCaptured] = useState(false)
	const [capturedCount, setCapturedCount] = useState(0)
	const [shiny, setShiny] = useState(false)
	const [shinyCount, setShinyCount] = useState(0)
	const [voiceLoading, setVoiceLoading] = useState(false)

	const playAudio = (url) => {
		stopAudio()
		const audio = new Audio(url)
		audioRef.current = audio
		audio.play().catch(() => {})
	}

	const stopAudio = () => {
		if (audioRef.current) {
			audioRef.current.pause()
			audioRef.current.currentTime = 0
		}
		if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
	}

	const replay = async () => {
		if (store.capture.voiceUrl?.startsWith('data:audio')) {
			playAudio(store.capture.voiceUrl)
			return
		}
		setVoiceLoading(true)
		await store.fetchVoice()
		setVoiceLoading(false)
		if (store.capture.voiceUrl?.startsWith('data:audio')) {
			playAudio(store.capture.voiceUrl)
		} else {
			const cleaned = (store.capture.description || '').replace(/(\*\*)?Pok[eÃ©]mon:[^\n]*(\*\*)?\s*\n*/i, '').replace(/\*\*/g, '')
			speakText(cleaned)
		}
	}

	useEffect(() => {
		if (!initialized.current) {
			initialized.current = true
			const initVoice = async () => {
				setVoiceLoading(true)
				await store.fetchVoice()
				setVoiceLoading(false)
				if (store.capture.voiceUrl?.startsWith('data:audio')) {
					setTimeout(() => playAudio(store.capture.voiceUrl), 500)
				} else {
					const cleaned = (store.capture.description || '').replace(/(\*\*)?Pok[eÃ©]mon:[^\n]*(\*\*)?\s*\n*/i, '').replace(/\*\*/g, '')
					setTimeout(() => speakText(cleaned), 500)
				}
			}
			initVoice()
		}
	}, []);

	const saveStats = async (field, value) => {
		if (!store.capture._id) return
		try {
			await fetch('/api/pokemon/stats', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ _id: store.capture._id, [field]: value })
			})
		} catch (e) {}
	}

	useEffect(() => {
		if (store.capture) {
			setCaptured(store.capture.captured || false)
			setCapturedCount(store.capture.capturedCount || 0)
			setShiny(store.capture.shiny || false)
			setShinyCount(store.capture.shinyCount || 0)
		}
	}, [])

	const type = store.capture.type.toLowerCase();
	const firstType = type.split(/[^a-zA-Z]/g)[0];
	const typeBgLight = "bg-100-" + type.replace(/[^a-zA-Z]/g, " bg-100-");
	const typeBg = "bg-" + type.replace(/[^a-zA-Z]/g, " bg-");

	return (
		<>
			<Header />
			<>
				<div className="poke-preview" style={{
					backgroundImage: `url(${store.capture.image})`,
				}}>

				</div>
				<div className="poke-info">
					<div className="title">
						{store.capture.object}
					</div>

					<div
						className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mt-2 mb-2 font-medium bg-${firstType}`}
					>
						<span className="inline-flex align-center content-center rounded-full w-4 h-6">
							<img src={`/${firstType}-icon.svg`} width="100%" />
						</span>
						{store.capture.type}
					</div>

					<div className="flex gap-2 mb-2">
						<button
							onClick={replay}
							disabled={voiceLoading}
							className="inline-flex items-center px-4 py-2 leading-6 text-sm shadow rounded-full text-white bg-red-500 hover:bg-red-600 transition ease-in-out duration-150"
						>
							{voiceLoading ? 'Loading...' : 'Replay'}
						</button>
						<button
							onClick={stopAudio}
							className="inline-flex items-center px-4 py-2 leading-6 text-sm shadow rounded-full text-white bg-gray-500 hover:bg-gray-600 transition ease-in-out duration-150"
						>
							Mute
						</button>
					</div>

					<div className="description"
						dangerouslySetInnerHTML={{
							__html: (store.capture.description || '')
								.replace(/(\*\*)?Pok[eÃ©]mon:[^\n]*(\*\*)?\s*\n*/i, '')
								.replace(/Pokemon/g, 'PokÃ©mon')
								.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
								.replace(/\n\n/g, '<br><br>')
								.replace(/\n/g, '<br>')
						}}
					/>

					<div className="stats divide-y mb-2">
						<div className="stat p-2">
							<div className="stat-icon w-8"><IconSeen /></div>
							<div className="stat-attr w-24">Seen</div>
							<div className="stat-value">{store.capture.seen || 1}</div>
						</div>
						<div className="stat p-2">
							<div className="stat-icon w-8"><IconCaptured /></div>
							<div className="stat-attr w-24">Captured</div>
							<div className="stat-value flex items-center gap-2">
								<input type="checkbox" checked={captured} onChange={(e) => { setCaptured(e.target.checked); saveStats('captured', e.target.checked) }} className="w-4 h-4" />
								<input type="number" value={capturedCount} onChange={(e) => { const v = parseInt(e.target.value) || 0; setCapturedCount(v); saveStats('capturedCount', v) }} className="w-12 border rounded px-1 text-center" min="0" />
							</div>
						</div>
						<div className="stat p-2">
							<div className="stat-icon w-8"><IconShiny /></div>
							<div className="stat-attr w-24">Shiny</div>
							<div className="stat-value flex items-center gap-2">
								<input type="checkbox" checked={shiny} onChange={(e) => { setShiny(e.target.checked); saveStats('shiny', e.target.checked) }} className="w-4 h-4" />
								<input type="number" value={shinyCount} onChange={(e) => { const v = parseInt(e.target.value) || 0; setShinyCount(v); saveStats('shinyCount', v) }} className="w-12 border rounded px-1 text-center" min="0" />
							</div>
						</div>
					</div>

					<div className="stats divide-y">
						<div className="stat p-2">
							<div className="stat-icon w-8"><IconSpecies /></div>
							<div className="stat-attr w-24">Species</div>
							<div className="stat-value">{store.capture.species}</div>
						</div>
						<div className="stat p-2">
							<div className="stat-icon w-8"><IconWeight /></div>
							<div className="stat-attr w-24">Weight</div>
							<div className="stat-value">{store.capture.approximateWeight}</div>
						</div>
						<div className="stat p-2">
							<div className="stat-icon w-8"><IconHeight /></div>
							<div className="stat-attr w-24">Height</div>
							<div className="stat-value ">{store.capture.approximateHeight}</div>
						</div>
						<div className="stat p-2">
							<div className="stat-icon w-8"><IconSpeed /></div>
							<div className="stat-attr w-24">Speed</div>
							<div className="stat-value">{store.capture.speed}</div>
						</div>
						<div className="stat p-2">
							<div className="stat-icon w-8"><IconHP /></div>
							<div className="stat-attr w-24">HP</div>
							<div className="stat-value">{store.capture.hp}</div>
						</div>
						<div className="stat p-2">
							<div className="stat-icon w-8"><IconAttack /></div>
							<div className="stat-attr w-24">Attack</div>
							<div className="stat-value ">{store.capture.attack}</div>
						</div>
						<div className="stat p-2">
							<div className="stat-icon w-8"><IconDefense /></div>
							<div className="stat-attr w-24">Defense</div>
							<div className="stat-value">{store.capture.defense}</div>
						</div>
					</div>

					<div className="stat-graph">
						<Radar
							options={{
								scales: {
									r: {
										suggestedMin: 0,
										suggestedMax: 50
									}
								},

							}}
							data={{
								label: '',
								labels: [
									'HP',
									'Attack',
									'Defense',
									'Speed',
									'Height',
									'Weight',
								],
								datasets: [{
									label: '',
									data: [
										parseInt(store.capture.hp),
										parseInt(store.capture.attack),
										parseInt(store.capture.defense),
										parseInt(store.capture.speed),
										parseInt(store.capture.height),
										parseInt(store.capture.weight),
									],
									backgroundColor: 'rgba(255, 99, 132, 0.2)',
									borderColor: 'rgba(255, 99, 132, 1)',
									borderWidth: 1,
								}]
							}}
						/>
					</div>

					<div className="flex justify-center cursor-pointer" onClick={()=> store.deletePokemon(store.entry)}>
						<img src={ButtonDelete.src} width="320" />
					</div>

				</div>

			</>

			<Footer />
		</>
	);
});

const IconHP = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>

const IconAttack = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/></svg>

const IconDefense = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>

const IconSpeed = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>

const IconSpecies = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/></svg>

const IconWeight = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z"/></svg>

const IconHeight = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>

const IconSeen = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>

const IconCaptured = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h7"/><path d="M15 12h7"/><circle cx="12" cy="12" r="3"/></svg>

const IconShiny = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>

export default Pokedex;
