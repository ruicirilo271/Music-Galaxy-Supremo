const LS = {
  playlists: "sd_supremo_playlists_v1",
  favorites: "sd_supremo_favorites_v1",
  history: "sd_supremo_history_v1",
  settings: "sd_supremo_settings_v1",
};

const state = {
  currentArtist: null,
  albums: [],
  visibleAlbums: [],
  currentAlbum: null,
  currentTracks: [],
  visibleTracks: [],
  queue: [],
  queueIndex: -1,
  repeatMode: "off", // off | all | one
  youtubePlayer: null,
  youtubeReady: false,
  currentCandidates: [],
  candidateIndex: 0,
  playlists: loadJson(LS.playlists, {}),
  activePlaylistName: null,
  favorites: loadJson(LS.favorites, []),
  history: loadJson(LS.history, []),
  settings: loadJson(LS.settings, { volume: 85 }),
  isPlaying: false,
  activeLibraryTab: "favorites",
  activeDrawerTab: "queue",
  progressTimer: null,
  cinemaActive: false,
};

const el = {
  artistForm: document.getElementById("artistForm"),
  artistInput: document.getElementById("artistInput"),
  healthDot: document.getElementById("healthDot"),
  healthText: document.getElementById("healthText"),
  messageBox: document.getElementById("messageBox"),

  artistsGrid: document.getElementById("artistsGrid"),
  artistsCount: document.getElementById("artistsCount"),

  albumsTitle: document.getElementById("albumsTitle"),
  albumsGrid: document.getElementById("albumsGrid"),
  albumFilter: document.getElementById("albumFilter"),
  albumSort: document.getElementById("albumSort"),

  tracksTitle: document.getElementById("tracksTitle"),
  tracksList: document.getElementById("tracksList"),
  albumInfo: document.getElementById("albumInfo"),
  trackFilter: document.getElementById("trackFilter"),
  playAlbumBtn: document.getElementById("playAlbumBtn"),
  shuffleAlbumBtn: document.getElementById("shuffleAlbumBtn"),
  addSelectedBtn: document.getElementById("addSelectedBtn"),

  statPlaylists: document.getElementById("statPlaylists"),
  statFavorites: document.getElementById("statFavorites"),
  statHistory: document.getElementById("statHistory"),

  playlistSelector: document.getElementById("playlistSelector"),
  activePlaylistPanel: document.getElementById("activePlaylistPanel"),
  newPlaylistBtn: document.getElementById("newPlaylistBtn"),
  libraryPanel: document.getElementById("libraryPanel"),

  nowTitle: document.getElementById("nowTitle"),
  nowArtist: document.getElementById("nowArtist"),
  nowYoutube: document.getElementById("nowYoutube"),
  videoPlaceholder: document.getElementById("videoPlaceholder"),
  videoHome: document.querySelector(".video-shell"),
  footerPlayer: document.getElementById("footerPlayer"),

  prevBtn: document.getElementById("prevBtn"),
  toggleBtn: document.getElementById("toggleBtn"),
  nextBtn: document.getElementById("nextBtn"),
  repeatBtn: document.getElementById("repeatBtn"),
  queueBtn: document.getElementById("queueBtn"),
  cinemaBtn: document.getElementById("cinemaBtn"),
  volumeRange: document.getElementById("volumeRange"),

  queuePosition: document.getElementById("queuePosition"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  seekBar: document.getElementById("seekBar"),
  progressFill: document.getElementById("progressFill"),

  rightDrawer: document.getElementById("rightDrawer"),
  closeDrawerBtn: document.getElementById("closeDrawerBtn"),
  drawerTitle: document.getElementById("drawerTitle"),
  drawerContent: document.getElementById("drawerContent"),

  cinemaOverlay: document.getElementById("cinemaOverlay"),
  closeCinemaBtn: document.getElementById("closeCinemaBtn"),
  cinemaTitle: document.getElementById("cinemaTitle"),
  cinemaSubtitle: document.getElementById("cinemaSubtitle"),
};

document.addEventListener("DOMContentLoaded", boot);

function boot() {
  checkHealth();
  setupEvents();
  renderPlaylists();
  renderLibrary();
  updateStats();
  updateQueueUI();
  clearTracksOnly();
  el.volumeRange.value = state.settings.volume ?? 85;
}

function setupEvents() {
  el.artistForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = el.artistInput.value.trim();
    if (!query) return showMessage("Escreve o nome de um artista.", "warn");
    searchArtists(query);
  });

  document.querySelectorAll(".quick-artist").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.artistInput.value = btn.dataset.artist;
      searchArtists(btn.dataset.artist);
    });
  });

  el.albumFilter.addEventListener("input", renderFilteredAlbums);
  el.albumSort.addEventListener("change", renderFilteredAlbums);
  el.trackFilter.addEventListener("input", renderFilteredTracks);

  el.playAlbumBtn.addEventListener("click", () => {
    if (!state.currentTracks.length) return;
    setQueue(state.currentTracks, 0);
    playQueueIndex(0);
  });

  el.shuffleAlbumBtn.addEventListener("click", () => {
    if (!state.currentTracks.length) return;
    const shuffled = shuffle([...state.currentTracks]);
    setQueue(shuffled, 0);
    playQueueIndex(0);
  });

  el.addSelectedBtn.addEventListener("click", addSelectedTracksToPlaylist);

  el.newPlaylistBtn.addEventListener("click", createPlaylist);
  el.prevBtn.addEventListener("click", playPrevious);
  el.nextBtn.addEventListener("click", playNext);
  el.toggleBtn.addEventListener("click", togglePlayPause);

  el.repeatBtn.addEventListener("click", cycleRepeat);
  el.queueBtn.addEventListener("click", () => openDrawer("queue"));
  el.closeDrawerBtn.addEventListener("click", closeDrawer);

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      tab.classList.add("active");
      state.activeLibraryTab = tab.dataset.tab;
      renderLibrary();
    });
  });

  document.querySelectorAll(".drawer-tab").forEach((tab) => {
    tab.addEventListener("click", () => openDrawer(tab.dataset.drawer));
  });

  el.volumeRange.addEventListener("input", () => {
    const volume = Number(el.volumeRange.value);
    state.settings.volume = volume;
    saveJson(LS.settings, state.settings);
    if (state.youtubeReady && state.youtubePlayer?.setVolume) {
      state.youtubePlayer.setVolume(volume);
    }
  });

  el.seekBar.addEventListener("click", (event) => {
    if (!state.youtubeReady || !state.youtubePlayer?.seekTo) return;
    const duration = state.youtubePlayer.getDuration?.() || 0;
    if (!duration) return;
    const rect = el.seekBar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    state.youtubePlayer.seekTo(duration * ratio, true);
  });

  el.cinemaBtn.addEventListener("click", openCinema);
  el.closeCinemaBtn.addEventListener("click", closeCinema);
  el.cinemaOverlay.addEventListener("click", (event) => {
    if (event.target === el.cinemaOverlay) closeCinema();
  });

  document.addEventListener("keydown", handleHotkeys);
}

