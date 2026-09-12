// ==UserScript==
// @name        Better Redbar
// @namespace   Violentmonkey Scripts
// @match       https://redbarradio.net/*
// @grant       none
// @version     1.0
// @author      Matthew Daniel Murphy
// @description better redbar
// ==/UserScript==

const $ = (q) => document.querySelector(q)

window.onload = async () => {
	addStyles()
	const paragraphs = document.querySelectorAll('.post-contents p')
	console.log(paragraphs)
	paragraphs.forEach((p, i) => {
		if (i === 0) return
		p.innerText = p.innerText.replaceAll(' / ', '\n')
	})
	const iframe = await getIFrame()
	const iframeDocument = iframe.contentWindow.document
	const i$ = (q) => iframeDocument.querySelector(q)
	const video = i$('video')
	window.video = video // make accessible from web console

	// Remember playback position
	const episodeURI = window.location.pathname
	const existingTimeStamp = window.localStorage.getItem(episodeURI)
	console.log(episodeURI)
	console.log('existingTimeStamp', existingTimeStamp)
	if (existingTimeStamp) video.currentTime = existingTimeStamp
	else window.localStorage.setItem(episodeURI, video.currentTime)
	video.addEventListener('timeupdate', (e) => {
		window.localStorage.setItem(episodeURI, e.target.currentTime)
	})

	keyboardControls()

	// create skip forward/back buttons
	const skipButtons = document.createElement('div')
	skipButtons.style.cssText = 'display: flex; font-size: .75rem;'
	const adjustments = [-5, -15, -60, 5, 15, 60, 60 * 5, 60 * 15]
	adjustments.forEach((time) => {
		skipButtons.innerHTML += `\n<button style="padding: 0 .1rem;" onClick="document.getElementsByTagName('video')[0].currentTime += ${time}">${
			time > 0 ? '+' : ''
		}${time >= 60 ? time / 60 + 'm' : time + 's'}</button>`
	})

	iframe.style.position = 'fixed'
	iframe.style.left = '0'
	iframe.style.top = '0'
	iframe.style.bottom = '0'
	iframe.style.width = 'calc(100dvw - .55rem)'
	iframe.style.height = '100dvh'
	iframe.style.maxHeight = '100vh'
	iframe.style.zIndex = '999'
	iframe.style.border = '.3rem solid black'
	$('body').style.opacity = 1
	i$('html').style.height = '100vh'
	i$('body').style.height = '100vh'
	i$('video-js').style.marginTop =
		'calc((100dvh - (100dvw * 9 / 16) - .6rem) / 2)'
	console.log($('.post-contents > p').innerText.split('/ ').join('\n'))

	video.addEventListener('canplay', () => {
		const controlBar = i$('.vjs-custom-control-spacer')
		controlBar.insertAdjacentElement('beforeend', skipButtons)

		iframeDocument
			.querySelectorAll('.vjs-chromecast-button')
			.forEach((el) => el.remove())
	})

	let firstPlayback = true
	selectMaxRes()

	function selectMaxRes() {
		video.addEventListener('play', () => {
			if (firstPlayback) {
				firstPlayback = false
				setTimeout(() => {
					i$('li[data-height="1440"]').click() // Select 1440p
				}, 0)
			}
		})
	}

	function keyboardControls() {
		const goBack = (s = 5) => Math.max((video.currentTime -= s), 0)
		const goForward = (s = 5) => (video.currentTime += s)
		const nextEpisode = () => {
			const pathName = document.location.pathname
			const pageName = pathName.match(/([^\/]*)$/)[1]
			const normalEpMatch = pageName.match(/s\d\d-e\d\d/)
			let videoID

			if (normalEpMatch[0]) {
				videoID = 'REDBAR-' + normalEpMatch[0].toUpperCase()
				const episodeNumber = normalEpMatch[0].match(/e(\d\d)/)[1]
				console.log('ep number is ', episodeNumber)
				const newPathname = pathName.replace(
					/(s\d\d-e)\d\d/,
					'$1' + (Number(episodeNumber) + 1),
				)
				document.location.pathname = newPathname
			} else {
				videoID = pageName.toUpperCase()
			}
		}
		let autoRewindCooldownActive = false
		let videoPlaying = false
		video.addEventListener('playing', () => (videoPlaying = true))
		video.addEventListener('pause', () => (videoPlaying = false))
		video.addEventListener('ended', () => {
			confirm('Episode ended. Proceed to next?') && nextEpisode()
		})
		let autoRewindCooldownTimeoutID

		function handleSpace(e) {
			e.preventDefault()
			if (videoPlaying) pause()
			else play()

			function play() {
				video.play()
				console.log('play')
				if (!autoRewindCooldownActive) {
					video.currentTime -= 3
				}
			}
			function pause() {
				video.pause()
				console.log('pause')
				autoRewindCooldownActive = true
				if (autoRewindCooldownTimeoutID)
					clearTimeout(autoRewindCooldownTimeoutID)
				autoRewindCooldownTimeoutID = setTimeout(() => {
					console.log('cooldown disabled, cooldownActive = false')
					autoRewindCooldownActive = false
				}, 2000)
			}
		}

		iframeDocument.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowRight') goForward()
			if (e.key === 'ArrowLeft') goBack()
			if (e.key === ' ') handleSpace(e)
		})
		document.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowRight') goForward()
			if (e.key === 'ArrowLeft') goBack()
			if (e.key === ' ') handleSpace(e)
		})
	}
}

function addStyles() {
	const style = document.createElement('style')
	document.head.appendChild(style)
	style.innerHTML = `
		@media (prefers-color-scheme: dark) {
			body, #content {
				background-color: black;
				color: white;
			}
		}
		hr {
			display: none;
		}
		.video-js .vjs-chromecast-button {
			display: none;
		}
		iframe[src^="https://redbarradio.net/embed/vod2?id="] {
			width: 100vw;
			height: 100vh;
			position: fixed;
			left: 0;
			top: 0;
			z-index: 999;
		}
		body {
			opacity: 0;
		}
		html {
			height: 100%;
			background: black;
		}
		`
}

function createIFrame(videoID) {
	const iframe = document.createElement('iframe')
	iframe.src = '/embed/vod2?id=' + videoID
	iframe.allow = 'fullscreen'
	return iframe
}

async function getIFrame() {
	let ogIFrame = $('#content .post .post-contents iframe')
	if (ogIFrame) return ogIFrame
	else {
		const pathName = document.location.pathname
		const pageName = pathName.match(/([^\/]*)$/)[1]
		const normalEpMatch = pageName.match(/s\d\d-e\d\d/)
		const videoID = normalEpMatch
			? 'REDBAR-' + normalEpMatch[0].toUpperCase()
			: pageName.toUpperCase()

		const newIFrame = createIFrame(videoID)
		$('.post-contents').insertAdjacentElement('afterbegin', newIFrame)
		return await new Promise(
			async (resolve) =>
				newIFrame.addEventListener('load', () => resolve(newIFrame)), // return newIFrame once it's loaded
		)
	}
}
