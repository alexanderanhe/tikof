let skip = 2;
const options = {
  root: null,
  rootMargin: '0px',
  threshold: 0.9
}

const observer = new window.IntersectionObserver((entries) => {
  entries
    ?.forEach(entry => {
      const { target, isIntersecting } = entry
      target._handleIntersect(isIntersecting)
      isIntersecting && window.history.pushState({}, "", `/v/${target.parentElement.dataset.id}`)
    })
}, options);

const section = document.querySelector("section");
const prevItem = (item) => {
  const next = item.previousElementSibling
  if (next) {
    const top = next.offsetTop;
    section.scrollTo({ top: top, behavior:"smooth" });
  }
}
const nextItem = (item) => {
  const next = item.nextElementSibling
  if (next) {
    const top = next.offsetTop;
    section.scrollTo({ top: top, behavior:"smooth" });
  }
}
const initVideoPlayer = (videoContainer) => {
  // const videoContainer = document.querySelector(".video-container")
  const playPauseBtn = videoContainer.querySelector(".play-pause-btn")
  // const theaterBtn = videoContainer.querySelector(".theater-btn")
  const fullScreenBtn = videoContainer.querySelector(".full-screen-btn")
  const miniPlayerBtn = videoContainer.querySelector(".mini-player-btn")
  const muteBtn = videoContainer.querySelector(".mute-btn")
  const captionsBtn = videoContainer.querySelector(".captions-btn")
  const speedBtn = videoContainer.querySelector(".speed-btn")
  const currentTimeElem = videoContainer.querySelector(".current-time")
  const totalTimeElem = videoContainer.querySelector(".total-time")
  const previewImg = videoContainer.querySelector(".preview-img")
  const thumbnailImg = videoContainer.querySelector(".thumbnail-img")
  const volumeSlider = videoContainer.querySelector(".volume-slider")
  const timelineContainer = videoContainer.querySelector(".timeline-container")
  const video = videoContainer.querySelector("video")


  const videoId = video.parentElement.dataset.id;

  video._handleIntersect = (isIntersecting) => {
    isIntersecting ? video.play() : video.pause()
    video.parentElement.classList.toggle("current", isIntersecting);
  };
  observer?.observe(video);

  document.addEventListener("keydown", e => {
    const tagName = document.activeElement.tagName.toLowerCase()

    if (tagName === "input") return
    if (video.paused) return

    switch (e.key.toLowerCase()) {
      case " ":
        if (tagName === "button") return
      case "k":
        togglePlay()
        break
      case "f":
        toggleFullScreenMode()
        break
      case "t":
        toggleTheaterMode()
        break
      case "i":
        toggleMiniPlayerMode()
        break
      case "m":
        toggleMute()
        break
      case "arrowleft":
      case "j":
        skip(-5)
        break
      case "arrowright":
      case "l":
        skip(5)
        break
      case "c":
        toggleCaptions()
        break
    }
  })

  // Timeline
  timelineContainer.addEventListener("mousemove", handleTimelineUpdate)
  timelineContainer.addEventListener("mousedown", toggleScrubbing)
  videoContainer.addEventListener("mouseup", e => {
    if (isScrubbing) toggleScrubbing(e)
  })
  videoContainer.addEventListener("mousemove", e => {
    if (isScrubbing) handleTimelineUpdate(e)
  })

  let isScrubbing = false
  let wasPaused
  function toggleScrubbing(e) {
    const rect = timelineContainer.getBoundingClientRect()
    const percent = Math.min(Math.max(0, e.x - rect.x), rect.width) / rect.width
    isScrubbing = (e.buttons & 1) === 1
    videoContainer.classList.toggle("scrubbing", isScrubbing)
    if (isScrubbing) {
      wasPaused = video.paused
      video.pause()
    } else {
      video.currentTime = percent * video.duration
      if (!wasPaused) video.play()
    }

    handleTimelineUpdate(e)
  }

  function handleTimelineUpdate(e) {
    const rect = timelineContainer.getBoundingClientRect()
    const percent = isNaN(Math.min(Math.max(0, e.x - rect.x), rect.width) / rect.width)
      ? 0 : Math.min(Math.max(0, e.x - rect.x), rect.width) / rect.width
    const previewImgNumber = Math.max(
      1,
      Math.floor((percent * video.duration) / 10)
    )
    // console.log({previewImgNumber})
    const previewImgSrc = `/thumbnails/${videoId}/thumbnail-${previewImgNumber}.jpg`
    previewImg.src = previewImgSrc
    timelineContainer.style.setProperty("--preview-position", percent)

    if (isScrubbing) {
      e.preventDefault()
      thumbnailImg.src = previewImgSrc
      timelineContainer.style.setProperty("--progress-position", percent)
    }
  }

  // Playback Speed
  speedBtn.addEventListener("click", changePlaybackSpeed)

  function changePlaybackSpeed() {
    let newPlaybackRate = video.playbackRate + 0.25
    if (newPlaybackRate > 2) newPlaybackRate = 0.25
    video.playbackRate = newPlaybackRate
    speedBtn.textContent = `${newPlaybackRate}x`
  }

  // Captions
  if (video.textTracks.length) {
    const captions = video.textTracks[0]
    captions.mode = "hidden"

    captionsBtn.addEventListener("click", toggleCaptions)
    
    function toggleCaptions() {
      const isHidden = captions.mode === "hidden"
      captions.mode = isHidden ? "showing" : "hidden"
      videoContainer.classList.toggle("captions", isHidden)
    }
  } else {
    captionsBtn.style.display = "none"
  }


  // Duration
  video.addEventListener("loadeddata", () => {
    totalTimeElem.textContent = formatDuration(video.duration)
  })

  video.addEventListener("timeupdate", () => {
    currentTimeElem.textContent = formatDuration(video.currentTime)
    const percent = video.currentTime / video.duration
    timelineContainer.style.setProperty("--progress-position", isNaN(percent) ? 0 : percent)
  })

  const leadingZeroFormatter = new Intl.NumberFormat(undefined, {
    minimumIntegerDigits: 2,
  })
  function formatDuration(time) {
    const seconds = Math.floor(time % 60)
    const minutes = Math.floor(time / 60) % 60
    const hours = Math.floor(time / 3600)
    if (hours === 0) {
      return `${minutes}:${leadingZeroFormatter.format(seconds)}`
    } else {
      return `${hours}:${leadingZeroFormatter.format(
        minutes
      )}:${leadingZeroFormatter.format(seconds)}`
    }
  }

  function skip(duration) {
    video.currentTime += duration
  }

  // Volume
  muteBtn.addEventListener("click", toggleMute)
  volumeSlider.addEventListener("input", e => {
    video.volume = e.target.value
    video.muted = e.target.value === 0
  })

  function toggleMute() {
    video.muted = !video.muted
  }

  video.addEventListener("volumechange", () => {
    volumeSlider.value = video.volume
    let volumeLevel
    if (video.muted || video.volume === 0) {
      volumeSlider.value = 0
      volumeLevel = "muted"
    } else if (video.volume >= 0.5) {
      volumeLevel = "high"
    } else {
      volumeLevel = "low"
    }

    videoContainer.dataset.volumeLevel = volumeLevel
  })

  // View Modes
  // theaterBtn.addEventListener("click", toggleTheaterMode)
  fullScreenBtn.addEventListener("click", toggleFullScreenMode)
  miniPlayerBtn.addEventListener("click", toggleMiniPlayerMode)

  // function toggleTheaterMode() {
  //   videoContainer.classList.toggle("theater")
  // }

  function toggleFullScreenMode() {
    if (document.fullscreenElement == null) {
      videoContainer.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  function toggleMiniPlayerMode() {
    if (videoContainer.classList.contains("mini-player")) {
      document.exitPictureInPicture()
    } else {
      video.requestPictureInPicture()
    }
  }

  document.addEventListener("fullscreenchange", () => {
    videoContainer.classList.toggle("full-screen", document.fullscreenElement)
  })

  video.addEventListener("enterpictureinpicture", () => {
    videoContainer.classList.add("mini-player")
  })

  video.addEventListener("leavepictureinpicture", () => {
    videoContainer.classList.remove("mini-player")
  })

  // Play/Pause
  playPauseBtn.addEventListener("click", togglePlay)
  video.addEventListener("click", togglePlay)

  function togglePlay() {
    video.paused ? video.play() : video.pause()
  }

  video.addEventListener("play", () => {
    videoContainer.classList.remove("paused")
  })

  video.addEventListener("pause", () => {
    videoContainer.classList.add("paused")
    videoContainer.classList.toggle("waiting", false);
  })
  video.addEventListener("waiting", () => {
    videoContainer.classList.toggle("waiting", video.readyState < 3)
  });
  video.addEventListener("playing", () => {
    videoContainer.classList.toggle("waiting", video.readyState < 3)
  });

  video.addEventListener("ended", () => {
    videoContainer.classList.add("ended")
    if (video.parentElement.nextElementSibling) {
      nextItem(video.parentElement)
    }
  })
};
document.querySelectorAll(".video-container").forEach(initVideoPlayer);

const initImagePlayer = (imageContainer) => {
  const image = imageContainer.querySelector("img")

  observer?.observe(image)
  let timer;
  image._handleIntersect = (isIntersecting) => {
    image.parentElement.classList.toggle("current", isIntersecting);
    if (isIntersecting) {
      timer = setTimeout(() => {
        if (image.parentElement.nextElementSibling) {
          nextItem(image.parentElement)
        }
      }, 10000);
    } else {
      clearTimeout(timer);
    }
  }
  image.addEventListener("error", () => {
    image.parentElement.classList.add('error')
  }, true);
}
document.querySelectorAll(".image-container").forEach(initImagePlayer);

const handleScrollend = async () => {
  const scrollRest = section.scrollHeight - section.scrollTop - section.clientHeight;
  if (scrollRest < 100 && section.dataset.loading !== "true") {
    try {
      section.dataset.loading = true;
      const request = await fetch(`/api?skip=${skip}&limit=10`);
      const data = await request.json();
      if (data.length === 0) {
        section.removeEventListener("scrollend", handleScrollend);
        return;
      };
      skip += 10;
      data.forEach(async ({ fileName, typef }) => {
        const html = await fetch(`/static/${typef}-container?file=${fileName}`);
        const templateText = await html.text();
        const template = document.createElement('template');
        template.innerHTML = templateText;
        if (typef == "video") {
          initVideoPlayer(template.content.querySelector(".video-container"));
        } else {
          initImagePlayer(template.content.querySelector(".image-container"));
        }
        section.appendChild(template.content);
      });
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => section.dataset.loading = false, 1000);
    }
  }
}
section.addEventListener("scrollend", handleScrollend);