function onYouTubeIframeAPIReady() {
  state.youtubePlayer = new YT.Player("youtube-player", {
    height: "112",
    width: "200",
    playerVars: {
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      controls: 1,
      disablekb: 0,
    },
    events: {
      onReady: () => {
        state.youtubeReady = true;
        state.youtubePlayer.setVolume(Number(el.volumeRange.value || 85));
        startProgressTimer();
      },
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
}

window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

async function checkHealth() {
  try {
    const data = await api("/api/health");
    el.healthText.textContent = data.youtube_api_key_ready
      ? `YouTube API pronta · iTunes país: ${data.itunes_country}`
      : "Falta YOUTUBE_API_KEY no ambiente.";
    el.healthDot.className = data.youtube_api_key_ready ? "dot ok" : "dot warn";
  } catch {
    el.healthText.textContent = "Backend indisponível.";
    el.healthDot.className = "dot warn";
  }
}

async function searchArtists(query) {
  showMessage("A procurar artistas no iTunes...", "info");
  clearAlbumsAndTracks();
  el.artistsGrid.innerHTML = skeletonCards(8);
  el.artistsCount.textContent = "…";

  try {
    const data = await api(`/api/search-artists?q=${encodeURIComponent(query)}`);
    el.artistsGrid.innerHTML = "";
    el.artistsCount.textContent = data.artists.length;

    if (!data.artists.length) {
      el.artistsGrid.innerHTML = emptyState(`Não encontrei artistas para “${escapeHtml(query)}”.`);
      showMessage("Tenta outro nome de artista.", "warn");
      return;
    }

    data.artists.forEach((artist) => {
      const card = document.createElement("button");
      card.className = "artist-card";
      card.innerHTML = `
        <span class="artist-orb">${initials(artist.artistName)}</span>
        <strong>${escapeHtml(artist.artistName)}</strong>
        <small>${escapeHtml(artist.primaryGenreName || "Music")}</small>
        <em>Ver álbuns</em>
      `;
      card.addEventListener("click", () => loadAlbums(artist));
      el.artistsGrid.appendChild(card);
    });

    showMessage(`Encontrei ${data.artists.length} artista(s).`, "success");
  } catch (error) {
    el.artistsGrid.innerHTML = "";
    el.artistsCount.textContent = "0";
    showMessage(error.message, "error");
  }
}

async function loadAlbums(artist) {
  state.currentArtist = artist;
  state.currentAlbum = null;
  state.currentTracks = [];
  state.albums = [];
  state.visibleAlbums = [];
  el.albumsTitle.textContent = `Álbuns de ${artist.artistName}`;
  el.albumsGrid.innerHTML = skeletonCards(10);
  clearTracksOnly();
  showMessage(`A buscar álbuns de ${artist.artistName} no iTunes...`, "info");

  try {
    const data = await api(`/api/artist/${artist.artistId}/albums`);
    state.albums = data.albums || [];
    state.visibleAlbums = [...state.albums];

    el.albumFilter.disabled = false;
    el.albumSort.disabled = false;
    el.albumFilter.value = "";
    el.albumSort.value = "newest";

    renderFilteredAlbums();

    if (!state.albums.length) {
      showMessage("Sem álbuns encontrados no iTunes.", "warn");
      return;
    }

    showMessage(`${state.albums.length} álbum/álbuns carregados.`, "success");
  } catch (error) {
    el.albumsGrid.innerHTML = "";
    showMessage(error.message, "error");
  }
}

function renderFilteredAlbums() {
  const term = normalizeClient(el.albumFilter.value);
  const sort = el.albumSort.value;

  let albums = [...state.albums].filter((album) => {
    if (!term) return true;
    return normalizeClient(`${album.collectionName} ${album.releaseYear} ${album.primaryGenreName}`).includes(term);
  });

  if (sort === "oldest") albums.sort((a, b) => String(a.releaseDate || "").localeCompare(String(b.releaseDate || "")));
  if (sort === "newest") albums.sort((a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")));
  if (sort === "az") albums.sort((a, b) => String(a.collectionName || "").localeCompare(String(b.collectionName || "")));
  if (sort === "tracks") albums.sort((a, b) => Number(b.trackCount || 0) - Number(a.trackCount || 0));

  state.visibleAlbums = albums;
  renderAlbums();
}

function renderAlbums() {
  el.albumsGrid.innerHTML = "";

  if (!state.visibleAlbums.length) {
    el.albumsGrid.innerHTML = emptyState("Nenhum álbum corresponde ao filtro.");
    return;
  }

  state.visibleAlbums.forEach((album) => {
    const card = document.createElement("button");
    card.className = "album-card";
    card.innerHTML = `
      <img src="${album.artworkUrl100 || defaultCover()}" alt="">
      <span class="album-shine"></span>
      <span class="album-year">${escapeHtml(album.releaseYear || "—")}</span>
      <strong>${escapeHtml(album.collectionName)}</strong>
      <small>${escapeHtml(album.trackCount || "?")} faixas · ${escapeHtml(album.primaryGenreName || "Music")}</small>
    `;
    card.addEventListener("click", () => loadTracks(album));
    el.albumsGrid.appendChild(card);
  });
}

async function loadTracks(album) {
  state.currentAlbum = album;
  state.currentTracks = [];
  state.visibleTracks = [];
  el.tracksTitle.textContent = album.collectionName;
  el.tracksList.innerHTML = skeletonTracks(11);
  el.albumInfo.classList.add("hidden");
  setTrackControls(false);
  showMessage(`A buscar faixas de “${album.collectionName}” no iTunes...`, "info");

  try {
    const data = await api(`/api/album/${album.collectionId}/tracks`);
    state.currentTracks = (data.tracks || []).map((track) => ({
      ...track,
      uid: makeTrackUid(track),
      artworkUrl100: track.artworkUrl100 || album.artworkUrl100,
    }));
    state.visibleTracks = [...state.currentTracks];

    renderAlbumInfo(data.album || album);
    el.trackFilter.disabled = false;
    el.trackFilter.value = "";
    renderFilteredTracks();

    if (!state.currentTracks.length) {
      showMessage("Este álbum não devolveu faixas no iTunes.", "warn");
      return;
    }

    setTrackControls(true);
    showMessage(`${state.currentTracks.length} música(s) carregadas.`, "success");
  } catch (error) {
    el.tracksList.innerHTML = "";
    showMessage(error.message, "error");
  }
}

function renderAlbumInfo(album) {
  el.albumInfo.classList.remove("hidden");
  el.albumInfo.innerHTML = `
    <img src="${album.artworkUrl100 || defaultCover()}" alt="">
    <div>
      <strong>${escapeHtml(album.collectionName || "Álbum")}</strong>
      <span>${escapeHtml(album.artistName || "")}</span>
      <small>${escapeHtml(album.releaseDate || "Sem data")} · ${escapeHtml(album.primaryGenreName || "Music")}</small>
    </div>
    <button class="ghost-btn" id="albumToPlaylistBtn">Adicionar álbum à playlist</button>
  `;

  document.getElementById("albumToPlaylistBtn").addEventListener("click", () => {
    addTracksToActivePlaylist(state.currentTracks);
  });
}

function renderFilteredTracks() {
  const term = normalizeClient(el.trackFilter.value);
  state.visibleTracks = state.currentTracks.filter((track) => {
    if (!term) return true;
    return normalizeClient(`${track.trackName} ${track.artistName} ${track.collectionName}`).includes(term);
  });
  renderTracks();
}

function renderTracks() {
  el.tracksList.innerHTML = "";

  if (!state.visibleTracks.length) {
    el.tracksList.innerHTML = emptyState("Nenhuma música para mostrar.");
    return;
  }

  state.visibleTracks.forEach((track) => {
    const originalIndex = state.currentTracks.findIndex((item) => item.uid === track.uid);
    const isFav = isFavorite(track);
    const row = document.createElement("div");
    row.className = "track-row";
    row.innerHTML = `
      <label class="check-wrap" title="Selecionar">
        <input type="checkbox" class="track-check" data-uid="${escapeAttr(track.uid)}">
        <span></span>
      </label>
      <button class="track-main" type="button">
        <strong>${String(track.trackNumber || originalIndex + 1).padStart(2, "0")}. ${escapeHtml(track.trackName)}</strong>
        <small>${escapeHtml(track.artistName)} · ${escapeHtml(track.collectionName)} · ${escapeHtml(track.duration || "")}</small>
      </button>
      <button class="mini-btn play-track">Ouvir</button>
      <button class="mini-btn add-track">+ Playlist</button>
      <button class="mini-btn fav-track">${isFav ? "★" : "☆"}</button>
    `;

    row.querySelector(".track-main").addEventListener("click", () => {
      setQueue(state.currentTracks, Math.max(0, originalIndex));
      playQueueIndex(Math.max(0, originalIndex));
    });

    row.querySelector(".play-track").addEventListener("click", () => {
      setQueue(state.currentTracks, Math.max(0, originalIndex));
      playQueueIndex(Math.max(0, originalIndex));
    });

    row.querySelector(".add-track").addEventListener("click", () => addTracksToActivePlaylist([track]));
    row.querySelector(".fav-track").addEventListener("click", () => toggleFavorite(track));

    el.tracksList.appendChild(row);
  });
}

function setTrackControls(enabled) {
  el.playAlbumBtn.disabled = !enabled;
  el.shuffleAlbumBtn.disabled = !enabled;
  el.addSelectedBtn.disabled = !enabled;
}

function setQueue(tracks, startIndex = 0) {
  state.queue = tracks.map((track) => ({ ...track, uid: makeTrackUid(track) }));
  state.queueIndex = startIndex;
  updateQueueUI();
  renderDrawer();
}

async function playQueueIndex(index) {
  if (index < 0 || index >= state.queue.length) return;

  state.queueIndex = index;
  const track = state.queue[index];

  el.nowTitle.textContent = track.trackName;
  el.nowArtist.textContent = `${track.artistName} · ${track.collectionName || ""}`;
  el.nowYoutube.textContent = "A procurar no YouTube...";
  el.toggleBtn.textContent = "⏸";
  el.footerPlayer.classList.add("playing");
  state.isPlaying = true;
  state.currentCandidates = [];
  state.candidateIndex = 0;
  updateQueueUI();
  renderDrawer();

  try {
    const url = `/api/youtube/search?artist=${encodeURIComponent(track.artistName)}&track=${encodeURIComponent(track.trackName)}&album=${encodeURIComponent(track.collectionName || "")}`;
    const data = await api(url);

    state.currentCandidates = data.videos || [];
    state.candidateIndex = 0;

    if (!state.currentCandidates.length) {
      throw new Error("Não encontrei vídeos no YouTube para esta música.");
    }

    addToHistory(track);
    loadCurrentCandidate();
  } catch (error) {
    el.nowYoutube.textContent = error.message;
    showMessage(error.message, "error");
  }
}

function loadCurrentCandidate() {
  const candidate = state.currentCandidates[state.candidateIndex];
  if (!candidate) {
    showMessage("Todos os vídeos deram erro. A passar à próxima música.", "warn");
    playNext();
    return;
  }

  el.videoPlaceholder.style.display = "none";
  el.nowYoutube.textContent = `${candidate.title} · ${candidate.channelTitle}`;
  el.cinemaTitle.textContent = state.queue[state.queueIndex]?.trackName || candidate.title;
  el.cinemaSubtitle.textContent = `${candidate.title} · ${candidate.channelTitle}`;

  if (state.youtubeReady && state.youtubePlayer?.loadVideoById) {
    state.youtubePlayer.loadVideoById(candidate.videoId);
    state.youtubePlayer.setVolume(Number(el.volumeRange.value || 85));
    state.youtubePlayer.playVideo();
    renderDrawer();
  } else {
    setTimeout(loadCurrentCandidate, 500);
  }
}

function onPlayerStateChange(event) {
  if (!window.YT) return;

  if (event.data === YT.PlayerState.ENDED) {
    if (state.repeatMode === "one") {
      playQueueIndex(state.queueIndex);
      return;
    }
    playNext();
  }

  if (event.data === YT.PlayerState.PLAYING) {
    state.isPlaying = true;
    el.toggleBtn.textContent = "⏸";
    el.footerPlayer.classList.add("playing");
  }

  if (event.data === YT.PlayerState.PAUSED) {
    state.isPlaying = false;
    el.toggleBtn.textContent = "▶";
    el.footerPlayer.classList.remove("playing");
  }
}

function onPlayerError() {
  state.candidateIndex += 1;
  const nextCandidate = state.currentCandidates[state.candidateIndex];

  if (nextCandidate) {
    el.nowYoutube.textContent = "Vídeo indisponível. A tentar outro resultado...";
    setTimeout(loadCurrentCandidate, 650);
  } else {
    el.nowYoutube.textContent = "Vídeo indisponível. A passar à próxima música...";
    setTimeout(playNext, 900);
  }
}

function playNext() {
  if (!state.queue.length) return;
  let next = state.queueIndex + 1;

  if (next >= state.queue.length) {
    if (state.repeatMode === "all") {
      next = 0;
    } else {
      state.queueIndex = -1;
      state.isPlaying = false;
      el.toggleBtn.textContent = "▶";
      el.footerPlayer.classList.remove("playing");
      updateQueueUI();
      showMessage("Fim da fila.", "info");
      return;
    }
  }

  playQueueIndex(next);
}

function playPrevious() {
  if (!state.queue.length) return;
  const previous = state.queueIndex <= 0 ? 0 : state.queueIndex - 1;
  playQueueIndex(previous);
}

function togglePlayPause() {
  if (!state.youtubePlayer || !state.youtubeReady) return;

  if (state.isPlaying) {
    state.youtubePlayer.pauseVideo();
  } else {
    if (state.queueIndex === -1 && state.queue.length) {
      playQueueIndex(0);
    } else {
      state.youtubePlayer.playVideo();
    }
  }
}

function cycleRepeat() {
  const modes = ["off", "all", "one"];
  const next = modes[(modes.indexOf(state.repeatMode) + 1) % modes.length];
  state.repeatMode = next;

  const labels = {
    off: "Repeat off",
    all: "Repeat all",
    one: "Repeat one",
  };
  el.repeatBtn.textContent = labels[next];
}

function startProgressTimer() {
  clearInterval(state.progressTimer);
  state.progressTimer = setInterval(() => {
    if (!state.youtubeReady || !state.youtubePlayer?.getCurrentTime) return;

    const current = state.youtubePlayer.getCurrentTime() || 0;
    const duration = state.youtubePlayer.getDuration?.() || 0;
    const ratio = duration ? Math.min(100, (current / duration) * 100) : 0;

    el.progressFill.style.width = `${ratio}%`;
    el.currentTime.textContent = secondsToTime(current);
    el.durationTime.textContent = secondsToTime(duration);
  }, 650);
}

function updateQueueUI() {
  const count = state.queue.length;
  if (state.queueIndex >= 0 && count) {
    el.queuePosition.textContent = `${state.queueIndex + 1}/${count}`;
  } else {
    el.queuePosition.textContent = `${count} na fila`;
  }
}

function createPlaylist() {
  const name = prompt("Nome da nova playlist:");
  const clean = (name || "").trim();

  if (!clean) return;

  if (state.playlists[clean]) {
    showMessage("Já existe uma playlist com esse nome.", "warn");
    state.activePlaylistName = clean;
    renderPlaylists();
    return;
  }

  state.playlists[clean] = [];
  state.activePlaylistName = clean;
  saveJson(LS.playlists, state.playlists);
  renderPlaylists();
  updateStats();
  showMessage(`Playlist “${clean}” criada.`, "success");
}

function addSelectedTracksToPlaylist() {
  const checked = [...document.querySelectorAll(".track-check:checked")];
  const tracks = checked
    .map((input) => state.currentTracks.find((track) => track.uid === input.dataset.uid))
    .filter(Boolean);

  if (!tracks.length) {
    showMessage("Seleciona pelo menos uma música.", "warn");
    return;
  }

  addTracksToActivePlaylist(tracks);
  checked.forEach((input) => (input.checked = false));
}

function copyTrackToPlaylist(track, sourcePlaylistName = "") {
  const existingNames = Object.keys(state.playlists).filter((name) => name !== sourcePlaylistName);
  const existingText = existingNames.length ? existingNames.join(", ") : "nenhuma";

  const targetName = prompt(
    `Copiar para que playlist?\n\nPlaylists existentes: ${existingText}\n\nPodes escrever um nome novo para criar playlist.`
  );

  const cleanName = (targetName || "").trim();
  if (!cleanName) return;

  if (!state.playlists[cleanName]) {
    state.playlists[cleanName] = [];
  }

  const playlist = state.playlists[cleanName];
  const item = { ...track, uid: makeTrackUid(track) };
  const exists = playlist.some((saved) => makeTrackUid(saved) === item.uid);

  if (exists) {
    showMessage(`Essa música já existe na playlist “${cleanName}”.`, "warn");
  } else {
    playlist.push(item);
    showMessage(`Música copiada para “${cleanName}”.`, "success");
  }

  state.activePlaylistName = cleanName;
  saveJson(LS.playlists, state.playlists);
  renderPlaylists();
  updateStats();
}

function addTracksToActivePlaylist(tracks) {
  if (!tracks.length) return;

  if (!state.activePlaylistName) createPlaylist();
  if (!state.activePlaylistName) return;

  const playlist = state.playlists[state.activePlaylistName] || [];
  let added = 0;

  tracks.forEach((track) => {
    const item = { ...track, uid: makeTrackUid(track) };
    const exists = playlist.some((saved) => saved.uid === item.uid);
    if (!exists) {
      playlist.push(item);
      added += 1;
    }
  });

  state.playlists[state.activePlaylistName] = playlist;
  saveJson(LS.playlists, state.playlists);
  renderPlaylists();
  updateStats();

  showMessage(
    added ? `${added} música(s) adicionada(s) à playlist “${state.activePlaylistName}”.` : "Essas músicas já estão na playlist.",
    added ? "success" : "warn"
  );
}

function renderPlaylists() {
  const names = Object.keys(state.playlists);

  if (!state.activePlaylistName && names.length) {
    state.activePlaylistName = names[0];
  }

  el.playlistSelector.innerHTML = names.length
    ? ""
    : `<p class="mini-empty">Ainda não tens playlists.</p>`;

  names.forEach((name) => {
    const btn = document.createElement("button");
    btn.className = name === state.activePlaylistName ? "playlist-pill active" : "playlist-pill";
    btn.textContent = `${name} (${state.playlists[name].length})`;
    btn.addEventListener("click", () => {
      state.activePlaylistName = name;
      renderPlaylists();
    });
    el.playlistSelector.appendChild(btn);
  });

  renderActivePlaylist();
}

function renderActivePlaylist() {
  const name = state.activePlaylistName;

  if (!name) {
    el.activePlaylistPanel.innerHTML = `<p class="mini-empty">Cria uma playlist e adiciona músicas.</p>`;
    return;
  }

  const tracks = state.playlists[name] || [];

  el.activePlaylistPanel.innerHTML = `
    <div class="playlist-head">
      <strong>${escapeHtml(name)}</strong>
      <button class="danger-btn" id="deletePlaylistBtn">Apagar</button>
    </div>

    <div class="playlist-actions">
      <button class="gold-btn full" id="playPlaylistBtn" ${tracks.length ? "" : "disabled"}>Ouvir</button>
      <button class="ghost-btn full" id="shufflePlaylistBtn" ${tracks.length ? "" : "disabled"}>Shuffle</button>
      <button class="ghost-btn full" id="exportPlaylistBtn">Exportar</button>
      <button class="ghost-btn full" id="importPlaylistBtn">Importar</button>
    </div>

    <div class="playlist-tracks">
      ${
        tracks.length
          ? tracks.map((track, index) => `
            <div class="playlist-track">
              <button class="playlist-track-main" data-index="${index}" title="Ouvir esta música">
                <strong>${escapeHtml(track.trackName)}</strong>
                <small>${escapeHtml(track.artistName)} · ${escapeHtml(track.collectionName || "")}</small>
              </button>
              <button class="playlist-fav" data-index="${index}" title="Adicionar/remover favorito">${isFavorite(track) ? "★" : "☆"}</button>
              <button class="playlist-copy" data-index="${index}" title="Copiar para outra playlist">＋</button>
              <button class="remove-track" data-index="${index}" title="Remover desta playlist">×</button>
            </div>
          `).join("")
          : `<p class="mini-empty">Playlist vazia.</p>`
      }
    </div>
  `;

  document.getElementById("deletePlaylistBtn").addEventListener("click", () => {
    if (!confirm(`Apagar a playlist “${name}”?`)) return;
    delete state.playlists[name];
    state.activePlaylistName = Object.keys(state.playlists)[0] || null;
    saveJson(LS.playlists, state.playlists);
    renderPlaylists();
    updateStats();
  });

  document.getElementById("playPlaylistBtn").addEventListener("click", () => {
    setQueue(tracks, 0);
    playQueueIndex(0);
  });

  document.getElementById("shufflePlaylistBtn").addEventListener("click", () => {
    const shuffled = shuffle([...tracks]);
    setQueue(shuffled, 0);
    playQueueIndex(0);
  });

  document.getElementById("exportPlaylistBtn").addEventListener("click", () => exportPlaylist(name));
  document.getElementById("importPlaylistBtn").addEventListener("click", importPlaylist);

  el.activePlaylistPanel.querySelectorAll(".playlist-track-main").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      setQueue(tracks, index);
      playQueueIndex(index);
    });
  });

  el.activePlaylistPanel.querySelectorAll(".playlist-fav").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      const track = state.playlists[name][index];
      if (!track) return;
      toggleFavorite(track);
      renderPlaylists();
    });
  });

  el.activePlaylistPanel.querySelectorAll(".playlist-copy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      const track = state.playlists[name][index];
      if (!track) return;
      copyTrackToPlaylist(track, name);
    });
  });

  el.activePlaylistPanel.querySelectorAll(".remove-track").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      state.playlists[name].splice(index, 1);
      saveJson(LS.playlists, state.playlists);
      renderPlaylists();
      updateStats();
    });
  });
}

function exportPlaylist(name) {
  const payload = {
    app: "Music Galaxy Supremo",
    playlist: name,
    tracks: state.playlists[name] || [],
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^\wÀ-ÿ-]+/g, "_")}_playlist.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importPlaylist() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const name = (payload.playlist || file.name.replace(/\.json$/i, "") || "Playlist importada").trim();
      const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
      state.playlists[name] = tracks.map((track) => ({ ...track, uid: makeTrackUid(track) }));
      state.activePlaylistName = name;
      saveJson(LS.playlists, state.playlists);
      renderPlaylists();
      updateStats();
      showMessage(`Playlist “${name}” importada.`, "success");
    } catch (error) {
      showMessage(`Erro ao importar playlist: ${error.message}`, "error");
    }
  });
  input.click();
}

function toggleFavorite(track) {
  const uid = makeTrackUid(track);
  const index = state.favorites.findIndex((item) => item.uid === uid);

  if (index >= 0) {
    state.favorites.splice(index, 1);
    showMessage("Removido dos favoritos.", "info");
  } else {
    state.favorites.unshift({ ...track, uid, savedAt: new Date().toISOString() });
    showMessage("Adicionado aos favoritos.", "success");
  }

  saveJson(LS.favorites, state.favorites);
  renderTracks();
  renderLibrary();
  updateStats();
}

function isFavorite(track) {
  const uid = makeTrackUid(track);
  return state.favorites.some((item) => item.uid === uid);
}

function addToHistory(track) {
  const uid = makeTrackUid(track);
  state.history = state.history.filter((item) => item.uid !== uid);
  state.history.unshift({ ...track, uid, playedAt: new Date().toISOString() });
  state.history = state.history.slice(0, 80);
  saveJson(LS.history, state.history);
  renderLibrary();
  updateStats();
}

function renderLibrary() {
  const list = state.activeLibraryTab === "favorites" ? state.favorites : state.history;
  const title = state.activeLibraryTab === "favorites" ? "favoritos" : "histórico";

  if (!list.length) {
    el.libraryPanel.innerHTML = `<p class="mini-empty">Ainda não existem ${title}.</p>`;
    return;
  }

  el.libraryPanel.innerHTML = `
    <div class="library-actions">
      <button class="ghost-btn full" id="playLibraryBtn">Ouvir ${title}</button>
      <button class="danger-btn full" id="clearLibraryBtn">Limpar</button>
    </div>

    <div class="library-list">
      ${list.map((track, index) => `
        <div class="library-track">
          <button class="library-main" data-index="${index}" title="Ouvir esta música">
            <strong>${escapeHtml(track.trackName)}</strong>
            <small>${escapeHtml(track.artistName)} · ${escapeHtml(track.collectionName || "")}</small>
          </button>
          <button class="library-fav" data-index="${index}" title="Adicionar/remover favorito">${isFavorite(track) ? "★" : "☆"}</button>
          <button class="library-copy" data-index="${index}" title="Copiar para playlist">＋</button>
        </div>
      `).join("")}
    </div>
  `;

  document.getElementById("playLibraryBtn").addEventListener("click", () => {
    setQueue(list, 0);
    playQueueIndex(0);
  });

  document.getElementById("clearLibraryBtn").addEventListener("click", () => {
    if (!confirm(`Limpar ${title}?`)) return;
    if (state.activeLibraryTab === "favorites") {
      state.favorites = [];
      saveJson(LS.favorites, state.favorites);
    } else {
      state.history = [];
      saveJson(LS.history, state.history);
    }
    renderLibrary();
    updateStats();
    renderTracks();
  });

  el.libraryPanel.querySelectorAll(".library-main").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      setQueue(list, index);
      playQueueIndex(index);
    });
  });

  el.libraryPanel.querySelectorAll(".library-fav").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      const track = list[index];
      if (!track) return;
      toggleFavorite(track);
      renderLibrary();
    });
  });

  el.libraryPanel.querySelectorAll(".library-copy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      const track = list[index];
      if (!track) return;
      copyTrackToPlaylist(track, "");
    });
  });
}

function openDrawer(tab = "queue") {
  state.activeDrawerTab = tab;
  el.rightDrawer.classList.add("open");
  document.querySelectorAll(".drawer-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.drawer === tab);
  });
  renderDrawer();
}

function closeDrawer() {
  el.rightDrawer.classList.remove("open");
}

async function renderDrawer() {
  const tab = state.activeDrawerTab;
  el.drawerTitle.textContent = tab === "queue" ? "Fila" : tab === "lyrics" ? "Letra" : "Vídeos";

  if (tab === "queue") {
    renderQueueDrawer();
  } else if (tab === "lyrics") {
    await renderLyricsDrawer();
  } else {
    renderVideosDrawer();
  }
}

function renderQueueDrawer() {
  if (!state.queue.length) {
    el.drawerContent.innerHTML = `<p class="mini-empty">A fila está vazia.</p>`;
    return;
  }

  el.drawerContent.innerHTML = `
    <button class="danger-btn full" id="clearQueueBtn">Limpar fila</button>
    <div class="queue-list">
      ${state.queue.map((track, index) => `
        <button class="queue-item ${index === state.queueIndex ? "active" : ""}" data-index="${index}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(track.trackName)}</strong>
            <small>${escapeHtml(track.artistName)} · ${escapeHtml(track.collectionName || "")}</small>
          </div>
        </button>
      `).join("")}
    </div>
  `;

  document.getElementById("clearQueueBtn").addEventListener("click", () => {
    state.queue = [];
    state.queueIndex = -1;
    updateQueueUI();
    renderDrawer();
  });

  el.drawerContent.querySelectorAll(".queue-item").forEach((btn) => {
    btn.addEventListener("click", () => playQueueIndex(Number(btn.dataset.index)));
  });
}

async function renderLyricsDrawer() {
  const track = state.queue[state.queueIndex];
  if (!track) {
    el.drawerContent.innerHTML = `<p class="mini-empty">Escolhe uma música para tentar buscar letra.</p>`;
    return;
  }

  el.drawerContent.innerHTML = `<p class="mini-empty">A procurar letra...</p>`;

  try {
    const data = await api(`/api/lyrics?artist=${encodeURIComponent(track.artistName)}&track=${encodeURIComponent(track.trackName)}`);
    const lyrics = data.lyrics || data.syncedLyrics || "";
    el.drawerContent.innerHTML = lyrics
      ? `<pre class="lyrics-box">${escapeHtml(lyrics)}</pre>`
      : `<p class="mini-empty">Letra não encontrada.</p>`;
  } catch (error) {
    el.drawerContent.innerHTML = `<p class="mini-empty">Letra indisponível neste momento.<br>${escapeHtml(error.message)}</p>`;
  }
}

function renderVideosDrawer() {
  if (!state.currentCandidates.length) {
    el.drawerContent.innerHTML = `<p class="mini-empty">Ainda não há resultados de vídeo.</p>`;
    return;
  }

  el.drawerContent.innerHTML = `
    <div class="video-candidates">
      ${state.currentCandidates.map((video, index) => `
        <button class="video-card ${index === state.candidateIndex ? "active" : ""}" data-index="${index}">
          <img src="${video.thumbnail || defaultCover()}" alt="">
          <div>
            <strong>${escapeHtml(video.title)}</strong>
            <small>${escapeHtml(video.channelTitle)} · score ${escapeHtml(video.score)}</small>
          </div>
        </button>
      `).join("")}
    </div>
  `;

  el.drawerContent.querySelectorAll(".video-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.candidateIndex = Number(btn.dataset.index);
      loadCurrentCandidate();
      renderDrawer();
    });
  });
}

function openCinema() {
  if (!state.youtubeReady || !state.youtubePlayer) {
    showMessage("O player ainda não está pronto. Escolhe primeiro uma música.", "warn");
    return;
  }

  if (!state.queue[state.queueIndex] && !state.currentCandidates.length) {
    showMessage("Escolhe primeiro uma música para abrir o modo cinema.", "warn");
    return;
  }

  state.cinemaActive = true;
  document.body.classList.add("cinema-mode");
  el.cinemaOverlay.classList.remove("hidden");

  const track = state.queue[state.queueIndex];
  const candidate = state.currentCandidates[state.candidateIndex];

  el.cinemaTitle.textContent = track?.trackName || "Modo cinema";
  el.cinemaSubtitle.textContent = candidate
    ? `${candidate.title} · ${candidate.channelTitle}`
    : "O vídeo está ampliado no modo cinema.";

  // Muito importante:
  // Não movemos o iframe do YouTube no DOM, porque isso pode causar:
  // "An error occurred. Please try again later. Playback ID..."
  // Em vez disso, ampliamos visualmente o mesmo .video-shell com CSS.
  try {
    if (state.youtubePlayer.playVideo && !state.isPlaying) {
      state.youtubePlayer.playVideo();
    }
  } catch {}
}

function closeCinema() {
  state.cinemaActive = false;
  document.body.classList.remove("cinema-mode");
  el.cinemaOverlay.classList.add("hidden");
}

function handleHotkeys(event) {
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;

  if (event.code === "Space") {
    event.preventDefault();
    togglePlayPause();
  }
  if (event.key.toLowerCase() === "n") playNext();
  if (event.key.toLowerCase() === "p") playPrevious();
  if (event.key.toLowerCase() === "q") openDrawer("queue");
  if (event.key.toLowerCase() === "l") openDrawer("lyrics");
}

function updateStats() {
  el.statPlaylists.textContent = Object.keys(state.playlists).length;
  el.statFavorites.textContent = state.favorites.length;
  el.statHistory.textContent = state.history.length;
}

function clearAlbumsAndTracks() {
  state.currentArtist = null;
  state.currentAlbum = null;
  state.currentTracks = [];
  state.visibleTracks = [];
  state.albums = [];
  state.visibleAlbums = [];

  el.albumsTitle.textContent = "Álbuns";
  el.albumsGrid.innerHTML = "";
  el.albumFilter.value = "";
  el.albumFilter.disabled = true;
  el.albumSort.disabled = true;
  clearTracksOnly();
}

function clearTracksOnly() {
  state.currentAlbum = null;
  state.currentTracks = [];
  state.visibleTracks = [];

  el.tracksTitle.textContent = "Músicas";
  el.tracksList.innerHTML = emptyState("Clica num álbum para carregar as músicas.");
  el.albumInfo.classList.add("hidden");
  el.trackFilter.value = "";
  el.trackFilter.disabled = true;
  setTrackControls(false);
}

async function api(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Erro ${response.status}`);
  }

  return data;
}

function showMessage(text, type = "info") {
  el.messageBox.textContent = text;
  el.messageBox.className = `message-box ${type}`;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => el.messageBox.classList.add("hidden"), 6000);
}

function skeletonCards(count) {
  return Array.from({ length: count }, () => `<div class="skeleton-card"></div>`).join("");
}

function skeletonTracks(count) {
  return Array.from({ length: count }, () => `<div class="skeleton-track"></div>`).join("");
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function defaultCover() {
  return "https://placehold.co/700x700/110b18/f3c96b?text=Album";
}

function makeTrackUid(track) {
  return [
    track.trackId || "",
    track.artistName || "",
    track.collectionName || "",
    track.trackName || "",
  ].join("::").toLowerCase();
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function normalizeClient(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function secondsToTime(value) {
  const total = Math.max(0, Math.floor(Number(value || 0)));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
